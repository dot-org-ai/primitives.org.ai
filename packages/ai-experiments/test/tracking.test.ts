/**
 * Tests for tracking utilities
 *
 * These tests verify the event tracking functionality including:
 * - Track function basics
 * - Configuration options
 * - Backend implementations
 * - Memory backend
 * - Batch backend
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  track,
  flush,
  configureTracking,
  getTrackingConfig,
  createConsoleBackend,
  createMemoryBackend,
  createBatchBackend,
} from '../src/index.js'

describe('tracking configuration', () => {
  beforeEach(() => {
    // Reset to default state
    configureTracking({
      backend: createMemoryBackend(),
      enabled: true,
      metadata: {},
    })
  })

  it('configures tracking with custom backend', () => {
    const customBackend = createMemoryBackend()
    configureTracking({ backend: customBackend })

    const config = getTrackingConfig()
    expect(config.backend).toBe(customBackend)
  })

  it('configures tracking enabled state', () => {
    configureTracking({ enabled: false })
    expect(getTrackingConfig().enabled).toBe(false)

    configureTracking({ enabled: true })
    expect(getTrackingConfig().enabled).toBe(true)
  })

  it('configures global metadata', () => {
    configureTracking({ metadata: { project: 'test', env: 'development' } })

    const config = getTrackingConfig()
    expect(config.metadata).toEqual({ project: 'test', env: 'development' })
  })

  it('preserves existing config when partial update', () => {
    const backend = createMemoryBackend()
    configureTracking({ backend, enabled: true, metadata: { key: 'value' } })

    // Update only enabled
    configureTracking({ enabled: false })

    const config = getTrackingConfig()
    expect(config.backend).toBe(backend)
    expect(config.enabled).toBe(false)
    expect(config.metadata).toEqual({ key: 'value' })
  })
})

describe('track function', () => {
  let backend: ReturnType<typeof createMemoryBackend>

  beforeEach(() => {
    backend = createMemoryBackend()
    configureTracking({ backend, enabled: true, metadata: {} })
  })

  it('tracks events to backend', () => {
    track({
      type: 'experiment.start',
      timestamp: new Date(),
      data: { experimentId: 'test-exp' },
    })

    const events = backend.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('experiment.start')
    expect(events[0].data.experimentId).toBe('test-exp')
  })

  it('does not track when disabled', () => {
    configureTracking({ enabled: false })

    track({
      type: 'experiment.start',
      timestamp: new Date(),
      data: {},
    })

    const events = backend.getEvents()
    expect(events).toHaveLength(0)
  })

  it('merges global metadata with event data', () => {
    configureTracking({
      backend,
      metadata: { projectId: 'proj-123', env: 'test' },
    })

    track({
      type: 'variant.start',
      timestamp: new Date(),
      data: { variantId: 'v1' },
    })

    const events = backend.getEvents()
    expect(events[0].data.variantId).toBe('v1')
    expect(events[0].data.projectId).toBe('proj-123')
    expect(events[0].data.env).toBe('test')
  })

  it('tracks all event types', () => {
    const eventTypes = [
      'experiment.start',
      'experiment.complete',
      'variant.start',
      'variant.complete',
      'variant.error',
      'metric.computed',
      'decision.made',
    ] as const

    for (const type of eventTypes) {
      track({
        type,
        timestamp: new Date(),
        data: { type },
      })
    }

    const events = backend.getEvents()
    expect(events).toHaveLength(eventTypes.length)
  })
})

describe('flush function', () => {
  it('calls backend flush when available', async () => {
    const flushMock = vi.fn().mockResolvedValue(undefined)
    const customBackend = {
      track: vi.fn(),
      flush: flushMock,
    }

    configureTracking({ backend: customBackend })

    await flush()

    expect(flushMock).toHaveBeenCalled()
  })

  it('handles backend without flush method', async () => {
    const customBackend = {
      track: vi.fn(),
      // No flush method
    }

    configureTracking({ backend: customBackend })

    // Should not throw
    await expect(flush()).resolves.not.toThrow()
  })
})

describe('createConsoleBackend', () => {
  it('creates a tracking backend', () => {
    const backend = createConsoleBackend()
    expect(backend).toHaveProperty('track')
    expect(typeof backend.track).toBe('function')
  })

  it('accepts verbose option', () => {
    const verboseBackend = createConsoleBackend({ verbose: true })
    expect(verboseBackend).toHaveProperty('track')
  })

  it('logs events without throwing', () => {
    const backend = createConsoleBackend()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    backend.track({
      type: 'experiment.start',
      timestamp: new Date(),
      data: { experimentId: 'test' },
    })

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('createMemoryBackend', () => {
  it('creates backend with getEvents and clear methods', () => {
    const backend = createMemoryBackend()

    expect(backend).toHaveProperty('track')
    expect(backend).toHaveProperty('getEvents')
    expect(backend).toHaveProperty('clear')
  })

  it('stores tracked events', () => {
    const backend = createMemoryBackend()

    backend.track({
      type: 'experiment.start',
      timestamp: new Date(),
      data: { id: 1 },
    })

    backend.track({
      type: 'experiment.complete',
      timestamp: new Date(),
      data: { id: 2 },
    })

    const events = backend.getEvents()
    expect(events).toHaveLength(2)
    expect(events[0].data.id).toBe(1)
    expect(events[1].data.id).toBe(2)
  })

  it('clears all events', () => {
    const backend = createMemoryBackend()

    backend.track({
      type: 'experiment.start',
      timestamp: new Date(),
      data: {},
    })

    expect(backend.getEvents()).toHaveLength(1)

    backend.clear()

    expect(backend.getEvents()).toHaveLength(0)
  })

  it('returns copy of events array', () => {
    const backend = createMemoryBackend()

    backend.track({
      type: 'experiment.start',
      timestamp: new Date(),
      data: {},
    })

    const events1 = backend.getEvents()
    const events2 = backend.getEvents()

    // Should be equal but not same reference
    expect(events1).toEqual(events2)
    expect(events1).not.toBe(events2)
  })
})

describe('createBatchBackend', () => {
  it('creates backend with track and flush methods', () => {
    const backend = createBatchBackend({
      batchSize: 10,
      send: async () => {},
    })

    expect(backend).toHaveProperty('track')
    expect(backend).toHaveProperty('flush')
  })

  it('batches events until batchSize reached', async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined)
    const backend = createBatchBackend({
      batchSize: 3,
      send: sendMock,
    })

    // Track 2 events - should not trigger send yet
    backend.track({ type: 'experiment.start', timestamp: new Date(), data: {} })
    backend.track({ type: 'experiment.start', timestamp: new Date(), data: {} })

    expect(sendMock).not.toHaveBeenCalled()

    // Track 3rd event - should trigger batch send
    backend.track({ type: 'experiment.start', timestamp: new Date(), data: {} })

    // Allow async processing
    await new Promise((r) => setTimeout(r, 10))

    expect(sendMock).toHaveBeenCalled()
    expect(sendMock.mock.calls[0][0]).toHaveLength(3)
  })

  it('flushes remaining events on flush call', async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined)
    const backend = createBatchBackend({
      batchSize: 10,
      send: sendMock,
    })

    backend.track({ type: 'experiment.start', timestamp: new Date(), data: {} })
    backend.track({ type: 'experiment.start', timestamp: new Date(), data: {} })

    expect(sendMock).not.toHaveBeenCalled()

    await backend.flush!()

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0][0]).toHaveLength(2)
  })

  it('does not send on flush when batch is empty', async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined)
    const backend = createBatchBackend({
      batchSize: 10,
      send: sendMock,
    })

    await backend.flush!()

    expect(sendMock).not.toHaveBeenCalled()
  })

  it('supports flush interval', async () => {
    const sendMock = vi.fn().mockResolvedValue(undefined)
    const backend = createBatchBackend({
      batchSize: 100,
      flushInterval: 50,
      send: sendMock,
    })

    backend.track({ type: 'experiment.start', timestamp: new Date(), data: {} })

    // Wait for flush interval
    await new Promise((r) => setTimeout(r, 100))

    expect(sendMock).toHaveBeenCalled()

    // Clean up timer
    await backend.flush!()
  })
})
