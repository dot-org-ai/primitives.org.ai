/**
 * Project Management - Task workflows, dependencies, and execution modes
 *
 * Provides project management primitives for organizing tasks:
 * - Projects/TaskLists as containers
 * - Parallel vs Sequential execution
 * - Dependencies and dependants (bidirectional)
 * - Subtasks with inheritance
 *
 * ## Execution Modes
 *
 * Tasks can be organized for parallel or sequential execution:
 *
 * ```ts
 * // Parallel - all can run simultaneously
 * parallel(
 *   task('Design UI'),
 *   task('Write API specs'),
 *   task('Set up infrastructure'),
 * )
 *
 * // Sequential - must run in order
 * sequential(
 *   task('Implement backend'),
 *   task('Implement frontend'),
 *   task('Integration testing'),
 * )
 * ```
 *
 * ## Markdown Syntax
 *
 * Tasks map to markdown checklists:
 * - `- [ ]` = Parallel/unordered tasks
 * - `1. [ ]` = Sequential/ordered tasks
 *
 * @packageDocumentation
 */

import type {
  Task,
  AnyTask,
  TaskStatus,
  TaskPriority,
  WorkerRef,
  CreateTaskOptions,
  FunctionDefinition,
} from './types.js'
import { createTask as createBaseTask } from './task.js'

// ============================================================================
// Execution Mode Types
// ============================================================================

/**
 * How tasks should be executed relative to each other
 */
export type ExecutionMode = 'parallel' | 'sequential'

/**
 * Task node in a workflow - can be a single task or a group
 */
export type TaskNode =
  | TaskDefinition
  | ParallelGroup
  | SequentialGroup

/**
 * Function type for the DSL
 */
export type FunctionType = 'code' | 'generative' | 'agentic' | 'human'

/**
 * A single task definition
 */
export interface TaskDefinition {
  __type: 'task'
  title: string
  description?: string
  functionType?: FunctionType
  priority?: TaskPriority
  assignTo?: WorkerRef
  tags?: string[]
  subtasks?: TaskNode[]
  metadata?: Record<string, unknown>
}

/**
 * A group of tasks that can run in parallel
 */
export interface ParallelGroup {
  __type: 'parallel'
  tasks: TaskNode[]
}

/**
 * A group of tasks that must run sequentially
 */
export interface SequentialGroup {
  __type: 'sequential'
  tasks: TaskNode[]
}

// ============================================================================
// Project Types
// ============================================================================

/**
 * Project status
 */
export type ProjectStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'

/**
 * Project definition
 */
export interface Project {
  /** Unique project ID */
  id: string
  /** Project name */
  name: string
  /** Project description */
  description?: string
  /** Project status */
  status: ProjectStatus
  /** Root task nodes */
  tasks: TaskNode[]
  /** Default execution mode for top-level tasks */
  defaultMode?: ExecutionMode
  /** Project owner */
  owner?: WorkerRef
  /** Project tags */
  tags?: string[]
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt: Date
  /** Project metadata */
  metadata?: Record<string, unknown>
}

/**
 * Options for creating a project
 */
export interface CreateProjectOptions {
  name: string
  description?: string
  tasks?: TaskNode[]
  defaultMode?: ExecutionMode
  owner?: WorkerRef
  tags?: string[]
  metadata?: Record<string, unknown>
}

// ============================================================================
// Task DSL Functions
// ============================================================================

/**
 * Create a task definition
 *
 * @example
 * ```ts
 * task('Implement feature')
 * task('Review PR', { priority: 'high', assignTo: { type: 'human', id: 'user_123' } })
 * task('Parent task', {
 *   subtasks: [
 *     task('Subtask 1'),
 *     task('Subtask 2'),
 *   ]
 * })
 * ```
 */
export function task(
  title: string,
  options?: Partial<Omit<TaskDefinition, '__type' | 'title'>>
): TaskDefinition {
  return {
    __type: 'task',
    title,
    ...options,
  }
}

/**
 * Create a group of tasks that can run in parallel
 *
 * @example
 * ```ts
 * parallel(
 *   task('Design UI'),
 *   task('Write API specs'),
 *   task('Set up infrastructure'),
 * )
 * ```
 */
export function parallel(...tasks: TaskNode[]): ParallelGroup {
  return {
    __type: 'parallel',
    tasks,
  }
}

