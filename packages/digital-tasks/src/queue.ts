/**
 * Task Queue - In-memory task queue implementation
 *
 * Provides task queuing, assignment, and execution management.
 *
 * @packageDocumentation
 */

import type {
  AnyTask,
  TaskQueue,
  TaskQueueOptions,
  TaskQuery,
  TaskStatus,
  TaskPriority,
  UpdateTaskOptions,
  WorkerRef,
  TaskQueueStats,
  TaskEvent,
  FunctionDefinition,
} from './types.js'

/**
 * Priority values for sorting
 */
const priorityOrder: Record<TaskPriority, number> = {
  critical: 5,
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
}

/**
 * In-memory task queue implementation
 */
class InMemoryTaskQueue implements TaskQueue {
  private tasks: Map<string, AnyTask> = new Map()
  private options: TaskQueueOptions

  constructor(options: TaskQueueOptions = {}) {
    this.options = {
      name: 'default',
      concurrency: 10,
      defaultTimeout: 5 * 60 * 1000, // 5 minutes
      persistent: false,
      ...options,
    }
  }

  async add(task: AnyTask): Promise<void> {
    // Add created event
    const event: TaskEvent = {
      id: `evt_${Date.now()}`,
      type: 'created',
      timestamp: new Date(),
      message: `Task created: ${task.function.name}`,
    }

    const taskWithEvent = {
      ...task,
      events: [...(task.events || []), event],
    }

    this.tasks.set(task.id, taskWithEvent)
  }

  async get(id: string): Promise<AnyTask | undefined> {
    return this.tasks.get(id)
  }

  async update(id: string, options: UpdateTaskOptions): Promise<AnyTask | undefined> {
    const task = this.tasks.get(id)
    if (!task) return undefined

    const events = [...(task.events || [])]

    // Add event if provided
    if (options.event) {
      events.push({
        ...options.event,
        id: `evt_${Date.now()}`,
        timestamp: new Date(),
      })
    }

    // Add status change event
    if (options.status && options.status !== task.status) {
      events.push({
        id: `evt_${Date.now()}_status`,
        type:
          options.status === 'completed'
            ? 'completed'
            : options.status === 'failed'
            ? 'failed'
            : options.status === 'in_progress'
            ? 'started'
            : options.status === 'blocked'
            ? 'blocked'
            : 'progress',
        timestamp: new Date(),
        message: `Status changed from ${task.status} to ${options.status}`,
      })
    }

    // Build progress update if provided
    let progressUpdate = task.progress
    if (options.progress) {
      progressUpdate = {
        percent: options.progress.percent ?? task.progress?.percent ?? 0,
        updatedAt: new Date(),
      }
      const step = options.progress.step ?? task.progress?.step
      if (step !== undefined) {
        progressUpdate.step = step
      }
      const totalSteps = options.progress.totalSteps ?? task.progress?.totalSteps
      if (totalSteps !== undefined) {
        progressUpdate.totalSteps = totalSteps
      }
      const currentStep = options.progress.currentStep ?? task.progress?.currentStep
      if (currentStep !== undefined) {
        progressUpdate.currentStep = currentStep
      }
      const estTime =
        options.progress.estimatedTimeRemaining ?? task.progress?.estimatedTimeRemaining
      if (estTime !== undefined) {
        progressUpdate.estimatedTimeRemaining = estTime
      }
    }

    const updated: AnyTask = {
      ...task,
      ...(options.status && { status: options.status }),
      ...(options.priority && { priority: options.priority }),
      ...(options.assignment && { assignment: options.assignment }),
      ...(progressUpdate && { progress: progressUpdate }),
      ...(options.metadata && {
        metadata: { ...task.metadata, ...options.metadata },
      }),
      events,
    }

    this.tasks.set(id, updated)
    return updated
  }

  async remove(id: string): Promise<boolean> {
    return this.tasks.delete(id)
  }

