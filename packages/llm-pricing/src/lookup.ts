/**
 * @primitives/llm-pricing — lookup helpers.
 *
 * The single source of truth for cost computation across the Phase-2
 * three-repo cascade. Throws on unknown slug/tier (per BYOK_GATEWAY_LIES
 * memory: silent zero is the lying-gateway pattern; loud failure beats
 * silent downgrade).
 */

import { PRICING_TABLE } from './pricing.js'
import type {
  HasPricingArgs,
  ModelPricing,
  PriceForArgs,
  PriceForResult,
  PricingTier,
} from './types.js'

/**
 * Compute USD cost for a known generation. Throws on:
 * - unknown slug (no rows for the slug at all)
 * - unknown/unmodeled tier for the slug (no row for the (slug, tier) pair)
 * - negative token counts (programming error — fail loud)
 *
 * Honors `contextTierBreakpoint` when present: if `inputTokens >=
 * breakpoint`, the entire request is billed at `contextTierAbove` rates
 * (matches Google's published billing model — the rate switches once the
 * input crosses 200K, applied to the full request).
 *
 * `cachedInputTokens` is billed at `cachedInputPer1M` when defined,
 * falling back to the regular input rate otherwise. Cached tokens are
 * SUBTRACTED from `inputTokens` to compute the non-cached portion — i.e.
 * `inputTokens` is the TOTAL input including any cached tokens.
 */
export function priceFor(args: PriceForArgs): PriceForResult {
  const { slug, tier, inputTokens, outputTokens, cachedInputTokens } = args

  if (inputTokens < 0 || outputTokens < 0 || (cachedInputTokens ?? 0) < 0) {
    throw new RangeError(
      `priceFor() requires non-negative token counts; got input=${inputTokens}, output=${outputTokens}, cachedInput=${
        cachedInputTokens ?? 0
      }`
    )
  }

  const row = findRow(slug, tier)

  // Pick the right rate block based on context-tier breakpoint.
  const useAbove =
    typeof row.contextTierBreakpoint === 'number' &&
    row.contextTierAbove !== undefined &&
    inputTokens >= row.contextTierBreakpoint
  const block = useAbove
    ? (row.contextTierAbove as NonNullable<typeof row.contextTierAbove>)
    : {
        inputPer1M: row.inputPer1M,
        outputPer1M: row.outputPer1M,
        cachedInputPer1M: row.cachedInputPer1M,
      }

  const cachedTok = Math.min(cachedInputTokens ?? 0, inputTokens)
  const nonCachedInputTok = inputTokens - cachedTok
  const cachedRate = block.cachedInputPer1M ?? block.inputPer1M

  const inputUsd =
    (nonCachedInputTok / 1_000_000) * block.inputPer1M + (cachedTok / 1_000_000) * cachedRate
  const outputUsd = (outputTokens / 1_000_000) * block.outputPer1M
  const totalUsd = inputUsd + outputUsd

  return { inputUsd, outputUsd, totalUsd }
}

/**
 * Returns the unique set of slugs in the table. Useful for adapters that
 * want to validate caller-supplied model ids before dispatching.
 */
export function listSlugs(): readonly string[] {
  const set = new Set<string>()
  for (const row of PRICING_TABLE) set.add(row.slug)
  return Array.from(set)
}

/**
 * Returns true if pricing exists for the given (slug, tier). Use this
 * when you need a non-throwing existence check before calling
 * `priceFor()` (e.g. a metering middleware that wants to fall back to
 * "unknown cost" telemetry rather than throwing on a not-yet-registered
 * model).
 */
export function hasPricing(args: HasPricingArgs): boolean {
  return PRICING_TABLE.some((row) => row.slug === args.slug && row.tier === args.tier)
}

/**
 * Returns all pricing rows for a slug, across all tiers. Useful for
 * tooling that wants to display "this model has standard + batch tiers"
 * in a UI.
 */
export function rowsForSlug(slug: string): readonly ModelPricing[] {
  return PRICING_TABLE.filter((row) => row.slug === slug)
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function findRow(slug: string, tier: PricingTier): ModelPricing {
  const slugRows = PRICING_TABLE.filter((row) => row.slug === slug)
  if (slugRows.length === 0) {
    throw new Error(
      `Unknown model slug: '${slug}'. Known slugs: ${listSlugs().slice(0, 8).join(', ')}${
        listSlugs().length > 8 ? `, ...(${listSlugs().length - 8} more)` : ''
      }`
    )
  }
  const tierRow = slugRows.find((row) => row.tier === tier)
  if (tierRow === undefined) {
    const availableTiers = slugRows.map((row) => row.tier)
    throw new Error(
      `No '${tier}' pricing for slug '${slug}'. Available tiers: ${availableTiers.join(', ')}`
    )
  }
  return tierRow
}
