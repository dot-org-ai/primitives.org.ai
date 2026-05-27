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

describe('personAsWorker.dispatch.approve — Human approval lifecycle (PRD aip-9l4r)', () => {
  it('attaches approve only when approveResolver is supplied', () => {
    const noApprove = personAsWorker(makePerson(), { resolve: async () => 'noop' })
    expect(noApprove.dispatch?.approve).toBeUndefined()

    const withApprove = personAsWorker(makePerson(), {
      resolve: async () => 'noop',
      approveResolver: async () => ({ approved: true }),
    })
    expect(typeof withApprove.dispatch?.approve).toBe('function')
  })

  it('walks the lifecycle create → claim → in_progress → completed and returns the decision', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => 'noop',
      approveResolver: async ({ item, request, person }) => {
        // The resolver receives the persisted lifecycle item (in_progress
        // status), the original request body, and the person record.
        expect(item.status).toBe('in_progress')
        expect(item.kind).toBe('approve')
        expect(item.artifact.kind).toBe('ApprovalRequest')
        expect(request).toBe('Approve $500 refund?')
        expect(person.id).toBe('person_priya')
        return { approved: true, notes: 'within refund policy' }
      },
    })

    const result = await worker.dispatch!.approve!({ request: 'Approve $500 refund?' })
    expect(result.approved).toBe(true)
    expect(result.notes).toBe('within refund policy')
    expect(result.approvedBy?.id).toBe('person_priya')
    expect(result.approvedBy?.type).toBe('human')
    expect(result.approvedBy?.name).toBe('Priya')

    // After resolution the lifecycle item is in 'completed' status.
    const items = await store.list()
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('completed')
    expect(items[0]?.resolution?.verb).toBe('approve')
  })

  it('records rejection cleanly with verb="reject" (no escalation by default)', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => 'noop',
      approveResolver: async () => ({ approved: false, notes: 'over budget' }),
    })

    const result = await worker.dispatch!.approve!({ request: 'Approve $5000?' })
    expect(result.approved).toBe(false)
    expect(result.notes).toBe('over budget')

    const items = await store.list()
    expect(items[0]?.status).toBe('completed')
    expect(items[0]?.resolution?.verb).toBe('reject')
  })

  it('escalates rejection when escalateOnReject=true (adapter-level policy)', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => 'noop',
      approveResolver: async () => ({ approved: false }),
      escalateOnReject: true,
    })

    const result = await worker.dispatch!.approve!({ request: 'q' })
    expect(result.approved).toBe(false)

    const items = await store.list()
    expect(items[0]?.status).toBe('escalated')
  })

  it('escalates rejection when caller passes escalate=true on the call', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => 'noop',
      approveResolver: async () => ({ approved: false }),
    })

    await worker.dispatch!.approve!({ request: 'q', escalate: true })
    const items = await store.list()
    expect(items[0]?.status).toBe('escalated')
  })

  it('escalates the lifecycle item when the resolver throws', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => 'noop',
      approveResolver: async () => {
        throw new Error('channel timeout')
      },
    })

    await expect(worker.dispatch!.approve!({ request: 'q' })).rejects.toThrow('channel timeout')

    const items = await store.list()
    expect(items[0]?.status).toBe('escalated')
  })

  it('invokes the channel adapter before claiming (best-effort delivery)', async () => {
    const deliver = vi.fn().mockResolvedValue({ ok: true })
    const adapter = { kind: 'web' as const, deliver }
    const worker = personAsWorker(makePerson(), {
      channelAdapter: adapter,
      resolve: async () => 'noop',
      approveResolver: async () => ({ approved: true }),
    })

    await worker.dispatch!.approve!({ request: 'Approve?' })
    expect(deliver).toHaveBeenCalledOnce()
    const deliveredItem = deliver.mock.calls[0]?.[0]
    expect(deliveredItem?.status).toBe('pending')
    expect(deliveredItem?.kind).toBe('approve')
    expect(deliveredItem?.title).toBe('Approve?')
  })

  it('honours per-call timeout in slaDeadline', async () => {
    const store = new LifecycleStoreMemory()
    const now = Date.now()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => 'noop',
      approveResolver: async () => ({ approved: true }),
    })

    await worker.dispatch!.approve!({ request: 'q', timeout: 5000 })
    const items = await store.list()
    expect(items).toHaveLength(1)
    const item = items[0]!
    const delta = item.slaDeadline.getTime() - now
    expect(delta).toBeGreaterThanOrEqual(4000)
    expect(delta).toBeLessThanOrEqual(10000)
  })
})

