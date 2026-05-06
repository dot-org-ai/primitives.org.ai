/**
 * runCascade — concrete cascade walker that drives a Service's
 * `binding.cascade` step-by-step, emitting {@link InvocationEvent}s as work
 * progresses.
 *
 * Round-7 status: **Generative AND Agentic branches are real LLM dispatch.**
 *   - Generative: `ai-functions.generateObject` (round 6).
 *   - Agentic:    `ai-functions.generateText` with the tool-use loop
 *                 (`tools` + `maxSteps`) — round 7. Tools are looked up in
 *                 the `digital-tools` registry by `toolPermissions` name.
 *
 * The Code branch invokes the inline handler (or stubs an ActionRef
 * indirection); the Human branch is still mocked, with comments marking it
 * as round-8 work (HITL channels + workflow-signal park/resume).
 *
 * The walker is decoupled from the FSM transitions in `runtime.ts`: the
 * caller (`runtime.ts`) emits `state-changed` events around the call, and
 * this module emits the per-step `cascade-progress`, `cost-incurred`,
 * `preview-available`, and `clarification-needed` events.
 *
 * **Cost capture is wire-only.** A `cost-incurred` event is emitted with a
 * {@link Money} amount derived from the LLM response (when available);
 * downstream ledger persistence (autonomous-finance Repo writes) lands in
 * round 8+.
 *
 * @packageDocumentation
 */

import { generateObject, generateText } from 'ai-functions'
import { z, type ZodTypeAny } from 'zod'

