/**
 * cost-estimate — shared LLM-cost heuristic used across the v3 invoke
 * machinery (cascade walker, evaluator panel).
 *
 * Round-11 wiring: the previously-hardcoded Sonnet rate is replaced with a
 * real {@link BudgetTracker} dispatch from `ai-functions`. The tracker owns
 * the per-model pricing table (gpt-4o, claude-opus-4-…, gemini-1.5-pro, etc.
 * — see `ai-functions/src/budget.ts`'s `DEFAULT_MODEL_PRICING`). This module
 * adds two thin pieces of glue on top:
 *
 *   1. **Alias bridging.** Cascade/panel sites pass model names like
 *      `'sonnet'` / `'opus'` / `'haiku'`, which match the
 *      `language-models/src/aliases.ts` alias surface but are *not* keys in
 *      the BudgetTracker's pricing table (which keys on full IDs like
 *      `'claude-3-5-sonnet-latest'`). We register these alias names via
 *      `customPricing` so a `model: 'sonnet'` call gets Sonnet rates.
 *
 *   2. **Sonnet fallback for unknown models.** When a model name is
 *      recognised neither as an alias nor in the BudgetTracker default
 *      pricing table (e.g. a brand-new provider id), we route through Sonnet
 *      rates and emit a one-time `console.warn` per unknown model name so the
 *      operator notices the gap. The BudgetTracker's own `'default'` rate
 *      ($1/M input, $3/M output) is intentionally *not* used here — Sonnet
 *      ($3/M input, $15/M output) is the conservative pessimistic fallback
 *      for SaS cost estimation and matches the legacy round-7/8 behaviour.
 *
 * The function stays **synchronous** (no `await`) because it is called from
 * the cascade walker's hot loop and from `evaluator-panel.run`'s persona
 * dispatch — both of which are already inside `await` blocks for the upstream
 * `generateObject`/`generateText` call. A fresh per-call `BudgetTracker` is
 * cheap (a few field initialisations); we don't share trackers across calls
 * because each call wants its own isolated cost number, and aggregate cost
 * tracking already happens at the {@link InvocationHandle} layer via
 * `cost-incurred` events.
 *
 * Returns USD as a `number` — sub-cent precision is preserved by the caller
 * via `usdToMicroCents` when settling into a {@link Money} amount. The
 * signature is unchanged from the round-7/8 surface so callers in
 * `cascade-walker.ts` and `evaluator-panel.ts` need no churn.
 *
 * **Language-models overlay (round-12 follow-up).** A lazy module-load reads
 * `language-models/data/models.json` and overlays each catalogued model's
 * `pricing.{prompt,completion}` (USD per token, parsed from the entry's
 * string fields and rescaled to per-million) into the `customPricing` map
 * passed to {@link BudgetTracker}. Result: Llama (via Together / Groq),
 * DeepSeek, Mistral, Qwen, Grok, Perplexity Sonar — any model in the
 * language-models catalog — get their real per-token rate instead of the
 * Sonnet pessimistic fallback. The load is best-effort (try/catch); a
 * failed load silently degrades to the previous round-11 alias-only behaviour.
 *
 * TODO(round 13): native BudgetTracker support for these models so we don't
 * need the overlay (i.e. promote the language-models catalog into
 * `ai-functions/src/budget.ts` `DEFAULT_MODEL_PRICING`).
 *
 * @packageDocumentation
 */

import { BudgetTracker, type ModelPricing } from 'ai-functions'

// ============================================================================
// Pricing (Sonnet fallback + alias overlay)
// ============================================================================

/**
 * Sonnet-class default rate. Used when the passed model is not recognised
 * by the BudgetTracker pricing table OR our alias overlay. Matches the
 * legacy round-7/8 hardcoded rate so unknown-model behaviour is unchanged.
 */
const SONNET_PRICING: ModelPricing = {
  inputPricePerMillion: 3,
  outputPricePerMillion: 15,
}

/**
 * Opus-class rate. Mirrors the BudgetTracker's `'claude-opus-4-20250514'`
 * entry; supplied here under the short alias key so callers passing
 * `model: 'opus'` (a `language-models` alias) get the right number.
 */
const OPUS_PRICING: ModelPricing = {
  inputPricePerMillion: 15,
  outputPricePerMillion: 75,
}

/**
 * Haiku-class rate. Mirrors the BudgetTracker's
 * `'claude-3-5-haiku-latest'` entry; supplied under the short alias key.
 */
const HAIKU_PRICING: ModelPricing = {
  inputPricePerMillion: 0.25,
  outputPricePerMillion: 1.25,
}

