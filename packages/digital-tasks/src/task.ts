/**
 * Task - Core task creation and management functions
 *
 * @packageDocumentation
 */

import type {
  Task,
  AnyTask,
  CreateTaskOptions,
  WorkerRef,
  TaskResult,
  TaskDependency,
} from './types.js'
import { taskQueue } from './queue.js'

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Create a new task from a function definition
 *
 * @example
 * ```ts
 * const task = await createTask({
 *   function: {
 *     type: 'generative',
 *     name: 'summarize',
 *     args: { text: 'The text to summarize' },
 *     output: 'string',
 *     promptTemplate: 'Summarize: {{text}}',
 *   },
 *   input: { text: 'Long article content...' },
 *   priority: 'high',
 * })
 * ```
 */
export async function createTask<TInput = unknown, TOutput = unknown>(
  options: CreateTaskOptions<TInput, TOutput>
): Promise<Task<TInput, TOutput>> {
  const now = new Date()

  // Convert string dependencies to TaskDependency array
  let dependencies: TaskDependency[] | undefined
  if (options.dependencies && options.dependencies.length > 0) {
    dependencies = options.dependencies.map((taskId) => ({
      type: 'blocked_by' as const,
      taskId,
      satisfied: false,
    }))
  }

  // Determine allowed workers from function type
  let allowedWorkers = options.allowedWorkers
  if (!allowedWorkers) {
    const funcType = options.function.type
    if (funcType === 'human') {
      allowedWorkers = ['human']
    } else if (funcType === 'agentic') {
      allowedWorkers = ['agent']
    } else {
      allowedWorkers = ['any']
    }
  }

  const task: Task<TInput, TOutput> = {
    id: generateTaskId(),
    function: options.function,
    status: options.scheduledFor ? 'pending' : 'queued',
    priority: options.priority || 'normal',
    input: options.input,
    allowedWorkers,
    dependencies,
    scheduledFor: options.scheduledFor,
    deadline: options.deadline,
    timeout: options.timeout,
    tags: options.tags,
    parentId: options.parentId,
    projectId: options.projectId,
    metadata: options.metadata,
    createdAt: now,
    events: [],
  }

  // Auto-assign if specified
  if (options.assignTo) {
    task.assignment = {
      worker: options.assignTo,
      assignedAt: now,
    }
    task.status = 'assigned'
  }

  // Check if blocked by dependencies
  if (dependencies && dependencies.length > 0) {
    const hasPendingDeps = dependencies.some(
      (d) => d.type === 'blocked_by' && !d.satisfied
    )
    if (hasPendingDeps) {
      task.status = 'blocked'
    }
  }

  // Add to queue
  await taskQueue.add(task as AnyTask)

  return task
}

/**
 * Get a task by ID
 */
export async function getTask(id: string): Promise<AnyTask | undefined> {
  return taskQueue.get(id)
}

/**
 * Start working on a task
 */
export async function startTask(
  taskId: string,
  worker: WorkerRef
): Promise<AnyTask | undefined> {
  const task = await taskQueue.get(taskId)
  if (!task) return undefined

  // Claim the task if not already assigned
  if (!task.assignment) {
    const claimed = await taskQueue.claim(taskId, worker)
    if (!claimed) return undefined
  }

  // Update status to in_progress
  return taskQueue.update(taskId, {
    status: 'in_progress',
    event: {
      type: 'started',
      actor: worker,
      message: `Started by ${worker.name || worker.id}`,
    },
  })
}

/**
 * Update task progress
 */
export async function updateProgress(
  taskId: string,
  percent: number,
  step?: string
): Promise<AnyTask | undefined> {
  return taskQueue.update(taskId, {
    progress: {
      percent,
      step,
      updatedAt: new Date(),
    },
    event: {
      type: 'progress',
      message: step || `Progress: ${percent}%`,
      data: { percent, step },
    },
  })
}

/**
 * Complete a task with output
 */
