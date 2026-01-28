/**
 * DO() - Unified Digital Object Definition
 *
 * A self-contained, portable, type-safe definition that includes:
 * - Schema (description-first, string default)
 * - Relationships (cascades: -> ~> <- <~)
 * - Functions (code + generative)
 * - Events (onNounEvent)
 * - Schedules (everyInterval, cron)
 * - Migrations (migrate.N hooks)
 *
 * Each DO knows all its children/instances.
 * Definition stored at key '$' in DO's storage.
 *
 * @example
 * const Startup = DO({
 *   $type: 'Startup',
 *   $version: 3,
 *   name: 'Name of the startup',
 *   stage: 'Seed | SeriesA | SeriesB',
 *   founders: ['Co-founders ->Founder'],
 *   pitch: { mdx: 'Generate pitch for {name}' },
 *   onFounderCreated: (founder, $) => $.notify(founder),
 *   everyWeek: ($) => $.report(),
 *   'migrate.2': ($) => $.instances().forEach(s => s.stage ??= 'Seed'),
 * })
 */

// ============================================
// Type Inference from Description Strings
// ============================================

/** Parse enum from "A | B | C" string */
type ParseEnum<T extends string> = T extends `${infer A} | ${infer Rest}` ? A | ParseEnum<Rest> : T

/** Infer type from description string */
type InferFieldType<T> =
  // Type suffixes
  T extends `${string} (number)`
    ? number
    : T extends `${string} (date)`
    ? Date
    : T extends `${string} (boolean)`
    ? boolean
    : // Enum pattern
    T extends `${infer A} | ${infer Rest}`
    ? ParseEnum<T>
    : // Cascade patterns (extract the field type, not the cascade)
    T extends `${string} ->${string}`
    ? InferCascadeType<T>
    : T extends `${string} ~>${string}`
    ? InferCascadeType<T>
    : T extends `${string} <-${string}`
    ? InferCascadeType<T>
    : T extends `${string} <~${string}`
    ? InferCascadeType<T>
    : // Plain string
    T extends string
    ? string
    : // Array of strings
    T extends readonly [infer Item extends string]
    ? InferFieldType<Item>[]
    : // Array of objects
    T extends readonly [infer Item extends object]
    ? InferSchema<Item>[]
    : // Nested object
    T extends object
    ? InferSchema<T>
    : unknown

/** Extract type from cascade description */
type InferCascadeType<T extends string> = T extends `${string} ->${infer Type}`
  ? { $ref: Type }
  : T extends `${string} ~>${infer Type}`
  ? { $ref: Type }
  : T extends `${string} <-${infer Type}`
  ? { $ref: Type }
  : T extends `${string} <~${infer Type}`
  ? { $ref: Type }
  : unknown

/** Filter special keys from schema type */
type FilterSpecialKeys<K> = K extends `$${string}`
  ? K // Keep $type, $id, etc
  : K extends `on${Capitalize<string>}${string}`
  ? never
  : K extends `every${string}`
  ? never
  : K extends `migrate.${number}`
  ? never
  : K extends `${number} ${string}`
  ? never // cron
  : K

/** Infer full schema from definition */
type InferSchema<T> = {
  [K in keyof T as FilterSpecialKeys<K & string>]: InferFieldType<T[K]>
}

// ============================================
// Cascade & Relationship Types
// ============================================

/**
 * Cascade/Relationship Operators:
 * ->   outgoing (create/link, can cascade generate)
 * <-   incoming (refs pointing to me)
 * <->  bidirectional (many-to-many)
 * ~>   outgoing + fuzzy (find existing, no dupes)
 * <~   incoming + fuzzy (vector/similarity search)
 * <~>  bidirectional + fuzzy
 */
type CascadeOperator = '->' | '<-' | '<->' | '~>' | '<~' | '<~>'

/**
 * Filter condition in relationship queries
 * e.g., status=active, mrr>1000, plan!=free
 */
interface FilterCondition {
  field: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<='
  value: string | number | boolean
}

