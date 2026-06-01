/**
 * v4 invocation RUNTIME tests (aip-cnks.7.4).
 *
 * Two halves:
 *   1. The 11-state FSM — `VALID_TRANSITIONS` / `canTransition` / `isTerminal` /
 *      `assertTransition`. Every legal edge returns `true`; a representative set
 *      of illegal edges returns `false`; terminals have no out-edges;
 *      `assertTransition` throws on an illegal edge.
 *   2. The in-memory handle scaffold — `createInvocationHandle` driven through
 *      ORDERED→…→DELIVERED→ACCEPTED, asserting the emitted event sequence and the
 *      terminal settlement stub.
 */

import { describe, it, expect } from 'vitest'

import type {
  DurableStore,
  InvocationEvent,
  InvocationState,
  OfferOf,
  PersistedInvocation,
} from '../../src/v4/index.js'
import {
  VALID_TRANSITIONS,
  canTransition,
  isTerminal,
  assertTransition,
  IllegalTransitionError,
  createInvocationHandle,
  reconcileHandle,
  attach,
  NoDurableStoreError,
  InvocationNotFoundError,
} from '../../src/v4/index.js'

// ============================================================================
// Fixtures
// ============================================================================

const ALL_STATES: readonly InvocationState[] = [
  'ORDERED',
  'ONBOARDING',
  'ACTIVE',
  'DELIVERING',
  'QUALITY_REVIEW',
  'DELIVERED',
  'ACCEPTED',
  'CANCELLED',
  'ESCALATED',
  'ERROR',
  'REFUNDED',
  'DISPUTED',
]

const TERMINALS: readonly InvocationState[] = ['ACCEPTED', 'CANCELLED', 'REFUNDED']

type Out = { report: string }

function stubOffer(): OfferOf<Out> {
  const offer: OfferOf<Out> = {
    $type: 'Offer',
    $id: 'offer:test',
    name: 'Test Offer',
    itemOffered: { $type: 'Service', $id: 'service:test' },
    gatingBasis: 'access',
    priceSpecification: { structure: 'SinglePrice', price: { amount: 0n, currency: 'USD' } },
    fundingSource: { source: 'direct' },
  }
  return offer
}

// ============================================================================
// 1. FSM — VALID_TRANSITIONS / canTransition
// ============================================================================

describe('v4 FSM — VALID_TRANSITIONS table', () => {
  it('pins the exact ADR-0011 §4 edge set', () => {
    expect(VALID_TRANSITIONS).toEqual({
      ORDERED: ['ONBOARDING', 'CANCELLED', 'ERROR'],
      ONBOARDING: ['ACTIVE', 'CANCELLED', 'ESCALATED', 'ERROR'],
      ACTIVE: ['DELIVERING', 'CANCELLED', 'ESCALATED', 'ERROR'],
      DELIVERING: ['QUALITY_REVIEW', 'ESCALATED', 'ERROR'],
      QUALITY_REVIEW: ['DELIVERED', 'ESCALATED', 'ERROR'],
      DELIVERED: ['ACCEPTED', 'DISPUTED'],
      ESCALATED: ['ACTIVE', 'CANCELLED', 'REFUNDED'],
      ERROR: ['REFUNDED', 'DISPUTED'],
      DISPUTED: ['REFUNDED', 'ACCEPTED'],
      ACCEPTED: [],
      CANCELLED: [],
      REFUNDED: [],
    })
  })

  it('covers all 11 distinct states as keys', () => {
    expect(Object.keys(VALID_TRANSITIONS).sort()).toEqual([...ALL_STATES].sort())
  })
})

describe('v4 FSM — canTransition allows EVERY edge in the table', () => {
  // Generate one assertion per legal edge so a dropped edge fails loudly.
  for (const from of ALL_STATES) {
    for (const to of VALID_TRANSITIONS[from]) {
      it(`${from} → ${to} is allowed`, () => {
        expect(canTransition(from, to)).toBe(true)
      })
    }
  }
})

