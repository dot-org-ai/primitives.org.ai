/**
 * `Service.verify()` — round-4 implementation per v3 §10 + §11.
 *
 * Walks the cascade against synthetic / supplied fixtures using the round-3
 * mock invocation runtime, collects evaluator sign-offs from the event stream,
 * and produces a typed {@link VerificationReport}. On success the FSM
 * transitions `draft → verified` (via {@link ServiceLifecycle.markVerified}).
 *
 * **Mock cascade walker is the substrate today** — the round-3
 * `createInvocationHandle` emits a synthetic `evaluator-signoff` burst per
 * persona; the predicate evaluator below is a stub that approves any report
 * carrying at least one approve sign-off when the outcome contract uses
 * `kind: 'evaluator-pass'`. Real ai-functions / ai-workflows wiring + a full
 * predicate evaluator land in round 5/6.
 *
 * @packageDocumentation
 */

import { createInvocationHandle } from '../invoke/runtime.js'
import type { InvocationEvent } from '../invoke/invocation-event.js'
import type { ProofPredicate } from 'autonomous-finance'

import type { ServiceInstance } from '../service.js'
import type { VersionVector } from '../lineage.js'
import { ServiceLifecycle } from './lifecycle.js'

// ============================================================================
// Public option + report types
// ============================================================================

/**
 * Options accepted by `service.verify()` per v3 §10.
 *
 * `fixtures` lets the caller pin specific input/expectation pairs; when
 * absent, `verifyService` synthesises a single empty input cast to `TIn`
 * (round 5/6 will replace this with LLM-driven synthesis from the input
 * schema).
 */
export interface VerifyOpts {
  /** Optional explicit fixtures; auto-synthesised when omitted. */
  fixtures?: VerifyFixture[]
  /**
   * When `true`, verify-time events land on the canonical cascade-event log
   * tagged with `cascadeEventTags` (per v3 §10). Today the bridge is a no-op
   * placeholder — the report still records the intended emit.
   */
  emitToCascadeEventLog?: boolean
  /** Tags applied to verify-time events for downstream filtering. */
  cascadeEventTags?: string[]
}

/**
 * One fixture run by `verifyService`. `expect` knobs let a caller assert
 * against ProofPredicate-style outcomes + load-bearing / overall-floor
 * thresholds (per the extended `ProofPredicate` union in v3 §8).
 */
export interface VerifyFixture {
  input: unknown
  expect?: {
    predicate?: ProofPredicate
    floors?: {
      overallPassRate?: number
      loadBearing?: string[]
    }
  }
}

/** One reason a fixture failed verification. */
export interface VerificationFailure {
  reason: string
  detail?: string
}

/** One persona approval recorded during a verify run. */
export interface VerificationEvaluatorPass {
  reviewer: string
  rationale: string
}

/**
 * Result of `service.verify()`. Replaces the placeholder shape on
 * `service.ts`. Carries a `versionVector` snapshot so the publish-side
 * field-diff (per ADR-0006) can compare exactly the verified version, not a
 * heuristic.
 */
export interface VerificationReport {
  readonly $id: string
  readonly $type: 'VerificationReport'
  readonly serviceRef: string
  readonly passed: boolean
  readonly failures: VerificationFailure[]
  readonly evaluatorPasses: VerificationEvaluatorPass[]
  readonly versionVector: VersionVector
  readonly verifiedAt: string
  /** Cascade-event refs emitted when `emitToCascadeEventLog: true`. */
  readonly emittedEvents?: string[]
}

// ============================================================================
// Helpers
// ============================================================================

/** Mint a stable id for a VerificationReport — `vrep:<base36-time>-<rand>`. */
function mintReportId(): string {
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 0xffffff).toString(36)
  return `vrep:${t}-${r}`
}

/**
 * Best-effort version snapshot at verify time. The lineage value (when
 * present) is the source of truth; otherwise we stamp a `verify-fallback`
 * tag so the publish-side diff can still match.
 *
 * Round 5+: replace with a real version vector pulled from the running
 * cascade engine + ontology snapshot.
 */
function snapshotVersionVector(svc: ServiceInstance<unknown, unknown>): VersionVector {
  if (svc.lineage?.versionVector) return svc.lineage.versionVector
  return {
    ontology: 'verify-fallback',
    engine: 'verify-fallback',
    generation: 'verify-fallback',
    fh: 'verify-fallback',
  }
}

/**
 * Stub predicate evaluator. The full evaluator is round-6 work; for now we
 * approve any predicate whose `kind === 'evaluator-pass'` provided the run
 * collected at least one `evaluator-signoff` event with `verdict: 'approve'`.
 *
 * Other predicate kinds default to "pass" (the publish-side gate is the
 * authoritative cost-aware checker; verify-side here is a smoke test).
 */