interface CascadeDefinition {
  operator: CascadeOperator
  targetType: string
  predicate?: string | undefined // e.g., 'tenantOf' in '<- SaaSTenant.tenantOf'
  description: string
  isArray: boolean
  isFuzzy: boolean // uses vector/similarity search
  isBidirectional: boolean
  routeParam?: string | undefined // e.g., ':tenant' means instances are DOs
  filters?: FilterCondition[] | undefined
}

// ============================================
// Function Types
// ============================================

interface GenerativeFunctionDef {
  mdx: string
  schema?: Record<string, unknown>
  model?: 'best' | 'fast' | 'cost' | 'reasoning'
}

type CodeFunctionDef = (...args: unknown[]) => unknown

type FunctionDef = GenerativeFunctionDef | CodeFunctionDef

// ============================================
// Event & Schedule Types
// ============================================

type EventHandler<T = unknown> = (payload: T, $: DOContext) => void | Promise<void>
type ScheduleHandler = ($: DOContext) => void | Promise<void>
type MigrateHandler = ($: DOContext) => void | Promise<void>

// ============================================
// DO Context ($ parameter)
// ============================================

export interface DOContext {
  // Identity
  $id: string
  $type: string
  $version: number
  $extends?: string | undefined
  $parent?: string | undefined

  // Instance operations
  instances: () => DOInstance[]
  create: (id: string, data: Record<string, unknown>) => DOInstance
  get: (id: string) => DOInstance | null
  put: (id: string, data: Record<string, unknown>) => DOInstance
  delete: (id: string) => boolean

  // Cascade operations
  cascade: (instance: DOInstance, field: string) => Promise<void>
  search: (instance: DOInstance, field: string) => Promise<void>

  // Function execution
  call: (name: string, ...args: unknown[]) => Promise<unknown>

  // Event emission
  emit: (event: string, payload: unknown) => void

  // Storage access
  storage: DOStorage
}

export interface DOStorage {
  get: <T = unknown>(key: string) => T | null
  put: <T = unknown>(key: string, value: T) => void
  delete: (key: string) => boolean
  list: (options?: { prefix?: string; limit?: number }) => Map<string, unknown>
}

export interface DOInstance {
  $id: string
  $type: string
  $version: number
  data: Record<string, unknown>
}

// ============================================
// DO Definition Type
// ============================================

export interface DODefinition {
  $type: string
  $id?: string
  $version?: number
  $context?: string
  $extends?: string // Parent type name for inheritance
  [key: string]: unknown
}

// ============================================
// Parsed Definition
// ============================================

interface ParsedField {
  name: string
  description: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'enum' | 'object' | 'array'
  enumValues?: string[] | undefined
  cascade?: CascadeDefinition | undefined
  nested?: Record<string, ParsedField> | undefined
  arrayItem?: ParsedField | undefined
}

interface ParsedDefinition {
  $type: string
  $id?: string | undefined
  $version: number
  $context?: string | undefined
  $extends?: string | undefined
  fields: Record<string, ParsedField>
  cascades: Record<string, CascadeDefinition>
  functions: Record<string, FunctionDef>
  events: Record<string, EventHandler>
  schedules: Record<string, ScheduleHandler>
  crons: Record<string, ScheduleHandler>
  migrations: Record<number, MigrateHandler>
}

// ============================================
// Parsing Utilities
// ============================================

// Operators ordered by length (longest first for proper matching)
const CASCADE_OPERATORS = ['<~>', '<->', '<~', '~>', '<-', '->'] as const
// Regex with optional description before operator
const CASCADE_REGEX = /^(.*?)\s*(<~>|<->|<~|~>|<-|->)\s*(.+)$/
const TYPE_SUFFIX_REGEX = /\s*\((number|date|boolean)\)\s*$/i
const ENUM_REGEX = /^[\w\s]+(\s*\|\s*[\w\s]+)+$/
const CRON_REGEX =
  /^([\*\d,\-\/]+)\s+([\*\d,\-\/]+)\s+([\*\d,\-\/]+)\s+([\*\d,\-\/]+)\s+([\*\d,\-\/]+)$/
