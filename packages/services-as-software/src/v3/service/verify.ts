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
 * persona. The predicate evaluator now delegates to the real
 * `predicate-eval` module (cluster-1 sb-v3-migration gap-fix) which covers
 * all 9 leaf predicate kinds + AND/OR composition. The legacy
 * `evaluator-pass`-without-`panelVerdict` shortcut is preserved so callers
 * that never wired an `EvaluationContext` see the same pass/fail surface.
 * Real ai-functions / ai-workflows cascade wiring lands in round 5/6.
 *
 * @packageDocumentation
 */

import { createInvocationHandle } from '../invoke/runtime.js'
import type { InvocationEvent } from '../invoke/invocation-event.js'
import type { ProofPredicate } from 'autonomous-finance'

import type { ServiceInstance } from '../service.js'
import type { VersionVector } from '../lineage.js'
import { ServiceLifecycle } from './lifecycle.js'
import { getMarketplaceRepo } from '../marketplace/persistence.js'
import {
  evaluatePredicate as evaluatePredicateFull,
  type EvaluationContext,
} from './predicate-eval.js'

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
   * When `true`, verify-time {@link InvocationEvent}s emitted by the cascade
   * walker fan out to the canonical SVO Action log tagged with
   * `cascadeEventTags` (per v3 §10). Emission goes through the configured
   * `MarketplaceRepo` if it exposes a `db.actions.create` surface (the
   * `ai-database`-backed adapter does; the in-memory default does not — the
   * report's `emittedEvents` array stays empty in that case). Emission
   * failures are swallowed with a `console.warn` so verify never breaks on
   * observability errors.
   */
  emitToCascadeEventLog?: boolean
  /** Tags applied to verify-time events for downstream filtering. */
  cascadeEventTags?: string[]
}

/**
 * One fixture run by `verifyService`. `expect` knobs let a caller assert
 * against ProofPredicate-style outcomes + load-bearing / overall-floor
 * thresholds (per the extended `ProofPredicate` union in v3 §8).
 *
 * `context` (optional) supplies the verify-time {@link EvaluationContext}
 * slots the full predicate evaluator reads when a fixture's predicate is
 * not pure `evaluator-pass` (cluster-1 sb-v3-migration gap-fix). When
 * omitted, only `evaluator-pass` predicates can be evaluated (and `output`
 * is auto-populated from the fixture's `delivered` event when present).
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
  /**
   * Verify-time context fed into the predicate evaluator. The runtime
   * auto-populates `output` from the fixture's terminal `delivered` event
   * when this field omits it; everything else is caller-supplied (sb's
   * Stage-35 gate wires `rubricBreakdown` + `unmetRequirements` from the
   * RuntimeUnitInput).
   */
  context?: Partial<EvaluationContext>
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
  /**
   * Cascade-event Action refs emitted when `emitToCascadeEventLog: true`.
   * Empty when the configured `MarketplaceRepo` has no `db.actions.create`
   * surface (in-memory default), or when every emission failed silently.
   */
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
 * Verify-time predicate evaluator entrypoint. Cluster-1 (sb-v3-migration)
 * gap-fix: delegates to the real `predicate-eval` evaluator that covers all
 * 9 leaf kinds + AND/OR composition.
 *
 * **Back-compat shortcut.** The previous implementation special-cased
 * `evaluator-pass` against the `passes` count emitted by the synthetic
 * cascade walker. To keep that surface intact (so existing callers that
 * never wire a verify-time `EvaluationContext` keep observing the same
 * pass/fail behaviour), we still apply the old rule when the predicate is
 * a bare `evaluator-pass` AND the caller did not supply `panelVerdict` in
 * the context. Any other predicate (or any predicate composed via AND/OR)
 * goes straight through the full evaluator.
 *
 * Returns `{ ok, reason }` shaped like the old API so the rest of
 * `runFixture` is unchanged.
 */
async function evaluatePredicate(
  predicate: ProofPredicate | undefined,
  passes: VerificationEvaluatorPass[],
  context: EvaluationContext
): Promise<{ ok: boolean; reason?: string }> {
  if (!predicate) return { ok: true }

  // Legacy `evaluator-pass`-only path: when the caller did not wire a real
  // PanelVerdict in `context`, infer one from the cascade walker's
  // `passes` so existing callers continue to observe the round-3 behaviour
  // (predicate passes when at least one approve sign-off was emitted).
  if (predicate.kind === 'evaluator-pass' && context.panelVerdict === undefined) {
    if (passes.length === 0) {
      return {
        ok: false,
        reason: 'predicate evaluator-pass requires at least one approve sign-off',
      }
    }
    return { ok: true }
  }

  const result = await evaluatePredicateFull(predicate, context)
  if (result.passed) return { ok: true }
  return { ok: false, reason: result.failures.join('; ') || 'predicate failed' }
}

/**
 * Walk a single fixture's invocation through the mock cascade and collect
 * verdicts. When `collectEvents` is true, every {@link InvocationEvent} the
 * cascade emits is buffered into the returned `events` array so the caller
 * (`verifyService`) can fan them out to the SVO Action log when
 * `opts.emitToCascadeEventLog === true`.
 */
