/**
 * org.ai - TypeScript types for AI-powered organizations
 *
 * This package is primarily focused on providing shared type definitions
 * for the AI primitives ecosystem. For the full umbrella package with all
 * functionality, use `ai-primitives` instead.
 *
 * @example Types import (recommended)
 * ```ts
 * import type { Thing, Agent, Workflow, Event } from 'org.ai'
 * ```
 *
 * @example Full umbrella (use ai-primitives instead)
 * ```ts
 * import { AI, Workflow, Agent, DB } from 'ai-primitives'
 * ```
 *
 * @example Subpath imports (still supported)
 * ```ts
 * import { ai, generate, list } from 'org.ai/functions'
 * import { Workflow, on, every } from 'org.ai/workflows'
 * import { Agent, Role, Team } from 'org.ai/agents'
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// SHARED TYPES - Primary export from @org.ai/types
// ============================================================================
// org.ai is now primarily a types package. These are the core type definitions
// shared across all AI primitives packages. For runtime functionality, use
// `ai-primitives` as the umbrella package.
//
// Includes:
// - Thing, ThingDO - Base entity types with URL-based identity
// - Things, ThingsDO, Collection - Collection types
// - Noun, Verb, StandardVerbs - Schema types
// - Event, EventWhat, EventWho, EventWhen, EventWhere, EventWhy, EventHow - 5W+H events
// - Worker, Agent, Human - Worker types with schemas and type guards
// - Tool, Toolbox - Tool types
// - LeanCanvas, StoryBrand, Founder - Business model framework types
// - Startup, ICP - Startup and customer profile types
// - ListOptions, ListResult, PaginationInfo - Pagination types for Thing collections
// - Various type guards: isWorker, isAgent, isHuman, isTool, isStartup, etc.
// - Factory functions: createAgent, createHuman

// Re-export from @org.ai/types, excluding WorkerType to avoid conflict with consolidated types
export {
  // Runtime markers
  AIFunction,
  EventHandler,
  WorkflowContext,
  RelationshipOperator,
  ParsedField,
  Thing as ThingMarker,
  ThingsMarker,
  ListOptionsMarker,
  ListResultMarker,
  // Types
  type AIFunctionType,
  type EventHandlerType,
  type WorkflowContextType,
  type RelationshipOperatorType,
  type ParsedFieldType,
  // Thing types
  type Thing,
  type ThingDO,
  // Noun and Verb types
  type Noun,
  type Verb,
  StandardVerbs,
  type StandardVerb,
  // Collection types
  type Things,
  type ThingsDO,
  type Collection,
  THINGS_TYPE,
  COLLECTION_TYPE,
  type SortDirection,
  type SortSpec,
  type ListOptions,
  type PaginationInfo,
  type ListResult,
  // Event types
  type Event,
  type EventWhat,
  type EventWho,
  type EventWhen,
  type EventWhere,
  type EventWhy,
  type EventHow,
  // Field types
  type FieldType,
  type FieldConstraints,
  type FieldDefinition,
  // Branded ID types
  type ThingId,
  type NounId,
  type VerbId,
  type ActionId,
  type EventId,
  isThingId,
  isActionId,
  isEventId,
  // Worker types (excluding WorkerType to avoid conflict)
  WorkerStatus,
  type WorkerStatusType,
  WORKER_TYPE,
  AGENT_TYPE,
  HUMAN_TYPE,
  WorkerTypes,
  Worker,
  Agent,
  Human,
  type WorkerType as BaseWorkerType,
  type AgentType,
  type HumanType,
  WorkerSchema,
  AgentSchema,
  HumanSchema,
  isWorker,
  isAgent,
  isHuman,
  createAgent,
  createHuman,
  // Tool types
  TOOL_TYPE,
  StandardToolTypes,
  StandardCapabilities,
  Tool,
  ToolInput,
  ToolOutput,
  ToolParameter,
  ToolExecutionResult,
  ToolValidationError,
  ToolValidationResult,
  ToolExecutor,
  ExecutableTool,
  ValidatableTool,
  Tools,
  Toolbox,
  ToolCapability,
  type ToolParameterType,
  type ToolInputType,
  type ToolOutputType,
  type ToolExecutionResultType,
  type ToolValidationErrorType,
  type ToolValidationResultType,
  type ToolExecutorType,
  type ToolCapabilityType,
  type ToolType,
  type ExecutableToolType,
  type ValidatableToolType,
  type ToolsType,
  type ToolboxType,
  type ToolId,
  ToolId as ToolIdMarker,
  isToolId,
  isTool,
  isToolParameter,
  isToolExecutionResult,
  isToolValidationError,
  // Business model types
  LeanCanvasMarker,
  LeanCanvas,
  LEAN_CANVAS_TYPE,
  type LeanCanvasType,
  isLeanCanvas,
  StoryBrandMarker,
  StoryBrand,
  STORY_BRAND_TYPE,
  type StoryBrandType,
  isStoryBrand,
  FounderMarker,
  Founder,
  FounderRole,
  FOUNDER_TYPE,
  FounderRoles,
  type FounderRoleType,
  type FounderType,
  isFounder,
  // Startup types
  Startup,
  StartupStage,
  STARTUP_TYPE,
  type StartupStageType,
  type StartupType,
  isStartup,
  // ICP types
  ICP,
  ICP_TYPE,
  type ICPType,
  isICP,
} from '@org.ai/types'

// ============================================================================
// CONSOLIDATED TYPES - New unified types for org.ai
// ============================================================================
// These consolidated types combine the best features from multiple packages:
// - digital-workers
// - autonomous-agents
// - human-in-the-loop
// - business-as-code
//
// Includes:
// - Role, RoleType, isRole, createRole - Unified role definitions
// - Team, TeamMember, isTeam, createTeam - Team organization types
// - Goal, Goals, GoalStatus, GoalCategory, isGoal - Goal tracking types
// - KPI, KPIDefinition, KPICategory, KPITrend, isKPI - Key performance indicators
// - OKR, KeyResult, OKRStatus, isOKR - Objectives and key results

export * from './types/index.js'

// ============================================================================
// PACKAGE RE-EXPORTS - Backward compatibility (deprecated)
// ============================================================================
// NOTE: These re-exports are maintained for backward compatibility only.
// For new projects, use `ai-primitives` as the umbrella package instead.
// These exports may be removed in a future major version.
//
// Migration guide:
//   Before: import { AI, Workflow, DB } from 'org.ai'
//   After:  import { AI, Workflow, DB } from 'ai-primitives'

/**
 * @deprecated Import from 'ai-primitives' instead for the full umbrella package.
 * These exports are maintained for backward compatibility only.
 */
