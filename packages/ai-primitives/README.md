# ai-primitives

![Stability: Alpha](https://img.shields.io/badge/stability-alpha-orange)

All AI primitives for building intelligent applications - a unified package that re-exports primitives from the entire ecosystem.

## Installation

```bash
npm install ai-primitives
# or
pnpm add ai-primitives
# or
yarn add ai-primitives
```

## Overview

`ai-primitives` is a meta-package that provides a single entry point to all AI building blocks in the ecosystem. Instead of importing from multiple packages, you can import everything you need from `ai-primitives`.

## Quick Start

```typescript
import {
  // AI Functions
  ai, generate, list, is, summarize,
  // Agents
  Agent, Role, Team, Goals,
  // Workflows
  Workflow, on, every, send,
  // Database
  DB,
  // Workers
  workers,
  // Human-in-the-loop
  Human,
  // And more...
} from 'ai-primitives'

// Generate text with AI
const summary = await summarize('Long article text here...')

// Check conditions with AI
const isSpam = await is`Is "${message}" spam?`

// Create structured lists
const ideas = await list`5 startup ideas for ${industry}`
```

## Core Primitives

### AI Functions

Core AI primitives for generation, classification, and extraction.

```typescript
import {
  ai, generate, write, code, list, lists,
  extract, summarize, is, diagram, slides,
  image, video, research, read, browse,
  decide, ask, approve, review,
  configure, withContext,
} from 'ai-primitives'

// Template literal syntax for quick AI calls
const poem = await ai`Write a haiku about ${topic}`

// Generate structured output
const result = await generate({
  prompt: 'Describe the weather',
  schema: { temperature: 'number', conditions: 'string' }
})

// Extract data from text
const entities = await extract`
  Extract names and emails from: ${text}
`

// Boolean classification
const positive = await is`Is "${review}" a positive review?`

// Generate lists
const items = await list`Top 5 programming languages for ${useCase}`

// Code generation
const snippet = await code`
  A function that ${description}
  Language: TypeScript
`
```

### Language Models

Access and resolve language models from multiple providers.

```typescript
import { models, resolveModel, getModelInfo, searchModels } from 'ai-primitives'

// List all available models
const allModels = models()

// Resolve a model alias to full model ID
const model = resolveModel('claude')  // -> 'anthropic/claude-sonnet-4-20250514'

// Get model information
const info = getModelInfo('gpt-4')

// Search models by capability
const results = searchModels({ capability: 'vision' })
```

### AI Providers

Unified provider registry for multiple AI services.

```typescript
import {
  createRegistry, model, embeddingModel,
  LLM, getLLM,
} from 'ai-primitives'

// Get a model from the registry
const chatModel = model('anthropic/claude-sonnet-4-20250514')

// Get an embedding model
const embedder = embeddingModel('openai/text-embedding-3-small')

// Use the LLM transport for unified access
const llm = getLLM({ provider: 'anthropic' })
```

## Data Layer

### Database

Schema-first database with promise pipelining and natural language queries.

```typescript
import { DB } from 'ai-primitives'
import type { ThingFlat, ThingExpanded, DatabaseSchema } from 'ai-primitives'

// Define your schema
const { db } = DB({
  Lead: {
    name: 'string',
    email: 'string',
    company: 'Company.leads',
  },
  Company: {
    name: 'string',
  }
})

// Chain operations without await
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

## Workflow Orchestration

### Workflows

Event-driven workflows with a fluent $ context API.

```typescript
import { Workflow, on, every, send } from 'ai-primitives'

// Create a workflow
const workflow = Workflow($ => {
  // Handle events
  $.on.Customer.created(async (customer, $) => {
    $.log('New customer:', customer.name)
    await $.send('Email.welcome', { to: customer.email })
  })

  $.on.Order.completed(async (order, $) => {
    $.log('Order completed:', order.id)
  })

  // Schedule recurring tasks
  $.every.hour(async ($) => {
    $.log('Hourly health check')
  })

  $.every.Monday.at9am(async ($) => {
    $.log('Weekly standup reminder')
  })

  // Natural language scheduling
  $.every('first Monday of the month', async ($) => {
    $.log('Monthly report')
  })
})

// Start the workflow
await workflow.start()

// Emit events
await workflow.send('Customer.created', { name: 'John', email: 'john@example.com' })
```

## Agents and Workers

### Autonomous Agents

Create AI agents that can execute tasks and make decisions.

```typescript
import { Agent, Role, Team, Goals } from 'ai-primitives'

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

### Digital Workers

Abstract interface for organizing work between AI and humans.

```typescript
import { workers } from 'ai-primitives'

// Worker routing functions route work to AI Agents or Humans
// via real communication channels

// Route a task to a worker
await workers.do(task, workerConfig)

// Ask a question via communication channel
await workers.ask(question, { via: 'slack' })

// Request approval through workflow
await workers.approve(request, manager)

// Multi-criteria decision
await workers.decide(options, criteria)
```

### Human-in-the-Loop

Integrate human oversight and intervention in AI workflows.

```typescript
import { Human, HumanManager } from 'ai-primitives'

// Create a human-in-the-loop manager
const human = Human({
  defaultTimeout: 3600000, // 1 hour
  autoEscalate: true,
})

// Request human approval
const result = await human.approve({
  title: 'Deploy to production',
  description: 'Approve deployment of v2.0.0',
  assignee: 'tech-lead@example.com',
  priority: 'high',
})

if (result.approved) {
  await deploy()
}
```

## Tasks and Tools

### Digital Tasks

Task management with parallel/sequential execution.

```typescript
import { createTask, task, parallel, sequential } from 'ai-primitives'

// Create a task
const t = await createTask({
  function: {
    type: 'generative',
    name: 'summarize',
    args: { text: 'The text to summarize' },
    output: 'string',
    promptTemplate: 'Summarize: {{text}}',
  },
  input: { text: 'Long article...' },
  priority: 'high',
})

// Define project with parallel/sequential tasks
const project = {
  name: 'Launch Feature',
  tasks: [
    parallel(
      task('Design mockups'),
      task('Write tech spec'),
    ),
    sequential(
      task('Implement backend'),
      task('Implement frontend'),
      task('Write tests'),
    ),
  ],
}
```

### Digital Tools

Tools usable by both humans and AI agents.

```typescript
import { defineTool } from 'ai-primitives'

// Define a custom tool
const myTool = defineTool({
  name: 'fetchWeather',
  description: 'Fetch current weather for a location',
  parameters: {
    type: 'object',
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
  execute: async ({ location }) => {
    // Implementation
    return { temperature: 72, conditions: 'sunny' }
  },
})
```

## Products and Services

### Digital Products

Define digital products: Apps, APIs, Sites, SDKs.

```typescript
import { Product, App, API, Site, SDK, MCP } from 'ai-primitives'

// Define an API
const api = API({
  name: 'Weather API',
  version: '1.0.0',
  endpoints: [
    { path: '/weather', method: 'GET', description: 'Get weather data' },
  ],
})

// Define a site
const site = Site({
  name: 'Documentation',
  domain: 'docs.example.com',
  pages: ['/', '/getting-started', '/api-reference'],
})
```

### Services as Software

Build AI-powered services with business logic.

```typescript
import { Service, Endpoint, Client, Provider } from 'ai-primitives'

// Define a service
const service = Service({
  name: 'TranslationService',
  description: 'AI-powered translation',
  pricing: {
    model: 'usage',
    price: 0.01,
    unit: 'word',
  },
})

// Define endpoints
const translateEndpoint = Endpoint({
  path: '/translate',
  method: 'POST',
  handler: async (req) => {
    // Translation logic
  },
})
```

## Business Logic

### Business as Code

Express business logic, goals, KPIs, and financials as code.

```typescript
import { Business, kpis, okrs, financials } from 'ai-primitives'

// Define your business
const company = Business({
  name: 'Acme Corp',
  mission: 'To make widgets accessible to everyone',
  values: ['Innovation', 'Customer Focus', 'Integrity'],
})

// Track KPIs
const metrics = kpis([
  {
    name: 'Monthly Recurring Revenue',
    category: 'financial',
    target: 100000,
    current: 85000,
  },
])

// Define OKRs
const objectives = okrs([
  {
    objective: 'Achieve Product-Market Fit',
    keyResults: [
      {
        description: 'Increase NPS',
        metric: 'NPS',
        targetValue: 60,
        currentValue: 52,
      },
    ],
  },
])

// Calculate financials
const finance = financials({
  revenue: 1000000,
  cogs: 300000,
  operatingExpenses: 500000,
})
```

## Additional Features

### AI Props

Generate component props using AI.

```typescript
import { createAIComponent, generateProps } from 'ai-primitives'

// Create an AI-enhanced component
const AICard = createAIComponent({
  schema: {
    title: 'string',
    description: 'string',
    imageUrl: 'string',
  },
})

// Generate props automatically
const props = await generateProps(AICard, {
  prompt: 'A card about machine learning',
})
```

### Evaluation

Secure code execution in sandboxed environments.

```typescript
import { evaluate, createEvaluator } from 'ai-primitives'

// Evaluate code safely
const result = await evaluate({
  code: `
    export default function() {
      return 2 + 2
    }
  `,
})

console.log(result.output) // 4
```

### Experiments

Run AI experiments with different configurations.

```typescript
import { Experiment } from 'ai-primitives'

// Define an experiment
const experiment = Experiment({
  name: 'prompt-comparison',
  variants: ['v1', 'v2', 'control'],
  metrics: ['accuracy', 'latency'],
})
```

## Type Exports

The package also exports shared types from org.ai:

```typescript
import type {
  // Core entities
  Thing, ThingDO, Noun, Verb,
  // Workers
  WorkerType, AgentType, HumanType,
  // Tools
  ToolType,
  // Events
  Event,
  // Organization
  WorkflowContext,
  // Business
  LeanCanvasType, StoryBrandType, StartupType, ICPType,
} from 'ai-primitives'
```

## Package Dependencies

`ai-primitives` unifies the following packages:

| Package | Description |
|---------|-------------|
| `ai-functions` | Core AI primitives (generate, list, is, etc.) |
| `ai-providers` | Unified AI provider registry |
| `language-models` | Model listing and resolution |
| `ai-database` | Schema-first database with AI |
| `ai-workflows` | Event-driven workflows |
| `autonomous-agents` | AI agent primitives |
| `digital-workers` | Worker coordination |
| `human-in-the-loop` | Human oversight integration |
| `ai-experiments` | AI experimentation |
| `digital-tasks` | Task management |
| `digital-tools` | Tool definitions |
| `digital-products` | Product definitions |
| `services-as-software` | Service primitives |
| `business-as-code` | Business logic |
| `ai-props` | AI-powered component props |
| `ai-evaluate` | Sandboxed code evaluation |
| `org.ai` | Shared types |

## License

MIT
