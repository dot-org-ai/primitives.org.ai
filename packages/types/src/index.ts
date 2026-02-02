// @org.ai/types - Shared type definitions for AI primitives packages

// Runtime markers (for testing that exports exist)
export const AIFunction = Symbol('AIFunction')
export const EventHandler = Symbol('EventHandler')
export const WorkflowContext = Symbol('WorkflowContext')
export const RelationshipOperator = Symbol('RelationshipOperator')
export const ParsedField = Symbol('ParsedField')
export const Thing = Symbol('Thing')
export const ThingsMarker = Symbol('Things')
export const ListOptionsMarker = Symbol('ListOptions')
export const ListResultMarker = Symbol('ListResult')

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
 *
 * Execution semantics:
 *
 *               |  Fire & Forget  |   Durable
 * --------------|-----------------|---------------
 *    Event      |  track() -> void|  send() -> EventId
 * --------------|-----------------|---------------
 *    Action     |  try() -> T     |  do() -> T
 */
export interface WorkflowContextType {
  /**
   * Track an event (fire and forget)
   * Best effort, no confirmation, swallows errors silently
   * Use for telemetry, analytics, non-critical logging
   */
  track: (event: string, data: unknown) => void

  /**
   * Send an event (durable)
   * Guaranteed delivery with retries, returns trackable EventId
   * Use for important domain events that must not be lost
   */
  send: <T = unknown>(event: string, data: T) => string // Returns EventId

  /**
   * Try an action (fire and forget)
   * Single attempt, use .catch() for error handling
   * No retries, no persistence
   */
  try: <TResult = unknown, TInput = unknown>(action: string, data: TInput) => Promise<TResult>

  /**
   * Do an action (durable)
   * Retries on failure, guaranteed completion
   * Stores result durably, can await receipt confirmation
   */
  do: <TResult = unknown, TInput = unknown>(action: string, data: TInput) => Promise<TResult>

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

// ============================================================================
// Thing Types (do-jth)
// ============================================================================

/**
 * Base entity with URL-based identity
 *
 * Thing is the foundational type for all entities in the schema.org.ai ecosystem.
 * It provides URL-based identity and supports JSON-LD semantics.
 *
 * @see https://schema.org.ai/Thing
 */
export interface Thing {
  /** Fully qualified URL (unique identity) */
  $id: string
  /** Noun URL (schema reference) - indicates the type of this entity */
  $type: string
  /** Schema URL (JSON-LD @context) - optional reference to schema definition */
  $schema?: string
  /** Optional human-readable name */
  name?: string
  /** Arbitrary data payload */
  data?: Record<string, unknown>
  /** Visibility level */
  visibility?: 'public' | 'unlisted' | 'org' | 'user'
  /** Outbound relationships */
  relationships?: Record<string, Thing | Thing[]>
  /** Inbound references */
  references?: Record<string, Thing | Thing[]>
  /** Timestamps */
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date
}

/**
 * Thing that IS a Durable Object namespace
 */
export interface ThingDO extends Thing {
  /** Marker that this Thing is a DO */
  isDO: true
  /** Git integration */
  $git?: {
    repo?: string
    branch?: string
    commit?: string
    syncMode?: 'push' | 'pull' | 'sync'
  }
  /** Parent DO */
  $parent?: ThingDO
  /** Child DOs */
  $children?: ThingDO[]
}

// ============================================================================
// Noun and Verb Types (do-xe4)
// ============================================================================

/**
 * Type/schema registry entry
 */
export interface Noun {
  /** Type name, e.g. 'Customer' */
  noun: string
  /** Plural form, e.g. 'Customers' */
  plural?: string
  /** Schema definition */
  schema?: Record<string, string | ParsedFieldType>
  /** Cloudflare DO class binding name */
  doClass?: string
  /** Description */
  description?: string
}

/**
 * Action/event predicate
 */
export interface Verb {
  /** Base verb form, e.g. 'create' */
  verb: string
  /** Gerund form, e.g. 'creating' */
  activity?: string
  /** Past participle, e.g. 'created' */
  event?: string
  /** Opposite verb, e.g. 'delete' */
  inverse?: string
  /** Description */
  description?: string
}

/** Standard verbs for common operations */
export const StandardVerbs = [
  'create',
  'update',
  'delete',
  'get',
  'list',
  'find',
  'assign',
  'unassign',
  'publish',
  'unpublish',
  'archive',
  'restore',
  'approve',
  'reject',
  'start',
  'stop',
  'complete',
  'cancel',
  'send',
  'receive',
  'notify',
  'subscribe',
  'unsubscribe',
] as const

export type StandardVerb = (typeof StandardVerbs)[number]

// ============================================================================
// Things Collection Types (do-p9q)
// ============================================================================

/**
 * Homogeneous typed collection of Things
 */
export interface Things<T extends Thing = Thing> {
  /** Collection URL */
  $id: string
  /** Always 'https://schema.org.ai/Things' */
  $type: 'https://schema.org.ai/Things'
  /** Type of items in collection */
  itemType: string
  /** Total count */
  count?: number
}

/**
 * Collection that IS a Durable Object
 */
export interface ThingsDO<T extends Thing = Thing> extends Things<T> {
  isDO: true
}

/**
 * Generic collection container
 */
export interface Collection<T extends Thing = Thing> {
  $id: string
  $type: 'https://schema.org.ai/Collection'
  /** Logical namespace */
  ns: string
  /** Type of contained items */
  itemType: string
}

export const THINGS_TYPE = 'https://schema.org.ai/Things'
export const COLLECTION_TYPE = 'https://schema.org.ai/Collection'

/**
 * Sort direction for list queries
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Sort specification
 */
export interface SortSpec {
  /** Field to sort by */
  field: string
  /** Sort direction */
  direction: SortDirection
}

/**
 * Options for filtering, sorting, and paginating Things
 */
export interface ListOptions<T extends Thing = Thing> {
  /** Maximum number of items to return */
  limit?: number
  /** Number of items to skip (offset-based pagination) */
  offset?: number
  /** Cursor for cursor-based pagination */
  cursor?: string
  /** Sort specifications */
  sort?: SortSpec | SortSpec[]
  /** Filter by field values */
  filter?: Partial<T>
  /** Text search query */
  search?: string
  /** Include soft-deleted items */
  includeDeleted?: boolean
}

/**
 * Pagination information for list results
 */
export interface PaginationInfo {
  /** Total number of items matching the query */
  total: number
  /** Number of items returned */
  count: number
  /** Limit used for the query */
  limit: number
  /** Offset used for the query */
  offset: number
  /** Cursor for the next page (if available) */
  nextCursor?: string
  /** Cursor for the previous page (if available) */
  prevCursor?: string
  /** Whether there are more items */
  hasMore: boolean
}

/**
 * Result of listing Things with pagination
 */
export interface ListResult<T extends Thing = Thing> {
  /** The items in this page */
  items: T[]
  /** Pagination information */
  pagination: PaginationInfo
}

// ============================================================================
// Event Schema - 5W+H (do-jbe)
// ============================================================================

/**
 * Event with 5W+H dimensions
 */
export interface Event {
  /** Event ID */
  $id: string
  /** Event type URL */
  $type: string
  /** What happened */
  what: EventWhat
  /** Who did it */
  who: EventWho
  /** When it happened */
  when: EventWhen
  /** Where it happened */
  where?: EventWhere
  /** Why it happened */
  why?: EventWhy
  /** How it happened */
  how?: EventHow
}

export interface EventWhat {
  /** Action performed */
  action: string
  /** Verb used */
  verb?: string
  /** Subject of the action */
  subject?: Thing
  /** Object of the action */
  object?: Thing
}

export interface EventWho {
  /** Actor ID */
  id: string
  /** Actor type */
  type: 'user' | 'system' | 'agent' | 'service'
  /** Actor name */
  name?: string
}

export interface EventWhen {
  /** Timestamp */
  timestamp: Date
  /** Duration in ms */
  duration?: number
  /** Sequence number */
  sequence?: number
}

export interface EventWhere {
  /** Namespace/context */
  ns?: string
  /** URL context */
  url?: string
  /** Geographic location */
  location?: { lat: number; lng: number }
}

export interface EventWhy {
  /** Reason/intent */
  reason?: string
  /** Trigger event */
  trigger?: string
  /** Parent event ID */
  parent?: string
}

export interface EventHow {
  /** Method used */
  method?: string
  /** Tool/agent used */
  tool?: string
  /** Additional details */
  details?: Record<string, unknown>
}

// ============================================================================
// Field Type Definitions (do-5ob)
// ============================================================================

/**
 * Supported field types
 */
export type FieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'markdown'
  | 'json'
  | 'url'
  | 'email'
  | 'blob'

/**
 * Field constraint modifiers
 */
export interface FieldConstraints {
  required?: boolean
  optional?: boolean
  array?: boolean
  unique?: boolean
  indexed?: boolean
  default?: unknown
  min?: number
  max?: number
  pattern?: string
}

/**
 * Complete field definition
 */
export interface FieldDefinition extends FieldConstraints {
  type: FieldType
  description?: string
  /** For relationship fields */
  operator?: RelationshipOperatorType
  relatedType?: string
  threshold?: number
}

/**
 * Field interface - simple field definition with name and type
 */
export interface Field {
  /** Field name */
  name: string
  /** Field type */
  type: FieldType
  /** Whether the field is required */
  required?: boolean
  /** Default value */
  default?: unknown
  /** Field description */
  description?: string
  /** Whether this is an array field */
  array?: boolean
}

/**
 * FieldValue discriminated union - runtime value with type tag
 */
export type FieldValue =
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'date'; value: Date }
  | { type: 'datetime'; value: Date }
  | { type: 'markdown'; value: string }
  | { type: 'json'; value: unknown }
  | { type: 'url'; value: string }
  | { type: 'email'; value: string }
  | { type: 'blob'; value: ArrayBuffer }

/**
 * Type helper to extract the value type for a given FieldType
 */
export type FieldValueFor<T extends FieldType> = T extends 'string'
  ? string
  : T extends 'number'
  ? number
  : T extends 'boolean'
  ? boolean
  : T extends 'date'
  ? Date
  : T extends 'datetime'
  ? Date
  : T extends 'markdown'
  ? string
  : T extends 'json'
  ? unknown
  : T extends 'url'
  ? string
  : T extends 'email'
  ? string
  : T extends 'blob'
  ? ArrayBuffer
  : never

/** Valid field type strings for runtime checking */
const VALID_FIELD_TYPES: readonly FieldType[] = [
  'string',
  'number',
  'boolean',
  'date',
  'datetime',
  'markdown',
  'json',
  'url',
  'email',
  'blob',
]

/**
 * Type guard for FieldValue
 */
export function isFieldValue(value: unknown): value is FieldValue {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v['type'] !== 'string') return false
  if (!VALID_FIELD_TYPES.includes(v['type'] as FieldType)) return false
  if (!('value' in v)) return false
  return true
}

// ============================================================================
// Branded ID Types (do-5ob)
// ============================================================================

/** Brand helper for nominal typing */
declare const __brand: unique symbol
type Brand<T, B> = T & { [__brand]: B }

/** Branded ID types */
export type ThingId = Brand<string, 'ThingId'>
export type NounId = Brand<string, 'NounId'>
export type VerbId = Brand<string, 'VerbId'>
export type ActionId = Brand<string, 'ActionId'>
export type EventId = Brand<string, 'EventId'>

/** Type guards */
export const isThingId = (v: string): v is ThingId => v.includes('/')
export const isActionId = (v: string): v is ActionId => v.startsWith('act_')
export const isEventId = (v: string): v is EventId => v.startsWith('evt_')

// ============================================================================
// Worker Types (schema.org.ai)
// ============================================================================

import { z } from 'zod'

/** Worker status values */
export const WorkerStatus = ['idle', 'working', 'paused', 'offline'] as const
export type WorkerStatusType = (typeof WorkerStatus)[number]

/** Type URL constants */
export const WORKER_TYPE = 'https://schema.org.ai/Worker' as const
export const AGENT_TYPE = 'https://schema.org.ai/Agent' as const
export const HUMAN_TYPE = 'https://schema.org.ai/Human' as const

/** All worker types */
export const WorkerTypes = [WORKER_TYPE, AGENT_TYPE, HUMAN_TYPE] as const

