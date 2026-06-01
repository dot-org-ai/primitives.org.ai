/**
 * services-as-software v4 — the `Service()` authoring front door (aip-cnks.7.3).
 *
 * SURFACE #1, the capstone. `Service(spec)` is a callable factory over SIMPLE
 * plain objects (the business-as-code `Business()`/`Product()`/`Goals()` idiom)
 * with progressive disclosure: the flat author fields fan OUT into the four
 * `Deliverable` layers, and the returned value's affordances are WIRED to the
 * other two runtimes:
 *
 *   - `contract`        ← `input`/`output`/`outcome`/`metric`/`accept`
 *   - `implementation`  ← `run` | `functions` | `archetype` | `cascade`
 *   - `dependencies`    ← `composes` / `integrations`
 *   - `commercial`      ← `price` shorthand → a real business-as-code {@link Offer}
 *
 *   - `.invoke(input, opts)` → {@link createInvocationHandle} (runtime, 7.4)
 *   - `.reconcile(desired)`  → {@link reconcileHandle}        (runtime, 7.4)
 *   - `.derive(lens)`        → graph `project` (discovery, 7.5)
 *   - `.offer`               → the canonical business-as-code {@link Offer}(s)
 *
 * **The ceiling is unforgeable at authoring time.** The generic narrows a legal
 * `price.per: 'outcome'` from `spec.metric.verify` ({@link WithinCeiling}): an
 * outcome-priced spec WITHOUT a verifiable Metric collapses the parameter to
 * `never`, so the call does not typecheck. This is the law where the VALUE and
 * CONTROL spines meet — *"you may not sell on an outcome you never declared."*
 * (See the `@ts-expect-error` proof in `test/v4/service.test.ts`.)
 *
 * @packageDocumentation
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'
import { Offer as makeOffer } from 'business-as-code'
import type {
  PriceSpecification,
  PricingBasis,
  FundingSource,
  ItemOfferedRef,
} from 'business-as-code'
import type { Money } from 'business-as-code/finance'

import { createInvocationHandle, reconcileHandle } from './invoke.js'
import type { CascadeExecutor } from './invoke.js'
import { makeDiscovery } from './graph.js'
import type {
  Assurance,
  CommercialLens,
  ContractLayer,
  Deliverable,
  DeliverableOf,
  DependenciesLayer,
  FunctionDef,
  ImplementationLayer,
  InvocationHandle,
  Lens,
  LensCtx,
  Outcome,
  OfferOf,
  OrderOpts,
  PriceShorthand,
  ProblemRef,
  ResponseEnvelope,
  Schema,
  ServiceRef,
  ServiceSpec,
  Settled,
  WithinCeiling,
} from './types.js'

// ============================================================================
// Internal: shape → Standard Schema (the loose `{ field: 'type' }` shorthand)
// ============================================================================

/** True iff `x` is already a Standard Schema (has the `'~standard'` field). */
function isStandardSchema(x: unknown): x is StandardSchemaV1<unknown, unknown> {
  return (
    typeof x === 'object' &&
    x !== null &&
    '~standard' in x &&
    typeof (x as { '~standard': unknown })['~standard'] === 'object'
  )
}

/**
 * A pass-through Standard Schema for a loose `Shapeish`. A real validator
 * (Zod/Valibot/ArkType) is supplied by the author when they pass a Schema
 * directly; the `{ field: 'type' }` shorthand becomes an accept-everything
 * validator that still carries the inferred `T` through the signature. The
 * declared field shape is stashed under a non-standard `shape` slot so the
 * projector/inspector can read the author's intent without re-parsing.
 */
function shapeToSchema<T>(shapeish: Record<string, string> | Schema<unknown>): Schema<T> {
  if (isStandardSchema(shapeish)) return shapeish as Schema<T>
  const schema: StandardSchemaV1<unknown, T> & { shape: Record<string, string> } = {
    '~standard': {
      version: 1,
      vendor: 'services-as-software/service',
      validate: (value: unknown) => ({ value: value as T }),
    },
    shape: shapeish,
  }
  return schema
}

