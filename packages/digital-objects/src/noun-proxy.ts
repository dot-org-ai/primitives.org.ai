/**
 * Proxy runtime dispatch for Noun entities
 *
 * Creates a Proxy that intercepts property access to dispatch:
 * - Verb actions (create, qualify) → async execution functions
 * - Verb activities (creating, qualifying) → BEFORE hook registration
 * - Verb events (created, qualified) → AFTER hook registration
 * - Disabled verbs → null
 * - $schema, $name → static schema access
 */

import type {
  NounSchema,
  NounInstance,
  NounEntity,
  NounProvider,
  PipelineableNounProvider,
  RpcPromise,
  BeforeHookHandler,
  AfterHookHandler,
  VerbConjugation,
  EntityEvent,
} from './noun-types.js'
import { deriveVerb } from './linguistic.js'

function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') return structuredClone(obj)
  return JSON.parse(JSON.stringify(obj))
}

// =============================================================================
// ID Generation
// =============================================================================

const SQID_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateSqid(): string {
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += SQID_CHARS[Math.floor(Math.random() * SQID_CHARS.length)]
  }
  return result
}

function generateEntityId(type: string): string {
  return `${type.toLowerCase()}_${generateSqid()}`
}

// =============================================================================
// Tenant Context
// =============================================================================

function getTenantContext(): string {
  const tenant =
    (typeof process !== 'undefined' && process.env?.['HEADLESSLY_TENANT']) || 'default'
  return `https://headless.ly/~${tenant}`
}

// =============================================================================
// Global Provider
// =============================================================================

let globalProvider: NounProvider | undefined

// =============================================================================
// Entity Registry (for $ context in after hooks)
// =============================================================================

let entityRegistry: Record<string, unknown> | undefined

/**
 * Set the global entity registry used as $ context in after hooks.
 * Called by the SDK to inject the allEntities map so that
 * after hooks like `Deal.closed((deal, $) => { $.Subscription.create(...) })`
 * receive the full entity graph as the second argument.
 */
export function setEntityRegistry(registry: Record<string, unknown>): void {
  entityRegistry = registry
}

/**
 * Get the current entity registry
 */
export function getEntityRegistry(): Record<string, unknown> | undefined {
  return entityRegistry
}

// =============================================================================
// Global Event Bus
// =============================================================================

type EventCallback = (event: EntityEvent) => void
const eventBusCallbacks: EventCallback[] = []

/**
 * Emit an entity event to all global subscribers
 */
function emitEvent(event: EntityEvent): void {
  for (const cb of eventBusCallbacks) {
    try {
      cb(event)
    } catch {
      // Subscriber errors must not crash the emitter
    }
  }
}

/**
 * Subscribe to ALL entity events globally.
 * Returns an unsubscribe function.
 */
export function subscribeToEvents(callback: EventCallback): () => void {
  eventBusCallbacks.push(callback)
  return () => {
    const idx = eventBusCallbacks.indexOf(callback)
    if (idx !== -1) eventBusCallbacks.splice(idx, 1)
  }
}

/**
 * Clear all global event bus subscribers (for testing)
 */
export function clearEventBus(): void {
  eventBusCallbacks.length = 0
}

// Scoped provider support for multi-tenant
let providerFactory: ((context?: string) => NounProvider) | undefined

/**
 * Set the global NounProvider used by all Noun proxies
 */
export function setProvider(provider: NounProvider): void {
  globalProvider = provider
}

/**
 * Set a provider factory for scoped/multi-tenant usage.
 * When set, getProvider() calls the factory with the current context.
 */
export function setProviderFactory(factory: (context?: string) => NounProvider): void {
  providerFactory = factory
}

/**
 * Clear the provider factory
 */
export function clearProviderFactory(): void {
  providerFactory = undefined
}

/**
 * Get the current global NounProvider (creates default if none set)
 */
export function getProvider(): NounProvider {
  if (providerFactory) {
    return providerFactory()
  }
  if (!globalProvider) {
    globalProvider = new MemoryNounProvider()
  }
  return globalProvider
}

/**
 * Check if the current provider supports promise pipelining
 */
