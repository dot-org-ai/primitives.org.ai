/**
 * RAG Chatbot Example
 *
 * This example demonstrates building a Retrieval-Augmented Generation (RAG) chatbot
 * using ai-functions. It shows how to:
 * - Generate embeddings for documents
 * - Perform semantic search
 * - Generate context-aware responses
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/01-rag-chatbot.ts
 * ```
 */

import {
  write,
  list,
  configure,
  EmbeddingCache,
  MemoryCache,
  GenerationCache,
  withRetry,
} from '../src/index.js'

// ============================================================================
// Document Store (In-memory for this example)
// ============================================================================

interface Document {
  id: string
  content: string
  embedding?: number[]
}

const documents: Document[] = [
  {
    id: 'doc-1',
    content:
      'ai-functions is a TypeScript library that simplifies AI integration. It provides template literals for natural AI calls like `const poem = await write`a haiku about TypeScript``.',
  },
  {
    id: 'doc-2',
    content:
      'The library supports batch processing with 50% cost savings through provider batch APIs. Use createBatch() to process large workloads efficiently.',
  },
  {
    id: 'doc-3',
    content:
      'Built-in retry logic with exponential backoff handles rate limits automatically. Use withRetry() or RetryPolicy for custom retry behavior.',
  },
  {
    id: 'doc-4',
    content:
      'Budget tracking monitors token usage and costs. BudgetTracker supports alerts at configurable thresholds and enforces spending limits.',
  },
  {
    id: 'doc-5',
    content:
      'The list primitive generates arrays with automatic batching. Use list`5 ideas`.map() to process each item in parallel.',
  },
]

// ============================================================================
// Simple Embedding Simulation (replace with real embeddings in production)
// ============================================================================

function simulateEmbedding(text: string): number[] {
  // Simple word-based embedding simulation
  // In production, use a real embedding model
  const words = text.toLowerCase().split(/\s+/)
  const embedding = new Array(128).fill(0)

  for (const word of words) {
    const hash = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    embedding[hash % 128] += 1
  }

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((acc, val) => acc + val * val, 0))
  return embedding.map((val) => (magnitude > 0 ? val / magnitude : 0))
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
  }
  return dotProduct
}

// ============================================================================
// RAG Chatbot Implementation
// ============================================================================

class RAGChatbot {
  private documents: Document[]
  private responseCache: GenerationCache

  constructor(documents: Document[]) {
    this.documents = documents
    this.responseCache = new GenerationCache({
      defaultTTL: 3600000, // 1 hour cache
    })

    // Generate embeddings for all documents
    for (const doc of this.documents) {
      doc.embedding = simulateEmbedding(doc.content)
    }
  }

  /**
   * Find the most relevant documents for a query
   */
  private findRelevantDocs(query: string, topK: number = 3): Document[] {
    const queryEmbedding = simulateEmbedding(query)

    const scored = this.documents.map((doc) => ({
      doc,
      score: cosineSimilarity(queryEmbedding, doc.embedding!),
    }))

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(({ doc }) => doc)
  }

  /**
   * Generate a response using RAG
   */
  async chat(userMessage: string): Promise<string> {
    console.log(`\nUser: ${userMessage}`)
    console.log('---')

    // Step 1: Retrieve relevant documents
    const relevantDocs = this.findRelevantDocs(userMessage)
    console.log(`Found ${relevantDocs.length} relevant documents`)

    // Step 2: Build context from retrieved documents
    const context = relevantDocs.map((doc, i) => `[Source ${i + 1}]: ${doc.content}`).join('\n\n')

    // Step 3: Generate response with context
    const response =
      await write`You are a helpful assistant that answers questions about ai-functions library.

Context from documentation:
${context}

User Question: ${userMessage}

Please provide a helpful, accurate response based on the context above. If the context doesn't contain enough information, say so.`

    console.log(`Assistant: ${response}`)
    return response
  }

  /**
   * Generate follow-up questions
   */
  async suggestFollowUps(topic: string): Promise<string[]> {
    const suggestions =
      await list`3 follow-up questions someone might ask about ${topic} related to ai-functions library`
    return suggestions
  }
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== RAG Chatbot Example ===\n')

  // Configure the AI provider
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  // Initialize the chatbot with our documents
  const chatbot = new RAGChatbot(documents)

  // Example conversation
  const questions = [
    'How do I generate a list of items?',
    'What are the cost savings for batch processing?',
    'How does retry handling work?',
  ]

  for (const question of questions) {
    await chatbot.chat(question)
    console.log('')
  }

  // Generate follow-up suggestions
  console.log('\n--- Suggested follow-up questions ---')
  const followUps = await chatbot.suggestFollowUps('batch processing')
  for (const suggestion of followUps) {
    console.log(`- ${suggestion}`)
  }
}

main()
  .then(() => {
    console.log('\n=== Example Complete ===\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nError:', error.message)
    process.exit(1)
  })
