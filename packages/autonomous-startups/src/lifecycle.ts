// =====================================================================================
// The lifecycle of an autonomous startup.
//
//   idea → named → sited → sellable → running
//
// The lifecycle is linear and forward-only: each state has exactly one legal successor.
// This axis is about CONSTRUCTION (does it have a name, a site, a priced offer, is it
// operating), distinct from the maturity `stage` carried by the schema.org.ai/Startup
// data noun (idea | validating | building | scaling | established), which the capstone
// projects onto (see ./startup.ts).
//
// Each transition draws on a distinct competence domain from @org.ai/authority. The
// gating itself lives on `advance()` in ./startup.ts, where the transition demands an
// unforgeable `Passed` token whose competence domain is pinned to `DomainOf<From>` and
// whose principal is pinned to the startup's tenant. Here we only declare the machine and
// the domain each step draws on.
// =====================================================================================

import type { Domain } from '@org.ai/authority'

/** The lifecycle states, in order. */
export const LIFECYCLE_STATES = ['idea', 'named', 'sited', 'sellable', 'running'] as const

/** One phase in the construction of an autonomous startup. */
export type LifecycleState = (typeof LIFECYCLE_STATES)[number]

/** A state that still has a legal successor (everything except the terminal `running`). */
export type NonTerminalState = Exclude<LifecycleState, 'running'>

/** The single legal successor of a lifecycle state, at the type level. */
export type NextOf<S extends LifecycleState> = S extends 'idea'
  ? 'named'
  : S extends 'named'
    ? 'sited'
    : S extends 'sited'
      ? 'sellable'
      : S extends 'sellable'
        ? 'running'
        : never

/** The competence domain a transition out of state `S` draws on. */
export type DomainOf<S extends LifecycleState> = S extends 'idea'
  ? 'growth'
  : S extends 'named'
    ? 'product'
    : S extends 'sited'
      ? 'money'
      : S extends 'sellable'
        ? 'delivery'
        : never

/** The single legal successor of each state at runtime (`null` at the terminal state). */
export const NEXT_STATE = {
  idea: 'named',
  named: 'sited',
  sited: 'sellable',
  sellable: 'running',
  running: null,
} as const satisfies Record<LifecycleState, LifecycleState | null>

/** The competence domain each transition draws on at runtime (`null` at the terminal state). */
export const TRANSITION_DOMAIN = {
  idea: 'growth',
  named: 'product',
  sited: 'money',
  sellable: 'delivery',
  running: null,
} as const satisfies Record<LifecycleState, Domain | null>

/** The legal next states of a lifecycle state (zero-or-one, since the machine is linear). */
export function legalNextStates(state: LifecycleState): readonly LifecycleState[] {
  const next = NEXT_STATE[state]
  return next === null ? [] : [next]
}

/** Whether `to` is the legal successor of `from`. */
export function canTransition(from: LifecycleState, to: LifecycleState): boolean {
  return NEXT_STATE[from] === to
}