function isPipelineable(provider: NounProvider): provider is PipelineableNounProvider {
  return 'pipelineable' in provider && (provider as PipelineableNounProvider).pipelineable === true
}

// =============================================================================
// MongoDB-style filter matching
// =============================================================================

/**
 * Check if an operator object contains MongoDB-style query operators.
 * Operator keys start with '$' (e.g. $gt, $gte, $lt, $lte, $in, $nin, $exists, $regex).
 */
function isOperatorObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).some((k) => k.startsWith('$'))
  )
}

/**
 * Match a single field value against a filter value.
 * Supports both exact equality and MongoDB-style operators:
 * $gt, $gte, $lt, $lte, $in, $nin, $exists, $regex, $eq, $ne
 */
function matchFilterValue(fieldValue: unknown, filterValue: unknown): boolean {
  if (isOperatorObject(filterValue)) {
    for (const [op, opVal] of Object.entries(filterValue)) {
      switch (op) {
        case '$eq':
          if (fieldValue !== opVal) return false
          break
        case '$ne':
          if (fieldValue === opVal) return false
          break
        case '$gt':
          if (typeof fieldValue !== 'number' || typeof opVal !== 'number' || fieldValue <= opVal) return false
          break
        case '$gte':
          if (typeof fieldValue !== 'number' || typeof opVal !== 'number' || fieldValue < opVal) return false
          break
        case '$lt':
          if (typeof fieldValue !== 'number' || typeof opVal !== 'number' || fieldValue >= opVal) return false
          break
        case '$lte':
          if (typeof fieldValue !== 'number' || typeof opVal !== 'number' || fieldValue > opVal) return false
          break
        case '$in':
          if (!Array.isArray(opVal) || !opVal.includes(fieldValue)) return false
          break
        case '$nin':
          if (!Array.isArray(opVal) || opVal.includes(fieldValue)) return false
          break
        case '$exists':
          if (opVal && fieldValue === undefined) return false
          if (!opVal && fieldValue !== undefined) return false
          break
        case '$regex': {
          const re = opVal instanceof RegExp ? opVal : new RegExp(opVal as string)
          if (typeof fieldValue !== 'string' || !re.test(fieldValue)) return false
          break
        }
        default:
          // Unknown operator — treat as non-match
          return false
      }
    }
    return true
  }
  return fieldValue === filterValue
}

// =============================================================================
// MemoryNounProvider — default in-process provider
// =============================================================================

export class MemoryNounProvider implements NounProvider {
  private store = new Map<string, NounInstance>()
  private eventLogByEntity = new Map<string, EntityEvent[]>()
  private static readonly MAX_EVENTS_PER_ENTITY = 1000

  private recordEvent(event: EntityEvent): void {
    let entityEvents = this.eventLogByEntity.get(event.entityId)
    if (!entityEvents) {
      entityEvents = []
      this.eventLogByEntity.set(event.entityId, entityEvents)
    }
    entityEvents.push(event)
    // Cap per-entity log
    if (entityEvents.length > MemoryNounProvider.MAX_EVENTS_PER_ENTITY) {
      entityEvents.shift()
    }
    emitEvent(event)
  }

  async create(type: string, data: Record<string, unknown>): Promise<NounInstance> {
    const now = new Date().toISOString()
    const instance: NounInstance = {
      $id: generateEntityId(type),
      $type: type,
      $context: getTenantContext(),
      $version: 1,
      $createdAt: now,
      $updatedAt: now,
      ...data,
    }
    this.store.set(instance.$id, instance)
    const event: EntityEvent = {
      type,
      action: 'created',
      entityId: instance.$id,
      data: deepClone(instance),
      previousData: null,
      timestamp: now,
      version: 1,
    }
    this.recordEvent(event)
    return instance
  }

  async get(type: string, id: string): Promise<NounInstance | null> {
    const instance = this.store.get(id)
    if (!instance || instance.$type !== type) return null
    return instance
  }

  async find(type: string, where?: Record<string, unknown>): Promise<NounInstance[]> {
    const context = getTenantContext()
    const results: NounInstance[] = []
    for (const instance of this.store.values()) {
      if (instance.$type !== type) continue
      if (instance.$context !== context) continue
      if (where) {
        let match = true
        for (const [key, value] of Object.entries(where)) {
          if (!matchFilterValue(instance[key], value)) {
            match = false
            break
          }
        }
        if (!match) continue
      }
      results.push(instance)
    }
    return results
  }