function evaluatePredicate(
  predicate: ProofPredicate | undefined,
  passes: VerificationEvaluatorPass[]
): { ok: boolean; reason?: string } {
  if (!predicate) return { ok: true }
  if (predicate.kind === 'evaluator-pass') {
    if (passes.length === 0) {
      return {
        ok: false,
        reason: 'predicate evaluator-pass requires at least one approve sign-off',
      }
    }
    return { ok: true }
  }
  // TODO(round 6): wire the remaining predicate kinds (schema-match, human-sign,
  // external, load-bearing-pass, overall-floor, and/or composition).
  return { ok: true }
}

/**
 * Walk a single fixture's invocation through the mock cascade and collect
 * verdicts.
 */
async function runFixture<TIn, TOut>(
  svc: ServiceInstance<TIn, TOut>,
  fixture: VerifyFixture
): Promise<{ passes: VerificationEvaluatorPass[]; failure?: VerificationFailure }> {
  const handle = createInvocationHandle<TIn, TOut>(svc, fixture.input as TIn, {
    tenantRef: '__verify__',
  })

  const passes: VerificationEvaluatorPass[] = []
  let failure: VerificationFailure | undefined

  for await (const ev of handle.events as AsyncIterable<InvocationEvent<TOut>>) {
    if (ev.kind === 'evaluator-signoff' && ev.verdict === 'approve') {
      passes.push({ reviewer: ev.reviewer, rationale: ev.rationale })
    } else if (ev.kind === 'evaluator-signoff' && ev.verdict === 'reject') {
      failure = {
        reason: 'evaluator-rejected',
        detail: `${ev.reviewer}: ${ev.rationale}`,
      }
    } else if (ev.kind === 'failed') {
      failure = { reason: ev.reason, detail: ev.detail }
    } else if (ev.kind === 'delivered') {
      break
    }
  }

  // Apply the fixture's predicate expectation, if any.
  const predicateResult = evaluatePredicate(fixture.expect?.predicate, passes)
  if (!predicateResult.ok && !failure) {
    failure = {
      reason: 'predicate-failed',
      ...(predicateResult.reason !== undefined && { detail: predicateResult.reason }),
    }
  }

  if (failure) return { passes, failure }
  return { passes }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Run `service.verify()` per v3 §10.
 *
 * Pipeline:
 *   1. Materialise fixtures (synthetic empty input when none provided).
 *   2. Run each fixture through the mock cascade walker; collect approvals
 *      and failures.
 *   3. Apply the outcomeContract.predicate (when present) as a smoke test
 *      via {@link evaluatePredicate}.
 *   4. Build a typed {@link VerificationReport}.
 *   5. On success, transition `draft → verified` via
 *      {@link ServiceLifecycle.markVerified}.
 *
 * Returns the report regardless of pass/fail; the lifecycle transition only
 * fires when `passed === true`.
 */
export async function verifyService<TIn, TOut>(
  svc: ServiceInstance<TIn, TOut>,
  opts?: VerifyOpts
): Promise<VerificationReport> {
  // 1. Synthesise a fixture when none provided. Round 5/6 will use the real
  //    LLM-driven input synthesis from `svc.schema.input`.
  const syntheticFixture: VerifyFixture = {
    input: {} as unknown,
    ...(svc.outcomeContract?.predicate !== undefined && {
      expect: { predicate: svc.outcomeContract.predicate },
    }),
  }
  const fixtures: VerifyFixture[] =
    opts?.fixtures && opts.fixtures.length > 0 ? opts.fixtures : [syntheticFixture]

  const evaluatorPasses: VerificationEvaluatorPass[] = []
  const failures: VerificationFailure[] = []

  for (const fixture of fixtures) {
    const { passes, failure } = await runFixture(svc, fixture)
    evaluatorPasses.push(...passes)
    if (failure) failures.push(failure)
  }

  const passed = failures.length === 0

  // Build the report. The optional `emittedEvents` field is included only
  // when the caller asked for cascade-event-log emission.
  const report: VerificationReport = {
    $id: mintReportId(),
    $type: 'VerificationReport',
    serviceRef: svc.$id,
    passed,
    failures,
    evaluatorPasses,
    versionVector: snapshotVersionVector(svc as ServiceInstance<unknown, unknown>),
    verifiedAt: new Date().toISOString(),
    ...(opts?.emitToCascadeEventLog && {
      // TODO(round 5): bridge to the canonical cascade-event log; for now we
      // record the intended tags so downstream consumers see the surface.
      emittedEvents: (opts.cascadeEventTags ?? []).map((tag) => `cascade-event:${tag}`),
    }),
  }

  if (passed) {
    ServiceLifecycle.markVerified(svc.$id, report)
  }

  return report
}
