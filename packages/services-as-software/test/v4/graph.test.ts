/**
 * v4 graph DISCOVERY tests (aip-cnks.7.5).
 *
 * Three halves:
 *   1. The ResponseEnvelope PROJECTOR — a Deliverable + its Offer project to a
 *      WELL-FORMED envelope: correct `$type`/`$id`, out-edges in `relationships`,
 *      in-edges in `references`, the typed payload under its discriminant key,
 *      the available FSM transitions in `actions`.
 *   2. The lens map (`derive.<lens>`) — every Lens has a `derive` entry; a
 *      private/builder-only field is DROPPED under `marketplace` (public) but
 *      PRESENT under `holdco` (the visibility predicate). `listing` is a
 *      projection (representative vs concrete differ by ctx, no stored noun).
 *   3. `match` — match-or-mint via an INJECTED stub matcher: a hit→ratified Offer
 *      and a miss→minted stub Offer. Plus `resolve` (Outcome→Problem+Metric).
 */

import { describe, it, expect } from 'vitest'

import type { Offer } from 'business-as-code'
import type { Deliverable, Demand, Lens, LensCtx, Outcome } from '../../src/v4/index.js'
import { makeDiscovery, envelope } from '../../src/v4/index.js'
import type { Matcher } from '../../src/v4/graph.js'

// ============================================================================
// Fixtures
// ============================================================================

type Out = { reconciled: number }

function fixtureOffer($id = 'offer:bookkeeping'): Offer {
  return {
    $type: 'Offer',
    $id,
    name: 'Bookkeeping — monthly',
    promise: 'Books reconciled to GAAP by BD5',
    seller: 'acme-books',
    itemOffered: { $type: 'Service', $id: 'service:bookkeeping' },
    gatingBasis: 'outcome',
    priceSpecification: { structure: 'SuccessFee', percent: 10, of: 'metric:unmatched' },
    fundingSource: { source: 'direct' },
  }
}

function fixtureDeliverable(): Deliverable {
  const offer = fixtureOffer() as Offer & { readonly __out?: Out }
  const d: Deliverable = {
    kind: 'service-as-software',
    $id: 'deliverable:bookkeeping',
    name: 'GAAP reconciliation',
    description: 'Reconcile the books to GAAP, 0 unmatched, by BD5.',
    contract: {
      input: { '~standard': {} } as never,
      output: { '~standard': {} } as never,
      outcomeContract: {
        outcome: {
          id: 'outcome:gaap',
          statement: 'Books reconciled to GAAP, 0 unmatched, by BD5',
          metric: { ref: 'metric:unmatched', unit: 'txns', verifiability: 'deterministic' },
          resolves: 'problem:unreconciled-books',
        },
        acceptance: [{ predicate: 'unmatched == 0' }],
      },
    },
    implementation: {
      functions: [{ id: 'fn:reconcile', fnKind: 'Agentic', performs: 'reconcile ledger' }],
    },
    dependencies: {
      composes: [
        {
          kind: 'software',
          $id: 'deliverable:ledger-parser',
          name: 'Ledger parser',
          contract: {
            input: { '~standard': {} } as never,
            output: { '~standard': {} } as never,
            outcomeContract: {
              outcome: {
                id: 'outcome:parsed',
                statement: 'Ledger parsed',
                metric: { ref: 'metric:parsed', verifiability: 'deterministic' },
              },
              acceptance: [],
            },
          },
          implementation: { functions: [{ id: 'fn:parse', fnKind: 'Code', performs: 'parse' }] },
          commercial: {
            gating: { basis: 'access' },
            priceSpecification: {
              structure: 'SinglePrice',
              price: { amount: 0n, currency: 'USD' },
            },
            fundingSource: { source: 'direct' },
            offer: { mode: 'inline', promise: 'parse the ledger' },
          },
        } as unknown as Deliverable,
      ],
    },
    commercial: {
      gating: { basis: 'outcome' },
      priceSpecification: { structure: 'SuccessFee', percent: 10, of: 'metric:unmatched' },
      fundingSource: { source: 'direct' },
      offer: { mode: 'ref', offerId: 'offer:bookkeeping' },
    },
    offer,
    derive: () => {
      throw new Error('not used in these tests')
    },
    invoke: () => {
      throw new Error('not used in these tests')
    },
    reconcile: () => {
      throw new Error('not used in these tests')
    },
  }
  return d
}

