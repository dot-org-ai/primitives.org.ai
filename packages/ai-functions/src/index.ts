/**
 * ai-functions - Full-featured AI primitives for building intelligent applications
 *
 * This package provides the complete feature set including:
 * - Core primitives from ai-core (generate, AIPromise, templates, context)
 * - Batch processing (BatchQueue, BatchMapPromise)
 * - Retry/resilience patterns (RetryPolicy, CircuitBreaker, FallbackChain)
 * - Budget tracking (BudgetTracker, TokenCounter)
 * - Caching (MemoryCache, EmbeddingCache, GenerationCache)
 * - Tool orchestration (AgenticLoop, ToolRouter)
 * - Embeddings
 * - Provider integrations
 *
 * For lightweight usage with just core primitives, use ai-core directly.
 *
 * @packageDocumentation
 */

// ============================================================================
// Re-export core primitives for backward compatibility
// ============================================================================

// Types
export type {
  AIFunctionDefinition,
  JSONSchema,
  AIGenerateOptions,
  AIGenerateResult,
  AIFunctionCall,
  AIClient,
  ImageOptions,
  ImageResult,
  VideoOptions,
  VideoResult,
  WriteOptions,
  TemplateFunction as CoreTemplateFunction,
  ListItem,
  ListResult,
  NamedList,
  ListsResult,
  CodeLanguage,
  GenerativeOutputType,
  HumanChannel,
  LegacyHumanChannel,
  SchemaLimitations,
  BaseFunctionDefinition,
  CodeFunctionDefinition,
  CodeFunctionResult,
  GenerativeFunctionDefinition,
  GenerativeFunctionResult,
  AgenticFunctionDefinition,
  AgenticExecutionState,
  HumanFunctionDefinition,
  HumanFunctionResult,
  FunctionDefinition,
  DefinedFunction,
  FunctionRegistry,
  AutoDefineResult,
} from './types.js'

// Schema exports
export { schema, type SimpleSchema } from './schema.js'

// Template exports
export {
  parseTemplate,
  createTemplateFunction,
  createChainablePromise,
  createStreamableList,
  withBatch,
  type FunctionOptions,
  type TemplateFunction,
  type BatchableFunction,
  type StreamableList,
  type ChainablePromise,
} from './template.js'

// AIPromise exports
export {
  AIPromise,
  isAIPromise,
  getRawPromise,
  createTextPromise,
  createObjectPromise,
  createListPromise,
  createListsPromise,
  createBooleanPromise,
  createExtractPromise,
  createAITemplateFunction,
  parseTemplateWithDependencies,
  AI_PROMISE_SYMBOL,
  RAW_PROMISE_SYMBOL,
  type AIPromiseOptions,
  type StreamingAIPromise,
  type StreamOptions,
} from './ai-promise.js'

// Generation exports
export { generateObject, generateText, streamObject, streamText } from './generate.js'

// Primitives
export {
  generate,
  type GenerateType,
  type GenerateOptions,
  ai,
  write,
  code,
  list,
  lists,
  extract,
  summarize,
  is,
  diagram,
  slides,
  image,
  video,
  do,
  research,
  read,
  browse,
  decide,
  ask,
  approve,
  review,
  type HumanOptions,
  type HumanResult,
} from './primitives.js'

// Context exports
export {
  configure,
  getContext,
  withContext,
  getGlobalContext,
  resetContext,
  getModel,
  getProvider,
  type ExecutionContext,
} from './context.js'

// Type guards
export { isZodSchema } from './type-guards.js'

// ============================================================================
// Export AI Proxy (the AI class/proxy from ai.ts)
// This is separate from the core 'ai' template function
// ============================================================================

export {
  AI,
  ai as aiProxy,
  define,
  defineFunction,
  functions,
  createFunctionRegistry,
  resetGlobalRegistry,
  withTemplate,
  type AIProxy,
  // Also export from new split modules
  createSchemaFunctions,
  type AISchemaOptions,
  type SchemaFunctions,
  type InferSimpleSchemaResult,
  createDefinedFunction,
  convertArgsToJSONSchema,
  fillTemplate,
} from './ai.js'

// Also export 'ai' primitive as 'aiPrompt' for convenience
export { ai as aiPrompt } from './primitives.js'

// Export embedding utilities (not in ai-core)
export * from './embeddings.js'

// Export providers (not in ai-core)
export * from './providers/index.js'

// ============================================================================
// Extended exports (NOT in ai-core)
// ============================================================================

// Export batch processing
export {
  BatchQueue,
  createBatch,
  withBatch as withBatchQueue,
  registerBatchAdapter,
  getBatchAdapter,
  registerFlexAdapter,
  getFlexAdapter,
  hasFlexAdapter,
  tiersForModel,
  modelSupportsTier,
  isBatchMode,
  deferToBatch,
  BATCH_MODE_SYMBOL,
  type BatchMode as BatchQueueMode,
  type BatchProvider,
  type BatchStatus,
  type BatchItem,
  type BatchJob,
  type BatchResult,
  type BatchSubmitResult,
  type BatchAdapter,
  type FlexAdapter,
  type BatchQueueOptions,
  type DeferredOptions,
} from './batch-queue.js'

