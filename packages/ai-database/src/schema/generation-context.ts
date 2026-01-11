/**
 * GenerationContext - Manages state and context during cascade generation
 *
 * Provides context accumulation across cascading generations:
 * - Parent stack tracking for nested entity context
 * - Generated entities accumulation across a session
 * - generatedByType index for efficient type-based lookup
 * - Token counting for monitoring context size
 * - Auto-compaction when exceeding token limits
 * - Array generation context (previousInArray)
 * - Relationship tracking between generated entities
 * - Snapshot/branching for speculative generation
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Entity type representing a generated entity
 */
export interface Entity {
  /** Unique identifier */
  $id: string
  /** Entity type */
  $type: string
  /** Additional data fields */
  [key: string]: unknown
}

/**
 * Options for creating a GenerationContext
 */
export interface GenerationContextOptions {
  /** Maximum tokens allowed in context (default: Infinity) */
  maxContextTokens?: number
  /** Auto-compact when exceeding limit (default: false) */
  autoCompact?: boolean
}

/**
 * Snapshot of context state for restore/branching
 */
export interface ContextSnapshot {
  /** Number of generated entities at snapshot time */
  generatedCount: number
  /** Depth of parent stack at snapshot time */
  parentDepth: number
  /** When the snapshot was created */
  timestamp: Date
}

/**
 * Context for a specific field (used in array generation)
 */
export interface FieldContext {
  /** Previously generated items in this array field */
  previousInArray: Entity[]
}

/**
 * Options for building context string
 */
export interface BuildContextOptions {
  /** Maximum tokens for the context string */
  maxTokens?: number
  /** Types to prioritize in context */
  relevantTypes?: string[]
}

// =============================================================================
// Errors
// =============================================================================

/**
 * Error thrown when context exceeds token limit without auto-compact
 */
export class ContextOverflowError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContextOverflowError'
  }
}

// =============================================================================
// Constants
// =============================================================================

const CHARS_PER_TOKEN = 4

// =============================================================================
// GenerationContext Class
// =============================================================================

/**
 * Context for managing state during entity generation
 */
export class GenerationContext {
  private generated: Map<string, Entity> = new Map()
  private generatedByType: Map<string, Entity[]> = new Map()
  private parentStack: Entity[] = []
  private relationships: Array<{ from: string; to: string; verb: string }> = []
  private generationOrder: Entity[] = []
  private maxContextTokens: number
  private autoCompact: boolean

  // Array generation tracking
  private arrayContexts: Map<string, Entity[]> = new Map()

  constructor(options: GenerationContextOptions = {}) {
    this.maxContextTokens = options.maxContextTokens ?? Infinity
    this.autoCompact = options.autoCompact ?? false
  }

  // ============================================================================
  // PARENT MANAGEMENT
  // ============================================================================

  /**
   * Push a parent entity onto the stack
   */
  pushParent(entity: Entity): void {
    this.parentStack.push(entity)
  }

  /**
   * Pop the top parent from the stack
   */
  popParent(): Entity | undefined {
    return this.parentStack.pop()
  }

  /**
   * Get parent at specific depth (0 = immediate parent)
   */
  getParent(depth = 0): Entity | undefined {
    const index = this.parentStack.length - 1 - depth
    return index >= 0 ? this.parentStack[index] : undefined
  }

  /**
   * Get the entire parent chain (nearest first)
   */
  getParentChain(): Entity[] {
    return [...this.parentStack].reverse()
  }

  /**
   * Get the entire parent stack (oldest first)
   */
  getParentStack(): Entity[] {
    return [...this.parentStack]
  }

  // ============================================================================
  // GENERATED ENTITY MANAGEMENT
  // ============================================================================

  /**
   * Add a generated entity to the context
   */
  addGenerated(entity: Entity): void {
    // Check token limit before adding
    if (this.maxContextTokens !== Infinity) {
      const currentTokens = this.estimateTokens()
      const entityTokens = this.estimateEntityTokens(entity)

      if (currentTokens + entityTokens > this.maxContextTokens) {
        if (this.autoCompact) {
          this.compactOldest()
        } else {
          throw new ContextOverflowError(
            `Adding entity would exceed token limit (${currentTokens + entityTokens} > ${this.maxContextTokens})`
          )
        }
      }
    }

    this.generated.set(entity.$id, entity)
    this.generationOrder.push(entity)

    const byType = this.generatedByType.get(entity.$type) ?? []
    byType.push(entity)
    this.generatedByType.set(entity.$type, byType)
  }

