# language-models

Model listing and resolution for LLM providers. Fetches models from OpenRouter and resolves aliases to full model IDs.

## Quick Start

```typescript
import { resolve, list, search } from 'language-models'

// Resolve aliases to full model IDs
resolve('opus')        // 'anthropic/claude-opus-4.5'
resolve('gpt-4o')      // 'openai/gpt-4o'
resolve('llama-70b')   // 'meta-llama/llama-3.3-70b-instruct'
resolve('mistral')     // 'mistralai/mistral-large-2411'

// List all available models
const models = list()

// Search models
const claudeModels = search('claude')
```

## API

### `resolve(input: string): string`

Resolve an alias or partial name to a full model ID.

```typescript
resolve('opus')                      // 'anthropic/claude-opus-4.5'
resolve('sonnet')                    // 'anthropic/claude-sonnet-4.5'
resolve('gpt')                       // 'openai/gpt-4o'
resolve('llama')                     // 'meta-llama/llama-4-maverick'
resolve('anthropic/claude-opus-4.5') // 'anthropic/claude-opus-4.5' (pass-through)
```

### `list(): ModelInfo[]`

List all available models from OpenRouter.

### `get(id: string): ModelInfo | undefined`

Get a model by exact ID.

### `search(query: string): ModelInfo[]`

Search models by ID or name.

## Available Aliases

| Alias | Model ID |
|-------|----------|
| `opus` | anthropic/claude-opus-4.5 |
| `sonnet` | anthropic/claude-sonnet-4.5 |
| `haiku` | anthropic/claude-haiku-4.5 |
| `claude` | anthropic/claude-sonnet-4.5 |
| `gpt`, `gpt-4o`, `4o` | openai/gpt-4o |
| `o1`, `o3`, `o3-mini` | openai/o1, openai/o3, openai/o3-mini |
| `gemini`, `flash` | google/gemini-2.5-flash |
| `gemini-pro` | google/gemini-2.5-pro |
| `llama`, `llama-4` | meta-llama/llama-4-maverick |
| `llama-70b` | meta-llama/llama-3.3-70b-instruct |
| `mistral` | mistralai/mistral-large-2411 |
| `codestral` | mistralai/codestral-2501 |
| `deepseek` | deepseek/deepseek-chat |
| `r1` | deepseek/deepseek-r1 |
| `qwen` | qwen/qwen3-235b-a22b |
| `grok` | x-ai/grok-3 |
| `sonar` | perplexity/sonar-pro |

## Updating Models

Fetch the latest models from OpenRouter:

```bash
pnpm fetch-models
```

This updates `data/models.json` with all available models.
