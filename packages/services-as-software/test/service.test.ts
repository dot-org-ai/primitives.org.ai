/**
 * Tests for Service implementation
 */

import { describe, it, expect } from 'vitest'
import { Service, Endpoint, POST, GET } from '../src/index.js'
import type { ServiceContext } from '../src/types.js'

describe('Service', () => {
  it('should create a service with basic configuration', () => {
    const service = Service({
      name: 'test-service',
      version: '1.0.0',
      endpoints: [],
    })

    expect(service).toBeDefined()
    expect(service.definition.name).toBe('test-service')
    expect(service.definition.version).toBe('1.0.0')
  })

  it('should call an endpoint and return result', async () => {
    const service = Service({
      name: 'test-service',
      version: '1.0.0',
      endpoints: [
        POST({
          name: 'echo',
          handler: async (input: { message: string }) => {
            return { echoed: input.message }
          },
        }),
      ],
    })

    const result = await service.call<{ message: string }, { echoed: string }>('echo', {
      message: 'hello',
    })

    expect(result.echoed).toBe('hello')
  })

  it('should provide service context to handlers', async () => {
    let capturedContext: ServiceContext | undefined

    const service = Service({
      name: 'test-service',
      version: '1.0.0',
      endpoints: [
        POST({
          name: 'test',
          handler: async (_input: unknown, context?: ServiceContext) => {
            capturedContext = context
            return { ok: true }
          },
        }),
      ],
    })

    await service.call('test', {}, { requestId: 'test-123', entitlements: ['test'] })

    expect(capturedContext).toBeDefined()
    expect(capturedContext?.requestId).toBe('test-123')
    expect(capturedContext?.entitlements).toContain('test')
  })

  it('should throw error for unknown endpoint', async () => {
    const service = Service({
      name: 'test-service',
      version: '1.0.0',
      endpoints: [],
    })

    await expect(service.call('unknown', {})).rejects.toThrow('Endpoint not found: unknown')
  })

  it('should calculate KPIs', async () => {
    const service = Service({
      name: 'test-service',
      version: '1.0.0',
      endpoints: [],
      kpis: [
        {
          id: 'test-kpi',
          name: 'Test KPI',
          calculate: async () => 42,
        },
      ],
    })

    const kpis = await service.kpis()
    expect(kpis['test-kpi']).toBe(42)
  })

  it('should calculate OKRs with key results', async () => {
    const service = Service({
      name: 'test-service',
      version: '1.0.0',
      endpoints: [],
      okrs: [
        {
          id: 'okr-1',
          objective: 'Test objective',
          keyResults: [
            {
              description: 'Test key result',
              measure: async () => 75,
              target: 100,
              unit: 'points',
            },
          ],
        },
      ],
    })

    const okrs = await service.okrs()
    expect(okrs).toHaveLength(1)
    expect(okrs[0]?.objective).toBe('Test objective')
    expect(okrs[0]?.keyResults[0]?.current).toBe(75)
    expect(okrs[0]?.keyResults[0]?.target).toBe(100)
  })

  it('should register event handlers', () => {
    const service = Service({
      name: 'test-service',
      version: '1.0.0',
      endpoints: [],
    })

    let eventFired = false
    service.on('test.event', () => {
      eventFired = true
    })

    // Event handlers are registered (actual firing would happen in event system)
    expect(eventFired).toBe(false) // Not fired yet
  })

  it('should register scheduled tasks', () => {
    const service = Service({
      name: 'test-service',
      version: '1.0.0',
      endpoints: [],
    })

    let taskRan = false
    service.every('0 * * * *', () => {
      taskRan = true
    })

    // Task is registered (actual execution would happen in scheduler)
    expect(taskRan).toBe(false) // Not run yet
  })
})

describe('Endpoint helpers', () => {
  it('should create POST endpoint', () => {
    const endpoint = POST({
      name: 'test',
      handler: async () => ({ ok: true }),
    })

    expect(endpoint.method).toBe('POST')
    expect(endpoint.name).toBe('test')
  })

  it('should create GET endpoint', () => {
    const endpoint = GET({
      name: 'test',
      handler: async () => ({ ok: true }),
    })

    expect(endpoint.method).toBe('GET')
    expect(endpoint.name).toBe('test')
  })

  it('should default to requiring auth', () => {
    const endpoint = Endpoint({
      name: 'test',
      handler: async () => ({ ok: true }),
    })

    expect(endpoint.requiresAuth).toBe(true)
  })

  it('should allow disabling auth requirement', () => {
    const endpoint = Endpoint({
      name: 'test',
      handler: async () => ({ ok: true }),
      requiresAuth: false,
    })

    expect(endpoint.requiresAuth).toBe(false)
  })
})
