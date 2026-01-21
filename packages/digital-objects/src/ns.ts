/**
 * NS - Namespace Durable Object
 *
 * SQLite-based implementation of DigitalObjectsProvider for Cloudflare Workers.
 * Each NS instance represents a namespace (tenant) with isolated data.
 */

/// <reference types="@cloudflare/workers-types" />

import type {
  DigitalObjectsProvider,
  Noun,
  NounDefinition,
  Verb,
  VerbDefinition,
  Thing,
  Action,
  ActionStatusType,
  ListOptions,
  ActionOptions,
  ValidationOptions,
  Direction,
} from './types.js'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_BATCH_SIZE,
  validateDirection,
  ActionStatus,
} from './types.js'
import { deriveNoun, deriveVerb } from './linguistic.js'
import { validateData } from './schema-validation.js'
import { NotFoundError, ValidationError, errorToResponse } from './errors.js'
import { ZodError } from 'zod'
import {
  NounDefinitionSchema,
  VerbDefinitionSchema,
  CreateThingSchema,
  UpdateThingSchema,
  PerformActionSchema,
  BatchCreateThingsSchema,
  BatchUpdateThingsSchema,
  BatchDeleteThingsSchema,
  BatchPerformActionsSchema,
} from './http-schemas.js'

/**
 * Convert a ZodError to a ValidationError
 */
function zodErrorToValidationError(error: ZodError): ValidationError {
  const fieldErrors = error.errors.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }))
  return new ValidationError('Request validation failed', fieldErrors)
}

/**
 * Calculate effective limit with safety bounds
 */
function effectiveLimit(requestedLimit?: number): number {
  return Math.min(requestedLimit ?? DEFAULT_LIMIT, MAX_LIMIT)
}

// Whitelist of allowed orderBy fields for SQL injection prevention
const ALLOWED_ORDER_FIELDS = [
  'createdAt',
  'updatedAt',
  'id',
  'noun',
  'verb',
  'status',
  'name',
  'title',
]

/**
 * Validates an orderBy field name to prevent SQL injection.
 * Allows whitelisted fields or simple alphanumeric field names.
 */
function validateOrderByField(field: string): boolean {
  // Allow whitelisted fields
  if (ALLOWED_ORDER_FIELDS.includes(field)) return true
  // Only allow simple alphanumeric field names (letters, numbers, underscores)
  // Must start with a letter or underscore
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)
}

/**
 * Validates a namespace ID to ensure it contains only safe characters.
 * Used to validate the 'ns' query parameter before using it to identify a Durable Object.
 *
 * Allowed: alphanumeric characters, hyphens, underscores
 * Maximum length: 64 characters
 *
 * @param ns - The namespace ID to validate
 * @returns true if valid, false otherwise
 */
export function validateNamespaceId(ns: string): boolean {
  // Check length limit
  if (ns.length > 64) return false
  // Empty string is invalid
  if (ns.length === 0) return false
  // Allow alphanumeric, hyphens, underscores
  return /^[a-zA-Z0-9_-]+$/.test(ns)
}

// Dangerous field names that could enable prototype pollution or other attacks
const DANGEROUS_FIELDS = ['__proto__', 'constructor', 'prototype']

/**
 * Validates a where clause field name to prevent JSON path traversal and prototype pollution.
 * Throws ValidationError if the field name is invalid.
 *
 * Rejects:
 * - Dots (.) in field names (JSON path traversal)
 * - __proto__, constructor, prototype (prototype pollution)
 * - Special JSON path characters ([, ], $, @)
 */
function validateWhereField(field: string): void {
  // Check for dangerous prototype-related field names
  if (DANGEROUS_FIELDS.includes(field)) {
    throw new ValidationError(`Invalid where field: '${field}' is not allowed`, [
      { field, message: `Field name '${field}' is not allowed for security reasons` },
    ])
  }

  // Check for dots (JSON path traversal)
  if (field.includes('.')) {
    throw new ValidationError(`Invalid where field: '${field}' contains dots`, [
      { field, message: 'Field names cannot contain dots (JSON path traversal prevention)' },
    ])
  }

  // Check for special JSON path characters
  if (/[\[\]$@]/.test(field)) {
    throw new ValidationError(`Invalid where field: '${field}' contains special characters`, [
      { field, message: 'Field names cannot contain special JSON path characters ([, ], $, @)' },
    ])
  }

  // Must match valid identifier pattern (starts with letter or underscore, followed by alphanumeric or underscore)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
    throw new ValidationError(`Invalid where field: '${field}'`, [
      {
        field,
        message: 'Field name must be a valid identifier (letters, numbers, underscores only)',
      },
    ])
  }
}

