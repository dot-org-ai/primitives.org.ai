/**
 * Types for ai-workflows
 */

import type { AnyActorLogic, AnyEventObject, Snapshot } from 'xstate'

/**
 * Event handler function type
 */
export type EventHandler<T = unknown> = (
  data: T,
  context: WorkflowContext
) => void | Promise<void>

/**
 * Schedule handler function type
 */
export type ScheduleHandler = (
  context: WorkflowContext
) => void | Promise<void>

/**
 * Workflow context passed to handlers
 */
export interface WorkflowContext {
  /** Emit an event */
  send: <T = unknown>(event: string, data: T) => Promise<void>
  /** Get workflow state */
  getState: () => WorkflowState
  /** Store data in workflow context */
  set: (key: string, value: unknown) => void
  /** Get data from workflow context */
  get: <T = unknown>(key: string) => T | undefined
  /** Log message */
  log: (message: string, data?: unknown) => void
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
 * Event registration
 */
export interface EventRegistration {
  noun: string
  event: string
  handler: EventHandler
}

/**
 * Schedule registration
 */
export interface ScheduleRegistration {
  interval: ScheduleInterval
  handler: ScheduleHandler
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
  machine?: AnyActorLogic
  initialContext?: Record<string, unknown>
}

/**
 * Workflow runner options
 */
export interface WorkflowRunnerOptions {
  /** Persist state to storage */
  storage?: WorkflowStorage
  /** Logger */
  logger?: WorkflowLogger
}

/**
 * Workflow storage interface
 */
export interface WorkflowStorage {
  get(workflowId: string): Promise<WorkflowState | null>
  set(workflowId: string, state: WorkflowState): Promise<void>
  delete(workflowId: string): Promise<void>
}

/**
 * Workflow logger interface
 */
export interface WorkflowLogger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

/**
 * Parsed event name (Noun.event format)
 */
export interface ParsedEvent {
  noun: string
  event: string
}
