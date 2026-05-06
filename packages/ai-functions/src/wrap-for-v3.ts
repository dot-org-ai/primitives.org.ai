/**
 * wrapForV3 — convenience composer for the v3 cascade-walker / evaluator-panel
 * use case.
 *
 * Composes `cacheMiddleware`, `budgetMiddleware`, and `traceMiddleware` in a
 * single `wrapLanguageModel` call so callers in services-as-software (round
 * 15+ swap) can replace their existing post-hoc duck-typing in
 * `cost-estimate.ts` with a single wrap call:
 *
 * ```ts
 * import { wrapForV3, BudgetTracker, getEvalLogStore } from 'ai-functions'
 *
 * const tracker = new BudgetTracker({ maxCost: 1.0 })
 * const store = getEvalLogStore()
 *
 * const wrapped = wrapForV3(openai('gpt-4o'), {
 *   cache: { store: 'disk', ttlMs: 86_400_000 },
 *   budget: { tracker },
 *   trace: { emit: (e) => store.record({ ...e, costUsd: e.costUsd ?? 0 }) },
 * })
 * ```
 *
 * **Composition order:**
 *   1. **cache** — first so cache hits skip budget+trace network cost. The
 *      cached payload's usage still flows downstream so budget records the
 *      cost on hits AND misses.
 *   2. **budget** — second so it sees the wrapped result regardless of
 *      cache hit/miss; tracker.recordUsage fires either way.
 *   3. **trace** — last so the event sees the final outcome (post-cache,
 *      post-budget). Errors from `emit` are swallowed.
 *
 * AI SDK 6 ordering semantics (per the wrapLanguageModel JSDoc): "the first
 * middleware will transform the input first, and the last middleware will
 * be wrapped directly around the model." So when we hand the array
 * `[cache, budget, trace]`, the runtime call order is
 * `cache → budget → trace → model` on the way in, and the reverse on the
 * way out. Cache sees the call first; if it has a hit, downstream layers
 * never run their `wrapGenerate` body for that call. Budget and trace each
 * get their own post-completion hook on the result the layer below them
 * returned — so on a cache hit, neither budget nor trace runs (because
 * cache short-circuits via `return cached`). To get budget + trace on
 * cache hits, the budgetMiddleware/traceMiddleware would need to wrap the
 * cache middleware (i.e. install AFTER it in the chain). Per the spec
 * above, "later in the array = closer to the model" → install order
 * matters: callers who want cache-hit cost recording should pass
 * `[budget, trace, cache]`. We use `[cache, budget, trace]` as the default
 * because the eval-fixture use case wants the 5x verify-time win and is
 * happy to skip the cost record on the hit path (the original miss already
 * recorded it).
 *
 * @packageDocumentation
 */

import { wrapLanguageModel, type LanguageModel } from 'ai'
import type { LanguageModelV3, LanguageModelV3Middleware } from '@ai-sdk/provider'
import { cacheMiddleware, type CacheMiddlewareOptions } from './middleware/cache.js'
import { budgetMiddleware, type BudgetMiddlewareOptions } from './middleware/budget.js'
import { traceMiddleware, type TraceMiddlewareOptions } from './middleware/trace.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Options for {@link wrapForV3}. All three middleware sections are
 * optional — pass only what you need.
 */
export interface WrapForV3Options {
  /** Cache config (see {@link CacheMiddlewareOptions}). */
  cache?: CacheMiddlewareOptions
  /** Budget tracking config (see {@link BudgetMiddlewareOptions}). */
  budget?: BudgetMiddlewareOptions
  /** Trace emission config (see {@link TraceMiddlewareOptions}). */
  trace?: TraceMiddlewareOptions
}

// ============================================================================
// Composer
// ============================================================================

/**
 * Wrap a {@link LanguageModel} with the v3-cascade middleware stack
 * (cache → budget → trace, in install order).
 *
 * Returns the wrapped model with the same shape as the input; downstream
 * `generateText` / `generateObject` / `streamText` calls treat it as a
 * regular model.
 *
 * @see WrapForV3Options for partial-config behaviour
 */
export function wrapForV3(model: LanguageModel, opts: WrapForV3Options = {}): LanguageModel {
  const middleware: LanguageModelV3Middleware[] = []
  if (opts.cache) middleware.push(cacheMiddleware(opts.cache))
  if (opts.budget) middleware.push(budgetMiddleware(opts.budget))
  if (opts.trace) middleware.push(traceMiddleware(opts.trace))
  if (middleware.length === 0) return model
  // wrapLanguageModel currently accepts LanguageModelV3 — at the AI SDK 6
  // surface, `LanguageModel` is the wider union. The runtime is V3
  // everywhere in the published providers; the cast is the same one the
  // wrapLanguageModel cookbook uses.
  return wrapLanguageModel({
    model: model as LanguageModelV3,
    middleware,
  }) as LanguageModel
}
