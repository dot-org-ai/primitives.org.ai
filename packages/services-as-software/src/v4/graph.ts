/**
 * services-as-software v4 — the graph DISCOVERY surface (aip-cnks.7.5).
 *
 * The TYPE surface for discovery (the {@link Lens} union, {@link LensCtx},
 * {@link Match}, {@link Discovery}, and the locked {@link ResponseEnvelope})
 * lives in `./types.ts`. This module is the *values* that make those types
 * usable — the discovery RUNTIME:
 *
 *   1. {@link envelope} / {@link project} — the ResponseEnvelope PROJECTOR. A
 *      pure serialization of a `Deliverable`/`Offer` node + its edges into the
 *      design-locked wire shape: out-edges → `relationships`, in-edges →
 *      `references`, the available FSM transitions → `actions`, the typed payload
 *      under its `[typedKey]`, plus `api`/`$context`/`$type`/`$id`/`links`/
 *      `options`/`meta`/`user`.
 *   2. `derive.<lens>` — a lens-keyed map of pure projections over the SAME node.
 *      `marketplace` vs `holdco` differ ONLY by a visibility predicate (the
 *      private/builder-only fields a public viewer must not see). `listing` is a
 *      PROJECTION (representative vs concrete via {@link LensCtx.representative}),
 *      never a stored noun (ADR-0011 §2).
 *   3. {@link makeDiscovery} — a `Discovery` factory. `match` is the match-or-mint
 *      surface; the real pgvector ANN + ratify lives in `ai-database` and is
 *      INJECTED as a {@link Matcher} port (embed + nearest + ratify), defaulting
 *      to an in-memory stub. The match DECISION (link | mint | quarantine) is the
 *      shared `find-or-create` gate core — `decide()` from `ai-functions/find-or-create`
 *      — so `match` never auto-mints on uncertainty: a ratify-reject, a closed-pool
 *      miss, or a `generation:'review'` Demand ESCALATES (no stub minted). `resolve`
 *      is the Outcome→Problem (+ bound Metric) traversal.
 *
 * **What is real here vs. what awaits ai-database.** The projector + lenses are
 * pure data — fully implemented. `match`'s pgvector ANN is the one INJECTED seam:
 * the default {@link inMemoryMatcher} does a deterministic substring/overlap
 * score over a seeded Offer pool so the match-or-mint contract (ratified hit →
 * reused Offer; open-pool miss → minted stub; uncertainty → escalate) is
 * exercisable end-to-end in tests. The DECISION runs through the shared
 * `find-or-create` gate (`decide()`); only the embeddings/ANN/ratifier are
 * injected. Replace {@link inMemoryMatcher} with the real `ai-database` ANN port
 * when that lands.
 *
 * @packageDocumentation
 */

import type { Offer } from 'business-as-code'
import { decide } from 'ai-functions/find-or-create'
import type { Evidence, GateCandidate, ThresholdBand } from 'ai-functions/find-or-create'

import { VALID_TRANSITIONS } from './invoke.js'
import type {
  Deliverable,
  Demand,
  Discovery,
  InvocationState,
  Lens,
  LensCtx,
  Match,
  MatchOpts,
  MetricRef,
  OfferOf,
  Outcome,
  ProblemRef,
  ResponseEnvelope,
} from './types.js'

// ============================================================================
// The locked `api` block + a few wire constants
// ============================================================================

/**
 * The `api` block on every {@link ResponseEnvelope} this package emits. The
 * five golden fixtures (startup-builder) lock this shape; the `version` tracks
 * the discovery surface, not the package.
 */
export const ENVELOPE_API = {
  name: 'services-as-software',
  docs: 'https://schema.org.ai/services-as-software',
  version: 'v4',
  home: 'https://schema.org.ai/',
} as const

/** The `$context` every node carries (MDXLD — the `$`-prefixed JSON-LD superset). */
const ENVELOPE_CONTEXT = 'https://schema.org.ai/'

/** The default `user` block — a request-scoped echo the edge fills in. */
function defaultUser(ctx: LensCtx): ResponseEnvelope['user'] {
  return { requestId: `req:${ctx.audience}`, edgeLocation: 'local' }
}

// ============================================================================
// Node discriminant — the projector accepts either layer of the one value
// ============================================================================

/** True iff `root` is a four-layer {@link Deliverable} (not a bare {@link Offer}). */
function isDeliverable(root: Offer | Deliverable): root is Deliverable {
  return (root as Deliverable).kind !== undefined && (root as Deliverable).contract !== undefined
}

