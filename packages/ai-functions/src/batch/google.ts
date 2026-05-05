/**
 * Google GenAI (Gemini) Adapter
 *
 * Google doesn't have a native batch API like OpenAI/Anthropic, so this
 * adapter fakes batch processing via concurrent direct calls and tracks the
 * job state locally (see `LocalJobStore` in `./provider.js`).
 *
 * For true async batch processing, consider Google Cloud Batch with Vertex AI.
 *
 * @see https://ai.google.dev/gemini-api/docs
 *
 * @packageDocumentation
 */

import {
  LocalJobStore,
  processConcurrently,
  registerBatchAdapter,
  registerFlexAdapter,
  tryParseJson,
  type BatchAdapter,
  type BatchItem,
  type BatchJob,
  type BatchQueueOptions,
  type BatchResult,
  type BatchSubmitResult,
  type FlexAdapter,
} from './provider.js'

// ============================================================================
// Provider-specific types
// ============================================================================

interface GeminiMessage {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>
      role: string
    }
    finishReason: string
    safetyRatings?: Array<{ category: string; probability: string }>
  }>
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

// ============================================================================
// Google GenAI client configuration
// ============================================================================

let googleApiKey: string | undefined
let googleBaseUrl = 'https://generativelanguage.googleapis.com/v1beta'

// AI Gateway configuration (optional - for routing through Cloudflare AI Gateway)
let gatewayUrl: string | undefined
let gatewayToken: string | undefined

/** Configure the Google GenAI client. */
export function configureGoogleGenAI(options: {
  apiKey?: string
  baseUrl?: string
  /** Optional: Cloudflare AI Gateway URL for routing requests */
  gatewayUrl?: string
  /** Optional: Cloudflare AI Gateway token */
  gatewayToken?: string
}): void {
  if (options.apiKey) googleApiKey = options.apiKey
  if (options.baseUrl) googleBaseUrl = options.baseUrl
  if (options.gatewayUrl) gatewayUrl = options.gatewayUrl
  if (options.gatewayToken) gatewayToken = options.gatewayToken
}

interface GoogleConfig {
  apiKey: string
  baseUrl: string
  gatewayUrl?: string
  gatewayToken?: string
}

function getConfig(): GoogleConfig {
  const gwUrl = gatewayUrl || process.env['AI_GATEWAY_URL']
  const gwToken = gatewayToken || process.env['AI_GATEWAY_TOKEN']

  if (gwUrl && gwToken) {
    return {
      apiKey: '',
      baseUrl: googleBaseUrl,
      gatewayUrl: gwUrl,
      gatewayToken: gwToken,
    }
  }

  const key = googleApiKey || process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY']
  if (!key) {
    throw new Error(
      'Google API key not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY, or use AI_GATEWAY_URL and AI_GATEWAY_TOKEN'
    )
  }
  return { apiKey: key, baseUrl: googleBaseUrl }
}

// ============================================================================
// Local job tracking
// ============================================================================

const jobs = new LocalJobStore('google_batch')

// ============================================================================
// Google GenAI batch adapter (BatchProvider port)
// ============================================================================

const googleAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const model = options.model || 'gemini-2.0-flash'
    const { id, state } = jobs.create(items, options)

    // Drive the job state machine in the background; `waitForCompletion`
    // will poll the in-memory state.
    const completion = (async () => {
      state.status = 'in_progress'
      const results = await processConcurrently(items, (item) => processGoogleItem(item, model), {
        concurrency: 10,
        onWaveComplete: (partial) => {
          state.results = partial
        },
      })
      state.results = results
      state.status = results.every((r) => r.status === 'completed') ? 'completed' : 'failed'
      state.completedAt = new Date()
      return results
    })()

    const job: BatchJob = {
      id,
      provider: 'google',
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
    return jobs.snapshot(batchId, 'google')
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
// Google GenAI flex adapter (FlexAdapter port)
// ============================================================================

const googleFlexAdapter: FlexAdapter = {
  async submitFlex(items: BatchItem[], options: { model?: string }): Promise<BatchResult[]> {
    const model = options.model || 'gemini-2.0-flash'
    return processConcurrently(items, (item) => processGoogleItem(item, model), {
      concurrency: 10,
    })
  },
}

// ============================================================================
// Per-item processing
// ============================================================================

async function processGoogleItem(item: BatchItem, model: string): Promise<BatchResult> {
  const config = getConfig()
  if (config.gatewayUrl && config.gatewayToken) {
    return processGoogleItemViaGateway(item, config, model)
  }

  const modelName = model.startsWith('models/') ? model : `models/${model}`
  const url = `${config.baseUrl}/${modelName}:generateContent?key=${config.apiKey}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGeminiBody(item)),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google GenAI API error: ${response.status} ${error}`)
  }

  return parseGeminiResponse(item, (await response.json()) as GeminiResponse)
}

/**
 * Process a Google GenAI item via Cloudflare AI Gateway.
 * Gateway URL format: {gateway_url}/google-ai-studio/v1beta/models/{model}:generateContent
 */
async function processGoogleItemViaGateway(
  item: BatchItem,
  config: GoogleConfig,
  model: string
): Promise<BatchResult> {
  const modelName = model.startsWith('models/') ? model.replace('models/', '') : model
  const url = `${config.gatewayUrl}/google-ai-studio/v1beta/models/${modelName}:generateContent`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'cf-aig-authorization': `Bearer ${config.gatewayToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildGeminiBody(item)),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google GenAI via Gateway error: ${response.status} ${error}`)
  }

  return parseGeminiResponse(item, (await response.json()) as GeminiResponse)
}

function buildGeminiBody(item: BatchItem): Record<string, unknown> {
  // Gemini handles system instructions as part of the user message.
  const userText = item.options?.system
    ? `System instruction: ${item.options.system}\n\nUser request: ${item.prompt}`
    : item.prompt

  const contents: GeminiMessage[] = [{ role: 'user', parts: [{ text: userText }] }]

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: item.options?.maxTokens || 8192,
    ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
    ...(item.schema && { responseMimeType: 'application/json' }),
  }

  return { contents, generationConfig }
}

function parseGeminiResponse(item: BatchItem, data: GeminiResponse): BatchResult {
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text

  return {
    id: item.id,
    customId: item.id,
    status: 'completed',
    result: tryParseJson(content, !!item.schema),
    ...(data.usageMetadata && {
      usage: {
        promptTokens: data.usageMetadata.promptTokenCount,
        completionTokens: data.usageMetadata.candidatesTokenCount,
        totalTokens: data.usageMetadata.totalTokenCount,
      },
    }),
  }
}

// ============================================================================
// Register adapters
// ============================================================================

registerBatchAdapter('google', googleAdapter)
registerFlexAdapter('google', googleFlexAdapter)

export { googleAdapter, googleFlexAdapter }
