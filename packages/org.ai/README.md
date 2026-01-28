# org.ai

All primitives for building AI-powered organizations.

## Overview

`org.ai` is a comprehensive TypeScript package that provides shared type definitions and re-exports from the AI primitives ecosystem. It serves as a unified entry point for accessing types and functionality related to:

- **AI Functions** - Core primitives for AI-powered operations
- **Autonomous Agents** - Building and orchestrating AI agents
- **Workflows** - Event-driven workflow automation
- **Database** - Schema-first database with promise pipelining
- **Digital Workers** - Abstracting human and AI workers
- **Business Logic** - KPIs, OKRs, and financial metrics
- **Human-in-the-Loop** - Human oversight and approval workflows
- **And more...**

> **Note**: This package is primarily focused on providing shared type definitions. For the full umbrella package with all runtime functionality, consider using `ai-primitives` instead.

## Installation

```bash
npm install org.ai
```

```bash
pnpm add org.ai
```

```bash
yarn add org.ai
```

## Usage

### Importing Types (Recommended)

```typescript
import type { Thing, Agent, Workflow, Event, Worker, Tool } from 'org.ai'
```

### Subpath Imports

For more granular imports, use the available subpaths:

```typescript
// AI Functions - core primitives
import { ai, generate, list, schema } from 'org.ai/functions'

// Workflows - event-driven automation
import { Workflow, on, every } from 'org.ai/workflows'

// Agents - autonomous AI agents
import { Agent, Role, Team } from 'org.ai/agents'

// Database - schema-first with promise pipelining
import { DB } from 'org.ai/database'

// Models - language model resolution
import { resolve, list as listModels } from 'org.ai/models'

// Providers - AI provider registry
import * as providers from 'org.ai/providers'

// Tasks - task management
import { createTask, task, parallel, sequential } from 'org.ai/tasks'

// Tools - digital tools for humans and AI
import { defineTool } from 'org.ai/tools'

// Products - digital product primitives
import { Product, App, API } from 'org.ai/products'

// Services - AI-powered services
import { Service, Endpoint, Client } from 'org.ai/services'

// Business - business logic primitives
import { Business, kpis, okrs } from 'org.ai/business'

// Human-in-the-Loop - human oversight
import { Human, HumanManager } from 'org.ai/human'

// Props - AI-powered component props
import { createAIComponent, generateProps } from 'org.ai/props'

// Evaluate - secure code execution
import { evaluate, createEvaluator } from 'org.ai/evaluate'

// Experiments - A/B testing
import { Experiment, track } from 'org.ai/experiments'

// Tests - test utilities
import { expect, TestRunner } from 'org.ai/tests'

// Types - shared type definitions
import type { Thing, Worker, Agent } from 'org.ai/types'
```

## Core Types

### Thing

The base entity type with URL-based identity:

```typescript
interface Thing {
  $id: string          // Fully qualified URL (unique identity)
  $type: string        // Noun URL (schema reference)
  name?: string        // Human-readable name
  data?: Record<string, unknown>
  visibility?: 'public' | 'unlisted' | 'org' | 'user'
  relationships?: Record<string, Thing | Thing[]>
  references?: Record<string, Thing | Thing[]>
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date
}
```

### Worker Types

Workers represent entities that can execute work:

```typescript
// Base worker interface
interface WorkerType extends Thing {
  status: 'idle' | 'working' | 'paused' | 'offline'
  capabilities?: string[]
  currentTask?: string
}

// AI Agent - executes work autonomously
interface AgentType extends WorkerType {
  model: string
  autonomous: boolean
  provider?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  tools?: string[]
}

// Human Worker
interface HumanType extends WorkerType {
  email?: string
  role?: string
  department?: string
  manager?: string
  timezone?: string
  availability?: { ... }
}
```

### Event Types (5W+H)

Events follow the 5W+H framework:

```typescript
interface Event {
  $id: string
  $type: string
  what: EventWhat   // What happened
  who: EventWho     // Who did it
  when: EventWhen   // When it happened
  where?: EventWhere // Where it happened
  why?: EventWhy    // Why it happened
  how?: EventHow    // How it happened
}
```

