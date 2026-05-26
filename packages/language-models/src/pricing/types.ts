/**
 * language-models / pricing — type definitions for the canonical pricing table.
 *
 * Schema design notes (sb-ncer 2026-05-07):
 *
 * 1. **Provider** is the upstream API surface, not the model family. AWS
 *    Bedrock hosts Anthropic Claude, but `provider: 'bedrock'` (not
 *    `'anthropic'`) — same model, different cost when consumed via
 *    Anthropic's first-party API key (provider: 'anthropic' would be a
 *    DIFFERENT row with potentially different rates).
 *
 * 2. **Slug** is the caller-facing string: `<provider>/<short-name>`.
 *    Multiple slugs (the cascade short slug, the SDK-native id, etc.)
 *    can map to the same logical SKU — but for the canonical primitive
 *    we only carry the cascade short slug (`vertex/gemini-3.1-pro`,
 *    `bedrock/claude-opus-4-7`). Adapter packages can layer their own
 *    rewrite tables on top.
 *
 * 3. **Tier** distinguishes pricing modes for the same SKU:
 *    - `standard`: synchronous interactive pricing (full price)
 *    - `batch`: async batch-prediction pricing (typically 50% discount)
 *    - `flex`: flex-tier pricing (Vertex's name for batch, kept as alias)
 *    - `provisioned`: provisioned-throughput pricing (per-hour, not
 *      currently modeled — placeholder for future PT entries)
 *
 * 4. **contextTierBreakpoint + contextTierAbove**: Gemini 3.x SKUs apply
 *    a 2× rate above 200K input tokens; Anthropic Claude pricing is flat.
 *    Optional fields — when absent, the base rate applies regardless of
 *    input size.
 */

export type Provider = 'vertex' | 'bedrock' | 'openai' | 'anthropic' | 'google-ai-studio'

export type PricingTier = 'standard' | 'batch' | 'flex' | 'provisioned'

/** Rates expressed in USD per 1,000,000 tokens. */
export interface RateBlock {
  /** USD per 1M input tokens. */
  readonly inputPer1M: number
  /** USD per 1M output (completion) tokens. */
  readonly outputPer1M: number
  /**
   * Optional USD per 1M cached input tokens (prompt-caching tier). When
   * absent, callers should fall back to inputPer1M (no cache discount).
   */
  readonly cachedInputPer1M?: number
}

/**
 * Single canonical pricing row. Identity is `(slug, tier)` — provider is
 * derived from the slug prefix and stored explicitly only for tooling
 * convenience.
 */
export interface ModelPricing extends RateBlock {
  readonly provider: Provider
  readonly slug: string
  readonly tier: PricingTier
  /**
   * Token count at which pricing changes (inclusive — i.e. inputs >=
   * breakpoint use contextTierAbove). Currently only Gemini 3.x SKUs
   * have a breakpoint (200_000). Anthropic Claude has flat pricing.
   */
  readonly contextTierBreakpoint?: number
  /** Rates that apply when inputTokens >= contextTierBreakpoint. */
  readonly contextTierAbove?: RateBlock
}

export interface PriceForArgs {
  readonly slug: string
  readonly tier: PricingTier
  readonly inputTokens: number
  readonly outputTokens: number
  /**
   * Optional cached input tokens (subset of inputTokens that hit a
   * prompt-caching tier). Billed at cachedInputPer1M when the row
   * defines it; otherwise at inputPer1M (i.e. no discount).
   */
  readonly cachedInputTokens?: number
}

export interface PriceForResult {
  readonly inputUsd: number
  readonly outputUsd: number
  readonly totalUsd: number
}

export interface HasPricingArgs {
  readonly slug: string
  readonly tier: PricingTier
}
