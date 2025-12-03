/**
 * Schema-first Database Definition
 *
 * Declarative schema with automatic bi-directional relationships.
 *
 * @example
 * ```ts
 * const db = DB({
 *   Post: {
 *     title: 'string',
 *     author: 'Author.posts',     // one-to-many: Post.author -> Author, Author.posts -> Post[]
 *     tags: ['Tag.posts'],        // many-to-many: Post.tags -> Tag[], Tag.posts -> Post[]
 *   },
 *   Author: {
 *     name: 'string',
 *     // posts: Post[] auto-created from backref
 *   },
 *   Tag: {
 *     name: 'string',
 *     // posts: Post[] auto-created from backref
 *   }
 * })
 *
 * // Typed access
 * const post = await db.Post.get('123')
 * post.author  // Author (single)
 * post.tags    // Tag[] (array)
 * ```
 */

// =============================================================================
// Schema Definition Types
// =============================================================================

/**
 * Primitive field types
 */
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
 * A field definition can be:
 * - A primitive type: 'string', 'number', etc.
 * - A relation: 'Author.posts' (Type.backref)
 * - An array of primitives: 'string[]'
 * - An array relation: ['Author.posts'] (many-to-many with backref)
 * - Optional modifier: 'string?'
 */
export type FieldDefinition = string | [string]

/**
 * Schema for a single entity type
 */
export type EntitySchema = Record<string, FieldDefinition>

/**
 * Full database schema
 */
export type DatabaseSchema = Record<string, EntitySchema>

// =============================================================================
// Parsed Schema Types
// =============================================================================

/**
 * Parsed field information
 */
export interface ParsedField {
  name: string
  type: string
  isArray: boolean
  isOptional: boolean
  isRelation: boolean
  relatedType?: string
  backref?: string
}

/**
 * Parsed entity with all fields including auto-generated backrefs
 */
export interface ParsedEntity {
  name: string
  fields: Map<string, ParsedField>
}

/**
 * Fully parsed schema with bi-directional relationships resolved
 */
export interface ParsedSchema {
  entities: Map<string, ParsedEntity>
}

// =============================================================================
// Schema Parsing
// =============================================================================

/**
 * Parse a single field definition
 */
function parseField(name: string, definition: FieldDefinition): ParsedField {
  // Handle array literal syntax: ['Author.posts']
  if (Array.isArray(definition)) {
    const inner = parseField(name, definition[0])
    return { ...inner, isArray: true }
  }

  let type = definition
  let isArray = false
  let isOptional = false
  let isRelation = false
  let relatedType: string | undefined
  let backref: string | undefined

  // Check for optional modifier
  if (type.endsWith('?')) {
    isOptional = true
    type = type.slice(0, -1)
  }

  // Check for array modifier (string syntax)
  if (type.endsWith('[]')) {
    isArray = true
    type = type.slice(0, -2)
  }

  // Check for relation (contains a dot for backref)
  if (type.includes('.')) {
    isRelation = true
    const [entityName, backrefName] = type.split('.')
    relatedType = entityName
    backref = backrefName
    type = entityName!
  } else if (type[0] === type[0]?.toUpperCase() && !isPrimitiveType(type)) {
    // PascalCase non-primitive = relation without explicit backref
    isRelation = true
    relatedType = type
  }

  return {
    name,
    type,
    isArray,
    isOptional,
    isRelation,
    relatedType,
    backref,
  }
}

/**
 * Check if a type is a primitive
 */
function isPrimitiveType(type: string): boolean {
  const primitives: PrimitiveType[] = [
    'string',
    'number',
    'boolean',
    'date',
    'datetime',
    'json',
    'markdown',
    'url',
  ]
  return primitives.includes(type as PrimitiveType)
}

/**
 * Parse a database schema and resolve bi-directional relationships
 */
