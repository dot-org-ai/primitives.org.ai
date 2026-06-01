/**
 * v4 type-surface tests (aip-cnks.7.2).
 *
 * These are TYPE-LEVEL assertions: they prove the four-layer `Deliverable`
 * composes, that the assurance→gatingBasis ceiling is enforced at AUTHOR time
 * (outcome-pricing without a verifiable metric is a COMPILE error), and that
 * `Offer` / `PricingBasis` are the SAME types that originate in
 * `business-as-code` (not redefined at this layer).
 *
 * The `@ts-expect-error` directives are real: if the ceiling guard stopped
 * narrowing to `never`, the directive would have nothing to suppress and the
 * compile (and `tsc --noEmit` typecheck) would FAIL with TS2578.
 */

import { describe, it, expect, expectTypeOf } from 'vitest'

import type {
  // four layers
  Deliverable,
  ContractLayer,
  ImplementationLayer,
  DependenciesLayer,
  CommercialLens,
  DeliverableKind,
  Outcome,
  FunctionKind,
  // spines + ceiling
  Assurance,
  GatingCeiling,
  LegalGating,
  // authoring + ceiling helpers
  ServiceSpec,
  WithinCeiling,
  AssuranceOf,
  PriceShorthand,
  // re-exported economic primitives
  Offer,
  OfferOf,
  PricingBasis,
  PriceSpecification,
  FundingSource,
  // invocation
  InvocationState,
  Terminal,
  InvocationEvent,
  InvocationHandle,
  Settlement,
  VerificationVerdict,
  Settled,
  // discovery
  Discovery,
  Lens,
  Match,
  // wire
  ResponseEnvelope,
} from '../../src/v4/index.js'
import { Service } from '../../src/v4/index.js'

// The canonical homes — used to prove origin, not redefinition.
import type {
  Offer as BacOffer,
  PricingBasis as BacPricingBasis,
  PriceSpecification as BacPriceSpecification,
  FundingSource as BacFundingSource,
} from 'business-as-code'

// ============================================================================
// Offer / PricingBasis / PriceSpecification / FundingSource originate in
// business-as-code (re-exported here, NOT redefined).
// ============================================================================

describe('economic primitives originate in business-as-code', () => {
  it('Offer is the SAME type as business-as-code Offer', () => {
    expectTypeOf<Offer>().toEqualTypeOf<BacOffer>()
  })

  it('PricingBasis is the SAME closed ladder as business-as-code', () => {
    expectTypeOf<PricingBasis>().toEqualTypeOf<BacPricingBasis>()
    // and it is the 5-rung value-capture ladder, complete by construction
    expectTypeOf<PricingBasis>().toEqualTypeOf<
      'access' | 'effort' | 'usage' | 'output' | 'outcome'
    >()
  })

  it('PriceSpecification + FundingSource are re-exported, not forked', () => {
    expectTypeOf<PriceSpecification>().toEqualTypeOf<BacPriceSpecification>()
    expectTypeOf<FundingSource>().toEqualTypeOf<BacFundingSource>()
  })

  it('OfferOf<TOut> IS structurally an Offer (phantom carrier only)', () => {
    expectTypeOf<OfferOf<{ id: string }>>().toMatchTypeOf<Offer>()
  })
})

// ============================================================================
// The four layers compose into one Deliverable.
// ============================================================================

describe('the four-layer Deliverable composes', () => {
  it('contract / implementation / dependencies / commercial line up', () => {
    expectTypeOf<Deliverable['contract']>().toEqualTypeOf<ContractLayer<unknown, unknown>>()
    expectTypeOf<Deliverable['implementation']>().toEqualTypeOf<ImplementationLayer>()
    expectTypeOf<Deliverable['dependencies']>().toEqualTypeOf<DependenciesLayer | undefined>()
    expectTypeOf<Deliverable['commercial']>().toEqualTypeOf<
      CommercialLens | readonly [CommercialLens, ...CommercialLens[]]
    >()
  })

  it('kind is the recursive 3-kind union', () => {
    expectTypeOf<DeliverableKind>().toEqualTypeOf<'service-as-software' | 'agent' | 'software'>()
  })

  it('FunctionKind is Code | Generative | Agentic | Human', () => {
    expectTypeOf<FunctionKind>().toEqualTypeOf<'Code' | 'Generative' | 'Agentic' | 'Human'>()
  })

  it('a fully-typed Deliverable is assignable', () => {
    type Out = { reconciled: number }
    type D = Deliverable<{ url: string }, Out>
    // the typed Offer threads TOut through invoke/offer affordances
    expectTypeOf<D['offer']>().toEqualTypeOf<OfferOf<Out> | ReadonlyArray<OfferOf<Out>>>()
    expectTypeOf<Awaited<ReturnType<D['invoke']>>>().toEqualTypeOf<InvocationHandle<Out>>()
  })
})