/**
 * Create a group of tasks that must run sequentially
 *
 * @example
 * ```ts
 * sequential(
 *   task('Implement backend'),
 *   task('Implement frontend'),
 *   task('Integration testing'),
 * )
 * ```
 */
export function sequential(...tasks: TaskNode[]): SequentialGroup {
  return {
    __type: 'sequential',
    tasks,
  }
}

// ============================================================================
// Project DSL Functions
// ============================================================================

/**
 * Generate a unique project ID
 */
function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Create a new project
 *
 * @example
 * ```ts
 * const project = createProject({
 *   name: 'Launch New Feature',
 *   description: 'Ship the new dashboard feature',
 *   tasks: [
 *     parallel(
 *       task('Design mockups'),
 *       task('Write technical spec'),
 *     ),
 *     sequential(
 *       task('Implement backend API'),
 *       task('Implement frontend UI'),
 *       task('Write tests'),
 *       task('Deploy to staging'),
 *     ),
 *     task('QA testing'),
 *     task('Deploy to production'),
 *   ],
 * })
 * ```
 */
export function createProject(options: CreateProjectOptions): Project {
  const now = new Date()
  return {
    id: generateProjectId(),
    name: options.name,
    description: options.description,
    status: 'draft',
    tasks: options.tasks || [],
    defaultMode: options.defaultMode || 'sequential',
    owner: options.owner,
    tags: options.tags,
    createdAt: now,
    updatedAt: now,
    metadata: options.metadata,
  }
}

// ============================================================================
// Workflow Builder (Fluent API)
// ============================================================================

/**
 * Workflow builder for fluent task definition
 *
 * @example
 * ```ts
 * const workflow = workflow('Feature Launch')
 *   .parallel(
 *     task('Design'),
 *     task('Spec'),
 *   )
 *   .then(task('Implement'))
 *   .then(task('Test'))
 *   .parallel(
 *     task('Deploy staging'),
 *     task('Update docs'),
 *   )
 *   .then(task('Deploy production'))
 *   .build()
 * ```
 */
export function workflow(name: string, description?: string) {
  const tasks: TaskNode[] = []

  const builder = {
    /**
     * Add tasks that can run in parallel
     */
    parallel(...nodes: TaskNode[]) {
      tasks.push(parallel(...nodes))
      return builder
    },

    /**
     * Add tasks that must run sequentially
     */
    sequential(...nodes: TaskNode[]) {
      tasks.push(sequential(...nodes))
      return builder
    },

    /**
     * Add a single task (sequential with previous)
     */
    then(...nodes: TaskNode[]) {
      if (nodes.length === 1) {
        tasks.push(nodes[0])
      } else {
        tasks.push(sequential(...nodes))
      }
      return builder
    },

    /**
     * Add a task (alias for then)
     */
    task(title: string, options?: Partial<Omit<TaskDefinition, '__type' | 'title'>>) {
      tasks.push(task(title, options))
      return builder
    },

    /**
     * Build the project
     */
    build(options?: Partial<Omit<CreateProjectOptions, 'name' | 'tasks'>>): Project {
      return createProject({
        name,
        description,
        tasks,
        ...options,
      })
    },
  }

  return builder
}

// ============================================================================
// Task Materialization
// ============================================================================

/**
 * Flatten task nodes into actual Task objects with dependencies
 */
