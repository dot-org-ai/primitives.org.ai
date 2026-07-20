/**
 * Types for digital-tasks
 *
 * Task = Action + issue-shaped metadata (title, body, comments, labels,
 * dependencies, assignees, project). A Task is a specialization of an
 * `Action` (`digital-objects.Action`) with project-management overlay,
 * per the SVO co-design (`docs/plans/2026-05-05-svo-co-design.md`).
 *
 * Every task wraps a callable Verb — historically the `function` field
 * (an `ai-functions.FunctionDefinition`). Per CONTEXT.md the canonical
 * name for callable Verbs is **Tool**; `function` is being renamed to
 * `tool` over time. See the `function` / `tool` fields below.
 *
 * The function (now Tool) can be:
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
import type { FunctionKind } from '@org.ai/types'
import type { Action } from 'digital-objects'

// Re-export function types for convenience.
// The kind axis ('code' | 'generative' | 'agentic' | 'human') is the
// canonical FunctionKind vocabulary from @org.ai/types.
export type {
  FunctionDefinition,
  CodeFunctionDefinition,
  GenerativeFunctionDefinition,
  AgenticFunctionDefinition,
  HumanFunctionDefinition,
  FunctionKind,
}

// Re-export Action so consumers can see the supertype
export type { Action }

// ============================================================================
// Task Status and Priority
// ============================================================================

/**
 * Task lifecycle status
 */
export type TaskStatus =
  | 'pending' // Created but not started
  | 'queued' // In queue waiting for worker
  | 'assigned' // Assigned to a worker
  | 'in_progress' // Being worked on
  | 'blocked' // Waiting on dependency
  | 'review' // Awaiting review
  | 'completed' // Successfully finished
  | 'failed' // Failed with error
  | 'cancelled' // Cancelled

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
  | 'blocks' // This task blocks another
  | 'blocked_by' // This task is blocked by another
  | 'related_to' // Related but not blocking
  | 'parent' // Parent task
  | 'child' // Child subtask

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
  type:
    | 'created'
    | 'assigned'
    | 'started'
    | 'progress'
    | 'blocked'
    | 'unblocked'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'comment'
  timestamp: Date
  actor?: WorkerRef
  data?: unknown
  message?: string
}

// ============================================================================
// Comments (issue-shaped child Actions)
// ============================================================================

/**
 * Comment - a thin wrapper around a comment posted on a Task.
 *
 * Per the SVO co-design, comments are child Actions of verb 'commented'
 * whose `cause` role points back at the parent Task's Action id. This
 * shape is the surfaced view of such an Action for issue-shaped UIs.
 */
export interface Comment {
  /** Comment id (matches the underlying Action id when persisted) */
  id: string
  /** Markdown body of the comment */
  body: string
  /** Who posted the comment */
  author?: WorkerRef
  /** When the comment was posted */
  createdAt: Date
}

// ============================================================================
// Core Task Interface
// ============================================================================

/**
 * Task = Action + issue-shaped metadata
 *
 * A Task is a specialization of `digital-objects.Action` carrying
 * project-management overlay (title, body, comments, labels,
 * dependencies, assignees, milestone/project). The Action supertype
 * provides id/verb/subject/object/roles/data/createdAt/completedAt.
 *
 * Status: Action's status taxonomy is lifecycle-only
 * (pending/active/completed/failed/cancelled). Task's status taxonomy
 * is project-management shaped (queued/assigned/in_progress/blocked/
 * review/...). We omit Action's `status` and replace it with the
 * Task-specific `TaskStatus`. Both supersets share `pending`,
 * `completed`, `failed`, `cancelled`.
 *
 * Verb: every Task is an Action of some Verb. For tasks created via
 * the legacy `createTask({ function })` path, `verb` defaults to the
 * function's name (e.g. `'summarize'`).
 *
 * Backward compatibility: all previously-valid Task shapes remain
 * assignable. Newly added fields (title/body/labels/project/assignees/
 * comments/$type/verb) are optional or have defaults populated by
 * `createTask`.
 */
