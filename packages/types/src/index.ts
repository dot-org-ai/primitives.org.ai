// @primitives/types - Shared type definitions for AI primitives packages

// Runtime markers (for testing that exports exist)
export const AIFunction = Symbol('AIFunction')
export const EventHandler = Symbol('EventHandler')
export const WorkflowContext = Symbol('WorkflowContext')
export const RelationshipOperator = Symbol('RelationshipOperator')
export const ParsedField = Symbol('ParsedField')

// Actual types (compile-time only)

/**
 * Generic AI function type
 * @template TOutput - The output type of the function
 * @template TInput - The input type (defaults to unknown)
 * @template TConfig - Optional configuration type (defaults to unknown)
 */
export type AIFunctionType<TOutput, TInput = unknown, TConfig = unknown> = {
  (input: TInput, config?: TConfig): Promise<TOutput>
}

/**
 * Event handler type for workflow events
 * @template TOutput - The return type of the handler (defaults to unknown)
 * @template TInput - The event data type (defaults to unknown)
 */
export type EventHandlerType<TOutput = unknown, TInput = unknown> = (
  data: TInput,
  ctx: WorkflowContextType
) => TOutput | void | Promise<TOutput | void>

/**
 * Workflow execution context interface
 * Provides methods for event handling, scheduling, and state management.
 * This is a base interface that packages can extend with more specific types.
 */
export interface WorkflowContextType {
  /** Fire-and-forget event dispatch (non-blocking, non-durable) */
  send: <T = unknown>(event: string, data: T) => Promise<void>
  /** Quick attempt at an action (non-durable, may be sync or async) */
  try: <TResult = unknown, TInput = unknown>(event: string, data: TInput) => TResult | Promise<TResult>
  /** Durable execution with retries (blocking, durable) */
  do: <TResult = unknown, TInput = unknown>(event: string, data: TInput) => Promise<TResult>
  /** Event handler registry - $.on.Noun.verb(handler) */
  on: Record<string, Record<string, (handler: EventHandlerType) => void>>
  /** Scheduling registry - $.every.monday.at('9am')(handler) */
  every: Record<string, unknown>
  /** State storage */
  state: Record<string, unknown>
  /** Set a value in state */
  set: <T>(key: string, value: T) => void
  /** Get a value from state */
  get: <T>(key: string) => T | undefined
}

/**
 * Relationship operators for defining relationships between types
 * - '->' : Direct relationship (has one)
 * - '~>' : Fuzzy/semantic relationship
 * - '<-' : Inverse relationship (belongs to)
 * - '<~' : Inverse fuzzy relationship
 */
export type RelationshipOperatorType = '->' | '~>' | '<-' | '<~'

/**
 * Base parsed field interface for schema field definitions.
 * Provides common fields shared across packages.
 * Packages can extend this with additional fields as needed.
 */
export interface ParsedFieldType {
  /** Field name */
  name: string
  /** Field type (string, number, etc.) */
  type: string
  /** Whether the field is required (inverse of isOptional) */
  required?: boolean
  /** Whether the field is optional (inverse of required) */
  isOptional?: boolean
  /** Whether the field is an array */
  isArray?: boolean
  /** Optional description of the field */
  description?: string
  /** Relationship operator if this is a relationship field */
  operator?: RelationshipOperatorType
  /** Related type name for relationship fields */
  relatedType?: string
  /** Threshold for fuzzy relationships */
  threshold?: number
  /** Union types if this is a union field */
  unionTypes?: string[]
  /** Back-reference field name for inverse relationships */
  backref?: string
}
