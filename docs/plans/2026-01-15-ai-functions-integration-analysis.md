# AI Functions Integration with Digital Objects Analysis

## Executive Summary

This document analyzes the `ai-functions` package to understand how it can integrate with `digital-objects` for persistent storage of AI function definitions, registries, and execution results.

## Current Architecture

### ai-functions Package Overview

The `ai-functions` package provides a comprehensive AI primitives library with:

1. **Core Generation Functions**
   - `generate`, `ai`, `write`, `code`, `list`, `lists`, `extract`, `summarize`
   - `is` (boolean classification), `decide` (multi-option selection)
   - `diagram`, `slides`, `image`, `video`
   - `research`, `do`, `browse`, `read`
   - Human-in-the-loop: `ask`, `approve`, `review`

2. **Function Definition System**
   - `defineFunction()` - Create typed AI functions
   - `define()` - Auto-define functions from name and example args
   - Four function types:
     - `code` - Generates executable code
     - `generative` - Uses AI to generate text/objects/media
     - `agentic` - Runs in a loop with tools
     - `human` - Requires human input/approval

3. **Function Registry**
   - In-memory `InMemoryFunctionRegistry` class
   - Global `functions` registry instance
   - `createFunctionRegistry()` for isolated registries

4. **AI Proxy System**
   - `AI()` constructor with schema-based functions
   - Dynamic function auto-definition on first call
   - RPC client mode (planned, not yet implemented)

5. **Extended Features** (not in ai-core)
   - Batch processing (`BatchQueue`, `BatchMapPromise`)
   - Retry/resilience (`RetryPolicy`, `CircuitBreaker`, `FallbackChain`)
   - Budget tracking (`BudgetTracker`, `TokenCounter`)
   - Caching (`MemoryCache`, `EmbeddingCache`, `GenerationCache`)
   - Tool orchestration (`AgenticLoop`, `ToolRouter`)

### Current Storage Architecture

**ai-functions currently has NO persistence layer.** All storage is in-memory:

```typescript
// src/ai.ts - InMemoryFunctionRegistry
class InMemoryFunctionRegistry implements FunctionRegistry {
  private functions = new Map<string, DefinedFunction>()

  get(name: string): DefinedFunction | undefined
  set(name: string, fn: DefinedFunction): void
  has(name: string): boolean
  list(): string[]
  delete(name: string): boolean
  clear(): void
}
```

The `FunctionRegistry` interface provides basic CRUD operations but no persistence, search, or relationships.

### Cache System (In-Memory Only)

```typescript
// src/cache.ts
class MemoryCache<T> implements CacheStorage<T> {
  private cache: Map<string, CacheEntry<T>> = new Map()
  private accessOrder: string[] = []  // LRU tracking
}

class EmbeddingCache extends MemoryCache<number[]>
class GenerationCache extends MemoryCache<unknown>
```

## Relationship to ai-database

The `ai-database` package provides rich semantic types that overlap significantly with ai-functions:

### Overlapping Concepts

| ai-functions | ai-database | digital-objects |
|--------------|-------------|-----------------|
| `FunctionDefinition` | `Noun` + `Verb` | `Noun` + `Verb` |
| `DefinedFunction` | `Thing` | `Thing` |
| Function call | `Action` | `Action` |
| `CodeFunctionResult` | `Artifact` | (could be Thing) |
| `HumanFunctionResult` | `Event` | `Action` |
| `AgenticExecutionState` | `Action` with status | `Action` with status |

### ai-database Noun/Verb System

```typescript
// ai-database/src/types.ts
interface Verb {
  action: string      // 'create' (imperative)
  actor?: string      // 'creator' (agent noun)
  act?: string        // 'creates' (3rd person)
  activity?: string   // 'creating' (gerund)
  result?: string     // 'creation' (result noun)
  reverse?: {         // Passive forms
    at?: string       // 'createdAt'
    by?: string       // 'createdBy'
    in?: string       // 'createdIn'
    for?: string      // 'createdFor'
  }
  inverse?: string    // 'delete'
}

interface Noun {
  singular: string
  plural: string
  description?: string
  properties?: Record<string, NounProperty>
  relationships?: Record<string, NounRelationship>
  actions?: Array<string | Verb>
  events?: string[]
}
```

### digital-objects Noun/Verb System

