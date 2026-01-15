/**
 * In-memory implementation of DigitalObjectsProvider
 *
 * Used for testing and development. All data is stored in Maps.
 */

import type {
  DigitalObjectsProvider,
  Noun,
  NounDefinition,
  Verb,
  VerbDefinition,
  Thing,
  Action,
  ActionStatusType,
  ListOptions,
  ActionOptions,
  ValidationOptions,
  Direction,
} from './types.js'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_BATCH_SIZE,
  validateDirection,
  ActionStatus,
} from './types.js'
import { deriveNoun, deriveVerb } from './linguistic.js'
import { validateData } from './schema-validation.js'
import { NotFoundError, ValidationError } from './errors.js'

/**
 * Calculate effective limit with safety bounds
 */
function effectiveLimit(requestedLimit?: number): number {
  return Math.min(requestedLimit ?? DEFAULT_LIMIT, MAX_LIMIT)
}

function generateId(): string {
  return crypto.randomUUID()
}

// Dangerous field names that could enable prototype pollution or other attacks
const DANGEROUS_FIELDS = ['__proto__', 'constructor', 'prototype']

/**
 * Validates a where clause field name to prevent JSON path traversal and prototype pollution.
 * Throws ValidationError if the field name is invalid.
 *
 * Rejects:
 * - Dots (.) in field names (JSON path traversal)
 * - __proto__, constructor, prototype (prototype pollution)
 * - Special JSON path characters ([, ], $, @)
 */
function validateWhereField(field: string): void {
  // Check for dangerous prototype-related field names
  if (DANGEROUS_FIELDS.includes(field)) {
    throw new ValidationError(`Invalid where field: '${field}' is not allowed`, [
      { field, message: `Field name '${field}' is not allowed for security reasons` },
    ])
  }

  // Check for dots (JSON path traversal)
  if (field.includes('.')) {
    throw new ValidationError(`Invalid where field: '${field}' contains dots`, [
      { field, message: 'Field names cannot contain dots (JSON path traversal prevention)' },
    ])
  }

  // Check for special JSON path characters
  if (/[\[\]$@]/.test(field)) {
    throw new ValidationError(`Invalid where field: '${field}' contains special characters`, [
      { field, message: 'Field names cannot contain special JSON path characters ([, ], $, @)' },
    ])
  }

  // Must match valid identifier pattern (starts with letter or underscore, followed by alphanumeric or underscore)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
    throw new ValidationError(`Invalid where field: '${field}'`, [
      {
        field,
        message: 'Field name must be a valid identifier (letters, numbers, underscores only)',
      },
    ])
  }
}

export class MemoryProvider implements DigitalObjectsProvider {
  private nouns = new Map<string, Noun>()
  private verbs = new Map<string, Verb>()
  private things = new Map<string, Thing>()
  private actions = new Map<string, Action>()

  // ==================== Nouns ====================

  async defineNoun(def: NounDefinition): Promise<Noun> {
    const derived = deriveNoun(def.name)
    const noun: Noun = {
      name: def.name,
      singular: def.singular ?? derived.singular,
      plural: def.plural ?? derived.plural,
      slug: derived.slug,
      description: def.description,
      schema: def.schema,
      createdAt: new Date(),
    }
    this.nouns.set(noun.name, noun)
    return noun
  }

  async getNoun(name: string): Promise<Noun | null> {
    return this.nouns.get(name) ?? null
  }

  async listNouns(): Promise<Noun[]> {
    return Array.from(this.nouns.values())
  }

  // ==================== Verbs ====================

  async defineVerb(def: VerbDefinition): Promise<Verb> {
    const derived = deriveVerb(def.name)
    const verb: Verb = {
      name: def.name,
      action: def.action ?? derived.action,
      act: def.act ?? derived.act,
      activity: def.activity ?? derived.activity,
      event: def.event ?? derived.event,
      reverseBy: def.reverseBy ?? derived.reverseBy,
      reverseAt: derived.reverseAt,
      reverseIn: def.reverseIn ?? derived.reverseIn,
      inverse: def.inverse,
      description: def.description,
      createdAt: new Date(),
    }
    this.verbs.set(verb.name, verb)
    return verb
  }

  async getVerb(name: string): Promise<Verb | null> {
    return this.verbs.get(name) ?? null
  }

