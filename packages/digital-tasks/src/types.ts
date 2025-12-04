/**
 * Types for digital-tasks
 *
 * Task = Function + metadata (status, progress, assignment, dependencies)
 *
 * Every task is a function call. The function can be:
 * - Code: generates executable code
 * - Generative: AI generates content (no tools)
 * - Agentic: AI with tools in a loop
 * - Human: requires human input
 *
 * @packageDocumentation
 */

import type {
  FunctionDefinition,
  CodeFunctionDefinition,
  GenerativeFunctionDefinition,
  AgenticFunctionDefinition,
  HumanFunctionDefinition,
} from 'ai-functions'

// Re-export function types for convenience
export type {
  FunctionDefinition,
  CodeFunctionDefinition,
  GenerativeFunctionDefinition,
  AgenticFunctionDefinition,
  HumanFunctionDefinition,
}

// ============================================================================
// Task Status and Priority
// ============================================================================

/**
 * Task lifecycle status
 */
export type TaskStatus =
  | 'pending'      // Created but not started
  | 'queued'       // In queue waiting for worker
  | 'assigned'     // Assigned to a worker
  | 'in_progress'  // Being worked on
  | 'blocked'      // Waiting on dependency
  | 'review'       // Awaiting review
  | 'completed'    // Successfully finished
  | 'failed'       // Failed with error
  | 'cancelled'    // Cancelled

/**
 * Task priority levels
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'

// ============================================================================
// Worker Assignment
// ============================================================================

/**
 * Who can work on this task
 */
export type WorkerType = 'agent' | 'human' | 'team' | 'any'

/**
 * Worker reference
 */
export interface WorkerRef {
  type: WorkerType
  id: string
  name?: string
  role?: string
}

/**
 * Task assignment
 */
export interface TaskAssignment {
  worker: WorkerRef
  assignedAt: Date
  assignedBy?: string
  notes?: string
}

// ============================================================================
// Dependencies
// ============================================================================

/**
 * Dependency type
 */
export type DependencyType =
  | 'blocks'       // This task blocks another
  | 'blocked_by'   // This task is blocked by another
  | 'related_to'   // Related but not blocking
  | 'parent'       // Parent task
  | 'child'        // Child subtask

/**
 * Task dependency
 */
export interface TaskDependency {
  type: DependencyType
  taskId: string
  satisfied?: boolean
}

// ============================================================================
// Progress and Events
// ============================================================================

/**
 * Task progress
 */
export interface TaskProgress {
  percent: number
  step?: string
  totalSteps?: number
  currentStep?: number
  estimatedTimeRemaining?: number
  updatedAt: Date
}

/**
 * Task event for history
 */
export interface TaskEvent {
  id: string
  type: 'created' | 'assigned' | 'started' | 'progress' | 'blocked' | 'unblocked' | 'completed' | 'failed' | 'cancelled' | 'comment'
  timestamp: Date
  actor?: WorkerRef
  data?: unknown
  message?: string
}

// ============================================================================
// Core Task Interface
// ============================================================================

/**
 * Task = Function + metadata
 *
 * A task wraps a function (code, generative, agentic, or human)
 * with lifecycle management, assignment, and dependencies.
 */
export interface Task<TInput = unknown, TOutput = unknown> {
  /** Unique task ID */
  id: string

  /** The function this task executes */
  function: FunctionDefinition<TInput, TOutput>

  /** Current status */
  status: TaskStatus

  /** Priority level */
  priority: TaskPriority

  // Input/Output
  /** Input value (resolved from function.args) */
  input?: TInput

  /** Output value (when completed) */
  output?: TOutput

  /** Error (when failed) */
  error?: string

  // Assignment
  /** Who can work on this */
  allowedWorkers?: WorkerType[]

  /** Current assignment */
  assignment?: TaskAssignment

  // Dependencies
  /** Task dependencies */
  dependencies?: TaskDependency[]

  // Progress
  /** Current progress */
  progress?: TaskProgress

  // Timing
  /** When created */
  createdAt: Date

  /** Scheduled start time */
  scheduledFor?: Date

  /** Deadline */
  deadline?: Date

  /** When started */
  startedAt?: Date

  /** When completed */
  completedAt?: Date

  /** Timeout in ms */
  timeout?: number

  // Hierarchy
  /** Parent task ID */
  parentId?: string

  /** Project ID */
  projectId?: string

  // Metadata
  /** Tags */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** Event history */
  events?: TaskEvent[]
}

