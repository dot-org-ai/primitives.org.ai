/**
 * Google GenAI (Gemini) Adapter
 *
 * Implements processing using Google's Generative AI API (Gemini models).
 * Google doesn't have a native batch API like OpenAI/Anthropic, so this
 * implements concurrent processing for the flex tier.
 *
 * @see https://ai.google.dev/gemini-api/docs
 *
 * @packageDocumentation
 */

import {
  registerBatchAdapter,
  registerFlexAdapter,
  type BatchAdapter,
  type FlexAdapter,
  type BatchItem,
  type BatchJob,
  type BatchQueueOptions,
  type BatchResult,
  type BatchSubmitResult,
  type BatchStatus,
} from '../batch-queue.js'

// ============================================================================
// Types
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
    safetyRatings?: Array<{
      category: string
      probability: string
    }>
  }>
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

// ============================================================================
// Google GenAI Client Configuration
// ============================================================================

let googleApiKey: string | undefined
let googleBaseUrl = 'https://generativelanguage.googleapis.com/v1beta'

// AI Gateway configuration (optional - for routing through Cloudflare AI Gateway)
let gatewayUrl: string | undefined
let gatewayToken: string | undefined

/**
 * Configure the Google GenAI client
 */
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

function getConfig(): { apiKey: string; baseUrl: string; gatewayUrl?: string; gatewayToken?: string } {
  // Check for AI Gateway configuration
  const gwUrl = gatewayUrl || process.env.AI_GATEWAY_URL
  const gwToken = gatewayToken || process.env.AI_GATEWAY_TOKEN

  // If using gateway, we don't need a direct API key
  if (gwUrl && gwToken) {
    return {
      apiKey: '',
      baseUrl: googleBaseUrl,
      gatewayUrl: gwUrl,
      gatewayToken: gwToken,
    }
  }

  const key = googleApiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
  if (!key) {
    throw new Error(
      'Google API key not configured. Set GOOGLE_API_KEY or GEMINI_API_KEY, or use AI_GATEWAY_URL and AI_GATEWAY_TOKEN'
    )
  }
  return { apiKey: key, baseUrl: googleBaseUrl, gatewayUrl: undefined, gatewayToken: undefined }
}

// ============================================================================
// In-memory job tracking
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
// Google GenAI Batch Adapter
// ============================================================================

/**
 * Google GenAI batch adapter
 *
 * Note: Google doesn't have a native batch API like OpenAI/Anthropic.
 * This adapter implements batch processing via concurrent requests.
 * For true async batch processing, consider using Google Cloud Batch
 * with Vertex AI.
 */
const googleAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const jobId = `google_batch_${++jobCounter}_${Date.now()}`
    const model = options.model || 'gemini-2.0-flash'

    // Store job state
    pendingJobs.set(jobId, {
      items,
      options,
      results: [],
      status: 'pending',
      createdAt: new Date(),
    })

    // Process requests concurrently
    const completion = processGoogleRequestsConcurrently(jobId, items, model, options)

    const job: BatchJob = {
      id: jobId,
      provider: 'google',
      status: 'pending',
      totalItems: items.length,
      completedItems: 0,
      failedItems: 0,
      createdAt: new Date(),
      webhookUrl: options.webhookUrl,
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
      provider: 'google',
      status: job.status,
      totalItems: job.items.length,
      completedItems,
      failedItems,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
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
// Google GenAI Flex Adapter
// ============================================================================

/**
 * Google GenAI Flex Adapter
 *
 * Implements concurrent processing for medium-sized batches.
 * Uses the Gemini API for fast turnaround.
 */
const googleFlexAdapter: FlexAdapter = {
  async submitFlex(items: BatchItem[], options: { model?: string }): Promise<BatchResult[]> {
    const model = options.model || 'gemini-2.0-flash'
    const CONCURRENCY = 10

    const results: BatchResult[] = []

    // Process items concurrently
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY)

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            return await processGoogleItem(item, model)
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
    }

    return results
  },
}

// ============================================================================
// Processing
// ============================================================================

async function processGoogleRequestsConcurrently(
  jobId: string,
  items: BatchItem[],
  model: string,
  options: BatchQueueOptions
): Promise<BatchResult[]> {
  const job = pendingJobs.get(jobId)
  if (!job) {
    throw new Error(`Job not found: ${jobId}`)
  }

  job.status = 'in_progress'

  const CONCURRENCY = 10
  const results: BatchResult[] = []

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          return await processGoogleItem(item, model)
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

async function processGoogleItem(item: BatchItem, model: string): Promise<BatchResult> {
  const config = getConfig()

  // Check if using AI Gateway
  if (config.gatewayUrl && config.gatewayToken) {
    return processGoogleItemViaGateway(item, config, model)
  }

  // Build the model name (add models/ prefix if not present)
  const modelName = model.startsWith('models/') ? model : `models/${model}`

  const url = `${config.baseUrl}/${modelName}:generateContent?key=${config.apiKey}`

  // Build messages
  const contents: GeminiMessage[] = []

  // Add system instruction as a user message if provided (Gemini handles this differently)
  if (item.options?.system) {
    contents.push({
      role: 'user',
      parts: [{ text: `System instruction: ${item.options.system}\n\nUser request: ${item.prompt}` }],
    })
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: item.prompt }],
    })
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: item.options?.maxTokens || 8192,
      temperature: item.options?.temperature,
    },
  }

  // Add JSON mode if schema is provided
  if (item.schema) {
    body.generationConfig = {
      ...(body.generationConfig as object),
      responseMimeType: 'application/json',
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google GenAI API error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as GeminiResponse

  // Extract content
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text

  let result: unknown = content

  // Try to parse JSON if schema was provided or content looks like JSON
  if (content && (item.schema || content.trim().startsWith('{') || content.trim().startsWith('['))) {
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
    usage: data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
        }
      : undefined,
  }
}

/**
 * Process a Google GenAI item via Cloudflare AI Gateway
 * Gateway URL format: {gateway_url}/google-ai-studio/v1beta/models/{model}:generateContent
 */
async function processGoogleItemViaGateway(
  item: BatchItem,
  config: ReturnType<typeof getConfig>,
  model: string
): Promise<BatchResult> {
  // AI Gateway URL for Google AI Studio
  // Format: {gateway_url}/google-ai-studio/v1beta/models/{model}:generateContent
  const modelName = model.startsWith('models/') ? model.replace('models/', '') : model
  const url = `${config.gatewayUrl}/google-ai-studio/v1beta/models/${modelName}:generateContent`

  // Build messages
  const contents: GeminiMessage[] = []

  if (item.options?.system) {
    contents.push({
      role: 'user',
      parts: [{ text: `System instruction: ${item.options.system}\n\nUser request: ${item.prompt}` }],
    })
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: item.prompt }],
    })
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: item.options?.maxTokens || 8192,
      temperature: item.options?.temperature,
    },
  }

  if (item.schema) {
    body.generationConfig = {
      ...(body.generationConfig as object),
      responseMimeType: 'application/json',
    }
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'cf-aig-authorization': `Bearer ${config.gatewayToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Google GenAI via Gateway error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as GeminiResponse

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text

  let result: unknown = content

  if (content && (item.schema || content.trim().startsWith('{') || content.trim().startsWith('['))) {
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
    usage: data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
        }
      : undefined,
  }
}

// ============================================================================
// Register Adapters
// ============================================================================

registerBatchAdapter('google', googleAdapter)
registerFlexAdapter('google', googleFlexAdapter)

export { googleAdapter, googleFlexAdapter }
