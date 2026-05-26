/**
 * Unit tests for LifecycleChannelAdapter port + stub adapters.
 *
 * Covers:
 *   1. emailAdapter — correct kind, deliver is a no-op, respond drives store
 *   2. slackAdapter — correct kind, deliver is a no-op, respond drives store
 *   3. deliver → respond round-trip through a stub adapter drives the store
 *   4. LifecycleAdapterRegistry — register, get, unregister, kinds()
 *   5. adapterRegistry (global default) — pre-populated after importing stubs
 *   6. respond() enforces lifecycle state machine (illegal transitions throw)
 *   7. respond() with all LifecycleResponse fields persisted correctly
 *
 * No I/O, no mocks, no framework imports.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { emailAdapter } from '../src/adapters/email-adapter.js'
import { slackAdapter } from '../src/adapters/slack-adapter.js'
import { LifecycleAdapterRegistry, adapterRegistry } from '../src/lifecycle-channel-adapter.js'
import { LifecycleStoreMemory } from '../src/lifecycle-store-memory.js'
import type { LifecycleItem } from '../src/request-lifecycle.js'
import type { LifecycleResponse } from '../src/lifecycle-store.js'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture factory
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-25T10:00:00Z')
const SLA_FAR = new Date('2026-05-25T18:00:00Z')

let _counter = 0

function makeItem(overrides: Partial<LifecycleItem> = {}): LifecycleItem {
  _counter += 1
  return {
    id: `ca-test-${_counter}`,
    kind: 'approve',
    status: 'pending',
    priority: 'normal',
    title: `ChannelAdapter test item ${_counter}`,
    artifact: { kind: 'Invoice', id: `inv-${_counter}` },
    assignee: 'person-alex',
    createdAt: NOW,
    slaDeadline: SLA_FAR,
    updatedAt: NOW,
    ...overrides,
  }
}

function claimedItem(overrides: Partial<LifecycleItem> = {}): LifecycleItem {
  return makeItem({ status: 'claimed', claimedBy: 'person-alex', ...overrides })
}

function approveResponse(resolvedBy = 'person-alex'): LifecycleResponse {
  return { verb: 'approve', resolvedBy }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup
// ─────────────────────────────────────────────────────────────────────────────

let store: LifecycleStoreMemory

beforeEach(() => {
  store = new LifecycleStoreMemory()
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. emailAdapter
// ─────────────────────────────────────────────────────────────────────────────

describe('emailAdapter', () => {
  it('has kind = "email"', () => {
    expect(emailAdapter.kind).toBe('email')
  })

  it('deliver returns void (no-op)', async () => {
    const item = makeItem()
    await store.create(item)
    // Should not throw; returns undefined
    const result = await emailAdapter.deliver(item, store)
    expect(result).toBeUndefined()
  })

  it('deliver does not mutate the store', async () => {
    const item = makeItem()
    await store.create(item)
    await emailAdapter.deliver(item, store)
    // Store still has exactly one item in pending state
    const results = await store.list()
    expect(results).toHaveLength(1)
    expect(results[0]!.status).toBe('pending')
  })

  it('respond drives store.complete and returns completed item', async () => {
    const item = claimedItem()
    await store.create(item)
    const result = await emailAdapter.respond(item.id, approveResponse(), store)
    expect(result.status).toBe('completed')
    expect(result.resolution?.verb).toBe('approve')
  })

  it('respond persists through the store', async () => {
    const item = claimedItem()
    await store.create(item)
    await emailAdapter.respond(item.id, approveResponse(), store)
    const fetched = await store.get(item.id)
    expect(fetched!.status).toBe('completed')
  })

  it('respond throws for illegal transition (pending item)', async () => {
    const item = makeItem({ status: 'pending' })
    await store.create(item)
    await expect(emailAdapter.respond(item.id, approveResponse(), store)).rejects.toThrow()
  })

  it('respond throws when item not found', async () => {
    await expect(emailAdapter.respond('ghost', approveResponse(), store)).rejects.toThrow(
      /not found/
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. slackAdapter
// ─────────────────────────────────────────────────────────────────────────────

describe('slackAdapter', () => {
  it('has kind = "slack"', () => {
    expect(slackAdapter.kind).toBe('slack')
  })

  it('deliver returns void (no-op)', async () => {
    const item = makeItem()
    await store.create(item)
    const result = await slackAdapter.deliver(item, store)
    expect(result).toBeUndefined()
  })

  it('deliver does not mutate the store', async () => {
    const item = makeItem()
    await store.create(item)
    await slackAdapter.deliver(item, store)
    const results = await store.list()
    expect(results).toHaveLength(1)
    expect(results[0]!.status).toBe('pending')
  })

  it('respond drives store.complete and returns completed item', async () => {
    const item = claimedItem()
    await store.create(item)
    const result = await slackAdapter.respond(item.id, approveResponse(), store)
    expect(result.status).toBe('completed')
    expect(result.resolution?.verb).toBe('approve')
  })

  it('respond persists through the store', async () => {
    const item = claimedItem()
    await store.create(item)
    await slackAdapter.respond(item.id, approveResponse(), store)
    const fetched = await store.get(item.id)
    expect(fetched!.status).toBe('completed')
  })

  it('respond throws for illegal transition (already completed)', async () => {
    const item = makeItem({ status: 'completed' })
    await store.create(item)
    await expect(slackAdapter.respond(item.id, approveResponse(), store)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. deliver → respond round-trip through a stub adapter
// ─────────────────────────────────────────────────────────────────────────────

describe('deliver → respond round-trip', () => {
  it('email: pending item delivered then responded → completed', async () => {
    // 1. Create a pending item in the store
    const item = makeItem({ id: 'rtrip-email-1', status: 'pending' })
    await store.create(item)

    // 2. Deliver via email adapter (no-op stub — just verifies the interface call)
    await emailAdapter.deliver(item, store)

    // 3. Simulate claim (as store.update — the web layer would do this)
    await store.update(item.id, { status: 'claimed', claimedBy: 'person-alex' })

    // 4. Human responds via the adapter's respond() path
    const completed = await emailAdapter.respond(
      item.id,
      {
        verb: 'approve',
        resolvedBy: 'person-alex',
        comments: 'Approved via email reply',
      },
      store
    )

    expect(completed.status).toBe('completed')
    expect(completed.resolution?.verb).toBe('approve')
    expect(completed.resolution?.comments).toBe('Approved via email reply')

    // 5. Verify persistence
    const persisted = await store.get(item.id)
    expect(persisted!.status).toBe('completed')
  })

  it('slack: pending item delivered then responded → completed', async () => {
    const item = makeItem({ id: 'rtrip-slack-1', status: 'pending' })
    await store.create(item)

    await slackAdapter.deliver(item, store)

    // Claim the item
    await store.update(item.id, { status: 'claimed', claimedBy: 'person-sam' })

    const completed = await slackAdapter.respond(
      item.id,
      {
        verb: 'decide',
        resolvedBy: 'person-sam',
        data: { chosenOption: 'Option B' },
      },
      store
    )

    expect(completed.status).toBe('completed')
    expect(completed.resolution?.verb).toBe('decide')
    expect(completed.resolution?.data).toEqual({ chosenOption: 'Option B' })
  })

  it('round-trip works for all 6 request kinds', async () => {
    const kinds: LifecycleItem['kind'][] = ['approve', 'ask', 'decide', 'review', 'do', 'notify']

    for (const kind of kinds) {
      const item = claimedItem({ kind, id: `rtrip-kind-${kind}` })
      await store.create(item)

      const result = await emailAdapter.respond(
        item.id,
        {
          verb: kind === 'approve' ? 'approve' : 'done',
          resolvedBy: 'person-alex',
        },
        store
      )

      expect(result.status).toBe('completed')
      expect(result.kind).toBe(kind)
      store.reset()
    }
  })

  it('respond rejects double-resolution (fail-closed on second respond)', async () => {
    const item = claimedItem({ id: 'rtrip-double-1' })
    await store.create(item)

    // First respond — succeeds
    await slackAdapter.respond(item.id, approveResponse(), store)

    // Second respond — must throw (item is now completed, not claimed/in_progress)
    await expect(slackAdapter.respond(item.id, approveResponse(), store)).rejects.toThrow()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. LifecycleAdapterRegistry
// ─────────────────────────────────────────────────────────────────────────────

describe('LifecycleAdapterRegistry', () => {
  it('register + get round-trip', () => {
    const registry = new LifecycleAdapterRegistry()
    registry.register(emailAdapter)
    expect(registry.get('email')).toBe(emailAdapter)
  })

  it('get returns undefined for unregistered kind', () => {
    const registry = new LifecycleAdapterRegistry()
    expect(registry.get('web')).toBeUndefined()
  })

  it('register overwrites existing adapter for the same kind', () => {
    const registry = new LifecycleAdapterRegistry()
    const fakeAdapter = { ...emailAdapter, kind: 'email' as const }
    registry.register(emailAdapter)
    registry.register(fakeAdapter)
    expect(registry.get('email')).toBe(fakeAdapter)
  })

  it('kinds() lists all registered kinds', () => {
    const registry = new LifecycleAdapterRegistry()
    registry.register(emailAdapter)
    registry.register(slackAdapter)
    const kinds = registry.kinds()
    expect(kinds).toContain('email')
    expect(kinds).toContain('slack')
    expect(kinds).toHaveLength(2)
  })

  it('unregister removes the adapter', () => {
    const registry = new LifecycleAdapterRegistry()
    registry.register(emailAdapter)
    registry.unregister('email')
    expect(registry.get('email')).toBeUndefined()
    expect(registry.kinds()).toHaveLength(0)
  })

  it('can register adapters with custom (non-union) kind strings', () => {
    const registry = new LifecycleAdapterRegistry()
    const customAdapter = { ...emailAdapter, kind: 'sms' }
    registry.register(customAdapter)
    expect(registry.get('sms')).toBe(customAdapter)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. adapterRegistry (global default)
// ─────────────────────────────────────────────────────────────────────────────

describe('adapterRegistry (global)', () => {
  it('is a LifecycleAdapterRegistry instance', () => {
    expect(adapterRegistry).toBeInstanceOf(LifecycleAdapterRegistry)
  })

  it('can register and look up adapters', () => {
    // Use unregister to clean up after test
    adapterRegistry.register(emailAdapter)
    expect(adapterRegistry.get('email')).toBe(emailAdapter)
    adapterRegistry.unregister('email')
  })

  it('can register a custom channel kind', () => {
    const testAdapter = { ...slackAdapter, kind: 'test-custom-registry' }
    adapterRegistry.register(testAdapter)
    expect(adapterRegistry.get('test-custom-registry')).toBe(testAdapter)
    adapterRegistry.unregister('test-custom-registry')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. respond() with rich LifecycleResponse fields
// ─────────────────────────────────────────────────────────────────────────────

describe('respond with full LifecycleResponse', () => {
  it('preserves resolvedAt when provided', async () => {
    const resolvedAt = new Date('2026-05-25T11:30:00Z')
    const item = claimedItem({ id: 'resp-rt-1' })
    await store.create(item)
    const result = await emailAdapter.respond(
      item.id,
      {
        verb: 'approve',
        resolvedBy: 'person-alex',
        resolvedAt,
      },
      store
    )
    expect(result.resolution?.resolvedAt).toEqual(resolvedAt)
  })

  it('preserves comments when provided', async () => {
    const item = claimedItem({ id: 'resp-rt-2' })
    await store.create(item)
    const result = await slackAdapter.respond(
      item.id,
      {
        verb: 'reviewed',
        resolvedBy: 'person-sam',
        comments: 'Needs minor changes',
      },
      store
    )
    expect(result.resolution?.comments).toBe('Needs minor changes')
  })

  it('preserves data when provided', async () => {
    const item = claimedItem({ id: 'resp-rt-3' })
    await store.create(item)
    const result = await emailAdapter.respond(
      item.id,
      {
        verb: 'decide',
        resolvedBy: 'person-jordan',
        data: { selected: 'plan-b', reason: 'cost' },
      },
      store
    )
    expect(result.resolution?.data).toEqual({ selected: 'plan-b', reason: 'cost' })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. deliver() logs to console (stub contract)
// ─────────────────────────────────────────────────────────────────────────────

describe('deliver stub logging', () => {
  it('emailAdapter.deliver logs to console.log', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const item = makeItem({ id: 'log-test-1', title: 'Deploy approval' })
    await store.create(item)
    await emailAdapter.deliver(item, store)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[email-adapter]'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Deploy approval'))
    spy.mockRestore()
  })

  it('slackAdapter.deliver logs to console.log', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const item = makeItem({ id: 'log-test-2', title: 'Budget decision' })
    await store.create(item)
    await slackAdapter.deliver(item, store)
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('[slack-adapter]'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Budget decision'))
    spy.mockRestore()
  })
})