/** The accept-everything schema used when the author omits `input`/`output`. */
function anySchema<T>(): Schema<T> {
  return shapeToSchema<T>({})
}

// ============================================================================
// Internal: price string → Money (bigint minor units)
// ============================================================================

/**
 * Parse an author-friendly price string (`'$5,000'`, `'$49.00'`, `'1200'`) to a
 * {@link Money} in bigint MINOR units (cents). Strips currency symbols and
 * thousands separators; a fractional part is taken as cents (two-decimal
 * convention). Non-numeric input yields a zero-amount `Money` (a free price).
 */
function parsePrice(s: string, currency: Money['currency'] = 'USD'): Money {
  const cleaned = s.replace(/[^0-9.]/g, '')
  if (cleaned === '' || cleaned === '.') return { amount: 0n, currency }
  const [whole, frac = ''] = cleaned.split('.')
  const cents = (frac + '00').slice(0, 2)
  const amount = BigInt(whole || '0') * 100n + BigInt(cents || '0')
  return { amount, currency }
}

// ============================================================================
// Internal: the four-layer fan-out
// ============================================================================

/** A stable, slug-ish id fragment derived from the service name. */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'service'
  )
}

/** Layer 1 — the CONTRACT: io schemas + the Outcome + acceptance predicates. */
function buildContract<TIn, TOut>(spec: ServiceSpec, serviceId: string): ContractLayer<TIn, TOut> {
  const input = (spec.input ? shapeToSchema<TIn>(spec.input) : anySchema<TIn>()) as Schema<TIn>
  const output = (
    spec.output ? shapeToSchema<TOut>(spec.output) : anySchema<TOut>()
  ) as Schema<TOut>

  // The Assurance grade the spec declares (drives the ceiling); default `unverifiable`.
  const verifiability: Assurance = spec.metric?.verify ?? 'unverifiable'

  const statement =
    spec.outcome === undefined
      ? spec.description ?? spec.name
      : typeof spec.outcome === 'string'
      ? spec.outcome
      : spec.outcome.statement
  const resolves: ProblemRef | undefined =
    typeof spec.outcome === 'object' && spec.outcome !== null ? spec.outcome.resolves : undefined

  const outcome: Outcome = {
    id: `outcome:${serviceId}`,
    statement,
    metric: {
      ref: `metric:${serviceId}:${spec.metric?.name ?? 'acceptance'}`,
      verifiability,
      ...(spec.metric?.unit !== undefined ? { unit: spec.metric.unit } : {}),
    },
    ...(resolves !== undefined ? { resolves } : {}),
  }

  // Acceptance predicates: the author's `accept` sentence becomes the first
  // predicate, bound (when present) to the Metric's verifiability check.
  const acceptance: ReadonlyArray<{ predicate: string; check?: string }> =
    spec.accept !== undefined
      ? [
          {
            predicate: spec.accept,
            ...(spec.metric ? { check: `${outcome.metric.ref} (${verifiability})` } : {}),
          },
        ]
      : []

  return { input, output, outcomeContract: { outcome, acceptance } }
}

/**
 * Wrap a single `run` shorthand as one {@link FunctionDef}. Whether the body is
 * deterministic Code or autonomous Agentic is not knowable from the closure
 * here, so the shorthand defaults to `Agentic` (the most general autonomous
 * Function); a richer authoring path supplies an explicit `functions` array.
 */
function runToFunction(serviceId: string, run: (input: unknown) => Promise<unknown>): FunctionDef {
  return {
    id: `fn:${serviceId}:run`,
    fnKind: 'Agentic',
    performs: run.name || 'run',
    oversight: { posture: 'autonomous' },
  }
}

