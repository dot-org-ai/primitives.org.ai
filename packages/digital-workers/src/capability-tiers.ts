/**
 * Capability Tiers
 *
 * Agent capability tiers with complexity levels and toolsets.
 * Follows the cascade pattern: code < generative < agentic < human
 *
 * ## Tier Hierarchy
 *
 * 1. **Code** (complexity 1-2): Deterministic, pure functions
 *    - Tools: calculate, lookup, validate, transform
 *    - No AI, predictable outputs
 *
 * 2. **Generative** (complexity 3-5): LLM-powered generation
 *    - Tools: generate, summarize, analyze, classify
 *    - Uses AI but no autonomous actions
 *
 * 3. **Agentic** (complexity 6-8): Autonomous AI agents
 *    - Tools: browse, execute, plan, delegate
 *    - Can take actions, make decisions
 *
 * 4. **Human** (complexity 9-10): Human-in-the-loop
 *    - Tools: approve, review, decide, escalate
 *    - Requires human judgment
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Capability tier levels following cascade pattern
 */
export type CapabilityTier = 'code' | 'generative' | 'agentic' | 'human'

/**
 * Task complexity rating (1-10 scale)
 */
export type TaskComplexity = number

/**
 * Capability profile defining an agent's abilities
 */
export interface CapabilityProfile {
  /** Unique profile name */
  name: string
  /** Tier level */
  tier: CapabilityTier
  /** Complexity rating this profile can handle (1-10) */
  complexityRating: number
  /** Available tools for this profile */
  tools: string[]
  /** Optional description */
  description?: string
  /** Optional constraints */
  constraints?: ProfileConstraints
}

/**
 * Profile constraints
 */
export interface ProfileConstraints {
  maxTokens?: number
  allowedDomains?: string[]
  requiresApproval?: boolean
  timeout?: number
  maxRetries?: number
}

/**
 * Tier configuration
 */
export interface TierConfig {
  tier: CapabilityTier
  minComplexity: number
  maxComplexity: number
  description: string
  allowedTools: string[]
  defaultTimeout: number
}

/**
 * Toolset for a tier
 */
export interface TierToolset {
  tier: CapabilityTier
  tools: string[]
  includesLowerTiers: boolean
}

/**
 * Result of matching a tier to complexity
 */
export interface TierMatchResult {
  tier: CapabilityTier
  confidence: number
  suggestedTools: string[]
}

/**
 * Tier escalation request
 */
export interface TierEscalation {
  fromTier: CapabilityTier
  toTier: CapabilityTier
  reason: string
  skipJustification?: string
  allowDeescalation?: boolean
}

/**
 * Escalation validation result
 */
export interface EscalationValidationResult {
  valid: boolean
  error?: string
}

// ============================================================================
// Constants
// ============================================================================

/**
 * All capability tiers in order
 */
export const CAPABILITY_TIERS: readonly CapabilityTier[] = [
  'code',
  'generative',
  'agentic',
  'human',
] as const

/**
 * Tier order for comparison
 */
export const TIER_ORDER: Record<CapabilityTier, number> = {
  code: 0,
  generative: 1,
  agentic: 2,
  human: 3,
} as const

/**
 * Tools specific to each tier (not including inherited tools)
 */
const TIER_SPECIFIC_TOOLS: Record<CapabilityTier, string[]> = {
  code: ['calculate', 'lookup', 'validate', 'transform'],
  generative: ['generate', 'summarize', 'analyze', 'classify'],
  agentic: ['browse', 'execute', 'plan', 'delegate'],
  human: ['approve', 'review', 'decide', 'escalate'],
}

/**
 * Tier configurations
 */
const TIER_CONFIGS: Record<CapabilityTier, TierConfig> = {
  code: {
    tier: 'code',
    minComplexity: 1,
    maxComplexity: 2,
    description: 'Deterministic code execution with predictable outputs',
    allowedTools: TIER_SPECIFIC_TOOLS.code,
    defaultTimeout: 5000, // 5 seconds
  },
  generative: {
    tier: 'generative',
    minComplexity: 3,
    maxComplexity: 5,
    description: 'LLM-powered generation and analysis without autonomous actions',
    allowedTools: [...TIER_SPECIFIC_TOOLS.code, ...TIER_SPECIFIC_TOOLS.generative],
    defaultTimeout: 30000, // 30 seconds
  },
  agentic: {
    tier: 'agentic',
    minComplexity: 6,
    maxComplexity: 8,
    description: 'Autonomous AI agents that can take actions and make decisions',
    allowedTools: [
      ...TIER_SPECIFIC_TOOLS.code,
      ...TIER_SPECIFIC_TOOLS.generative,
      ...TIER_SPECIFIC_TOOLS.agentic,
    ],
    defaultTimeout: 300000, // 5 minutes
  },
  human: {
    tier: 'human',
    minComplexity: 9,
    maxComplexity: 10,
    description: 'Human-in-the-loop for tasks requiring human judgment',
    allowedTools: [
      ...TIER_SPECIFIC_TOOLS.code,
      ...TIER_SPECIFIC_TOOLS.generative,
      ...TIER_SPECIFIC_TOOLS.agentic,
      ...TIER_SPECIFIC_TOOLS.human,
    ],
    defaultTimeout: 86400000, // 24 hours
  },
}

