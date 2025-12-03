/**
 * In-memory Database Provider
 *
 * Simple provider implementation for testing and development.
 */

import type { DBProvider, ListOptions, SearchOptions } from './schema.js'

/**
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID()
}

/**
 * In-memory storage for entities and relationships
 */
export class MemoryProvider implements DBProvider {
  // type -> id -> entity
  private entities = new Map<string, Map<string, Record<string, unknown>>>()

  // from:relation -> Set<to>
  private relations = new Map<string, Set<string>>()

  private getTypeStore(type: string): Map<string, Record<string, unknown>> {
    if (!this.entities.has(type)) {
      this.entities.set(type, new Map())
    }
    return this.entities.get(type)!
  }

  private relationKey(
    fromType: string,
    fromId: string,
    relation: string
  ): string {
    return `${fromType}:${fromId}:${relation}`
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
      const full = { ...entity, $id: id, $type: type }

      // Apply where filter
      if (options?.where) {
        let matches = true
        for (const [key, value] of Object.entries(options.where)) {
          if (full[key] !== value) {
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

    return { ...updated, $id: id, $type: type }
  }

  async delete(type: string, id: string): Promise<boolean> {
    const store = this.getTypeStore(type)

    if (!store.has(id)) {
      return false
    }

    store.delete(id)

    // Also clean up any relations
    for (const [key, targets] of this.relations) {
      if (key.startsWith(`${type}:${id}:`)) {
        this.relations.delete(key)
      }
      // Remove from reverse relations
      targets.delete(`${type}:${id}`)
    }

    return true
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
    }
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.entities.clear()
    this.relations.clear()
  }

  /**
   * Get stats
   */
  stats(): { entities: number; relations: number } {
    let entityCount = 0
    for (const store of this.entities.values()) {
      entityCount += store.size
    }

    let relationCount = 0
    for (const targets of this.relations.values()) {
      relationCount += targets.size
    }

    return { entities: entityCount, relations: relationCount }
  }
}

/**
 * Create an in-memory provider
 */
export function createMemoryProvider(): MemoryProvider {
  return new MemoryProvider()
}
