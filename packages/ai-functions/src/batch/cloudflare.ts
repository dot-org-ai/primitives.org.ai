/**
 * Cloudflare AI Gateway Batch Adapter
 *
 * Implements batch processing using Cloudflare AI Gateway's batch endpoint.
 * Cloudflare's batch API is newer but integrates well with Workers.
 *
 * Note: Cloudflare's batch API is evolving. This adapter implements
 * the current batch capabilities and can be extended as new features land.
 *
 * @see https://developers.cloudflare.com/ai-gateway/
 *
 * @packageDocumentation
 */

import {
  registerBatchAdapter,
  type BatchAdapter,
  type BatchItem,
  type BatchJob,
  type BatchQueueOptions,
  type BatchResult,
  type BatchSubmitResult,
  type BatchStatus,
} from '../batch-queue.js'
import { schema as convertSchema } from '../schema.js'

// ============================================================================
// Types
// ============================================================================

interface CloudflareBatchRequest {
  id: string
  provider: string
  endpoint: string
  headers: Record<string, string>
  query: {
    model: string
    messages: Array<{ role: string; content: string }>
    response_format?: { type: 'json_object' }
    max_tokens?: number
    temperature?: number
  }
}

interface CloudflareBatchResponse {
  id: string
  success: boolean
  result?: {
    response: string
    usage?: {
      prompt_tokens: number
      completion_tokens: number
      total_tokens: number
    }
  }
  error?: {
    message: string
    code?: string
  }
}

interface CloudflareBatchJob {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  completed_at?: string
  request_count: number
  completed_count: number
  failed_count: number
  results_url?: string
}

// ============================================================================
// Cloudflare Client Configuration
// ============================================================================

let accountId: string | undefined
let gatewayId: string | undefined
let apiToken: string | undefined
let baseUrl = 'https://api.cloudflare.com/client/v4'

/**
 * Configure the Cloudflare client
 */
export function configureCloudflare(options: {
  accountId?: string
  gatewayId?: string
  apiToken?: string
  baseUrl?: string
}): void {
  if (options.accountId) accountId = options.accountId
  if (options.gatewayId) gatewayId = options.gatewayId
  if (options.apiToken) apiToken = options.apiToken
  if (options.baseUrl) baseUrl = options.baseUrl
}

function getConfig(): { accountId: string; gatewayId: string; apiToken: string } {
  const accId = accountId || process.env['CLOUDFLARE_ACCOUNT_ID']
  const gwId = gatewayId || process.env['CLOUDFLARE_AI_GATEWAY_ID'] || process.env['AI_GATEWAY_ID']
  const token = apiToken || process.env['CLOUDFLARE_API_TOKEN']

  if (!accId) {
    throw new Error(
      'Cloudflare account ID not configured. Set CLOUDFLARE_ACCOUNT_ID or call configureCloudflare()'
    )
  }
  if (!gwId) {
    throw new Error(
      'Cloudflare AI Gateway ID not configured. Set CLOUDFLARE_AI_GATEWAY_ID or call configureCloudflare()'
    )
  }
  if (!token) {
    throw new Error(
      'Cloudflare API token not configured. Set CLOUDFLARE_API_TOKEN or call configureCloudflare()'
    )
  }

  return { accountId: accId, gatewayId: gwId, apiToken: token }
}