```typescript
// digital-objects/src/types.ts
interface Noun {
  name: string        // 'Post', 'Author'
  singular: string    // 'post', 'author'
  plural: string      // 'posts', 'authors'
  slug: string        // URL-safe: 'post', 'author'
  description?: string
  schema?: Record<string, FieldDefinition>
  createdAt: Date
}

interface Verb {
  name: string        // 'create', 'publish'
  action: string      // 'create' (imperative)
  act: string         // 'creates' (3rd person)
  activity: string    // 'creating' (gerund)
  event: string       // 'created' (past participle)
  reverseBy?: string  // 'createdBy'
  reverseAt?: string  // 'createdAt'
  reverseIn?: string  // 'createdIn'
  inverse?: string    // 'delete'
  description?: string
  createdAt: Date
}
```

Both systems have very similar verb conjugation systems. The key differences:
- `ai-database` has richer `Noun` with properties/relationships/actions
- `digital-objects` has simpler `Noun` with schema as field definitions
- `ai-database` has `actor` and `result` noun forms
- `digital-objects` has `reverseIn` form

### digital-objects already has an ai-database adapter!

```typescript
// digital-objects/src/ai-database-adapter.ts
export function createDBProviderAdapter(provider: DigitalObjectsProvider): DBProvider {
  return {
    async get(type: string, id: string)
    async list(type: string, options?: ListOptions)
    async search(type: string, query: string, options?: SearchOptions)
    async create(type: string, id: string | undefined, data: Record<string, unknown>)
    async update(type: string, id: string, data: Record<string, unknown>)
    async delete(type: string, id: string): Promise<boolean>
    async related(type: string, id: string, relation: string)
    async relate(fromType: string, fromId: string, relation: string, toType: string, toId: string)
    async unrelate(fromType: string, fromId: string, relation: string, toType: string, toId: string)
  }
}
```

## Types That Overlap with digital-objects

### Function Definition Types (ai-functions) vs Nouns/Verbs (digital-objects)

```typescript
// ai-functions FunctionDefinition types
type FunctionDefinition =
  | CodeFunctionDefinition      // Generates code
  | GenerativeFunctionDefinition // Generates content
  | AgenticFunctionDefinition   // Multi-step with tools
  | HumanFunctionDefinition     // Human-in-the-loop

// These map to digital-objects concepts:
// - Each FunctionDefinition TYPE is a Noun (CodeFunction, GenerativeFunction, etc.)
// - Each FunctionDefinition INSTANCE is a Thing
// - The function TYPE field ('code' | 'generative' | 'agentic' | 'human') is a Verb
// - Function calls/invocations are Actions

interface BaseFunctionDefinition<TOutput, TInput> {
  name: string           // -> Thing.data.name
  description?: string   // -> Thing.data.description
  args: TInput           // -> Thing.data.args (schema)
  returnType?: TOutput   // -> Thing.data.returnType (schema)
}
```

### Function Types as Nouns

The four function types should become Nouns in digital-objects:

```typescript
// Define function type nouns
await provider.defineNoun({ name: 'CodeFunction', description: 'Function that generates executable code' })
await provider.defineNoun({ name: 'GenerativeFunction', description: 'Function that uses AI to generate content' })
await provider.defineNoun({ name: 'AgenticFunction', description: 'Function that runs in a loop with tools' })
await provider.defineNoun({ name: 'HumanFunction', description: 'Function that requires human input' })
```

### Function Actions as Verbs

```typescript
// Define function-related verbs
await provider.defineVerb({ name: 'define' })   // defineFunction()
await provider.defineVerb({ name: 'call' })     // function.call()
await provider.defineVerb({ name: 'execute' })  // execution
await provider.defineVerb({ name: 'complete' }) // completion
await provider.defineVerb({ name: 'fail' })     // failure
```

### Human Channel Types

```typescript
// ai-functions HumanChannel
type HumanChannel = 'chat' | 'email' | 'phone' | 'sms' | 'workspace' | 'web'

// digital-objects can track human interactions via Actions
interface HumanInteraction {
  channel: HumanChannel
  requestedAt: Date
  respondedAt?: Date
  respondedBy?: string
}
```

## Integration Approach

### 1. Digital Objects as Function Registry Backend

Replace `InMemoryFunctionRegistry` with a persistent `DigitalObjectsFunctionRegistry`:

