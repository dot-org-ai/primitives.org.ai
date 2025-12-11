/**
 * Core Primitives
 *
 * Foundational types that form the basis of the domain model:
 * Thing, Noun, Verb, Event, Action, and Domain.
 *
 * @module core/primitives
 */

import type { Input, Output, Action, BaseEvent, EventHandler, CRUDResource, ListParams, PaginatedResult } from '@/core/rpc'

// =============================================================================
// Property System
// =============================================================================

/**
 * Property type definitions for schema building.
 */
export type PropertyType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'url'
  | 'email'
  | 'json'
  | 'array'
  | 'object'
  | 'enum'
  | 'ref'

/**
 * Property definition for noun schemas.
 *
 * @example
 * ```ts
 * const emailProperty: Property = {
 *   type: 'email',
 *   required: true,
 *   description: 'Primary email address',
 *   unique: true
 * }
 * ```
 */
export interface Property {
  /** Property data type */
  type: PropertyType

  /** Human-readable description */
  description?: string

  /** Whether the property is required */
  required?: boolean

  /** Default value */
  default?: unknown

  /** Whether values must be unique */
  unique?: boolean

  /** For enum types, the allowed values */
  enum?: string[]

  /** For ref types, the referenced noun */
  ref?: string

  /** For array types, the item type */
  items?: Property

  /** For object types, nested properties */
  properties?: Record<string, Property>

  /** Validation pattern (regex) */
  pattern?: string

  /** Minimum value (number) or length (string/array) */
  min?: number

  /** Maximum value (number) or length (string/array) */
  max?: number

  /** Whether this property is indexed for queries */
  indexed?: boolean

  /** Whether this property is searchable */
  searchable?: boolean
}

// =============================================================================
// Thing - Instance of a Noun
// =============================================================================

/**
 * Instance of a noun with identity and state.
 *
 * Things are the fundamental data objects in the system.
 * Each thing has a unique ID, belongs to a type (noun),
 * and contains data conforming to the noun's schema.
 *
 * @example
 * ```ts
 * const contact: Thing = {
 *   id: 'cntct_123',
 *   $type: 'contact',
 *   $uri: 'https://crm.example.com/contacts/cntct_123',
 *   data: {
 *     email: 'john@example.com',
 *     firstName: 'John',
 *     lastName: 'Doe'
 *   },
 *   createdAt: new Date('2024-01-15'),
 *   updatedAt: new Date('2024-01-15')
 * }
 * ```
 */
export interface Thing {
  /** Unique identifier */
  id: string

  /** Noun type name (e.g., 'contact', 'deal') */
  $type: string

  /** Canonical resource URI */
  $uri?: string

  /** Instance data conforming to the noun schema */
  data: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

/** Input type for creating/updating things */
export type ThingInput = Input<Thing>

/** Output type for thing responses */
export type ThingOutput = Output<Thing>

/**
 * Thing with resolved relationships.
 *
 * When fetching a thing with `include` options,
 * relationships are resolved and attached.
 */
export interface ThingWithRelations extends Thing {
  /** The noun type definition */
  noun?: Noun

  /** Parent domain namespace */
  domain?: Domain

  /** Related things (resolved references) */
  relationships?: Thing[]
}

// =============================================================================
// Noun - Entity Schema Definition
// =============================================================================

/**
 * Named entity or concept schema within a domain.
 *
 * Nouns define the structure and behavior of things.
 * They specify properties, relationships, and available operations.
 *
 * @example
 * ```ts
 * const contactNoun: Noun = {
 *   singular: 'contact',
 *   plural: 'contacts',
 *   description: 'A person or organization in the CRM',
 *   properties: {
 *     email: { type: 'email', required: true, unique: true },
 *     firstName: { type: 'string' },
 *     lastName: { type: 'string' },
 *     company: { type: 'ref', ref: 'company' }
 *   }
 * }
 * ```
 */
export interface Noun {
  /** Singular form (e.g., 'contact') */
  singular: string

  /** Plural form (e.g., 'contacts') */
  plural: string

  /** Human-readable description */
  description?: string

  /** Property definitions */
  properties?: Record<string, Property>