async function cloudflareRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  const config = getConfig()
  const url = `${baseUrl}${path}`

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Cloudflare API error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as { success: boolean; result: T; errors?: unknown[] }
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`)
  }

  return data.result
}

// ============================================================================
// In-memory job storage (for polling)
// ============================================================================

const pendingJobs = new Map<
  string,
  {
    items: BatchItem[]
    options: BatchQueueOptions
    results: BatchResult[]
    status: BatchStatus
    createdAt: Date
    completedAt?: Date
  }
>()

let jobCounter = 0

// ============================================================================
// Cloudflare Batch Adapter
// ============================================================================

/**
 * Cloudflare batch adapter
 *
 * Note: Cloudflare's AI Gateway doesn't have a native batch API like OpenAI/Anthropic.
 * This adapter implements batch processing by:
 * 1. Sending requests concurrently through the gateway
 * 2. Utilizing Cloudflare's caching and rate limiting
 * 3. Tracking job state locally (or in D1/KV for production)
 *
 * For true async batch processing, consider using Cloudflare Queues + Workers.
 */
const cloudflareAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const config = getConfig()
    const jobId = `cf_batch_${++jobCounter}_${Date.now()}`
    const model = options.model || 'mistral/mistral-7b-instruct-v0.1'

    // Store job state
    pendingJobs.set(jobId, {
      items,
      options,
      results: [],
      status: 'pending',
      createdAt: new Date(),
    })

    // Process requests concurrently (Cloudflare handles rate limiting)
    const completion = processCloudflareRequests(jobId, items, config, model, options)

    const job: BatchJob = {
      id: jobId,
      provider: 'cloudflare',
      status: 'pending',
      totalItems: items.length,
      completedItems: 0,
      failedItems: 0,
      createdAt: new Date(),
      ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
    }

    return { job, completion }
  },

  async getStatus(batchId: string): Promise<BatchJob> {
    const job = pendingJobs.get(batchId)
    if (!job) {
      throw new Error(`Batch not found: ${batchId}`)
    }

    const completedItems = job.results.filter((r) => r.status === 'completed').length
    const failedItems = job.results.filter((r) => r.status === 'failed').length

    return {
      id: batchId,
      provider: 'cloudflare',
      status: job.status,
      totalItems: job.items.length,
      completedItems,
      failedItems,
      createdAt: job.createdAt,
      ...(job.completedAt && { completedAt: job.completedAt }),
    }
  },

  async cancel(batchId: string): Promise<void> {
    const job = pendingJobs.get(batchId)
    if (job) {
      job.status = 'cancelled'
    }
  },

  async getResults(batchId: string): Promise<BatchResult[]> {
    const job = pendingJobs.get(batchId)
    if (!job) {
      throw new Error(`Batch not found: ${batchId}`)
    }
    return job.results
  },

  async waitForCompletion(batchId: string, pollInterval = 1000): Promise<BatchResult[]> {
    const job = pendingJobs.get(batchId)
    if (!job) {
      throw new Error(`Batch not found: ${batchId}`)
    }

    while (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    return job.results
  },
}

// ============================================================================
// Processing
// ============================================================================

async function processCloudflareRequests(
  jobId: string,
  items: BatchItem[],
  config: { accountId: string; gatewayId: string; apiToken: string },
  model: string,
  options: BatchQueueOptions
): Promise<BatchResult[]> {
  const job = pendingJobs.get(jobId)
  if (!job) {
    throw new Error(`Job not found: ${jobId}`)
  }

  job.status = 'in_progress'

  // Process all requests concurrently with concurrency limit
  const CONCURRENCY = 10
  const results: BatchResult[] = []

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          const result = await processCloudflareItem(item, config, model)
          return result
        } catch (error) {
          return {
            id: item.id,
            customId: item.id,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })
    )

    results.push(...batchResults)
    job.results = results
  }

  job.status = results.every((r) => r.status === 'completed') ? 'completed' : 'failed'
  job.completedAt = new Date()

  return results
}

async function processCloudflareItem(
  item: BatchItem,
  config: { accountId: string; gatewayId: string; apiToken: string },
  model: string
): Promise<BatchResult> {
  // Route through AI Gateway
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}`

  // Determine provider from model
  let provider = 'workers-ai'
  let endpoint = ''

  if (model.startsWith('openai/') || model.startsWith('gpt-')) {
    provider = 'openai'
    endpoint = '/chat/completions'
  } else if (model.startsWith('anthropic/') || model.startsWith('claude-')) {
    provider = 'anthropic'
    endpoint = '/messages'
  } else if (model.startsWith('@cf/') || model.startsWith('workers-ai/')) {
    provider = 'workers-ai'
    endpoint = `/ai/run/${model.replace('workers-ai/', '').replace('@cf/', '')}`
  } else {
    // Default to OpenAI-compatible
    provider = 'openai'
    endpoint = '/chat/completions'
  }

  const url = `${gatewayUrl}/${provider}${endpoint}`

  const messages = [
    ...(item.options?.system ? [{ role: 'system', content: item.options.system }] : []),
    { role: 'user', content: item.prompt },
  ]

  const body: Record<string, unknown> = {
    model: model.replace(`${provider}/`, ''),
    messages,
    max_tokens: item.options?.maxTokens || 4096,
    ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
  }

  // Add JSON mode if schema is provided
  if (item.schema) {
    body['response_format'] = { type: 'json_object' }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'cf-aig-authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Cloudflare Gateway error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message: { content: string } }>
    content?: Array<{ text: string }>
    response?: string
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }

  // Extract content based on response format
  let content: string | undefined

  if (data.choices?.[0]?.message?.content) {
    // OpenAI format
    content = data.choices[0].message.content
  } else if (data.content?.[0]?.text) {
    // Anthropic format
    content = data.content[0].text
  } else if (data.response) {
    // Workers AI format
    content = data.response
  }

  let result: unknown = content

  // Try to parse JSON if schema was provided
  if (item.schema && content) {
    try {
      result = JSON.parse(content)
    } catch {
      // Keep as string
    }
  }

  return {
    id: item.id,
    customId: item.id,
    status: 'completed',
    result,
    ...(data.usage && {
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    }),
  }
}

// ============================================================================
// Register Adapter
// ============================================================================

registerBatchAdapter('cloudflare', cloudflareAdapter)

export { cloudflareAdapter }
