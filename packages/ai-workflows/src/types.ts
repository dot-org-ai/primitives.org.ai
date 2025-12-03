/**
 * Types for ai-workflows
 */

/**
 * Handler function with source code for remote execution
 */
export interface HandlerFunction<T = unknown> {
  /** The actual function */
  fn: (...args: any[]) => void | Promise<void>
  /** Source code string for remote execution */
  source: string
  /** Handler name (for debugging) */
  name?: string
}

/**
 * Event handler function type
 * Can return void (for send) or a result (for do/try)
 */
export type EventHandler<T = unknown, R = unknown> = (
  data: T,
  $: WorkflowContext
) => R | void | Promise<R | void>

/**
 * Schedule handler function type
 */
export type ScheduleHandler = (
  $: WorkflowContext
) => void | Promise<void>

/**
 * Workflow context ($) passed to handlers
 */
export interface WorkflowContext {
  /**
   * Send an event (fire and forget, durable)
   * Confirms receipt but doesn't wait for result
   */
  send: <T = unknown>(event: string, data: T) => Promise<void>

  /**
   * Do an action (durable, waits for result)
   * Retries on failure, stores result durably
   */
  do: <TData = unknown, TResult = unknown>(event: string, data: TData) => Promise<TResult>

  /**
   * Try an action (non-durable, waits for result)
   * Simple execution without durability guarantees
   */
  try: <TData = unknown, TResult = unknown>(event: string, data: TData) => Promise<TResult>

  /** Register event handler ($.on.Noun.event) */
  on: OnProxy

  /** Register schedule handler ($.every.hour, $.every.Monday.at9am) */
  every: EveryProxy

  /**
   * Workflow state - read/write context data
   * $.state.userId = '123'
   * const id = $.state.userId
   */
  state: Record<string, unknown>

  /** Log message */
  log: (message: string, data?: unknown) => void

  /** Access to database (if connected) */
  db?: DatabaseContext
}

/**
 * Database context for workflows
 */
export interface DatabaseContext {
  /** Record an event (immutable) */
  recordEvent: (event: string, data: unknown) => Promise<void>

  /** Create an action (pending work) */
  createAction: (action: ActionData) => Promise<void>

  /** Complete an action */
  completeAction: (id: string, result: unknown) => Promise<void>

  /** Store an artifact */
  storeArtifact: (artifact: ArtifactData) => Promise<void>

  /** Get an artifact */
  getArtifact: (key: string) => Promise<unknown | null>
}

/**
 * Action data for pending/active work
 */
export interface ActionData {
  /** Actor performing the action (user, agent, system) */
  actor: string
  /** Object being acted upon */
  object: string
  /** Action being performed */
  action: string
  /** Current status */
  status?: 'pending' | 'active' | 'completed' | 'failed'
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Artifact data for cached compiled/parsed content
 */
export interface ArtifactData {
  /** Unique key for the artifact */
  key: string
  /** Type of artifact (ast, types, esm, worker, html, markdown) */
  type: 'ast' | 'types' | 'esm' | 'worker' | 'html' | 'markdown' | 'bundle' | string
  /** Source hash (for cache invalidation) */
  sourceHash: string
  /** The artifact content */
  content: unknown
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Event proxy type for $.on.Noun.event pattern
 */
export type OnProxy = {
  [noun: string]: {
    [event: string]: (handler: EventHandler) => void
  }
}

/**
 * Every proxy type for $.every patterns
 */
export type EveryProxy = {
  (description: string, handler: ScheduleHandler): void
} & {
  [key: string]: ((handler: ScheduleHandler) => void) | ((value: number) => (handler: ScheduleHandler) => void) | {
    [timeKey: string]: (handler: ScheduleHandler) => void
  }
}

/**
 * Workflow state
 */
export interface WorkflowState {
  /** Current state name (for state machines) */
  current?: string
  /** Context data */
  context: Record<string, unknown>
  /** Execution history */
  history: WorkflowHistoryEntry[]
}

/**
 * History entry for workflow execution
 */
export interface WorkflowHistoryEntry {
  timestamp: number
  type: 'event' | 'schedule' | 'transition' | 'action'
  name: string
  data?: unknown
}

/**
 * Event registration with source
 */
export interface EventRegistration {
  noun: string
  event: string
  handler: EventHandler
  source: string
}

/**
 * Schedule registration with source
 */
export interface ScheduleRegistration {
  interval: ScheduleInterval
  handler: ScheduleHandler
  source: string
}

/**
 * Schedule intervals
 */
export type ScheduleInterval =
  | { type: 'second'; value?: number; natural?: string }
  | { type: 'minute'; value?: number; natural?: string }
  | { type: 'hour'; value?: number; natural?: string }
  | { type: 'day'; value?: number; natural?: string }
  | { type: 'week'; value?: number; natural?: string }
  | { type: 'cron'; expression: string; natural?: string }
  | { type: 'natural'; description: string }

/**
 * Workflow definition
 */
export interface WorkflowDefinition {
  name: string
  events: EventRegistration[]
  schedules: ScheduleRegistration[]
  initialContext?: Record<string, unknown>
}

/**
 * Parsed event name (Noun.event format)
 */
export interface ParsedEvent {
  noun: string
  event: string
}

/**
 * Workflow options
 */
export interface WorkflowOptions {
  /** Initial context data */
  context?: Record<string, unknown>
  /** Database connection for persistence */
  db?: DatabaseContext
}
