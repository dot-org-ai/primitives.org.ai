/**
 * Organizational Types
 *
 * Types for planning, execution, and data management:
 * Database, Function, Goal, Plan, Project, Task, Workflow, Experiment.
 *
 * @module org
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// =============================================================================
// Database - Persistent Storage
// =============================================================================

/**
 * Database storage type.
 */
export type DatabaseType = 'graph' | 'relational' | 'document' | 'kv' | 'vector' | 'timeseries'

/**
 * Database status.
 */
export type DatabaseStatus = 'creating' | 'available' | 'updating' | 'deleting' | 'error'

/**
 * Persistent storage for things and relationships.
 *
 * Databases provide the underlying persistence layer
 * for domain data. They can be specialized for different
 * access patterns (graph, document, key-value, etc.).
 *
 * @example
 * ```ts
 * const crmDatabase: Database = {
 *   id: 'db_crm',
 *   name: 'CRM Database',
 *   type: 'document',
 *   status: 'available',
 *   connectionString: 'mongodb://...',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Database {
  /** Unique identifier */
  id: string

  /** Display name */
  name: string

  /** Storage type */
  type: DatabaseType

  /** Current status */
  status: DatabaseStatus

  /** Connection string or endpoint */
  connectionString?: string

  /** Provider (e.g., 'mongodb', 'postgres', 'redis') */
  provider?: string

  /** Region/location */
  region?: string

  /** Configuration options */
  config?: Record<string, unknown>

  /** Usage metrics */
  metrics?: {
    size?: number
    documents?: number
    connections?: number
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DatabaseInput = Input<Database>
export type DatabaseOutput = Output<Database>

// =============================================================================
// Function - AI-Powered Capability
// =============================================================================

/**
 * Function execution type.
 */
export type FunctionType = 'code' | 'generative' | 'agentic' | 'human'

/**
 * Function status.
 */
export type FunctionStatus = 'draft' | 'active' | 'deprecated' | 'archived'

/**
 * AI-powered capability that transforms input to output.
 *
 * Functions are the computational building blocks.
 * They can be pure code, AI-generated, agentic loops,
 * or human-in-the-loop operations.
 *
 * @example
 * ```ts
 * const summarize: Function = {
 *   id: 'fn_summarize',
 *   name: 'summarize',
 *   type: 'generative',
 *   status: 'active',
 *   description: 'Summarize text content',
 *   input: { text: { type: 'string', description: 'Text to summarize' } },
 *   output: { summary: { type: 'string', description: 'Generated summary' } },
 *   model: 'claude-3-sonnet',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Function {
  /** Unique identifier */
  id: string

  /** Function name (callable identifier) */
  name: string

  /** Function type */
  type: FunctionType

  /** Current status */
  status: FunctionStatus

  /** Human-readable description */
  description?: string

  /** Input schema */
  input?: Record<string, unknown>

  /** Output schema */
  output?: Record<string, unknown>

  /** AI model to use (for generative/agentic) */
  model?: string

  /** System prompt (for generative/agentic) */
  system?: string

  /** Prompt template with {{placeholders}} */
  promptTemplate?: string

  /** Example inputs/outputs for testing and documentation */
  examples?: Array<{ input: unknown; output: unknown }>

  /** Execution timeout (ms) */
  timeout?: number

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FunctionInput = Input<Function>
export type FunctionOutput = Output<Function>

// =============================================================================
// Goal - Desired Outcome
// =============================================================================

/**
 * Goal status.
 */
export type GoalStatus = 'draft' | 'active' | 'achieved' | 'abandoned' | 'blocked'

/**
 * Goal priority.
 */
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low'

/**
 * Desired outcome to achieve.
 *
 * Goals represent strategic objectives that guide
 * planning and execution. They can have targets,
 * deadlines, and measurable progress.
 *
 * @example
 * ```ts
 * const revenueGoal: Goal = {
 *   id: 'goal_q1_revenue',
 *   name: 'Q1 Revenue Target',
 *   status: 'active',
 *   priority: 'critical',
 *   target: { amount: 1000000, unit: 'USD' },
 *   progress: 0.45,
 *   deadline: new Date('2024-03-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Goal {
  /** Unique identifier */
  id: string

  /** Goal name */
  name: string

  /** Current status */
  status: GoalStatus

  /** Priority level */
  priority?: GoalPriority

  /** Human-readable description */
  description?: string

  /** Quantifiable target */
  target?: {
    amount?: number
    unit?: string
    condition?: string
  }

  /** Progress (0-1) */
  progress?: number

  /** Deadline date */
  deadline?: Date

  /** Key results or success metrics */
  keyResults?: Array<{
    name: string
    target: number
    current: number
    unit?: string
  }>

  /** Owner ID */
  ownerId?: string

  /** Parent goal ID (for goal hierarchy) */
  parentId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type GoalInput = Input<Goal>
export type GoalOutput = Output<Goal>

// =============================================================================
// Plan - Strategy to Achieve Goals
// =============================================================================

/**
 * Plan status.
 */
export type PlanStatus = 'draft' | 'approved' | 'active' | 'completed' | 'cancelled'

/**
 * Strategy to achieve goals.
 *
 * Plans organize work into phases, milestones,
 * and actionable steps. They connect goals to
 * projects and tasks.
 *
 * @example
 * ```ts
 * const launchPlan: Plan = {
 *   id: 'plan_product_launch',
 *   name: 'Product Launch Plan',
 *   status: 'active',
 *   description: 'Launch new product in Q2',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-06-30'),
 *   milestones: [
 *     { name: 'Alpha Release', date: new Date('2024-02-28') },
 *     { name: 'Beta Release', date: new Date('2024-04-30') },
 *     { name: 'GA Launch', date: new Date('2024-06-15') }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Plan {
  /** Unique identifier */
  id: string

  /** Plan name */
  name: string

  /** Current status */
  status: PlanStatus

  /** Human-readable description */
  description?: string

  /** Planned start date */
  startDate?: Date

  /** Planned end date */
  endDate?: Date

  /** Major milestones */
  milestones?: Array<{
    name: string
    date: Date
    status?: 'pending' | 'completed' | 'missed'
  }>

  /** High-level steps */
  steps?: Array<{
    order: number
    name: string
    description?: string
    status?: 'pending' | 'in_progress' | 'completed'
  }>

  /** Owner ID */
  ownerId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PlanInput = Input<Plan>
export type PlanOutput = Output<Plan>

// =============================================================================
// Project - Organized Effort
// =============================================================================

/**
 * Project status.
 */
export type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled'

/**
 * Organized effort to deliver an outcome.
 *
 * Projects group related tasks and track progress
 * toward a goal. They have budgets, timelines,
 * and team assignments.
 *
 * @example
 * ```ts
 * const websiteProject: Project = {
 *   id: 'proj_website_redesign',
 *   name: 'Website Redesign',
 *   status: 'active',
 *   description: 'Redesign company website',
 *   budget: { amount: 50000, currency: 'USD' },
 *   progress: 0.35,
 *   startDate: new Date('2024-01-15'),
 *   dueDate: new Date('2024-04-30'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Project {
  /** Unique identifier */
  id: string

  /** Project name */
  name: string

  /** Current status */
  status: ProjectStatus

  /** Human-readable description */
  description?: string

  /** Project budget */
  budget?: {
    amount: number
    currency: string
    spent?: number
  }

  /** Progress (0-1) */
  progress?: number

  /** Start date */
  startDate?: Date

  /** Due date */
  dueDate?: Date

  /** Project lead ID */
  leadId?: string

  /** Team member IDs */
  memberIds?: string[]

  /** Tags/labels */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ProjectInput = Input<Project>
export type ProjectOutput = Output<Project>

// =============================================================================
// Task - Unit of Work
// =============================================================================

/**
 * Task status.
 */
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done' | 'cancelled'

/**
 * Task priority.
 */
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'

/**
 * Unit of work to be done.
 *
 * Tasks are the atomic units of execution.
 * They have assignees, due dates, estimates,
 * and can depend on other tasks.
 *
 * @example
 * ```ts
 * const designTask: Task = {
 *   id: 'task_homepage_mockup',
 *   name: 'Create homepage mockup',
 *   status: 'in_progress',
 *   priority: 'high',
 *   description: 'Design mockup for new homepage',
 *   assigneeId: 'user_designer',
 *   dueDate: new Date('2024-02-15'),
 *   estimate: { value: 8, unit: 'hours' },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Task {
  /** Unique identifier */
  id: string

  /** Task name */
  name: string

  /** Current status */
  status: TaskStatus

  /** Priority level */
  priority?: TaskPriority

  /** Human-readable description */
  description?: string

  /** Assignee ID */
  assigneeId?: string

  /** Due date */
  dueDate?: Date

  /** Time estimate */
  estimate?: {
    value: number
    unit: 'minutes' | 'hours' | 'days' | 'points'
  }

  /** Actual time spent */
  timeSpent?: {
    value: number
    unit: 'minutes' | 'hours' | 'days'
  }

  /** Dependent task IDs */
  dependencyIds?: string[]

  /** Parent task ID (for subtasks) */
  parentId?: string

  /** Project ID */
  projectId?: string

  /** Tags/labels */
  tags?: string[]

  /** Completion percentage (0-100) */
  completionPercent?: number

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TaskInput = Input<Task>
export type TaskOutput = Output<Task>

// =============================================================================
// Workflow - Orchestrated Process
// =============================================================================

/**
 * Workflow status.
 */
export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived'

/**
 * Workflow trigger type.
 */
export type TriggerType = 'manual' | 'schedule' | 'event' | 'webhook' | 'api'

/**
 * Workflow step type.
 */
export type StepType = 'function' | 'action' | 'condition' | 'loop' | 'parallel' | 'wait' | 'human'

/**
 * Orchestrated sequence of functions and actions.
 *
 * Workflows define automated processes that respond
 * to triggers and execute steps in sequence or parallel.
 *
 * @example
 * ```ts
 * const onboardingWorkflow: Workflow = {
 *   id: 'wf_customer_onboarding',
 *   name: 'Customer Onboarding',
 *   status: 'active',
 *   description: 'Automated customer onboarding flow',
 *   triggers: [
 *     { type: 'event', event: 'customer.created' }
 *   ],
 *   steps: [
 *     { type: 'function', name: 'sendWelcomeEmail', functionId: 'fn_welcome' },
 *     { type: 'wait', duration: '1d' },
 *     { type: 'function', name: 'sendOnboardingGuide', functionId: 'fn_guide' }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Workflow {
  /** Unique identifier */
  id: string

  /** Workflow name */
  name: string

  /** Current status */
  status: WorkflowStatus

  /** Human-readable description */
  description?: string

  /** What triggers this workflow */
  triggers?: Array<{
    type: TriggerType
    event?: string
    schedule?: string
    webhookPath?: string
  }>

  /** Workflow steps */
  steps?: Array<{
    type: StepType
    name: string
    functionId?: string
    actionId?: string
    condition?: string
    duration?: string
    parallel?: boolean
    onError?: 'fail' | 'continue' | 'retry'
    retries?: number
  }>

  /** Input schema */
  input?: Record<string, unknown>

  /** Output schema */
  output?: Record<string, unknown>

  /** Execution timeout (ms) */
  timeout?: number

  /** Owner ID */
  ownerId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type WorkflowInput = Input<Workflow>
export type WorkflowOutput = Output<Workflow>

// =============================================================================
// Experiment - Controlled Test
// =============================================================================

/**
 * Experiment status.
 */
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'

/**
 * Controlled test to validate a hypothesis.
 *
 * Experiments allow A/B testing and feature validation
 * with measurable metrics and statistical analysis.
 *
 * @example
 * ```ts
 * const pricingExperiment: Experiment = {
 *   id: 'exp_pricing_test',
 *   name: 'Pricing Page Test',
 *   status: 'running',
 *   hypothesis: 'Showing annual pricing first increases conversions',
 *   variants: [
 *     { id: 'control', name: 'Monthly First', weight: 0.5 },
 *     { id: 'treatment', name: 'Annual First', weight: 0.5 }
 *   ],
 *   metrics: [
 *     { name: 'conversion_rate', type: 'percentage' },
 *     { name: 'revenue_per_visitor', type: 'currency' }
 *   ],
 *   startDate: new Date('2024-01-15'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Experiment {
  /** Unique identifier */
  id: string

  /** Experiment name */
  name: string

  /** Current status */
  status: ExperimentStatus

  /** Human-readable description */
  description?: string

  /** The hypothesis being tested */
  hypothesis?: string

  /** Test variants */
  variants?: Array<{
    id: string
    name: string
    description?: string
    weight: number
    config?: Record<string, unknown>
  }>

  /** Success metrics */
  metrics?: Array<{
    name: string
    type: 'count' | 'percentage' | 'currency' | 'duration' | 'custom'
    goal?: 'increase' | 'decrease'
    threshold?: number
  }>

  /** Results per variant */
  results?: Record<string, {
    sampleSize: number
    metrics: Record<string, number>
    confidence?: number
  }>

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Minimum sample size per variant */
  minSampleSize?: number

  /** Confidence level required (e.g., 0.95) */
  confidenceLevel?: number

  /** Owner ID */
  ownerId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ExperimentInput = Input<Experiment>
export type ExperimentOutput = Output<Experiment>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface DatabaseActions extends CRUDResource<Database, DatabaseInput> {
  /** Connect to the database */
  connect: Action<{ id: string }, { connected: boolean; latency?: number }>

  /** Disconnect from the database */
  disconnect: Action<{ id: string }, { disconnected: boolean }>

  /** Get database metrics */
  getMetrics: Action<{ id: string }, Database['metrics']>

  /** Run a query */
  query: Action<{ id: string; query: string; params?: unknown[] }, unknown[]>
}

export interface FunctionActions extends CRUDResource<Function, FunctionInput> {
  /** Execute a function */
  execute: Action<{ id: string; input: unknown }, unknown>

  /** Test a function with example inputs */
  test: Action<{ id: string }, { passed: number; failed: number; results: unknown[] }>

  /** Deploy a function */
  deploy: Action<{ id: string; environment?: string }, { deployed: boolean; version?: string }>
}

export interface GoalActions extends CRUDResource<Goal, GoalInput> {
  /** Update goal progress */
  updateProgress: Action<{ id: string; progress: number }, Goal>

  /** Mark goal as achieved */
  achieve: Action<{ id: string }, Goal>

  /** Abandon a goal */
  abandon: Action<{ id: string; reason?: string }, Goal>

  /** Get child goals */
  getChildren: Action<{ id: string }, Goal[]>
}

export interface PlanActions extends CRUDResource<Plan, PlanInput> {
  /** Approve a plan */
  approve: Action<{ id: string; approverId: string }, Plan>

  /** Update milestone status */
  updateMilestone: Action<{ id: string; milestoneName: string; status: string }, Plan>

  /** Get associated goals */
  getGoals: Action<{ id: string }, Goal[]>

  /** Get associated projects */
  getProjects: Action<{ id: string }, Project[]>
}

export interface ProjectActions extends CRUDResource<Project, ProjectInput> {
  /** Update project progress */
  updateProgress: Action<{ id: string; progress: number }, Project>

  /** Add team member */
  addMember: Action<{ id: string; memberId: string; role?: string }, Project>

  /** Remove team member */
  removeMember: Action<{ id: string; memberId: string }, Project>

  /** Get tasks in project */
  getTasks: Action<{ id: string } & ListParams, PaginatedResult<Task>>
}

export interface TaskActions extends CRUDResource<Task, TaskInput> {
  /** Assign task to user */
  assign: Action<{ id: string; assigneeId: string }, Task>

  /** Unassign task */
  unassign: Action<{ id: string }, Task>

  /** Start working on task */
  start: Action<{ id: string }, Task>

  /** Complete task */
  complete: Action<{ id: string }, Task>

  /** Block task */
  block: Action<{ id: string; reason?: string }, Task>

  /** Unblock task */
  unblock: Action<{ id: string }, Task>

  /** Log time spent */
  logTime: Action<{ id: string; value: number; unit: string }, Task>

  /** Get subtasks */
  getSubtasks: Action<{ id: string }, Task[]>

  /** Get dependencies */
  getDependencies: Action<{ id: string }, Task[]>
}

export interface WorkflowActions extends CRUDResource<Workflow, WorkflowInput> {
  /** Trigger workflow execution */
  trigger: Action<{ id: string; input?: unknown }, { executionId: string }>

  /** Pause workflow */
  pause: Action<{ id: string }, Workflow>

  /** Resume workflow */
  resume: Action<{ id: string }, Workflow>

  /** Get execution history */
  getExecutions: Action<{ id: string } & ListParams, PaginatedResult<WorkflowExecution>>
}

export interface ExperimentActions extends CRUDResource<Experiment, ExperimentInput> {
  /** Start experiment */
  start: Action<{ id: string }, Experiment>

  /** Pause experiment */
  pause: Action<{ id: string }, Experiment>

  /** Stop experiment */
  stop: Action<{ id: string }, Experiment>

  /** Record a conversion/event */
  record: Action<{ id: string; variantId: string; metric: string; value?: number }, void>

  /** Get statistical analysis */
  analyze: Action<{ id: string }, ExperimentAnalysis>
}

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Workflow execution record.
 */
export interface WorkflowExecution {
  id: string
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  input?: unknown
  output?: unknown
  startedAt: Date
  completedAt?: Date
  error?: string
  steps?: Array<{
    name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    startedAt?: Date
    completedAt?: Date
    output?: unknown
    error?: string
  }>
}

/**
 * Experiment analysis result.
 */
export interface ExperimentAnalysis {
  experimentId: string
  status: 'inconclusive' | 'winning' | 'losing'
  winningVariant?: string
  confidence: number
  sampleSize: number
  metrics: Record<string, {
    control: number
    treatment: number
    lift: number
    pValue: number
    significant: boolean
  }>
  recommendation?: string
}

// =============================================================================
// Events
// =============================================================================

export interface DatabaseEvents {
  created: BaseEvent<'database.created', Database>
  updated: BaseEvent<'database.updated', Database>
  deleted: BaseEvent<'database.deleted', { id: string }>
  connected: BaseEvent<'database.connected', { id: string }>
  disconnected: BaseEvent<'database.disconnected', { id: string }>
  error: BaseEvent<'database.error', { id: string; error: string }>
}

export interface FunctionEvents {
  created: BaseEvent<'function.created', Function>
  updated: BaseEvent<'function.updated', Function>
  deleted: BaseEvent<'function.deleted', { id: string }>
  executed: BaseEvent<'function.executed', { id: string; input: unknown; output: unknown; duration: number }>
  failed: BaseEvent<'function.failed', { id: string; input: unknown; error: string }>
  deployed: BaseEvent<'function.deployed', { id: string; version: string; environment: string }>
}

export interface GoalEvents {
  created: BaseEvent<'goal.created', Goal>
  updated: BaseEvent<'goal.updated', Goal>
  deleted: BaseEvent<'goal.deleted', { id: string }>
  progress_updated: BaseEvent<'goal.progress_updated', { id: string; progress: number }>
  achieved: BaseEvent<'goal.achieved', Goal>
  abandoned: BaseEvent<'goal.abandoned', { id: string; reason?: string }>
}

export interface PlanEvents {
  created: BaseEvent<'plan.created', Plan>
  updated: BaseEvent<'plan.updated', Plan>
  deleted: BaseEvent<'plan.deleted', { id: string }>
  approved: BaseEvent<'plan.approved', { id: string; approverId: string }>
  milestone_completed: BaseEvent<'plan.milestone_completed', { id: string; milestone: string }>
}

export interface ProjectEvents {
  created: BaseEvent<'project.created', Project>
  updated: BaseEvent<'project.updated', Project>
  deleted: BaseEvent<'project.deleted', { id: string }>
  started: BaseEvent<'project.started', Project>
  completed: BaseEvent<'project.completed', Project>
  paused: BaseEvent<'project.paused', Project>
  member_added: BaseEvent<'project.member_added', { projectId: string; memberId: string }>
  member_removed: BaseEvent<'project.member_removed', { projectId: string; memberId: string }>
}

export interface TaskEvents {
  created: BaseEvent<'task.created', Task>
  updated: BaseEvent<'task.updated', Task>
  deleted: BaseEvent<'task.deleted', { id: string }>
  assigned: BaseEvent<'task.assigned', { taskId: string; assigneeId: string }>
  unassigned: BaseEvent<'task.unassigned', { taskId: string }>
  started: BaseEvent<'task.started', Task>
  completed: BaseEvent<'task.completed', Task>
  blocked: BaseEvent<'task.blocked', { taskId: string; reason?: string }>
  unblocked: BaseEvent<'task.unblocked', { taskId: string }>
  time_logged: BaseEvent<'task.time_logged', { taskId: string; value: number; unit: string }>
}

export interface WorkflowEvents {
  created: BaseEvent<'workflow.created', Workflow>
  updated: BaseEvent<'workflow.updated', Workflow>
  deleted: BaseEvent<'workflow.deleted', { id: string }>
  triggered: BaseEvent<'workflow.triggered', { workflowId: string; executionId: string; input?: unknown }>
  completed: BaseEvent<'workflow.completed', { workflowId: string; executionId: string; output?: unknown }>
  failed: BaseEvent<'workflow.failed', { workflowId: string; executionId: string; error: string }>
  paused: BaseEvent<'workflow.paused', { id: string }>
  resumed: BaseEvent<'workflow.resumed', { id: string }>
}

export interface ExperimentEvents {
  created: BaseEvent<'experiment.created', Experiment>
  updated: BaseEvent<'experiment.updated', Experiment>
  deleted: BaseEvent<'experiment.deleted', { id: string }>
  started: BaseEvent<'experiment.started', Experiment>
  paused: BaseEvent<'experiment.paused', { id: string }>
  stopped: BaseEvent<'experiment.stopped', Experiment>
  recorded: BaseEvent<'experiment.recorded', { experimentId: string; variantId: string; metric: string; value?: number }>
  analyzed: BaseEvent<'experiment.analyzed', ExperimentAnalysis>
}

// =============================================================================
// Resources (Actions + Events)
// =============================================================================

export interface DatabaseResource extends DatabaseActions {
  on: <K extends keyof DatabaseEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DatabaseEvents[K], TProxy>
  ) => () => void
}

export interface FunctionResource extends FunctionActions {
  on: <K extends keyof FunctionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<FunctionEvents[K], TProxy>
  ) => () => void
}

export interface GoalResource extends GoalActions {
  on: <K extends keyof GoalEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<GoalEvents[K], TProxy>
  ) => () => void
}

export interface PlanResource extends PlanActions {
  on: <K extends keyof PlanEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PlanEvents[K], TProxy>
  ) => () => void
}

export interface ProjectResource extends ProjectActions {
  on: <K extends keyof ProjectEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ProjectEvents[K], TProxy>
  ) => () => void
}

export interface TaskResource extends TaskActions {
  on: <K extends keyof TaskEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TaskEvents[K], TProxy>
  ) => () => void
}

export interface WorkflowResource extends WorkflowActions {
  on: <K extends keyof WorkflowEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<WorkflowEvents[K], TProxy>
  ) => () => void
}

export interface ExperimentResource extends ExperimentActions {
  on: <K extends keyof ExperimentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ExperimentEvents[K], TProxy>
  ) => () => void
}