/** Layer 2 — the IMPLEMENTATION: ≥1 Functions + an optional cascade binding. */
function buildImplementation(spec: ServiceSpec, serviceId: string): ImplementationLayer {
  let functions: ReadonlyArray<FunctionDef>
  if (spec.functions && spec.functions.length > 0) {
    functions = spec.functions
  } else if (spec.run) {
    functions = [runToFunction(serviceId, spec.run)]
  } else if (spec.archetype) {
    // archetype pulls defaults from the seed catalog (closed per ADR-0011 §5);
    // until that lands, the archetype name is recorded as a single Function.
    functions = [
      {
        id: `fn:${serviceId}:archetype`,
        fnKind: 'Agentic',
        performs: `archetype:${spec.archetype}`,
        oversight: { posture: 'review-queue' },
      },
    ]
  } else {
    // every Deliverable performs at least one Function — a no-op placeholder
    // when the author declared no implementation style yet.
    functions = [
      {
        id: `fn:${serviceId}:noop`,
        fnKind: 'Code',
        performs: 'noop',
        oversight: { posture: 'autonomous' },
      },
    ]
  }

  const impl: ImplementationLayer = { functions }
  if (spec.cascade !== undefined) impl.binding = { cascade: spec.cascade }
  return impl
}

/** Layer 3 — the DEPENDENCIES: recursively composes sub-Deliverables. */
function buildDependencies(spec: ServiceSpec): DependenciesLayer | undefined {
  const composes = spec.composes
  const integrations = spec.integrations
  if ((!composes || composes.length === 0) && (!integrations || integrations.length === 0)) {
    return undefined
  }
  const deps: DependenciesLayer = {}
  if (composes && composes.length > 0) deps.composes = composes
  if (integrations && integrations.length > 0) deps.integrations = integrations
  return deps
}

// ============================================================================
// Internal: `price` shorthand → (gatingBasis, PriceSpecification) → Offer
// ============================================================================

/**
 * Map one {@link PriceShorthand} to its value-capture `gatingBasis` rung and a
 * concrete {@link PriceSpecification} (composing the business-as-code price
 * shapes — `SinglePrice`/`UsageMeter`/`SuccessFee`/`Gainshare`, no settlement
 * math duplicated here):
 *
 *   - `per: 'access'`  → `access`  · `SinglePrice`  (subscription/license)
 *   - `per: 'effort'`  → `effort`  · `UsageMeter`   (per hour/day/FTE)
 *   - `per: 'usage'`   → `usage`   · `UsageMeter`   (metered)
 *   - `per: 'output'`  → `output`  · `UsageMeter`   (per unit produced)
 *   - `per: 'outcome'` → `outcome` · `SuccessFee` | `Gainshare`
 */
/**
 * Map an outcome-rung `successFee` shorthand to a concrete success-fee
 * {@link PriceSpecification}:
 *
 *   - a PERCENT (`'10%'`, `'7.5%'`)  → `SuccessFee` of `percent` over the
 *     realised `invoice-amount` basis ("10% of what you collect").
 *   - a DOLLAR amount (`'$5,000'`)   → a flat fee. There is no flat-Money
 *     success-fee shape in the business-as-code `PriceSpecification` union yet,
 *     so a flat outcome fee is modelled as a `SinglePrice` carrying the parsed
 *     {@link Money}; the `outcome` gatingBasis (set by the caller) is what marks
 *     it as conditioned on the outcome. PLACEHOLDER pending a real flat-Money
 *     outcome-pricing shape (a `SuccessFee { flat: Money }` variant upstream).
 *   - omitted (`undefined`)          → `SuccessFee` of 100% of `invoice-amount`
 *     (pure outcome billing of the realised invoice).
 *
 * Avoids the prior nonsensical `{ percent: 100, of: '$5,000' }` ("100% of
 * '$5,000'") by never stuffing a dollar string into the percent `of` slot.
 */
