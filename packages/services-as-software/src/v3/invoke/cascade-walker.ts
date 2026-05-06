/**
 * runCascade — concrete cascade walker that drives a Service's
 * `binding.cascade` step-by-step, emitting {@link InvocationEvent}s as work
 * progresses.
 *
 * This is the **first concrete LLM dispatch** in services-as-software v3
 * (round 6). The Generative branch wires through to
 * `ai-functions.generateObject`; the Code branch invokes the inline handler
 * (or stubs an ActionRef indirection); the Agentic and Human branches are
 * still mocked, with comments marking them as round-7 work.
 *
 * The walker is decoupled from the FSM transitions in `runtime.ts`: the
 * caller (`runtime.ts`) emits `state-changed` events around the call, and
 * this module emits the per-step `cascade-progress`, `cost-incurred`,
 * `preview-available`, and `clarification-needed` events.
 *
 * **Cost capture is wire-only for round 6.** A `cost-incurred` event is
 * emitted with a {@link Money} amount derived from the LLM response (when
 * available); downstream ledger persistence (autonomous-finance Repo writes)
 * lands in round 7+.
 *
 * @packageDocumentation
 */

import { generateObject } from 'ai-functions'
import { z, type ZodTypeAny } from 'zod'

import type { Money } from 'autonomous-finance'
import type { ActionRef } from 'digital-objects'
import type { FunctionRef } from 'digital-tools'

import type { ServiceInstance } from '../service.js'
import type { InvocationEvent } from './invocation-event.js'

// ============================================================================
// Public surface
// ============================================================================

/**
 * Inputs to {@link runCascade}.
 *
 * `emit` is the producer-side hook into the {@link InvocationHandle}'s
 * subscriber fan-out — the runtime in `runtime.ts` passes `handle.emit`
 * directly. `tenantRef` is forwarded for downstream attribution but is not
 * yet consumed (round 7+ will use it for ledger writes).
 */
export interface RunCascadeOpts<TIn, TOut> {
  service: ServiceInstance<TIn, TOut>
  input: TIn
  emit: (event: InvocationEvent<TOut>) => void
  tenantRef?: string
}

/**
 * Walk the Service's `binding.cascade` end-to-end, dispatching each
 * {@link FunctionRef} to its concrete runtime, and return the typed final
 * output.
 *
 * Round-6 dispatch matrix:
 *
 *   - `code`        — calls the inline `handler` (or stubs through an
 *                     {@link ActionRef}); zero-cost emission.
 *   - `generative`  — real `ai-functions.generateObject` call against the
 *                     declared `modelHint` (or the runtime default), with
 *                     the Service's `schema.output` for the LAST generative
 *                     step and a `z.string()` schema for earlier ones.
 *   - `agentic`     — STILL MOCK; round 7 will wire the AgenticLoop.
 *   - `human`       — STILL MOCK; round 7 will wire HITL channels +
 *                     workflow-signal park/resume.
 *
 * Errors throw; `runtime.ts` catches and emits the typed `'failed'` event.
 */
export async function runCascade<TIn, TOut>(opts: RunCascadeOpts<TIn, TOut>): Promise<TOut> {
  const { service, input, emit } = opts
  const cascade = service.binding.cascade

  // Find the index of the LAST generative step — only this step receives the
  // Service's output schema; earlier generative steps get a generic z.string()
  // because per-step Function-level outputContracts don't exist yet
  // (round 7+ will support per-step schemas via Function-level outputContract).
  const lastGenerativeIdx = findLastGenerativeIdx(cascade)

  // Carry the value forward through the cascade. Starts as the typed input;
  // the type erodes to `unknown` once we cross any generative/agentic/human
  // step (they don't preserve TIn → TOut composition yet).
  let current: unknown = input

  for (let i = 0; i < cascade.length; i++) {
    const fn = cascade[i]!
    const pct = ((i + 1) / cascade.length) * 100

    emit({ kind: 'cascade-progress', functionRef: fn.name, pct })

    switch (fn.kind) {
      case 'code': {
        current = await runCodeStep(fn, current)
        emit({
          kind: 'cost-incurred',
          cost: { amount: 0n, currency: 'USD' } satisfies Money,
          functionRef: fn.name,
        })
        break
      }

      case 'generative': {
        const isLast = i === lastGenerativeIdx
        const stepSchema: ZodTypeAny = isLast
          ? (service.schema.output as unknown as ZodTypeAny)
          : z.string()
        const { value, costUsd } = await runGenerativeStep<TIn>({
          fn,
          service,
          input,
          carry: current,
          schema: stepSchema,
        })
        current = value
        emit({
          kind: 'cost-incurred',
          cost: { amount: usdToMicroCents(costUsd), currency: 'USD' } satisfies Money,
          functionRef: fn.name,
        })
        // Emit a partial preview keyed by the Function's name so the
        // customer-runtime can render mid-cascade output.
        emit({
          kind: 'preview-available',
          slot: fn.name,
          payload: isLast ? (value as Partial<TOut>) : ({} as Partial<TOut>),
        })
        break
      }

      case 'agentic': {
        // TODO(round 7): wire ai-functions.AgenticLoop with persona +
        // toolPermissions + signOff. Until then: stub.
        current = current ?? null
        emit({
          kind: 'cost-incurred',
          cost: { amount: 0n, currency: 'USD' } satisfies Money,
          functionRef: fn.name,
        })
        break
      }

      case 'human': {
        // TODO(round 7): real walker transitions NEEDS_CLARIFICATION + parks
        // the workflow on a HumanChannel dispatch. Until then: emit the
        // request and continue (the in-memory walker has no reply mechanism).
        emit({
          kind: 'clarification-needed',
          request: {
            id: `clr:${fn.$id}`,
            question: `(mock) human step '${fn.name}' would request input here`,
          },
        })
        emit({
          kind: 'cost-incurred',
          cost: { amount: 0n, currency: 'USD' } satisfies Money,
          functionRef: fn.name,
        })
        break
      }
    }
  }

  // The cascade's final value is the Service's typed TOut. We trust the LAST
  // generative step (or the LAST code step if no generative is present) to
  // have produced a value matching `service.schema.output`. A future round
  // will validate against the Standard Schema before returning.
  return current as TOut
}

