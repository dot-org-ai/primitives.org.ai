# ai-functions

![Stability: Stable](https://img.shields.io/badge/stability-stable-green)

**Calling AI models shouldn't require 50 lines of boilerplate.**

You just want to get a response from Claude, GPT, or Gemini. Instead, you're drowning in SDK initialization, error handling, retry logic, JSON parsing, and type coercion. Every AI call becomes a small engineering project.

```typescript
// What you're doing now
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic()
try {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'List 5 startup ideas' }],
  })
  const text = response.content[0].type === 'text'
    ? response.content[0].text
    : ''
  const ideas = JSON.parse(text) // Pray it's valid JSON
} catch (e) {
  if (e.status === 429) { /* rate limit logic */ }
  if (e.status === 500) { /* retry logic */ }
  // ... 30 more lines
}
```

```typescript
// What you could be doing
import { list } from 'ai-functions'

const ideas = await list`5 startup ideas`
```

## Installation

```bash
npm install ai-functions
```

Set your API key:

```bash
export ANTHROPIC_API_KEY=sk-...  # or OPENAI_API_KEY
```

## Quick Start

### Template Literals for Natural AI Calls

```typescript
import { ai, list, is, write } from 'ai-functions'

// Generate text
const poem = await write`a haiku about TypeScript`

// Generate lists
const ideas = await list`10 startup ideas in healthcare`

// Yes/no decisions
const isValid = await is`"john@example" is a valid email`

// Structured objects with auto-inferred schema
const { title, summary, tags } = await ai`analyze this article: ${articleText}`
```

### The `list` Primitive with `.map()`

Process lists with automatic batching - one prompt generates items, then each item is processed in parallel:

```typescript
const ideas = await list`5 startup ideas`.map(idea => ({
  idea,
  viable: is`${idea} is technically feasible`,
  market: ai`estimate market size for ${idea}`,
}))

// Result: Array of { idea, viable, market } objects
```

### Boolean Checks with `is`

```typescript
// Simple validation
const isColor = await is`"turquoise" is a color`  // true

// Content moderation
const isSafe = await is`${userContent} is safe for work`

// Quality checks
const { conclusion } = await ai`write about ${topic}`
const isWellArgumented = await is`${conclusion} is well-argued`
```

### Task Execution with `do`

```typescript
const { summary, actions } = await do`send welcome email to ${user.email}`
// Returns: { summary: "...", actions: ["Created email", "Sent via SMTP", ...] }
```

## Features

### Batch Processing (50% Cost Savings)

Process large workloads at half the cost using provider batch APIs:

```typescript
import { createBatch, write } from 'ai-functions'

// Create a batch queue
const batch = createBatch({ provider: 'openai' })

// Add items (deferred, not executed)
const posts = titles.map(title =>
  batch.add(`Write a blog post about ${title}`)
)

// Submit for batch processing
const { job } = await batch.submit()
console.log(job.id) // batch_abc123

// Wait for results (up to 24hr turnaround)
const results = await batch.wait()
```

Or use the `withBatch` helper:

```typescript
import { withBatch } from 'ai-functions'

const results = await withBatch(async (batch) => {
  return ['TypeScript', 'React', 'Next.js'].map(topic =>
    batch.add(`Write tutorial about ${topic}`)
  )
})
```

### Retry & Circuit Breaker

Built-in resilience for production workloads:

```typescript
import { withRetry, RetryPolicy, CircuitBreaker, FallbackChain } from 'ai-functions'

// Simple retry wrapper
const reliableAI = withRetry(myAIFunction, {
  maxRetries: 3,
  baseDelay: 1000,
  jitter: 0.2,  // Prevent thundering herd
})

// Advanced retry policy
const policy = new RetryPolicy({
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 30000,
  jitterStrategy: 'decorrelated',
  respectRetryAfter: true,  // Honor rate limit headers
})

await policy.execute(async () => {
  return await ai`generate content`
})

// Circuit breaker for fail-fast
const breaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeout: 30000,
})

await breaker.execute(async () => {
  return await ai`generate content`
})

// Model fallback chain
const fallback = new FallbackChain([
  { name: 'claude-sonnet', execute: () => generateWithClaude(prompt) },
  { name: 'gpt-4o', execute: () => generateWithGPT(prompt) },
  { name: 'gemini-pro', execute: () => generateWithGemini(prompt) },
])

const result = await fallback.execute()
```

### Caching

Avoid redundant API calls with intelligent caching:

```typescript
import { GenerationCache, EmbeddingCache, withCache, MemoryCache } from 'ai-functions'

// Generation cache
const cache = new GenerationCache({
  defaultTTL: 3600000, // 1 hour
  maxSize: 1000,       // LRU eviction
})

// Check cache first
const cached = await cache.get({ prompt, model: 'sonnet' })
if (!cached) {
  const result = await ai`${prompt}`
  await cache.set({ prompt, model: 'sonnet' }, result)
}

// Embedding cache with batch support
const embedCache = new EmbeddingCache()
const { hits, misses } = await embedCache.getMany(texts, { model: 'text-embedding-3-small' })

// Wrap any function with caching
const cachedGenerate = withCache(
  new MemoryCache(),
  generateContent,
  { keyFn: (prompt) => prompt, ttl: 3600000 }
)
```

### Budget Tracking

Monitor and limit spending:

```typescript
import { BudgetTracker, withBudget, BudgetExceededError } from 'ai-functions'

// Create a budget tracker
const tracker = new BudgetTracker({
  maxTokens: 100000,
  maxCost: 10.00,  // USD
  alertThresholds: [0.5, 0.8, 0.95],
  onAlert: (alert) => {
    console.log(`Budget ${alert.type} at ${alert.threshold * 100}%`)
  },
})

// Record usage
tracker.recordUsage({
  inputTokens: 1500,
  outputTokens: 500,
  model: 'claude-sonnet-4-20250514',
})

// Check remaining budget
console.log(tracker.getRemainingBudget())
// { tokens: 98000, cost: 9.95 }

// Use with automatic tracking
const result = await withBudget({ maxCost: 5.00 }, async (tracker) => {
  // All AI calls within this scope are tracked
  return await ai`generate content`
})
```

### Tool Orchestration

Build agentic loops with tool calling:

```typescript
import { AgenticLoop, createTool, createToolset } from 'ai-functions'

// Define tools
const searchTool = createTool({
  name: 'search',
  description: 'Search the web',
  parameters: { query: 'Search query' },
  handler: async ({ query }) => await searchWeb(query),
})

const calculatorTool = createTool({
  name: 'calculate',
  description: 'Perform calculations',
  parameters: { expression: 'Math expression' },
  handler: async ({ expression }) => eval(expression),
})

// Create an agentic loop
const loop = new AgenticLoop({
  model: 'claude-sonnet-4-20250514',
  tools: [searchTool, calculatorTool],
  maxIterations: 10,
})

const result = await loop.run('What is the population of Tokyo times 2?')
```

## Configuration

### Global Configuration

```typescript
import { configure } from 'ai-functions'

configure({
  model: 'claude-sonnet-4-20250514',
  provider: 'anthropic',
  batchMode: 'auto',  // 'auto' | 'immediate' | 'flex' | 'deferred'
  flexThreshold: 5,   // Use flex for 5+ items
  batchThreshold: 500, // Use batch API for 500+ items
})
```

### Scoped Configuration

```typescript
import { withContext } from 'ai-functions'

const results = await withContext(
  { provider: 'openai', model: 'gpt-4o', batchMode: 'deferred' },
  async () => {
    const titles = await list`10 blog titles`
    return titles.map(title => write`blog post: ${title}`)
  }
)
```

### Environment Variables

```bash
AI_MODEL=claude-sonnet-4-20250514
AI_PROVIDER=anthropic
AI_BATCH_MODE=auto
AI_FLEX_THRESHOLD=5
AI_BATCH_THRESHOLD=500
AI_BATCH_WEBHOOK_URL=https://api.example.com/webhook
```

## Schema-Based Functions

Create typed AI functions with simple schemas:

```typescript
import { AI } from 'ai-functions'

const ai = AI({
  recipe: {
    name: 'Recipe name',
    servings: 'Number of servings (number)',
    ingredients: ['List of ingredients'],
    steps: ['Cooking steps'],
    prepTime: 'Prep time in minutes (number)',
  },
  storyBrand: {
    hero: 'Who is the customer?',
    problem: {
      internal: 'Internal struggle',
      external: 'External challenge',
      philosophical: 'Why is this wrong?',
    },
    guide: 'Who helps them?',
    plan: ['Steps to success'],
    callToAction: 'What should they do?',
    success: 'What success looks like',
    failure: 'What failure looks like',
  },
})

// Fully typed results
const recipe = await ai.recipe('Italian pasta for 4 people')
// { name: string, servings: number, ingredients: string[], ... }

const brand = await ai.storyBrand('A developer tools startup')
// { hero: string, problem: { internal, external, philosophical }, ... }
```

## Define Custom Functions

```typescript
import { define, defineFunction } from 'ai-functions'

// Auto-define from name and example args
const planTrip = await define('planTrip', {
  destination: 'Tokyo',
  travelers: 2
})

// Or define explicitly with full control
const summarize = defineFunction({
  type: 'generative',
  name: 'summarize',
  args: { text: 'Text to summarize', maxLength: 'Max words (number)' },
  output: 'string',
  promptTemplate: 'Summarize in {{maxLength}} words: {{text}}',
})

// Use the defined functions
const trip = await planTrip.call({ destination: 'Paris', travelers: 4 })
const summary = await summarize.call({ text: longArticle, maxLength: 100 })
```

## API Reference

### Core Primitives

| Function | Description | Returns |
|----------|-------------|---------|
| `ai` | General-purpose generation with dynamic schema | `Promise<T>` |
| `write` | Generate text content | `Promise<string>` |
| `list` | Generate a list of items | `Promise<string[]>` |
| `lists` | Generate multiple named lists | `Promise<Record<string, string[]>>` |
| `is` | Boolean yes/no checks | `Promise<boolean>` |
| `do` | Execute a task | `Promise<{ summary, actions }>` |
| `extract` | Extract structured data | `Promise<T[]>` |
| `summarize` | Summarize content | `Promise<string>` |
| `code` | Generate code | `Promise<string>` |
| `decide` | Choose between options | `(options) => Promise<T>` |

### Batch Processing

| Export | Description |
|--------|-------------|
| `createBatch()` | Create a batch queue for deferred execution |
| `withBatch()` | Execute operations in batch mode |
| `BatchQueue` | Class for managing batch jobs |

### Resilience

| Export | Description |
|--------|-------------|
| `withRetry()` | Wrap function with retry logic |
| `RetryPolicy` | Configurable retry policy |
| `CircuitBreaker` | Fail-fast circuit breaker |
| `FallbackChain` | Model failover chain |

### Caching

| Export | Description |
|--------|-------------|
| `MemoryCache` | In-memory LRU cache |
| `GenerationCache` | Cache for generation results |
| `EmbeddingCache` | Cache for embeddings |
| `withCache()` | Wrap function with caching |

### Budget & Tracking

| Export | Description |
|--------|-------------|
| `BudgetTracker` | Track token usage and costs |
| `withBudget()` | Execute with budget limits |
| `RequestContext` | Request tracing and isolation |

### Configuration

| Export | Description |
|--------|-------------|
| `configure()` | Set global defaults |
| `withContext()` | Scoped configuration |
| `getContext()` | Get current context |

## Related Packages

- [`ai-core`](../ai-core) - Lightweight core primitives (no batch/budget/retry)
- [`ai-providers`](../ai-providers) - Provider integrations
- [`language-models`](../language-models) - Model aliases and configuration

## License

MIT