  async listVerbs(): Promise<Verb[]> {
    return Array.from(this.verbs.values())
  }

  // ==================== Things ====================

  async create<T>(
    noun: string,
    data: T,
    id?: string,
    options?: ValidationOptions
  ): Promise<Thing<T>> {
    // Validate data against noun schema if validation is enabled
    if (options?.validate) {
      const nounDef = this.nouns.get(noun)
      validateData(data as Record<string, unknown>, nounDef?.schema, options)
    }

    const thing: Thing<T> = {
      id: id ?? generateId(),
      noun,
      data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.things.set(thing.id, thing as Thing)
    return thing
  }

  async get<T>(id: string): Promise<Thing<T> | null> {
    return (this.things.get(id) as Thing<T>) ?? null
  }

  /**
   * Batch fetch multiple things by IDs
   * More efficient than N individual get() calls
   */
  async getMany<T>(ids: string[]): Promise<Thing<T>[]> {
    if (ids.length === 0) return []

    const results: Thing<T>[] = []
    for (const id of ids) {
      const thing = this.things.get(id)
      if (thing) {
        results.push(thing as Thing<T>)
      }
    }
    return results
  }

  async list<T>(noun: string, options?: ListOptions): Promise<Thing<T>[]> {
    let results = Array.from(this.things.values()).filter((t) => t.noun === noun) as Thing<T>[]

    if (options?.where) {
      // Use Object.getOwnPropertyNames to also catch __proto__ which is not enumerable with Object.keys
      const whereKeys = Object.getOwnPropertyNames(options.where)
      // Validate all field names before filtering
      for (const key of whereKeys) {
        validateWhereField(key)
      }
      results = results.filter((t) => {
        for (const key of whereKeys) {
          const value = (options.where as Record<string, unknown>)[key]
          if ((t.data as Record<string, unknown>)[key] !== value) {
            return false
          }
        }
        return true
      })
    }

    if (options?.orderBy) {
      const key = options.orderBy
      const dir = options.order === 'desc' ? -1 : 1
      results.sort((a, b) => {
        const aVal = (a.data as Record<string, unknown>)[key] as
          | string
          | number
          | boolean
          | null
          | undefined
        const bVal = (b.data as Record<string, unknown>)[key] as
          | string
          | number
          | boolean
          | null
          | undefined
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return 1 * dir
        if (bVal == null) return -1 * dir
        if (aVal < bVal) return -1 * dir
        if (aVal > bVal) return 1 * dir
        return 0
      })
    }

    if (options?.offset) {
      results = results.slice(options.offset)
    }

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    results = results.slice(0, limit)

    return results
  }

  async find<T>(noun: string, where: Partial<T>): Promise<Thing<T>[]> {
    return this.list<T>(noun, { where: where as Record<string, unknown> })
  }

  async update<T>(id: string, data: Partial<T>, options?: ValidationOptions): Promise<Thing<T>> {
    const existing = this.things.get(id)
    if (!existing) {
      throw new NotFoundError('Thing', id)
    }

    // Merge data for validation
    const mergedData = { ...existing.data, ...data } as T

    // Validate merged data against noun schema if validation is enabled
    if (options?.validate) {
      const nounDef = this.nouns.get(existing.noun)
      validateData(mergedData as Record<string, unknown>, nounDef?.schema, options)
    }

    // Ensure updatedAt is always strictly newer than createdAt
    const now = new Date()
    const updatedAt =
      now.getTime() <= existing.createdAt.getTime()
        ? new Date(existing.createdAt.getTime() + 1)
        : now

    const updated: Thing<T> = {
      ...existing,
      data: mergedData,
      updatedAt,
    }
    this.things.set(id, updated as Thing)
    return updated
  }

  async delete(id: string): Promise<boolean> {
    return this.things.delete(id)
  }

  async search<T>(query: string, options?: ListOptions): Promise<Thing<T>[]> {
    const q = query.toLowerCase()
    let results = Array.from(this.things.values()).filter((t) =>
      JSON.stringify(t.data).toLowerCase().includes(q)
    ) as Thing<T>[]

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    results = results.slice(0, limit)

    return results
  }

  // ==================== Actions ====================

  async perform<T>(verb: string, subject?: string, object?: string, data?: T): Promise<Action<T>> {
    const action: Action<T> = {
      id: generateId(),
      verb,
      subject,
      object,
      data,
      status: ActionStatus.COMPLETED,
      createdAt: new Date(),
      completedAt: new Date(),
    }
    this.actions.set(action.id, action as Action)
    return action
  }

  async getAction<T>(id: string): Promise<Action<T> | null> {
    return (this.actions.get(id) as Action<T>) ?? null
  }

  async listActions<T>(options?: ActionOptions): Promise<Action<T>[]> {
    let results = Array.from(this.actions.values()) as Action<T>[]

    if (options?.verb) {
      results = results.filter((a) => a.verb === options.verb)
    }

    if (options?.subject) {
      results = results.filter((a) => a.subject === options.subject)
    }

    if (options?.object) {
      results = results.filter((a) => a.object === options.object)
    }

    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status]
      results = results.filter((a) => statuses.includes(a.status))
    }

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    results = results.slice(0, limit)