export async function completeTask<TOutput>(
  taskId: string,
  output: TOutput
): Promise<TaskResult<TOutput>> {
  const task = await taskQueue.get(taskId)
  if (!task) {
    return {
      taskId,
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: `Task "${taskId}" not found`,
      },
    }
  }

  await taskQueue.complete(taskId, output)

  return {
    taskId,
    success: true,
    output,
    metadata: {
      duration: task.startedAt
        ? Date.now() - task.startedAt.getTime()
        : 0,
      startedAt: task.startedAt || new Date(),
      completedAt: new Date(),
      worker: task.assignment?.worker,
    },
  }
}

/**
 * Fail a task with error
 */
export async function failTask(
  taskId: string,
  error: string | Error
): Promise<TaskResult> {
  const task = await taskQueue.get(taskId)
  if (!task) {
    return {
      taskId,
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: `Task "${taskId}" not found`,
      },
    }
  }

  const errorMessage = error instanceof Error ? error.message : error

  await taskQueue.fail(taskId, errorMessage)

  return {
    taskId,
    success: false,
    error: {
      code: 'TASK_FAILED',
      message: errorMessage,
      details: error instanceof Error ? { stack: error.stack } : undefined,
    },
    metadata: {
      duration: task.startedAt
        ? Date.now() - task.startedAt.getTime()
        : 0,
      startedAt: task.startedAt || new Date(),
      completedAt: new Date(),
      worker: task.assignment?.worker,
    },
  }
}

/**
 * Cancel a task
 */
export async function cancelTask(
  taskId: string,
  reason?: string
): Promise<boolean> {
  const task = await taskQueue.get(taskId)
  if (!task) return false

  await taskQueue.update(taskId, {
    status: 'cancelled',
    event: {
      type: 'cancelled',
      message: reason || 'Task cancelled',
    },
  })

  return true
}

/**
 * Add a comment to a task
 */
export async function addComment(
  taskId: string,
  comment: string,
  author?: WorkerRef
): Promise<AnyTask | undefined> {
  return taskQueue.update(taskId, {
    event: {
      type: 'comment',
      actor: author,
      message: comment,
    },
  })
}

/**
 * Create a subtask
 */
export async function createSubtask<TInput = unknown, TOutput = unknown>(
  parentTaskId: string,
  options: Omit<CreateTaskOptions<TInput, TOutput>, 'parentId'>
): Promise<Task<TInput, TOutput>> {
  return createTask({
    ...options,
    parentId: parentTaskId,
  })
}

/**
 * Get subtasks of a task
 */
export async function getSubtasks(parentTaskId: string): Promise<AnyTask[]> {
  return taskQueue.query({ parentId: parentTaskId })
}

/**
 * Wait for a task to complete
 */
export async function waitForTask(
  taskId: string,
  options?: { timeout?: number; pollInterval?: number }
): Promise<TaskResult> {
  const timeout = options?.timeout ?? 5 * 60 * 1000 // 5 minutes
  const pollInterval = options?.pollInterval ?? 1000 // 1 second

  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const task = await taskQueue.get(taskId)
    if (!task) {
      return {
        taskId,
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: `Task "${taskId}" not found`,
        },
      }
    }

    if (task.status === 'completed') {
      return {
        taskId,
        success: true,
        output: task.output,
        metadata: {
          duration: task.completedAt && task.startedAt
            ? task.completedAt.getTime() - task.startedAt.getTime()
            : 0,
          startedAt: task.startedAt || task.createdAt,
          completedAt: task.completedAt || new Date(),
          worker: task.assignment?.worker,
        },
      }
    }

    if (task.status === 'failed') {
      return {
        taskId,
        success: false,
        error: {
          code: 'TASK_FAILED',
          message: task.error || 'Task failed',
        },
        metadata: {
          duration: task.completedAt && task.startedAt
            ? task.completedAt.getTime() - task.startedAt.getTime()
            : 0,
          startedAt: task.startedAt || task.createdAt,
          completedAt: task.completedAt || new Date(),
          worker: task.assignment?.worker,
        },
      }
    }

    if (task.status === 'cancelled') {
      return {
        taskId,
        success: false,
        error: {
          code: 'TASK_CANCELLED',
          message: 'Task was cancelled',
        },
      }
    }

    // Wait before polling again
    await new Promise((resolve) => setTimeout(resolve, pollInterval))
  }

  return {
    taskId,
    success: false,
    error: {
      code: 'TIMEOUT',
      message: `Task did not complete within ${timeout}ms`,
    },
  }
}
