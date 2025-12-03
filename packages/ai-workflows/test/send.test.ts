import { describe, it, expect, beforeEach, vi } from 'vitest'
import { send, parseEvent } from '../src/send.js'
import { on, clearEventHandlers } from '../src/on.js'

describe('send - event emission', () => {
  beforeEach(() => {
    clearEventHandlers()
  })

  describe('parseEvent', () => {
    it('should parse valid event strings', () => {
      expect(parseEvent('Customer.created')).toEqual({
        noun: 'Customer',
        event: 'created',
      })

      expect(parseEvent('Order.completed')).toEqual({
        noun: 'Order',
        event: 'completed',
      })

      expect(parseEvent('Payment.failed')).toEqual({
        noun: 'Payment',
        event: 'failed',
      })
    })

    it('should return null for invalid event strings', () => {
      expect(parseEvent('invalid')).toBeNull()
      expect(parseEvent('too.many.parts')).toBeNull()
      expect(parseEvent('')).toBeNull()
      expect(parseEvent('.')).toBeNull()
    })
  })

  describe('send', () => {
    it('should emit event to registered handler', async () => {
      const handler = vi.fn()
      on.Customer.created(handler)

      await send('Customer.created', { id: '123', name: 'John' })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        { id: '123', name: 'John' },
        expect.objectContaining({
          send: expect.any(Function),
          getState: expect.any(Function),
          set: expect.any(Function),
          get: expect.any(Function),
          log: expect.any(Function),
        })
      )
    })

    it('should emit event to multiple handlers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      on.Customer.created(handler1)
      on.Customer.created(handler2)

      await send('Customer.created', { id: '123' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should not throw when no handlers are registered', async () => {
      await expect(send('Customer.created', { id: '123' })).resolves.not.toThrow()
    })

    it('should not call handlers for different events', async () => {
      const handler = vi.fn()
      on.Customer.updated(handler)

      await send('Customer.created', { id: '123' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('should not call handlers for different nouns', async () => {
      const handler = vi.fn()
      on.Order.created(handler)

      await send('Customer.created', { id: '123' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle async handlers', async () => {
      let completed = false
      on.Customer.created(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        completed = true
      })

      await send('Customer.created', { id: '123' })

      expect(completed).toBe(true)
    })

    it('should continue with other handlers if one throws', async () => {
      const handler1 = vi.fn().mockRejectedValue(new Error('Handler 1 failed'))
      const handler2 = vi.fn()

      on.Customer.created(handler1)
      on.Customer.created(handler2)

      // Should not throw
      await expect(send('Customer.created', { id: '123' })).resolves.not.toThrow()

      // Both handlers should be called
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })
})