// Runtime markers for type exports
export const Worker = Symbol('Worker')
export const Agent = Symbol('Agent')
export const Human = Symbol('Human')

/**
 * Worker interface - base type for work executors
 * Extends Thing with worker-specific fields
 */
export interface WorkerType extends Thing {
  $type: typeof WORKER_TYPE | typeof AGENT_TYPE | typeof HUMAN_TYPE
  /** Worker status */
  status: WorkerStatusType
  /** What the worker can do */
  capabilities?: string[]
  /** Reference to current task */
  currentTask?: string
}

/**
 * Agent interface - AI agent that can execute work
 * Extends Worker with agent-specific fields
 */
export interface AgentType extends Omit<WorkerType, '$type'> {
  $type: typeof AGENT_TYPE
  /** AI model powering this agent */
  model: string
  /** Whether agent can act without human approval */
  autonomous: boolean
  /** AI provider (anthropic, openai, etc.) */
  provider?: string
  /** Base instructions for the agent */
  systemPrompt?: string
  /** Creativity/randomness setting (0-2) */
  temperature?: number
  /** Token limit for responses */
  maxTokens?: number
  /** Available tools/functions */
  tools?: string[]
}

/**
 * Human interface - Human worker that can execute work
 * Extends Worker with human-specific fields
 */
export interface HumanType extends Omit<WorkerType, '$type'> {
  $type: typeof HUMAN_TYPE
  /** Contact email */
  email?: string
  /** Job role */
  role?: string
  /** Department */
  department?: string
  /** Reference to manager (another Human) */
  manager?: string
  /** Timezone (e.g., 'America/Los_Angeles') */
  timezone?: string
  /** Availability information */
  availability?: {
    schedule?: string
    workingHours?: { start: string; end: string }
  }
}

// ============================================================================
// Zod Schemas for Worker Types
// ============================================================================

/** Base Worker schema */
export const WorkerSchema = z.object({
  $id: z.string().url(),
  $type: z.enum([WORKER_TYPE, AGENT_TYPE, HUMAN_TYPE]),
  status: z.enum(WorkerStatus),
  name: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  currentTask: z.string().optional(),
  // Thing properties
  data: z.record(z.unknown()).optional(),
  visibility: z.enum(['public', 'unlisted', 'org', 'user']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
})

/** Agent schema - extends Worker with agent-specific fields */
export const AgentSchema = z.object({
  $id: z.string().url(),
  $type: z.literal(AGENT_TYPE),
  status: z.enum(WorkerStatus),
  model: z.string(),
  autonomous: z.boolean(),
  provider: z.string().optional(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  tools: z.array(z.string()).optional(),
  name: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  currentTask: z.string().optional(),
  // Thing properties
  data: z.record(z.unknown()).optional(),
  visibility: z.enum(['public', 'unlisted', 'org', 'user']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
})

/** Human schema - extends Worker with human-specific fields */
export const HumanSchema = z.object({
  $id: z.string().url(),
  $type: z.literal(HUMAN_TYPE),
  status: z.enum(WorkerStatus),
  email: z.string().email().optional(),
  role: z.string().optional(),
  department: z.string().optional(),
  manager: z.string().optional(),
  timezone: z.string().optional(),
  availability: z
    .object({
      schedule: z.string().optional(),
      workingHours: z
        .object({
          start: z.string(),
          end: z.string(),
        })
        .optional(),
    })
    .optional(),
  name: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  currentTask: z.string().optional(),
  // Thing properties
  data: z.record(z.unknown()).optional(),
  visibility: z.enum(['public', 'unlisted', 'org', 'user']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
})

// ============================================================================
// Type Guards for Worker Types
// ============================================================================

/**
 * Type guard for Worker (includes Agent and Human subtypes)
 */
export function isWorker(v: unknown): v is WorkerType {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  if (typeof obj['$type'] !== 'string') return false
  return (
    (WorkerTypes as readonly string[]).includes(obj['$type']) &&
    typeof obj['status'] === 'string' &&
    WorkerStatus.includes(obj['status'] as WorkerStatusType)
  )
}

/**
 * Type guard for Agent
 */
export function isAgent(v: unknown): v is AgentType {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return (
    obj['$type'] === AGENT_TYPE &&
    typeof obj['model'] === 'string' &&
    typeof obj['autonomous'] === 'boolean' &&
    typeof obj['status'] === 'string' &&
    WorkerStatus.includes(obj['status'] as WorkerStatusType)
  )
}

/**
 * Type guard for Human
 */
export function isHuman(v: unknown): v is HumanType {
  if (typeof v !== 'object' || v === null) return false
  const obj = v as Record<string, unknown>
  return (
    obj['$type'] === HUMAN_TYPE &&
    typeof obj['status'] === 'string' &&
    WorkerStatus.includes(obj['status'] as WorkerStatusType)
  )
}

// ============================================================================
// Factory Functions for Worker Types
// ============================================================================

let agentCounter = 0
let humanCounter = 0

/**
 * Create a new Agent with auto-generated $id
 */
export function createAgent(opts: {
  model: string
  autonomous: boolean
  name?: string
  provider?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  tools?: string[]
  capabilities?: string[]
}): AgentType {
  return {
    $id: `https://schema.org.ai/agents/${++agentCounter}`,
    $type: AGENT_TYPE,
    status: 'idle',
    model: opts.model,
    autonomous: opts.autonomous,
    ...(opts.name !== undefined && { name: opts.name }),
    ...(opts.provider !== undefined && { provider: opts.provider }),
    ...(opts.systemPrompt !== undefined && { systemPrompt: opts.systemPrompt }),
    ...(opts.temperature !== undefined && { temperature: opts.temperature }),
    ...(opts.maxTokens !== undefined && { maxTokens: opts.maxTokens }),
    ...(opts.tools !== undefined && { tools: opts.tools }),
    ...(opts.capabilities !== undefined && { capabilities: opts.capabilities }),
  }
}

/**
 * Create a new Human with auto-generated $id
 */
export function createHuman(opts?: {
  name?: string
  email?: string
  role?: string
  department?: string
  manager?: string
  timezone?: string
  capabilities?: string[]
  availability?: {
    schedule?: string
    workingHours?: { start: string; end: string }
  }
}): HumanType {
  return {
    $id: `https://schema.org.ai/humans/${++humanCounter}`,
    $type: HUMAN_TYPE,
    status: 'idle',
    ...(opts?.name !== undefined && { name: opts.name }),
    ...(opts?.email !== undefined && { email: opts.email }),
    ...(opts?.role !== undefined && { role: opts.role }),
    ...(opts?.department !== undefined && { department: opts.department }),
    ...(opts?.manager !== undefined && { manager: opts.manager }),
    ...(opts?.timezone !== undefined && { timezone: opts.timezone }),
    ...(opts?.capabilities !== undefined && { capabilities: opts.capabilities }),
    ...(opts?.availability !== undefined && { availability: opts.availability }),
  }
}

// ============================================================================
// Tool Types (schema.org.ai)
// ============================================================================

/** Type URL for Tool */
export const TOOL_TYPE = 'https://schema.org.ai/Tool'

/** Standard tool parameter types */
export const StandardToolTypes = ['string', 'number', 'boolean', 'object', 'array'] as const

/** Standard capabilities */
export const StandardCapabilities = [
  'read',
  'write',
  'execute',
  'delete',
  'create',
  'update',
] as const

/** Runtime marker for Tool type */
export const Tool = Symbol('Tool')
export const ToolInput = Symbol('ToolInput')
export const ToolOutput = Symbol('ToolOutput')
export const ToolParameter = Symbol('ToolParameter')
export const ToolExecutionResult = Symbol('ToolExecutionResult')
export const ToolValidationError = Symbol('ToolValidationError')
export const ToolValidationResult = Symbol('ToolValidationResult')
export const ToolExecutor = Symbol('ToolExecutor')
export const ExecutableTool = Symbol('ExecutableTool')
export const ValidatableTool = Symbol('ValidatableTool')
export const Tools = Symbol('Tools')
export const Toolbox = Symbol('Toolbox')
export const ToolCapability = Symbol('ToolCapability')

/**
 * Tool parameter definition
 */
export interface ToolParameterType {
  /** Parameter name */
  name: string
  /** Parameter type */
  type: string
  /** Description */
  description?: string
  /** Whether the parameter is required */
  required: boolean
  /** Default value */
  default?: unknown
  /** Allowed values */
  enum?: unknown[]
}

/**
 * Tool input schema
 */
export interface ToolInputType {
  type: 'object'
  properties: Record<string, unknown>
  required?: string[]
}

/**
 * Tool output schema
 */
export interface ToolOutputType {
  type: string
  description?: string
  schema?: Record<string, unknown>
}

/**
 * Tool execution result
 */
export interface ToolExecutionResultType {
  success: boolean
  data?: unknown
  error?: string
  duration?: number
  metadata?: Record<string, unknown>
}

/**
 * Tool validation error
 */
export interface ToolValidationErrorType {
  field: string
  message: string
  code: string
  expected?: unknown
  received?: unknown
}

/**
 * Tool validation result
 */
export interface ToolValidationResultType {
  valid: boolean
  errors: ToolValidationErrorType[]
}

/**
 * Tool executor function type
 */
export type ToolExecutorType = (input: unknown) => Promise<ToolExecutionResultType>

/**
 * Tool capability
 */
export interface ToolCapabilityType {
  name: string
  description: string
}

/**
 * Tool interface
 */
export interface ToolType extends Thing {
  $id: string
  $type: string
  name: string
  description: string
  inputs: ToolParameterType[]
  outputs: ToolOutputType
}

/**
 * Executable tool with execute method
 */
export interface ExecutableToolType extends ToolType {
  execute: ToolExecutorType
}

/**
 * Validatable tool with validate method
 */
export interface ValidatableToolType extends ToolType {
  validate: (input: unknown) => ToolValidationResultType
}

/**
 * Tools collection
 */
export interface ToolsType extends Things<ToolType> {
  itemType: 'https://schema.org.ai/Tool'
}

/**
 * Toolbox - collection of related tools
 */
export interface ToolboxType {
  name: string
  description?: string
  tools: ToolType[]
}

/** Branded ToolId type */
export type ToolId = Brand<string, 'ToolId'>

/** Runtime marker for ToolId */
export const ToolId = Symbol('ToolId')

/**
 * Type guard for ToolId
 */
export function isToolId(v: string): v is ToolId {
  return v.includes('/tool/') || v.includes('/tools/')
}

/**
 * Type guard for Tool
 */
export function isTool(value: unknown): value is ToolType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === TOOL_TYPE &&
    typeof v['name'] === 'string'
  )
}

/**
 * Type guard for ToolParameter
 */
export function isToolParameter(value: unknown): value is ToolParameterType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['name'] === 'string' &&
    typeof v['type'] === 'string' &&
    typeof v['required'] === 'boolean'
  )
}

/**
 * Type guard for ToolExecutionResult
 */
export function isToolExecutionResult(value: unknown): value is ToolExecutionResultType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['success'] === 'boolean'
}

/**
 * Type guard for ToolValidationError
 */
export function isToolValidationError(value: unknown): value is ToolValidationErrorType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['field'] === 'string' &&
    typeof v['message'] === 'string' &&
    typeof v['code'] === 'string'
  )
}

// ============================================================================
// Integration Types (schema.org.ai)
// ============================================================================

/** Type URL for Integration */
export const INTEGRATION_TYPE = 'https://schema.org.ai/Integration'

/** Runtime marker for Integration type */
export const Integration = Symbol('Integration')

/** Runtime marker for Integrations collection */
export const Integrations = Symbol('Integrations')

/** Integration status values */
export const IntegrationStatus = ['active', 'inactive', 'error', 'pending'] as const
export type IntegrationStatusType = (typeof IntegrationStatus)[number]

/** Integration category values */
export const IntegrationCategory = [
  'finance',
  'message',
  'code',
  'storage',
  'analytics',
  'ai',
] as const
export type IntegrationCategoryType = (typeof IntegrationCategory)[number]

/** Branded IntegrationId type */
export type IntegrationId = Brand<string, 'IntegrationId'>

/** Runtime marker for IntegrationId */
export const IntegrationId = Symbol('IntegrationId')

