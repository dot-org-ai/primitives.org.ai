/**
 * ServiceInstance — read-only shape returned by `Service.define()` per v3 §5.
 *
 * Methods (`invoke`, `verify`, `publish`, `retire`) are declared as types only;
 * the concrete implementation ships in the next agent's `Service.define`
 * factory. The placeholder helper interfaces (`InvocationHandle`, `InvokeOpts`,
 * `VerifyOpts`, `PublishOpts`, `VerificationReport`, `MarketplaceListing`)
 * are minimal shells the next agents fill in.
 *
 * @packageDocumentation
 */

import type {
  AuthorityBoundaryRef,
  CostModel,
  OutcomeContract,
  Pricing,
  RefundContractRef,
} from 'autonomous-finance'
import type { RewardSignal } from 'digital-tools'

import type { ServiceBinding } from './binding.js'
import type { OutputContract } from './output-contract.js'
import type { ServiceLineage } from './lineage.js'
import type { Audience, Schema } from './types.js'
import type { ServiceArchetypeRef } from './archetype/registry.js'
import type {
  CatalogShape,
  DeliveryShape,
  OnboardingShape,
  OrderShape,
  OversightPolicy,
  PortalShape,
} from './service-spec.js'
import type { EvaluatorPanel } from './evaluator-panel.js'

// ============================================================================
// Method-side placeholder types (filled by next agents)
// ============================================================================

/**
 * Options accepted by `service.invoke()`. Placeholder shape — the
 * Service.define agent fills in concrete fields (tenant, idempotency key,
 * tracing context, cost cap, abort signal).
 *
 * TODO(next-agent: Service.define): expand to the real options shape.
 */
export interface InvokeOpts {
  /** Caller-supplied idempotency key (de-dupe identical re-tries). */
  idempotencyKey?: string
  /** Logical tenant the invocation runs under. */
  tenantId?: string
  /** Abort signal for cooperative cancellation. */
  signal?: AbortSignal
}

/**
 * Handle returned by `service.invoke()`. Placeholder — the runtime agent
 * fills in `result` (resolved Promise of TOut), `events` (AsyncIterable for
 * streaming), `cancel()` semantics per v3 (subscription-teardown vs.
 * workflow-cancel), and observability accessors.
 *
 * TODO(next-agent: Service.invoke): expand with `result`, `events`, `cancel`.
 */
export interface InvocationHandle<TOut> {
  /** Stable id for the invocation (used by polling + observability). */
  readonly id: string
  /** Promise that resolves with the typed output once the cascade completes. */
  readonly result: Promise<TOut>
}

/**
 * Options accepted by `service.verify()`. Placeholder shape — the next agent
 * adds `fixtures`, `emitToCascadeEventLog` (per v3 §10), `cascadeEventTags`,
 * holdout sampling, and snapshot diffing.
 *
 * TODO(next-agent: Service.verify): expand to the real options shape.
 */
export interface VerifyOpts {
  /** When true, verify-time events land on the canonical cascade-event log. */
  emitToCascadeEventLog?: boolean
  /** Tags applied to verify-time events for downstream filtering. */
  cascadeEventTags?: string[]
}

/**
 * Result of `service.verify()`. Placeholder — the runtime agent fills in
 * per-fixture pass/fail, evaluator scores, cost capture, and cascade-event
 * refs (when `emitToCascadeEventLog` was set).
 *
 * TODO(next-agent: Service.verify): expand to the real report shape.
 */
export interface VerificationReport {
  /** ISO-8601 timestamp the verification ran at. */
  readonly verifiedAt: string
  /** Whether all fixtures passed. */
  readonly passed: boolean
}

/**
 * Options accepted by `service.publish()`. Placeholder — the next agent adds
 * marketplace targeting (`agents.do` / `api.services` / `platform.do`),
 * pricing-page render hints, and re-verify gating (per v3 §11).
 *
 * TODO(next-agent: Service.publish): expand to the real options shape.
 */
