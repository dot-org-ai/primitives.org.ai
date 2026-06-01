/**
 * The embeddings socket — the pure, API-free half of the find ladder.
 *
 * This module owns the *modes and transforms* the vector tier of the
 * findOrCreate gate runs in. It deliberately holds no model calls: `embedText`
 * (in `embeddings.ts`) consumes `applyStrategyPrefix` + `postProcess` from here,
 * and `find-or-create.ts`'s collector consumes `cosine`/`computeRRF` to fuse the
 * FTS + vector tiers. The mode vocabulary lines up 1:1 with `find-or-create.ts`'s
 * `GateMode` ('asymmetric-match' | 'symmetric-collapse') via `EmbeddingMode.gateMode`.
 *
 * The TWO modes must NEVER be globally flipped — flipping was a real bug that
 * compressed cosine to ~0.07–0.11:
 *  - MATCH      = asymmetric (query-prefix + bare-doc, NO centering) → retrieval / matching / madlib.
 *  - COLLAPSE   = symmetric-centered (mean-centered) → entity dedup / findOrCreate-collapse @0.93.
 *
 * Research that stays OUT of the primitive (injected via ports in ai-experiments):
 * per-relation InfoNCE rankers and the threshold calibration map.
 *
 * See docs/plans/2026-06-01-strategic-primitives-hardening.md — "embeddings socket".
 *
 * @packageDocumentation
 */

import type { GateMode } from './find-or-create.js'

/** How a value is turned into a vector — the space the vector tier matches in. */
export interface EmbeddingMode {
  /** Embedding model id. Pin/version it so matches don't drift on encoder change. */
  readonly model?: string
  /** Output dimensionality (for models that support truncation, e.g. Matryoshka). */
  readonly dims?: number
  /**
   * Symmetric (query==doc, for dedup) vs asymmetric (distinct query/doc prefixes,
   * for retrieval). `asymmetric-doc` and `asymmetric-query` are the two halves of
   * the asymmetric space.
   */
  readonly strategy: 'symmetric' | 'asymmetric-doc' | 'asymmetric-query'
  /**
   * Post-embed hook applied to the raw vector — e.g. mean-centering for the
   * symmetric-collapse mode. Absent for MATCH (asymmetric never centers).
   */
  readonly postProcess?: (v: number[]) => number[]
  /** Overrides the strategy-derived prefix label (e.g. a model's required prefix). */
  readonly prefixKind?: string
  /** The find-or-create `GateMode` this embedding mode realizes. */
  readonly gateMode: GateMode
}

/**
 * MATCH — asymmetric retrieval mode. Query-prefix + bare-doc, NO centering.
 * Used for relationship resolution (seed/name → other-type node) and the
 * direction-gated madlib query-templates. NEVER mean-centers.
 */
export const MATCH_MODE: EmbeddingMode = {
  strategy: 'asymmetric-query',
  gateMode: 'asymmetric-match',
}

/**
 * COLLAPSE — symmetric, mean-centered dedup mode (the 0.93 gate). Used for
 * same-type entity dedup / findOrCreate-collapse / ICP-emergence. The centering
 * centroid is supplied at call time via `cosine(a, b, { center })`, so this
 * constant carries no fixed centroid.
 */
export const COLLAPSE_MODE: EmbeddingMode = {
  strategy: 'symmetric',
  gateMode: 'symmetric-collapse',
}

/** The strategy-derived prefix label for asymmetric query embeddings. */
const DEFAULT_QUERY_PREFIX = 'query'

/**
 * Apply a mode's strategy prefix to a raw text before embedding.
 *
 * - `symmetric` and `asymmetric-doc` are bare (no prefix) — symmetric needs query
 *   and doc in the same space; the asymmetric *doc* side is intentionally bare.
 * - `asymmetric-query` gets a query marker (`prefixKind` overrides the label).
 *
 * Pure string transform — no model call.
 */
export function applyStrategyPrefix(
  text: string,
  mode: Pick<EmbeddingMode, 'strategy' | 'prefixKind'>
): string {
  if (mode.strategy === 'asymmetric-query') {
    const label = mode.prefixKind ?? DEFAULT_QUERY_PREFIX
    return `${label}: ${text}`
  }
  // symmetric and asymmetric-doc embed the bare text.
  return text
}

