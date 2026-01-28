# @org.ai/types

**You're building AI-powered applications, but TypeScript keeps fighting you.** Your AI functions return `any`, your workflow contexts are untyped blobs, and refactoring means breaking things you cannot see.

`@org.ai/types` gives you the type safety you need to build AI applications with confidence.

## The Problem

```typescript
// Without types: runtime errors waiting to happen
const result = await aiFunction(input) // What does this return?
workflow.on('event', (data) => {       // What's in data?
  workflow.state.user = data           // Is this right?
})
```

## The Solution

```typescript
import type { AIFunctionType, WorkflowContextType, EventHandlerType } from '@org.ai/types'

// With types: autocomplete, refactoring, and compile-time safety
const summarize: AIFunctionType<Summary, Document> = async (doc) => {
  // TypeScript knows doc is Document, return must be Summary
}

const handler: EventHandlerType<void, UserEvent> = (data, ctx) => {
  // data is UserEvent, ctx has full WorkflowContextType methods
  ctx.send('notification', { userId: data.userId })
}
```

## Quick Start

### 1. Install

```bash
npm install @org.ai/types
```

### 2. Import the types you need

```typescript
import type {
  AIFunctionType,
  EventHandlerType,
  WorkflowContextType,
  RelationshipOperatorType,
  ParsedFieldType,
} from '@org.ai/types'
```

### 3. Build with confidence

Your IDE now understands your AI code. Refactor fearlessly.

## Type Reference

| Type | Purpose |
|------|---------|
| `AIFunctionType<TOutput, TInput, TConfig>` | Generic AI function with output-first parameter order |
| `EventHandlerType<TOutput, TInput>` | Workflow event handlers with typed context |
| `WorkflowContextType` | The `$` workflow proxy with `send`, `try`, `do`, `on`, `every` |
| `RelationshipOperatorType` | Database relationship operators (`->`, `~>`, `<-`, `<~`) |
| `ParsedFieldType` | Schema field definitions with relationship metadata |

## Why Output-First Generics?

Just like `Promise<T>` puts the important part first, `AIFunctionType<TOutput>` leads with what matters most:

```typescript
// Natural reading order: "an AI function that returns a Summary"
type Summarizer = AIFunctionType<Summary>

// vs the awkward alternative
type Summarizer = AIFunctionType<Document, Summary>  // Wait, which is which?
```

## Part of the org.ai Ecosystem

This package provides shared types for:
- [ai-functions](../ai-functions) - AI function primitives
- [ai-workflows](../ai-workflows) - Workflow orchestration
- [ai-database](../ai-database) - AI-native database with relationships
- And [more packages](../) in the org.ai monorepo

## License

MIT
