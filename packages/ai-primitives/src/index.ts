// =============================================================================
// AI Primitives - Unified AI Building Blocks
// =============================================================================

// -----------------------------------------------------------------------------
// 1. Core AI Primitives (from ai-functions)
// -----------------------------------------------------------------------------

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
} from 'ai-functions'

// Schema
export { schema } from 'ai-functions'
export type { SimpleSchema } from 'ai-functions'

// Template
export {
  parseTemplate,
  createTemplateFunction,
  createChainablePromise,
  createStreamableList,
  withBatch,
} from 'ai-functions'
export type {
  FunctionOptions,
  TemplateFunction,
  BatchableFunction,
  StreamableList,
  ChainablePromise,
} from 'ai-functions'

// AIPromise
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
} from 'ai-functions'
export type { AIPromiseOptions, StreamingAIPromise, StreamOptions } from 'ai-functions'

// Generation
export { generateObject, generateText, streamObject, streamText } from 'ai-functions'

// Primitives
export {
  generate,
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
  research,
  read,
  browse,
  decide,
  ask,
  approve,
  review,
} from 'ai-functions'
// Note: 'do' is a reserved word, re-export with different name if needed
export { do as aiDo } from 'ai-functions'
export type { GenerateType, GenerateOptions, HumanOptions, HumanResult } from 'ai-functions'

// Context
export {
  configure,
  getContext,
  withContext,
  getGlobalContext,
  resetContext,
  getModel,
  getProvider,
  getBatchMode,
  getBatchThreshold,
  shouldUseBatchAPI,
  getFlexThreshold,
  getExecutionTier,
  isFlexAvailable,
} from 'ai-functions'
export type { ExecutionContext, BatchMode, ContextBudgetConfig, ExecutionTier } from 'ai-functions'

// Type guards
export { isZodSchema } from 'ai-functions'

// AI Proxy
export {
  AI,
  aiProxy,
  define,
  defineFunction,
  functions,
  createFunctionRegistry,
  resetGlobalRegistry,
  withTemplate,
} from 'ai-functions'
export { aiPrompt } from 'ai-functions'
export type { AIProxy } from 'ai-functions'

// Embeddings
export {
  embed,
  embedMany,
  cosineSimilarity,
  cloudflare,
  cloudflareEmbedding,
  DEFAULT_CF_EMBEDDING_MODEL,
  getDefaultEmbeddingModel,
  embedText,
  embedTexts,
  findSimilar,
  pairwiseSimilarity,
  clusterBySimilarity,
  averageEmbeddings,
  normalizeEmbedding,
} from 'ai-functions'
export type {
  EmbeddingModel,
  Embedding,
  EmbedResult,
  EmbedManyResult,
  CloudflareConfig,
} from 'ai-functions'

// Batch processing
export {
  BatchQueue,
  createBatch,
  withBatchQueue,
  registerBatchAdapter,
  getBatchAdapter,
  isBatchMode,
  deferToBatch,
  BATCH_MODE_SYMBOL,
} from 'ai-functions'
export type {
  BatchQueueMode,
  BatchProvider,
  BatchStatus,
  BatchItem,
  BatchJob,
  BatchResult,
  BatchSubmitResult,
  BatchAdapter,
  BatchQueueOptions,
  DeferredOptions,
} from 'ai-functions'

// Batch map
export { BatchMapPromise, createBatchMap, isBatchMapPromise, BATCH_MAP_SYMBOL } from 'ai-functions'
export type { CapturedOperation, BatchMapOptions } from 'ai-functions'

// Budget tracking
export {
  BudgetTracker,
  TokenCounter,
  RequestContext,
  BudgetExceededError,
  createRequestContext,
  withBudget,
} from 'ai-functions'
export type {
  BudgetConfig,
  BudgetAlert,
  BudgetSnapshot,
  TokenUsage,
  RequestInfo,
  RequestContextOptions,
  ModelPricing,
  WithBudgetOptions,
  RemainingBudget,
  CheckBudgetOptions,
} from 'ai-functions'

// Agentic tool orchestration
export {
  AgenticLoop,
  ToolRouter,
  ToolValidator,
  createTool,
  createToolset,
  wrapTool,
  cachedTool,
  rateLimitedTool,
  timeoutTool,
  createAgenticLoop,
} from 'ai-functions'
export type {
  Tool,
  ToolCall,
  ToolResult,
  FormattedToolResult,
  ValidationResult,
  ModelResponse,
  Message,
  StepInfo,
  LoopOptions,
  RunOptions,
  ToolCallResult,
  SDKToolResult,
  LoopResult,
  LoopStreamEvent,
} from 'ai-functions'

