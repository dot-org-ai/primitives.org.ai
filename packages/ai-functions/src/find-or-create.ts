/**
 * The pure findOrCreate gate core.
 *
 * `decide(evidence) → Verdict` is pure, total, and synchronous — the ② data-boundary
 * core from docs/plans/2026-06-01-strategic-primitives-hardening.md. The impure
 * collector resolves the find ladder (exact → FTS → vector, fused) and any LLM
 * ratification, then hands a materialized Evidence value in. This function owns ONLY
 * the decision policy: FIND (link) | CREATE (mint) | ESCALATE (quarantine).
 *
 * Invariants (driven out by test, never weakened):
 *  - never auto-mint on uncertainty (marginal band → quarantine)
 *  - fail safe on a null/uncalibrated band (→ quarantine, never accept)
 *  - deterministic: same Evidence → same Verdict (tie-break is total-ordered)
 */

/** Which embedding space the vector tier of the find ladder ran in. */
export type GateMode = 'asymmetric-match' | 'symmetric-collapse'

/** One ranked candidate from the find ladder (exact ∪ FTS ∪ vector, fused). */
export interface GateCandidate {
  readonly id: string
  /** Fused score in [0,1], best-first. */
  readonly score: number
  /** True when this candidate came from an exact/normalized-key match (no vector). */
  readonly exact: boolean
}

/** Per-Noun calibrated bands. `null` (uncalibrated) → the core fails safe to escalate. */
export interface ThresholdBand {
  readonly autoLink: number
  readonly judgeFloor: number
}

/** The materialized decision input. Every field is a value, never a callback. */
export interface Evidence {
  readonly mode: GateMode
  /** Ranked candidates, best-first. Empty = greenfield. */
  readonly candidates: readonly GateCandidate[]
  /** Calibrated band, or null when uncalibrated. */
  readonly band: ThresholdBand | null
  /** LLM ratification over the marginal band, or null when not run/unavailable. */
  readonly ratification: { readonly accept: boolean; readonly confidence: number } | null
  /** Closed reference/enum Noun → never mint (escalate instead). */
  readonly closedPool?: boolean
}

export type Verdict =
  | { readonly kind: 'link'; readonly canonical: string; readonly mechanism: string; readonly confidence: number }
  | { readonly kind: 'mint'; readonly mechanism: string; readonly confidence: number }
  | { readonly kind: 'quarantine'; readonly mechanism: string; readonly confidence: number; readonly reason: string }

/** Best fused candidate; ties broken deterministically by id (idempotency). */
function topCandidate(candidates: readonly GateCandidate[]): GateCandidate {
  return candidates.reduce((best, c) =>
    c.score > best.score || (c.score === best.score && c.id < best.id) ? c : best
  )
}

export function decide(evidence: Evidence): Verdict {
  const { candidates, band, ratification, closedPool } = evidence

  // A CREATE outcome into a closed reference/enum Noun is never allowed — an
  // off-rail name escalates rather than minting a spurious member.
  const mint = (mechanism: string, confidence: number): Verdict =>
    closedPool
      ? { kind: 'quarantine', mechanism: 'closed-pool', confidence, reason: 'no match in a closed pool' }
      : { kind: 'mint', mechanism, confidence }

  if (candidates.length === 0) {
    return mint('greenfield', 0)
  }

  // Cheapest tier: an exact/normalized-key match short-circuits the ladder.
  const exact = candidates.find((c) => c.exact)
  if (exact) {
    return { kind: 'link', canonical: exact.id, mechanism: 'exact', confidence: exact.score }
  }

  // Fail safe: an uncalibrated band must never accept a fuzzy match.
  if (band === null) {
    return { kind: 'quarantine', mechanism: 'no-calibrated-band', confidence: 0, reason: 'uncalibrated band' }
  }

  const top = topCandidate(candidates)

  if (top.score >= band.autoLink) {
    return { kind: 'link', canonical: top.id, mechanism: 'auto-link', confidence: top.score }
  }
  if (top.score >= band.judgeFloor) {
    if (ratification === null) {
      return {
        kind: 'quarantine',
        mechanism: 'adjudicator-unavailable',
        confidence: top.score,
        reason: `judge band (sim=${top.score}) but no ratifier available`,
      }
    }
    return ratification.accept
      ? { kind: 'link', canonical: top.id, mechanism: 'ratify', confidence: ratification.confidence }
      : mint('ratify-reject', top.score)
  }
  return mint('below-floor', top.score)
}

/** What the caller hands the collector: the thing to resolve + its Noun/mode. */
export interface ResolveInput {
  readonly text: string
  readonly key?: string
  readonly noun: string
  readonly mode: GateMode
  readonly closedPool?: boolean
}

/**
 * The injected ports the collector drives — the find ladder + the ratifier +
 * the calibrated bands. In-memory fakes make `collect` unit-testable with no DB,
 * no embeddings, no LLM. `ratify` is optional — its absence is "no ratifier
 * available," which the gate treats as a fail-safe escalation.
 */
export interface FindPorts {
  exact(input: ResolveInput): Promise<GateCandidate | null>
  lexical(input: ResolveInput): Promise<readonly GateCandidate[]>
  vector(input: ResolveInput): Promise<readonly GateCandidate[]>
  ratify?(input: ResolveInput, candidate: GateCandidate): Promise<{ accept: boolean; confidence: number }>
  thresholds(noun: string): ThresholdBand | null
}

/**
 * Run the find ladder (exact → FTS → vector, fused) + ratifier and materialize
 * an Evidence value for `decide`. Cheap tiers short-circuit: an exact hit never
 * touches the vector tier; the ratifier runs only when the fused top lands in
 * the judge band.
 */
export async function collect(input: ResolveInput, ports: FindPorts): Promise<Evidence> {
  const band = ports.thresholds(input.noun)

  // Cheapest tier first: an exact hit short-circuits — no FTS, no embed/ANN.
  const exact = await ports.exact(input)
  if (exact) {
    return { mode: input.mode, candidates: [exact], band, ratification: null, closedPool: input.closedPool ?? false }
  }

  // Lexical (FTS) + vector (embed+ANN); fuse by id, best score wins.
  const [lexical, vector] = await Promise.all([ports.lexical(input), ports.vector(input)])
  const byId = new Map<string, GateCandidate>()
  for (const c of [...lexical, ...vector]) {
    const prev = byId.get(c.id)
    if (!prev || c.score > prev.score) byId.set(c.id, c)
  }
  const candidates = [...byId.values()]
  let evidence: Evidence = { mode: input.mode, candidates, band, ratification: null, closedPool: input.closedPool ?? false }

  // Expensive tier last: run the ratifier ONLY when the gate would otherwise
  // escalate solely for lack of one — i.e. the fused top sits in the judge band.
  // Reusing `decide` here avoids duplicating the band logic in the collector.
  if (ports.ratify && candidates.length > 0) {
    const dry = decide(evidence)
    if (dry.kind === 'quarantine' && dry.mechanism === 'adjudicator-unavailable') {
      const ratification = await ports.ratify(input, topCandidate(candidates))
      evidence = { ...evidence, ratification }
    }
  }

  return evidence
}