function outcomeFeeSpec(successFee: string | undefined): PriceSpecification {
  if (successFee === undefined) {
    return { structure: 'SuccessFee', percent: 100, of: 'invoice-amount' }
  }
  const pct = /^\s*([0-9]+(?:\.[0-9]+)?)\s*%\s*$/.exec(successFee)
  if (pct) {
    return { structure: 'SuccessFee', percent: Number(pct[1]), of: 'invoice-amount' }
  }
  // dollar / numeric → a flat fee carried as SinglePrice (placeholder shape).
  return { structure: 'SinglePrice', price: parsePrice(successFee) }
}

function priceToSpec(price: PriceShorthand): {
  basis: PricingBasis
  priceSpecification: PriceSpecification
} {
  switch (price.per) {
    case 'access':
      return {
        basis: 'access',
        priceSpecification: { structure: 'SinglePrice', price: parsePrice(price.amount) },
      }
    case 'effort':
      return {
        basis: 'effort',
        priceSpecification: {
          structure: 'UsageMeter',
          meter: { event: price.unit, amount: parsePrice(price.amount).amount },
          unit: price.unit,
        },
      }
    case 'usage':
      return {
        basis: 'usage',
        priceSpecification: {
          structure: 'UsageMeter',
          meter: { event: price.unit, amount: parsePrice(price.amount).amount },
          unit: price.unit,
        },
      }
    case 'output':
      return {
        basis: 'output',
        priceSpecification: {
          structure: 'UsageMeter',
          meter: { event: price.unit, amount: parsePrice(price.amount).amount },
          unit: price.unit,
        },
      }
    case 'outcome': {
      // gainshare (% of a delta) takes precedence when supplied; otherwise a
      // success fee. Both gate on the `outcome` rung (the ceiling unlocked it at
      // compile time via WithinCeiling).
      if (price.gainsharePct !== undefined) {
        return {
          basis: 'outcome',
          priceSpecification: {
            structure: 'Gainshare',
            sharePercent: price.gainsharePct,
            baseline: 'baseline',
          },
        }
      }
      return {
        basis: 'outcome',
        priceSpecification: outcomeFeeSpec(price.successFee),
      }
    }
  }
}

/** The free/access Offer minted when the author omits `price` (and `offer`). */
function freePriceSpec(): { basis: PricingBasis; priceSpecification: PriceSpecification } {
  return {
    basis: 'access',
    priceSpecification: { structure: 'SinglePrice', price: { amount: 0n, currency: 'USD' } },
  }
}

/**
 * Layer 4 — the COMMERCIAL lens + the canonical {@link Offer}(s). The flat
 * `price`/`offer` author fields fan out into (a) the typed {@link CommercialLens}
 * tuple exposed on `deliverable.commercial`, and (b) the canonical
 * business-as-code Offer(s) exposed on `deliverable.offer`.
 */
