# human-in-the-loop

Primitives for integrating human oversight and intervention in AI workflows. Implements the digital-workers interface for humans operating within a company boundary.

## Overview

This package provides a comprehensive toolkit for human-in-the-loop (HITL) workflows, enabling seamless integration of human judgment, approval, and intervention points in automated AI systems.

**Key Features:**

- 🎯 **Approval Workflows** - Multi-step approval gates with escalation
- ❓ **Question & Answer** - Ask humans for information or guidance
- 📋 **Task Assignment** - Delegate tasks that require human judgment
- 🔀 **Decision Points** - Request human decisions between options
- 👀 **Review Processes** - Code, content, design, and data reviews
- 📬 **Notifications** - Multi-channel notifications (Slack, email, SMS, web)
- 👥 **Role & Team Management** - Define roles, teams, and capabilities
- 📊 **Goals & OKRs** - Track objectives, KPIs, and key results
- ⏰ **Timeouts & Escalation** - Automatic escalation on timeout
- 🔄 **Review Queues** - Organize and prioritize pending requests

## Installation

```bash
pnpm add human-in-the-loop
```

## Quick Start

```typescript
import { Human, approve, ask, notify } from 'human-in-the-loop'

// Create a Human-in-the-loop manager
const human = Human({
  defaultTimeout: 3600000, // 1 hour
  autoEscalate: true,
})

// Request approval
const result = await approve({
  title: 'Deploy to production',
  description: 'Approve deployment of v2.0.0',
  subject: 'Production Deployment',
  input: { version: '2.0.0' },
  assignee: 'tech-lead@example.com',
  priority: 'high',
})

if (result.approved) {
  await deploy()
  await notify({
    type: 'success',
    title: 'Deployment complete',
    message: 'v2.0.0 deployed to production',
    recipient: 'team@example.com',
  })
}
```

## API Reference

### Core Functions

#### `Human(options?)`

Create a Human-in-the-loop manager instance.

```typescript
const human = Human({
  defaultTimeout: 3600000, // Default timeout in ms
  defaultPriority: 'normal', // Default priority level
  autoEscalate: true, // Auto-escalate on timeout
  escalationPolicies: [...], // Escalation policies
  store: customStore, // Custom storage backend
})
```

#### `approve(params)`

Request approval from a human.

```typescript
const result = await approve({
  title: 'Expense Approval',
  description: 'Approve employee expense claim',
  subject: 'Expense Claim #1234',
  input: { amount: 150, category: 'Travel' },
  assignee: 'manager@example.com',
  priority: 'normal',
  timeout: 86400000, // 24 hours
  escalatesTo: 'director@example.com',
})

// result: { approved: boolean, comments?: string, conditions?: string[] }
```

#### `ask(params)`

Ask a question to a human.

```typescript
const answer = await ask({
  title: 'Product naming',
  question: 'What should we name the new feature?',
  context: { feature: 'AI Assistant' },
  assignee: 'product-manager@example.com',
  suggestions: ['CodeMate', 'DevAssist', 'AIHelper'],
})

// answer: string
```

#### `do(params)`

Request a human to perform a task (implements digital-workers interface).

```typescript
const result = await do({
  title: 'Review code',
  instructions: 'Review the PR and provide feedback',
  input: { prUrl: 'https://github.com/...' },
  assignee: 'senior-dev@example.com',
  estimatedEffort: '30 minutes',
})

// result: TOutput (task-specific)
```

#### `decide(params)`

Request a human to make a decision.

```typescript
const strategy = await decide({
  title: 'Deployment strategy',
  options: ['blue-green', 'canary', 'rolling'],
  context: { risk: 'high', users: 100000 },
  criteria: ['Minimize risk', 'Fast rollback'],
  assignee: 'devops-lead@example.com',
})

// strategy: 'blue-green' | 'canary' | 'rolling'
```

#### `generate(params)`

Request content generation from a human (specialized form of `do()`).

```typescript
const content = await generate({
  title: 'Write blog post',
  instructions: 'Write about our new AI features',
  input: { topic: 'AI Assistant', targetAudience: 'developers' },
  assignee: 'content-writer@example.com',
})

// content: string
```

#### `is(params)`

Request validation/type checking from a human.

```typescript
const valid = await is({
  title: 'Validate data',
  question: 'Is this user data valid and complete?',
  input: userData,
  assignee: 'data-specialist@example.com',
})

// valid: boolean
```

#### `notify(params)`

Send a notification to a human.

```typescript
await notify({
  type: 'info', // 'info' | 'warning' | 'error' | 'success'
  title: 'Deployment complete',
  message: 'Version 2.0.0 deployed successfully',
  recipient: 'team@example.com',
  channels: ['slack', 'email'], // Optional
  priority: 'normal',
})
```

### Role & Team Management

#### `Role(definition)`

Define a human role.

