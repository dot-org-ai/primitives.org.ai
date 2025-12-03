# ai-providers

Unified AI provider registry with Cloudflare AI Gateway support.

## Installation

```bash
pnpm add ai-providers
```

## Quick Start

```typescript
import { model } from 'ai-providers'
import { generateText } from 'ai'

// Simple aliases - just works
const { text } = await generateText({
  model: await model('sonnet'),  // → anthropic/claude-sonnet-4.5
  prompt: 'Hello!'
})

// All these work too
await model('opus')        // → anthropic/claude-opus-4.5
await model('gpt-4o')      // → openai/gpt-4o
await model('gemini')      // → google/gemini-2.5-flash
await model('llama-70b')   // → meta-llama/llama-3.3-70b-instruct
await model('mistral')     // → mistralai/mistral-large-2411
await model('deepseek')    // → deepseek/deepseek-chat
```

## How It Works

### Smart Routing

The `model()` function uses intelligent routing based on model data from OpenRouter:

1. **Direct Provider Routing** - When `provider_model_id` is available and the provider matches (openai, anthropic, google), routes directly to the provider's native SDK. This enables provider-specific features like:
   - Anthropic: MCP (Model Context Protocol), extended thinking
   - OpenAI: Function calling, JSON mode, vision
   - Google: Grounding, code execution

2. **OpenRouter Fallback** - All other models route through OpenRouter, which provides:
   - 200+ models from all major providers
   - Unified API with consistent model ID format
   - Automatic model ID translation
   - Fallback routing if a provider is down

Model aliases are resolved by the `language-models` package, which includes `provider_model_id` data from OpenRouter's API for direct routing when available.

## Configuration

### Cloudflare AI Gateway (Recommended)

Set up a Cloudflare AI Gateway with stored secrets for each provider:

```bash
export AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}
export AI_GATEWAY_TOKEN=your-gateway-auth-token
```

The gateway handles authentication - you don't need individual API keys.

### Direct API Keys (Fallback)

If not using a gateway:

```bash
export OPENROUTER_API_KEY=sk-or-...
export OPENAI_API_KEY=sk-...           # for embeddings
export CLOUDFLARE_ACCOUNT_ID=...       # for CF embeddings
export CLOUDFLARE_API_TOKEN=...        # for CF embeddings
```

## API

### `model(id: string)`

Get a language model by alias or full ID.

```typescript
import { model } from 'ai-providers'

// Aliases (requires language-models package)
await model('opus')        // anthropic/claude-opus-4.5
await model('sonnet')      // anthropic/claude-sonnet-4.5
await model('gpt-4o')      // openai/gpt-4o
await model('llama')       // meta-llama/llama-4-maverick

// Full IDs always work
await model('anthropic/claude-opus-4.5')
await model('mistralai/codestral-2501')
await model('meta-llama/llama-3.3-70b-instruct')
```

### `embeddingModel(id: string)`

Get an embedding model.

```typescript
import { embeddingModel } from 'ai-providers'

await embeddingModel('openai:text-embedding-3-small')
await embeddingModel('cloudflare:@cf/baai/bge-m3')
```

### `createRegistry(config?)`

Create a custom provider registry.

```typescript
import { createRegistry } from 'ai-providers'

const registry = await createRegistry({
  gatewayUrl: 'https://gateway.ai.cloudflare.com/v1/...',
  gatewayToken: 'your-token'
})

// Use registry directly
const model = registry.languageModel('openrouter:anthropic/claude-sonnet-4.5')
```

### `getRegistry()`

Get the default singleton registry (lazily created).

```typescript
import { getRegistry } from 'ai-providers'

const registry = await getRegistry()
```

## Model Aliases

When `language-models` is installed, these aliases work:

| Alias | Model ID |
|-------|----------|
| `opus` | anthropic/claude-opus-4.5 |
| `sonnet` | anthropic/claude-sonnet-4.5 |
| `haiku` | anthropic/claude-haiku-4.5 |
| `gpt`, `gpt-4o` | openai/gpt-4o |
| `o1`, `o3` | openai/o1, openai/o3 |
| `gemini`, `flash` | google/gemini-2.5-flash |
| `llama`, `llama-4` | meta-llama/llama-4-maverick |
| `mistral` | mistralai/mistral-large-2411 |
| `deepseek`, `r1` | deepseek/deepseek-chat, deepseek/deepseek-r1 |
| `qwen` | qwen/qwen3-235b-a22b |
| `grok` | x-ai/grok-3 |

## Cloudflare Embeddings

The package includes a Cloudflare Workers AI embedding provider:

```typescript
import { cloudflareEmbedding } from 'ai-providers/cloudflare'
import { embed } from 'ai'

const model = cloudflareEmbedding('@cf/baai/bge-m3')
const { embedding } = await embed({ model, value: 'Hello world' })
```

Available models:
- `@cf/baai/bge-m3` (default, multilingual)
- `@cf/baai/bge-base-en-v1.5`
- `@cf/baai/bge-large-en-v1.5`
- `@cf/baai/bge-small-en-v1.5`

## Architecture

```
┌─────────────────┐
│   ai-functions  │  Uses model() for generation
└────────┬────────┘
         │
┌────────▼────────┐
│   ai-providers  │  Resolves aliases, smart routing
└────────┬────────┘
         │
┌────────▼────────┐
│ language-models │  Model data with provider_model_id
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌───▼───┐
│Direct │ │OpenRou│  Direct: openai, anthropic, google
│SDK    │ │ter    │  OpenRouter: all other providers
└───────┘ └───────┘
```

## Gateway Authentication

When using Cloudflare AI Gateway with stored secrets:

1. Gateway URL points to your gateway endpoint
2. `AI_GATEWAY_TOKEN` authenticates with the gateway
3. Gateway injects provider API keys from its stored secrets
4. No individual API keys needed in your app

The package automatically:
- Strips SDK-added API key headers
- Adds `cf-aig-authorization` header for gateway auth
- Lets the gateway inject the real API keys