  /**
   * Get entity by ID
   */
  getById(id: string): Entity | undefined {
    return this.generated.get(id)
  }

  /**
   * Get all entities of a specific type
   */
  getByType(type: string): Entity[] {
    return this.generatedByType.get(type) ?? []
  }

  /**
   * Get all generated entities
   */
  getAllGenerated(): Entity[] {
    return Array.from(this.generated.values())
  }

  /**
   * Get entities in generation order
   */
  getGenerationOrder(): Entity[] {
    return [...this.generationOrder]
  }

  // ============================================================================
  // ARRAY GENERATION CONTEXT
  // ============================================================================

  /**
   * Start tracking an array field generation
   */
  startArrayGeneration(fieldName: string): void {
    this.arrayContexts.set(fieldName, [])
  }

  /**
   * Add an item to an array generation context
   */
  addArrayItem(fieldName: string, entity: Entity): void {
    const items = this.arrayContexts.get(fieldName) ?? []
    items.push(entity)
    this.arrayContexts.set(fieldName, items)
  }

  /**
   * Get previously generated items in an array field
   */
  getPreviousInArray(fieldName: string): Entity[] {
    return this.arrayContexts.get(fieldName) ?? []
  }

  /**
   * Get context for a specific field (includes previousInArray)
   */
  getContextForField(fieldName: string): FieldContext {
    return {
      previousInArray: this.getPreviousInArray(fieldName),
    }
  }

  /**
   * End tracking an array field generation
   */
  endArrayGeneration(fieldName: string): void {
    this.arrayContexts.delete(fieldName)
  }

  // ============================================================================
  // RELATIONSHIP MANAGEMENT
  // ============================================================================

  /**
   * Add a relationship between entities
   */
  addRelationship(fromId: string, toId: string, verb: string): void {
    this.relationships.push({ from: fromId, to: toId, verb })
  }

  /**
   * Get relationships for an entity
   */
  getRelationships(entityId: string): Array<{ to: string; verb: string }> {
    return this.relationships
      .filter((r) => r.from === entityId)
      .map((r) => ({ to: r.to, verb: r.verb }))
  }

  // ============================================================================
  // TOKEN MANAGEMENT
  // ============================================================================

  /**
   * Estimate total tokens in context
   */
  estimateTokens(): number {
    let chars = 0
    const entities = Array.from(this.generated.values())
    for (const entity of entities) {
      chars += JSON.stringify(entity).length
    }
    for (const parent of this.parentStack) {
      chars += JSON.stringify(parent).length
    }
    return Math.ceil(chars / CHARS_PER_TOKEN)
  }

  /**
   * Estimate tokens for a single entity
   */
  estimateEntityTokens(entity: Entity): number {
    return Math.ceil(JSON.stringify(entity).length / CHARS_PER_TOKEN)
  }

  /**
   * Get remaining token budget
   */
  getRemainingTokenBudget(): number {
    return Math.max(0, this.maxContextTokens - this.estimateTokens())
  }

  /**
   * Compact oldest entries to free up space
   */
  private compactOldest(): void {
    // Remove oldest entries until we have room (target 50% of max)
    const targetTokens = Math.floor(this.maxContextTokens * 0.5)

    while (this.estimateTokens() > targetTokens && this.generationOrder.length > 0) {
      const oldest = this.generationOrder.shift()
      if (oldest) {
        this.generated.delete(oldest.$id)
        const byType = this.generatedByType.get(oldest.$type)
        if (byType) {
          const idx = byType.findIndex((e) => e.$id === oldest.$id)
          if (idx !== -1) byType.splice(idx, 1)
        }
      }
    }
  }

  // ============================================================================
  // CONTEXT BUILDING
  // ============================================================================