/** Resolve the canonical {@link Offer} a node carries (the bare Offer, or a Deliverable's). */
function offerOf(root: Offer | Deliverable): Offer {
  if (!isDeliverable(root)) return root
  const o = root.offer
  return (Array.isArray(o) ? o[0] : o) as Offer
}

/** The MDXLD `$id` of a node (`$id` on an Offer; `$id` on a Deliverable). */
function nodeId(root: Offer | Deliverable): string {
  return isDeliverable(root) ? root.$id : root.$id
}

/** The MDXLD `$type` of a node. */
function nodeType(root: Offer | Deliverable): string {
  return isDeliverable(root) ? 'Deliverable' : 'Offer'
}

/** The typed-payload key the node rides under (the `[typedKey]` index slot). */
function typedKeyOf(root: Offer | Deliverable): string {
  return isDeliverable(root) ? 'deliverable' : 'offer'
}

// ============================================================================
// Edges — out-edges (relationships) + in-edges (references)
// ============================================================================

/**
 * The out-edges of a node → the locked `relationships` map. An Offer points at
 * its `itemOffered` (the G1 abstract Service category) and, when present, its
 * `seller`. A Deliverable additionally points at the sub-Deliverables it
 * `composes` and the Offer it is sold as.
 */
function outEdges(root: Offer | Deliverable): Record<string, string | object> {
  const rel: Record<string, string | object> = {}
  const offer = offerOf(root)
  // every node offers/wraps a G1 Service category noun.
  rel['itemOffered'] = `${offer.itemOffered.$type}/${offer.itemOffered.$id}`
  if (offer.seller) rel['seller'] = offer.seller

  if (isDeliverable(root)) {
    rel['offer'] = `Offer/${offer.$id}`
    const composes = root.dependencies?.composes ?? []
    if (composes.length > 0) {
      rel['composes'] = composes.map((d) => `Deliverable/${d.$id}`)
    }
    const outcome = root.contract.outcomeContract.outcome
    rel['outcome'] = `Outcome/${outcome.id}`
    if (outcome.resolves) rel['resolves'] = `Problem/${outcome.resolves}`
  }
  return rel
}

/**
 * The in-edges of a node → the locked `references` block. These are the nodes
 * that point AT this one: the Demands seeking its Service, and (for a bare
 * Offer) the Deliverable that produces it. In-edges are supplied by the caller
 * (the graph read-path); absent any, the block is omitted.
 */
function inEdges(
  refs: ReadonlyArray<{ $type: string; $id: string; predicate: string }>
): ResponseEnvelope['references'] | undefined {
  if (refs.length === 0) return undefined
  return { total: refs.length, items: refs }
}

// ============================================================================
// Actions — the FSM transitions available from this node
// ============================================================================

/**
 * The `actions` map = the FSM transitions available from this node. A
 * not-yet-ordered discovery node sits at `ORDERED`'s precursor: the only action
 * is to `order` (open an invocation). Once an invocation exists the caller
 * passes its current {@link InvocationState} and the available transitions are
 * read straight off {@link VALID_TRANSITIONS} (the single source of truth the
 * runtime guards on).
 */
function actionsFor(state: InvocationState | undefined): Record<string, string> {
  if (state === undefined) {
    // a discovery node (no live invocation) → the one affordance is to order.
    return { order: 'invoke()' }
  }
  const actions: Record<string, string> = {}
  for (const to of VALID_TRANSITIONS[state]) {
    actions[to.toLowerCase()] = `→ ${to}`
  }
  return actions
}

// ============================================================================
// The ResponseEnvelope PROJECTOR
// ============================================================================

/** Options that tune {@link envelope} — the edges + (optional) live FSM state. */
export interface EnvelopeOpts {
  /** In-edges (nodes that reference this one). Default: none. */
  references?: ReadonlyArray<{ $type: string; $id: string; predicate: string }>
  /** The live invocation state, if any — drives the `actions` map. */
  state?: InvocationState
  /** Lens context (audience/visibility) — drives `meta.scopes` + the `user` echo. */
  ctx?: LensCtx
  /** Extra `links` to merge over the derived defaults. */
  links?: Record<string, string>
  /** Extra `options` (e.g. lens variants the caller may switch to). */
  options?: Record<string, string>
}

const DEFAULT_CTX: LensCtx = { audience: 'public', visibility: 'public' }

/**
 * Serialize a node + its edges into the design-locked {@link ResponseEnvelope}.
 *
 * Pure data: out-edges → `relationships`, in-edges → `references`, the available
 * FSM transitions → `actions`, the node payload under its `[typedKey]`. The
 * `api`/`$context`/`links`/`options`/`meta`/`user` blocks are filled from the
 * node + the {@link LensCtx}. No I/O, no LLM — same input always yields the same
 * envelope.
 */