## API Reference

### AI Functions (`org.ai/functions`)

Core primitives for AI-powered operations:

```typescript
// Text generation with template literals
const summary = await ai`Summarize this article: ${article}`

// Generate structured objects
const user = await generate<User>('Create a test user', { schema: UserSchema })

// Generate lists
const ideas = await list`5 startup ideas for ${industry}`

// Boolean checks
const isSpam = await is`Is this comment spam? ${comment}`

// Extract structured data
const entities = await extract`Extract names and dates from: ${text}`

// Human-in-the-loop operations
const approval = await approve({ title: 'Budget Request', data: { amount: 50000 } })
const answer = await ask('What is the priority for this task?')
const choice = await decide(['high', 'medium', 'low'], 'Select priority')
```

### Workflows (`org.ai/workflows`)

Event-driven workflows with `$` context:

```typescript
import { Workflow, on, every, send } from 'org.ai/workflows'

const workflow = Workflow($ => {
  // Event handlers
  $.on.Customer.created(async (customer, $) => {
    $.log('New customer:', customer.name)
    await $.send('Email.welcome', { to: customer.email })
  })

  // Scheduled tasks
  $.every.hour(async ($) => {
    $.log('Hourly check')
  })

  $.every.Monday.at9am(async ($) => {
    $.log('Weekly standup reminder')
  })
})

await workflow.start()
```

### Agents (`org.ai/agents`)

Autonomous AI agents with roles and goals:

```typescript
import { Agent, Role, Team, Goals } from 'org.ai/agents'

// Define a role
const productManager = Role({
  name: 'Product Manager',
  description: 'Manages product strategy and roadmap',
  skills: ['product strategy', 'user research', 'roadmap planning'],
})

// Create an agent
const agent = Agent({
  name: 'ProductAgent',
  role: productManager,
  mode: 'autonomous',
  goals: [
    { id: 'g1', description: 'Define Q1 roadmap', target: '100%' }
  ],
})

// Execute tasks
const result = await agent.do('Create product brief for feature X')

// Make decisions
const choice = await agent.decide(['A', 'B', 'C'], 'Which feature to prioritize?')

// Request approval
const approval = await agent.approve({
  title: 'Budget Request',
  description: 'Request $50k for research',
  data: { amount: 50000 },
})
```

### Database (`org.ai/database`)

Schema-first database with promise pipelining:

```typescript
import { DB } from 'org.ai/database'

const { db } = DB({
  Lead: {
    name: 'string',
    company: 'Company.leads',
    score: 'number',
  },
  Company: {
    name: 'string',
  }
})

// Chain without await
const leads = db.Lead.list()
const qualified = await leads.filter(l => l.score > 80)

// Batch relationship loading
const withCompanies = await leads.map(l => ({
  name: l.name,
  company: l.company,  // Batch loaded!
}))

// Natural language queries
const results = await db.Lead`who closed deals this month?`
```

### Tasks (`org.ai/tasks`)

Task management primitives:

```typescript
import { createTask, task, parallel, sequential, toMarkdown } from 'org.ai/tasks'

// Create individual tasks
const myTask = createTask({
  title: 'Review PR',
  description: 'Review and approve the feature PR',
  priority: 'high',
})

// Parallel execution
const results = await parallel([
  task('Fetch user data'),
  task('Load permissions'),
  task('Get preferences'),
])

// Sequential execution
await sequential([
  task('Validate input'),
  task('Process data'),
  task('Save results'),
])
```

### Business Logic (`org.ai/business`)

Business metrics and KPIs:

```typescript
import { Business, kpis, okrs, financials } from 'org.ai/business'

const business = Business({
  name: 'My Startup',
  kpis: kpis({
    revenue: { target: 1000000, current: 750000 },
    customers: { target: 1000, current: 850 },
  }),
  okrs: okrs([
    {
      objective: 'Increase market share',
      keyResults: [
        { description: 'Reach 10% market share', target: 10, current: 7 },
      ],
    },
  ]),
})
```

