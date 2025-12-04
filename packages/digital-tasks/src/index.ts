/**
 * digital-tasks - Task management primitives for digital workers
 *
 * Task = Function + metadata (status, progress, assignment, dependencies)
 *
 * Every task wraps a function (code, generative, agentic, or human)
 * with lifecycle management, worker assignment, and dependency tracking.
 *
 * ## Quick Start
 *
 * ```ts
 * import { Task, createTask, taskQueue } from 'digital-tasks'
 *
 * // Create a task from a function
 * const task = await createTask({
 *   function: {
 *     type: 'generative',
 *     name: 'summarize',
 *     args: { text: 'The text to summarize' },
 *     output: 'string',
 *     promptTemplate: 'Summarize: {{text}}',
 *   },
 *   input: { text: 'Long article...' },
 *   priority: 'high',
 * })
 *
 * // Start and complete
 * await startTask(task.id, { type: 'agent', id: 'agent_1' })
 * await completeTask(task.id, 'Summary of the article...')
 * ```
 *
 * ## Projects with Parallel/Sequential Tasks
 *
 * ```ts
 * import { createProject, task, parallel, sequential, toMarkdown } from 'digital-tasks'
 *
 * const project = createProject({
 *   name: 'Launch Feature',
 *   tasks: [
 *     parallel(
 *       task('Design mockups'),
 *       task('Write tech spec'),
 *     ),
 *     sequential(
 *       task('Implement backend'),
 *       task('Implement frontend'),
 *       task('Write tests'),
 *     ),
 *   ],
 * })
 *
 * // Convert to markdown
 * const md = toMarkdown(project)
 * // # Launch Feature
 * // - [ ] Design mockups
 * // - [ ] Write tech spec
 * // 1. [ ] Implement backend
 * // 2. [ ] Implement frontend
 * // 3. [ ] Write tests
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Types
// ============================================================================

export type * from './types.js'

export type {
  Task,
  AnyTask,
  TaskStatus,
  TaskPriority,
  TaskQueue,
  TaskQueueOptions,
  TaskResult,
  WorkerRef,
  WorkerType,
  TaskDependency,
  DependencyType,
  TaskProgress,
  TaskEvent,
  CreateTaskOptions,
  UpdateTaskOptions,
  TaskQuery,
  TaskQueueStats,
  // Function types (re-exported from ai-functions)
  FunctionDefinition,
  CodeFunctionDefinition,
  GenerativeFunctionDefinition,
  AgenticFunctionDefinition,
  HumanFunctionDefinition,
} from './types.js'

// ============================================================================
// Task Queue
// ============================================================================

export { taskQueue, createTaskQueue } from './queue.js'

// ============================================================================
// Task Management
// ============================================================================

export {
  createTask,
  getTask,
  startTask,
  updateProgress,
  completeTask,
  failTask,
  cancelTask,
  addComment,
  createSubtask,
  getSubtasks,
  waitForTask,
} from './task.js'

// ============================================================================
// Project & Workflow DSL
// ============================================================================

export type {
  ExecutionMode,
  FunctionType,
  TaskNode,
  TaskDefinition,
  ParallelGroup,
  SequentialGroup,
  Project,
  ProjectStatus,
  CreateProjectOptions,
} from './project.js'

export {
  task,
  parallel,
  sequential,
  createProject,
  workflow,
  materializeProject,
  getDependants,
  getDependencies,
  getReadyTasks,
  hasCycles,
  sortTasks,
} from './project.js'

// ============================================================================
// Markdown Integration
// ============================================================================

export type { SerializeOptions } from './markdown.js'

export {
  parseMarkdown,
  toMarkdown,
  syncStatusFromMarkdown,
} from './markdown.js'