export function envelope(node: Offer | Deliverable, opts: EnvelopeOpts = {}): ResponseEnvelope {
  const ctx = opts.ctx ?? DEFAULT_CTX
  const id = nodeId(node)
  const $type = nodeType(node)
  const key = typedKeyOf(node)

  const env: ResponseEnvelope = {
    api: { ...ENVELOPE_API },
    $context: ENVELOPE_CONTEXT,
    $type,
    $id: id,
    links: { self: `${$type}/${id}`, ...opts.links },
    actions: actionsFor(opts.state),
    options: { ...opts.options },
    relationships: outEdges(node),
    meta: { level: ctx.visibility, scopes: [ctx.audience] },
    user: defaultUser(ctx),
    // the typed payload rides under its discriminant key.
    [key]: node,
  }
  const refs = inEdges(opts.references ?? [])
  if (refs) env.references = refs
  return env
}

// ============================================================================
// Lens projections — pure, lens-filtered views over the same node
// ============================================================================

/**
 * Fields a public viewer must NOT see — the private / builder-only slots a
 * Deliverable carries (the seller's internal implementation, the cost basis,
 * the raw Function bindings). The `holdco` lens (the owner's god-view) keeps
 * them; every public lens (`marketplace`/`catalog`/`listing`/…) drops them.
 * This is the one predicate that distinguishes `marketplace` from `holdco`.
 */
const BUILDER_ONLY_RELATIONSHIPS: ReadonlySet<string> = new Set(['composes', 'seller', 'outcome'])

/** True iff the lens/ctx is allowed to see builder-only (private) fields. */
function seesPrivate(lens: Lens, ctx: LensCtx): boolean {
  return lens === 'holdco' || ctx.audience === 'holdco' || ctx.visibility === 'private'
}

/**
 * Strip the builder-only relationships from an envelope unless the viewer is
 * the holdco. Pure — returns a new envelope; never mutates its argument.
 */
function applyVisibility(env: ResponseEnvelope, lens: Lens, ctx: LensCtx): ResponseEnvelope {
  if (seesPrivate(lens, ctx)) return env
  const relationships: Record<string, string | object> = {}
  for (const [k, v] of Object.entries(env.relationships)) {
    if (!BUILDER_ONLY_RELATIONSHIPS.has(k)) relationships[k] = v
  }
  return { ...env, relationships }
}

/**
 * The Listing projection. A Listing is NOT a stored noun (ADR-0011 §2) — it is
 * the published, lens-filtered projection of an Offer. `representative` (the
 * abstract category Offer) vs concrete (a live seller's Offer) is selected
 * purely by {@link LensCtx.representative}; the same node projects to either.
 */
function listingProjection(
  node: Offer | Deliverable,
  ctx: LensCtx,
  env: ResponseEnvelope
): ResponseEnvelope {
  const representative = ctx.representative ?? false
  const offer = offerOf(node)
  return {
    ...env,
    options: {
      ...env.options,
      kind: representative ? 'representative' : 'concrete',
    },
    listing: {
      kind: representative ? 'representative' : 'concrete',
      // a representative Listing hides the concrete seller (it stands for the
      // category, not a live storefront); a concrete Listing names the seller.
      seller: representative ? undefined : offer.seller,
      promise: offer.promise,
      gatingBasis: offer.gatingBasis,
      priceSpecification: offer.priceSpecification,
    },
  }
}

// ============================================================================
// makeDiscovery — the Discovery factory + injected ports
// ============================================================================

/**
 * The match-or-mint port — the pgvector ANN seam.
 *
 * injected — ai-database. The real port embeds the {@link Demand}, runs a
 * pgvector approximate-nearest-neighbour search over the Offer index, and
 * ratifies the top hit. The default {@link inMemoryMatcher} scores a seeded
 * Offer pool with a deterministic token-overlap heuristic so the match-or-mint
 * contract is exercisable without ai-database.
 */
export interface Matcher {
  /** Embed + nearest: return the best Offer for `demand` with its similarity score. */
  nearest(demand: Demand): Promise<{ offer: Offer; score: number } | null>
  /** Ratify a candidate (the `manual`/`auto` gate) — does this Offer truly clear? */
  ratify(demand: Demand, candidate: Offer, mode: 'auto' | 'manual'): Promise<boolean>
}