function buildCommercial<TOut>(
  spec: ServiceSpec,
  serviceId: string,
  promise: string
): {
  commercial: Deliverable['commercial']
  offers: readonly [OfferOf<TOut>, ...OfferOf<TOut>[]]
} {
  const itemOffered: ItemOfferedRef = { $type: 'Service', $id: `service:${serviceId}` }
  const fundingSource: FundingSource = { source: 'direct' }

  // explicit Offer(s) win — the author handed us canonical Offers directly.
  if (spec.offer !== undefined) {
    const explicit = Array.isArray(spec.offer) ? spec.offer : [spec.offer]
    const offers = explicit as unknown as readonly [OfferOf<TOut>, ...OfferOf<TOut>[]]
    const lenses = offers.map(
      (o): CommercialLens => ({
        gating: {
          basis: o.gatingBasis,
          ...(o.secondaryBasis !== undefined ? { secondaryBasis: o.secondaryBasis } : {}),
        },
        priceSpecification: o.priceSpecification,
        fundingSource: o.fundingSource,
        offer: { mode: 'ref', offerId: o.$id },
      })
    ) as [CommercialLens, ...CommercialLens[]]
    return { commercial: toCommercialTuple(lenses), offers }
  }

  // `price` shorthand (single or array) → real Offer(s); omitted ⇒ free/access.
  const shorthands: ReadonlyArray<PriceShorthand> =
    spec.price === undefined ? [] : Array.isArray(spec.price) ? spec.price : [spec.price]

  const specs = shorthands.length === 0 ? [freePriceSpec()] : shorthands.map((p) => priceToSpec(p))

  const offers: [OfferOf<TOut>, ...OfferOf<TOut>[]] = [] as unknown as [
    OfferOf<TOut>,
    ...OfferOf<TOut>[]
  ]
  const lenses: [CommercialLens, ...CommercialLens[]] = [] as unknown as [
    CommercialLens,
    ...CommercialLens[]
  ]
  specs.forEach((ps, i) => {
    const offer = makeOffer({
      $id: specs.length === 1 ? `offer:${serviceId}` : `offer:${serviceId}:${ps.basis}:${i}`,
      name: spec.name,
      itemOffered,
      promise,
      gatingBasis: ps.basis,
      priceSpecification: ps.priceSpecification,
      fundingSource,
    }) as OfferOf<TOut>
    offers.push(offer)
    lenses.push({
      gating: { basis: ps.basis },
      priceSpecification: ps.priceSpecification,
      fundingSource,
      // omit `seller` entirely (no double-cast): under exactOptionalPropertyTypes
      // the optional key is simply absent, so `'seller' in lens` is honestly false.
      offer: { mode: 'inline', promise },
    })
  })

  return { commercial: toCommercialTuple(lenses), offers }
}

/** Collapse a non-empty lens list to the `CommercialLens | [...]` shape. */
function toCommercialTuple(
  lenses: readonly [CommercialLens, ...CommercialLens[]]
): Deliverable['commercial'] {
  return lenses.length === 1 ? lenses[0] : lenses
}

// ============================================================================
// Lazy invocation handle — return at ORDERED, start the FSM on first observe
// ============================================================================

/**
 * Wrap {@link createInvocationHandle} so the returned handle is observably
 * `ORDERED` until the caller first OBSERVES or DRIVES it. The 7.4 scaffold
 * auto-drives the FSM on a creation microtask; `Service().invoke()` returns a
 * `Promise<InvocationHandle>`, so without this seam the FSM would race past
 * `ORDERED` before the awaiting caller could read `state()`.
 *
 * The lazy handle presents the stable identity (`id`/`offer`/`ceiling`) and
 * `state() === 'ORDERED'` synchronously. The REAL handle (with `autoStart`) is
 * minted the first time any observe (`events`/`watch`/`result`/`quality`/
 * `settled`/`history`/`costSoFar`/`previews`) or drive (`accept`/`dispute`/…)
 * method is touched — at which point every method delegates to it. This keeps
 * the front door honest ("an order, not yet delivered") while preserving the
 * full runtime once the buyer engages.
 */