/**
 * Integration interface - connection to external services
 * Extends Thing with integration-specific fields
 */
export interface IntegrationType extends Thing {
  $id: string
  $type: typeof INTEGRATION_TYPE | string
  /** Integration name */
  name: string
  /** Service provider (e.g., 'stripe', 'slack') */
  provider: string
  /** Integration category */
  category: string
  /** Connection status */
  status: IntegrationStatusType
  /** Description */
  description?: string
  /** Integration-specific configuration */
  config?: Record<string, unknown>
  /** Reference to encrypted credentials */
  credentials?: { ref: string }
  /** Tools exposed by this integration */
  tools?: unknown[]
  /** Capabilities provided by this integration */
  capabilities?: string[]
  /** Webhook URL for receiving events */
  webhookUrl?: string
  /** Rate limiting configuration */
  rateLimit?: { requests: number; period: string }
}

/** Integration Zod Schema */
export const IntegrationSchema = z.object({
  $id: z.string().url(),
  $type: z.literal(INTEGRATION_TYPE).or(z.string()),
  name: z.string(),
  provider: z.string(),
  category: z.string(),
  status: z.enum(IntegrationStatus),
  description: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  credentials: z.object({ ref: z.string() }).optional(),
  tools: z.array(z.unknown()).optional(),
  capabilities: z.array(z.string()).optional(),
  webhookUrl: z.string().optional(),
  rateLimit: z.object({ requests: z.number(), period: z.string() }).optional(),
  // Thing properties
  data: z.record(z.unknown()).optional(),
  visibility: z.enum(['public', 'unlisted', 'org', 'user']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
})

/**
 * Type guard for Integration
 */
export function isIntegration(value: unknown): value is IntegrationType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === INTEGRATION_TYPE &&
    typeof v['name'] === 'string' &&
    typeof v['provider'] === 'string' &&
    typeof v['category'] === 'string' &&
    typeof v['status'] === 'string' &&
    (IntegrationStatus as readonly string[]).includes(v['status'] as string)
  )
}

/**
 * Type guard for IntegrationId
 */
export function isIntegrationId(v: string): v is IntegrationId {
  return v.includes('/integration/') || v.includes('/integrations/')
}

/** Counter for auto-generated integration IDs */
let integrationCounter = 0

/**
 * Factory function to create an Integration
 */
export function createIntegration(opts: {
  name: string
  provider: string
  category: string
  status?: IntegrationStatusType
  description?: string
  config?: Record<string, unknown>
  credentials?: { ref: string }
  tools?: unknown[]
  capabilities?: string[]
  webhookUrl?: string
  rateLimit?: { requests: number; period: string }
  $id?: string
}): IntegrationType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/integrations/${++integrationCounter}`,
    $type: INTEGRATION_TYPE,
    name: opts.name,
    provider: opts.provider,
    category: opts.category,
    status: opts.status ?? 'pending',
    ...(opts.description !== undefined && { description: opts.description }),
    ...(opts.config !== undefined && { config: opts.config }),
    ...(opts.credentials !== undefined && { credentials: opts.credentials }),
    ...(opts.tools !== undefined && { tools: opts.tools }),
    ...(opts.capabilities !== undefined && { capabilities: opts.capabilities }),
    ...(opts.webhookUrl !== undefined && { webhookUrl: opts.webhookUrl }),
    ...(opts.rateLimit !== undefined && { rateLimit: opts.rateLimit }),
  }
}

// ============================================================================
// Capability Types (schema.org.ai)
// ============================================================================

/** Type URL for Capability */
export const CAPABILITY_TYPE = 'https://schema.org.ai/Capability'

/** Runtime marker for Capability type */
export const Capability = Symbol('Capability')

/** Runtime marker for Capabilities collection */
export const Capabilities = Symbol('Capabilities')

/** Capability category values */
export const CapabilityCategory = [
  'read',
  'write',
  'execute',
  'communicate',
  'analyze',
  'transform',
  'manage',
] as const
export type CapabilityCategoryType = (typeof CapabilityCategory)[number]

/** Capability level values */
export const CapabilityLevel = ['basic', 'intermediate', 'advanced', 'expert'] as const
export type CapabilityLevelType = (typeof CapabilityLevel)[number]

/** Branded CapabilityId type */
export type CapabilityId = Brand<string, 'CapabilityId'>

/** Runtime marker for CapabilityId */
export const CapabilityId = Symbol('CapabilityId')

/**
 * Capability interface - what a Worker/Agent/Tool can do
 * Extends Thing with capability-specific fields
 */
export interface CapabilityType extends Thing {
  $id: string
  $type: typeof CAPABILITY_TYPE | string
  /** Capability name */
  name: string
  /** What this capability enables */
  description: string
  /** Capability category */
  category?: string
  /** Proficiency level */
  level?: CapabilityLevelType
  /** Required permissions to use this capability */
  permissions?: string[]
  /** Constraints/limits on the capability */
  constraints?: Record<string, unknown>
  /** Tools that implement this capability */
  tools?: unknown[]
  /** Integrations that provide this capability */
  integrations?: unknown[]
  /** Other capabilities this depends on */
  requiredCapabilities?: string[]
}

/** Capability Zod Schema */
export const CapabilitySchema = z.object({
  $id: z.string().url(),
  $type: z.literal(CAPABILITY_TYPE).or(z.string()),
  name: z.string(),
  description: z.string(),
  category: z.string().optional(),
  level: z.enum(CapabilityLevel).optional(),
  permissions: z.array(z.string()).optional(),
  constraints: z.record(z.unknown()).optional(),
  tools: z.array(z.unknown()).optional(),
  integrations: z.array(z.unknown()).optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  // Thing properties
  data: z.record(z.unknown()).optional(),
  visibility: z.enum(['public', 'unlisted', 'org', 'user']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
})

/**
 * Type guard for Capability
 */
export function isCapability(value: unknown): value is CapabilityType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === CAPABILITY_TYPE &&
    typeof v['name'] === 'string' &&
    typeof v['description'] === 'string'
  )
}

/**
 * Type guard for CapabilityId
 */
export function isCapabilityId(v: string): v is CapabilityId {
  return v.includes('/capability/') || v.includes('/capabilities/')
}

/** Counter for auto-generated capability IDs */
let capabilityCounter = 0

/**
 * Factory function to create a Capability
 */
export function createCapability(opts: {
  name: string
  description: string
  category?: string
  level?: CapabilityLevelType
  permissions?: string[]
  constraints?: Record<string, unknown>
  tools?: unknown[]
  integrations?: unknown[]
  requiredCapabilities?: string[]
  $id?: string
}): CapabilityType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/capabilities/${++capabilityCounter}`,
    $type: CAPABILITY_TYPE,
    name: opts.name,
    description: opts.description,
    ...(opts.category !== undefined && { category: opts.category }),
    ...(opts.level !== undefined && { level: opts.level }),
    ...(opts.permissions !== undefined && { permissions: opts.permissions }),
    ...(opts.constraints !== undefined && { constraints: opts.constraints }),
    ...(opts.tools !== undefined && { tools: opts.tools }),
    ...(opts.integrations !== undefined && { integrations: opts.integrations }),
    ...(opts.requiredCapabilities !== undefined && {
      requiredCapabilities: opts.requiredCapabilities,
    }),
  }
}

/**
 * Helper function to check if an entity has a specific capability
 */
export function hasCapability(entity: { capabilities?: string[] }, capability: string): boolean {
  return entity.capabilities?.includes(capability) ?? false
}

// ============================================================================
// Business Model Framework Types (LeanCanvas, StoryBrand, Founder)
// ============================================================================

/** Runtime marker for LeanCanvas type */
export const LeanCanvasMarker = Symbol('LeanCanvas')
export const LeanCanvas = Symbol('LeanCanvas')

/** Type URL for LeanCanvas */
export const LEAN_CANVAS_TYPE = 'https://schema.org.ai/LeanCanvas'

/**
 * LeanCanvas - 9-box business model canvas
 */
export interface LeanCanvasType extends Thing {
  $id: string
  $type: string
  /** Top 3 problems customers face */
  problem: string[]
  /** Top 3 solutions to those problems */
  solution: string[]
  /** Single clear compelling message */
  uniqueValueProposition: string
  /** What can't be easily copied */
  unfairAdvantage: string
  /** Target customer segments */
  customerSegments: string[]
  /** Key metrics to track */
  keyMetrics: string[]
  /** Paths to reach customers */
  channels: string[]
  /** Fixed and variable costs */
  costStructure: string[]
  /** Revenue streams */
  revenueStreams: string[]
  /** Canvas version for iterations */
  version?: number
  /** Reference to startup */
  startupId?: string
}

/**
 * Type guard for LeanCanvas
 */
export function isLeanCanvas(value: unknown): value is LeanCanvasType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === LEAN_CANVAS_TYPE
  )
}

/** Runtime marker for StoryBrand type */
export const StoryBrandMarker = Symbol('StoryBrand')
export const StoryBrand = Symbol('StoryBrand')

/** Type URL for StoryBrand */
export const STORY_BRAND_TYPE = 'https://schema.org.ai/StoryBrand'

/**
 * StoryBrand - 7-part narrative framework
 */
export interface StoryBrandType extends Thing {
  $id: string
  $type: string
  /** Character - the customer */
  character: {
    wants: string
    identity: string
  }
  /** The problem */
  problem: {
    external: string
    internal: string
    philosophical: string
  }
  /** The guide - your brand */
  guide: {
    empathy: string
    authority: string
  }
  /** The plan - steps to success */
  plan: string[]
  /** Call to action */
  callToAction: {
    direct: string
    transitional?: string
  }
  /** Failure - what's at stake */
  failure: string[]
  /** Success - transformation */
  success: string[]
  /** Reference to startup */
  startupId?: string
  /** Reference to ICP */
  icpId?: string
}

/**
 * Type guard for StoryBrand
 */
export function isStoryBrand(value: unknown): value is StoryBrandType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === STORY_BRAND_TYPE
  )
}

/** Runtime marker for Founder type */
export const FounderMarker = Symbol('Founder')
export const Founder = Symbol('Founder')
export const FounderRole = Symbol('FounderRole')

/** Type URL for Founder */
export const FOUNDER_TYPE = 'https://schema.org.ai/Founder'

/** Founder roles */
export const FounderRoles = ['ceo', 'cto', 'cpo', 'coo', 'cfo', 'cmo', 'cro'] as const
export type FounderRoleType = (typeof FounderRoles)[number]

/**
 * Founder - founding team member
 */
export interface FounderType extends Thing {
  $id: string
  $type: string
  /** Founder name */
  name: string
  /** Email address */
  email?: string
  /** Role in the company */
  role: FounderRoleType | string
  /** Skills */
  skills: string[]
  /** Areas of expertise */
  expertise?: string[]
  /** Startups this founder is associated with */
  startupIds?: string[]
}

/**
 * Type guard for Founder
 */
export function isFounder(value: unknown): value is FounderType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' && typeof v['$type'] === 'string' && v['$type'] === FOUNDER_TYPE
  )
}

// ============================================================================
// Startup Types (aip-unce, aip-bbwo)
// ============================================================================

/** Runtime marker for Startup type */
export const Startup = Symbol('Startup')

/** Runtime marker for StartupStage type */
export const StartupStage = Symbol('StartupStage')

/** Type URL for Startup */
export const STARTUP_TYPE = 'https://schema.org.ai/Startup' as const

/** Schema URL for Startup type definition */
export const STARTUP_SCHEMA = 'https://schema.org.ai/Startup' as const

/** All valid startup stages */
export const StartupStages = ['idea', 'validating', 'building', 'scaling', 'established'] as const

/**
 * Startup lifecycle stages
 *
 * Represents the different phases a startup goes through:
 * - `idea`: Initial concept phase, exploring problem/solution fit
 * - `validating`: Testing assumptions and validating market demand
 * - `building`: Developing the product and initial go-to-market
 * - `scaling`: Growing the business and expanding market reach
 * - `established`: Mature operations with sustainable growth
 */
export type StartupStageType = (typeof StartupStages)[number]