```typescript
const techLead = Role({
  id: 'tech-lead',
  name: 'Tech Lead',
  description: 'Technical leadership',
  capabilities: ['approve-prs', 'deploy-prod'],
  escalatesTo: 'engineering-manager',
})
```

#### `Team(definition)`

Define a team.

```typescript
const engineering = Team({
  id: 'engineering',
  name: 'Engineering Team',
  members: ['alice', 'bob', 'charlie'],
  lead: 'alice',
})
```

#### `registerHuman(human)`

Register a human worker.

```typescript
const alice = registerHuman({
  id: 'alice',
  name: 'Alice Smith',
  email: 'alice@example.com',
  roles: ['tech-lead'],
  teams: ['engineering'],
  channels: {
    slack: '@alice',
    email: 'alice@example.com',
  },
})
```

### Goals & Performance Tracking

#### `Goals(definition)`

Define goals for a team or individual.

```typescript
const q1Goals = Goals({
  id: 'q1-2024',
  objectives: ['Launch v2.0', 'Improve performance by 50%'],
  successCriteria: ['Release by March 31', 'Pass benchmarks'],
  targetDate: new Date('2024-03-31'),
})
```

#### `kpis(kpi)`

Track Key Performance Indicators.

```typescript
kpis({
  id: 'response-time',
  name: 'API Response Time',
  value: 120,
  target: 100,
  unit: 'ms',
  trend: 'down',
})
```

#### `okrs(okr)`

Define Objectives and Key Results.

```typescript
okrs({
  id: 'q1-2024-growth',
  objective: 'Accelerate user growth',
  keyResults: [
    {
      description: 'Increase active users by 50%',
      progress: 0.3,
      current: 13000,
      target: 15000,
    },
  ],
  period: 'Q1 2024',
  owner: 'ceo@example.com',
})
```

## Advanced Usage

### Custom Store Implementation

Implement a custom storage backend:

```typescript
import { HumanStore } from 'human-in-the-loop'

class DatabaseHumanStore implements HumanStore {
  async create(request) {
    // Save to database
  }

  async get(id) {
    // Fetch from database
  }

  async update(id, updates) {
    // Update in database
  }

  async complete(id, response) {
    // Complete request
  }

  async reject(id, reason) {
    // Reject request
  }

  async escalate(id, to) {
    // Escalate request
  }

  async cancel(id) {
    // Cancel request
  }

  async list(filters, limit) {
    // List requests with filters
  }
}

const human = Human({
  store: new DatabaseHumanStore(),
})
```

### Escalation Policies

Define automatic escalation policies:

```typescript
const human = Human({
  autoEscalate: true,
  escalationPolicies: [
    {
      id: 'critical-approval',
      name: 'Critical Approval Policy',
      conditions: {
        timeout: 1800000, // 30 minutes
        minPriority: 'critical',
      },
      escalationPath: [
        {
          assignee: 'tech-lead',
          afterMs: 1800000, // 30 minutes
          notifyVia: ['slack', 'sms'],
        },
        {
          assignee: 'engineering-manager',
          afterMs: 3600000, // 1 hour
          notifyVia: ['slack', 'email', 'sms'],
        },
      ],
    },
  ],
})
```

### Approval Workflows

Create multi-step approval workflows:

```typescript
const workflow = human.createWorkflow({
  id: 'prod-deployment-workflow',
  name: 'Production Deployment Workflow',
  steps: [
    {
      name: 'Code Review',
      role: 'engineer',
      approvers: ['bob'],
      requireAll: true,
    },
    {
      name: 'Security Review',
      role: 'security-engineer',
      approvers: ['security-team'],
      requireAll: false, // Any one approver
    },
    {
      name: 'Tech Lead Approval',
      role: 'tech-lead',
      approvers: ['alice'],
      requireAll: true,
    },
  ],
})
```

### Review Queues

Organize and prioritize pending requests:

```typescript
const queue = await human.getQueue({
  name: 'High Priority Queue',
  description: 'All high priority pending requests',
  filters: {
    status: ['pending', 'in_progress'],
    priority: ['high', 'critical'],
  },
  sortBy: 'priority',
  sortDirection: 'desc',
  limit: 10,
})

console.log(`Queue: ${queue.name}`)
console.log(`Items: ${queue.items.length}`)

for (const item of queue.items) {
  console.log(`- ${item.title} (${item.priority})`)
}
```

### Request Management

Manually manage requests:

```typescript
// Get a request
const request = await human.getRequest('req_123')

// Complete with response
await human.completeRequest('req_123', {
  approved: true,
  comments: 'Looks good!',
})

// Reject
await human.rejectRequest('req_123', 'Not ready yet')

// Escalate
await human.escalateRequest('req_123', 'manager@example.com')

// Cancel
await human.cancelRequest('req_123')
```

## Integration with digital-workers

