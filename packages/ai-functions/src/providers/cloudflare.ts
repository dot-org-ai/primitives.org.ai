/**
 * Cloudflare Workers AI Provider for embeddings
 *
 * Provides embedding models via Cloudflare Workers AI API.
 * Default model: @cf/baai/bge-m3
 *
 * @packageDocumentation
 */

import type { EmbeddingModel, EmbeddingModelV1 } from 'ai'

/**
 * Default Cloudflare embedding model
 */
export const DEFAULT_CF_EMBEDDING_MODEL = '@cf/baai/bge-m3'

/**
 * Cloudflare Workers AI configuration
 */
export interface CloudflareConfig {
  /** Cloudflare Account ID */
  accountId?: string
  /** Cloudflare API Token */
  apiToken?: string
  /** AI Gateway (optional) */
  gateway?: string
  /** Base URL override */
  baseUrl?: string
}

/**
 * Get Cloudflare config from environment
 */
function getCloudflareConfig(): CloudflareConfig {
  return {
    accountId: typeof process !== 'undefined' ? process.env?.CLOUDFLARE_ACCOUNT_ID : undefined,
    apiToken: typeof process !== 'undefined' ? process.env?.CLOUDFLARE_API_TOKEN : undefined,
    gateway: typeof process !== 'undefined' ? process.env?.CLOUDFLARE_AI_GATEWAY : undefined
  }
}

/**
 * Cloudflare embedding model implementation
 */
class CloudflareEmbeddingModel implements EmbeddingModelV1<string> {
  readonly specificationVersion = 'v1' as const
  readonly modelId: string
  readonly provider = 'cloudflare'
  readonly maxEmbeddingsPerCall = 100
  readonly supportsParallelCalls = true

  private config: CloudflareConfig
  private ai?: Ai // Cloudflare AI binding (when running in Workers)

  constructor(
    modelId: string = DEFAULT_CF_EMBEDDING_MODEL,
    config: CloudflareConfig = {},
    ai?: Ai
  ) {
    this.modelId = modelId
    this.config = { ...getCloudflareConfig(), ...config }
    this.ai = ai
  }

  async doEmbed(options: {
    values: string[]
    abortSignal?: AbortSignal
    headers?: Record<string, string>
  }): Promise<{
    embeddings: number[][]
    usage?: { tokens: number }
    rawResponse?: { headers?: Record<string, string> }
  }> {
    const { values, abortSignal, headers } = options

    // If running in Cloudflare Workers with AI binding
    if (this.ai) {
      return this.embedWithBinding(values)
    }

    // Otherwise use REST API
    return this.embedWithRest(values, abortSignal, headers)
  }

  private async embedWithBinding(values: string[]): Promise<{
    embeddings: number[][]
    usage?: { tokens: number }
  }> {
    const embeddings: number[][] = []

    // Cloudflare AI binding processes one at a time or in batches depending on model
    for (const text of values) {
      const result = await this.ai!.run(this.modelId as BaseAiTextEmbeddingsModels, {
        text
      })

      if ('data' in result && Array.isArray(result.data)) {
        embeddings.push(result.data[0] as number[])
      }
    }

    return { embeddings }
  }

  private async embedWithRest(
    values: string[],
    abortSignal?: AbortSignal,
    headers?: Record<string, string>
  ): Promise<{
    embeddings: number[][]
    usage?: { tokens: number }
    rawResponse?: { headers?: Record<string, string> }
  }> {
    const { accountId, apiToken, gateway, baseUrl } = this.config

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials required. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      )
    }

    const url = baseUrl ||
      (gateway
        ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/workers-ai/${this.modelId}`
        : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${this.modelId}`)

    const embeddings: number[][] = []

    // Process in batches (some models have limits)
    for (const text of values) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({ text }),
        signal: abortSignal
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Cloudflare AI error: ${response.status} ${error}`)
      }

      const result = await response.json() as {
        success: boolean
        result?: { data: number[][] }
        errors?: Array<{ message: string }>
      }

      if (!result.success || !result.result) {
        throw new Error(`Cloudflare AI error: ${result.errors?.[0]?.message || 'Unknown error'}`)
      }

      embeddings.push(result.result.data[0])
    }

    return { embeddings }
  }
}

/**
 * Create a Cloudflare Workers AI embedding model
 *
 * @example
 * ```ts
 * // Using REST API (outside Workers)
 * import { cloudflareEmbedding, embed } from 'ai-functions'
 *
 * const model = cloudflareEmbedding('@cf/baai/bge-m3')
 * const { embedding } = await embed({ model, value: 'hello world' })
 *
 * // Using AI binding (inside Workers)
 * const model = cloudflareEmbedding('@cf/baai/bge-m3', {}, env.AI)
 * ```
 */
export function cloudflareEmbedding(
  modelId: string = DEFAULT_CF_EMBEDDING_MODEL,
  config: CloudflareConfig = {},
  ai?: Ai
): EmbeddingModelV1<string> {
  return new CloudflareEmbeddingModel(modelId, config, ai)
}

/**
 * Cloudflare Workers AI provider
 */
export const cloudflare = {
  /**
   * Create an embedding model
   */
  embedding: cloudflareEmbedding,

  /**
   * Alias for embedding
   */
  textEmbeddingModel: cloudflareEmbedding
}

// Type definitions for Cloudflare AI binding
declare global {
  interface Ai {
    run<T = unknown>(model: string, inputs: unknown): Promise<T>
  }

  type BaseAiTextEmbeddingsModels =
    | '@cf/baai/bge-small-en-v1.5'
    | '@cf/baai/bge-base-en-v1.5'
    | '@cf/baai/bge-large-en-v1.5'
    | '@cf/baai/bge-m3'
    | (string & {})
}

export type { CloudflareConfig, CloudflareEmbeddingModel }