  /** Additional metadata */
  metadata?: Record<string, unknown>

  /** Icon identifier for UI */
  icon?: string

  /** URL slug for routing */
  slug?: string
}

/** Input type for defining nouns */
export type NounInput = Input<Noun & { id?: string; createdAt?: Date; updatedAt?: Date }>

/** Output type for noun responses */
export type NounOutput = Output<Noun>

/**
 * Noun with resolved relationships.
 */
export interface NounWithRelations extends Noun {
  /** Parent domain namespace */
  domain?: Domain

  /** Instances of this noun */
  things?: Thing[]

  /** Operations available on this noun */
  verbs?: Verb[]

  /** Events emitted for this noun */
  events?: string[]
}

// =============================================================================
// Verb - Operation Definition
// =============================================================================

/**
 * Action or operation that can be performed on things.
 *
 * Verbs define the behaviors available in a domain.
 * Each verb has preconditions, effects, and emits events.
 *
 * @example
 * ```ts
 * const createVerb: Verb = {
 *   action: 'create',
 *   activity: 'creating',
 *   result: 'creation',
 *   preconditions: {
 *     authenticated: true
 *   },
 *   effect: {
 *     creates: 'thing'
 *   }
 * }
 * ```
 */
export interface Verb {
  /** Infinitive form (e.g., 'create', 'update', 'send') */
  action: string

  /** Role that can perform this action */
  actor?: string

  /** Gerund form (e.g., 'creating', 'updating', 'sending') */
  activity?: string

  /** Noun form of the result (e.g., 'creation', 'update', 'delivery') */
  result?: string

  /** Opposite action (e.g., 'delete' for 'create') */
  inverse?: string

  /** Required conditions before execution */
  preconditions?: Record<string, unknown>

  /** State changes after execution */
  effect?: Record<string, unknown>

  /** Human-readable description */
  description?: string
}

/** Input type for defining verbs */
export type VerbInput = Input<Verb & { id?: string; createdAt?: Date; updatedAt?: Date }>

/** Output type for verb responses */
export type VerbOutput = Output<Verb>

/**
 * Verb with resolved relationships.
 */
export interface VerbWithRelations extends Verb {
  /** Parent domain namespace */
  domain?: Domain

  /** Actor noun type */
  subject?: Noun

  /** Target noun type */
  object?: Noun

  /** Events emitted by this verb */
  events?: string[]
}

// =============================================================================
// Event - Record of Something that Happened
// =============================================================================

/**
 * Record of something that happened in the system.
 *
 * Events are immutable records of state changes.
 * They enable event sourcing, audit trails, and reactive workflows.
 *
 * @example
 * ```ts
 * const contactCreated: Event = {
 *   type: 'contact.created',
 *   timestamp: new Date(),
 *   data: {
 *     id: 'cntct_123',
 *     email: 'john@example.com'
 *   },
 *   metadata: {
 *     userId: 'user_456',
 *     source: 'api'
 *   }
 * }
 * ```
 */
export interface Event<TData = Record<string, unknown>> {
  /** Event type identifier (e.g., 'contact.created') */
  type: string

  /** When the event occurred */
  timestamp: Date

  /** Event payload */
  data?: TData

  /** Additional context */
  metadata?: Record<string, unknown>

  /** Unique event ID */
  id?: string

  /** Source system/service */
  source?: string

  /** Correlation ID for tracking */
  correlationId?: string
}

/** Input type for emitting events */
export type EventInput<TData = Record<string, unknown>> = Input<Event<TData>>

/** Output type for event responses */
export type EventOutput<TData = Record<string, unknown>> = Output<Event<TData>>

/**
 * Event with resolved relationships.
 */
export interface EventWithRelations<TData = Record<string, unknown>> extends Event<TData> {
  /** Parent domain namespace */
  domain?: Domain

  /** The verb that triggered this event */
  verb?: Verb

  /** The actor (thing that performed the action) */
  subject?: Thing

  /** The target (thing that was acted upon) */
  object?: Thing

