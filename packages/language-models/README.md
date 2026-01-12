# language-models

**Stop memorizing model IDs. Start shipping.**

You're building AI-powered applications, but every provider has different naming conventions. Is it `claude-opus-4-5-20251101` or `anthropic/claude-opus-4.5`? Was it `gpt-4o` or `openai/gpt-4o`? You shouldn't have to care.

## The Problem

```typescript
// Without language-models: fragile, provider-specific, constantly breaking
const model = 'anthropic/claude-3-opus-20240229' // Wait, is this still current?
const model = 'claude-opus-4-5-20251101'         // Or was it this format?
const model = 'anthropic/claude-opus-4.5'        // Which one does OpenRouter want?
```

## The Solution

```typescript
// With language-models: simple, memorable, always resolves correctly
import { resolve } from 'language-models'

resolve('opus')   // 'anthropic/claude-opus-4.5'
resolve('sonnet') // 'anthropic/claude-sonnet-4.5'
resolve('gpt')    // 'openai/gpt-4o'
resolve('llama')  // 'meta-llama/llama-4-maverick'
```

## Quick Start

**1. Install**
```bash
npm install language-models
```

**2. Import**
```typescript
import { resolve, list, search } from 'language-models'
```

**3. Use**
```typescript
// Resolve human-friendly aliases to full model IDs
const modelId = resolve('opus')

// Search across 200+ models
const claudeModels = search('claude')

// Get full model catalog with pricing and context info
const allModels = list()
```

## API Reference

### `resolve(input: string): string`

Resolve an alias or partial name to a full OpenRouter model ID.

```typescript
resolve('opus')                      // 'anthropic/claude-opus-4.5'
resolve('sonnet')                    // 'anthropic/claude-sonnet-4.5'
resolve('gpt')                       // 'openai/gpt-4o'
resolve('llama')                     // 'meta-llama/llama-4-maverick'
resolve('anthropic/claude-opus-4.5') // Pass-through for full IDs
```

### `resolveWithProvider(input: string): ResolvedModel`

Get full routing information including provider details for direct SDK access.

```typescript
const info = resolveWithProvider('opus')
// {
//   id: 'anthropic/claude-opus-4.5',
//   provider: 'anthropic',
//   providerModelId: 'claude-opus-4-5-20251101',
//   supportsDirectRouting: true,
//   model: { name, pricing, context_length, ... }
// }
```

### `list(): ModelInfo[]`

Get the complete model catalog with pricing, context lengths, and capabilities.

### `get(id: string): ModelInfo | undefined`

Fetch a specific model by exact ID.

### `search(query: string): ModelInfo[]`

Find models matching a search query across IDs and names.

## Supported Aliases

| You type | You get |
|----------|---------|
| `opus` | `anthropic/claude-opus-4.5` |
| `sonnet` | `anthropic/claude-sonnet-4.5` |
| `haiku` | `anthropic/claude-haiku-4.5` |
| `gpt`, `gpt-4o`, `4o` | `openai/gpt-4o` |
| `o1`, `o3`, `o3-mini` | `openai/o1`, `openai/o3`, `openai/o3-mini` |
| `gemini`, `flash` | `google/gemini-2.5-flash` |
| `gemini-pro` | `google/gemini-2.5-pro` |
| `llama`, `llama-4` | `meta-llama/llama-4-maverick` |
| `llama-70b` | `meta-llama/llama-3.3-70b-instruct` |
| `mistral` | `mistralai/mistral-large-2411` |
| `codestral` | `mistralai/codestral-2501` |
| `deepseek` | `deepseek/deepseek-chat` |
| `r1` | `deepseek/deepseek-r1` |
| `qwen` | `qwen/qwen3-235b-a22b` |
| `grok` | `x-ai/grok-3` |
| `sonar` | `perplexity/sonar-pro` |

## Direct Provider Routing

For providers that support direct SDK access (Anthropic, OpenAI, Google), use `resolveWithProvider` to get the native model ID:

```typescript
import { resolveWithProvider, DIRECT_PROVIDERS } from 'language-models'

const { provider, providerModelId, supportsDirectRouting } = resolveWithProvider('opus')

if (supportsDirectRouting) {
  // Use native SDK with providerModelId
} else {
  // Route through OpenRouter
}
```

## Updating the Model Catalog

```bash
pnpm fetch-models
```

Fetches the latest models from OpenRouter and updates `data/models.json`.

## License

MIT
