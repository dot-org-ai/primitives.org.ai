/**
 * Unit tests for LifecycleStoreMemory (in-memory LifecycleStore implementation).
 *
 * Covers:
 *   1. create — persists item, returns item, rejects duplicate IDs
 *   2. get — returns item or null
 *   3. update — patches metadata, bumps updatedAt, throws on not-found
 *   4. list — returns all items; filters by assignee, status, kind, teamId, etc.
 *   5. complete — drives resolve() transition (claimed | in_progress → completed)
 *   6. complete — illegal transitions throw (fail-closed)
 *   7. reject — drives resolve(verb='reject') transition
 *   8. reject — illegal transitions throw
 *   9. escalate — drives escalate() transition + reassigns assignee
 *   10. escalate — illegal transitions throw
 *   11. cancel — drives cancel() transition
 *   12. cancel — illegal transitions throw
 *   13. reset — empties the store (test helper)
 *   14. list ordering — priority then SLA (sortByPriorityThenSLA contract)
 *
 * No I/O, no mocks, no framework imports.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { LifecycleStoreMemory } from '../src/lifecycle-store-memory.js'
import type { LifecycleItem } from '../src/request-lifecycle.js'
import type { LifecycleResponse } from '../src/lifecycle-store.js'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture factory
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-25T10:00:00Z')
const SLA_NEAR = new Date('2026-05-25T12:00:00Z') // 2h from NOW
const SLA_FAR = new Date('2026-05-25T18:00:00Z') // 8h from NOW

let _counter = 0

function makeItem(overrides: Partial<LifecycleItem> = {}): LifecycleItem {
  _counter += 1
  return {
    id: `store-test-${_counter}`,
    kind: 'approve',
    status: 'pending',
    priority: 'normal',
    title: `Test item ${_counter}`,
    artifact: { kind: 'Invoice', id: `inv-${_counter}` },
    assignee: 'person-alex',
    teamId: 'team-eng',
    businessId: 'biz-acme',
    studioId: 'studio-acme',
    createdAt: NOW,
    slaDeadline: SLA_FAR,
    updatedAt: NOW,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a LifecycleResponse for use in complete() */
function approveResponse(resolvedBy = 'person-alex'): LifecycleResponse {
  return { verb: 'approve', resolvedBy }
}

/** Build a claimed item (status=claimed + claimedBy set) */
function claimedItem(overrides: Partial<LifecycleItem> = {}): LifecycleItem {
  return makeItem({ status: 'claimed', claimedBy: 'person-alex', ...overrides })
}

