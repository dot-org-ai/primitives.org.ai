/**
 * Anthropic Message Batches API Adapter
 *
 * Implements batch processing using Anthropic's Message Batches API:
 * - 50% cost discount
 * - 24-hour turnaround
 * - Up to 10,000 requests per batch
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/message-batches
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

interface AnthropicBatchRequest {
  custom_id: string
  params: {
    model: string
    max_tokens: number
    messages: Array<{ role: string; content: string }>
    system?: string
    temperature?: number
    tool_choice?: { type: 'tool'; name: string }
    tools?: Array<{
      name: string
      description: string
      input_schema: Record<string, unknown>
    }>
  }
}

interface AnthropicBatchResult {
  custom_id: string
  result: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired'
    message?: {
      id: string
      content: Array<{
        type: 'text' | 'tool_use'
        text?: string
        name?: string
        input?: unknown
      }>
      usage: {
        input_tokens: number
        output_tokens: number
      }
    }
    error?: {
      type: string
      message: string
    }
  }
}

interface AnthropicBatch {
  id: string
  type: 'message_batch'
  processing_status: 'in_progress' | 'ended'
  request_counts: {
    processing: number
    succeeded: number
    errored: number
    canceled: number
    expired: number
  }
  ended_at: string | null
  created_at: string
  expires_at: string
  cancel_initiated_at: string | null
  results_url: string | null
}

// ============================================================================
// Anthropic Client
// ============================================================================

let anthropicApiKey: string | undefined
let anthropicBaseUrl = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_BETA = 'message-batches-2024-09-24'

/**
 * Configure the Anthropic client
 */
export function configureAnthropic(options: { apiKey?: string; baseUrl?: string }): void {
  if (options.apiKey) anthropicApiKey = options.apiKey
  if (options.baseUrl) anthropicBaseUrl = options.baseUrl
}

function getApiKey(): string {
  const key = anthropicApiKey || process.env['ANTHROPIC_API_KEY']
  if (!key) {
    throw new Error(
      'Anthropic API key not configured. Set ANTHROPIC_API_KEY or call configureAnthropic()'
    )
  }
  return key
}

async function anthropicRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${anthropicBaseUrl}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      'x-api-key': getApiKey(),
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta': ANTHROPIC_BETA,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} ${error}`)
  }

  return response.json()
}

// ============================================================================
// Status Mapping
// ============================================================================

function mapStatus(batch: AnthropicBatch): BatchStatus {
  if (batch.cancel_initiated_at) {
    return batch.processing_status === 'ended' ? 'cancelled' : 'cancelling'
  }
  if (batch.processing_status === 'ended') {
    return 'completed'
  }
  return 'in_progress'
}

// ============================================================================
// Anthropic Batch Adapter
// ============================================================================

const anthropicAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const model = options.model || 'claude-sonnet-4-20250514'
    const maxTokens = 4096

    // Build batch requests
    const requests: AnthropicBatchRequest[] = items.map((item) => {
      const request: AnthropicBatchRequest = {
        custom_id: item.id,
        params: {
          model,
          max_tokens: item.options?.maxTokens || maxTokens,
          messages: [{ role: 'user', content: item.prompt }],
          ...(item.options?.system !== undefined && { system: item.options.system }),
          ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
        },
      }

      // Add JSON schema as a tool if provided
      if (item.schema) {
        const zodSchema = convertSchema(item.schema)
        const jsonSchema = zodToJsonSchema(zodSchema)

        request.params.tools = [
          {
            name: 'structured_response',
            description: 'Generate a structured response matching the schema',
            input_schema: jsonSchema,
          },
        ]
        request.params.tool_choice = { type: 'tool', name: 'structured_response' }
      }

      return request
    })

    // Create the batch
    const batch = await anthropicRequest<AnthropicBatch>('POST', '/messages/batches', {
      requests,
    })

    const job: BatchJob = {
      id: batch.id,
      provider: 'anthropic',
      status: mapStatus(batch),
      totalItems: items.length,
      completedItems: batch.request_counts.succeeded,
      failedItems:
        batch.request_counts.errored + batch.request_counts.expired + batch.request_counts.canceled,
      createdAt: new Date(batch.created_at),
      expiresAt: new Date(batch.expires_at),
      ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
    }

    // Create completion promise
    const completion = this.waitForCompletion(batch.id)

    return { job, completion }
  },

  async getStatus(batchId: string): Promise<BatchJob> {
    const batch = await anthropicRequest<AnthropicBatch>('GET', `/messages/batches/${batchId}`)

    return {
      id: batch.id,
      provider: 'anthropic',
      status: mapStatus(batch),
      totalItems:
        batch.request_counts.processing +
        batch.request_counts.succeeded +
        batch.request_counts.errored +
        batch.request_counts.canceled +
        batch.request_counts.expired,
      completedItems: batch.request_counts.succeeded,
      failedItems:
        batch.request_counts.errored + batch.request_counts.expired + batch.request_counts.canceled,
      createdAt: new Date(batch.created_at),
      ...(batch.ended_at && { completedAt: new Date(batch.ended_at) }),
      expiresAt: new Date(batch.expires_at),
    }
  },

  async cancel(batchId: string): Promise<void> {
    await anthropicRequest('POST', `/messages/batches/${batchId}/cancel`)
  },

  async getResults(batchId: string): Promise<BatchResult[]> {
    const status = await this.getStatus(batchId)

    if (status.status !== 'completed' && status.status !== 'cancelled') {
      throw new Error(`Batch not complete. Status: ${status.status}`)
    }

    // Fetch results (Anthropic returns them directly via the API)
    const batch = await anthropicRequest<AnthropicBatch>('GET', `/messages/batches/${batchId}`)

    if (!batch.results_url) {
      throw new Error('No results URL available')
    }

    // Download results from the URL
    const response = await fetch(batch.results_url, {
      headers: {
        'x-api-key': getApiKey(),
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-beta': ANTHROPIC_BETA,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch results: ${response.status}`)
    }

    const content = await response.text()
    const lines = content.trim().split('\n')
    const results: BatchResult[] = []

    for (const line of lines) {
      const result: AnthropicBatchResult = JSON.parse(line)

      if (result.result.type === 'succeeded' && result.result.message) {
        const message = result.result.message
        let extractedResult: unknown

        // Extract from tool use or text
        const toolUse = message.content.find((c) => c.type === 'tool_use')
        const textContent = message.content.find((c) => c.type === 'text')

        if (toolUse?.input) {
          extractedResult = toolUse.input
        } else if (textContent?.text) {
          // Try to parse as JSON
          try {
            extractedResult = JSON.parse(textContent.text)
          } catch {
            extractedResult = textContent.text
          }
        }

        results.push({
          id: result.custom_id,
          customId: result.custom_id,
          status: 'completed',
          result: extractedResult,
          usage: {
            promptTokens: message.usage.input_tokens,
            completionTokens: message.usage.output_tokens,
            totalTokens: message.usage.input_tokens + message.usage.output_tokens,
          },
        })
      } else {
        results.push({
          id: result.custom_id,
          customId: result.custom_id,
          status: 'failed',
          error: result.result.error?.message || `Request ${result.result.type}`,
        })
      }
    }

    return results
  },

  async waitForCompletion(batchId: string, pollInterval = 5000): Promise<BatchResult[]> {
    while (true) {
      const status = await this.getStatus(batchId)

      if (status.status === 'completed' || status.status === 'cancelled') {
        return this.getResults(batchId)
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }
  },
}

// ============================================================================
// Helpers
// ============================================================================

/** Zod schema definition structure for type introspection */
interface ZodDef {
  typeName?: string
  type?: unknown
  shape?: () => Record<string, unknown>
}

/** Zod schema with _def property for introspection */
interface ZodSchemaLike {
  _def?: ZodDef
}

/**
 * Simple Zod to JSON Schema converter
 */
function zodToJsonSchema(zodSchema: unknown): Record<string, unknown> {
  const schema = zodSchema as ZodSchemaLike

  if (!schema._def) {
    return { type: 'object' }
  }

  const typeName = schema._def.typeName

  switch (typeName) {
    case 'ZodString':
      return { type: 'string' }
    case 'ZodNumber':
      return { type: 'number' }
    case 'ZodBoolean':
      return { type: 'boolean' }
    case 'ZodArray':
      return { type: 'array', items: zodToJsonSchema(schema._def.type) }
    case 'ZodObject': {
      const shape = schema._def.shape?.() ?? {}
      const properties: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value)
      }
      return { type: 'object', properties, required: Object.keys(properties) }
    }
    default:
      return { type: 'object' }
  }
}

// ============================================================================
// Register Adapter
// ============================================================================

registerBatchAdapter('anthropic', anthropicAdapter)

export { anthropicAdapter }