describe('v4 FSM — canTransition rejects representative illegal edges', () => {
  const ILLEGAL: ReadonlyArray<[InvocationState, InvocationState]> = [
    // The classic "can't skip to terminal accept" traps.
    ['ORDERED', 'ACCEPTED'],
    ['ORDERED', 'DELIVERED'],
    ['ORDERED', 'ACTIVE'],
    ['DELIVERING', 'ACCEPTED'],
    ['DELIVERING', 'DELIVERED'],
    ['ACTIVE', 'QUALITY_REVIEW'],
    ['ONBOARDING', 'DELIVERING'],
    ['QUALITY_REVIEW', 'ACCEPTED'],
    ['DELIVERED', 'REFUNDED'],
    // Out of a terminal — nothing is reachable.
    ['ACCEPTED', 'DISPUTED'],
    ['ACCEPTED', 'REFUNDED'],
    ['CANCELLED', 'ACTIVE'],
    ['REFUNDED', 'ACCEPTED'],
    // Self-loops are never legal.
    ['ACTIVE', 'ACTIVE'],
    ['DELIVERED', 'DELIVERED'],
  ]

  for (const [from, to] of ILLEGAL) {
    it(`${from} → ${to} is rejected`, () => {
      expect(canTransition(from, to)).toBe(false)
    })
  }

  it('ACCEPTED → every other state is rejected (terminal)', () => {
    for (const to of ALL_STATES) {
      expect(canTransition('ACCEPTED', to)).toBe(false)
    }
  })
})

// ============================================================================
// 1b. FSM — isTerminal
// ============================================================================

describe('v4 FSM — isTerminal', () => {
  for (const s of ALL_STATES) {
    const expected = TERMINALS.includes(s)
    it(`${s} is ${expected ? '' : 'not '}terminal`, () => {
      expect(isTerminal(s)).toBe(expected)
    })
  }

  it('terminal states have an empty out-edge list', () => {
    for (const s of ALL_STATES) {
      expect(VALID_TRANSITIONS[s].length === 0).toBe(isTerminal(s))
    }
  })
})

// ============================================================================
// 1c. FSM — assertTransition
// ============================================================================

