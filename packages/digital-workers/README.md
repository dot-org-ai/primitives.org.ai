# digital-workers

Common abstract interface for AI Agents and Humans within ai-primitives.

## Overview

Digital workers represent execution entities (AI agents or humans) that can perform tasks within a company/business boundary. They communicate through **Worker Actions** that integrate with `ai-workflows` as durable, traceable operations.

## Installation

```bash
pnpm add digital-workers
```

## Core Concepts

### Worker

A **Worker** is the common interface for both AI agents and humans:

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
    phone: '+1-555-1234',
  },
}

const codeReviewer: Worker = {
  id: 'agent_reviewer',
  name: 'Code Reviewer',
  type: 'agent',
  status: 'available',
  contacts: {
    api: { endpoint: 'https://api.internal/reviewer', auth: 'bearer' },
    webhook: { url: 'https://hooks.internal/reviewer' },
  },
}
```

### Contacts

Workers have **contacts** that define how they can be reached:

```typescript
import type { Contacts } from 'digital-workers'

const contacts: Contacts = {
  email: 'team@company.com',                    // Simple string
  slack: { workspace: 'acme', channel: '#eng' }, // Config object
  phone: { number: '+1-555-0000', voice: 'en-US' },
  sms: '+1-555-0001',
  teams: { tenant: 'company', channel: 'Engineering' },
  discord: { server: 'dev-community', channel: 'support' },
  telegram: { chat: '@company_support' },
  web: { url: 'https://dashboard.company.com', pushEnabled: true },
  api: { endpoint: 'https://api.company.com', auth: 'bearer' },
  webhook: { url: 'https://hooks.company.com/events' },
}
```

### Team

**Teams** group workers with shared contacts:

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
```

## Worker Actions

Worker actions are durable workflow actions with Actor/Object semantics that integrate with `ai-workflows`:

### Using with Workflows (Recommended)

```typescript
import { Workflow } from 'ai-workflows'
import { registerWorkerActions, withWorkers } from 'digital-workers'

const workflow = Workflow($ => {
  registerWorkerActions($)
  const worker$ = withWorkers($)

  $.on.Expense.submitted(async (expense) => {
    // Notify finance team
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

### Direct Workflow Integration

```typescript
// Using $.do for durable actions
await $.do('Worker.notify', {
  actor: 'system',
  object: alice,
  action: 'notify',
  message: 'Deployment complete',
  via: 'slack',
})

// Using $.send for fire-and-forget
await $.send('Worker.notified', { ... })
```

### Action Types

#### notify - Send notifications

```typescript
await worker$.notify(target, 'Message content', {
  via: 'slack',           // Channel to use
  priority: 'urgent',     // 'low' | 'normal' | 'high' | 'urgent'
})
```

#### ask - Request information

```typescript
const result = await worker$.ask<Priority>(
  target,
  'What priority should this be?',
  {
    via: 'slack',
    schema: { priority: 'low | normal | high' },
  }
)
console.log(result.answer) // { priority: 'high' }
```

#### approve - Request approval

```typescript
const result = await worker$.approve(
  'Deploy v2.0 to production',
  manager,
  {
    via: 'slack',
    context: { version: '2.0', environment: 'production' },
    timeout: 3600000, // 1 hour
  }
)

if (result.approved) {
  console.log(`Approved by ${result.approvedBy?.name}`)
}
```

#### decide - AI-powered decisions

```typescript
const result = await worker$.decide({
  options: ['React', 'Vue', 'Svelte'],
  context: 'Choosing a frontend framework for our new project',
  criteria: ['DX', 'Performance', 'Ecosystem'],
})

console.log(result.choice)     // 'React'
console.log(result.reasoning)  // 'React offers the best ecosystem...'
console.log(result.confidence) // 0.85
```

## Standalone Functions

For use outside workflows:

```typescript
import { notify, ask, approve, decide } from 'digital-workers'

// Simple notification
await notify(alice, 'Task completed', { via: 'slack' })

// Ask with variants
await ask(alice, 'What is the status?')
await ask.ai('What is our refund policy?', { policies: [...] })
await ask.yesNo(manager, 'Should we proceed?')

// Approval variants
await approve('Deploy to production', manager)
await approve.all('Major change', [cto, vpe, securityLead])
await approve.any('Urgent fix', oncallTeam)

// Decision making
await decide({ options: ['A', 'B', 'C'], criteria: ['cost', 'time'] })
await decide.yesNo('Should we proceed?', context)
await decide.prioritize(['Task 1', 'Task 2', 'Task 3'])
```

## Additional Utilities

### Role Definition

```typescript
import { Role } from 'digital-workers'

const engineer = Role({
  name: 'Software Engineer',
  description: 'Builds and maintains software',
  responsibilities: ['Write code', 'Review PRs', 'Fix bugs'],
  skills: ['TypeScript', 'React', 'Node.js'],
})
```

### Goals & KPIs

```typescript
import { Goals, kpis, okrs } from 'digital-workers'

const teamGoals = Goals({
  shortTerm: ['Ship v2.0', 'Reduce tech debt'],
  longTerm: ['100% test coverage'],
  metrics: [
    { name: 'Velocity', current: 42, target: 50, unit: 'points' },
  ],
})
```

### Content Generation

```typescript
import { generate } from 'digital-workers'

const result = await generate('Write a product description', {
  type: 'text',
  instructions: 'Keep it under 100 words',
})
```

### Type Validation

```typescript
import { is } from 'digital-workers'

const result = await is('hello@example.com', 'email')
console.log(result.valid) // true
```

## Type Reference

Key types exported:

- `Worker` - Worker interface
- `Team` - Team interface
- `WorkerRef` - Lightweight worker reference
- `Contacts` - Contact configuration
- `ContactChannel` - Channel names
- `WorkerAction` - Action types
- `NotifyResult`, `AskResult`, `ApprovalResult`, `DecideResult`, `DoResult`
- `WorkerContext` - Context extension for workflows

## Related Packages

- `ai-workflows` - Event-driven workflow engine
- `autonomous-agents` - AI agent implementations
- `human-in-the-loop` - Human approval patterns
- `services-as-software` - External service integration