  async query(options: TaskQuery): Promise<AnyTask[]> {
    let results = Array.from(this.tasks.values())

    // Filter by status
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status]
      results = results.filter((t) => statuses.includes(t.status))
    }

    // Filter by priority
    if (options.priority) {
      const priorities = Array.isArray(options.priority) ? options.priority : [options.priority]
      results = results.filter((t) => priorities.includes(t.priority))
    }

    // Filter by function type
    if (options.functionType) {
      results = results.filter((t) => t.function.type === options.functionType)
    }

    // Filter by assigned worker
    if (options.assignedTo) {
      results = results.filter((t) => t.assignment?.worker.id === options.assignedTo)
    }

    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      results = results.filter((t) => t.tags && options.tags!.some((tag) => t.tags!.includes(tag)))
    }

    // Filter by project
    if (options.projectId) {
      results = results.filter((t) => t.projectId === options.projectId)
    }

    // Filter by parent
    if (options.parentId) {
      results = results.filter((t) => t.parentId === options.parentId)
    }

    // Text search
    if (options.search) {
      const search = options.search.toLowerCase()
      results = results.filter(
        (t) =>
          t.function.name.toLowerCase().includes(search) ||
          t.function.description?.toLowerCase().includes(search)
      )
    }

    // Sort
    if (options.sortBy) {
      results.sort((a, b) => {
        let aVal: number
        let bVal: number

        switch (options.sortBy) {
          case 'createdAt':
            aVal = a.createdAt.getTime()
            bVal = b.createdAt.getTime()
            break
          case 'priority':
            aVal = priorityOrder[a.priority]
            bVal = priorityOrder[b.priority]
            break
          case 'deadline':
            aVal = a.deadline?.getTime() || Infinity
            bVal = b.deadline?.getTime() || Infinity
            break
          case 'status':
            aVal = a.status.charCodeAt(0)
            bVal = b.status.charCodeAt(0)
            break
          default:
            return 0
        }

        return options.sortOrder === 'desc' ? bVal - aVal : aVal - bVal
      })
    }

    // Pagination
    const offset = options.offset ?? 0
    const limit = options.limit ?? results.length
    results = results.slice(offset, offset + limit)

    return results
  }

  async getNextForWorker(worker: WorkerRef): Promise<AnyTask | undefined> {
    // Get queued tasks sorted by priority, then by deadline
    const queuedTasks = await this.query({
      status: ['pending', 'queued'],
      sortBy: 'priority',
      sortOrder: 'desc',
    })

    // Find first task the worker can handle
    for (const task of queuedTasks) {
      // Check if worker type is allowed
      if (
        task.allowedWorkers &&
        !task.allowedWorkers.includes(worker.type) &&
        !task.allowedWorkers.includes('any')
      ) {
        continue
      }

      // Note: Could check worker skills against task requirements in the future

      // Check if task is scheduled for later
      if (task.scheduledFor && task.scheduledFor > new Date()) {
        continue
      }

      // Check dependencies
      if (task.dependencies && task.dependencies.length > 0) {
        const unblockedDeps = task.dependencies.filter(
          (d) => d.type === 'blocked_by' && !d.satisfied
        )
        if (unblockedDeps.length > 0) {
          continue
        }
      }

      return task
    }

    return undefined
  }

  async claim(taskId: string, worker: WorkerRef): Promise<boolean> {
    const task = await this.get(taskId)
    if (!task) return false

    // Check if already assigned
    if (task.assignment) {
      return false
    }

    // Update task with assignment
    await this.update(taskId, {
      status: 'assigned',
      assignment: {
        worker,
        assignedAt: new Date(),
      },
      event: {
        type: 'assigned',
        actor: worker,
        message: `Assigned to ${worker.name || worker.id}`,
      },
    })

    return true
  }

  async complete(taskId: string, output: unknown): Promise<void> {
    const task = await this.get(taskId)
    if (!task) return

    const event: Omit<TaskEvent, 'id' | 'timestamp'> = {
      type: 'completed',
      message: 'Task completed successfully',
      data: { output },
    }
    if (task.assignment?.worker !== undefined) {
      event.actor = task.assignment.worker
    }
    await this.update(taskId, {
      status: 'completed',
      event,
    })

    // Update task output separately since it's not in UpdateTaskOptions
    const updated = await this.get(taskId)
    if (updated) {
      this.tasks.set(taskId, {
        ...updated,
        output: {
          value: output,
          producedAt: new Date(),
        },
        completedAt: new Date(),
      })
    }

    // Satisfy dependencies in other tasks
    for (const [, otherTask] of this.tasks) {
      if (otherTask.dependencies) {
        const hasDep = otherTask.dependencies.find(
          (d) => d.taskId === taskId && d.type === 'blocked_by'
        )
        if (hasDep) {
          const updatedDeps = otherTask.dependencies.map((d) =>
            d.taskId === taskId ? { ...d, satisfied: true } : d
          )
          this.tasks.set(otherTask.id, {
            ...otherTask,
            dependencies: updatedDeps,
          })

          // Unblock if all dependencies satisfied
          const allSatisfied = updatedDeps
            .filter((d) => d.type === 'blocked_by')
            .every((d) => d.satisfied)
          if (allSatisfied && otherTask.status === 'blocked') {
            await this.update(otherTask.id, {
              status: 'queued',
              event: {
                type: 'unblocked',
                message: 'All dependencies satisfied',
              },
            })
          }
        }
      }
    }
  }

  async fail(taskId: string, error: string): Promise<void> {
    const task = await this.get(taskId)
    if (!task) return

    const event: Omit<TaskEvent, 'id' | 'timestamp'> = {
      type: 'failed',
      message: `Task failed: ${error}`,
      data: { error },
    }
    if (task.assignment?.worker !== undefined) {
      event.actor = task.assignment.worker
    }
    await this.update(taskId, {
      status: 'failed',
      event,
    })
  }

  async stats(): Promise<TaskQueueStats> {
    const tasks = Array.from(this.tasks.values())

    const byStatus: Record<TaskStatus, number> = {
      pending: 0,
      queued: 0,
      assigned: 0,
      in_progress: 0,
      blocked: 0,
      review: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    }

    const byPriority: Record<TaskPriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0,
      critical: 0,
    }

    let totalWaitTime = 0
    let waitTimeCount = 0
    let totalCompletionTime = 0
    let completionTimeCount = 0

    for (const task of tasks) {
      byStatus[task.status]++
      byPriority[task.priority]++

      if (task.startedAt && task.createdAt) {
        totalWaitTime += task.startedAt.getTime() - task.createdAt.getTime()
        waitTimeCount++
      }

      if (task.completedAt && task.startedAt) {
        totalCompletionTime += task.completedAt.getTime() - task.startedAt.getTime()
        completionTimeCount++
      }
    }

    const stats: TaskQueueStats = {
      total: tasks.length,
      byStatus,
      byPriority,
    }
    if (waitTimeCount > 0) {
      stats.avgWaitTime = totalWaitTime / waitTimeCount
    }
    if (completionTimeCount > 0) {
      stats.avgCompletionTime = totalCompletionTime / completionTimeCount
    }
    return stats
  }
}

/**
 * Global task queue instance
 */
export const taskQueue: TaskQueue = new InMemoryTaskQueue()

/**
 * Create a new task queue instance
 */
export function createTaskQueue(options?: TaskQueueOptions): TaskQueue {
  return new InMemoryTaskQueue(options)
}
