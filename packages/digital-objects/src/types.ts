/**
 * Core types for Digital Objects
 *
 * A unified nouns/verbs/things/actions model that provides:
 * - Linguistic consistency (singular/plural, conjugations)
 * - Entity definitions (Nouns) and instances (Things)
 * - Action definitions (Verbs) and instances (Actions)
 * - Graph relationships through Actions
 * - Event sourcing and audit trails
 *
 * Relationship to `@graphdl/core` (the static schema/vocabulary DSL):
 * digital-objects is the SVO RUNTIME layer that sits on top of graphdl. Its
 * `Verb` EXTENDS graphdl's static `Verb` vocabulary type (gaining
 * `action`/`actor?`/`act?`/`activity?`/`result?`/`reverse?`/`inverse?`) and
 * adds the runtime-specific facts graphdl has no concept of: a stable `name`,
 * the past-participle `event` (the event-bus key), the flat
 * `reverseBy`/`reverseAt`/`reverseIn` accessors, `createdAt`, and the SVO
 * co-design fields `frame`/`source`/`canonical`.
 */

import type { Verb as GraphdlVerb } from '@graphdl/core'

/**
 * Query limit constants to prevent memory exhaustion
 */
export const DEFAULT_LIMIT = 100
export const MAX_LIMIT = 1000

/**
 * Maximum batch size to prevent DoS attacks
 */
export const MAX_BATCH_SIZE = 1000

/**
 * Direction for graph traversal
 */
export type Direction = 'in' | 'out' | 'both'

/**
 * Validates direction parameter for graph traversal methods.
 * @throws Error if direction is not 'in', 'out', or 'both'
 */
export function validateDirection(direction: string): Direction {
  if (direction !== 'in' && direction !== 'out' && direction !== 'both') {
    throw new Error(`Invalid direction: "${direction}". Must be "in", "out", or "both".`)
  }
  return direction
}

/**
 * Noun - Entity type definition with linguistic forms
 */
export interface Noun {
  name: string // 'Post', 'Author'
  singular: string // 'post', 'author'
  plural: string // 'posts', 'authors'
  slug: string // URL-safe: 'post', 'author'
  description?: string | undefined
  schema?: Record<string, FieldDefinition> | undefined
  createdAt: Date
}

export interface NounDefinition {
  name: string
  singular?: string | undefined // Auto-derived if not provided
  plural?: string | undefined // Auto-derived if not provided
  description?: string | undefined
  schema?: Record<string, FieldDefinition> | undefined
}

/**
 * NounRef - Reference to a Noun by name
 *
 * String alias that documents intent: this string identifies a Noun
 * (e.g., 'Customer', 'Order') registered in the ontology.
 */
export type NounRef = string

/**
 * ThingRef - Reference to a Thing by id
 *
 * String alias that documents intent: this string identifies a specific
 * Thing instance (Thing.id) — the entity playing a role in an Action.
 */
export type ThingRef = string

/**
 * ActionRef - Reference to an Action by id
 *
 * String alias that documents intent: this string identifies a specific
 * Action (Action.id) — used for parent/cause linkage between Actions.
 */
export type ActionRef = string

/**
 * FrameRole - Closed taxonomy of complement roles a Verb can take.
 *
 * Defined in CONTEXT.md. The literal `when`/`where` are carried directly
 * on Action (timestamp, location) and are not in this taxonomy.
 */
export type FrameRole =
  | 'subject'
  | 'object'
  | 'recipient'
  | 'source'
  | 'destination'
  | 'instrument'
  | 'topic'
  | 'cause'
  | 'manner'

/**
 * Frame - Set of complement roles a Verb declares.
 *
 * - `subject` is required ('any' permits any Noun, useful for permissive
 *   defaults when a Verb is declared without a specific subject restriction)
 * - `instrument` may reference a Tool literal
 * - `cause` links to a parent Action
 * - `manner` is an enum/string list, not a Thing reference
 */
export interface Frame {
  subject: NounRef | 'any'
  object?: NounRef | undefined
  recipient?: NounRef | undefined
  source?: NounRef | undefined
  destination?: NounRef | undefined
  instrument?: NounRef | 'Tool' | undefined
  topic?: NounRef | undefined
  cause?: 'Action' | undefined
  manner?: string[] | undefined
}

/**
 * VerbSource - Provenance taxonomy for canonical Verb registries.
 *
 * - `verbs.org.ai` — primary canonical registry (NOT YET PUBLISHED)
 * - `apqc` — APQC Process Classification Framework
 * - `onet` — O*NET occupational task taxonomy
 * - `domain` — domain-specific verb defined locally (default for user-defined)
 *
 * NOTE: As of 2026-05-05 none of `verbs.org.ai`, `process.org.ai`, or
 * `tasks.org.ai` are published. No canonical Verbs are pre-loaded into
 * the registry; defineVerb() defaults to `source: 'domain'` and
 * `canonical: false` until those upstream sources publish.
 */
