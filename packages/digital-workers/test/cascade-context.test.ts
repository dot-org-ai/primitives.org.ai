/**
 * Tests for AgentCascadeContext - Type-safe cascade context schema for agent coordination
 *
 * TDD RED Phase: These tests define the expected behavior before implementation.
 */

import { describe, it, expect, expectTypeOf } from 'vitest'
import { z } from 'zod'

// These imports will fail initially (RED phase)
import {
  // Types
  type AgentCascadeContext,
  type AgentTier,
  type ContextVersion,
  type ContextEnrichment,
  type ValidationResult,
  // Functions
  createCascadeContext,
  validateContext,
  enrichContext,
  serializeContext,
  deserializeContext,
  mergeContexts,
  diffContexts,
  createContextVersion,
  // Schemas
  AgentCascadeContextSchema,
  AgentTierSchema,
} from '../src/cascade-context.js'

// ============================================================================
// Test Fixtures
// ============================================================================

const mockBaseContext: AgentCascadeContext = {
  id: 'ctx_123',
  version: {
    major: 1,
    minor: 0,
    patch: 0,
    timestamp: new Date('2026-01-11T00:00:00Z'),
  },
  originAgent: {
    id: 'agent_coordinator',
    tier: 'coordinator',
    name: 'Task Coordinator',
  },
  currentAgent: {
    id: 'agent_worker',
    tier: 'worker',
    name: 'Code Worker',
  },
  task: {
    id: 'task_456',
    type: 'code_review',
    priority: 'high',
    description: 'Review pull request #123',
  },
  state: {
    phase: 'execution',
    startedAt: new Date('2026-01-11T00:00:00Z'),
    attempts: 1,
  },
  data: {
    pullRequest: { id: 123, branch: 'feature/cascade' },
  },
  trace: [],
  metadata: {},
}

// ============================================================================
// AgentCascadeContext Interface Tests
// ============================================================================

describe('AgentCascadeContext Interface', () => {
  describe('type safety', () => {
    it('should have required id field', () => {
      const context: AgentCascadeContext = { ...mockBaseContext }
      expect(context.id).toBe('ctx_123')
      expectTypeOf(context.id).toBeString()
    })

    it('should have required version field with proper structure', () => {
      const context: AgentCascadeContext = { ...mockBaseContext }
      expect(context.version.major).toBe(1)
      expect(context.version.minor).toBe(0)
      expect(context.version.patch).toBe(0)
      expect(context.version.timestamp).toBeInstanceOf(Date)
    })

    it('should have required originAgent with tier', () => {
      const context: AgentCascadeContext = { ...mockBaseContext }
      expect(context.originAgent.id).toBe('agent_coordinator')
      expect(context.originAgent.tier).toBe('coordinator')
    })

    it('should have required currentAgent with tier', () => {
      const context: AgentCascadeContext = { ...mockBaseContext }
      expect(context.currentAgent.id).toBe('agent_worker')
      expect(context.currentAgent.tier).toBe('worker')
    })

    it('should have required task information', () => {
      const context: AgentCascadeContext = { ...mockBaseContext }
      expect(context.task.id).toBe('task_456')
      expect(context.task.type).toBe('code_review')
    })

    it('should have required state information', () => {
      const context: AgentCascadeContext = { ...mockBaseContext }
      expect(context.state.phase).toBe('execution')
      expect(context.state.attempts).toBe(1)
    })

    it('should support optional data payload', () => {
      const context: AgentCascadeContext = { ...mockBaseContext }
      expect(context.data).toBeDefined()
      expect(context.data?.pullRequest).toBeDefined()
    })

    it('should support trace array for debugging', () => {
      const context: AgentCascadeContext = { ...mockBaseContext }
      expect(Array.isArray(context.trace)).toBe(true)
    })

    it('should support metadata for extensions', () => {
      const context: AgentCascadeContext = { ...mockBaseContext }
      expect(context.metadata).toBeDefined()
    })
  })

  describe('AgentTier type', () => {
    it('should support coordinator tier', () => {
      const tier: AgentTier = 'coordinator'
      expect(tier).toBe('coordinator')
    })

    it('should support supervisor tier', () => {
      const tier: AgentTier = 'supervisor'
      expect(tier).toBe('supervisor')
    })

    it('should support worker tier', () => {
      const tier: AgentTier = 'worker'
      expect(tier).toBe('worker')
    })

    it('should support specialist tier', () => {
      const tier: AgentTier = 'specialist'
      expect(tier).toBe('specialist')
    })

    it('should support executor tier', () => {
      const tier: AgentTier = 'executor'
      expect(tier).toBe('executor')
    })
  })
})

