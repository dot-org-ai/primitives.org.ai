import { describe, it, expect, beforeEach } from 'vitest'
import { getLocalTestService, createTestServiceBinding } from '../src/local.js'
import { TestServiceCore } from '../src/worker.js'

describe('local', () => {
  describe('getLocalTestService()', () => {
    it('returns a TestServiceCore instance', () => {
      const service = getLocalTestService()
      expect(service).toBeInstanceOf(TestServiceCore)
    })

    it('returns the same instance on subsequent calls', () => {
      const service1 = getLocalTestService()
      const service2 = getLocalTestService()
      expect(service1).toBe(service2)
    })
  })

  describe('createTestServiceBinding()', () => {
    it('returns a TestServiceCore instance', () => {
      const service = createTestServiceBinding()
      expect(service).toBeInstanceOf(TestServiceCore)
    })

    it('returns a new instance each time', () => {
      const service1 = createTestServiceBinding()
      const service2 = createTestServiceBinding()
      expect(service1).not.toBe(service2)
    })
  })
})
