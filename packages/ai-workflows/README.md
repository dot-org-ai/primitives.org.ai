# ai-workflows

![Stability: Beta](https://img.shields.io/badge/stability-beta-yellow)

**Event-driven AI workflows shouldn't require a PhD in distributed systems.**

You have business logic that needs to react to events, run on schedules, and coordinate parallel tasks. Traditional workflow engines make you wade through XML configs, learn proprietary DSLs, and debug mysterious state machines. You just want to write `$.on.Order.placed(handler)` and have it work.

```typescript
import { Workflow } from 'ai-workflows'

const workflow = Workflow($ => {
  $.on.Customer.created(async (customer, $) => {
    await $.send('Email.welcome', { to: customer.email })
  })

  $.every.Monday.at9am(async ($) => {
    $.log('Weekly standup reminder')
  })
})

await workflow.start()
```

That's it. No YAML. No state machine diagrams. Just JavaScript.

## Installation

```bash
npm install ai-workflows
```

## Quick Start

### Event Handlers

React to events with the `$.on` pattern. Events follow `Noun.verb` naming:

```typescript
Workflow($ => {
  $.on.Order.placed(async (order, $) => {
    $.log('Processing order', order.id)
    await $.send('Inventory.reserve', { items: order.items })
    await $.send('Payment.charge', { amount: order.total })
  })

  $.on.Payment.completed(async (payment, $) => {
    await $.send('Order.fulfill', { orderId: payment.orderId })
  })

  $.on.Payment.failed(async (payment, $) => {
    await $.send('Customer.notify', {
      message: 'Payment failed',
      orderId: payment.orderId
    })
  })
})
```

### Scheduled Tasks

Natural scheduling with `$.every`:

```typescript
Workflow($ => {
  // Simple intervals
  $.every.hour(async ($) => {
    $.log('Hourly health check')
  })

  // Day + time combinations
  $.every.Monday.at9am(async ($) => {
    const report = await $.do('Analytics.weeklyReport', {})
    await $.send('Slack.post', { channel: '#metrics', report })
  })

  $.every.weekday.at8am(async ($) => {
    $.log('Good morning! Time to standup.')
  })

  // Precise intervals
  $.every.minutes(30)(async ($) => {
    await $.send('Cache.refresh', {})
  })
})
```

**Available schedules:**

| Intervals | Days | Times |
|-----------|------|-------|
| `$.every.second` | `$.every.Monday` | `.at6am` `.at7am` `.at8am` |
| `$.every.minute` | `$.every.Tuesday` | `.at9am` `.at10am` `.at11am` |
| `$.every.hour` | `$.every.Wednesday` | `.at12pm` `.atnoon` |
| `$.every.day` | `$.every.Thursday` | `.at1pm` `.at2pm` `.at3pm` |
| `$.every.week` | `$.every.Friday` | `.at4pm` `.at5pm` `.at6pm` |
| `$.every.month` | `$.every.Saturday` | `.at7pm` `.at8pm` `.at9pm` |
| `$.every.minutes(n)` | `$.every.Sunday` | `.atmidnight` |
| `$.every.hours(n)` | `$.every.weekday` | |
| | `$.every.weekend` | |

## The Cascade Pattern

Not every problem can be solved with code. Some need AI. Some need human judgment. The cascade executor tries each tier in sequence, escalating only when needed:

```
Code -> Generative AI -> Agentic AI -> Human
```

```typescript
import { CascadeExecutor } from 'ai-workflows'

const processRefund = new CascadeExecutor({
  cascadeName: 'refund-processor',

  tiers: {
    // Tier 1: Deterministic rules (fastest, cheapest)
    code: {
      name: 'rule-based-refund',
      execute: async (request) => {
        if (request.amount < 50 && request.reason === 'defective') {
          return { approved: true, method: 'original-payment' }
        }
        throw new Error('Rules inconclusive')
      }
    },

    // Tier 2: AI analysis for complex cases
    generative: {
      name: 'ai-refund-analysis',
      execute: async (request, ctx) => {
        const analysis = await analyzeRefundRequest(request)
        if (analysis.confidence > 0.9) {
          return { approved: analysis.shouldApprove, reason: analysis.explanation }
        }
        throw new Error('Confidence too low')
      }
    },

    // Tier 3: Agent with tool access
    agentic: {
      name: 'refund-agent',
      execute: async (request, ctx) => {
        return await refundAgent.process(request)
      }
    },

    // Tier 4: Human review for edge cases
    human: {
      name: 'human-review',
      execute: async (request) => {
        return await createHumanTask({
          type: 'refund-review',
          data: request,
          assignTo: 'support-team'
        })
      }
    }
  },

  // Default timeouts per tier
  useDefaultTimeouts: true,  // code: 5s, generative: 30s, agentic: 5m, human: 24h
})

const result = await processRefund.execute(refundRequest)
console.log(`Resolved by ${result.tier} tier in ${result.metrics.totalDuration}ms`)
```

### Cascade Features

- **Automatic escalation** - Failed tiers escalate to the next level
- **Tier timeouts** - Each tier has configurable time limits
- **Retry support** - Configure retries with exponential backoff per tier
- **Skip conditions** - Skip tiers based on input characteristics
- **5W+H audit trail** - Full event log: who, what, when, where, why, how

## Dependency Graphs

For complex workflows with interdependent steps, use the dependency graph to ensure correct execution order:

```typescript
import { DependencyGraph, getExecutionLevels } from 'ai-workflows'

const graph = new DependencyGraph()

// Steps with no dependencies run first (level 0)
graph.addNode('fetch-user')
graph.addNode('fetch-products')

// Dependent steps run after their dependencies complete
graph.addNode('validate-cart', { dependsOn: ['fetch-user', 'fetch-products'] })
graph.addNode('calculate-shipping', { dependsOn: 'fetch-products' })
graph.addNode('apply-discounts', { dependsOn: 'validate-cart' })
graph.addNode('process-payment', { dependsOn: ['apply-discounts', 'calculate-shipping'] })

// Automatic cycle detection
try {
  graph.addNode('bad-step', { dependsOn: 'process-payment' })
  graph.addEdge('bad-step', 'fetch-user')  // Would create a cycle!
} catch (e) {
  console.log('Caught circular dependency:', e.cyclePath)
}
```

### Topological Sort

Execute steps in dependency order:

```typescript
import { topologicalSort, getExecutionLevels } from 'ai-workflows'

const steps = [
  { id: 'A', dependencies: [] },
  { id: 'B', dependencies: ['A'] },
  { id: 'C', dependencies: ['A'] },
  { id: 'D', dependencies: ['B', 'C'] },
]

// Linear execution order
const { order } = topologicalSort(steps)
// => ['A', 'B', 'C', 'D']

// Parallel execution groups
const levels = getExecutionLevels(steps)
// => [
//   { level: 0, nodes: ['A'] },        // Run first
//   { level: 1, nodes: ['B', 'C'] },   // Run in parallel
//   { level: 2, nodes: ['D'] }         // Run after B and C complete
// ]
```

## Barriers and Joins

Coordinate parallel operations with barrier semantics:

```typescript
import { waitForAll, waitForAny, Barrier, withConcurrencyLimit } from 'ai-workflows'

// Wait for all parallel tasks
const results = await waitForAll([
  fetchUserData(userId),
  fetchOrderHistory(userId),
  fetchRecommendations(userId),
], { timeout: 5000 })

// Wait for N of M (e.g., 2 of 3 replicas)
const { completed, pending } = await waitForAny(2, [
  writeToReplica1(data),
  writeToReplica2(data),
  writeToReplica3(data),
])

// Manual barrier for complex coordination
const barrier = new Barrier(3, {
  timeout: 10000,
  onProgress: ({ arrived, expected, percentage }) => {
    console.log(`${arrived}/${expected} (${percentage}%)`)
  }
})

// In parallel handlers...
barrier.arrive(resultFromWorker1)
barrier.arrive(resultFromWorker2)
barrier.arrive(resultFromWorker3)

// Wait for all to arrive
const allResults = await barrier.wait()
```

### Concurrency Control

Limit parallel executions to prevent overwhelming downstream services:

```typescript
const urls = [/* 100 URLs */]

// Process 5 at a time
const results = await withConcurrencyLimit(
  urls.map(url => () => fetch(url)),
  5,  // max concurrent
  { collectErrors: true }  // don't fail fast
)
```

## Standalone API

Use `on`, `every`, and `send` for global registration outside of a workflow:

```typescript
import { on, every, send } from 'ai-workflows'

// Register handlers
on.Customer.created(async (customer, $) => {
  await $.send('Email.welcome', { to: customer.email })
})

every.hour(async ($) => {
  $.log('Background task running')
})

// Emit events from anywhere
await send('Customer.created', { name: 'Alice', email: 'alice@example.com' })
```

## Configuration

### Custom Cron Converter

Enable natural language scheduling with an AI-powered cron converter:

```typescript
import { setCronConverter } from 'ai-workflows'

setCronConverter(async (description) => {
  // Use your AI service to convert natural language to cron
  const response = await ai.complete(`Convert to cron: "${description}"`)
  return response.cron
})

// Now you can use natural language
$.every('first Monday of the month at 9am', handler)
$.every('every 15 minutes during business hours', handler)
```

### Cascade Timeouts

Configure per-tier and total timeouts:

```typescript
const executor = new CascadeExecutor({
  tiers: { /* ... */ },

  // Custom timeouts per tier (milliseconds)
  timeouts: {
    code: 2000,        // 2 seconds
    generative: 15000, // 15 seconds
    agentic: 60000,    // 1 minute
    human: 3600000,    // 1 hour
  },

  // Or use defaults
  useDefaultTimeouts: true,  // code: 5s, generative: 30s, agentic: 5m, human: 24h

  // Total cascade timeout
  totalTimeout: 300000,  // 5 minutes max for entire cascade
})
```

### Retry Configuration

Add retries with exponential backoff:

```typescript
const executor = new CascadeExecutor({
  tiers: { /* ... */ },

  retryConfig: {
    code: { maxRetries: 2, baseDelay: 100 },
    generative: { maxRetries: 3, baseDelay: 1000, multiplier: 2 },
    agentic: { maxRetries: 1, baseDelay: 5000 },
  }
})
```

## Testing

Create isolated contexts for testing:

```typescript
import { createTestContext } from 'ai-workflows'

const $ = createTestContext()

// Call your handler
await orderHandler({ id: '123', total: 99.99 }, $)

// Assert on emitted events
expect($.emittedEvents).toContainEqual({
  event: 'Payment.charge',
  data: { amount: 99.99 },
})
```

## API Reference

### Core Workflow

| Export | Description |
|--------|-------------|
| `Workflow($)` | Create a workflow with $ context |
| `on` | Standalone event registration proxy |
| `every` | Standalone schedule registration proxy |
| `send(event, data)` | Emit events globally |
| `createTestContext()` | Create isolated $ for testing |

### Cascade Executor

| Export | Description |
|--------|-------------|
| `CascadeExecutor` | Tiered execution: code -> AI -> agent -> human |
| `TIER_ORDER` | `['code', 'generative', 'agentic', 'human']` |
| `DEFAULT_TIER_TIMEOUTS` | Default timeout per tier |

### Dependency Graph

| Export | Description |
|--------|-------------|
| `DependencyGraph` | DAG for workflow step dependencies |
| `topologicalSort(nodes)` | Sort nodes in dependency order |
| `getExecutionLevels(nodes)` | Group nodes for parallel execution |
| `CircularDependencyError` | Thrown when cycle detected |

### Barriers

| Export | Description |
|--------|-------------|
| `Barrier` | Manual synchronization point |
| `waitForAll(promises)` | Wait for all with timeout support |
| `waitForAny(n, promises)` | Wait for N of M to complete |
| `withConcurrencyLimit(tasks, n)` | Limit parallel executions |

## Related Packages

- [`ai-functions`](../ai-functions) - AI-powered functions with type safety
- [`ai-database`](../ai-database) - Durable event storage
- [`human-in-the-loop`](../human-in-the-loop) - Human workflow steps
- [`digital-workers`](../digital-workers) - Autonomous AI agents
