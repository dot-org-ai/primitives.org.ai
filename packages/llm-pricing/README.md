# @primitives/llm-pricing

Canonical LLM model pricing table — keyed by `(provider, slug, tier)`,
sourced from Vertex / Bedrock / Google AI Studio public list prices.

## Why

Across `startup-builder`, `icps`, and `services-builder` we previously
maintained 5+ separate pricing tables that all keyed the same canonical
slugs but with different schemas + duplicate data. This package
consolidates them.

Replaces:

- `startup-builder/packages/llm-vertex/src/pricing.ts`
- `startup-builder/packages/llm-bedrock/src/pricing.ts`
- `startup-builder/packages/llm-vertex-batch/src/adapter.ts:PRICING_TABLE`
- `startup-builder/packages/llm-vercel-gateway/...` injected pricing
- `icps/packages/llm/pricing.ts` (200K-context-tier breakpoint logic)
- `services-builder/packages/llm/cost.ts`

## Install

```bash
pnpm add @primitives/llm-pricing
```

No runtime dependencies — pure TypeScript table.

## Usage

### Compute cost for a single call

```typescript
import { priceFor } from '@primitives/llm-pricing'

const result = priceFor({
  slug: 'vertex/gemini-3.1-pro',
  tier: 'batch',
  inputTokens: 1500,
  outputTokens: 800,
})
// { inputUsd: 0.0015, outputUsd: 0.0048, totalUsd: 0.0063 }
```

### Throws on unknown slug or tier

`priceFor()` throws on unknown `slug` or unmodeled `tier` (per the
[lying-gateway lesson](../../CLAUDE.md): silent zero is worse than loud
failure). Use `hasPricing()` for non-throwing existence checks:

```typescript
import { hasPricing } from '@primitives/llm-pricing'

if (hasPricing({ slug, tier })) {
  // safe to call priceFor
}
```

### Iterate the table

```typescript
import { PRICING_TABLE, listSlugs, rowsForSlug } from '@primitives/llm-pricing'

console.log(`${PRICING_TABLE.length} pricing rows`)
console.log(`Known slugs: ${listSlugs().join(', ')}`)

for (const row of rowsForSlug('vertex/gemini-3.1-pro')) {
  console.log(`  tier=${row.tier} input=$${row.inputPer1M}/M output=$${row.outputPer1M}/M`)
}
```

## Schema

```typescript
interface ModelPricing {
  provider: 'vertex' | 'bedrock' | 'openai' | 'anthropic' | 'google-ai-studio'
  slug: string
  tier: 'standard' | 'batch' | 'flex' | 'provisioned'
  inputPer1M: number
  outputPer1M: number
  cachedInputPer1M?: number
  contextTierBreakpoint?: number
  contextTierAbove?: { inputPer1M, outputPer1M, cachedInputPer1M? }
}
```

### Context-tier breakpoint

Gemini 3.x SKUs apply a 2× rate above 200K input tokens. We model this
with `contextTierBreakpoint: 200_000` + `contextTierAbove`. `priceFor()`
applies the breakpoint **per-call**: if `inputTokens >= breakpoint`, the
WHOLE request is billed at the high-context rate. For aggregate cost
rollups across many small calls, callers accumulate per-call results.

Anthropic Claude has flat pricing — no breakpoint.

### Pricing tiers

- `standard`: synchronous interactive pricing (full price).
- `batch`: async batch-prediction pricing (Vertex applies a ~50%
  discount).
- `flex`: alias slot for Vertex's flex-tier — currently unused but
  reserved for future flex-only SKUs.
- `provisioned`: provisioned-throughput pricing — currently unmodeled
  (returns "no tier" error). Future PT entries can land here.

## Sourcing

Rates were cross-referenced across the three repos on 2026-05-07. Where
sources disagreed, the most-recently-updated wins:

- **Gemini 3.x batch**: `startup-builder/packages/llm-vertex-batch`
  (sb-srnl 2026-05-07 verified).
- **Gemini 2.5**: `startup-builder/packages/llm-vertex-batch`
  (icps's `gemini-2.5-flash` rates were ~4× off — likely transposed from
  a different SKU).
- **Bedrock Anthropic**: `startup-builder/packages/llm-bedrock` (matches
  AWS Bedrock public pricing on 2026-05-07).
- **`gemini-embedding-2`**: icps `packages/llm/pricing.ts` — Google AI
  Studio API key path (cheapest).

## Adding a new SKU

1. Append a new row to `src/pricing.ts` keyed on
   `<provider>/<short-slug>` + `tier`.
2. If the SKU has a context-tier breakpoint, add `contextTierBreakpoint`
   + `contextTierAbove`. Otherwise omit.
3. If both `standard` + `batch` tiers exist, add BOTH rows.
4. Run `pnpm test` — the table-integrity test catches duplicates and
   invalid shapes.
5. Bump the package version (semver minor for additions).

## License

MIT
