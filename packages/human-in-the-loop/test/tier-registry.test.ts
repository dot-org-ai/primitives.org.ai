/**
 * Tests for cascade tier registry for failure type routing
 *
 * Cascade tiers represent the hierarchy of handlers for AI failures:
 * - code: Automated code-based handlers (retry, fallback values)
 * - generative: AI/LLM-based handlers (regenerate, rephrase)
 * - agentic: AI agent handlers (autonomous problem solving)
 * - human: Human-in-the-loop handlers (manual intervention)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  TierRegistry,
  CascadeTier,
  TierConfig,
  FailureType,
  TierHandler,
} from '../src/tier-registry.js'

describe('TierRegistry', () => {
  let registry: TierRegistry

  beforeEach(() => {
    registry = new TierRegistry()
  })

  describe('Tier Registration', () => {
    it('should register a tier with basic configuration', () => {
      const config: TierConfig = {
        name: 'code',
        description: 'Automated code-based handlers',
        priority: 0,
      }

      registry.registerTier('code', config)

      const tier = registry.getTier('code')
      expect(tier).toBeDefined()
      expect(tier?.name).toBe('code')
      expect(tier?.priority).toBe(0)
    })

    it('should register all four cascade tiers (code, generative, agentic, human)', () => {
      registry.registerTier('code', { name: 'code', priority: 0 })
      registry.registerTier('generative', { name: 'generative', priority: 1 })
      registry.registerTier('agentic', { name: 'agentic', priority: 2 })
      registry.registerTier('human', { name: 'human', priority: 3 })

      expect(registry.getTier('code')).toBeDefined()
      expect(registry.getTier('generative')).toBeDefined()
      expect(registry.getTier('agentic')).toBeDefined()
      expect(registry.getTier('human')).toBeDefined()
    })

    it('should list all registered tiers in priority order', () => {
      registry.registerTier('human', { name: 'human', priority: 3 })
      registry.registerTier('code', { name: 'code', priority: 0 })
      registry.registerTier('agentic', { name: 'agentic', priority: 2 })
      registry.registerTier('generative', { name: 'generative', priority: 1 })

      const tiers = registry.listTiers()
      expect(tiers.map((t) => t.id)).toEqual(['code', 'generative', 'agentic', 'human'])
    })

    it('should update an existing tier configuration', () => {
      registry.registerTier('code', { name: 'code', priority: 0 })
      registry.registerTier('code', {
        name: 'code-v2',
        priority: 0,
        description: 'Updated description',
      })

      const tier = registry.getTier('code')
      expect(tier?.name).toBe('code-v2')
      expect(tier?.description).toBe('Updated description')
    })

    it('should unregister a tier', () => {
      registry.registerTier('code', { name: 'code', priority: 0 })
      expect(registry.getTier('code')).toBeDefined()

      registry.unregisterTier('code')
      expect(registry.getTier('code')).toBeUndefined()
    })

    it('should register tier with handlers', () => {
      const handler: TierHandler = {
        canHandle: (failure) => failure.type === 'timeout',
        handle: async (failure) => ({ handled: true, result: 'retried' }),
      }

      registry.registerTier('code', {
        name: 'code',
        priority: 0,
        handlers: [handler],
      })

      const tier = registry.getTier('code')
      expect(tier?.handlers).toHaveLength(1)
    })
  })

  describe('Failure Type to Tier Mapping', () => {
    beforeEach(() => {
      registry.registerTier('code', { name: 'code', priority: 0 })
      registry.registerTier('generative', { name: 'generative', priority: 1 })
      registry.registerTier('agentic', { name: 'agentic', priority: 2 })
      registry.registerTier('human', { name: 'human', priority: 3 })
    })

    it('should map failure type to a specific tier', () => {
      registry.mapFailureToTier('timeout', 'code')
      registry.mapFailureToTier('rate_limit', 'code')
      registry.mapFailureToTier('invalid_output', 'generative')
      registry.mapFailureToTier('complex_reasoning', 'agentic')
      registry.mapFailureToTier('approval_required', 'human')

      expect(registry.routeToTier('timeout')).toBe('code')
      expect(registry.routeToTier('rate_limit')).toBe('code')
      expect(registry.routeToTier('invalid_output')).toBe('generative')
      expect(registry.routeToTier('complex_reasoning')).toBe('agentic')
      expect(registry.routeToTier('approval_required')).toBe('human')
    })

    it('should return undefined for unmapped failure types', () => {
      expect(registry.routeToTier('unknown_failure')).toBeUndefined()
    })

    it('should allow updating failure type mappings', () => {
      registry.mapFailureToTier('timeout', 'code')
      expect(registry.routeToTier('timeout')).toBe('code')

      registry.mapFailureToTier('timeout', 'human')
      expect(registry.routeToTier('timeout')).toBe('human')
    })

    it('should remove failure type mappings', () => {
      registry.mapFailureToTier('timeout', 'code')
      expect(registry.routeToTier('timeout')).toBe('code')

      registry.unmapFailureType('timeout')
      expect(registry.routeToTier('timeout')).toBeUndefined()
    })

    it('should list all failure type mappings', () => {
      registry.mapFailureToTier('timeout', 'code')
      registry.mapFailureToTier('approval_required', 'human')

      const mappings = registry.getFailureMappings()
      expect(mappings).toEqual({
        timeout: 'code',
        approval_required: 'human',
      })
    })

    it('should support pattern-based failure matching', () => {
      registry.mapFailureToTier(/^validation_.*/, 'code')
      registry.mapFailureToTier(/^ai_.*_failure$/, 'generative')

      expect(registry.routeToTier('validation_error')).toBe('code')
      expect(registry.routeToTier('validation_missing_field')).toBe('code')
      expect(registry.routeToTier('ai_generation_failure')).toBe('generative')
    })
  })

  describe('Priority-Based Routing', () => {
    beforeEach(() => {
      registry.registerTier('code', { name: 'code', priority: 0 })
      registry.registerTier('generative', { name: 'generative', priority: 1 })
      registry.registerTier('agentic', { name: 'agentic', priority: 2 })
      registry.registerTier('junior-human', {
        name: 'junior-human',
        priority: 3,
        metadata: { level: 'junior' },
      })
      registry.registerTier('senior-human', {
        name: 'senior-human',
        priority: 4,
        metadata: { level: 'senior' },
      })
    })

    it('should route low priority to code tier', () => {
      const tier = registry.getTierForPriority('low')
      expect(tier).toBe('code')
    })

    it('should route normal priority to generative tier', () => {
      const tier = registry.getTierForPriority('normal')
      expect(tier).toBe('generative')
    })

    it('should route high priority to agentic tier', () => {
      const tier = registry.getTierForPriority('high')
      expect(tier).toBe('agentic')
    })

    it('should route critical priority to senior human tier', () => {
      const tier = registry.getTierForPriority('critical')
      expect(tier).toBe('senior-human')
    })

    it('should allow custom priority to tier mapping', () => {
      registry.setPriorityMapping({
        low: 'code',
        normal: 'code',
        high: 'human',
        critical: 'senior-human',
      })

      expect(registry.getTierForPriority('low')).toBe('code')
      expect(registry.getTierForPriority('normal')).toBe('code')
      expect(registry.getTierForPriority('high')).toBe('human')
    })
  })

  describe('Tier Fallback Chains', () => {
    beforeEach(() => {
      registry.registerTier('code', { name: 'code', priority: 0 })
      registry.registerTier('generative', { name: 'generative', priority: 1 })
      registry.registerTier('agentic', { name: 'agentic', priority: 2 })
      registry.registerTier('human', { name: 'human', priority: 3 })
    })

    it('should define a fallback chain for a tier', () => {
      registry.setFallbackChain('code', ['generative', 'agentic', 'human'])

      const chain = registry.getFallbackChain('code')
      expect(chain).toEqual(['generative', 'agentic', 'human'])
    })

    it('should return next tier in fallback chain', () => {
      registry.setFallbackChain('code', ['generative', 'agentic', 'human'])

      expect(registry.getNextFallback('code')).toBe('generative')
      expect(registry.getNextFallback('generative')).toBe('agentic')
      expect(registry.getNextFallback('agentic')).toBe('human')
    })

    it('should return undefined when no more fallbacks', () => {
      registry.setFallbackChain('code', ['generative'])

      expect(registry.getNextFallback('generative')).toBeUndefined()
      expect(registry.getNextFallback('human')).toBeUndefined()
    })

    it('should support automatic fallback chain based on priority', () => {
      registry.enableAutoFallback()

      // Automatic: each tier falls back to the next higher priority
      expect(registry.getNextFallback('code')).toBe('generative')
      expect(registry.getNextFallback('generative')).toBe('agentic')
      expect(registry.getNextFallback('agentic')).toBe('human')
      expect(registry.getNextFallback('human')).toBeUndefined()
    })

    it('should return full escalation path from a tier', () => {
      registry.setFallbackChain('code', ['generative', 'agentic', 'human'])

      const path = registry.getEscalationPath('code')
      expect(path).toEqual(['code', 'generative', 'agentic', 'human'])
    })
  })

  describe('Tier Availability Checking', () => {
    beforeEach(() => {
      registry.registerTier('code', { name: 'code', priority: 0 })
      registry.registerTier('generative', { name: 'generative', priority: 1 })
      registry.registerTier('human', { name: 'human', priority: 3 })
    })

    it('should mark tier as available by default', () => {
      expect(registry.isTierAvailable('code')).toBe(true)
    })

    it('should mark tier as unavailable', () => {
      registry.setTierAvailability('generative', false)
      expect(registry.isTierAvailable('generative')).toBe(false)
    })

    it('should mark tier as available again', () => {
      registry.setTierAvailability('generative', false)
      registry.setTierAvailability('generative', true)
      expect(registry.isTierAvailable('generative')).toBe(true)
    })

    it('should return undefined availability for unknown tier', () => {
      expect(registry.isTierAvailable('unknown')).toBeUndefined()
    })

    it('should skip unavailable tiers in fallback routing', () => {
      registry.setFallbackChain('code', ['generative', 'human'])
      registry.setTierAvailability('generative', false)

      const next = registry.getNextAvailableFallback('code')
      expect(next).toBe('human')
    })

    it('should return undefined if all fallbacks are unavailable', () => {
      registry.setFallbackChain('code', ['generative', 'human'])
      registry.setTierAvailability('generative', false)
      registry.setTierAvailability('human', false)

      const next = registry.getNextAvailableFallback('code')
      expect(next).toBeUndefined()
    })

    it('should list all available tiers', () => {
      registry.setTierAvailability('generative', false)

      const available = registry.getAvailableTiers()
      expect(available.map((t) => t.id)).toEqual(['code', 'human'])
    })

    it('should check tier availability with a custom function', async () => {
      registry.registerTier('human', {
        name: 'human',
        priority: 3,
        availabilityCheck: async () => {
          // Could check if human operators are online
          return true
        },
      })

      // Async availability check
      await expect(registry.checkTierAvailability('human')).resolves.toBe(true)
    })
  })

  describe('Tier Metrics', () => {
    beforeEach(() => {
      registry.registerTier('code', { name: 'code', priority: 0 })
      registry.registerTier('human', { name: 'human', priority: 3 })
    })

    it('should track tier usage count', () => {
      registry.recordTierUsage('code')
      registry.recordTierUsage('code')
      registry.recordTierUsage('human')

      const metrics = registry.getTierMetrics('code')
      expect(metrics?.usageCount).toBe(2)
    })

    it('should track tier success and failure rates', () => {
      registry.recordTierResult('code', true)
      registry.recordTierResult('code', true)
      registry.recordTierResult('code', false)

      const metrics = registry.getTierMetrics('code')
      expect(metrics?.successCount).toBe(2)
      expect(metrics?.failureCount).toBe(1)
      expect(metrics?.successRate).toBeCloseTo(0.667, 2)
    })

    it('should track average handling time', () => {
      registry.recordTierUsage('code', { durationMs: 100 })
      registry.recordTierUsage('code', { durationMs: 200 })
      registry.recordTierUsage('code', { durationMs: 300 })

      const metrics = registry.getTierMetrics('code')
      expect(metrics?.avgDurationMs).toBe(200)
    })

    it('should reset tier metrics', () => {
      registry.recordTierUsage('code')
      registry.recordTierResult('code', true)
      registry.resetTierMetrics('code')

      const metrics = registry.getTierMetrics('code')
      expect(metrics?.usageCount).toBe(0)
      expect(metrics?.successCount).toBe(0)
    })

    it('should get all tier metrics', () => {
      registry.recordTierUsage('code')
      registry.recordTierUsage('human')

      const allMetrics = registry.getAllMetrics()
      expect(allMetrics['code']?.usageCount).toBe(1)
      expect(allMetrics['human']?.usageCount).toBe(1)
    })
  })
})