// Core AI primitives - the foundation
// Note: ai-functions has a conflicting ListResult type (for AI list operations).
// The @org.ai/types ListResult (for Thing collection pagination) takes precedence.
// Access ai-functions ListResult via: import { ListResult } from 'org.ai/functions'
export {
  // Types from types.ts
  type AIFunctionDefinition,
  type JSONSchema,
  type AIGenerateOptions,
  type AIGenerateResult,
  type AIFunctionCall,
  type AIClient,
  type ImageOptions,
  type ImageResult,
  type VideoOptions,
  type VideoResult,
  type WriteOptions,
  type ListItem,
  // ListResult excluded - conflicts with @org.ai/types ListResult
  type NamedList,
  type ListsResult,
  type CodeLanguage,
  type GenerativeOutputType,
  type HumanChannel,
  type LegacyHumanChannel,
  type SchemaLimitations,
  type BaseFunctionDefinition,
  type CodeFunctionDefinition,
  type CodeFunctionResult,
  type GenerativeFunctionDefinition,
  type GenerativeFunctionResult,
  type AgenticFunctionDefinition,
  type AgenticExecutionState,
  type HumanFunctionDefinition,
  type HumanFunctionResult,
  type FunctionDefinition,
  type DefinedFunction,
  type FunctionRegistry,
  type AutoDefineResult,
  // Schema
  schema,
  type SimpleSchema,
  // Template
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
  // AIPromise
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
  // Generation
  generateObject,
  generateText,
  streamObject,
  streamText,
  // Primitives
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
  do as doAction,
  research,
  read,
  browse,
  decide,
  ask,
  approve,
  review,
  type HumanOptions,
  type HumanResult,
  // Context
  configure,
  getContext,
  withContext,
  getGlobalContext,
  resetContext,
  getModel,
  getProvider,
  type ExecutionContext,
  // Type guards
  isZodSchema,
  // AI Proxy
  AI,
  aiProxy,
  define,
  defineFunction,
  functions,
  createFunctionRegistry,
  resetGlobalRegistry,
  withTemplate,
  type AIProxy,
  // Also export 'ai' primitive as 'aiPrompt'
  aiPrompt,
  // Embeddings
  embed,
  embedMany,
  type EmbedResult,
  type EmbedManyResult,
  // Batch processing
  BatchQueue,
  createBatch,
  registerBatchAdapter,
  getBatchAdapter,
  isBatchMode,
  deferToBatch,
  BATCH_MODE_SYMBOL,
  type BatchProvider,
  type BatchStatus,
  type BatchItem,
  type BatchJob,
  type BatchResult,
  type BatchSubmitResult,
  type BatchAdapter,
  type BatchQueueOptions,
  type DeferredOptions,
  // Batch map
  BatchMapPromise,
  createBatchMap,
  isBatchMapPromise,
  BATCH_MAP_SYMBOL,
  type CapturedOperation,
  type BatchMapOptions,
  // Extended context features
  getBatchMode,
  getBatchThreshold,
  shouldUseBatchAPI,
  getFlexThreshold,
  getExecutionTier,
  isFlexAvailable,
  type BatchMode,
  type ContextBudgetConfig,
  type ExecutionTier,
  // Budget tracking
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
  // Tool orchestration
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
  // Caching
  MemoryCache,
  EmbeddingCache,
  GenerationCache,
  withCache,
  hashKey,
  createCacheKey,
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
  // Retry/fallback
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
  // Digital objects registry
  DigitalObjectsFunctionRegistry,
  createDigitalObjectsRegistry,
  FUNCTION_NOUNS,
  FUNCTION_VERBS,
  type StoredFunctionDefinition,
  type FunctionCallData,
  type DigitalObjectsRegistryOptions,
} from 'ai-functions'