export function parseSchema(schema: DatabaseSchema): ParsedSchema {
  const entities = new Map<string, ParsedEntity>()

  // First pass: parse all entities and their fields
  for (const [entityName, entitySchema] of Object.entries(schema)) {
    const fields = new Map<string, ParsedField>()

    for (const [fieldName, fieldDef] of Object.entries(entitySchema)) {
      fields.set(fieldName, parseField(fieldName, fieldDef))
    }

    entities.set(entityName, { name: entityName, fields })
  }

  // Second pass: create bi-directional relationships
  for (const [entityName, entity] of entities) {
    for (const [fieldName, field] of entity.fields) {
      if (field.isRelation && field.relatedType && field.backref) {
        const relatedEntity = entities.get(field.relatedType)
        if (relatedEntity && !relatedEntity.fields.has(field.backref)) {
          // Auto-create the inverse relation
          // If Post.author -> Author.posts, then Author.posts -> Post[]
          relatedEntity.fields.set(field.backref, {
            name: field.backref,
            type: entityName,
            isArray: true, // Backref is always an array
            isOptional: false,
            isRelation: true,
            relatedType: entityName,
            backref: fieldName, // Points back to the original field
          })
        }
      }
    }
  }

  return { entities }
}

// =============================================================================
// Type Generation (for TypeScript inference)
// =============================================================================

/**
 * Map field type to TypeScript type
 */
type FieldToTS<T extends string> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'boolean'
      ? boolean
      : T extends 'date' | 'datetime'
        ? Date
        : T extends 'json'
          ? Record<string, unknown>
          : T extends 'markdown'
            ? string
            : T extends 'url'
              ? string
              : unknown

/**
 * Infer entity type from schema definition
 */
export type InferEntity<
  TSchema extends DatabaseSchema,
  TEntity extends keyof TSchema,
> = {
  $id: string
  $type: TEntity
} & {
  [K in keyof TSchema[TEntity]]: TSchema[TEntity][K] extends `${infer Type}.${string}`
    ? Type extends keyof TSchema
      ? InferEntity<TSchema, Type>
      : unknown
    : TSchema[TEntity][K] extends `${infer Type}[]`
      ? Type extends keyof TSchema
        ? InferEntity<TSchema, Type>[]
        : FieldToTS<Type>[]
      : TSchema[TEntity][K] extends `${infer Type}?`
        ? FieldToTS<Type> | undefined
        : FieldToTS<TSchema[TEntity][K] & string>
}

// =============================================================================
// Typed Operations
// =============================================================================

/**
 * Operations available on each entity type
 */
export interface EntityOperations<T> {
  /** Get an entity by ID */
  get(id: string): Promise<T | null>

  /** List all entities */
  list(options?: ListOptions): Promise<T[]>

  /** Find entities matching criteria */
  find(where: Partial<T>): Promise<T[]>

  /** Search entities */
  search(query: string, options?: SearchOptions): Promise<T[]>

  /** Create a new entity */
  create(data: Omit<T, '$id' | '$type'>): Promise<T>
  create(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>

  /** Update an entity */
  update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T>

  /** Upsert an entity */
  upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>

  /** Delete an entity */
  delete(id: string): Promise<boolean>

  /** Iterate over entities */
  forEach(callback: (entity: T) => void | Promise<void>): Promise<void>
  forEach(
    options: ListOptions,
    callback: (entity: T) => void | Promise<void>
  ): Promise<void>
}

export interface ListOptions {
  where?: Record<string, unknown>
  orderBy?: string
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface SearchOptions extends ListOptions {
  fields?: string[]
  minScore?: number
}

// =============================================================================
// Database Client Type
// =============================================================================

/**
 * Typed database client based on schema
 */
export type TypedDB<TSchema extends DatabaseSchema> = {
  [K in keyof TSchema]: EntityOperations<InferEntity<TSchema, K>>
} & {
  /** The parsed schema */
  readonly $schema: ParsedSchema

  /** Get any entity by URL */
  get(url: string): Promise<unknown>

  /** Search across all entities */
  search(query: string, options?: SearchOptions): Promise<unknown[]>
}

// =============================================================================
// Provider Interface
// =============================================================================

/**
 * Database provider interface that adapters must implement
 */
export interface DBProvider {
  /** Get an entity */
  get(type: string, id: string): Promise<Record<string, unknown> | null>

  /** List entities */
  list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]>

  /** Search entities */
  search(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]>

  /** Create an entity */
  create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>

  /** Update an entity */
  update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>

  /** Delete an entity */
  delete(type: string, id: string): Promise<boolean>

  /** Get related entities */
  related(
    type: string,
    id: string,
    relation: string
  ): Promise<Record<string, unknown>[]>

  /** Create a relationship */
  relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>

