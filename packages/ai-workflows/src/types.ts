/**
 * Types for ai-workflows
 */

import type { WorkflowContextType } from '@org.ai/types'

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
 *
 * Generic order follows Promise<T> convention:
 * - TOutput (first) is what the handler returns
 * - TInput (second) is what the handler receives
 *
 * Note: Uses WorkflowContext (extends WorkflowContextType from @org.ai/types)
 * for workflow-specific features like OnProxy, EveryProxy, getState, log.
 */
export type EventHandler<TOutput = unknown, TInput = unknown> = (
  data: TInput,
  $: WorkflowContext
) => TOutput | void | Promise<TOutput | void>

/**
 * Schedule handler function type
 */
export type ScheduleHandler = (
  $: WorkflowContext
) => void | Promise<void>

/**
 * Workflow context ($) passed to handlers.
 * Extends WorkflowContextType from @org.ai/types with workflow-specific features.
 */
export interface WorkflowContext extends WorkflowContextType {
  /**
   * Track an event (fire and forget)
   * Best effort, no confirmation, swallows errors
   * Use for telemetry and non-critical events
   */
  track: (event: string, data: unknown) => void

  /**
   * Send an event (durable)
   * Guaranteed delivery, returns trackable EventId
   */
  send: <T = unknown>(event: string, data: T) => string

  /**
   * Do an action (durable, waits for result)
   * Retries on failure, stores result durably
   *
   * Generic order follows Promise<T> convention:
   * - TResult (first) is what the action returns
   * - TInput (second) is what data is passed to the action
   */
  do: <TResult = unknown, TInput = unknown>(event: string, data: TInput) => Promise<TResult>

  /**
   * Try an action (non-durable, waits for result)
   * Simple execution without durability guarantees
   *
   * Generic order follows Promise<T> convention:
   * - TResult (first) is what the action returns
   * - TInput (second) is what data is passed to the action
   */
  try: <TResult = unknown, TInput = unknown>(event: string, data: TInput) => Promise<TResult>

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

  /**
   * Get the full workflow state (context + history)
   * Returns a copy to prevent mutation
   */
  getState: () => WorkflowState

  /**
   * Set a value in the context
   * Alternative to $.state.key = value
   */
  set: <T = unknown>(key: string, value: T) => void

