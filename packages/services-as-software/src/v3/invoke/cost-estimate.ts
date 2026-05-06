/**
 * cost-estimate — shared LLM-cost heuristic used across the v3 invoke
 * machinery (cascade walker, evaluator panel).
 *
 * Round-7/8 status: a deliberately naïve token-count → USD estimator that
 * mirrors what was previously duplicated inline in `cascade-walker.ts` and
 * `evaluator-panel.ts`. The single source of truth here keeps the two
 * dispatchers in lock-step so a panel-call's reported cost matches a
 * cascade-step's reported cost when both hit the same model.
 *
 * TODO(round 9): route through `ai-functions.budget` for per-model pricing
 * tables, provider markups, batch-API discounts, and tenant-level rate
 * agreements. Until then, a Sonnet-class flat rate is used regardless of the
 * passed `model` argument; the `model` parameter is reserved to keep the
 * signature stable across the migration.
 *
 * @packageDocumentation
 */

/**
 * Naïve cost estimator from the AI SDK's `usage` shape. Uses a flat
 * Sonnet-class default ($3/M input, $15/M output) when token counts are
 * present; otherwise falls back to a $0.001 per-call placeholder.
 *
 * Returns USD as a `number` (sub-cent precision is preserved by the caller
 * via `usdToMicroCents` when settling into a {@link Money} amount).
 *
 * TODO(round 9): replace with `ai-functions.budget` integration — per-model
 * pricing tables, provider markups, and tenant-level rate agreements.
 */
export function estimateCostFromUsage(usage: unknown, _model?: string): number {
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