/** @deprecated Import from 'ai-primitives' instead. */
// AI providers and model registry
export * from 'ai-providers'

/** @deprecated Import from 'ai-primitives' instead. */
// Language models - model listing and resolution (renamed to avoid conflict with ai-functions list)
export {
  resolve as resolveModel,
  resolveWithProvider,
  list as listModels,
  get as getModelInfo,
  search as searchModels,
  DIRECT_PROVIDERS,
} from 'language-models'
export type { ModelInfo, ResolvedModel, DirectProvider } from 'language-models'

/** @deprecated Import from 'ai-primitives' instead. */
// Database - schema-first database with promise pipelining
// Note: FieldDefinition conflicts with @org.ai/types FieldDefinition
export { DB } from 'ai-database'
export type {
  ThingFlat,
  ThingExpanded,
  DatabaseSchema,
  EntitySchema,
  FieldDefinition as DBFieldDefinition,
  PrimitiveType,
  ParsedSchema,
  ParsedEntity,
  ParsedField as DBParsedField,
  TypedDB,
} from 'ai-database'

/** @deprecated Import from 'ai-primitives' instead. */
// Workflows - event-driven workflows with $ context
// Note: WorkflowContext and EventHandler are also exported from @org.ai/types
// These are aliased as WorkflowsContext and WorkflowEventHandler to avoid conflicts
export { Workflow, on, every, send } from 'ai-workflows'
export type {
  WorkflowContext as WorkflowsContext,
  WorkflowDefinition,
  EventHandler as WorkflowEventHandler,
  ScheduleHandler,
} from 'ai-workflows'

/** @deprecated Import from 'ai-primitives' instead. */
// Autonomous agents
// Note: Role, Team, Goals, Goal are now exported from consolidated types (./types/index.js)
// Legacy versions are aliased with 'Legacy' prefix for backward compatibility
export { Agent as AutonomousAgent } from 'autonomous-agents'
export { Role as LegacyRole, Team as LegacyTeam, Goals as LegacyGoals } from 'autonomous-agents'
export type {
  AgentConfig,
  AgentMode,
  AgentStatus,
  Goal as LegacyGoal,
  ApprovalRequest,
  ApprovalResult,
} from 'autonomous-agents'

