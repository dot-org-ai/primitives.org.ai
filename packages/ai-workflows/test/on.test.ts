import { describe, it, expect, beforeEach } from 'vitest'
import { on, registerEventHandler, getEventHandlers, clearEventHandlers } from '../src/on.js'

describe('on - event handler registration', () => {
  beforeEach(() => {
    clearEventHandlers()
  })

  describe('on.Noun.event pattern', () => {
    it('should register handler for Customer.created', () => {
      const handler = () => {}
      on.Customer.created(handler)

      const handlers = getEventHandlers()
      expect(handlers).toHaveLength(1)
      expect(handlers[0]?.noun).toBe('Customer')
      expect(handlers[0]?.event).toBe('created')
      expect(handlers[0]?.handler).toBe(handler)
      expect(handlers[0]?.source).toBeDefined()
    })

    it('should register handler for Order.completed', () => {
      const handler = () => {}
      on.Order.completed(handler)

      const handlers = getEventHandlers()
      expect(handlers).toHaveLength(1)
      expect(handlers[0]?.noun).toBe('Order')
      expect(handlers[0]?.event).toBe('completed')
    })

    it('should register multiple handlers', () => {
      on.Customer.created(() => {})
      on.Customer.updated(() => {})
      on.Order.completed(() => {})

      const handlers = getEventHandlers()
      expect(handlers).toHaveLength(3)
    })

    it('should register multiple handlers for same event', () => {
      on.Customer.created(() => {})
      on.Customer.created(() => {})

      const handlers = getEventHandlers()
      expect(handlers).toHaveLength(2)
      expect(handlers[0]?.noun).toBe('Customer')
      expect(handlers[0]?.event).toBe('created')
      expect(handlers[1]?.noun).toBe('Customer')
      expect(handlers[1]?.event).toBe('created')
    })

    it('should capture function source code', () => {
      on.Test.event(async (data, $) => {
        $.log('test', data)
      })

      const handlers = getEventHandlers()
      expect(handlers[0]?.source).toContain('$.log')
    })
  })

  describe('registerEventHandler', () => {
    it('should register handler directly', () => {
      const handler = () => {}
      registerEventHandler('Payment', 'failed', handler)

      const handlers = getEventHandlers()
      expect(handlers).toHaveLength(1)
      expect(handlers[0]?.noun).toBe('Payment')
      expect(handlers[0]?.event).toBe('failed')
      expect(handlers[0]?.handler).toBe(handler)
    })
  })

  describe('clearEventHandlers', () => {
    it('should clear all handlers', () => {
      on.Customer.created(() => {})
      on.Order.completed(() => {})

      expect(getEventHandlers()).toHaveLength(2)

      clearEventHandlers()

      expect(getEventHandlers()).toHaveLength(0)
    })
  })

  describe('getEventHandlers', () => {
    it('should return a copy of handlers array', () => {
      on.Customer.created(() => {})

      const handlers1 = getEventHandlers()
      const handlers2 = getEventHandlers()

      expect(handlers1).not.toBe(handlers2)
      expect(handlers1).toEqual(handlers2)
    })
  })
})
