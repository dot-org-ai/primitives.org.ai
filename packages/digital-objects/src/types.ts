/**
 * Core types for Digital Objects
 *
 * A unified nouns/verbs/things/actions model that provides:
 * - Linguistic consistency (singular/plural, conjugations)
 * - Entity definitions (Nouns) and instances (Things)
 * - Action definitions (Verbs) and instances (Actions)
 * - Graph relationships through Actions
 * - Event sourcing and audit trails
 */

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
  description?: string
  schema?: Record<string, FieldDefinition>
  createdAt: Date
}

export interface NounDefinition {
  name: string
  singular?: string // Auto-derived if not provided
  plural?: string // Auto-derived if not provided
  description?: string
  schema?: Record<string, FieldDefinition>
}

/**
 * Verb - Action definition with all conjugations
 */
export interface Verb {
  name: string // 'create', 'publish'
  action: string // 'create' (imperative)
  act: string // 'creates' (3rd person)
  activity: string // 'creating' (gerund)
  event: string // 'created' (past participle)
  reverseBy?: string // 'createdBy'
  reverseAt?: string // 'createdAt'
  reverseIn?: string // 'createdIn'
  inverse?: string // 'delete'
  description?: string
  createdAt: Date
}

export interface VerbDefinition {
  name: string
  // All forms auto-derived if not provided
  action?: string
  act?: string
  activity?: string
  event?: string
  reverseBy?: string
  reverseAt?: string
  reverseIn?: string
  inverse?: string
  description?: string
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
 */
export interface Action<T = Record<string, unknown>> {
  id: string
  verb: string // References verb.name
  subject?: string // Thing ID (actor/from)
  object?: string // Thing ID (target/to)
  data?: T // Payload/metadata
  status: ActionStatusType
  createdAt: Date
  completedAt?: Date
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
 */
export interface ExtendedFieldDefinition {
  type: PrimitiveType | 'object' | 'array'
  required?: boolean
  default?: unknown
}

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

  // Lifecycle
  close?(): Promise<void>
}