// ============================================================================
// Context Validation Tests
// ============================================================================

describe('Context Validation', () => {
  describe('validateContext()', () => {
    it('should validate a correct context', () => {
      const result = validateContext(mockBaseContext)
      expect(result.success).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should reject context without id', () => {
      const invalid = { ...mockBaseContext, id: undefined } as any
      const result = validateContext(invalid)
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors).toContainEqual(expect.objectContaining({
        path: ['id'],
      }))
    })

    it('should reject context without version', () => {
      const invalid = { ...mockBaseContext, version: undefined } as any
      const result = validateContext(invalid)
      expect(result.success).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({
        path: ['version'],
      }))
    })

    it('should reject invalid agent tier', () => {
      const invalid = {
        ...mockBaseContext,
        currentAgent: { ...mockBaseContext.currentAgent, tier: 'invalid_tier' },
      } as any
      const result = validateContext(invalid)
      expect(result.success).toBe(false)
      expect(result.errors).toContainEqual(expect.objectContaining({
        path: expect.arrayContaining(['currentAgent', 'tier']),
      }))
    })

    it('should reject invalid task priority', () => {
      const invalid = {
        ...mockBaseContext,
        task: { ...mockBaseContext.task, priority: 'invalid_priority' },
      } as any
      const result = validateContext(invalid)
      expect(result.success).toBe(false)
    })

    it('should provide descriptive error messages', () => {
      const invalid = { id: 123 } as any // Wrong type for id
      const result = validateContext(invalid)
      expect(result.success).toBe(false)
      expect(result.errors?.[0]?.message).toBeDefined()
      expect(typeof result.errors?.[0]?.message).toBe('string')
    })

    it('should validate nested context data', () => {
      const withNestedData: AgentCascadeContext = {
        ...mockBaseContext,
        data: {
          deeply: { nested: { value: 'test' } },
        },
      }
      const result = validateContext(withNestedData)
      expect(result.success).toBe(true)
    })
  })

  describe('Zod Schema Validation', () => {
    it('should export AgentCascadeContextSchema', () => {
      expect(AgentCascadeContextSchema).toBeDefined()
      expect(AgentCascadeContextSchema.parse).toBeTypeOf('function')
    })

    it('should export AgentTierSchema', () => {
      expect(AgentTierSchema).toBeDefined()
      expect(AgentTierSchema.parse).toBeTypeOf('function')
    })

    it('should validate context with Zod schema directly', () => {
      const parsed = AgentCascadeContextSchema.safeParse(mockBaseContext)
      expect(parsed.success).toBe(true)
    })

    it('should reject invalid context with Zod schema', () => {
      const parsed = AgentCascadeContextSchema.safeParse({ invalid: true })
      expect(parsed.success).toBe(false)
    })
  })
})

// ============================================================================
// Context Enrichment Tests
// ============================================================================

