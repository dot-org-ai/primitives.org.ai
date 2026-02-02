/**
 * RPC Surface Tests (RED Phase)
 *
 * Failing tests that define the expected interface for the full RPC surface
 * of WorkflowService and WorkflowServiceCore.
 *
 * These tests are written in the RED phase of TDD - they define the expected
 * behavior before implementation. They should fail initially.
 *
 * ## RPC Surface Categories
 * 1. Workflow Creation and Registration
 * 2. Workflow Lifecycle Management
 * 3. Event Emission and Handling
 * 4. State Management (in-memory and persisted)
 * 5. Query and List Operations
 * 6. Batch Operations
 * 7. Workflow Introspection
 * 8. Error Handling and Recovery
 * 9. Metrics and Observability
 * 10. Serialization/Deserialization for RPC
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkflowService, WorkflowServiceCore } from '../src/worker.js'
import type { WorkflowInstanceInfo } from '../src/worker.js'

describe('RPC Surface: WorkflowServiceCore', () => {
  let service: WorkflowServiceCore

  beforeEach(() => {
    service = new WorkflowServiceCore()
  })

  afterEach(() => {
    service.clear()
    service.clearGlobalEventHandlers()
    service.clearGlobalScheduleHandlers()
  })

  // ===========================================================================
  // 1. Workflow Creation and Registration
  // ===========================================================================
  describe('Workflow Creation RPC Methods', () => {
    describe('createFromDefinition()', () => {
      it('creates a workflow from a serializable definition object', () => {
        const definition = {
          name: 'test-workflow',
          events: [
            { noun: 'Customer', event: 'created' },
            { noun: 'Order', event: 'placed' },
          ],
          schedules: [{ type: 'hour' as const }],
        }

        const info = service.createFromDefinition(definition)

        expect(info.id).toBeDefined()
        expect(info.name).toBe('test-workflow')
        expect(info.eventCount).toBe(2)
        expect(info.scheduleCount).toBe(1)
      })

      it('validates definition schema before creation', () => {
        const invalidDefinition = {
          name: '', // Invalid: empty name
          events: 'not-an-array', // Invalid: should be array
        }

        expect(() => {
          service.createFromDefinition(invalidDefinition as unknown)
        }).toThrow(/invalid.*definition/i)
      })
    })

    describe('clone()', () => {
      it('clones an existing workflow with a new ID', () => {
        const original = service.create('original-workflow', {
          context: { key: 'value' },
        })

        const cloned = service.clone(original.id, 'cloned-workflow')

        expect(cloned.id).not.toBe(original.id)
        expect(cloned.name).toBe('cloned-workflow')
        expect(cloned.state.context).toEqual({ key: 'value' })
      })

      it('throws for non-existent workflow', () => {
        expect(() => {
          service.clone('non-existent', 'new-name')
        }).toThrow('not found')
      })
    })

    describe('import()', () => {
      it('imports a workflow from a serialized state snapshot', async () => {
        // Create and export a workflow
        const original = service.create('export-test', {
          context: { data: 'important' },
        })
        service.setState(original.id, 'progress', 50)
        const exported = await service.export(original.id)

        // Clear and import
        service.clear()
        const imported = await service.import(exported)

        expect(imported.name).toBe('export-test')
        expect(service.getValue(imported.id, 'progress')).toBe(50)
      })
    })

    describe('export()', () => {
      it('exports a workflow to a serializable format', async () => {
        const info = service.create('export-test', {
          context: { userId: '123' },
        })
        service.setState(info.id, 'step', 'processing')

        const exported = await service.export(info.id)

        expect(exported).toMatchObject({
          name: 'export-test',
          state: expect.objectContaining({
            context: expect.objectContaining({ userId: '123', step: 'processing' }),
          }),
          version: expect.any(Number),
        })
      })

      it('throws for non-existent workflow', async () => {
        await expect(service.export('non-existent')).rejects.toThrow('not found')
      })
    })
  })

  // ===========================================================================
  // 2. Workflow Lifecycle Management
  // ===========================================================================
  describe('Lifecycle RPC Methods', () => {
    describe('pause()', () => {
      it('pauses a running workflow', async () => {
        const info = service.create('pause-test')
        await service.start(info.id)

        await service.pause(info.id)

        const updated = service.get(info.id)
        expect(updated?.started).toBe(false)
        // Paused workflows should retain their state
        expect(service.getState(info.id).context).toBeDefined()
      })

      it('records pause in workflow history', async () => {
        const info = service.create('pause-history-test')
        await service.start(info.id)
        await service.pause(info.id)

        const state = service.getState(info.id)
        expect(state.history).toContainEqual(
          expect.objectContaining({
            type: 'lifecycle',
            action: 'paused',
          })
        )
      })
    })

    describe('resume()', () => {
      it('resumes a paused workflow', async () => {
        const info = service.create('resume-test')
        await service.start(info.id)
        await service.pause(info.id)

        await service.resume(info.id)

        const updated = service.get(info.id)
        expect(updated?.started).toBe(true)
      })
    })

    describe('restart()', () => {
      it('restarts a workflow from the beginning', async () => {
        const info = service.create('restart-test', {
          context: { counter: 0 },
        })
        await service.start(info.id)
        service.setState(info.id, 'counter', 10)

        await service.restart(info.id)

        // After restart, state should be reset but workflow should be running
        const state = service.getState(info.id)
        expect(state.context.counter).toBe(0)
        expect(service.get(info.id)?.started).toBe(true)
      })
    })

    describe('getStatus()', () => {
      it('returns detailed workflow status', () => {
        const info = service.create('status-test')

        const status = service.getStatus(info.id)

        expect(status).toMatchObject({
          id: info.id,
          name: 'status-test',
          started: false,
          paused: false,
          eventsPending: 0,
          lastActivity: expect.any(Date),
        })
      })
    })
  })

  // ===========================================================================
  // 3. Event Emission and Handling
  // ===========================================================================
  describe('Event RPC Methods', () => {
    describe('emitBatch()', () => {
      it('emits multiple events in a single RPC call', () => {
        const info = service.createWithSetup(($) => {
          $.on.Customer.created(() => {})
          $.on.Order.placed(() => {})
        })

        const eventIds = service.emitBatch(info.id, [
          { event: 'Customer.created', data: { id: '1' } },
          { event: 'Order.placed', data: { id: '2' } },
        ])

        expect(eventIds).toHaveLength(2)
        expect(eventIds.every((id) => typeof id === 'string')).toBe(true)
      })

      it('is atomic - all events succeed or none', () => {
        const info = service.create('batch-atomic-test')

        // Emitting to a workflow without handlers should still return event IDs
        // But attempting to batch emit to non-existent workflow should fail all
        expect(() => {
          service.emitBatch('non-existent', [
            { event: 'Test.event1', data: {} },
            { event: 'Test.event2', data: {} },
          ])
        }).toThrow('not found')
      })
    })

    describe('emitWithDelay()', () => {
      it('schedules an event for future emission', async () => {
        const info = service.createWithSetup(($) => {
          $.on.Test.delayed(() => {})
        })

        const scheduledId = await service.emitWithDelay(
          info.id,
          'Test.delayed',
          { value: 42 },
          1000 // 1 second delay
        )

        expect(scheduledId).toBeDefined()
        // The event should not have been processed yet
        const pending = service.getPendingEvents(info.id)
        expect(pending).toContainEqual(
          expect.objectContaining({
            event: 'Test.delayed',
            scheduledFor: expect.any(Date),
          })
        )
      })

      it('supports cancellation of scheduled events', async () => {
        const info = service.create('cancel-test')
        const scheduledId = await service.emitWithDelay(info.id, 'Test.event', {}, 10000)

        const cancelled = await service.cancelScheduledEvent(info.id, scheduledId)

        expect(cancelled).toBe(true)
        const pending = service.getPendingEvents(info.id)
        expect(pending.find((e) => e.id === scheduledId)).toBeUndefined()
      })
    })

    describe('subscribeToEvents()', () => {
      it('returns event stream for a workflow', async () => {
        const info = service.create('subscribe-test')
        const events: Array<{ event: string; data: unknown }> = []

        const subscription = service.subscribeToEvents(info.id, (event, data) => {
          events.push({ event, data })
        })

        service.emit(info.id, 'Test.event', { value: 1 })
        service.emit(info.id, 'Test.event', { value: 2 })

        // Wait for events to be processed
        await new Promise((resolve) => setTimeout(resolve, 100))

        expect(events).toHaveLength(2)
        subscription.unsubscribe()
      })
    })

    describe('getEventHistory()', () => {
      it('returns history of emitted events', () => {
        const info = service.create('history-test')
        service.emit(info.id, 'Test.event1', { a: 1 })
        service.emit(info.id, 'Test.event2', { b: 2 })

        const history = service.getEventHistory(info.id)

        expect(history).toHaveLength(2)
        expect(history[0]).toMatchObject({
          event: 'Test.event1',
          data: { a: 1 },
          timestamp: expect.any(Date),
        })
      })

      it('supports pagination', () => {
        const info = service.create('paginated-history-test')
        for (let i = 0; i < 10; i++) {
          service.emit(info.id, 'Test.event', { i })
        }

        const page1 = service.getEventHistory(info.id, { limit: 5, offset: 0 })
        const page2 = service.getEventHistory(info.id, { limit: 5, offset: 5 })

        expect(page1).toHaveLength(5)
        expect(page2).toHaveLength(5)
        expect(page1[0].data).not.toEqual(page2[0].data)
      })
    })
  })

  // ===========================================================================
  // 4. State Management
  // ===========================================================================
  describe('State RPC Methods', () => {
    describe('getStateSnapshot()', () => {
      it('returns immutable snapshot of current state', () => {
        const info = service.create('snapshot-test', {
          context: { mutable: 'value' },
        })

        const snapshot = service.getStateSnapshot(info.id)

        // Modifying snapshot should not affect actual state
        snapshot.context.mutable = 'changed'
        expect(service.getValue(info.id, 'mutable')).toBe('value')
      })
    })

    describe('mergeState()', () => {
      it('deep merges state updates', () => {
        const info = service.create('merge-test', {
          context: {
            user: { name: 'John', age: 30 },
            settings: { theme: 'dark' },
          },
        })

        service.mergeState(info.id, {
          user: { age: 31, email: 'john@example.com' },
        })

        const state = service.getState(info.id)
        expect(state.context).toEqual({
          user: { name: 'John', age: 31, email: 'john@example.com' },
          settings: { theme: 'dark' },
        })
      })
    })

    describe('deleteValue()', () => {
      it('removes a key from workflow context', () => {
        const info = service.create('delete-test', {
          context: { keep: 'this', remove: 'this' },
        })

        service.deleteValue(info.id, 'remove')

        const state = service.getState(info.id)
        expect(state.context.keep).toBe('this')
        expect(state.context.remove).toBeUndefined()
      })
    })

    describe('hasValue()', () => {
      it('checks if a key exists in context', () => {
        const info = service.create('has-test', {
          context: { exists: true },
        })

        expect(service.hasValue(info.id, 'exists')).toBe(true)
        expect(service.hasValue(info.id, 'missing')).toBe(false)
      })
    })

    describe('getValues()', () => {
      it('returns multiple values in a single call', () => {
        const info = service.create('multi-get-test', {
          context: { a: 1, b: 2, c: 3 },
        })

        const values = service.getValues(info.id, ['a', 'c', 'missing'])

        expect(values).toEqual({ a: 1, c: 3, missing: undefined })
      })
    })

    describe('setValues()', () => {
      it('sets multiple values in a single call', () => {
        const info = service.create('multi-set-test')

        service.setValues(info.id, { x: 10, y: 20, z: 30 })

        expect(service.getValue(info.id, 'x')).toBe(10)
        expect(service.getValue(info.id, 'y')).toBe(20)
        expect(service.getValue(info.id, 'z')).toBe(30)
      })
    })
  })

  // ===========================================================================
  // 5. Query and List Operations
  // ===========================================================================
  describe('Query RPC Methods', () => {
    describe('listByName()', () => {
      it('lists workflows by name pattern', () => {
        service.create('order-workflow-1')
        service.create('order-workflow-2')
        service.create('customer-workflow-1')

        const orderWorkflows = service.listByName('order-*')

        expect(orderWorkflows).toHaveLength(2)
        expect(orderWorkflows.every((id) => id.includes('order'))).toBe(false) // IDs don't contain name
        // Verify by getting the info
        for (const id of orderWorkflows) {
          const info = service.get(id)
          expect(info?.name).toMatch(/^order-workflow/)
        }
      })
    })

    describe('listByStatus()', () => {
      it('lists workflows by running status', async () => {
        const wf1 = service.create('running-1')
        const wf2 = service.create('running-2')
        const wf3 = service.create('stopped-1')

        await service.start(wf1.id)
        await service.start(wf2.id)
        // wf3 not started

        const running = service.listByStatus('running')
        const stopped = service.listByStatus('stopped')

        expect(running).toHaveLength(2)
        expect(stopped).toHaveLength(1)
      })
    })

    describe('count()', () => {
      it('returns total count of workflows', () => {
        service.create('count-1')
        service.create('count-2')
        service.create('count-3')

        expect(service.count()).toBe(3)
      })
    })

    describe('find()', () => {
      it('finds workflows matching a predicate', () => {
        service.create('findable-1', { context: { type: 'order' } })
        service.create('findable-2', { context: { type: 'customer' } })
        service.create('findable-3', { context: { type: 'order' } })

        const orderWorkflows = service.find((info) => info.state.context.type === 'order')

        expect(orderWorkflows).toHaveLength(2)
      })
    })

    describe('getAll()', () => {
      it('returns all workflow info objects', () => {
        service.create('all-1')
        service.create('all-2')

        const all = service.getAll()

        expect(all).toHaveLength(2)
        expect(all[0]).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          started: false,
        })
      })
    })
  })

  // ===========================================================================
  // 6. Batch Operations
  // ===========================================================================
  describe('Batch RPC Methods', () => {
    describe('startBatch()', () => {
      it('starts multiple workflows in a single call', async () => {
        const wf1 = service.create('batch-start-1')
        const wf2 = service.create('batch-start-2')
        const wf3 = service.create('batch-start-3')

        const results = await service.startBatch([wf1.id, wf2.id, wf3.id])

        expect(results.successful).toHaveLength(3)
        expect(results.failed).toHaveLength(0)
        expect(service.get(wf1.id)?.started).toBe(true)
        expect(service.get(wf2.id)?.started).toBe(true)
        expect(service.get(wf3.id)?.started).toBe(true)
      })

      it('reports partial failures', async () => {
        const wf1 = service.create('batch-partial-1')

        const results = await service.startBatch([wf1.id, 'non-existent'])

        expect(results.successful).toContain(wf1.id)
        expect(results.failed).toContainEqual({
          id: 'non-existent',
          error: expect.stringMatching(/not found/i),
        })
      })
    })

    describe('stopBatch()', () => {
      it('stops multiple workflows in a single call', async () => {
        const wf1 = service.create('batch-stop-1')
        const wf2 = service.create('batch-stop-2')
        await service.start(wf1.id)
        await service.start(wf2.id)

        const results = await service.stopBatch([wf1.id, wf2.id])

        expect(results.successful).toHaveLength(2)
        expect(service.get(wf1.id)?.started).toBe(false)
      })
    })

    describe('destroyBatch()', () => {
      it('destroys multiple workflows in a single call', async () => {
        const wf1 = service.create('batch-destroy-1')
        const wf2 = service.create('batch-destroy-2')

        const results = await service.destroyBatch([wf1.id, wf2.id])

        expect(results.successful).toHaveLength(2)
        expect(service.has(wf1.id)).toBe(false)
        expect(service.has(wf2.id)).toBe(false)
      })
    })

    describe('emitToAll()', () => {
      it('emits an event to all workflows', () => {
        service.createWithSetup(($) => {
          $.on.Global.broadcast(() => {})
        })
        service.createWithSetup(($) => {
          $.on.Global.broadcast(() => {})
        })

        const results = service.emitToAll('Global.broadcast', { message: 'hello' })

        expect(results.eventIds).toHaveLength(2)
      })
    })
  })

  // ===========================================================================
  // 7. Workflow Introspection
  // ===========================================================================
  describe('Introspection RPC Methods', () => {
    describe('getDefinition()', () => {
      it('returns the workflow definition', () => {
        const info = service.createWithSetup(($) => {
          $.on.Customer.created(() => {})
          $.on.Order.placed(() => {})
          $.every.hour(() => {})
        })

        const definition = service.getDefinition(info.id)

        expect(definition.events).toContainEqual({ noun: 'Customer', event: 'created' })
        expect(definition.events).toContainEqual({ noun: 'Order', event: 'placed' })
        expect(definition.schedules).toHaveLength(1)
      })
    })

    describe('getRegisteredEvents()', () => {
      it('returns list of events the workflow handles', () => {
        const info = service.createWithSetup(($) => {
          $.on.Customer.created(() => {})
          $.on.Customer.updated(() => {})
          $.on.Order.placed(() => {})
        })

        const events = service.getRegisteredEvents(info.id)

        expect(events).toContain('Customer.created')
        expect(events).toContain('Customer.updated')
        expect(events).toContain('Order.placed')
      })
    })

    describe('getRegisteredSchedules()', () => {
      it('returns list of schedules the workflow handles', () => {
        const info = service.createWithSetup(($) => {
          $.every.hour(() => {})
          $.every.minutes(30)(() => {})
        })

        const schedules = service.getRegisteredSchedules(info.id)

        expect(schedules).toHaveLength(2)
        expect(schedules).toContainEqual(expect.objectContaining({ type: 'hour' }))
        expect(schedules).toContainEqual(expect.objectContaining({ type: 'minute', value: 30 }))
      })
    })

    describe('canHandle()', () => {
      it('checks if a workflow can handle a specific event', () => {
        const info = service.createWithSetup(($) => {
          $.on.Customer.created(() => {})
        })

        expect(service.canHandle(info.id, 'Customer.created')).toBe(true)
        expect(service.canHandle(info.id, 'Order.placed')).toBe(false)
      })
    })
  })

  // ===========================================================================
  // 8. Error Handling and Recovery
  // ===========================================================================
  describe('Error and Recovery RPC Methods', () => {
    describe('getErrors()', () => {
      it('returns list of errors that occurred in workflow', async () => {
        const info = service.createWithSetup(($) => {
          $.on.Test.error(() => {
            throw new Error('Intentional error')
          })
        })

        // Emit event that causes error
        service.emit(info.id, 'Test.error', {})
        await new Promise((resolve) => setTimeout(resolve, 100))

        const errors = service.getErrors(info.id)

        expect(errors).toContainEqual(
          expect.objectContaining({
            message: 'Intentional error',
            event: 'Test.error',
            timestamp: expect.any(Date),
          })
        )
      })
    })

    describe('clearErrors()', () => {
      it('clears error history for a workflow', async () => {
        const info = service.createWithSetup(($) => {
          $.on.Test.error(() => {
            throw new Error('Error')
          })
        })

        service.emit(info.id, 'Test.error', {})
        await new Promise((resolve) => setTimeout(resolve, 100))

        service.clearErrors(info.id)

        expect(service.getErrors(info.id)).toHaveLength(0)
      })
    })

    describe('retry()', () => {
      it('retries the last failed operation', async () => {
        let attempts = 0
        const info = service.createWithSetup(($) => {
          $.on.Test.retry(() => {
            attempts++
            if (attempts < 2) {
              throw new Error('Retry me')
            }
          })
        })

        service.emit(info.id, 'Test.retry', {})
        await new Promise((resolve) => setTimeout(resolve, 100))

        const result = await service.retry(info.id)

        expect(result.success).toBe(true)
        expect(attempts).toBe(2)
      })
    })

    describe('setErrorHandler()', () => {
      it('sets a global error handler for workflow', () => {
        const errors: Error[] = []
        const info = service.createWithSetup(($) => {
          $.on.Test.error(() => {
            throw new Error('Caught error')
          })
        })

        service.setErrorHandler(info.id, (error) => {
          errors.push(error)
        })

        service.emit(info.id, 'Test.error', {})

        // Error handler should be called
        expect(errors).toHaveLength(1)
        expect(errors[0].message).toBe('Caught error')
      })
    })
  })

  // ===========================================================================
  // 9. Metrics and Observability
  // ===========================================================================
  describe('Metrics RPC Methods', () => {
    describe('getMetrics()', () => {
      it('returns workflow execution metrics', () => {
        const info = service.create('metrics-test')
        service.emit(info.id, 'Test.event1', {})
        service.emit(info.id, 'Test.event2', {})

        const metrics = service.getMetrics(info.id)

        expect(metrics).toMatchObject({
          eventsProcessed: expect.any(Number),
          eventsEmitted: expect.any(Number),
          errorCount: expect.any(Number),
          uptime: expect.any(Number),
          lastEventAt: expect.any(Date),
        })
      })
    })

    describe('getAggregateMetrics()', () => {
      it('returns aggregate metrics across all workflows', () => {
        service.create('agg-1')
        service.create('agg-2')
        service.emit(service.list()[0], 'Test.event', {})

        const metrics = service.getAggregateMetrics()

        expect(metrics).toMatchObject({
          totalWorkflows: 2,
          runningWorkflows: 0,
          totalEventsProcessed: expect.any(Number),
          totalErrors: expect.any(Number),
        })
      })
    })

    describe('resetMetrics()', () => {
      it('resets metrics for a workflow', () => {
        const info = service.create('reset-metrics-test')
        service.emit(info.id, 'Test.event', {})

        service.resetMetrics(info.id)

        const metrics = service.getMetrics(info.id)
        expect(metrics.eventsProcessed).toBe(0)
      })
    })
  })

  // ===========================================================================
  // 10. Serialization for RPC
  // ===========================================================================
  describe('RPC Serialization', () => {
    describe('toJSON()', () => {
      it('serializes workflow info to JSON-safe format', () => {
        const info = service.create('json-test', {
          context: { date: new Date(), func: () => {} },
        })

        const json = service.toJSON(info.id)
        const parsed = JSON.parse(JSON.stringify(json))

        expect(parsed.id).toBe(info.id)
        expect(parsed.name).toBe('json-test')
        // Functions should be excluded
        expect(parsed.state.context.func).toBeUndefined()
        // Dates should be serialized
        expect(typeof parsed.state.context.date).toBe('string')
      })
    })

    describe('describe()', () => {
      it('returns RPC interface description', () => {
        const description = service.describe()

        expect(description.methods).toContain('create')
        expect(description.methods).toContain('start')
        expect(description.methods).toContain('emit')
        expect(description.version).toBeDefined()
      })
    })
  })
})

// =============================================================================
// WorkflowService WorkerEntrypoint Tests
// =============================================================================
describe('RPC Surface: WorkflowService (WorkerEntrypoint)', () => {
  describe('connect() with options', () => {
    it('accepts configuration options', () => {
      // This tests that connect() can accept optional configuration
      // Note: We can't fully test WorkerEntrypoint without Workers runtime
      expect(typeof WorkflowService.prototype.connect).toBe('function')
    })
  })

  describe('RPC method signatures', () => {
    it('all methods are callable via RPC', () => {
      const service = new WorkflowServiceCore()

      // Verify all expected RPC methods exist
      const expectedMethods = [
        // Creation
        'create',
        'createWithSetup',
        'createFromDefinition',
        'clone',
        'import',
        'export',
        // Lifecycle
        'start',
        'stop',
        'pause',
        'resume',
        'restart',
        'destroy',
        'getStatus',
        // Events
        'emit',
        'emitBatch',
        'emitWithDelay',
        'cancelScheduledEvent',
        'getPendingEvents',
        'subscribeToEvents',
        'getEventHistory',
        'sendGlobal',
        // State
        'getState',
        'setState',
        'getValue',
        'getStateSnapshot',
        'mergeState',
        'deleteValue',
        'hasValue',
        'getValues',
        'setValues',
        // Query
        'get',
        'list',
        'has',
        'listByName',
        'listByStatus',
        'count',
        'find',
        'getAll',
        // Batch
        'startBatch',
        'stopBatch',
        'destroyBatch',
        'emitToAll',
        // Introspection
        'getDefinition',
        'getRegisteredEvents',
        'getRegisteredSchedules',
        'canHandle',
        // Errors
        'getErrors',
        'clearErrors',
        'retry',
        'setErrorHandler',
        // Metrics
        'getMetrics',
        'getAggregateMetrics',
        'resetMetrics',
        // Utilities
        'parseEvent',
        'toCron',
        'intervalToMs',
        'formatInterval',
        'createTestContext',
        'clear',
        'toJSON',
        'describe',
        // Global handlers
        'registerGlobalEvent',
        'registerGlobalSchedule',
        'getGlobalEventHandlers',
        'getGlobalScheduleHandlers',
        'clearGlobalEventHandlers',
        'clearGlobalScheduleHandlers',
        // State persistence
        'hasStatePersistence',
        'getStateAdapter',
        'persistState',
        'loadPersistedState',
        'saveCheckpoint',
        'getCheckpoint',
        'updateStateWithVersion',
        'queryByStatus',
        'queryByIds',
        'deletePersistedState',
        'listPersistedWorkflows',
        'createSnapshot',
        'restoreSnapshot',
        'getSnapshots',
        // WorkflowBuilder
        'registerWorkflow',
      ]

      for (const method of expectedMethods) {
        expect(
          typeof (service as Record<string, unknown>)[method],
          `Method ${method} should exist`
        ).toBe('function')
      }

      service.clear()
    })
  })
})
