# ai-workflows Examples

This directory contains runnable examples demonstrating the key features of ai-workflows.

## Prerequisites

```bash
# From the package root (or monorepo root)
npm install
npm run build  # Must build first since examples import from dist/
```

## Running Examples

Each example can be run directly with `tsx`:

```bash
# From the ai-workflows package directory
npx tsx examples/01-ecommerce-order-pipeline.ts
npx tsx examples/02-content-moderation-cascade.ts
npx tsx examples/03-scheduled-reporting-dependencies.ts
npx tsx examples/04-database-persistence.ts
```

**Note:** Examples import from `../dist/index.js` to use the built package. Ensure you run `npm run build` first.

## Examples Overview

### 01 - E-commerce Order Processing Pipeline

Demonstrates a complete order processing workflow using event-driven architecture.

**Key Concepts:**
- Event handlers with `$.on.Noun.event()`
- Event chaining (one event triggers another)
- State management with `$.state`
- Error handling and compensation patterns
- Customer notification flow

**Flow:**
```
Order.placed -> Payment.requested -> Payment.completed -> Order.confirmed
                                  -> Shipping.requested -> Order.shipped
```

### 02 - AI Content Moderation with Human Escalation

Demonstrates the CascadeExecutor pattern for tiered processing with escalation.

**Key Concepts:**
- `CascadeExecutor` for code -> AI -> agent -> human escalation
- Per-tier timeouts and retry configuration
- Skip conditions for tier bypassing
- 5W+H audit trail for compliance
- Workflow integration with cascade results

**Tiers:**
1. **Code**: Fast keyword/pattern matching (100ms timeout)
2. **Generative**: LLM-based analysis (5s timeout)
3. **Agentic**: Multi-step reasoning with tools (30s timeout)
4. **Human**: Expert review queue (1 hour timeout)

### 03 - Scheduled Reporting with Dependency Chains

Demonstrates complex workflows with dependencies and parallel execution.

**Key Concepts:**
- `DependencyGraph` for step ordering
- `topologicalSort()` for execution planning
- `getExecutionLevels()` for parallel grouping
- `waitForAll()` and `Barrier` for synchronization
- `withConcurrencyLimit()` for controlled parallelism

**Pipeline:**
```
Level 0: [fetch-sales, fetch-crm, fetch-inventory, fetch-analytics]  (parallel)
Level 1: [aggregate-data]                                             (sequential)
Level 2: [generate-daily-report, generate-summary]                    (parallel)
Level 3: [distribute-email, distribute-slack, archive-s3]             (parallel)
```

### 04 - Database Persistence Integration

Demonstrates durable event storage and state persistence.

**Key Concepts:**
- `DatabaseContext` integration with workflows
- Durable event storage with `$.db.recordEvent()`
- Action tracking with `$.db.createAction()`
- Artifact storage with `$.db.storeArtifact()`
- State checkpointing and recovery
- Audit trail with 5W+H events

**Note:** Uses a mock database implementation. In production, integrate with `ai-database` or your persistence layer.

## Code Patterns

### Basic Workflow Setup

```typescript
import { Workflow } from 'ai-workflows'

const workflow = Workflow($ => {
  $.on.Entity.event(async (data, $) => {
    $.log('Processing event')
    $.send('Another.event', { result: 'done' })
  })
})

await workflow.start()
await workflow.send('Entity.event', { input: 'data' })
await workflow.stop()
```

### Cascade Executor

```typescript
import { CascadeExecutor } from 'ai-workflows'

const cascade = new CascadeExecutor({
  tiers: {
    code: { name: 'rules', execute: async (input) => { /* fast rules */ } },
    generative: { name: 'ai', execute: async (input) => { /* AI analysis */ } },
    human: { name: 'review', execute: async (input) => { /* human queue */ } },
  },
  useDefaultTimeouts: true,
})

const result = await cascade.execute(input)
console.log(`Resolved by ${result.tier} tier`)
```

### Dependency Graph

```typescript
import { DependencyGraph, getExecutionLevels } from 'ai-workflows'

const graph = new DependencyGraph()
graph.addNode('step-a')
graph.addNode('step-b')
graph.addNode('step-c', { dependsOn: ['step-a', 'step-b'] })

const levels = getExecutionLevels(graph.getNodes())
// Level 0: [step-a, step-b]
// Level 1: [step-c]
```

### Barrier Synchronization

```typescript
import { Barrier, waitForAll } from 'ai-workflows'

// Simple parallel wait
const results = await waitForAll([
  fetchA(),
  fetchB(),
  fetchC(),
], { timeout: 5000 })

// Manual barrier with progress
const barrier = new Barrier(3, {
  onProgress: (p) => console.log(`${p.percentage}% complete`)
})
// ... barrier.arrive(result) from parallel workers
const all = await barrier.wait()
```

## Related Documentation

- [ai-workflows README](../README.md) - Full API documentation
- [CascadeExecutor](../src/cascade-executor.ts) - Tiered execution pattern
- [DependencyGraph](../src/dependency-graph.ts) - Step dependency management
- [Barrier](../src/barrier.ts) - Parallel coordination primitives
