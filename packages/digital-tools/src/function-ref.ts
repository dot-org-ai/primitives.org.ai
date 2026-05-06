/**
 * FunctionRef — discriminated union of the Four Functions (v3 §6).
 *
 * The Services-as-Software book decomposes any cascade step into one of four
 * Function kinds:
 *
 *   - `code`        — deterministic, programmable. A pure function or a
 *                     reference to a code Action.
 *   - `generative`  — single-shot LLM call (no tool use, no agentic loop).
 *   - `agentic`     — looping, tool-using AI worker with a persona.
 *   - `human`       — work that *must* be performed by a person, with a
 *                     declared rationale + expiration policy describing the
 *                     conditions under which the Function may be migrated to
 *                     a non-human kind.
 *
 * Each kind carries the same per-Function knobs the v3 design pins:
 * a {@link RewardSignal} reference, a {@link CostModel}, an
 * {@link OversightPolicy}, and a {@link TrackRecord}. The agentic and human
 * variants additionally carry kind-specific shape (mode/persona vs.
 * rationale/expiration).
 *
 * This type is *additive* alongside the legacy {@link Tool} interface.
 * Existing tools are not migrated; new SaS cascades use `FunctionRef` directly.
 *
 * @packageDocumentation
 */

import type { ActionRef } from 'digital-objects'
import type { CostModel } from 'autonomous-finance'
import type { AgentMode, PromotionPolicy, TrackRecord } from './track-record.js'

// ============================================================================
// Reward (placeholder)
// ============================================================================

/**
 * Placeholder reward signal — the canonical type ships in `business-as-code`
 * once the OKR / KeyResult primitives land. Until then, a Function declares
 * the KeyResult it should be rewarded against by reference.
 *
 * The string form is an MDXLD `$id` that resolves to a KeyResult node in the
 * BaC graph (e.g. `'kr:revenue.q3.signups'`).
 */
export interface RewardSignal {
  /** `$id` of the KeyResult the Function moves the needle on. */
  keyResultRef: string
}

// ============================================================================
// Oversight + per-Function knobs shared across all four kinds
// ============================================================================

/**
 * Reusable persona reference for an agentic Function — typically a string
 * `$id` into the persona library shipped by `ai-evaluate`. Kept opaque here
 * to avoid a layer-up dependency on `ai-evaluate`.
 */
export type PersonaRef = string

/**
 * Sign-off policy on the output of an agentic Function before it is released
 * downstream. `none` means no per-invocation sign-off (autonomous);
 * `self` means the Function reviews its own output against its persona;
 * `peer` requires another agentic Function to approve; `human` requires a
 * human reviewer; `panel` defers to an EvaluatorPanel reference.
 */
export type SignOffMode = 'none' | 'self' | 'peer' | 'human' | 'panel'

/**
 * Declarative oversight gate applied per-invocation to a Function.
 *
 * `mode` selects the {@link AgentMode} the Function is currently operating in;
 * `promotion` (when present) is the {@link PromotionPolicy} that may move the
 * Function up or down the ladder based on its {@link TrackRecord}.
 */
export interface OversightPolicy {
  mode: AgentMode
  promotion?: PromotionPolicy
}

// ============================================================================
// Discriminated union
// ============================================================================

/**
 * Fields common to every Function kind. The discriminator (`kind`) is added
 * by each variant so consumers can narrow with a single switch.
 */
export interface BaseFunctionRef {
  /** MDXLD `$id` (e.g. `'fn:code:summarize'`). */
  $id: string
  /** Human-readable name used by the registry / UI. */
  name: string
  /** Optional one-line description rendered by catalog UIs. */
  description?: string
  /** Reward this Function is optimised against, when known. */
  reward?: RewardSignal
  /** Declared cost model — used for budgeting and price quoting. */
  costModel?: CostModel
  /** Per-Function oversight + autonomy policy. */
  oversight?: OversightPolicy
  /**
   * Accumulated quality / cost / override signal. Present on materialised
   * (registered) Functions; omitted on the spec passed to a sugar factory.
   */
  track?: TrackRecord
}

/**
 * Code Function — deterministic, programmable.
 *
 * `handler` may be either an inline function (preferred for in-process
 * Services) or an {@link ActionRef} string pointing at a registered Action
 * in `digital-objects` (preferred for cross-process / serialisable cascades).
 */
export interface CodeFunctionRef<TInput = unknown, TOutput = unknown> extends BaseFunctionRef {
  kind: 'code'
  handler: ((input: TInput) => TOutput | Promise<TOutput>) | ActionRef
}

/**
 * Generative Function — single-shot LLM call. No tool use, no loop.
 *
 * `modelHint` is an optional preferred model spec (e.g. `'claude-opus-4'`);
 * the runtime is free to substitute based on cost/availability policy.
 */
export interface GenerativeFunctionRef extends BaseFunctionRef {
  kind: 'generative'
  modelHint?: string
}

