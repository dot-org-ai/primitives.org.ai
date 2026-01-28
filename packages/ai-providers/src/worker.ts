/**
 * Provider Worker - exposes AI provider registry via RPC
 *
 * This worker can be deployed to Cloudflare Workers or run locally via Miniflare.
 * It exposes model and embedding model access via Workers RPC.
 *
 * Uses Cloudflare Workers RPC (WorkerEntrypoint, RpcTarget) for communication.
 */

import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'
import type { LanguageModel, EmbeddingModel, ProviderRegistryProvider } from 'ai'
import {
  createRegistry,
  DIRECT_PROVIDERS,
  type ProviderId,
  type ProviderConfig,
} from './registry.js'
import { cloudflareEmbedding } from './providers/cloudflare.js'

/**
 * Environment bindings for the worker
 */
export interface Env {
  /** Cloudflare AI binding */
  AI?: Ai
  /** AI Gateway URL */
  AI_GATEWAY_URL?: string
  /** AI Gateway token */
  AI_GATEWAY_TOKEN?: string
  DO_TOKEN?: string
  /** Provider API keys */
  OPENAI_API_KEY?: string
  ANTHROPIC_API_KEY?: string
  GOOGLE_GENERATIVE_AI_API_KEY?: string
  OPENROUTER_API_KEY?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_API_TOKEN?: string
}

/**
 * List of available providers
 */
const AVAILABLE_PROVIDERS: ProviderId[] = [
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'cloudflare',
  'bedrock',
]

/**
 * Core provider service - extends RpcTarget so it can be passed over RPC
 *
 * Contains all provider functionality: model access, embedding models,
 * and provider configuration.
 */
export class ProviderServiceCore extends RpcTarget {
  protected env: Env
  protected registry: ProviderRegistryProvider | null = null
  protected registryPromise: Promise<ProviderRegistryProvider> | null = null

  constructor(env: Env) {
    super()
    this.env = env
  }

  /**
   * Get provider configuration from environment
   */
  private getConfig(): ProviderConfig {
    return {
      gatewayUrl: this.env.AI_GATEWAY_URL,
      gatewayToken: this.env.AI_GATEWAY_TOKEN || this.env.DO_TOKEN,
      openaiApiKey: this.env.OPENAI_API_KEY,
      anthropicApiKey: this.env.ANTHROPIC_API_KEY,
      googleApiKey: this.env.GOOGLE_GENERATIVE_AI_API_KEY,
      openrouterApiKey: this.env.OPENROUTER_API_KEY,
      cloudflareAccountId: this.env.CLOUDFLARE_ACCOUNT_ID,
      cloudflareApiToken: this.env.CLOUDFLARE_API_TOKEN,
    }
  }

  /**
   * Get or create the provider registry
   */
  async getRegistry(): Promise<ProviderRegistryProvider> {
    if (this.registry) return this.registry

    if (!this.registryPromise) {
      this.registryPromise = createRegistry(this.getConfig()).then((registry) => {
        this.registry = registry
        return registry
      })
    }

    return this.registryPromise
  }

