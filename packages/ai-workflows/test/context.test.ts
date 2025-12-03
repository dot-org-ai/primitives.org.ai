import { describe, it, expect, vi } from 'vitest'
import { createWorkflowContext, createIsolatedContext } from '../src/context.js'

describe('context - workflow context', () => {
  describe('createWorkflowContext', () => {
    it('should create a context with all required methods', () => {
      const eventBus = { emit: vi.fn() }
      const ctx = createWorkflowContext(eventBus)

      expect(ctx).toHaveProperty('send')
      expect(ctx).toHaveProperty('getState')
      expect(ctx).toHaveProperty('set')
      expect(ctx).toHaveProperty('get')
      expect(ctx).toHaveProperty('log')
    })

    it('should emit events through the event bus', async () => {
      const eventBus = { emit: vi.fn() }
      const ctx = createWorkflowContext(eventBus)

      await ctx.send('Customer.created', { id: '123' })

      expect(eventBus.emit).toHaveBeenCalledWith('Customer.created', { id: '123' })
    })

    it('should track events in history', async () => {
      const eventBus = { emit: vi.fn() }
      const ctx = createWorkflowContext(eventBus)

      await ctx.send('Customer.created', { id: '123' })

      const state = ctx.getState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0]).toMatchObject({
        type: 'event',
        name: 'Customer.created',
        data: { id: '123' },
      })
      expect(state.history[0]?.timestamp).toBeGreaterThan(0)
    })

    it('should store and retrieve context data', () => {
      const eventBus = { emit: vi.fn() }
      const ctx = createWorkflowContext(eventBus)

      ctx.set('userId', '123')
      ctx.set('counter', 42)

      expect(ctx.get('userId')).toBe('123')
      expect(ctx.get('counter')).toBe(42)
      expect(ctx.get('nonexistent')).toBeUndefined()
    })

    it('should return typed values from get', () => {
      const eventBus = { emit: vi.fn() }
      const ctx = createWorkflowContext(eventBus)

      ctx.set('user', { name: 'John', age: 30 })

      const user = ctx.get<{ name: string; age: number }>('user')
      expect(user?.name).toBe('John')
      expect(user?.age).toBe(30)
    })

    it('should include context data in state', () => {
      const eventBus = { emit: vi.fn() }
      const ctx = createWorkflowContext(eventBus)

      ctx.set('key1', 'value1')
      ctx.set('key2', 'value2')

      const state = ctx.getState()
      expect(state.context).toEqual({
        key1: 'value1',
        key2: 'value2',
      })
    })

    it('should return a copy of state to prevent mutation', () => {
      const eventBus = { emit: vi.fn() }
      const ctx = createWorkflowContext(eventBus)

      ctx.set('key', 'original')

      const state1 = ctx.getState()
      state1.context.key = 'mutated'

      const state2 = ctx.getState()
      expect(state2.context.key).toBe('original')
    })

    it('should log messages with history tracking', () => {
      const eventBus = { emit: vi.fn() }
      const ctx = createWorkflowContext(eventBus)

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      ctx.log('Test message', { extra: 'data' })

      expect(consoleSpy).toHaveBeenCalled()

      const state = ctx.getState()
      expect(state.history).toHaveLength(1)
      expect(state.history[0]).toMatchObject({
        type: 'action',
        name: 'log',
        data: { message: 'Test message', data: { extra: 'data' } },
      })

      consoleSpy.mockRestore()
    })
  })

  describe('createIsolatedContext', () => {
    it('should create a context not connected to real event bus', async () => {
      const ctx = createIsolatedContext()

      // Should not throw
      await ctx.send('Test.event', { data: 'test' })

      // Should track the event
      const emittedEvents = (ctx as any).getEmittedEvents()
      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0]).toEqual({
        event: 'Test.event',
        data: { data: 'test' },
      })
    })

    it('should track multiple emitted events', async () => {
      const ctx = createIsolatedContext()

      await ctx.send('Event1', { a: 1 })
      await ctx.send('Event2', { b: 2 })
      await ctx.send('Event3', { c: 3 })

      const emittedEvents = (ctx as any).getEmittedEvents()
      expect(emittedEvents).toHaveLength(3)
    })

    it('should have all standard context methods', () => {
      const ctx = createIsolatedContext()

      expect(typeof ctx.send).toBe('function')
      expect(typeof ctx.getState).toBe('function')
      expect(typeof ctx.set).toBe('function')
      expect(typeof ctx.get).toBe('function')
      expect(typeof ctx.log).toBe('function')
    })
  })
})