  /** The action record */
  action?: ActionRecord
}

// =============================================================================
// Action - Bound Operation on a Thing
// =============================================================================

/**
 * Execution status of an action.
 */
export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Bound operation on a specific thing.
 *
 * Actions are the execution records of verbs on things.
 * They track input, output, timing, and resulting events.
 *
 * @example
 * ```ts
 * const updateAction: ActionRecord = {
 *   name: 'update',
 *   status: 'completed',
 *   input: { firstName: 'Jane' },
 *   output: { id: 'cntct_123', firstName: 'Jane', ... },
 *   startedAt: new Date('2024-01-15T10:00:00Z'),
 *   completedAt: new Date('2024-01-15T10:00:01Z')
 * }
 * ```
 */
export interface ActionRecord {
  /** Action name (verb infinitive) */
  name: string

  /** Current execution status */
  status: ActionStatus

  /** Input parameters */
  input?: Record<string, unknown>

  /** Result data */
  output?: Record<string, unknown>

  /** When execution started */
  startedAt?: Date

  /** When execution completed */
  completedAt?: Date

  /** Error message (if failed) */
  error?: string

  /** Retry count */
  retries?: number
}

/** Input type for creating action records */
export type ActionRecordInput = Input<ActionRecord & { id?: string; createdAt?: Date; updatedAt?: Date }>

/** Output type for action record responses */
export type ActionRecordOutput = Output<ActionRecord>

/**
 * Action record with resolved relationships.
 */
export interface ActionRecordWithRelations extends ActionRecord {
  /** The verb definition */
  verb?: Verb

  /** The actor (who performed the action) */
  subject?: Thing

  /** The target (what was acted upon) */
  object?: Thing

  /** The resulting event */
  event?: Event
}

// =============================================================================
// Domain - Namespace for AI and Data
// =============================================================================

/**
 * URL-based namespace that provides context for AI and data.
 *
 * Domains are the top-level organizational unit.
 * They contain nouns, verbs, things, functions, agents, and workflows.
 *
 * @example
 * ```ts
 * const crmDomain: Domain = {
 *   name: 'CRM',
 *   url: 'https://crm.example.com',
 *   description: 'Customer relationship management domain',
 *   nouns: [contactNoun, companyNoun, dealNoun],
 *   verbs: [createVerb, updateVerb, deleteVerb]
 * }
 * ```
 */
export interface Domain {
  /** Display name */
  name: string

  /** Canonical URL (acts as namespace) */
  url: string

  /** Human-readable description */
  description?: string
}

/** Input type for creating domains */
export type DomainInput = Input<Domain & { id?: string; createdAt?: Date; updatedAt?: Date }>

/** Output type for domain responses */
export type DomainOutput = Output<Domain>

/**
 * Domain with resolved relationships.
 */
export interface DomainWithRelations extends Domain {
  /** Type definitions in this domain */
  nouns?: Noun[]

  /** Available operations */
  verbs?: Verb[]

  /** Instances in this domain */
  things?: Thing[]

  /** AI functions */
  functions?: unknown[]

  /** Autonomous actors */
  agents?: unknown[]

  /** Orchestrated processes */
  workflows?: unknown[]
}

// =============================================================================
// Actions Interfaces (for RPC)
// =============================================================================

/**
 * Standard CRUD + extra actions for Thing resources.
 */
export interface ThingActions extends CRUDResource<Thing, ThingInput> {
  /** Archive a thing (soft delete) */
  archive: Action<{ id: string }, Thing>

  /** Restore an archived thing */
  restore: Action<{ id: string }, Thing>

  /** Find by type */
  findByType: Action<{ $type: string } & ListParams, PaginatedResult<Thing>>
}

/**
 * Actions for managing Noun definitions.
 */
export interface NounActions extends CRUDResource<Noun, NounInput> {
  /** Extend a noun (create child type) */
  extend: Action<{ parentId: string; noun: NounInput }, Noun>

  /** Validate a noun schema */
  validate: Action<{ noun: NounInput }, { valid: boolean; errors?: string[] }>