// Export per-model policy data (sourced from language-models)
export {
  policyFor as modelPolicyFor,
  type ModelPolicy,
  type BatchTier,
  type RetryPolicyData,
  type CircuitBreakerPolicyData,
  type ErrorCategoryName,
} from 'language-models'

// Export batch map for automatic batching
export {
  BatchMapPromise,
  createBatchMap,
  isBatchMapPromise,
  BATCH_MAP_SYMBOL,
  type CapturedOperation,
  type BatchMapOptions,
} from './batch-map.js'

// Export additional execution context features (full version with batch/budget)
export {
  getBatchMode,
  getBatchThreshold,
  shouldUseBatchAPI,
  getFlexThreshold,
  getExecutionTier,
  isFlexAvailable,
  type BatchMode,
  type ContextBudgetConfig,
  type ExecutionTier,
} from './context.js'

// Export budget tracking and request tracing
export {
  BudgetTracker,
  TokenCounter,
  RequestContext,
  BudgetExceededError,
  createRequestContext,
  withBudget,
  type BudgetConfig,
  type BudgetAlert,
  type BudgetSnapshot,
  type TokenUsage,
  type RequestInfo,
  type RequestContextOptions,
  type ModelPricing,
  type WithBudgetOptions,
  type RemainingBudget,
  type CheckBudgetOptions,
} from './budget.js'

// Export agentic tool orchestration
export {
  // Core classes
  AgenticLoop,
  ToolRouter,
  ToolValidator,

  // Tool composition utilities
  createTool,
  createToolset,
  wrapTool,
  cachedTool,
  rateLimitedTool,
  timeoutTool,
  createAgenticLoop,

  // Types
  type Tool,
  type ToolCall,
  type ToolResult,
  type FormattedToolResult,
  type ValidationResult,
  type ModelResponse,
  type Message,
  type StepInfo,
  type LoopOptions,
  type RunOptions,
  type ToolCallResult,
  type SDKToolResult,
  type LoopResult,
  type LoopStreamEvent,
} from './tool-orchestration.js'

// Export caching layer for embeddings and generations
export {
  // Core cache storage
  MemoryCache,

  // Specialized caches
  EmbeddingCache,
  GenerationCache,

  // Cache wrapper
  withCache,

  // Utilities
  hashKey,
  createCacheKey,

  // Types
  type CacheStorage,
  type CacheEntry,
  type CacheOptions,
  type CacheStats,
  type MemoryCacheOptions,
  type CacheKeyType,
  type EmbeddingCacheOptions,
  type BatchEmbeddingResult,
  type GenerationParams,
  type GenerationCacheGetOptions,
  type WithCacheOptions,
  type CachedFunction,
} from './cache.js'

// Export retry/fallback patterns with exponential backoff
export {
  // Error types and classification
  RetryableError,
  NonRetryableError,
  NetworkError,
  RateLimitError,
  CircuitOpenError,
  ErrorCategory,
  classifyError,

  // Backoff calculation
  calculateBackoff,

  // Retry policy
  RetryPolicy,

  // Circuit breaker
  CircuitBreaker,

  // Fallback chain
  FallbackChain,

  // Convenience helper
  withRetry,

  // Types
  type JitterStrategy,
  type BackoffOptions,
  type RetryOptions,
  type RetryInfo,
  type BatchItemResult,
  type CircuitState,
  type CircuitBreakerOptions,
  type CircuitBreakerMetrics,
  type FallbackModel,
  type FallbackOptions,
  type FallbackMetrics,
} from './retry.js'

// Export digital-objects function registry
export {
  DigitalObjectsFunctionRegistry,
  createDigitalObjectsRegistry,
  FUNCTION_NOUNS,
  FUNCTION_VERBS,
  type StoredFunctionDefinition,
  type FunctionCallData,
  type DigitalObjectsRegistryOptions,
} from './digital-objects-registry.js'

// Export configurable logger
export {
  configureLogger,
  getLogger,
  resetLogger,
  getLogLevel,
  setLogLevel,
  type Logger,
  type LoggerConfig,
} from './logger.js'

// ============================================================================
// V3 middleware stack — cache / budget / trace via wrapLanguageModel
// ============================================================================

// Composable middleware primitives
export {
  cacheMiddleware,
  embeddingCacheMiddleware,
  budgetMiddleware,
  traceMiddleware,
  type CacheMiddlewareOptions,
  type CacheMiddlewareStore,
  type EmbedCacheMiddlewareOptions,
  type EmbedCacheMiddlewareStore,
  type BudgetMiddlewareOptions,
  type PricingOverlay,
  type TraceEvent,
  type TraceEventKind,
  type TraceMiddlewareOptions,
} from './middleware/index.js'

// Convenience composer
export { wrapForV3, type WrapForV3Options } from './wrap-for-v3.js'

// Type re-export — downstream packages (services-as-software EvaluatorPanel
// model-injection point, etc.) need `LanguageModelV3` for typing wrapped-model
// arguments. Re-exporting from ai-functions avoids forcing every consumer to
// depend on `@ai-sdk/provider` directly.
export type { LanguageModelV3 } from '@ai-sdk/provider'

// Pluggable persistence primitive for trace/eval entries
export {
  InMemoryEvalLogStore,
  getEvalLogStore,
  configureEvalLogStore,
  type EvalLogEntry,
  type EvalLogListOptions,
  type EvalLogStore,
} from './eval-log/index.js'
