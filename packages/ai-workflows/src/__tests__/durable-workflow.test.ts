/**
 * Tests for DurableWorkflow
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createMemoryProvider, type DigitalObjectsProvider } from 'digital-objects'
import {
  DurableWorkflow,
  createDurableWorkflow,
  type DurableWorkflowState,
} from '../durable-workflow.js'

describe('DurableWorkflow', () => {
  let provider: DigitalObjectsProvider

  beforeEach(() => {
    provider = createMemoryProvider()
  })

  afterEach(async () => {
    // Clean up any workflows
    await provider.close?.()
  })

  describe('initialization', () => {
    it('should create a new workflow instance', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('test-workflow', ($) => {
        $.on.Test.event(async () => {})
      })

      // Verify workflow was created in digital-objects
      const thing = await provider.get<DurableWorkflowState>(workflow.id)
      expect(thing).not.toBeNull()
      expect(thing?.noun).toBe('Workflow')
      expect(thing?.data.name).toBe('test-workflow')
      expect(thing?.data.status).toBe('running')
    })

    it('should use provided instance ID', async () => {
      const workflow = new DurableWorkflow(provider, { instanceId: 'my-workflow-id' })

      await workflow.initialize('named-workflow', ($) => {})

      expect(workflow.id).toBe('my-workflow-id')

      const thing = await provider.get('my-workflow-id')
      expect(thing).not.toBeNull()
    })

    it('should register event handlers', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('event-workflow', ($) => {
        $.on.Customer.created(async () => {})
        $.on.Order.completed(async () => {})
      })

      const thing = await provider.get<DurableWorkflowState>(workflow.id)
      expect(thing?.data.registeredEvents).toContain('Customer.created')
      expect(thing?.data.registeredEvents).toContain('Order.completed')
    })

    it('should register schedule handlers', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('schedule-workflow', ($) => {
        $.every.minutes(30)(async () => {})
      })

      const thing = await provider.get<DurableWorkflowState>(workflow.id)
      expect(thing?.data.registeredSchedules).toContain('minute:30')
    })

    it('should reject double initialization', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('test', ($) => {})

      await expect(workflow.initialize('test2', ($) => {})).rejects.toThrow(
        'Workflow already initialized'
      )
    })

    it('should initialize with context', async () => {
      const workflow = new DurableWorkflow(provider, {
        context: { userId: 'user-123', tenant: 'acme' },
      })

      await workflow.initialize('context-workflow', ($) => {})

      const thing = await provider.get<DurableWorkflowState>(workflow.id)
      expect(thing?.data.context).toMatchObject({
        userId: 'user-123',
        tenant: 'acme',
      })
    })
  })

  describe('state management', () => {
    it('should get current state', async () => {
      const workflow = new DurableWorkflow(provider, {
        context: { counter: 0 },
      })

      await workflow.initialize('state-workflow', ($) => {
        $.state.counter = 1
      })

      const state = workflow.getState()
      expect(state.context.counter).toBe(1)
    })

    it('should persist state changes', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('persist-workflow', ($) => {
        $.set('key1', 'value1')
        $.set('key2', { nested: true })
      })

      // Wait for async persist
      await new Promise((r) => setTimeout(r, 10))

      const thing = await provider.get<DurableWorkflowState>(workflow.id)
      expect(thing?.data.context.key1).toBe('value1')
      expect(thing?.data.context.key2).toMatchObject({ nested: true })
    })

    it('should support $.get and $.set', async () => {
      const workflow = new DurableWorkflow(provider)

      let capturedValue: unknown

      await workflow.initialize('getset-workflow', ($) => {
        $.set('myKey', 'myValue')
        capturedValue = $.get('myKey')
      })

      expect(capturedValue).toBe('myValue')
    })
  })

  describe('event handling', () => {
    it('should send events and trigger handlers', async () => {
      const workflow = new DurableWorkflow(provider)
      const handler = vi.fn()

      await workflow.initialize('event-workflow', ($) => {
        $.on.Test.triggered(handler)
      })

      await workflow.start()
      await workflow.send('Test.triggered', { value: 42 })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ value: 42 }),
        expect.anything()
      )

      await workflow.destroy()
    })

    it('should record events as Actions', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('action-workflow', ($) => {
        $.on.Event.happened(async () => {})
      })

      await workflow.start()
      await workflow.send('Event.happened', { data: 'test' })

      // Wait for async persistence
      await new Promise((r) => setTimeout(r, 10))

      const actions = await provider.listActions({ verb: 'emit' })
      expect(actions.length).toBeGreaterThan(0)

      await workflow.destroy()
    })

    it('should throw for uninitialized workflow', async () => {
      const workflow = new DurableWorkflow(provider)

      await expect(workflow.send('Test.event', {})).rejects.toThrow('Workflow not initialized')
    })
  })

  describe('history', () => {
    it('should track history entries', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('history-workflow', ($) => {
        $.on.Step.one(async () => {})
      })

      await workflow.start()
      await workflow.send('Step.one', {})

      const state = workflow.getState()
      expect(state.history.length).toBeGreaterThan(0)
      expect(state.history.some((h) => h.name === 'workflow.started')).toBe(true)

      await workflow.destroy()
    })

    it('should persist history as Actions', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('persist-history', ($) => {
        $.log('Test log message')
      })

      // Wait for async persistence
      await new Promise((r) => setTimeout(r, 10))

      const actions = await provider.listActions({ verb: 'action', subject: workflow.id })
      expect(actions.some((a) => a.data?.name === 'log')).toBe(true)

      await workflow.destroy()
    })
  })

  describe('lifecycle', () => {
    it('should start and stop workflow', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('lifecycle-workflow', ($) => {})

      await workflow.start()

      let thing = await provider.get<DurableWorkflowState>(workflow.id)
      expect(thing?.data.status).toBe('running')

      await workflow.stop()

      thing = await provider.get<DurableWorkflowState>(workflow.id)
      expect(thing?.data.status).toBe('paused')
    })

    it('should destroy workflow', async () => {
      const workflow = new DurableWorkflow(provider)

      await workflow.initialize('destroy-workflow', ($) => {})
      await workflow.start()
      await workflow.destroy()

      const thing = await provider.get<DurableWorkflowState>(workflow.id)
      expect(thing?.data.status).toBe('completed')
    })

    it('should reject start before initialization', async () => {
      const workflow = new DurableWorkflow(provider)

      await expect(workflow.start()).rejects.toThrow('Workflow not initialized')
    })
  })

  describe('recovery', () => {
    it('should restore workflow from existing state', async () => {
      // Create initial workflow
      const workflow1 = new DurableWorkflow(provider, { instanceId: 'recovery-test' })

      await workflow1.initialize('recoverable', ($) => {
        $.set('data', 'original')
      })

      await workflow1.start()
      await workflow1.stop()

      // Create new workflow with same ID - should restore
      const workflow2 = new DurableWorkflow(provider, { instanceId: 'recovery-test' })

      await workflow2.initialize('recoverable', ($) => {})

      const state = workflow2.getState()
      expect(state.context.data).toBe('original')

      await workflow2.destroy()
    })
  })

  describe('createDurableWorkflow factory', () => {
    it('should create workflow instance', () => {
      const workflow = createDurableWorkflow(provider)
      expect(workflow).toBeInstanceOf(DurableWorkflow)
    })

    it('should pass options', () => {
      const workflow = createDurableWorkflow(provider, { instanceId: 'factory-test' })
      expect(workflow.id).toBe('factory-test')
    })
  })
})
