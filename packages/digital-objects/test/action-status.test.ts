import { describe, it, expect } from 'vitest'
import { ActionStatus, MemoryProvider } from '../src/index.js'

describe('ActionStatus Constants', () => {
  describe('ActionStatus export', () => {
    it('should export ActionStatus const object from types', () => {
      expect(ActionStatus).toBeDefined()
      expect(typeof ActionStatus).toBe('object')
    })

    it('should have COMPLETED equal to "completed"', () => {
      expect(ActionStatus.COMPLETED).toBe('completed')
    })

    it('should have PENDING equal to "pending"', () => {
      expect(ActionStatus.PENDING).toBe('pending')
    })

    it('should have ACTIVE equal to "active"', () => {
      expect(ActionStatus.ACTIVE).toBe('active')
    })

    it('should have FAILED equal to "failed"', () => {
      expect(ActionStatus.FAILED).toBe('failed')
    })

    it('should have CANCELLED equal to "cancelled"', () => {
      expect(ActionStatus.CANCELLED).toBe('cancelled')
    })
  })

  describe('ActionStatus usage in perform()', () => {
    it('should return action with status equal to ActionStatus.COMPLETED', async () => {
      const provider = new MemoryProvider()
      await provider.defineVerb({ name: 'create' })

      const action = await provider.perform('create')

      expect(action.status).toBe(ActionStatus.COMPLETED)
    })
  })
})