const MIGRATE_REGEX = /^migrate\.(\d+)$/
const ROUTE_PARAM_REGEX = /^:(\w+)\s+(.+)$/ // :tenant ->Type
const TARGET_PREDICATE_REGEX = /^(\w+)\.(\w+)$/ // Type.predicate
const FILTER_REGEX = /\[([^\]]+)\]/ // [status=active, plan=Pro]
const FILTER_CONDITION_REGEX = /(\w+)\s*(=|!=|>=|<=|>|<)\s*(.+)/
const TEMPLATE_VAR_REGEX = /\{(\w+)\}/g

/**
 * Detect if a string contains template variables like {name}
 * Used to distinguish generative strings from regular field descriptions
 */
export function isGenerativeString(str: string): boolean {
  // Returns true if string has {varName} templates (not empty {})
  const matches = str.match(TEMPLATE_VAR_REGEX)
  return matches !== null && matches.length > 0
}

/**
 * Parse filter conditions like [status=active, mrr>1000]
 */
export function parseFilters(filterStr: string): FilterCondition[] {
  const conditions: FilterCondition[] = []
  const parts = filterStr.split(',').map((s) => s.trim())

  for (const part of parts) {
    const match = part.match(FILTER_CONDITION_REGEX)
    if (match) {
      const [, field, op, rawValue] = match
      if (!field || !rawValue) continue
      let value: string | number | boolean = rawValue.trim()

      // Type coercion
      if (value === 'true') value = true
      else if (value === 'false') value = false
      else if (!isNaN(Number(value))) value = Number(value)

      conditions.push({
        field,
        operator: op as FilterCondition['operator'],
        value,
      })
    }
  }

  return conditions
}

/**
 * Parse cascade/relationship definitions
 *
 * Formats:
 *   'Description ->Type'           - outgoing to Type
 *   '<- Type.predicate'            - incoming via predicate
 *   ':param ->Type'                - outgoing, instances are DOs
 *   '->Type[status=active]'        - with filter
 *   '<~> Type.predicate'           - fuzzy bidirectional
 */
export function parseCascade(value: string): { description: string; cascade?: CascadeDefinition } {
  // Check for route parameter prefix (:param)
  let routeParam: string | undefined
  let parseValue = value

  const routeMatch = value.match(ROUTE_PARAM_REGEX)
  if (routeMatch && routeMatch[1] && routeMatch[2]) {
    routeParam = routeMatch[1]
    parseValue = routeMatch[2]
  }

  // Match cascade operator
  const match = parseValue.match(CASCADE_REGEX)
  if (!match) return { description: value }

  const [, rawDescription = '', operator, targetPart = ''] = match
  const op = operator as CascadeOperator
  const description = rawDescription.trim()

  // Parse target: could be 'Type', 'Type.predicate', or 'Type[filters]'
  let targetType: string
  let predicate: string | undefined
  let filters: FilterCondition[] | undefined

  // Extract filters if present
  let targetClean = targetPart.trim()
  const filterMatch = targetClean.match(FILTER_REGEX)
  if (filterMatch && filterMatch[1]) {
    filters = parseFilters(filterMatch[1])
    targetClean = targetClean.replace(FILTER_REGEX, '').trim()
  }

  // Check for Type.predicate format
  const predicateMatch = targetClean.match(TARGET_PREDICATE_REGEX)
  if (predicateMatch && predicateMatch[1]) {
    targetType = predicateMatch[1]
    predicate = predicateMatch[2]
  } else {
    targetType = targetClean
  }

  // Use targetType as description if none provided
  const finalDescription = description || `${targetType}${predicate ? '.' + predicate : ''}`

  return {
    description: finalDescription,
    cascade: {
      operator: op,
      targetType,
      predicate,
      description: finalDescription,
      isArray: false,
      isFuzzy: op.includes('~'),
      isBidirectional: op.includes('<') && op.includes('>') && op !== '<-' && op !== '<~',
      routeParam,
      filters,
    },
  }
}

export function parseFieldType(value: string): ParsedField['type'] {
  if (TYPE_SUFFIX_REGEX.test(value)) {
    const match = value.match(TYPE_SUFFIX_REGEX)
    if (match?.[1]) {
      return match[1].toLowerCase() as 'number' | 'date' | 'boolean'
    }
  }
  if (ENUM_REGEX.test(value)) return 'enum'
  return 'string'
}

