/**
 * Multi-provider selection + quota-fallback policy (pure / L0).
 *
 * `language-models` owns model identity, resilience policy, and pricing. This
 * module adds the *declarative* multi-provider decision: given a model spec,
 * produce the ordered list of provider candidates to try (the quota-fallback
 * chain), classify quota / rate-limit errors, and step the chain when a
 * candidate is throttled.
 *
 * It is **pure** — no network, no SDK, no `ai-providers` import. The execution
 * binding (calling the actual provider, looping the chain on quota errors)
 * lives one layer up in `ai-providers` (`runWithFallback`). The
 * `model.run(PreparedGeneration)` seam in `ai-functions` consumes both: it asks
 * for a selection plan here and drives it there.
 *
 * Source pattern: startup-builder `_dual-google-router.ts` — `isQuotaError` +
 * cool-down + opus→sonnet downgrade — generalized over the per-model
 * `policyFor().fallbackChain` data this package already derives.
 *
 * @packageDocumentation
 */

import { resolveWithProvider } from './models.js'
import { policyFor, type BatchTier } from './policy.js'

// ============================================================================
// Quota-error classification
// ============================================================================

/**
 * Provider quota / throttle codes. A request that fails with one of these
 * should fall back to the next candidate in the chain rather than fail hard.
 */
const QUOTA_CODES: ReadonlySet<string> = new Set([
  'RESOURCE_EXHAUSTED', // Google / Vertex
  'QUOTA_EXCEEDED', // Google
  'ThrottlingException', // AWS Bedrock
  'TooManyRequestsException', // AWS
  'insufficient_quota', // OpenAI
  'rate_limit_exceeded', // OpenAI / Anthropic
  'overloaded_error', // Anthropic
])

/** Lower-cased message fragments that signal a quota / rate-limit condition. */
const QUOTA_MESSAGE_FRAGMENTS: readonly string[] = [
  '429',
  'rate limit',
  'ratelimit',
  'quota',
  'resource_exhausted',
  'too many requests',
  'overloaded',
]

/**
 * Decide whether an error is a quota / rate-limit condition that warrants
 * falling back to the next provider candidate.
 *
 * Mirrors the shape both the Bedrock and Google adapters use (status 429,
 * provider codes) plus message-text fallbacks for status-code-less SDK errors.
 */
export function isQuotaError(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false
  const e = err as {
    status?: unknown
    statusCode?: unknown
    code?: unknown
    message?: unknown
  }

  const status =
    typeof e.status === 'number'
      ? e.status
      : typeof e.statusCode === 'number'
        ? e.statusCode
        : undefined
  if (status === 429) return true

  if (typeof e.code === 'string' && QUOTA_CODES.has(e.code)) return true

  if (typeof e.message === 'string') {
    const m = e.message.toLowerCase()
    if (QUOTA_MESSAGE_FRAGMENTS.some((frag) => m.includes(frag))) return true
  }

  return false
}

// ============================================================================
// Provider candidates
// ============================================================================

/**
 * A single provider candidate in a quota-fallback chain. Carries everything an
 * executor needs to bind a concrete provider call without re-resolving:
 * the OpenRouter-style model id, the provider slug, the native provider model
 * id (when known), whether the provider supports direct SDK routing, and which
 * batch tiers the model is eligible for.
 */
export interface ProviderCandidate {
  /** OpenRouter-style model id (e.g. `anthropic/claude-opus-4.5`). */
  readonly modelId: string
  /** Provider slug (e.g. `anthropic`, `openai`, `google`). */
  readonly provider: string
  /** Provider's native model id (e.g. `claude-opus-4-5-20251101`), when known. */
  readonly providerModelId?: string
  /** Whether this provider supports direct (native-SDK) routing. */
  readonly supportsDirectRouting: boolean
  /** Batch tiers this model is eligible for (`immediate` always present). */
  readonly batchTier: readonly BatchTier[]
}

/** Options for {@link selectionFor}. */
export interface SelectionOptions {
  /**
   * Override the quota-fallback chain. When omitted, the per-model
   * `policyFor().fallbackChain` is used. Pass `[]` to disable fallback (a
   * single-candidate plan). Each entry is resolved through alias resolution.
   */
  readonly fallback?: readonly string[]
}

/** Build a candidate from a resolved-model spec. */
function toCandidate(spec: string): ProviderCandidate {
  const resolved = resolveWithProvider(spec)
  const policy = policyFor(spec)
  const candidate: ProviderCandidate = {
    modelId: resolved.id,
    provider: resolved.provider,
    supportsDirectRouting: resolved.supportsDirectRouting,
    batchTier: policy.batchTier,
  }
  if (resolved.providerModelId !== undefined) {
    return { ...candidate, providerModelId: resolved.providerModelId }
  }
  return candidate
}

