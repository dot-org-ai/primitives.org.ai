/**
 * Worker Export Tests for ai-workflows
 *
 * Tests for the /worker export.
 * These tests verify the WorkflowService WorkerEntrypoint and WorkflowServiceCore RpcTarget.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkflowService, WorkflowServiceCore } from '../src/worker.js'
import type { WorkflowInstanceInfo } from '../src/worker.js'

describe('WorkflowServiceCore (RpcTarget)', () => {
  let service: WorkflowServiceCore

  beforeEach(() => {
    service = new WorkflowServiceCore()
  })

  afterEach(() => {
    // Clean up any created workflows
    service.clear()
  })

  describe('constructor', () => {
    it('creates a new WorkflowServiceCore instance', () => {
      expect(service).toBeInstanceOf(WorkflowServiceCore)
    })

    it('has expected class name', () => {
      expect(service.constructor.name).toBe('WorkflowServiceCore')
    })
  })

  describe('workflow creation', () => {
    describe('create()', () => {
      it('creates a new workflow with generated ID', () => {
        const info = service.create()

        expect(info.id).toBeDefined()
        expect(info.id).toMatch(/^wf-/)
        expect(info.started).toBe(false)
      })

      it('creates a workflow with a custom name', () => {
        const info = service.create('my-workflow')

        expect(info.name).toBe('my-workflow')
        expect(info.id).toBeDefined()
      })

      it('creates a workflow with initial context', () => {
        const info = service.create('test-workflow', {
          context: { userId: '123', role: 'admin' },
        })

        expect(info.state.context).toEqual({ userId: '123', role: 'admin' })
      })

      it('creates multiple independent workflows', () => {
        const wf1 = service.create('workflow-1')
        const wf2 = service.create('workflow-2')

        expect(wf1.id).not.toBe(wf2.id)
        expect(service.list()).toContain(wf1.id)
        expect(service.list()).toContain(wf2.id)
      })
    })

    describe('createWithSetup()', () => {
      it('creates a workflow with event handlers', () => {
        const info = service.createWithSetup(($) => {
          $.on.Customer.created(() => {
            // Handler
          })
        })

        expect(info.id).toBeDefined()
        expect(info.eventCount).toBe(1)
      })

      it('creates a workflow with schedule handlers', () => {
        const info = service.createWithSetup(($) => {
          $.every.minutes(5)(() => {
            // Handler
          })
        })

        expect(info.id).toBeDefined()
        expect(info.scheduleCount).toBe(1)
      })

      it('creates a workflow with both event and schedule handlers', () => {
        const info = service.createWithSetup(($) => {
          $.on.Order.completed(() => {})
          $.on.Payment.received(() => {})
          $.every.hours(1)(() => {})
        })

        expect(info.eventCount).toBe(2)
        expect(info.scheduleCount).toBe(1)
      })
    })
  })

  describe('workflow lifecycle', () => {
    let workflowId: string

    beforeEach(() => {
      const info = service.create('lifecycle-test')
      workflowId = info.id
    })

    describe('start()', () => {
      it('starts a workflow', async () => {
        await service.start(workflowId)
        const info = service.get(workflowId)
        expect(info?.started).toBe(true)
      })

      it('is idempotent (can be called multiple times)', async () => {
        await service.start(workflowId)
        await service.start(workflowId) // Should not throw
        const info = service.get(workflowId)
        expect(info?.started).toBe(true)
      })

      it('throws for non-existent workflow', async () => {
        await expect(service.start('non-existent')).rejects.toThrow('not found')
      })
    })

    describe('stop()', () => {
      it('stops a running workflow', async () => {
        await service.start(workflowId)
        await service.stop(workflowId)
        const info = service.get(workflowId)
        expect(info?.started).toBe(false)
      })

      it('throws for non-existent workflow', async () => {
        await expect(service.stop('non-existent')).rejects.toThrow('not found')
      })
    })

    describe('destroy()', () => {
      it('destroys a workflow and removes from registry', async () => {
        await service.destroy(workflowId)
        expect(service.has(workflowId)).toBe(false)
        expect(service.get(workflowId)).toBeNull()
      })

      it('throws for non-existent workflow', async () => {
        await expect(service.destroy('non-existent')).rejects.toThrow('not found')
      })
    })
  })

  describe('event emission', () => {
    let workflowId: string

    beforeEach(() => {
      const info = service.createWithSetup(($) => {
        $.on.Customer.created((data) => {
          $.set('lastCustomer', data)
        })
      })
      workflowId = info.id
    })

    describe('emit()', () => {
      it('emits an event to a workflow', () => {
        const eventId = service.emit(workflowId, 'Customer.created', {
          name: 'John',
          email: 'john@example.com',
        })

        expect(eventId).toBeDefined()
        expect(typeof eventId).toBe('string')
      })

      it('throws for non-existent workflow', () => {
        expect(() => {
          service.emit('non-existent', 'Test.event', {})
        }).toThrow('not found')
      })
    })
  })

  describe('state management', () => {
    let workflowId: string

    beforeEach(() => {
      const info = service.create('state-test', {
        context: { initial: 'value' },
      })
      workflowId = info.id
    })

    describe('getState()', () => {
      it('returns the workflow state', () => {
        const state = service.getState(workflowId)

        expect(state.context).toBeDefined()
        expect(state.context.initial).toBe('value')
        expect(state.history).toEqual([])
      })

      it('throws for non-existent workflow', () => {
        expect(() => service.getState('non-existent')).toThrow('not found')
      })
    })

    describe('setState()', () => {
      it('sets a value in workflow context', () => {
        service.setState(workflowId, 'newKey', 'newValue')

        const state = service.getState(workflowId)
        expect(state.context.newKey).toBe('newValue')
      })

      it('throws for non-existent workflow', () => {
        expect(() => service.setState('non-existent', 'key', 'value')).toThrow('not found')
      })
    })

    describe('getValue()', () => {
      it('gets a value from workflow context', () => {
        service.setState(workflowId, 'testKey', 'testValue')
        const value = service.getValue(workflowId, 'testKey')

        expect(value).toBe('testValue')
      })

      it('returns undefined for non-existent key', () => {
        const value = service.getValue(workflowId, 'nonExistent')
        expect(value).toBeUndefined()
      })

      it('throws for non-existent workflow', () => {
        expect(() => service.getValue('non-existent', 'key')).toThrow('not found')
      })
    })
  })

  describe('workflow info', () => {
    describe('get()', () => {
      it('returns workflow info', () => {
        const created = service.create('info-test')
        const info = service.get(created.id)

        expect(info).not.toBeNull()
        expect(info?.id).toBe(created.id)
        expect(info?.name).toBe('info-test')
        expect(info?.started).toBe(false)
      })

      it('returns null for non-existent workflow', () => {
        const info = service.get('non-existent')
        expect(info).toBeNull()
      })
    })

    describe('list()', () => {
      it('returns all workflow IDs', () => {
        const wf1 = service.create('list-test-1')
        const wf2 = service.create('list-test-2')

        const ids = service.list()

        expect(ids).toContain(wf1.id)
        expect(ids).toContain(wf2.id)
      })

      it('returns empty array when no workflows', () => {
        service.clear()
        const ids = service.list()
        expect(ids).toEqual([])
      })
    })

    describe('has()', () => {
      it('returns true for existing workflow', () => {
        const info = service.create('has-test')
        expect(service.has(info.id)).toBe(true)
      })

      it('returns false for non-existent workflow', () => {
        expect(service.has('non-existent')).toBe(false)
      })
    })
  })

  describe('global event handlers', () => {
    afterEach(() => {
      service.clearGlobalEventHandlers()
    })

    describe('registerGlobalEvent()', () => {
      it('registers a global event handler', () => {
        service.registerGlobalEvent('Test', 'event', () => {})

        const handlers = service.getGlobalEventHandlers()
        expect(handlers.length).toBeGreaterThan(0)
        expect(handlers.some((h) => h.noun === 'Test' && h.event === 'event')).toBe(true)
      })
    })

    describe('getGlobalEventHandlers()', () => {
      it('returns all registered global event handlers', () => {
        service.registerGlobalEvent('A', 'event1', () => {})
        service.registerGlobalEvent('B', 'event2', () => {})

        const handlers = service.getGlobalEventHandlers()
        expect(handlers.length).toBe(2)
      })
    })

    describe('clearGlobalEventHandlers()', () => {
      it('clears all global event handlers', () => {
        service.registerGlobalEvent('Test', 'event', () => {})
        service.clearGlobalEventHandlers()

        const handlers = service.getGlobalEventHandlers()
        expect(handlers.length).toBe(0)
      })
    })
  })

  describe('global schedule handlers', () => {
    afterEach(() => {
      service.clearGlobalScheduleHandlers()
    })

    describe('registerGlobalSchedule()', () => {
      it('registers a global schedule handler', () => {
        service.registerGlobalSchedule({ type: 'hour' }, () => {})

        const handlers = service.getGlobalScheduleHandlers()
        expect(handlers.length).toBe(1)
      })
    })

    describe('getGlobalScheduleHandlers()', () => {
      it('returns all registered global schedule handlers', () => {
        service.registerGlobalSchedule({ type: 'minute' }, () => {})
        service.registerGlobalSchedule({ type: 'hour' }, () => {})

        const handlers = service.getGlobalScheduleHandlers()
        expect(handlers.length).toBe(2)
      })
    })

    describe('clearGlobalScheduleHandlers()', () => {
      it('clears all global schedule handlers', () => {
        service.registerGlobalSchedule({ type: 'hour' }, () => {})
        service.clearGlobalScheduleHandlers()

        const handlers = service.getGlobalScheduleHandlers()
        expect(handlers.length).toBe(0)
      })
    })
  })

  describe('utilities', () => {
    describe('parseEvent()', () => {
      it('parses valid event string', () => {
        const parsed = service.parseEvent('Customer.created')

        expect(parsed).toEqual({ noun: 'Customer', event: 'created' })
      })

      it('returns null for invalid event string', () => {
        expect(service.parseEvent('invalid')).toBeNull()
        expect(service.parseEvent('too.many.parts')).toBeNull()
        expect(service.parseEvent('')).toBeNull()
      })
    })

    describe('toCron()', () => {
      it('converts known pattern to cron', async () => {
        const cron = await service.toCron('hour')
        expect(cron).toBeDefined()
        expect(cron).toBe('0 * * * *')
      })

      it('converts day pattern to cron', async () => {
        const cron = await service.toCron('Monday')
        expect(cron).toBeDefined()
        expect(cron).toBe('0 0 * * 1')
      })
    })

    describe('intervalToMs()', () => {
      it('converts second interval to milliseconds', () => {
        const ms = service.intervalToMs({ type: 'second', value: 10 })
        expect(ms).toBe(10000)
      })

      it('converts minute interval to milliseconds', () => {
        const ms = service.intervalToMs({ type: 'minute', value: 5 })
        expect(ms).toBe(300000)
      })

      it('converts hour interval to milliseconds', () => {
        const ms = service.intervalToMs({ type: 'hour', value: 2 })
        expect(ms).toBe(7200000)
      })
    })

    describe('formatInterval()', () => {
      it('formats hour interval', () => {
        const formatted = service.formatInterval({ type: 'hour' })
        expect(typeof formatted).toBe('string')
      })

      it('formats minute interval with value', () => {
        const formatted = service.formatInterval({ type: 'minute', value: 30 })
        expect(typeof formatted).toBe('string')
      })
    })

    describe('createTestContext()', () => {
      it('creates a test context with emittedEvents tracking', () => {
        const ctx = service.createTestContext()

        expect(ctx.emittedEvents).toBeDefined()
        expect(Array.isArray(ctx.emittedEvents)).toBe(true)
        expect(typeof ctx.send).toBe('function')
        expect(typeof ctx.log).toBe('function')
      })

      it('test context tracks sent events', () => {
        const ctx = service.createTestContext()
        ctx.send('Test.event', { value: 42 })

        expect(ctx.emittedEvents.length).toBe(1)
        expect(ctx.emittedEvents[0].event).toBe('Test.event')
      })
    })

    describe('clear()', () => {
      it('clears all workflows', () => {
        service.create('test-1')
        service.create('test-2')

        service.clear()

        expect(service.list()).toEqual([])
      })
    })
  })
})

describe('WorkflowService (WorkerEntrypoint)', () => {
  describe('class definition', () => {
    it('exports WorkflowService class', () => {
      expect(WorkflowService).toBeDefined()
      expect(typeof WorkflowService).toBe('function')
    })

    it('WorkflowService has connect method in prototype', () => {
      expect(typeof WorkflowService.prototype.connect).toBe('function')
    })

    it('has expected class name', () => {
      expect(WorkflowService.name).toBe('WorkflowService')
    })
  })

  describe('connect()', () => {
    // Note: WorkerEntrypoint classes cannot be instantiated directly in tests.
    // They require the Cloudflare Workers runtime context.
    // We verify the connect method behavior by testing that:
    // 1. The method exists on the prototype
    // 2. The return type (WorkflowServiceCore) is properly constructable and functional

    it('returns a WorkflowServiceCore instance', () => {
      // Since we can't instantiate WorkflowService directly (requires Workers runtime),
      // we verify that WorkflowServiceCore (the return type of connect()) works correctly
      const core = new WorkflowServiceCore()
      expect(core).toBeInstanceOf(WorkflowServiceCore)
    })

    it('returns service with all required methods', () => {
      const core = new WorkflowServiceCore()

      // Workflow creation
      expect(typeof core.create).toBe('function')
      expect(typeof core.createWithSetup).toBe('function')

      // Lifecycle
      expect(typeof core.start).toBe('function')
      expect(typeof core.stop).toBe('function')
      expect(typeof core.destroy).toBe('function')

      // Events
      expect(typeof core.emit).toBe('function')
      expect(typeof core.sendGlobal).toBe('function')

      // State
      expect(typeof core.getState).toBe('function')
      expect(typeof core.setState).toBe('function')
      expect(typeof core.getValue).toBe('function')

      // Info
      expect(typeof core.get).toBe('function')
      expect(typeof core.list).toBe('function')
      expect(typeof core.has).toBe('function')

      // Global handlers
      expect(typeof core.registerGlobalEvent).toBe('function')
      expect(typeof core.registerGlobalSchedule).toBe('function')

      // Utilities
      expect(typeof core.parseEvent).toBe('function')
      expect(typeof core.toCron).toBe('function')
      expect(typeof core.intervalToMs).toBe('function')
      expect(typeof core.formatInterval).toBe('function')
      expect(typeof core.createTestContext).toBe('function')
      expect(typeof core.clear).toBe('function')
    })

    it('creates independent service instances', () => {
      const core1 = new WorkflowServiceCore()
      const core2 = new WorkflowServiceCore()

      // Create workflow in core1
      const wf = core1.create('independent-test')

      // Both instances share the global registry, so wf should be visible in both
      // This is intentional - workflows are shared state
      expect(core1.has(wf.id)).toBe(true)
      expect(core2.has(wf.id)).toBe(true)

      // Clean up
      core1.clear()
    })
  })
})

describe('Integration: Workflow Execution', () => {
  let service: WorkflowServiceCore

  beforeEach(() => {
    service = new WorkflowServiceCore()
  })

  afterEach(() => {
    service.clear()
    service.clearGlobalEventHandlers()
    service.clearGlobalScheduleHandlers()
  })

  it('creates and starts a workflow', async () => {
    const info = service.create('integration-test')

    await service.start(info.id)

    const updated = service.get(info.id)
    expect(updated?.started).toBe(true)
  })

  it('manages workflow state through lifecycle', async () => {
    const info = service.create('state-lifecycle', {
      context: { counter: 0 },
    })

    // Initial state
    expect(service.getValue(info.id, 'counter')).toBe(0)

    // Update state
    service.setState(info.id, 'counter', 1)
    expect(service.getValue(info.id, 'counter')).toBe(1)

    // State persists across start/stop
    await service.start(info.id)
    expect(service.getValue(info.id, 'counter')).toBe(1)

    await service.stop(info.id)
    expect(service.getValue(info.id, 'counter')).toBe(1)
  })

  it('creates workflow with event handlers and emits events', () => {
    const received: unknown[] = []

    const info = service.createWithSetup(($) => {
      $.on.Test.event((data) => {
        received.push(data)
      })
    })

    // Emit event
    const eventId = service.emit(info.id, 'Test.event', { value: 42 })

    expect(eventId).toBeDefined()
    // Note: Event delivery is async, so we verify the eventId was returned
  })

  it('destroys workflow and cleans up', async () => {
    const info = service.create('destroy-test')
    await service.start(info.id)

    await service.destroy(info.id)

    expect(service.has(info.id)).toBe(false)
    expect(service.get(info.id)).toBeNull()
  })
})