/**
 * Startup entity with lifecycle states
 *
 * Represents a startup company with its current stage in the lifecycle.
 * Follows the schema.org.ai vocabulary for interoperability.
 *
 * @see https://schema.org.ai/Startup
 *
 * @example
 * ```typescript
 * const startup: StartupType = {
 *   $id: 'https://example.com/startups/acme',
 *   $type: 'https://schema.org.ai/Startup',
 *   $schema: 'https://schema.org.ai/Startup',
 *   name: 'Acme Inc',
 *   stage: 'building',
 *   description: 'Making the world a better place',
 *   pitch: 'We help developers ship faster',
 *   industry: 'Developer Tools',
 * }
 * ```
 */
export interface StartupType extends Thing {
  /** Unique identifier URL */
  $id: string
  /** Type URL (https://schema.org.ai/Startup) */
  $type: typeof STARTUP_TYPE | string
  /** Schema URL reference for JSON-LD compatibility */
  $schema?: typeof STARTUP_SCHEMA | string
  /** Startup name */
  name: string
  /** Current lifecycle stage */
  stage: StartupStageType
  /** Description of the startup */
  description?: string
  /** Elevator pitch */
  pitch?: string
  /** Date founded */
  founded?: Date
  /** Website URL */
  website?: string
  /** Industry/sector */
  industry?: string
  /** Ideal Customer Profiles for this startup */
  icps?: ICPType[]
}

/**
 * Type guard for Startup
 *
 * Validates that a value conforms to the StartupType interface.
 *
 * @param value - The value to check
 * @returns True if the value is a valid Startup
 *
 * @example
 * ```typescript
 * if (isStartup(entity)) {
 *   console.log(`${entity.name} is in ${entity.stage} stage`)
 * }
 * ```
 */
export function isStartup(value: unknown): value is StartupType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === STARTUP_TYPE &&
    typeof v['name'] === 'string' &&
    typeof v['stage'] === 'string' &&
    (StartupStages as readonly string[]).includes(v['stage'] as string)
  )
}

/** Counter for auto-generated startup IDs */
let startupCounter = 0

/**
 * Input type for createStartup factory function
 */
export interface CreateStartupInput {
  /** Startup name */
  name: string
  /** Current lifecycle stage */
  stage: StartupStageType
  /** Description of the startup */
  description?: string
  /** Elevator pitch */
  pitch?: string
  /** Date founded */
  founded?: Date
  /** Website URL */
  website?: string
  /** Industry/sector */
  industry?: string
  /** Custom $id (auto-generated if not provided) */
  $id?: string
}

/**
 * Factory function to create a Startup
 *
 * Creates a new Startup entity with auto-generated $id if not provided.
 *
 * @param opts - Startup configuration options
 * @returns A fully-formed StartupType entity
 *
 * @example
 * ```typescript
 * const startup = createStartup({
 *   name: 'Acme Inc',
 *   stage: 'building',
 *   description: 'Making the world a better place',
 * })
 * ```
 */
export function createStartup(opts: CreateStartupInput): StartupType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/startups/${++startupCounter}`,
    $type: STARTUP_TYPE,
    $schema: STARTUP_SCHEMA,
    name: opts.name,
    stage: opts.stage,
    ...(opts.description !== undefined && { description: opts.description }),
    ...(opts.pitch !== undefined && { pitch: opts.pitch }),
    ...(opts.founded !== undefined && { founded: opts.founded }),
    ...(opts.website !== undefined && { website: opts.website }),
    ...(opts.industry !== undefined && { industry: opts.industry }),
  }
}

// ============================================================================
// ICP (Ideal Customer Profile) Types (aip-unce, aip-bbwo)
// ============================================================================

/** Runtime marker for ICP type */
export const ICP = Symbol('ICP')

/** Type URL for ICP */
export const ICP_TYPE = 'https://schema.org.ai/ICP' as const

/** Schema URL for ICP type definition */
export const ICP_SCHEMA = 'https://schema.org.ai/ICP' as const

/**
 * Ideal Customer Profile (ICP) with as/at/are/using/to framework
 *
 * Describes the ideal customer for a startup using a structured framework:
 * - `as`: persona/role description (who they are)
 * - `at`: company/context description (where they work)
 * - `are`: current state/pain points (their situation)
 * - `using`: current solutions (what they use today)
 * - `to`: desired outcome/job to be done (what they want to achieve)
 *
 * This framework helps startups clearly articulate their target customer
 * in a way that drives product and marketing decisions.
 *
 * @see https://schema.org.ai/ICP
 *
 * @example
 * ```typescript
 * const icp: ICPType = {
 *   $id: 'https://example.com/icps/product-manager',
 *   $type: 'https://schema.org.ai/ICP',
 *   $schema: 'https://schema.org.ai/ICP',
 *   name: 'Product Manager ICP',
 *   as: 'a product manager',
 *   at: 'a B2B SaaS company with 50-200 employees',
 *   are: 'struggling to manage customer feedback at scale',
 *   using: 'spreadsheets and email to track feedback',
 *   to: 'prioritize features based on customer impact',
 * }
 * ```
 */
export interface ICPType extends Thing {
  /** Unique identifier URL */
  $id: string
  /** Type URL (https://schema.org.ai/ICP) */
  $type: typeof ICP_TYPE | string
  /** Schema URL reference for JSON-LD compatibility */
  $schema?: typeof ICP_SCHEMA | string
  /** Profile name */
  name?: string
  /** Persona/role description - who they are */
  as?: string
  /** Company/context description - where they work */
  at?: string
  /** Current state/pain points - their situation */
  are?: string
  /** Current solutions - what they use today */
  using?: string
  /** Desired outcome/job to be done - what they want to achieve */
  to?: string
  /** Reference to the startup this ICP belongs to */
  startup?: StartupType
}

/**
 * Type guard for ICP
 *
 * Validates that a value conforms to the ICPType interface.
 *
 * @param value - The value to check
 * @returns True if the value is a valid ICP
 *
 * @example
 * ```typescript
 * if (isICP(entity)) {
 *   console.log(`ICP "${entity.name}" targets: ${entity.as} at ${entity.at}`)
 * }
 * ```
 */
export function isICP(value: unknown): value is ICPType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['$id'] === 'string' && typeof v['$type'] === 'string' && v['$type'] === ICP_TYPE
}

/** Counter for auto-generated ICP IDs */
let icpCounter = 0

/**
 * Input type for createICP factory function
 */
export interface CreateICPInput {
  /** Profile name */
  name?: string
  /** Persona/role description - who they are */
  as?: string
  /** Company/context description - where they work */
  at?: string
  /** Current state/pain points - their situation */
  are?: string
  /** Current solutions - what they use today */
  using?: string
  /** Desired outcome/job to be done - what they want to achieve */
  to?: string
  /** Reference to the startup this ICP belongs to */
  startup?: StartupType
  /** Custom $id (auto-generated if not provided) */
  $id?: string
}

/**
 * Factory function to create an ICP
 *
 * Creates a new ICP entity with auto-generated $id if not provided.
 *
 * @param opts - ICP configuration options
 * @returns A fully-formed ICPType entity
 *
 * @example
 * ```typescript
 * const icp = createICP({
 *   name: 'Product Manager ICP',
 *   as: 'a product manager',
 *   at: 'a B2B SaaS company',
 *   are: 'struggling to manage feedback',
 *   using: 'spreadsheets',
 *   to: 'make better product decisions',
 * })
 * ```
 */
export function createICP(opts?: CreateICPInput): ICPType {
  return {
    $id: opts?.$id ?? `https://schema.org.ai/icps/${++icpCounter}`,
    $type: ICP_TYPE,
    $schema: ICP_SCHEMA,
    ...(opts?.name !== undefined && { name: opts.name }),
    ...(opts?.as !== undefined && { as: opts.as }),
    ...(opts?.at !== undefined && { at: opts.at }),
    ...(opts?.are !== undefined && { are: opts.are }),
    ...(opts?.using !== undefined && { using: opts.using }),
    ...(opts?.to !== undefined && { to: opts.to }),
    ...(opts?.startup !== undefined && { startup: opts.startup }),
  }
}

// ============================================================================
// OpenTelemetry Integration (aip-66xl)
// ============================================================================

export {
  // W3C Trace Context
  parseTraceparent,
  createTraceparent,
  generateTraceId,
  generateSpanId,
  type TraceContext,
  type ParsedTraceContext,

  // Span types
  type SpanKind,
  type SpanStatus,
  type AttributeValue,
  type SpanAttributes,
  type SpanEvent,
  type SpanLink,
  type Span,
  type SpanOptions,

  // Tracer
  type Tracer,

  // Metrics
  type MetricLabels,
  type Counter,
  type Histogram,
  type Gauge,
  type Meter,

  // Logger
  type LogLevel,
  type LogRecord,
  type Logger,

  // Provider
  type TelemetryProvider,

  // No-op implementations
  noopTracer,
  noopMeter,
  noopLogger,
  noopTelemetryProvider,

  // Console implementations
  createConsoleTracer,
  createConsoleMeter,
  createConsoleLogger,
  createConsoleTelemetryProvider,

  // Global configuration
  setTelemetryProvider,
  getTelemetryProvider,
  getTracer,
  getMeter,
  getLogger,

  // Instrumentation helpers
  SemanticAttributes,
  MetricNames,
  createAIMetrics,
  createHandlerMetrics,
  instrument,

  // Symbols
  TelemetrySymbol,
  TracerSymbol,
  MeterSymbol,
  LoggerSymbol,
  SpanSymbol,
} from './telemetry.js'

// ============================================================================
// Idea Types (aip-kwd7)
// ============================================================================

/** Runtime marker for Idea type */
export const Idea = Symbol('Idea')

/** Type URL for Idea */
export const IDEA_TYPE = 'https://schema.org.ai/Idea' as const

/** Schema URL for Idea type definition */
export const IDEA_SCHEMA = 'https://schema.org.ai/Idea' as const

/** Idea status values */
export const IdeaStatuses = ['raw', 'refined', 'validated', 'rejected'] as const

/**
 * Idea lifecycle status
 *
 * - `raw`: Initial unrefined idea
 * - `refined`: Developed and articulated idea
 * - `validated`: Proven through hypothesis testing
 * - `rejected`: Discarded based on validation results
 */
export type IdeaStatus = (typeof IdeaStatuses)[number]

/**
 * Idea entity - a business concept with pitch and status
 *
 * Represents a business idea that can be validated through hypotheses.
 * Follows the schema.org.ai vocabulary for interoperability.
 *
 * @see https://schema.org.ai/Idea
 *
 * @example
 * ```typescript
 * const idea: IdeaType = {
 *   $id: 'https://example.com/ideas/todoai',
 *   $type: 'https://schema.org.ai/Idea',
 *   name: 'AI-powered todo app',
 *   pitch: 'TodoAI uses AI to prioritize your tasks automatically',
 *   status: 'raw',
 * }
 * ```
 */
export interface IdeaType extends Thing {
  /** Unique identifier URL */
  $id: string
  /** Type URL (https://schema.org.ai/Idea) */
  $type: typeof IDEA_TYPE | string
  /** Schema URL reference for JSON-LD compatibility */
  $schema?: typeof IDEA_SCHEMA | string
  /** Idea name */
  name: string
  /** Elevator pitch - concise compelling message */
  pitch: string
  /** Detailed description of the idea */
  description?: string
  /** Current lifecycle status */
  status: IdeaStatus
  /** Tags for categorization */
  tags?: string[]
  /** Reference to the startup this idea belongs to */
  startup?: StartupType
  /** Hypotheses to validate this idea */
  hypotheses?: HypothesisType[]
}

/**
 * Type guard for Idea
 *
 * Validates that a value conforms to the IdeaType interface.
 *
 * @param value - The value to check
 * @returns True if the value is a valid Idea
 */
export function isIdea(value: unknown): value is IdeaType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === IDEA_TYPE &&
    typeof v['name'] === 'string' &&
    typeof v['pitch'] === 'string' &&
    typeof v['status'] === 'string' &&
    (IdeaStatuses as readonly string[]).includes(v['status'] as string)
  )
}

/** Counter for auto-generated idea IDs */
let ideaCounter = 0

/**
 * Input type for createIdea factory function
 */
export interface CreateIdeaInput {
  /** Idea name */
  name: string
  /** Elevator pitch */
  pitch: string
  /** Current lifecycle status */
  status: IdeaStatus
  /** Detailed description */
  description?: string
  /** Tags for categorization */
  tags?: string[]
  /** Reference to startup */
  startup?: StartupType
  /** Custom $id (auto-generated if not provided) */
  $id?: string
}