describe('v4 FSM — assertTransition', () => {
  it('does not throw on a legal edge', () => {
    expect(() => assertTransition('ORDERED', 'ONBOARDING')).not.toThrow()
  })

  it('throws IllegalTransitionError on an illegal edge', () => {
    expect(() => assertTransition('ORDERED', 'ACCEPTED')).toThrow(IllegalTransitionError)
  })

  it('throws out of a terminal', () => {
    expect(() => assertTransition('ACCEPTED', 'DISPUTED')).toThrow(/illegal FSM transition/)
  })

  it('carries the offending from/to on the error', () => {
    try {
      assertTransition('DELIVERING', 'ACCEPTED')
      throw new Error('expected assertTransition to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(IllegalTransitionError)
      const e = err as IllegalTransitionError
      expect(e.from).toBe('DELIVERING')
      expect(e.to).toBe('ACCEPTED')
    }
  })
})

// ============================================================================
// 2. Handle scaffold — drive the happy path, assert the event sequence
// ============================================================================

describe('v4 handle scaffold — createInvocationHandle', () => {
  it('drives ORDERED→…→DELIVERED then settles on accept(), emitting the FSM spine', async () => {
    const handle = createInvocationHandle<{ q: string }, Out>({
      id: 'inv:test-1',
      offer: stubOffer(),
      ceiling: 'access',
      input: { q: 'hello' },
      metric: 'metric:test',
      assurance: 'instrumented',
      seedOutput: { report: 'done' },
      autoStart: true,
    })

    expect(handle.id).toBe('inv:test-1')
    expect(handle.ceiling).toBe('access')

    // Collect the full event stream until the terminal `settled` event.
    const events: InvocationEvent<Out>[] = []
    const collector = (async () => {
      for await (const ev of handle.events) {
        events.push(ev)
        if (ev.kind === 'settled') break
      }
    })()

    // The run auto-drives to DELIVERED; the buyer drives the terminal accept().
    const delivered = await handle.result
    expect(delivered).toEqual({ report: 'done' })

    await handle.watch('DELIVERED')
    const settlement = await handle.accept()
    await collector

    // ── state-changed spine: ORDERED→…→DELIVERED→ACCEPTED ──
    const states = events
      .filter(
        (e): e is Extract<InvocationEvent<Out>, { kind: 'state-changed' }> =>
          e.kind === 'state-changed'
      )
      .map((e) => e.to)
    expect(states).toEqual([
      'ONBOARDING',
      'ACTIVE',
      'DELIVERING',
      'QUALITY_REVIEW',
      'DELIVERED',
      'ACCEPTED',
    ])

    // ── content events fired in order along the spine ──
    const kinds = events.map((e) => e.kind)
    expect(kinds).toContain('evaluator-signoff')
    expect(kinds).toContain('delivered')
    expect(kinds).toContain('settled')
    // evaluator-signoff precedes delivered precedes settled.
    expect(kinds.indexOf('evaluator-signoff')).toBeLessThan(kinds.indexOf('delivered'))
    expect(kinds.indexOf('delivered')).toBeLessThan(kinds.indexOf('settled'))

    // ── terminal state + settlement stub ──
    expect(handle.state()).toBe('ACCEPTED')
    expect(isTerminal(handle.state())).toBe(true)
    expect(settlement).toEqual({
      outcome: 'charged',
      chargeId: 'stub:charge',
      captured: { amount: 0n, currency: 'USD' },
      basis: 'access',
      contract: 'stub:outcome-contract',
    })

    // ── the quality promise resolves to the 3-rater (stub) verdict ──
    const quality = await handle.quality
    expect(quality.metric).toBe('metric:test')
    expect(quality.raters).toHaveLength(3)
    expect(quality.rollup).toBe('auto-promote')
    expect(quality.assuranceAchieved).toBe('instrumented')

    // ── settled() returns the same charged settlement ──
    await expect(handle.settled()).resolves.toEqual(settlement)
  })

  it('history() records every emitted event for replay', async () => {
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      seedOutput: { report: 'x' },
    })
    await handle.result
    await handle.watch('DELIVERED')
    await handle.accept()
    const log = handle.history()
    expect(log.some((e) => e.kind === 'state-changed' && e.to === 'ACCEPTED')).toBe(true)
    expect(log.some((e) => e.kind === 'settled')).toBe(true)
  })

  it('autoAccept settles without a buyer round-trip', async () => {
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      seedOutput: { report: 'auto' },
      orderOpts: { autoAccept: true },
    })
    const settlement = await handle.settled()
    expect(settlement.outcome).toBe('charged')
    expect(handle.state()).toBe('ACCEPTED')
  })

  it('dispute() from DELIVERED moves to DISPUTED (a guarded drive verb)', async () => {
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      seedOutput: { report: 'disputed' },
    })
    await handle.watch('DELIVERED')
    await handle.dispute('not what I ordered')
    expect(handle.state()).toBe('DISPUTED')
  })

  it('cancel() before delivery is a noop settlement', async () => {
    // No autoStart: drive the cancel from the initial ORDERED state.
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      seedOutput: { report: 'n/a' },
      autoStart: false,
    })
    expect(handle.state()).toBe('ORDERED')
    await handle.cancel('changed my mind')
    expect(handle.state()).toBe('CANCELLED')
    const settlement = await handle.settled()
    expect(settlement).toEqual({ outcome: 'noop', reason: 'cancelled-pre-charge' })
  })

  it('rejects an illegal drive verb (accept() from ORDERED)', async () => {
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      seedOutput: { report: 'n/a' },
      autoStart: false,
    })
    await expect(handle.accept()).rejects.toThrow(IllegalTransitionError)
    expect(handle.state()).toBe('ORDERED')
  })

  it('an injected executor failure routes the FSM to ERROR + a failed event', async () => {
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      executor: {
        async execute() {
          throw new Error('boom')
        },
      },
    })
    await expect(handle.result).rejects.toThrow('boom')
    expect(handle.state()).toBe('ERROR')
    const log = handle.history()
    expect(log.some((e) => e.kind === 'failed')).toBe(true)
  })
})