export interface PublishOpts {
  /** Target marketplace slug (e.g. `'agents.do'`, `'api.services'`). */
  marketplace?: string
  /** Skip re-verify gating; throws if the latest report is stale. */
  skipReverifyGate?: boolean
}

/**
 * Marketplace listing emitted by `service.publish()`. Placeholder — the
 * runtime agent fills in pricing-page render fields, MarketMemoryEvent refs,
 * and listing visibility / state.
 *
 * TODO(next-agent: MarketplaceListing): replace with the full record per
 * v3 design §12.
 */
export interface MarketplaceListing {
  /** Stable id of the listing in the catalog database. */
  readonly $id: string
  /** Marketplace slug the listing was published to. */
  readonly marketplace: string
  /** ISO-8601 timestamp the listing was published at. */
  readonly publishedAt: string
}

// ============================================================================
// ServiceInstance
// ============================================================================

/**
 * Read-only shape of a Service value. Per v3 §5, every field is `readonly`;
 * mutation goes through `Service.define()` (republish a new revision) or the
 * runtime methods (`invoke` / `verify` / `publish` / `retire`).
 *
 * Most consumers don't need the type alias — `const svc = Service.define({...})`
 * infers `ServiceInstance<TIn, TOut>` automatically.
 */
export interface ServiceInstance<TIn, TOut> {
  // ---- identity (readonly) ------------------------------------------------

  readonly $id: string
  readonly $type: 'Service'
  readonly name: string
  readonly promise: string
  readonly description?: string

  // ---- shape (readonly) ---------------------------------------------------

  readonly audience: Audience | Audience[]
  readonly archetype: ServiceArchetypeRef
  readonly schema: { input: Schema<TIn>; output: Schema<TOut> }
  readonly binding: ServiceBinding
  readonly outputContract?: OutputContract<TIn, TOut>

  // ---- evaluation + outcome (readonly) -----------------------------------

  /**
   * Materialised EvaluatorPanel value. Placeholder type until the
   * EvaluatorPanel agent ships the real shape.
   */
  readonly evaluators?: EvaluatorPanel
  readonly outcomeContract?: OutcomeContract

  // ---- billing + finance (readonly) --------------------------------------

  readonly pricing?: Pricing
  readonly refundContract?: RefundContractRef
  readonly authorityBoundary?: AuthorityBoundaryRef
  readonly costModel?: CostModel

  // ---- reward + oversight (readonly) -------------------------------------

  readonly reward?: RewardSignal
  readonly oversight?: OversightPolicy

  // ---- provenance (readonly) ---------------------------------------------

  readonly lineage?: ServiceLineage

  // ---- UI overrides (readonly; placeholder) ------------------------------

  readonly catalog?: CatalogShape
  readonly order?: OrderShape
  readonly onboarding?: OnboardingShape
  readonly delivery?: DeliveryShape
  readonly portal?: PortalShape

  // ---- runtime methods (declared only; impl is the next agent) -----------

  /**
   * Invoke the Service against `input`, returning an {@link InvocationHandle}
   * whose `result` resolves to the typed output.
   *
   * Per v3 §5, the same value runs in three execution targets (in-process,
   * Cloudflare Workers, `api.services`) — the runtime is selected by the
   * surrounding context, not the call site.
   */
  invoke(input: TIn, opts?: InvokeOpts): InvocationHandle<TOut>

  /**
   * Run the cascade against fixture inputs and return a {@link VerificationReport}.
   * Per v3 §10, verify-time events stay sandboxed unless
   * `emitToCascadeEventLog: true`.
   */
  verify(opts?: VerifyOpts): Promise<VerificationReport>

  /**
   * Publish the Service to a marketplace as a {@link MarketplaceListing}.
   * Per v3 §11, requires a fresh {@link VerificationReport} unless
   * `skipReverifyGate` is set.
   */
  publish(opts?: PublishOpts): Promise<MarketplaceListing>

  /**
   * Retire the Service — pending invocations drain per the existing SLA, and
   * no new invocations are accepted.
   */
  retire(reason?: string): Promise<void>
}
