/**
 * Cascade Tier Registry for Failure Type Routing
 *
 * This module provides a registry for managing cascade tiers in AI failure handling.
 * Cascade tiers represent the hierarchy of handlers for AI failures:
 * - code: Automated code-based handlers (retry, fallback values)
 * - generative: AI/LLM-based handlers (regenerate, rephrase)
 * - agentic: AI agent handlers (autonomous problem solving)
 * - human: Human-in-the-loop handlers (manual intervention)
 */

import type { Priority } from './types.js'

/**
 * Failure types that can be routed to different tiers
 */
export type FailureType = string

/**
 * Failure pattern for matching multiple failure types
 */
export type FailurePattern = string | RegExp

/**
 * Result of a tier handler
 */
export interface TierHandlerResult {
  /** Whether the failure was handled */
  handled: boolean
  /** Result of handling (if successful) */
  result?: unknown
  /** Error message (if failed) */
  error?: string
}

/**
 * Failure information passed to tier handlers
 */
export interface FailureInfo {
  /** Type of failure */
  type: FailureType
  /** Error message */
  message?: string
  /** Original error */
  error?: Error
  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Handler for processing failures within a tier
 */
export interface TierHandler {
  /** Check if this handler can handle the failure */
  canHandle: (failure: FailureInfo) => boolean
  /** Handle the failure */
  handle: (failure: FailureInfo) => Promise<TierHandlerResult>
}

/**
 * Configuration for a cascade tier
 */
export interface TierConfig {
  /** Display name for the tier */
  name: string
  /** Description of the tier's purpose */
  description?: string
  /** Priority level (lower = tried first) */
  priority: number
  /** Handlers for this tier */
  handlers?: TierHandler[]
  /** Custom availability check function */
  availabilityCheck?: () => Promise<boolean>
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * A registered cascade tier
 */
export interface CascadeTier extends TierConfig {
  /** Unique identifier for the tier */
  id: string
}

/**
 * Metrics for a tier
 */
export interface TierMetrics {
  /** Number of times this tier was used */
  usageCount: number
  /** Number of successful handlings */
  successCount: number
  /** Number of failed handlings */
  failureCount: number
  /** Success rate (0-1) */
  successRate: number
  /** Average duration in milliseconds */
  avgDurationMs: number
  /** Total duration in milliseconds (internal) */
  totalDurationMs: number
}

/**
 * Priority to tier mapping
 */
export type PriorityMapping = Record<Priority, string>

/**
 * Registry for managing cascade tiers
 */
export class TierRegistry {
  private tiers = new Map<string, CascadeTier>()
  private failureMappings = new Map<FailurePattern, string>()
  private fallbackChains = new Map<string, string[]>()
  private availability = new Map<string, boolean>()
  private metrics = new Map<string, TierMetrics>()
  private autoFallbackEnabled = false
  private priorityMapping: PriorityMapping = {
    low: 'code',
    normal: 'generative',
    high: 'agentic',
    critical: 'senior-human',
  }

  /**
   * Register a new tier or update an existing one
   */
  registerTier(id: string, config: TierConfig): CascadeTier {
    const tier: CascadeTier = { id, ...config }
    this.tiers.set(id, tier)
    // Initialize availability to true by default
    if (!this.availability.has(id)) {
      this.availability.set(id, true)
    }
    // Initialize metrics
    if (!this.metrics.has(id)) {
      this.metrics.set(id, this.createEmptyMetrics())
    }
    return tier
  }

  /**
   * Get a tier by ID
   */
  getTier(id: string): CascadeTier | undefined {
    return this.tiers.get(id)
  }

  /**
   * Unregister a tier
   */
  unregisterTier(id: string): boolean {
    this.availability.delete(id)
    this.fallbackChains.delete(id)
    this.metrics.delete(id)
    return this.tiers.delete(id)
  }

  /**
   * List all registered tiers sorted by priority
   */
  listTiers(): CascadeTier[] {
    return Array.from(this.tiers.values()).sort((a, b) => a.priority - b.priority)
  }

  /**
   * Map a failure type to a tier
   */
  mapFailureToTier(failureType: FailurePattern, tierId: string): void {
    this.failureMappings.set(failureType, tierId)
  }

  /**
   * Route a failure type to the appropriate tier
   */
  routeToTier(failureType: FailureType): string | undefined {
    // First check for exact match
    if (this.failureMappings.has(failureType)) {
      return this.failureMappings.get(failureType)
    }

    // Then check for pattern matches
    for (const [pattern, tierId] of this.failureMappings) {
      if (pattern instanceof RegExp && pattern.test(failureType)) {
        return tierId
      }
    }

    return undefined
  }

  /**
   * Remove a failure type mapping
   */
  unmapFailureType(failureType: FailurePattern): boolean {
    return this.failureMappings.delete(failureType)
  }

  /**
   * Get all failure type mappings
   */
  getFailureMappings(): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [pattern, tierId] of this.failureMappings) {
      if (typeof pattern === 'string') {
        result[pattern] = tierId
      }
    }
    return result
  }