  /** Remove a relationship */
  unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>
}

// =============================================================================
// Provider Resolution
// =============================================================================

let globalProvider: DBProvider | null = null
let providerPromise: Promise<DBProvider> | null = null

/** File count threshold for suggesting ClickHouse upgrade */
const FILE_COUNT_THRESHOLD = 10_000

/**
 * Set the global database provider
 */
export function setProvider(provider: DBProvider): void {
  globalProvider = provider
  providerPromise = null
}

/**
 * Parsed DATABASE_URL
 */
interface ParsedDatabaseUrl {
  provider: 'fs' | 'sqlite' | 'clickhouse' | 'memory'
  /** Content root directory */
  root: string
  /** Remote URL for Turso/ClickHouse HTTP */
  remoteUrl?: string
}

/**
 * Parse DATABASE_URL into provider type and paths
 *
 * Local storage (all use .db/ folder):
 * - `./content` → fs (default)
 * - `sqlite://./content` → sqlite stored in ./content/.db/index.sqlite
 * - `chdb://./content` → clickhouse stored in ./content/.db/clickhouse/
 *
 * Remote:
 * - `libsql://your-db.turso.io` → Turso SQLite
 * - `clickhouse://host:8123` → ClickHouse HTTP
 * - `:memory:` → in-memory
 */
function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  if (!url) return { provider: 'fs', root: './content' }

  // In-memory
  if (url === ':memory:') {
    return { provider: 'memory', root: '' }
  }

  // Remote Turso
  if (url.startsWith('libsql://') || url.includes('.turso.io')) {
    return { provider: 'sqlite', root: '', remoteUrl: url }
  }

  // Remote ClickHouse
  if (url.startsWith('clickhouse://') && url.includes(':')) {
    // clickhouse://host:port/db
    return { provider: 'clickhouse', root: '', remoteUrl: url.replace('clickhouse://', 'https://') }
  }

  // Local SQLite: sqlite://./content → ./content/.db/index.sqlite
  if (url.startsWith('sqlite://')) {
    const root = url.replace('sqlite://', '') || './content'
    return { provider: 'sqlite', root }
  }

  // Local ClickHouse (chDB): chdb://./content → ./content/.db/clickhouse/
  if (url.startsWith('chdb://')) {
    const root = url.replace('chdb://', '') || './content'
    return { provider: 'clickhouse', root }
  }

  // Default: filesystem
  return { provider: 'fs', root: url }
}

/**
 * Resolve provider from DATABASE_URL environment variable
 *
 * @example
 * ```bash
 * # Filesystem (default) - stores in ./content with .db/ metadata
 * DATABASE_URL=./content
 *
 * # Local SQLite - stores in ./content/.db/index.sqlite
 * DATABASE_URL=sqlite://./content
 *
 * # Remote Turso
 * DATABASE_URL=libsql://your-db.turso.io
 *
 * # Local ClickHouse (chDB) - stores in ./content/.db/clickhouse/
 * DATABASE_URL=chdb://./content
 *
 * # Remote ClickHouse
 * DATABASE_URL=clickhouse://localhost:8123
 *
 * # In-memory (testing)
 * DATABASE_URL=:memory:
 * ```
 */
