/**
 * Cloudflare Workers AI Provider for embeddings and language models
 *
 * Provides embedding and language models via Cloudflare Workers AI API.
 * Default embedding model: @cf/baai/bge-m3
 * Default language model: @cf/meta/llama-3.3-70b-instruct-fp8-fast
 *
 * For language models, uses Cloudflare's OpenAI-compatible endpoint.
 *
 * @packageDocumentation
 */

import type { EmbeddingModel, LanguageModel } from 'ai'

/**
 * Default Cloudflare embedding model
 */
export const DEFAULT_CF_EMBEDDING_MODEL = '@cf/baai/bge-m3'
export const DEFAULT_CF_LANGUAGE_MODEL = '@cf/openai/gpt-oss-120b'

/**
 * Cloudflare Workers AI configuration
 */
export interface CloudflareConfig {
  /** Cloudflare Account ID */
  accountId?: string | undefined
  /** Cloudflare API Token */
  apiToken?: string | undefined
  /** AI Gateway (optional) */
  gateway?: string | undefined
  /** Base URL override */
  baseUrl?: string | undefined
}

/**
 * Get Cloudflare config from environment
 */
function getCloudflareConfig(): CloudflareConfig {
  return {
    accountId: typeof process !== 'undefined' ? process.env?.['CLOUDFLARE_ACCOUNT_ID'] : undefined,
    apiToken: typeof process !== 'undefined' ? process.env?.['CLOUDFLARE_API_TOKEN'] : undefined,
    gateway: typeof process !== 'undefined' ? process.env?.['CLOUDFLARE_AI_GATEWAY'] : undefined,
  }
}

/**
 * Cloudflare embedding model implementation (AI SDK v5 compatible)
 */
class CloudflareEmbeddingModel {
  readonly specificationVersion = 'v2' as const
  readonly modelId: string
  readonly provider = 'cloudflare'
  readonly maxEmbeddingsPerCall = 100
  readonly supportsParallelCalls = true

  private config: CloudflareConfig
  private ai: Ai | undefined // Cloudflare AI binding (when running in Workers)

  constructor(
    modelId: string = DEFAULT_CF_EMBEDDING_MODEL,
    config: CloudflareConfig = {},
    ai?: Ai | undefined
  ) {
    this.modelId = modelId
    this.config = { ...getCloudflareConfig(), ...config }
    this.ai = ai
  }

  async doEmbed(options: {
    values: string[]
    abortSignal?: AbortSignal | undefined
    headers?: Record<string, string> | undefined
  }): Promise<{
    embeddings: number[][]
    usage?: { tokens: number } | undefined
    response?: { headers?: Record<string, string> | undefined; body?: unknown } | undefined
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
    usage?: { tokens: number } | undefined
  }> {
    const embeddings: number[][] = []

    // Cloudflare AI binding processes one at a time or in batches depending on model
    for (const text of values) {
      const result = (await this.ai!.run(this.modelId as BaseAiTextEmbeddingsModels, {
        text,
      })) as { data?: number[][] }

      if (result.data && Array.isArray(result.data) && result.data[0]) {
        embeddings.push(result.data[0])
      }
    }

    return { embeddings }
  }

  private async embedWithRest(
    values: string[],
    abortSignal?: AbortSignal | undefined,
    headers?: Record<string, string> | undefined
  ): Promise<{
    embeddings: number[][]
    usage?: { tokens: number } | undefined
    response?: { headers?: Record<string, string> | undefined; body?: unknown } | undefined
  }> {
    const { accountId, apiToken, gateway, baseUrl } = this.config

    if (!accountId || !apiToken) {
      throw new Error(
        'Cloudflare credentials required. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
      )
    }

    const url =
      baseUrl ||
      (gateway
        ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/workers-ai/${this.modelId}`
        : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${this.modelId}`)

    const embeddings: number[][] = []

    // Process in batches (some models have limits)
    for (const text of values) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({ text }),
        signal: abortSignal ?? null,
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Cloudflare AI error: ${response.status} ${error}`)
      }

      const result = (await response.json()) as {
        success: boolean
        result?: { data: number[][] }
        errors?: Array<{ message: string }>
      }

      if (!result.success || !result.result || !result.result.data[0]) {
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
  ai?: Ai | undefined
): EmbeddingModel<string> {
  return new CloudflareEmbeddingModel(modelId, config, ai) as unknown as EmbeddingModel<string>
}

/**
 * Create a Cloudflare Workers AI language model using OpenAI-compatible endpoint
 *
 * Cloudflare provides an OpenAI-compatible API for language models at:
 * https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/v1
 *
 * @example
 * ```ts
 * import { cloudflareLanguageModel } from 'ai-providers'
 * import { generateText } from 'ai'
 *
 * const model = await cloudflareLanguageModel('@cf/meta/llama-3.3-70b-instruct-fp8-fast')
 * const { text } = await generateText({ model, prompt: 'Hello!' })
 * ```
 */
export async function cloudflareLanguageModel(
  modelId: string = DEFAULT_CF_LANGUAGE_MODEL,
  config: CloudflareConfig = {}
): Promise<LanguageModel> {
  const mergedConfig = { ...getCloudflareConfig(), ...config }
  const { accountId, apiToken, gateway } = mergedConfig

  if (!accountId || !apiToken) {
    throw new Error(
      'Cloudflare credentials required. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN environment variables.'
    )
  }

  // Use OpenAI SDK pointed at Cloudflare's OpenAI-compatible endpoint
  const { createOpenAI } = await import('@ai-sdk/openai')

  // Build base URL - use gateway if configured, otherwise direct API
  const baseURL = gateway
    ? `https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/workers-ai/v1`
    : `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`

  const openai = createOpenAI({
    apiKey: apiToken,
    baseURL,
  })

  // Return the language model - model ID should be the Cloudflare model name
  return openai(modelId)
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
  textEmbeddingModel: cloudflareEmbedding,

  /**
   * Create a language model (async - uses OpenAI-compatible endpoint)
   */
  languageModel: cloudflareLanguageModel,
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

export type { CloudflareEmbeddingModel }
