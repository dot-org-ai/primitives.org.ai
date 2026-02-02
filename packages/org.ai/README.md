# org.ai

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

**The primary consumer-facing types package for AI-powered organizations.**

`org.ai` consolidates foundation types from `@org.ai/types` with organizational types (Role, Team, Goal, KPI, OKR) into a single, unified package. **Consumers should import from `org.ai`, not `@org.ai/types` directly.**

## Package Relationship

```
org.ai (consumer-facing)
├── Re-exports all of @org.ai/types (foundation types)
│   ├── Thing, ThingDO - Base entity types
│   ├── Worker, Agent, Human - Worker types
│   ├── Tool, Toolbox - Tool types
│   ├── Event (5W+H) - Event types
│   ├── Noun, Verb - Schema types
│   ├── LeanCanvas, StoryBrand, Founder - Business framework types
│   └── Startup, ICP - Customer profile types
│
└── Adds organizational types (defined in org.ai)
    ├── Role - Job roles and responsibilities
    ├── Team - Team structures and members
    ├── Goal - Goal tracking
    ├── KPI - Key Performance Indicators
    └── OKR - Objectives and Key Results
```

## Installation

```bash
npm install org.ai
# or
pnpm add org.ai
# or
yarn add org.ai
```

## Usage

### Import Types (Recommended)

```typescript
// Import everything from org.ai - the unified entry point
import type {
  // Foundation types (from @org.ai/types)
  Thing,
  Worker,
  Agent,
  Human,
  Tool,
  Event,
  Noun,
  Verb,
  Startup,
  ICP,
  LeanCanvas,
  StoryBrand,

  // Organizational types (from org.ai)
  Role,
  Team,
  Goal,
  KPI,
  OKR,
} from 'org.ai'
```

### Type Guards and Factory Functions

```typescript
import {
  // Type guards
  isWorker,
  isAgent,
  isHuman,
  isTool,
  isRole,
  isTeam,
  isGoal,
  isKPI,
  isOKR,

  // Factory functions
  createAgent,
  createHuman,
  createRole,
  createTeam,
} from 'org.ai'

// Runtime type checking
if (isAgent(worker)) {
  console.log(worker.model, worker.autonomous)
}

// Create typed entities
const agent = createAgent({
  model: 'claude-3-opus',
  autonomous: true,
  name: 'ResearchAgent',
})
```

## Foundation Types (from @org.ai/types)

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

## Organizational Types (defined in org.ai)

### Role

Defines job roles and responsibilities:

```typescript
interface Role {
  name: string
  description?: string
  responsibilities?: string[]
  skills?: string[]
  workerType?: 'human' | 'agent' | 'any'
}
```

### Team

Team structures with members and channels:

```typescript
interface Team {
  name: string
  description?: string
  members: TeamMember[]
  lead?: TeamLead
  channels?: Channel[]
}
```

### Goal

Goal tracking with status and priority:

```typescript
interface Goal {
  id: string
  description: string
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked'
  category?: 'growth' | 'efficiency' | 'quality' | 'innovation'
  priority?: 'low' | 'medium' | 'high' | 'critical'
  target?: number | string
  current?: number | string
  dueDate?: Date
}
```

### KPI

Key Performance Indicators with trends and history:

```typescript
interface KPI {
  name: string
  value: number
  target: number
  unit?: string
  category?: 'financial' | 'customer' | 'operational' | 'growth'
  trend?: 'up' | 'down' | 'stable'
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  history?: KPIHistoryEntry[]
}
```

### OKR

Objectives and Key Results:

```typescript
interface OKR {
  objective: string
  description?: string
  keyResults: KeyResult[]
  status?: 'on_track' | 'at_risk' | 'off_track' | 'achieved'
  owner?: string
  period?: string
}

interface KeyResult {
  description: string
  target: number
  current: number
  unit?: string
  status?: 'not_started' | 'in_progress' | 'achieved' | 'missed'
}
```

## Why org.ai Instead of @org.ai/types?

1. **Single Import Source**: Import all types from one package
2. **Complete Type Set**: Foundation types + organizational types in one place
3. **Simplified Dependencies**: Only add `org.ai` to your package.json
4. **Future-Proof**: New organizational types will be added to `org.ai`

`@org.ai/types` is the foundation package used internally by other packages in the monorepo. For application development, always use `org.ai`.

## Subpath Exports

For specific use cases, subpath exports are available:

```typescript
// Types only (same as main export)
import type { Thing, Role, Team } from 'org.ai/types'

// Identity utilities
import { createUser, createAgentIdentity, createSession } from 'org.ai/identity'
```

## Part of the AI Primitives Ecosystem

`org.ai` provides types for the entire ecosystem:

- [ai-functions](../ai-functions) - AI function primitives
- [ai-workflows](../ai-workflows) - Workflow orchestration
- [ai-database](../ai-database) - AI-native database
- [autonomous-agents](../autonomous-agents) - Agent primitives
- [digital-workers](../digital-workers) - Worker abstraction
- [business-as-code](../business-as-code) - Business logic

For runtime functionality, use the individual packages or the `ai-primitives` umbrella package.

## License

MIT
