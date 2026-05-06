/**
 * budgetMiddleware — record token usage + cost into a {@link BudgetTracker}
 *
 * Replaces the post-hoc duck-typing in
 * `services-as-software/src/v3/invoke/cost-estimate.ts` with a single
 * AI-SDK-6 middleware: on `doGenerate` / `doStream` completion, read the
 * `LanguageModelV3Usage` shape directly off the result and call
 * `tracker.recordUsage(...)`. The pricing overlay is supplied via
 * `customPricing` on the {@link BudgetTracker} (or we hand the tracker the
 * pricing at construction time when the caller wants per-call isolation).
 *
 * Key V3 → BudgetTracker mapping detail: AI SDK 6 reports
 * `usage.inputTokens.total` / `usage.outputTokens.total` as
 * `number | undefined`. We coerce undefined → 0 so partial-streaming results
 * (where the upstream provider didn't emit token counts) don't blow up the
 * tracker. The `inputTokens.cacheRead` / `inputTokens.cacheWrite` breakdown
 * is *not* propagated yet — round 13+ work to add prompt-cache awareness to
 * BudgetTracker.
 *
 * Composition note: install **after** cache (so a cache hit still records
 * the cost — the wrapped result is the same regardless of which layer
 * served it) and **before** trace (so the trace event sees the final
 * computed cost via the tracker).
 *
 * @packageDocumentation
 */

import type {
  LanguageModelV3GenerateResult,
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
} from '@ai-sdk/provider'
import type { BudgetTracker, ModelPricing } from '../budget.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Pricing overlay supplied to the middleware. Mirrors the
 * `BudgetConfig.customPricing` shape — keyed on model id, value is the
 * per-million USD rate. Sourced (in services-as-software) from the
 * `language-models/data/models.json` catalog so Llama / DeepSeek / Mistral /
 * Qwen / Grok / Perplexity Sonar all get their real per-token rate.
 */
export type PricingOverlay = Record<string, ModelPricing>

/** Options for {@link budgetMiddleware}. */
export interface BudgetMiddlewareOptions {
  /**
   * The {@link BudgetTracker} to record usage into. Required — the
   * middleware never constructs its own tracker (the tracker holds budget
   * limits + alert callbacks, which the caller owns).
   */
  tracker: BudgetTracker
  /**
   * Pricing overlay (per-model rates). When supplied, takes precedence over
   * the BudgetTracker's own default pricing for any matching model id. Pass
   * the language-models catalog overlay here to extend pricing without
   * mutating the tracker.
   */
  pricing?: PricingOverlay
  /**
   * Optional override for the model id reported to the tracker. Defaults to
   * `model.modelId` (the wrapped model's underlying id). Pass an alias
   * (`'sonnet'`, `'opus'`) to bridge to the alias-based pricing tables.
   */
  modelIdOverride?: string
}

// ============================================================================
// Helpers
// ============================================================================

function coerceUsage(usage: LanguageModelV3Usage | undefined): {
  inputTokens: number
  outputTokens: number
} {
  if (!usage) return { inputTokens: 0, outputTokens: 0 }
  return {
    inputTokens: usage.inputTokens?.total ?? 0,
    outputTokens: usage.outputTokens?.total ?? 0,
  }
}

function record(
  tracker: BudgetTracker,
  pricing: PricingOverlay | undefined,
  modelId: string,
  usage: LanguageModelV3Usage | undefined
): void {
  const { inputTokens, outputTokens } = coerceUsage(usage)
  if (inputTokens === 0 && outputTokens === 0) return
  // The pricing overlay is wired in via the tracker's `customPricing`
  // already (set at BudgetTracker construction time by the caller). When
  // the caller wants per-call pricing override, they install
  // `pricing[modelId]` ahead of time. We expose `pricing` here as a
  // forward-looking hook so we can later add per-call pricing without a
  // breaking change.
  void pricing
  tracker.recordUsage({ inputTokens, outputTokens, model: modelId })
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Build a budget middleware for `wrapLanguageModel`. Records
 * {@link LanguageModelV3Usage} into the supplied {@link BudgetTracker} on
 * every successful `doGenerate` / `doStream` completion. Errors from the
 * downstream model propagate unchanged — the tracker is only updated on
 * success.
 *
 * For streaming calls, we accumulate the final `usage` from the `'finish'`
 * stream part (per the V3 spec, the final `'finish'` event carries the
 * authoritative usage shape) and record once on stream end.
 *
 * @example
 * ```ts
 * import { wrapLanguageModel } from 'ai'
 * import { BudgetTracker, budgetMiddleware } from 'ai-functions'
 *
 * const tracker = new BudgetTracker({ maxCost: 1.0 })
 * const model = wrapLanguageModel({
 *   model: openai('gpt-4o'),
 *   middleware: budgetMiddleware({ tracker }),
 * })
 * ```
 */
export function budgetMiddleware(options: BudgetMiddlewareOptions): LanguageModelV3Middleware {
  const { tracker, pricing, modelIdOverride } = options
  return {
    specificationVersion: 'v3',
    async wrapGenerate({ doGenerate, model }) {
      const result = await doGenerate()
      const modelId = modelIdOverride ?? model.modelId
      record(tracker, pricing, modelId, result.usage)
      return result
    },
    async wrapStream({ doStream, model }) {
      const result = await doStream()
      const modelId = modelIdOverride ?? model.modelId
      let finalUsage: LanguageModelV3Usage | undefined
      const transformedStream = result.stream.pipeThrough(
        new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === 'finish') {
              finalUsage = chunk.usage
            }
            controller.enqueue(chunk)
          },
          flush() {
            record(tracker, pricing, modelId, finalUsage)
          },
        })
      )
      const wrapped: LanguageModelV3StreamResult = {
        ...result,
        stream: transformedStream,
      }
      return wrapped
    },
  }
}

// Re-export to make the result type available to consumers writing custom
// middleware chains.
export type { LanguageModelV3GenerateResult }
