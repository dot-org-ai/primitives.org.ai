/**
 * WorkflowRuntime tests
 *
 * The runtime is the single owner of the `$` runtime contract. These tests
 * exercise the full handler surface through `runtime.dispatch` — the
 * canonical test seam established by aip-k9uy.
 *
 * Old per-module tests (cascade-context, database-context, on/send/every)
 * remain for unit-level coverage of the internal seams; this file is the
 * interface-level test that pins the consolidated contract.
 */

import { describe, it, expect, vi } from 'vitest'
import { createWorkflowRuntime, parseEvent, type WorkflowRuntime } from '../src/runtime.js'
import { createMemoryDatabaseContext } from '../src/database-context.js'

describe('WorkflowRuntime', () => {
  describe('construction', () => {
    it('creates a runtime with a $ context', () => {
      const runtime = createWorkflowRuntime()
      expect(runtime.$).toBeDefined()
      expect(runtime.$.send).toBeInstanceOf(Function)
      expect(runtime.$.do).toBeInstanceOf(Function)
      expect(runtime.$.try).toBeInstanceOf(Function)
      expect(runtime.$.track).toBeInstanceOf(Function)
      expect(runtime.$.on).toBeDefined()
      expect(runtime.$.every).toBeDefined()
      expect(runtime.$.state).toBeDefined()
      expect(runtime.$.log).toBeInstanceOf(Function)
    })

    it('starts with an empty event registry', () => {
      const runtime = createWorkflowRuntime()
      expect(runtime.getEventRegistry()).toEqual([])
      expect(runtime.getScheduleRegistry()).toEqual([])
    })

    it('seeds state context from options', () => {
      const runtime = createWorkflowRuntime({ context: { count: 7 } })
      expect(runtime.$.state.count).toBe(7)
      expect(runtime.$.get('count')).toBe(7)
    })

    it('exposes a cascade context for tracing', () => {
      const runtime = createWorkflowRuntime({ name: 'test' })
      expect(runtime.cascade).toBeDefined()
      expect(runtime.cascade.correlationId).toBeDefined()
      expect(runtime.cascade.name).toBe('test')
    })

    it('attaches the injected DatabaseContext to $.db', () => {
      const db = createMemoryDatabaseContext()
      const runtime = createWorkflowRuntime({ db })
      expect(runtime.$.db).toBe(db)
    })

    it('omits $.db when no database is wired', () => {
      const runtime = createWorkflowRuntime()
      expect(runtime.$.db).toBeUndefined()
    })
  })

  describe('register + dispatch (canonical test surface)', () => {
    it('delivers an event to a registered handler', async () => {
      const runtime = createWorkflowRuntime()
      const handler = vi.fn()

      runtime.register('Order', 'placed', handler)
      await runtime.dispatch('Order.placed', { id: 'o-1' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        { id: 'o-1' },
        expect.objectContaining({ send: expect.any(Function) })
      )
    })

    it('delivers an event to all matching handlers', async () => {
      const runtime = createWorkflowRuntime()
      const a = vi.fn()
      const b = vi.fn()
      runtime.register('Order', 'placed', a)
      runtime.register('Order', 'placed', b)

      await runtime.dispatch('Order.placed', { id: 'o-1' })

      expect(a).toHaveBeenCalledTimes(1)
      expect(b).toHaveBeenCalledTimes(1)
    })

    it('returns silently when no handler matches', async () => {
      const runtime = createWorkflowRuntime()
      await expect(runtime.dispatch('Nothing.here', {})).resolves.toBeUndefined()
    })

    it('warns and skips invalid event names', async () => {
      const runtime = createWorkflowRuntime()
      const handler = vi.fn()
      runtime.register('Order', 'placed', handler)

      await runtime.dispatch('not-a-valid-event', {})
      expect(handler).not.toHaveBeenCalled()
    })

    it('isolates handler errors so siblings still run', async () => {
      const runtime = createWorkflowRuntime()
      const failing = vi.fn().mockRejectedValue(new Error('boom'))
      const ok = vi.fn()
      runtime.register('Order', 'placed', failing)
      runtime.register('Order', 'placed', ok)

      await runtime.dispatch('Order.placed', { id: 'o-1' })
      expect(failing).toHaveBeenCalled()
      expect(ok).toHaveBeenCalled()
    })
  })

  describe('register via $.on (proxy surface)', () => {
    it('captures handlers registered through $.on.Noun.event', async () => {
      const runtime = createWorkflowRuntime()
      const handler = vi.fn()

      runtime.$.on.Customer.created(handler)

      expect(runtime.getEventRegistry()).toHaveLength(1)
      expect(runtime.getEventRegistry()[0]).toMatchObject({
        noun: 'Customer',
        event: 'created',
      })

      await runtime.dispatch('Customer.created', { id: 'c-1' })
      expect(handler).toHaveBeenCalled()
    })

    it('routes $.send through the runtime dispatch', async () => {
      const runtime = createWorkflowRuntime()
      const handler = vi.fn()
      runtime.$.on.Email.welcome(handler)

      runtime.$.send('Email.welcome', { to: 'a@b.com' })
      // Allow the microtask queue to flush
      await new Promise((r) => setTimeout(r, 0))

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler.mock.calls[0]?.[0]).toMatchObject({ to: 'a@b.com' })
    })
  })

  describe('execute (do / try semantics)', () => {
    it('returns the first matching handler result for $.try', async () => {
      const runtime = createWorkflowRuntime()
      runtime.register('Math', 'add', async (data: { a: number; b: number }) => {
        return data.a + data.b
      })

      const result = await runtime.$.try<number>('Math.add', { a: 2, b: 3 })
      expect(result).toBe(5)
    })

    it('records an action on $.do when a database is wired', async () => {
      const db = createMemoryDatabaseContext()
      const runtime = createWorkflowRuntime({ db })
      runtime.register('Math', 'add', async (data: { a: number; b: number }) => {
        return data.a + data.b
      })

      const result = await runtime.$.do<number>('Math.add', { a: 2, b: 3 })
      expect(result).toBe(5)
      // recordEvent + createAction were both invoked durably
      const events = await db.getEvents()
      expect(events.length).toBeGreaterThan(0)
    })

    it('throws when no handler is registered for $.try', async () => {
      const runtime = createWorkflowRuntime()
      await expect(runtime.$.try('Missing.handler', {})).rejects.toThrow(/No handler/)
    })

    it('throws on invalid event format', async () => {
      const runtime = createWorkflowRuntime()
      await expect(runtime.execute('bad', {}, false)).rejects.toThrow(/Invalid event format/)
    })
  })

  describe('state + history', () => {
    it('mutates state via $.set / $.get', () => {
      const runtime = createWorkflowRuntime()
      runtime.$.set('user', { id: 'u-1' })
      expect(runtime.$.get<{ id: string }>('user')).toEqual({ id: 'u-1' })
    })

    it('records send + log into history', async () => {
      const runtime = createWorkflowRuntime()
      runtime.$.send('Order.placed', { id: 'o-1' })
      runtime.$.log('hi')
      const state = runtime.$.getState()
      expect(state.history.length).toBeGreaterThanOrEqual(2)
      expect(state.history[0]?.type).toBe('event')
      expect(state.history[1]?.type).toBe('action')
    })

    it('returns a deep copy from getState (no mutation leak)', () => {
      const runtime = createWorkflowRuntime()
      runtime.$.set('k', 'v1')
      const snapshot = runtime.$.getState()
      snapshot.context.k = 'mutated'
      expect(runtime.$.get('k')).toBe('v1')
    })
  })

  describe('schedule registration', () => {
    it('captures schedule handlers via $.every', () => {
      const runtime = createWorkflowRuntime()
      runtime.$.every.hour(() => {})
      runtime.$.every.Monday.at9am(() => {})

      expect(runtime.getScheduleRegistry()).toHaveLength(2)
      expect(runtime.getScheduleRegistry()[0]?.interval).toMatchObject({
        type: 'cron',
        natural: 'hour',
      })
    })

    it('registers schedules via runtime.registerSchedule directly', () => {
      const runtime = createWorkflowRuntime()
      runtime.registerSchedule({ type: 'minute', value: 5 }, () => {})
      expect(runtime.getScheduleRegistry()).toHaveLength(1)
    })
  })

  describe('parseEvent (re-exported convenience)', () => {
    it('parses Noun.event form', () => {
      expect(parseEvent('Order.placed')).toEqual({ noun: 'Order', event: 'placed' })
    })

    it('rejects malformed input', () => {
      expect(parseEvent('justaword')).toBeNull()
      expect(parseEvent('a.b.c')).toBeNull()
      expect(parseEvent('')).toBeNull()
    })
  })

  describe('shape of WorkflowRuntime export', () => {
    it('exposes the documented surface and nothing extra', () => {
      const runtime: WorkflowRuntime = createWorkflowRuntime()
      const keys = Object.keys(runtime).sort()
      expect(keys).toEqual(
        [
          '$',
          'cascade',
          'dispatch',
          'execute',
          'getEventRegistry',
          'getScheduleRegistry',
          'register',
          'registerSchedule',
          'state',
        ].sort()
      )
    })
  })
})
