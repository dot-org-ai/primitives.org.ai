/**
 * services-as-software v4 — the DELIVERING-phase cascade EXECUTOR (aip-cnks.10).
 *
 * This is the concrete {@link CascadeExecutor} that drives a Deliverable's
 * `binding.cascade` step-by-step during the `DELIVERING` phase of the
 * invocation FSM (see `./invoke.ts`). It is the v4 port of the proven v3
 * step-walker (`../v3/invoke/cascade-walker.ts`), specialised to the v4
 * runtime ports and decoupled from the LLM substrate via an INJECTED
 * {@link FunctionRunner} port.
 *
 * ## The shape of "binding is data"
 *
 * A cascade is a `CascadeStep[]`. Each step is a {@link FunctionRef} carrying:
 *   - `fnKind` — `'Code' | 'Generative' | 'Agentic' | 'Human'` (the v4
 *     {@link FunctionKind} discriminant);
 *   - `fnId` / `name` — identity + a human label (the label rides the
 *     `cascade-progress` event's `functionRef`);
 *   - `args` — a JSON object whose values are LITERALS or `$ref` indirections
 *     (`{ $ref: 'step1.field' }`) resolved against an accumulating state bag;
 *   - `outputAs` — the bag key the step's result is bound under, so later
 *     steps can `$ref` it.
 *
 * The walker seeds the bag with `{ input }`, then for each step: resolves the
 * step's `args` against the bag, dispatches by `fnKind` through the injected
 * {@link FunctionRunner}, binds the result under `outputAs`, emits a
 * `cascade-progress` + `cost-incurred` event pair, and accumulates the running
 * cost. The final step's value is returned as the typed `TOut`.
 *
 * ## Why an injected runner (not a direct LLM call)
 *
 * Dispatch goes through {@link FunctionRunner} so tests inject a fake and make
 * NO real LLM / sandbox calls. The {@link aiFunctionsRunner} default wires the
 * three machine kinds to `ai-functions`:
 *   - `Code`       → ai-evaluate V8-isolate sandbox via
 *                    `ai-functions.defineFunction({ type: 'code' })`
 *                    (ADR-0010 — `new Function`/`eval` are banned);
 *   - `Generative` → `ai-functions.generateObject`;
 *   - `Agentic`    → `ai-functions.generateText` tool-use loop.
 * `Human` stays an INJECTED `HumanChannel` port (services-as-software is L6 and
 * must NOT import human-in-the-loop, L7). The default {@link aiFunctionsRunner}
 * rejects a Human step until a `humanChannel` is supplied.
 *
 * @packageDocumentation
 */

import { defineFunction, generateObject, generateText } from 'ai-functions'
import type { SandboxEnv } from 'ai-functions'

import type { Money } from 'business-as-code/finance'

import type { CascadeExecutor, ExecCtx } from './invoke.js'
import type { FunctionKind, InvocationEvent } from './types.js'

// ============================================================================
// The v4 cascade step shape — "binding is data"
// ============================================================================

/**
 * A `$ref` indirection inside a step's `args`: `{ $ref: 'step1.field.sub' }`
 * resolves to the value at that dotted path in the accumulating state bag.
 * The bag is seeded with `{ input }`, then each step's result is bound under
 * its `outputAs` key.
 */
export interface CascadeRef {
  $ref: string
}

/** Type guard: a value is a `{ $ref }` indirection. */
export function isCascadeRef(v: unknown): v is CascadeRef {
  return typeof v === 'object' && v !== null && typeof (v as { $ref?: unknown }).$ref === 'string'
}

/**
 * One cascade step — a v4-local {@link FunctionRef}. `args` values are either
 * literals or {@link CascadeRef} indirections; `outputAs` is the bag key the
 * step's result binds under.
 *
 * This is the v4 cascade-step shape — self-contained, NOT the heavy
 * `digital-tools` `FunctionRef` union (which the v3 walker consumed). v4 owns
 * its own minimal JSON-step shape so `binding.cascade` is plain data.
 */
