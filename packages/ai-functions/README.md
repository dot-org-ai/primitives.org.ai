# ai-functions

Core AI primitives for building intelligent applications with auto-defining functions.

## Installation

```bash
pnpm add ai-functions
```

## Quick Start

```typescript
import { ai } from 'ai-functions'

// Just call any function - it auto-defines on first use
const trip = await ai.planTrip({
  destination: 'Tokyo',
  dates: { start: '2024-03-01', end: '2024-03-10' },
  travelers: 2,
})

// Second call uses cached definition
const trip2 = await ai.planTrip({
  destination: 'Paris',
  dates: { start: '2024-06-01', end: '2024-06-07' },
  travelers: 4,
})
```

## Auto-Defining Functions

The `ai` proxy automatically analyzes function names and arguments to determine the best implementation:

```typescript
import { ai } from 'ai-functions'

// Generative - generates content
const summary = await ai.summarize({ text: 'Long article...' })
const recipe = await ai.generateRecipe({ cuisine: 'Italian', servings: 4 })
const email = await ai.writeEmail({ to: 'John', subject: 'Meeting', tone: 'professional' })

// Agentic - multi-step with tools
const research = await ai.researchTopic({ topic: 'quantum computing', depth: 'comprehensive' })
const analysis = await ai.analyzeCompetitors({ company: 'Acme Corp', market: 'SaaS' })

// Human - requires approval
const approval = await ai.approveExpense({ amount: 500, description: 'Team dinner' })
const review = await ai.reviewPullRequest({ pr: 123, repo: 'myapp' })

// Code - generates executable code
const algo = await ai.implementSortAlgorithm({ type: 'quicksort', language: 'typescript' })
```

## Explicit Function Definition

Define functions explicitly when you need precise control:

```typescript
import { ai, define } from 'ai-functions'

// Define a generative function
const summarize = define.generative({
  name: 'summarize',
  args: { text: 'The text to summarize', maxLength: 'Maximum length (number)' },
  output: 'string',
  system: 'You are an expert summarizer. Be concise.',
  promptTemplate: 'Summarize in {{maxLength}} words or less:\n\n{{text}}',
})

const result = await summarize.call({ text: 'Very long article...', maxLength: 100 })

// Define agentic function with tools
const research = define.agentic({
  name: 'research',
  args: { topic: 'Topic to research' },
  returnType: {
    summary: 'Research summary',
    sources: ['List of sources'],
    confidence: 'Confidence level (number)',
  },
  instructions: 'Research the topic thoroughly using available tools.',
  tools: [searchTool, fetchTool],
  maxIterations: 10,
})

// Define human-in-the-loop function
const approve = define.human({
  name: 'approveExpense',
  args: {
    amount: 'Expense amount (number)',
    description: 'What the expense is for',
    submitter: 'Who submitted it',
  },
  returnType: {
    approved: 'Whether approved (boolean)',
    notes: 'Approver notes',
  },
  channel: 'slack',
  instructions: 'Review the expense and approve or reject with notes.',
})

// Define code generation function
const implement = define.code({
  name: 'implementFunction',
  args: { spec: 'Function specification' },
  language: 'typescript',
  includeTests: true,
  includeExamples: true,
})
```

## Function Registry

Access and manage defined functions:

```typescript
import { ai, functions } from 'ai-functions'

// After calling ai.summarize(), it's in the registry
await ai.summarize({ text: '...' })

// List all defined functions
console.log(functions.list()) // ['summarize']

// Get a function
const fn = functions.get('summarize')
console.log(fn?.definition)

// Check if exists
if (functions.has('summarize')) {
  // ...
}

// Clear all
functions.clear()
```

## Schema-Based Functions

Create typed functions from schemas:

```typescript
import { AI } from 'ai-functions'

const ai = AI({
  recipe: {
    name: 'Recipe name',
    type: 'food | drink | dessert',
    servings: 'How many servings? (number)',
    ingredients: ['List all ingredients'],
    steps: ['Cooking steps in order'],
  },
  storyBrand: {
    hero: 'Who is the customer?',
    problem: {
      internal: 'What internal struggle?',
      external: 'What external challenge?',
    },
    solution: 'How do we help?',
  },
})

// Call with inferred types
const recipe = await ai.recipe('Italian pasta for 4 people')
// Type: { name: string, type: 'food'|'drink'|'dessert', servings: number, ingredients: string[], steps: string[] }
```

### Schema Syntax

| Syntax | Type | Example |
|--------|------|---------|
| `'description'` | string | `name: 'User name'` |
| `'desc (number)'` | number | `age: 'User age (number)'` |
| `'desc (boolean)'` | boolean | `active: 'Is active? (boolean)'` |
| `'desc (date)'` | datetime | `created: 'Created at (date)'` |
| `'opt1 \| opt2'` | enum | `status: 'pending \| done'` |
| `['description']` | string[] | `tags: ['List of tags']` |
| `{ nested }` | object | `address: { city: '...' }` |

## Generate Functions

Use `generateObject` and `generateText` directly:

```typescript
import { generateObject, generateText } from 'ai-functions'

// Generate structured object
const { object } = await generateObject({
  model: 'sonnet',
  schema: {
    title: 'Article title',
    sections: [{ heading: 'Heading', content: 'Content' }],
  },
  prompt: 'Write an article about TypeScript',
})

// Generate text
const { text } = await generateText({
  model: 'sonnet',
  prompt: 'Explain quantum computing',
})
```

## Embeddings

```typescript
import { embedText, embedTexts, findSimilar, cosineSimilarity } from 'ai-functions'

// Embed text
const { embedding } = await embedText('Hello world')
const { embeddings } = await embedTexts(['doc1', 'doc2', 'doc3'])

// Find similar
const results = findSimilar(queryEmbedding, embeddings, documents, {
  topK: 5,
  minScore: 0.7,
})

// Calculate similarity
const score = cosineSimilarity(embedding1, embedding2)
```

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `AI_GATEWAY_URL` | Cloudflare AI Gateway URL |
| `AI_GATEWAY_TOKEN` | Gateway auth token |
| `OPENAI_API_KEY` | OpenAI API key (fallback) |
| `ANTHROPIC_API_KEY` | Anthropic API key (fallback) |

## API Reference

### Core Exports

| Export | Description |
|--------|-------------|
| `ai` | Smart proxy with auto-define |
| `ai.functions` | Function registry |
| `ai.define` | Define helpers |
| `ai.defineFunction` | Full definition |
| `functions` | Direct registry access |
| `define` | Auto-define + typed helpers |
| `defineFunction` | Low-level define |

### Define Helpers

| Helper | Description |
|--------|-------------|
| `define(name, args)` | Auto-define from name + args |
| `define.generative({...})` | Define generative function |
| `define.agentic({...})` | Define agentic function |
| `define.human({...})` | Define human function |
| `define.code({...})` | Define code function |

### Generate Functions

| Function | Description |
|----------|-------------|
| `generateObject()` | Generate structured object |
| `generateText()` | Generate text |
| `streamObject()` | Stream object generation |
| `streamText()` | Stream text generation |

### Embedding Functions

| Function | Description |
|----------|-------------|
| `embedText()` | Embed single text |
| `embedTexts()` | Embed multiple texts |
| `cosineSimilarity()` | Calculate similarity |
| `findSimilar()` | Find similar items |
| `clusterBySimilarity()` | Cluster by similarity |
