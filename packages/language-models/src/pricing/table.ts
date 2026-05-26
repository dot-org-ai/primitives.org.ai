/**
 * language-models / pricing — canonical model pricing table.
 *
 * All rates are USD per 1,000,000 tokens (per1M form, NOT per1k). Sourced
 * from public list prices on 2026-05-07. Where prior repo tables disagree,
 * the most-recently-updated source wins:
 *
 * - **Vertex Gemini 3.x**: startup-builder/packages/llm-vertex-batch
 *   (sb-srnl 2026-05-07 verified) is canonical for the flex/batch tier.
 *   startup-builder/packages/llm-vertex (same date) is canonical for
 *   standard interactive pricing.
 * - **Vertex Gemini 2.5**: startup-builder/llm-vertex-batch is canonical
 *   (icps's `gemini-2.5-flash` rates were ~4× off — likely transposed
 *   from a different SKU).
 * - **Bedrock Anthropic**: startup-builder/packages/llm-bedrock is the
 *   most-recently-curated table (matches AWS Bedrock public pricing on
 *   2026-05-07).
 * - **Embeddings**: icps/packages/llm/pricing.ts is the source for
 *   `gemini-embedding-2`. Bedrock has no first-party Gemini embedding
 *   SKU; Anthropic has no embedding SKU. Embedding lives under
 *   `aistudio/` since the cheapest path is the AI Studio API key (icps's
 *   2026-05-07 fallback chain — the path startup-builder also uses).
 *
 * 200K-context tier breakpoint:
 *
 * Gemini 3.1 Pro Preview list pricing has a 2× rate above 200K input
 * tokens. We model this with `contextTierBreakpoint: 200_000` +
 * `contextTierAbove`. Anthropic Claude has flat pricing (no breakpoint).
 * Gemini 2.5 + 3.x flash-lite + embedding SKUs are flat too.
 *
 * Adding a new SKU:
 *
 * 1. Append a new row keyed on `<provider>/<short-slug>` + `tier`. Both
 *    fields together form the lookup key; duplicates are caught by the
 *    table-integrity test.
 * 2. If the SKU has a context-tier breakpoint, add
 *    `contextTierBreakpoint` + `contextTierAbove`. Otherwise omit them.
 * 3. If both standard + batch tiers exist, add BOTH rows; downstream
 *    consumers select via `priceFor({ tier: ... })`. Vertex's batch tier
 *    is ~50% of standard; that's not enforced — declare the actual
 *    published rates.
 * 4. Bump the package version (semver minor for additions).
 */

import type { ModelPricing } from './types.js'