export interface CascadeStep {
  /** Dispatch discriminant — the v4 {@link FunctionKind}. */
  fnKind: FunctionKind
  /** Stable Function `$id` (used to mint deterministic request/clarification ids). */
  fnId: string
  /** Human label — rides the `cascade-progress` event's `functionRef`. */
  name: string
  /** JSON args; values are literals or `{ $ref: 'path' }` indirections. */
  args: Record<string, unknown>
  /** Bag key the step's result binds under (so later steps can `$ref` it). */
  outputAs: string
  /** Optional model hint forwarded to the runner (Generative/Agentic). */
  modelHint?: string
  /** Optional tool ids (Agentic) — resolved by the runner against its registry. */
  toolPermissions?: readonly string[]
  /** Optional inline prose/description (Generative prompt seed, Human question). */
  description?: string
  /**
   * Inline source body for a `Code` step — runs in the ai-evaluate V8-isolate
   * sandbox via `ai-functions.defineFunction({ type: 'code' })` (ADR-0010). The
   * body receives the resolved `args` in scope and should `return` the result.
   */
  code?: string
}

/** The accumulating state bag the walker resolves `$ref`s against. */
export type StateBag = Record<string, unknown>

// ============================================================================
// $ref resolution
// ============================================================================

/** Thrown when a `$ref` path cannot be resolved against the state bag. */
export class CascadeRefError extends Error {
  readonly ref: string
  constructor(ref: string) {
    super(`unresolvable $ref: '${ref}' — no such path in the cascade state bag`)
    this.name = 'CascadeRefError'
    this.ref = ref
  }
}

/** Walk a dotted path (`'a.b.c'`) into a value, returning `undefined` if absent. */
function getPath(root: unknown, path: string): unknown {
  let cur: unknown = root
  for (const key of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

/**
 * Resolve a step's `args` against the state bag: each `{ $ref: 'path' }` value
 * is replaced by the value at that dotted path; literals pass through. Throws
 * {@link CascadeRefError} on an unresolvable ref so a mis-wired cascade fails
 * loudly rather than silently feeding `undefined` forward.
 */
export function resolveRefs(args: Record<string, unknown>, bag: StateBag): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(args)) {
    if (isCascadeRef(v)) {
      const resolved = getPath(bag, v.$ref)
      if (resolved === undefined) throw new CascadeRefError(v.$ref)
      out[k] = resolved
    } else {
      out[k] = v
    }
  }
  return out
}

// ============================================================================
// FunctionRunner — the injected dispatch port (no real LLM in tests)
// ============================================================================

/** A runner's result: the step's output value + the {@link Money} cost it incurred. */
export interface RunnerResult {
  value: unknown
  cost: Money
}

/** The per-step context handed to each runner method. */
export interface RunnerCtx {
  /** The resolved (`$ref`-free) args for this step. */
  args: Record<string, unknown>
  /** The original typed cascade input (for prompt context). */
  input: unknown
  /** The full accumulating bag (read-only — for richer prompt context). */
  bag: StateBag
}

/**
 * The dispatch port the {@link makeCascadeExecutor} walks through. Tests inject
 * a fake (no LLM); the {@link aiFunctionsRunner} default wires the three machine
 * kinds to `ai-functions` and leaves `Human` to an injected channel.
 */
export interface FunctionRunner {
  runCode(step: CascadeStep, ctx: RunnerCtx): Promise<RunnerResult>
  runGenerative(step: CascadeStep, ctx: RunnerCtx): Promise<RunnerResult>
  runAgentic(step: CascadeStep, ctx: RunnerCtx): Promise<RunnerResult>
  runHuman(step: CascadeStep, ctx: RunnerCtx): Promise<RunnerResult>
}

// ============================================================================
// aiFunctionsRunner — the real default (ai-functions; Human = injected channel)
// ============================================================================

const ZERO_MONEY: Money = { amount: 0n, currency: 'USD' }

/** Convert a USD dollar float to a `bigint` micro-cent count (1e-6 of a cent). */
function usdToMicroCents(usd: number): bigint {
  return BigInt(Math.round(usd * 100_000_000))
}