/**
 * Factory function to create an Idea
 *
 * Creates a new Idea entity with auto-generated $id if not provided.
 *
 * @param opts - Idea configuration options
 * @returns A fully-formed IdeaType entity
 */
export function createIdea(opts: CreateIdeaInput): IdeaType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/ideas/${++ideaCounter}`,
    $type: IDEA_TYPE,
    $schema: IDEA_SCHEMA,
    name: opts.name,
    pitch: opts.pitch,
    status: opts.status,
    ...(opts.description !== undefined && { description: opts.description }),
    ...(opts.tags !== undefined && { tags: opts.tags }),
    ...(opts.startup !== undefined && { startup: opts.startup }),
  }
}

// ============================================================================
// Hypothesis Types (aip-kwd7)
// ============================================================================

/** Runtime marker for Hypothesis type */
export const Hypothesis = Symbol('Hypothesis')

/** Type URL for Hypothesis */
export const HYPOTHESIS_TYPE = 'https://schema.org.ai/Hypothesis' as const

/** Schema URL for Hypothesis type definition */
export const HYPOTHESIS_SCHEMA = 'https://schema.org.ai/Hypothesis' as const

/** Hypothesis status values */
export const HypothesisStatuses = ['untested', 'testing', 'validated', 'invalidated'] as const

/**
 * Hypothesis testing status
 *
 * - `untested`: Not yet tested
 * - `testing`: Currently being validated
 * - `validated`: Proven true by evidence
 * - `invalidated`: Proven false by evidence
 */
export type HypothesisStatus = (typeof HypothesisStatuses)[number]

/**
 * Evidence interface - data point supporting or refuting a hypothesis
 */
export interface Evidence {
  /** Type of evidence (e.g., 'user_study', 'analytics', 'survey') */
  type: string
  /** Measured value */
  value: number
  /** Source of the evidence */
  source: string
  /** When the evidence was collected */
  collectedAt: Date
  /** Additional notes */
  notes?: string
  /** Confidence level (0-1) */
  confidence?: number
}

/**
 * Hypothesis entity - a testable assumption with evidence collection
 *
 * Represents a testable hypothesis that can be validated or invalidated.
 * Follows the schema.org.ai vocabulary for interoperability.
 *
 * @see https://schema.org.ai/Hypothesis
 *
 * @example
 * ```typescript
 * const hypothesis: HypothesisType = {
 *   $id: 'https://example.com/hypotheses/pricing',
 *   $type: 'https://schema.org.ai/Hypothesis',
 *   statement: 'Users will pay $10/month for AI task prioritization',
 *   metric: 'conversion_rate',
 *   target: 0.05,
 *   status: 'testing',
 * }
 * ```
 */
export interface HypothesisType extends Thing {
  /** Unique identifier URL */
  $id: string
  /** Type URL (https://schema.org.ai/Hypothesis) */
  $type: typeof HYPOTHESIS_TYPE | string
  /** Schema URL reference for JSON-LD compatibility */
  $schema?: typeof HYPOTHESIS_SCHEMA | string
  /** The hypothesis statement to test */
  statement: string
  /** Metric to measure */
  metric: string
  /** Target value to achieve */
  target: number
  /** Current testing status */
  status: HypothesisStatus
  /** Baseline value before experiment */
  baseline?: number
  /** Deadline for testing */
  deadline?: Date
  /** Collected evidence */
  evidence?: Evidence[]
  /** Reference to the idea this hypothesis validates */
  idea?: IdeaType | string
}

/**
 * Type guard for Hypothesis
 *
 * Validates that a value conforms to the HypothesisType interface.
 *
 * @param value - The value to check
 * @returns True if the value is a valid Hypothesis
 */
export function isHypothesis(value: unknown): value is HypothesisType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === HYPOTHESIS_TYPE &&
    typeof v['statement'] === 'string' &&
    typeof v['metric'] === 'string' &&
    typeof v['target'] === 'number' &&
    typeof v['status'] === 'string' &&
    (HypothesisStatuses as readonly string[]).includes(v['status'] as string)
  )
}

/** Counter for auto-generated hypothesis IDs */
let hypothesisCounter = 0

/**
 * Input type for createHypothesis factory function
 */
export interface CreateHypothesisInput {
  /** The hypothesis statement to test */
  statement: string
  /** Metric to measure */
  metric: string
  /** Target value to achieve */
  target: number
  /** Current testing status */
  status?: HypothesisStatus
  /** Baseline value */
  baseline?: number
  /** Testing deadline */
  deadline?: Date
  /** Reference to idea */
  idea?: IdeaType | string
  /** Custom $id (auto-generated if not provided) */
  $id?: string
}

/**
 * Factory function to create a Hypothesis
 *
 * Creates a new Hypothesis entity with auto-generated $id if not provided.
 *
 * @param opts - Hypothesis configuration options
 * @returns A fully-formed HypothesisType entity
 */
export function createHypothesis(opts: CreateHypothesisInput): HypothesisType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/hypotheses/${++hypothesisCounter}`,
    $type: HYPOTHESIS_TYPE,
    $schema: HYPOTHESIS_SCHEMA,
    statement: opts.statement,
    metric: opts.metric,
    target: opts.target,
    status: opts.status ?? 'untested',
    ...(opts.baseline !== undefined && { baseline: opts.baseline }),
    ...(opts.deadline !== undefined && { deadline: opts.deadline }),
    ...(opts.idea !== undefined && { idea: opts.idea }),
  }
}

// ============================================================================
// JTBD (Jobs To Be Done) Types (aip-kwd7)
// ============================================================================

/** Runtime marker for JTBD type */
export const JTBD = Symbol('JTBD')

/** Type URL for JTBD */
export const JTBD_TYPE = 'https://schema.org.ai/JTBD' as const

/** Schema URL for JTBD type definition */
export const JTBD_SCHEMA = 'https://schema.org.ai/JTBD' as const

/** JTBD frequency values */
export const JTBDFrequencies = [
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'occasionally',
] as const

/**
 * JTBD frequency - how often the job occurs
 */
export type JTBDFrequency = (typeof JTBDFrequencies)[number]

/**
 * Job Dimension - functional, emotional, or social aspect of a job
 */
export interface JobDimension {
  /** Description of this dimension */
  description: string
  /** Importance rating (0-10) */
  importance: number
  /** Current solution being used */
  currentSolution?: string
  /** Satisfaction with current solution (0-10) */
  satisfaction?: number
}

/**
 * JTBD entity - Jobs To Be Done framework
 *
 * Represents a job the customer is trying to accomplish using the
 * When/I want/So I can pattern.
 *
 * @see https://schema.org.ai/JTBD
 *
 * @example
 * ```typescript
 * const jtbd: JTBDType = {
 *   $id: 'https://example.com/jtbds/task-prioritization',
 *   $type: 'https://schema.org.ai/JTBD',
 *   situation: 'I have too many tasks',
 *   motivation: 'find the most important one',
 *   outcome: 'make meaningful progress',
 * }
 * ```
 */
export interface JTBDType extends Thing {
  /** Unique identifier URL */
  $id: string
  /** Type URL (https://schema.org.ai/JTBD) */
  $type: typeof JTBD_TYPE | string
  /** Schema URL reference for JSON-LD compatibility */
  $schema?: typeof JTBD_SCHEMA | string
  /** Situation - When... */
  situation: string
  /** Motivation - I want to... */
  motivation: string
  /** Outcome - So I can... */
  outcome: string
  /** Functional dimension - practical task completion */
  functional?: JobDimension
  /** Emotional dimension - feelings and peace of mind */
  emotional?: JobDimension
  /** Social dimension - how others perceive me */
  social?: JobDimension
  /** Priority rating (1-5) */
  priority?: number
  /** How often this job occurs */
  frequency?: JTBDFrequency
  /** Reference to persona/ICP this job belongs to */
  persona?: ICPType | string
}

/**
 * Type guard for JTBD
 *
 * Validates that a value conforms to the JTBDType interface.
 *
 * @param value - The value to check
 * @returns True if the value is a valid JTBD
 */
export function isJTBD(value: unknown): value is JTBDType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === JTBD_TYPE &&
    typeof v['situation'] === 'string' &&
    typeof v['motivation'] === 'string' &&
    typeof v['outcome'] === 'string'
  )
}

/** Counter for auto-generated JTBD IDs */
let jtbdCounter = 0

/**
 * Input type for createJTBD factory function
 */
export interface CreateJTBDInput {
  /** Situation - When... */
  situation: string
  /** Motivation - I want to... */
  motivation: string
  /** Outcome - So I can... */
  outcome: string
  /** Functional dimension */
  functional?: JobDimension
  /** Emotional dimension */
  emotional?: JobDimension
  /** Social dimension */
  social?: JobDimension
  /** Priority (1-5) */
  priority?: number
  /** Frequency */
  frequency?: JTBDFrequency
  /** Reference to persona/ICP */
  persona?: ICPType | string
  /** Custom $id (auto-generated if not provided) */
  $id?: string
}

/**
 * Factory function to create a JTBD
 *
 * Creates a new JTBD entity with auto-generated $id if not provided.
 *
 * @param opts - JTBD configuration options
 * @returns A fully-formed JTBDType entity
 */