export function parseEnumValues(value: string): string[] | undefined {
  if (!ENUM_REGEX.test(value)) return undefined
  return value.split('|').map((v) => v.trim())
}

export function parseField(name: string, value: unknown): ParsedField {
  // String field
  if (typeof value === 'string') {
    const { description, cascade } = parseCascade(value)
    const type = parseFieldType(description)
    return {
      name,
      description: description.replace(TYPE_SUFFIX_REGEX, '').trim(),
      type,
      enumValues: parseEnumValues(description),
      cascade,
    }
  }

  // Array field
  if (Array.isArray(value) && value.length === 1) {
    const item = value[0]
    if (typeof item === 'string') {
      const { description, cascade } = parseCascade(item)
      if (cascade) cascade.isArray = true
      return {
        name,
        description,
        type: 'array',
        cascade,
        arrayItem: {
          name: 'item',
          description,
          type: parseFieldType(description),
          enumValues: parseEnumValues(description),
        },
      }
    }
    if (typeof item === 'object' && item !== null) {
      return {
        name,
        description: `Array of ${name}`,
        type: 'array',
        arrayItem: {
          name: 'item',
          description: `${name} item`,
          type: 'object',
          nested: parseFields(item as Record<string, unknown>),
        },
      }
    }
  }

  // Nested object
  if (typeof value === 'object' && value !== null && !('mdx' in value)) {
    return {
      name,
      description: name,
      type: 'object',
      nested: parseFields(value as Record<string, unknown>),
    }
  }

  // Fallback
  return { name, description: name, type: 'string' }
}

function parseFields(obj: Record<string, unknown>): Record<string, ParsedField> {
  const fields: Record<string, ParsedField> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue
    if (/^on[A-Z]/.test(key)) continue
    if (/^every[A-Z0-9]/.test(key)) continue
    if (CRON_REGEX.test(key)) continue
    if (MIGRATE_REGEX.test(key)) continue
    if (typeof value === 'function') continue
    if (typeof value === 'object' && value !== null && 'mdx' in value) continue
    // Skip generative strings (template variables)
    if (typeof value === 'string' && isGenerativeString(value)) continue

    fields[key] = parseField(key, value)
  }
  return fields
}

function parseDefinition(def: DODefinition): ParsedDefinition {
  const parsed: ParsedDefinition = {
    $type: def.$type,
    $id: def.$id as string | undefined,
    $version: (def.$version as number) || 1,
    $context: def.$context as string | undefined,
    $extends: def.$extends as string | undefined,
    fields: {},
    cascades: {},
    functions: {},
    events: {},
    schedules: {},
    crons: {},
    migrations: {},
  }

  for (const [key, value] of Object.entries(def)) {
    // Skip $-prefixed identity fields
    if (key.startsWith('$')) continue

    // Migration handlers: migrate.N
    const migrateMatch = key.match(MIGRATE_REGEX)
    if (migrateMatch && migrateMatch[1] && typeof value === 'function') {
      parsed.migrations[parseInt(migrateMatch[1], 10)] = value as MigrateHandler
      continue
    }

    // Event handlers: onNounEvent
    if (/^on[A-Z]/.test(key) && typeof value === 'function') {
      parsed.events[key] = value as EventHandler
      continue
    }

    // Schedule handlers: everyInterval
    if (/^every[A-Z0-9]/.test(key) && typeof value === 'function') {
      parsed.schedules[key] = value as ScheduleHandler
      continue
    }

    // Cron handlers: '* * * * *'
    if (CRON_REGEX.test(key) && typeof value === 'function') {
      parsed.crons[key] = value as ScheduleHandler
      continue
    }

    // Functions: code or generative
    if (typeof value === 'function') {
      parsed.functions[key] = value as CodeFunctionDef
      continue
    }
    if (typeof value === 'object' && value !== null && 'mdx' in value) {
      parsed.functions[key] = value as GenerativeFunctionDef
      continue
    }

    // String with template vars -> generative function
    if (typeof value === 'string' && isGenerativeString(value)) {
      parsed.functions[key] = { mdx: value }
      continue
    }

    // Fields (may include cascades)
    const field = parseField(key, value)
    parsed.fields[key] = field
    if (field.cascade) {
      parsed.cascades[key] = field.cascade
    }
  }

  return parsed
}

