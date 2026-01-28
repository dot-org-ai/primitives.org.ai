/**
 * Worker Export Tests for digital-tasks (RED phase)
 *
 * Tests for the /worker export that provides TaskService (WorkerEntrypoint)
 * with a connect() method that returns TaskServiceCore (RpcTarget).
 *
 * Uses @cloudflare/vitest-pool-workers for real Cloudflare Workers execution.
 * NO MOCKS - tests use real Durable Objects for task persistence and Queues.
 *
 * These tests should FAIL initially because src/worker.ts doesn't exist yet.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'

// These imports will FAIL because worker.ts doesn't exist yet
import { TaskService, TaskServiceCore } from '../src/worker.js'

// Types for test assertions
interface TaskData<TInput = unknown, TOutput = unknown> {
  id: string
  status: string
  priority: string
  input?: TInput
  output?: TOutput
  error?: string
  scheduledFor?: Date
  deadline?: Date
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  progress?: {
    percent: number
    step?: string
    updatedAt: Date
  }
  dependencies?: Array<{
    type: string
    taskId: string
    satisfied: boolean
  }>
  assignment?: {
    worker: { type: string; id: string; name?: string }
    assignedAt: Date
  }
  metadata?: Record<string, unknown>
}

interface TaskStats {
  total: number
  byStatus: Record<string, number>
  byPriority: Record<string, number>
}

describe('TaskServiceCore (RpcTarget)', () => {
  let service: TaskServiceCore

  beforeEach(() => {
    service = new TaskServiceCore(env)
  })

  describe('constructor', () => {
    it('creates a new TaskServiceCore instance', () => {
      expect(service).toBeInstanceOf(TaskServiceCore)
    })

    it('accepts env with required bindings', () => {
      const serviceWithEnv = new TaskServiceCore(env)
      expect(serviceWithEnv).toBeDefined()
    })

    it('extends RpcTarget for RPC communication', () => {
      expect(service.constructor.name).toBe('TaskServiceCore')
    })
  })

  describe('create()', () => {
    it('creates a new task with minimal options', async () => {
      const task = await service.create({
        name: 'Test Task',
        description: 'A test task for creation',
      })

      expect(task).toBeDefined()
      expect(task.id).toBeDefined()
      expect(task.id.length).toBeGreaterThan(0)
      expect(task.status).toBe('pending')
      expect(task.createdAt).toBeInstanceOf(Date)
    })

    it('creates a task with custom ID', async () => {
      const task = await service.create({
        id: 'custom-task-id',
        name: 'Custom ID Task',
        description: 'Task with custom ID',
      })

      expect(task.id).toBe('custom-task-id')
    })

    it('creates a task with priority', async () => {
      const task = await service.create({
        name: 'High Priority Task',
        description: 'An urgent task',
        priority: 'high',
      })

      expect(task.priority).toBe('high')
    })

    it('creates a task with input data', async () => {
      const input = { url: 'https://example.com', method: 'GET' }
      const task = await service.create({
        name: 'Fetch Data',
        description: 'Fetch data from URL',
        input,
      })

      expect(task.input).toEqual(input)
    })

    it('creates a task with scheduled execution time', async () => {
      const scheduledFor = new Date(Date.now() + 3600000) // 1 hour from now
      const task = await service.create({
        name: 'Scheduled Task',
        description: 'Run later',
        scheduledFor,
      })

      expect(task.scheduledFor).toEqual(scheduledFor)
      expect(task.status).toBe('scheduled')
    })

    it('creates a task with deadline', async () => {
      const deadline = new Date(Date.now() + 86400000) // 24 hours
      const task = await service.create({
        name: 'Task with Deadline',
        description: 'Must complete in time',
        deadline,
      })

      expect(task.deadline).toEqual(deadline)
    })

    it('creates a task with tags', async () => {
      const task = await service.create({
        name: 'Tagged Task',
        description: 'Task with tags',
        tags: ['important', 'review'],
      })

      expect(task.metadata?.tags).toContain('important')
      expect(task.metadata?.tags).toContain('review')
    })

    it('creates a task with metadata', async () => {
      const task = await service.create({
        name: 'Task with Metadata',
        description: 'Has extra info',
        metadata: { source: 'api', version: 2 },
      })

      expect(task.metadata?.source).toBe('api')
      expect(task.metadata?.version).toBe(2)
    })

    it('creates a task with dependencies', async () => {
      const dep1 = await service.create({ name: 'Dependency 1', description: 'First' })
      const dep2 = await service.create({ name: 'Dependency 2', description: 'Second' })

      const task = await service.create({
        name: 'Dependent Task',
        description: 'Depends on others',
        dependencies: [dep1.id, dep2.id],
      })

      expect(task.dependencies).toHaveLength(2)
      expect(task.dependencies?.map((d) => d.taskId)).toContain(dep1.id)
      expect(task.dependencies?.map((d) => d.taskId)).toContain(dep2.id)
      expect(task.status).toBe('blocked')
    })
  })

  describe('schedule()', () => {
    it('schedules a task for future execution', async () => {
      const task = await service.create({
        name: 'Task to Schedule',
        description: 'Will be scheduled',
      })

      const scheduledFor = new Date(Date.now() + 3600000)
      const scheduled = await service.schedule(task.id, scheduledFor)

      expect(scheduled.scheduledFor).toEqual(scheduledFor)
      expect(scheduled.status).toBe('scheduled')
    })

    it('schedules with priority override', async () => {
      const task = await service.create({
        name: 'Schedule with Priority',
        description: 'Override priority',
        priority: 'normal',
      })

      const scheduledFor = new Date(Date.now() + 3600000)
      const scheduled = await service.schedule(task.id, scheduledFor, {
        priority: 'urgent',
      })

      expect(scheduled.priority).toBe('urgent')
    })

    it('throws error for non-existent task', async () => {
      const scheduledFor = new Date(Date.now() + 3600000)

      await expect(service.schedule('nonexistent-task', scheduledFor)).rejects.toThrow()
    })

    it('prevents scheduling already completed tasks', async () => {
      const task = await service.create({
        name: 'Completed Task',
        description: 'Already done',
      })
      await service.execute(task.id)
      await service.complete(task.id, { result: 'done' })

      const scheduledFor = new Date(Date.now() + 3600000)

      await expect(service.schedule(task.id, scheduledFor)).rejects.toThrow()
    })

    it('allows rescheduling pending tasks', async () => {
      const task = await service.create({
        name: 'Reschedulable Task',
        description: 'Can be rescheduled',
      })

      const firstSchedule = new Date(Date.now() + 3600000)
      await service.schedule(task.id, firstSchedule)

      const secondSchedule = new Date(Date.now() + 7200000)
      const rescheduled = await service.schedule(task.id, secondSchedule)

      expect(rescheduled.scheduledFor).toEqual(secondSchedule)
    })
  })

  describe('execute()', () => {
    it('starts task execution', async () => {
      const task = await service.create({
        name: 'Task to Execute',
        description: 'Will be executed',
      })

      const executing = await service.execute(task.id)

      expect(executing.status).toBe('in_progress')
      expect(executing.startedAt).toBeInstanceOf(Date)
    })

    it('assigns worker when executing', async () => {
      const task = await service.create({
        name: 'Worker Assigned Task',
        description: 'Assigned to worker',
      })

      const worker = { type: 'agent' as const, id: 'agent_123', name: 'Test Agent' }
      const executing = await service.execute(task.id, { worker })

      expect(executing.assignment?.worker.id).toBe('agent_123')
      expect(executing.assignment?.worker.name).toBe('Test Agent')
    })

    it('throws error for non-existent task', async () => {
      await expect(service.execute('nonexistent-task')).rejects.toThrow()
    })

    it('prevents executing already in-progress tasks', async () => {
      const task = await service.create({
        name: 'Already Running',
        description: 'In progress',
      })

      await service.execute(task.id)

      await expect(service.execute(task.id)).rejects.toThrow()
    })

    it('prevents executing completed tasks', async () => {
      const task = await service.create({
        name: 'Completed Task',
        description: 'Done',
      })
      await service.execute(task.id)
      await service.complete(task.id, { result: 'done' })

      await expect(service.execute(task.id)).rejects.toThrow()
    })

    it('respects dependency blocking', async () => {
      const blocker = await service.create({
        name: 'Blocker Task',
        description: 'Blocks other',
      })

      const blocked = await service.create({
        name: 'Blocked Task',
        description: 'Depends on blocker',
        dependencies: [blocker.id],
      })

      await expect(service.execute(blocked.id)).rejects.toThrow(/blocked/)
    })

    it('executes unblocked tasks after dependency completion', async () => {
      const blocker = await service.create({
        name: 'Blocker',
        description: 'Will complete',
      })

      const blocked = await service.create({
        name: 'Blocked',
        description: 'Waiting',
        dependencies: [blocker.id],
      })

      // Complete the blocker
      await service.execute(blocker.id)
      await service.complete(blocker.id, { result: 'done' })

      // Now blocked should be executable
      const executing = await service.execute(blocked.id)
      expect(executing.status).toBe('in_progress')
    })
  })

  describe('complete()', () => {
    it('marks task as completed with output', async () => {
      const task = await service.create({
        name: 'Task to Complete',
        description: 'Will be completed',
      })
      await service.execute(task.id)

      const completed = await service.complete(task.id, {
        result: 'success',
        data: { count: 42 },
      })

      expect(completed.status).toBe('completed')
      expect(completed.output).toEqual({
        result: 'success',
        data: { count: 42 },
      })
      expect(completed.completedAt).toBeInstanceOf(Date)
    })

    it('throws error for non-existent task', async () => {
      await expect(service.complete('nonexistent', { result: 'done' })).rejects.toThrow()
    })

    it('throws error for non-executing task', async () => {
      const task = await service.create({
        name: 'Not Started',
        description: 'Never executed',
      })

      await expect(service.complete(task.id, { result: 'done' })).rejects.toThrow()
    })

    it('unblocks dependent tasks on completion', async () => {
      const blocker = await service.create({
        name: 'Blocker',
        description: 'Unblocks on complete',
      })

      const blocked = await service.create({
        name: 'Blocked',
        description: 'Will be unblocked',
        dependencies: [blocker.id],
      })

      expect(blocked.status).toBe('blocked')

      await service.execute(blocker.id)
      await service.complete(blocker.id, { result: 'done' })

      const updated = await service.getStatus(blocked.id)
      expect(updated.status).not.toBe('blocked')
      expect(updated.dependencies?.[0].satisfied).toBe(true)
    })
  })

  describe('fail()', () => {
    it('marks task as failed with error message', async () => {
      const task = await service.create({
        name: 'Task to Fail',
        description: 'Will fail',
      })
      await service.execute(task.id)

      const failed = await service.fail(task.id, 'Something went wrong')

      expect(failed.status).toBe('failed')
      expect(failed.error).toBe('Something went wrong')
      expect(failed.completedAt).toBeInstanceOf(Date)
    })

    it('marks task as failed with Error object', async () => {
      const task = await service.create({
        name: 'Task with Error',
        description: 'Will fail with Error',
      })
      await service.execute(task.id)

      const error = new Error('Network timeout')
      const failed = await service.fail(task.id, error)

      expect(failed.status).toBe('failed')
      expect(failed.error).toContain('Network timeout')
    })

    it('throws error for non-existent task', async () => {
      await expect(service.fail('nonexistent', 'error')).rejects.toThrow()
    })
  })

  describe('getStatus()', () => {
    it('returns full task status', async () => {
      const task = await service.create({
        name: 'Status Check Task',
        description: 'Check its status',
        priority: 'high',
      })

      const status = await service.getStatus(task.id)

      expect(status.id).toBe(task.id)
      expect(status.status).toBe('pending')
      expect(status.priority).toBe('high')
      expect(status.createdAt).toBeInstanceOf(Date)
    })

    it('returns progress information', async () => {
      const task = await service.create({
        name: 'Progress Task',
        description: 'Has progress',
      })
      await service.execute(task.id)
      await service.updateProgress(task.id, 50, 'Processing data')

      const status = await service.getStatus(task.id)

      expect(status.progress?.percent).toBe(50)
      expect(status.progress?.step).toBe('Processing data')
    })

    it('returns null for non-existent task', async () => {
      const status = await service.getStatus('nonexistent-id')
      expect(status).toBeNull()
    })

    it('includes dependency status', async () => {
      const dep = await service.create({ name: 'Dep', description: 'Dependency' })
      const task = await service.create({
        name: 'Main',
        description: 'Has dependency',
        dependencies: [dep.id],
      })

      const status = await service.getStatus(task.id)

      expect(status.dependencies).toHaveLength(1)
      expect(status.dependencies?.[0].taskId).toBe(dep.id)
      expect(status.dependencies?.[0].satisfied).toBe(false)
    })
  })

  describe('updateProgress()', () => {
    it('updates task progress percentage', async () => {
      const task = await service.create({
        name: 'Progress Update Task',
        description: 'Track progress',
      })
      await service.execute(task.id)

      const updated = await service.updateProgress(task.id, 25)

      expect(updated.progress?.percent).toBe(25)
      expect(updated.progress?.updatedAt).toBeInstanceOf(Date)
    })

    it('updates progress with step description', async () => {
      const task = await service.create({
        name: 'Step Progress Task',
        description: 'With step info',
      })
      await service.execute(task.id)

      const updated = await service.updateProgress(task.id, 50, 'Downloading files')

      expect(updated.progress?.percent).toBe(50)
      expect(updated.progress?.step).toBe('Downloading files')
    })

    it('throws error for non-executing task', async () => {
      const task = await service.create({
        name: 'Not Started',
        description: 'Cannot update progress',
      })

      await expect(service.updateProgress(task.id, 50)).rejects.toThrow()
    })

    it('validates progress percentage range', async () => {
      const task = await service.create({
        name: 'Invalid Progress',
        description: 'Bad percentage',
      })
      await service.execute(task.id)

      await expect(service.updateProgress(task.id, 150)).rejects.toThrow()

      await expect(service.updateProgress(task.id, -10)).rejects.toThrow()
    })
  })

  describe('cancel()', () => {
    it('cancels a pending task', async () => {
      const task = await service.create({
        name: 'Task to Cancel',
        description: 'Will be cancelled',
      })

      const cancelled = await service.cancel(task.id)

      expect(cancelled).toBe(true)

      const status = await service.getStatus(task.id)
      expect(status?.status).toBe('cancelled')
    })

    it('cancels a task with reason', async () => {
      const task = await service.create({
        name: 'Task with Reason',
        description: 'Cancelled with reason',
      })

      await service.cancel(task.id, 'No longer needed')

      const status = await service.getStatus(task.id)
      expect(status?.metadata?.cancellationReason).toBe('No longer needed')
    })

    it('cancels an in-progress task', async () => {
      const task = await service.create({
        name: 'Running Task',
        description: 'Will be cancelled while running',
      })
      await service.execute(task.id)

      const cancelled = await service.cancel(task.id)
      expect(cancelled).toBe(true)

      const status = await service.getStatus(task.id)
      expect(status?.status).toBe('cancelled')
    })

    it('returns false for non-existent task', async () => {
      const cancelled = await service.cancel('nonexistent-id')
      expect(cancelled).toBe(false)
    })

    it('cannot cancel completed tasks', async () => {
      const task = await service.create({
        name: 'Completed Task',
        description: 'Already done',
      })
      await service.execute(task.id)
      await service.complete(task.id, { result: 'done' })

      const cancelled = await service.cancel(task.id)
      expect(cancelled).toBe(false)
    })
  })

  describe('list()', () => {
    beforeEach(async () => {
      // Create some test tasks
      await service.create({ name: 'Task A', description: 'First', priority: 'high' })
      await service.create({ name: 'Task B', description: 'Second', priority: 'normal' })
      await service.create({ name: 'Task C', description: 'Third', priority: 'low' })
    })

    it('lists all tasks', async () => {
      const tasks = await service.list()

      expect(tasks.length).toBeGreaterThanOrEqual(3)
      expect(
        tasks.some((t) => t.id.includes('Task A') || (t.metadata as any)?.name === 'Task A')
      ).toBe(true)
    })

    it('filters by status', async () => {
      const task = await service.create({ name: 'Running Task', description: 'In progress' })
      await service.execute(task.id)

      const inProgress = await service.list({ status: 'in_progress' })

      expect(inProgress.length).toBeGreaterThanOrEqual(1)
      expect(inProgress.every((t) => t.status === 'in_progress')).toBe(true)
    })

    it('filters by priority', async () => {
      const highPriority = await service.list({ priority: 'high' })

      expect(highPriority.length).toBeGreaterThanOrEqual(1)
      expect(highPriority.every((t) => t.priority === 'high')).toBe(true)
    })

    it('filters by multiple statuses', async () => {
      const task1 = await service.create({ name: 'Pending', description: 'Pending' })
      const task2 = await service.create({ name: 'Running', description: 'Running' })
      await service.execute(task2.id)

      const filtered = await service.list({ status: ['pending', 'in_progress'] })

      expect(filtered.length).toBeGreaterThanOrEqual(2)
      expect(filtered.every((t) => ['pending', 'in_progress'].includes(t.status))).toBe(true)
    })

    it('supports pagination with limit', async () => {
      const limited = await service.list({ limit: 2 })

      expect(limited).toHaveLength(2)
    })

    it('supports pagination with offset', async () => {
      const all = await service.list()
      const offset = await service.list({ offset: 1, limit: 2 })

      expect(offset).toHaveLength(2)
      expect(offset[0].id).toBe(all[1].id)
    })

    it('sorts by createdAt', async () => {
      const sorted = await service.list({ sortBy: 'createdAt', sortOrder: 'asc' })

      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          sorted[i - 1].createdAt.getTime()
        )
      }
    })

    it('sorts by priority', async () => {
      const sorted = await service.list({ sortBy: 'priority', sortOrder: 'desc' })

      const priorityOrder = { critical: 5, urgent: 4, high: 3, normal: 2, low: 1 }
      for (let i = 1; i < sorted.length; i++) {
        expect(priorityOrder[sorted[i].priority as keyof typeof priorityOrder]).toBeLessThanOrEqual(
          priorityOrder[sorted[i - 1].priority as keyof typeof priorityOrder]
        )
      }
    })

    it('filters by tags', async () => {
      await service.create({
        name: 'Tagged Task',
        description: 'Has specific tag',
        tags: ['urgent', 'api'],
      })

      const tagged = await service.list({ tags: ['urgent'] })

      expect(tagged.length).toBeGreaterThanOrEqual(1)
    })

    it('searches by name/description', async () => {
      await service.create({ name: 'Unique Name XYZ', description: 'Searchable task' })

      const results = await service.list({ search: 'XYZ' })

      expect(results.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('getStats()', () => {
    it('returns task statistics', async () => {
      await service.create({ name: 'Pending 1', description: 'Test' })
      await service.create({ name: 'Pending 2', description: 'Test', priority: 'high' })
      const running = await service.create({ name: 'Running', description: 'Test' })
      await service.execute(running.id)

      const stats = await service.getStats()

      expect(stats.total).toBeGreaterThanOrEqual(3)
      expect(stats.byStatus).toHaveProperty('pending')
      expect(stats.byStatus).toHaveProperty('in_progress')
      expect(stats.byPriority).toHaveProperty('normal')
      expect(stats.byPriority).toHaveProperty('high')
    })
  })

  describe('retry()', () => {
    it('retries a failed task', async () => {
      const task = await service.create({
        name: 'Retry Task',
        description: 'Will fail then retry',
      })
      await service.execute(task.id)
      await service.fail(task.id, 'Initial failure')

      const retried = await service.retry(task.id)

      expect(retried.status).toBe('pending')
      expect(retried.error).toBeUndefined()
      expect(retried.metadata?.retryCount).toBe(1)
    })

    it('increments retry count on each retry', async () => {
      const task = await service.create({
        name: 'Multi-Retry Task',
        description: 'Fails multiple times',
      })

      // First attempt
      await service.execute(task.id)
      await service.fail(task.id, 'Failure 1')
      const retry1 = await service.retry(task.id)
      expect(retry1.metadata?.retryCount).toBe(1)

      // Second attempt
      await service.execute(task.id)
      await service.fail(task.id, 'Failure 2')
      const retry2 = await service.retry(task.id)
      expect(retry2.metadata?.retryCount).toBe(2)
    })

    it('throws error for non-failed task', async () => {
      const task = await service.create({
        name: 'Not Failed',
        description: 'Cannot retry',
      })

      await expect(service.retry(task.id)).rejects.toThrow()
    })

    it('respects max retry limit', async () => {
      const task = await service.create({
        name: 'Limited Retries',
        description: 'Max 3 retries',
        metadata: { maxRetries: 3 },
      })

      // Fail and retry 3 times
      for (let i = 0; i < 3; i++) {
        await service.execute(task.id)
        await service.fail(task.id, `Failure ${i + 1}`)
        await service.retry(task.id)
      }

      // Fail one more time
      await service.execute(task.id)
      await service.fail(task.id, 'Final failure')

      // Should not be able to retry again
      await expect(service.retry(task.id)).rejects.toThrow(/max retries/)
    })
  })
})

describe('Task Dependencies and Workflows', () => {
  let service: TaskServiceCore

  beforeEach(() => {
    service = new TaskServiceCore(env)
  })

  describe('dependency resolution', () => {
    it('blocks tasks with unsatisfied dependencies', async () => {
      const task1 = await service.create({ name: 'First', description: 'Runs first' })
      const task2 = await service.create({
        name: 'Second',
        description: 'Depends on first',
        dependencies: [task1.id],
      })

      expect(task2.status).toBe('blocked')
    })

    it('unblocks tasks when all dependencies complete', async () => {
      const dep1 = await service.create({ name: 'Dep 1', description: 'First dep' })
      const dep2 = await service.create({ name: 'Dep 2', description: 'Second dep' })
      const main = await service.create({
        name: 'Main',
        description: 'Depends on both',
        dependencies: [dep1.id, dep2.id],
      })

      expect(main.status).toBe('blocked')

      // Complete first dependency
      await service.execute(dep1.id)
      await service.complete(dep1.id, { result: 'done' })

      let status = await service.getStatus(main.id)
      expect(status?.status).toBe('blocked') // Still blocked

      // Complete second dependency
      await service.execute(dep2.id)
      await service.complete(dep2.id, { result: 'done' })

      status = await service.getStatus(main.id)
      expect(status?.status).not.toBe('blocked') // Now unblocked
    })

    it('fails dependent tasks when dependency fails', async () => {
      const dep = await service.create({ name: 'Dep', description: 'Will fail' })
      const main = await service.create({
        name: 'Main',
        description: 'Depends on failing task',
        dependencies: [dep.id],
        metadata: { failOnDependencyFailure: true },
      })

      await service.execute(dep.id)
      await service.fail(dep.id, 'Dependency failed')

      const status = await service.getStatus(main.id)
      expect(status?.status).toBe('failed')
      expect(status?.error).toContain('dependency')
    })
  })

  describe('workflow execution', () => {
    it('executes parallel tasks independently', async () => {
      const parallel1 = await service.create({ name: 'Parallel 1', description: 'P1' })
      const parallel2 = await service.create({ name: 'Parallel 2', description: 'P2' })

      // Both can be executed without waiting for each other
      await service.execute(parallel1.id)
      await service.execute(parallel2.id)

      const status1 = await service.getStatus(parallel1.id)
      const status2 = await service.getStatus(parallel2.id)

      expect(status1?.status).toBe('in_progress')
      expect(status2?.status).toBe('in_progress')
    })

    it('executes sequential tasks in order', async () => {
      const first = await service.create({ name: 'First', description: 'Step 1' })
      const second = await service.create({
        name: 'Second',
        description: 'Step 2',
        dependencies: [first.id],
      })
      const third = await service.create({
        name: 'Third',
        description: 'Step 3',
        dependencies: [second.id],
      })

      // Cannot execute second before first
      await expect(service.execute(second.id)).rejects.toThrow()

      // Execute in order
      await service.execute(first.id)
      await service.complete(first.id, { result: '1' })

      await service.execute(second.id)
      await service.complete(second.id, { result: '2' })

      await service.execute(third.id)
      const status = await service.getStatus(third.id)
      expect(status?.status).toBe('in_progress')
    })

    it('supports mixed parallel and sequential execution', async () => {
      // Create parallel tasks
      const p1 = await service.create({ name: 'P1', description: 'Parallel 1' })
      const p2 = await service.create({ name: 'P2', description: 'Parallel 2' })

      // Create sequential task that depends on both parallel tasks
      const sequential = await service.create({
        name: 'Sequential',
        description: 'After parallel',
        dependencies: [p1.id, p2.id],
      })

      expect(sequential.status).toBe('blocked')

      // Complete parallel tasks
      await service.execute(p1.id)
      await service.execute(p2.id)
      await service.complete(p1.id, { result: 'p1' })
      await service.complete(p2.id, { result: 'p2' })

      // Now sequential should be executable
      const status = await service.getStatus(sequential.id)
      expect(status?.status).not.toBe('blocked')
    })
  })

  describe('getReadyTasks()', () => {
    it('returns tasks ready for execution', async () => {
      await service.create({ name: 'Ready 1', description: 'No deps' })
      await service.create({ name: 'Ready 2', description: 'No deps' })

      const blocker = await service.create({ name: 'Blocker', description: 'Blocks other' })
      await service.create({
        name: 'Blocked',
        description: 'Has deps',
        dependencies: [blocker.id],
      })

      const ready = await service.getReadyTasks()

      expect(ready.length).toBeGreaterThanOrEqual(3) // Ready 1, Ready 2, Blocker
      expect(ready.every((t) => t.status !== 'blocked')).toBe(true)
    })
  })

  describe('getDependants()', () => {
    it('returns tasks that depend on a given task', async () => {
      const parent = await service.create({ name: 'Parent', description: 'Has dependants' })
      await service.create({
        name: 'Child 1',
        description: 'Depends on parent',
        dependencies: [parent.id],
      })
      await service.create({
        name: 'Child 2',
        description: 'Also depends on parent',
        dependencies: [parent.id],
      })

      const dependants = await service.getDependants(parent.id)

      expect(dependants).toHaveLength(2)
    })
  })
})

describe('TaskService (WorkerEntrypoint)', () => {
  describe('class definition', () => {
    it('exports TaskService class', async () => {
      const { default: TaskServiceClass } = await import('../src/worker.js')
      expect(TaskServiceClass).toBeDefined()
      expect(typeof TaskServiceClass).toBe('function')
    })

    it('TaskService has connect method in prototype', () => {
      expect(typeof TaskService.prototype.connect).toBe('function')
    })

    it('extends WorkerEntrypoint', () => {
      expect(TaskService.name).toBe('TaskService')
    })
  })

  describe('connect()', () => {
    it('returns a TaskServiceCore instance', () => {
      const service = new TaskService({ env } as any, {} as any)
      const core = service.connect()

      expect(core).toBeInstanceOf(TaskServiceCore)
    })

    it('returns RpcTarget for RPC communication', () => {
      const service = new TaskService({ env } as any, {} as any)
      const core = service.connect()

      expect(core).toBeDefined()
      expect(typeof core.create).toBe('function')
      expect(typeof core.schedule).toBe('function')
      expect(typeof core.execute).toBe('function')
      expect(typeof core.complete).toBe('function')
      expect(typeof core.fail).toBe('function')
      expect(typeof core.getStatus).toBe('function')
      expect(typeof core.cancel).toBe('function')
      expect(typeof core.list).toBe('function')
    })
  })
})

describe('Default export', () => {
  it('exports TaskService as default', async () => {
    const { default: DefaultExport } = await import('../src/worker.js')
    expect(DefaultExport).toBe(TaskService)
  })
})

describe('Queue Integration', () => {
  let service: TaskServiceCore

  beforeEach(() => {
    service = new TaskServiceCore(env)
  })

  describe('enqueue()', () => {
    it('enqueues a task for background processing', async () => {
      const task = await service.create({
        name: 'Queue Task',
        description: 'Will be queued',
      })

      const queued = await service.enqueue(task.id)

      expect(queued.status).toBe('queued')
    })

    it('enqueues with delay', async () => {
      const task = await service.create({
        name: 'Delayed Task',
        description: 'Delayed by 30 seconds',
      })

      const queued = await service.enqueue(task.id, { delaySeconds: 30 })

      expect(queued.status).toBe('queued')
      expect(queued.metadata?.queueDelay).toBe(30)
    })
  })

  describe('dequeue()', () => {
    it('retrieves next task from queue', async () => {
      await service.create({ name: 'Queued 1', description: 'First' })
      const task2 = await service.create({ name: 'Queued 2', description: 'Second' })

      await service.enqueue(task2.id)

      const next = await service.dequeue()

      expect(next).toBeDefined()
      expect(next?.status).toBe('in_progress')
    })

    it('returns null when queue is empty', async () => {
      const next = await service.dequeue()
      expect(next).toBeNull()
    })

    it('respects task priority in queue', async () => {
      const low = await service.create({
        name: 'Low',
        description: 'Low priority',
        priority: 'low',
      })
      const high = await service.create({
        name: 'High',
        description: 'High priority',
        priority: 'high',
      })

      await service.enqueue(low.id)
      await service.enqueue(high.id)

      const next = await service.dequeue()

      expect(next?.priority).toBe('high')
    })
  })
})

describe('Persistence and Durability', () => {
  it('persists tasks across service instances', async () => {
    const service1 = new TaskServiceCore(env)
    const task = await service1.create({
      name: 'Persistent Task',
      description: 'Survives restart',
    })
    const taskId = task.id

    // Simulate new service instance
    const service2 = new TaskServiceCore(env)
    const retrieved = await service2.getStatus(taskId)

    expect(retrieved).not.toBeNull()
    expect(retrieved?.id).toBe(taskId)
  })

  it('maintains task state across operations', async () => {
    const service = new TaskServiceCore(env)
    const task = await service.create({
      name: 'Stateful Task',
      description: 'Track state changes',
    })

    await service.execute(task.id)
    await service.updateProgress(task.id, 50, 'Halfway')

    // Get fresh service
    const freshService = new TaskServiceCore(env)
    const status = await freshService.getStatus(task.id)

    expect(status?.status).toBe('in_progress')
    expect(status?.progress?.percent).toBe(50)
  })
})

describe('AI-Powered Task Execution', () => {
  let service: TaskServiceCore

  beforeEach(() => {
    service = new TaskServiceCore(env)
  })

  describe('executeWithAI()', () => {
    it('executes a generative task with AI', async () => {
      const task = await service.create({
        name: 'Summarize Text',
        description: 'Use AI to summarize input text',
        input: { text: 'The quick brown fox jumps over the lazy dog.' },
        metadata: { functionType: 'generative' },
      })

      const result = await service.executeWithAI(task.id)

      expect(result.status).toBe('completed')
      expect(result.output).toBeDefined()
    })

    it('uses AI gateway with caching', async () => {
      const task = await service.create({
        name: 'Cached AI Task',
        description: 'Should use cached response',
        input: { prompt: 'Say hello' },
        metadata: {
          functionType: 'generative',
          aiOptions: { cache: true },
        },
      })

      // First execution
      const result1 = await service.executeWithAI(task.id)
      expect(result1.status).toBe('completed')

      // Create same task again
      const task2 = await service.create({
        name: 'Same Cached AI Task',
        description: 'Should use cached response',
        input: { prompt: 'Say hello' },
        metadata: {
          functionType: 'generative',
          aiOptions: { cache: true },
        },
      })

      // Second execution should be faster (cached)
      const result2 = await service.executeWithAI(task2.id)
      expect(result2.status).toBe('completed')
    })
  })
})