/** JSON.stringify with bigint coercion (amounts carry bigint). */
function safeStringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val))
}

/**
 * The Human dispatch seam. services-as-software (L6) must NOT import
 * human-in-the-loop (L7), so a Human step routes to this INJECTED port. A
 * concrete adapter (CLI prompt, inbox, human-in-the-loop) is supplied by the
 * caller; the default {@link aiFunctionsRunner} rejects Human until one is wired.
 */
export interface HumanChannel {
  ask(step: CascadeStep, ctx: RunnerCtx): Promise<RunnerResult>
}

/** Options for the {@link aiFunctionsRunner} default. */
export interface AiFunctionsRunnerOpts {
  /** Default model alias for Generative/Agentic steps with no `modelHint`. */
  defaultModel?: string
  /** Injected Human dispatch port. Absent ⇒ Human steps reject. */
  humanChannel?: HumanChannel
  /**
   * Optional host Workers `env` carrying the `LOADER` binding for the
   * ai-evaluate sandbox. Absent ⇒ the Node/Miniflare fallback is used.
   */
  sandboxEnv?: SandboxEnv
}

/**
 * The real default {@link FunctionRunner}: wires the three machine kinds to
 * `ai-functions` (ADR-0010 sandbox for Code; `generateObject` for Generative;
 * `generateText` tool-loop for Agentic). `Human` routes to the injected
 * {@link HumanChannel}, rejecting with a clear stub when none is supplied.
 *
 * NOTE: this runner makes REAL LLM / sandbox calls. Tests must inject a fake
 * runner instead — the executor is decoupled from this default by construction.
 */
export function aiFunctionsRunner(opts: AiFunctionsRunnerOpts = {}): FunctionRunner {
  const defaultModel = opts.defaultModel ?? 'sonnet'

  return {
    async runCode(step, ctx): Promise<RunnerResult> {
      // Code Functions run in the ai-evaluate V8-isolate sandbox (ADR-0010) via
      // the exported `defineFunction({ type: 'code' })` surface — `new
      // Function`/`eval` are banned. The step's `code` body receives the
      // resolved `args` in scope and `return`s the result; zero LLM cost.
      const fn = defineFunction<unknown, Record<string, unknown>>({
        type: 'code',
        name: step.name,
        args: {},
        code: step.code ?? 'return args',
      })
      const value = await fn.call(ctx.args, opts.sandboxEnv)
      return { value, cost: ZERO_MONEY }
    },

    async runGenerative(step, ctx): Promise<RunnerResult> {
      const model = step.modelHint ?? defaultModel
      const prompt = [
        step.description ?? `Step: ${step.name}`,
        `Args: ${safeStringify(ctx.args)}`,
      ].join('\n\n')
      // A permissive object schema — the step is expected to declare its own
      // output contract in a later pass; for now we accept any JSON object.
      const result = await generateObject<Record<string, unknown>>({
        model,
        schema: { result: 'the step output' },
        prompt,
      })
      const costUsd = estimateUsd((result as { usage?: unknown }).usage)
      return { value: result.object, cost: { amount: usdToMicroCents(costUsd), currency: 'USD' } }
    },

    async runAgentic(step, ctx): Promise<RunnerResult> {
      const model = step.modelHint ?? defaultModel
      const prompt = [
        step.description ?? `Step: ${step.name}`,
        `Args: ${safeStringify(ctx.args)}`,
        `Available tools: ${(step.toolPermissions ?? []).join(', ') || '(none)'}`,
      ].join('\n\n')
      const result = await generateText({
        model,
        prompt,
        maxSteps: 10,
      } as Parameters<typeof generateText>[0])
      const text = (result as { text?: string }).text ?? ''
      const costUsd = estimateUsd((result as { usage?: unknown }).usage)
      return { value: text, cost: { amount: usdToMicroCents(costUsd), currency: 'USD' } }
    },

    async runHuman(step, ctx): Promise<RunnerResult> {
      if (!opts.humanChannel) {
        throw new Error(
          `Human step '${step.name}' requires an injected HumanChannel — ` +
            `services-as-software (L6) cannot import human-in-the-loop (L7); ` +
            `pass aiFunctionsRunner({ humanChannel }) to wire it.`
        )
      }
      return opts.humanChannel.ask(step, ctx)
    },
  }
}