    return results
  }

  async deleteAction(id: string): Promise<boolean> {
    return this.actions.delete(id)
  }

  // ==================== Graph Traversal ====================

  async related<T>(
    id: string,
    verb?: string,
    direction: Direction = 'out',
    options?: ListOptions
  ): Promise<Thing<T>[]> {
    const validDirection = validateDirection(direction)
    const edgesList = await this.edges(id, verb, validDirection)
    const relatedIds = new Set<string>()

    for (const edge of edgesList) {
      if (direction === 'out' || direction === 'both') {
        if (edge.subject === id && edge.object) {
          relatedIds.add(edge.object)
        }
      }
      if (direction === 'in' || direction === 'both') {
        if (edge.object === id && edge.subject) {
          relatedIds.add(edge.subject)
        }
      }
    }

    // Use batch query instead of N individual get() calls (fixes N+1 pattern)
    let results = await this.getMany<T>([...relatedIds])

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    results = results.slice(0, limit)

    return results
  }

  async edges<T>(
    id: string,
    verb?: string,
    direction: Direction = 'out',
    options?: ListOptions
  ): Promise<Action<T>[]> {
    const validDirection = validateDirection(direction)
    let results = Array.from(this.actions.values()) as Action<T>[]

    if (verb) {
      results = results.filter((a) => a.verb === verb)
    }

    results = results.filter((a) => {
      if (validDirection === 'out') return a.subject === id
      if (validDirection === 'in') return a.object === id
      return a.subject === id || a.object === id
    })

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    results = results.slice(0, limit)

    return results
  }

  // ==================== Batch Operations ====================

  async createMany<T>(noun: string, items: T[]): Promise<Thing<T>[]> {
    if (items.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`Batch size ${items.length} exceeds maximum of ${MAX_BATCH_SIZE}`, [
        { field: 'items', message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
      ])
    }
    return Promise.all(items.map((item) => this.create(noun, item)))
  }

  async updateMany<T>(updates: Array<{ id: string; data: Partial<T> }>): Promise<Thing<T>[]> {
    if (updates.length > MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Batch size ${updates.length} exceeds maximum of ${MAX_BATCH_SIZE}`,
        [{ field: 'items', message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` }]
      )
    }
    return Promise.all(updates.map((u) => this.update(u.id, u.data)))
  }

  async deleteMany(ids: string[]): Promise<boolean[]> {
    if (ids.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`Batch size ${ids.length} exceeds maximum of ${MAX_BATCH_SIZE}`, [
        { field: 'ids', message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
      ])
    }
    return Promise.all(ids.map((id) => this.delete(id)))
  }

  async performMany<T>(
    actions: Array<{ verb: string; subject?: string; object?: string; data?: T }>
  ): Promise<Action<T>[]> {
    if (actions.length > MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Batch size ${actions.length} exceeds maximum of ${MAX_BATCH_SIZE}`,
        [{ field: 'actions', message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` }]
      )
    }
    return Promise.all(actions.map((a) => this.perform(a.verb, a.subject, a.object, a.data)))
  }

  // ==================== Lifecycle ====================

  async close(): Promise<void> {
    this.nouns.clear()
    this.verbs.clear()
    this.things.clear()
    this.actions.clear()
  }
}

export function createMemoryProvider(): DigitalObjectsProvider {
  return new MemoryProvider()
}
