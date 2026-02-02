/**
 * AI Providers Example - ai-database
 *
 * This example demonstrates configuring different AI providers:
 * - OpenAI (GPT-4, etc.)
 * - Anthropic (Claude)
 * - Custom provider configuration
 * - Embedding configuration
 * - Rate limiting and error handling
 *
 * Run with: npx tsx examples/07-ai-providers.ts
 *
 * Environment variables:
 *   OPENAI_API_KEY - Your OpenAI API key
 *   ANTHROPIC_API_KEY - Your Anthropic API key
 *   AI_GATEWAY_URL - Optional: Cloudflare AI Gateway URL for caching/logging
 */

import {
  DB,
  setProvider,
  createMemoryProvider,
  configureAIGeneration,
  getAIGenerationConfig,
} from '../src/index.js'
import type { DatabaseSchema, AIGenerationConfig } from '../src/index.js'

async function main() {
  console.log('=== AI Providers Example ===\n')

  // Initialize the database provider
  setProvider(createMemoryProvider())

  // ====================================
  // Section 1: Basic Provider Configuration
  // ====================================
  console.log('--- Section 1: Basic Configuration ---\n')

  // Configure with Anthropic Claude (default)
  configureAIGeneration({
    enabled: true,
    model: 'sonnet', // Uses Claude Sonnet
  })

  console.log('Configured with Claude Sonnet')
  console.log('Current config:', getAIGenerationConfig())

  // ====================================
  // Section 2: OpenAI Configuration
  // ====================================
  console.log('\n--- Section 2: OpenAI Configuration ---\n')

  // Configure with OpenAI
  configureAIGeneration({
    enabled: true,
    model: 'gpt-4o', // OpenAI GPT-4 Turbo
    // Optional: Override with environment variable
    // apiKey: process.env.OPENAI_API_KEY,
  })

  console.log('Configured with OpenAI GPT-4o')

  // Alternative models
  const openaiModels = [
    { name: 'gpt-4o', description: 'Most capable, best for complex tasks' },
    { name: 'gpt-4o-mini', description: 'Faster, cheaper, good for most tasks' },
    { name: 'gpt-4', description: 'Original GPT-4, still very capable' },
    { name: 'gpt-3.5-turbo', description: 'Fast and cost-effective' },
  ]

  console.log('\nAvailable OpenAI models:')
  for (const model of openaiModels) {
    console.log(`  - ${model.name}: ${model.description}`)
  }

  // ====================================
  // Section 3: Anthropic Configuration
  // ====================================
  console.log('\n--- Section 3: Anthropic Configuration ---\n')

  // Configure with Anthropic
  configureAIGeneration({
    enabled: true,
    model: 'sonnet', // Claude Sonnet
    // Optional: Override with environment variable
    // apiKey: process.env.ANTHROPIC_API_KEY,
  })

  console.log('Configured with Claude Sonnet')

  // Alternative models
  const anthropicModels = [
    { name: 'opus', description: 'Most capable, best for complex reasoning' },
    { name: 'sonnet', description: 'Balanced performance and speed' },
    { name: 'haiku', description: 'Fastest, best for simple tasks' },
  ]

  console.log('\nAvailable Anthropic models:')
  for (const model of anthropicModels) {
    console.log(`  - ${model.name}: ${model.description}`)
  }

  // ====================================
  // Section 4: AI Gateway (Cloudflare)
  // ====================================
  console.log('\n--- Section 4: AI Gateway (Caching & Logging) ---\n')

  // Using Cloudflare AI Gateway provides:
  // - Request caching (reduces costs, faster responses)
  // - Request logging and analytics
  // - Rate limiting
  // - Fallback providers

  console.log('Cloudflare AI Gateway benefits:')
  console.log('  - Automatic response caching')
  console.log('  - Request/response logging')
  console.log('  - Rate limiting per user/IP')
  console.log('  - Fallback to alternative providers')
  console.log('  - Cost analytics')

  // Example gateway URL format:
  // https://gateway.ai.cloudflare.com/v1/ACCOUNT_ID/GATEWAY_NAME/openai
  // https://gateway.ai.cloudflare.com/v1/ACCOUNT_ID/GATEWAY_NAME/anthropic

  // ====================================
  // Section 5: Embedding Configuration
  // ====================================
  console.log('\n--- Section 5: Embedding Configuration ---\n')

  const schema = {
    Document: {
      title: 'string',
      content: 'markdown',
      category: 'string',
    },
    Product: {
      name: 'string',
      description: 'string',
      sku: 'string',
      price: 'number',
    },
    AuditLog: {
      action: 'string',
      timestamp: 'datetime',
      userId: 'string',
    },
  } as const satisfies DatabaseSchema

  // Configure embeddings per entity type
  const { db } = DB(schema, {
    embeddings: {
      // Documents: embed title and content
      Document: {
        fields: ['title', 'content'],
        // dimensions: 1536, // OpenAI ada-002
      },
      // Products: embed name and description only
      Product: {
        fields: ['name', 'description'],
      },
      // Disable embeddings for audit logs
      AuditLog: false,
    },
  })

  console.log('Embedding configuration:')
  console.log('  Document: title, content')
  console.log('  Product: name, description')
  console.log('  AuditLog: disabled')

  // ====================================
  // Section 6: Generation with Context
  // ====================================
  console.log('\n--- Section 6: Generation with Context ---\n')

  // Schema with AI generation fields
  const genSchema = {
    BlogPost: {
      $instructions: 'Write engaging, informative content',
      title: 'string',
      topic: 'string',
      content: 'Write a blog post about {topic}',
      summary: 'Summarize the post in 2-3 sentences',
      tags: 'Suggest 3-5 relevant tags as comma-separated list',
    },
  } as const satisfies DatabaseSchema

  const { db: blogDb } = DB(genSchema)

  console.log('Schema with generation fields:')
  console.log('  - $instructions: Sets context for all generations')
  console.log('  - content: Generated based on topic')
  console.log('  - summary: Generated from content')
  console.log('  - tags: Generated based on content')

  // Example usage (would generate if AI is enabled)
  console.log('\nTo generate a blog post:')
  console.log(`
  const post = await db.BlogPost.create({
    title: 'Introduction to AI Databases',
    topic: 'How AI-powered databases are changing data management',
  })
  // content, summary, and tags are AI-generated
`)

  // ====================================
  // Section 7: Error Handling
  // ====================================
  console.log('--- Section 7: Error Handling ---\n')

  console.log('Built-in error handling:')
  console.log('  - Automatic retries with exponential backoff')
  console.log('  - Rate limit detection and waiting')
  console.log('  - Graceful degradation when AI unavailable')
  console.log('  - Detailed error messages for debugging')

  // Example error handling pattern
  console.log('\nError handling example:')
  console.log(`
  try {
    const result = await db.Post.create({ title: 'Test' }, { cascade: true })
  } catch (error) {
    if (error.code === 'RATE_LIMIT') {
      console.log('Rate limited, will retry automatically')
    } else if (error.code === 'AI_UNAVAILABLE') {
      console.log('AI generation unavailable, using fallback')
    } else {
      throw error
    }
  }
`)

  // ====================================
  // Section 8: Disabling AI Generation
  // ====================================
  console.log('--- Section 8: Disabling AI Generation ---\n')

  // Disable AI generation globally
  configureAIGeneration({
    enabled: false,
  })

  console.log('AI generation disabled')
  console.log('All generation fields will use default values or remain empty')

  // Re-enable for production
  configureAIGeneration({
    enabled: true,
    model: 'sonnet',
  })

  console.log('AI generation re-enabled with Claude Sonnet')

  // ====================================
  // Section 9: Custom Model Configuration
  // ====================================
  console.log('\n--- Section 9: Custom Configuration ---\n')

  // Full configuration options
  const fullConfig: AIGenerationConfig = {
    enabled: true,
    model: 'sonnet',
    // Additional options (if supported):
    // temperature: 0.7,
    // maxTokens: 4096,
    // topP: 0.9,
  }

  configureAIGeneration(fullConfig)

  console.log('Full configuration applied:')
  console.log(JSON.stringify(fullConfig, null, 2))

  // ====================================
  // Section 10: Best Practices
  // ====================================
  console.log('\n--- Section 10: Best Practices ---\n')

  const bestPractices = [
    'Use environment variables for API keys (never commit keys)',
    'Enable AI Gateway in production for caching and logging',
    'Choose model based on task complexity (Haiku for simple, Opus for complex)',
    'Configure embeddings only for searchable entities',
    'Use $instructions to provide consistent context',
    'Handle rate limits gracefully with retry logic',
    'Monitor costs using provider dashboards',
    'Test with AI disabled to ensure fallback behavior',
  ]

  console.log('Best practices:')
  for (let i = 0; i < bestPractices.length; i++) {
    console.log(`  ${i + 1}. ${bestPractices[i]}`)
  }

  console.log('\n=== AI Providers Example Complete ===')
}

main().catch(console.error)