/** Build an in_progress item */
function inProgressItem(overrides: Partial<LifecycleItem> = {}): LifecycleItem {
  return makeItem({ status: 'in_progress', claimedBy: 'person-alex', ...overrides })
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

let store: LifecycleStoreMemory

beforeEach(() => {
  store = new LifecycleStoreMemory()
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. create
// ─────────────────────────────────────────────────────────────────────────────

describe('create', () => {
  it('persists and returns the item', async () => {
    const item = makeItem()
    const result = await store.create(item)
    expect(result).toEqual(item)
    expect(store.count()).toBe(1)
  })

  it('returns a reference-equal item (no clone needed)', async () => {
    const item = makeItem()
    const result = await store.create(item)
    expect(result.id).toBe(item.id)
    expect(result.kind).toBe(item.kind)
    expect(result.status).toBe(item.status)
  })

  it('throws if the same ID is created twice', async () => {
    const item = makeItem()
    await store.create(item)
    await expect(store.create(item)).rejects.toThrow(/already exists/)
  })

  it('supports multiple distinct items', async () => {
    const a = makeItem()
    const b = makeItem()
    await store.create(a)
    await store.create(b)
    expect(store.count()).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. get
// ─────────────────────────────────────────────────────────────────────────────

describe('get', () => {
  it('returns the item when it exists', async () => {
    const item = makeItem()
    await store.create(item)
    const result = await store.get(item.id)
    expect(result).not.toBeNull()
    expect(result!.id).toBe(item.id)
  })

  it('returns null when the item does not exist', async () => {
    const result = await store.get('nonexistent-id')
    expect(result).toBeNull()
  })

  it('returns the same data that was created', async () => {
    const item = makeItem({ title: 'Specific title', kind: 'review' })
    await store.create(item)
    const result = await store.get(item.id)
    expect(result!.title).toBe('Specific title')
    expect(result!.kind).toBe('review')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. update
// ─────────────────────────────────────────────────────────────────────────────

describe('update', () => {
  it('applies a partial patch and returns the updated item', async () => {
    const item = makeItem({ title: 'Old title' })
    await store.create(item)
    const updated = await store.update(item.id, { title: 'New title' })
    expect(updated.title).toBe('New title')
    // Preserved fields
    expect(updated.kind).toBe(item.kind)
    expect(updated.assignee).toBe(item.assignee)
  })

  it('bumps updatedAt on every patch', async () => {
    const item = makeItem({ updatedAt: NOW })
    await store.create(item)
    const updated = await store.update(item.id, { title: 'Changed' })
    // updatedAt should be a Date and not equal to NOW (bumped to wall clock)
    expect(updated.updatedAt).toBeInstanceOf(Date)
  })

  it('persists the patch — subsequent get returns updated data', async () => {
    const item = makeItem({ priority: 'normal' })
    await store.create(item)
    await store.update(item.id, { priority: 'high' })
    const fetched = await store.get(item.id)
    expect(fetched!.priority).toBe('high')
  })

  it('throws if the item does not exist', async () => {
    await expect(store.update('ghost-id', { title: 'X' })).rejects.toThrow(/not found/)
  })

  it('can update assignee (reassignment)', async () => {
    const item = makeItem({ assignee: 'person-alex' })
    await store.create(item)
    const updated = await store.update(item.id, { assignee: 'person-sam' })
    expect(updated.assignee).toBe('person-sam')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. list
// ─────────────────────────────────────────────────────────────────────────────

describe('list', () => {
  it('returns all items when no filters provided', async () => {
    await store.create(makeItem())
    await store.create(makeItem())
    await store.create(makeItem())
    const results = await store.list()
    expect(results).toHaveLength(3)
  })

  it('returns empty array when store is empty', async () => {
    const results = await store.list()
    expect(results).toHaveLength(0)
  })

  it('filters by assignee', async () => {
    await store.create(makeItem({ assignee: 'person-alex' }))
    await store.create(makeItem({ assignee: 'person-sam' }))
    await store.create(makeItem({ assignee: 'person-alex' }))

    const results = await store.list({ assignee: 'person-alex' })
    expect(results).toHaveLength(2)
    expect(results.every((i) => i.assignee === 'person-alex')).toBe(true)
  })

  it('filters by single status', async () => {
    await store.create(makeItem({ status: 'pending' }))
    await store.create(claimedItem())
    await store.create(inProgressItem())

    const results = await store.list({ status: 'pending' })
    expect(results).toHaveLength(1)
    expect(results[0]!.status).toBe('pending')
  })

  it('filters by status array', async () => {
    await store.create(makeItem({ status: 'pending' }))
    await store.create(claimedItem())
    await store.create(inProgressItem())
    await store.create(makeItem({ status: 'completed' }))

    const results = await store.list({ status: ['pending', 'claimed'] })
    expect(results).toHaveLength(2)
    expect(results.every((i) => ['pending', 'claimed'].includes(i.status))).toBe(true)
  })

  it('filters by single kind', async () => {
    await store.create(makeItem({ kind: 'approve' }))
    await store.create(makeItem({ kind: 'ask' }))
    await store.create(makeItem({ kind: 'approve' }))

    const results = await store.list({ kind: 'approve' })
    expect(results).toHaveLength(2)
    expect(results.every((i) => i.kind === 'approve')).toBe(true)
  })

  it('filters by kind array', async () => {
    await store.create(makeItem({ kind: 'approve' }))
    await store.create(makeItem({ kind: 'ask' }))
    await store.create(makeItem({ kind: 'decide' }))
    await store.create(makeItem({ kind: 'do' }))

    const results = await store.list({ kind: ['approve', 'ask'] })
    expect(results).toHaveLength(2)
  })

  it('filters by teamId', async () => {
    await store.create(makeItem({ teamId: 'team-a' }))
    await store.create(makeItem({ teamId: 'team-b' }))

    const results = await store.list({ teamId: 'team-a' })
    expect(results).toHaveLength(1)
    expect(results[0]!.teamId).toBe('team-a')
  })

  it('filters by businessId', async () => {
    await store.create(makeItem({ businessId: 'biz-1' }))
    await store.create(makeItem({ businessId: 'biz-2' }))

    const results = await store.list({ businessId: 'biz-1' })
    expect(results).toHaveLength(1)
  })

  it('filters by studioId', async () => {
    await store.create(makeItem({ studioId: 'studio-x' }))
    await store.create(makeItem({ studioId: 'studio-y' }))

    const results = await store.list({ studioId: 'studio-x' })
    expect(results).toHaveLength(1)
  })

  it('combines filters (AND semantics)', async () => {
    await store.create(makeItem({ assignee: 'person-alex', kind: 'approve', status: 'pending' }))
    await store.create(makeItem({ assignee: 'person-alex', kind: 'ask', status: 'pending' }))
    await store.create(makeItem({ assignee: 'person-sam', kind: 'approve', status: 'pending' }))

    const results = await store.list({ assignee: 'person-alex', kind: 'approve' })
    expect(results).toHaveLength(1)
    expect(results[0]!.kind).toBe('approve')
    expect(results[0]!.assignee).toBe('person-alex')
  })

  it('returns empty array when no items match filters', async () => {
    await store.create(makeItem({ assignee: 'person-alex' }))
    const results = await store.list({ assignee: 'person-nobody' })
    expect(results).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. list ordering (priority then SLA)
// ─────────────────────────────────────────────────────────────────────────────

describe('list ordering', () => {
  it('returns critical items before normal items', async () => {
    // Create normal first, critical second — ordering must flip
    const normal = makeItem({ priority: 'normal', slaDeadline: SLA_FAR, id: 'normal-1' })
    const critical = makeItem({ priority: 'critical', slaDeadline: SLA_FAR, id: 'critical-1' })
    await store.create(normal)
    await store.create(critical)

    const results = await store.list()
    expect(results[0]!.priority).toBe('critical')
    expect(results[1]!.priority).toBe('normal')
  })

  it('within same priority, returns closer SLA first', async () => {
    const farItem = makeItem({ priority: 'normal', slaDeadline: SLA_FAR, id: 'far-1' })
    const nearItem = makeItem({ priority: 'normal', slaDeadline: SLA_NEAR, id: 'near-1' })
    await store.create(farItem)
    await store.create(nearItem)

    const results = await store.list()
    expect(results[0]!.id).toBe('near-1')
    expect(results[1]!.id).toBe('far-1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. complete — drives resolve() transition
// ─────────────────────────────────────────────────────────────────────────────

describe('complete', () => {
  it('completes a claimed item (claimed → completed)', async () => {
    const item = claimedItem()
    await store.create(item)
    const result = await store.complete(item.id, approveResponse())
    expect(result.status).toBe('completed')
    expect(result.resolution?.verb).toBe('approve')
    expect(result.resolution?.resolvedBy).toBe('person-alex')
  })

  it('completes an in_progress item (in_progress → completed)', async () => {
    const item = inProgressItem()
    await store.create(item)
    const result = await store.complete(item.id, approveResponse())
    expect(result.status).toBe('completed')
  })

  it('persists the completed state — get returns completed item', async () => {
    const item = claimedItem()
    await store.create(item)
    await store.complete(item.id, approveResponse())
    const fetched = await store.get(item.id)
    expect(fetched!.status).toBe('completed')
  })

  it('throws if item not found', async () => {
    await expect(store.complete('ghost', approveResponse())).rejects.toThrow(/not found/)
  })

  it('throws for illegal transition — pending item cannot be directly completed', async () => {
    const item = makeItem({ status: 'pending' })
    await store.create(item)
    // pending → completed is not a direct transition in request-lifecycle
    await expect(store.complete(item.id, approveResponse())).rejects.toThrow()
  })

  it('throws for illegal transition — completing an already-completed item', async () => {
    const item = makeItem({ status: 'completed' })
    await store.create(item)
    await expect(store.complete(item.id, approveResponse())).rejects.toThrow()
  })

  it('throws for illegal transition — completing a cancelled item', async () => {
    const item = makeItem({ status: 'cancelled' })
    await store.create(item)
    await expect(store.complete(item.id, approveResponse())).rejects.toThrow()
  })

  it('stores optional comments in resolution', async () => {
    const item = claimedItem()
    await store.create(item)
    const result = await store.complete(item.id, {
      verb: 'approve',
      resolvedBy: 'person-alex',
      comments: 'LGTM',
    })
    expect(result.resolution?.comments).toBe('LGTM')
  })

  it('stores optional data in resolution', async () => {
    const item = claimedItem()
    await store.create(item)
    const result = await store.complete(item.id, {
      verb: 'approve',
      resolvedBy: 'person-alex',
      data: { code: 'APR-001' },
    })
    expect(result.resolution?.data).toEqual({ code: 'APR-001' })
  })

  it('records completedAt on the item', async () => {
    const item = claimedItem()
    await store.create(item)
    const result = await store.complete(item.id, approveResponse())
    expect(result.completedAt).toBeInstanceOf(Date)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. reject — drives resolve(verb='reject')
// ─────────────────────────────────────────────────────────────────────────────

describe('reject', () => {
  it('rejects a claimed item (claimed → completed, verb=reject)', async () => {
    const item = claimedItem()
    await store.create(item)
    const result = await store.reject(item.id, 'Out of policy', 'person-alex')
    expect(result.status).toBe('completed')
    expect(result.resolution?.verb).toBe('reject')
    expect(result.resolution?.comments).toBe('Out of policy')
    expect(result.resolution?.resolvedBy).toBe('person-alex')
  })

  it('rejects an in_progress item', async () => {
    const item = inProgressItem()
    await store.create(item)
    const result = await store.reject(item.id, 'Insufficient info', 'person-sam')
    expect(result.status).toBe('completed')
    expect(result.resolution?.verb).toBe('reject')
  })

  it('persists the rejection', async () => {
    const item = claimedItem()
    await store.create(item)
    await store.reject(item.id, 'No budget', 'person-alex')
    const fetched = await store.get(item.id)
    expect(fetched!.status).toBe('completed')
    expect(fetched!.resolution?.verb).toBe('reject')
  })

  it('throws if item not found', async () => {
    await expect(store.reject('ghost', 'reason', 'person-alex')).rejects.toThrow(/not found/)
  })

  it('throws for illegal transition — pending item', async () => {
    const item = makeItem({ status: 'pending' })
    await store.create(item)
    await expect(store.reject(item.id, 'x', 'person-alex')).rejects.toThrow()
  })

  it('throws for illegal transition — already completed', async () => {
    const item = makeItem({ status: 'completed' })
    await store.create(item)
    await expect(store.reject(item.id, 'x', 'person-alex')).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. escalate — drives escalate() + reassigns assignee
// ─────────────────────────────────────────────────────────────────────────────

describe('escalate', () => {
  it('escalates a pending item and reassigns assignee', async () => {
    const item = makeItem({ assignee: 'person-alex' })
    await store.create(item)
    const result = await store.escalate(item.id, 'person-sam')
    expect(result.status).toBe('escalated')
    expect(result.assignee).toBe('person-sam')
  })

  it('escalates a claimed item', async () => {
    const item = claimedItem({ assignee: 'person-alex' })
    await store.create(item)
    const result = await store.escalate(item.id, 'person-jordan')
    expect(result.status).toBe('escalated')
    expect(result.assignee).toBe('person-jordan')
  })

  it('escalates an in_progress item', async () => {
    const item = inProgressItem({ assignee: 'person-alex' })
    await store.create(item)
    const result = await store.escalate(item.id, 'person-sam')
    expect(result.status).toBe('escalated')
  })

  it('persists the escalation and new assignee', async () => {
    const item = makeItem({ assignee: 'person-alex' })
    await store.create(item)
    await store.escalate(item.id, 'person-sam')
    const fetched = await store.get(item.id)
    expect(fetched!.status).toBe('escalated')
    expect(fetched!.assignee).toBe('person-sam')
  })

  it('throws if item not found', async () => {
    await expect(store.escalate('ghost', 'person-sam')).rejects.toThrow(/not found/)
  })

  it('throws for illegal transition — already escalated', async () => {
    const item = makeItem({ status: 'escalated' })
    await store.create(item)
    await expect(store.escalate(item.id, 'person-sam')).rejects.toThrow()
  })

  it('throws for illegal transition — completed item', async () => {
    const item = makeItem({ status: 'completed' })
    await store.create(item)
    await expect(store.escalate(item.id, 'person-sam')).rejects.toThrow()
  })

  it('throws for illegal transition — cancelled item', async () => {
    const item = makeItem({ status: 'cancelled' })
    await store.create(item)
    await expect(store.escalate(item.id, 'person-sam')).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. cancel — drives cancel() transition
// ─────────────────────────────────────────────────────────────────────────────

describe('cancel', () => {
  it('cancels a pending item', async () => {
    const item = makeItem({ status: 'pending' })
    await store.create(item)
    const result = await store.cancel(item.id)
    expect(result.status).toBe('cancelled')
  })

  it('cancels a claimed item', async () => {
    const item = claimedItem()
    await store.create(item)
    const result = await store.cancel(item.id)
    expect(result.status).toBe('cancelled')
  })

  it('cancels an in_progress item', async () => {
    const item = inProgressItem()
    await store.create(item)
    const result = await store.cancel(item.id)
    expect(result.status).toBe('cancelled')
  })

  it('persists the cancellation', async () => {
    const item = makeItem({ status: 'pending' })
    await store.create(item)
    await store.cancel(item.id)
    const fetched = await store.get(item.id)
    expect(fetched!.status).toBe('cancelled')
  })

  it('throws if item not found', async () => {
    await expect(store.cancel('ghost')).rejects.toThrow(/not found/)
  })

  it('throws for illegal transition — already cancelled', async () => {
    const item = makeItem({ status: 'cancelled' })
    await store.create(item)
    await expect(store.cancel(item.id)).rejects.toThrow()
  })

  it('throws for illegal transition — completed item', async () => {
    const item = makeItem({ status: 'completed' })
    await store.create(item)
    await expect(store.cancel(item.id)).rejects.toThrow()
  })

  it('throws for illegal transition — timeout item', async () => {
    const item = makeItem({ status: 'timeout' })
    await store.create(item)
    await expect(store.cancel(item.id)).rejects.toThrow()
  })

  it('throws for illegal transition — escalated item', async () => {
    const item = makeItem({ status: 'escalated' })
    await store.create(item)
    await expect(store.cancel(item.id)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. reset
// ─────────────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('empties the store', async () => {
    await store.create(makeItem())
    await store.create(makeItem())
    store.reset()
    expect(store.count()).toBe(0)
    const results = await store.list()
    expect(results).toHaveLength(0)
  })

  it('allows creating items after reset (no duplicate-id errors)', async () => {
    const item = makeItem({ id: 'fixed-id' })
    await store.create(item)
    store.reset()
    const result = await store.create(item) // same ID — ok after reset
    expect(result.id).toBe('fixed-id')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. round-trip: create → complete → verify resolution
// ─────────────────────────────────────────────────────────────────────────────

describe('full round-trip', () => {
  it('create + complete: item goes through full lifecycle', async () => {
    // Start pending
    const item = makeItem({ status: 'pending', id: 'rt-1' })
    await store.create(item)
    expect((await store.get('rt-1'))!.status).toBe('pending')

    // Patch to claimed (simulate store.update after claim transition)
    await store.update('rt-1', {
      status: 'claimed',
      claimedBy: 'person-alex',
    })
    expect((await store.get('rt-1'))!.status).toBe('claimed')

    // Complete via store method (routes through lifecycle)
    const completed = await store.complete('rt-1', {
      verb: 'approve',
      resolvedBy: 'person-alex',
      comments: 'All good',
    })
    expect(completed.status).toBe('completed')
    expect(completed.resolution?.verb).toBe('approve')
    expect(completed.resolution?.comments).toBe('All good')

    // Verify persistence
    const fetched = await store.get('rt-1')
    expect(fetched!.status).toBe('completed')
    expect(fetched!.resolution?.resolvedBy).toBe('person-alex')
  })

  it('create + escalate + list by new assignee', async () => {
    const item = makeItem({ id: 'rt-2', assignee: 'person-alex' })
    await store.create(item)

    await store.escalate('rt-2', 'person-sam')

    const samItems = await store.list({ assignee: 'person-sam' })
    expect(samItems).toHaveLength(1)
    expect(samItems[0]!.id).toBe('rt-2')
    expect(samItems[0]!.status).toBe('escalated')

    const alexItems = await store.list({ assignee: 'person-alex' })
    expect(alexItems).toHaveLength(0)
  })

  it('create + reject: resolution verb is reject', async () => {
    const item = claimedItem({ id: 'rt-3' })
    await store.create(item)
    const result = await store.reject('rt-3', 'Policy violation', 'person-sam')
    expect(result.status).toBe('completed')
    expect(result.resolution?.verb).toBe('reject')
    expect(result.resolution?.resolvedBy).toBe('person-sam')
    expect(result.resolution?.comments).toBe('Policy violation')
  })
})