// ============================================================================
// The assurance→gatingBasis ceiling (AUTHOR-time, compile).
// ============================================================================

describe('assurance→gatingBasis ceiling', () => {
  it('GatingCeiling maps each grade to its legal rungs', () => {
    // outcome is unlocked ONLY by counterfactual + deterministic
    expectTypeOf<LegalGating<'deterministic'>>().toEqualTypeOf<GatingCeiling['deterministic']>()
    type DeterministicReaches = 'outcome' extends LegalGating<'deterministic'> ? true : false
    expectTypeOf<DeterministicReaches>().toEqualTypeOf<true>()
    type CounterfactualReaches = 'outcome' extends LegalGating<'counterfactual'> ? true : false
    expectTypeOf<CounterfactualReaches>().toEqualTypeOf<true>()

    // the lower grades do NOT reach outcome
    type AttestedReaches = 'outcome' extends LegalGating<'attested'> ? true : false
    expectTypeOf<AttestedReaches>().toEqualTypeOf<false>()
    type ProxyReaches = 'outcome' extends LegalGating<'proxy'> ? true : false
    expectTypeOf<ProxyReaches>().toEqualTypeOf<false>()
    type UnverifiableReaches = 'outcome' extends LegalGating<'unverifiable'> ? true : false
    expectTypeOf<UnverifiableReaches>().toEqualTypeOf<false>()
  })

  it('AssuranceOf defaults to unverifiable when no metric.verify is declared', () => {
    expectTypeOf<AssuranceOf<{ name: 'x' }>>().toEqualTypeOf<'unverifiable'>()
    expectTypeOf<
      AssuranceOf<{ name: 'x'; metric: { name: 'm'; verify: 'deterministic' } }>
    >().toEqualTypeOf<'deterministic'>()
  })

  // ── the LAW: outcome-pricing requires a verifiable metric ──

  it('outcome-pricing WITH a verifiable (deterministic) metric typechecks', () => {
    const ok = {
      name: 'GAAP reconciliation',
      metric: { name: 'unmatched', verify: 'deterministic' },
      price: { per: 'outcome', successFee: '$5,000' },
    } as const satisfies ServiceSpec

    // WithinCeiling passes the spec through unchanged (NOT narrowed to never)
    expectTypeOf<WithinCeiling<typeof ok>>().toEqualTypeOf<typeof ok>()
    // → so the front door return type is a real Deliverable, not never
    expectTypeOf<ReturnType<typeof Service<typeof ok>>>().not.toBeNever()
    expect(ok.price.per).toBe('outcome')
  })

  it('outcome-pricing WITHOUT a verifiable metric is narrowed to never', () => {
    type Bad = {
      name: 'vibes'
      metric: { name: 'm'; verify: 'proxy' }
      price: { per: 'outcome'; successFee: '$5,000' }
    }
    // proxy cannot reach outcome → the guard collapses the spec to never
    expectTypeOf<WithinCeiling<Bad>>().toBeNever()
  })

  it('outcome-pricing WITHOUT any metric (defaults unverifiable) is never', () => {
    type Bad = { name: 'vibes'; price: { per: 'outcome' } }
    expectTypeOf<WithinCeiling<Bad>>().toBeNever()
  })

  it('the COMPILE-error path: Service() rejects an over-reaching outcome price', () => {
    // The proof body is type-checked by `tsc -p tsconfig.test.json` (wired into
    // the package `typecheck` script) but NEVER executed at runtime — `Service`
    // is a `declare`d type-only signature with no value. Declaring-without-
    // calling keeps the runtime green while the compiler does the real work.
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

      // a non-outcome price (output) at proxy assurance is fine — sanity anchor
      const fine = {
        name: 'extraction',
        metric: { name: 'm', verify: 'proxy' },
        price: { per: 'output', unit: 'doc', amount: '$0.10' },
      } as const satisfies ServiceSpec
      Service(fine)
    }
    // reference the proof so it is type-checked but not invoked
    expectTypeOf(_ceilingProof).toBeFunction()
    expect(typeof _ceilingProof).toBe('function')
  })
})