// ============================================
// DigitalObjectDefinition Class
// ============================================

export class DigitalObjectDefinition<T extends DODefinition = DODefinition> {
  readonly $type: string
  readonly $id?: string | undefined
  readonly $version: number
  readonly $context?: string | undefined
  readonly $extends?: string | undefined

  private _raw: T
  private _parsed: ParsedDefinition
  private _storage?: DOStorage | undefined
  private _context?: DOContext | undefined
  private _memoryInstances = new Map<string, Record<string, unknown>>()

  constructor(definition: T, storage?: DOStorage) {
    this._raw = definition
    this._parsed = parseDefinition(definition)
    this.$type = this._parsed.$type
    this.$id = this._parsed.$id
    this.$version = this._parsed.$version
    this.$context = this._parsed.$context
    this.$extends = this._parsed.$extends
    this._storage = storage
  }

  // ========================================
  // Storage Binding
  // ========================================

  /** Bind to DO storage for persistence */
  bind(storage: DOStorage): this {
    this._storage = storage
    this._context = this._createContext()

    // Check for version upgrade and run migrations
    this._checkMigrations()

    // Store/update definition
    storage.put('$', this.toJSON())
    storage.put('$version', this.$version)

    return this
  }

  private _createContext(): DOContext {
    const self = this
    return {
      $id: this.$id || '',
      $type: this.$type,
      $version: this.$version,
      $extends: this.$extends,
      $parent: this.$context,

      instances: () => self.instances(),
      create: (id, data) => self.create(id, data),
      get: (id) => self.get(id),
      put: (id, data) => self.put(id, data),
      delete: (id) => self.delete(id),

      cascade: async (instance, field) => {
        // TODO: Implement cascade generation
        console.log(`Cascade ${field} for ${instance.$id}`)
      },

      search: async (instance, field) => {
        // TODO: Implement semantic search
        console.log(`Search ${field} for ${instance.$id}`)
      },

      call: async (name, ...args) => {
        return self.call(name, ...args)
      },

      emit: (event, payload) => {
        // TODO: Implement event emission
        console.log(`Emit ${event}`, payload)
      },

      storage: this._storage!,
    }
  }

  private _checkMigrations(): void {
    if (!this._storage || !this._context) return

    const storedVersion = this._storage.get<number>('$version') || 0

    if (storedVersion < this.$version) {
      // Run migrations in order
      const versions = Object.keys(this._parsed.migrations)
        .map(Number)
        .filter((v) => v > storedVersion && v <= this.$version)
        .sort((a, b) => a - b)

      for (const version of versions) {
        const migrate = this._parsed.migrations[version]
        if (migrate) {
          console.log(`Running migration to version ${version}`)
          migrate(this._context)
        }
      }

      // Update stored version
      this._storage.put('$version', this.$version)
    }
  }

  // ========================================
  // Schema Access
  // ========================================

  get fields(): Record<string, ParsedField> {
    return this._parsed.fields
  }

  get cascades(): Record<string, CascadeDefinition> {
    return this._parsed.cascades
  }

  get functions(): Record<string, FunctionDef> {
    return this._parsed.functions
  }

  get events(): Record<string, EventHandler> {
    return this._parsed.events
  }

  get schedules(): Record<string, ScheduleHandler> {
    return this._parsed.schedules
  }

  get crons(): Record<string, ScheduleHandler> {
    return this._parsed.crons
  }

  get migrations(): Record<number, MigrateHandler> {
    return this._parsed.migrations
  }

  // ========================================
  // Instance Management
  // ========================================

  /** Get all instances of this DO type */
  instances(): DOInstance[] {
    const instances: DOInstance[] = []

    if (this._storage) {
      const entries = this._storage.list({ prefix: '' })
      for (const [key, value] of entries) {
        // Skip system keys
        if (key.startsWith('$')) continue
        if (typeof value !== 'object' || value === null) continue

        instances.push({
          $id: key,
          $type: this.$type,
          $version: ((value as Record<string, unknown>)['$version'] as number) || this.$version,
          data: value as Record<string, unknown>,
        })
      }
    } else {
      // Use in-memory instances when no storage is bound
      for (const [key, value] of this._memoryInstances) {
        instances.push({
          $id: key,
          $type: this.$type,
          $version: ((value as Record<string, unknown>)['$version'] as number) || this.$version,
          data: value,
        })
      }
    }

    return instances
  }