  /**
   * Set the priority to tier mapping
   */
  setPriorityMapping(mapping: Partial<PriorityMapping>): void {
    this.priorityMapping = { ...this.priorityMapping, ...mapping }
  }

  /**
   * Get the tier for a given priority level
   */
  getTierForPriority(priority: Priority): string | undefined {
    return this.priorityMapping[priority]
  }

  /**
   * Set the fallback chain for a tier
   */
  setFallbackChain(tierId: string, fallbacks: string[]): void {
    this.fallbackChains.set(tierId, fallbacks)
  }

  /**
   * Get the fallback chain for a tier
   */
  getFallbackChain(tierId: string): string[] | undefined {
    return this.fallbackChains.get(tierId)
  }

  /**
   * Enable automatic fallback based on tier priority
   */
  enableAutoFallback(): void {
    this.autoFallbackEnabled = true
  }

  /**
   * Disable automatic fallback
   */
  disableAutoFallback(): void {
    this.autoFallbackEnabled = false
  }

  /**
   * Get the next fallback tier
   */
  getNextFallback(tierId: string): string | undefined {
    // Check explicit fallback chain first
    const chain = this.fallbackChains.get(tierId)
    if (chain && chain.length > 0) {
      return chain[0]
    }

    // Check if this tier appears in another tier's fallback chain
    for (const [sourceTier, fallbacks] of this.fallbackChains) {
      const index = fallbacks.indexOf(tierId)
      if (index !== -1 && index < fallbacks.length - 1) {
        return fallbacks[index + 1]
      }
    }

    // If auto fallback is enabled, return next tier by priority
    if (this.autoFallbackEnabled) {
      const sortedTiers = this.listTiers()
      const currentIndex = sortedTiers.findIndex((t) => t.id === tierId)
      if (currentIndex !== -1 && currentIndex < sortedTiers.length - 1) {
        const nextTier = sortedTiers[currentIndex + 1]
        if (nextTier) {
          return nextTier.id
        }
      }
    }

    return undefined
  }

  /**
   * Get the full escalation path from a tier
   */
  getEscalationPath(tierId: string): string[] {
    const path = [tierId]
    const chain = this.fallbackChains.get(tierId)
    if (chain) {
      path.push(...chain)
    }
    return path
  }

  /**
   * Check if a tier is available
   */
  isTierAvailable(tierId: string): boolean | undefined {
    if (!this.tiers.has(tierId)) {
      return undefined
    }
    return this.availability.get(tierId) ?? true
  }

  /**
   * Set tier availability
   */
  setTierAvailability(tierId: string, available: boolean): void {
    this.availability.set(tierId, available)
  }

  /**
   * Check tier availability using custom function if defined
   */
  async checkTierAvailability(tierId: string): Promise<boolean> {
    const tier = this.tiers.get(tierId)
    if (!tier) {
      return false
    }
    if (tier.availabilityCheck) {
      return tier.availabilityCheck()
    }
    return this.availability.get(tierId) ?? true
  }

  /**
   * Get next available fallback tier
   */
  getNextAvailableFallback(tierId: string): string | undefined {
    const chain = this.fallbackChains.get(tierId)
    if (!chain) {
      return undefined
    }

    for (const fallbackId of chain) {
      if (this.isTierAvailable(fallbackId)) {
        return fallbackId
      }
    }

    return undefined
  }

  /**
   * Get all available tiers
   */
  getAvailableTiers(): CascadeTier[] {
    return this.listTiers().filter((tier) => this.isTierAvailable(tier.id))
  }

  /**
   * Record tier usage
   */
  recordTierUsage(tierId: string, options?: { durationMs?: number }): void {
    const metrics = this.metrics.get(tierId)
    if (metrics) {
      metrics.usageCount++
      if (options?.durationMs !== undefined) {
        metrics.totalDurationMs += options.durationMs
        metrics.avgDurationMs = metrics.totalDurationMs / metrics.usageCount
      }
    }
  }

  /**
   * Record tier result (success or failure)
   */
  recordTierResult(tierId: string, success: boolean): void {
    const metrics = this.metrics.get(tierId)
    if (metrics) {
      if (success) {
        metrics.successCount++
      } else {
        metrics.failureCount++
      }
      const total = metrics.successCount + metrics.failureCount
      metrics.successRate = total > 0 ? metrics.successCount / total : 0
    }
  }

  /**
   * Get metrics for a tier
   */
  getTierMetrics(tierId: string): TierMetrics | undefined {
    return this.metrics.get(tierId)
  }

  /**
   * Reset metrics for a tier
   */
  resetTierMetrics(tierId: string): void {
    this.metrics.set(tierId, this.createEmptyMetrics())
  }

  /**
   * Get all tier metrics
   */
  getAllMetrics(): Record<string, TierMetrics> {
    const result: Record<string, TierMetrics> = {}
    for (const [tierId, metrics] of this.metrics) {
      result[tierId] = { ...metrics }
    }
    return result
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): TierMetrics {
    return {
      usageCount: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      avgDurationMs: 0,
      totalDurationMs: 0,
    }
  }
}
