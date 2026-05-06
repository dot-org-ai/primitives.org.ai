/**
 * `Service.define()` — the primary mint factory (v3 §5).
 *
 * Round 3 deliverable: factory body that validates the spec, applies
 * archetype defaults, mints `$id`, registers the result in the lifecycle
 * FSM as `'draft'`, and returns a fully-typed {@link ServiceInstance}.
 *
 * The runtime methods (`invoke`, `verify`, `publish`) are bound to stub
 * implementations that throw with pointers to the rounds where they land:
 *
 *   - `invoke`  — round 4 (Service.invoke FSM)
 *   - `verify`  — round 5 (Service.verify cascade-event hook per v3 §10)
 *   - `publish` — round 5 (Service.publish + MarketplaceListing per v3 §11)
 *
 * `retire` is wired today (calls `ServiceLifecycle.markRetired`) since the
 * lifecycle FSM is the entirety of its implementation.
 *
 * @packageDocumentation
 */

import type { FunctionRef, HumanFunctionRef } from 'digital-tools'

import { createInvocationHandle } from '../invoke/runtime.js'
import type { ServiceSpec } from '../service-spec.js'
import type {
  InvocationHandle,
  InvokeOpts,
  MarketplaceListing,
  PublishOpts,
  ServiceInstance,
  VerificationReport,
  VerifyOpts,
} from '../service.js'
import { archetypes } from '../archetype/registry.js'
import type { ServiceArchetype } from '../archetype/registry.js'

import { ServiceLifecycle } from './lifecycle.js'
import { mintServiceId } from './mint-id.js'
import { expandDoSugar, type ServiceSpecWithDoSugar } from './expand-do-sugar.js'
import { verifyService } from './verify.js'
import { publishService } from './publish.js'

// ============================================================================
// Validation helpers
// ============================================================================

/**
 * Allowed FunctionRef discriminator values. Mirrors `digital-tools`'
 * `FunctionKind` union without re-importing it (avoid layer churn here).
 */
const VALID_FUNCTION_KINDS = new Set(['code', 'generative', 'agentic', 'human'])

function isHumanFunctionRef(fn: FunctionRef): fn is HumanFunctionRef {
  return fn.kind === 'human'
}

/**
 * Validate the cascade: every {@link FunctionRef} must declare a recognised
 * `kind`, and every {@link HumanFunctionRef} must declare both
 * `rationale` and `expirationPolicy` (book ch.6 enforcement at runtime; the
 * compile-time enforcement already exists via the discriminated union).
 *
 * Throws `Error` with an actionable message on the first failure.
 */
function validateCascade(cascade: FunctionRef[], serviceName: string): void {
  if (cascade.length === 0) {
    throw new Error(
      `Service.define(${JSON.stringify(serviceName)}): binding.cascade is empty. ` +
        `At least one FunctionRef is required.`
    )
  }

  for (let i = 0; i < cascade.length; i++) {
    const fn = cascade[i]
    if (!fn) {
      throw new Error(
        `Service.define(${JSON.stringify(serviceName)}): binding.cascade[${i}] is undefined.`
      )
    }
    if (!VALID_FUNCTION_KINDS.has(fn.kind)) {
      throw new Error(
        `Service.define(${JSON.stringify(serviceName)}): binding.cascade[${i}] has invalid kind ` +
          `${JSON.stringify(fn.kind)}; expected one of ${[...VALID_FUNCTION_KINDS].join(', ')}.`
      )
    }
    if (isHumanFunctionRef(fn)) {
      if (!fn.rationale) {
        throw new Error(
          `Service.define(${JSON.stringify(serviceName)}): Human FunctionRef ` +
            `${JSON.stringify(fn.name)} must declare a 'rationale' (book ch.6 enforcement).`
        )
      }
      if (!fn.expirationPolicy) {
        throw new Error(
          `Service.define(${JSON.stringify(serviceName)}): Human FunctionRef ` +
            `${JSON.stringify(fn.name)} must declare an 'expirationPolicy' (book ch.6 enforcement).`
        )
      }
    }
  }
}

// ============================================================================
// Archetype default merging
// ============================================================================

