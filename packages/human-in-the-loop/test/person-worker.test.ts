/**
 * Tests for `personAsWorker` — the Person filler of the `digital-workers`
 * Worker port (PRD aip-qozi).
 *
 * The adapter wraps a `Human` so it satisfies the `Worker` interface AND
 * carries a `dispatch` port. When `digital-workers.ask(personWorker, …)`
 * dispatches, it routes through the lifecycle state machine
 * (create → claim → in_progress → completed) and obtains the answer via an
 * injected `resolve` callback (the channel-delivery seam).
 *
 * These tests run in node (no Cloudflare bindings needed) — the adapter is
 * pure object construction over an injected store.
 */

import { describe, it, expect, vi } from 'vitest'
import { personAsWorker } from '../src/person-worker.js'
import { LifecycleStoreMemory } from '../src/lifecycle-store-memory.js'
import type { Worker } from 'digital-workers'
import type { Human } from '../src/types.js'

function makePerson(overrides: Partial<Human> = {}): Human {
  return {
    id: 'person_priya',
    name: 'Priya',
    email: 'priya@example.com',
    roles: ['reviewer', 'product-manager'],
    channels: {
      slack: '@priya',
      email: 'priya@example.com',
    },
    ...overrides,
  }
}

describe('personAsWorker — adapter shape', () => {
  it('produces an object that satisfies the Worker interface from digital-workers', () => {
    const worker: Worker = personAsWorker(makePerson(), { resolve: async () => 'noop' })

    expect(worker.id).toBe('person_priya')
    expect(worker.name).toBe('Priya')
    expect(worker.type).toBe('human')
    expect(worker.status).toBe('available')
    expect(worker.contacts).toEqual({ slack: '@priya', email: 'priya@example.com' })
    expect(typeof worker.dispatch?.ask).toBe('function')
  })

  it('derives skills from the person roles by default', () => {
    const worker = personAsWorker(makePerson(), { resolve: async () => 'noop' })
    expect(worker.skills).toEqual(['reviewer', 'product-manager'])
  })

  it('honours id / name / status / contacts / skills overrides', () => {
    const worker = personAsWorker(makePerson(), {
      id: 'override_id',
      name: 'Override Name',
      status: 'busy',
      contacts: { email: 'override@example.com' },
      skills: ['custom-skill'],
      resolve: async () => 'noop',
    })
    expect(worker.id).toBe('override_id')
    expect(worker.name).toBe('Override Name')
    expect(worker.status).toBe('busy')
    expect(worker.contacts).toEqual({ email: 'override@example.com' })
    expect(worker.skills).toEqual(['custom-skill'])
  })

  it('omits optional fields when not supplied (no undefined leakage)', () => {
    const worker = personAsWorker(makePerson(), { resolve: async () => 'noop' })
    expect('preferences' in worker).toBe(false)
    expect('metadata' in worker).toBe(false)
  })

  it('carries preferences and metadata when supplied', () => {
    const worker = personAsWorker(makePerson(), {
      preferences: { primary: 'slack' },
      metadata: { team: 'platform' },
      resolve: async () => 'noop',
    })
    expect(worker.preferences).toEqual({ primary: 'slack' })
    expect(worker.metadata).toEqual({ team: 'platform' })
  })
})

describe('personAsWorker.dispatch.ask — Human lifecycle (PRD aip-qozi)', () => {
  it('walks the lifecycle create → claim → in_progress → completed and returns the answer', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async ({ item, question, person }) => {
        // The resolver receives the persisted lifecycle item, the original
        // question, and the person record — the channel-delivery seam.
        expect(item.status).toBe('in_progress')
        expect(item.kind).toBe('ask')
        expect(item.askPayload?.question).toBe(question)
        expect(person.id).toBe('person_priya')
        return 'Yes, approved.'
      },
    })

    const result = await worker.dispatch!.ask({ question: 'Approve the refund?' })
    expect(result.answer).toBe('Yes, approved.')
    expect(result.answeredBy?.id).toBe('person_priya')
    expect(result.answeredBy?.type).toBe('human')
    expect(result.answeredBy?.name).toBe('Priya')

    // After resolution the lifecycle item is in 'completed' status.
    const items = await store.list()
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('completed')
  })

  it('escalates the lifecycle item when the resolver throws', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => {
        throw new Error('channel timeout')
      },
    })

    await expect(worker.dispatch!.ask({ question: 'q' })).rejects.toThrow('channel timeout')

    // The lifecycle item is escalated (not completed) after resolver failure.
    const items = await store.list()
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('escalated')
  })

  it('invokes the channel adapter before claiming (best-effort delivery)', async () => {
    const deliver = vi.fn().mockResolvedValue({ ok: true })
    const adapter = {
      kind: 'web' as const,
      deliver,
    }
    const worker = personAsWorker(makePerson(), {
      channelAdapter: adapter,
      resolve: async () => 'answer',
    })

    await worker.dispatch!.ask({ question: 'q' })
    expect(deliver).toHaveBeenCalledOnce()
    const deliveredItem = deliver.mock.calls[0]?.[0]
    expect(deliveredItem?.status).toBe('pending')
    expect(deliveredItem?.askPayload?.question).toBe('q')
  })

  it('does not throw when the channel adapter delivery fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const adapter = {
      kind: 'web' as const,
      deliver: vi.fn().mockRejectedValue(new Error('slack down')),
    }
    const worker = personAsWorker(makePerson(), {
      channelAdapter: adapter,
      resolve: async () => 'answer',
    })

    const result = await worker.dispatch!.ask({ question: 'q' })
    expect(result.answer).toBe('answer')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('channel delivery failed'),
      expect.any(Error)
    )
    warnSpy.mockRestore()
  })

  it('honours per-call timeout in slaDeadline', async () => {
    const store = new LifecycleStoreMemory()
    const now = Date.now()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => 'answer',
    })

    await worker.dispatch!.ask({ question: 'q', timeout: 5000 })
    const items = await store.list()
    expect(items).toHaveLength(1)
    const item = items[0]!
    const delta = item.slaDeadline.getTime() - now
    // Should be ~5000ms (allow generous wiggle for test execution time).
    expect(delta).toBeGreaterThanOrEqual(4000)
    expect(delta).toBeLessThanOrEqual(10000)
  })
})
