/**
 * In-memory Database Provider
 *
 * Simple provider implementation for testing and development.
 * Includes concurrency control via Semaphore for rate limiting.
 */

import type { DBProvider, ListOptions, SearchOptions } from './schema.js'

// =============================================================================
// Semaphore for Concurrency Control
// =============================================================================

/**
 * Simple semaphore for concurrency control
 * Used to limit parallel operations (e.g., embedding, generation)
 */
export class Semaphore {
  private queue: Array<() => void> = []
  private running = 0

  constructor(private concurrency: number) {}

  /**
   * Acquire a slot. Returns a release function.
   */
  async acquire(): Promise<() => void> {
    if (this.running < this.concurrency) {
      this.running++
      return () => this.release()
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.running++
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) next()
  }

  /**
   * Run a function with concurrency control
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire()
    try {
      return await fn()
    } finally {
      release()
    }
  }

  /**
   * Run multiple functions with concurrency control
   */
  async map<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    return Promise.all(items.map((item) => this.run(() => fn(item))))
  }

  get pending(): number {
    return this.queue.length
  }

  get active(): number {
    return this.running
  }
}

// =============================================================================
// Types
// =============================================================================

export interface Event {
  id: string
  type: string
  url?: string
  data: unknown
  timestamp: Date
}

export interface Action {
  id: string
  type: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  progress?: number
  total?: number
  data: unknown
  result?: unknown
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface Artifact {
  url: string
  type: string
  sourceHash: string
  content: unknown
  metadata?: Record<string, unknown>
  createdAt: Date
}

export interface MemoryProviderOptions {
  /** Concurrency limit for operations (default: 10) */
  concurrency?: number
}

// =============================================================================
// Generate ID
// =============================================================================

function generateId(): string {
  return crypto.randomUUID()
}

// =============================================================================
// In-memory Provider
// =============================================================================

/**
 * In-memory storage for entities, relationships, events, actions, and artifacts
 */
export class MemoryProvider implements DBProvider {
  // Things: type -> id -> entity
  private entities = new Map<string, Map<string, Record<string, unknown>>>()

  // Relationships: from:relation -> Set<to>
  private relations = new Map<string, Set<string>>()

  // Events: chronological log
  private events: Event[] = []
  private eventHandlers = new Map<string, Array<(event: Event) => void | Promise<void>>>()

  // Actions: id -> action
  private actions = new Map<string, Action>()

  // Artifacts: url:type -> artifact
  private artifacts = new Map<string, Artifact>()

  // Concurrency control
  private semaphore: Semaphore

  constructor(options: MemoryProviderOptions = {}) {
    this.semaphore = new Semaphore(options.concurrency ?? 10)
  }

  // ===========================================================================
  // Things (Records)
  // ===========================================================================

  private getTypeStore(type: string): Map<string, Record<string, unknown>> {
    if (!this.entities.has(type)) {
      this.entities.set(type, new Map())
    }
    return this.entities.get(type)!
  }

  async get(
    type: string,
    id: string
  ): Promise<Record<string, unknown> | null> {
    const store = this.getTypeStore(type)
    const entity = store.get(id)
    return entity ? { ...entity, $id: id, $type: type } : null
  }