const PUBLIC_CTX: LensCtx = { audience: 'public', visibility: 'public' }
const HOLDCO_CTX: LensCtx = { audience: 'holdco', visibility: 'private' }

// ============================================================================
// 1. The ResponseEnvelope PROJECTOR
// ============================================================================

describe('the ResponseEnvelope projector', () => {
  it('projects a Deliverable to a well-formed envelope ($type/$id + api block)', () => {
    const d = fixtureDeliverable()
    const env = envelope(d, { ctx: HOLDCO_CTX })

    expect(env.$type).toBe('Deliverable')
    expect(env.$id).toBe('deliverable:bookkeeping')
    expect(env.$context).toBe('https://schema.org.ai/')
    expect(env.api.name).toBe('services-as-software')
    expect(env.api.version).toBe('v4')
    expect(env.links['self']).toBe('Deliverable/deliverable:bookkeeping')
  })

  it('lands out-edges in relationships', () => {
    const env = envelope(fixtureDeliverable(), { ctx: HOLDCO_CTX })
    // itemOffered (the G1 Service) + the Offer it is sold as are out-edges.
    expect(env.relationships['itemOffered']).toBe('Service/service:bookkeeping')
    expect(env.relationships['offer']).toBe('Offer/offer:bookkeeping')
    // the sub-Deliverable it composes is an out-edge (array form).
    expect(env.relationships['composes']).toEqual(['Deliverable/deliverable:ledger-parser'])
    // the Outcome + the Problem it resolves are out-edges.
    expect(env.relationships['outcome']).toBe('Outcome/outcome:gaap')
    expect(env.relationships['resolves']).toBe('Problem/problem:unreconciled-books')
  })

  it('lands in-edges in references (with a total)', () => {
    const refs = [
      { $type: 'Demand', $id: 'demand:abc', predicate: 'seeks' },
      { $type: 'Demand', $id: 'demand:def', predicate: 'seeks' },
    ]
    const env = envelope(fixtureDeliverable(), { ctx: HOLDCO_CTX, references: refs })
    expect(env.references?.total).toBe(2)
    expect(env.references?.items).toEqual(refs)
  })

  it('omits references when there are no in-edges', () => {
    const env = envelope(fixtureDeliverable(), { ctx: HOLDCO_CTX })
    expect(env.references).toBeUndefined()
  })

  it('rides the typed payload under its discriminant key', () => {
    const d = fixtureDeliverable()
    const dEnv = envelope(d, { ctx: HOLDCO_CTX })
    expect(dEnv['deliverable']).toBe(d)

    const o = fixtureOffer()
    const oEnv = envelope(o)
    expect(oEnv['offer']).toBe(o)
    expect(oEnv.$type).toBe('Offer')
  })

  it('exposes the available FSM transitions as actions', () => {
    // a discovery node (no live invocation) → the single `order` affordance.
    const discoveryEnv = envelope(fixtureOffer())
    expect(discoveryEnv.actions).toEqual({ order: 'invoke()' })

    // a node at a live FSM state → exactly that state's VALID_TRANSITIONS.
    const liveEnv = envelope(fixtureOffer(), { state: 'DELIVERED' })
    expect(Object.keys(liveEnv.actions).sort()).toEqual(['accepted', 'disputed'])
  })
})

// ============================================================================
// 2. The lens map + the visibility predicate
// ============================================================================

