/**
 * Factory functions for creating mock database providers in tests.
 *
 * These providers simulate entity storage with CRUD operations and
 * configurable semantic search scoring. Use them instead of defining
 * large inline mock objects in every test.
 */

export interface MockEntity extends Record<string, unknown> {
  $id: string
  $type: string
}

export type SemanticScoreFn = (entity: MockEntity, query: string) => number

/**
 * Default semantic scoring: exact name match = 0.95, partial = 0.80, no match = 0.3
 */
export function defaultNameScorer(entity: MockEntity, query: string): number {
  const name = (entity.name as string).toLowerCase()
  const queryLower = query.toLowerCase()
  if (name === queryLower) return 0.95
  if (name.includes(queryLower) || queryLower.includes(name)) return 0.8
  return 0.3
}

/**
 * Exact-only scorer: exact match = 0.95, everything else = 0.3
 */
export function exactOnlyScorer(entity: MockEntity, query: string): number {
  const name = (entity.name as string).toLowerCase()
  return name === query.toLowerCase() ? 0.95 : 0.2
}

/**
 * First-word name scorer: matches if query includes the first word of the name.
 * Returns 0.9 on match, 0.3 otherwise.
 */
export function firstWordNameScorer(entity: MockEntity, query: string): number {
  const name = (entity.name as string).toLowerCase()
  const queryLower = query.toLowerCase()
  if (name.includes(queryLower) || queryLower.includes(name.split(' ')[0] || '')) return 0.9
  return 0.3
}

/**
 * Title-based first-word scorer for entities keyed on `title` instead of `name`.
 * Returns 0.88 on match, 0.3 otherwise.
 */
export function titleFirstWordScorer(entity: MockEntity, query: string): number {
  const title = (entity.title as string).toLowerCase()
  const queryLower = query.toLowerCase()
  if (title.includes(queryLower) || queryLower.includes(title.split(' ')[0] || '')) return 0.88
  return 0.3
}

/**
 * Threshold-aware scorer used for testing per-entity threshold behavior.
 * "javascript" exact = 0.95, other exact = 0.82, partial = 0.7, none = 0.3
 */
export function thresholdTestScorer(entity: MockEntity, query: string): number {
  const name = (entity.name as string).toLowerCase()
  const queryLower = query.toLowerCase()
  if (name === queryLower && queryLower === 'javascript') return 0.95
  if (name === queryLower) return 0.82
  if (name.includes(queryLower) || queryLower.includes(name)) return 0.7
  return 0.3
}

export interface CreateMockProviderOptions {
  /** Initial entities grouped by type */
  entities: Record<string, MockEntity[]>
  /** Custom semantic search scoring function (defaults to defaultNameScorer) */
  scorer?: SemanticScoreFn
  /**
   * If true, semanticSearch always returns [] regardless of scorer.
   * Useful for testing when all entities should be generated.
   */
  noSemanticResults?: boolean
}

/**
 * Create a mock database provider with in-memory storage and configurable
 * semantic search scoring.
 */
export function createMockProvider(options: CreateMockProviderOptions) {
  const {
    entities: initialEntities,
    scorer = defaultNameScorer,
    noSemanticResults = false,
  } = options

  const entities = new Map<string, Map<string, Record<string, unknown>>>()
  for (const [type, items] of Object.entries(initialEntities)) {
    entities.set(type, new Map(items.map((e) => [e.$id, e])))
  }

  return {
    entities,
    relations: new Map(),

    async get(type: string, id: string) {
      return this.entities.get(type)?.get(id) ?? null
    },

    async list(type: string) {
      return Array.from(this.entities.get(type)?.values() ?? [])
    },

    async search() {
      return []
    },

    async create(type: string, id: string | undefined, data: Record<string, unknown>) {
      const entityId =
        id || `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const entity = { $id: entityId, $type: type, ...data }
      if (!this.entities.has(type)) {
        this.entities.set(type, new Map())
      }
      this.entities.get(type)!.set(entityId, entity)
      return entity
    },

    async update(type: string, id: string, data: Record<string, unknown>) {
      const existing = await this.get(type, id)
      if (!existing) throw new Error(`Not found: ${type}/${id}`)
      const updated = { ...existing, ...data }
      this.entities.get(type)!.set(id, updated)
      return updated
    },

    async delete(type: string, id: string) {
      return this.entities.get(type)?.delete(id) ?? false
    },

    async relate() {},
    async unrelate() {},
    async related() {
      return []
    },

    async semanticSearch(
      type: string,
      query: string,
      searchOptions?: { minScore?: number; limit?: number }
    ) {
      if (noSemanticResults) return []
      const minScore = searchOptions?.minScore ?? 0.75
      const items = Array.from(this.entities.get(type)?.values() ?? [])

      const results = items
        .map((entity) => {
          const score = scorer(entity as MockEntity, query)
          return { ...entity, $score: score }
        })
        .filter((r) => r.$score >= minScore)

      return results.sort((a, b) => b.$score - a.$score)
    },
  }
}