// Caching
export {
  MemoryCache,
  EmbeddingCache,
  GenerationCache,
  withCache,
  hashKey,
  createCacheKey,
} from 'ai-functions'
export type {
  CacheStorage,
  CacheEntry,
  CacheOptions,
  CacheStats,
  MemoryCacheOptions,
  CacheKeyType,
  EmbeddingCacheOptions,
  BatchEmbeddingResult,
  GenerationParams,
  GenerationCacheGetOptions,
  WithCacheOptions,
  CachedFunction,
} from 'ai-functions'

// Retry/fallback patterns
export {
  RetryableError,
  NonRetryableError,
  NetworkError,
  RateLimitError,
  CircuitOpenError,
  ErrorCategory,
  classifyError,
  calculateBackoff,
  RetryPolicy,
  CircuitBreaker,
  FallbackChain,
  withRetry,
} from 'ai-functions'
export type {
  JitterStrategy,
  BackoffOptions,
  RetryOptions,
  RetryInfo,
  BatchItemResult,
  CircuitState,
  CircuitBreakerOptions,
  CircuitBreakerMetrics,
  FallbackModel,
  FallbackOptions,
  FallbackMetrics,
} from 'ai-functions'

// Digital objects registry
export {
  DigitalObjectsFunctionRegistry,
  createDigitalObjectsRegistry,
  FUNCTION_NOUNS,
  FUNCTION_VERBS,
} from 'ai-functions'
export type {
  StoredFunctionDefinition,
  FunctionCallData,
  DigitalObjectsRegistryOptions,
} from 'ai-functions'

// -----------------------------------------------------------------------------
// 2. Language Models
// -----------------------------------------------------------------------------
export {
  list as models,
  resolve as resolveModel,
  get as getModelInfo,
  search as searchModels,
} from 'language-models'

// -----------------------------------------------------------------------------
// 3. AI Providers
// -----------------------------------------------------------------------------
export {
  createRegistry,
  getRegistry,
  configureRegistry,
  model,
  embeddingModel,
  DIRECT_PROVIDERS,
  LLM,
  getLLM,
  createLLMFetch,
} from 'ai-providers'
export type {
  ProviderId,
  DirectProvider,
  ProviderConfig,
  LLMConfig,
  UniversalRequest,
  UniversalCreated,
  UniversalStream,
  UniversalDone,
  UniversalError,
  GatewayMessage,
  Provider,
  ProviderRegistryProvider,
} from 'ai-providers'

// -----------------------------------------------------------------------------
// 4. Database
// -----------------------------------------------------------------------------
export { DB } from 'ai-database'
export type { ThingFlat, ThingExpanded, DatabaseSchema, TypedDB } from 'ai-database'

// -----------------------------------------------------------------------------
// 5. Workflows
// -----------------------------------------------------------------------------
export { Workflow, on, every, send } from 'ai-workflows'

// -----------------------------------------------------------------------------
// 6. Agents
// -----------------------------------------------------------------------------
export { Agent, Role, Team, Goals } from 'autonomous-agents'

// -----------------------------------------------------------------------------
// 7. Digital Workers
// -----------------------------------------------------------------------------
export * as workers from 'digital-workers'

// -----------------------------------------------------------------------------
// 8. Human-in-the-Loop
// -----------------------------------------------------------------------------
export { Human, HumanManager } from 'human-in-the-loop'

// -----------------------------------------------------------------------------
// 9. Experiments
// -----------------------------------------------------------------------------
export { Experiment } from 'ai-experiments'

// -----------------------------------------------------------------------------
// 10. Tasks
// -----------------------------------------------------------------------------
export { createTask, task, parallel, sequential } from 'digital-tasks'

// -----------------------------------------------------------------------------
// 11. Tools
// -----------------------------------------------------------------------------
export { defineTool } from 'digital-tools'

// -----------------------------------------------------------------------------
// 12. Products
// -----------------------------------------------------------------------------
export { Product, App, API, Site, SDK, MCP } from 'digital-products'

// -----------------------------------------------------------------------------
// 13. Services
// -----------------------------------------------------------------------------
export { Service, Endpoint, Client, Provider as ServiceProvider } from 'services-as-software'

// -----------------------------------------------------------------------------
// 14. Business
// -----------------------------------------------------------------------------
export { Business, kpis, okrs, financials } from 'business-as-code'

// -----------------------------------------------------------------------------
// 15. Props
// -----------------------------------------------------------------------------
export { createAIComponent, generateProps } from 'ai-props'

// -----------------------------------------------------------------------------
// 16. Evaluate
// -----------------------------------------------------------------------------
export { evaluate, createEvaluator } from 'ai-evaluate'

// -----------------------------------------------------------------------------
// 17. Shared Types (from org.ai)
// -----------------------------------------------------------------------------
export type {
  // Core entities
  Thing,
  ThingDO,
  Noun,
  Verb,
  // Workers
  WorkerType,
  AgentType,
  HumanType,
  // Tools
  ToolType,
  // Events
  Event,
  // Organization
  WorkflowContext,
  // Business
  LeanCanvasType,
  StoryBrandType,
  StartupType,
  ICPType,
} from 'org.ai'
