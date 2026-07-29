/**
 * ai-providers - Unified AI Provider Registry
 *
 * Access multiple AI providers via simple string identifiers.
 * Supports Cloudflare AI Gateway for unified routing and auth.
 *
 * @packageDocumentation
 */

export {
  createRegistry,
  getRegistry,
  configureRegistry,
  model,
  embeddingModel,
  DIRECT_PROVIDERS,
  type ProviderId,
  type DirectProvider,
  type ProviderConfig
} from './registry.js'

// Export llm.do WebSocket transport
export {
  LLM,
  getLLM,
  createLLMFetch,
  type LLMConfig,
  type UniversalRequest,
  type UniversalCreated,
  type UniversalStream,
  type UniversalDone,
  type UniversalError,
  type GatewayMessage
} from './llm.do.js'

// Multi-provider execution driver — the L1 runtime half of the multi-provider
// abstraction. `language-models` builds the pure selection plan; this walks it
// with quota-fallback. The `model.run(PreparedGeneration)` seam in
// `ai-functions` wraps `runWithFallback` around its AI-SDK call.
export {
  runWithFallback,
  type InvokeCandidate,
  type FallbackResult,
} from './run.js'

// Re-export the L0 selection/quota-fallback policy so consumers can build a
// plan and run it from one import surface.
export {
  isQuotaError,
  selectionFor,
  nextCandidate,
  batchProviderFor,
  batchPlanFor,
  type ProviderCandidate,
  type SelectionOptions,
  type BatchProvider as BatchProviderId,
  type BatchPlan,
} from 'language-models'

// Re-export AI SDK types for convenience
export type { Provider, ProviderRegistryProvider } from 'ai'