async function resolveProvider(): Promise<DBProvider> {
  if (globalProvider) return globalProvider

  if (providerPromise) return providerPromise

  providerPromise = (async () => {
    const databaseUrl =
      (typeof process !== 'undefined' && process.env?.DATABASE_URL) || './content'

    const parsed = parseDatabaseUrl(databaseUrl)

    switch (parsed.provider) {
      case 'memory': {
        const { createMemoryProvider } = await import('./memory-provider.js')
        globalProvider = createMemoryProvider()
        break
      }

      case 'fs': {
        try {
          const { createFsProvider } = await import('@mdxdb/fs/provider' as any)
          globalProvider = createFsProvider({ root: parsed.root })

          // Check file count and warn if approaching threshold
          checkFileCountThreshold(parsed.root)
        } catch (err) {
          console.warn('@mdxdb/fs not available, falling back to memory provider')
          const { createMemoryProvider } = await import('./memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      case 'sqlite': {
        try {
          const { createSqliteProvider } = await import('@mdxdb/sqlite/provider' as any)

          if (parsed.remoteUrl) {
            // Remote Turso
            globalProvider = await createSqliteProvider({ url: parsed.remoteUrl })
          } else {
            // Local SQLite in .db folder
            const dbPath = `${parsed.root}/.db/index.sqlite`
            globalProvider = await createSqliteProvider({ url: `file:${dbPath}` })
          }
        } catch (err) {
          console.warn('@mdxdb/sqlite not available, falling back to memory provider')
          const { createMemoryProvider } = await import('./memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      case 'clickhouse': {
        try {
          const { createClickhouseProvider } = await import('@mdxdb/clickhouse/provider' as any)

          if (parsed.remoteUrl) {
            // Remote ClickHouse
            globalProvider = await createClickhouseProvider({
              mode: 'http',
              url: parsed.remoteUrl,
            })
          } else {
            // Local chDB in .db folder
            const dbPath = `${parsed.root}/.db/clickhouse`
            globalProvider = await createClickhouseProvider({
              mode: 'chdb',
              url: dbPath,
            })
          }
        } catch (err) {
          console.warn('@mdxdb/clickhouse not available, falling back to memory provider')
          const { createMemoryProvider } = await import('./memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      default: {
        const { createMemoryProvider } = await import('./memory-provider.js')
        globalProvider = createMemoryProvider()
      }
    }

    return globalProvider!
  })()

  return providerPromise
}

/**
 * Check file count and warn if approaching threshold
 */
async function checkFileCountThreshold(root: string): Promise<void> {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    async function countFiles(dir: string): Promise<number> {
      let count = 0
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          if (entry.isDirectory()) {
            count += await countFiles(path.join(dir, entry.name))
          } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
            count++
          }
        }
      } catch {
        // Directory doesn't exist yet
      }
      return count
    }

    const count = await countFiles(root)
    if (count > FILE_COUNT_THRESHOLD) {
      console.warn(
        `\n⚠️  You have ${count.toLocaleString()} MDX files. ` +
        `Consider upgrading to ClickHouse for better performance:\n` +
        `   DATABASE_URL=chdb://./data/clickhouse\n`
      )
    }
  } catch {
    // Ignore errors in file counting
  }
}

// =============================================================================
// DB Factory
// =============================================================================

/**
 * Create a typed database from a schema definition
 *
 * @example
 * ```ts
 * const db = DB({
 *   Post: {
 *     title: 'string',
 *     content: 'markdown',
 *     author: 'Author.posts',
 *     tags: 'Tag[]',
 *   },
 *   Author: {
 *     name: 'string',
 *     email: 'string',
 *     // posts: Post[] - auto-created from Post.author backref
 *   },
 *   Tag: {
 *     name: 'string',
 *   }
 * })
 *
 * // Fully typed operations
 * const post = await db.Post.get('hello-world')
 * const author = await post?.author // Resolved Author
 * const authorPosts = await db.Author.get('john')?.posts // Post[]
 * ```
 */
export function DB<TSchema extends DatabaseSchema>(
  schema: TSchema
): TypedDB<TSchema> {
  const parsedSchema = parseSchema(schema)

  // Create entity operations for each type
  const entityOperations: Record<string, EntityOperations<unknown>> = {}

  for (const [entityName, entity] of parsedSchema.entities) {
    entityOperations[entityName] = createEntityOperations(
      entityName,
      entity,
      parsedSchema
    )
  }

  // Create the typed DB object
  const db = {
    $schema: parsedSchema,

    async get(url: string) {
      const provider = await resolveProvider()
      // Parse URL to get type and id
      const parsed = parseUrl(url)
      return provider.get(parsed.type, parsed.id)
    },

    async search(query: string, options?: SearchOptions) {
      const provider = await resolveProvider()
      const results: unknown[] = []
      for (const [typeName] of parsedSchema.entities) {
        const typeResults = await provider.search(typeName, query, options)
        results.push(...typeResults)
      }
      return results
    },

    ...entityOperations,
  }

  return db as TypedDB<TSchema>
}

/**
 * Parse a URL into type and id
 */
function parseUrl(url: string): { type: string; id: string } {
  // Handle full URLs
  if (url.includes('://')) {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/').filter(Boolean)
    return {
      type: parts[0] || '',
      id: parts.slice(1).join('/'),
    }
  }

  // Handle type/id format
  if (url.includes('/')) {
    const parts = url.split('/')
    return {
      type: parts[0]!,
      id: parts.slice(1).join('/'),
    }
  }

  // Just id
  return { type: '', id: url }
}

/**
 * Create operations for a single entity type
 */
function createEntityOperations<T>(
  typeName: string,
  entity: ParsedEntity,
  schema: ParsedSchema
): EntityOperations<T> {
  return {
    async get(id: string): Promise<T | null> {
      const provider = await resolveProvider()
      const result = await provider.get(typeName, id)
      if (!result) return null
      return hydrateEntity(result, entity, schema) as T
    },

    async list(options?: ListOptions): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.list(typeName, options)
      return Promise.all(
        results.map((r) => hydrateEntity(r, entity, schema) as T)
      )
    },

    async find(where: Partial<T>): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.list(typeName, {
        where: where as Record<string, unknown>,
      })
      return Promise.all(
        results.map((r) => hydrateEntity(r, entity, schema) as T)
      )
    },

    async search(query: string, options?: SearchOptions): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.search(typeName, query, options)
      return Promise.all(
        results.map((r) => hydrateEntity(r, entity, schema) as T)
      )
    },

    async create(
      idOrData: string | Omit<T, '$id' | '$type'>,
      maybeData?: Omit<T, '$id' | '$type'>
    ): Promise<T> {
      const provider = await resolveProvider()
      const id = typeof idOrData === 'string' ? idOrData : undefined
      const data =
        typeof idOrData === 'string'
          ? (maybeData as Record<string, unknown>)
          : (idOrData as Record<string, unknown>)

      const result = await provider.create(typeName, id, data)
      return hydrateEntity(result, entity, schema) as T
    },

    async update(
      id: string,
      data: Partial<Omit<T, '$id' | '$type'>>
    ): Promise<T> {
      const provider = await resolveProvider()
      const result = await provider.update(
        typeName,
        id,
        data as Record<string, unknown>
      )
      return hydrateEntity(result, entity, schema) as T
    },

    async upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T> {
      const provider = await resolveProvider()
      const existing = await provider.get(typeName, id)
      if (existing) {
        const result = await provider.update(
          typeName,
          id,
          data as Record<string, unknown>
        )
        return hydrateEntity(result, entity, schema) as T
      }
      const result = await provider.create(
        typeName,
        id,
        data as Record<string, unknown>
      )
      return hydrateEntity(result, entity, schema) as T
    },

    async delete(id: string): Promise<boolean> {
      const provider = await resolveProvider()
      return provider.delete(typeName, id)
    },

    async forEach(
      optionsOrCallback:
        | ListOptions
        | ((entity: T) => void | Promise<void>),
      maybeCallback?: (entity: T) => void | Promise<void>
    ): Promise<void> {
      const options =
        typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback =
        typeof optionsOrCallback === 'function'
          ? optionsOrCallback
          : maybeCallback!

      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },
  }
}

