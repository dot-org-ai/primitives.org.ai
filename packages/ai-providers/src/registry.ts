/**
 * Unified AI Provider Registry
 *
 * Centralizes access to multiple AI providers via simple string identifiers.
 *
 * Smart routing:
 * - openai/* models → OpenAI SDK (via gateway)
 * - anthropic/* models → Anthropic SDK (via gateway)
 * - google/* models → Google AI SDK (via gateway)
 * - All other models → OpenRouter (via gateway)
 *
 * Supports simple aliases: 'opus' → anthropic/claude-opus-4.5
 *
 * @packageDocumentation
 */

import { createProviderRegistry, type Provider, type ProviderRegistryProvider } from 'ai'

/**
 * Available provider IDs
 */
export type ProviderId = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'cloudflare'

/**
 * Providers that get direct SDK access (not via openrouter)
 * These support special capabilities like MCP, structured outputs, etc.
 * Re-exported from language-models for consistency.
 */
export { DIRECT_PROVIDERS, type DirectProvider } from 'language-models'

/**
 * Provider configuration options
 */
export interface ProviderConfig {
  /** Cloudflare AI Gateway URL (e.g., https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}) */
  gatewayUrl?: string
  /** AI Gateway auth token */
  gatewayToken?: string

  /** OpenAI API key (fallback if no gateway) */
  openaiApiKey?: string
  /** Anthropic API key (fallback if no gateway) */
  anthropicApiKey?: string
  /** Google AI API key (fallback if no gateway) */
  googleApiKey?: string
  /** OpenRouter API key (fallback if no gateway) */
  openrouterApiKey?: string
  /** Cloudflare Account ID */
  cloudflareAccountId?: string
  /** Cloudflare API Token (fallback if no gateway) */
  cloudflareApiToken?: string

  /** Custom base URLs (overrides gateway) */
  baseUrls?: Partial<Record<ProviderId, string>>
}

/**
 * Cloudflare AI Gateway provider endpoint mapping
 */
const GATEWAY_PROVIDER_PATHS: Record<ProviderId, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google-ai-studio',
  openrouter: 'openrouter',
  cloudflare: 'workers-ai'
}

/**
 * Get provider configuration from environment variables
 */
function getEnvConfig(): ProviderConfig {
  if (typeof process === 'undefined') return {}

  return {
    // Cloudflare AI Gateway
    gatewayUrl: process.env.AI_GATEWAY_URL,
    gatewayToken: process.env.AI_GATEWAY_TOKEN || process.env.DO_TOKEN,

    // Individual provider keys (fallbacks)
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN
  }
}

/**
 * Get the base URL for a provider, using Cloudflare AI Gateway if configured
 */
function getBaseUrl(
  providerId: ProviderId,
  config: ProviderConfig,
  defaultUrl?: string
): string | undefined {
  // Custom URL takes priority
  if (config.baseUrls?.[providerId]) {
    return config.baseUrls[providerId]
  }

  // Use Cloudflare AI Gateway if configured
  if (config.gatewayUrl) {
    const gatewayPath = GATEWAY_PROVIDER_PATHS[providerId]
    return `${config.gatewayUrl}/${gatewayPath}`
  }

  return defaultUrl
}

/**
 * Create a custom fetch that handles Cloudflare AI Gateway authentication
 * When using gateway with secrets, we strip SDK's API key headers and let the gateway inject them
 */
function createGatewayFetch(config: ProviderConfig): typeof fetch | undefined {
  if (!config.gatewayUrl || !config.gatewayToken) {
    return undefined
  }

  return async (url, init) => {
    const headers = new Headers(init?.headers)
    // Remove SDK's API key headers - gateway will inject from its secrets
    headers.delete('x-api-key')
    headers.delete('authorization')
    headers.delete('x-goog-api-key')
    // Add gateway authentication
    headers.set('cf-aig-authorization', `Bearer ${config.gatewayToken}`)
    return fetch(url, { ...init, headers })
  }
}

/**
 * Check if using gateway with secrets (token configured)
 */
function useGatewaySecrets(config: ProviderConfig): boolean {
  return !!(config.gatewayUrl && config.gatewayToken)
}

/**
 * Get API key - when using gateway secrets, use a placeholder
 */
