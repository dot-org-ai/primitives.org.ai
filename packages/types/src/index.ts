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
 */
export interface Thing {
  /** Fully qualified URL (unique identity) */
  $id: string
  /** Noun URL (schema reference) */
  $type: string
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
// Startup Types (aip-unce)
// ============================================================================

/** Runtime marker for Startup type */
export const Startup = Symbol('Startup')

/** Runtime marker for StartupStage type */
export const StartupStage = Symbol('StartupStage')

/** Type URL for Startup */
export const STARTUP_TYPE = 'https://schema.org.ai/Startup'

/**
 * Startup lifecycle stages
 */
export type StartupStageType = 'idea' | 'validating' | 'building' | 'scaling' | 'established'

/**
 * Startup entity with lifecycle states
 *
 * Represents a startup company with its current stage in the lifecycle.
 */
export interface StartupType extends Thing {
  /** Unique identifier URL */
  $id: string
  /** Type URL (https://schema.org.ai/Startup) */
  $type: string
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
    ['idea', 'validating', 'building', 'scaling', 'established'].includes(v['stage'] as string)
  )
}

// ============================================================================
// ICP (Ideal Customer Profile) Types (aip-unce)
// ============================================================================

/** Runtime marker for ICP type */
export const ICP = Symbol('ICP')

/** Type URL for ICP */
export const ICP_TYPE = 'https://schema.org.ai/ICP'

/**
 * Ideal Customer Profile (ICP) with as/at/are/using/to framework
 *
 * Describes the ideal customer for a startup using a structured framework:
 * - as: persona/role description (who they are)
 * - at: company/context description (where they work)
 * - are: current state/pain points (their situation)
 * - using: current solutions (what they use today)
 * - to: desired outcome/job to be done (what they want to achieve)
 */
export interface ICPType extends Thing {
  /** Unique identifier URL */
  $id: string
  /** Type URL (https://schema.org.ai/ICP) */
  $type: string
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
 */
export function isICP(value: unknown): value is ICPType {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['$id'] === 'string' && typeof v['$type'] === 'string' && v['$type'] === ICP_TYPE
}
