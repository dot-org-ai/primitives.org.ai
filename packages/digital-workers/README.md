# digital-workers

**You're building AI-powered workflows. But who should actually do the work?**

Sometimes it's an AI agent operating autonomously. Sometimes it requires human judgment. Often it's both working together. And as AI capabilities evolve, you need workflows that can adapt without rewriting everything.

`digital-workers` gives you a single interface that works whether the worker is human or AI - so you can design once and swap implementations as your needs change.

## The Problem

```typescript
// Without digital-workers: You're locked into implementation details
if (task.requiresHumanJudgment) {
  await sendSlackToAlice(task.description)
  const approval = await waitForSlackResponse()
  // Different code path for humans...
} else {
  await callAIAgent(task.description)
  // Completely different code path for AI...
}
```

Your workflow logic becomes tangled with *who* does the work instead of *what* needs to happen.

## The Solution

```typescript
// With digital-workers: Define what, not who
await worker$.approve('Deploy v2.0 to production', alice, { via: 'slack' })
```

The same code works whether `alice` is:
- A human product manager who gets a Slack notification
- An AI agent that evaluates deployment criteria autonomously
- A supervised AI that escalates to humans for high-risk decisions

## Quick Start

### 1. Install

```bash
pnpm add digital-workers
```

### 2. Define Your Workers

```typescript
import type { Worker } from 'digital-workers'

const alice: Worker = {
  id: 'user_alice',
  name: 'Alice',
  type: 'human',
  status: 'available',
  contacts: {
    email: 'alice@company.com',
    slack: { workspace: 'acme', user: 'U123' },
  },
}

const codeReviewer: Worker = {
  id: 'agent_reviewer',
  name: 'Code Reviewer',
  type: 'agent',
  status: 'available',
  contacts: {
    api: { endpoint: 'https://api.internal/reviewer' },
  },
}
```

### 3. Build Your Workflow

```typescript
import { Workflow } from 'ai-workflows'
import { registerWorkerActions, withWorkers } from 'digital-workers'

const workflow = Workflow($ => {
  registerWorkerActions($)
  const worker$ = withWorkers($)

  $.on.Expense.submitted(async (expense) => {
    // Notify the finance team
    await worker$.notify(finance, `New expense: ${expense.amount}`)

    // Request approval from manager
    const approval = await worker$.approve(
      `Expense: $${expense.amount} for ${expense.description}`,
      manager,
      { via: 'slack' }
    )

    if (approval.approved) {
      await worker$.notify(expense.submitter, 'Your expense was approved!')
    }
  })
})
```

## What You Can Do

### Notify - Send Messages

```typescript
await worker$.notify(target, 'Deployment complete', {
  via: 'slack',
  priority: 'urgent',
})
```

### Ask - Request Information

```typescript
const result = await worker$.ask<{ priority: string }>(
  target,
  'What priority should this be?',
  { schema: { priority: 'low | normal | high' } }
)
console.log(result.answer.priority) // 'high'
```

### Approve - Get Sign-off

```typescript
const result = await worker$.approve(
  'Deploy v2.0 to production',
  manager,
  { via: 'slack', timeout: 3600000 }
)

if (result.approved) {
  console.log(`Approved by ${result.approvedBy?.name}`)
}
```

### Decide - Make Choices

```typescript
const result = await worker$.decide({
  options: ['React', 'Vue', 'Svelte'],
  context: 'Choosing a frontend framework',
  criteria: ['DX', 'Performance', 'Ecosystem'],
})

console.log(result.choice)     // 'React'
console.log(result.reasoning)  // 'React offers the best ecosystem...'
console.log(result.confidence) // 0.85
```

## Teams

Group workers with shared contacts:

```typescript
import { Team } from 'digital-workers'

const engineering = Team({
  id: 'team_eng',
  name: 'Engineering',
  members: [alice, bob, codeReviewer],
  contacts: {
    slack: '#engineering',
    email: 'eng@company.com',
  },
  lead: alice,
})

// Notify the whole team
await worker$.notify(engineering, 'Sprint planning in 10 minutes')
```