async function runFixture<TIn, TOut>(
  svc: ServiceInstance<TIn, TOut>,
  fixture: VerifyFixture,
  collectEvents: boolean
): Promise<{
  passes: VerificationEvaluatorPass[]
  failure?: VerificationFailure
  events: InvocationEvent<TOut>[]
}> {
  const handle = createInvocationHandle<TIn, TOut>(svc, fixture.input as TIn, {
    tenantRef: '__verify__',
  })

  const passes: VerificationEvaluatorPass[] = []
  const events: InvocationEvent<TOut>[] = []
  let failure: VerificationFailure | undefined
  let deliveredOutput: unknown

  for await (const ev of handle.events as AsyncIterable<InvocationEvent<TOut>>) {
    if (collectEvents) events.push(ev)
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
      // Capture the cascade's terminal output so `schema-match` predicates
      // can validate it without the caller having to plumb context.output
      // explicitly. Fixture-supplied `context.output` still wins below.
      deliveredOutput = (ev as unknown as { output?: unknown }).output
      break
    }
  }

  // Build the verify-time EvaluationContext. The caller's `fixture.context`
  // wins on every slot — verify auto-populates only `output` (from the
  // delivered event) when the caller didn't supply one.
  const context: EvaluationContext = {
    ...(deliveredOutput !== undefined && { output: deliveredOutput }),
    ...fixture.context,
  }

  // Apply the fixture's predicate expectation, if any.
  const predicateResult = await evaluatePredicate(fixture.expect?.predicate, passes, context)
  if (!predicateResult.ok && !failure) {
    failure = {
      reason: 'predicate-failed',
      ...(predicateResult.reason !== undefined && { detail: predicateResult.reason }),
    }
  }

  if (failure) return { passes, failure, events }
  return { passes, events }
}

// ============================================================================
// SVO Action emission for verify-time events
// ============================================================================

/**
 * Default actor identity stamped on cascade-event-log emissions. Mirrors
 * the `role:`-prefixed convention used by `Service.publish` (publish.ts).
 */
const DEFAULT_VERIFY_ACTOR = 'role:verifier'

/**
 * Best-effort SVO Action emission for a single verify-time
 * {@link InvocationEvent}.
 *
 * Mirrors the `emitPublishAction` pattern in `service/publish.ts`: duck-types
 * the configured `MarketplaceRepo` for a `db.actions.create` surface (the
 * `ai-database`-backed adapter exposes one; the in-memory default does not).
 * Returns the minted Action `$id` on success, `undefined` when the repo has
 * no Action sink or the create call rejects (failure must NOT break verify
 * — emission is observability, not source of truth).
 */
async function emitVerifyEventAction(
  svc: ServiceInstance<unknown, unknown>,
  event: InvocationEvent<unknown>,
  tags: string[]
): Promise<string | undefined> {
  const repo = getMarketplaceRepo()
  // Duck-type check: ai-database adapter exposes a `db` field with an
  // `actions.create` API. The in-memory adapter does not — skip silently.
  const dbHolder = repo as unknown as {
    db?: { actions?: { create(opts: unknown): Promise<{ $id?: string; id?: string } | unknown> } }
  }
  const create = dbHolder.db?.actions?.create
  if (typeof create !== 'function') return undefined

  try {
    const { kind, ...payload } = event as { kind: string } & Record<string, unknown>
    const result = await create.call(dbHolder.db!.actions, {
      actor: DEFAULT_VERIFY_ACTOR,
      action: 'verify-step',
      object: svc.$id,
      objectData: { event: kind, payload },
      meta: { tags },
    })
    // Action providers vary in id field shape; accept either `$id` or `id`.
    const ref = result as { $id?: string; id?: string } | undefined
    return ref?.$id ?? ref?.id
  } catch (err) {
    console.warn(`[Service.verify] cascade-event-log emission failed for ${svc.$id}:`, err)
    return undefined
  }
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
  const collectedEvents: InvocationEvent<unknown>[] = []

  const collectEvents = opts?.emitToCascadeEventLog === true
  for (const fixture of fixtures) {
    const { passes, failure, events } = await runFixture(svc, fixture, collectEvents)
    evaluatorPasses.push(...passes)
    if (failure) failures.push(failure)
    if (collectEvents) collectedEvents.push(...(events as InvocationEvent<unknown>[]))
  }

  const passed = failures.length === 0

  // When the caller asked for cascade-event-log emission AND the configured
  // MarketplaceRepo exposes a `db.actions.create` surface (ai-database
  // adapter), fan each collected InvocationEvent out to the SVO Action log
  // tagged with `opts.cascadeEventTags`. The minted Action `$id`s are
  // captured into `report.emittedEvents`. When no DB-backed repo is wired
  // (in-memory default), this resolves to an empty array — same surface,
  // no real emission. Emission failures are swallowed (observability, not
  // source of truth).
  let emittedEvents: string[] | undefined
  if (collectEvents) {
    emittedEvents = []
    const tags = opts?.cascadeEventTags ?? []
    for (const event of collectedEvents) {
      const ref = await emitVerifyEventAction(svc as ServiceInstance<unknown, unknown>, event, tags)
      if (ref !== undefined) emittedEvents.push(ref)
    }
  }

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
    ...(emittedEvents !== undefined && { emittedEvents }),
  }

  if (passed) {
    ServiceLifecycle.markVerified(svc.$id, report)
  }

  return report
}
