/**
 * Tests for do() - Task execution primitive
 *
 * The do() function routes tasks to appropriate Workers (AI Agents or Humans)
 * based on capability matching. Unlike ai-functions.do() which directly calls
 * the LLM, this function provides worker coordination with retries and timeouts.
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 * Tests are skipped if AI_GATEWAY_URL is not configured.
 */

import { describe, it, expect, vi } from 'vitest'
import { do as doTask } from '../src/index.js'
import type {
  Worker,
  WorkerDispatcher,
  WorkerDoInput,
  WorkerDoOutput,
  RoleTarget,
} from '../src/types.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe('do() - Task Execution Primitive', () => {
  describe('Unit Tests (no AI)', () => {
    it('should be exported from index', () => {
      expect(doTask).toBeDefined()
      expect(typeof doTask).toBe('function')
    })

    it('should have parallel method', () => {
      expect(doTask.parallel).toBeDefined()
      expect(typeof doTask.parallel).toBe('function')
    })

    it('should have sequence method', () => {
      expect(doTask.sequence).toBeDefined()
      expect(typeof doTask.sequence).toBe('function')
    })

    it('should have withDependencies method', () => {
      expect(doTask.withDependencies).toBeDefined()
      expect(typeof doTask.withDependencies).toBe('function')
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI)', () => {
    it('should execute a simple task', async () => {
      const result = await doTask('Calculate 2 + 2 and return the result', {
        timeout: 30000,
      })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.duration).toBe('number')
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should execute task with context', async () => {
      const result = await doTask('Summarize the provided text', {
        timeout: 30000,
        context: {
          text: 'Hello world. This is a simple test message.',
        },
      })

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should return steps array', async () => {
      const result = await doTask('List 3 colors', {
        timeout: 30000,
      })

      expect(result).toBeDefined()
      expect(Array.isArray(result.steps)).toBe(true)
    })

    it('should handle task with structured context', async () => {
      const result = await doTask<{ name: string; greeting: string }>(
        'Generate a greeting for the user',
        {
          timeout: 30000,
          context: {
            user: { name: 'Alice', language: 'English' },
          },
        }
      )

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it('should handle timeout option', async () => {
      // Very short timeout to test timeout behavior
      const result = await doTask('Count from 1 to 5', {
        timeout: 1, // 1ms timeout - will likely fail
      })

      // Either succeeds quickly or fails due to timeout
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('should execute parallel tasks', async () => {
      const results = await doTask.parallel(['What is 1+1?', 'What is 2+2?', 'What is 3+3?'], {
        timeout: 30000,
      })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(3)
      results.forEach((result) => {
        expect(result.success).toBeDefined()
        expect(result.duration).toBeDefined()
      })
    })

    it('should execute sequential tasks', async () => {
      const results = await doTask.sequence(['Say hello', 'Say goodbye'], { timeout: 30000 })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(2)
    })

    it('should handle task with retries option', async () => {
      const result = await doTask('Return the word "success"', {
        maxRetries: 1,
        timeout: 30000,
      })

      expect(result).toBeDefined()
      expect(result.success).toBeDefined()
    })

    it('should support background execution option', async () => {
      const result = await doTask('Generate a random number', {
        background: true,
        timeout: 30000,
      })

      expect(result).toBeDefined()
      // Background tasks still return a result
      expect(result.success).toBeDefined()
    })
  })

  // ==========================================================================
  // PRD aip-2q19 — Worker dispatch port (Agent / Person / Role) for `do`
  // ==========================================================================
  describe('Worker dispatch port (PRD aip-2q19)', () => {
    it('routes through a Worker dispatcher when present (Agent filler)', async () => {
      const dispatcherDo = vi
        .fn<(input: WorkerDoInput) => Promise<WorkerDoOutput<string>>>()
        .mockResolvedValue({ result: 'agent did the task' })
      const dispatcher: WorkerDispatcher = {
        ask: async () => ({ answer: 'noop' }),
        do: dispatcherDo,
      }
      const agentWorker: Worker = {
        id: 'agent_doer',
        name: 'Doer Agent',
        type: 'agent',
        status: 'available',
        contacts: {},
        dispatch: dispatcher,
      }

      const result = await doTask<string>(agentWorker, 'Calculate 2+2')

      expect(dispatcherDo).toHaveBeenCalledOnce()
      expect(dispatcherDo).toHaveBeenCalledWith(expect.objectContaining({ task: 'Calculate 2+2' }))
      expect(result.success).toBe(true)
      expect(result.result).toBe('agent did the task')
    })

    it('forwards context and timeout to the dispatcher input', async () => {
      const dispatcherDo = vi
        .fn<(input: WorkerDoInput) => Promise<WorkerDoOutput<string>>>()
        .mockResolvedValue({ result: 'ok' })
      const dispatcher: WorkerDispatcher = {
        ask: async () => ({ answer: 'noop' }),
        do: dispatcherDo,
      }
      const worker: Worker = {
        id: 'w',
        name: 'W',
        type: 'agent',
        status: 'available',
        contacts: {},
        dispatch: dispatcher,
      }

      await doTask(worker, 'task', { context: { foo: 'bar' }, timeout: 5000 })

      expect(dispatcherDo).toHaveBeenCalledWith({
        task: 'task',
        context: { foo: 'bar' },
        timeout: 5000,
      })
    })

    it('resolves a Role target to its filler before dispatching', async () => {
      const dispatcher: WorkerDispatcher = {
        ask: async () => ({ answer: 'noop' }),
        do: async () => ({ result: 'role filler did it' }),
      }
      const ceoFiller: Worker = {
        id: 'person_priya',
        name: 'Priya',
        type: 'human',
        status: 'available',
        contacts: {},
        dispatch: dispatcher,
      }
      const resolveWorker = vi.fn().mockResolvedValue(ceoFiller)
      const ceoRole: RoleTarget = {
        $type: 'Role',
        name: 'CEO',
        resolveWorker,
      }

      const result = await doTask<string>(ceoRole, 'execute Q1 plan')

      expect(resolveWorker).toHaveBeenCalledOnce()
      expect(result.success).toBe(true)
      expect(result.result).toBe('role filler did it')
    })

    it('marks the result failed when the dispatcher throws', async () => {
      const dispatcher: WorkerDispatcher = {
        ask: async () => ({ answer: 'noop' }),
        do: async () => {
          throw new Error('dispatcher boom')
        },
      }
      const worker: Worker = {
        id: 'w',
        name: 'W',
        type: 'agent',
        status: 'available',
        contacts: {},
        dispatch: dispatcher,
      }

      const result = await doTask(worker, 'task')

      expect(result.success).toBe(false)
      expect(result.error).toBe('dispatcher boom')
    })
  })
})
