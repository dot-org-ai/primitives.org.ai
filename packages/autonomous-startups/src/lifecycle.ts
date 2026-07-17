// =====================================================================================
// lifecycle@1 — the versioned stategraph of an autonomous startup.
//
// v1 REPLACES the old linear, forward-only walk (idea → named → sited → sellable →
// running) with an explicit, versioned STATEGRAPH. The forward build spine is still
// there, but it is now one edge KIND among five:
//
//   advance   idea → named → sited → sellable → running   (build the construct forward)
//   revert    running → sellable → sited → named → idea    (undo the last build step)
//   pivot     {named,sited,sellable,running} → idea         (re-idea, carrying LINEAGE)
//   dissolve  {any live state} → dissolved                  (wind the construct down)
//   rename    {any live state} → itself                     (re-name; identity is kept)
//
// plus a `live` predicate: every state except the terminal `dissolved` is LIVE.
//
// Each edge draws on a distinct competence domain from @org.ai/authority. The gating
// itself lives on the edge functions in ./startup.ts, where each demands an unforgeable
// `Passed` token whose competence domain is pinned to that edge's domain and whose
// principal is pinned to the startup's tenant. Here we only declare the machine, the
// per-edge target, and the domain each edge draws on — at both the type level (for the
// compile-time gate) and the value level (the STATEGRAPH, for runtime inspection).
//
// The version is explicit (`LIFECYCLE_VERSION = 1`): the stategraph is the thing an
// instance lockfile pins, so a future lifecycle@2 is an additive, versioned migration
// rather than a silent reshape.
// =====================================================================================

import type { Domain } from '@org.ai/authority'

/** The lifecycle version this stategraph implements. */
export const LIFECYCLE_VERSION = 1 as const
export type LifecycleVersion = typeof LIFECYCLE_VERSION

/** Every lifecycle state, including the terminal `dissolved`. */
export const LIFECYCLE_STATES = ['idea', 'named', 'sited', 'sellable', 'running', 'dissolved'] as const

/** One state in the lifecycle stategraph. */
export type LifecycleState = (typeof LIFECYCLE_STATES)[number]

/** The states from which the construct is still operable — everything but `dissolved`. */
export const LIVE_STATES = ['idea', 'named', 'sited', 'sellable', 'running'] as const
/** A live (non-terminal) state. `dissolve` and `rename` are legal from exactly these. */
export type LiveState = Exclude<LifecycleState, 'dissolved'>

/** The terminal states. `dissolved` is a sink — no edge leaves it. */
export const TERMINAL_STATES = ['dissolved'] as const
export type TerminalState = 'dissolved'

/** The five edge kinds of lifecycle@1. */
export const EDGE_KINDS = ['advance', 'revert', 'pivot', 'dissolve', 'rename'] as const
export type EdgeKind = (typeof EDGE_KINDS)[number]

// ----- Type-level per-edge targets ----------------------------------------------------

/** States that still have a forward `advance` edge (running/dissolved do not). */
export type AdvanceableState = 'idea' | 'named' | 'sited' | 'sellable'
/** States that have a backward `revert` edge (idea/dissolved do not). */
export type RevertableState = 'named' | 'sited' | 'sellable' | 'running'
/** States a `pivot` (re-idea-with-lineage) may leave — a live state that is already formed. */
export type PivotableState = 'named' | 'sited' | 'sellable' | 'running'

/** The single `advance` successor of a state. */
export type NextOf<S extends LifecycleState> = S extends 'idea'
  ? 'named'
  : S extends 'named'
    ? 'sited'
    : S extends 'sited'
      ? 'sellable'
      : S extends 'sellable'
        ? 'running'
        : never

/** The single `revert` predecessor of a state. */
export type PrevOf<S extends LifecycleState> = S extends 'named'
  ? 'idea'
  : S extends 'sited'
    ? 'named'
    : S extends 'sellable'
      ? 'sited'
      : S extends 'running'
        ? 'sellable'
        : never

// ----- Type-level per-edge competence domains ----------------------------------------

/** The competence domain the forward `advance` out of state `S` draws on. */
export type AdvanceDomainOf<S extends LifecycleState> = S extends 'idea'
  ? 'growth'
  : S extends 'named'
    ? 'product'
    : S extends 'sited'
      ? 'money'
      : S extends 'sellable'
        ? 'delivery'
        : never

/**
 * The competence domain the backward `revert` out of state `S` draws on: the SAME domain
 * as the forward edge that built `S` (reverting `running`→`sellable` un-does the
 * `delivery` step, so it draws on `delivery`). The authority competent to make a step is
 * exactly the authority competent to undo it.
 */
export type RevertDomainOf<S extends RevertableState> = AdvanceDomainOf<PrevOf<S>>

