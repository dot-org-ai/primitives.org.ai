# ai-workflows Integration Analysis with digital-objects

**Date**: 2026-01-15
**Status**: Research Complete
**Package**: `ai-workflows`

## Executive Summary

The `ai-workflows` package provides an event-driven workflow system with a fluent `$` context API. It features event handlers (`$.on`), scheduled tasks (`$.every`), and advanced workflow orchestration (dependency graphs, barriers, cascade execution). Integration with `digital-objects` would provide durable persistence for workflow state, events, and actions.

---

## 1. Current Architecture

### 1.1 Core Components

| Component | File | Purpose |
|-----------|------|---------|
| `Workflow` | `workflow.ts` | Main entry point - creates workflows with `$` context |
| `WorkflowContext` | `types.ts` | The `$` API passed to handlers |
| `on` proxy | `on.ts` | Event handler registration (`$.on.Noun.event`) |
| `every` proxy | `every.ts` | Schedule registration (`$.every.hour`) |
| `send` | `send.ts` | Event emission via global event bus |
| `context` | `context.ts` | Workflow context creation |
| `CascadeContext` | `cascade-context.ts` | Correlation IDs and step tracking |
| `DependencyGraph` | `dependency-graph.ts` | DAG for step dependencies |
| `Barrier` | `barrier.ts` | Parallel step synchronization |
| `CascadeExecutor` | `cascade-executor.ts` | Code->Generative->Agentic->Human pattern |

### 1.2 State Management

**Current State Storage**:
```typescript
interface WorkflowState {
  current?: string              // Current state name (for state machines)
  context: Record<string, unknown>  // Key-value context data
  history: WorkflowHistoryEntry[]   // Execution history
}

interface WorkflowHistoryEntry {
  timestamp: number
  type: 'event' | 'schedule' | 'transition' | 'action'
  name: string
  data?: unknown
}
```

**State is stored**:
- In-memory within the `WorkflowInstance`
- Via `$.state` proxy for direct access
- Via `$.get(key)` / `$.set(key, value)` methods
- History tracked via `addHistory()` internal function

**Persistence (Optional)**:
- `DatabaseContext` interface for optional persistence
- `recordEvent`, `createAction`, `completeAction` methods
- No concrete implementation - just interface

### 1.3 Event System

**Event Registration**:
```typescript
$.on.Customer.created(async (customer, $) => {
  // Handler receives event data and context
  await $.send('Email.welcome', { to: customer.email })
})
```

**Event Types**:
- `track(event, data)` - Fire and forget, best effort
- `send(event, data)` - Durable, returns EventId
- `do(event, data)` - Durable, waits for result
- `try(event, data)` - Non-durable, waits for result

### 1.4 Schedule System

```typescript
$.every.hour(handler)           // Simple intervals
$.every.Monday.at9am(handler)   // Day + time
$.every.minutes(30)(handler)    // Custom intervals
$.every('first Monday of month', handler)  // Natural language
```

Schedules are converted to cron expressions or interval-based timers.

### 1.5 Advanced Features

**Dependency Graph**:
- DAG for ordering workflow steps
- Hard vs soft dependencies
- Cycle detection
- Parallel group identification

**Barrier/Join Semantics**:
- `waitForAll()` - All steps must complete
- `waitForAny(n)` - N of M steps
- Concurrency limits
- Timeout and cancellation support

**Cascade Executor**:
- Tiered execution: code -> generative -> agentic -> human
- Per-tier timeouts and retries
- 5W+H event emission for audit trails

---

## 2. Mapping to digital-objects Concepts

### 2.1 Conceptual Mapping

| ai-workflows | digital-objects | Notes |
|--------------|-----------------|-------|
| `WorkflowState.context` | `Thing<WorkflowContext>` | State as a Thing |
| `WorkflowHistoryEntry` | `Action` | History entries become Actions |
| `EventRegistration` | `Noun` + `Verb` | Events map to Noun.verb pattern |
| `EventHandler` | Verb handler | Handlers triggered by Actions |
| `ScheduleRegistration` | `Thing<Schedule>` | Schedules as Things |
| `CascadeStep` | `Action` with status | Steps are Actions with lifecycle |
| Dependency edges | `Action` edges | Graph edges via Actions |