export const PRICING_TABLE: readonly ModelPricing[] = [
  // ---------------------------------------------------------------------
  // Vertex Gemini 3.x (200K-context breakpoint applies to 3.1 Pro)
  // ---------------------------------------------------------------------

  // gemini-3.1-pro-preview standard interactive
  // ≤200K: $2/M in, $12/M out  ;  >200K: $4/M in, $18/M out
  {
    provider: 'vertex',
    slug: 'vertex/gemini-3.1-pro',
    tier: 'standard',
    inputPer1M: 2.0,
    outputPer1M: 12.0,
    contextTierBreakpoint: 200_000,
    contextTierAbove: { inputPer1M: 4.0, outputPer1M: 18.0 },
  },

  // gemini-3.1-pro-preview flex/batch (sb-srnl 2026-05-07 verified)
  // ≤200K: $1/M in, $6/M out  ;  >200K: $2/M in, $9/M out
  {
    provider: 'vertex',
    slug: 'vertex/gemini-3.1-pro',
    tier: 'batch',
    inputPer1M: 1.0,
    outputPer1M: 6.0,
    contextTierBreakpoint: 200_000,
    contextTierAbove: { inputPer1M: 2.0, outputPer1M: 9.0 },
  },

  // gemini-3.1-flash-lite-preview standard
  // Flat: $0.25/M in, $1.50/M out (no breakpoint per public table)
  {
    provider: 'vertex',
    slug: 'vertex/gemini-3.1-flash-lite',
    tier: 'standard',
    inputPer1M: 0.25,
    outputPer1M: 1.5,
  },

  // gemini-3.1-flash-lite-preview flex/batch
  // Flat: $0.13/M in, $0.75/M out
  {
    provider: 'vertex',
    slug: 'vertex/gemini-3.1-flash-lite',
    tier: 'batch',
    inputPer1M: 0.13,
    outputPer1M: 0.75,
  },

  // gemini-3-pro-preview — placeholder pricing using 3.1 sibling rates
  // (Vertex hasn't published separate 3.0 list prices as of 2026-05-07)
  {
    provider: 'vertex',
    slug: 'vertex/gemini-3-pro',
    tier: 'standard',
    inputPer1M: 2.0,
    outputPer1M: 12.0,
    contextTierBreakpoint: 200_000,
    contextTierAbove: { inputPer1M: 4.0, outputPer1M: 18.0 },
  },
  {
    provider: 'vertex',
    slug: 'vertex/gemini-3-pro',
    tier: 'batch',
    inputPer1M: 1.0,
    outputPer1M: 6.0,
    contextTierBreakpoint: 200_000,
    contextTierAbove: { inputPer1M: 2.0, outputPer1M: 9.0 },
  },

  // gemini-3-flash-preview — placeholder using 3.1 flash-lite sibling rates
  {
    provider: 'vertex',
    slug: 'vertex/gemini-3-flash',
    tier: 'standard',
    inputPer1M: 0.25,
    outputPer1M: 1.5,
  },
  {
    provider: 'vertex',
    slug: 'vertex/gemini-3-flash',
    tier: 'batch',
    inputPer1M: 0.13,
    outputPer1M: 0.75,
  },

  // ---------------------------------------------------------------------
  // Vertex Gemini 2.5 (no context-tier breakpoint per public table)
  // ---------------------------------------------------------------------

  // gemini-2.5-pro standard: $1.25/M in, $10/M out
  {
    provider: 'vertex',
    slug: 'vertex/gemini-2.5-pro',
    tier: 'standard',
    inputPer1M: 1.25,
    outputPer1M: 10.0,
  },

  // gemini-2.5-pro batch: ~50% of standard
  {
    provider: 'vertex',
    slug: 'vertex/gemini-2.5-pro',
    tier: 'batch',
    inputPer1M: 0.625,
    outputPer1M: 5.0,
  },

  // gemini-2.5-flash standard: $0.075/M in, $0.30/M out
  // (startup-builder/llm-vertex-batch source — supersedes icps's stale rate)
  {
    provider: 'vertex',
    slug: 'vertex/gemini-2.5-flash',
    tier: 'standard',
    inputPer1M: 0.075,
    outputPer1M: 0.3,
  },

  // gemini-2.5-flash batch: ~50% of standard
  {
    provider: 'vertex',
    slug: 'vertex/gemini-2.5-flash',
    tier: 'batch',
    inputPer1M: 0.0375,
    outputPer1M: 0.15,
  },

  // ---------------------------------------------------------------------
  // Bedrock Anthropic Claude (flat pricing — no context-tier breakpoint)
  // ---------------------------------------------------------------------

  // claude-opus-4-7: $15/M in, $75/M out
  {
    provider: 'bedrock',
    slug: 'bedrock/claude-opus-4-7',
    tier: 'standard',
    inputPer1M: 15.0,
    outputPer1M: 75.0,
  },

  // claude-opus-4-6: same as 4-7
  {
    provider: 'bedrock',
    slug: 'bedrock/claude-opus-4-6',
    tier: 'standard',
    inputPer1M: 15.0,
    outputPer1M: 75.0,
  },

  // claude-sonnet-4-7: $3/M in, $15/M out
  {
    provider: 'bedrock',
    slug: 'bedrock/claude-sonnet-4-7',
    tier: 'standard',
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },

  // claude-sonnet-4-6: same as 4-7
  {
    provider: 'bedrock',
    slug: 'bedrock/claude-sonnet-4-6',
    tier: 'standard',
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },

  // claude-haiku-4-5: $1/M in, $5/M out
  {
    provider: 'bedrock',
    slug: 'bedrock/claude-haiku-4-5',
    tier: 'standard',
    inputPer1M: 1.0,
    outputPer1M: 5.0,
  },

  // ---------------------------------------------------------------------
  // Google AI Studio embeddings
  // ---------------------------------------------------------------------

  // gemini-embedding-2: $0.15/M input (no output side — pure embedding SKU)
  {
    provider: 'google-ai-studio',
    slug: 'aistudio/gemini-embedding-2',
    tier: 'standard',
    inputPer1M: 0.15,
    outputPer1M: 0,
  },
]