/**
 * Agentic Function — looping, tool-using AI worker with a persona and a
 * sign-off rule.
 */
export interface AgenticFunctionRef extends BaseFunctionRef {
  kind: 'agentic'
  /**
   * Operating mode for this Function specifically. Mirrors
   * {@link OversightPolicy.mode}; declared inline because the agentic kind is
   * the primary consumer of the autonomy ladder.
   */
  mode: AgentMode
  /**
   * Optional preferred model spec (e.g. `'claude-opus-4'`, `'sonnet'`).
   * Mirrors {@link GenerativeFunctionRef.modelHint}; the runtime is free to
   * substitute based on cost/availability/track-record policy. The
   * `services-as-software` cascade walker forwards this to
   * `ai-functions.generateText` for the agentic tool-use loop.
   */
  modelHint?: string
  /**
   * Tool ids registered with `digital-tools.defineTool`. Each id resolves to
   * exactly one {@link Tool} via the global registry. Scope-style strings
   * (e.g. `'github.repos'`) are accepted but treated as literal tool ids,
   * not permission scopes — the runtime does not expand `'github.repos'`
   * into the set of github repo tools. True scope→tools resolution
   * (capability-based permission expansion) is round-9+ work; until then,
   * list each concrete tool id explicitly.
   */
  toolPermissions?: string[]
  /**
   * Concurrency policy for this Function:
   *
   *   - `number`     — hard cap on concurrent invocations (caller picks N).
   *   - `'serial'`   — one invocation at a time (semantic alias for `1`).
   *   - `'fan-out'`  — semantic "fan out as wide as upstream emits"; the
   *                    cascade compiler chooses N at runtime based on the
   *                    upstream step's emitted batch size and ambient
   *                    cost-budget policy.
   *
   * Used by the runtime to bound cost on bursty workloads.
   */
  concurrency?: number | 'serial' | 'fan-out'
  /** Persona reference (typically into the `ai-evaluate` persona library). */
  persona?: PersonaRef
  /**
   * Sign-off requirement before the Function's output is released downstream.
   * Defaults to `'none'` for `mode === 'autonomous'`, `'human'` for
   * `mode === 'supervised'`, and `'human'` for `mode === 'manual'`.
   */
  signOff?: SignOffMode
}

/**
 * Reasons a step in the cascade *must* be performed by a human. Drives both
 * UX copy ("why is a human reviewing this?") and the migration policy
 * ({@link HumanFunctionRef.expirationPolicy} declares when the human step
 * may be replaced by a non-human Function).
 */
export type HumanRationale =
  | 'approval' // sign-off / authorisation cannot be delegated
  | 'physical' // requires a physical action in the world
  | 'regulatory' // law or policy mandates a human in the loop
  | 'trust' // customer pays specifically for human attention
  | 'premium' // human work is the value being sold

/**
 * Conditions under which a {@link HumanFunctionRef} may be migrated to a
 * non-human Function (typically an {@link AgenticFunctionRef}).
 *
 * The expiration is *declarative*: the policy is checked against the
 * Function's accumulated {@link TrackRecord} (and any sibling-Function
 * record indicated by `migrateTo`). When the predicate holds, the cascade
 * compiler may swap the Human Function for the named target Function with
 * the catalog operator's confirmation.
 */
export interface HumanExpirationPolicy {
  /** `$id` of the Function the human step should migrate to once eligible. */
  migrateTo?: string
  /**
   * Migrate when the cascade-without-the-human's accuracy exceeds this
   * threshold (0–1). The bookkeeper case ("could AI have decided this
   * correctly?") is the canonical example — see v3 §14 open decision.
   */
  whenAccuracyExceeds?: number
  /** Migrate when total samples exceed this count. */
  whenSamplesExceed?: number
}

/**
 * Channel used to dispatch work to a human. Opaque string so concrete
 * channels (Slack DM, email, in-app inbox, paging system, …) can be wired
 * by the runtime without a type change here.
 */
export type HumanChannel = string

/**
 * Human Function — work that must be performed by a person.
 *
 * Carries a declared {@link HumanRationale} (so UX can explain *why* a human
 * is in the loop) and an {@link HumanExpirationPolicy} (so the cascade can
 * eventually be migrated to a non-human Function once track-record allows).
 */
export interface HumanFunctionRef extends BaseFunctionRef {
  kind: 'human'
  rationale: HumanRationale
  expirationPolicy: HumanExpirationPolicy
  channel?: HumanChannel
}

/**
 * Discriminated union of the Four Functions. Narrow with `switch (fn.kind)`.
 */
export type FunctionRef =
  | CodeFunctionRef
  | GenerativeFunctionRef
  | AgenticFunctionRef
  | HumanFunctionRef

/**
 * Discriminator string union — convenient for table-driven dispatchers.
 */
export type FunctionKind = FunctionRef['kind']