  /**
   * Build context string for AI generation
   */
  buildContextString(options: BuildContextOptions = {}): string {
    const parts: string[] = []

    // 1. Parent context
    if (this.parentStack.length > 0) {
      const parentInfo = this.parentStack
        .map((p) => `${p.$type}: ${JSON.stringify(p)}`)
        .join('\n')
      parts.push(`parent entities:\n${parentInfo}`)
    }

    // 2. Previously generated entities (prioritize relevant types)
    let entities = this.getAllGenerated()

    if (options.relevantTypes && options.relevantTypes.length > 0) {
      const relevant = entities.filter((e) => options.relevantTypes!.includes(e.$type))
      const other = entities.filter((e) => !options.relevantTypes!.includes(e.$type))
      entities = [...relevant, ...other]
    }

    if (entities.length > 0) {
      const entitiesJson = JSON.stringify(entities)
      parts.push(`Previously generated:\n${entitiesJson}`)
    }

    let result = parts.join('\n\n')

    // Truncate if needed
    if (options.maxTokens) {
      const maxChars = options.maxTokens * CHARS_PER_TOKEN
      if (result.length > maxChars) {
        result = result.slice(0, maxChars - 3) + '...'
      }
    }

    return result
  }

  // ============================================================================
  // SNAPSHOTS AND BRANCHING
  // ============================================================================

  /**
   * Create a snapshot of current state
   */
  createSnapshot(): ContextSnapshot {
    return {
      generatedCount: this.generated.size,
      parentDepth: this.parentStack.length,
      timestamp: new Date(),
    }
  }

  /**
   * Restore from a snapshot (clears additions after snapshot)
   */
  restoreSnapshot(snapshot: ContextSnapshot): void {
    // Trim generated to match snapshot count
    while (this.generated.size > snapshot.generatedCount) {
      const lastEntity = this.generationOrder.pop()
      if (lastEntity) {
        this.generated.delete(lastEntity.$id)
        const byType = this.generatedByType.get(lastEntity.$type)
        if (byType) byType.pop()
      }
    }

    // Trim parent stack
    while (this.parentStack.length > snapshot.parentDepth) {
      this.parentStack.pop()
    }
  }

  /**
   * Create a branch (copy) of this context
   */
  branch(): GenerationContext {
    const branched = new GenerationContext({
      maxContextTokens: this.maxContextTokens,
      autoCompact: this.autoCompact,
    })

    // Copy state
    const generatedEntries = Array.from(this.generated.entries())
    for (const [id, entity] of generatedEntries) {
      branched.generated.set(id, { ...entity })
    }
    const byTypeEntries = Array.from(this.generatedByType.entries())
    for (const [type, entities] of byTypeEntries) {
      branched.generatedByType.set(type, [...entities])
    }
    branched.parentStack = [...this.parentStack]
    branched.generationOrder = [...this.generationOrder]
    branched.relationships = [...this.relationships]

    // Copy array contexts
    const arrayContextEntries = Array.from(this.arrayContexts.entries())
    for (const [field, items] of arrayContextEntries) {
      branched.arrayContexts.set(field, [...items])
    }

    return branched
  }

  /**
   * Merge a branch back into this context
   */
  merge(branch: GenerationContext): void {
    const branchEntities = Array.from(branch.generated.values())
    for (const entity of branchEntities) {
      if (!this.generated.has(entity.$id)) {
        this.addGenerated(entity)
      }
    }
    for (const rel of branch.relationships) {
      const exists = this.relationships.some(
        (r) => r.from === rel.from && r.to === rel.to && r.verb === rel.verb
      )
      if (!exists) {
        this.relationships.push(rel)
      }
    }
  }

  // ============================================================================
  // SERIALIZATION
  // ============================================================================

  /**
   * Serialize context to JSON
   */
  toJSON(): string {
    return JSON.stringify({
      generated: Array.from(this.generated.values()),
      parents: this.parentStack,
      relationships: this.relationships,
      generationOrder: this.generationOrder.map((e) => e.$id),
    })
  }

  /**
   * Deserialize context from JSON
   */
  static fromJSON(json: string, options?: GenerationContextOptions): GenerationContext {
    const data = JSON.parse(json)
    const context = new GenerationContext(options)

    for (const entity of data.generated) {
      context.generated.set(entity.$id, entity)
      context.generationOrder.push(entity)
      const byType = context.generatedByType.get(entity.$type) ?? []
      byType.push(entity)
      context.generatedByType.set(entity.$type, byType)
    }

    for (const parent of data.parents) {
      context.pushParent(parent)
    }

    context.relationships = data.relationships ?? []

    return context
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new GenerationContext with the given options
 */
export function createGenerationContext(options?: GenerationContextOptions): GenerationContext {
  return new GenerationContext(options)
}