/**
 * Custom pricing overlay for `language-models` short aliases. Keys are the
 * names that appear on `FunctionRef.modelHint` and `EvaluatorPanel` persona
 * calls; values mirror the BudgetTracker's per-model defaults for the full
 * provider IDs the aliases resolve to.
 *
 * Keep this table in sync with `language-models/src/aliases.ts` ALIASES.
 */
const ALIAS_PRICING: Record<string, ModelPricing> = {
  sonnet: SONNET_PRICING,
  claude: SONNET_PRICING,
  opus: OPUS_PRICING,
  haiku: HAIKU_PRICING,
  // Provider-prefixed aliases — kept here so the resolved model id from
  // `language-models.resolve('sonnet')` also gets the right rate when a
  // caller has already pre-resolved it. BudgetTracker keys on shorter ids,
  // so we mirror those entries here too.
  'anthropic/claude-sonnet-4.5': SONNET_PRICING,
  'anthropic/claude-opus-4.5': OPUS_PRICING,
  'anthropic/claude-haiku-4.5': HAIKU_PRICING,
}

// ============================================================================
// Language-models catalog overlay (round-12 follow-up)
// ============================================================================

/**
 * Minimal shape we read off each language-models catalog entry. Pricing
 * fields are quoted strings (USD per token) — we parse them into
 * {@link ModelPricing}'s per-million convention.
 */
interface CatalogEntry {
  id: string
  pricing?: {
    prompt?: string
    completion?: string
  }
}

/**
 * Lazy-loaded pricing overlay sourced from `language-models/data/models.json`.
 * Each catalog entry's `pricing.prompt` / `pricing.completion` (USD per
 * single token; quoted strings) is parsed and rescaled to per-million for
 * {@link BudgetTracker}'s convention.
 *
 * Best-effort: a missing dep / parse failure / empty pricing entry silently
 * degrades to the previous round-11 alias-only behaviour. Loaded once on
 * first access; cached for the lifetime of the process.
 *
 * Round-13 follow-up: promote these into `ai-functions/src/budget.ts`'s
 * `DEFAULT_MODEL_PRICING` so the overlay can go away.
 */
let _languageModelsOverlayCache: Record<string, ModelPricing> | null = null
let _languageModelsOverlayKnownIds: Set<string> | null = null

function loadLanguageModelsOverlay(): {
  pricing: Record<string, ModelPricing>
  knownIds: Set<string>
} {
  if (_languageModelsOverlayCache !== null && _languageModelsOverlayKnownIds !== null) {
    return { pricing: _languageModelsOverlayCache, knownIds: _languageModelsOverlayKnownIds }
  }
  const pricing: Record<string, ModelPricing> = {}
  const knownIds: Set<string> = new Set()
  try {
    // Lazy ESM-safe load. The require is wrapped in createRequire so the
    // module-load error (when the dep is missing) is catchable. Parsing
    // the JSON file directly avoids importing any of language-models'
    // module-load side effects.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createRequire } = require('module') as typeof import('module')
    const req = createRequire(import.meta.url)
    const entries = req('language-models/data/models.json') as CatalogEntry[]
    for (const entry of entries) {
      if (!entry || typeof entry.id !== 'string') continue
      knownIds.add(entry.id)
      const promptRaw = entry.pricing?.prompt
      const completionRaw = entry.pricing?.completion
      if (typeof promptRaw !== 'string' || typeof completionRaw !== 'string') continue
      const promptPerToken = Number(promptRaw)
      const completionPerToken = Number(completionRaw)
      // Skip non-finite, negative, or both-zero entries. A free model
      // (prompt=0, completion=0) gets `{ in: 0, out: 0 }` so we don't
      // accidentally emit Sonnet rates for it via the unknown-model path.
      if (!Number.isFinite(promptPerToken) || !Number.isFinite(completionPerToken)) continue
      if (promptPerToken < 0 || completionPerToken < 0) continue
      pricing[entry.id] = {
        inputPricePerMillion: promptPerToken * 1_000_000,
        outputPricePerMillion: completionPerToken * 1_000_000,
      }
    }
  } catch {
    // Best-effort — language-models may not be installed (or models.json
    // moved). Fall through to the alias-only overlay; unknown models will
    // route through the Sonnet fallback warn.
  }
  _languageModelsOverlayCache = pricing
  _languageModelsOverlayKnownIds = knownIds
  return { pricing, knownIds }
}

