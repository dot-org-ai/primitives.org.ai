/**
 * RAG Chatbot Example - ai-database
 *
 * This example demonstrates building a RAG (Retrieval-Augmented Generation) chatbot
 * using ai-database's semantic search capabilities:
 * - Vector embeddings for documents
 * - Semantic search to find relevant context
 * - Hybrid search combining keyword and semantic matching
 *
 * Run with: npx tsx examples/02-rag-chatbot.ts
 */

import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

async function main() {
  // Initialize provider with embedding support
  setProvider(createMemoryProvider())

  // Enable AI generation for the chatbot responses
  configureAIGeneration({
    enabled: true,
    model: 'sonnet', // Use Claude Sonnet for generation
  })

  // Define schema for knowledge base and conversations
  const schema = {
    // Knowledge base documents for RAG
    Document: {
      title: 'string',
      content: 'markdown',
      source: 'string',
      category: 'string?',
    },

    // Chat conversations
    Conversation: {
      title: 'string',
      createdAt: 'datetime',
      messages: ['<-Message.conversation'],
    },

    // Individual messages in a conversation
    Message: {
      role: 'string', // 'user' or 'assistant'
      content: 'string',
      conversation: '->Conversation',
      // Store which documents were used as context
      contextDocs: 'json?',
    },
  } as const satisfies DatabaseSchema

  const { db } = DB(schema, {
    // Configure embeddings for semantic search
    embeddings: {
      Document: {
        fields: ['title', 'content'], // Embed title and content
      },
      // Don't embed messages (optional)
      Message: false,
    },
  })

  console.log('=== RAG Chatbot Example ===\n')

  // Step 1: Populate the knowledge base
  console.log('--- Populating Knowledge Base ---\n')

  const docs = [
    {
      title: 'Introduction to Machine Learning',
      content: `# Machine Learning Basics

Machine learning is a subset of artificial intelligence that enables systems to learn and improve from experience without being explicitly programmed.

## Key Concepts
- **Supervised Learning**: Learning from labeled data
- **Unsupervised Learning**: Finding patterns in unlabeled data
- **Reinforcement Learning**: Learning through trial and error

## Common Applications
- Image recognition
- Natural language processing
- Recommendation systems
- Fraud detection`,
      source: 'ml-handbook',
      category: 'AI/ML',
    },
    {
      title: 'Neural Networks Explained',
      content: `# Neural Networks

Neural networks are computing systems inspired by biological neural networks in the brain.

## Architecture
- **Input Layer**: Receives the raw data
- **Hidden Layers**: Process and transform data
- **Output Layer**: Produces the final result

## Types of Neural Networks
- **Feedforward**: Information flows in one direction
- **Convolutional (CNN)**: Specialized for image processing
- **Recurrent (RNN)**: Handles sequential data
- **Transformer**: State-of-the-art for NLP tasks`,
      source: 'deep-learning-guide',
      category: 'AI/ML',
    },
    {
      title: 'Database Design Principles',
      content: `# Database Design

Good database design is crucial for application performance and maintainability.

## Normalization
- Remove data redundancy
- Ensure data integrity
- Use appropriate normal forms (1NF, 2NF, 3NF)

## Indexing Strategies
- Primary keys for unique identification
- Foreign keys for relationships
- Composite indexes for complex queries

## Best Practices
- Choose appropriate data types
- Plan for scalability
- Consider query patterns`,
      source: 'db-handbook',
      category: 'Databases',
    },
    {
      title: 'API Design Best Practices',
      content: `# RESTful API Design

Building well-designed APIs is essential for modern applications.

## Core Principles
- Use meaningful resource names
- Proper HTTP methods (GET, POST, PUT, DELETE)
- Consistent error handling
- Version your APIs

## Security
- Authentication (OAuth, JWT)
- Rate limiting
- Input validation
- HTTPS everywhere`,
      source: 'api-guide',
      category: 'Development',
    },
  ]

  for (const doc of docs) {
    await db.Document.create(doc)
    console.log(`Added: ${doc.title}`)
  }

  console.log(`\nKnowledge base loaded with ${docs.length} documents\n`)

  // Step 2: Create a conversation
  console.log('--- Starting Conversation ---\n')

  const conversation = await db.Conversation.create({
    title: 'Learning about AI',
    createdAt: new Date(),
  })

  // Step 3: Simulate RAG workflow
  async function askQuestion(question: string) {
    console.log(`User: ${question}\n`)

    // Save user message
    await db.Message.create({
      role: 'user',
      content: question,
      conversation: conversation.$id,
    })

    // Step 3a: Semantic search to find relevant documents
    const relevantDocs = await db.Document.semanticSearch(question, {
      limit: 2,
      minScore: 0.3, // Minimum similarity threshold
    })

    console.log('Retrieved context:')
    for (const doc of relevantDocs) {
      console.log(`  - ${doc.title} (score: ${doc.$score?.toFixed(3)})`)
    }

    // Step 3b: Build context from retrieved documents
    const context = relevantDocs.map((doc) => `## ${doc.title}\n${doc.content}`).join('\n\n')

    // Step 3c: Generate response (simulated - in production, call your LLM)
    const response = generateResponse(question, context, relevantDocs)

    // Save assistant message with context reference
    await db.Message.create({
      role: 'assistant',
      content: response,
      conversation: conversation.$id,
      contextDocs: relevantDocs.map((d) => ({ id: d.$id, title: d.title })),
    })

    console.log(`\nAssistant: ${response}\n`)
    console.log('---\n')

    return response
  }

  // Simulated response generation (replace with actual LLM call)
  function generateResponse(question: string, context: string, docs: any[]): string {
    // In production, you would call your LLM here with:
    // - The user question
    // - The retrieved context
    // - System prompt for RAG

    if (docs.length === 0) {
      return "I don't have enough information in my knowledge base to answer that question."
    }

    // Simulated responses based on context
    if (context.includes('Machine Learning') || context.includes('Neural Networks')) {
      return `Based on my knowledge base, ${docs[0].title} provides relevant information. Machine learning enables systems to learn from data, with key approaches including supervised learning (labeled data), unsupervised learning (finding patterns), and reinforcement learning (trial and error). Neural networks are particularly powerful for complex pattern recognition tasks.`
    }

    if (context.includes('Database') || context.includes('API')) {
      return `According to my documentation on ${docs[0].title}, proper design principles are essential. For databases, focus on normalization and indexing. For APIs, use RESTful conventions with proper HTTP methods and security measures.`
    }

    return `Based on the retrieved documents (${docs
      .map((d) => d.title)
      .join(', ')}), I can provide information about your question.`
  }

  // Ask some questions
  await askQuestion('What is machine learning and how does it work?')
  await askQuestion('Can you explain neural network architecture?')
  await askQuestion('What are the best practices for API design?')

  // Step 4: Hybrid search example
  console.log('--- Hybrid Search Demo ---\n')

  const hybridResults = await db.Document.hybridSearch('neural network deep learning', {
    ftsWeight: 0.4, // 40% keyword matching
    semanticWeight: 0.6, // 60% semantic similarity
    limit: 3,
  })

  console.log('Hybrid search results (keyword + semantic):')
  for (const doc of hybridResults) {
    console.log(`  - ${doc.title}`)
    console.log(`    RRF Score: ${doc.$rrfScore?.toFixed(3)}`)
  }

  // Step 5: Show conversation history
  console.log('\n--- Conversation History ---\n')

  const messages = await conversation.messages
  for (const msg of messages) {
    const prefix = msg.role === 'user' ? 'User' : 'Bot'
    console.log(`${prefix}: ${msg.content.substring(0, 80)}...`)
  }

  console.log('\n=== RAG Chatbot Example Complete ===')
}

main().catch(console.error)