## Standalone Usage

Use outside of workflows:

```typescript
import { notify, ask, approve, decide } from 'digital-workers'

// Simple notification
await notify(alice, 'Task completed', { via: 'slack' })

// Ask variants
await ask(alice, 'What is the status?')
await ask.ai('What is our refund policy?', { policies: [...] })
await ask.yesNo(manager, 'Should we proceed?')

// Approval variants
await approve('Deploy to production', manager)
await approve.all('Major change', [cto, vpe, securityLead])  // All must approve
await approve.any('Urgent fix', oncallTeam)                   // Any one can approve

// Decision variants
await decide({ options: ['A', 'B', 'C'], criteria: ['cost', 'time'] })
await decide.yesNo('Should we proceed?', context)
await decide.prioritize(['Task 1', 'Task 2', 'Task 3'])
```

## How It Fits Together

```
┌─────────────────────────────────────────────────────────┐
│                    ai-workflows                         │
│              (orchestrates work execution)              │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  digital-workers                        │
│         (abstract interface for work & workers)         │
└────────────────────────┬────────────────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────────────┐
│  autonomous-agents  │   │     human-in-the-loop       │
│  (AI implementation)│   │   (human implementation)    │
└─────────────────────┘   └─────────────────────────────┘
```

- **digital-workers**: The abstract `Worker` interface, action types, and communication patterns
- **autonomous-agents**: Implements `Worker` for AI agents with autonomous decision-making
- **human-in-the-loop**: Implements `Worker` for humans with approval workflows and notifications
- **ai-workflows**: Orchestrates work execution with durable, event-driven workflows

## Advanced Features

### Capability Tiers

Route work based on agent capabilities:

```typescript
import { matchTierToComplexity, canExecuteAtTier } from 'digital-workers'

const tier = matchTierToComplexity({ reasoning: 'high', toolUse: true })
// Returns: { tier: 'agentic', confidence: 0.9 }
```

### Load Balancing

Distribute work across available workers:

```typescript
import { createLeastBusyBalancer, createCapabilityRouter } from 'digital-workers'

const balancer = createLeastBusyBalancer(workers)
const router = createCapabilityRouter(agents)
```

### Error Escalation

Automatic escalation when things go wrong:

```typescript
import { createEscalationEngine, createEscalationPolicy } from 'digital-workers'

const policy = createEscalationPolicy({
  maxRetries: 3,
  escalationPath: ['junior-agent', 'senior-agent', 'human'],
})

const engine = createEscalationEngine(policy)
```

### Agent Communication

Direct agent-to-agent messaging:

```typescript
import { sendToAgent, requestFromAgent, initiateHandoff } from 'digital-workers'

await sendToAgent(targetAgent, { type: 'task', payload: data })
const response = await requestFromAgent(agent, query, { timeout: 5000 })
await initiateHandoff(fromAgent, toAgent, context)
```

## Type Reference

Key exports:

- `Worker`, `Team`, `WorkerRef` - Core interfaces
- `Contacts`, `ContactChannel` - Communication configuration
- `NotifyResult`, `AskResult`, `ApprovalResult`, `DecideResult`, `DoResult` - Action results
- `CapabilityTier`, `CapabilityProfile` - Agent capability levels
- `LoadBalancer`, `EscalationEngine` - Advanced orchestration

## Related Packages

- **autonomous-agents** - Implements `Worker` for AI agents with goals, metrics, and autonomous decision-making
- **human-in-the-loop** - Implements `Worker` for humans with approval workflows, notifications, and escalation
- **ai-workflows** - Uses `digital-workers` to orchestrate work execution with durable, event-driven workflows
- **services-as-software** - External service integration (crosses company boundaries, unlike workers)