  /** Get a specific instance by ID */
  get(id: string): DOInstance | null {
    let data: Record<string, unknown> | null = null

    if (this._storage) {
      data = this._storage.get<Record<string, unknown>>(id)
    } else {
      data = this._memoryInstances.get(id) || null
    }

    if (!data) return null

    return {
      $id: id,
      $type: this.$type,
      $version: (data['$version'] as number) || this.$version,
      data,
    }
  }

  /** Create a new instance */
  create(id: string, data: Record<string, unknown>): DOInstance {
    const instance: DOInstance = {
      $id: id,
      $type: this.$type,
      $version: this.$version,
      data: { ...data, $version: this.$version },
    }

    if (this._storage) {
      this._storage.put(id, instance.data)
    } else {
      this._memoryInstances.set(id, instance.data)
    }

    // Trigger onCreate event if exists
    const eventName = `on${this.$type}Created`
    if (this._parsed.events[eventName]) {
      // Create context if not exists (for in-memory mode)
      const ctx = this._context || this._createContext()
      this._parsed.events[eventName](instance, ctx)
    }

    return instance
  }

  /** Update an instance */
  put(id: string, data: Record<string, unknown>): DOInstance {
    const existing = this.get(id)
    const instance: DOInstance = {
      $id: id,
      $type: this.$type,
      $version: this.$version,
      data: { ...data, $version: this.$version },
    }

    if (this._storage) {
      this._storage.put(id, instance.data)
    } else {
      this._memoryInstances.set(id, instance.data)
    }

    // Trigger onUpdate event if exists
    const eventName = `on${this.$type}Updated`
    if (this._parsed.events[eventName] && this._context) {
      this._parsed.events[eventName]({ previous: existing, current: instance }, this._context)
    }

    return instance
  }

  /** Delete an instance */
  delete(id: string): boolean {
    const instance = this.get(id)
    if (!instance) return false

    if (this._storage) {
      this._storage.delete(id)
    } else {
      this._memoryInstances.delete(id)
    }

    // Trigger onDelete event if exists
    const eventName = `on${this.$type}Deleted`
    if (this._parsed.events[eventName] && this._context) {
      this._parsed.events[eventName](instance, this._context)
    }

    return true
  }

  // ========================================
  // Function Execution
  // ========================================

  /** Call a function by name */
  async call(name: string, ...args: unknown[]): Promise<unknown> {
    const fn = this._parsed.functions[name]
    if (!fn) {
      throw new Error(`Function '${name}' not found`)
    }

    // Code function
    if (typeof fn === 'function') {
      return fn(...args)
    }

    // Generative function (MDX)
    if ('mdx' in fn) {
      // TODO: Execute via AI service
      return {
        _generate: true,
        mdx: fn.mdx,
        args,
        schema: fn.schema,
        model: fn.model,
      }
    }

    throw new Error(`Unknown function type for '${name}'`)
  }

  // ========================================
  // Serialization
  // ========================================

  /** Serialize to JSON object */
  toJSON(): Record<string, unknown> {
    const json: Record<string, unknown> = {
      $type: this.$type,
      $version: this.$version,
    }

    if (this.$id) json['$id'] = this.$id
    if (this.$context) json['$context'] = this.$context

    // Serialize fields (raw values)
    for (const [key, value] of Object.entries(this._raw)) {
      if (key.startsWith('$')) continue

      // Functions become strings
      if (typeof value === 'function') {
        json[key] = value.toString()
        continue
      }

      // Everything else passes through
      json[key] = value
    }

    return json
  }

  /** Serialize to JSON string */
  toString(): string {
    return JSON.stringify(this.toJSON(), null, 2)
  }

  /** Parse from JSON string or object */
  static parse<T extends DODefinition>(
    input: string | Record<string, unknown>
  ): DigitalObjectDefinition<T> {
    const obj = typeof input === 'string' ? JSON.parse(input) : input

    // Convert function strings back to functions
    const def: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && isFunctionString(value)) {
        def[key] = parseFunction(value)
      } else {
        def[key] = value
      }
    }

    return new DigitalObjectDefinition(def as T)
  }
}

