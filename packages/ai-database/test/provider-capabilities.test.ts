/**
 * Tests for provider capability detection
 *
 * Documents and tests which features are available with different database providers.
 * Ensures graceful degradation when features are unavailable.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ProviderCapabilities,
  detectCapabilities,
  CapabilityNotSupportedError,
  requireCapability,
  isCapabilityNotSupportedError,
} from '../src/provider-capabilities.js'
import { MemoryProvider, createMemoryProvider } from '../src/memory-provider.js'
import type { DBProvider } from '../src/schema.js'

describe('ProviderCapabilities', () => {
  describe('interface structure', () => {
    it('defines all required capability flags', () => {
      const capabilities: ProviderCapabilities = {
        hasSemanticSearch: true,
        hasEvents: true,
        hasActions: true,
        hasArtifacts: true,
        hasBatchOperations: true,
      }

      expect(capabilities).toBeDefined()
      expect(typeof capabilities.hasSemanticSearch).toBe('boolean')
      expect(typeof capabilities.hasEvents).toBe('boolean')
      expect(typeof capabilities.hasActions).toBe('boolean')
      expect(typeof capabilities.hasArtifacts).toBe('boolean')
      expect(typeof capabilities.hasBatchOperations).toBe('boolean')
    })
  })

  describe('detectCapabilities', () => {
    it('detects MemoryProvider capabilities as all true', async () => {
      const provider = createMemoryProvider()
      const capabilities = await detectCapabilities(provider)

      expect(capabilities.hasSemanticSearch).toBe(true)
      expect(capabilities.hasEvents).toBe(true)
      expect(capabilities.hasActions).toBe(true)
      expect(capabilities.hasArtifacts).toBe(true)
      expect(capabilities.hasBatchOperations).toBe(true)
    })

    it('detects basic DBProvider capabilities as false for advanced features', async () => {
      // Create a minimal DBProvider implementation (like RDB)
      const basicProvider: DBProvider = {
        async get(type: string, id: string) {
          return null
        },
        async list(type: string) {
          return []
        },
        async search(type: string, query: string) {
          return []
        },
        async create(type: string, id: string | undefined, data: Record<string, unknown>) {
          return { $id: id ?? 'generated', $type: type, ...data }
        },
        async update(type: string, id: string, data: Record<string, unknown>) {
          return { $id: id, $type: type, ...data }
        },
        async delete(type: string, id: string) {
          return true
        },
        async related(type: string, id: string, relation: string) {
          return []
        },
        async relate(
          fromType: string,
          fromId: string,
          relation: string,
          toType: string,
          toId: string
        ) {},
        async unrelate(
          fromType: string,
          fromId: string,
          relation: string,
          toType: string,
          toId: string
        ) {},
      }

      const capabilities = await detectCapabilities(basicProvider)

      expect(capabilities.hasSemanticSearch).toBe(false)
      expect(capabilities.hasEvents).toBe(false)
      expect(capabilities.hasActions).toBe(false)
      expect(capabilities.hasArtifacts).toBe(false)
      expect(capabilities.hasBatchOperations).toBe(false)
    })

    it('detects partial capabilities when some methods exist', async () => {
      // Provider with events but nothing else
      const eventsOnlyProvider = {
        ...createBasicProvider(),
        on: () => () => {},
        emit: async () => ({}),
        listEvents: async () => [],
      }

      const capabilities = await detectCapabilities(eventsOnlyProvider as DBProvider)

      expect(capabilities.hasSemanticSearch).toBe(false)
      expect(capabilities.hasEvents).toBe(true)
      expect(capabilities.hasActions).toBe(false)
      expect(capabilities.hasArtifacts).toBe(false)
    })

    it('detects semantic search capability', async () => {
      const semanticProvider = {
        ...createBasicProvider(),
        semanticSearch: async () => [],
        hybridSearch: async () => [],
        setEmbeddingsConfig: () => {},
      }

      const capabilities = await detectCapabilities(semanticProvider as DBProvider)

      expect(capabilities.hasSemanticSearch).toBe(true)
      expect(capabilities.hasEvents).toBe(false)
    })

    it('caches capability detection results', async () => {
      const provider = createMemoryProvider()

      const result1 = await detectCapabilities(provider)
      const result2 = await detectCapabilities(provider)

      expect(result1).toBe(result2) // Same reference means cached
    })
  })

  describe('CapabilityNotSupportedError', () => {
    it('creates error with capability name', () => {
      const error = new CapabilityNotSupportedError('semanticSearch')

      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('CapabilityNotSupportedError')
      expect(error.capability).toBe('semanticSearch')
      expect(error.message).toContain('semanticSearch')
    })

    it('creates error with custom message', () => {
      const error = new CapabilityNotSupportedError('events', 'Events API is not available')

      expect(error.message).toBe('Events API is not available')
      expect(error.capability).toBe('events')
    })

    it('includes suggested alternative in message', () => {
      const error = new CapabilityNotSupportedError(
        'semanticSearch',
        undefined,
        'Use regular search() instead'
      )

      expect(error.message).toContain('semanticSearch')
      expect(error.alternative).toBe('Use regular search() instead')
    })

    it('is identifiable via isCapabilityNotSupportedError', () => {
      const error = new CapabilityNotSupportedError('events')
      const regularError = new Error('Not found')

      expect(isCapabilityNotSupportedError(error)).toBe(true)
      expect(isCapabilityNotSupportedError(regularError)).toBe(false)
      expect(isCapabilityNotSupportedError(null)).toBe(false)
      expect(isCapabilityNotSupportedError(undefined)).toBe(false)
    })
  })

  describe('requireCapability', () => {
    let memoryProvider: MemoryProvider
    let basicProvider: DBProvider

    beforeEach(() => {
      memoryProvider = createMemoryProvider()
      basicProvider = createBasicProvider()
    })

    it('does not throw for supported capabilities', async () => {
      const capabilities = await detectCapabilities(memoryProvider)

      expect(() => requireCapability(capabilities, 'hasSemanticSearch')).not.toThrow()
      expect(() => requireCapability(capabilities, 'hasEvents')).not.toThrow()
      expect(() => requireCapability(capabilities, 'hasActions')).not.toThrow()
      expect(() => requireCapability(capabilities, 'hasArtifacts')).not.toThrow()
    })

    it('throws CapabilityNotSupportedError for unsupported capabilities', async () => {
      const capabilities = await detectCapabilities(basicProvider)

      expect(() => requireCapability(capabilities, 'hasSemanticSearch')).toThrow(
        CapabilityNotSupportedError
      )
      expect(() => requireCapability(capabilities, 'hasEvents')).toThrow(
        CapabilityNotSupportedError
      )
    })

    it('includes capability name in error', async () => {
      const capabilities = await detectCapabilities(basicProvider)

      try {
        requireCapability(capabilities, 'hasSemanticSearch')
        expect.fail('Should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(CapabilityNotSupportedError)
        expect((e as CapabilityNotSupportedError).capability).toBe('hasSemanticSearch')
      }
    })
  })

  describe('runtime warnings', () => {
    it('logs warning when feature is unavailable', async () => {
      const warnings: string[] = []
      const originalWarn = console.warn
      console.warn = (msg: string) => warnings.push(msg)

      try {
        const capabilities = await detectCapabilities(createBasicProvider())

        // Import the warnIfUnavailable helper
        const { warnIfUnavailable } = await import('../src/provider-capabilities.js')

        warnIfUnavailable(capabilities, 'hasSemanticSearch', 'semanticSearch')

        expect(warnings.length).toBe(1)
        expect(warnings[0]).toContain('semanticSearch')
      } finally {
        console.warn = originalWarn
      }
    })

    it('does not log warning when feature is available', async () => {
      const warnings: string[] = []
      const originalWarn = console.warn
      console.warn = (msg: string) => warnings.push(msg)

      try {
        const capabilities = await detectCapabilities(createMemoryProvider())

        const { warnIfUnavailable } = await import('../src/provider-capabilities.js')

        warnIfUnavailable(capabilities, 'hasSemanticSearch', 'semanticSearch')

        expect(warnings.length).toBe(0)
      } finally {
        console.warn = originalWarn
      }
    })
  })
})

// Helper to create a basic DBProvider for testing
function createBasicProvider(): DBProvider {
  return {
    async get(type: string, id: string) {
      return null
    },
    async list(type: string) {
      return []
    },
    async search(type: string, query: string) {
      return []
    },
    async create(type: string, id: string | undefined, data: Record<string, unknown>) {
      return { $id: id ?? 'generated', $type: type, ...data }
    },
    async update(type: string, id: string, data: Record<string, unknown>) {
      return { $id: id, $type: type, ...data }
    },
    async delete(type: string, id: string) {
      return true
    },
    async related(type: string, id: string, relation: string) {
      return []
    },
    async relate(
      fromType: string,
      fromId: string,
      relation: string,
      toType: string,
      toId: string
    ) {},
    async unrelate(
      fromType: string,
      fromId: string,
      relation: string,
      toType: string,
      toId: string
    ) {},
  }
}