function getApiKey(config: ProviderConfig, providerApiKey?: string): string | undefined {
  if (useGatewaySecrets(config)) {
    return 'gateway' // Placeholder - will be stripped by gatewayFetch
  }
  return providerApiKey
}

/**
 * Create OpenAI provider
 */
async function createOpenAIProvider(config: ProviderConfig): Promise<unknown> {
  const { createOpenAI } = await import('@ai-sdk/openai')
  return createOpenAI({
    apiKey: getApiKey(config, config.openaiApiKey),
    baseURL: getBaseUrl('openai', config),
    fetch: createGatewayFetch(config),
  })
}

/**
 * Create Anthropic provider
 */
async function createAnthropicProvider(config: ProviderConfig): Promise<unknown> {
  const { createAnthropic } = await import('@ai-sdk/anthropic')
  return createAnthropic({
    apiKey: getApiKey(config, config.anthropicApiKey),
    baseURL: getBaseUrl('anthropic', config),
    fetch: createGatewayFetch(config),
  })
}

/**
 * Create Google AI provider
 */
async function createGoogleProvider(config: ProviderConfig): Promise<unknown> {
  const { createGoogleGenerativeAI } = await import('@ai-sdk/google')
  return createGoogleGenerativeAI({
    apiKey: getApiKey(config, config.googleApiKey),
    baseURL: getBaseUrl('google', config),
    fetch: createGatewayFetch(config),
  })
}

/**
 * Create OpenRouter provider (OpenAI-compatible)
 */
async function createOpenRouterProvider(config: ProviderConfig): Promise<unknown> {
  const { createOpenAI } = await import('@ai-sdk/openai')
  return createOpenAI({
    apiKey: getApiKey(config, config.openrouterApiKey),
    baseURL: getBaseUrl('openrouter', config, 'https://openrouter.ai/api/v1'),
    fetch: createGatewayFetch(config),
  })
}

/**
 * Create Cloudflare Workers AI provider
 */
async function createCloudflareProvider(config: ProviderConfig): Promise<unknown> {
  const { cloudflare } = await import('./providers/cloudflare.js')

  return {
    languageModel: (modelId: string) => {
      throw new Error(`Cloudflare language models not yet supported via registry. Use embedding models like: cloudflare:@cf/baai/bge-m3`)
    },
    textEmbeddingModel: (modelId: string) => {
      return cloudflare.embedding(modelId, {
        accountId: config.cloudflareAccountId,
        apiToken: getApiKey(config, config.cloudflareApiToken),
        baseUrl: getBaseUrl('cloudflare', config)
      })
    }
  } as unknown
}

/**
 * Provider factories map
 */
const providerFactories: Record<ProviderId, (config: ProviderConfig) => Promise<unknown>> = {
  openai: createOpenAIProvider,
  anthropic: createAnthropicProvider,
  google: createGoogleProvider,
  openrouter: createOpenRouterProvider,
  cloudflare: createCloudflareProvider
}

/**
 * Create a unified provider registry with all configured providers
 *
 * @example
 * ```ts
 * import { createRegistry } from 'ai-providers'
 * import { generateText, embed } from 'ai'
 *
 * // With Cloudflare AI Gateway (recommended)
 * // Set AI_GATEWAY_URL and AI_GATEWAY_TOKEN env vars
 *
 * const registry = await createRegistry()
 *
 * // Use any provider with simple string IDs
 * const { text } = await generateText({
 *   model: registry.languageModel('openai:gpt-4o'),
 *   prompt: 'Hello!'
 * })
 *
 * const { text: claude } = await generateText({
 *   model: registry.languageModel('anthropic:claude-3-5-sonnet-latest'),
 *   prompt: 'Hello!'
 * })
 *
 * const { embedding } = await embed({
 *   model: registry.textEmbeddingModel('cloudflare:@cf/baai/bge-m3'),
 *   value: 'Hello!'
 * })
 * ```
 */