// ============================================================================
// Tier Comparison Functions
// ============================================================================

/**
 * Compare two tiers
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
export function compareTiers(a: CapabilityTier, b: CapabilityTier): number {
  return TIER_ORDER[a] - TIER_ORDER[b]
}

/**
 * Check if tier A is higher than tier B
 */
export function isHigherTier(a: CapabilityTier, b: CapabilityTier): boolean {
  return TIER_ORDER[a] > TIER_ORDER[b]
}

/**
 * Check if tier A is lower than tier B
 */
export function isLowerTier(a: CapabilityTier, b: CapabilityTier): boolean {
  return TIER_ORDER[a] < TIER_ORDER[b]
}

/**
 * Get the next tier in escalation order
 * @returns next tier or null if at highest tier
 */
export function getNextTier(tier: CapabilityTier): CapabilityTier | null {
  const index = TIER_ORDER[tier]
  if (index >= CAPABILITY_TIERS.length - 1) {
    return null
  }
  return CAPABILITY_TIERS[index + 1] ?? null
}

/**
 * Get the previous tier in de-escalation order
 * @returns previous tier or null if at lowest tier
 */
export function getPreviousTier(tier: CapabilityTier): CapabilityTier | null {
  const index = TIER_ORDER[tier]
  if (index <= 0) {
    return null
  }
  return CAPABILITY_TIERS[index - 1] ?? null
}

// ============================================================================
// Tier Configuration Functions
// ============================================================================

/**
 * Get configuration for a tier
 */
export function getTierConfig(tier: CapabilityTier): TierConfig {
  return TIER_CONFIGS[tier]
}

/**
 * Get tools available for a tier (includes inherited tools from lower tiers)
 */
export function getToolsForTier(tier: CapabilityTier): string[] {
  return TIER_CONFIGS[tier].allowedTools
}

// ============================================================================
// Complexity Matching Functions
// ============================================================================

/**
 * Match a complexity rating to the appropriate tier
 */
export function matchTierToComplexity(complexity: TaskComplexity): TierMatchResult {
  // Validate complexity is in range
  const clampedComplexity = Math.max(1, Math.min(10, complexity))

  // Find the matching tier
  for (const tier of CAPABILITY_TIERS) {
    const config = TIER_CONFIGS[tier]
    if (clampedComplexity >= config.minComplexity && clampedComplexity <= config.maxComplexity) {
      // Calculate confidence based on how centered in the range
      const range = config.maxComplexity - config.minComplexity
      const center = config.minComplexity + range / 2
      const distance = Math.abs(clampedComplexity - center)
      const confidence = 1 - (distance / (range + 1)) * 0.2 // 0.8-1.0 range

      return {
        tier,
        confidence,
        suggestedTools: config.allowedTools,
      }
    }
  }

  // Handle boundary cases (between tiers)
  // Find which tier is closest
  let bestTier: CapabilityTier = 'code'
  let bestDistance = Infinity

  for (const tier of CAPABILITY_TIERS) {
    const config = TIER_CONFIGS[tier]
    const center = (config.minComplexity + config.maxComplexity) / 2
    const distance = Math.abs(clampedComplexity - center)
    if (distance < bestDistance) {
      bestDistance = distance
      bestTier = tier
    }
  }

  return {
    tier: bestTier,
    confidence: 0.7, // Lower confidence for boundary cases
    suggestedTools: TIER_CONFIGS[bestTier].allowedTools,
  }
}

/**
 * Check if a tier can execute a task of given complexity
 */
export function canExecuteAtTier(tier: CapabilityTier, complexity: TaskComplexity): boolean {
  const config = TIER_CONFIGS[tier]
  // A tier can handle its own complexity range or any lower complexity
  return complexity <= config.maxComplexity
}

// ============================================================================
// Escalation Functions
// ============================================================================

/**
 * Validate a tier escalation request
 */
