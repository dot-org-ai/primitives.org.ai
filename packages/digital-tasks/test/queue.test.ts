import { describe, it, expect, beforeEach } from 'vitest'
import { createTaskQueue, createTask } from '../src/index.js'
import type { FunctionDefinition, WorkerRef, AnyTask, TaskQueue } from '../src/index.js'

describe('TaskQueue', () => {
  let queue: TaskQueue

  const createTestFunc = (name: string): FunctionDefinition => ({
    type: 'generative',
    name,
    args: {},
    output: 'string',
  })

  beforeEach(() => {
    queue = createTaskQueue({ name: 'test-queue' })
  })

  describe('add() and get()', () => {
    it('should add and retrieve a task', async () => {
      const task: AnyTask = {
        id: 'test_task_1',
        function: createTestFunc('test'),
        status: 'queued',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)
      const retrieved = await queue.get('test_task_1')

      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe('test_task_1')
      expect(retrieved!.events?.length).toBeGreaterThan(0) // Should have 'created' event
    })

    it('should return undefined for non-existent task', async () => {
      const result = await queue.get('non_existent')
      expect(result).toBeUndefined()
    })
  })

  describe('update()', () => {
    it('should update task status', async () => {
      const task: AnyTask = {
        id: 'update_test',
        function: createTestFunc('update'),
        status: 'queued',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)
      const updated = await queue.update('update_test', { status: 'in_progress' })

      expect(updated).toBeDefined()
      expect(updated!.status).toBe('in_progress')
    })

    it('should update task priority', async () => {
      const task: AnyTask = {
        id: 'priority_test',
        function: createTestFunc('priority'),
        status: 'queued',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)
      const updated = await queue.update('priority_test', { priority: 'urgent' })

      expect(updated!.priority).toBe('urgent')
    })

    it('should update task progress', async () => {
      const task: AnyTask = {
        id: 'progress_test',
        function: createTestFunc('progress'),
        status: 'in_progress',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)
      const updated = await queue.update('progress_test', {
        progress: { percent: 50, step: 'Processing' },
      })

      expect(updated!.progress?.percent).toBe(50)
      expect(updated!.progress?.step).toBe('Processing')
      expect(updated!.progress?.updatedAt).toBeInstanceOf(Date)
    })

    it('should add events to task history', async () => {
      const task: AnyTask = {
        id: 'event_test',
        function: createTestFunc('event'),
        status: 'queued',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)
      await queue.update('event_test', {
        event: {
          type: 'comment',
          message: 'Test comment',
        },
      })

      const updated = await queue.get('event_test')
      const commentEvent = updated!.events?.find(e => e.type === 'comment')
      expect(commentEvent).toBeDefined()
      expect(commentEvent!.message).toBe('Test comment')
    })

    it('should return undefined for non-existent task', async () => {
      const result = await queue.update('non_existent', { status: 'completed' })
      expect(result).toBeUndefined()
    })
  })

  describe('remove()', () => {
    it('should remove a task', async () => {
      const task: AnyTask = {
        id: 'remove_test',
        function: createTestFunc('remove'),
        status: 'queued',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)
      const removed = await queue.remove('remove_test')
      expect(removed).toBe(true)

      const retrieved = await queue.get('remove_test')
      expect(retrieved).toBeUndefined()
    })

    it('should return false for non-existent task', async () => {
      const result = await queue.remove('non_existent')
      expect(result).toBe(false)
    })
  })

  describe('query()', () => {
    beforeEach(async () => {
      // Add test tasks
      const tasks: AnyTask[] = [
        {
          id: 'query_1',
          function: createTestFunc('task1'),
          status: 'queued',
          priority: 'high',
          tags: ['frontend'],
          projectId: 'proj_1',
          createdAt: new Date('2024-01-01'),
          events: [],
        },
        {
          id: 'query_2',
          function: createTestFunc('task2'),
          status: 'in_progress',
          priority: 'normal',
          tags: ['backend'],
          projectId: 'proj_1',
          createdAt: new Date('2024-01-02'),
          events: [],
        },
        {
          id: 'query_3',
          function: createTestFunc('task3'),
          status: 'completed',
          priority: 'low',
          tags: ['frontend', 'ui'],
          projectId: 'proj_2',
          createdAt: new Date('2024-01-03'),
          events: [],
        },
      ]

      for (const task of tasks) {
        await queue.add(task)
      }
    })

    it('should filter by status', async () => {
      const results = await queue.query({ status: 'queued' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('query_1')
    })

    it('should filter by multiple statuses', async () => {
      const results = await queue.query({ status: ['queued', 'in_progress'] })
      expect(results).toHaveLength(2)
    })

    it('should filter by priority', async () => {
      const results = await queue.query({ priority: 'high' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('query_1')
    })

    it('should filter by tags', async () => {
      const results = await queue.query({ tags: ['frontend'] })
      expect(results).toHaveLength(2)
    })

    it('should filter by projectId', async () => {
      const results = await queue.query({ projectId: 'proj_1' })
      expect(results).toHaveLength(2)
    })

    it('should sort by priority descending', async () => {
      const results = await queue.query({ sortBy: 'priority', sortOrder: 'desc' })
      expect(results[0].priority).toBe('high')
      expect(results[results.length - 1].priority).toBe('low')
    })

    it('should sort by createdAt ascending', async () => {
      const results = await queue.query({ sortBy: 'createdAt', sortOrder: 'asc' })
      expect(results[0].id).toBe('query_1')
      expect(results[2].id).toBe('query_3')
    })

    it('should support pagination', async () => {
      const page1 = await queue.query({ limit: 2, offset: 0 })
      expect(page1).toHaveLength(2)

      const page2 = await queue.query({ limit: 2, offset: 2 })
      expect(page2).toHaveLength(1)
    })

    it('should search by name', async () => {
      const results = await queue.query({ search: 'task2' })
      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('query_2')
    })
  })

  describe('getNextForWorker()', () => {
    it('should return highest priority available task', async () => {
      const tasks: AnyTask[] = [
        {
          id: 'next_1',
          function: createTestFunc('low'),
          status: 'queued',
          priority: 'low',
          createdAt: new Date(),
          events: [],
        },
        {
          id: 'next_2',
          function: createTestFunc('high'),
          status: 'queued',
          priority: 'high',
          createdAt: new Date(),
          events: [],
        },
      ]

      for (const task of tasks) {
        await queue.add(task)
      }

      const worker: WorkerRef = { type: 'agent', id: 'agent_1' }
      const next = await queue.getNextForWorker(worker)

      expect(next).toBeDefined()
      expect(next!.id).toBe('next_2') // Higher priority
    })

    it('should respect allowedWorkers', async () => {
      const task: AnyTask = {
        id: 'worker_type_test',
        function: { type: 'human', name: 'human-task', args: {}, output: 'object', instructions: 'Do something' },
        status: 'queued',
        priority: 'high',
        allowedWorkers: ['human'],
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)

      const agentWorker: WorkerRef = { type: 'agent', id: 'agent_1' }
      const agentNext = await queue.getNextForWorker(agentWorker)
      expect(agentNext).toBeUndefined()

      const humanWorker: WorkerRef = { type: 'human', id: 'human_1' }
      const humanNext = await queue.getNextForWorker(humanWorker)
      expect(humanNext).toBeDefined()
      expect(humanNext!.id).toBe('worker_type_test')
    })

    it('should skip scheduled tasks not yet due', async () => {
      const futureDate = new Date(Date.now() + 60000) // 1 minute in future
      const task: AnyTask = {
        id: 'scheduled_test',
        function: createTestFunc('scheduled'),
        status: 'pending',
        priority: 'high',
        scheduledFor: futureDate,
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)

      const worker: WorkerRef = { type: 'agent', id: 'agent_1' }
      const next = await queue.getNextForWorker(worker)
      expect(next).toBeUndefined()
    })

    it('should skip blocked tasks', async () => {
      const task: AnyTask = {
        id: 'blocked_test',
        function: createTestFunc('blocked'),
        status: 'queued',
        priority: 'high',
        dependencies: [{ type: 'blocked_by', taskId: 'other_task', satisfied: false }],
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)

      const worker: WorkerRef = { type: 'agent', id: 'agent_1' }
      const next = await queue.getNextForWorker(worker)
      expect(next).toBeUndefined()
    })
  })

  describe('claim()', () => {
    it('should claim a task and assign it to worker', async () => {
      const task: AnyTask = {
        id: 'claim_test',
        function: createTestFunc('claim'),
        status: 'queued',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)

      const worker: WorkerRef = { type: 'agent', id: 'agent_1', name: 'Agent 1' }
      const claimed = await queue.claim('claim_test', worker)

      expect(claimed).toBe(true)

      const updated = await queue.get('claim_test')
      expect(updated!.status).toBe('assigned')
      expect(updated!.assignment?.worker).toEqual(worker)
    })

    it('should not claim already assigned task', async () => {
      const task: AnyTask = {
        id: 'claim_assigned',
        function: createTestFunc('claim'),
        status: 'assigned',
        priority: 'normal',
        assignment: {
          worker: { type: 'agent', id: 'other_agent' },
          assignedAt: new Date(),
        },
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)

      const worker: WorkerRef = { type: 'agent', id: 'agent_1' }
      const claimed = await queue.claim('claim_assigned', worker)

      expect(claimed).toBe(false)
    })

    it('should return false for non-existent task', async () => {
      const worker: WorkerRef = { type: 'agent', id: 'agent_1' }
      const claimed = await queue.claim('non_existent', worker)
      expect(claimed).toBe(false)
    })
  })

  describe('complete()', () => {
    it('should mark task as completed', async () => {
      const task: AnyTask = {
        id: 'complete_test',
        function: createTestFunc('complete'),
        status: 'in_progress',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)
      await queue.complete('complete_test', 'Result data')

      const updated = await queue.get('complete_test')
      expect(updated!.status).toBe('completed')
    })

    it('should satisfy dependencies in other tasks', async () => {
      const task1: AnyTask = {
        id: 'dep_complete_1',
        function: createTestFunc('task1'),
        status: 'in_progress',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      const task2: AnyTask = {
        id: 'dep_complete_2',
        function: createTestFunc('task2'),
        status: 'blocked',
        priority: 'normal',
        dependencies: [{ type: 'blocked_by', taskId: 'dep_complete_1', satisfied: false }],
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task1)
      await queue.add(task2)
      await queue.complete('dep_complete_1', 'done')

      const updated = await queue.get('dep_complete_2')
      expect(updated!.dependencies![0].satisfied).toBe(true)
      expect(updated!.status).toBe('queued') // Unblocked
    })
  })

  describe('fail()', () => {
    it('should mark task as failed', async () => {
      const task: AnyTask = {
        id: 'fail_test',
        function: createTestFunc('fail'),
        status: 'in_progress',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      }

      await queue.add(task)
      await queue.fail('fail_test', 'Error message')

      const updated = await queue.get('fail_test')
      expect(updated!.status).toBe('failed')
    })
  })

  describe('stats()', () => {
    it('should return queue statistics', async () => {
      const tasks: AnyTask[] = [
        { id: 's1', function: createTestFunc('t1'), status: 'queued', priority: 'high', createdAt: new Date(), events: [] },
        { id: 's2', function: createTestFunc('t2'), status: 'queued', priority: 'normal', createdAt: new Date(), events: [] },
        { id: 's3', function: createTestFunc('t3'), status: 'completed', priority: 'low', createdAt: new Date(), events: [] },
      ]

      for (const task of tasks) {
        await queue.add(task)
      }

      const stats = await queue.stats()

      expect(stats.total).toBe(3)
      expect(stats.byStatus.queued).toBe(2)
      expect(stats.byStatus.completed).toBe(1)
      expect(stats.byPriority.high).toBe(1)
      expect(stats.byPriority.normal).toBe(1)
      expect(stats.byPriority.low).toBe(1)
    })
  })
})