describe('derive.<lens> — pure lens projections', () => {
  const discovery = makeDiscovery()

  it('has a derive entry for every Lens', () => {
    const lenses: Lens[] = [
      'catalog',
      'listing',
      'marketplace',
      'order',
      'delivery',
      'portal',
      'holdco',
    ]
    for (const lens of lenses) {
      expect(typeof discovery.derive[lens]).toBe('function')
    }
  })

  it('drops a builder-only field under the public marketplace lens', () => {
    const env = discovery.derive.marketplace(fixtureOffer(), PUBLIC_CTX)
    // `seller` is builder-only; a public marketplace viewer must not see it.
    expect(env.relationships['seller']).toBeUndefined()
    // the public out-edge (itemOffered) is still present.
    expect(env.relationships['itemOffered']).toBe('Service/service:bookkeeping')
  })

  it('keeps the builder-only field under the holdco lens', () => {
    const env = discovery.derive.holdco(fixtureOffer(), HOLDCO_CTX)
    // the holdco (owner) god-view keeps the private seller edge.
    expect(env.relationships['seller']).toBe('acme-books')
  })

  it('marketplace vs holdco differ ONLY by the visibility predicate', () => {
    const offer = fixtureOffer()
    const market = discovery.derive.marketplace(offer, PUBLIC_CTX)
    const holdco = discovery.derive.holdco(offer, HOLDCO_CTX)
    // holdco is a strict superset of marketplace's relationships.
    for (const k of Object.keys(market.relationships)) {
      expect(holdco.relationships[k]).toEqual(market.relationships[k])
    }
    expect('seller' in holdco.relationships).toBe(true)
    expect('seller' in market.relationships).toBe(false)
  })
})

describe('listing is a PROJECTION (representative vs concrete), not a stored noun', () => {
  const discovery = makeDiscovery()

  it('representative ctx hides the concrete seller; concrete names it', () => {
    const offer = fixtureOffer()
    const representative = discovery.derive.listing(offer, {
      audience: 'public',
      visibility: 'public',
      representative: true,
    })
    const concrete = discovery.derive.listing(offer, {
      audience: 'holdco',
      visibility: 'private',
      representative: false,
    })

    // same node → two listings, selected purely by ctx.representative.
    expect((representative['listing'] as { kind: string }).kind).toBe('representative')
    expect((concrete['listing'] as { kind: string }).kind).toBe('concrete')

    // the representative Listing stands for the category — no live seller.
    expect((representative['listing'] as { seller?: string }).seller).toBeUndefined()
    // the concrete Listing names the live seller.
    expect((concrete['listing'] as { seller?: string }).seller).toBe('acme-books')
  })

  it('the Listing is derived (no Listing noun on the node)', () => {
    const offer = fixtureOffer()
    // the node carries no `listing` field — it is purely a projection output.
    expect((offer as unknown as Record<string, unknown>)['listing']).toBeUndefined()
    const env = discovery.derive.listing(offer, PUBLIC_CTX)
    expect(env['listing']).toBeDefined()
  })
})

// ============================================================================
// 3. match-or-mint (injected stub matcher) + resolve
// ============================================================================

