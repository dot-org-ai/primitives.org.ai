/**
 * hypothesis-evidence — the evidence spine of a startup bet (framework primitive).
 *
 * TYPE-ONLY name-claim stub (0.1.0, pre-1.0). Per ADR 0001's fixation gate the
 * four nouns below are markers, not an entrenched contract — they will change
 * without a major bump while the package is 0.x. No runtime, no implementation.
 *
 * The canonical nouns (per constitution annex STRAWMAN-v2):
 * FoundingHypothesis / Experiment / EvidenceScaffold / StageGate.
 *
 * @packageDocumentation
 */

/** The falsifiable bet a startup is founded on. */
export interface FoundingHypothesis {
  readonly id: string
  readonly statement: string
}

/** A test designed to accrue evidence for or against a hypothesis. */
export interface Experiment {
  readonly id: string
  readonly hypothesisId: string
}

/**
 * The structured slot evidence accretes into — proven vs asserted, never fused.
 * Placeholder: the real scaffold carries provenance + strength, not modeled yet.
 */
export interface EvidenceScaffold {
  readonly hypothesisId: string
  readonly experimentIds: readonly string[]
}

/** A threshold a hypothesis must clear (on real evidence) to advance a stage. */
export interface StageGate {
  readonly id: string
  readonly hypothesisId: string
  readonly cleared: boolean
}

/** Package identity marker (lets `import` resolve to a real value in 0.x). */
export const HYPOTHESIS_EVIDENCE_STUB = '0.1.0' as const