/** Best-effort USD estimate from an AI-SDK `usage` object (round-up duck-typing). */
function estimateUsd(usage: unknown): number {
  if (usage == null || typeof usage !== 'object') return 0
  const u = usage as { totalTokens?: number; inputTokens?: number; outputTokens?: number }
  const total = u.totalTokens ?? (u.inputTokens ?? 0) + (u.outputTokens ?? 0)
  // Coarse Sonnet-ish blended estimate: ~$6 / 1M tokens. Real per-model pricing
  // lands when this routes through ai-functions BudgetTracker.
  return (total / 1_000_000) * 6
}

// ============================================================================
// makeCascadeExecutor — the sequential step-walker
// ============================================================================

/** Dependencies for {@link makeCascadeExecutor}. */
export interface MakeCascadeExecutorDeps {
  /** The Deliverable's `binding.cascade` — the JSON steps to walk. */
  cascade: readonly CascadeStep[]
  /** The dispatch port (inject a fake in tests; default {@link aiFunctionsRunner}). */
  runner?: FunctionRunner
}

/**
 * Build a concrete {@link CascadeExecutor} that walks `cascade` sequentially:
 *
 *   1. seed the state bag with `{ input }`;
 *   2. for each step — resolve `args` (`$ref` → bag values), dispatch by
 *      `fnKind` through the {@link FunctionRunner}, bind the result under
 *      `outputAs`, emit `cascade-progress` + `cost-incurred`, accumulate cost;
 *   3. return the LAST step's value as the typed `TOut` (or the input when the
 *      cascade is empty).
 *
 * The returned executor plugs straight into `createInvocationHandle({ executor })`.
 */
export function makeCascadeExecutor<TIn, TOut>(
  deps: MakeCascadeExecutorDeps
): CascadeExecutor<TIn, TOut> {
  const runner = deps.runner ?? aiFunctionsRunner()
  const cascade = deps.cascade

  return {
    async execute(ctx: ExecCtx<TIn, TOut>): Promise<TOut> {
      const bag: StateBag = { input: ctx.input }
      let cumulative: Money = { ...ctx.cost }
      let last: unknown = ctx.input

      for (let i = 0; i < cascade.length; i++) {
        const step = cascade[i]!
        const pct = ((i + 1) / cascade.length) * 100

        ctx.emit({ kind: 'cascade-progress', functionRef: step.name, pct })

        const resolvedArgs = resolveRefs(step.args, bag)
        const runnerCtx: RunnerCtx = { args: resolvedArgs, input: ctx.input, bag }
        const { value, cost } = await dispatch(runner, step, runnerCtx)

        bag[step.outputAs] = value
        last = value

        cumulative = addMoney(cumulative, cost)
        ctx.emit({
          kind: 'cost-incurred',
          cost,
          cumulative,
          functionRef: step.name,
        } as InvocationEvent<TOut>)
      }

      return last as TOut
    },
  }
}

/** Route a step to its runner method by `fnKind`. */
function dispatch(
  runner: FunctionRunner,
  step: CascadeStep,
  ctx: RunnerCtx
): Promise<RunnerResult> {
  switch (step.fnKind) {
    case 'Code':
      return runner.runCode(step, ctx)
    case 'Generative':
      return runner.runGenerative(step, ctx)
    case 'Agentic':
      return runner.runAgentic(step, ctx)
    case 'Human':
      return runner.runHuman(step, ctx)
  }
}

/** Add two same-currency {@link Money} values (mismatched currencies throw). */
function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`cannot add Money of different currencies: ${a.currency} + ${b.currency}`)
  }
  return { amount: a.amount + b.amount, currency: a.currency }
}