describe('Context Enrichment', () => {
  describe('enrichContext()', () => {
    it('should add enrichment data from agent tier', () => {
      const enrichment: ContextEnrichment = {
        agentId: 'agent_worker',
        tier: 'worker',
        timestamp: new Date('2026-01-11T01:00:00Z'),
        data: { analysisResult: 'approved' },
      }

      const enriched = enrichContext(mockBaseContext, enrichment)

      expect(enriched.data?.analysisResult).toBe('approved')
    })

    it('should add trace entry when enriching', () => {
      const enrichment: ContextEnrichment = {
        agentId: 'agent_worker',
        tier: 'worker',
        timestamp: new Date(),
        data: { result: 'done' },
      }

      const enriched = enrichContext(mockBaseContext, enrichment)

      expect(enriched.trace).toHaveLength(1)
      expect(enriched.trace[0]?.agentId).toBe('agent_worker')
    })

    it('should preserve existing data when enriching', () => {
      const enrichment: ContextEnrichment = {
        agentId: 'agent_worker',
        tier: 'worker',
        timestamp: new Date(),
        data: { newField: 'value' },
      }

      const enriched = enrichContext(mockBaseContext, enrichment)

      expect(enriched.data?.pullRequest).toEqual({ id: 123, branch: 'feature/cascade' })
      expect(enriched.data?.newField).toBe('value')
    })

    it('should update currentAgent when enriching', () => {
      const enrichment: ContextEnrichment = {
        agentId: 'agent_specialist',
        tier: 'specialist',
        timestamp: new Date(),
        data: {},
      }

      const enriched = enrichContext(mockBaseContext, enrichment)

      expect(enriched.currentAgent.id).toBe('agent_specialist')
      expect(enriched.currentAgent.tier).toBe('specialist')
    })

    it('should increment version patch on enrichment', () => {
      const enrichment: ContextEnrichment = {
        agentId: 'agent_worker',
        tier: 'worker',
        timestamp: new Date(),
        data: {},
      }

      const enriched = enrichContext(mockBaseContext, enrichment)

      expect(enriched.version.patch).toBe(mockBaseContext.version.patch + 1)
    })

    it('should maintain immutability of original context', () => {
      const original = { ...mockBaseContext }
      const enrichment: ContextEnrichment = {
        agentId: 'agent_new',
        tier: 'worker',
        timestamp: new Date(),
        data: { modified: true },
      }

      const enriched = enrichContext(original, enrichment)

      expect(original.data?.modified).toBeUndefined()
      expect(enriched.data?.modified).toBe(true)
      expect(original.trace).toHaveLength(0)
    })
  })
})

// ============================================================================
// Context Serialization Tests
// ============================================================================

describe('Context Serialization', () => {
  describe('serializeContext()', () => {
    it('should serialize context to JSON string', () => {
      const serialized = serializeContext(mockBaseContext)
      expect(typeof serialized).toBe('string')
      expect(() => JSON.parse(serialized)).not.toThrow()
    })

    it('should serialize Date objects correctly', () => {
      const serialized = serializeContext(mockBaseContext)
      const parsed = JSON.parse(serialized)
      expect(parsed.version.timestamp).toBe('2026-01-11T00:00:00.000Z')
      expect(parsed.state.startedAt).toBe('2026-01-11T00:00:00.000Z')
    })

    it('should preserve all context fields in serialization', () => {
      const serialized = serializeContext(mockBaseContext)
      const parsed = JSON.parse(serialized)

      expect(parsed.id).toBe(mockBaseContext.id)
      expect(parsed.originAgent.id).toBe(mockBaseContext.originAgent.id)
      expect(parsed.task.type).toBe(mockBaseContext.task.type)
    })
  })

  describe('deserializeContext()', () => {
    it('should deserialize JSON string to context', () => {
      const serialized = serializeContext(mockBaseContext)
      const deserialized = deserializeContext(serialized)

      expect(deserialized.id).toBe(mockBaseContext.id)
    })

    it('should restore Date objects', () => {
      const serialized = serializeContext(mockBaseContext)
      const deserialized = deserializeContext(serialized)

      expect(deserialized.version.timestamp).toBeInstanceOf(Date)
      expect(deserialized.state.startedAt).toBeInstanceOf(Date)
    })

    it('should validate deserialized context', () => {
      const serialized = serializeContext(mockBaseContext)
      const deserialized = deserializeContext(serialized)

      const result = validateContext(deserialized)
      expect(result.success).toBe(true)
    })

    it('should throw on invalid JSON', () => {
      expect(() => deserializeContext('invalid json')).toThrow()
    })

    it('should throw on invalid context structure', () => {
      const invalidJson = JSON.stringify({ invalid: true })
      expect(() => deserializeContext(invalidJson)).toThrow()
    })
  })

  describe('round-trip serialization', () => {
    it('should preserve context through serialize/deserialize cycle', () => {
      const serialized = serializeContext(mockBaseContext)
      const deserialized = deserializeContext(serialized)

      expect(deserialized.id).toBe(mockBaseContext.id)
      expect(deserialized.version.major).toBe(mockBaseContext.version.major)
      expect(deserialized.originAgent.id).toBe(mockBaseContext.originAgent.id)
      expect(deserialized.currentAgent.tier).toBe(mockBaseContext.currentAgent.tier)
      expect(deserialized.task.priority).toBe(mockBaseContext.task.priority)
      expect(deserialized.data?.pullRequest).toEqual(mockBaseContext.data?.pullRequest)
    })
  })
})