### Human-in-the-Loop (`org.ai/human`)

Human oversight and approval workflows:

```typescript
import { Human, HumanManager } from 'org.ai/human'

const manager = HumanManager({
  retryConfig: { maxRetries: 3, backoff: 'exponential' },
  slaConfig: { responseTime: '1h', escalationPath: ['manager', 'director'] },
})

// Request human review
const decision = await manager.request({
  type: 'approval',
  title: 'Large Purchase Approval',
  data: { amount: 100000, vendor: 'Acme Corp' },
})
```

### Experiments (`org.ai/experiments`)

A/B testing and experimentation:

```typescript
import { Experiment, track, decide } from 'org.ai/experiments'

const experiment = Experiment({
  name: 'new-onboarding-flow',
  variants: [
    { id: 'control', weight: 0.5 },
    { id: 'treatment', weight: 0.5 },
  ],
})

// Get variant for user
const variant = await decide(experiment, userId)

// Track conversion
await track('conversion', { experimentId: experiment.id, variantId: variant.id })
```

### Evaluate (`org.ai/evaluate`)

Secure code execution in sandboxed environments:

```typescript
import { evaluate, createEvaluator } from 'org.ai/evaluate'

const result = await evaluate({
  code: `
    const sum = (a, b) => a + b;
    return sum(2, 3);
  `,
  timeout: 5000,
})

console.log(result.output) // 5
```

## Type Guards

The package includes type guards for runtime type checking:

```typescript
import {
  isWorker,
  isAgent,
  isHuman,
  isTool,
  isStartup,
  isLeanCanvas,
  isStoryBrand,
  isFounder,
  isICP,
} from 'org.ai'

if (isAgent(worker)) {
  console.log(worker.model, worker.autonomous)
}
```

## Factory Functions

Create typed entities with auto-generated IDs:

```typescript
import { createAgent, createHuman } from 'org.ai'

const agent = createAgent({
  model: 'claude-3-opus',
  autonomous: true,
  name: 'ResearchAgent',
  systemPrompt: 'You are a research assistant...',
})

const human = createHuman({
  name: 'John Doe',
  email: 'john@example.com',
  role: 'Engineer',
  department: 'Product',
})
```

## Available Exports

| Subpath | Description |
|---------|-------------|
| `org.ai` | Main entry - types and re-exports |
| `org.ai/functions` | AI function primitives |
| `org.ai/providers` | AI provider registry |
| `org.ai/models` | Language model resolution |
| `org.ai/database` | Schema-first database |
| `org.ai/workflows` | Event-driven workflows |
| `org.ai/agents` | Autonomous AI agents |
| `org.ai/workers` | Digital workers abstraction |
| `org.ai/tasks` | Task management |
| `org.ai/tools` | Digital tools |
| `org.ai/products` | Digital product primitives |
| `org.ai/services` | Services as software |
| `org.ai/business` | Business logic primitives |
| `org.ai/human` | Human-in-the-loop |
| `org.ai/props` | AI-powered component props |
| `org.ai/evaluate` | Secure code execution |
| `org.ai/experiments` | A/B testing |
| `org.ai/tests` | Test utilities |
| `org.ai/types` | Shared type definitions |

## Dependencies

This package re-exports from the following workspace packages:

- `@org.ai/types` - Shared type definitions
- `ai-functions` - Core AI primitives
- `ai-providers` - Provider registry
- `ai-database` - Database primitives
- `ai-workflows` - Workflow engine
- `ai-props` - Component props
- `ai-evaluate` - Code execution
- `ai-experiments` - Experimentation
- `ai-tests` - Test utilities
- `autonomous-agents` - Agent primitives
- `digital-workers` - Worker abstraction
- `digital-tasks` - Task management
- `digital-tools` - Tool definitions
- `digital-products` - Product primitives
- `services-as-software` - Service primitives
- `business-as-code` - Business logic
- `human-in-the-loop` - Human oversight
- `language-models` - Model resolution

## License

MIT
