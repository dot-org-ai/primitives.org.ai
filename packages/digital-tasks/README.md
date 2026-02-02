# digital-tasks

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

Task management primitives for digital workers (agents and humans).

## Overview

`digital-tasks` provides a comprehensive framework for managing tasks that can be executed by AI agents, humans, or hybrid teams. Every task wraps a function (code, generative, agentic, or human) with lifecycle management, worker assignment, and dependency tracking.

**Key concept:** Task = Function + metadata (status, progress, assignment, dependencies)

## Installation

```bash
npm install digital-tasks
```

```bash
pnpm add digital-tasks
```

```bash
yarn add digital-tasks
```

## Quick Start

### Creating and Managing Tasks

```typescript
import {
  createTask,
  startTask,
  updateProgress,
  completeTask,
  taskQueue
} from 'digital-tasks'

// Create a task from a function definition
const task = await createTask({
  function: {
    type: 'generative',
    name: 'summarize',
    description: 'Summarize text content',
    args: { text: 'The text to summarize' },
    output: 'string',
  },
  input: { text: 'Long article content...' },
  priority: 'high',
})

// Start working on the task
await startTask(task.id, { type: 'agent', id: 'agent_1', name: 'Summarizer' })

// Update progress
await updateProgress(task.id, 50, 'Processing content')

// Complete the task
await completeTask(task.id, 'Summary of the article...')
```

### Projects with Parallel/Sequential Tasks

```typescript
import {
  createProject,
  task,
  parallel,
  sequential,
  toMarkdown
} from 'digital-tasks'

const project = createProject({
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
})

// Convert to markdown for display
const markdown = toMarkdown(project)
// Output:
// # Launch Feature
//
// - [ ] Design mockups
// - [ ] Write tech spec
//
// 1. [ ] Implement backend
// 2. [ ] Implement frontend
// 3. [ ] Write tests
```

## API Reference

### Task Management

#### `createTask(options)`

Creates a new task from a function definition.

```typescript
const task = await createTask({
  function: FunctionDefinition,  // The function to execute
  input?: unknown,               // Input data for the function
  priority?: TaskPriority,       // 'low' | 'normal' | 'high' | 'urgent' | 'critical'
  allowedWorkers?: WorkerType[], // 'agent' | 'human' | 'team' | 'any'
  assignTo?: WorkerRef,          // Assign to a specific worker
  dependencies?: string[],       // Task IDs this task depends on
  scheduledFor?: Date,           // Schedule for later execution
  deadline?: Date,               // Task deadline
  timeout?: number,              // Timeout in milliseconds
  tags?: string[],               // Tags for organization
  parentId?: string,             // Parent task ID (for subtasks)
  projectId?: string,            // Project this task belongs to
  metadata?: Record<string, unknown>
})
```

#### `startTask(taskId, worker)`

Assigns a worker to a task and starts execution.

```typescript
const worker: WorkerRef = { type: 'agent', id: 'agent_1', name: 'Worker' }
const task = await startTask(taskId, worker)
```

#### `updateProgress(taskId, percent, step?)`

Updates the progress of a task.

```typescript
await updateProgress(taskId, 75, 'Finalizing output')
```

#### `completeTask(taskId, output)`

Marks a task as completed with the given output.

```typescript
const result = await completeTask(taskId, { summary: 'Task result' })
// result.success === true
// result.output contains the output
```

#### `failTask(taskId, error)`

Marks a task as failed with an error.

```typescript
const result = await failTask(taskId, 'Something went wrong')
// or
const result = await failTask(taskId, new Error('Something went wrong'))
```

#### `cancelTask(taskId, reason?)`

Cancels a task.

```typescript
const cancelled = await cancelTask(taskId, 'No longer needed')
```

#### `waitForTask(taskId, options?)`

Waits for a task to complete, fail, or be cancelled.

```typescript
const result = await waitForTask(taskId, {
  timeout: 60000,      // 60 seconds (default: 5 minutes)
  pollInterval: 1000   // Check every second (default: 1 second)
})
```

