/**
 * ProofPredicate — composable predicates that gate outcome-based settlement.
 *
 * Stripe's MPP Sessions ship escrow but no outcome-predicate-driven release —
 * this module is the gap-filler. SaS's Service.outcomeContract.predicate
 * uses these to express "definition of done."
 *
 * Six leaf predicates + AND/OR composition:
 *   - schema-match     : output matches schema
 *   - evaluator-pass   : EvaluatorPanel approves at threshold
 *   - human-sign       : human with signerRoles signs
 *   - external         : external verifier (e.g. github CI + merged) approves
 *   - load-bearing-pass: a named subset of rubric items all pass (sb killThreshold)
 *   - overall-floor    : N of total rubric items pass (sb killThreshold)
 */

export type ProofPredicate =
  | { kind: 'schema-match'; schema: unknown }
  | {
      kind: 'evaluator-pass'
      panelRef: string | 'self'
      minScore: number | 'all-approved' | 'majority'
    }
  | { kind: 'human-sign'; signerRoles: string[]; when?: string }
  | { kind: 'external'; verifier: string; spec: unknown }
  | { kind: 'load-bearing-pass'; itemSet: string[] }
  | { kind: 'overall-floor'; minPasses: number; outOfTotal: number }
  | { kind: 'and'; predicates: ProofPredicate[] }
  | { kind: 'or'; predicates: ProofPredicate[] }

export const SchemaMatch = (schema: unknown): ProofPredicate => ({
  kind: 'schema-match',
  schema,
})

export const EvaluatorPass = (opts: {
  panelRef: string | 'self'
  minScore: number | 'all-approved' | 'majority'
}): ProofPredicate => ({
  kind: 'evaluator-pass',
  panelRef: opts.panelRef,
  minScore: opts.minScore,
})

export const HumanSign = (opts: { signerRoles: string[]; when?: string }): ProofPredicate => {
  if (opts.when !== undefined) {
    return { kind: 'human-sign', signerRoles: opts.signerRoles, when: opts.when }
  }
  return { kind: 'human-sign', signerRoles: opts.signerRoles }
}

export const External = (opts: { verifier: string; spec: unknown }): ProofPredicate => ({
  kind: 'external',
  verifier: opts.verifier,
  spec: opts.spec,
})

export const LoadBearingPass = (itemSet: string[]): ProofPredicate => ({
  kind: 'load-bearing-pass',
  itemSet,
})

export const OverallFloor = (opts: { minPasses: number; outOfTotal: number }): ProofPredicate => ({
  kind: 'overall-floor',
  minPasses: opts.minPasses,
  outOfTotal: opts.outOfTotal,
})

export const AND = (...predicates: ProofPredicate[]): ProofPredicate => ({
  kind: 'and',
  predicates,
})

export const OR = (...predicates: ProofPredicate[]): ProofPredicate => ({
  kind: 'or',
  predicates,
})