describe('match — the match-or-mint surface', () => {
  const demand: Demand = {
    $type: 'Demand',
    $id: 'demand:books',
    seeks: 'service:bookkeeping',
    problem: 'problem:unreconciled-books',
    acceptance: { metric: 'unmatched', target: 0 },
  }

  it('a HIT returns the ratified Offer (minted: false)', async () => {
    // injected stub matcher: a clean hit over the sought Service.
    const matcher: Matcher = {
      async nearest() {
        return { offer: fixtureOffer(), score: 0.92 }
      },
      async ratify() {
        return true
      },
    }
    const discovery = makeDiscovery({ matcher })
    const m = await discovery.match<Out>(demand)

    expect(m.minted).toBe(false)
    expect(m.ratified).toBe(true)
    expect(m.score).toBe(0.92)
    expect(m.offer?.$id).toBe('offer:bookkeeping')
  })

  it('a MISS (nothing clears the threshold) MINTS a stub Offer', async () => {
    // injected stub matcher: a near-miss below the default 0.5 threshold.
    const matcher: Matcher = {
      async nearest() {
        return { offer: fixtureOffer(), score: 0.1 }
      },
      async ratify() {
        return true
      },
    }
    const discovery = makeDiscovery({ matcher })
    const m = await discovery.match<Out>(demand)

    expect(m.minted).toBe(true)
    expect(m.ratified).toBe(false)
    // the minted stub is bound to the sought Service.
    expect(m.offer?.itemOffered.$id).toBe('service:bookkeeping')
    expect(m.offer?.gatingBasis).toBe('access')
  })

  it('a hit that FAILS ratify ESCALATES (the gate never auto-mints on uncertainty)', async () => {
    // The `find-or-create` gate (ai-functions) refuses to mint a spurious Offer
    // when a strong candidate was rejected by the ratifier — that marginal band
    // is escalated to a human, not silently minted.
    const matcher: Matcher = {
      async nearest() {
        return { offer: fixtureOffer(), score: 0.92 }
      },
      async ratify() {
        return false
      },
    }
    const discovery = makeDiscovery({ matcher })
    const m = await discovery.match<Out>(demand)
    expect(m.escalated).toBe(true)
    expect(m.minted).toBe(false)
    expect(m.ratified).toBe(false)
    expect(m.offer).toBeNull()
    expect(m.reason).toBeTruthy()
  })

  it('a closed-pool MISS ESCALATES (never mints a spurious member)', async () => {
    // A sub-threshold hit into a CLOSED reference/enum Service must escalate,
    // not mint — minting would invent an off-rail member of the closed pool.
    const matcher: Matcher = {
      async nearest() {
        return { offer: fixtureOffer(), score: 0.1 }
      },
      async ratify() {
        return true
      },
    }
    const discovery = makeDiscovery({ matcher })
    const m = await discovery.match<Out>(demand, { closedPool: true })
    expect(m.escalated).toBe(true)
    expect(m.minted).toBe(false)
    expect(m.offer).toBeNull()
  })

  it("generation:'review' forces HITL escalate even on a clean ratified hit", async () => {
    const matcher: Matcher = {
      async nearest() {
        return { offer: fixtureOffer(), score: 0.92 }
      },
      async ratify() {
        return true
      },
    }
    const discovery = makeDiscovery({ matcher })
    const m = await discovery.match<Out>(demand, { generation: 'review' })
    expect(m.escalated).toBe(true)
    expect(m.minted).toBe(false)
    expect(m.ratified).toBe(false)
    expect(m.offer).toBeNull()
  })

  it('the default in-memory matcher scores a seeded pool (hit over overlap)', async () => {
    // no injected matcher → the in-memory token-overlap stub over the seed pool.
    const discovery = makeDiscovery({ offers: [fixtureOffer()] })
    const m = await discovery.match<Out>(demand)
    expect(m.minted).toBe(false)
    expect(m.ratified).toBe(true)
    expect(m.offer?.$id).toBe('offer:bookkeeping')
  })

  it('an empty default pool always mints', async () => {
    const discovery = makeDiscovery()
    const m = await discovery.match<Out>(demand)
    expect(m.minted).toBe(true)
    expect(m.score).toBe(0)
  })
})

describe('resolve — Outcome→Problem (+ bound Metric) traversal', () => {
  const discovery = makeDiscovery()

  it('returns the resolved Problem + the bound Metric', () => {
    const outcome: Outcome = {
      id: 'outcome:gaap',
      statement: 'Books reconciled to GAAP',
      metric: { ref: 'metric:unmatched', verifiability: 'deterministic' },
      resolves: 'problem:unreconciled-books',
    }
    expect(discovery.resolve(outcome)).toEqual({
      problem: 'problem:unreconciled-books',
      metric: 'metric:unmatched',
    })
  })

  it('derives a Problem ref when the Outcome does not name one', () => {
    const outcome: Outcome = {
      id: 'outcome:x',
      statement: 'something good',
      metric: { ref: 'metric:y', verifiability: 'proxy' },
    }
    expect(discovery.resolve(outcome)).toEqual({ problem: 'problem:outcome:x', metric: 'metric:y' })
  })
})