import type { Money } from 'autonomous-finance'
import type { ActionRef } from 'digital-objects'
import { getTool, type AnyTool, type FunctionRef, type ToolParameter } from 'digital-tools'

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
 * Round-7 dispatch matrix:
 *
 *   - `code`        — calls the inline `handler` (or stubs through an
 *                     {@link ActionRef}); zero-cost emission.
 *   - `generative`  — real `ai-functions.generateObject` call against the
 *                     declared `modelHint` (or the runtime default), with
 *                     the Service's `schema.output` for the LAST generative
 *                     step and a `z.string()` schema for earlier ones.
 *   - `agentic`     — real `ai-functions.generateText` tool-use loop;
 *                     resolves `toolPermissions` against the `digital-tools`
 *                     registry and dispatches with `maxSteps: 10`.
 *                     `mode: 'supervised'` additionally emits an advisory
 *                     `evaluator-signoff` event (real supervision UI lands
 *                     in round 8).
 *   - `human`       — STILL MOCK; round 8 will wire HITL channels +
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
        const isLast = i === cascade.length - 1
        const stepSchema: ZodTypeAny = isLast
          ? (service.schema.output as unknown as ZodTypeAny)
          : z.string()
        const { value, costUsd } = await runAgenticStep<TIn>({
          fn,
          service,
          input,
          carry: current,
          schema: stepSchema,
          emit: (event) => emit(event as InvocationEvent<TOut>),
          stepProgressBase: pct,
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
        // Supervised mode: emit an advisory sign-off event after the loop
        // completes. The InvocationEvent union locks `verdict` to
        // 'approve' | 'reject' (no `'advisory'` member yet — round 8 widens
        // the union and adds the supervision UI). For now we mark the
        // rationale string so consumers can detect advisory verdicts.
        if (fn.mode === 'supervised') {
          emit({
            kind: 'evaluator-signoff',
            reviewer: fn.persona ?? fn.name,
            verdict: 'approve',
            rationale: '(advisory) supervised-mode auto-approve — UI gate lands round 8',
          })
        }
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
  // `ai-functions.budget`; round 8 will route through there.
  const costUsd = estimateCostFromUsage(result.usage, model)
  return { value: result.object, costUsd }
}

/**
 * Agentic Function — real `ai-functions.generateText` tool-use loop dispatch.
 *
 * Resolves each name in `fn.toolPermissions` against the global
 * `digital-tools` registry, converts each `Tool` to the AI-SDK tool shape
 * (`{ description, parameters: zod, execute }`), then calls
 * `generateText({ tools, maxSteps })`. The AI SDK drives the
 * model→tool→model loop internally; `maxSteps` caps iterations.
 *
 * Round-7 caps `maxSteps` at 10 unconditionally — round 8 will read this off
 * the {@link AgenticFunctionRef} (e.g. an `iterationLimit` field or a
 * derivation from `concurrency`). The `persona` field is appended to the
 * system prompt when non-empty.
 *
 * Missing tools throw with a `Tool not registered: <name>` message;
 * `runtime.ts` catches and emits the typed `'failed'` event with
 * `reason: 'external-failure'` and that string as `detail`.
 *
 * Per-iteration tracing is currently approximate: `cascade-progress` events
 * are emitted via the `onStepFinish` callback (one per model step); a
 * `preview-available` event with an empty payload is emitted alongside so
 * the customer-runtime knows the loop made forward progress.
 */
async function runAgenticStep<TIn>(opts: {
  fn: Extract<FunctionRef, { kind: 'agentic' }>
  service: ServiceInstance<TIn, unknown>
  input: TIn
  carry: unknown
  schema: ZodTypeAny
  emit: (event: InvocationEvent<unknown>) => void
  stepProgressBase: number
}): Promise<{ value: unknown; costUsd: number }> {
  const { fn, service, input, carry, schema, emit, stepProgressBase } = opts

  // Round-7 cap. TODO(round 8): read from `fn` (e.g. `fn.iterationLimit`).
  const maxIterations = 10

  // Resolve tools by id from the global digital-tools registry. Missing
  // tools are a hard failure: the cascade can't proceed if a permission
  // resolves to nothing, so we throw with a deterministic message and let
  // runtime.ts emit the typed `'failed'` event.
  const requestedNames = fn.toolPermissions ?? []
  const resolved: AnyTool[] = []
  for (const name of requestedNames) {
    const tool = getTool(name)
    if (!tool) {
      throw new Error(`Tool not registered: ${name}`)
    }
    resolved.push(tool)
  }

  // Convert each digital-tools `Tool` to the AI-SDK tool shape. The SDK
  // expects `{ description, parameters: zod, execute }`. We synthesise a
  // permissive Zod schema from the tool's `ToolParameter[]` (each parameter
  // becomes a top-level property; required-ness honoured).
  const sdkTools: Record<
    string,
    { description: string; parameters: ZodTypeAny; execute: (args: unknown) => Promise<unknown> }
  > = {}
  for (const tool of resolved) {
    sdkTools[tool.id] = {
      description: tool.description,
      parameters: toolParametersToZod(tool.parameters),
      execute: async (args: unknown) => {
        // The Tool's handler signature varies; pass the args through. The
        // arity-2 (`(input, ctx)`) form receives `undefined` for ctx in
        // this dispatcher — SVO broker integration lands in round 8.
        const handler = tool.handler as (input: unknown) => unknown | Promise<unknown>
        return await handler(args)
      },
    }
  }

  // Build the system + user prompts. Persona becomes part of the system
  // prompt when present so the agent narrates as that role.
  const systemParts = [
    `You are an agentic worker dispatched by service "${service.name}".`,
    `Promise: ${service.promise}`,
  ]
  if (fn.persona) {
    systemParts.push(`Persona: ${fn.persona}`)
  }
  const system = systemParts.join('\n\n')

  const prompt = [
    `Step: ${fn.name}`,
    `Input: ${safeStringify(input)}`,
    `Carry value from previous step: ${safeStringify(carry)}`,
    `Available tools: ${requestedNames.join(', ') || '(none)'}`,
    `Use the tools to complete the step. When you have a final answer that satisfies ` +
      `the schema, return plain text describing it.`,
  ].join('\n\n')

  // AgenticFunctionRef does not yet declare a `modelHint` (the field lives on
  // GenerativeFunctionRef only). Default to 'sonnet' for now; round 8 will
  // either add `modelHint` to AgenticFunctionRef or route via ModelPolicy.
  const model = 'sonnet'

  // Track per-iteration progress. `onStepFinish` fires once per model step
  // (one model call + tool execution). We use it to emit cascade-progress
  // events back through the InvocationHandle.
  let callCount = 0
  const result = await generateText({
    model,
    system,
    prompt,
    tools: sdkTools,
    maxSteps: maxIterations,
    // The AI SDK's `onStepFinish` fires after each model step. We can't
    // reference it via the typed options here (the SDK's type is wrapped),
    // so we attach it via the loose extension permitted by GenerateTextOptions.
    ...({
      onStepFinish: (_step: unknown) => {
        callCount++
        emit({
          kind: 'cascade-progress',
          functionRef: fn.name,
          pct: stepProgressBase + (callCount / maxIterations) * 0.0001,
        })
        emit({
          kind: 'preview-available',
          slot: `${fn.name}:iter:${callCount}`,
          payload: {},
        })
      },
    } as Record<string, unknown>),
  } as Parameters<typeof generateText>[0])

  // The final value is either the schema-typed text (when the schema is
  // string-y) or a coerced parse of the text. Round 7 keeps this loose:
  // we trust the model's final text for non-string schemas; round 8 will
  // route through `generateObject` for the final shaping pass.
  const finalText = (result as { text?: string }).text ?? ''
  let value: unknown = finalText
  if (schema._def?.typeName !== 'ZodString') {
    // Best-effort coercion — if the model emitted JSON, parse it; else
    // keep the raw text and let the consumer's runtime validate.
    try {
      value = JSON.parse(finalText) as unknown
    } catch {
      value = finalText
    }
  }

  const costUsd = estimateCostFromUsage((result as { usage?: unknown }).usage, model)
  return { value, costUsd }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Convert a digital-tools `ToolParameter[]` into a single Zod object schema
 * suitable for the AI SDK's `tools[name].parameters` slot.
 *
 * Round-7 simplification: each parameter becomes a `z.unknown()` field with
 * a description copied across; required-ness is honoured via `.optional()`.
 * Round 8 will route through a JSON-Schema → Zod converter so per-field
 * validation kicks in (today the model's tool-call args are passed through
 * to the tool handler unchecked beyond presence/absence).
 */
function toolParametersToZod(params: ReadonlyArray<ToolParameter>): ZodTypeAny {
  const shape: Record<string, ZodTypeAny> = {}
  for (const p of params) {
    const field: ZodTypeAny = z.unknown().describe(p.description)
    shape[p.name] = p.required === false ? field.optional() : field
  }
  return z.object(shape)
}

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
