/**
 * Edge Function Deployment Example (Cloudflare Workers)
 *
 * This example demonstrates deploying ai-functions on Cloudflare Workers.
 * It shows how to:
 * - Configure for edge runtime
 * - Handle request/response patterns
 * - Use Workers AI or external providers
 * - Implement rate limiting and caching
 *
 * Note: This file demonstrates the patterns. To actually deploy, you would:
 * 1. npm create cloudflare@latest
 * 2. Add ai-functions as a dependency
 * 3. Use this code in src/index.ts
 *
 * @example
 * ```bash
 * # Local development
 * npx wrangler dev
 *
 * # Deploy
 * npx wrangler deploy
 * ```
 */

import {
  ai,
  write,
  list,
  is,
  configure,
  MemoryCache,
  withRetry,
  GenerationCache,
} from '../src/index.js'

// ============================================================================
// Types
// ============================================================================

interface Env {
  AI_GATEWAY_URL?: string
  ANTHROPIC_API_KEY?: string
  OPENAI_API_KEY?: string
  KV_CACHE?: unknown // KVNamespace in actual Workers
  RATE_LIMIT_KV?: unknown
}

interface RequestBody {
  action: 'generate' | 'classify' | 'extract' | 'summarize'
  input: string
  options?: Record<string, unknown>
}

interface APIResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  meta?: {
    requestId: string
    latencyMs: number
    cached: boolean
  }
}

// ============================================================================
// Worker Handler
// ============================================================================

/**
 * Main worker handler (Cloudflare Workers format)
 *
 * In actual wrangler.toml:
 * ```toml
 * name = "ai-functions-worker"
 * main = "src/index.ts"
 * compatibility_date = "2024-01-01"
 *
 * [vars]
 * AI_GATEWAY_URL = "https://your-gateway.com"
 *
 * [[kv_namespaces]]
 * binding = "KV_CACHE"
 * id = "your-kv-namespace-id"
 * ```
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const startTime = Date.now()
  const requestId = crypto.randomUUID()

  // Configure ai-functions
  configure({
    model: 'sonnet',
    provider: 'anthropic',
    // In production, use env variables
  })

  // CORS headers for API
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  // Handle OPTIONS for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Parse request
    const body = (await request.json()) as RequestBody

    // Process based on action
    let result: unknown
    let cached = false

    switch (body.action) {
      case 'generate':
        result = await handleGenerate(body.input, body.options)
        break
      case 'classify':
        result = await handleClassify(body.input, body.options)
        break
      case 'extract':
        result = await handleExtract(body.input, body.options)
        break
      case 'summarize':
        result = await handleSummarize(body.input, body.options)
        break
      default:
        throw new Error(`Unknown action: ${body.action}`)
    }

    const response: APIResponse = {
      success: true,
      data: result,
      meta: {
        requestId,
        latencyMs: Date.now() - startTime,
        cached,
      },
    }

    return new Response(JSON.stringify(response), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: (error as Error).message,
      meta: {
        requestId,
        latencyMs: Date.now() - startTime,
        cached: false,
      },
    }

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    })
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

async function handleGenerate(input: string, options?: Record<string, unknown>): Promise<unknown> {
  const { type = 'text', schema } = options || {}

  if (type === 'text') {
    return write`${input}`
  }

  if (schema) {
    return ai`${input}`
  }

  return ai`${input}`
}

async function handleClassify(input: string, options?: Record<string, unknown>): Promise<unknown> {
  const { categories = ['positive', 'negative', 'neutral'] } = options || {}

  const { category, confidence, reasoning } =
    await ai`Classify this text into one of these categories: ${(categories as string[]).join(', ')}

Text: "${input}"

Provide:
- category: the best matching category
- confidence: confidence score 0-1
- reasoning: brief explanation`

  return { category, confidence, reasoning }
}

async function handleExtract(input: string, options?: Record<string, unknown>): Promise<unknown> {
  const { fields } = options || {}

  if (fields && Array.isArray(fields)) {
    const fieldDescriptions = (fields as string[]).map((f) => `- ${f}`).join('\n')

    return ai`Extract the following fields from this text:
${fieldDescriptions}

Text: "${input}"`
  }

  // Default entity extraction
  const { entities, dates, amounts, names } = await ai`Extract key information from this text:

"${input}"

Provide:
- entities: array of key entities mentioned
- dates: array of dates found
- amounts: array of monetary amounts or quantities
- names: array of person/company names`

  return { entities, dates, amounts, names }
}

async function handleSummarize(input: string, options?: Record<string, unknown>): Promise<unknown> {
  const { maxLength = 100, style = 'concise' } = options || {}

  const summary = await write`Summarize this text in a ${style} style, maximum ${maxLength} words:

"${input}"`

  return { summary, wordCount: summary.split(/\s+/).length }
}

// ============================================================================
// Middleware Utilities
// ============================================================================

/**
 * Simple in-memory rate limiter (use KV in production)
 */