/**
 * Merge archetype defaults into a spec. Defaults LOSE to anything explicitly
 * set on the spec. Today the merge is shallow on the small handful of fields
 * archetypes contribute (oversight defaults, evaluator persona hints, cost
 * estimate). Deep merging on UI shape overrides lands when the UI shapes
 * agent ships its types.
 */
function applyArchetypeDefaults<TIn, TOut>(
  spec: ServiceSpec<TIn, TOut>,
  archetype: ServiceArchetype | undefined
): ServiceSpec<TIn, TOut> {
  if (!archetype) return spec

  // Only apply oversight default if not already set on spec.
  // (UI shape, evaluator, and cost defaults wire through round 5+ when the
  // UI shapes agent + EvaluatorPanel runtime land — the spec's archetype
  // ref is the durable carrier; these are presentation-time defaults.)
  if (spec.oversight !== undefined) return spec

  return {
    ...spec,
    oversight: {
      mode: archetype.defaultOversight.defaultMode,
    },
  }
}

// ============================================================================
// Stub method bindings (round 4 / round 5 work replaces these)
// ============================================================================

/**
 * Build the bound runtime methods for a Service.
 *
 * - `invoke`  — round 4 stub. Throws on call with a pointer to the FSM work.
 * - `verify`  — round 5 stub. Throws on call.
 * - `publish` — round 5 stub. Throws on call.
 * - `retire`  — wired today (delegates to {@link ServiceLifecycle.markRetired}).
 *
 * The function captures `serviceId` so the bound methods retain identity
 * even if the consuming code stores them detached from the Service value.
 */
function buildBoundMethods<TIn, TOut>(
  serviceId: string
): {
  invoke: (input: TIn, opts?: InvokeOpts) => InvocationHandle<TOut>
  verify: (opts?: VerifyOpts) => Promise<VerificationReport>
  publish: (opts?: PublishOpts) => Promise<MarketplaceListing>
  retire: (reason?: string) => Promise<void>
} {
  return {
    invoke(input: TIn, opts?: InvokeOpts): InvocationHandle<TOut> {
      // Wired round-3 close: look up the registered service in the lifecycle
      // FSM and dispatch to the Service.invoke FSM runtime. The cascade walker
      // is currently a mock (in-memory; emits typed events end-to-end). Real
      // ai-workflows DurableExecutionAdapter wiring lands in round 4/5.
      const service = ServiceLifecycle.getService(serviceId) as
        | ServiceInstance<TIn, TOut>
        | undefined
      if (!service) {
        throw new Error(
          `Service ${serviceId} not registered in lifecycle — was it created via Service.define()?`
        )
      }
      return createInvocationHandle<TIn, TOut>(service, input, opts)
    },

    verify(opts?: VerifyOpts): Promise<VerificationReport> {
      // Wired round-4: dispatch through the registered service so the bound
      // method retains identity even when stored detached. Mock cascade walker
      // is used end-to-end (round 3 substrate); real ai-functions wiring
      // lands in round 5/6.
      const service = ServiceLifecycle.getService(serviceId) as
        | ServiceInstance<TIn, TOut>
        | undefined
      if (!service) {
        return Promise.reject(
          new Error(
            `Service ${serviceId} not registered in lifecycle — was it created via Service.define()?`
          )
        )
      }
      return verifyService<TIn, TOut>(service, opts)
    },

    publish(opts?: PublishOpts): Promise<MarketplaceListing> {
      // Wired round-4: dispatch through the registered service. The publish
      // gate enforces ADR-0006 re-verify rules + emits a typed
      // MarketplaceListing + RuntimeUnit, persisted in-memory pending the
      // round-5 ai-database Repo writes.
      const service = ServiceLifecycle.getService(serviceId) as
        | ServiceInstance<TIn, TOut>
        | undefined
      if (!service) {
        return Promise.reject(
          new Error(
            `Service ${serviceId} not registered in lifecycle — was it created via Service.define()?`
          )
        )
      }
      return publishService<TIn, TOut>(service, opts)
    },

    retire(reason?: string): Promise<void> {
      // Wired today — the lifecycle FSM is the entirety of retire's impl.
      ServiceLifecycle.markRetired(serviceId, reason)
      return Promise.resolve()
    },
  }
}

// ============================================================================
// Build the readonly ServiceInstance value
// ============================================================================