// ============================================================================
// 2a. Handle scaffold — the ESCALATION verbs (escalate / resolve)
// ============================================================================

describe('v4 handle scaffold — escalation verbs', () => {
  /**
   * Mint a handle that PARKS in `DELIVERING` (a live, non-terminal state from
   * which `escalate()` is legal): the injected executor never resolves, so the
   * FSM advances ORDERED→ONBOARDING→ACTIVE→DELIVERING and stops awaiting it.
   */
  async function liveInDelivering() {
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      // never resolves — the run parks in DELIVERING awaiting the cascade.
      executor: { execute: () => new Promise<Out>(() => {}) },
    })
    await handle.watch('DELIVERING')
    expect(handle.state()).toBe('DELIVERING')
    return handle
  }

  it('escalate() from a live state → ESCALATED + an escalated event', async () => {
    const handle = await liveInDelivering()
    await handle.escalate('evaluator-deadlock')
    expect(handle.state()).toBe('ESCALATED')
    const log = handle.history()
    expect(log.some((e) => e.kind === 'escalated' && e.reason === 'evaluator-deadlock')).toBe(true)
  })

  it("resolve('refund') → REFUNDED, settling via settler.refund", async () => {
    const handle = await liveInDelivering()
    await handle.escalate('authority-boundary')
    expect(handle.state()).toBe('ESCALATED')

    const settlement = await handle.resolve('refund')
    expect(handle.state()).toBe('REFUNDED')
    // the stub settler.refund() shape (zero-Money refund). This escalation path
    // refunds PRE-charge, so the chargeId is the `no-prior-charge` sentinel.
    expect(settlement).toEqual({
      outcome: 'refunded',
      amount: { amount: 0n, currency: 'USD' },
      per: 'stub:refund-contract',
      chargeId: 'no-prior-charge',
    })
    // the same settlement is observable via settled().
    await expect(handle.settled()).resolves.toEqual(settlement)
    expect(isTerminal(handle.state())).toBe(true)
  })

  it("resolve('cancel') → CANCELLED with a noop settlement", async () => {
    const handle = await liveInDelivering()
    await handle.escalate('clarification-timeout')

    const settlement = await handle.resolve('cancel')
    expect(handle.state()).toBe('CANCELLED')
    expect(settlement).toEqual({ outcome: 'noop', reason: 'cancelled-pre-charge' })
    await expect(handle.settled()).resolves.toEqual(settlement)
    expect(isTerminal(handle.state())).toBe(true)
  })

  it("resolve('resume') RE-DRIVES the delivery tail to a charged settlement", async () => {
    // Mint a handle whose executor PARKS on the first pass (so we can escalate
    // mid-delivery) but RESOLVES on the resume re-drive. A one-shot gate flips
    // after the first call so the second `execute` returns a real output.
    let firstPass = true
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      executor: {
        execute: () => {
          if (firstPass) {
            firstPass = false
            return new Promise<Out>(() => {}) // park — never resolves on pass 1
          }
          return Promise.resolve({ report: 'resumed' })
        },
      },
    })

    await handle.watch('DELIVERING')
    await handle.escalate('evaluator-deadlock')
    expect(handle.state()).toBe('ESCALATED')

    // resolve('resume') takes ESCALATED→ACTIVE, re-drives the delivery tail via
    // the (now-resolving) executor, and settles with a real charge.
    const settlement = await handle.resolve('resume')
    expect(handle.state()).toBe('ACCEPTED')
    expect(settlement.outcome).toBe('charged')

    // the re-driven output + verdict are observable.
    await expect(handle.result).resolves.toEqual({ report: 'resumed' })
    const quality = await handle.quality
    expect(quality.rollup).toBe('auto-promote')
    await expect(handle.settled()).resolves.toEqual(settlement)
  })

  it("resolve('resume') with autoAccept re-drives straight to ACCEPTED", async () => {
    let firstPass = true
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      orderOpts: { autoAccept: true },
      executor: {
        execute: () => {
          if (firstPass) {
            firstPass = false
            return new Promise<Out>(() => {})
          }
          return Promise.resolve({ report: 'auto-resumed' })
        },
      },
    })

    await handle.watch('DELIVERING')
    await handle.escalate('evaluator-deadlock')
    const settlement = await handle.resolve('resume')
    expect(handle.state()).toBe('ACCEPTED')
    expect(settlement.outcome).toBe('charged')
  })
})