  async list(
    type: string,
    options?: ListOptions
  ): Promise<Record<string, unknown>[]> {
    const store = this.getTypeStore(type)
    let results: Record<string, unknown>[] = []

    for (const [id, entity] of store) {
      const full: Record<string, unknown> = { ...entity, $id: id, $type: type }

      // Apply where filter
      if (options?.where) {
        let matches = true
        for (const [key, value] of Object.entries(options.where)) {
          if ((full as Record<string, unknown>)[key] !== value) {
            matches = false
            break
          }
        }
        if (!matches) continue
      }

      results.push(full)
    }

    // Sort
    if (options?.orderBy) {
      const field = options.orderBy
      const dir = options.order === 'desc' ? -1 : 1
      results.sort((a, b) => {
        const aVal = a[field]
        const bVal = b[field]
        if (aVal === undefined && bVal === undefined) return 0
        if (aVal === undefined) return dir
        if (bVal === undefined) return -dir
        if ((aVal as string | number) < (bVal as string | number)) return -dir
        if ((aVal as string | number) > (bVal as string | number)) return dir
        return 0
      })
    }

    // Paginate
    if (options?.offset) {
      results = results.slice(options.offset)
    }
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  async search(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]> {
    const all = await this.list(type, options)
    const queryLower = query.toLowerCase()
    const fields = options?.fields || ['$all']

    const scored: Array<{ entity: Record<string, unknown>; score: number }> = []

    for (const entity of all) {
      let searchText: string
      if (fields.includes('$all')) {
        searchText = JSON.stringify(entity).toLowerCase()
      } else {
        searchText = fields
          .map((f) => String(entity[f] || ''))
          .join(' ')
          .toLowerCase()
      }

      if (searchText.includes(queryLower)) {
        const index = searchText.indexOf(queryLower)
        const score = 1 - index / searchText.length
        if (!options?.minScore || score >= options.minScore) {
          scored.push({ entity, score })
        }
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.map((s) => s.entity)
  }

  async create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const store = this.getTypeStore(type)
    const entityId = id || generateId()

    if (store.has(entityId)) {
      throw new Error(`Entity already exists: ${type}/${entityId}`)
    }

    const entity = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    store.set(entityId, entity)

    // Emit event
    await this.emit(`${type}.created`, { $id: entityId, $type: type, ...entity })

    return { ...entity, $id: entityId, $type: type }
  }

  async update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const store = this.getTypeStore(type)
    const existing = store.get(id)

    if (!existing) {
      throw new Error(`Entity not found: ${type}/${id}`)
    }

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    }

    store.set(id, updated)

    // Emit event
    await this.emit(`${type}.updated`, { $id: id, $type: type, ...updated })

    // Invalidate artifacts when data changes
    await this.invalidateArtifacts(`${type}/${id}`)

    return { ...updated, $id: id, $type: type }
  }

  async delete(type: string, id: string): Promise<boolean> {
    const store = this.getTypeStore(type)

    if (!store.has(id)) {
      return false
    }

    store.delete(id)

    // Emit event
    await this.emit(`${type}.deleted`, { $id: id, $type: type })

    // Clean up relations
    for (const [key, targets] of this.relations) {
      if (key.startsWith(`${type}:${id}:`)) {
        this.relations.delete(key)
      }
      targets.delete(`${type}:${id}`)
    }

    // Clean up artifacts
    await this.deleteArtifact(`${type}/${id}`)

    return true
  }

  // ===========================================================================
  // Relationships
  // ===========================================================================

  private relationKey(
    fromType: string,
    fromId: string,
    relation: string
  ): string {
    return `${fromType}:${fromId}:${relation}`
  }

  async related(
    type: string,
    id: string,
    relation: string
  ): Promise<Record<string, unknown>[]> {
    const key = this.relationKey(type, id, relation)
    const targets = this.relations.get(key)

    if (!targets) return []

    const results: Record<string, unknown>[] = []
    for (const target of targets) {
      const [targetType, targetId] = target.split(':')
      const entity = await this.get(targetType!, targetId!)
      if (entity) {
        results.push(entity)
      }
    }

    return results
  }

  async relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void> {
    const key = this.relationKey(fromType, fromId, relation)

    if (!this.relations.has(key)) {
      this.relations.set(key, new Set())
    }

    this.relations.get(key)!.add(`${toType}:${toId}`)

    // Emit event
    await this.emit('Relation.created', {
      from: `${fromType}/${fromId}`,
      type: relation,
      to: `${toType}/${toId}`,
    })
  }

  async unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void> {
    const key = this.relationKey(fromType, fromId, relation)
    const targets = this.relations.get(key)

    if (targets) {
      targets.delete(`${toType}:${toId}`)

      // Emit event
      await this.emit('Relation.deleted', {
        from: `${fromType}/${fromId}`,
        type: relation,
        to: `${toType}/${toId}`,
      })
    }
  }

