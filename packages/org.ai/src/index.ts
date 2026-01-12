/**
 * org.ai - All primitives for building AI-powered organizations
 *
 * This is the umbrella package that re-exports all core packages.
 * You can import everything from here, or use subpath imports for specific modules.
 *
 * @example Full import
 * ```ts
 * import { AI, Workflow, Agent, DB } from 'org.ai'
 * ```
 *
 * @example Subpath imports
 * ```ts
 * import { ai, generate, list } from 'org.ai/functions'
 * import { Workflow, on, every } from 'org.ai/workflows'
 * import { Agent, Role, Team } from 'org.ai/agents'
 * ```
 *
 * @packageDocumentation
 */

// Core AI primitives - the foundation
export * from 'ai-functions'

// AI providers and model registry
export * from 'ai-providers'

// Language models - model listing and resolution (renamed to avoid conflict with ai-functions list)
export {
  resolve as resolveModel,
  resolveWithProvider,
  list as listModels,
  get as getModel,
  search as searchModels,
  DIRECT_PROVIDERS,
} from 'language-models'
export type { ModelInfo, ResolvedModel, DirectProvider } from 'language-models'

// Database - schema-first database with promise pipelining
export { DB } from 'ai-database'
export type {
  ThingFlat,
  ThingExpanded,
  DatabaseSchema,
  EntitySchema,
  FieldDefinition,
  PrimitiveType,
  ParsedSchema,
  ParsedEntity,
  ParsedField,
  TypedDB,
} from 'ai-database'

// Workflows - event-driven workflows with $ context
export {
  Workflow,
  on,
  every,
  send,
} from 'ai-workflows'
export type {
  WorkflowContext,
  WorkflowDefinition,
  EventHandler,
  ScheduleHandler,
} from 'ai-workflows'

// Autonomous agents
export {
  Agent,
  Role,
  Team,
  Goals,
} from 'autonomous-agents'
export type {
  AgentConfig,
  AgentMode,
  AgentStatus,
  Goal,
  ApprovalRequest,
  ApprovalResult,
} from 'autonomous-agents'

// Digital workers - abstract interface for organizing work
export {
  registerWorkerActions,
  withWorkers,
} from 'digital-workers'
export type {
  Worker,
  WorkerType,
  WorkerAction,
} from 'digital-workers'

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
export type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskResult,
  Project,
} from 'digital-tasks'

// Digital tools - tools for humans and AI agents
export {
  defineTool,
} from 'digital-tools'
export type {
  Tool,
  ToolCategory,
  ToolSubcategory,
  ToolRegistry,
  AnyTool,
} from 'digital-tools'

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
export type {
  AppConfig,
} from 'digital-products'

// Services as software - AI-powered services
export {
  Service,
  Endpoint,
  Client,
  Provider,
  providers,
} from 'services-as-software'
export type {
  ServiceDefinition,
  ServiceClient,
  ServiceContext,
  ServiceStatus,
} from 'services-as-software'

// Business as code - business logic primitives
export {
  Business,
  kpis,
  okrs,
  financials,
} from 'business-as-code'
export type {
  KPIDefinition as KPI,
  OKRDefinition as OKR,
  KeyResult,
  FinancialMetrics,
} from 'business-as-code'

// Human in the loop - human oversight primitives
export {
  Human,
  HumanManager,
} from 'human-in-the-loop'
export type {
  RetryConfig,
  SLAConfig,
  CascadeTier,
  TierConfig,
} from 'human-in-the-loop'

// AI props - AI-powered component props
export {
  createAIComponent,
  definePropsSchema,
  generateProps,
  configureAIProps,
} from 'ai-props'
export type {
  AIPropsConfig,
  PropSchema,
  GeneratePropsResult,
} from 'ai-props'

// Evaluate - secure code execution
export { evaluate, createEvaluator } from 'ai-evaluate'
export type {
  EvaluateOptions,
  EvaluateResult,
  LogEntry,
  TestResults,
  TestResult,
  SandboxEnv,
  SDKConfig,
} from 'ai-evaluate'

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

// Tests - test utilities
export {
  expect,
  should,
  assert,
  TestRunner,
  createRunner,
} from 'ai-tests'
export type {
  TestFn,
  HookFn,
  RegisteredTest,
  SuiteContext,
  TestEnv,
} from 'ai-tests'