```typescript
// New: digital-objects-backed function registry
class DigitalObjectsFunctionRegistry implements FunctionRegistry {
  constructor(private provider: DigitalObjectsProvider) {}

  async initialize() {
    // Define function type nouns
    await this.provider.defineNoun({ name: 'Function' })
    await this.provider.defineNoun({ name: 'CodeFunction' })
    await this.provider.defineNoun({ name: 'GenerativeFunction' })
    await this.provider.defineNoun({ name: 'AgenticFunction' })
    await this.provider.defineNoun({ name: 'HumanFunction' })

    // Define function verbs
    await this.provider.defineVerb({ name: 'define' })
    await this.provider.defineVerb({ name: 'call' })
  }

  async get(name: string): Promise<DefinedFunction | undefined> {
    const things = await this.provider.find('Function', { name })
    if (things.length === 0) return undefined
    return this.thingToDefinedFunction(things[0])
  }

  async set(name: string, fn: DefinedFunction): Promise<void> {
    const existing = await this.provider.find('Function', { name })
    if (existing.length > 0) {
      await this.provider.update(existing[0].id, this.definedFunctionToData(fn))
    } else {
      await this.provider.create('Function', this.definedFunctionToData(fn))
    }
  }

  // ... other methods
}
```

### 2. Track Function Calls as Actions

Every function invocation becomes an Action:

```typescript
async function trackFunctionCall<T>(
  provider: DigitalObjectsProvider,
  functionId: string,
  args: unknown
): Promise<Action<{ args: unknown; result?: T; error?: string }>> {
  return provider.perform(
    'call',           // verb
    undefined,        // subject (could be user/agent ID)
    functionId,       // object (the function being called)
    { args }          // data
  )
}
```

### 3. Cache Storage using Things

Replace in-memory caches with digital-objects Things:

```typescript
// EmbeddingCache backed by digital-objects
class DigitalObjectsEmbeddingCache {
  constructor(private provider: DigitalObjectsProvider) {}

  async initialize() {
    await this.provider.defineNoun({ name: 'EmbeddingCache' })
  }

  async get(content: string, model: string): Promise<number[] | undefined> {
    const key = hashKey({ content, model })
    const things = await this.provider.find('EmbeddingCache', { key })
    if (things.length === 0) return undefined
    return things[0].data.embedding as number[]
  }

  async set(content: string, model: string, embedding: number[]): Promise<void> {
    const key = hashKey({ content, model })
    await this.provider.create('EmbeddingCache', {
      key,
      content,
      model,
      embedding,
    })
  }
}
```

### 4. Human Function Results as Actions

Human-in-the-loop functions naturally map to Actions with status tracking:

```typescript
// Human function creates a pending action
async function createHumanAction<T>(
  provider: DigitalObjectsProvider,
  functionId: string,
  channel: HumanChannel,
  artifacts: unknown
): Promise<Action<{ channel: HumanChannel; artifacts: unknown; response?: T }>> {
  await provider.defineVerb({ name: 'request' })

  return provider.perform(
    'request',
    undefined,        // subject (the AI agent)
    functionId,       // object (the human function)
    {
      channel,
      artifacts,
      status: 'pending'
    }
  )
}

// Human response updates the action
async function recordHumanResponse<T>(
  provider: DigitalObjectsProvider,
  actionId: string,
  response: T,
  respondedBy: string
): Promise<void> {
  // Actions in digital-objects are immutable
  // Need to perform a new 'respond' action that references the original
  await provider.defineVerb({ name: 'respond' })

  await provider.perform(
    'respond',
    undefined,        // subject (the human)
    actionId,         // object (the request action)
    {
      response,
      respondedBy,
      respondedAt: new Date()
    }
  )
}
```

## Required Changes

### 1. Add digital-objects Dependency

```json
// packages/ai-functions/package.json
{
  "dependencies": {
    "digital-objects": "workspace:*"
  }
}
```

### 2. Create Persistent Registry Implementation

```typescript
// New file: src/persistent-registry.ts
import { createMemoryProvider, type DigitalObjectsProvider } from 'digital-objects'

export interface PersistentRegistryOptions {
  provider?: DigitalObjectsProvider
}

export function createPersistentRegistry(
  options: PersistentRegistryOptions = {}
): FunctionRegistry {
  const provider = options.provider ?? createMemoryProvider()
  return new DigitalObjectsFunctionRegistry(provider)
}
```

### 3. Extend Context with Provider