/** @deprecated Import from 'ai-primitives' instead. */
// Digital workers - abstract interface for organizing work
export { registerWorkerActions, withWorkers } from 'digital-workers'
export type {
  Worker as DigitalWorker,
  WorkerType as DigitalWorkerType,
  WorkerAction,
} from 'digital-workers'

/** @deprecated Import from 'ai-primitives' instead. */
// Digital tasks - task management primitives
export {
  createTask,
  startTask,
  completeTask,
  failTask,
  cancelTask,
  createProject,
  task,
  parallel,
  sequential,
  toMarkdown,
} from 'digital-tasks'
export type { Task, TaskStatus, TaskPriority, TaskResult, Project } from 'digital-tasks'

/** @deprecated Import from 'ai-primitives' instead. */
// Digital tools - tools for humans and AI agents
export { defineTool } from 'digital-tools'
export type {
  Tool as DigitalTool,
  ToolCategory,
  ToolSubcategory,
  ToolRegistry,
  AnyTool,
} from 'digital-tools'

/** @deprecated Import from 'ai-primitives' instead. */
// Digital products - primitives for defining digital products
export {
  Product,
  App,
  API,
  Content,
  Site,
  MCP,
  SDK,
  registry as productRegistry,
} from 'digital-products'
export type { AppConfig } from 'digital-products'

/** @deprecated Import from 'ai-primitives' instead. */
// Services as software - AI-powered services
export { Service, Endpoint, Client, Provider, providers } from 'services-as-software'
export type {
  ServiceDefinition,
  ServiceClient,
  ServiceContext,
  ServiceStatus,
} from 'services-as-software'

/** @deprecated Import from 'ai-primitives' instead. */
// Business as code - business logic primitives
// Note: KPI, OKR, KeyResult are now exported from consolidated types (./types/index.js)
// Legacy versions are aliased with 'Legacy' prefix for backward compatibility
export { Business, kpis, okrs, financials } from 'business-as-code'
export type {
  KPIDefinition as LegacyKPI,
  OKRDefinition as LegacyOKR,
  KeyResult as LegacyKeyResult,
  FinancialMetrics,
} from 'business-as-code'

/** @deprecated Import from 'ai-primitives' instead. */
// Human in the loop - human oversight primitives
export { Human as HumanInLoop, HumanManager } from 'human-in-the-loop'
export type { RetryConfig, SLAConfig, CascadeTier, TierConfig } from 'human-in-the-loop'

/** @deprecated Import from 'ai-primitives' instead. */
// AI props - AI-powered component props
export { createAIComponent, definePropsSchema, generateProps, configureAIProps } from 'ai-props'
export type { AIPropsConfig, PropSchema, GeneratePropsResult } from 'ai-props'

/** @deprecated Import from 'ai-primitives' instead. */
// Evaluate - secure code execution
export { evaluate, createEvaluator } from 'ai-evaluate'
export type {
  EvaluateOptions,
  EvaluateResult,
  LogEntry,
  TestResults,
  TestResult as EvalTestResult,
  SandboxEnv,
  SDKConfig,
} from 'ai-evaluate'

/** @deprecated Import from 'ai-primitives' instead. */
// Experiments - A/B testing and experimentation
export {
  Experiment,
  createVariantsFromGrid,
  cartesian,
  decide as experimentDecide,
  decideWeighted,
  decideEpsilonGreedy,
  track,
  flush,
  configureTracking,
} from 'ai-experiments'
export type {
  ExperimentConfig,
  ExperimentVariant,
  ExperimentResult,
  TrackingOptions,
} from 'ai-experiments'

/** @deprecated Import from 'ai-primitives' instead. */
// Tests - test utilities
export { expect, should, assert, TestRunner, createRunner } from 'ai-tests'
export type { TestFn, HookFn, RegisteredTest, SuiteContext, TestEnv } from 'ai-tests'