  async findOne(type: string, where?: Record<string, unknown>): Promise<NounInstance | null> {
    const results = await this.find(type, where)
    return results[0] ?? null
  }

  async update(type: string, id: string, data: Record<string, unknown>): Promise<NounInstance> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) {
      throw new Error(`${type} not found: ${id}`)
    }
    const previousData = deepClone(existing)
    const updated: NounInstance = {
      ...existing,
      ...data,
      $id: existing.$id,
      $type: existing.$type,
      $context: existing.$context,
      $version: existing.$version + 1,
      $createdAt: existing.$createdAt,
      $updatedAt: new Date().toISOString(),
    }
    this.store.set(id, updated)
    const event: EntityEvent = {
      type,
      action: 'updated',
      entityId: id,
      data: deepClone(updated),
      previousData,
      timestamp: updated.$updatedAt,
      version: updated.$version,
    }
    this.recordEvent(event)
    return updated
  }

  async delete(type: string, id: string): Promise<boolean> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) return false
    const previousData = deepClone(existing)
    const result = this.store.delete(id)
    if (result) {
      const event: EntityEvent = {
        type,
        action: 'deleted',
        entityId: id,
        data: null,
        previousData,
        timestamp: new Date().toISOString(),
        version: existing.$version,
      }
      this.recordEvent(event)
    }
    return result
  }

  async perform(
    type: string,
    verb: string,
    id: string,
    data?: Record<string, unknown>,
  ): Promise<NounInstance> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) {
      throw new Error(`${type} not found: ${id}`)
    }
    if (data) {
      const previousData = deepClone(existing)
      const updated: NounInstance = {
        ...existing,
        ...data,
        $id: existing.$id,
        $type: existing.$type,
        $context: existing.$context,
        $version: existing.$version + 1,
        $createdAt: existing.$createdAt,
        $updatedAt: new Date().toISOString(),
      }
      this.store.set(id, updated)
      const event: EntityEvent = {
        type,
        action: 'performed',
        verb,
        entityId: id,
        data: deepClone(updated),
        previousData,
        timestamp: updated.$updatedAt,
        version: updated.$version,
      }
      this.recordEvent(event)
      return updated
    }
    return existing
  }

  async rollback(type: string, id: string, toVersion: number): Promise<NounInstance> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) {
      throw new Error(`${type} not found: ${id}`)
    }
    // Find the event at the target version (per-entity lookup)
    const entityEvents = this.eventLogByEntity.get(id) ?? []
    const targetEvent = entityEvents.find(
      (e) => e.version === toVersion && e.data !== null,
    )
    if (!targetEvent || !targetEvent.data) {
      throw new Error(`Version ${toVersion} not found for ${type}: ${id}`)
    }
    // Create a new version with the old state (not rewriting history)
    const previousData = deepClone(existing)
    const snapshot = targetEvent.data
    const restored: NounInstance = {
      ...snapshot,
      $id: existing.$id,
      $type: existing.$type,
      $context: existing.$context,
      $version: existing.$version + 1,
      $createdAt: existing.$createdAt,
      $updatedAt: new Date().toISOString(),
    }
    this.store.set(id, restored)
    const event: EntityEvent = {
      type,
      action: 'rolled_back',
      entityId: id,
      data: deepClone(restored),
      previousData,
      timestamp: restored.$updatedAt,
      version: restored.$version,
    }
    this.recordEvent(event)
    return restored
  }

  /**
   * Get all events for an entity (for debugging/testing)
   */
  getEvents(entityId?: string): EntityEvent[] {
    if (entityId) {
      return [...(this.eventLogByEntity.get(entityId) ?? [])]
    }
    const all: EntityEvent[] = []
    for (const events of this.eventLogByEntity.values()) {
      all.push(...events)
    }
    return all
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.store.clear()
    this.eventLogByEntity.clear()
  }
}

// =============================================================================
// Proxy Creation
// =============================================================================

/**
 * Build lookup maps for fast verb resolution from the schema
 */
