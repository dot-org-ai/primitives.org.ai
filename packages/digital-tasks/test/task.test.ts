import { describe, it, expect, beforeEach } from 'vitest'
import {
  createTask,
  getTask,
  startTask,
  updateProgress,
  completeTask,
  failTask,
  cancelTask,
  addComment,
  createSubtask,
  getSubtasks,
  waitForTask,
  taskQueue,
  createTaskQueue,
} from '../src/index.js'
import type { FunctionDefinition, WorkerRef } from '../src/index.js'

describe('Task Management', () => {
  let queue: ReturnType<typeof createTaskQueue>

  beforeEach(() => {
    // Create a fresh queue for each test
    queue = createTaskQueue({ name: 'test' })
  })

  describe('createTask()', () => {
    it('should create a task with a generative function', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'summarize',
        description: 'Summarize text',
        args: { text: 'The text to summarize' },
        output: 'string',
      }

      const task = await createTask({
        function: func,
        input: { text: 'Long article content...' },
        priority: 'high',
      })

      expect(task).toBeDefined()
      expect(task.id).toMatch(/^task_/)
      expect(task.function).toEqual(func)
      expect(task.priority).toBe('high')
      expect(task.status).toBe('queued')
      expect(task.input).toEqual({ text: 'Long article content...' })
      expect(task.createdAt).toBeInstanceOf(Date)
    })

    it('should create a task with a code function', async () => {
      const func: FunctionDefinition = {
        type: 'code',
        name: 'processData',
        args: { data: 'Input data' },
        output: 'object',
        code: 'return data',
        language: 'typescript',
      }

      const task = await createTask({
        function: func,
        priority: 'normal',
      })

      expect(task.function.type).toBe('code')
      expect(task.allowedWorkers).toEqual(['any'])
    })

    it('should set allowedWorkers to human for human functions', async () => {
      const func: FunctionDefinition = {
        type: 'human',
        name: 'review',
        description: 'Review document',
        args: { document: 'Document to review' },
        output: 'object',
        instructions: 'Please review this document',
      }

      const task = await createTask({
        function: func,
      })

      expect(task.allowedWorkers).toEqual(['human'])
    })

    it('should set allowedWorkers to agent for agentic functions', async () => {
      const func: FunctionDefinition = {
        type: 'agentic',
        name: 'research',
        args: { topic: 'Topic to research' },
        output: 'string',
        tools: [],
      }

      const task = await createTask({
        function: func,
      })

      expect(task.allowedWorkers).toEqual(['agent'])
    })

    it('should create a task with dependencies', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'task1',
        args: {},
        output: 'string',
      }

      const task1 = await createTask({ function: func })
      const task2 = await createTask({
        function: { ...func, name: 'task2' },
        dependencies: [task1.id],
      })

      expect(task2.status).toBe('blocked')
      expect(task2.dependencies).toHaveLength(1)
      expect(task2.dependencies![0].taskId).toBe(task1.id)
      expect(task2.dependencies![0].type).toBe('blocked_by')
      expect(task2.dependencies![0].satisfied).toBe(false)
    })

    it('should create a task with assignment', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'assigned-task',
        args: {},
        output: 'string',
      }

      const worker: WorkerRef = {
        type: 'agent',
        id: 'agent_123',
        name: 'Test Agent',
      }

      const task = await createTask({
        function: func,
        assignTo: worker,
      })

      expect(task.status).toBe('assigned')
      expect(task.assignment).toBeDefined()
      expect(task.assignment!.worker).toEqual(worker)
    })

    it('should create a task with scheduled start time', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'scheduled-task',
        args: {},
        output: 'string',
      }

      const scheduledFor = new Date(Date.now() + 60000)

      const task = await createTask({
        function: func,
        scheduledFor,
      })

      expect(task.status).toBe('pending')
      expect(task.scheduledFor).toEqual(scheduledFor)
    })

    it('should create a task with metadata and tags', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'tagged-task',
        args: {},
        output: 'string',
      }

      const task = await createTask({
        function: func,
        tags: ['urgent', 'frontend'],
        metadata: { source: 'api', version: '1.0' },
      })

      expect(task.tags).toEqual(['urgent', 'frontend'])
      expect(task.metadata).toEqual({ source: 'api', version: '1.0' })
    })
  })

  describe('getTask()', () => {
    it('should retrieve an existing task', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'test-task',
        args: {},
        output: 'string',
      }

      const created = await createTask({ function: func })
      const retrieved = await getTask(created.id)

      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(created.id)
    })

    it('should return undefined for non-existent task', async () => {
      const result = await getTask('non_existent_id')
      expect(result).toBeUndefined()
    })
  })

  describe('startTask()', () => {
    it('should start a task and update status', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'start-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      const worker: WorkerRef = { type: 'agent', id: 'agent_1', name: 'Worker' }

      const started = await startTask(task.id, worker)

      expect(started).toBeDefined()
      expect(started!.status).toBe('in_progress')
      expect(started!.assignment?.worker).toEqual(worker)
    })

    it('should return undefined for non-existent task', async () => {
      const worker: WorkerRef = { type: 'agent', id: 'agent_1' }
      const result = await startTask('non_existent', worker)
      expect(result).toBeUndefined()
    })
  })

  describe('updateProgress()', () => {
    it('should update task progress', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'progress-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      const updated = await updateProgress(task.id, 50, 'Processing data')

      expect(updated).toBeDefined()
      expect(updated!.progress?.percent).toBe(50)
      expect(updated!.progress?.step).toBe('Processing data')
    })
  })

  describe('completeTask()', () => {
    it('should complete a task with output', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'complete-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      const worker: WorkerRef = { type: 'agent', id: 'agent_1' }
      await startTask(task.id, worker)

      const result = await completeTask(task.id, 'Task completed successfully')

      expect(result.success).toBe(true)
      expect(result.output).toBe('Task completed successfully')
      expect(result.taskId).toBe(task.id)
    })

    it('should return error for non-existent task', async () => {
      const result = await completeTask('non_existent', 'output')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('TASK_NOT_FOUND')
    })
  })

  describe('failTask()', () => {
    it('should fail a task with error message', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'fail-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      const result = await failTask(task.id, 'Something went wrong')

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('TASK_FAILED')
      expect(result.error?.message).toBe('Something went wrong')
    })

    it('should fail a task with Error object', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'fail-error-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      const error = new Error('Error object message')
      const result = await failTask(task.id, error)

      expect(result.success).toBe(false)
      expect(result.error?.message).toBe('Error object message')
    })
  })

  describe('cancelTask()', () => {
    it('should cancel a task', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'cancel-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      const cancelled = await cancelTask(task.id, 'No longer needed')

      expect(cancelled).toBe(true)

      const updated = await getTask(task.id)
      expect(updated?.status).toBe('cancelled')
    })

    it('should return false for non-existent task', async () => {
      const result = await cancelTask('non_existent')
      expect(result).toBe(false)
    })
  })

  describe('addComment()', () => {
    it('should add a comment to a task', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'comment-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      const author: WorkerRef = { type: 'human', id: 'user_1', name: 'John' }

      const updated = await addComment(task.id, 'This is a comment', author)

      expect(updated).toBeDefined()
      const commentEvent = updated!.events?.find(e => e.type === 'comment')
      expect(commentEvent).toBeDefined()
      expect(commentEvent!.message).toBe('This is a comment')
      expect(commentEvent!.actor).toEqual(author)
    })
  })

  describe('createSubtask()', () => {
    it('should create a subtask with parent reference', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'parent-task',
        args: {},
        output: 'string',
      }

      const parent = await createTask({ function: func })

      const subtask = await createSubtask(parent.id, {
        function: {
          type: 'generative',
          name: 'subtask',
          args: {},
          output: 'string',
        },
      })

      expect(subtask.parentId).toBe(parent.id)
    })
  })

  describe('getSubtasks()', () => {
    it('should retrieve all subtasks of a parent', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'parent',
        args: {},
        output: 'string',
      }

      const parent = await createTask({ function: func })

      await createSubtask(parent.id, {
        function: { type: 'generative', name: 'sub1', args: {}, output: 'string' },
      })
      await createSubtask(parent.id, {
        function: { type: 'generative', name: 'sub2', args: {}, output: 'string' },
      })

      const subtasks = await getSubtasks(parent.id)
      expect(subtasks).toHaveLength(2)
    })
  })

  describe('waitForTask()', () => {
    it('should return immediately for completed task', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'wait-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      await completeTask(task.id, 'done')

      const result = await waitForTask(task.id, { timeout: 1000 })
      expect(result.success).toBe(true)
      // Output is wrapped in { value, producedAt } by queue.complete()
      expect(result.output).toEqual({ value: 'done', producedAt: expect.any(Date) })
    })

    it('should return error for failed task', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'wait-fail-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      await failTask(task.id, 'task failed')

      const result = await waitForTask(task.id, { timeout: 1000 })
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('TASK_FAILED')
    })

    it('should return error for cancelled task', async () => {
      const func: FunctionDefinition = {
        type: 'generative',
        name: 'wait-cancel-test',
        args: {},
        output: 'string',
      }

      const task = await createTask({ function: func })
      await cancelTask(task.id)

      const result = await waitForTask(task.id, { timeout: 1000 })
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('TASK_CANCELLED')
    })

    it('should return error for non-existent task', async () => {
      const result = await waitForTask('non_existent', { timeout: 100 })
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('TASK_NOT_FOUND')
    })
  })
})
