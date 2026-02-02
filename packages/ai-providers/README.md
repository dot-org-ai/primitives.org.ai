# ai-providers

![Stability: Stable](https://img.shields.io/badge/stability-stable-green)

**Stop juggling API keys. Start building.**

You're building AI features, not managing provider configurations. But every model needs its own SDK, its own API key, its own quirks. OpenAI, Anthropic, Google, Llama, Mistral... each one is another dependency to install, another secret to manage, another authentication pattern to remember.

What if you could just say `model('sonnet')` and it worked?

## The Problem

```typescript
// Before: Provider chaos
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const google = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)

// Different APIs, different patterns, different headaches
```

## The Solution

```typescript
// After: One import, any model
import { model } from 'ai-providers'
import { generateText } from 'ai'

const { text } = await generateText({
  model: await model('sonnet'),  // Just works
  prompt: 'Hello!'
})

// Switch models in seconds
await model('opus')        // Anthropic Claude Opus 4.5
await model('gpt-4o')      // OpenAI GPT-4o
await model('gemini')      // Google Gemini 2.5 Flash
await model('llama-70b')   // Meta Llama 3.3 70B
await model('deepseek')    // DeepSeek Chat
await model('mistral')     // Mistral Large
```

## Quick Start

### 1. Install

```bash
pnpm add ai-providers ai
```

### 2. Configure (choose one)

**Option A: Cloudflare AI Gateway (Recommended)**

One gateway, all providers, zero API key management:

```bash
export AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}
export AI_GATEWAY_TOKEN=your-gateway-auth-token
```

**Option B: Direct API Keys**

```bash
export OPENROUTER_API_KEY=sk-or-...  # Access 200+ models
```

### 3. Build

```typescript
import { model } from 'ai-providers'
import { generateText } from 'ai'

const { text } = await generateText({
  model: await model('sonnet'),
  prompt: 'What is the meaning of life?'
})
```

That's it. No provider-specific SDKs. No authentication dance. Just AI.

## How It Works

`ai-providers` is your guide through the AI provider landscape:

```
Your Code
    │
    ▼
┌─────────────────┐
│   ai-providers  │  Resolves aliases, routes intelligently
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────────┐
│Direct │ │OpenRouter│
│SDK    │ │          │
└───────┘ └──────────┘
    │         │
    ▼         ▼
Anthropic   200+ models
OpenAI      from any
Google      provider
```

**Smart routing** gives you the best of both worlds:
- **Direct SDK access** for OpenAI, Anthropic, and Google - enabling provider-specific features like MCP, extended thinking, and structured outputs
- **OpenRouter fallback** for everything else - 200+ models with automatic failover

## Model Aliases

Simple names that just work:

| Alias | Model |
|-------|-------|
| `opus` | Claude Opus 4.5 |
| `sonnet` | Claude Sonnet 4.5 |
| `haiku` | Claude Haiku 4.5 |
| `gpt-4o` | GPT-4o |
| `o1`, `o3` | OpenAI o1, o3 |
| `gemini` | Gemini 2.5 Flash |
| `llama` | Llama 4 Maverick |
| `deepseek`, `r1` | DeepSeek Chat, R1 |
| `mistral` | Mistral Large |
| `qwen` | Qwen3 235B |
| `grok` | Grok 3 |

Or use full model IDs:

```typescript
await model('anthropic/claude-opus-4.5')
await model('mistralai/codestral-2501')
await model('meta-llama/llama-3.3-70b-instruct')
```

## Embeddings

```typescript
import { embeddingModel } from 'ai-providers'
import { embed } from 'ai'

const model = await embeddingModel('openai:text-embedding-3-small')
const { embedding } = await embed({ model, value: 'Hello world' })

// Or use Cloudflare Workers AI
const cfModel = await embeddingModel('cloudflare:@cf/baai/bge-m3')
```

## Advanced Usage

### Custom Registry

```typescript
import { createRegistry } from 'ai-providers'

const registry = await createRegistry({
  gatewayUrl: 'https://gateway.ai.cloudflare.com/v1/...',
  gatewayToken: 'your-token'
})

const model = registry.languageModel('anthropic:claude-sonnet-4-5-20251101')
```

### Direct Provider Access

When you need provider-specific features:

```typescript
// Bedrock with bearer token auth
await model('bedrock:us.anthropic.claude-3-5-sonnet-20241022-v2:0')

// Direct provider routing
await model('openai:gpt-4o')
await model('anthropic:claude-sonnet-4-5-20251101')
await model('google:gemini-2.5-flash')
```

## Why Cloudflare AI Gateway?

When configured with AI Gateway:

1. **One token** authenticates everything - gateway injects provider keys from its secrets
2. **Unified logging** - see all AI calls in one dashboard
3. **Rate limiting** - protect your budget across providers
4. **Caching** - reduce costs with intelligent response caching
5. **Fallback routing** - automatic failover if a provider is down

No gateway? No problem. Set individual API keys and `ai-providers` works the same way.

## What You Get

With `ai-providers`, you can:

- **Ship faster** - one import, any model, zero config
- **Stay flexible** - switch providers without code changes
- **Build with confidence** - production-ready with Cloudflare AI Gateway
- **Access everything** - 200+ models through OpenRouter, native SDK features through direct routing

Stop wrestling with provider APIs. Start building AI features.