/**
 * Materialise the read-only {@link ServiceInstance} from a normalised spec
 * and a pre-minted `$id`. The result is `Object.freeze`d so consumers can't
 * mutate it after the fact (republishing changes goes through `Service.define`
 * with a new revision).
 */
function buildServiceInstance<TIn, TOut>(
  spec: ServiceSpec<TIn, TOut>,
  id: string
): ServiceInstance<TIn, TOut> {
  const methods = buildBoundMethods<TIn, TOut>(id)

  // Object literal carries `exactOptionalPropertyTypes` semantics — only set
  // optional fields that are actually present on the spec, never `undefined`.
  const instance: ServiceInstance<TIn, TOut> = {
    $id: id,
    $type: 'Service' as const,
    name: spec.name,
    promise: spec.promise,
    ...(spec.description !== undefined && { description: spec.description }),
    audience: spec.audience,
    archetype: spec.archetype,
    schema: spec.schema,
    binding: spec.binding,
    ...(spec.outputContract !== undefined && { outputContract: spec.outputContract }),
    ...(spec.evaluators !== undefined && { evaluators: spec.evaluators }),
    ...(spec.outcomeContract !== undefined && { outcomeContract: spec.outcomeContract }),
    ...(spec.pricing !== undefined && { pricing: spec.pricing }),
    ...(spec.refundContract !== undefined && { refundContract: spec.refundContract }),
    ...(spec.authorityBoundary !== undefined && { authorityBoundary: spec.authorityBoundary }),
    ...(spec.costModel !== undefined && { costModel: spec.costModel }),
    ...(spec.reward !== undefined && { reward: spec.reward }),
    ...(spec.oversight !== undefined && { oversight: spec.oversight }),
    ...(spec.lineage !== undefined && { lineage: spec.lineage }),
    ...(spec.catalog !== undefined && { catalog: spec.catalog }),
    ...(spec.order !== undefined && { order: spec.order }),
    ...(spec.onboarding !== undefined && { onboarding: spec.onboarding }),
    ...(spec.delivery !== undefined && { delivery: spec.delivery }),
    ...(spec.portal !== undefined && { portal: spec.portal }),
    invoke: methods.invoke,
    verify: methods.verify,
    publish: methods.publish,
    retire: methods.retire,
  }

  return Object.freeze(instance)
}

// ============================================================================
// Public API: define
// ============================================================================

/**
 * Mint a {@link ServiceInstance} from a {@link ServiceSpec}.
 *
 * Pipeline:
 *   1. {@link expandDoSugar} — lower Tier-0 `do:` to canonical schema + binding
 *   2. validate the cascade (kinds + Human rationale/expirationPolicy)
 *   3. resolve archetype + merge defaults (defaults lose to explicit fields)
 *   4. {@link mintServiceId} — derive deterministic `$id`
 *   5. construct the readonly {@link ServiceInstance} with stub-bound methods
 *   6. {@link ServiceLifecycle.draft} — register in mint FSM
 *
 * The bound methods (`invoke`, `verify`, `publish`) are round-4 / round-5
 * stubs that throw with pointers to the rounds that wire the real impls.
 * `retire` is wired today.
 */
export function define<TIn, TOut>(
  spec: ServiceSpecWithDoSugar<TIn, TOut> | ServiceSpec<TIn, TOut>
): ServiceInstance<TIn, TOut> {
  // 1. Lower Tier-0 sugar (no-op if `do:` is absent).
  const expanded = expandDoSugar<TIn, TOut>(spec as ServiceSpecWithDoSugar<TIn, TOut>)

  // 2. Validate cascade kinds + Human FunctionRef constraints.
  validateCascade(expanded.binding.cascade, expanded.name)

  // 3. Resolve archetype + merge defaults.
  const archetype = archetypes.get(expanded.archetype)
  const merged = applyArchetypeDefaults<TIn, TOut>(expanded, archetype)

  // 4. Mint stable `$id`. If the spec already has one (rare; explicit
  //    override path), respect it.
  const id = merged.$id ?? mintServiceId(merged as ServiceSpec<unknown, unknown>)

  // 5. Build the readonly ServiceInstance.
  const instance = buildServiceInstance<TIn, TOut>(merged, id)

  // 6. Register in the lifecycle FSM.
  ServiceLifecycle.draft(instance as ServiceInstance<unknown, unknown>)

  return instance
}
