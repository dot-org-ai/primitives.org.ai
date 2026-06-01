/**
 * v4 `Service()` front-door tests (aip-cnks.7.3).
 *
 * The authoring factory that PRODUCES a four-layer `Deliverable` from a simple
 * plain object and WIRES its affordances to the other two runtimes:
 *   - the four layers fan out from the flat author fields,
 *   - `price` shorthand → the commercial `gatingBasis` + a real business-as-code
 *     `Offer`,
 *   - the assurance→gatingBasis ceiling is enforced at AUTHOR time (a real
 *     `@ts-expect-error` proves outcome-pricing without a verifiable metric is a
 *     COMPILE error),
 *   - `.invoke` / `.reconcile` → the invocation runtime (7.4); `.derive` → the
 *     discovery projector (7.5); `.offer` → the canonical Offer.
 *
 * The `@ts-expect-error` directive is REAL: it is type-checked by
 * `tsc -p tsconfig.test.json` (wired into the package `typecheck` script). If the
 * `WithinCeiling` guard stopped narrowing the parameter to `never`, the directive
 * would have nothing to suppress and the typecheck would FAIL with TS2578.
 */

import { describe, it, expect } from 'vitest'

import { Service } from '../../src/v4/index.js'
import type { CommercialLens, Deliverable, ServiceSpec } from '../../src/v4/index.js'
import type { Offer } from 'business-as-code'

// Helper: a CommercialLens is `CommercialLens | [CommercialLens, ...]` — grab
// the primary lens regardless of arity.
function primaryLens(d: Deliverable): CommercialLens {
  return Array.isArray(d.commercial) ? d.commercial[0] : (d.commercial as CommercialLens)
}

// Helper: `.offer` is `Offer | Offer[]` — grab the primary Offer.
function primaryOffer(d: Deliverable): Offer {
  return (Array.isArray(d.offer) ? d.offer[0] : d.offer) as Offer
}

// ============================================================================
// Minimal spec → a valid four-layer Deliverable with a free/access Offer.
// ============================================================================

describe('Service() — minimal spec → four-layer Deliverable', () => {
  const svc = Service({
    name: 'Reconcile inbox',
    input: { url: 'string' },
    output: { count: 'number' },
    run: async (input: { url: string }) => ({ count: 1 }),
  })

  it('is a service-as-software Deliverable with all four layers present', () => {
    expect(svc.kind).toBe('service-as-software')
    expect(svc.name).toBe('Reconcile inbox')
    expect(svc.$id).toBe('deliverable:reconcile-inbox')

    // Layer 1 — contract (io schemas + outcome + acceptance)
    expect(svc.contract.input).toBeDefined()
    expect(svc.contract.output).toBeDefined()
    expect(svc.contract.outcomeContract.outcome.statement).toBeTruthy()
    expect(svc.contract.outcomeContract.outcome.metric.verifiability).toBe('unverifiable')

    // Layer 2 — implementation (≥1 Function from the `run` shorthand)
    expect(svc.implementation.functions.length).toBeGreaterThanOrEqual(1)
    expect(svc.implementation.functions[0]!.fnKind).toBe('Agentic')

    // Layer 3 — dependencies (omitted ⇒ undefined when nothing composes)
    expect(svc.dependencies).toBeUndefined()

    // Layer 4 — commercial (a free/access lens)
    expect(primaryLens(svc).gating.basis).toBe('access')
  })

  it('omitted price ⇒ a free/access Offer', () => {
    const offer = primaryOffer(svc)
    expect(offer.$type).toBe('Offer')
    expect(offer.gatingBasis).toBe('access')
    expect(offer.priceSpecification).toEqual({
      structure: 'SinglePrice',
      price: { amount: 0n, currency: 'USD' },
    })
    expect(offer.itemOffered).toEqual({ $type: 'Service', $id: 'service:reconcile-inbox' })
  })
})

// ============================================================================
// `price` shorthand → correct commercial gatingBasis + a real Offer.
// ============================================================================