```typescript
// Extend ExecutionContext in src/context.ts
interface ExecutionContext {
  // ... existing fields

  /** Digital objects provider for persistence */
  objectsProvider?: DigitalObjectsProvider

  /** Whether to persist function definitions */
  persistFunctions?: boolean

  /** Whether to track function calls as actions */
  trackCalls?: boolean
}
```

### 4. Update AI Proxy to Use Persistent Registry

```typescript
// Update createSmartAI() in src/ai.ts
function createSmartAI(options?: { provider?: DigitalObjectsProvider }): AIProxy {
  const registry = options?.provider
    ? new DigitalObjectsFunctionRegistry(options.provider)
    : functions  // fallback to in-memory

  // ... rest of implementation
}
```

## Migration Concerns

### 1. Backward Compatibility

The existing in-memory registry must remain the default for:
- Tests that expect isolation
- Lightweight usage without persistence
- Browser environments without DO access

Solution: Make persistence opt-in via configuration:

```typescript
// Default: in-memory (backward compatible)
const ai = AI()

// Opt-in: persistent storage
const ai = AI({ provider: myDigitalObjectsProvider })
```

### 2. Async Initialization

Digital objects provider operations are async, but the current registry methods are sync:

```typescript
// Current: sync
get(name: string): DefinedFunction | undefined

// Needed: async
get(name: string): Promise<DefinedFunction | undefined>
```

Solution: The `FunctionRegistry` interface needs to be updated to be async, or provide a separate `AsyncFunctionRegistry` interface.

### 3. Schema Evolution

Function definitions stored in digital-objects need versioning for schema changes:

```typescript
interface StoredFunctionDefinition {
  version: number  // Schema version
  definition: FunctionDefinition
}
```

### 4. Action Immutability

Digital-objects Actions are immutable (event-sourcing pattern), but ai-functions expects mutable status:

```typescript
// ai-functions expects:
action.status = 'completed'

// digital-objects pattern:
// Create new action referencing the original
```

Solution: Create wrapper that presents mutable view over immutable action chain.

### 5. Human Function Pending State

The `HumanFunctionPending` type in ai-functions needs to map to digital-objects Actions:

```typescript
// ai-functions
interface HumanFunctionPending<TOutput> {
  [PENDING_HUMAN_RESULT_SYMBOL]: true
  _pending: true
  channel: HumanChannel
  artifacts: unknown
  expectedResponseType: TOutput
}

// digital-objects equivalent
interface PendingHumanAction {
  id: string
  verb: 'request'
  subject?: string
  object: string  // function ID
  data: {
    channel: HumanChannel
    artifacts: unknown
    expectedResponseType: unknown
  }
  status: 'pending'
  createdAt: Date
}
```

## Recommended Implementation Order

1. **Phase 1: Core Registry** (Week 1)
   - Create `DigitalObjectsFunctionRegistry` class
   - Define function-related Nouns and Verbs
   - Add `createPersistentRegistry()` factory
   - Update `AI()` to accept provider option

2. **Phase 2: Call Tracking** (Week 2)
   - Implement call tracking as Actions
   - Add execution statistics via Action queries
   - Create call history retrieval APIs

3. **Phase 3: Caching** (Week 3)
   - Implement `DigitalObjectsEmbeddingCache`
   - Implement `DigitalObjectsGenerationCache`
   - Add cache statistics via Thing queries

4. **Phase 4: Human-in-the-Loop** (Week 4)
   - Map HumanFunctionPending to Actions
   - Implement response tracking
   - Add channel-specific artifact storage

5. **Phase 5: Batch Integration** (Week 5)
   - Store batch jobs as Things
   - Track batch status via Actions
   - Implement batch result retrieval

## Conclusion

The integration between ai-functions and digital-objects is natural and well-aligned:

- **Function definitions** map to **Things** (instances of Noun types)
- **Function types** map to **Nouns** (entity type definitions)
- **Function calls** map to **Actions** (events + relationships)
- **Function verbs** (define, call, execute, complete) map to **Verbs**

The main changes required are:
1. Adding an async `DigitalObjectsFunctionRegistry` implementation
2. Updating the `FunctionRegistry` interface to be async-aware
3. Creating action-based call tracking
4. Mapping human-in-the-loop state to Actions

The existing adapter (`createDBProviderAdapter`) in digital-objects provides a good foundation, but ai-functions needs higher-level abstractions specific to function management.