/**
 * Escapes LIKE pattern special characters (%, _, \) in a search query.
 * This prevents SQL LIKE wildcards from being interpreted as pattern characters.
 *
 * - % matches zero or more characters in LIKE
 * - _ matches exactly one character in LIKE
 * - \ is the escape character itself
 *
 * Example: "100%" becomes "100\%" to match literal "100%"
 */
function escapeLikePattern(query: string): string {
  return query.replace(/[%_\\]/g, '\\$&')
}

// Environment bindings
export interface Env {
  NS: DurableObjectNamespace
  STORAGE?: R2Bucket
}

/**
 * NS - Namespace Durable Object
 */
export class NS implements DigitalObjectsProvider {
  private sql: SqlStorage
  private initialized = false

  // Caches for noun and verb definitions to reduce database lookups
  private nounCache = new Map<string, Noun>()
  private verbCache = new Map<string, Verb>()

  constructor(ctx: DurableObjectState, _env: Env) {
    this.sql = ctx.storage.sql
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    // Create tables
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS nouns (
        name TEXT PRIMARY KEY,
        singular TEXT NOT NULL,
        plural TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT,
        schema TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS verbs (
        name TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        act TEXT NOT NULL,
        activity TEXT NOT NULL,
        event TEXT NOT NULL,
        reverse_by TEXT,
        reverse_at TEXT,
        reverse_in TEXT,
        inverse TEXT,
        description TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS things (
        id TEXT PRIMARY KEY,
        noun TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_things_noun ON things(noun);

      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        verb TEXT NOT NULL,
        subject TEXT,
        object TEXT,
        data TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_actions_verb ON actions(verb);
      CREATE INDEX IF NOT EXISTS idx_actions_subject ON actions(subject);
      CREATE INDEX IF NOT EXISTS idx_actions_object ON actions(object);
      CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
    `)

    this.initialized = true
  }

  // HTTP API handler
  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized()

    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    try {
      // Route to appropriate handler
      if (path === '/nouns' && method === 'POST') {
        const rawBody = await request.json()
        const body = NounDefinitionSchema.parse(rawBody)
        const noun = await this.defineNoun(body)
        return Response.json(noun)
      }

      if (path.startsWith('/nouns/') && method === 'GET') {
        const name = decodeURIComponent(path.slice('/nouns/'.length))
        const noun = await this.getNoun(name)
        return noun ? Response.json(noun) : new Response('Not found', { status: 404 })
      }

      if (path === '/nouns' && method === 'GET') {
        const nouns = await this.listNouns()
        return Response.json(nouns)
      }

      if (path === '/verbs' && method === 'POST') {
        const rawBody = await request.json()
        const body = VerbDefinitionSchema.parse(rawBody)
        const verb = await this.defineVerb(body)
        return Response.json(verb)
      }

      if (path.startsWith('/verbs/') && method === 'GET') {
        const name = decodeURIComponent(path.slice('/verbs/'.length))
        const verb = await this.getVerb(name)
        return verb ? Response.json(verb) : new Response('Not found', { status: 404 })
      }

      if (path === '/verbs' && method === 'GET') {
        const verbs = await this.listVerbs()
        return Response.json(verbs)
      }

      if (path === '/things' && method === 'POST') {
        const rawBody = await request.json()
        const { noun, data, id } = CreateThingSchema.parse(rawBody)
        const thing = await this.create(noun, data, id)
        return Response.json(thing)
      }

      if (path.startsWith('/things/') && method === 'GET') {
        const id = decodeURIComponent(path.slice('/things/'.length))
        const thing = await this.get(id)
        return thing ? Response.json(thing) : new Response('Not found', { status: 404 })
      }

      if (path.startsWith('/things/') && method === 'PATCH') {
        const id = decodeURIComponent(path.slice('/things/'.length))
        const rawBody = await request.json()
        const { data } = UpdateThingSchema.parse(rawBody)
        const thing = await this.update(id, data)
        return Response.json(thing)
      }

      if (path.startsWith('/things/') && method === 'DELETE') {
        const id = decodeURIComponent(path.slice('/things/'.length))
        const deleted = await this.delete(id)
        return Response.json({ deleted })
      }

      if (path === '/things' && method === 'GET') {
        const noun = url.searchParams.get('noun')
        if (!noun) {
          return new Response('noun parameter required', { status: 400 })
        }
        const options: ListOptions = {}
        const limit = url.searchParams.get('limit')
        const offset = url.searchParams.get('offset')
        const orderBy = url.searchParams.get('orderBy')
        const order = url.searchParams.get('order')
        const whereParam = url.searchParams.get('where')
        if (limit) options.limit = parseInt(limit, 10)
        if (offset) options.offset = parseInt(offset, 10)
        if (orderBy) options.orderBy = orderBy
        if (order === 'asc' || order === 'desc') options.order = order
        // Parse where parameter: format is "field=value" or "field1=value1&field2=value2"
        if (whereParam) {
          const where: Record<string, unknown> = {}
          for (const pair of whereParam.split('&')) {
            const eqIdx = pair.indexOf('=')
            if (eqIdx > 0) {
              const key = pair.substring(0, eqIdx)
              const value = pair.substring(eqIdx + 1)
              // Validation happens in list() method, but we validate here too for early error detection
              validateWhereField(key)
              where[key] = value
            }
          }
          options.where = where
        }
        const things = await this.list(noun, options)
        return Response.json(things)
      }

      if (path === '/search' && method === 'GET') {
        const query = url.searchParams.get('q') ?? ''
        const options: ListOptions = {}
        const limit = url.searchParams.get('limit')
        if (limit) options.limit = parseInt(limit, 10)
        const things = await this.search(query, options)
        return Response.json(things)
      }

      if (path === '/actions' && method === 'POST') {
        const rawBody = await request.json()
        const { verb, subject, object, data } = PerformActionSchema.parse(rawBody)
        const action = await this.perform(verb, subject, object, data)
        return Response.json(action)
      }

      if (path.startsWith('/actions/') && method === 'GET') {
        const id = decodeURIComponent(path.slice('/actions/'.length))
        const action = await this.getAction(id)
        return action ? Response.json(action) : new Response('Not found', { status: 404 })
      }

      if (path.startsWith('/actions/') && method === 'DELETE') {
        const id = decodeURIComponent(path.slice('/actions/'.length))
        const deleted = await this.deleteAction(id)
        return Response.json({ deleted })
      }

      if (path === '/actions' && method === 'GET') {
        const options: ActionOptions = {}
        const verb = url.searchParams.get('verb')
        const subject = url.searchParams.get('subject')
        const object = url.searchParams.get('object')
        const limit = url.searchParams.get('limit')
        const status = url.searchParams.get('status')
        if (verb) options.verb = verb
        if (subject) options.subject = subject
        if (object) options.object = object
        if (limit) options.limit = parseInt(limit, 10)
        if (status) options.status = status as ActionStatusType
        const actions = await this.listActions(options)
        return Response.json(actions)
      }

      if (path.startsWith('/edges/') && method === 'GET') {
        const id = decodeURIComponent(path.slice('/edges/'.length))
        const verb = url.searchParams.get('verb') ?? undefined
        const directionParam = url.searchParams.get('direction') ?? 'out'
        const direction = validateDirection(directionParam)
        const edges = await this.edges(id, verb, direction)
        return Response.json(edges)
      }

      if (path.startsWith('/related/') && method === 'GET') {
        const id = decodeURIComponent(path.slice('/related/'.length))
        const verb = url.searchParams.get('verb') ?? undefined
        const directionParam = url.searchParams.get('direction') ?? 'out'
        const direction = validateDirection(directionParam)
        const things = await this.related(id, verb, direction)
        return Response.json(things)
      }

      // Batch operations
      if (path === '/batch/things' && method === 'POST') {
        const rawBody = await request.json()
        const { noun, items } = BatchCreateThingsSchema.parse(rawBody)
        const things = await this.createMany(noun, items)
        return Response.json(things)
      }

      if (path === '/batch/things' && method === 'PATCH') {
        const rawBody = await request.json()
        const { updates } = BatchUpdateThingsSchema.parse(rawBody)
        const things = await this.updateMany(updates)
        return Response.json(things)
      }

      if (path === '/batch/things' && method === 'DELETE') {
        const rawBody = await request.json()
        const { ids } = BatchDeleteThingsSchema.parse(rawBody)
        const results = await this.deleteMany(ids)
        return Response.json(results)
      }

      if (path === '/batch/actions' && method === 'POST') {
        const rawBody = await request.json()
        const { actions } = BatchPerformActionsSchema.parse(rawBody)
        const results = await this.performMany(actions as Array<{ verb: string; subject?: string; object?: string; data?: unknown }>)
        return Response.json(results)
      }

      return Response.json({ error: 'NOT_FOUND', message: 'Endpoint not found' }, { status: 404 })
    } catch (error) {
      // Convert ZodError to ValidationError for consistent error handling
      const normalizedError = error instanceof ZodError ? zodErrorToValidationError(error) : error
      const { body, status } = errorToResponse(normalizedError)
      return Response.json(body, { status })
    }
  }

  // ==================== Nouns ====================

  async defineNoun(def: NounDefinition): Promise<Noun> {
    await this.ensureInitialized()

    const derived = deriveNoun(def.name)
    const now = Date.now()

    this.sql.exec(
      `INSERT OR REPLACE INTO nouns (name, singular, plural, slug, description, schema, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      def.name,
      def.singular ?? derived.singular,
      def.plural ?? derived.plural,
      derived.slug,
      def.description ?? null,
      def.schema ? JSON.stringify(def.schema) : null,
      now
    )

    const noun: Noun = {
      name: def.name,
      singular: def.singular ?? derived.singular,
      plural: def.plural ?? derived.plural,
      slug: derived.slug,
      description: def.description,
      schema: def.schema,
      createdAt: new Date(now),
    }

    // Update cache
    this.nounCache.set(def.name, noun)

    return noun
  }

  async getNoun(name: string): Promise<Noun | null> {
    await this.ensureInitialized()

    // Check cache first
    const cached = this.nounCache.get(name)
    if (cached) return cached

    const rows = [...this.sql.exec('SELECT * FROM nouns WHERE name = ?', name)]
    if (rows.length === 0) return null

    const row = rows[0] as Record<string, unknown>
    const noun: Noun = {
      name: row['name'] as string,
      singular: row['singular'] as string,
      plural: row['plural'] as string,
      slug: row['slug'] as string,
      description: row['description'] as string | undefined,
      schema: row['schema'] ? JSON.parse(row['schema'] as string) : undefined,
      createdAt: new Date(row['created_at'] as number),
    }

    // Populate cache
    this.nounCache.set(name, noun)

    return noun
  }

  async listNouns(): Promise<Noun[]> {
    await this.ensureInitialized()

    const rows = [...this.sql.exec('SELECT * FROM nouns')]
    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        name: r['name'] as string,
        singular: r['singular'] as string,
        plural: r['plural'] as string,
        slug: r['slug'] as string,
        description: r['description'] as string | undefined,
        schema: r['schema'] ? JSON.parse(r['schema'] as string) : undefined,
        createdAt: new Date(r['created_at'] as number),
      }
    })
  }

