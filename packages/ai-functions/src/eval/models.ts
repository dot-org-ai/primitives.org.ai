/**
 * Model Registry for AI Functions Eval Suite
 *
 * Simple model list for running evals across providers.
 * Uses ai-providers/language-models for resolution and pricing.
 *
 * @packageDocumentation
 */

import { resolve, get, list, type ModelInfo } from 'language-models'

export type ModelTier = 'best' | 'fast' | 'cheap'

export interface EvalModel {
  /** Alias or full model ID */
  id: string
  /** Human-readable name */
  name: string
  /** Provider slug */
  provider: string
  /** Capability tier */
  tier: ModelTier
  /** Optional notes */
  notes?: string
}

// ============================================================================
// Models to evaluate - using aliases from language-models
// ============================================================================

/**
 * Core models to test - one per tier per major provider
 * These resolve via ai-providers to OpenRouter or direct SDKs
 *
 * Updated: December 2025
 *
 * Note: Some models use OpenRouter format (provider/model) to avoid
 * resolution issues with provider_model_id mismatches.
 */
export const EVAL_MODELS: EvalModel[] = [
  // Anthropic Claude 4.5 - via AWS Bedrock (uses AWS credits with bearer token auth)
  // All Claude models should be 4.5 - older versions are deprecated
  { id: 'bedrock:us.anthropic.claude-opus-4-5-20251101-v1:0', name: 'Claude Opus 4.5', provider: 'anthropic', tier: 'best', notes: 'Bedrock' },
  { id: 'bedrock:us.anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5', provider: 'anthropic', tier: 'fast', notes: 'Bedrock' },
  { id: 'bedrock:us.anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5', provider: 'anthropic', tier: 'cheap', notes: 'Bedrock' },

  // OpenAI - GPT-5.1 variants + GPT-oss (open source)
  { id: 'openai/o3', name: 'o3', provider: 'openai', tier: 'best' },
  { id: 'openai/gpt-5.1', name: 'GPT-5.1', provider: 'openai', tier: 'best' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'openai', tier: 'fast' },
  { id: 'openai/gpt-5-nano', name: 'GPT-5 Nano', provider: 'openai', tier: 'cheap' },
  // GPT-oss 120B removed - times out frequently
  { id: 'openai/gpt-oss-20b', name: 'GPT-oss 20B', provider: 'openai', tier: 'fast', notes: 'Open source' },

  // Google - Gemini 3 (November 2025)
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', provider: 'google', tier: 'best', notes: '1M context, #1 LMArena' },
  // Gemini 2.5 Pro removed - times out frequently
  { id: 'flash', name: 'Gemini 2.5 Flash', provider: 'google', tier: 'fast' },

  // Meta (via OpenRouter)
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'meta-llama', tier: 'best' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', provider: 'meta-llama', tier: 'fast' },

  // DeepSeek - V3.2 (December 2025)
  { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'deepseek', tier: 'best', notes: 'GPT-5 class reasoning' },
  // DeepSeek V3.2 Speciale removed - no tool use support on OpenRouter
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', tier: 'fast' },

  // Mistral - Mistral 3 family (December 2025)
  { id: 'mistralai/mistral-large-2512', name: 'Mistral Large 3', provider: 'mistralai', tier: 'best', notes: '675B MoE, 41B active' },
  { id: 'mistralai/mistral-medium-3.1', name: 'Mistral Medium 3.1', provider: 'mistralai', tier: 'fast' },
  // Ministral 3 14B removed - often fails structured output

  // Qwen - Qwen3 family (2025)
  { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder 480B', provider: 'qwen', tier: 'best', notes: 'Agentic coding' },
  { id: 'qwen/qwen3-30b-a3b', name: 'Qwen3 30B', provider: 'qwen', tier: 'fast', notes: 'MoE 30B/3B active' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct', name: 'Qwen3 Next 80B', provider: 'qwen', tier: 'best', notes: 'Ultra-long context' },

  // xAI - Grok 4 family (December 2025)
  { id: 'x-ai/grok-4', name: 'Grok 4', provider: 'x-ai', tier: 'best', notes: '256K context, reasoning' },
  { id: 'x-ai/grok-4.1-fast', name: 'Grok 4.1 Fast', provider: 'x-ai', tier: 'fast', notes: '2M context, agentic' },
  { id: 'x-ai/grok-4-fast', name: 'Grok 4 Fast', provider: 'x-ai', tier: 'fast', notes: '2M context' },
]

/**
 * Get models by tier
 */
export function getModelsByTier(tier: ModelTier): EvalModel[] {
  return EVAL_MODELS.filter(m => m.tier === tier)
}

/**
 * Get models by provider
 */
export function getModelsByProvider(provider: string): EvalModel[] {
  return EVAL_MODELS.filter(m => m.provider === provider)
}

/**
 * Get model info from language-models package (includes pricing)
 */
export function getModelInfo(id: string): ModelInfo | undefined {
  const resolved = resolve(id)
  return get(resolved)
}

/**
 * Get pricing for a model (from OpenRouter data)
 */
export function getModelPricing(id: string): { prompt: number; completion: number } | undefined {
  const info = getModelInfo(id)
  if (!info?.pricing) return undefined

  return {
    prompt: parseFloat(info.pricing.prompt) * 1_000_000, // Convert to per-million
    completion: parseFloat(info.pricing.completion) * 1_000_000,
  }
}

/**
 * Create evalite variants for model testing
 */
export function createModelVariants(opts?: {
  tiers?: ModelTier[]
  providers?: string[]
}): Array<{ name: string; input: EvalModel }> {
  let models = EVAL_MODELS

  if (opts?.tiers) {
    models = models.filter(m => opts.tiers!.includes(m.tier))
  }

  if (opts?.providers) {
    models = models.filter(m => opts.providers!.includes(m.provider))
  }

  return models.map(model => ({
    name: `${model.provider}/${model.name}`,
    input: model,
  }))
}

/**
 * Get a representative model from each provider for a given tier
 */
export function getRepresentativeModels(tier: ModelTier): EvalModel[] {
  const seen = new Set<string>()
  const result: EvalModel[] = []

  for (const model of EVAL_MODELS) {
    if (model.tier === tier && !seen.has(model.provider)) {
      seen.add(model.provider)
      result.push(model)
    }
  }

  return result
}