#### `addComment(taskId, comment, author?)`

Adds a comment to a task's event history.

```typescript
await addComment(taskId, 'This is looking good', { type: 'human', id: 'user_1' })
```

#### `createSubtask(parentTaskId, options)`

Creates a subtask of an existing task.

```typescript
const subtask = await createSubtask(parentTaskId, {
  function: { type: 'generative', name: 'subtask', args: {}, output: 'string' }
})
```

#### `getSubtasks(parentTaskId)`

Gets all subtasks of a parent task.

```typescript
const subtasks = await getSubtasks(parentTaskId)
```

### Task Queue

#### `taskQueue`

Global task queue instance.

```typescript
import { taskQueue } from 'digital-tasks'

// Query tasks
const tasks = await taskQueue.query({
  status: 'queued',
  priority: ['high', 'urgent'],
  tags: ['frontend'],
  sortBy: 'priority',
  sortOrder: 'desc'
})

// Get queue statistics
const stats = await taskQueue.stats()
// { total, byStatus, byPriority, avgWaitTime, avgCompletionTime }
```

#### `createTaskQueue(options?)`

Creates a new task queue instance.

```typescript
const queue = createTaskQueue({
  name: 'my-queue',
  concurrency: 10,
  defaultTimeout: 300000,  // 5 minutes
  persistent: false
})
```

### Project DSL

#### `task(title, options?)`

Creates a task definition for use in projects.

```typescript
const t = task('Implement feature', {
  description: 'Build the new dashboard widget',
  priority: 'high',
  functionType: 'agentic',  // 'code' | 'generative' | 'agentic' | 'human'
  assignTo: { type: 'agent', id: 'agent_1' },
  tags: ['feature', 'dashboard'],
  subtasks: [
    task('Write tests'),
    task('Update documentation')
  ]
})
```

#### `parallel(...tasks)`

Groups tasks that can run simultaneously.

```typescript
parallel(
  task('Design UI'),
  task('Write API specs'),
  task('Set up infrastructure'),
)
```

#### `sequential(...tasks)`

Groups tasks that must run in order.

```typescript
sequential(
  task('Implement backend'),
  task('Implement frontend'),
  task('Integration testing'),
)
```

#### `createProject(options)`

Creates a new project.

```typescript
const project = createProject({
  name: 'Feature Launch',
  description: 'Ship the new dashboard feature',
  tasks: [...],
  defaultMode: 'sequential',  // or 'parallel'
  owner: { type: 'human', id: 'user_1', name: 'John' },
  tags: ['q1', 'priority']
})
```

#### `workflow(name, description?)`

Fluent API for building projects.

```typescript
const project = workflow('Feature Launch')
  .parallel(
    task('Design'),
    task('Spec'),
  )
  .then(task('Implement'))
  .then(task('Test'))
  .parallel(
    task('Deploy staging'),
    task('Update docs'),
  )
  .then(task('Deploy production'))
  .build()
```

#### `materializeProject(project)`

Converts a project's task definitions into actual Task objects with dependencies.

```typescript
const { project, tasks } = await materializeProject(project)
// tasks is an array of Task objects ready for execution
```

### Dependency Graph Utilities

#### `getDependants(taskId, allTasks)`

Gets all tasks that depend on the given task.

```typescript
const dependants = getDependants('task_1', allTasks)
```

#### `getDependencies(task, allTasks)`

Gets all tasks that the given task depends on.

```typescript
const dependencies = getDependencies(task, allTasks)
```

#### `getReadyTasks(allTasks)`

Gets tasks that are ready to execute (no unsatisfied dependencies).

```typescript
const ready = getReadyTasks(allTasks)
```

#### `hasCycles(allTasks)`

Checks if the task dependency graph contains cycles.

```typescript
if (hasCycles(allTasks)) {
  console.error('Circular dependency detected!')
}
```

#### `sortTasks(allTasks)`

Sorts tasks in topological order (dependencies first).

```typescript
const sorted = sortTasks(allTasks)
```

### Markdown Integration

