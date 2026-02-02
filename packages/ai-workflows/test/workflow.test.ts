import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Workflow, createTestContext, parseEvent } from '../src/workflow.js'
import { clearEventHandlers } from '../src/on.js'
import { clearScheduleHandlers } from '../src/every.js'

describe('Workflow - unified $ API', () => {
  beforeEach(() => {
    clearEventHandlers()
    clearScheduleHandlers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Workflow()', () => {
    it('should create a workflow with $ context', () => {
      const workflow = Workflow(($) => {
        // Just accessing $ to verify it works
        expect($).toBeDefined()
        expect($.on).toBeDefined()
        expect($.every).toBeDefined()
        expect($.send).toBeDefined()
        expect($.log).toBeDefined()
        expect($.get).toBeDefined()
        expect($.set).toBeDefined()
        expect($.getState).toBeDefined()
      })

      expect(workflow).toBeDefined()
      expect(workflow.$).toBeDefined()
      expect(workflow.send).toBeDefined()
      expect(workflow.start).toBeDefined()
      expect(workflow.stop).toBeDefined()
    })

    it('should capture event handlers registered via $.on', () => {
      const workflow = Workflow(($) => {
        $.on.Customer.created(() => {})
        $.on.Order.completed(() => {})
      })

      expect(workflow.definition.events).toHaveLength(2)
      expect(workflow.definition.events[0]?.noun).toBe('Customer')
      expect(workflow.definition.events[0]?.event).toBe('created')
      expect(workflow.definition.events[1]?.noun).toBe('Order')
      expect(workflow.definition.events[1]?.event).toBe('completed')
    })

    it('should capture schedule handlers registered via $.every', () => {
      const workflow = Workflow(($) => {
        $.every.hour(() => {})
        $.every.Monday.at9am(() => {})
      })

      expect(workflow.definition.schedules).toHaveLength(2)
    })

    it('should capture function source code', () => {
      const workflow = Workflow(($) => {
        $.on.Test.event(async (data, ctx) => {
          ctx.log('Test event', data)
        })
      })

      // Source code is captured (variable names may be minified)
      expect(workflow.definition.events[0]?.source).toBeDefined()
      expect(workflow.definition.events[0]?.source.length).toBeGreaterThan(0)
      expect(workflow.definition.events[0]?.source).toContain('Test event')
    })

    it('should deliver events to registered handlers', async () => {
      const handler = vi.fn()

      const workflow = Workflow(($) => {
        $.on.Customer.created(handler)
      })

      await workflow.start()
      await workflow.send('Customer.created', { id: '123', name: 'John' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: '123', name: 'John' }),
        expect.objectContaining({
          send: expect.any(Function),
          log: expect.any(Function),
        })
      )
    })

    it('should allow chained event sending from handlers', async () => {
      const welcomeHandler = vi.fn()

      const workflow = Workflow(($) => {
        $.on.Customer.created(async (customer, $) => {
          await $.send('Email.welcome', { to: customer.email })
        })

        $.on.Email.welcome(welcomeHandler)
      })

      await workflow.start()
      await workflow.send('Customer.created', { name: 'John', email: 'john@example.com' })

      expect(welcomeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'john@example.com' }),
        expect.anything()
      )
    })

    it('should track events in state history', async () => {
      const workflow = Workflow(($) => {
        $.on.Test.event(() => {})
      })

      await workflow.start()
      await workflow.send('Test.event', { data: 'test' })

      expect(workflow.state.history).toHaveLength(1)
      expect(workflow.state.history[0]).toMatchObject({
        type: 'event',
        name: 'Test.event',
        data: { data: 'test' },
      })
    })

    it('should trigger schedule handlers', async () => {
      const handler = vi.fn()

      const workflow = Workflow(($) => {
        $.every.seconds(1)(handler)
      })

      await workflow.start()
      await vi.advanceTimersByTimeAsync(1000)

      expect(handler).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).toHaveBeenCalledTimes(2)

      await workflow.stop()
    })

    it('should stop schedule handlers on stop', async () => {
      const handler = vi.fn()

      const workflow = Workflow(($) => {
        $.every.seconds(1)(handler)
      })

      await workflow.start()
      await vi.advanceTimersByTimeAsync(1000)
      expect(handler).toHaveBeenCalledTimes(1)

      await workflow.stop()
      await vi.advanceTimersByTimeAsync(5000)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should support $.set and $.get for context data', async () => {
      const workflow = Workflow(($) => {
        $.on.Test.set(async (data, $) => {
          $.set('value', data.value)
        })

        $.on.Test.get(async (_, $) => {
          const value = $.get<number>('value')
          $.log('Got value', value)
        })
      })

      await workflow.start()
      await workflow.send('Test.set', { value: 42 })

      expect(workflow.state.context.value).toBe(42)
      expect(workflow.$.get('value')).toBe(42)
    })

    it('should use initial context from options', () => {
      const workflow = Workflow(($) => {}, { context: { counter: 100 } })

      expect(workflow.state.context.counter).toBe(100)
    })
  })

  describe('parseEvent', () => {
    it('should parse valid event strings', () => {
      expect(parseEvent('Customer.created')).toEqual({
        noun: 'Customer',
        event: 'created',
      })
    })

    it('should return null for invalid event strings', () => {
      expect(parseEvent('invalid')).toBeNull()
      expect(parseEvent('too.many.parts')).toBeNull()
      expect(parseEvent('')).toBeNull()
    })
  })

  describe('createTestContext', () => {
    it('should create a $ context for testing', () => {
      const $ = createTestContext()

      expect($.send).toBeDefined()
      expect($.on).toBeDefined()
      expect($.every).toBeDefined()
      expect($.log).toBeDefined()
      expect($.get).toBeDefined()
      expect($.set).toBeDefined()
      expect($.getState).toBeDefined()
      expect($.emittedEvents).toBeDefined()
    })

    it('should track emitted events', async () => {
      const $ = createTestContext()

      await $.send('Test.event1', { a: 1 })
      await $.send('Test.event2', { b: 2 })

      expect($.emittedEvents).toHaveLength(2)
      expect($.emittedEvents[0]).toEqual({
        event: 'Test.event1',
        data: expect.objectContaining({ a: 1 }),
      })
      expect($.emittedEvents[1]).toEqual({
        event: 'Test.event2',
        data: expect.objectContaining({ b: 2 }),
      })
    })

    it('should support get/set', () => {
      const $ = createTestContext()

      $.set('key', 'value')
      expect($.get('key')).toBe('value')
    })
  })

  describe('$.every patterns', () => {
    it('should support $.every.hour', () => {
      const workflow = Workflow(($) => {
        $.every.hour(() => {})
      })

      expect(workflow.definition.schedules[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 * * * *',
        natural: 'hour',
      })
    })

    it('should support $.every.Monday.at9am', () => {
      const workflow = Workflow(($) => {
        $.every.Monday.at9am(() => {})
      })

      expect(workflow.definition.schedules[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 9 * * 1',
        natural: 'Monday.at9am',
      })
    })

    it('should support $.every.minutes(30)', () => {
      const workflow = Workflow(($) => {
        $.every.minutes(30)(() => {})
      })

      expect(workflow.definition.schedules[0]?.interval).toEqual({
        type: 'minute',
        value: 30,
        natural: '30 minutes',
      })
    })

    it('should support $.every("natural language")', () => {
      const workflow = Workflow(($) => {
        $.every('first Monday of the month', () => {})
      })

      expect(workflow.definition.schedules[0]?.interval).toEqual({
        type: 'natural',
        description: 'first Monday of the month',
      })
    })
  })
})