### 2.2 Things (State)

**Workflow Instance as Thing**:
```typescript
// In digital-objects
interface WorkflowInstanceData {
  name: string
  status: 'running' | 'paused' | 'completed' | 'failed'
  context: Record<string, unknown>  // $.state data
  registeredEvents: string[]        // List of Noun.event handlers
  registeredSchedules: string[]     // List of schedule patterns
}

// Store workflow instance
const workflow = await db.create<WorkflowInstanceData>('Workflow', {
  name: 'customer-onboarding',
  status: 'running',
  context: { userId: '123' },
  registeredEvents: ['Customer.created', 'Email.welcome'],
  registeredSchedules: ['every.hour', 'every.Monday.at9am']
})
```

**Schedule as Thing**:
```typescript
interface ScheduleData {
  workflowId: string
  pattern: string           // 'every.hour', 'every.Monday.at9am'
  cronExpression?: string   // '0 * * * *'
  handler: string           // Serialized handler source
  enabled: boolean
  lastRun?: Date
  nextRun?: Date
}

const schedule = await db.create<ScheduleData>('Schedule', {
  workflowId: workflow.id,
  pattern: 'every.hour',
  cronExpression: '0 * * * *',
  handler: handlerSource,
  enabled: true
})
```

### 2.3 Actions (Events + History + Transitions)

**Event Emission as Action**:
```typescript
// Current: $.send('Customer.created', { id: '123', name: 'John' })
// Becomes:
await db.perform('emit', workflowId, undefined, {
  event: 'Customer.created',
  data: { id: '123', name: 'John' },
  eventId: crypto.randomUUID()
})
```

**History Entry as Action**:
```typescript
// Current WorkflowHistoryEntry
// Becomes Action with workflow as subject
await db.perform('log', workflowId, undefined, {
  type: 'event',
  name: 'Customer.created',
  data: eventData
})
```

**Cascade Step as Action**:
```typescript
interface CascadeStepData {
  stepName: string
  status: 'running' | 'completed' | 'failed'
  tier?: 'code' | 'generative' | 'agentic' | 'human'
  metadata?: Record<string, unknown>
}

// Execute a cascade step
const stepAction = await db.perform<CascadeStepData>(
  'execute',     // verb
  cascadeId,     // subject (cascade context)
  undefined,     // object
  {
    stepName: 'validate-input',
    status: 'running',
    tier: 'code'
  }
)
```

### 2.4 Dependency Graph via Actions

**Dependency as Action Edge**:
```typescript
// Step B depends on Step A
await db.perform('dependsOn', stepBId, stepAId, {
  type: 'hard'  // or 'soft'
})

// Query dependencies
const deps = await db.edges(stepBId, 'dependsOn', 'out')
```

**Parallel Group Discovery**:
```typescript
// Find all steps at a given level
const level0Steps = await db.listActions({
  verb: 'execute',
  subject: workflowId
}).filter(action => {
  // Steps with no incoming 'dependsOn' edges
  const deps = await db.edges(action.id, 'dependsOn', 'in')
  return deps.length === 0
})
```

---

## 3. Integration Approach

### 3.1 Phase 1: Storage Adapter

Create a `DigitalObjectsStorageAdapter` that implements `DatabaseContext`:

```typescript
// packages/ai-workflows/src/digital-objects-adapter.ts

import type { DigitalObjectsProvider, Thing, Action } from 'digital-objects'
import type { DatabaseContext, ActionData, ArtifactData } from './types.js'

export function createDigitalObjectsAdapter(
  provider: DigitalObjectsProvider
): DatabaseContext {
  return {
    async recordEvent(event: string, data: unknown): Promise<void> {
      await provider.perform('emit', undefined, undefined, { event, data })
    },

    async createAction(action: ActionData): Promise<void> {
      await provider.perform(
        action.action,
        action.actor,
        action.object,
        action.metadata
      )
    },

    async completeAction(id: string, result: unknown): Promise<void> {
      // Update action status via another action
      await provider.perform('complete', undefined, id, { result })
    },

    async storeArtifact(artifact: ArtifactData): Promise<void> {
      await provider.create('Artifact', artifact, artifact.key)
    },

    async getArtifact(key: string): Promise<unknown | null> {
      const thing = await provider.get(key)
      return thing?.data ?? null
    }
  }
}
```

