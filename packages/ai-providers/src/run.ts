/**
 * Multi-provider execution driver (L1 runtime).
 *
 * `language-models` (L0) owns the *declarative* multi-provider decision —
 * `selectionFor(spec)` builds the ordered provider-candidate chain and
 * `isQuotaError` / `nextCandidate` classify and step it. This module owns the
 * *execution* half: `runWithFallback` walks that chain, invoking a
 * caller-supplied function against each candidate and falling back to the next
 * one on a quota / rate-limit error.
 *
 * This is the seam the `model.run(PreparedGeneration)` adapter in `ai-functions`
 * wraps around its AI-SDK call: `ai-functions` resolves a selection plan via
 * `language-models`, then hands this driver an `invoke` closure that performs
 * the actual `generateObject` / `generateText` against a concrete candidate.
 * The driver owns the failover loop; the closure owns the transport. No
 * provider transport is implemented here — `runWithFallback` is transport- and
 * payload-agnostic, so it composes with the existing AI-SDK registry
 * (`createRegistry` / `model`) without duplicating it.
 *
 * @packageDocumentation
 */

import { nextCandidate, type ProviderCandidate } from 'language-models'

/**
 * The function a caller runs against a single provider candidate. Receives the
 * candidate and its index in the plan. Should throw on failure — a quota /
 * rate-limit error triggers fallback to the next candidate; any other error is
 * surfaced immediately.
 */
export type InvokeCandidate<T> = (candidate: ProviderCandidate, index: number) => Promise<T>

/**
 * Result envelope from {@link runWithFallback}: the value produced, the
 * candidate that produced it, and how many candidates were attempted (1 = the
 * primary succeeded; > 1 means fallback occurred).
 */
export interface FallbackResult<T> {
  readonly value: T
  readonly candidate: ProviderCandidate
  readonly attempts: number
}

/**
 * Run `invoke` against the provider-candidate `plan`, falling back to the next
 * candidate on each quota / rate-limit error.
 *
 * - First candidate succeeds → returns its value with `attempts: 1`.
 * - Quota error → steps to the next candidate (via `nextCandidate`).
 * - Non-quota error → rethrown immediately (a different model won't fix a bad
 *   schema or a 4xx; the fallback is for *capacity*, not correctness).
 * - Chain exhausted on quota errors → the last quota error is rethrown.
 *
 * @throws if `plan` is empty.
 *
 * @example
 * ```ts
 * import { selectionFor } from 'language-models'
 * import { runWithFallback } from 'ai-providers'
 *
 * const plan = selectionFor('opus')               // opus → sonnet → ...
 * const { value, candidate, attempts } = await runWithFallback(plan, (c) =>
 *   generateObject({ model: registry.languageModel(`${c.provider}:${c.providerModelId}`), ... })
 * )
 * ```
 */
export async function runWithFallback<T>(
  plan: readonly ProviderCandidate[],
  invoke: InvokeCandidate<T>
): Promise<FallbackResult<T>> {
  if (plan.length === 0) {
    throw new Error('runWithFallback: candidate plan is empty')
  }

  let index = 0
  let attempts = 0
  let lastErr: unknown

  while (index !== null && index < plan.length) {
    const candidate = plan[index]!
    attempts++
    try {
      const value = await invoke(candidate, index)
      return { value, candidate, attempts }
    } catch (err) {
      lastErr = err
      const next = nextCandidate(plan, index, err)
      if (next === null) throw err
      index = next
    }
  }

  // Chain exhausted on quota errors.
  throw lastErr
}