export function createJTBD(opts: CreateJTBDInput): JTBDType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/jtbds/${++jtbdCounter}`,
    $type: JTBD_TYPE,
    $schema: JTBD_SCHEMA,
    situation: opts.situation,
    motivation: opts.motivation,
    outcome: opts.outcome,
    ...(opts.functional !== undefined && { functional: opts.functional }),
    ...(opts.emotional !== undefined && { emotional: opts.emotional }),
    ...(opts.social !== undefined && { social: opts.social }),
    ...(opts.priority !== undefined && { priority: opts.priority }),
    ...(opts.frequency !== undefined && { frequency: opts.frequency }),
    ...(opts.persona !== undefined && { persona: opts.persona }),
  }
}

/**
 * Format a JTBD as a statement string
 *
 * Converts JTBD fields into the standard "When [situation], I want to [motivation],
 * so I can [outcome]" format.
 *
 * @param jtbd - Object with situation, motivation, and outcome
 * @returns Formatted JTBD statement string
 *
 * @example
 * ```typescript
 * const statement = formatJTBDStatement({
 *   situation: 'I have too many tasks',
 *   motivation: 'find the most important one',
 *   outcome: 'make meaningful progress',
 * })
 * // Returns: "When I have too many tasks, I want to find the most important one, so I can make meaningful progress."
 * ```
 */
export function formatJTBDStatement(jtbd: {
  situation: string
  motivation: string
  outcome: string
}): string {
  return `When ${jtbd.situation}, I want to ${jtbd.motivation}, so I can ${jtbd.outcome}.`
}

// ============================================================================
// Role Types (schema.org.ai)
// ============================================================================

/** Type URL for Role */
export const ROLE_TYPE = 'https://schema.org.ai/Role' as const

/** Runtime marker for Role type */
export const RoleMarker = Symbol('Role')

/** Role status values */
export const RoleStatus = ['active', 'inactive', 'deprecated'] as const
export type RoleStatusType = (typeof RoleStatus)[number]

/** Role worker type preference */
export const RoleWorkerTypes = ['ai', 'human', 'hybrid'] as const
export type RoleWorkerTypeType = (typeof RoleWorkerTypes)[number]

/**
 * Role interface - job role definition for schema.org.ai
 * Extends Thing with role-specific fields
 */
export interface RoleType extends Thing {
  $id: string
  $type: typeof ROLE_TYPE
  /** Role name */
  name: string
  /** Role description */
  description: string
  /** Skills required for this role */
  skills: string[]
  /** Role status */
  status?: RoleStatusType
  /** Permissions granted to this role */
  permissions?: string[]
  /** Tools available to this role */
  tools?: string[]
  /** Expected outputs from this role */
  outputs?: string[]
  /** Role type classification (ceo, engineer, etc.) */
  roleType?: string
  /** Department this role belongs to */
  department?: string
  /** List of responsibilities */
  responsibilities?: string[]
  /** Types of tasks this role can handle */
  canHandle?: string[]
  /** Types of tasks this role can delegate */
  canDelegate?: string[]
  /** Types of requests this role can approve */
  canApprove?: string[]
  /** Role ID to escalate issues to */
  escalateTo?: string
  /** Role ID this role reports to */
  reportsTo?: string
  /** Hierarchical level (higher = more senior) */
  level?: number
  /** Preferred worker type for this role */
  workerType?: RoleWorkerTypeType
}

/** Role Zod Schema */
export const RoleSchema = z.object({
  $id: z.string().url(),
  $type: z.literal(ROLE_TYPE),
  name: z.string(),
  description: z.string(),
  skills: z.array(z.string()),
  status: z.enum(RoleStatus).optional(),
  permissions: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  roleType: z.string().optional(),
  department: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  canHandle: z.array(z.string()).optional(),
  canDelegate: z.array(z.string()).optional(),
  canApprove: z.array(z.string()).optional(),
  escalateTo: z.string().optional(),
  reportsTo: z.string().optional(),
  level: z.number().optional(),
  workerType: z.enum(RoleWorkerTypes).optional(),
  // Thing properties
  data: z.record(z.unknown()).optional(),
  visibility: z.enum(['public', 'unlisted', 'org', 'user']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
})

/**
 * Type guard for Role (schema.org.ai version)
 */
export function isRoleType(value: unknown): value is RoleType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === ROLE_TYPE &&
    typeof v['name'] === 'string' &&
    typeof v['description'] === 'string' &&
    Array.isArray(v['skills'])
  )
}

/** Counter for auto-generated role IDs */
let roleTypeCounter = 0

/**
 * Factory function to create a Role (schema.org.ai version)
 */
export function createRoleType(opts: {
  name: string
  description: string
  skills: string[]
  status?: RoleStatusType
  permissions?: string[]
  tools?: string[]
  outputs?: string[]
  roleType?: string
  department?: string
  responsibilities?: string[]
  canHandle?: string[]
  canDelegate?: string[]
  canApprove?: string[]
  escalateTo?: string
  reportsTo?: string
  level?: number
  workerType?: RoleWorkerTypeType
  $id?: string
}): RoleType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/roles/${++roleTypeCounter}`,
    $type: ROLE_TYPE,
    name: opts.name,
    description: opts.description,
    skills: opts.skills,
    ...(opts.status !== undefined && { status: opts.status }),
    ...(opts.permissions !== undefined && { permissions: opts.permissions }),
    ...(opts.tools !== undefined && { tools: opts.tools }),
    ...(opts.outputs !== undefined && { outputs: opts.outputs }),
    ...(opts.roleType !== undefined && { roleType: opts.roleType }),
    ...(opts.department !== undefined && { department: opts.department }),
    ...(opts.responsibilities !== undefined && { responsibilities: opts.responsibilities }),
    ...(opts.canHandle !== undefined && { canHandle: opts.canHandle }),
    ...(opts.canDelegate !== undefined && { canDelegate: opts.canDelegate }),
    ...(opts.canApprove !== undefined && { canApprove: opts.canApprove }),
    ...(opts.escalateTo !== undefined && { escalateTo: opts.escalateTo }),
    ...(opts.reportsTo !== undefined && { reportsTo: opts.reportsTo }),
    ...(opts.level !== undefined && { level: opts.level }),
    ...(opts.workerType !== undefined && { workerType: opts.workerType }),
  }
}

// ============================================================================
// Team Types (schema.org.ai)
// ============================================================================

/** Type URL for Team */
export const TEAM_TYPE = 'https://schema.org.ai/Team' as const

/** Runtime marker for Team type */
export const TeamMarker = Symbol('Team')

/** Team member status values */
export const TeamMemberStatus = ['active', 'inactive', 'pending'] as const
export type TeamMemberStatusType = (typeof TeamMemberStatus)[number]

/** Team member availability values */
export const TeamMemberAvailability = ['available', 'busy', 'away', 'offline'] as const
export type TeamMemberAvailabilityType = (typeof TeamMemberAvailability)[number]

/** Team member type */
export const TeamMemberTypes = ['human', 'agent'] as const
export type TeamMemberTypesType = (typeof TeamMemberTypes)[number]

/**
 * Team member reference
 */
export interface TeamMemberRef {
  /** Member identifier */
  id: string
  /** Member name */
  name: string
  /** Role in the team */
  role?: string
  /** Member type (human or agent) */
  type: TeamMemberTypesType
  /** Current status */
  status?: TeamMemberStatusType
  /** Current availability */
  availability?: TeamMemberAvailabilityType
}

/**
 * Team interface - team/group definition for schema.org.ai
 * Extends Thing with team-specific fields
 */
export interface TeamType extends Thing {
  $id: string
  $type: typeof TEAM_TYPE
  /** Team name */
  name: string
  /** Team description */
  description?: string
  /** List of team members */
  members: TeamMemberRef[]
  /** Team lead */
  lead?: TeamMemberRef
  /** Team goals (as URLs to Goal entities) */
  goals?: string[]
  /** Communication channels */
  channels?: Array<{ id: string; type: string; config?: Record<string, unknown> }>
  /** Contact information (channel -> address) */
  contacts?: Record<string, string>
  /** Shared team context */
  context?: Record<string, unknown>
}

/** Team Zod Schema */
export const TeamSchema = z.object({
  $id: z.string().url(),
  $type: z.literal(TEAM_TYPE),
  name: z.string(),
  description: z.string().optional(),
  members: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      role: z.string().optional(),
      type: z.enum(TeamMemberTypes),
      status: z.enum(TeamMemberStatus).optional(),
      availability: z.enum(TeamMemberAvailability).optional(),
    })
  ),
  lead: z
    .object({
      id: z.string(),
      name: z.string(),
      role: z.string().optional(),
      type: z.enum(TeamMemberTypes),
      status: z.enum(TeamMemberStatus).optional(),
      availability: z.enum(TeamMemberAvailability).optional(),
    })
    .optional(),
  goals: z.array(z.string()).optional(),
  channels: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        config: z.record(z.unknown()).optional(),
      })
    )
    .optional(),
  contacts: z.record(z.string()).optional(),
  context: z.record(z.unknown()).optional(),
  // Thing properties
  data: z.record(z.unknown()).optional(),
  visibility: z.enum(['public', 'unlisted', 'org', 'user']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
})

/**
 * Type guard for Team (schema.org.ai version)
 */
export function isTeamType(value: unknown): value is TeamType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === TEAM_TYPE &&
    typeof v['name'] === 'string' &&
    Array.isArray(v['members'])
  )
}

/** Counter for auto-generated team IDs */
let teamTypeCounter = 0

/**
 * Factory function to create a Team (schema.org.ai version)
 */
export function createTeamType(opts: {
  name: string
  description?: string
  members: TeamMemberRef[]
  lead?: TeamMemberRef
  goals?: string[]
  channels?: Array<{ id: string; type: string; config?: Record<string, unknown> }>
  contacts?: Record<string, string>
  context?: Record<string, unknown>
  $id?: string
}): TeamType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/teams/${++teamTypeCounter}`,
    $type: TEAM_TYPE,
    name: opts.name,
    members: opts.members,
    ...(opts.description !== undefined && { description: opts.description }),
    ...(opts.lead !== undefined && { lead: opts.lead }),
    ...(opts.goals !== undefined && { goals: opts.goals }),
    ...(opts.channels !== undefined && { channels: opts.channels }),
    ...(opts.contacts !== undefined && { contacts: opts.contacts }),
    ...(opts.context !== undefined && { context: opts.context }),
  }
}

// ============================================================================
// Task Types (schema.org.ai)
// ============================================================================

/** Type URL for Task */
export const TASK_TYPE = 'https://schema.org.ai/Task' as const

/** Runtime marker for Task type */
export const TaskMarker = Symbol('Task')

/** Task status values */
export const TaskStatus = [
  'pending',
  'assigned',
  'in_progress',
  'blocked',
  'completed',
  'cancelled',
  'failed',
] as const
export type TaskStatusType = (typeof TaskStatus)[number]

/** Task priority values */
export const TaskPriority = ['low', 'normal', 'high', 'urgent', 'critical'] as const
export type TaskPriorityType = (typeof TaskPriority)[number]

/**
 * Task interface - work item definition for schema.org.ai
 * Extends Thing with task-specific fields
 */
export interface TaskType extends Thing {
  $id: string
  $type: typeof TASK_TYPE
  /** Task title/name */
  name: string
  /** Task description */
  description?: string
  /** Task status */
  status: TaskStatusType
  /** Task priority */
  priority?: TaskPriorityType
  /** Reference to assigned worker */
  assignee?: string
  /** Reference to who created the task */
  createdBy?: string
  /** Reference to parent task (for subtasks) */
  parentTask?: string
  /** References to child/subtasks */
  subtasks?: string[]
  /** References to blocking tasks */
  blockedBy?: string[]
  /** References to tasks this blocks */
  blocks?: string[]
  /** Reference to team this task belongs to */
  team?: string
  /** Required skills to complete this task */
  requiredSkills?: string[]
  /** Required tools to complete this task */
  requiredTools?: string[]
  /** Estimated duration in minutes */
  estimatedDuration?: number
  /** Actual duration in minutes */
  actualDuration?: number
  /** Due date */
  dueDate?: Date
  /** Started at timestamp */
  startedAt?: Date
  /** Completed at timestamp */
  completedAt?: Date
  /** Task input data */
  input?: Record<string, unknown>
  /** Task output/result */
  output?: Record<string, unknown>
  /** Error information if failed */
  error?: { message: string; code?: string; stack?: string }
  /** Task tags for categorization */
  tags?: string[]
}

/** Task Zod Schema */
export const TaskSchema = z.object({
  $id: z.string().url(),
  $type: z.literal(TASK_TYPE),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(TaskStatus),
  priority: z.enum(TaskPriority).optional(),
  assignee: z.string().optional(),
  createdBy: z.string().optional(),
  parentTask: z.string().optional(),
  subtasks: z.array(z.string()).optional(),
  blockedBy: z.array(z.string()).optional(),
  blocks: z.array(z.string()).optional(),
  team: z.string().optional(),
  requiredSkills: z.array(z.string()).optional(),
  requiredTools: z.array(z.string()).optional(),
  estimatedDuration: z.number().optional(),
  actualDuration: z.number().optional(),
  dueDate: z.date().optional(),
  startedAt: z.date().optional(),
  completedAt: z.date().optional(),
  input: z.record(z.unknown()).optional(),
  output: z.record(z.unknown()).optional(),
  error: z
    .object({
      message: z.string(),
      code: z.string().optional(),
      stack: z.string().optional(),
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  // Thing properties
  data: z.record(z.unknown()).optional(),
  visibility: z.enum(['public', 'unlisted', 'org', 'user']).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
})

/**
 * Type guard for Task
 */
export function isTaskType(value: unknown): value is TaskType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === TASK_TYPE &&
    typeof v['name'] === 'string' &&
    typeof v['status'] === 'string' &&
    (TaskStatus as readonly string[]).includes(v['status'] as string)
  )
}

/** Counter for auto-generated task IDs */
let taskTypeCounter = 0

/**
 * Factory function to create a Task
 */
export function createTaskType(opts: {
  name: string
  status: TaskStatusType
  description?: string
  priority?: TaskPriorityType
  assignee?: string
  createdBy?: string
  parentTask?: string
  subtasks?: string[]
  blockedBy?: string[]
  blocks?: string[]
  team?: string
  requiredSkills?: string[]
  requiredTools?: string[]
  estimatedDuration?: number
  dueDate?: Date
  input?: Record<string, unknown>
  tags?: string[]
  $id?: string
}): TaskType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/tasks/${++taskTypeCounter}`,
    $type: TASK_TYPE,
    name: opts.name,
    status: opts.status,
    ...(opts.description !== undefined && { description: opts.description }),
    ...(opts.priority !== undefined && { priority: opts.priority }),
    ...(opts.assignee !== undefined && { assignee: opts.assignee }),
    ...(opts.createdBy !== undefined && { createdBy: opts.createdBy }),
    ...(opts.parentTask !== undefined && { parentTask: opts.parentTask }),
    ...(opts.subtasks !== undefined && { subtasks: opts.subtasks }),
    ...(opts.blockedBy !== undefined && { blockedBy: opts.blockedBy }),
    ...(opts.blocks !== undefined && { blocks: opts.blocks }),
    ...(opts.team !== undefined && { team: opts.team }),
    ...(opts.requiredSkills !== undefined && { requiredSkills: opts.requiredSkills }),
    ...(opts.requiredTools !== undefined && { requiredTools: opts.requiredTools }),
    ...(opts.estimatedDuration !== undefined && { estimatedDuration: opts.estimatedDuration }),
    ...(opts.dueDate !== undefined && { dueDate: opts.dueDate }),
    ...(opts.input !== undefined && { input: opts.input }),
    ...(opts.tags !== undefined && { tags: opts.tags }),
  }
}

