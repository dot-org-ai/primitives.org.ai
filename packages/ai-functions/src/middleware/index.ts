/**
 * Middleware barrel — composable AI SDK 6 `LanguageModelV3Middleware`
 * primitives for `wrapLanguageModel`.
 *
 * @packageDocumentation
 */

export { cacheMiddleware, type CacheMiddlewareOptions, type CacheMiddlewareStore } from './cache.js'

export {
  embeddingCacheMiddleware,
  type EmbedCacheMiddlewareOptions,
  type EmbedCacheMiddlewareStore,
} from './embed-cache.js'

export { budgetMiddleware, type BudgetMiddlewareOptions, type PricingOverlay } from './budget.js'

export {
  traceMiddleware,
  type TraceEvent,
  type TraceEventKind,
  type TraceMiddlewareOptions,
} from './trace.js'
