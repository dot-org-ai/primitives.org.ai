/**
 * RPC Client for digital-tasks
 *
 * Connects to a deployed digital-tasks worker via rpc.do,
 * providing a fully typed client for remote task management.
 *
 * @example
 * ```ts
 * import { createTaskClient } from 'digital-tasks/client'
 *
 * const tasks = createTaskClient('https://digital-tasks.workers.dev')
 * const task = await tasks.create({ name: 'My Task', description: 'Do something', priority: 'high' })
 * await tasks.execute(task.id)
 * await tasks.complete(task.id, { result: 'done' })
 * ```
 *
 * @packageDocumentation
 */

import { RPC, http } from 'rpc.do'

// ============================================================================
// Types (mirrored from worker.ts for client-side use)
// ============================================================================

export type TaskStatus =
  | 'pending'
  | 'scheduled'
  | 'queued'
  | 'blocked'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'

export interface WorkerRef {
  type: 'agent' | 'human' | 'team' | 'any'
  id: string
  name?: string
}

export interface TaskDependency {
  type: 'blocked_by'
  taskId: string
  satisfied: boolean
}

export interface TaskProgress {
  percent: number
  step?: string
  updatedAt: Date
}

export interface TaskAssignment {
  worker: WorkerRef
  assignedAt: Date
}

export interface TaskData<TInput = unknown, TOutput = unknown> {
  id: string
  name: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  input?: TInput
  output?: TOutput
  error?: string
  scheduledFor?: Date
  deadline?: Date
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  progress?: TaskProgress
  dependencies?: TaskDependency[]
  assignment?: TaskAssignment
  metadata?: Record<string, unknown>
}

export interface CreateTaskOptions<TInput = unknown> {
  id?: string
  name: string
  description: string
  priority?: TaskPriority
  input?: TInput
  scheduledFor?: Date
  deadline?: Date
  tags?: string[]
  metadata?: Record<string, unknown>
  dependencies?: string[]
}

export interface ScheduleOptions {
  priority?: TaskPriority
}

export interface ExecuteOptions {
  worker?: WorkerRef
}

export interface ListOptions {
  status?: TaskStatus | TaskStatus[]
  priority?: TaskPriority
  tags?: string[]
  search?: string
  sortBy?: 'createdAt' | 'priority'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface EnqueueOptions {
  delaySeconds?: number
}

export interface TaskStats {
  total: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
}

// ============================================================================
// TaskServiceAPI - the RPC interface for the client
// ============================================================================

/**
 * The RPC API surface exposed by the digital-tasks worker.
 *
 * This interface mirrors the methods on TaskServiceCore (worker.ts)
 * and is used to type the RPC client proxy.
 */
export interface TaskServiceAPI {
  /** Create a new task */
  create(options: CreateTaskOptions): Promise<TaskData>

  /** Schedule a task for future execution */
  schedule(taskId: string, scheduledFor: Date, options?: ScheduleOptions): Promise<TaskData>

  /** Start task execution */
  execute(taskId: string, options?: ExecuteOptions): Promise<TaskData>

  /** Complete a task with output */
  complete(taskId: string, output: unknown): Promise<TaskData>

  /** Fail a task with error */
  fail(taskId: string, error: string | Error): Promise<TaskData>

  /** Get task status */
  getStatus(taskId: string): Promise<TaskData | null>

  /** Update task progress */
  updateProgress(taskId: string, percent: number, step?: string): Promise<TaskData>

  /** Cancel a task */
  cancel(taskId: string, reason?: string): Promise<boolean>

  /** List tasks with optional filtering */
  list(options?: ListOptions): Promise<TaskData[]>

  /** Get task statistics */
  getStats(): Promise<TaskStats>

  /** Retry a failed task */
  retry(taskId: string): Promise<TaskData>

  /** Get tasks that are ready for execution */
  getReadyTasks(): Promise<TaskData[]>

  /** Get tasks that depend on a given task */
  getDependants(taskId: string): Promise<TaskData[]>

  /** Enqueue a task for background processing */
  enqueue(taskId: string, options?: EnqueueOptions): Promise<TaskData>

  /** Dequeue and start the next task */
  dequeue(): Promise<TaskData | null>

  /** Execute a task with AI */
  executeWithAI(taskId: string): Promise<TaskData>
}

// ============================================================================
// Client Options
// ============================================================================

/**
 * Options for creating a task client
 */
export interface TaskClientOptions {
  /** Authentication token or API key */
  token?: string
  /** Custom headers to include with requests */
  headers?: Record<string, string>
}

// ============================================================================
// Client Factory
// ============================================================================

/** Default worker URL for digital-tasks */
const DEFAULT_URL = 'https://digital-tasks.workers.dev'

/**
 * Create a typed RPC client for the digital-tasks worker.
 *
 * @param url - The URL of the deployed digital-tasks worker
 * @param options - Optional configuration (auth token, custom headers)
 * @returns A fully typed RPC client proxy
 *
 * @example
 * ```ts
 * import { createTaskClient } from 'digital-tasks/client'
 *
 * // Connect to a deployed worker
 * const tasks = createTaskClient('https://digital-tasks.workers.dev')
 *
 * // Create and manage tasks
 * const task = await tasks.create({
 *   name: 'Analyze data',
 *   description: 'Run data analysis pipeline',
 *   priority: 'high',
 * })
 *
 * // Execute the task
 * await tasks.execute(task.id)
 *
 * // Track progress
 * await tasks.updateProgress(task.id, 50, 'Processing...')
 *
 * // Complete with output
 * await tasks.complete(task.id, { results: [1, 2, 3] })
 *
 * // List all completed tasks
 * const completed = await tasks.list({ status: 'completed' })
 * ```
 *
 * @example
 * ```ts
 * // With authentication
 * const tasks = createTaskClient('https://digital-tasks.workers.dev', {
 *   token: 'my-api-key',
 * })
 * ```
 */
export function createTaskClient(
  url: string = DEFAULT_URL,
  options?: TaskClientOptions
): TaskServiceAPI {
  return RPC<TaskServiceAPI>(http(url, options?.token))
}

/**
 * Default task client connected to digital-tasks.workers.dev
 *
 * @example
 * ```ts
 * import client from 'digital-tasks/client'
 *
 * const task = await client.create({
 *   name: 'Quick task',
 *   description: 'A task using the default client',
 * })
 * ```
 */
const client: TaskServiceAPI = createTaskClient()

export default client