### 3.2 Phase 2: Workflow Instance Persistence

```typescript
// packages/ai-workflows/src/durable-workflow.ts

export class DurableWorkflow {
  private provider: DigitalObjectsProvider
  private instanceId: string

  constructor(provider: DigitalObjectsProvider, instanceId?: string) {
    this.provider = provider
    this.instanceId = instanceId ?? crypto.randomUUID()
  }

  // Create or restore a workflow instance
  async initialize(setup: ($: WorkflowContext) => void): Promise<void> {
    // Check if instance exists
    const existing = await this.provider.get(this.instanceId)

    if (!existing) {
      // Create new workflow Thing
      await this.provider.create('Workflow', {
        status: 'initializing',
        context: {},
        events: [],
        schedules: []
      }, this.instanceId)
    }

    // Run setup with durable context
    const $ = this.createDurableContext()
    setup($)
  }

  // Get current state
  async getState(): Promise<WorkflowState> {
    const workflow = await this.provider.get<WorkflowInstanceData>(this.instanceId)
    if (!workflow) throw new Error('Workflow not found')

    // Get history from actions
    const history = await this.provider.listActions({
      subject: this.instanceId
    })

    return {
      context: workflow.data.context,
      history: history.map(a => ({
        timestamp: a.createdAt.getTime(),
        type: a.data?.type ?? 'action',
        name: a.verb,
        data: a.data
      }))
    }
  }

  // Set a context value
  async set(key: string, value: unknown): Promise<void> {
    const workflow = await this.provider.get<WorkflowInstanceData>(this.instanceId)
    if (!workflow) throw new Error('Workflow not found')

    await this.provider.update(this.instanceId, {
      context: { ...workflow.data.context, [key]: value }
    })

    // Record the change as an action
    await this.provider.perform('set', this.instanceId, undefined, { key, value })
  }
}
```

### 3.3 Phase 3: Event System Integration

```typescript
// Integrate $.send with digital-objects Actions

async send<T>(event: string, data: T): string {
  const eventId = crypto.randomUUID()

  // Record event as Action
  await this.provider.perform('emit', this.instanceId, undefined, {
    event,
    data,
    eventId
  })

  // Deliver to handlers (async)
  this.deliverEvent(event, { ...data, _eventId: eventId })

  return eventId
}
```

### 3.4 Phase 4: Cascade Context with digital-objects

```typescript
// Store cascade context as a Thing, steps as Actions

export async function createDurableCascadeContext(
  provider: DigitalObjectsProvider,
  options: CascadeContextOptions = {}
): Promise<CascadeContext> {
  const cascadeId = options.correlationId ?? crypto.randomUUID()

  // Create cascade Thing
  await provider.create('Cascade', {
    name: options.name,
    parentId: options.parent?.correlationId,
    depth: options.parent ? options.parent.depth + 1 : 0,
    path: []
  }, cascadeId)

  return {
    correlationId: cascadeId,
    // ... other properties

    // Record step as Action
    async recordStep(name: string, metadata?: Record<string, unknown>) {
      const action = await provider.perform('step', cascadeId, undefined, {
        name,
        status: 'running',
        ...metadata
      })

      return {
        name,
        startedAt: action.createdAt.getTime(),
        status: 'running',
        complete: async () => {
          await provider.perform('complete', undefined, action.id, {
            status: 'completed',
            completedAt: Date.now()
          })
        },
        fail: async (error: Error) => {
          await provider.perform('fail', undefined, action.id, {
            status: 'failed',
            error: error.message,
            completedAt: Date.now()
          })
        }
      }
    }
  }
}
```

---

## 4. Required Changes

### 4.1 ai-workflows Package

| Change | File | Description |
|--------|------|-------------|
| Add adapter | `digital-objects-adapter.ts` | New file implementing DatabaseContext |
| Add durable workflow | `durable-workflow.ts` | Persistent workflow implementation |
| Modify Workflow | `workflow.ts` | Accept DigitalObjectsProvider in options |
| Modify types | `types.ts` | Add DurableWorkflowOptions interface |
| Add exports | `index.ts` | Export new adapter and durable workflow |