/**
 * Hydrate an entity with lazy-loaded relations
 */
function hydrateEntity(
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema
): Record<string, unknown> {
  const hydrated: Record<string, unknown> = { ...data }
  const id = (data.$id || data.id) as string

  // Add lazy getters for relations
  for (const [fieldName, field] of entity.fields) {
    if (field.isRelation && field.relatedType) {
      const relatedEntity = schema.entities.get(field.relatedType)
      if (!relatedEntity) continue

      // Define lazy getter
      Object.defineProperty(hydrated, fieldName, {
        get: async () => {
          const provider = await resolveProvider()

          if (field.isArray) {
            // Array relation - get related entities
            const results = await provider.related(
              entity.name,
              id,
              fieldName
            )
            return Promise.all(
              results.map((r) => hydrateEntity(r, relatedEntity, schema))
            )
          } else {
            // Single relation - get the stored ID and fetch
            const relatedId = data[fieldName] as string | undefined
            if (!relatedId) return null
            const result = await provider.get(field.relatedType!, relatedId)
            return result
              ? hydrateEntity(result, relatedEntity, schema)
              : null
          }
        },
        enumerable: true,
        configurable: true,
      })
    }
  }

  return hydrated
}

// =============================================================================
// Re-export for convenience
// =============================================================================

export { parseSchema as parse }