/**
 * Any task (for collections)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTask = Task<any, any>

// ============================================================================
// Task Creation
// ============================================================================

/**
 * Create task from a Code function
 */
export interface CodeTaskOptions<TInput = unknown, TOutput = unknown> {
  function: CodeFunctionDefinition<TInput, TOutput>
  input?: TInput
  priority?: TaskPriority
  assignTo?: WorkerRef
  dependencies?: string[]
  deadline?: Date
  tags?: string[]
  parentId?: string
  projectId?: string
}

/**
 * Create task from a Generative function
 */
export interface GenerativeTaskOptions<TInput = unknown, TOutput = unknown> {
  function: GenerativeFunctionDefinition<TInput, TOutput>
  input?: TInput
  priority?: TaskPriority
  assignTo?: WorkerRef
  dependencies?: string[]
  deadline?: Date
  tags?: string[]
  parentId?: string
  projectId?: string
}

/**
 * Create task from an Agentic function
 */
export interface AgenticTaskOptions<TInput = unknown, TOutput = unknown> {
  function: AgenticFunctionDefinition<TInput, TOutput>
  input?: TInput
  priority?: TaskPriority
  assignTo?: WorkerRef
  dependencies?: string[]
  deadline?: Date
  tags?: string[]
  parentId?: string
  projectId?: string
}

/**
 * Create task from a Human function
 */
export interface HumanTaskOptions<TInput = unknown, TOutput = unknown> {
  function: HumanFunctionDefinition<TInput, TOutput>
  input?: TInput
  priority?: TaskPriority
  assignTo?: WorkerRef
  dependencies?: string[]
  deadline?: Date
  tags?: string[]
  parentId?: string
  projectId?: string
}

/**
 * Generic task creation options
 */
export interface CreateTaskOptions<TInput = unknown, TOutput = unknown> {
  function: FunctionDefinition<TInput, TOutput>
  input?: TInput
  priority?: TaskPriority
  allowedWorkers?: WorkerType[]
  assignTo?: WorkerRef
  dependencies?: string[]
  scheduledFor?: Date
  deadline?: Date
  timeout?: number
  tags?: string[]
  parentId?: string
  projectId?: string
  metadata?: Record<string, unknown>
}

/**
 * Task update options
 */
export interface UpdateTaskOptions {
  status?: TaskStatus
  progress?: Partial<TaskProgress>
  assignment?: TaskAssignment
  priority?: TaskPriority
  event?: Omit<TaskEvent, 'id' | 'timestamp'>
  metadata?: Record<string, unknown>
}

// ============================================================================
// Task Queue
// ============================================================================

/**
 * Task query options
 */
export interface TaskQuery {
  status?: TaskStatus | TaskStatus[]
  priority?: TaskPriority | TaskPriority[]
  functionType?: 'code' | 'generative' | 'agentic' | 'human'
  assignedTo?: string
  tags?: string[]
  projectId?: string
  parentId?: string
  search?: string
  sortBy?: 'createdAt' | 'priority' | 'deadline' | 'status'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/**
 * Task queue options
 */
export interface TaskQueueOptions {
  name?: string
  concurrency?: number
  defaultTimeout?: number
  persistent?: boolean
}

/**
 * Task queue interface
 */
export interface TaskQueue {
  add(task: AnyTask): Promise<void>
  get(id: string): Promise<AnyTask | undefined>
  update(id: string, options: UpdateTaskOptions): Promise<AnyTask | undefined>
  remove(id: string): Promise<boolean>
  query(options: TaskQuery): Promise<AnyTask[]>
  getNextForWorker(worker: WorkerRef): Promise<AnyTask | undefined>
  claim(taskId: string, worker: WorkerRef): Promise<boolean>
  complete(taskId: string, output: unknown): Promise<void>
  fail(taskId: string, error: string): Promise<void>
  stats(): Promise<TaskQueueStats>
}

/**
 * Task queue stats
 */
export interface TaskQueueStats {
  total: number
  byStatus: Record<TaskStatus, number>
  byPriority: Record<TaskPriority, number>
  byFunctionType?: Record<string, number>
  avgWaitTime?: number
  avgCompletionTime?: number
}

// ============================================================================
// Task Result
// ============================================================================

/**
 * Task execution result
 */
export interface TaskResult<TOutput = unknown> {
  taskId: string
  success: boolean
  output?: TOutput
  error?: {
    code: string
    message: string
    details?: unknown
  }
  metadata?: {
    duration: number
    startedAt: Date
    completedAt: Date
    worker?: WorkerRef
  }
}