function buildVerbLookups(schema: NounSchema): {
  actionMap: Map<string, VerbConjugation>
  activityMap: Map<string, VerbConjugation>
  eventMap: Map<string, VerbConjugation>
} {
  const actionMap = new Map<string, VerbConjugation>()
  const activityMap = new Map<string, VerbConjugation>()
  const eventMap = new Map<string, VerbConjugation>()

  for (const [_name, conj] of schema.verbs) {
    actionMap.set(conj.action, conj)
    activityMap.set(conj.activity, conj)
    eventMap.set(conj.event, conj)
  }

  return { actionMap, activityMap, eventMap }
}

/**
 * Resolve the state transition data for a custom verb.
 *
 * Verb declarations like `qualify: 'Qualified'` define a target state value.
 * This function determines which entity field to set that value on.
 *
 * Resolution order:
 * 1. Exact enum match — find an enum field that contains the target value
 * 2. Entity awareness — if entity has `stage`/`status`/`state` fields, use the first match
 * 3. Schema convention — fall back to `stage` or `status` fields defined in the schema
 *
 * Returns { fieldName: targetValue } or empty object if not resolvable.
 */
function resolveVerbTransition(schema: NounSchema, verb: string, entity?: NounInstance): Record<string, unknown> {
  const rawValue = schema.raw[verb]
  if (typeof rawValue !== 'string') return {}

  // rawValue is the PascalCase target (e.g., 'Qualified', 'Closed', 'Paused')
  const target = rawValue

  // Strategy 1: Find an enum field that explicitly contains this target value
  for (const [fieldName, fieldDef] of schema.fields) {
    if (fieldDef.kind === 'enum' && fieldDef.enumValues) {
      if (fieldDef.enumValues.includes(target)) {
        return { [fieldName]: target }
      }
    }
  }

  // Strategy 2: Entity awareness — check the actual entity data for convention fields
  // This handles the case where entities are created with fields not in the schema
  if (entity) {
    const conventionFields = ['stage', 'status', 'state']
    for (const field of conventionFields) {
      if (field in entity && entity[field] !== undefined) {
        return { [field]: target }
      }
    }
  }

  // Strategy 3: Schema convention — fall back to schema-defined convention fields
  const conventionFields = ['stage', 'status', 'state']
  for (const field of conventionFields) {
    if (schema.fields.has(field)) {
      return { [field]: target }
    }
  }

  return {}
}

/**
 * Check whether any hooks are registered for a given verb form.
 * When no hooks exist and the provider is pipelineable, we can skip
 * the async wrapper entirely and return the pipelineable result directly.
 */
function hasHooks(
  beforeHooks: Map<string, BeforeHookHandler[]>,
  afterHooks: Map<string, AfterHookHandler[]>,
  verb: VerbConjugation,
): boolean {
  const bHooks = beforeHooks.get(verb.activity)
  const aHooks = afterHooks.get(verb.event)
  return (bHooks !== undefined && bHooks.length > 0) || (aHooks !== undefined && aHooks.length > 0)
}

/**
 * Create the Noun entity proxy
 *
 * The proxy intercepts property access to provide:
 * - Verb action methods: create(), qualify(), close()
 * - BEFORE hooks: creating(), qualifying(), closing()
 * - AFTER hooks: created(), qualified(), closed()
 * - Disabled verbs: null
 * - Read methods: get(), find()
 * - Schema access: $schema, $name
 *
 * When a PipelineableNounProvider is active and no hooks are registered,
 * methods return the RpcPromise directly — enabling promise pipelining
 * (single round-trip for dependent operation chains).
 *
 * @param schema - The parsed NounSchema
 * @param scopedProvider - Optional provider override for multi-tenant scoped usage
 */