#### `parseMarkdown(markdown)`

Parses a markdown task list into a Project.

```typescript
const markdown = `
# My Project

## Planning (parallel)
- [ ] Design mockups
- [ ] Write technical spec
- [x] Create project board

## Implementation (sequential)
1. [ ] Implement backend API
2. [-] Implement frontend UI
   - [ ] Create components
   - [ ] Add state management
3. [ ] Write tests
`

const project = parseMarkdown(markdown)
```

**Markdown Syntax:**
- `- [ ]` - Unordered/parallel tasks
- `1. [ ]` - Ordered/sequential tasks
- `- [x]` - Completed task
- `- [-]` - In progress task
- `- [~]` - Blocked task
- `- [!]` - Failed task
- `- [/]` - Cancelled task
- `- [?]` - In review task
- Indentation (2 spaces) - Subtasks
- `# Heading` - Project name
- `## Heading` - Task group/section
- `## Section (parallel)` or `## Section (sequential)` - Explicit execution mode

**Priority markers in task titles:**
- `!!` - Critical priority
- `!` - Urgent priority
- `^` - High priority
- `v` - Low priority

#### `toMarkdown(project, options?)`

Serializes a Project to markdown.

```typescript
const markdown = toMarkdown(project, {
  includeStatus: true,    // Include status markers (default: true)
  includePriority: false, // Include priority markers (default: false)
  indentSize: 2,          // Indent size in spaces (default: 2)
  includeSections: true   // Include section headings (default: true)
})
```

#### `syncStatusFromMarkdown(project, markdown)`

Updates task statuses in a project from edited markdown.

```typescript
const updatedProject = syncStatusFromMarkdown(project, editedMarkdown)
```

## Types

### Task

```typescript
interface Task<TInput = unknown, TOutput = unknown> {
  id: string
  function: FunctionDefinition<TInput, TOutput>
  status: TaskStatus
  priority: TaskPriority
  input?: TInput
  output?: TOutput
  error?: string
  allowedWorkers?: WorkerType[]
  assignment?: TaskAssignment
  dependencies?: TaskDependency[]
  progress?: TaskProgress
  createdAt: Date
  scheduledFor?: Date
  deadline?: Date
  startedAt?: Date
  completedAt?: Date
  timeout?: number
  parentId?: string
  projectId?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  events?: TaskEvent[]
}
```

### TaskStatus

```typescript
type TaskStatus =
  | 'pending'      // Created but not started
  | 'queued'       // In queue waiting for worker
  | 'assigned'     // Assigned to a worker
  | 'in_progress'  // Being worked on
  | 'blocked'      // Waiting on dependency
  | 'review'       // Awaiting review
  | 'completed'    // Successfully finished
  | 'failed'       // Failed with error
  | 'cancelled'    // Cancelled
```

### TaskPriority

```typescript
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'
```

### WorkerRef

```typescript
interface WorkerRef {
  type: WorkerType  // 'agent' | 'human' | 'team' | 'any'
  id: string
  name?: string
  role?: string
}
```

### FunctionDefinition

Tasks wrap function definitions from `ai-functions`:

```typescript
// Code function - generates/executes code
interface CodeFunctionDefinition {
  type: 'code'
  name: string
  args: Record<string, unknown>
  output: string
  code: string
  language: string
}

// Generative function - AI generates content (no tools)
interface GenerativeFunctionDefinition {
  type: 'generative'
  name: string
  description?: string
  args: Record<string, unknown>
  output: string
}

// Agentic function - AI with tools in a loop
interface AgenticFunctionDefinition {
  type: 'agentic'
  name: string
  args: Record<string, unknown>
  output: string
  tools: unknown[]
}

// Human function - requires human input
interface HumanFunctionDefinition {
  type: 'human'
  name: string
  description?: string
  args: Record<string, unknown>
  output: string
  instructions: string
}
```

## Dependencies

- `ai-functions` - Function definition types and utilities
- `digital-tools` - Tool definitions for agentic functions
- `digital-workers` - Worker primitives

## License

MIT
