/**
 * RDBProviderAdapter Compliance Tests
 *
 * Verifies that RDBProviderAdapter correctly adapts an RDB instance
 * to the DBProvider interface.
 *
 * Uses a MockRDB that simulates the RDB interface for testing purposes.
 *
 * @packageDocumentation
 */

import { createProviderComplianceSuite } from '../provider-compliance-suite.js'
import { RDBProviderAdapter } from '../../src/rdb-provider-adapter.js'

/**
 * Mock RDB Entity interface
 */
interface MockRDBEntity {
  id: string
  type: string
  [key: string]: unknown
}

/**
 * Mock filter type
 */
type MockFilter = Record<string, unknown>

/**
 * Mock RDB Provider that simulates the @dotdo/rdb interface
 *
 * This is a simple in-memory implementation for testing the adapter.
 */
class MockRDB {
  private entities = new Map<string, Map<string, MockRDBEntity>>()
  private relations = new Map<string, Set<string>>()
  private idCounter = 0

  private getTypeStore(type: string): Map<string, MockRDBEntity> {
    if (!this.entities.has(type)) {
      this.entities.set(type, new Map())
    }
    return this.entities.get(type)!
  }

  private generateId(): string {
    return `mock-id-${++this.idCounter}`
  }

  async get(type: string, id: string): Promise<MockRDBEntity | null> {
    const store = this.getTypeStore(type)
    const entity = store.get(id)
    return entity ?? null
  }

  async list(
    type: string,
    options?: { limit?: number; offset?: number; orderBy?: string; order?: 'asc' | 'desc' }
  ): Promise<MockRDBEntity[]> {
    const store = this.getTypeStore(type)
    let results = Array.from(store.values())

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
    filter: MockFilter,
    options?: { limit?: number; offset?: number }
  ): Promise<MockRDBEntity[]> {
    const store = this.getTypeStore(type)
    let results = Array.from(store.values())

    // Apply filter
    for (const [field, condition] of Object.entries(filter)) {
      if (condition && typeof condition === 'object' && '$regex' in condition) {
        const regex = new RegExp((condition as { $regex: string }).$regex, 'i')
        results = results.filter((entity) => {
          const value = entity[field]
          return typeof value === 'string' && regex.test(value)
        })
      } else {
        results = results.filter((entity) => entity[field] === condition)
      }
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

  async create(type: string, data: Record<string, unknown>, id?: string): Promise<MockRDBEntity> {
    const store = this.getTypeStore(type)
    const entityId = id || this.generateId()

    if (store.has(entityId)) {
      throw new Error(`Entity ${type}/${entityId} already exists`)
    }

    const entity: MockRDBEntity = {
      id: entityId,
      type,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    store.set(entityId, entity)
    return entity
  }

  async update(type: string, id: string, data: Record<string, unknown>): Promise<MockRDBEntity> {
    const store = this.getTypeStore(type)
    const existing = store.get(id)

    if (!existing) {
      throw new Error(`Entity ${type}/${id} not found`)
    }

    const updated: MockRDBEntity = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    }

    store.set(id, updated)
    return updated
  }

  async delete(type: string, id: string): Promise<void> {
    const store = this.getTypeStore(type)

    if (!store.has(id)) {
      throw new Error(`Entity ${type}/${id} not found`)
    }

    store.delete(id)

    // Clean up relations
    for (const [key, targets] of this.relations) {
      if (key.startsWith(`${type}:${id}:`)) {
        this.relations.delete(key)
      }
      targets.delete(`${type}:${id}`)
    }
  }

  async relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    _metadata?: Record<string, unknown>
  ): Promise<void> {
    const key = `${fromType}:${fromId}:${relation}`

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
    const key = `${fromType}:${fromId}:${relation}`
    const targets = this.relations.get(key)

    if (targets) {
      targets.delete(`${toType}:${toId}`)
    }
  }

  async related(
    type: string,
    id: string,
    relation: string,
    options?: { direction?: 'outgoing' | 'incoming' | 'both'; limit?: number; offset?: number }
  ): Promise<MockRDBEntity[]> {
    const direction = options?.direction ?? 'outgoing'
    const results: MockRDBEntity[] = []

    if (direction === 'outgoing' || direction === 'both') {
      const key = `${type}:${id}:${relation}`
      const targets = this.relations.get(key)

      if (targets) {
        for (const target of targets) {
          const [targetType, targetId] = target.split(':')
          const entity = await this.get(targetType!, targetId!)
          if (entity) {
            results.push(entity)
          }
        }
      }
    }

    if (direction === 'incoming' || direction === 'both') {
      // Look for relationships pointing to this entity
      for (const [key, targets] of this.relations) {
        if (targets.has(`${type}:${id}`)) {
          const [fromType, fromId] = key.split(':')
          const entity = await this.get(fromType!, fromId!)
          if (entity) {
            results.push(entity)
          }
        }
      }
    }

    // Paginate
    let finalResults = results
    if (options?.offset) {
      finalResults = finalResults.slice(options.offset)
    }
    if (options?.limit) {
      finalResults = finalResults.slice(0, options.limit)
    }

    return finalResults
  }

  clear(): void {
    this.entities.clear()
    this.relations.clear()
  }
}

// Store the mock RDB instance for cleanup
let mockRdb: MockRDB | null = null

createProviderComplianceSuite('RDBProviderAdapter', {
  factory: () => {
    mockRdb = new MockRDB()
    return new RDBProviderAdapter(mockRdb)
  },
  cleanup: () => {
    if (mockRdb) {
      mockRdb.clear()
      mockRdb = null
    }
  },
  capabilities: {
    // RDB adapter only implements core DBProvider, not extended features
    extended: false,
    transactions: false,
    semanticSearch: false,
    events: false,
    actions: false,
    artifacts: false,
  },
})