export async function materializeProject(
  project: Project
): Promise<{ project: Project; tasks: AnyTask[] }> {
  const tasks: AnyTask[] = []
  let taskIndex = 0

  async function processNode(
    node: TaskNode,
    parentId?: string,
    previousIds: string[] = [],
    mode: ExecutionMode = 'sequential'
  ): Promise<string[]> {
    if (node.__type === 'task') {
      const taskDef = node as TaskDefinition
      const taskId = `${project.id}_task_${taskIndex++}`

      // Create dependencies based on mode (as string array for CreateTaskOptions)
      const dependencies = mode === 'sequential' && previousIds.length > 0
        ? previousIds
        : undefined

      // Create a FunctionDefinition from the task definition
      // Default to generative function type for DSL tasks
      const functionDef = {
        type: taskDef.functionType || 'generative',
        name: taskDef.title,
        description: taskDef.description,
        args: {},
        output: 'string',
      } as FunctionDefinition

      const newTask = await createBaseTask({
        function: functionDef,
        priority: taskDef.priority || 'normal',
        assignTo: taskDef.assignTo,
        tags: taskDef.tags,
        parentId,
        projectId: project.id,
        dependencies,
        metadata: {
          ...taskDef.metadata,
          _taskNodeIndex: taskIndex - 1,
        },
      })

      // Override the generated ID with our predictable one
      ;(newTask as AnyTask).id = taskId
      tasks.push(newTask as AnyTask)

      // Process subtasks
      if (taskDef.subtasks && taskDef.subtasks.length > 0) {
        let subtaskPrevIds: string[] = []
        for (const subtask of taskDef.subtasks) {
          subtaskPrevIds = await processNode(subtask, taskId, subtaskPrevIds, 'sequential')
        }
      }

      return [taskId]
    }

    if (node.__type === 'parallel') {
      const group = node as ParallelGroup
      const allIds: string[] = []

      // All tasks in parallel group can start simultaneously
      // They don't depend on each other, only on previousIds
      for (const child of group.tasks) {
        const childIds = await processNode(child, parentId, previousIds, 'parallel')
        allIds.push(...childIds)
      }

      return allIds
    }

    if (node.__type === 'sequential') {
      const group = node as SequentialGroup
      let currentPrevIds = previousIds

      // Each task depends on the previous one
      for (const child of group.tasks) {
        currentPrevIds = await processNode(child, parentId, currentPrevIds, 'sequential')
      }

      return currentPrevIds
    }

    return []
  }

  // Process all root-level tasks
  let previousIds: string[] = []
  for (const node of project.tasks) {
    previousIds = await processNode(node, undefined, previousIds, project.defaultMode || 'sequential')
  }

  return { project, tasks }
}

// ============================================================================
// Dependency Graph Utilities
// ============================================================================

/**
 * Get all tasks that depend on a given task (dependants)
 */
export function getDependants(taskId: string, allTasks: AnyTask[]): AnyTask[] {
  return allTasks.filter(t =>
    t.dependencies?.some(d => d.taskId === taskId && d.type === 'blocked_by')
  )
}

/**
 * Get all tasks that a given task depends on (dependencies)
 */
export function getDependencies(task: AnyTask, allTasks: AnyTask[]): AnyTask[] {
  if (!task.dependencies) return []

  const depIds = task.dependencies
    .filter(d => d.type === 'blocked_by')
    .map(d => d.taskId)

  return allTasks.filter(t => depIds.includes(t.id))
}

/**
 * Get tasks that are ready to execute (no unsatisfied dependencies)
 */
export function getReadyTasks(allTasks: AnyTask[]): AnyTask[] {
  return allTasks.filter(t => {
    if (t.status !== 'queued' && t.status !== 'pending') return false

    if (!t.dependencies || t.dependencies.length === 0) return true

    return t.dependencies
      .filter(d => d.type === 'blocked_by')
      .every(d => d.satisfied)
  })
}

/**
 * Check if a task graph has cycles
 */
export function hasCycles(allTasks: AnyTask[]): boolean {
  const visited = new Set<string>()
  const recStack = new Set<string>()

  function dfs(taskId: string): boolean {
    visited.add(taskId)
    recStack.add(taskId)

    const task = allTasks.find(t => t.id === taskId)
    if (task?.dependencies) {
      for (const dep of task.dependencies) {
        if (dep.type === 'blocked_by') {
          if (!visited.has(dep.taskId)) {
            if (dfs(dep.taskId)) return true
          } else if (recStack.has(dep.taskId)) {
            return true
          }
        }
      }
    }

    recStack.delete(taskId)
    return false
  }

  for (const task of allTasks) {
    if (!visited.has(task.id)) {
      if (dfs(task.id)) return true
    }
  }

  return false
}

/**
 * Sort tasks by their dependencies (tasks with no dependencies first)
 */
export function sortTasks(allTasks: AnyTask[]): AnyTask[] {
  const result: AnyTask[] = []
  const visited = new Set<string>()

  function visit(task: AnyTask) {
    if (visited.has(task.id)) return
    visited.add(task.id)

    // Visit dependencies first
    if (task.dependencies) {
      for (const dep of task.dependencies) {
        if (dep.type === 'blocked_by') {
          const depTask = allTasks.find(t => t.id === dep.taskId)
          if (depTask) visit(depTask)
        }
      }
    }

    result.push(task)
  }

  for (const task of allTasks) {
    visit(task)
  }

  return result
}