// ============================================================================
// Digital Products Types (Service, Product, Feature, Offer)
// ============================================================================

/** Type URL for Service */
export const SERVICE_TYPE = 'https://schema.org.ai/Service' as const

/** Type URL for Product */
export const PRODUCT_TYPE = 'https://schema.org.ai/Product' as const

/** Type URL for Feature */
export const FEATURE_TYPE = 'https://schema.org.ai/Feature' as const

/** Type URL for Offer */
export const OFFER_TYPE = 'https://schema.org.ai/Offer' as const

/** Runtime marker for Service type */
export const Service = Symbol('Service')

/** Runtime marker for ServiceType (for tests that import ServiceType) */
export const ServiceType = Symbol('ServiceType')

/** Runtime marker for Product type */
export const Product = Symbol('Product')

/** Runtime marker for ProductType (for tests that import ProductType) */
export const ProductType = Symbol('ProductType')

/** Runtime marker for Feature type */
export const Feature = Symbol('Feature')

/** Runtime marker for FeatureType (for tests that import FeatureType) */
export const FeatureType = Symbol('FeatureType')

/** Runtime marker for Offer type */
export const Offer = Symbol('Offer')

/** Runtime marker for OfferType (for tests that import OfferType) */
export const OfferType = Symbol('OfferType')

/** Feature type classification */
export type FeatureTypeKind = 'boolean' | 'metered' | 'unlimited'

/**
 * Provider reference for services
 */
export interface ProviderRef {
  $id: string
  $type: string
  name?: string
}

/**
 * Service interface - a digital service offering
 * Extends Thing with service-specific fields
 */
export interface ServiceType extends Thing {
  $id: string
  $type: typeof SERVICE_TYPE
  /** Service name */
  name: string
  /** Service description */
  description?: string
  /** Provider of the service */
  provider: ProviderRef
  /** Products offered by this service */
  offers?: ProductType[]
  /** Features included in this service */
  features?: FeatureType[]
  /** Service category */
  category?: string
  /** Service URL */
  url?: string
  /** Terms of service URL */
  termsOfService?: string
  /** Support email */
  supportEmail?: string
}

/**
 * Offer interface - pricing/offering for a product
 * Extends Thing with offer-specific fields
 */
export interface OfferType extends Thing {
  $id: string
  $type: typeof OFFER_TYPE
  /** Price amount */
  price: number
  /** Currency code (e.g., 'USD') */
  priceCurrency: string
  /** Billing interval (e.g., 'month', 'year') */
  billingInterval?: string
  /** Free trial period in days */
  trialPeriodDays?: number
  /** Whether the offer is currently available */
  availability?: string
  /** Valid from date */
  validFrom?: Date
  /** Valid through date */
  validThrough?: Date
}

/**
 * Product interface - a purchasable product/plan
 * Extends Thing with product-specific fields
 */
export interface ProductType extends Thing {
  $id: string
  $type: typeof PRODUCT_TYPE
  /** Product name */
  name: string
  /** Product description */
  description?: string
  /** Pricing offers for this product */
  offers?: OfferType | OfferType[]
  /** Features included in this product */
  features?: FeatureType[]
  /** Back-reference to service */
  service?: ServiceType
  /** Product SKU */
  sku?: string
  /** Product category */
  category?: string
  /** Brand name */
  brand?: string
}

/**
 * Feature interface - a capability/feature of a service or product
 * Extends Thing with feature-specific fields
 */
export interface FeatureType extends Thing {
  $id: string
  $type: typeof FEATURE_TYPE
  /** Feature name */
  name: string
  /** Feature description */
  description?: string
  /** Feature type classification */
  featureType?: FeatureTypeKind
  /** Limit for metered features */
  limit?: number
  /** Unit for metered features (e.g., 'API calls', 'GB') */
  unit?: string
  /** Whether the feature is enabled */
  enabled?: boolean
  /** Back-reference to products that have this feature */
  products?: Array<{ $id: string }>
  /** Back-reference to services that have this feature */
  services?: Array<{ $id: string }>
}

/**
 * Type guard for Service
 */
export function isService(value: unknown): value is ServiceType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === SERVICE_TYPE &&
    typeof v['name'] === 'string' &&
    typeof v['provider'] === 'object' &&
    v['provider'] !== null
  )
}

/**
 * Type guard for Product
 */
export function isProduct(value: unknown): value is ProductType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === PRODUCT_TYPE &&
    typeof v['name'] === 'string'
  )
}

/**
 * Type guard for Feature
 */
export function isFeature(value: unknown): value is FeatureType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === FEATURE_TYPE &&
    typeof v['name'] === 'string'
  )
}

/**
 * Type guard for Offer
 */
export function isOffer(value: unknown): value is OfferType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === OFFER_TYPE &&
    typeof v['price'] === 'number' &&
    typeof v['priceCurrency'] === 'string'
  )
}

/** Counter for auto-generated service IDs */
let serviceCounter = 0

/** Counter for auto-generated product IDs */
let productCounter = 0

/** Counter for auto-generated feature IDs */
let featureCounter = 0

/** Counter for auto-generated offer IDs */
let offerCounter = 0

/**
 * Factory function to create a Service
 */
export function createService(opts: {
  name: string
  provider: ProviderRef
  description?: string
  offers?: ProductType[]
  features?: FeatureType[]
  category?: string
  url?: string
  termsOfService?: string
  supportEmail?: string
  $id?: string
}): ServiceType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/services/${++serviceCounter}`,
    $type: SERVICE_TYPE,
    name: opts.name,
    provider: opts.provider,
    ...(opts.description !== undefined && { description: opts.description }),
    ...(opts.offers !== undefined && { offers: opts.offers }),
    ...(opts.features !== undefined && { features: opts.features }),
    ...(opts.category !== undefined && { category: opts.category }),
    ...(opts.url !== undefined && { url: opts.url }),
    ...(opts.termsOfService !== undefined && { termsOfService: opts.termsOfService }),
    ...(opts.supportEmail !== undefined && { supportEmail: opts.supportEmail }),
  }
}

/**
 * Factory function to create a Product
 */
export function createProduct(opts: {
  name: string
  description?: string
  offers?: OfferType | OfferType[]
  features?: FeatureType[]
  service?: ServiceType
  sku?: string
  category?: string
  brand?: string
  $id?: string
}): ProductType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/products/${++productCounter}`,
    $type: PRODUCT_TYPE,
    name: opts.name,
    ...(opts.description !== undefined && { description: opts.description }),
    ...(opts.offers !== undefined && { offers: opts.offers }),
    ...(opts.features !== undefined && { features: opts.features }),
    ...(opts.service !== undefined && { service: opts.service }),
    ...(opts.sku !== undefined && { sku: opts.sku }),
    ...(opts.category !== undefined && { category: opts.category }),
    ...(opts.brand !== undefined && { brand: opts.brand }),
  }
}

/**
 * Factory function to create a Feature
 */
export function createFeature(opts: {
  name: string
  description?: string
  featureType?: FeatureTypeKind
  limit?: number
  unit?: string
  enabled?: boolean
  products?: Array<{ $id: string }>
  services?: Array<{ $id: string }>
  $id?: string
}): FeatureType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/features/${++featureCounter}`,
    $type: FEATURE_TYPE,
    name: opts.name,
    ...(opts.description !== undefined && { description: opts.description }),
    ...(opts.featureType !== undefined && { featureType: opts.featureType }),
    ...(opts.limit !== undefined && { limit: opts.limit }),
    ...(opts.unit !== undefined && { unit: opts.unit }),
    ...(opts.enabled !== undefined && { enabled: opts.enabled }),
    ...(opts.products !== undefined && { products: opts.products }),
    ...(opts.services !== undefined && { services: opts.services }),
  }
}

/**
 * Factory function to create an Offer
 */
export function createOffer(opts: {
  price: number
  priceCurrency: string
  billingInterval?: string
  trialPeriodDays?: number
  availability?: string
  validFrom?: Date
  validThrough?: Date
  $id?: string
}): OfferType {
  return {
    $id: opts.$id ?? `https://schema.org.ai/offers/${++offerCounter}`,
    $type: OFFER_TYPE,
    price: opts.price,
    priceCurrency: opts.priceCurrency,
    ...(opts.billingInterval !== undefined && { billingInterval: opts.billingInterval }),
    ...(opts.trialPeriodDays !== undefined && { trialPeriodDays: opts.trialPeriodDays }),
    ...(opts.availability !== undefined && { availability: opts.availability }),
    ...(opts.validFrom !== undefined && { validFrom: opts.validFrom }),
    ...(opts.validThrough !== undefined && { validThrough: opts.validThrough }),
  }
}

// ============================================================================
// Employee Types (aip-aure)
// ============================================================================

/** Runtime marker for Employee type */
export const EmployeeMarker = Symbol('Employee')

/** Type URL for Employee */
export const EMPLOYEE_TYPE = 'https://schema.org.ai/Employee'

/** Employee status values */
export const EmployeeStatusValues = ['active', 'on-leave', 'terminated', 'pending'] as const
export type EmployeeStatus = (typeof EmployeeStatusValues)[number]

/** Employee type values (employment type) */
export const EmployeeTypeValues = ['full-time', 'part-time', 'contractor', 'intern'] as const
export type EmployeeTypeKind = (typeof EmployeeTypeValues)[number]

/**
 * Employee entity - represents a person employed by an organization
 *
 * Extends Thing with employee-specific fields for HR management,
 * organizational hierarchy, and compensation tracking.
 */
export interface EmployeeType extends Thing {
  /** Unique identifier */
  $id: string
  /** Type URL (https://schema.org.ai/Employee) */
  $type: string
  /** First name */
  firstName: string
  /** Last name */
  lastName: string
  /** Work email address */
  email: string
  /** Employment status */
  status: EmployeeStatus
  /** Employment type */
  employmentType: EmployeeTypeKind
  /** Date employee was hired */
  hireDate: Date
  /** Department name */
  department?: string
  /** Team name */
  team?: string
  /** Job title */
  title?: string
  /** Seniority level */
  level?: string
  /** ID of the employee's manager */
  managerId?: string
  /** Work location */
  location?: string
  /** Timezone (e.g., 'America/Los_Angeles') */
  timezone?: string
  /** Base salary amount */
  salary?: number
  /** Salary currency code (e.g., 'USD') */
  currency?: string
  /** Date of termination (if terminated) */
  terminationDate?: Date
  /** Termination reason (if terminated) */
  terminationReason?: string
}

/**
 * Employee definition for creating new employees
 */
export interface EmployeeDefinition {
  firstName: string
  lastName: string
  email: string
  employmentType: EmployeeTypeKind
  department?: string
  team?: string
  title?: string
  level?: string
  managerId?: string
  status?: EmployeeStatus
  hireDate?: Date
  location?: string
  timezone?: string
  salary?: number
  currency?: string
}

/**
 * Type guard for Employee
 */
export function isEmployeeType(value: unknown): value is EmployeeType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === EMPLOYEE_TYPE &&
    typeof v['firstName'] === 'string' &&
    typeof v['lastName'] === 'string' &&
    typeof v['email'] === 'string' &&
    typeof v['status'] === 'string' &&
    EmployeeStatusValues.includes(v['status'] as EmployeeStatus) &&
    typeof v['employmentType'] === 'string' &&
    EmployeeTypeValues.includes(v['employmentType'] as EmployeeTypeKind)
  )
}

let employeeTypeCounter = 0

/**
 * Factory function to create an Employee
 */
