/**
 * OpenAI Batch API Adapter
 *
 * Implements batch processing using OpenAI's Batch API:
 * - 50% cost discount
 * - 24-hour turnaround
 * - Up to 50,000 requests per batch
 *
 * @see https://platform.openai.com/docs/guides/batch
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
import { schema as convertSchema, type SimpleSchema } from '../schema.js'

// ============================================================================
// Types
// ============================================================================

interface OpenAIBatchRequest {
  custom_id: string
  method: 'POST'
  url: '/v1/chat/completions'
  body: {
    model: string
    messages: Array<{ role: string; content: string }>
    response_format?: { type: 'json_schema'; json_schema: { name: string; schema: unknown } }
    max_tokens?: number
    temperature?: number
  }
}

interface OpenAIBatchResponse {
  id: string
  custom_id: string
  response: {
    status_code: number
    body: {
      id: string
      choices: Array<{
        message: {
          content: string
        }
      }>
      usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
      }
    }
  } | null
  error: {
    code: string
    message: string
  } | null
}

interface OpenAIBatch {
  id: string
  object: 'batch'
  endpoint: string
  errors: null | { object: string; data: Array<{ code: string; message: string; line: number }> }
  input_file_id: string
  completion_window: string
  status: string
  output_file_id: string | null
  error_file_id: string | null
  created_at: number
  in_progress_at: number | null
  expires_at: number | null
  finalizing_at: number | null
  completed_at: number | null
  failed_at: number | null
  expired_at: number | null
  cancelling_at: number | null
  cancelled_at: number | null
  request_counts: {
    total: number
    completed: number
    failed: number
  }
  metadata: Record<string, string> | null
}

// ============================================================================
// OpenAI Client
// ============================================================================

let openaiApiKey: string | undefined
let openaiBaseUrl = 'https://api.openai.com/v1'

/**
 * Configure the OpenAI client
 */
export function configureOpenAI(options: { apiKey?: string; baseUrl?: string }): void {
  if (options.apiKey) openaiApiKey = options.apiKey
  if (options.baseUrl) openaiBaseUrl = options.baseUrl
}

function getApiKey(): string {
  const key = openaiApiKey || process.env['OPENAI_API_KEY']
  if (!key) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY or call configureOpenAI()')
  }
  return key
}

async function openaiRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const url = `${openaiBaseUrl}${path}`
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${error}`)
  }

  return response.json()
}

async function uploadFile(content: string, purpose: string): Promise<{ id: string }> {
  const formData = new FormData()
  formData.append('purpose', purpose)
  formData.append('file', new Blob([content], { type: 'application/jsonl' }), 'batch.jsonl')

  const response = await fetch(`${openaiBaseUrl}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI file upload error: ${response.status} ${error}`)
  }

  return response.json()
}

async function downloadFile(fileId: string): Promise<string> {
  const response = await fetch(`${openaiBaseUrl}/files/${fileId}/content`, {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI file download error: ${response.status} ${error}`)
  }

  return response.text()
}

// ============================================================================
// Status Mapping
// ============================================================================

function mapStatus(status: string): BatchStatus {
  const statusMap: Record<string, BatchStatus> = {
    validating: 'validating',
    in_progress: 'in_progress',
    finalizing: 'finalizing',
    completed: 'completed',
    failed: 'failed',
    expired: 'expired',
    cancelling: 'cancelling',
    cancelled: 'cancelled',
  }
  return statusMap[status] || 'pending'
}

// ============================================================================
// OpenAI Batch Adapter
// ============================================================================

const openaiAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const model = options.model || 'gpt-4o'

    // Build JSONL content
    const requests: OpenAIBatchRequest[] = items.map((item) => {
      const request: OpenAIBatchRequest = {
        custom_id: item.id,
        method: 'POST',
        url: '/v1/chat/completions',
        body: {
          model,
          messages: [
            ...(item.options?.system ? [{ role: 'system', content: item.options.system }] : []),
            { role: 'user', content: item.prompt },
          ],
          ...(item.options?.maxTokens !== undefined && { max_tokens: item.options.maxTokens }),
          ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
        },
      }

      // Add JSON schema if provided
      if (item.schema) {
        const zodSchema = convertSchema(item.schema)
        // Convert Zod to JSON Schema (simplified - you'd want a proper converter)
        request.body.response_format = {
          type: 'json_schema',
          json_schema: {
            name: 'response',
            schema: zodToJsonSchema(zodSchema),
          },
        }
      }

      return request
    })

    const jsonlContent = requests.map((r) => JSON.stringify(r)).join('\n')

    // Upload the input file
    const inputFile = await uploadFile(jsonlContent, 'batch')

    // Create the batch
    const batch = await openaiRequest<OpenAIBatch>('POST', '/batches', {
      input_file_id: inputFile.id,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
      metadata: options.metadata,
    })

    const job: BatchJob = {
      id: batch.id,
      provider: 'openai',
      status: mapStatus(batch.status),
      totalItems: items.length,
      completedItems: 0,
      failedItems: 0,
      createdAt: new Date(batch.created_at * 1000),
      ...(batch.expires_at && { expiresAt: new Date(batch.expires_at * 1000) }),
      ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
      inputFileId: batch.input_file_id,
    }

    // Create completion promise
    const completion = this.waitForCompletion(batch.id)

    return { job, completion }
  },

  async getStatus(batchId: string): Promise<BatchJob> {
    const batch = await openaiRequest<OpenAIBatch>('GET', `/batches/${batchId}`)

    return {
      id: batch.id,
      provider: 'openai',
      status: mapStatus(batch.status),
      totalItems: batch.request_counts.total,
      completedItems: batch.request_counts.completed,
      failedItems: batch.request_counts.failed,
      createdAt: new Date(batch.created_at * 1000),
      ...(batch.in_progress_at && { startedAt: new Date(batch.in_progress_at * 1000) }),
      ...(batch.completed_at && { completedAt: new Date(batch.completed_at * 1000) }),
      ...(batch.expires_at && { expiresAt: new Date(batch.expires_at * 1000) }),
      inputFileId: batch.input_file_id,
      ...(batch.output_file_id && { outputFileId: batch.output_file_id }),
      ...(batch.error_file_id && { errorFileId: batch.error_file_id }),
    }
  },

  async cancel(batchId: string): Promise<void> {
    await openaiRequest('POST', `/batches/${batchId}/cancel`)
  },

  async getResults(batchId: string): Promise<BatchResult[]> {
    const status = await this.getStatus(batchId)

    if (status.status !== 'completed' && status.status !== 'failed') {
      throw new Error(`Batch not complete. Status: ${status.status}`)
    }

    const results: BatchResult[] = []

    // Download and parse output file
    if (status.outputFileId) {
      const content = await downloadFile(status.outputFileId)
      const lines = content.trim().split('\n')

      for (const line of lines) {
        const response: OpenAIBatchResponse = JSON.parse(line)

        if (response.error) {
          results.push({
            id: response.custom_id,
            customId: response.custom_id,
            status: 'failed',
            error: response.error.message,
          })
        } else if (response.response) {
          const content = response.response.body.choices[0]?.message?.content
          let result: unknown = content

          // Try to parse JSON if it looks like JSON
          if (content?.startsWith('{') || content?.startsWith('[')) {
            try {
              result = JSON.parse(content)
            } catch {
              // Keep as string
            }
          }

          results.push({
            id: response.custom_id,
            customId: response.custom_id,
            status: 'completed',
            result,
            usage: {
              promptTokens: response.response.body.usage.prompt_tokens,
              completionTokens: response.response.body.usage.completion_tokens,
              totalTokens: response.response.body.usage.total_tokens,
            },
          })
        }
      }
    }

    // Download and parse error file
    if (status.errorFileId) {
      const content = await downloadFile(status.errorFileId)
      const lines = content.trim().split('\n')

      for (const line of lines) {
        const response: OpenAIBatchResponse = JSON.parse(line)
        results.push({
          id: response.custom_id,
          customId: response.custom_id,
          status: 'failed',
          error: response.error?.message || 'Unknown error',
        })
      }
    }

    return results
  },

  async waitForCompletion(batchId: string, pollInterval = 5000): Promise<BatchResult[]> {
    while (true) {
      const status = await this.getStatus(batchId)

      if (status.status === 'completed' || status.status === 'failed') {
        return this.getResults(batchId)
      }

      if (status.status === 'cancelled' || status.status === 'expired') {
        throw new Error(`Batch ${status.status}`)
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }
  },
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Simple Zod to JSON Schema converter
 * In production, use a proper library like zod-to-json-schema
 */
function zodToJsonSchema(zodSchema: unknown): Record<string, unknown> {
  // This is a simplified converter - in production use zod-to-json-schema
  const schema = zodSchema as { _def?: { typeName?: string; shape?: unknown } }

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
      return { type: 'array', items: zodToJsonSchema((schema._def as any).type) }
    case 'ZodObject': {
      const shape = (schema._def as any).shape()
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

// ============================================================================
// OpenAI Flex Adapter
// ============================================================================

/**
 * OpenAI Flex Adapter
 *
 * Flex processing uses concurrent requests with a service tier that provides
 * ~50% discount similar to batch, but with much faster turnaround (minutes vs 24hr).
 *
 * This is ideal for 5-500 items where you need results quickly but still want
 * cost savings.
 *
 * Note: As of 2024, OpenAI doesn't have an official "flex" tier API.
 * This adapter implements concurrent processing as a middle ground.
 * When OpenAI adds official flex support, this can be updated.
 */
const openaiFlexAdapter: FlexAdapter = {
  async submitFlex(items: BatchItem[], options: { model?: string }): Promise<BatchResult[]> {
    const model = options.model || 'gpt-4o'
    const CONCURRENCY = 10 // Higher concurrency for flex tier

    const results: BatchResult[] = []

    // Process items concurrently in batches
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY)

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            return await processOpenAIItem(item, model)
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

/**
 * Process a single item via OpenAI Chat Completions API
 */
async function processOpenAIItem(item: BatchItem, model: string): Promise<BatchResult> {
  const messages: Array<{ role: string; content: string }> = []

  if (item.options?.system) {
    messages.push({ role: 'system', content: item.options.system })
  }
  messages.push({ role: 'user', content: item.prompt })

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: item.options?.maxTokens,
    temperature: item.options?.temperature,
  }

  // Add JSON schema if provided
  if (item.schema) {
    const zodSchema = convertSchema(item.schema)
    body['response_format'] = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: zodToJsonSchema(zodSchema),
      },
    }
  }

  const response = await fetch(`${openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI API error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }

  const content = data.choices[0]?.message?.content
  let result: unknown = content

  // Try to parse JSON if schema was provided or content looks like JSON
  if (content && (item.schema || content.startsWith('{') || content.startsWith('['))) {
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
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  }
}

// ============================================================================
// Register Adapters
// ============================================================================

registerBatchAdapter('openai', openaiAdapter)
registerFlexAdapter('openai', openaiFlexAdapter)

export { openaiAdapter, openaiFlexAdapter }