/** Ports a {@link makeDiscovery} consumer may inject (all default to in-memory stubs). */
export interface DiscoveryPorts {
  /** The match-or-mint ANN port (default: {@link inMemoryMatcher} over `offers`). */
  matcher?: Matcher
  /** A seed Offer pool the default matcher searches (ignored if `matcher` is set). */
  offers?: ReadonlyArray<Offer>
}

/** The default similarity threshold a hit must clear to count as a match. */
const DEFAULT_THRESHOLD = 0.5

/** Tokenize a string into a lowercased word set (for the stub overlap score). */
function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  )
}

/**
 * Overlap-coefficient of two token sets ∈ [0, 1] — the stub similarity metric.
 * Intersection over the SMALLER set (not Jaccard): a short, well-covered Demand
 * fully subsumed by a richer Offer scores high, which is the behaviour a real
 * ANN over embeddings approximates (the Demand's terms are all present). The
 * real pgvector cosine similarity replaces this — injected, ai-database.
 */
function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  const smaller = Math.min(a.size, b.size)
  return smaller === 0 ? 0 : inter / smaller
}

/**
 * The default in-memory {@link Matcher} — a deterministic stand-in for the
 * ai-database pgvector ANN. `nearest` scores the seed pool by token overlap
 * between the Demand's `seeks`/`problem`/acceptance and each Offer's
 * `itemOffered`/`name`/`promise`; `ratify` accepts any candidate that named the
 * sought Service (auto) or unconditionally (manual is a human gate, stubbed
 * here as a pass-through). injected — ai-database supplies the real ANN.
 */
export function inMemoryMatcher(offers: ReadonlyArray<Offer>): Matcher {
  return {
    async nearest(demand: Demand): Promise<{ offer: Offer; score: number } | null> {
      const demandTokens = tokens(
        [demand.seeks, demand.problem ?? '', demand.acceptance?.metric ?? ''].join(' ')
      )
      let best: { offer: Offer; score: number } | null = null
      for (const offer of offers) {
        const offerTokens = tokens(
          [offer.itemOffered.$id, offer.name, offer.promise ?? ''].join(' ')
        )
        const score = overlap(demandTokens, offerTokens)
        if (best === null || score > best.score) best = { offer, score }
      }
      return best
    },
    async ratify(demand: Demand, candidate: Offer, mode: 'auto' | 'manual'): Promise<boolean> {
      // injected — ai-database runs the real ratify (a verifiable Metric check
      // or a human review). The stub auto-ratifies when the candidate offers the
      // sought Service; `manual` is a pass-through (a human would gate it).
      if (mode === 'manual') return true
      return candidate.itemOffered.$id === demand.seeks
    },
  }
}

/**
 * Mint a stub {@link Offer} for a Demand nothing cleared — the "or-mint" half of
 * match-or-mint. The minted Offer is a free `access`-gated placeholder bound to
 * the sought Service; a real population engine (explore, closed per ADR-0011 §5)
 * would later flesh it out.
 */
function mintOffer(demand: Demand): Offer {
  return {
    $type: 'Offer',
    $id: `offer:minted:${demand.seeks}`,
    name: `Minted offer for ${demand.seeks}`,
    itemOffered: { $type: 'Service', $id: demand.seeks },
    gatingBasis: 'access',
    priceSpecification: { structure: 'SinglePrice', price: { amount: 0n, currency: 'USD' } },
    fundingSource: { source: 'direct' },
  }
}

/**
 * Build a {@link Discovery} — the discovery surface (#3) over the one Deliverable
 * value. Ports default to in-memory stubs (the pgvector ANN is the injected
 * seam); the projector + lenses are pure data.
 */