function makeLazyHandle<TIn, TOut>(
  opts: Omit<Parameters<typeof createInvocationHandle<TIn, TOut>>[0], 'autoStart'>
): InvocationHandle<TOut> {
  const id = opts.id ?? `inv:${slugify(opts.offer.$id)}-${Math.random().toString(36).slice(2, 8)}`
  let real: InvocationHandle<TOut> | undefined
  function ensure(): InvocationHandle<TOut> {
    if (!real) real = createInvocationHandle<TIn, TOut>({ ...opts, id, autoStart: true })
    return real
  }
  // START-TRIGGERING observe methods (call `ensure()`, minting + auto-driving the
  // real handle on first touch): `events`, `watch`, `result`, `quality`,
  // `settled` (and every drive verb: `clarify`/`accept`/`dispute`/`escalate`/
  // `resolve`/`cancel`). INERT until something else starts the run: `state()`
  // reports `'ORDERED'`, `costSoFar()` a zero Money, `previews()` `{}`,
  // `history()` `[]` — none of these start the FSM.
  const lazy: InvocationHandle<TOut> = {
    id,
    offer: opts.offer,
    ceiling: opts.ceiling,
    state: () => (real ? real.state() : 'ORDERED'),
    get events() {
      return ensure().events
    },
    watch: (...states) => ensure().watch(...states),
    costSoFar: () => (real ? real.costSoFar() : { amount: 0n, currency: 'USD' }),
    previews: () => (real ? real.previews() : {}),
    history: () => (real ? real.history() : []),
    get result() {
      return ensure().result
    },
    get quality() {
      return ensure().quality
    },
    settled: () => ensure().settled(),
    clarify: (reply) => ensure().clarify(reply),
    accept: () => ensure().accept(),
    dispute: (reason) => ensure().dispute(reason),
    escalate: (reason) => ensure().escalate(reason),
    resolve: (r) => ensure().resolve(r),
    cancel: (reason) => ensure().cancel(reason),
  }
  return lazy
}

// ============================================================================
// build — the runtime fan-out (spec → four-layer Deliverable + wired affordances)
// ============================================================================

/** A zero-config discovery surface for the `.derive` affordance (pure projector). */
const DISCOVERY = makeDiscovery()
const DEFAULT_DERIVE_CTX: LensCtx = { audience: 'public', visibility: 'public' }

/** The single runtime that produces a wired {@link Deliverable} from a spec. */
function build<TIn, TOut>(spec: ServiceSpec): Deliverable<TIn, TOut> {
  if (!spec.name) throw new Error('Service: `name` is required')

  const serviceId = slugify(spec.name)
  const contract = buildContract<TIn, TOut>(spec, serviceId)
  const implementation = buildImplementation(spec, serviceId)
  const dependencies = buildDependencies(spec)

  const promise = contract.outcomeContract.outcome.statement
  const { commercial, offers } = buildCommercial<TOut>(spec, serviceId, promise)

  const offer: OfferOf<TOut> | ReadonlyArray<OfferOf<TOut>> =
    offers.length === 1 ? offers[0] : offers
  // the rung settlement gates at (the primary Offer's gatingBasis).
  const ceiling: PricingBasis = offers[0].gatingBasis
  const metricRef = contract.outcomeContract.outcome.metric.ref
  const assurance = contract.outcomeContract.outcome.metric.verifiability

  const deliverable: Deliverable<TIn, TOut> = {
    kind: 'service-as-software',
    $id: `deliverable:${serviceId}`,
    name: spec.name,
    ...(spec.description !== undefined ? { description: spec.description } : {}),
    contract,
    implementation,
    ...(dependencies !== undefined ? { dependencies } : {}),
    commercial,

    // ── affordances: the one value flows into surfaces #2 and #3 ──
    offer,

    invoke(input: TIn, opts?: OrderOpts) {
      // #2 — open a runtime invocation against the primary Offer. The `run`
      // shorthand becomes a CascadeExecutor that runs DURING the FSM's
      // `DELIVERING` phase (so the handle is returned synchronously at ORDERED,
      // before the first transition). verify / settle keep the in-memory stubs
      // (awaits aip-cnks.5). With no `run`, the stub executor returns no output.
      const run = spec.run
      const executor: CascadeExecutor<TIn, TOut> | undefined = run
        ? { execute: (ctx) => run(ctx.input) as Promise<TOut> }
        : undefined
      const handle = makeLazyHandle<TIn, TOut>({
        offer: offers[0],
        ceiling,
        input,
        metric: metricRef,
        assurance,
        ...(executor !== undefined ? { executor } : { seedOutput: undefined as TOut }),
        ...(opts !== undefined ? { orderOpts: opts } : {}),
      })
      return Promise.resolve(handle)
    },

    async reconcile(desired): Promise<Settled<TOut>> {
      // #2 fire-and-forget: order → settle, no buyer round-trip.
      const handle = await deliverable.invoke(desired.input)
      return reconcileHandle(handle)
    },

    derive(lens: Lens): ResponseEnvelope {
      // #3 pure projection through a lens → the locked wire envelope.
      return DISCOVERY.project(lens, deliverable as Deliverable, DEFAULT_DERIVE_CTX)
    },
  }

  return deliverable
}