export function createNounProxy(schema: NounSchema, scopedProvider?: NounProvider): NounEntity {
  const { actionMap, activityMap, eventMap } = buildVerbLookups(schema)
  const beforeHooks = new Map<string, BeforeHookHandler[]>()
  const afterHooks = new Map<string, AfterHookHandler[]>()

  /**
   * Resolve the provider for this Noun proxy.
   * Priority: scoped provider (per-Noun) > global provider
   */
  function resolveProvider(): NounProvider {
    return scopedProvider ?? getProvider()
  }

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (typeof prop === 'symbol') return undefined

      // Static schema access
      if (prop === '$schema') return schema
      if (prop === '$name') return schema.name

      // Check for disabled verbs
      if (schema.disabledVerbs.has(prop)) return null

      // Read verbs (always available) — always passthrough pipelineable results
      if (prop === 'get') {
        return (id: string) => {
          return resolveProvider().get(schema.name, id)
        }
      }
      if (prop === 'find') {
        return (where?: Record<string, unknown>) => {
          return resolveProvider().find(schema.name, where)
        }
      }
      if (prop === 'findOne') {
        return (where?: Record<string, unknown>) => {
          return resolveProvider().findOne(schema.name, where)
        }
      }

      // Rollback to a previous version
      if (prop === 'rollback') {
        return (id: string, toVersion: number) => {
          return resolveProvider().rollback(schema.name, id, toVersion)
        }
      }

      // Watch an entity for changes
      if (prop === 'watch') {
        return (id: string, callback: (instance: NounInstance) => void): (() => void) => {
          const handler = (event: EntityEvent) => {
            if (event.entityId === id && event.data) {
              callback(event.data)
            }
          }
          return subscribeToEvents(handler)
        }
      }

      // Verb action (create, update, delete, qualify, close, ...)
      const actionVerb = actionMap.get(prop)
      if (actionVerb) {
        if (prop === 'create') {
          return (data: Record<string, unknown>) => {
            const provider = resolveProvider()

            // Fast path: no hooks + pipelineable → return RpcPromise directly
            if (isPipelineable(provider) && !hasHooks(beforeHooks, afterHooks, actionVerb)) {
              return provider.create(schema.name, data)
            }

            // Standard path: run hooks sequentially
            return (async () => {
              let processedData = { ...data }

              // Run BEFORE hooks
              const hooks = beforeHooks.get(actionVerb.activity)
              if (hooks) {
                for (const hook of hooks) {
                  const result = await hook(processedData)
                  if (result && typeof result === 'object') {
                    processedData = result as Record<string, unknown>
                  }
                }
              }

              const instance = await provider.create(schema.name, processedData)

              // Run AFTER hooks
              const aHooks = afterHooks.get(actionVerb.event)
              if (aHooks) {
                for (const hook of aHooks) {
                  await hook(instance, entityRegistry)
                }
              }

              return instance
            })()
          }
        }

        if (prop === 'update') {
          return (id: string, data: Record<string, unknown>) => {
            const provider = resolveProvider()

            // Fast path: no hooks + pipelineable → return RpcPromise directly
            if (isPipelineable(provider) && !hasHooks(beforeHooks, afterHooks, actionVerb)) {
              return provider.update(schema.name, id, data)
            }

            return (async () => {
              let processedData = { ...data }

              const hooks = beforeHooks.get(actionVerb.activity)
              if (hooks) {
                for (const hook of hooks) {
                  const result = await hook(processedData)
                  if (result && typeof result === 'object') {
                    processedData = result as Record<string, unknown>
                  }
                }
              }

              const instance = await provider.update(schema.name, id, processedData)

              const aHooks = afterHooks.get(actionVerb.event)
              if (aHooks) {
                for (const hook of aHooks) {
                  await hook(instance, entityRegistry)
                }
              }

              return instance
            })()
          }
        }

        if (prop === 'delete') {
          return (id: string) => {
            const provider = resolveProvider()

            // Fast path: no hooks + pipelineable → return RpcPromise directly
            if (isPipelineable(provider) && !hasHooks(beforeHooks, afterHooks, actionVerb)) {
              return provider.delete(schema.name, id)
            }

            return (async () => {
              const hooks = beforeHooks.get(actionVerb.activity)
              if (hooks) {
                for (const hook of hooks) {
                  await hook({ $id: id })
                }
              }

              const result = await provider.delete(schema.name, id)

              const aHooks = afterHooks.get(actionVerb.event)
              if (aHooks) {
                for (const hook of aHooks) {
                  await hook({ $id: id, $type: schema.name, $context: '', $version: 0, $createdAt: '', $updatedAt: '' }, entityRegistry)
                }
              }

              return result
            })()
          }
        }

        // Custom verb (qualify, close, pause, cancel, reactivate, ...)
        return (idOrData?: string | Record<string, unknown>, maybeData?: Record<string, unknown>) => {
          // Support both: Contact.qualify(id) and Contact.qualify(id, data)
          const id = typeof idOrData === 'string' ? idOrData : undefined
          const data = typeof idOrData === 'object' ? idOrData : maybeData
          const provider = resolveProvider()

          // Fast path: pipelineable, no hooks, has an ID → pass-through perform
          if (id && isPipelineable(provider) && !hasHooks(beforeHooks, afterHooks, actionVerb)) {
            const transition = resolveVerbTransition(schema, prop)
            const mergedData = { ...transition, ...data }
            return provider.perform(schema.name, prop, id, Object.keys(mergedData).length > 0 ? mergedData : undefined)
          }

          return (async () => {
            const hooks = beforeHooks.get(actionVerb.activity)
            if (hooks) {
              for (const hook of hooks) {
                await hook(data ?? {})
              }
            }

            // Get current entity state for data-aware verb resolution
            let currentEntity: NounInstance | undefined
            if (id) {
              const existing = await provider.get(schema.name, id)
              if (existing) currentEntity = existing
            }

            // Resolve state transition from verb declaration (e.g., qualify -> { stage: 'Qualified' })
            const transition = resolveVerbTransition(schema, prop, currentEntity)
            const mergedData = { ...transition, ...data }

            let instance: NounInstance
            if (id) {
              instance = await provider.perform(schema.name, prop, id, Object.keys(mergedData).length > 0 ? mergedData : undefined)
            } else {
              // If no ID, treat data as the operation payload
              instance = await provider.create(schema.name, mergedData)
            }

            const aHooks = afterHooks.get(actionVerb.event)
            if (aHooks) {
              for (const hook of aHooks) {
                await hook(instance, entityRegistry)
              }
            }

            return instance
          })()
        }
      }

      // BEFORE hook registration (creating, qualifying, closing, ...)
      const activityVerb = activityMap.get(prop)
      if (activityVerb) {
        return (hookHandler: BeforeHookHandler) => {
          const existing = beforeHooks.get(prop) ?? []
          existing.push(hookHandler)
          beforeHooks.set(prop, existing)
          // Return unsubscribe function
          return () => {
            const hooks = beforeHooks.get(prop)
            if (hooks) {
              const idx = hooks.indexOf(hookHandler)
              if (idx !== -1) hooks.splice(idx, 1)
            }
          }
        }
      }

      // AFTER hook registration (created, qualified, closed, ...)
      const eventVerb = eventMap.get(prop)
      if (eventVerb) {
        return (hookHandler: AfterHookHandler) => {
          const existing = afterHooks.get(prop) ?? []
          existing.push(hookHandler)
          afterHooks.set(prop, existing)
          // Return unsubscribe function
          return () => {
            const hooks = afterHooks.get(prop)
            if (hooks) {
              const idx = hooks.indexOf(hookHandler)
              if (idx !== -1) hooks.splice(idx, 1)
            }
          }
        }
      }

      // Check if it's a disabled verb's activity or event form
      for (const disabledVerb of schema.disabledVerbs) {
        const derived = deriveVerb(disabledVerb)
        if (prop === derived.activity || prop === derived.event) {
          return null
        }
      }

      return undefined
    },
  }

  return new Proxy({} as NounEntity, handler)
}

/**
 * Create a scoped NounProvider for multi-tenant usage.
 *
 * Returns a provider factory that creates NounProviders bound to a specific
 * tenant context URL. Use with the `provider` option in Noun() or call
 * setProviderFactory() for global scoping.
 *
 * @param createProvider - Factory that creates a NounProvider for a given context URL
 * @returns A provider factory suitable for setProviderFactory()
 */
export function createScopedProvider(
  createProvider: (contextUrl: string) => NounProvider,
): (context?: string) => NounProvider {
  const cache = new Map<string, NounProvider>()
  return (context?: string) => {
    const url = context ?? getTenantContext()
    let provider = cache.get(url)
    if (!provider) {
      provider = createProvider(url)
      cache.set(url, provider)
    }
    return provider
  }
}
