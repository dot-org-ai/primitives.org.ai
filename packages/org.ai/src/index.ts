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

// Language models - model listing and resolution
export * from 'language-models'

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
  trigger,
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
  Supervisor,
  AgentPool,
  Swarm,
} from 'autonomous-agents'
export type {
  AgentConfig,
  AgentMode,
  AgentState,
  AgentResult,
  RoleConfig,
  TeamConfig,
  Goal,
  GoalStatus,
  ApprovalRequest,
  ApprovalResult,
} from 'autonomous-agents'

// Digital workers - abstract interface for organizing work
export {
  Worker,
  registerWorkerActions,
  withWorkers,
} from 'digital-workers'
export type {
  WorkerConfig,
  WorkerType,
  WorkerAction,
  WorkerCapability,
} from 'digital-workers'

// Digital tasks - task management primitives
export {
  Task,
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
  TaskConfig,
  TaskStatus,
  TaskPriority,
  TaskResult,
  Project,
  ProjectConfig,
} from 'digital-tasks'

// Digital tools - tools for humans and AI agents
export {
  defineTool,
  createTool,
  toolRegistry,
  MCPToolProvider,
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
  ProductConfig,
  AppConfig,
  APIConfig,
  ContentConfig,
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
  BusinessConfig,
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