/**
 * Build the ordered provider-candidate plan for a model spec.
 *
 * The primary (resolved spec) is always the first candidate. The remaining
 * candidates are the quota-fallback chain — either the explicit
 * `options.fallback` override or the model's derived `policyFor().fallbackChain`
 * — de-duplicated and resolved into candidates.
 *
 * @example
 * ```ts
 * const plan = selectionFor('opus')
 * // [ { modelId: 'anthropic/claude-opus-4.5', ... },
 * //   { modelId: 'anthropic/claude-sonnet-4.5', ... }, ... ]
 *
 * const downgrade = selectionFor('opus', { fallback: ['sonnet'] })
 * // primary opus, then sonnet only
 * ```
 */
export function selectionFor(spec: string, options: SelectionOptions = {}): ProviderCandidate[] {
  const primary = toCandidate(spec)
  const seen = new Set<string>([primary.modelId])
  const plan: ProviderCandidate[] = [primary]

  const chain = options.fallback ?? policyFor(spec).fallbackChain
  for (const entry of chain) {
    const candidate = toCandidate(entry)
    if (seen.has(candidate.modelId)) continue
    seen.add(candidate.modelId)
    plan.push(candidate)
  }

  return plan
}

// ============================================================================
// Chain stepping
// ============================================================================

/**
 * Given the candidate plan, the index that just failed, and the error it
 * failed with, return the index of the next candidate to try — or `null` to
 * stop.
 *
 * Stepping happens **only** on a quota error (a non-quota error means the
 * caller should surface it immediately; retrying a different model won't fix a
 * bad schema). Stepping returns `null` when the chain is exhausted.
 *
 * Pure and total — same inputs always yield the same answer, so a fallback run
 * is fully replayable.
 */
export function nextCandidate(
  plan: readonly ProviderCandidate[],
  currentIndex: number,
  err: unknown
): number | null {
  if (!isQuotaError(err)) return null
  const next = currentIndex + 1
  if (next >= plan.length) return null
  return next
}

// ============================================================================
// Batch-plan policy — the reconciliation seam with ai-functions' batch layer
// ============================================================================

/**
 * The batch-provider slugs `ai-functions` registers adapters under
 * (`ai-functions/src/batch-queue.ts` `BatchProvider`). This module produces a
 * plan *naming* one of these; it never re-implements the adapters. Mirrored
 * here as a string union so `language-models` stays dependency-free (it must
 * not import the higher-layer `ai-functions`).
 */
export type BatchProvider = 'openai' | 'anthropic' | 'google' | 'bedrock' | 'cloudflare'

/**
 * Map a `language-models` provider slug to the `ai-functions` `BatchProvider`
 * slug. The catalog uses `amazon-bedrock`; ai-functions registers it under
 * `bedrock`. Providers with no ai-functions batch adapter map to `null`.
 */
const PROVIDER_TO_BATCH_PROVIDER: Record<string, BatchProvider> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  'amazon-bedrock': 'bedrock',
  bedrock: 'bedrock',
  cloudflare: 'cloudflare',
}

/**
 * Resolve a model spec to the `ai-functions` `BatchProvider` its batch jobs
 * should be dispatched to, or `null` when no batch adapter exists for that
 * provider (e.g. OpenRouter-only models).
 */
export function batchProviderFor(spec: string): BatchProvider | null {
  const resolved = resolveWithProvider(spec)
  return PROVIDER_TO_BATCH_PROVIDER[resolved.provider] ?? null
}

/**
 * A serializable batch-dispatch plan: which `ai-functions` `BatchProvider` to
 * submit to, the resolved model id, the tier, and whether the model is
 * eligible for that tier. An executor (or `ai-functions`) reads this to pick
 * the registered adapter — no decision logic is duplicated here.
 */
export interface BatchPlan {
  /** Resolved OpenRouter-style model id. */
  readonly modelId: string
  /** ai-functions BatchProvider to dispatch to, or `null` if none exists. */
  readonly provider: BatchProvider | null
  /** Requested tier. */
  readonly tier: BatchTier
  /** Whether the model is eligible for the requested tier on a real provider. */
  readonly eligible: boolean
}

/**
 * Build a batch-dispatch plan for a model spec + desired tier (default
 * `immediate`). A model is `eligible` only when it both (a) maps to an
 * ai-functions `BatchProvider` and (b) declares the requested tier in its
 * `policyFor().batchTier`.
 *
 * @example
 * ```ts
 * batchPlanFor('opus', 'batch')
 * // { modelId: 'anthropic/claude-opus-4.5', provider: 'anthropic',
 * //   tier: 'batch', eligible: true }
 * ```
 */
export function batchPlanFor(spec: string, tier: BatchTier = 'immediate'): BatchPlan {
  const resolved = resolveWithProvider(spec)
  const provider = PROVIDER_TO_BATCH_PROVIDER[resolved.provider] ?? null
  const tiers = policyFor(spec).batchTier
  const eligible = provider !== null && tiers.includes(tier)
  return { modelId: resolved.id, provider, tier, eligible }
}