// ============================================
// Function String Detection & Parsing
// ============================================

function isFunctionString(str: string): boolean {
  const trimmed = str.trim()
  return (
    (trimmed.startsWith('(') && trimmed.includes('=>')) ||
    trimmed.startsWith('async (') ||
    trimmed.startsWith('function') ||
    trimmed.startsWith('async function') ||
    /^\w+\s*=>/.test(trimmed)
  )
}

function parseFunction(str: string): (...args: unknown[]) => unknown {
  // For safety, we don't eval - we store the string and execute via ai-evaluate
  // Return a placeholder that stores the original code
  const fn = (...args: unknown[]) => ({
    _execute: true,
    code: str,
    args,
  })
  ;(fn as { _code?: string })._code = str
  return fn
}

// ============================================
// DO() Factory Function
// ============================================

/**
 * Callable definition type - can be called to create extended definitions
 * @example
 * const Startup = DO({ $type: 'Startup', name: 'Name' })
 * const TechStartup = Startup({ $type: 'TechStartup', techStack: ['Stack'] })
 */
export type CallableDefinition<T extends DODefinition = DODefinition> =
  DigitalObjectDefinition<T> & {
    <U extends Partial<DODefinition>>(extension: U): CallableDefinition<T & U>
  }

/**
 * Make a DigitalObjectDefinition callable for extension
 * Uses a function wrapper since Proxy apply only works on function targets
 */
function makeCallable<T extends DODefinition>(
  definition: DigitalObjectDefinition<T>,
  rawDef: T
): CallableDefinition<T> {
  // Create a callable function that extends the definition
  const callable = function (extension: Partial<DODefinition>) {
    // Merge parent definition with extension
    const merged = {
      ...rawDef,
      ...extension,
      // Track lineage
      $extends: rawDef.$type,
      // Merge $version: extension wins if specified, otherwise inherit
      $version: extension.$version ?? rawDef.$version ?? 1,
    }
    return DO(merged as T & typeof extension)
  } as CallableDefinition<T>

  // Copy all properties and methods from the definition to the callable
  Object.setPrototypeOf(callable, Object.getPrototypeOf(definition))

  // Copy own properties
  const props = Object.getOwnPropertyDescriptors(definition)
  for (const [key, descriptor] of Object.entries(props)) {
    Object.defineProperty(callable, key, descriptor)
  }

  // Also copy the private fields by proxying property access
  return new Proxy(callable, {
    get(target, prop, receiver) {
      // First check if it's on the callable function itself
      if (prop in target) {
        const value = Reflect.get(target, prop, receiver)
        // Bind methods to the definition instance
        if (typeof value === 'function' && prop !== 'constructor') {
          return value.bind(definition)
        }
        return value
      }
      // Then check the definition instance
      const value = Reflect.get(definition, prop, definition)
      // Bind methods to the definition instance
      if (typeof value === 'function' && prop !== 'constructor') {
        return value.bind(definition)
      }
      return value
    },
    set(target, prop, value, receiver) {
      return Reflect.set(definition, prop, value, definition)
    },
  })
}

export function DO<T extends DODefinition>(
  definition: T | string,
  storage?: DOStorage
): CallableDefinition<T> {
  if (typeof definition === 'string') {
    const parsed = DigitalObjectDefinition.parse<T>(definition)
    return makeCallable(parsed, JSON.parse(definition) as T)
  }
  const dod = new DigitalObjectDefinition(definition, storage)
  if (storage) {
    dod.bind(storage)
  }
  return makeCallable(dod, definition)
}

// Attach parse method for convenience
DO.parse = DigitalObjectDefinition.parse

// ============================================
// Exports
// ============================================

export type {
  ParsedDefinition,
  ParsedField,
  CascadeDefinition,
  CascadeOperator,
  GenerativeFunctionDef,
  CodeFunctionDef,
  FunctionDef,
  EventHandler,
  ScheduleHandler,
  MigrateHandler,
  InferSchema,
  FilterCondition,
}