describe('personAsWorker.dispatch.notify — channel delivery (PRD aip-9l4r)', () => {
  it('attaches notify by default (no extra options required)', () => {
    const worker = personAsWorker(makePerson(), { resolve: async () => 'noop' })
    expect(typeof worker.dispatch?.notify).toBe('function')
  })

  it('creates a notify lifecycle item, delivers, and resolves with acknowledged', async () => {
    const store = new LifecycleStoreMemory()
    const deliver = vi.fn().mockResolvedValue({ ok: true })
    const adapter = { kind: 'web' as const, deliver }
    const worker = personAsWorker(makePerson(), {
      store,
      channelAdapter: adapter,
      resolve: async () => 'noop',
    })

    const result = await worker.dispatch!.notify!({ message: 'Deploy complete' })
    expect(result.sent).toBe(true)
    expect(deliver).toHaveBeenCalledOnce()
    const deliveredItem = deliver.mock.calls[0]?.[0]
    expect(deliveredItem?.kind).toBe('notify')
    expect(deliveredItem?.status).toBe('pending')

    const items = await store.list()
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('completed')
    expect(items[0]?.resolution?.verb).toBe('acknowledged')
  })

  it('reflects sent=false when channel delivery fails (but lifecycle still records the item)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = new LifecycleStoreMemory()
    const adapter = {
      kind: 'web' as const,
      deliver: vi.fn().mockRejectedValue(new Error('slack down')),
    }
    const worker = personAsWorker(makePerson(), {
      store,
      channelAdapter: adapter,
      resolve: async () => 'noop',
    })

    const result = await worker.dispatch!.notify!({ message: 'm' })
    expect(result.sent).toBe(false)
    expect(result.notes).toContain('channel adapter delivery failed')

    const items = await store.list()
    expect(items[0]?.status).toBe('completed')
    expect(items[0]?.resolution?.verb).toBe('acknowledged')

    warnSpy.mockRestore()
  })

  it('invokes the optional notifyHandler after delivery + resolution', async () => {
    const handler = vi.fn().mockResolvedValue(undefined)
    const worker = personAsWorker(makePerson(), {
      resolve: async () => 'noop',
      notifyHandler: handler,
    })

    await worker.dispatch!.notify!({ message: 'hello', priority: 'high' })
    expect(handler).toHaveBeenCalledOnce()
    const ctx = handler.mock.calls[0]?.[0]
    expect(ctx.message).toBe('hello')
    expect(ctx.priority).toBe('high')
    expect(ctx.item.status).toBe('completed')
    expect(ctx.person.id).toBe('person_priya')
  })

  it('swallows notifyHandler errors (fire-and-forget)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const worker = personAsWorker(makePerson(), {
      resolve: async () => 'noop',
      notifyHandler: async () => {
        throw new Error('subscriber blew up')
      },
    })

    const result = await worker.dispatch!.notify!({ message: 'm' })
    expect(result.sent).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('notifyHandler threw'),
      expect.any(Error)
    )
    warnSpy.mockRestore()
  })
})