// ============================================================================
// Service — the public front door (overloaded: single spec | batch array)
//
// The secondary constructors (`define` / `fromFunction` / `load`) are attached
// as PROPERTIES of the `Service` function (the idiomatic ES-module form), not a
// `namespace`. The callable + its properties are described by the
// {@link ServiceFn} interface so the generic overloads (and `define`'s ceiling
// generic) survive the conversion.
// ============================================================================

/** The overloaded callable + its attached secondary constructors. */
export interface ServiceFn {
  /** The front door. Simple object in, canonical four-layer Deliverable out. */
  <const S extends ServiceSpec>(spec: S & WithinCeiling<S>): DeliverableOf<S>
  /** Batch authoring (à la business-as-code `Goals([...])`). */
  <const S extends ServiceSpec>(specs: readonly S[]): ReadonlyArray<DeliverableOf<S>>

  /** Alias of the single-spec front door. */
  define<const S extends ServiceSpec>(spec: S & WithinCeiling<S>): DeliverableOf<S>
  /**
   * Wrap a bare `(input) => Promise<output>` function as a minimal Deliverable.
   * The param stays `any` (not `unknown`) so authors can hand a NARROWLY-typed
   * function — `(input: { url: string }) => …` — without a contravariant
   * mismatch (the same author-ergonomics reason `ServiceSpec.run` is `any`).
   */
  fromFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- author-facing contravariance
    fn: (input: any) => Promise<any>,
    opts?: Partial<ServiceSpec>
  ): Deliverable
  /** Load a persisted Deliverable by ref (awaits persistence; rejects for now). */
  load(ref: ServiceRef): Promise<Deliverable>
}

function service(spec: ServiceSpec | readonly ServiceSpec[]): unknown {
  if (Array.isArray(spec)) {
    return spec.map((s) => build(s))
  }
  return build(spec as ServiceSpec)
}

/** Alias of the single-spec front door. */
function serviceDefine<const S extends ServiceSpec>(spec: S & WithinCeiling<S>): DeliverableOf<S> {
  return build(spec as ServiceSpec) as DeliverableOf<S>
}

/** Wrap a bare async function as a minimal Deliverable (the `run` shorthand). */
function serviceFromFunction(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- author-facing contravariance
  fn: (input: any) => Promise<any>,
  opts?: Partial<ServiceSpec>
): Deliverable {
  const spec: ServiceSpec = {
    name: opts?.name ?? fn.name ?? 'anonymous-service',
    ...opts,
    run: fn,
  }
  return build(spec)
}

/**
 * Load a persisted Deliverable by {@link ServiceRef}. awaits persistence —
 * the durable store (ai-database read-path) is not wired here; this is the
 * thin view seam the persistence adapter will back. Rejects until then.
 */
function serviceLoad(ref: ServiceRef): Promise<Deliverable> {
  return Promise.reject(
    new Error(`Service.load(${ref}) awaits persistence — durable store adapter not yet wired`)
  )
}

/**
 * The public front door. `Service(spec)` (or `Service([...])`) fans a simple
 * plain object out into a canonical four-layer {@link Deliverable}; the
 * secondary constructors are attached as properties.
 */
export const Service: ServiceFn = Object.assign(service, {
  define: serviceDefine,
  fromFunction: serviceFromFunction,
  load: serviceLoad,
}) as ServiceFn