/** `pivot` (re-ideation) draws on the growth doctrine. */
export type PivotDomain = 'growth'
/** `dissolve` (winding down) draws on the legal domain. */
export type DissolveDomain = 'legal'
/** `rename` (identity stewardship) draws on the schema domain. */
export type RenameDomain = 'schema'

// ----- The value-level stategraph -----------------------------------------------------

/** One directed, competence-tagged edge of the lifecycle stategraph. */
export interface LifecycleEdge {
  readonly kind: EdgeKind
  readonly from: LifecycleState
  readonly to: LifecycleState
  readonly domain: Domain
  /** Only `pivot` carries lineage (re-idea-with-lineage). */
  readonly carriesLineage: boolean
}

const advanceEdge = (from: LifecycleState, to: LifecycleState, domain: Domain): LifecycleEdge => ({
  kind: 'advance',
  from,
  to,
  domain,
  carriesLineage: false,
})
const revertEdge = (from: LifecycleState, to: LifecycleState, domain: Domain): LifecycleEdge => ({
  kind: 'revert',
  from,
  to,
  domain,
  carriesLineage: false,
})
const pivotEdge = (from: LifecycleState): LifecycleEdge => ({
  kind: 'pivot',
  from,
  to: 'idea',
  domain: 'growth',
  carriesLineage: true,
})
const dissolveEdge = (from: LifecycleState): LifecycleEdge => ({
  kind: 'dissolve',
  from,
  to: 'dissolved',
  domain: 'legal',
  carriesLineage: false,
})
const renameEdge = (from: LifecycleState): LifecycleEdge => ({
  kind: 'rename',
  from,
  to: from,
  domain: 'schema',
  carriesLineage: false,
})

/** The lifecycle@1 stategraph: every legal edge, competence-tagged. */
export const STATEGRAPH: readonly LifecycleEdge[] = [
  // advance — the forward build spine
  advanceEdge('idea', 'named', 'growth'),
  advanceEdge('named', 'sited', 'product'),
  advanceEdge('sited', 'sellable', 'money'),
  advanceEdge('sellable', 'running', 'delivery'),
  // revert — undo the last build step (same domain as the forward edge)
  revertEdge('named', 'idea', 'growth'),
  revertEdge('sited', 'named', 'product'),
  revertEdge('sellable', 'sited', 'money'),
  revertEdge('running', 'sellable', 'delivery'),
  // pivot — re-idea-with-lineage, from any formed live state
  pivotEdge('named'),
  pivotEdge('sited'),
  pivotEdge('sellable'),
  pivotEdge('running'),
  // dissolve — wind down, from any live state
  dissolveEdge('idea'),
  dissolveEdge('named'),
  dissolveEdge('sited'),
  dissolveEdge('sellable'),
  dissolveEdge('running'),
  // rename — self-edge, from any live state (identity kept)
  renameEdge('idea'),
  renameEdge('named'),
  renameEdge('sited'),
  renameEdge('sellable'),
  renameEdge('running'),
]

/**
 * The forward `advance` domain of each state (`null` where there is no forward edge).
 * Retained as the compact advance-spine view; the full graph is `STATEGRAPH`.
 */
export const TRANSITION_DOMAIN = {
  idea: 'growth',
  named: 'product',
  sited: 'money',
  sellable: 'delivery',
  running: null,
  dissolved: null,
} as const satisfies Record<LifecycleState, Domain | null>

/** The single `advance` successor of each state at runtime (`null` where none). */
export const NEXT_STATE = {
  idea: 'named',
  named: 'sited',
  sited: 'sellable',
  sellable: 'running',
  running: null,
  dissolved: null,
} as const satisfies Record<LifecycleState, LifecycleState | null>

// ----- Runtime queries ----------------------------------------------------------------

/** Whether a state is live (operable) — i.e. anything but the terminal `dissolved`. */
export function isLive(state: LifecycleState): boolean {
  return state !== 'dissolved'
}

/** Every edge leaving `state`, across all edge kinds. */
export function edgesFrom(state: LifecycleState): readonly LifecycleEdge[] {
  return STATEGRAPH.filter((e) => e.from === state)
}

/** The single edge of a given `kind` leaving `state`, or `null` if there is none. */
export function edgeFor(kind: EdgeKind, from: LifecycleState): LifecycleEdge | null {
  return STATEGRAPH.find((e) => e.kind === kind && e.from === from) ?? null
}

/** Whether an edge of `kind` connects `from` → `to`. */
export function canTransition(kind: EdgeKind, from: LifecycleState, to: LifecycleState): boolean {
  return STATEGRAPH.some((e) => e.kind === kind && e.from === from && e.to === to)
}

/** The legal `advance` successors of a state (zero-or-one; the forward spine is linear). */
export function legalNextStates(state: LifecycleState): readonly LifecycleState[] {
  const next = NEXT_STATE[state]
  return next === null ? [] : [next]
}
