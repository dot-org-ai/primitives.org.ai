/**
 * Track Record + Agent Mode + Promotion Policy (v3 §6 — Function-as-typed-primitive)
 *
 * Earned-autonomy primitives shared across `digital-tools` Function refs and
 * (later) `digital-workers`. A Function or Worker accumulates a {@link TrackRecord}
 * over time; a {@link PromotionPolicy} declares the threshold rules that move a
 * Function up or down the {@link AgentMode} ladder (manual → supervised →
 * autonomous, and back).
 *
 * These types live in `digital-tools` because the Function discriminated union
 * is the first consumer; `digital-workers` re-exports the same types when it
 * lands so per-Worker autonomy and per-Function autonomy use one vocabulary.
 *
 * @packageDocumentation
 */

import type { Money } from 'autonomous-finance'

/**
 * Operating mode of an agentic Function (or Worker).
 *
 * - `manual`     — every invocation requires a human to initiate.
 * - `supervised` — runs autonomously but every output is reviewed before
 *                  being released downstream (gated on human sign-off).
 * - `autonomous` — runs and releases without per-invocation review;
 *                  oversight is post-hoc and sample-based.
 */
export type AgentMode = 'manual' | 'supervised' | 'autonomous'

/**
 * Direction of the most recent measured trend in a {@link TrackRecord}.
 */
export type TrendDirection = 'improving' | 'stable' | 'declining'

/**
 * Quality + cost + oversight signal accumulated over a Function or Worker's
 * recent invocations. Drives {@link PromotionPolicy} thresholds.
 *
 * All fields are present for any Function that has been invoked at least once;
 * the registry materialises a zero-sample record on first registration so
 * thresholds always have a value to compare against.
 */
export interface TrackRecord {
  /** Fraction of invocations that met the OutcomeContract (0–1). */
  accuracy: number
  /** Number of invocations the record summarises. */
  samples: number
  /** Direction of the most recent measured trend. */
  trend: TrendDirection
  /** ISO-8601 timestamp of the most recent sample. */
  lastUpdated: string
  /** Average cost per successful invocation; absent until at least one success. */
  costPerSuccess?: Money
  /**
   * Fraction of supervised invocations whose human reviewer overrode the
   * Function's output (0–1). High values indicate the Function is not ready
   * for promotion to `autonomous`.
   */
  reviewerOverrideRate?: number
  /**
   * Composite 0–100 score combining accuracy / cost / override rate. Used by
   * downstream catalog UI when ranking Functions; the precise formula lives
   * in `ai-evaluate` so it can evolve without a type change here.
   */
  digitalScore?: number
}

/**
 * Threshold-gated rule that promotes or demotes a Function between
 * {@link AgentMode} values based on its accumulated {@link TrackRecord}.
 *
 * Predicates are expressed as strings so they can be persisted alongside the
 * Function definition and re-evaluated against fresh records without a code
 * change. The evaluator (lives in `ai-evaluate`) parses them against a
 * `TrackRecord` plus invocation context.
 */
export interface PromotionRule {
  /**
   * String predicate evaluated against the {@link TrackRecord} (and optionally
   * elapsed time / sample size). Examples:
   *   - `'accuracy >= 0.95 && samples >= 100'`
   *   - `'reviewerOverrideRate < 0.05 && trend === "improving"'`
   */
  when: string
  /** Mode to move the Function to when {@link when} holds. */
  to: AgentMode
  /** Optional human-readable description of the rule's intent. */
  rationale?: string
}

/**
 * Declarative ladder describing when a Function may climb to a more
 * autonomous {@link AgentMode} and when it must step back down.
 *
 * `evaluate` sets the cadence at which the policy is re-checked against the
 * latest {@link TrackRecord}; `'continuous'` re-evaluates after every
 * invocation, `'daily'` / `'weekly'` use a scheduled job.
 */
export interface PromotionPolicy {
  /** Rules that move the Function up the autonomy ladder. */
  promote: PromotionRule[]
  /** Rules that move the Function down the autonomy ladder. */
  demote: PromotionRule[]
  /** Cadence at which the policy is re-evaluated. */
  evaluate: 'continuous' | 'daily' | 'weekly'
}