class RateLimiter {
  private requests = new Map<string, number[]>()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  check(key: string): boolean {
    const now = Date.now()
    const windowStart = now - this.windowMs

    let timestamps = this.requests.get(key) || []
    timestamps = timestamps.filter((t) => t > windowStart)

    if (timestamps.length >= this.maxRequests) {
      return false
    }

    timestamps.push(now)
    this.requests.set(key, timestamps)
    return true
  }
}

/**
 * Request caching utility
 */
class RequestCache {
  private cache: GenerationCache

  constructor() {
    this.cache = new GenerationCache({
      defaultTTL: 3600000, // 1 hour
      maxSize: 1000,
    })
  }

  async get(key: string): Promise<unknown | null> {
    return this.cache.get({ prompt: key, model: 'cache' })
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.cache.set({ prompt: key, model: 'cache' }, value)
  }
}

// ============================================================================
// Streaming Response Handler
// ============================================================================

async function handleStreamingRequest(request: Request, env: Env): Promise<Response> {
  const { input } = (await request.json()) as { input: string }

  // Configure for streaming
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  const response = write`${input}`
  const stream = response.stream()

  // Create a TransformStream for SSE
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  // Stream in background
  ;(async () => {
    try {
      for await (const chunk of stream.textStream) {
        await writer.write(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
      }
      await writer.write(encoder.encode('data: [DONE]\n\n'))
    } finally {
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

// ============================================================================
// Simulated Worker Execution
// ============================================================================

async function simulateWorkerExecution(): Promise<void> {
  console.log('\n=== Simulating Cloudflare Worker Execution ===\n')

  const rateLimiter = new RateLimiter(10, 10000) // 10 requests per 10 seconds
  const cache = new RequestCache()

  // Simulate various API requests
  const testRequests = [
    {
      action: 'generate' as const,
      input: 'Write a tagline for a coffee shop',
    },
    {
      action: 'classify' as const,
      input: 'I absolutely love this product! Best purchase ever!',
      options: { categories: ['positive', 'negative', 'neutral'] },
    },
    {
      action: 'extract' as const,
      input: 'Contact John Smith at john@example.com or call 555-1234',
      options: { fields: ['name', 'email', 'phone'] },
    },
    {
      action: 'summarize' as const,
      input:
        'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet and is commonly used for testing purposes.',
      options: { maxLength: 20, style: 'brief' },
    },
  ]

  for (const body of testRequests) {
    console.log(`\n--- ${body.action.toUpperCase()} Request ---`)
    console.log(`Input: "${body.input.substring(0, 50)}..."`)

    // Check rate limit
    const clientIP = '127.0.0.1'
    if (!rateLimiter.check(clientIP)) {
      console.log('Rate limited!')
      continue
    }

    // Create mock request
    const request = new Request('https://worker.example.com/api', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    })

    // Handle request
    const startTime = Date.now()
    const response = await handleRequest(request, {} as Env)
    const result = (await response.json()) as APIResponse

    console.log(`Response: ${response.status}`)
    console.log(`Latency: ${Date.now() - startTime}ms`)
    console.log(`Result:`, JSON.stringify(result.data, null, 2).substring(0, 200))
  }
}

// ============================================================================
// Export Worker
// ============================================================================

/**
 * In actual Cloudflare Worker (src/index.ts):
 *
 * ```ts
 * export default {
 *   async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
 *     // Check for streaming request
 *     if (request.url.includes('/stream')) {
 *       return handleStreamingRequest(request, env)
 *     }
 *     return handleRequest(request, env)
 *   },
 * }
 * ```
 */

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== Cloudflare Worker Example ===\n')

  // Configure the AI provider (for local simulation)
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  // Show worker code structure
  console.log('Worker Code Structure:')
  console.log(`
// wrangler.toml
name = "ai-functions-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
AI_MODEL = "sonnet"

// src/index.ts
import { ai, write, configure } from 'ai-functions'

export default {
  async fetch(request, env, ctx) {
    configure({ model: env.AI_MODEL })

    const { prompt } = await request.json()
    const response = await write\`\${prompt}\`

    return new Response(JSON.stringify({ response }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
`)

  // Run simulation
  await simulateWorkerExecution()

  console.log('\n--- Deployment Instructions ---')
  console.log('1. npm create cloudflare@latest my-ai-worker')
  console.log('2. cd my-ai-worker && npm install ai-functions')
  console.log('3. Copy the handler code to src/index.ts')
  console.log('4. npx wrangler dev (for local testing)')
  console.log('5. npx wrangler deploy (for production)')
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