### 4.2 New Type Definitions

```typescript
// types.ts additions

export interface DurableWorkflowOptions extends WorkflowOptions {
  /** digital-objects provider for persistence */
  provider: DigitalObjectsProvider
  /** Existing workflow instance ID to restore */
  instanceId?: string
  /** Auto-persist state changes */
  autoPersist?: boolean
}
```

### 4.3 New Nouns for digital-objects

```typescript
// Define workflow-specific nouns

await provider.defineNoun({ name: 'Workflow', description: 'Workflow instance' })
await provider.defineNoun({ name: 'Schedule', description: 'Scheduled task' })
await provider.defineNoun({ name: 'Cascade', description: 'Cascade execution context' })
await provider.defineNoun({ name: 'Artifact', description: 'Cached workflow artifact' })
```

### 4.4 New Verbs for digital-objects

```typescript
// Define workflow-specific verbs

await provider.defineVerb({ name: 'emit', description: 'Emit an event' })
await provider.defineVerb({ name: 'execute', description: 'Execute a step' })
await provider.defineVerb({ name: 'complete', description: 'Complete an action' })
await provider.defineVerb({ name: 'fail', description: 'Mark action as failed' })
await provider.defineVerb({ name: 'dependsOn', description: 'Declare dependency' })
await provider.defineVerb({ name: 'escalate', description: 'Escalate to next tier' })
await provider.defineVerb({ name: 'set', description: 'Set context value' })
await provider.defineVerb({ name: 'step', description: 'Record cascade step' })
```

---

## 5. Benefits of Integration

### 5.1 Durability
- Workflow state persists across restarts
- Event history stored permanently
- Can resume workflows from any point

### 5.2 Audit Trail
- All events stored as Actions with timestamps
- Full graph of dependencies and relationships
- 5W+H event data preserved

### 5.3 Query Capabilities
- Find all workflows in a status
- Trace event chains via Action edges
- Analyze cascade execution patterns

### 5.4 Multi-Tenant Support
- Each namespace has isolated workflows
- Shared verb/noun definitions
- Cross-workflow event routing possible

---

## 6. Implementation Priority

1. **High**: `digital-objects-adapter.ts` - Basic persistence
2. **High**: Modify `Workflow` to accept provider option
3. **Medium**: `durable-workflow.ts` - Full durable workflow class
4. **Medium**: Cascade context persistence
5. **Low**: Schedule persistence and recovery
6. **Low**: Dependency graph persistence

---

## 7. Open Questions

1. **Event Replay**: Should we support replaying events from stored Actions?
2. **Workflow Versioning**: How to handle schema changes in stored workflows?
3. **Schedule Recovery**: How to recover scheduled tasks after restart?
4. **Cross-Workflow Events**: Should workflows be able to send events to each other?
5. **Cascade Distribution**: Could cascade tiers run in different workers/namespaces?

---

## 8. File Summary

### Source Files Analyzed

| File | Lines | Purpose |
|------|-------|---------|
| `/packages/ai-workflows/src/index.ts` | 185 | Package exports |
| `/packages/ai-workflows/src/types.ts` | 465 | Type definitions |
| `/packages/ai-workflows/src/workflow.ts` | 604 | Main Workflow API |
| `/packages/ai-workflows/src/context.ts` | 129 | Context creation |
| `/packages/ai-workflows/src/cascade-context.ts` | 489 | Correlation & tracing |
| `/packages/ai-workflows/src/dependency-graph.ts` | 519 | DAG for dependencies |
| `/packages/ai-workflows/src/cascade-executor.ts` | 588 | Tiered execution |
| `/packages/ai-workflows/src/barrier.ts` | 467 | Synchronization primitives |
| `/packages/ai-workflows/src/send.ts` | 117 | Event bus |

### digital-objects Files Referenced

| File | Lines | Purpose |
|------|-------|---------|
| `/packages/digital-objects/src/types.ts` | 190 | Core type definitions |
| `/packages/digital-objects/src/ns.ts` | 685 | Durable Object implementation |
| `/packages/digital-objects/src/index.ts` | 60 | Package exports |