export function validateTierEscalation(escalation: TierEscalation): EscalationValidationResult {
  const { fromTier, toTier, reason, skipJustification, allowDeescalation } = escalation

  // Require a reason
  if (!reason || reason.trim() === '') {
    return {
      valid: false,
      error: 'Escalation reason is required',
    }
  }

  const fromOrder = TIER_ORDER[fromTier]
  const toOrder = TIER_ORDER[toTier]

  // Check for de-escalation
  if (toOrder < fromOrder) {
    if (!allowDeescalation) {
      return {
        valid: false,
        error: 'de-escalation not allowed without explicit allowDeescalation flag',
      }
    }
    return { valid: true }
  }

  // Check for same tier (no-op)
  if (fromOrder === toOrder) {
    return { valid: true }
  }

  // Check for multi-level escalation (skipping tiers)
  const tierDifference = toOrder - fromOrder
  if (tierDifference > 1) {
    if (!skipJustification || skipJustification.trim() === '') {
      return {
        valid: false,
        error: 'skipJustification is required when skipping tiers',
      }
    }
  }

  return { valid: true }
}

// ============================================================================
// Profile Creation and Validation
// ============================================================================

/**
 * Create a capability profile with validation
 */
export function createCapabilityProfile(input: {
  name: string
  tier: CapabilityTier
  complexityRating: number
  tools: string[]
  description?: string
  constraints?: ProfileConstraints
}): CapabilityProfile {
  const { name, tier, complexityRating, tools, description, constraints } = input
  const config = TIER_CONFIGS[tier]

  // Validate complexity rating is within tier bounds
  if (complexityRating < config.minComplexity || complexityRating > config.maxComplexity) {
    throw new Error(
      `Complexity rating ${complexityRating} is outside bounds for ${tier} tier ` +
        `(${config.minComplexity}-${config.maxComplexity})`
    )
  }

  // Validate tools are appropriate for tier
  const allowedTools = new Set(config.allowedTools)
  for (const tool of tools) {
    if (!allowedTools.has(tool)) {
      throw new Error(
        `Tool '${tool}' is not allowed at ${tier} tier. ` +
          `Allowed tools: ${config.allowedTools.join(', ')}`
      )
    }
  }

  return {
    name,
    tier,
    complexityRating,
    tools,
    ...(description !== undefined && { description }),
    ...(constraints !== undefined && { constraints }),
  }
}

// ============================================================================
// Tier Registry
// ============================================================================

/**
 * Registry for managing capability profiles
 */
export class TierRegistry {
  private profiles: Map<string, CapabilityProfile> = new Map()

  /**
   * Register a capability profile
   */
  register(input: {
    name: string
    tier: CapabilityTier
    complexityRating: number
    tools: string[]
    description?: string
    constraints?: ProfileConstraints
  }): void {
    if (this.profiles.has(input.name)) {
      throw new Error(`Profile '${input.name}' is already registered`)
    }

    const profile = createCapabilityProfile(input)
    this.profiles.set(profile.name, profile)
  }

  /**
   * Get a profile by name
   */
  get(name: string): CapabilityProfile | undefined {
    return this.profiles.get(name)
  }

  /**
   * Unregister a profile
   */
  unregister(name: string): boolean {
    return this.profiles.delete(name)
  }

  /**
   * List all profiles for a tier
   */
  listByTier(tier: CapabilityTier): CapabilityProfile[] {
    const result: CapabilityProfile[] = []
    for (const profile of this.profiles.values()) {
      if (profile.tier === tier) {
        result.push(profile)
      }
    }
    return result
  }

  /**
   * Find profiles that can handle a given complexity
   */
  findByComplexity(complexity: TaskComplexity): CapabilityProfile[] {
    const result: CapabilityProfile[] = []
    for (const profile of this.profiles.values()) {
      if (canExecuteAtTier(profile.tier, complexity)) {
        result.push(profile)
      }
    }
    return result
  }

  /**
   * Find profiles with the required tools
   */
  findByTools(requiredTools: string[]): CapabilityProfile[] {
    const result: CapabilityProfile[] = []
    for (const profile of this.profiles.values()) {
      const profileTools = new Set(profile.tools)
      const hasAllTools = requiredTools.every((tool) => profileTools.has(tool))
      if (hasAllTools) {
        result.push(profile)
      }
    }
    return result
  }

  /**
   * List all registered profiles
   */
  listAll(): CapabilityProfile[] {
    return Array.from(this.profiles.values())
  }

  /**
   * Clear all profiles
   */
  clear(): void {
    this.profiles.clear()
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  CAPABILITY_TIERS,
  TIER_ORDER,
  compareTiers,
  isHigherTier,
  isLowerTier,
  getNextTier,
  getPreviousTier,
  getTierConfig,
  getToolsForTier,
  matchTierToComplexity,
  canExecuteAtTier,
  validateTierEscalation,
  createCapabilityProfile,
  TierRegistry,
}