// ============================================================================
// Context Version Tracking Tests
// ============================================================================

describe('Context Version Tracking', () => {
  describe('ContextVersion type', () => {
    it('should have major, minor, patch fields', () => {
      const version: ContextVersion = {
        major: 1,
        minor: 2,
        patch: 3,
        timestamp: new Date(),
      }

      expect(version.major).toBe(1)
      expect(version.minor).toBe(2)
      expect(version.patch).toBe(3)
    })

    it('should have timestamp field', () => {
      const version: ContextVersion = {
        major: 1,
        minor: 0,
        patch: 0,
        timestamp: new Date('2026-01-11T00:00:00Z'),
      }

      expect(version.timestamp).toBeInstanceOf(Date)
    })

    it('should support optional hash for integrity', () => {
      const version: ContextVersion = {
        major: 1,
        minor: 0,
        patch: 0,
        timestamp: new Date(),
        hash: 'abc123',
      }

      expect(version.hash).toBe('abc123')
    })
  })

  describe('createContextVersion()', () => {
    it('should create initial version 1.0.0', () => {
      const version = createContextVersion()

      expect(version.major).toBe(1)
      expect(version.minor).toBe(0)
      expect(version.patch).toBe(0)
      expect(version.timestamp).toBeInstanceOf(Date)
    })

    it('should create version with current timestamp', () => {
      const before = new Date()
      const version = createContextVersion()
      const after = new Date()

      expect(version.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(version.timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    it('should accept custom version numbers', () => {
      const version = createContextVersion({ major: 2, minor: 1, patch: 5 })

      expect(version.major).toBe(2)
      expect(version.minor).toBe(1)
      expect(version.patch).toBe(5)
    })
  })
})

// ============================================================================
// Context Factory Tests
// ============================================================================

describe('Context Factory', () => {
  describe('createCascadeContext()', () => {
    it('should create context with required fields', () => {
      const context = createCascadeContext({
        originAgent: {
          id: 'agent_1',
          tier: 'coordinator',
          name: 'Coordinator',
        },
        task: {
          id: 'task_1',
          type: 'analysis',
          priority: 'normal',
          description: 'Analyze data',
        },
      })

      expect(context.id).toBeDefined()
      expect(context.version).toBeDefined()
      expect(context.originAgent.id).toBe('agent_1')
      expect(context.currentAgent.id).toBe('agent_1')
      expect(context.task.id).toBe('task_1')
    })

    it('should generate unique context id', () => {
      const ctx1 = createCascadeContext({
        originAgent: { id: 'a', tier: 'worker', name: 'A' },
        task: { id: 't', type: 'test', priority: 'low', description: 'd' },
      })
      const ctx2 = createCascadeContext({
        originAgent: { id: 'a', tier: 'worker', name: 'A' },
        task: { id: 't', type: 'test', priority: 'low', description: 'd' },
      })

      expect(ctx1.id).not.toBe(ctx2.id)
    })

    it('should initialize empty trace array', () => {
      const context = createCascadeContext({
        originAgent: { id: 'a', tier: 'worker', name: 'A' },
        task: { id: 't', type: 'test', priority: 'low', description: 'd' },
      })

      expect(context.trace).toEqual([])
    })

    it('should set currentAgent to originAgent by default', () => {
      const context = createCascadeContext({
        originAgent: { id: 'origin', tier: 'coordinator', name: 'Origin' },
        task: { id: 't', type: 'test', priority: 'low', description: 'd' },
      })

      expect(context.currentAgent.id).toBe('origin')
      expect(context.currentAgent.tier).toBe('coordinator')
    })

    it('should initialize state with planning phase', () => {
      const context = createCascadeContext({
        originAgent: { id: 'a', tier: 'worker', name: 'A' },
        task: { id: 't', type: 'test', priority: 'low', description: 'd' },
      })

      expect(context.state.phase).toBe('planning')
      expect(context.state.attempts).toBe(0)
      expect(context.state.startedAt).toBeInstanceOf(Date)
    })

    it('should accept optional initial data', () => {
      const context = createCascadeContext({
        originAgent: { id: 'a', tier: 'worker', name: 'A' },
        task: { id: 't', type: 'test', priority: 'low', description: 'd' },
        data: { key: 'value' },
      })

      expect(context.data?.key).toBe('value')
    })

    it('should accept optional metadata', () => {
      const context = createCascadeContext({
        originAgent: { id: 'a', tier: 'worker', name: 'A' },
        task: { id: 't', type: 'test', priority: 'low', description: 'd' },
        metadata: { source: 'api' },
      })

      expect(context.metadata?.source).toBe('api')
    })
  })
})

// ============================================================================
// Context Diff/Merge Utilities Tests
// ============================================================================

describe('Context Diff/Merge Utilities', () => {
  describe('mergeContexts()', () => {
    it('should merge two contexts preferring the newer one', () => {
      const older: AgentCascadeContext = {
        ...mockBaseContext,
        version: { ...mockBaseContext.version, patch: 0 },
      }
      const newer: AgentCascadeContext = {
        ...mockBaseContext,
        version: { ...mockBaseContext.version, patch: 1 },
        data: { newData: true },
      }

      const merged = mergeContexts(older, newer)

      expect(merged.version.patch).toBe(1)
      expect(merged.data?.newData).toBe(true)
    })

    it('should combine trace arrays', () => {
      const ctx1: AgentCascadeContext = {
        ...mockBaseContext,
        trace: [{ agentId: 'a1', tier: 'worker', timestamp: new Date(), action: 'process' }],
      }
      const ctx2: AgentCascadeContext = {
        ...mockBaseContext,
        trace: [{ agentId: 'a2', tier: 'specialist', timestamp: new Date(), action: 'analyze' }],
      }

      const merged = mergeContexts(ctx1, ctx2)

      expect(merged.trace).toHaveLength(2)
    })

    it('should merge data objects deeply', () => {
      const ctx1: AgentCascadeContext = {
        ...mockBaseContext,
        data: { a: 1, nested: { x: 1 } },
      }
      const ctx2: AgentCascadeContext = {
        ...mockBaseContext,
        data: { b: 2, nested: { y: 2 } },
      }

      const merged = mergeContexts(ctx1, ctx2)

      expect(merged.data?.a).toBe(1)
      expect(merged.data?.b).toBe(2)
      expect(merged.data?.nested?.x).toBe(1)
      expect(merged.data?.nested?.y).toBe(2)
    })
  })

  describe('diffContexts()', () => {
    it('should return empty diff for identical contexts', () => {
      const diff = diffContexts(mockBaseContext, mockBaseContext)

      expect(diff.changes).toHaveLength(0)
    })

    it('should detect version changes', () => {
      const modified = {
        ...mockBaseContext,
        version: { ...mockBaseContext.version, patch: 5 },
      }

      const diff = diffContexts(mockBaseContext, modified)

      expect(diff.changes).toContainEqual(expect.objectContaining({
        path: ['version', 'patch'],
        oldValue: 0,
        newValue: 5,
      }))
    })

    it('should detect data changes', () => {
      const modified = {
        ...mockBaseContext,
        data: { ...mockBaseContext.data, newField: 'new' },
      }

      const diff = diffContexts(mockBaseContext, modified)

      expect(diff.changes.some(c => c.path.includes('data'))).toBe(true)
    })

    it('should detect agent changes', () => {
      const modified = {
        ...mockBaseContext,
        currentAgent: { id: 'new_agent', tier: 'specialist' as AgentTier, name: 'New' },
      }

      const diff = diffContexts(mockBaseContext, modified)

      expect(diff.changes.some(c => c.path.includes('currentAgent'))).toBe(true)
    })
  })
})