// ============================================================================
// PRD aip-2q19 — LLM-shape verbs (do / decide / generate / is)
// ============================================================================
describe('personAsWorker.dispatch.do — Human task lifecycle (PRD aip-2q19)', () => {
  it('walks the do lifecycle and resolves with the human-supplied result', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async ({ item }) => {
        expect(item.kind).toBe('do')
        expect(item.doPayload?.instructions).toBe('Review the PR')
        return 'PR reviewed: looks good'
      },
    })

    const result = await worker.dispatch!.do!({ task: 'Review the PR' })
    expect(result.result).toBe('PR reviewed: looks good')
    expect(result.doneBy?.id).toBe('person_priya')
    expect(result.doneBy?.type).toBe('human')

    const items = await store.list()
    expect(items).toHaveLength(1)
    expect(items[0]?.status).toBe('completed')
    expect(items[0]?.resolution?.verb).toBe('done')
  })

  it('escalates on resolver failure', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => {
        throw new Error('reviewer unavailable')
      },
    })

    await expect(worker.dispatch!.do!({ task: 'Review' })).rejects.toThrow('reviewer unavailable')
    const items = await store.list()
    expect(items[0]?.status).toBe('escalated')
  })
})

describe('personAsWorker.dispatch.decide — Human decision lifecycle (PRD aip-2q19)', () => {
  it('walks the decide lifecycle with the option list on decidePayload', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async ({ item }) => {
        expect(item.kind).toBe('decide')
        expect(item.decidePayload?.options).toEqual(['canary', 'rolling', 'blue-green'])
        return 'canary'
      },
    })

    const result = await worker.dispatch!.decide!({
      options: ['canary', 'rolling', 'blue-green'],
    })
    expect(result.decision).toBe('canary')
    expect(result.decidedBy?.id).toBe('person_priya')

    const items = await store.list()
    expect(items[0]?.resolution?.verb).toBe('decided')
  })

  it('serialises non-string context onto the artifact', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async () => 'A',
    })

    await worker.dispatch!.decide!({
      options: ['A', 'B'],
      context: { risk: 'high', users: 100000 },
    })
    const items = await store.list()
    expect(items[0]?.artifact.context).toEqual({ risk: 'high', users: 100000 })
  })
})

describe('personAsWorker.dispatch.generate — Human task lifecycle (PRD aip-2q19)', () => {
  it('models generate as a do task — matches helpers.generate → defaultHuman.do', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async ({ item }) => {
        // generate is mapped onto the `do` lifecycle (per helpers.generate).
        expect(item.kind).toBe('do')
        expect(item.doPayload?.instructions).toBe('Write a blog post')
        expect(item.artifact.kind).toBe('Generation')
        return '# My blog post'
      },
    })

    const result = await worker.dispatch!.generate!({ prompt: 'Write a blog post' })
    expect(result.content).toBe('# My blog post')
    expect(result.generatedBy?.id).toBe('person_priya')

    const items = await store.list()
    expect(items[0]?.resolution?.verb).toBe('done')
  })
})

describe('personAsWorker.dispatch.is — Human binary decision (PRD aip-2q19)', () => {
  it('models is as a binary decide(true|false) — matches helpers.is mapping', async () => {
    const store = new LifecycleStoreMemory()
    const worker = personAsWorker(makePerson(), {
      store,
      resolve: async ({ item }) => {
        expect(item.kind).toBe('decide')
        expect(item.decidePayload?.options).toEqual(['true', 'false'])
        return 'true'
      },
    })

    const result = await worker.dispatch!.is!({ value: 'foo@bar.com', type: 'email' })
    expect(result.valid).toBe(true)
    expect(result.checkedBy?.id).toBe('person_priya')

    const items = await store.list()
    expect(items[0]?.artifact.context).toMatchObject({
      value: 'foo@bar.com',
      type: 'email',
    })
    expect(items[0]?.resolution?.verb).toBe('decided')
  })

  it('returns valid=false when the human picks "false"', async () => {
    const worker = personAsWorker(makePerson(), {
      resolve: async () => 'false',
    })

    const result = await worker.dispatch!.is!({ value: 'not-an-email', type: 'email' })
    expect(result.valid).toBe(false)
  })
})