/** Subtract a centroid from a vector (mean-centering). */
function center(v: readonly number[], centroid: readonly number[]): number[] {
  return v.map((x, i) => x - (centroid[i] ?? 0))
}

function dot(a: readonly number[], b: readonly number[]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) sum += (a[i] ?? 0) * (b[i] ?? 0)
  return sum
}

function magnitude(v: readonly number[]): number {
  return Math.sqrt(dot(v, v))
}

/**
 * Cosine similarity with optional mean-centering.
 *
 * `opts.center` is the COLLAPSE-mode centroid: both vectors are shifted by it
 * before the angle is measured (symmetric-centered space). Without it, this is
 * plain cosine (the asymmetric MATCH space, which never centers). Returns 0 (not
 * NaN) when either vector has zero magnitude after centering.
 */
export function cosine(
  a: readonly number[],
  b: readonly number[],
  opts?: { center?: readonly number[] }
): number {
  const va = opts?.center ? center(a, opts.center) : a
  const vb = opts?.center ? center(b, opts.center) : b
  const denom = magnitude(va) * magnitude(vb)
  if (denom === 0) return 0
  return dot(va, vb) / denom
}

/** One fused result from reciprocal-rank fusion, best-first. */
export interface RRFResult {
  readonly id: string
  readonly score: number
}

/** Default RRF rank-damping constant (the standard k=60). */
const DEFAULT_RRF_K = 60

/**
 * Reciprocal-rank fusion over several ranked id lists (the FTS + vector hybrid).
 *
 * Each list is best-first; an id's contribution from a list is `1 / (k + rank)`
 * (rank is 1-based). Scores sum across lists, so an id ranked highly in multiple
 * tiers beats one that only appears in a single tier. Larger `k` flattens the
 * contribution gap between ranks. Ties (equal fused score) break by id for
 * determinism / idempotency, matching `find-or-create.ts`'s tie-break policy.
 */
export function computeRRF(lists: ReadonlyArray<readonly string[]>, k: number = DEFAULT_RRF_K): RRFResult[] {
  const scores = new Map<string, number>()
  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank]!
      const contribution = 1 / (k + rank + 1)
      scores.set(id, (scores.get(id) ?? 0) + contribution)
    }
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((p, q) => (q.score !== p.score ? q.score - p.score : p.id < q.id ? -1 : 1))
}

/**
 * A relation's matching regime — the per-relation config the matcher gates on.
 *
 * `fan` (avg distinct true-tails per head, #473): `functional` (fan<3,
 * direction-bearing) vs `fuzzy` (fan≥3, many-to-many). `direction`:
 * `direction-bearing` relations win from the madlib query-template; the
 * `similarity-aligned`/meronymic ones (composedOf, hypernym, holonym) are HURT by
 * it and use bare text. `closedPool` flags a closed reference/enum tail Noun
 * (no-mint → escalate), matching `find-or-create.ts`'s `Evidence.closedPool`.
 */
export interface PredicateSpec {
  readonly rel: string
  readonly dstType: string
  readonly fan: 'functional' | 'fuzzy'
  readonly direction: 'direction-bearing' | 'similarity-aligned'
  readonly madlibQuestion?: string
  readonly closedPool?: boolean
}

/** Input to the direction-gated madlib query builder. */
export interface BuildMatchQueryInput {
  readonly spec: PredicateSpec
  readonly value: string
}

/**
 * Build the MATCH-side query text for a relation, direction-gated.
 *
 * The madlib template (`"What type of company manufactures {name}?"`) is applied
 * ONLY for `direction-bearing` predicates that carry a `madlibQuestion`. For
 * `similarity-aligned` predicates the madlib hurts, so the bare value is used.
 * Falls back to bare text when no template is supplied.
 *
 * Note: this returns the *raw* query text. The strategy prefix
 * (`applyStrategyPrefix`) is applied separately by `embedText` so the prefix is a
 * function of the embedding mode, not the predicate.
 */
export function buildMatchQuery(input: BuildMatchQueryInput): string {
  const { spec, value } = input
  if (spec.direction === 'direction-bearing' && spec.madlibQuestion) {
    return spec.madlibQuestion.replace(/\{name\}/g, value)
  }
  return value
}