describe('Service() — `price` shorthand → commercial gatingBasis + real Offer', () => {
  it('per:usage → usage basis + a UsageMeter Offer', () => {
    const svc = Service({
      name: 'Doc extraction',
      price: { per: 'usage', unit: 'page', amount: '$0.05' },
    })
    expect(primaryLens(svc).gating.basis).toBe('usage')
    const offer = primaryOffer(svc)
    expect(offer.gatingBasis).toBe('usage')
    expect(offer.priceSpecification.structure).toBe('UsageMeter')
  })

  it('per:output → output basis + a UsageMeter Offer', () => {
    const svc = Service({
      name: 'Image gen',
      price: { per: 'output', unit: 'image', amount: '$0.10' },
    })
    expect(primaryLens(svc).gating.basis).toBe('output')
    expect(primaryOffer(svc).gatingBasis).toBe('output')
  })

  it('per:access → access basis + a SinglePrice Offer (priced, not free)', () => {
    const svc = Service({
      name: 'Monthly bookkeeping',
      price: { per: 'access', amount: '$499.00', interval: 'month' },
    })
    const offer = primaryOffer(svc)
    expect(offer.gatingBasis).toBe('access')
    expect(offer.priceSpecification).toEqual({
      structure: 'SinglePrice',
      price: { amount: 49900n, currency: 'USD' },
    })
  })

  it('per:outcome WITH a verifiable metric → outcome basis + a SuccessFee Offer', () => {
    const svc = Service({
      name: 'GAAP reconciliation',
      metric: { name: 'unmatched', verify: 'deterministic' },
      price: { per: 'outcome', successFee: '$5,000' },
    })
    expect(primaryLens(svc).gating.basis).toBe('outcome')
    const offer = primaryOffer(svc)
    expect(offer.gatingBasis).toBe('outcome')
    expect(offer.priceSpecification.structure).toBe('SuccessFee')
    // the metric verifiability flows into the contract's Outcome
    expect(svc.contract.outcomeContract.outcome.metric.verifiability).toBe('deterministic')
  })
})

// ============================================================================
// The ceiling — outcome-pricing requires a verifiable metric (AUTHOR-time).
// ============================================================================

describe('Service() — the assurance→gatingBasis ceiling (compile-time)', () => {
  it('the COMPILE-error path: Service() rejects an over-reaching outcome price', () => {
    // Type-checked by `tsc -p tsconfig.test.json`, never executed at runtime.
    function _ceilingProof() {
      const bad = {
        name: 'vibes',
        metric: { name: 'm', verify: 'proxy' },
        price: { per: 'outcome', successFee: '$5,000' },
      } as const satisfies ServiceSpec

      // @ts-expect-error — proxy assurance cannot gate on `outcome`; the
      // WithinCeiling guard narrows the parameter to `never`, so this call does
      // not typecheck. (If the ceiling regressed, this directive would be unused
      // → TS2578 → typecheck FAILS. That is the test.)
      Service(bad)

      // WITH a deterministic metric the SAME outcome price compiles cleanly.
      const ok = {
        name: 'GAAP reconciliation',
        metric: { name: 'unmatched', verify: 'deterministic' },
        price: { per: 'outcome', successFee: '$5,000' },
      } as const satisfies ServiceSpec
      Service(ok)
    }
    expect(typeof _ceilingProof).toBe('function')
  })
})

// ============================================================================
// Affordances — wired to the invocation runtime (#2) + discovery projector (#3).
// ============================================================================

