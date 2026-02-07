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
  NounProvider,
  BeforeHookHandler,
  AfterHookHandler,
  VerbConjugation,
} from './noun-types.js'

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

/**
 * Set the global NounProvider used by all Noun proxies
 */
export function setProvider(provider: NounProvider): void {
  globalProvider = provider
}

/**
 * Get the current global NounProvider (creates default if none set)
 */
export function getProvider(): NounProvider {
  if (!globalProvider) {
    globalProvider = new MemoryNounProvider()
  }
  return globalProvider
}

// =============================================================================
// MemoryNounProvider — default in-process provider
// =============================================================================

export class MemoryNounProvider implements NounProvider {
  private store = new Map<string, NounInstance>()

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
          if (instance[key] !== value) {
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

  async update(type: string, id: string, data: Record<string, unknown>): Promise<NounInstance> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) {
      throw new Error(`${type} not found: ${id}`)
    }
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
    return updated
  }

  async delete(type: string, id: string): Promise<boolean> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) return false
    return this.store.delete(id)
  }

  async perform(
    type: string,
    _verb: string,
    id: string,
    data?: Record<string, unknown>,
  ): Promise<NounInstance> {
    const existing = this.store.get(id)
    if (!existing || existing.$type !== type) {
      throw new Error(`${type} not found: ${id}`)
    }
    if (data) {
      return this.update(type, id, data)
    }
    return existing
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.store.clear()
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
 * Create the Noun entity proxy
 *
 * The proxy intercepts property access to provide:
 * - Verb action methods: create(), qualify(), close()
 * - BEFORE hooks: creating(), qualifying(), closing()
 * - AFTER hooks: created(), qualified(), closed()
 * - Disabled verbs: null
 * - Read methods: get(), find()
 * - Schema access: $schema, $name
 */
export function createNounProxy(schema: NounSchema): Record<string, unknown> {
  const { actionMap, activityMap, eventMap } = buildVerbLookups(schema)
  const beforeHooks = new Map<string, BeforeHookHandler[]>()
  const afterHooks = new Map<string, AfterHookHandler[]>()

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (typeof prop === 'symbol') return undefined

      // Static schema access
      if (prop === '$schema') return schema
      if (prop === '$name') return schema.name

      // Check for disabled verbs
      if (schema.disabledVerbs.has(prop)) return null

      // Read verbs (always available)
      if (prop === 'get') {
        return async (id: string) => getProvider().get(schema.name, id)
      }
      if (prop === 'find') {
        return async (where?: Record<string, unknown>) => getProvider().find(schema.name, where)
      }

      // Verb action (create, update, delete, qualify, close, ...)
      const actionVerb = actionMap.get(prop)
      if (actionVerb) {
        if (prop === 'create') {
          return async (data: Record<string, unknown>) => {
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

            const instance = await getProvider().create(schema.name, processedData)

            // Run AFTER hooks
            const aHooks = afterHooks.get(actionVerb.event)
            if (aHooks) {
              for (const hook of aHooks) {
                await hook(instance)
              }
            }

            return instance
          }
        }

        if (prop === 'update') {
          return async (id: string, data: Record<string, unknown>) => {
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

            const instance = await getProvider().update(schema.name, id, processedData)

            const aHooks = afterHooks.get(actionVerb.event)
            if (aHooks) {
              for (const hook of aHooks) {
                await hook(instance)
              }
            }

            return instance
          }
        }

        if (prop === 'delete') {
          return async (id: string) => {
            const hooks = beforeHooks.get(actionVerb.activity)
            if (hooks) {
              for (const hook of hooks) {
                await hook({ $id: id })
              }
            }

            const result = await getProvider().delete(schema.name, id)

            const aHooks = afterHooks.get(actionVerb.event)
            if (aHooks) {
              for (const hook of aHooks) {
                await hook({ $id: id, $type: schema.name, $context: '', $version: 0, $createdAt: '', $updatedAt: '' })
              }
            }

            return result
          }
        }

        // Custom verb (qualify, close, pause, cancel, reactivate, ...)
        return async (idOrData?: string | Record<string, unknown>, maybeData?: Record<string, unknown>) => {
          // Support both: Contact.qualify(id) and Contact.qualify(id, data)
          const id = typeof idOrData === 'string' ? idOrData : undefined
          const data = typeof idOrData === 'object' ? idOrData : maybeData

          const hooks = beforeHooks.get(actionVerb.activity)
          if (hooks) {
            for (const hook of hooks) {
              await hook(data ?? {})
            }
          }

          let instance: NounInstance
          if (id) {
            instance = await getProvider().perform(schema.name, prop, id, data)
          } else {
            // If no ID, treat data as the operation payload
            instance = await getProvider().create(schema.name, data ?? {})
          }

          const aHooks = afterHooks.get(actionVerb.event)
          if (aHooks) {
            for (const hook of aHooks) {
              await hook(instance)
            }
          }

          return instance
        }
      }

      // BEFORE hook registration (creating, qualifying, closing, ...)
      const activityVerb = activityMap.get(prop)
      if (activityVerb) {
        return (handler: BeforeHookHandler) => {
          const existing = beforeHooks.get(prop) ?? []
          existing.push(handler)
          beforeHooks.set(prop, existing)
        }
      }

      // AFTER hook registration (created, qualified, closed, ...)
      const eventVerb = eventMap.get(prop)
      if (eventVerb) {
        return (handler: AfterHookHandler) => {
          const existing = afterHooks.get(prop) ?? []
          existing.push(handler)
          afterHooks.set(prop, existing)
        }
      }

      // Check if it's a disabled verb's activity or event form
      for (const disabledVerb of schema.disabledVerbs) {
        const conj = schema.verbs.get(disabledVerb)
        if (conj && (prop === conj.activity || prop === conj.event)) {
          return null
        }
      }

      return undefined
    },
  }

  return new Proxy({}, handler)
}
