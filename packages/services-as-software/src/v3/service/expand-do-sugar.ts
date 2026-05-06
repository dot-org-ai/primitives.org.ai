/**
 * `expandDoSugar(spec)` — entry point for the Tier-0 `do:` template-literal
 * sugar (v3 §5 Tier-0 example).
 *
 * The Tier-0 5-line case looks like:
 *
 * ```ts
 * const summarize = $.services.define({
 *   name: 'Summarize',
 *   promise: 'One-paragraph summary of any text.',
 *   do: ($) => $`summarize: ${$.input.text}`,
 * })
 * ```
 *
 * `do:` is a function returning a tagged template; expansion walks the
 * `TemplateStringsArray` to:
 *
 *   1. Synthesise `schema.input` from placeholder names (each `${$.input.X}`
 *      becomes a string-typed field `X`).
 *   2. Default `schema.output` to `z.string()`.
 *   3. Synthesise `binding.cascade = [Generative({ name + '-do', do: ... })]`.
 *
 * **Round 3 status:** the entry point exists and is type-safe, but the body
 * is not yet implemented — Tier-0 sugar requires the `ai-functions` runtime
 * to dispatch the `Generative` step and the Standard Schema vendor to
 * synthesise schemas at call time. Both land in round 4 alongside
 * `Service.invoke` FSM.
 *
 * Today, calling `expandDoSugar` on a spec that uses `do:` throws
 * `NotImplementedError` so the failure surface is loud and obvious. Specs
 * without `do:` pass through untouched.
 *
 * @packageDocumentation
 */

import type { ServiceSpec } from '../service-spec.js'

// ============================================================================
// Tier-0 spec extension shape (compile-time only)
// ============================================================================

/**
 * Tier-0 sugar callback shape. Receives a `$` proxy carrying the input
 * placeholders and a tagged-template-literal renderer; returns the rendered
 * prompt that drives the synthesised `Generative` cascade step.
 *
 * Kept loose-typed (`unknown`) here — the runtime resolves the actual proxy
 * shape in round 4.
 */
export type TierZeroDoCallback = (dollar: unknown) => unknown

/**
 * `ServiceSpec` augmented with the optional Tier-0 `do:` sugar field.
 *
 * `Service.define()` accepts this shape, calls `expandDoSugar` to lower
 * `do:` into explicit `schema` + `binding`, then proceeds with the normalised
 * spec.
 */
export interface ServiceSpecWithDoSugar<TIn, TOut> extends Partial<ServiceSpec<TIn, TOut>> {
  name: string
  promise: string
  /** Tier-0 5-line sugar; mutually-exclusive with explicit `binding.cascade`. */
  do?: TierZeroDoCallback
}

// ============================================================================
// Errors
// ============================================================================

/**
 * Thrown when a code path that requires round-4+ runtime wiring is hit
 * before that wiring lands. The presence of this error type keeps the API
 * shape stable: round-4 work removes the throws without changing signatures.
 */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotImplementedError'
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Lower a Tier-0 `do:` spec to a normalised {@link ServiceSpec}.
 *
 * - Spec without `do:` → returned unchanged (cast to drop the sugar field).
 * - Spec with `do:`    → throws {@link NotImplementedError} (round-4 work).
 *
 * The pass-through behaviour for non-`do:` specs is intentional: round 3
 * uses this function unconditionally inside `Service.define()` so round 4
 * can drop in the real expansion without touching the call site.
 */
export function expandDoSugar<TIn, TOut>(
  spec: ServiceSpecWithDoSugar<TIn, TOut>
): ServiceSpec<TIn, TOut> {
  if (spec.do !== undefined) {
    throw new NotImplementedError(
      `Tier-0 'do:' sugar requires ai-functions runtime integration; ` +
        `arrives in round 4 alongside Service.invoke. ` +
        `Workaround: pass an explicit schema + binding.cascade for now.`
    )
  }

  // Pass-through: strip the sugar field, return the canonical spec.
  // We assume the caller supplied the required canonical fields; the body of
  // Service.define() validates that immediately after.
  const { do: _do, ...rest } = spec
  void _do
  return rest as ServiceSpec<TIn, TOut>
}
