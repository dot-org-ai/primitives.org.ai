/**
 * Cloudflare AI Gateway Adapter
 *
 * Cloudflare's AI Gateway doesn't have a native batch API like OpenAI/Anthropic,
 * so this adapter fakes batch processing via concurrent direct calls through
 * the gateway and tracks state locally (`LocalJobStore` from `./provider.js`).
 *
 * For true async batch processing, consider Cloudflare Queues + Workers.
 *
 * @see https://developers.cloudflare.com/ai-gateway/
 *
 * @packageDocumentation
 */

import {
  LocalJobStore,
  processConcurrently,
  registerBatchAdapter,
  tryParseJson,
  type BatchAdapter,
  type BatchItem,
  type BatchJob,
  type BatchQueueOptions,
  type BatchResult,
  type BatchSubmitResult,
} from './provider.js'

// ============================================================================
// Cloudflare client configuration
// ============================================================================

let accountId: string | undefined
let gatewayId: string | undefined
let apiToken: string | undefined

/** Configure the Cloudflare client. */
export function configureCloudflare(options: {
  accountId?: string
  gatewayId?: string
  apiToken?: string
  /** Reserved for tests / custom hosts; the gateway URL itself is fixed. */
  baseUrl?: string
}): void {
  if (options.accountId) accountId = options.accountId
  if (options.gatewayId) gatewayId = options.gatewayId
  if (options.apiToken) apiToken = options.apiToken
  // baseUrl is accepted for backwards compatibility but unused.
  void options.baseUrl
}

interface CloudflareConfig {
  accountId: string
  gatewayId: string
  apiToken: string
}

function getConfig(): CloudflareConfig {
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

// ============================================================================
// Local job tracking
// ============================================================================

const jobs = new LocalJobStore('cf_batch')

// ============================================================================
// Cloudflare batch adapter (BatchProvider port)
// ============================================================================

const cloudflareAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const config = getConfig()
    const model = options.model || 'mistral/mistral-7b-instruct-v0.1'
    const { id, state } = jobs.create(items, options)

    const completion = (async () => {
      state.status = 'in_progress'
      const results = await processConcurrently(
        items,
        (item) => processCloudflareItem(item, config, model),
        {
          concurrency: 10,
          onWaveComplete: (partial) => {
            state.results = partial
          },
        }
      )
      state.results = results
      state.status = results.every((r) => r.status === 'completed') ? 'completed' : 'failed'
      state.completedAt = new Date()
      return results
    })()

    const job: BatchJob = {
      id,
      provider: 'cloudflare',
      status: 'pending',
      totalItems: items.length,
      completedItems: 0,
      failedItems: 0,
      createdAt: state.createdAt,
      ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
    }

    return { job, completion }
  },

  async getStatus(batchId: string): Promise<BatchJob> {
    return jobs.snapshot(batchId, 'cloudflare')
  },

  async cancel(batchId: string): Promise<void> {
    if (jobs.has(batchId)) {
      jobs.get(batchId).status = 'cancelled'
    }
  },

  async getResults(batchId: string): Promise<BatchResult[]> {
    return jobs.get(batchId).results
  },

  async waitForCompletion(batchId: string, pollInterval = 1000): Promise<BatchResult[]> {
    return jobs.waitForCompletion(batchId, pollInterval)
  },
}

// ============================================================================
// Per-item processing
// ============================================================================

async function processCloudflareItem(
  item: BatchItem,
  config: CloudflareConfig,
  model: string
): Promise<BatchResult> {
  const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${config.accountId}/${config.gatewayId}`
  const { provider, endpoint } = routeForModel(model)
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
    ...(item.schema && { response_format: { type: 'json_object' } }),
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

  // Extract content based on which downstream provider answered.
  const content =
    data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? data.response ?? undefined

  return {
    id: item.id,
    customId: item.id,
    status: 'completed',
    result: tryParseJson(content, !!item.schema),
    ...(data.usage && {
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
    }),
  }
}

/** Map a model id to the AI Gateway provider segment + endpoint path. */
function routeForModel(model: string): { provider: string; endpoint: string } {
  if (model.startsWith('openai/') || model.startsWith('gpt-')) {
    return { provider: 'openai', endpoint: '/chat/completions' }
  }
  if (model.startsWith('anthropic/') || model.startsWith('claude-')) {
    return { provider: 'anthropic', endpoint: '/messages' }
  }
  if (model.startsWith('@cf/') || model.startsWith('workers-ai/')) {
    return {
      provider: 'workers-ai',
      endpoint: `/ai/run/${model.replace('workers-ai/', '').replace('@cf/', '')}`,
    }
  }
  // Default: assume an OpenAI-compatible downstream.
  return { provider: 'openai', endpoint: '/chat/completions' }
}

// ============================================================================
// Register adapter
// ============================================================================

registerBatchAdapter('cloudflare', cloudflareAdapter)

export { cloudflareAdapter }
