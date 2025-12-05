/**
 * Provider Registry Implementation
 *
 * Central registry for discovering and instantiating providers.
 *
 * @packageDocumentation
 */

import type {
  BaseProvider,
  ProviderCategory,
  ProviderConfig,
  ProviderFactory,
  ProviderInfo,
  ProviderRegistry,
  RegisteredProvider,
} from './types.js'

/**
 * Create a new provider registry
 */
export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<string, RegisteredProvider>()

  return {
    register<T extends BaseProvider>(info: ProviderInfo, factory: ProviderFactory<T>): void {
      if (providers.has(info.id)) {
        throw new Error(`Provider '${info.id}' is already registered`)
      }
      providers.set(info.id, { info, factory })
    },

    get<T extends BaseProvider>(providerId: string): RegisteredProvider<T> | undefined {
      return providers.get(providerId) as RegisteredProvider<T> | undefined
    },

    list(category?: ProviderCategory): RegisteredProvider[] {
      const all = Array.from(providers.values())
      if (category) {
        return all.filter((p) => p.info.category === category)
      }
      return all
    },

    async create<T extends BaseProvider>(providerId: string, config: ProviderConfig): Promise<T> {
      const registered = providers.get(providerId)
      if (!registered) {
        throw new Error(`Provider '${providerId}' not found. Available: ${Array.from(providers.keys()).join(', ')}`)
      }

      // Validate required config
      const missing = registered.info.requiredConfig.filter((key) => !(key in config))
      if (missing.length > 0) {
        throw new Error(`Provider '${providerId}' missing required config: ${missing.join(', ')}`)
      }

      const provider = await registered.factory(config)
      await provider.initialize(config)
      return provider as T
    },

    has(providerId: string): boolean {
      return providers.has(providerId)
    },
  }
}

/**
 * Global provider registry instance
 */
export const providerRegistry = createProviderRegistry()

/**
 * Register a provider in the global registry
 */
export function registerProvider<T extends BaseProvider>(
  info: ProviderInfo,
  factory: ProviderFactory<T>
): void {
  providerRegistry.register(info, factory)
}

/**
 * Get a provider from the global registry
 */
export function getProvider<T extends BaseProvider>(providerId: string): RegisteredProvider<T> | undefined {
  return providerRegistry.get<T>(providerId)
}

/**
 * Create a provider instance from the global registry
 */
export async function createProvider<T extends BaseProvider>(
  providerId: string,
  config: ProviderConfig
): Promise<T> {
  return providerRegistry.create<T>(providerId, config)
}

/**
 * List providers by category
 */
export function listProviders(category?: ProviderCategory): RegisteredProvider[] {
  return providerRegistry.list(category)
}

/**
 * Helper to define a provider with type safety
 */
export function defineProvider<T extends BaseProvider>(
  info: ProviderInfo,
  factory: ProviderFactory<T>
): { info: ProviderInfo; factory: ProviderFactory<T>; register: () => void } {
  return {
    info,
    factory,
    register: () => registerProvider(info, factory),
  }
}
