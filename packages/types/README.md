# @org.ai/types

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

**Foundation type definitions for the AI primitives ecosystem.**

> **Note for Consumers**: This is an internal foundation package. For application development, use [`org.ai`](../org.ai) instead, which re-exports all types from this package plus additional organizational types (Role, Team, Goal, KPI, OKR).

## Package Relationship

```
@org.ai/types (foundation - internal)
└── Provides base types used by all packages

org.ai (consumer-facing)
├── Re-exports ALL of @org.ai/types
└── Adds organizational types (Role, Team, Goal, KPI, OKR)

Consumers should:
  import { Thing, Agent, Role, Team } from 'org.ai'  // Correct

NOT:
  import { Thing, Agent } from '@org.ai/types'       // Internal use only
```

## When to Use This Package

- **Internal packages** in the monorepo that need foundation types
- **Building new packages** that extend the type system

For **application development**, always use `org.ai`:

```typescript
// Recommended for applications
import type { Thing, Agent, Human, Role, Team, Goal } from 'org.ai'
```

## Foundation Types

This package provides the core type definitions:

### Entity Types
- `Thing`, `ThingDO` - Base entity types with URL-based identity
- `Things`, `ThingsDO`, `Collection` - Collection types
- `Noun`, `Verb`, `StandardVerbs` - Schema types

### Worker Types
- `WorkerType` - Base worker interface
- `AgentType` - AI agent with model, autonomy settings
- `HumanType` - Human worker with role, department, availability

### Event Types (5W+H)
- `Event` - Full event with all dimensions
- `EventWhat`, `EventWho`, `EventWhen`, `EventWhere`, `EventWhy`, `EventHow`

### Tool Types
- `ToolType` - Tool definition
- `ToolParameterType`, `ToolInputType`, `ToolOutputType`
- `ExecutableToolType`, `ValidatableToolType`
- `ToolsType`, `ToolboxType`

### Business Framework Types
- `LeanCanvasType` - 9-box business model canvas
- `StoryBrandType` - 7-part narrative framework
- `FounderType` - Founding team member
- `StartupType` - Startup with lifecycle stages
- `ICPType` - Ideal Customer Profile

### Utility Types
- `AIFunctionType<TOutput, TInput, TConfig>` - Generic AI function
- `EventHandlerType<TOutput, TInput>` - Workflow event handlers
- `WorkflowContextType` - Workflow execution context
- `RelationshipOperatorType` - Database relationship operators
- `ParsedFieldType` - Schema field definitions
- `ListOptions`, `ListResult`, `PaginationInfo` - Pagination types

### Type Guards
- `isWorker`, `isAgent`, `isHuman`
- `isTool`, `isToolParameter`, `isToolExecutionResult`
- `isStartup`, `isICP`
- `isLeanCanvas`, `isStoryBrand`, `isFounder`

### Factory Functions
- `createAgent(opts)` - Create an AI agent
- `createHuman(opts)` - Create a human worker

## Installation (for internal packages)

```bash
pnpm add @org.ai/types
```

## Usage (for internal packages)

```typescript
import type {
  Thing,
  AgentType,
  HumanType,
  WorkflowContextType,
} from '@org.ai/types'

import { isAgent, createAgent } from '@org.ai/types'
```

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

## License

MIT