  /**
   * Get a value from the context
   * Alternative to $.state.key
   */
  get: <T = unknown>(key: string) => T | undefined

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
 * Event handler proxy for a specific noun
 * Allows $.on.Noun.event(handler) pattern
 */
export type NounEventProxy = {
  [event: string]: (handler: EventHandler) => void
}

/**
 * Event proxy type for $.on.Noun.event pattern
 *
 * Includes explicit known nouns for IDE autocomplete while
 * preserving index signature for dynamic noun access.
 */
export type OnProxy = {
  // Known nouns (for autocomplete)
  Customer: NounEventProxy
  Order: NounEventProxy
  Payment: NounEventProxy
  User: NounEventProxy
  Email: NounEventProxy
  Invoice: NounEventProxy
  Product: NounEventProxy
  Subscription: NounEventProxy
  // Index signature for dynamic nouns
  [noun: string]: NounEventProxy
}

/**
 * Schedule handler with optional time modifiers
 * Allows $.every.Monday.at9am(handler) pattern
 */
export type DayScheduleProxy = ((handler: ScheduleHandler) => void) & {
  at6am: (handler: ScheduleHandler) => void
  at7am: (handler: ScheduleHandler) => void
  at8am: (handler: ScheduleHandler) => void
  at9am: (handler: ScheduleHandler) => void
  at10am: (handler: ScheduleHandler) => void
  at11am: (handler: ScheduleHandler) => void
  at12pm: (handler: ScheduleHandler) => void
  atnoon: (handler: ScheduleHandler) => void
  at1pm: (handler: ScheduleHandler) => void
  at2pm: (handler: ScheduleHandler) => void
  at3pm: (handler: ScheduleHandler) => void
  at4pm: (handler: ScheduleHandler) => void
  at5pm: (handler: ScheduleHandler) => void
  at6pm: (handler: ScheduleHandler) => void
  atmidnight: (handler: ScheduleHandler) => void
  [timeKey: string]: (handler: ScheduleHandler) => void
}

/**
 * Every proxy type for $.every patterns
 *
 * Includes explicit known schedule patterns for IDE autocomplete while
 * preserving index signature for dynamic patterns.
 */
export type EveryProxy = {
  // Callable for natural language schedules
  (description: string, handler: ScheduleHandler): void
} & {
  // Known time units (for autocomplete)
  second: (handler: ScheduleHandler) => void
  minute: (handler: ScheduleHandler) => void
  hour: (handler: ScheduleHandler) => void
  day: (handler: ScheduleHandler) => void
  week: (handler: ScheduleHandler) => void
  month: (handler: ScheduleHandler) => void
  year: (handler: ScheduleHandler) => void

  // Known days of week with time modifiers
  Monday: DayScheduleProxy
  Tuesday: DayScheduleProxy
  Wednesday: DayScheduleProxy
  Thursday: DayScheduleProxy
  Friday: DayScheduleProxy
  Saturday: DayScheduleProxy
  Sunday: DayScheduleProxy
  weekday: DayScheduleProxy
  weekend: DayScheduleProxy
  midnight: (handler: ScheduleHandler) => void
  noon: (handler: ScheduleHandler) => void

  // Plural forms for specifying intervals
  seconds: (value: number) => (handler: ScheduleHandler) => void
  minutes: (value: number) => (handler: ScheduleHandler) => void
  hours: (value: number) => (handler: ScheduleHandler) => void
  days: (value: number) => (handler: ScheduleHandler) => void
  weeks: (value: number) => (handler: ScheduleHandler) => void

  // Index signature for dynamic patterns
  [key: string]: ((handler: ScheduleHandler) => void) | ((value: number) => (handler: ScheduleHandler) => void) | DayScheduleProxy
}

/**
 * Callable target type for EveryProxy
 * Used as a properly-typed Proxy target that supports both call and property access
 */
export type EveryProxyTarget = {
  (description: string, handler: ScheduleHandler): void
}

/**
 * ProxyHandler type for OnProxy
 * Provides proper typing for the two-level noun.event proxy pattern
 */
export interface OnProxyHandler extends ProxyHandler<Record<string, NounEventProxy>> {
  get(target: Record<string, NounEventProxy>, noun: string, receiver: unknown): NounEventProxy
}

/**
 * ProxyHandler type for the inner noun level (event accessors)
 */
export interface NounEventProxyHandler extends ProxyHandler<Record<string, (handler: EventHandler, dependencies?: DependencyConfig) => void>> {
  get(
    target: Record<string, (handler: EventHandler, dependencies?: DependencyConfig) => void>,
    event: string,
    receiver: unknown
  ): (handler: EventHandler, dependencies?: DependencyConfig) => void
}

/**
 * ProxyHandler type for EveryProxy
 * Handles both function calls and property access for schedule patterns
 */
export interface EveryProxyHandler extends ProxyHandler<EveryProxyTarget> {
  get(target: EveryProxyTarget, prop: string, receiver: unknown): unknown
  apply(target: EveryProxyTarget, thisArg: unknown, args: [string, ScheduleHandler]): void
}

/**
 * ProxyHandler type for day schedule patterns with time modifiers
 * Handles $.every.Monday.at9am pattern
 */
export interface DayScheduleProxyHandler extends ProxyHandler<(handler: ScheduleHandler) => void> {
  get(
    target: (handler: ScheduleHandler) => void,
    timeKey: string,
    receiver: unknown
  ): ((handler: ScheduleHandler) => void) | undefined
  apply(
    target: (handler: ScheduleHandler) => void,
    thisArg: unknown,
    args: [ScheduleHandler]
  ): void
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
 * Dependency type: hard (must succeed) or soft (can proceed on failure)
 */
export type DependencyType = 'hard' | 'soft'

/**
 * Configuration for step dependencies
 */
export interface DependencyConfig {
  /**
   * Step(s) that must complete before this step runs
   * Can be a single step ID or array of step IDs
   * Format: 'Noun.event' (e.g., 'Step1.complete')
   */
  dependsOn: string | string[]

  /**
   * Type of dependency (default: 'hard')
   * - 'hard': Dependency must complete successfully
   * - 'soft': Step can proceed even if dependency fails
   */
  type?: DependencyType
}

/**
 * Event registration with source
 */
export interface EventRegistration {
  noun: string
  event: string
  handler: EventHandler
  source: string
  /** Optional dependency configuration for workflow step ordering */
  dependencies?: DependencyConfig
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
 * Time-based interval types (singular form)
 * Used as discriminant values in ScheduleInterval
 */
export type TimeIntervalType = 'second' | 'minute' | 'hour' | 'day' | 'week'

/**
 * Mapping from plural unit names to their singular interval types
 * Used for type-safe conversion in every.units(value) patterns
 */
export type PluralUnitMapping = {
  seconds: 'second'
  minutes: 'minute'
  hours: 'hour'
  days: 'day'
  weeks: 'week'
}

/**
 * Plural unit keys
 */
export type PluralUnitKey = keyof PluralUnitMapping

/**
 * Type guard to check if a string is a valid plural unit key
 */
export function isPluralUnitKey(key: string): key is PluralUnitKey {
  return key === 'seconds' || key === 'minutes' || key === 'hours' || key === 'days' || key === 'weeks'
}

/**
 * Constant mapping object with strict typing
 * Maps plural forms to their singular interval type values
 */
export const PLURAL_UNITS: Readonly<PluralUnitMapping> = {
  seconds: 'second',
  minutes: 'minute',
  hours: 'hour',
  days: 'day',
  weeks: 'week',
} as const

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
