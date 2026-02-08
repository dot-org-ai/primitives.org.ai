/**
 * Core types for the Noun() factory system
 *
 * Noun() is the high-level entity definition API for headless.ly.
 * It produces typed, event-sourced entities with CRUD + custom verbs.
 */

/**
 * Property value in a Noun definition:
 * - string pattern: field type, relationship, enum, or verb declaration
 * - null: disable a CRUD verb
 */
export type PropertyValue = string | null

/**
 * The input definition object passed to Noun()
 */
export type NounDefinitionInput = Record<string, PropertyValue>

/**
 * Field modifier flags parsed from type strings
 * e.g., 'string!#' → { required: true, optional: false, indexed: true, unique: false, array: false }
 */
export interface FieldModifiers {
  required: boolean
  optional: boolean
  indexed: boolean
  unique: boolean
  array: boolean
}

/**
 * The kind of property parsed from the definition
 */
export type PropertyKind = 'field' | 'relationship' | 'enum' | 'verb' | 'disabled'

/**
 * Parsed property result
 */
export interface ParsedProperty {
  name: string
  kind: PropertyKind
  type?: string | undefined
  modifiers?: FieldModifiers | undefined
  defaultValue?: string | undefined
  enumValues?: string[] | undefined
  operator?: string | undefined
  targetType?: string | undefined
  backref?: string | undefined
  isArray?: boolean | undefined
  verbAction?: string | undefined
  verbConjugation?: VerbConjugation | undefined
}

/**
 * Full verb conjugation
 *
 * qualify() → qualifying() → qualified()
 * action     activity        event
 */
export interface VerbConjugation {
  action: string
  activity: string
  event: string
  reverseBy: string
  reverseAt: string
}

/**
 * Complete noun schema after parsing
 */
export interface NounSchema {
  name: string
  singular: string
  plural: string
  slug: string
  fields: Map<string, ParsedProperty>
  relationships: Map<string, ParsedProperty>
  verbs: Map<string, VerbConjugation>
  disabledVerbs: Set<string>
  raw: NounDefinitionInput
}

/**
 * Instance returned from CRUD operations
 *
 * Every entity carries base meta-fields: $type, $id, $context, $version, $createdAt, $updatedAt
 */
export interface NounInstance {
  $id: string
  $type: string
  $context: string
  $version: number
  $createdAt: string
  $updatedAt: string
  [key: string]: unknown
}

/**
 * BEFORE hook handler — called before a verb executes
 * Return a modified data object to transform the input, or void to pass through.
 * Throw to reject the operation.
 */
export type BeforeHookHandler = (
  data: Record<string, unknown>,
) => void | Record<string, unknown> | Promise<void> | Promise<Record<string, unknown>>

/**
 * AFTER hook handler — called after a verb executes
 * Receives the resulting instance and optional cross-domain context ($).
 */
export type AfterHookHandler = (
  instance: NounInstance,
  $?: Record<string, unknown>,
) => void | Promise<void>

/**
 * The typed interface returned by Noun()
 *
 * Provides typed CRUD methods, hook registration, schema access,
 * and custom verb dispatch via index signature.
 */
export interface NounEntity {
  /** Create a new entity instance */
  create(data: Record<string, unknown>): Promise<NounInstance>
  /** Get an entity by ID */
  get(id: string): Promise<NounInstance | null>
  /** Find entities matching a filter */
  find(where?: Record<string, unknown>): Promise<NounInstance[]>
  /** Update an entity by ID */
  update(id: string, data: Record<string, unknown>): Promise<NounInstance>
  /** Delete an entity by ID */
  delete(id: string): Promise<boolean>
  /** Access the noun schema */
  $schema: NounSchema
  /** Access the noun name */
  $name: string
  /** Custom verbs, hook registration, and dynamic access */
  [key: string]: unknown
}

/**
 * Provider interface for Noun runtime storage
 *
 * The Noun proxy dispatches all operations to a NounProvider.
 * Default: MemoryNounProvider (in-process Map).
 */
export interface NounProvider {
  create(type: string, data: Record<string, unknown>): Promise<NounInstance>
  get(type: string, id: string): Promise<NounInstance | null>
  find(type: string, where?: Record<string, unknown>): Promise<NounInstance[]>
  update(type: string, id: string, data: Record<string, unknown>): Promise<NounInstance>
  delete(type: string, id: string): Promise<boolean>
  perform(type: string, verb: string, id: string, data?: Record<string, unknown>): Promise<NounInstance>
}
