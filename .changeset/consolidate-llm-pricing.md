---
"language-models": minor
---

Fold llm-pricing primitive into language-models (consolidate accidentally-scoped @primitives/llm-pricing).

The canonical LLM model pricing table (rates, tiers, context-tier breakpoints, `priceFor()` cost computation) now lives inside `language-models` under `src/pricing/`. Two ways to import:

- Subpath: `import { priceFor, PRICING_TABLE } from 'language-models/pricing'`
- Root: `import { priceFor, PRICING_TABLE } from 'language-models'` (re-exported for convenience)

The standalone `@primitives/llm-pricing` package is removed — it was accidentally scoped under `@primitives/`, an npm scope we do not own, and was always intended to live alongside the model catalog.