// ============================================================================
// Per-kind dispatchers
// ============================================================================

/**
 * Code Function — invoke the inline handler when present; if `handler` is an
 * {@link ActionRef} string, stub for now (the digital-objects Action registry
 * dispatch lands later).
 */
async function runCodeStep(
  fn: Extract<FunctionRef, { kind: 'code' }>,
  carry: unknown
): Promise<unknown> {
  const handler = fn.handler
  if (typeof handler === 'function') {
    // Inline handler — TInput / TOutput are erased to `unknown` here because
    // the cascade carries a heterogeneous value-stream the compiler can't
    // narrow without per-step types (round 7+ work).
    const fnHandler = handler as (input: unknown) => unknown | Promise<unknown>
    return await fnHandler(carry)
  }
  // ActionRef indirection — stub. Round 7 will look up the registered
  // Action in `digital-objects` and dispatch.
  void (handler as ActionRef)
  return carry
}

/**
 * Generative Function — real `ai-functions.generateObject` dispatch.
 *
 * Prompt is naïve concatenation for round 6: `service.name + service.promise
 * + JSON.stringify(input) + fn.name`. Better prompt-templating (Function-
 * level prompts, carry-value injection, system-prompt composition) lands in
 * round 7+ alongside per-step output schemas.
 *
 * `modelHint` is forwarded to `generateObject` as the `model` arg; the
 * default falls back to a published alias (`'sonnet'`) when the Function
 * declares no preference. Model-selection policy (cost/availability/track-
 * record) lands later — for round 6 the hint is honoured verbatim.
 */
async function runGenerativeStep<TIn>(opts: {
  fn: Extract<FunctionRef, { kind: 'generative' }>
  service: ServiceInstance<TIn, unknown>
  input: TIn
  carry: unknown
  schema: ZodTypeAny
}): Promise<{ value: unknown; costUsd: number }> {
  const { fn, service, input, schema } = opts
  const prompt = [
    `Service: ${service.name}`,
    `Promise: ${service.promise}`,
    `Input: ${safeStringify(input)}`,
    `Step: ${fn.name}`,
  ].join('\n\n')
  const model = fn.modelHint ?? 'sonnet'

  const result = await generateObject({
    model,
    schema,
    prompt,
  })

  // ai-functions.generateObject returns `usage` as `unknown` — duck-type it
  // for token counts and estimate cost. Real per-model pricing lives in
  // `ai-functions.budget`; round 7 will route through there.
  const costUsd = estimateCostFromUsage(result.usage, model)
  return { value: result.object, costUsd }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Index of the LAST generative cascade step, or `-1` if none. Only this
 * step receives the Service's `schema.output` (round 6 simplification).
 */
function findLastGenerativeIdx(cascade: ReadonlyArray<FunctionRef>): number {
  for (let i = cascade.length - 1; i >= 0; i--) {
    if (cascade[i]!.kind === 'generative') return i
  }
  return -1
}

/** JSON.stringify with bigint coercion (transactions carry bigint amounts). */
function safeStringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val))
}

/**
 * Naïve cost estimator from the AI SDK's `usage` shape. Round 6 uses a flat
 * $3-input / $15-output per-million-tokens for Sonnet-class models when
 * inputTokens/outputTokens are present; otherwise falls back to a $0.001
 * per-call placeholder. Round 7 will route through `ai-functions.budget`.
 */
function estimateCostFromUsage(usage: unknown, _model: string): number {
  if (usage && typeof usage === 'object') {
    const u = usage as { inputTokens?: number; outputTokens?: number }
    const inT = typeof u.inputTokens === 'number' ? u.inputTokens : 0
    const outT = typeof u.outputTokens === 'number' ? u.outputTokens : 0
    if (inT > 0 || outT > 0) {
      // Sonnet-class default: $3/M input, $15/M output.
      return (inT * 3) / 1_000_000 + (outT * 15) / 1_000_000
    }
  }
  return 0.001
}

/**
 * Convert a USD-denominated dollar float to a `bigint` micro-cent count
 * (1e-6 of a cent). Stays in {@link Money}'s smallest-unit convention while
 * preserving sub-cent precision for cheap LLM calls.
 */
function usdToMicroCents(usd: number): bigint {
  // 1 USD = 100 cents = 100_000_000 micro-cents.
  return BigInt(Math.round(usd * 100_000_000))
}
