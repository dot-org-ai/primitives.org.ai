# Changelog

All notable changes to `@primitives/llm-pricing` are documented here.

## 0.1.0 — 2026-05-07

### Added

- Initial canonical pricing table consolidating five prior repo sources:
  startup-builder's `llm-vertex/pricing.ts`, `llm-bedrock/pricing.ts`,
  `llm-vertex-batch/adapter.ts:PRICING_TABLE`, gateway-injected pricing,
  plus icps `llm/pricing.ts` and services-builder `llm/cost.ts`.
- 12 canonical model slugs across providers `vertex` / `bedrock` /
  `google-ai-studio` (19 rows total when both `standard` + `batch` tiers
  exist):
  - `vertex/gemini-3.1-pro` (standard + batch, with 200K context-tier
    breakpoint)
  - `vertex/gemini-3.1-flash-lite` (standard + batch, flat)
  - `vertex/gemini-3-pro` (standard + batch, with 200K breakpoint)
  - `vertex/gemini-3-flash` (standard + batch, flat)
  - `vertex/gemini-2.5-pro` (standard + batch, flat)
  - `vertex/gemini-2.5-flash` (standard + batch, flat)
  - `bedrock/claude-opus-4-7` (standard, flat)
  - `bedrock/claude-opus-4-6` (standard, flat)
  - `bedrock/claude-sonnet-4-7` (standard, flat)
  - `bedrock/claude-sonnet-4-6` (standard, flat)
  - `bedrock/claude-haiku-4-5` (standard, flat)
  - `aistudio/gemini-embedding-2` (standard)
- `priceFor({ slug, tier, inputTokens, outputTokens, cachedInputTokens? })`
  → `{ inputUsd, outputUsd, totalUsd }` lookup helper. Throws on unknown
  slug, unmodeled tier, or negative token counts (per
  `BYOK_GATEWAY_LIES`: silent zero is the lying-gateway pattern).
- `hasPricing()`, `listSlugs()`, `rowsForSlug()` introspection helpers.
- 200K context-tier breakpoint logic: when
  `inputTokens >= contextTierBreakpoint`, the entire request is billed at
  `contextTierAbove` rates (matches Google's published Gemini 3.x
  billing model). Anthropic Claude has flat pricing — no breakpoint.
- 28-test suite covering table integrity, required slugs, synthetic rate
  anchors, the BMC corpus production regression anchor (5602 records ×
  ~4500 input × ~1140 output on `vertex/gemini-3.1-pro` batch ≈ $63.53,
  matches sb-srnl 2026-05-07), and error paths.

### Sourcing notes

Where prior tables disagreed, the most-recently-updated source wins:

- Gemini 3.x batch tier: startup-builder/llm-vertex-batch (sb-srnl
  2026-05-07 verified).
- Gemini 2.5: startup-builder/llm-vertex-batch (icps's
  `gemini-2.5-flash` rates were ~4× off the published rates — likely
  transposed from a different SKU).
- Bedrock Anthropic: startup-builder/llm-bedrock.
- `gemini-embedding-2`: icps/llm/pricing.ts (Google AI Studio path —
  cheapest provider).