export async function createRegistry(
  config: ProviderConfig = {},
  options: { providers?: ProviderId[] } = {}
): Promise<ProviderRegistryProvider> {
  const mergedConfig = { ...getEnvConfig(), ...config }
  const providerIds = options.providers || (['openai', 'anthropic', 'google', 'openrouter', 'cloudflare'] as ProviderId[])

  const providers: Record<string, unknown> = {}

  // Load providers in parallel
  await Promise.all(
    providerIds.map(async (id) => {
      try {
        providers[id] = await providerFactories[id](mergedConfig)
      } catch (error) {
        // Provider SDK not installed - skip silently
        if (process.env.DEBUG) {
          console.warn(`Provider ${id} not available:`, error)
        }
      }
    })
  )

  return createProviderRegistry(providers as Record<string, any>)
}

// Default registry management
let defaultRegistry: ProviderRegistryProvider | null = null
let defaultRegistryPromise: Promise<ProviderRegistryProvider> | null = null

/**
 * Get or create the default provider registry
 */
export async function getRegistry(): Promise<ProviderRegistryProvider> {
  if (defaultRegistry) return defaultRegistry

  if (!defaultRegistryPromise) {
    defaultRegistryPromise = createRegistry().then(registry => {
      defaultRegistry = registry
      return registry
    })
  }

  return defaultRegistryPromise
}

/**
 * Configure the default registry with custom settings
 */
export async function configureRegistry(config: ProviderConfig): Promise<void> {
  defaultRegistry = await createRegistry(config)
  defaultRegistryPromise = null
}

/**
 * Parse a model ID into provider and model name
 *
 * @example
 * parseModelId('openai/gpt-4o') // { provider: 'openai', model: 'gpt-4o' }
 * parseModelId('meta-llama/llama-3.3-70b') // { provider: 'meta-llama', model: 'llama-3.3-70b' }
 */
function parseModelId(id: string): { provider: string; model: string } {
  const slashIndex = id.indexOf('/')
  if (slashIndex === -1) {
    return { provider: 'openrouter', model: id }
  }
  return {
    provider: id.substring(0, slashIndex),
    model: id.substring(slashIndex + 1)
  }
}

/**
 * Get a language model with smart routing
 *
 * Resolves aliases and routes to the appropriate provider:
 * - openai/* → OpenAI SDK (via gateway) when provider_model_id is available
 * - anthropic/* → Anthropic SDK (via gateway) when provider_model_id is available
 * - google/* → Google AI SDK (via gateway) when provider_model_id is available
 * - All others → OpenRouter (via gateway)
 *
 * Direct routing to native SDKs enables provider-specific features like:
 * - Anthropic: MCP (Model Context Protocol), extended thinking
 * - OpenAI: Function calling, JSON mode, vision
 * - Google: Grounding, code execution
 *
 * @example
 * ```ts
 * import { model } from 'ai-providers'
 *
 * // Simple aliases
 * const opus = await model('opus')           // → anthropic:claude-opus-4-5-20251101
 * const gpt = await model('gpt-4o')          // → openai:gpt-4o
 * const llama = await model('llama-70b')     // → openrouter:meta-llama/llama-3.3-70b-instruct
 *
 * // Full IDs also work
 * const claude = await model('anthropic/claude-sonnet-4.5')
 * const mistral = await model('mistralai/mistral-large-2411')
 * ```
 */
export async function model(id: string) {
  const registry = await getRegistry()

  // Try to resolve with provider routing info
  try {
    const { resolveWithProvider, DIRECT_PROVIDERS } = await import('language-models')
    const resolved = resolveWithProvider(id)

    // Extract expected provider from the model ID (e.g., 'anthropic' from 'anthropic/claude-sonnet-4.5')
    const slashIndex = resolved.id.indexOf('/')
    const expectedProvider = slashIndex > 0 ? resolved.id.substring(0, slashIndex) : null

    // Use direct routing if:
    // 1. Provider supports direct SDK access (openai, anthropic, google)
    // 2. We have the provider's native model ID
    // 3. The data's provider matches the expected provider from the model ID
    //    (OpenRouter may return different top providers like google-vertex for anthropic models)
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
 * Shorthand to get an embedding model from the default registry
 *
 * @example
 * ```ts
 * import { embeddingModel } from 'ai-providers'
 *
 * const openaiEmbed = await embeddingModel('openai:text-embedding-3-small')
 * const cfEmbed = await embeddingModel('cloudflare:@cf/baai/bge-m3')
 * ```
 */
export async function embeddingModel(id: string) {
  const registry = await getRegistry()
  return registry.textEmbeddingModel(id as `${string}:${string}`)
}
