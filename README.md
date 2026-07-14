# primitives.org.ai

**Building AI apps shouldn't mean sacrificing code quality.**

Your AI code is scattered across files, riddled with inconsistent patterns, and nearly impossible to maintain. Every new feature feels like adding another layer to an already fragile house of cards. You're not alone - developers everywhere are drowning in AI complexity, but software doesn't have to be this way.

## The Solution

**primitives.org.ai** provides battle-tested building blocks for AI applications. These aren't experimental toys - they're production-grade primitives with full TypeScript support, designed to compose elegantly and scale confidently.

## Quick Start

**1. Install**

```bash
npm install ai-functions
```

**2. Import**

```typescript
import { ai } from 'ai-functions'
```

**3. Ship**

```typescript
const sentiment = await ai.is('This product is amazing!', {
  positive: 'Expresses satisfaction or enthusiasm',
  negative: 'Expresses disappointment or frustration',
  neutral: 'Neither positive nor negative'
})
// => 'positive'

const summary = await ai.do('Summarize this article in 3 bullet points', {
  article: longArticleText
})

const users = await ai.list('Generate 5 realistic user personas for a fitness app')
```

## Packages

### Core Primitives

| Package | Description |
|---------|-------------|
| [`ai-functions`](./packages/ai-functions) | Type-safe AI function calls with `ai.do()`, `ai.is()`, `ai.list()`, and more |
| [`ai-database`](./packages/ai-database) | AI-powered database operations with semantic search and CRUD |
| [`ai-workflows`](./packages/ai-workflows) | Event-driven workflows and state machine orchestration |

### Workers and Tasks

| Package | Description |
|---------|-------------|
| [`digital-workers`](./packages/digital-workers) | Unified interface for AI agents and human workers |
| [`digital-tasks`](./packages/digital-tasks) | Task queues with dependencies, priorities, and lifecycle management |
| [`digital-tools`](./packages/digital-tools) | Tool definitions compatible with MCP and function calling |

### Human-AI Collaboration

| Package | Description |
|---------|-------------|
| [`autonomous-agents`](./packages/autonomous-agents) | Build and orchestrate autonomous AI agents with goals |
| [`human-in-the-loop`](./packages/human-in-the-loop) | Integrate human oversight and approval workflows |
| [`@org.ai/authority`](./packages/authority) | Zero-dependency authority kernel - five-axis tokens, register discipline, and competence-typed gates ([docs](./packages/authority/README.md)) |

### Business Logic

| Package | Description |
|---------|-------------|
| [`business-as-code`](./packages/business-as-code) | Model business processes, KPIs, and OKRs in code |
| [`services-as-software`](./packages/services-as-software) | Transform services into programmable software interfaces |

## Why primitives.org.ai?

### Without primitives

- Spaghetti code that nobody wants to touch
- Budget overruns from reinventing wheels
- Security vulnerabilities in custom AI handling
- Inconsistent behavior across your application
- Tests that are impossible to write

### With primitives

- Clean, composable functions that read like documentation
- Type-safe interfaces that catch errors at compile time
- Production-tested patterns used across real applications
- Consistent abstractions from prototype to production
- Full test coverage with proven reliability

## Documentation

- [Getting Started](https://primitives.org.ai/docs)
- [API Reference](https://primitives.org.ai/docs/api)
- [Examples](./packages/examples)

## Installation

```bash
# Core package (most users start here)
npm install ai-functions

# Additional packages as needed
npm install ai-database ai-workflows digital-tasks
```

## License

MIT
