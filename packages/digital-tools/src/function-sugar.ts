/**
 * Sugar factories for the Four Functions (v3 §6).
 *
 * Top-level named exports `Code` / `Generative` / `Agentic` / `Human` mint a
 * typed {@link FunctionRef} from a kind-specific spec. The factory fills in
 * the discriminator (`kind`) and a deterministic `$id` derived from `name`,
 * so callers write the minimum possible at the call site:
 *
 * ```ts
 * import { Code, Generative, Agentic, Human } from 'digital-tools'
 *
 * const summarize = Generative({ name: 'summarize', modelHint: 'claude-opus-4' })
 * const reviewer  = Agentic({ name: 'security-review', mode: 'supervised', persona: 'persona:skeptic' })
 * const signOff   = Human({ name: 'controller-sign-off', rationale: 'regulatory',
 *                            expirationPolicy: { whenAccuracyExceeds: 0.99, whenSamplesExceed: 500 } })
 * const compute   = Code({ name: 'compute-vat', handler: (x: { net: number }) => x.net * 0.2 })
 * ```
 *
 * @packageDocumentation
 */

import type {
  AgenticFunctionRef,
  CodeFunctionRef,
  FunctionRef,
  GenerativeFunctionRef,
  HumanFunctionRef,
} from './function-ref.js'

/**
 * Reduce an arbitrary name to a stable, lowercase, hyphen-joined slug.
 * Non-ASCII alphanumerics collapse to `-`; leading/trailing `-` are trimmed.
 */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Mint a deterministic `fn:<kind>:<slug>` MDXLD `$id`.
 */
function mintId(kind: FunctionRef['kind'], name: string): string {
  return `fn:${kind}:${slug(name)}`
}

// ============================================================================
// Code
// ============================================================================

/**
 * Spec accepted by the {@link Code} sugar factory. Omits the auto-derived
 * `$id` and the discriminator `kind`.
 */
export type CodeFunctionSpec<TInput = unknown, TOutput = unknown> = Omit<
  CodeFunctionRef<TInput, TOutput>,
  '$id' | 'kind'
>

/**
 * Mint a {@link CodeFunctionRef}. The `handler` may be an inline function or
 * an `ActionRef` string into `digital-objects`.
 */
export function Code<TInput = unknown, TOutput = unknown>(
  spec: CodeFunctionSpec<TInput, TOutput>
): CodeFunctionRef<TInput, TOutput> {
  return {
    $id: mintId('code', spec.name),
    kind: 'code',
    ...spec,
  }
}

// ============================================================================
// Generative
// ============================================================================

/**
 * Spec accepted by the {@link Generative} sugar factory.
 */
export type GenerativeFunctionSpec = Omit<GenerativeFunctionRef, '$id' | 'kind'>

/**
 * Mint a {@link GenerativeFunctionRef} — single-shot LLM call.
 */
export function Generative(spec: GenerativeFunctionSpec): GenerativeFunctionRef {
  return {
    $id: mintId('generative', spec.name),
    kind: 'generative',
    ...spec,
  }
}

// ============================================================================
// Agentic
// ============================================================================

/**
 * Spec accepted by the {@link Agentic} sugar factory.
 */
export type AgenticFunctionSpec = Omit<AgenticFunctionRef, '$id' | 'kind'>

/**
 * Mint an {@link AgenticFunctionRef} — looping, tool-using AI worker.
 */
export function Agentic(spec: AgenticFunctionSpec): AgenticFunctionRef {
  return {
    $id: mintId('agentic', spec.name),
    kind: 'agentic',
    ...spec,
  }
}

// ============================================================================
// Human
// ============================================================================

/**
 * Spec accepted by the {@link Human} sugar factory.
 */
export type HumanFunctionSpec = Omit<HumanFunctionRef, '$id' | 'kind'>

/**
 * Mint a {@link HumanFunctionRef} — work performed by a person, with a
 * declared rationale and migration policy.
 */
export function Human(spec: HumanFunctionSpec): HumanFunctionRef {
  return {
    $id: mintId('human', spec.name),
    kind: 'human',
    ...spec,
  }
}
