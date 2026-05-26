# language-models

## 2.4.0

## 2.3.0

### Minor Changes

- 2787830: Fold llm-pricing primitive into language-models (consolidate accidentally-scoped @primitives/llm-pricing).

  The canonical LLM model pricing table (rates, tiers, context-tier breakpoints, `priceFor()` cost computation) now lives inside `language-models` under `src/pricing/`. Two ways to import:

  - Subpath: `import { priceFor, PRICING_TABLE } from 'language-models/pricing'`
  - Root: `import { priceFor, PRICING_TABLE } from 'language-models'` (re-exported for convenience)

  The standalone `@primitives/llm-pricing` package is removed — it was accidentally scoped under `@primitives/`, an npm scope we do not own, and was always intended to live alongside the model catalog.

## 2.2.0

### Minor Changes

- Add `ModelPolicy` MDXLD type and per-model policy derivation layer
  (aip-70mk). `policyFor(alias)` returns derived retry, circuit-breaker,
  fallback-chain, and batch-tier data for any catalog model. Heuristics
  encode "frontier providers retry more aggressively", "same-family
  siblings fall back first, sorted by recency then price", and
  "OpenAI/Bedrock are flex-eligible". `ai-functions` reads policy via
  `RetryPolicy.forModel`, `CircuitBreaker.forModel`,
  `FallbackChain.forModel`.

## 2.1.3

### Patch Changes

- Documentation and testing improvements
  - Add deterministic AI testing suite with self-validating patterns
  - Apply StoryBrand narrative to all package READMEs
  - Update TESTING.md with four principles of deterministic AI testing
  - Fix duplicate examples package name conflict

## 2.1.1

## 2.0.3

### Patch Changes

- Updated dependencies
  - rpc.do@0.2.0

## 2.0.2

## 2.0.1