export type Task<TInput = unknown, TOutput = unknown> = Omit<Action<TInput>, 'status'> & {
  /** MDXLD type discriminator */
  $type?: 'Task'

  /**
   * The Tool (callable Verb) this task executes. This is the canonical
   * field per CONTEXT.md. `createTask` always populates `tool`; the
   * legacy `function` alias is also populated during the deprecation
   * window so existing readers keep working.
   *
   * Optional on the type so that older literals constructed with only
   * `function` still typecheck; in practice every Task has exactly one
   * underlying callable Verb available via `task.tool ?? task.function`.
   */
  tool?: FunctionDefinition<TInput, TOutput>

  /**
   * Legacy alias for `tool`.
   *
   * @deprecated Use `tool` instead. The canonical name for callable
   * Verbs is **Tool** (see CONTEXT.md). `createTask` continues to
   * populate this alongside `tool` for the duration of the deprecation
   * window. Slated for removal in the next major version.
   */
  function?: FunctionDefinition<TInput, TOutput>

  /** Issue title (short, single-line) */
  title?: string

  /** Rich markdown body / description */
  body?: string

  /** GitHub-issue-shaped labels */
  labels?: string[]

  /** Milestone or project reference (string ref; cf. `projectId` for
   *  the durable internal id when a `Project` exists in this package). */
  project?: string

  /** Comments posted on this task (child Actions of verb 'commented') */
  comments?: Comment[]

  /** Workers assigned to this task */
  assignees?: WorkerRef[]

  /** Current task status (specialization — see jsdoc above) */
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
  /** Worker types permitted to claim this task */
  allowedWorkers?: WorkerType[]

  /** Current assignment (single primary worker) */
  assignment?: TaskAssignment

  // Dependencies
  /** Task dependencies */
  dependencies?: TaskDependency[]

  // Progress
  /** Current progress */
  progress?: TaskProgress

  // Timing
  /** Scheduled start time */
  scheduledFor?: Date

  /** Deadline */
  deadline?: Date

  /** When started */
  startedAt?: Date

  /** Timeout in ms */
  timeout?: number

  // Hierarchy
  /** Parent task ID */
  parentId?: string

  /** Project ID (internal `Project.id` when this Task belongs to a
   *  Project in this package; distinct from `project` ref string) */
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
 * Task dependency tuple — minimal shape from the SVO design doc.
 *
 * `TaskDependency` (above) is the richer in-package shape with a
 * full DependencyType set; `TaskDep` is the issue-shaped pair from
 * the design doc, retained as a convenience export.
 */
export interface TaskDep {
  taskId: string
  type: 'blocked_by' | 'related'
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
  /** Tool (callable Verb) to run. Preferred over `function`. */
  tool?: CodeFunctionDefinition<TInput, TOutput>
  /** @deprecated Use `tool` instead. */
  function?: CodeFunctionDefinition<TInput, TOutput>
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
  /** Tool (callable Verb) to run. Preferred over `function`. */
  tool?: GenerativeFunctionDefinition<TInput, TOutput>
  /** @deprecated Use `tool` instead. */
  function?: GenerativeFunctionDefinition<TInput, TOutput>
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
  /** Tool (callable Verb) to run. Preferred over `function`. */
  tool?: AgenticFunctionDefinition<TInput, TOutput>
  /** @deprecated Use `tool` instead. */
  function?: AgenticFunctionDefinition<TInput, TOutput>
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
  /** Tool (callable Verb) to run. Preferred over `function`. */
  tool?: HumanFunctionDefinition<TInput, TOutput>
  /** @deprecated Use `tool` instead. */
  function?: HumanFunctionDefinition<TInput, TOutput>
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
 *
 * Either `tool` (preferred) or the deprecated `function` alias must be
 * provided. `createTask` normalizes to `tool` and also populates the
 * legacy `function` alias on the resulting Task for backward compat.
 */
export interface CreateTaskOptions<TInput = unknown, TOutput = unknown> {
  /** Tool (callable Verb) to run. Preferred over `function`. */
  tool?: FunctionDefinition<TInput, TOutput>
  /** @deprecated Use `tool` instead. */
  function?: FunctionDefinition<TInput, TOutput>
  input?: TInput
  priority?: TaskPriority
  allowedWorkers?: WorkerType[]
  assignTo?: WorkerRef
  /** Multiple assignees (issue-shaped); first becomes the primary `assignment` */
  assignees?: WorkerRef[]
  dependencies?: string[]
  scheduledFor?: Date
  deadline?: Date
  timeout?: number
  tags?: string[]
  parentId?: string
  projectId?: string
  metadata?: Record<string, unknown>
  // Issue-shaped fields (SVO co-design)
  /** Issue title (short, single-line) */
  title?: string
  /** Rich markdown body / description */
  body?: string
  /** GitHub-issue-shaped labels */
  labels?: string[]
  /** Milestone or project ref string */
  project?: string
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
  functionType?: FunctionKind
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
