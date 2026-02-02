# autonomous-agents

![Stability: Beta](https://img.shields.io/badge/stability-beta-yellow)

Primitives for building and orchestrating autonomous AI agents. Implements the `digital-workers` interface for AI agents operating within a company boundary.

## Overview

Autonomous agents are AI Workers that can:
- Execute tasks and make decisions autonomously
- Work in teams with other agents and humans
- Track goals and metrics (KPIs, OKRs)
- Request approvals and interact with human oversight
- Operate within defined roles and responsibilities

## Installation

```bash
pnpm add autonomous-agents
```

## Integration with digital-workers

Autonomous agents implement the `Worker` interface from `digital-workers`, enabling them to:
- Receive notifications, questions, and approval requests
- Be targeted by Worker Actions in workflows
- Communicate through configured contact channels

```typescript
import { Agent } from 'autonomous-agents'
import { registerWorkerActions, withWorkers } from 'digital-workers'
import { Workflow } from 'ai-workflows'

// Create an autonomous agent
const codeReviewer = Agent({
  name: 'Code Reviewer',
  role: Role({
    name: 'Senior Engineer',
    description: 'Reviews code for quality and security',
    skills: ['code review', 'security analysis'],
  }),
  mode: 'autonomous',
  contacts: {
    api: { endpoint: 'https://api.internal/reviewer', auth: 'bearer' },
    webhook: { url: 'https://hooks.internal/code-review' },
  },
})

// Use in workflows
const workflow = Workflow($ => {
  registerWorkerActions($)
  const worker$ = withWorkers($)

  $.on.PR.opened(async (pr) => {
    // Ask the AI agent to review
    const review = await worker$.ask(
      codeReviewer,
      `Review PR #${pr.number}: ${pr.title}`,
      { schema: { approved: 'boolean', comments: ['string'] } }
    )

    if (!review.approved) {
      await worker$.notify(pr.author, `Code review needs changes: ${review.comments.join(', ')}`)
    }
  })
})
```

## Creating Agents

### Basic Agent

```typescript
import { Agent, Role } from 'autonomous-agents'

const productManager = Role({
  name: 'Product Manager',
  description: 'Manages product strategy and roadmap',
  skills: ['product strategy', 'user research', 'roadmap planning'],
})

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

// Ask questions
const answer = await agent.ask('What are the top user complaints?')
```

### Supervised Agent

```typescript
const supervisedAgent = Agent({
  name: 'DeployBot',
  role: Role({
    name: 'DevOps Engineer',
    description: 'Manages deployments',
    skills: ['deployment', 'infrastructure'],
  }),
  mode: 'supervised',
  supervisor: 'alice@company.com', // Human supervisor
  requiresApproval: true,
  contacts: {
    slack: { workspace: 'company', channel: '#deployments' },
  },
})

// This will request approval before executing
const approval = await supervisedAgent.approve({
  title: 'Production Deployment',
  description: 'Deploy v2.0.0 to production',
  data: { version: '2.0.0', environment: 'production' },
  priority: 'high',
})

if (approval.status === 'approved') {
  await supervisedAgent.do('Deploy application', { version: '2.0.0' })
}
```

## Teams

Create teams of agents and humans:

```typescript
import { Team, Agent, Role } from 'autonomous-agents'

const engineeringTeam = Team({
  name: 'Engineering',
  description: 'Product engineering team',
  members: [
    {
      id: 'alice',
      name: 'Alice',
      role: Role({ name: 'Tech Lead', description: 'Leads technical decisions', skills: [] }),
      type: 'human',
    },
    {
      id: 'code-reviewer',
      name: 'Code Reviewer Bot',
      role: Role({ name: 'Reviewer', description: 'Reviews code', skills: ['code review'] }),
      type: 'agent',
    },
  ],
  goals: [
    { id: 'velocity', description: 'Increase velocity by 20%', target: '20%' },
  ],
  channels: [
    { id: 'slack', type: 'slack', config: { channel: '#engineering' } },
  ],
})