  // ==================== Verbs ====================

  async defineVerb(def: VerbDefinition): Promise<Verb> {
    await this.ensureInitialized()

    const derived = deriveVerb(def.name)
    const now = Date.now()

    this.sql.exec(
      `INSERT OR REPLACE INTO verbs
       (name, action, act, activity, event, reverse_by, reverse_at, reverse_in, inverse, description, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      def.name,
      def.action ?? derived.action,
      def.act ?? derived.act,
      def.activity ?? derived.activity,
      def.event ?? derived.event,
      def.reverseBy ?? derived.reverseBy,
      derived.reverseAt,
      def.reverseIn ?? derived.reverseIn,
      def.inverse ?? null,
      def.description ?? null,
      now
    )

    const verb: Verb = {
      name: def.name,
      action: def.action ?? derived.action,
      act: def.act ?? derived.act,
      activity: def.activity ?? derived.activity,
      event: def.event ?? derived.event,
      reverseBy: def.reverseBy ?? derived.reverseBy,
      reverseAt: derived.reverseAt,
      reverseIn: def.reverseIn ?? derived.reverseIn,
      inverse: def.inverse,
      description: def.description,
      createdAt: new Date(now),
    }

    // Update cache
    this.verbCache.set(def.name, verb)

    return verb
  }

  async getVerb(name: string): Promise<Verb | null> {
    await this.ensureInitialized()

    // Check cache first
    const cached = this.verbCache.get(name)
    if (cached) return cached

    const rows = [...this.sql.exec('SELECT * FROM verbs WHERE name = ?', name)]
    if (rows.length === 0) return null

    const row = rows[0] as Record<string, unknown>
    const verb: Verb = {
      name: row['name'] as string,
      action: row['action'] as string,
      act: row['act'] as string,
      activity: row['activity'] as string,
      event: row['event'] as string,
      reverseBy: row['reverse_by'] as string | undefined,
      reverseAt: row['reverse_at'] as string | undefined,
      reverseIn: row['reverse_in'] as string | undefined,
      inverse: row['inverse'] as string | undefined,
      description: row['description'] as string | undefined,
      createdAt: new Date(row['created_at'] as number),
    }

    // Populate cache
    this.verbCache.set(name, verb)

    return verb
  }

  async listVerbs(): Promise<Verb[]> {
    await this.ensureInitialized()

    const rows = [...this.sql.exec('SELECT * FROM verbs')]
    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        name: r['name'] as string,
        action: r['action'] as string,
        act: r['act'] as string,
        activity: r['activity'] as string,
        event: r['event'] as string,
        reverseBy: r['reverse_by'] as string | undefined,
        reverseAt: r['reverse_at'] as string | undefined,
        reverseIn: r['reverse_in'] as string | undefined,
        inverse: r['inverse'] as string | undefined,
        description: r['description'] as string | undefined,
        createdAt: new Date(r['created_at'] as number),
      }
    })
  }

  // ==================== Things ====================

  async create<T>(
    noun: string,
    data: T,
    id?: string,
    options?: ValidationOptions
  ): Promise<Thing<T>> {
    await this.ensureInitialized()

    // Validate data against noun schema if validation is enabled
    if (options?.validate) {
      const nounDef = await this.getNoun(noun)
      validateData(data as Record<string, unknown>, nounDef?.schema, options)
    }

    const thingId = id ?? crypto.randomUUID()
    const now = Date.now()

    this.sql.exec(
      `INSERT INTO things (id, noun, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      thingId,
      noun,
      JSON.stringify(data),
      now,
      now
    )

    return {
      id: thingId,
      noun,
      data,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    }
  }

  async get<T>(id: string): Promise<Thing<T> | null> {
    await this.ensureInitialized()

    const rows = [...this.sql.exec('SELECT * FROM things WHERE id = ?', id)]
    if (rows.length === 0) return null

    const row = rows[0] as Record<string, unknown>
    return {
      id: row['id'] as string,
      noun: row['noun'] as string,
      data: JSON.parse(row['data'] as string) as T,
      createdAt: new Date(row['created_at'] as number),
      updatedAt: new Date(row['updated_at'] as number),
    }
  }

  /**
   * Batch fetch multiple things by IDs using WHERE IN clause
   * More efficient than N individual get() calls (fixes N+1 query pattern)
   */
  private async getMany<T>(ids: string[]): Promise<Thing<T>[]> {
    if (ids.length === 0) return []

    await this.ensureInitialized()

    // Build WHERE IN clause with placeholders
    const placeholders = ids.map(() => '?').join(',')
    const rows = [...this.sql.exec(`SELECT * FROM things WHERE id IN (${placeholders})`, ...ids)]

    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: r['id'] as string,
        noun: r['noun'] as string,
        data: JSON.parse(r['data'] as string) as T,
        createdAt: new Date(r['created_at'] as number),
        updatedAt: new Date(r['updated_at'] as number),
      }
    })
  }

  async list<T>(noun: string, options?: ListOptions): Promise<Thing<T>[]> {
    await this.ensureInitialized()

    let sql = 'SELECT * FROM things WHERE noun = ?'
    const params: unknown[] = [noun]

    // Apply where filter in SQL using json_extract for better performance
    if (options?.where) {
      // Use Object.getOwnPropertyNames to also catch __proto__ which is not enumerable with Object.entries
      const whereKeys = Object.getOwnPropertyNames(options.where)
      for (const key of whereKeys) {
        // Validate field name to prevent JSON path traversal and prototype pollution
        validateWhereField(key)
        const value = (options.where as Record<string, unknown>)[key]
        sql += ` AND json_extract(data, '$.${key}') = ?`
        // json_extract returns strings unquoted, numbers as numbers, booleans as 0/1, null as NULL
        params.push(value)
      }
    }

    if (options?.orderBy) {
      // Validate orderBy field to prevent SQL injection
      if (!validateOrderByField(options.orderBy)) {
        throw new Error(`Invalid orderBy field: ${options.orderBy}`)
      }
      sql += ` ORDER BY json_extract(data, '$.${options.orderBy}')`
      sql += options.order === 'desc' ? ' DESC' : ' ASC'
    }

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    sql += ` LIMIT ?`
    params.push(limit)

    if (options?.offset) {
      sql += ` OFFSET ?`
      params.push(options.offset)
    }

    const rows = [...this.sql.exec(sql, ...params)]
    const results = rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: r['id'] as string,
        noun: r['noun'] as string,
        data: JSON.parse(r['data'] as string) as T,
        createdAt: new Date(r['created_at'] as number),
        updatedAt: new Date(r['updated_at'] as number),
      }
    })

    return results
  }

  async find<T>(noun: string, where: Partial<T>): Promise<Thing<T>[]> {
    return this.list<T>(noun, { where: where as Record<string, unknown> })
  }

  async update<T>(id: string, data: Partial<T>, options?: ValidationOptions): Promise<Thing<T>> {
    await this.ensureInitialized()

    const existing = await this.get<T>(id)
    if (!existing) throw new NotFoundError('Thing', id)

    const updated = { ...existing.data, ...data } as T

    // Validate merged data against noun schema if validation is enabled
    if (options?.validate) {
      const nounDef = await this.getNoun(existing.noun)
      validateData(updated as Record<string, unknown>, nounDef?.schema, options)
    }

    const now = Date.now()

    this.sql.exec(
      `UPDATE things SET data = ?, updated_at = ? WHERE id = ?`,
      JSON.stringify(updated),
      now,
      id
    )

    return {
      ...existing,
      data: updated,
      updatedAt: new Date(now),
    }
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureInitialized()

    const result = this.sql.exec('DELETE FROM things WHERE id = ?', id)
    return result.rowsWritten > 0
  }

  async search<T>(query: string, options?: ListOptions): Promise<Thing<T>[]> {
    await this.ensureInitialized()

    // Escape LIKE wildcards (%, _, \) so they match literally
    const q = `%${escapeLikePattern(query.toLowerCase())}%`
    let sql = `SELECT * FROM things WHERE LOWER(data) LIKE ? ESCAPE '\\'`
    const params: unknown[] = [q]

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    sql += ` LIMIT ?`
    params.push(limit)

    const rows = [...this.sql.exec(sql, ...params)]
    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: r['id'] as string,
        noun: r['noun'] as string,
        data: JSON.parse(r['data'] as string) as T,
        createdAt: new Date(r['created_at'] as number),
        updatedAt: new Date(r['updated_at'] as number),
      }
    })
  }

  // ==================== Actions ====================

  async perform<T>(verb: string, subject?: string, object?: string, data?: T): Promise<Action<T>> {
    await this.ensureInitialized()

    const id = crypto.randomUUID()
    const now = Date.now()

    this.sql.exec(
      `INSERT INTO actions (id, verb, subject, object, data, status, created_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      verb,
      subject ?? null,
      object ?? null,
      data ? JSON.stringify(data) : null,
      ActionStatus.COMPLETED,
      now,
      now
    )

    return {
      id,
      verb,
      subject,
      object,
      data,
      status: ActionStatus.COMPLETED,
      createdAt: new Date(now),
      completedAt: new Date(now),
    }
  }

  async getAction<T>(id: string): Promise<Action<T> | null> {
    await this.ensureInitialized()

    const rows = [...this.sql.exec('SELECT * FROM actions WHERE id = ?', id)]
    if (rows.length === 0) return null

    const row = rows[0] as Record<string, unknown>
    return {
      id: row['id'] as string,
      verb: row['verb'] as string,
      subject: row['subject'] as string | undefined,
      object: row['object'] as string | undefined,
      data: row['data'] ? (JSON.parse(row['data'] as string) as T) : undefined,
      status: row['status'] as ActionStatusType,
      createdAt: new Date(row['created_at'] as number),
      completedAt: row['completed_at'] ? new Date(row['completed_at'] as number) : undefined,
    }
  }

  async listActions<T>(options?: ActionOptions): Promise<Action<T>[]> {
    await this.ensureInitialized()

    let sql = 'SELECT * FROM actions WHERE 1=1'
    const params: unknown[] = []

    if (options?.verb) {
      sql += ' AND verb = ?'
      params.push(options.verb)
    }

    if (options?.subject) {
      sql += ' AND subject = ?'
      params.push(options.subject)
    }

    if (options?.object) {
      sql += ' AND object = ?'
      params.push(options.object)
    }

    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status]
      sql += ` AND status IN (${statuses.map(() => '?').join(', ')})`
      params.push(...statuses)
    }

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    sql += ' LIMIT ?'
    params.push(limit)

    const rows = [...this.sql.exec(sql, ...params)]
    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: r['id'] as string,
        verb: r['verb'] as string,
        subject: r['subject'] as string | undefined,
        object: r['object'] as string | undefined,
        data: r['data'] ? (JSON.parse(r['data'] as string) as T) : undefined,
        status: r['status'] as ActionStatusType,
        createdAt: new Date(r['created_at'] as number),
        completedAt: r['completed_at'] ? new Date(r['completed_at'] as number) : undefined,
      }
    })
  }

  async deleteAction(id: string): Promise<boolean> {
    await this.ensureInitialized()

    const result = this.sql.exec('DELETE FROM actions WHERE id = ?', id)
    return result.rowsWritten > 0
  }

  // ==================== Graph Traversal ====================

  async related<T>(
    id: string,
    verb?: string,
    direction: Direction = 'out',
    options?: ListOptions
  ): Promise<Thing<T>[]> {
    const validDirection = validateDirection(direction)
    const edgesList = await this.edges(id, verb, validDirection)
    const relatedIds = new Set<string>()

    for (const edge of edgesList) {
      if (direction === 'out' || direction === 'both') {
        if (edge.subject === id && edge.object) {
          relatedIds.add(edge.object)
        }
      }
      if (direction === 'in' || direction === 'both') {
        if (edge.object === id && edge.subject) {
          relatedIds.add(edge.subject)
        }
      }
    }

    // Use batch query instead of N individual get() calls (fixes N+1 pattern)
    let results = await this.getMany<T>([...relatedIds])

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    results = results.slice(0, limit)

    return results
  }

  async edges<T>(
    id: string,
    verb?: string,
    direction: Direction = 'out',
    options?: ListOptions
  ): Promise<Action<T>[]> {
    const validDirection = validateDirection(direction)
    await this.ensureInitialized()

    let sql: string
    const params: unknown[] = []

    if (validDirection === 'out') {
      sql = 'SELECT * FROM actions WHERE subject = ?'
      params.push(id)
    } else if (validDirection === 'in') {
      sql = 'SELECT * FROM actions WHERE object = ?'
      params.push(id)
    } else {
      sql = 'SELECT * FROM actions WHERE subject = ? OR object = ?'
      params.push(id, id)
    }

    if (verb) {
      sql += ' AND verb = ?'
      params.push(verb)
    }

    // Apply limit with safety bounds
    const limit = effectiveLimit(options?.limit)
    sql += ' LIMIT ?'
    params.push(limit)

    const rows = [...this.sql.exec(sql, ...params)]
    return rows.map((row) => {
      const r = row as Record<string, unknown>
      return {
        id: r['id'] as string,
        verb: r['verb'] as string,
        subject: r['subject'] as string | undefined,
        object: r['object'] as string | undefined,
        data: r['data'] ? (JSON.parse(r['data'] as string) as T) : undefined,
        status: r['status'] as ActionStatusType,
        createdAt: new Date(r['created_at'] as number),
        completedAt: r['completed_at'] ? new Date(r['completed_at'] as number) : undefined,
      }
    })
  }

  // ==================== Batch Operations ====================

  async createMany<T>(noun: string, items: T[]): Promise<Thing<T>[]> {
    if (items.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`Batch size ${items.length} exceeds maximum of ${MAX_BATCH_SIZE}`, [
        { field: 'items', message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
      ])
    }

    await this.ensureInitialized()

    const now = Date.now()
    const results: Thing<T>[] = []

    // Use a transaction for atomic batch insert
    this.sql.exec('BEGIN TRANSACTION')
    try {
      for (const item of items) {
        const thingId = crypto.randomUUID()
        this.sql.exec(
          `INSERT INTO things (id, noun, data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          thingId,
          noun,
          JSON.stringify(item),
          now,
          now
        )
        results.push({
          id: thingId,
          noun,
          data: item,
          createdAt: new Date(now),
          updatedAt: new Date(now),
        })
      }
      this.sql.exec('COMMIT')
    } catch (error) {
      this.sql.exec('ROLLBACK')
      throw error
    }

    return results
  }

  async updateMany<T>(updates: Array<{ id: string; data: Partial<T> }>): Promise<Thing<T>[]> {
    if (updates.length > MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Batch size ${updates.length} exceeds maximum of ${MAX_BATCH_SIZE}`,
        [{ field: 'items', message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` }]
      )
    }

    await this.ensureInitialized()

    const now = Date.now()
    const results: Thing<T>[] = []

    // Use a transaction for atomic batch update
    this.sql.exec('BEGIN TRANSACTION')
    try {
      for (const { id, data } of updates) {
        const existing = await this.get<T>(id)
        if (!existing) throw new NotFoundError('Thing', id)

        const updated = { ...existing.data, ...data } as T
        this.sql.exec(
          `UPDATE things SET data = ?, updated_at = ? WHERE id = ?`,
          JSON.stringify(updated),
          now,
          id
        )
        results.push({
          ...existing,
          data: updated,
          updatedAt: new Date(now),
        })
      }
      this.sql.exec('COMMIT')
    } catch (error) {
      this.sql.exec('ROLLBACK')
      throw error
    }

    return results
  }

  async deleteMany(ids: string[]): Promise<boolean[]> {
    if (ids.length > MAX_BATCH_SIZE) {
      throw new ValidationError(`Batch size ${ids.length} exceeds maximum of ${MAX_BATCH_SIZE}`, [
        { field: 'ids', message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` },
      ])
    }

    await this.ensureInitialized()

    const results: boolean[] = []

    // Use a transaction for atomic batch delete
    this.sql.exec('BEGIN TRANSACTION')
    try {
      for (const id of ids) {
        const result = this.sql.exec('DELETE FROM things WHERE id = ?', id)
        results.push(result.rowsWritten > 0)
      }
      this.sql.exec('COMMIT')
    } catch (error) {
      this.sql.exec('ROLLBACK')
      throw error
    }

    return results
  }

  async performMany<T>(
    actions: Array<{ verb: string; subject?: string; object?: string; data?: T }>
  ): Promise<Action<T>[]> {
    if (actions.length > MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Batch size ${actions.length} exceeds maximum of ${MAX_BATCH_SIZE}`,
        [{ field: 'actions', message: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}` }]
      )
    }

    await this.ensureInitialized()

    const now = Date.now()
    const results: Action<T>[] = []

    // Use a transaction for atomic batch insert
    this.sql.exec('BEGIN TRANSACTION')
    try {
      for (const action of actions) {
        const id = crypto.randomUUID()
        this.sql.exec(
          `INSERT INTO actions (id, verb, subject, object, data, status, created_at, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          id,
          action.verb,
          action.subject ?? null,
          action.object ?? null,
          action.data ? JSON.stringify(action.data) : null,
          ActionStatus.COMPLETED,
          now,
          now
        )
        results.push({
          id,
          verb: action.verb,
          subject: action.subject,
          object: action.object,
          data: action.data,
          status: ActionStatus.COMPLETED,
          createdAt: new Date(now),
          completedAt: new Date(now),
        })
      }
      this.sql.exec('COMMIT')
    } catch (error) {
      this.sql.exec('ROLLBACK')
      throw error
    }

    return results
  }

  async close(): Promise<void> {
    // No-op for Durable Objects (SQLite persists automatically)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const namespaceId = url.searchParams.get('ns') ?? 'default'

    // Validate namespace ID format
    if (!validateNamespaceId(namespaceId)) {
      return Response.json(
        {
          error: 'INVALID_NAMESPACE',
          message:
            'Invalid namespace ID. Must be 1-64 characters, alphanumeric with hyphens and underscores only.',
        },
        { status: 400 }
      )
    }

    const id = env.NS.idFromName(namespaceId)
    const stub = env.NS.get(id)

    return stub.fetch(request)
  },
}