describe('Service() — wired affordances', () => {
  const svc = Service({
    name: 'Reconcile',
    input: { url: 'string' },
    output: { count: 'number' },
    run: async (_input: { url: string }) => ({ count: 42 }),
  })

  it('.invoke(input) returns a handle that starts ORDERED', async () => {
    const handle = await svc.invoke({ url: 'https://x' })
    // synchronously created at ORDERED before the FSM auto-drives.
    expect(handle.state()).toBe('ORDERED')
    expect(handle.offer).toBe(primaryOffer(svc))
    expect(handle.ceiling).toBe('access')
    // the run shorthand seeds the delivered output through the stub executor.
    await handle.watch('DELIVERED', 'ACCEPTED')
    await expect(handle.result).resolves.toEqual({ count: 42 })
  })

  it('.reconcile(desired) drives to a terminal settlement', async () => {
    const settled = await svc.reconcile({ input: { url: 'https://y' } })
    expect(settled.state).toBe('ACCEPTED')
    expect(settled.output).toEqual({ count: 42 })
    expect(settled.settlement.outcome).toBe('charged')
  })

  it('.derive(lens) returns a well-formed ResponseEnvelope', () => {
    const env = svc.derive('listing')
    expect(env.api.name).toBe('services-as-software')
    expect(env.$type).toBe('Deliverable')
    expect(env.$id).toBe('deliverable:reconcile')
    expect(env.relationships['itemOffered']).toBeDefined()
    // the listing lens projects the Offer's pricing under a `listing` key.
    expect(env['listing']).toBeDefined()
    // actions = the FSM transitions available (a discovery node → `order`).
    expect(env.actions['order']).toBeDefined()
  })

  it('.offer is the canonical business-as-code Offer', () => {
    const offer = primaryOffer(svc)
    expect(offer.$type).toBe('Offer')
    expect(offer.$id).toBe('offer:reconcile')
    expect(offer.itemOffered.$id).toBe('service:reconcile')
  })
})

// ============================================================================
// Order-time gateAt ceiling — backstop #3 (ADR-0011 §3) through Service().invoke()
// ============================================================================

describe('Service().invoke() — order-time gateAt ceiling (backstop #3)', () => {
  // An `unverifiable` Deliverable (no metric) tops out at `access`.
  const unverified = Service({
    name: 'Vibes report',
    output: { note: 'string' },
    run: async () => ({ note: 'ok' }),
  })

  // A `deterministic` Deliverable unlocks the full ladder up to `outcome`.
  const verified = Service({
    name: 'GAAP recon order',
    metric: { name: 'unmatched', verify: 'deterministic' },
    price: { per: 'outcome', successFee: '$5,000' },
    run: async () => ({ ok: true }),
  })

  it('REJECTS the order when gateAt exceeds the assurance ceiling', async () => {
    await expect(unverified.invoke({}, { gateAt: 'outcome' })).rejects.toThrow(/gateAt/)
  })

  it('ACCEPTS the order when gateAt is at/below the ceiling', async () => {
    const atCeiling = await verified.invoke({}, { gateAt: 'outcome' })
    expect(atCeiling.state()).toBe('ORDERED')
    const below = await verified.invoke({}, { gateAt: 'usage' })
    expect(below.state()).toBe('ORDERED')
  })

  it('ACCEPTS the order when gateAt is omitted', async () => {
    const handle = await unverified.invoke({})
    expect(handle.state()).toBe('ORDERED')
  })
})

// ============================================================================
// Batch authoring — Service([...]) → Deliverable[].
// ============================================================================

describe('Service([...]) — batch authoring', () => {
  it('returns one Deliverable per spec, each fully wired', () => {
    const services = Service([
      { name: 'Alpha', run: async () => ({}) },
      { name: 'Beta', price: { per: 'usage', unit: 'call', amount: '$0.01' } },
    ])
    expect(services).toHaveLength(2)
    expect(services[0]!.name).toBe('Alpha')
    expect(services[0]!.kind).toBe('service-as-software')
    expect(services[1]!.name).toBe('Beta')
    expect(primaryLens(services[1]!).gating.basis).toBe('usage')
  })
})

// ============================================================================
// Secondary constructors — define / fromFunction / load.
// ============================================================================

describe('Service.define / fromFunction / load', () => {
  it('Service.define is an alias of the single-spec front door', () => {
    const svc = Service.define({ name: 'Aliased', run: async () => ({}) })
    expect(svc.kind).toBe('service-as-software')
    expect(svc.$id).toBe('deliverable:aliased')
  })

  it('Service.fromFunction wraps a bare async function', () => {
    const svc = Service.fromFunction(async (_x: number) => _x + 1, { name: 'Increment' })
    expect(svc.name).toBe('Increment')
    expect(svc.implementation.functions.length).toBeGreaterThanOrEqual(1)
  })

  it('Service.load is a declared stub awaiting persistence (rejects for now)', async () => {
    await expect(Service.load('svc:does-not-exist')).rejects.toThrow(/awaits persistence/)
  })
})
