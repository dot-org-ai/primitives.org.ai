/**
 * Model aliases - map simple names to full model IDs
 */

export const ALIASES: Record<string, string> = {
  // Claude (Anthropic)
  'opus': 'anthropic/claude-opus-4.5',
  'sonnet': 'anthropic/claude-sonnet-4.5',
  'haiku': 'anthropic/claude-haiku-4.5',
  'claude': 'anthropic/claude-sonnet-4.5',

  // GPT (OpenAI)
  'gpt': 'openai/gpt-4o',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  '4o': 'openai/gpt-4o',
  'o1': 'openai/o1',
  'o3': 'openai/o3',
  'o3-mini': 'openai/o3-mini',
  'o4-mini': 'openai/o4-mini',

  // Gemini (Google)
  'gemini': 'google/gemini-2.5-flash',
  'flash': 'google/gemini-2.5-flash',
  'gemini-flash': 'google/gemini-2.5-flash',
  'gemini-pro': 'google/gemini-2.5-pro',

  // Llama (Meta)
  'llama': 'meta-llama/llama-4-maverick',
  'llama-4': 'meta-llama/llama-4-maverick',
  'llama-70b': 'meta-llama/llama-3.3-70b-instruct',

  // DeepSeek
  'deepseek': 'deepseek/deepseek-chat',
  'r1': 'deepseek/deepseek-r1',

  // Mistral
  'mistral': 'mistralai/mistral-large-2411',
  'codestral': 'mistralai/codestral-2501',

  // Qwen
  'qwen': 'qwen/qwen3-235b-a22b',

  // Grok
  'grok': 'x-ai/grok-3',

  // Perplexity
  'sonar': 'perplexity/sonar-pro',
}