export function makeDiscovery(ports: DiscoveryPorts = {}): Discovery {
  const matcher = ports.matcher ?? inMemoryMatcher(ports.offers ?? [])

  /** The generic projector — node + lens-context → the locked envelope (visibility-filtered). */
  function project(lens: Lens, root: Offer | Deliverable, ctx: LensCtx): ResponseEnvelope {
    const base = envelope(root, { ctx, options: { lens } })
    const visible = applyVisibility(base, lens, ctx)
    if (lens === 'listing') return listingProjection(root, ctx, visible)
    return visible
  }

  /** One pure lens projection bound to a {@link Lens}. */
  const lensProjector =
    (lens: Lens) =>
    (offer: Offer, ctx: LensCtx): ResponseEnvelope =>
      project(lens, offer, ctx)

  const derive: Discovery['derive'] = {
    catalog: lensProjector('catalog'),
    listing: lensProjector('listing'),
    marketplace: lensProjector('marketplace'),
    order: lensProjector('order'),
    delivery: lensProjector('delivery'),
    portal: lensProjector('portal'),
    holdco: lensProjector('holdco'),
  }

  async function match<TOut>(demand: Demand, opts: MatchOpts = {}): Promise<Match<TOut>> {
    const threshold = opts.threshold ?? DEFAULT_THRESHOLD
    const mode = opts.ratify ?? 'auto'

    // A Demand explicitly flagged for review is a HITL escalation regardless of
    // any candidate's score — the gate never auto-resolves a review-flagged
    // Demand. This is the `$generation:'review'` signal (ADR-0011 §5 cascade).
    if (opts.generation === 'review') {
      return {
        offer: null,
        score: 0,
        ratified: false,
        minted: false,
        escalated: true,
        reason: 'generation-review',
      }
    }

    // injected — ai-database: embed(demand) → pgvector nearest → top candidate.
    const hit = await matcher.nearest(demand)

    // Materialize the ranked candidate(s) for the gate. A pgvector ANN hit is a
    // FUZZY match (never an exact/normalized-key hit), so `exact: false`.
    const candidates: GateCandidate[] = hit
      ? [{ id: hit.offer.$id, score: hit.score, exact: false }]
      : []

    // The calibrated band. The single `threshold` becomes the `judgeFloor`: every
    // hit at/above it lands in the ratify band (so the injected `ratify` port
    // still gates each reuse), and `autoLink` is set unreachable (>1) so the gate
    // never auto-links without ratifying. This preserves the prior contract
    // (a hit clears ONLY if the ratifier accepts) while the DECISION moves to
    // `decide`. The real per-Noun calibrated bands replace this — injected.
    const band: ThresholdBand = { autoLink: Number.POSITIVE_INFINITY, judgeFloor: threshold }

    // Run the injected ratifier ONLY when a candidate lands in the judge band —
    // i.e. it cleared the floor (mirrors `collect`'s expensive-tier-last rule).
    let ratification: Evidence['ratification'] = null
    if (hit && hit.score >= threshold) {
      const accept = await matcher.ratify(demand, hit.offer, mode)
      ratification = { accept, confidence: hit.score }
    }

    const evidence: Evidence = {
      mode: 'asymmetric-match',
      candidates,
      band,
      ratification,
      closedPool: opts.closedPool ?? false,
    }

    const verdict = decide(evidence)

    if (verdict.kind === 'link') {
      // reuse the existing Offer (the gate LINKED to a canonical candidate).
      return {
        offer: hit!.offer as OfferOf<TOut>,
        score: hit?.score ?? verdict.confidence,
        ratified: true,
        minted: false,
      }
    }

    // A `mint` on `ratify-reject` is NOT a greenfield mint: a STRONG candidate
    // that the ratifier rejected is the marginal/uncertain band — minting a stub
    // there would be the "auto-mint on uncertainty" this wiring exists to
    // prevent. Escalate it to a human (HITL) instead. Genuine greenfield /
    // below-floor / empty-pool mints (nothing strong to reuse) still mint a stub.
    if (verdict.kind === 'mint' && verdict.mechanism === 'ratify-reject') {
      return {
        offer: null,
        score: hit?.score ?? 0,
        ratified: false,
        minted: false,
        escalated: true,
        reason: verdict.mechanism,
      }
    }

    if (verdict.kind === 'mint') {
      // or-mint: nothing strong to reuse, pool is open → mint a stub Offer.
      return {
        offer: mintOffer(demand) as OfferOf<TOut>,
        score: hit?.score ?? 0,
        ratified: false,
        minted: true,
      }
    }

    // quarantine → ESCALATE: the gate refused (an uncalibrated band, an
    // adjudicator-unavailable judge band, or a closed-pool miss). NO stub is
    // minted — a human (HITL) decides.
    return {
      offer: null,
      score: hit?.score ?? 0,
      ratified: false,
      minted: false,
      escalated: true,
      reason: verdict.reason,
    }
  }

  function resolve(outcome: Outcome): { problem: ProblemRef; metric: MetricRef } {
    // Outcome→Problem traversal: the Outcome is the positive mirror of a Problem,
    // and carries the bound acceptance Metric. When the Outcome does not name the
    // Problem it resolves, fall back to a derived problem ref over its id.
    const problem: ProblemRef = outcome.resolves ?? (`problem:${outcome.id}` as ProblemRef)
    return { problem, metric: outcome.metric.ref }
  }

  return { match, derive, project, resolve }
}

// ============================================================================
// A default Discovery (no seeded pool) — convenient for the pure surfaces
// ============================================================================

/** A zero-config {@link Discovery} (empty Offer pool; `match` always mints). */
export const discovery: Discovery = makeDiscovery()