  /** Get all verbs for a noun */
  getVerbs: Action<{ nounId: string }, Verb[]>
}

/**
 * Actions for managing Verb definitions.
 */
export interface VerbActions extends CRUDResource<Verb, VerbInput> {
  /** Execute a verb on a thing */
  execute: Action<{ verbId: string; thingId: string; input?: Record<string, unknown> }, ActionRecord>

  /** Get verb conjugations */
  conjugate: Action<{ verbId: string }, { infinitive: string; gerund: string; past: string; result: string }>
}

/**
 * Actions for Event operations.
 */
export interface EventActions {
  /** Emit an event */
  emit: Action<EventInput, Event>

  /** List events */
  list: Action<ListParams & { type?: string }, PaginatedResult<Event>>

  /** Get event by ID */
  get: Action<{ id: string }, Event>

  /** Replay events */
  replay: Action<{ from?: Date; to?: Date; types?: string[] }, { count: number }>
}

/**
 * Actions for Domain management.
 */
export interface DomainActions extends CRUDResource<Domain, DomainInput> {
  /** Federate with another domain */
  federate: Action<{ targetUrl: string }, { success: boolean }>

  /** Discover domain capabilities */
  discover: Action<{ url: string }, DomainWithRelations>
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Standard events for Thing lifecycle.
 */
export interface ThingEvents {
  created: BaseEvent<'thing.created', Thing>
  read: BaseEvent<'thing.read', Thing>
  updated: BaseEvent<'thing.updated', { before: Thing; after: Thing }>
  deleted: BaseEvent<'thing.deleted', { id: string; $type: string }>
  archived: BaseEvent<'thing.archived', Thing>
  restored: BaseEvent<'thing.restored', Thing>
}

/**
 * Standard events for Noun lifecycle.
 */
export interface NounEvents {
  created: BaseEvent<'noun.created', Noun>
  updated: BaseEvent<'noun.updated', { before: Noun; after: Noun }>
  deleted: BaseEvent<'noun.deleted', { singular: string }>
  extended: BaseEvent<'noun.extended', { parent: Noun; child: Noun }>
  validated: BaseEvent<'noun.validated', { noun: Noun; valid: boolean }>
}

/**
 * Standard events for Verb lifecycle.
 */
export interface VerbEvents {
  created: BaseEvent<'verb.created', Verb>
  updated: BaseEvent<'verb.updated', { before: Verb; after: Verb }>
  deleted: BaseEvent<'verb.deleted', { action: string }>
  executed: BaseEvent<'verb.executed', ActionRecord>
}

/**
 * Standard events for Domain lifecycle.
 */
export interface DomainEvents {
  created: BaseEvent<'domain.created', Domain>
  updated: BaseEvent<'domain.updated', { before: Domain; after: Domain }>
  deleted: BaseEvent<'domain.deleted', { url: string }>
  federated: BaseEvent<'domain.federated', { source: string; target: string }>
  discovered: BaseEvent<'domain.discovered', DomainWithRelations>
}

// =============================================================================
// Resource Interfaces (Actions + Events)
// =============================================================================

/**
 * Complete Thing resource with actions and event subscriptions.
 *
 * @example
 * ```ts
 * const things: ThingResource = ...
 *
 * // Create a thing
 * const contact = await things.create({
 *   $type: 'contact',
 *   data: { email: 'john@example.com' }
 * })
 *
 * // Subscribe to events
 * things.on('created', (event, ctx) => {
 *   console.log('Thing created:', event.data.id)
 * })
 * ```
 */
export interface ThingResource extends ThingActions {
  on: <K extends keyof ThingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ThingEvents[K], TProxy>
  ) => () => void
}

/**
 * Complete Noun resource with actions and event subscriptions.
 */
export interface NounResource extends NounActions {
  on: <K extends keyof NounEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<NounEvents[K], TProxy>
  ) => () => void
}

/**
 * Complete Verb resource with actions and event subscriptions.
 */
export interface VerbResource extends VerbActions {
  on: <K extends keyof VerbEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<VerbEvents[K], TProxy>
  ) => () => void
}

/**
 * Complete Domain resource with actions and event subscriptions.
 */
export interface DomainResource extends DomainActions {
  on: <K extends keyof DomainEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DomainEvents[K], TProxy>
  ) => () => void
}
