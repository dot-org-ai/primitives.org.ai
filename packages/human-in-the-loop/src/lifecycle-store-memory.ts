/**
 * lifecycle-store-memory — in-memory LifecycleStore implementation.
 *
 * The reference implementation for tests and dev environments (fallback when
 * DATABASE_URL is unset). All state transitions go through the request-lifecycle
 * state machine; illegal transitions throw rather than silently mutating state.
 *
 * Usage:
 *   import { LifecycleStoreMemory } from 'human-in-the-loop'
 *
 *   const store = new LifecycleStoreMemory()
 *   const item = await store.create({ id: crypto.randomUUID(), ... })
 *   await store.complete(item.id, { verb: 'approve', resolvedBy: 'person-alex' })
 *
 *   // In tests: reset between cases
 *   store.reset()
 */

import {
  resolve as lcResolve,
  escalate as lcEscalate,
  cancel as lcCancel,
  sortByPriorityThenSLA,
} from './request-lifecycle.js'
import type { LifecycleItem, LifecycleStatus, RequestKind } from './request-lifecycle.js'
import type {
  LifecycleStore,
  LifecycleStoreFilters,
  LifecycleItemPatch,
  LifecycleResponse,
} from './lifecycle-store.js'

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalise a scalar-or-array filter value into an array for .includes().
 */
function toArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined
  return Array.isArray(value) ? value : [value]
}

// ============================================================================
// LifecycleStoreMemory
// ============================================================================

/**
 * In-memory implementation of the LifecycleStore port.
 *
 * Thread-safety: JS is single-threaded; no locking needed for in-process use.
 * All mutation methods are async for interface compatibility and to ease
 * drop-in replacement with async implementations (Neon, etc.).
 *
 * Lifecycle enforcement:
 *   - complete()  → resolve() (claimed | in_progress → completed)
 *   - reject()    → resolve() with verb='reject' (claimed | in_progress → completed)
 *   - escalate()  → escalate() (active → escalated)
 *   - cancel()    → cancel()   (active → cancelled)
 *   All other transitions are illegal and throw.
 */
export class LifecycleStoreMemory implements LifecycleStore {
  private items = new Map<string, LifecycleItem>()

  // ── create ──────────────────────────────────────────────────────────────────

  async create(item: LifecycleItem): Promise<LifecycleItem> {
    if (this.items.has(item.id)) {
      throw new Error(`LifecycleStoreMemory.create: item "${item.id}" already exists`)
    }
    this.items.set(item.id, item)
    return item
  }

  // ── get ─────────────────────────────────────────────────────────────────────

  async get(id: string): Promise<LifecycleItem | null> {
    return this.items.get(id) ?? null
  }

  // ── update ──────────────────────────────────────────────────────────────────

  async update(id: string, patch: LifecycleItemPatch): Promise<LifecycleItem> {
    const existing = this.items.get(id)
    if (!existing) {
      throw new Error(`LifecycleStoreMemory.update: item "${id}" not found`)
    }
    const updated: LifecycleItem = {
      ...existing,
      ...patch,
      // Always bump updatedAt on any patch
      updatedAt: new Date(),
    }
    this.items.set(id, updated)
    return updated
  }

  // ── list ─────────────────────────────────────────────────────────────────────

  async list(filters?: LifecycleStoreFilters): Promise<LifecycleItem[]> {
    let results = Array.from(this.items.values())

    if (filters) {
      const statusFilter = toArray<LifecycleStatus>(filters.status)
      const kindFilter = toArray<RequestKind>(filters.kind)

      if (filters.assignee !== undefined) {
        const assignee = filters.assignee
        results = results.filter((i) => i.assignee === assignee)
      }
      if (statusFilter !== undefined) {
        results = results.filter((i) => statusFilter.includes(i.status))
      }
      if (kindFilter !== undefined) {
        results = results.filter((i) => kindFilter.includes(i.kind))
      }
      if (filters.teamId !== undefined) {
        const teamId = filters.teamId
        results = results.filter((i) => i.teamId === teamId)
      }
      if (filters.businessId !== undefined) {
        const businessId = filters.businessId
        results = results.filter((i) => i.businessId === businessId)
      }
      if (filters.studioId !== undefined) {
        const studioId = filters.studioId
        results = results.filter((i) => i.studioId === studioId)
      }
    }

    // Sort by priority then SLA proximity (canonical queue ordering)
    return sortByPriorityThenSLA(results, new Date())
  }

  // ── complete ─────────────────────────────────────────────────────────────────

  async complete(id: string, response: LifecycleResponse): Promise<LifecycleItem> {
    const existing = this.items.get(id)
    if (!existing) {
      throw new Error(`LifecycleStoreMemory.complete: item "${id}" not found`)
    }

    const result = lcResolve(existing, {
      verb: response.verb,
      resolvedBy: response.resolvedBy,
      ...(response.resolvedAt !== undefined ? { resolvedAt: response.resolvedAt } : {}),
      ...(response.comments !== undefined ? { comments: response.comments } : {}),
      ...(response.data !== undefined ? { data: response.data } : {}),
    })

    if (result instanceof Error) {
      throw result
    }

    this.items.set(id, result)
    return result
  }

  // ── reject ────────────────────────────────────────────────────────────────────

  async reject(id: string, reason: string, rejectedBy: string): Promise<LifecycleItem> {
    const existing = this.items.get(id)
    if (!existing) {
      throw new Error(`LifecycleStoreMemory.reject: item "${id}" not found`)
    }

    const result = lcResolve(existing, {
      verb: 'reject',
      resolvedBy: rejectedBy,
      comments: reason,
    })

    if (result instanceof Error) {
      throw result
    }

    this.items.set(id, result)
    return result
  }

  // ── escalate ──────────────────────────────────────────────────────────────────

  async escalate(id: string, toAssignee: string): Promise<LifecycleItem> {
    const existing = this.items.get(id)
    if (!existing) {
      throw new Error(`LifecycleStoreMemory.escalate: item "${id}" not found`)
    }

    const result = lcEscalate(existing, {})
    if (result instanceof Error) {
      throw result
    }

    // Reassign to the escalation target and persist
    const escalated: LifecycleItem = {
      ...result,
      assignee: toAssignee,
    }

    this.items.set(id, escalated)
    return escalated
  }

  // ── cancel ────────────────────────────────────────────────────────────────────

  async cancel(id: string): Promise<LifecycleItem> {
    const existing = this.items.get(id)
    if (!existing) {
      throw new Error(`LifecycleStoreMemory.cancel: item "${id}" not found`)
    }

    const result = lcCancel(existing, {})
    if (result instanceof Error) {
      throw result
    }

    this.items.set(id, result)
    return result
  }

  // ── reset (test helper) ───────────────────────────────────────────────────────

  reset(): void {
    this.items.clear()
  }

  // ── count (convenience for tests) ────────────────────────────────────────────

  count(): number {
    return this.items.size
  }
}