  // ===========================================================================
  // Events
  // ===========================================================================

  async emit(type: string, data: unknown): Promise<void> {
    const event: Event = {
      id: generateId(),
      type,
      data,
      timestamp: new Date(),
    }

    this.events.push(event)

    // Trigger handlers (with concurrency control)
    const handlers = this.getEventHandlers(type)
    await this.semaphore.map(handlers, (handler) =>
      Promise.resolve(handler(event))
    )
  }

  private getEventHandlers(type: string): Array<(event: Event) => void | Promise<void>> {
    const handlers: Array<(event: Event) => void | Promise<void>> = []

    for (const [pattern, patternHandlers] of this.eventHandlers) {
      if (this.matchesPattern(type, pattern)) {
        handlers.push(...patternHandlers)
      }
    }

    return handlers
  }

  private matchesPattern(type: string, pattern: string): boolean {
    if (pattern === type) return true
    if (pattern === '*') return true
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2)
      return type.startsWith(prefix + '.')
    }
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2)
      return type.endsWith('.' + suffix)
    }
    return false
  }

  on(pattern: string, handler: (event: Event) => void | Promise<void>): () => void {
    if (!this.eventHandlers.has(pattern)) {
      this.eventHandlers.set(pattern, [])
    }
    this.eventHandlers.get(pattern)!.push(handler)

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(pattern)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index !== -1) handlers.splice(index, 1)
      }
    }
  }

  async listEvents(options?: {
    type?: string
    since?: Date
    until?: Date
    limit?: number
  }): Promise<Event[]> {
    let results = [...this.events]

    if (options?.type) {
      results = results.filter((e) => this.matchesPattern(e.type, options.type!))
    }
    if (options?.since) {
      results = results.filter((e) => e.timestamp >= options.since!)
    }
    if (options?.until) {
      results = results.filter((e) => e.timestamp <= options.until!)
    }
    if (options?.limit) {
      results = results.slice(-options.limit)
    }

    return results
  }

  async replayEvents(options: {
    type?: string
    since?: Date
    handler: (event: Event) => void | Promise<void>
  }): Promise<void> {
    const events = await this.listEvents({
      type: options.type,
      since: options.since,
    })

    for (const event of events) {
      await this.semaphore.run(() => Promise.resolve(options.handler(event)))
    }
  }

  // ===========================================================================
  // Actions
  // ===========================================================================

  async createAction(data: {
    type: string
    data: unknown
    total?: number
  }): Promise<Action> {
    const action: Action = {
      id: generateId(),
      type: data.type,
      status: 'pending',
      progress: 0,
      total: data.total,
      data: data.data,
      createdAt: new Date(),
    }

    this.actions.set(action.id, action)

    await this.emit('Action.created', action)

    return action
  }

  async getAction(id: string): Promise<Action | null> {
    return this.actions.get(id) ?? null
  }

  async updateAction(
    id: string,
    updates: Partial<Pick<Action, 'status' | 'progress' | 'result' | 'error'>>
  ): Promise<Action> {
    const action = this.actions.get(id)
    if (!action) {
      throw new Error(`Action not found: ${id}`)
    }

    Object.assign(action, updates)

    if (updates.status === 'active' && !action.startedAt) {
      action.startedAt = new Date()
      await this.emit('Action.started', action)
    }

    if (updates.status === 'completed') {
      action.completedAt = new Date()
      await this.emit('Action.completed', action)
    }

    if (updates.status === 'failed') {
      action.completedAt = new Date()
      await this.emit('Action.failed', action)
    }

    return action
  }

  async listActions(options?: {
    status?: Action['status']
    type?: string
    limit?: number
  }): Promise<Action[]> {
    let results = Array.from(this.actions.values())

    if (options?.status) {
      results = results.filter((a) => a.status === options.status)
    }
    if (options?.type) {
      results = results.filter((a) => a.type === options.type)
    }
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  async retryAction(id: string): Promise<Action> {
    const action = this.actions.get(id)
    if (!action) {
      throw new Error(`Action not found: ${id}`)
    }
    if (action.status !== 'failed') {
      throw new Error(`Can only retry failed actions: ${id}`)
    }

    action.status = 'pending'
    action.error = undefined
    action.startedAt = undefined
    action.completedAt = undefined

    return action
  }

  async cancelAction(id: string): Promise<void> {
    const action = this.actions.get(id)
    if (!action) {
      throw new Error(`Action not found: ${id}`)
    }
    if (action.status === 'completed' || action.status === 'failed') {
      throw new Error(`Cannot cancel finished action: ${id}`)
    }

    action.status = 'failed'
    action.error = 'Cancelled'
    action.completedAt = new Date()

    await this.emit('Action.cancelled', action)
  }

  // ===========================================================================
  // Artifacts
  // ===========================================================================

  private artifactKey(url: string, type: string): string {
    return `${url}:${type}`
  }

  async getArtifact(url: string, type: string): Promise<Artifact | null> {
    return this.artifacts.get(this.artifactKey(url, type)) ?? null
  }

  async setArtifact(
    url: string,
    type: string,
    data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    const artifact: Artifact = {
      url,
      type,
      sourceHash: data.sourceHash,
      content: data.content,
      metadata: data.metadata,
      createdAt: new Date(),
    }

    this.artifacts.set(this.artifactKey(url, type), artifact)
  }

  async deleteArtifact(url: string, type?: string): Promise<void> {
    if (type) {
      this.artifacts.delete(this.artifactKey(url, type))
    } else {
      // Delete all artifacts for this URL
      for (const key of this.artifacts.keys()) {
        if (key.startsWith(`${url}:`)) {
          this.artifacts.delete(key)
        }
      }
    }
  }

  private async invalidateArtifacts(url: string): Promise<void> {
    // Keep embedding artifact but mark others for regeneration
    for (const [key, artifact] of this.artifacts) {
      if (key.startsWith(`${url}:`) && artifact.type !== 'embedding') {
        this.artifacts.delete(key)
      }
    }
  }

  async listArtifacts(url: string): Promise<Artifact[]> {
    const results: Artifact[] = []
    for (const [key, artifact] of this.artifacts) {
      if (key.startsWith(`${url}:`)) {
        results.push(artifact)
      }
    }
    return results
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Run an operation with concurrency control
   */
  async withConcurrency<T>(fn: () => Promise<T>): Promise<T> {
    return this.semaphore.run(fn)
  }

  /**
   * Run multiple operations with concurrency control
   */
  async mapWithConcurrency<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    return this.semaphore.map(items, fn)
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.entities.clear()
    this.relations.clear()
    this.events.length = 0
    this.actions.clear()
    this.artifacts.clear()
    this.eventHandlers.clear()
  }

  /**
   * Get stats
   */
  stats(): {
    entities: number
    relations: number
    events: number
    actions: { pending: number; active: number; completed: number; failed: number }
    artifacts: number
    concurrency: { active: number; pending: number }
  } {
    let entityCount = 0
    for (const store of this.entities.values()) {
      entityCount += store.size
    }

    let relationCount = 0
    for (const targets of this.relations.values()) {
      relationCount += targets.size
    }

    const actionStats = { pending: 0, active: 0, completed: 0, failed: 0 }
    for (const action of this.actions.values()) {
      actionStats[action.status]++
    }

    return {
      entities: entityCount,
      relations: relationCount,
      events: this.events.length,
      actions: actionStats,
      artifacts: this.artifacts.size,
      concurrency: {
        active: this.semaphore.active,
        pending: this.semaphore.pending,
      },
    }
  }
}

/**
 * Create an in-memory provider
 */
export function createMemoryProvider(options?: MemoryProviderOptions): MemoryProvider {
  return new MemoryProvider(options)
}
