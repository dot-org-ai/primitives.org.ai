/**
 * OpenAI Batch API Adapter
 *
 * Implements batch processing using OpenAI's Batch API:
 * - 50% cost discount
 * - 24-hour turnaround
 * - Up to 50,000 requests per batch
 *
 * Plus a flex adapter that processes items concurrently for faster turnaround
 * at a similar discount.
 *
 * This file is a small adapter on top of the BatchProvider port (`./provider.js`).
 *
 * @see https://platform.openai.com/docs/guides/batch
 *
 * @packageDocumentation
 */

import { schema as convertSchema } from '../schema.js'
import {
  failedResult,
  pollUntilComplete,
  processConcurrently,
  registerBatchAdapter,
  registerFlexAdapter,
  tryParseJson,
  zodToJsonSchema,
  type BatchAdapter,
  type BatchItem,
  type BatchJob,
  type BatchQueueOptions,
  type BatchResult,
  type BatchStatus,
  type BatchSubmitResult,
  type FlexAdapter,
} from './provider.js'

// ============================================================================
// Provider-specific types
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
      choices: Array<{ message: { content: string } }>
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
// OpenAI client
// ============================================================================

let openaiApiKey: string | undefined
let openaiBaseUrl = 'https://api.openai.com/v1'

/** Configure the OpenAI client. */
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
  const response = await fetch(`${openaiBaseUrl}${path}`, {
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
    headers: { Authorization: `Bearer ${getApiKey()}` },
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
    headers: { Authorization: `Bearer ${getApiKey()}` },
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenAI file download error: ${response.status} ${error}`)
  }

  return response.text()
}

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
// OpenAI batch adapter (BatchProvider port)
// ============================================================================

const TERMINAL_FOR_OPENAI: ReadonlySet<BatchStatus> = new Set(['completed', 'failed'])
const THROW_FOR_OPENAI: ReadonlySet<BatchStatus> = new Set(['cancelled', 'expired'])

const openaiAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const model = options.model || 'gpt-4o'

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
          ...(item.options?.temperature !== undefined && {
            temperature: item.options.temperature,
          }),
        },
      }

      if (item.schema) {
        const zodSchema = convertSchema(item.schema)
        request.body.response_format = {
          type: 'json_schema',
          json_schema: { name: 'response', schema: zodToJsonSchema(zodSchema) },
        }
      }

      return request
    })

    const jsonlContent = requests.map((r) => JSON.stringify(r)).join('\n')
    const inputFile = await uploadFile(jsonlContent, 'batch')

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

    if (status.outputFileId) {
      const lines = (await downloadFile(status.outputFileId)).trim().split('\n')
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
          results.push({
            id: response.custom_id,
            customId: response.custom_id,
            status: 'completed',
            result: tryParseJson(content),
            usage: {
              promptTokens: response.response.body.usage.prompt_tokens,
              completionTokens: response.response.body.usage.completion_tokens,
              totalTokens: response.response.body.usage.total_tokens,
            },
          })
        }
      }
    }

    if (status.errorFileId) {
      const lines = (await downloadFile(status.errorFileId)).trim().split('\n')
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
    return pollUntilComplete(this, batchId, {
      pollInterval,
      fetchResultsOn: TERMINAL_FOR_OPENAI,
      throwOn: THROW_FOR_OPENAI,
    })
  },
}

// ============================================================================
// OpenAI flex adapter (FlexAdapter port)
// ============================================================================

/**
 * Flex processing uses concurrent requests for faster turnaround than batch
 * (minutes vs 24h) at a similar discount. Ideal for 5–500 items.
 *
 * As of 2026, OpenAI doesn't expose a dedicated "flex" tier API, so this
 * adapter implements concurrent direct chat completions as a middle ground.
 */
const openaiFlexAdapter: FlexAdapter = {
  async submitFlex(items: BatchItem[], options: { model?: string }): Promise<BatchResult[]> {
    const model = options.model || 'gpt-4o'
    return processConcurrently(items, (item) => processOpenAIItem(item, model), {
      concurrency: 10,
    })
  },
}

/** Process a single item via OpenAI Chat Completions API. */
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

  if (item.schema) {
    const zodSchema = convertSchema(item.schema)
    body['response_format'] = {
      type: 'json_schema',
      json_schema: { name: 'response', schema: zodToJsonSchema(zodSchema) },
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

  return {
    id: item.id,
    customId: item.id,
    status: 'completed',
    result: tryParseJson(content, !!item.schema),
    usage: {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    },
  }
}

// `failedResult` re-imported only to keep the import surface stable for tests
// that may use it. The processConcurrently helper handles failures internally.
void failedResult

// ============================================================================
// Register adapters
// ============================================================================

registerBatchAdapter('openai', openaiAdapter)
registerFlexAdapter('openai', openaiFlexAdapter)

export { openaiAdapter, openaiFlexAdapter }