export type VerbSource = 'verbs.org.ai' | 'apqc' | 'onet' | 'domain'

/**
 * Verb - Action definition with all conjugations (digital-objects RUNTIME verb)
 *
 * EXTENDS graphdl's static `Verb` vocabulary type. From graphdl it inherits the
 * static-vocabulary forms (`action`, optional `actor`/`act`/`activity`/
 * `result`/`inverse`/`description`, and the nested
 * `reverse?: { at, by, in, for }` interop representation). On top of that it
 * carries the runtime facts graphdl does not model:
 *
 * - `name` — stable verb identifier in the runtime registry
 * - `event` — past participle; the canonical event-bus key + audit-trail form
 * - flat `reverseBy`/`reverseAt`/`reverseIn` — the runtime reverse-form
 *   accessors (the CANONICAL representation used across the providers, the
 *   event bus, and r2-persistence; graphdl's nested `reverse` map is available
 *   via inheritance purely for static-vocabulary interop)
 * - `createdAt` — when the verb was registered
 * - `frame` / `source` / `canonical` — SVO co-design (complement-role
 *   declaration, provenance, canonicality)
 *
 * `act`/`activity` are required here (they are optional in graphdl). `frame`,
 * `source`, and `canonical` are optional for backward compatibility. Verbs
 * defined without a frame are treated as permissive (effectively
 * `{ subject: 'any' }`) by tools that consume frames.
 *
 * Verb.reverse reconciliation (aip-cnks.8): the runtime keeps the FLAT
 * `reverseBy`/`reverseAt`/`reverseIn` + `event` shape as its canonical
 * representation; graphdl's nested `reverse: { at, by, in, for }` + `result`/
 * `actor` shape is inherited (and thus assignable) for interop, but is not the
 * driving representation in the runtime. Full migration of the runtime to
 * graphdl's nested shape is deferred (see report).
 */
export interface Verb extends Omit<GraphdlVerb, 'inverse' | 'description'> {
  name: string // 'create', 'publish'
  action: string // 'create' (imperative) — narrows graphdl's required `action`
  act: string // 'creates' (3rd person) — required (optional in graphdl)
  activity: string // 'creating' (gerund) — required (optional in graphdl)
  event: string // 'created' (past participle)
  reverseBy?: string | undefined // 'createdBy'
  reverseAt?: string | undefined // 'createdAt'
  reverseIn?: string | undefined // 'createdIn'
  // `inverse`/`description` are redeclared with explicit `| undefined`: the
  // runtime sets them from optional VerbDefinition fields under
  // exactOptionalPropertyTypes. graphdl declares them as bare `string`, so they
  // are Omit-ed from the base and re-added here.
  inverse?: string | undefined // 'delete'
  description?: string | undefined
  frame?: Frame | undefined // Complement-role declaration (SVO co-design)
  source?: VerbSource | undefined // Provenance; defaults to 'domain' when defining
  canonical?: boolean | undefined // True for pre-loaded canonical verbs; defaults to false
  createdAt: Date
}

export interface VerbDefinition {
  name: string
  // All forms auto-derived if not provided
  action?: string | undefined
  act?: string | undefined
  activity?: string | undefined
  event?: string | undefined
  reverseBy?: string | undefined
  reverseAt?: string | undefined
  reverseIn?: string | undefined
  inverse?: string | undefined
  description?: string | undefined
  frame?: Frame | undefined
  source?: VerbSource | undefined
  canonical?: boolean | undefined
}

/**
 * Thing - Entity instance
 */
export interface Thing<T = Record<string, unknown>> {
  id: string
  noun: string // References noun.name
  data: T
  createdAt: Date
  updatedAt: Date
}

/**
 * Action - Events + Relationships + Audit Trail (unified!)
 *
 * An action represents:
 * - A graph edge (subject --verb--> object)
 * - An event (something happened)
 * - An audit record (who did what when)
 *
 * `roles` carries the remaining Frame slots beyond subject/object
 * (recipient, source, destination, instrument, topic, cause, manner).
 * Values are ThingRef (a Thing.id) for entity-shaped roles, or string
 * for `manner` enum values. Optional for backward compatibility.
 */
export interface Action<T = Record<string, unknown>> {
  id: string
  verb: string // References verb.name
  subject?: string | undefined // Thing ID (actor/from)
  object?: string | undefined // Thing ID (target/to)
  roles?: Partial<Record<FrameRole, ThingRef | string>> | undefined // Remaining Frame slots
  data?: T | undefined // Payload/metadata
  status: ActionStatusType
  createdAt: Date
  completedAt?: Date | undefined
}

/**
 * ActionStatus constants - use these instead of string literals
 */
export const ActionStatus = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export type ActionStatusType = (typeof ActionStatus)[keyof typeof ActionStatus]

/**
 * Field definition for schemas
 *
 * Can be either a simple type string or an extended definition with options
 */
export type FieldDefinition = SimpleFieldType | ExtendedFieldDefinition