// ============================================================================
// Spine / Assurance / authoring shapes are the expected closed unions.
// ============================================================================

describe('spines + authoring shapes', () => {
  it('Assurance is the 7-grade CONTROL spine', () => {
    expectTypeOf<Assurance>().toEqualTypeOf<
      | 'instrumented'
      | 'deterministic'
      | 'proxy'
      | 'sampled'
      | 'attested'
      | 'counterfactual'
      | 'unverifiable'
    >()
  })

  it('PriceShorthand discriminates on the value-capture rung', () => {
    expectTypeOf<PriceShorthand['per']>().toEqualTypeOf<PricingBasis>()
  })

  it('Outcome.metric.verifiability is graded by Assurance', () => {
    expectTypeOf<Outcome['metric']['verifiability']>().toEqualTypeOf<Assurance>()
  })
})

// ============================================================================
// Invocation runtime types (surface #2).
// ============================================================================

describe('invocation runtime types', () => {
  it('InvocationState is the 11-literal FSM union', () => {
    expectTypeOf<InvocationState>().toEqualTypeOf<
      | 'ORDERED'
      | 'ONBOARDING'
      | 'ACTIVE'
      | 'DELIVERING'
      | 'QUALITY_REVIEW'
      | 'DELIVERED'
      | 'ACCEPTED'
      | 'CANCELLED'
      | 'ESCALATED'
      | 'ERROR'
      | 'REFUNDED'
      | 'DISPUTED'
    >()
  })

  it('Terminal is a subset of InvocationState', () => {
    expectTypeOf<Terminal>().toMatchTypeOf<InvocationState>()
    expectTypeOf<Terminal>().toEqualTypeOf<'ACCEPTED' | 'CANCELLED' | 'REFUNDED'>()
  })

  it('InvocationEvent<TOut> threads the typed output into preview/delivered', () => {
    type Out = { score: number }
    type Delivered = Extract<InvocationEvent<Out>, { kind: 'delivered' }>
    expectTypeOf<Delivered['output']>().toEqualTypeOf<Out>()
    type Preview = Extract<InvocationEvent<Out>, { kind: 'preview-available' }>
    expectTypeOf<Preview['slot']>().toEqualTypeOf<'score'>()
  })

  it('Settlement is the 3-way settlement union; Settled wraps a terminal state', () => {
    expectTypeOf<Settlement>().toMatchTypeOf<{ outcome: 'charged' | 'refunded' | 'noop' }>()
    expectTypeOf<Settled<{ x: 1 }>['state']>().toEqualTypeOf<Terminal>()
    expectTypeOf<Settled<{ x: 1 }>['verification']>().toEqualTypeOf<
      VerificationVerdict | undefined
    >()
  })

  it('InvocationHandle.ceiling is a PricingBasis computed at ORDER', () => {
    expectTypeOf<InvocationHandle<unknown>['ceiling']>().toEqualTypeOf<PricingBasis>()
  })
})

// ============================================================================
// Discovery + wire (surfaces #3 + the locked envelope).
// ============================================================================

describe('discovery + wire', () => {
  it('Lens is the closed projection set', () => {
    expectTypeOf<Lens>().toEqualTypeOf<
      'catalog' | 'listing' | 'marketplace' | 'order' | 'delivery' | 'portal' | 'holdco'
    >()
  })

  it('Match<TOut> carries a typed (nullable) Offer', () => {
    expectTypeOf<Match<{ id: string }>['offer']>().toEqualTypeOf<OfferOf<{ id: string }> | null>()
  })

  it('Discovery.derive is a lens-keyed projector map', () => {
    expectTypeOf<keyof Discovery['derive']>().toEqualTypeOf<Lens>()
  })

  it('ResponseEnvelope locks relationships/references/actions/api', () => {
    expectTypeOf<ResponseEnvelope['relationships']>().toEqualTypeOf<
      Record<string, string | object>
    >()
    expectTypeOf<ResponseEnvelope['actions']>().toEqualTypeOf<Record<string, string>>()
    expectTypeOf<ResponseEnvelope['api']>().toEqualTypeOf<{
      name: string
      docs: string
      version: string
      home: string
    }>()
  })
})
