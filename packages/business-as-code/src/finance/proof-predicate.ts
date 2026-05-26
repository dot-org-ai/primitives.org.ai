/**
 * ProofPredicate — composable predicates that gate outcome-based settlement.
 *
 * Stripe's MPP Sessions ship escrow but no outcome-predicate-driven release —
 * this module is the gap-filler. SaS's Service.outcomeContract.predicate
 * uses these to express "definition of done."
 *
 * Seven leaf predicates + AND/OR composition:
 *   - schema-match            : output matches schema
 *   - evaluator-pass          : EvaluatorPanel approves at threshold
 *   - human-sign              : human with signerRoles signs
 *   - external                : external verifier (e.g. github CI + merged) approves
 *   - load-bearing-pass       : a named subset of rubric items all pass (sb killThreshold)
 *   - overall-floor           : N of total rubric items pass (sb killThreshold)
 *   - unmet-requirements-pass : no `severity: 'blocking'` UnmetRequirements remain
 *                               (sb-n7d open-blocking gate); when `categories` is
 *                               supplied, only those categories are checked.
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
  | { kind: 'unmet-requirements-pass'; categories?: string[] }
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

/**
 * `UnmetRequirementsPass` — sb-n7d's open-blocking gate as a first-class
 * predicate.
 *
 * Passes iff no `severity: 'blocking'` UnmetRequirement is present in the
 * verify-time evaluation context. `severity: 'warning'` items are ignored.
 *
 * When `categories` is supplied, only requirements whose `category` matches
 * one of the listed values are considered (others are ignored regardless of
 * severity). When omitted, ALL categories are inspected.
 *
 * @example
 *   // Any blocking unmet requirement fails the predicate.
 *   UnmetRequirementsPass()
 *
 *   // Only blocking items in the 'compliance' or 'security' buckets fail.
 *   UnmetRequirementsPass({ categories: ['compliance', 'security'] })
 */
export const UnmetRequirementsPass = (opts?: { categories?: string[] }): ProofPredicate => {
  if (opts?.categories !== undefined) {
    return { kind: 'unmet-requirements-pass', categories: opts.categories }
  }
  return { kind: 'unmet-requirements-pass' }
}

export const AND = (...predicates: ProofPredicate[]): ProofPredicate => ({
  kind: 'and',
  predicates,
})

export const OR = (...predicates: ProofPredicate[]): ProofPredicate => ({
  kind: 'or',
  predicates,
})
