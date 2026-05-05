/**
 * Anthropic Message Batches API Adapter
 *
 * Implements batch processing using Anthropic's Message Batches API:
 * - 50% cost discount
 * - 24-hour turnaround
 * - Up to 10,000 requests per batch
 *
 * This file is a small adapter on top of the BatchProvider port (`./provider.js`).
 * It owns only the Anthropic-specific request/response shapes and HTTP calls;
 * shared concerns (polling, JSON-Schema conversion, JSON parsing) live in the port.
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/message-batches
 *
 * @packageDocumentation
 */

import { schema as convertSchema } from '../schema.js'
import {
  pollUntilComplete,
  registerBatchAdapter,
  tryParseJson,
  zodToJsonSchema,
  type BatchAdapter,
  type BatchItem,
  type BatchJob,
  type BatchQueueOptions,
  type BatchResult,
  type BatchStatus,
  type BatchSubmitResult,
} from './provider.js'

// ============================================================================
// Provider-specific types
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
// Anthropic client
// ============================================================================

let anthropicApiKey: string | undefined
let anthropicBaseUrl = 'https://api.anthropic.com/v1'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_BETA = 'message-batches-2024-09-24'

/** Configure the Anthropic client. */
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

function anthropicHeaders(): Record<string, string> {
  return {
    'x-api-key': getApiKey(),
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-beta': ANTHROPIC_BETA,
    'Content-Type': 'application/json',
  }
}

async function anthropicRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${anthropicBaseUrl}${path}`, {
    method,
    headers: anthropicHeaders(),
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Anthropic API error: ${response.status} ${error}`)
  }

  return response.json()
}

function mapStatus(batch: AnthropicBatch): BatchStatus {
  if (batch.cancel_initiated_at) {
    return batch.processing_status === 'ended' ? 'cancelled' : 'cancelling'
  }
  if (batch.processing_status === 'ended') {
    return 'completed'
  }
  return 'in_progress'
}

function toBatchJob(batch: AnthropicBatch, totalItemsHint?: number): BatchJob {
  const totalFromCounts =
    batch.request_counts.processing +
    batch.request_counts.succeeded +
    batch.request_counts.errored +
    batch.request_counts.canceled +
    batch.request_counts.expired

  return {
    id: batch.id,
    provider: 'anthropic',
    status: mapStatus(batch),
    totalItems: totalItemsHint ?? totalFromCounts,
    completedItems: batch.request_counts.succeeded,
    failedItems:
      batch.request_counts.errored + batch.request_counts.expired + batch.request_counts.canceled,
    createdAt: new Date(batch.created_at),
    ...(batch.ended_at && { completedAt: new Date(batch.ended_at) }),
    expiresAt: new Date(batch.expires_at),
  }
}

// ============================================================================
// Anthropic adapter (BatchProvider port)
// ============================================================================

const anthropicAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const model = options.model || 'claude-sonnet-4-20250514'
    const maxTokens = 4096

    const requests: AnthropicBatchRequest[] = items.map((item) => {
      const request: AnthropicBatchRequest = {
        custom_id: item.id,
        params: {
          model,
          max_tokens: item.options?.maxTokens || maxTokens,
          messages: [{ role: 'user', content: item.prompt }],
          ...(item.options?.system !== undefined && { system: item.options.system }),
          ...(item.options?.temperature !== undefined && {
            temperature: item.options.temperature,
          }),
        },
      }

      if (item.schema) {
        const zodSchema = convertSchema(item.schema)
        request.params.tools = [
          {
            name: 'structured_response',
            description: 'Generate a structured response matching the schema',
            input_schema: zodToJsonSchema(zodSchema),
          },
        ]
        request.params.tool_choice = { type: 'tool', name: 'structured_response' }
      }

      return request
    })

    const batch = await anthropicRequest<AnthropicBatch>('POST', '/messages/batches', {
      requests,
    })

    const job = toBatchJob(batch, items.length)
    if (options.webhookUrl !== undefined) {
      job.webhookUrl = options.webhookUrl
    }

    const completion = this.waitForCompletion(batch.id)
    return { job, completion }
  },

  async getStatus(batchId: string): Promise<BatchJob> {
    const batch = await anthropicRequest<AnthropicBatch>('GET', `/messages/batches/${batchId}`)
    return toBatchJob(batch)
  },

  async cancel(batchId: string): Promise<void> {
    await anthropicRequest('POST', `/messages/batches/${batchId}/cancel`)
  },

  async getResults(batchId: string): Promise<BatchResult[]> {
    const status = await this.getStatus(batchId)

    if (status.status !== 'completed' && status.status !== 'cancelled') {
      throw new Error(`Batch not complete. Status: ${status.status}`)
    }

    // Anthropic returns results via a signed URL on the batch object.
    const batch = await anthropicRequest<AnthropicBatch>('GET', `/messages/batches/${batchId}`)
    if (!batch.results_url) {
      throw new Error('No results URL available')
    }

    const response = await fetch(batch.results_url, { headers: anthropicHeaders() })
    if (!response.ok) {
      throw new Error(`Failed to fetch results: ${response.status}`)
    }

    const lines = (await response.text()).trim().split('\n')
    return lines.map(parseAnthropicResult)
  },

  async waitForCompletion(batchId: string, pollInterval = 5000): Promise<BatchResult[]> {
    return pollUntilComplete(this, batchId, { pollInterval })
  },
}

function parseAnthropicResult(line: string): BatchResult {
  const result: AnthropicBatchResult = JSON.parse(line)

  if (result.result.type === 'succeeded' && result.result.message) {
    const message = result.result.message
    const toolUse = message.content.find((c) => c.type === 'tool_use')
    const textContent = message.content.find((c) => c.type === 'text')

    let extractedResult: unknown
    if (toolUse?.input) {
      extractedResult = toolUse.input
    } else if (textContent?.text) {
      extractedResult = tryParseJson(textContent.text)
    }

    return {
      id: result.custom_id,
      customId: result.custom_id,
      status: 'completed',
      result: extractedResult,
      usage: {
        promptTokens: message.usage.input_tokens,
        completionTokens: message.usage.output_tokens,
        totalTokens: message.usage.input_tokens + message.usage.output_tokens,
      },
    }
  }

  return {
    id: result.custom_id,
    customId: result.custom_id,
    status: 'failed',
    error: result.result.error?.message || `Request ${result.result.type}`,
  }
}

// ============================================================================
// Register adapter
// ============================================================================

registerBatchAdapter('anthropic', anthropicAdapter)

export { anthropicAdapter }