Human-in-the-loop implements the `Worker` interface from `digital-workers`, enabling humans to:
- Receive notifications, questions, and approval requests via Worker Actions
- Be targeted by workflow actions
- Communicate through configured contact channels

### Using Worker Actions in Workflows

```typescript
import { Workflow } from 'ai-workflows'
import { registerWorkerActions, withWorkers } from 'digital-workers'
import type { Worker } from 'digital-workers'

// Define a human worker with contacts
const alice: Worker = {
  id: 'alice',
  name: 'Alice',
  type: 'human',
  status: 'available',
  contacts: {
    email: 'alice@company.com',
    slack: { workspace: 'company', user: 'U123' },
    phone: '+1-555-1234',
  },
}

const workflow = Workflow($ => {
  registerWorkerActions($)
  const worker$ = withWorkers($)

  $.on.Expense.submitted(async (expense) => {
    // Request approval from manager using Worker Actions
    const approval = await worker$.approve(
      `Expense: $${expense.amount} for ${expense.description}`,
      alice,
      { via: 'slack', timeout: 86400000 }
    )

    if (approval.approved) {
      await worker$.notify(
        expense.submitter,
        'Your expense has been approved!',
        { via: 'email' }
      )
    }
  })

  $.on.Deployment.requested(async (deploy) => {
    // Ask human for confirmation
    const confirmed = await worker$.ask(
      alice,
      `Proceed with deployment of ${deploy.version} to ${deploy.env}?`,
      { schema: { proceed: 'boolean', notes: 'string' } }
    )

    if (confirmed.answer.proceed) {
      $.send('Deployment.approved', deploy)
    }
  })
})
```

### Human as Worker Target

```typescript
import { registerHuman } from 'human-in-the-loop'
import { notify, ask, approve } from 'digital-workers'

// Register a human worker
const manager = registerHuman({
  id: 'manager',
  name: 'Manager',
  email: 'manager@company.com',
  roles: ['approver'],
  teams: ['finance'],
  channels: {
    slack: '@manager',
    email: 'manager@company.com',
  },
})

// Use digital-workers actions directly
await notify(manager, 'Weekly report ready', { via: 'email' })

const answer = await ask(manager, 'What is the Q2 budget?', {
  via: 'slack',
  schema: { amount: 'number', notes: 'string' },
})

const approval = await approve('Hire contractor', manager, {
  via: 'slack',
  context: { role: 'Senior Developer', rate: '$150/hr' },
})
```

## Integration Examples

### With AI Workflows

```typescript
import { Human } from 'human-in-the-loop'
import { AI } from 'ai-functions'

const human = Human()
const ai = AI()

async function processWithOversight(data: unknown) {
  // AI generates initial result
  const result = await ai.analyze(data)

  // Human reviews before proceeding
  const review = await human.review({
    title: 'Review AI analysis',
    content: result,
    reviewType: 'data',
    criteria: ['Accuracy', 'Completeness', 'Bias'],
    assignee: 'data-analyst@example.com',
  })

  if (review.approved) {
    return result
  } else {
    // Request human to fix
    return await human.do({
      title: 'Fix analysis',
      instructions: review.comments,
      input: { original: result, feedback: review.changes },
      assignee: 'data-analyst@example.com',
    })
  }
}
```

### With MCP Tools

```typescript
import { createMCPServer } from '@mdxe/mcp'
import { Human } from 'human-in-the-loop'

const human = Human()

const mcpServer = createMCPServer({
  tools: {
    request_approval: {
      description: 'Request human approval',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          assignee: { type: 'string' },
        },
        required: ['title', 'description'],
      },
      handler: async (params) => {
        const result = await human.approve({
          title: params.title,
          description: params.description,
          subject: params.title,
          input: params,
          assignee: params.assignee,
        })
        return result
      },
    },
  },
})
```

## Architecture

The package follows a clean architecture with clear separation of concerns:

```
human-in-the-loop/
├── src/
│   ├── types.ts      # Type definitions
│   ├── store.ts      # Storage implementation
│   ├── human.ts      # Core HumanManager class
│   ├── helpers.ts    # Convenience functions
│   └── index.ts      # Public exports
├── examples/
│   └── basic-usage.ts  # Usage examples
└── README.md
```

**Design Principles:**

- **Store-agnostic**: Works with any storage backend (in-memory, database, queue)
- **Channel-flexible**: Supports multiple notification channels
- **Type-safe**: Full TypeScript support with strict types
- **Extensible**: Easy to add custom workflows and policies
- **Digital Workers Interface**: Compatible with the digital-workers abstraction

## Related Packages

- **ai-functions**: Core AI primitives
- **digital-workers**: Abstract interface over AI agents and humans
- **ai-workflows**: Event-driven AI workflows
- **@mdxe/mcp**: Model Context Protocol integration

## License

MIT

## Contributing

Contributions welcome! Please see the main repository for guidelines.