  /**
   * Get a language model by ID
   *
   * Supports multiple formats:
   * - Provider:model format: 'anthropic:claude-sonnet-4-20250514', 'openai:gpt-4o'
   * - Aliases: 'sonnet', 'opus', 'gpt-4o'
   * - OpenRouter format: 'meta-llama/llama-3.3-70b-instruct'
   *
   * @example
   * ```ts
   * const model = await core.model('anthropic:claude-sonnet-4-20250514')
   * const alias = await core.model('sonnet')
   * const llama = await core.model('meta-llama/llama-3.3-70b-instruct')
   * ```
   */
  async model(id: string): Promise<LanguageModel> {
    const registry = await this.getRegistry()

    // Check for direct provider:model format (e.g., anthropic:claude-sonnet-4-20250514)
    const colonIndex = id.indexOf(':')
    if (colonIndex > 0) {
      const provider = id.substring(0, colonIndex)
      // Known providers that support direct routing
      if (['bedrock', 'openai', 'anthropic', 'google', 'openrouter'].includes(provider)) {
        return registry.languageModel(id as `${string}:${string}`)
      }
    }

    // Try to resolve with provider routing info via language-models
    try {
      const { resolveWithProvider } = await import('language-models')
      const resolved = resolveWithProvider(id)

      // Extract expected provider from the model ID (e.g., 'anthropic' from 'anthropic/claude-sonnet-4.5')
      const slashIndex = resolved.id.indexOf('/')
      const expectedProvider = slashIndex > 0 ? resolved.id.substring(0, slashIndex) : null

      // Use direct routing if:
      // 1. Provider supports direct SDK access (openai, anthropic, google)
      // 2. We have the provider's native model ID
      // 3. The data's provider matches the expected provider from the model ID
      const dataProvider = resolved.model?.provider
      const providerMatches = expectedProvider && dataProvider === expectedProvider

      if (
        resolved.supportsDirectRouting &&
        resolved.providerModelId &&
        providerMatches &&
        (DIRECT_PROVIDERS as readonly string[]).includes(expectedProvider)
      ) {
        // Route directly to provider SDK with native model ID
        const modelSpec = `${expectedProvider}:${resolved.providerModelId}` as `${string}:${string}`
        return registry.languageModel(modelSpec)
      }

      // Fall back to OpenRouter for all other models
      return registry.languageModel(`openrouter:${resolved.id}`)
    } catch {
      // language-models not available, route through OpenRouter as-is
      return registry.languageModel(`openrouter:${id}`)
    }
  }

  /**
   * Get an embedding model by ID
   *
   * Supports:
   * - OpenAI: 'openai:text-embedding-3-small'
   * - Cloudflare Workers AI: 'cloudflare:@cf/baai/bge-m3'
   *
   * @example
   * ```ts
   * const openai = await core.embeddingModel('openai:text-embedding-3-small')
   * const cf = await core.embeddingModel('cloudflare:@cf/baai/bge-m3')
   * ```
   */
  async embeddingModel(id: string): Promise<EmbeddingModel<string>> {
    const registry = await this.getRegistry()

    // Check for cloudflare provider - use AI binding if available
    const colonIndex = id.indexOf(':')
    if (colonIndex > 0) {
      const provider = id.substring(0, colonIndex)
      const modelId = id.substring(colonIndex + 1)

      if (provider === 'cloudflare' && this.env.AI) {
        // Use Cloudflare AI binding directly for better performance
        const config = this.getConfig()
        return cloudflareEmbedding(
          modelId,
          {
            accountId: config.cloudflareAccountId,
            apiToken: config.cloudflareApiToken,
          },
          this.env.AI
        )
      }
    }

    return registry.textEmbeddingModel(id as `${string}:${string}`)
  }

  /**
   * List all available provider IDs
   *
   * @returns Array of provider IDs that can be used with model() and embeddingModel()
   */
  async listProviders(): Promise<ProviderId[]> {
    return AVAILABLE_PROVIDERS
  }
}

/**
 * Main provider service exposed via RPC as WorkerEntrypoint
 *
 * Usage:
 *   const providers = await env.PROVIDERS.connect()
 *   const model = await providers.model('anthropic:claude-sonnet-4-20250514')
 *   const embed = await providers.embeddingModel('cloudflare:@cf/baai/bge-m3')
 */
export class ProviderService extends WorkerEntrypoint<Env> {
  /**
   * Get a provider service instance - returns an RpcTarget that can be used directly
   */
  connect(): ProviderServiceCore {
    return new ProviderServiceCore(this.env)
  }
}

// Export as default for WorkerEntrypoint pattern
export default ProviderService

// Export aliases
export { ProviderService as ProviderWorker }