// Find best team member for a task
const reviewer = findBestMemberForTask(engineeringTeam, 'code review')
```

## Goals and OKRs

Track agent goals with KPIs and OKRs:

```typescript
import { Goals, kpis, okrs } from 'autonomous-agents'

const agentGoals = Goals({
  goals: [
    {
      id: 'response-time',
      description: 'Maintain sub-5s response time',
      target: '5s',
      priority: 'high',
      successCriteria: ['95th percentile < 5s', 'No timeouts'],
    },
  ],
  strategy: 'Focus on performance optimization',
})

// Define KPIs
const performanceKPIs = kpis([
  {
    id: 'response-time',
    name: 'Response Time',
    value: 3.2,
    target: 5,
    unit: 'seconds',
    trend: 'down', // lower is better
  },
  {
    id: 'success-rate',
    name: 'Success Rate',
    value: 98.5,
    target: 99,
    unit: '%',
    trend: 'up',
  },
])

// Define OKRs
const quarterlyOKRs = okrs([
  {
    id: 'okr-1',
    objective: 'Improve agent reliability',
    keyResults: [
      { id: 'kr-1', description: 'Reduce error rate', current: 2, target: 0.5, unit: '%' },
      { id: 'kr-2', description: 'Increase uptime', current: 99.5, target: 99.9, unit: '%' },
    ],
    period: 'Q1 2024',
    status: 'active',
  },
])
```

## Action Primitives

Standalone action functions:

```typescript
import { do as doTask, ask, decide, approve, generate, is, notify } from 'autonomous-agents'

// Execute a task
const result = await doTask('Analyze customer feedback', {
  feedback: ['Great!', 'Needs work', 'Love it'],
})

// Ask a question
const answer = await ask('What are the key benefits?', { product: 'AI Assistant' })

// Make a decision
const choice = await decide(['React', 'Vue', 'Svelte'], 'Best framework for this project')

// Request approval
const approval = await approve({
  title: 'Budget Request',
  description: 'Request $50k for research',
  data: { amount: 50000 },
  approver: 'manager@company.com',
  channel: 'slack',
})

// Generate content
const content = await generate({
  schema: { title: 'string', body: 'string' },
  prompt: 'Write a blog post about AI',
})

// Type validation
const isValid = await is({ email: 'test@example.com' }, 'valid email address')

// Send notification
await notify({
  message: 'Task completed!',
  channel: 'slack',
  recipients: ['#general'],
})
```

## Role Definitions

Define agent capabilities through roles:

```typescript
import { Role, Roles, hasSkill, getPermissions } from 'autonomous-agents'

// Create a role
const securityAnalyst = Role({
  name: 'Security Analyst',
  description: 'Analyzes code for security vulnerabilities',
  skills: ['security analysis', 'code review', 'vulnerability assessment'],
  permissions: ['read-code', 'create-issues', 'request-changes'],
})

// Check capabilities
if (hasSkill(securityAnalyst, 'security analysis')) {
  // Assign security review
}

// Common roles
const { ProductManager, SoftwareEngineer, DataAnalyst } = Roles
```

## Type Reference

Key types exported:

- `Agent` / `AgentType` - Agent interface and configuration
- `AgentConfig` - Agent configuration options
- `AgentMode` - 'autonomous' | 'supervised' | 'manual'
- `Role` / `RoleType` - Role definitions
- `Team` / `TeamType` - Team composition
- `Goal` - Goal definitions
- `KPI` - Key Performance Indicators
- `OKR` - Objectives and Key Results
- `ApprovalRequest` / `ApprovalResult` - Approval workflow types

## Related Packages

- `digital-workers` - Common Worker interface for agents and humans
- `ai-workflows` - Event-driven workflow engine
- `human-in-the-loop` - Human oversight patterns
- `ai-functions` - AI function primitives