/**
 * Models the BudgetTracker default pricing table already knows about
 * (verbatim from `ai-functions/src/budget.ts` DEFAULT_MODEL_PRICING). We
 * use this as a recognised-set so `estimateCostFromUsage` doesn't warn for
 * a perfectly valid full-id model that ships out of the box.
 */
const BUDGET_TRACKER_KNOWN_MODELS: ReadonlySet<string> = new Set([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'o1',
  'o1-mini',
  'o1-preview',
  'o3-mini',
  'claude-opus-4-20250514',
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-latest',
  'claude-3-5-haiku-latest',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
])

/**
 * Set of model names we have already warned about. Prevents log spam when
 * the cascade fires the same unknown model dozens of times in one process.
 */
const _warnedUnknownModels: Set<string> = new Set()

/**
 * Whether we recognise `model` — either as an alias we've overlaid, as a
 * language-models catalog id (round-12 overlay), or as a key the
 * BudgetTracker default pricing table already knows.
 */
function isKnownModel(model: string): boolean {
  if (model in ALIAS_PRICING) return true
  if (BUDGET_TRACKER_KNOWN_MODELS.has(model)) return true
  const { knownIds } = loadLanguageModelsOverlay()
  if (knownIds.has(model)) return true
  return false
}

/**
 * Emit a one-time `console.warn` for an unrecognised model. Subsequent calls
 * with the same name are silent.
 */
function warnUnknownModelOnce(model: string): void {
  if (_warnedUnknownModels.has(model)) return
  _warnedUnknownModels.add(model)
  // eslint-disable-next-line no-console
  console.warn(
    `[services-as-software/cost-estimate] Unknown model '${model}' — falling back to ` +
      `Sonnet pricing ($3/M input, $15/M output). Round-12 work will load full ` +
      `language-models pricing as BudgetTracker customPricing.`
  )
}

// ============================================================================
// Public surface
// ============================================================================

/**
 * Estimate the USD cost of a single LLM call, given the AI SDK's `usage`
 * shape and the model name.
 *
 * Round-11 implementation: routes through `ai-functions`'s
 * {@link BudgetTracker} for per-model pricing.
 *
 *   - Recognised model (BudgetTracker default OR our alias overlay) →
 *     real per-model rate.
 *   - Unrecognised model → Sonnet fallback ($3/M input, $15/M output) with
 *     a one-time `console.warn` per unknown name.
 *   - Missing/zero token counts → flat $0.001 placeholder (preserves the
 *     legacy round-7/8 behaviour for tool-only Code-step or smoke-test
 *     mocks that never round-tripped to a model).
 *
 * Returns USD as a `number`. The caller (`cascade-walker.ts`,
 * `evaluator-panel.ts`) converts to a `Money` micro-cents bigint via
 * `usdToMicroCents` at emission time.
 *
 * Synchronous by design — runs inside the cascade walker's hot loop and
 * inside `evaluator-panel.run`'s `Promise.all`. A fresh `BudgetTracker` is
 * instantiated per call (cheap; a few field initialisations).
 */
export function estimateCostFromUsage(usage: unknown, model?: string): number {
  if (!usage || typeof usage !== 'object') {
    return 0.001
  }
  const u = usage as { inputTokens?: number; outputTokens?: number }
  const inT = typeof u.inputTokens === 'number' ? u.inputTokens : 0
  const outT = typeof u.outputTokens === 'number' ? u.outputTokens : 0
  if (inT === 0 && outT === 0) {
    return 0.001
  }

  // Resolve the pricing key. When the model is unrecognised, register it
  // under a synthetic key with Sonnet rates so the BudgetTracker still does
  // the math (and we get a single source of truth for the input/output
  // multiplication). Warn exactly once per unknown name.
  //
  // Round-12: merge the language-models catalog overlay first so Llama /
  // DeepSeek / Mistral / Qwen / Grok / Perplexity Sonar route through their
  // real catalog rate before the alias / unknown-model paths fire.
  const modelName = model ?? 'sonnet'
  const { pricing: catalogPricing } = loadLanguageModelsOverlay()
  const customPricing = { ...catalogPricing, ...ALIAS_PRICING }
  let trackerModelKey = modelName
  if (!isKnownModel(modelName)) {
    warnUnknownModelOnce(modelName)
    // Override the unknown name to point at Sonnet rates via customPricing.
    customPricing[modelName] = SONNET_PRICING
    trackerModelKey = modelName
  }

  const tracker = new BudgetTracker({ customPricing })
  tracker.recordUsage({
    inputTokens: inT,
    outputTokens: outT,
    model: trackerModelKey,
  })
  return tracker.getTotalCost()
}