/**
 * Simple field type - just a type string
 */
export type SimpleFieldType =
  | PrimitiveType
  | `${string}.${string}` // Relation: 'Author.posts'
  | `[${string}.${string}]` // Array relation: '[Tag.posts]'
  | `${PrimitiveType}?` // Optional

/**
 * Extended field definition with options like required, default, etc.
 *
 * `stratum` classifies the mutation/composition rule for the field
 * (orthogonal to Frame, which classifies the role a Thing plays in an
 * Action). When unspecified, runtime providers treat the field as
 * `'expression'` (forgiving: always mutable).
 *
 * `variants` is required iff `stratum === 'composition'`; runtime
 * providers reject direct assignment to composition fields and require
 * mutation via `pickComposition(thingRef, fieldName, variantIdx)`.
 */
export interface ExtendedFieldDefinition {
  type: PrimitiveType | 'object' | 'array'
  required?: boolean
  default?: unknown
  stratum?: TokenStratum
  variants?: unknown[]
}

/**
 * TokenStratum - Field-level mutation/composition classification.
 *
 * Orthogonal to Frame (which classifies role in an Action). Strata:
 * - `frozen`      set once at creation; never mutates; identity-bearing
 * - `negotiable`  intentionally null; downstream stage may fill ONCE
 * - `expression`  free-form mutable content (default; prose, copy)
 * - `composition` bandit-eligible variants picked at render-time
 *
 * Runtime providers enforce mutation rules; see `pickComposition` for
 * the legitimate mutation path for `composition` fields.
 */
export type TokenStratum = 'frozen' | 'negotiable' | 'expression' | 'composition'

export type PrimitiveType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'json'
  | 'markdown'
  | 'url'

/**
 * Validation options for create/update operations
 */
export interface ValidationOptions {
  validate?: boolean | undefined
}

/**
 * List options for queries
 */
export interface ListOptions {
  limit?: number | undefined
  offset?: number | undefined
  where?: Record<string, unknown> | undefined
  orderBy?: string | undefined
  order?: 'asc' | 'desc' | undefined
}

/**
 * Action query options
 */
export interface ActionOptions extends ListOptions {
  verb?: string
  subject?: string
  object?: string
  status?: ActionStatusType | ActionStatusType[]
}

/**
 * DigitalObjectsProvider - Core storage interface
 *
 * Implementations: MemoryProvider, NS (DurableObject)
 */
export interface DigitalObjectsProvider {
  // Nouns
  defineNoun(def: NounDefinition): Promise<Noun>
  getNoun(name: string): Promise<Noun | null>
  listNouns(): Promise<Noun[]>

  // Verbs
  defineVerb(def: VerbDefinition): Promise<Verb>
  getVerb(name: string): Promise<Verb | null>
  listVerbs(): Promise<Verb[]>

  // Things
  create<T>(noun: string, data: T, id?: string, options?: ValidationOptions): Promise<Thing<T>>
  get<T>(id: string): Promise<Thing<T> | null>
  list<T>(noun: string, options?: ListOptions): Promise<Thing<T>[]>
  find<T>(noun: string, where: Partial<T>): Promise<Thing<T>[]>
  update<T>(id: string, data: Partial<T>, options?: ValidationOptions): Promise<Thing<T>>
  delete(id: string): Promise<boolean>
  search<T>(query: string, options?: ListOptions): Promise<Thing<T>[]>

  // Actions (events + edges)
  perform<T>(verb: string, subject?: string, object?: string, data?: T): Promise<Action<T>>
  getAction<T>(id: string): Promise<Action<T> | null>
  listActions<T>(options?: ActionOptions): Promise<Action<T>[]>
  deleteAction(id: string): Promise<boolean>

  // Graph traversal (via actions)
  related<T>(
    id: string,
    verb?: string,
    direction?: Direction,
    options?: ListOptions
  ): Promise<Thing<T>[]>
  edges<T>(
    id: string,
    verb?: string,
    direction?: Direction,
    options?: ListOptions
  ): Promise<Action<T>[]>

  // Batch operations
  createMany<T>(noun: string, items: T[]): Promise<Thing<T>[]>
  updateMany<T>(updates: Array<{ id: string; data: Partial<T> }>): Promise<Thing<T>[]>
  deleteMany(ids: string[]): Promise<boolean[]>
  performMany<T>(
    actions: Array<{ verb: string; subject?: string; object?: string; data?: T }>
  ): Promise<Action<T>[]>

  // Token strata (L0 — orthogonal to Frame)
  // Optional for backward compatibility; MemoryProvider implements them.
  stratumOf?(nounRef: NounRef, fieldName: string): TokenStratum
  compositionFields?(nounRef: NounRef): { field: string; variants: unknown[] }[]
  pickComposition?(thingRef: ThingRef, fieldName: string, variantIdx: number): Promise<void>

  // Lifecycle
  close?(): Promise<void>
}