// ============================================================================
// 2b. reconcileHandle — fire-and-forget convenience
// ============================================================================

describe('v4 reconcileHandle', () => {
  it('drives to a terminal Settled record (auto-accepts at DELIVERED)', async () => {
    const handle = createInvocationHandle<unknown, Out>({
      offer: stubOffer(),
      ceiling: 'access',
      input: {},
      seedOutput: { report: 'reconciled' },
    })
    const settled = await reconcileHandle(handle)
    expect(settled.state).toBe('ACCEPTED')
    expect(settled.output).toEqual({ report: 'reconciled' })
    expect(settled.settlement.outcome).toBe('charged')
    expect(settled.verification?.rollup).toBe('auto-promote')
  })
})

// ============================================================================
// 2c. attach — an injected DurableStore seam
// ============================================================================

describe('v4 attach', () => {
  it('rejects with NoDurableStoreError when no store is wired', async () => {
    await expect(attach('inv:durable-1')).rejects.toBeInstanceOf(NoDurableStoreError)
    await expect(attach('inv:durable-1')).rejects.toThrow(/no durable backend is wired/i)
  })

  it('rejects with InvocationNotFoundError when the store has no such run', async () => {
    const store: DurableStore = { load: async () => null }
    await expect(attach('inv:missing', store)).rejects.toBeInstanceOf(InvocationNotFoundError)
  })

  it('returns a read-only handle view from a fake store', async () => {
    const persisted: PersistedInvocation<Out> = {
      id: 'inv:durable-2',
      offer: stubOffer(),
      ceiling: 'access',
      state: 'ACCEPTED',
      history: [
        { kind: 'delivered', output: { report: 'persisted' }, assurance: 'instrumented' },
        {
          kind: 'settled',
          settlement: {
            outcome: 'charged',
            chargeId: 'charge:1',
            captured: { amount: 0n, currency: 'USD' },
            basis: 'access',
            contract: 'charge:1',
          },
        },
      ],
    }
    const store: DurableStore = {
      load: async <T>(id: string) =>
        id === 'inv:durable-2' ? (persisted as unknown as PersistedInvocation<T>) : null,
    }

    const handle = await attach<Out>('inv:durable-2', store)
    expect(handle.id).toBe('inv:durable-2')
    expect(handle.state()).toBe('ACCEPTED')
    expect(handle.ceiling).toBe('access')
    // the replayed spine serves the derived promises.
    await expect(handle.result).resolves.toEqual({ report: 'persisted' })
    const settlement = await handle.settled()
    expect(settlement.outcome).toBe('charged')
    // the view replays history.
    expect(handle.history()).toHaveLength(2)
    // drive verbs are read-only on an attached view.
    await expect(handle.accept()).rejects.toThrow(/read-only/)
  })
})