export function createEmployeeType(opts: EmployeeDefinition & { $id?: string }): EmployeeType {
  if (!opts.email) {
    throw new Error('Employee email is required')
  }
  return {
    $id: opts.$id ?? `https://schema.org.ai/employees/${++employeeTypeCounter}`,
    $type: EMPLOYEE_TYPE,
    firstName: opts.firstName,
    lastName: opts.lastName,
    email: opts.email,
    status: opts.status ?? 'active',
    employmentType: opts.employmentType,
    hireDate: opts.hireDate ?? new Date(),
    ...(opts.department !== undefined && { department: opts.department }),
    ...(opts.team !== undefined && { team: opts.team }),
    ...(opts.title !== undefined && { title: opts.title }),
    ...(opts.level !== undefined && { level: opts.level }),
    ...(opts.managerId !== undefined && { managerId: opts.managerId }),
    ...(opts.location !== undefined && { location: opts.location }),
    ...(opts.timezone !== undefined && { timezone: opts.timezone }),
    ...(opts.salary !== undefined && { salary: opts.salary }),
    ...(opts.currency !== undefined && { currency: opts.currency }),
  }
}

// ============================================================================
// Customer Types (aip-aure)
// ============================================================================

/** Runtime marker for Customer type */
export const CustomerMarker = Symbol('Customer')

/** Type URL for Customer */
export const CUSTOMER_TYPE = 'https://schema.org.ai/Customer'

/** Customer status values */
export const CustomerStatusValues = [
  'prospect',
  'trial',
  'active',
  'churned',
  'at-risk',
  'paused',
] as const
export type CustomerStatusType = (typeof CustomerStatusValues)[number]

/** Customer segment values */
export const CustomerSegmentValues = [
  'enterprise',
  'mid-market',
  'smb',
  'startup',
  'consumer',
] as const
export type CustomerSegmentType = (typeof CustomerSegmentValues)[number]

/** Customer tier values */
export const CustomerTierValues = ['free', 'basic', 'pro', 'premium', 'enterprise'] as const
export type CustomerTierType = (typeof CustomerTierValues)[number]

/** Churn risk levels */
export const ChurnRiskValues = ['low', 'medium', 'high', 'critical'] as const
export type ChurnRiskType = (typeof ChurnRiskValues)[number]

/**
 * Customer entity - represents a customer of a business
 *
 * Extends Thing with customer-specific fields for CRM,
 * revenue tracking, and customer success management.
 */
export interface CustomerEntityType extends Thing {
  /** Unique identifier */
  $id: string
  /** Type URL (https://schema.org.ai/Customer) */
  $type: string
  /** Customer/company name */
  name: string
  /** Primary contact email */
  email: string
  /** Customer lifecycle status */
  status: CustomerStatusType
  /** Market segment */
  segment: CustomerSegmentType
  /** Subscription/service tier */
  tier?: CustomerTierType | string
  /** Date customer was created */
  createdAt: Date
  /** Industry/sector */
  industry?: string
  /** Company size (e.g., '1-10', '11-50', '51-200') */
  companySize?: string
  /** Annual revenue in base currency */
  annualRevenue?: number
  /** Company website URL */
  website?: string
  /** Customer health score (0-100) */
  healthScore?: number
  /** Net Promoter Score (-100 to 100) */
  nps?: number
  /** Customer lifetime value */
  lifetimeValue?: number
  /** Monthly recurring revenue */
  mrr?: number
  /** Annual recurring revenue */
  arr?: number
  /** Churn risk assessment */
  churnRisk?: ChurnRiskType | string
  /** Date customer churned (if churned) */
  churnDate?: Date
  /** Reason for churn (if churned) */
  churnReason?: string
  /** Primary contact name */
  contactName?: string
  /** Primary contact phone */
  contactPhone?: string
  /** Billing address */
  billingAddress?: string
  /** Account manager ID */
  accountManagerId?: string
}

/**
 * Customer definition for creating new customers
 */
export interface CustomerEntityDefinition {
  name: string
  email: string
  segment: CustomerSegmentType
  tier?: CustomerTierType | string
  status?: CustomerStatusType
  industry?: string
  companySize?: string
  mrr?: number
  arr?: number
  website?: string
  contactName?: string
}

/**
 * Type guard for Customer
 */
export function isCustomerType(value: unknown): value is CustomerEntityType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === CUSTOMER_TYPE &&
    typeof v['name'] === 'string' &&
    typeof v['email'] === 'string' &&
    typeof v['status'] === 'string' &&
    CustomerStatusValues.includes(v['status'] as CustomerStatusType) &&
    typeof v['segment'] === 'string' &&
    CustomerSegmentValues.includes(v['segment'] as CustomerSegmentType)
  )
}

let customerTypeCounter = 0

/**
 * Factory function to create a Customer
 */
export function createCustomerType(
  opts: CustomerEntityDefinition & { $id?: string }
): CustomerEntityType {
  if (!opts.name) {
    throw new Error('Customer name is required')
  }
  return {
    $id: opts.$id ?? `https://schema.org.ai/customers/${++customerTypeCounter}`,
    $type: CUSTOMER_TYPE,
    name: opts.name,
    email: opts.email,
    status: opts.status ?? 'prospect',
    segment: opts.segment,
    createdAt: new Date(),
    ...(opts.tier !== undefined && { tier: opts.tier }),
    ...(opts.industry !== undefined && { industry: opts.industry }),
    ...(opts.companySize !== undefined && { companySize: opts.companySize }),
    ...(opts.mrr !== undefined && { mrr: opts.mrr }),
    ...(opts.arr !== undefined && { arr: opts.arr }),
    ...(opts.website !== undefined && { website: opts.website }),
    ...(opts.contactName !== undefined && { contactName: opts.contactName }),
  }
}

// ============================================================================
// Goal Types (aip-aure)
// ============================================================================

/** Runtime marker for Goal type */
export const GoalMarker = Symbol('Goal')

/** Type URL for Goal */
export const GOAL_TYPE = 'https://schema.org.ai/Goal'

/** Goal status values */
export const GoalStatusValues = [
  'draft',
  'active',
  'in-progress',
  'at-risk',
  'behind',
  'completed',
  'cancelled',
  'deferred',
] as const
export type GoalStatusType = (typeof GoalStatusValues)[number]

/** Goal priority values */
export const GoalPriorityValues = ['critical', 'high', 'medium', 'low'] as const
export type GoalPriorityType = (typeof GoalPriorityValues)[number]

/** Goal level values (organizational hierarchy) */
export const GoalLevelValues = ['company', 'department', 'team', 'individual'] as const
export type GoalLevelType = (typeof GoalLevelValues)[number]

/**
 * Goal entity - represents a measurable objective
 *
 * Extends Thing with goal-specific fields for OKR/goal management,
 * supporting hierarchical goals with alignment and progress tracking.
 */
export interface GoalEntityType extends Thing {
  /** Unique identifier */
  $id: string
  /** Type URL (https://schema.org.ai/Goal) */
  $type: string
  /** Goal name/title */
  name: string
  /** Goal status */
  status: GoalStatusType
  /** Priority level */
  priority: GoalPriorityType
  /** Progress percentage (0-100) */
  progress: number
  /** Detailed description */
  description?: string
  /** Parent goal ID (for hierarchy) */
  parentId?: string
  /** Organizational level */
  level?: GoalLevelType
  /** Owner (employee/user) ID */
  ownerId?: string
  /** Team ID */
  teamId?: string
  /** Department ID */
  departmentId?: string
  /** IDs of goals this is aligned to */
  alignedTo?: string[]
  /** IDs of child goals */
  children?: string[]
  /** IDs of goals this depends on */
  dependencies?: string[]
  /** Target value (for measurable goals) */
  targetValue?: number
  /** Current value (for measurable goals) */
  currentValue?: number
  /** Unit of measurement */
  unit?: string
  /** Goal start date */
  startDate?: Date
  /** Target completion date */
  targetDate?: Date
  /** IDs of associated metrics */
  metrics?: string[]
  /** Weight for weighted progress rollup */
  weight?: number
  /** Key results (for OKR-style goals) */
  keyResults?: string[]
  /** Initiatives/projects supporting this goal */
  initiatives?: string[]
}

/**
 * Goal definition for creating new goals
 */
export interface GoalEntityDefinition {
  name: string
  priority: GoalPriorityType
  status?: GoalStatusType
  progress?: number
  description?: string
  parentId?: string
  level?: GoalLevelType
  ownerId?: string
  teamId?: string
  departmentId?: string
  alignedTo?: string[]
  children?: string[]
  dependencies?: string[]
  targetValue?: number
  currentValue?: number
  unit?: string
  startDate?: Date
  targetDate?: Date
  metrics?: string[]
  weight?: number
}

/**
 * Type guard for Goal
 */
export function isGoalType(value: unknown): value is GoalEntityType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['$id'] === 'string' &&
    typeof v['$type'] === 'string' &&
    v['$type'] === GOAL_TYPE &&
    typeof v['name'] === 'string' &&
    typeof v['status'] === 'string' &&
    GoalStatusValues.includes(v['status'] as GoalStatusType) &&
    typeof v['priority'] === 'string' &&
    GoalPriorityValues.includes(v['priority'] as GoalPriorityType) &&
    typeof v['progress'] === 'number'
  )
}

let goalTypeCounter = 0

/**
 * Factory function to create a Goal
 */
export function createGoalType(
  opts: GoalEntityDefinition & { $id?: string; id?: string }
): GoalEntityType {
  return {
    $id: opts.$id ?? opts.id ?? `https://schema.org.ai/goals/${++goalTypeCounter}`,
    $type: GOAL_TYPE,
    name: opts.name,
    status: opts.status ?? 'active',
    priority: opts.priority,
    progress: opts.progress ?? 0,
    ...(opts.description !== undefined && { description: opts.description }),
    ...(opts.parentId !== undefined && { parentId: opts.parentId }),
    ...(opts.level !== undefined && { level: opts.level }),
    ...(opts.ownerId !== undefined && { ownerId: opts.ownerId }),
    ...(opts.teamId !== undefined && { teamId: opts.teamId }),
    ...(opts.departmentId !== undefined && { departmentId: opts.departmentId }),
    ...(opts.alignedTo !== undefined && { alignedTo: opts.alignedTo }),
    ...(opts.children !== undefined && { children: opts.children }),
    ...(opts.dependencies !== undefined && { dependencies: opts.dependencies }),
    ...(opts.targetValue !== undefined && { targetValue: opts.targetValue }),
    ...(opts.currentValue !== undefined && { currentValue: opts.currentValue }),
    ...(opts.unit !== undefined && { unit: opts.unit }),
    ...(opts.startDate !== undefined && { startDate: opts.startDate }),
    ...(opts.targetDate !== undefined && { targetDate: opts.targetDate }),
    ...(opts.metrics !== undefined && { metrics: opts.metrics }),
    ...(opts.weight !== undefined && { weight: opts.weight }),
  }
}

/**
 * Helper function to calculate goal progress from current/target values
 */
export function calculateGoalProgress(goal: GoalEntityType): number {
  if (goal.targetValue && goal.currentValue !== undefined) {
    return Math.round((goal.currentValue / goal.targetValue) * 100)
  }
  return goal.progress
}

/**
 * Helper function to get goals at risk or behind schedule
 */
export function getGoalsAtRisk(goals: GoalEntityType[]): GoalEntityType[] {
  return goals.filter((g) => g.status === 'at-risk' || g.status === 'behind')
}

/**
 * Helper function to get goals by owner
 */
export function getGoalsByOwner(goals: GoalEntityType[], ownerId: string): GoalEntityType[] {
  return goals.filter((g) => g.ownerId === ownerId)
}

/**
 * Helper function to get goals by status
 */
export function getGoalsByStatus(
  goals: GoalEntityType[],
  status: GoalStatusType
): GoalEntityType[] {
  return goals.filter((g) => g.status === status)
}

/**
 * Helper function to roll up progress from child goals
 */
export function rollupGoalProgress(
  parent: GoalEntityType,
  children: GoalEntityType[],
  options?: { weighted?: boolean }
): number {
  if (children.length === 0) return 0
  if (options?.weighted) {
    const totalWeight = children.reduce((sum, c) => sum + (c.weight || 0), 0)
    if (totalWeight === 0) return 0
    return children.reduce((sum, c) => sum + c.progress * (c.weight || 0), 0) / totalWeight
  }
  return children.reduce((sum, c) => sum + c.progress, 0) / children.length
}
