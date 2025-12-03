# ai-providers

Unified AI provider registry with smart routing and Cloudflare AI Gateway support.

## Quick Start

```typescript
import { model } from 'ai-providers'
import { generateText } from 'ai'

// Simple aliases - just works
const { text } = await generateText({
  model: await model('opus'),  // → anthropic/claude-opus-4.5
  prompt: 'Hello!'
})

// All these work too
await model('sonnet')      // → anthropic/claude-sonnet-4.5
await model('gpt-4o')      // → openai/gpt-4o
await model('gemini')      // → google/gemini-2.5-flash
await model('llama-70b')   // → meta-llama/llama-3.3-70b-instruct (via openrouter)
await model('mistral')     // → mistralai/mistral-large-2411 (via openrouter)
await model('deepseek')    // → deepseek/deepseek-chat (via openrouter)
```

## Smart Routing

Models are automatically routed to the best provider:

| Provider Prefix | Route | Benefits |
|----------------|-------|----------|
| `openai/*` | OpenAI SDK | Structured outputs, tool use, streaming |
| `anthropic/*` | Anthropic SDK | MCP, tool use, vision |
| `google/*` | Google AI SDK | Grounding, code execution |
| Everything else | OpenRouter | 200+ models, one API |

This means `opus` uses Anthropic's native SDK with full MCP support, while `llama-70b` goes through OpenRouter.

## Configuration

Set up Cloudflare AI Gateway for unified routing:

```bash
export AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}
export AI_GATEWAY_TOKEN=your-token
```

Or use direct API keys:

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_GENERATIVE_AI_API_KEY=...
export OPENROUTER_API_KEY=sk-or-...
```

## API

### `model(id: string)`

Get a language model with smart routing.

```typescript
// Aliases (requires language-models package)
await model('opus')        // anthropic/claude-opus-4.5
await model('sonnet')      // anthropic/claude-sonnet-4.5
await model('gpt-4o')      // openai/gpt-4o
await model('llama')       // meta-llama/llama-4-maverick

// Full IDs always work
await model('anthropic/claude-opus-4.5')
await model('mistralai/codestral-2501')
```

### `embeddingModel(id: string)`

Get an embedding model.

```typescript
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
```

## Available Aliases

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
