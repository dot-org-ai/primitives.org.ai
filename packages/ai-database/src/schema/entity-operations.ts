/**
 * Entity Operations Factory
 *
 * Contains the createEntityOperations<T>() function that creates typed CRUD operations
 * for database entities. This includes get, list, find, create, update, upsert, delete,
 * search, forEach, draft, and resolve operations.
 *
 * @packageDocumentation
 */

import type { ParsedEntity, ParsedSchema } from '../types.js'

import type {
  DraftOptions,
  ResolveOptions,
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  ReferenceSpec,
  Draft,
  Resolved,
} from './types.js'

import type { DBProvider, SemanticSearchResult, HybridSearchResult } from './provider.js'
import { resolveProvider, hasSemanticSearch, hasHybridSearch } from './provider.js'
import { hydrateEntity, resolveReferenceSpec, isPromptField } from './resolve.js'
import {
  resolveForwardExact,
  generateAIFields,
  generateContextAwareValue,
  generateNaturalLanguageContent,
  generateEntity,
} from './cascade.js'
import { resolveBackwardFuzzy, resolveForwardFuzzy, getFuzzyThreshold } from './semantic.js'
import {
  isNotFoundError,
  isEntityExistsError,
  wrapDatabaseError,
  DatabaseError,
  CapabilityNotSupportedError,
} from '../errors.js'

// =============================================================================
// Entity Operations Configuration Type
// =============================================================================

/**
 * Configuration for creating entity operations
 */
export interface EntityOperationsConfig {
  /** The type name for the entity */
  typeName: string
  /** The parsed entity definition */
  entity: ParsedEntity
  /** The full parsed schema */
  schema: ParsedSchema
}

// =============================================================================
// Entity Operations Interface
// =============================================================================

/**
 * Operations available on each entity type
 */
export interface EntityOperations<T> {
  get(id: string): Promise<T | null>
  list(options?: ListOptions): Promise<T[]>
  find(where: Partial<T>): Promise<T[]>
  search(query: string, options?: SearchOptions): Promise<T[]>
  create(data: Omit<T, '$id' | '$type'>): Promise<T>
  create(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>
  update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T>
  upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T>
  delete(id: string): Promise<boolean>
  forEach(callback: (entity: T) => void | Promise<void>): Promise<void>
  forEach(options: ListOptions, callback: (entity: T) => void | Promise<void>): Promise<void>
  semanticSearch?(
    query: string,
    options?: SemanticSearchOptions
  ): Promise<Array<T & { $score: number }>>
  hybridSearch?(
    query: string,
    options?: HybridSearchOptions
  ): Promise<
    Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>
  >
  draft?(data: Partial<Omit<T, '$id' | '$type'>>, options?: DraftOptions): Promise<Draft<T>>
  resolve?(draft: Draft<T>, options?: ResolveOptions): Promise<Resolved<T>>
}

// =============================================================================
// Entity Operations Factory
// =============================================================================

/**
 * Create typed CRUD operations for a database entity
 *
 * This function creates the full set of operations for working with a specific
 * entity type in the database, including:
 * - get/list/find for reading
 * - create/update/upsert/delete for writing
 * - search/semanticSearch/hybridSearch for querying
 * - forEach for iteration
 * - draft/resolve for two-phase entity creation
 *
 * @param typeName - The type name for the entity
 * @param entity - The parsed entity definition
 * @param schema - The full parsed schema
 * @returns EntityOperations<T> with all available methods
 */
export function createEntityOperations<T>(
  typeName: string,
  entity: ParsedEntity,
  schema: ParsedSchema
): EntityOperations<T> {
  return {
    async get(id: string): Promise<T | null> {
      const provider = await resolveProvider()
      const result = await provider.get(typeName, id)
      if (!result) return null
      return hydrateEntity(result, entity, schema, resolveProvider) as T
    },

    async list(options?: ListOptions): Promise<T[]> {
      try {
        const provider = await resolveProvider()
        const results = await provider.list(typeName, options)
        return Promise.all(
          results.map((r) => hydrateEntity(r, entity, schema, resolveProvider) as T)
        )
      } catch (error) {
        // Handle error with callback if provided
        if (options?.onError) {
          const wrappedError = error instanceof Error ? error : new Error(String(error))
          const fallback = options.onError(wrappedError)
          return (fallback ?? []) as T[]
        }
        // Suppress errors if requested
        if (options?.suppressErrors) {
          return []
        }
        throw error
      }
    },

    async find(where: Partial<T>): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.list(typeName, {
        where: where as Record<string, unknown>,
      })
      return Promise.all(results.map((r) => hydrateEntity(r, entity, schema, resolveProvider) as T))
    },

    async search(query: string, options?: SearchOptions): Promise<T[]> {
      const provider = await resolveProvider()
      const results = await provider.search(typeName, query, options)
      return Promise.all(results.map((r) => hydrateEntity(r, entity, schema, resolveProvider) as T))
    },

    async create(
      idOrData: string | Omit<T, '$id' | '$type'>,
      maybeData?: Omit<T, '$id' | '$type'>
    ): Promise<T> {
      const providedId = typeof idOrData === 'string' ? idOrData : undefined
      const data =
        typeof idOrData === 'string'
          ? (maybeData as Record<string, unknown>)
          : (idOrData as Record<string, unknown>)

      const entityId = providedId || crypto.randomUUID()

      try {
        const provider = await resolveProvider()

        const { data: resolvedData, pendingRelations } = await resolveForwardExact(
          typeName,
          data,
          entity,
          schema,
          provider,
          entityId
        )

        const { data: fuzzyResolvedData, pendingRelations: fuzzyPendingRelations } =
          await resolveForwardFuzzy(typeName, resolvedData, entity, schema, provider, entityId)

        const backwardResolvedData = await resolveBackwardFuzzy(
          typeName,
          fuzzyResolvedData,
          entity,
          schema,
          provider
        )

        const finalData = await generateAIFields(
          backwardResolvedData,
          typeName,
          entity,
          schema,
          provider
        )

        const result = await provider.create(typeName, entityId, finalData)

        for (const rel of pendingRelations) {
          await provider.relate(typeName, entityId, rel.fieldName, rel.targetType, rel.targetId)
        }

        const createdEdgeIds = new Set<string>()
        for (const rel of fuzzyPendingRelations) {
          await provider.relate(typeName, entityId, rel.fieldName, rel.targetType, rel.targetId, {
            matchMode: 'fuzzy',
            ...(rel.similarity !== undefined && { similarity: rel.similarity }),
            ...(rel.matchedType !== undefined && { matchedType: rel.matchedType }),
          })

          const edgeId = `${typeName}_${rel.fieldName}_${entityId}_${rel.targetId}`
          if (!createdEdgeIds.has(edgeId)) {
            createdEdgeIds.add(edgeId)
            try {
              await provider.create('Edge', edgeId, {
                from: typeName,
                name: rel.fieldName,
                to: rel.targetType,
                direction: 'forward',
                matchMode: 'fuzzy',
                similarity: rel.similarity,
                matchedType: rel.matchedType,
                fromId: entityId,
                toId: rel.targetId,
              })
            } catch (error) {
              // Only ignore actual duplicate key errors, propagate other errors
              if (!isEntityExistsError(error)) {
                throw wrapDatabaseError(error, 'create', 'Edge', edgeId)
              }
            }
          }
        }

        return hydrateEntity(result, entity, schema, resolveProvider) as T
      } catch (error) {
        // Wrap provider errors with context
        if (error instanceof DatabaseError) throw error
        throw wrapDatabaseError(error, 'create', typeName, entityId)
      }
    },

    async update(id: string, data: Partial<Omit<T, '$id' | '$type'>>): Promise<T> {
      try {
        const provider = await resolveProvider()
        const result = await provider.update(typeName, id, data as Record<string, unknown>)
        return hydrateEntity(result, entity, schema, resolveProvider) as T
      } catch (error) {
        if (error instanceof DatabaseError) throw error
        throw wrapDatabaseError(error, 'update', typeName, id)
      }
    },

    async upsert(id: string, data: Omit<T, '$id' | '$type'>): Promise<T> {
      try {
        const provider = await resolveProvider()
        const existing = await provider.get(typeName, id)
        if (existing) {
          const result = await provider.update(typeName, id, data as Record<string, unknown>)
          return hydrateEntity(result, entity, schema, resolveProvider) as T
        }
        const result = await provider.create(typeName, id, data as Record<string, unknown>)
        return hydrateEntity(result, entity, schema, resolveProvider) as T
      } catch (error) {
        if (error instanceof DatabaseError) throw error
        throw wrapDatabaseError(error, 'upsert', typeName, id)
      }
    },

    async delete(id: string): Promise<boolean> {
      try {
        const provider = await resolveProvider()
        return provider.delete(typeName, id)
      } catch (error) {
        if (error instanceof DatabaseError) throw error
        throw wrapDatabaseError(error, 'delete', typeName, id)
      }
    },

    async forEach(
      optionsOrCallback: ListOptions | ((entity: T) => void | Promise<void>),
      maybeCallback?: (entity: T) => void | Promise<void>
    ): Promise<void> {
      const options = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!

      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },

    async semanticSearch(
      query: string,
      options?: SemanticSearchOptions
    ): Promise<Array<T & { $score: number }>> {
      const provider = await resolveProvider()
      if (!hasSemanticSearch(provider)) {
        throw new CapabilityNotSupportedError(
          'hasSemanticSearch',
          `Semantic search is not supported by the current provider. ` +
            `The provider does not implement the semanticSearch method required for vector similarity search.`,
          `Use the regular search() method instead, which performs basic text matching.`
        )
      }
      const results: SemanticSearchResult[] = await provider.semanticSearch(
        typeName,
        query,
        options
      )
      return Promise.all(
        results.map(
          (r: SemanticSearchResult) =>
            ({
              ...hydrateEntity(r, entity, schema, resolveProvider),
              $score: r.$score,
            } as T & { $score: number })
        )
      )
    },

    async hybridSearch(
      query: string,
      options?: HybridSearchOptions
    ): Promise<
      Array<T & { $rrfScore: number; $ftsRank: number; $semanticRank: number; $score: number }>
    > {
      const provider = await resolveProvider()
      if (!hasHybridSearch(provider)) {
        throw new CapabilityNotSupportedError(
          'hasHybridSearch',
          `Hybrid search is not supported by the current provider. ` +
            `The provider does not implement the hybridSearch method required for combined FTS and vector search.`,
          `Use the regular search() method instead, which performs basic text matching.`
        )
      }
      const results: HybridSearchResult[] = await provider.hybridSearch(typeName, query, options)
      return Promise.all(
        results.map(
          (r: HybridSearchResult) =>
            ({
              ...hydrateEntity(r, entity, schema, resolveProvider),
              $rrfScore: r.$rrfScore,
              $ftsRank: r.$ftsRank,
              $semanticRank: r.$semanticRank,
              $score: r.$score,
            } as T & {
              $rrfScore: number
              $ftsRank: number
              $semanticRank: number
              $score: number
            })
        )
      )
    },

    async draft(
      data: Partial<Omit<T, '$id' | '$type'>>,
      options?: DraftOptions
    ): Promise<Draft<T>> {
      const draftData: Record<string, unknown> = { ...data, $phase: 'draft' }
      const refs: Record<string, ReferenceSpec | ReferenceSpec[]> = {}

      // Get the raw schema to detect prompt fields and source instructions
      const rawSchema = entity.schema || {}
      const sourceInstructions = rawSchema['$instructions'] as string | undefined
      const hasContextDependencies =
        Array.isArray(rawSchema['$context']) && rawSchema['$context'].length > 0

      for (const [fieldName, field] of entity.fields) {
        if (draftData[fieldName] !== undefined && draftData[fieldName] !== null) {
          continue
        }

        if (field.operator && field.relatedType) {
          // Skip optional relation fields - they shouldn't auto-generate
          if (field.isOptional) continue

          // Skip backward references - they're resolved lazily via hydrateEntity
          // Backward refs find entities that reference US, not entities we create
          if (field.operator === '<-' || field.operator === '<~') continue

          // Relationship field with operator
          const matchMode = field.matchMode ?? (field.operator.includes('~') ? 'fuzzy' : 'exact')

          if (field.isArray) {
            // Get hint value for array fuzzy matching (e.g., categoriesHint for categories field)
            const hintKey = `${fieldName}Hint`
            const hintValue = (data as Record<string, unknown>)[hintKey]

            // Get fuzzy threshold from entity schema
            const threshold = field.threshold ?? getFuzzyThreshold(entity)

            // If hint is an array, create one ref spec per hint item
            // Skip promptless fields only when _skipPromptlessRefs is set (internal create() without cascade)
            const shouldSkipPromptless = options?._skipPromptlessRefs && !field.prompt
            const hints = Array.isArray(hintValue)
              ? hintValue
              : hintValue
              ? [hintValue]
              : shouldSkipPromptless
              ? []
              : [
                  generateNaturalLanguageContent(
                    fieldName,
                    field.prompt,
                    field.relatedType,
                    data as Record<string, unknown>
                  ),
                ]

            const refSpecs: ReferenceSpec[] = hints.map((hint: unknown) => {
              const generatedText = String(hint)
              const spec: ReferenceSpec = {
                field: fieldName,
                operator: field.operator!,
                type: field.relatedType!,
                matchMode,
                resolved: false,
                ...(field.unionTypes !== undefined && { unionTypes: field.unionTypes }),
                ...(field.prompt !== undefined && { prompt: field.prompt }),
                ...(generatedText !== undefined && { generatedText }),
                ...(sourceInstructions !== undefined && { sourceInstructions }),
                ...(threshold !== undefined && { threshold }),
              }
              return spec
            })

            // Store the combined generated text for the draft display
            draftData[fieldName] = hints.map(String).join(', ')
            refs[fieldName] = refSpecs

            if (options?.stream && options.onChunk) {
              for (const spec of refSpecs) {
                if (spec.generatedText) {
                  options.onChunk(spec.generatedText)
                }
              }
            }
          } else {
            // Get hint value for fuzzy matching (e.g., contentHint for content field)
            const hintKey = `${fieldName}Hint`
            const hintValue = (data as Record<string, unknown>)[hintKey] as string | undefined

            // Get fuzzy threshold from entity schema
            const threshold = field.threshold ?? getFuzzyThreshold(entity)

            // Use hint if available, otherwise generate natural language content
            const generatedText =
              hintValue ||
              generateNaturalLanguageContent(
                fieldName,
                field.prompt,
                field.relatedType,
                data as Record<string, unknown>
              )
            draftData[fieldName] = generatedText

            const spec: ReferenceSpec = {
              field: fieldName,
              operator: field.operator,
              type: field.relatedType,
              matchMode,
              resolved: false,
              ...(field.unionTypes !== undefined && { unionTypes: field.unionTypes }),
              ...(field.prompt !== undefined && { prompt: field.prompt }),
              ...(generatedText !== undefined && { generatedText }),
              ...(sourceInstructions !== undefined && { sourceInstructions }),
              ...(threshold !== undefined && { threshold }),
            }
            refs[fieldName] = spec

            if (options?.stream && options.onChunk) {
              options.onChunk(generatedText)
            }
          }
        } else if (!field.isRelation) {
          // Non-relationship field - check if it's a prompt field
          const isPrompt = isPromptField(field)

          if (isPrompt && !hasContextDependencies) {
            // Generate content for prompt field using the type as the prompt
            // NOTE: Skip generation when entity has $context dependencies, as those fields
            // need the pre-fetched context to generate properly (done in generateAIFields)
            const generatedText = generateContextAwareValue(
              fieldName,
              typeName,
              field.type,
              field.type,
              data as Record<string, unknown>
            )
            draftData[fieldName] = generatedText

            if (options?.stream && options.onChunk) {
              options.onChunk(generatedText)
            }
          }
        }
      }

      draftData['$refs'] = refs
      return draftData as Draft<T>
    },

    async resolve(draft: Draft<T>, options?: ResolveOptions): Promise<Resolved<T>> {
      // Draft<T> interface requires $phase: 'draft', so we can access it directly
      if (draft.$phase !== 'draft') {
        throw new Error('Cannot resolve entity: not a draft (missing $phase: "draft")')
      }

      const provider = await resolveProvider()
      const resolved: Record<string, unknown> = { ...draft }
      const errors: Array<{ field: string; error: string }> = []

      delete resolved['$refs']
      resolved['$phase'] = 'resolved'

      const refs = draft.$refs

      for (const [fieldName, refSpec] of Object.entries(refs)) {
        try {
          if (Array.isArray(refSpec)) {
            const resolvedIds: string[] = []
            for (const spec of refSpec) {
              const resolvedId = await resolveReferenceSpec(
                spec,
                resolved,
                schema,
                provider,
                generateContextAwareValue,
                generateEntity
              )
              if (resolvedId) {
                resolvedIds.push(resolvedId)
                options?.onResolved?.(fieldName, resolvedId)
              }
            }
            resolved[fieldName] = resolvedIds
          } else {
            const resolvedId = await resolveReferenceSpec(
              refSpec,
              resolved,
              schema,
              provider,
              generateContextAwareValue,
              generateEntity
            )
            if (resolvedId) {
              resolved[fieldName] = resolvedId
              options?.onResolved?.(fieldName, resolvedId)
            }
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          if (options?.onError === 'skip') {
            errors.push({ field: fieldName, error: errorMsg })
          } else {
            throw err
          }
        }
      }

      if (errors.length > 0 || options?.onError === 'skip') {
        // resolved is typed as Record<string, unknown>, so we can assign $errors directly
        resolved['$errors'] = errors
      }

      return resolved as Resolved<T>
    },
  }
}

// =============================================================================
// Edge Entity Operations Factory
// =============================================================================

/**
 * Create specialized operations for the Edge entity type
 *
 * Edge entities are auto-generated from schema relationships and have
 * restricted write operations (no manual create/update/delete).
 *
 * @param schemaEdgeRecords - Edge records derived from the schema
 * @param getProvider - Function to get the database provider
 * @returns EntityOperations for Edge type
 */
/**
 * Create specialized operations for the Noun entity type
 *
 * Noun entities are auto-generated from schema entity types and have
 * restricted write operations (no manual create/update/delete).
 *
 * @param nounRecords - Noun records derived from the schema entity types
 * @returns EntityOperations for Noun type
 */
export function createNounEntityOperations(
  nounRecords: Array<Record<string, unknown>>
): EntityOperations<Record<string, unknown>> {
  return {
    async get(id: string) {
      // Find by name (type name)
      return nounRecords.find((n) => n['name'] === id || n['$id'] === id) ?? null
    },

    async list(options?: ListOptions) {
      let results = [...nounRecords]
      if (options?.where) {
        for (const [key, value] of Object.entries(options.where)) {
          results = results.filter((n) => n[key] === value)
        }
      }
      if (options?.limit) {
        results = results.slice(options.offset ?? 0, (options.offset ?? 0) + options.limit)
      }
      return results.map((n) => ({
        ...n,
        $id: n['$id'] || n['name'],
        $type: 'Noun',
      }))
    },

    async find(where: Record<string, unknown>) {
      let results = [...nounRecords]
      for (const [key, value] of Object.entries(where)) {
        results = results.filter((n) => n[key] === value)
      }
      return results.map((n) => ({
        ...n,
        $id: n['$id'] || n['name'],
        $type: 'Noun',
      }))
    },

    async search(query: string) {
      const queryLower = query.toLowerCase()
      return nounRecords
        .filter(
          (n) =>
            String(n['name']).toLowerCase().includes(queryLower) ||
            String(n['singular']).toLowerCase().includes(queryLower) ||
            String(n['plural']).toLowerCase().includes(queryLower) ||
            String(n['description'] || '')
              .toLowerCase()
              .includes(queryLower)
        )
        .map((n) => ({
          ...n,
          $id: n['$id'] || n['name'],
          $type: 'Noun',
        }))
    },

    async create() {
      throw new Error('Cannot manually create Noun records - they are auto-generated from schema')
    },

    async update() {
      throw new Error('Cannot manually update Noun records - they are auto-generated from schema')
    },

    async upsert() {
      throw new Error('Cannot manually upsert Noun records - they are auto-generated from schema')
    },

    async delete() {
      throw new Error('Cannot manually delete Noun records - they are auto-generated from schema')
    },

    async forEach(
      optionsOrCallback: ListOptions | ((entity: Record<string, unknown>) => void | Promise<void>),
      maybeCallback?: (entity: Record<string, unknown>) => void | Promise<void>
    ) {
      const options = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!
      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },

    async semanticSearch() {
      return []
    },

    async hybridSearch() {
      return []
    },
  }
}

/**
 * Create specialized operations for the Verb entity type
 *
 * Verb entities are the standard verb definitions (create, update, delete, etc.)
 * and any custom verbs defined through the verbs API.
 *
 * @param verbRecords - Verb records with conjugation forms
 * @returns EntityOperations for Verb type
 */
export function createVerbEntityOperations(
  verbRecords: Array<Record<string, unknown>>
): EntityOperations<Record<string, unknown>> {
  return {
    async get(id: string) {
      // Find by action name
      return verbRecords.find((v) => v['action'] === id || v['$id'] === id) ?? null
    },

    async list(options?: ListOptions) {
      let results = [...verbRecords]
      if (options?.where) {
        for (const [key, value] of Object.entries(options.where)) {
          results = results.filter((v) => v[key] === value)
        }
      }
      if (options?.limit) {
        results = results.slice(options.offset ?? 0, (options.offset ?? 0) + options.limit)
      }
      return results.map((v) => ({
        ...v,
        $id: v['$id'] || v['action'],
        $type: 'Verb',
      }))
    },

    async find(where: Record<string, unknown>) {
      let results = [...verbRecords]
      for (const [key, value] of Object.entries(where)) {
        results = results.filter((v) => v[key] === value)
      }
      return results.map((v) => ({
        ...v,
        $id: v['$id'] || v['action'],
        $type: 'Verb',
      }))
    },

    async search(query: string) {
      const queryLower = query.toLowerCase()
      return verbRecords
        .filter(
          (v) =>
            String(v['action']).toLowerCase().includes(queryLower) ||
            String(v['actor'] || '')
              .toLowerCase()
              .includes(queryLower) ||
            String(v['activity'] || '')
              .toLowerCase()
              .includes(queryLower) ||
            String(v['description'] || '')
              .toLowerCase()
              .includes(queryLower)
        )
        .map((v) => ({
          ...v,
          $id: v['$id'] || v['action'],
          $type: 'Verb',
        }))
    },

    async create() {
      throw new Error('Cannot manually create Verb records - use verbs.define() instead')
    },

    async update() {
      throw new Error('Cannot manually update Verb records - use verbs.define() instead')
    },

    async upsert() {
      throw new Error('Cannot manually upsert Verb records - use verbs.define() instead')
    },

    async delete() {
      throw new Error('Cannot manually delete Verb records')
    },

    async forEach(
      optionsOrCallback: ListOptions | ((entity: Record<string, unknown>) => void | Promise<void>),
      maybeCallback?: (entity: Record<string, unknown>) => void | Promise<void>
    ) {
      const options = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!
      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },

    async semanticSearch() {
      return []
    },

    async hybridSearch() {
      return []
    },
  }
}

export function createEdgeEntityOperations(
  schemaEdgeRecords: Array<Record<string, unknown>>,
  getProvider: () => Promise<DBProvider>
): EntityOperations<Record<string, unknown>> {
  /**
   * Get runtime edges from the provider.
   *
   * @param options - Options for error handling
   * @returns Runtime edges, or empty array for not-found errors
   * @throws DatabaseError for unexpected provider failures
   */
  async function getRuntimeEdges(options?: {
    suppressErrors?: boolean
  }): Promise<Array<Record<string, unknown>>> {
    try {
      const provider = await getProvider()
      const runtimeEdges = await provider.list('Edge')
      return runtimeEdges
    } catch (error) {
      // "Not found" errors are expected - Edge table may not exist yet
      if (isNotFoundError(error)) {
        return []
      }
      // If suppressErrors is set, return empty array for any error
      if (options?.suppressErrors) {
        return []
      }
      // Wrap and rethrow unexpected errors with context
      throw wrapDatabaseError(error, 'list', 'Edge')
    }
  }

  async function getAllEdges(options?: {
    suppressErrors?: boolean
  }): Promise<Array<Record<string, unknown>>> {
    const runtimeEdges = await getRuntimeEdges(options)
    const runtimeEdgeKeys = new Set(runtimeEdges.map((e) => `${e['from']}:${e['name']}`))

    const filteredSchemaEdges = schemaEdgeRecords.filter((e) => {
      const key = `${e['from']}:${e['name']}`
      const hasRuntimeVersion = runtimeEdgeKeys.has(key)
      if (hasRuntimeVersion && e['matchMode'] === 'fuzzy') {
        return false
      }
      return !hasRuntimeVersion
    })

    return [...filteredSchemaEdges, ...runtimeEdges]
  }

  return {
    async get(id: string) {
      const runtimeEdges = await getRuntimeEdges()
      const runtimeMatch = runtimeEdges.find(
        (e) => e['$id'] === id || `${e['from']}:${e['name']}` === id
      )
      if (runtimeMatch) return { ...runtimeMatch, $type: 'Edge' }
      return schemaEdgeRecords.find((e) => `${e['from']}:${e['name']}` === id) ?? null
    },

    async list(options?: ListOptions) {
      try {
        let results = await getAllEdges({
          ...(options?.suppressErrors !== undefined && { suppressErrors: options.suppressErrors }),
        })
        if (options?.where) {
          for (const [key, value] of Object.entries(options.where)) {
            results = results.filter((e) => e[key] === value)
          }
        }
        return results.map((e) => ({
          ...e,
          $id: e['$id'] || `${e['from']}:${e['name']}`,
          $type: 'Edge',
        }))
      } catch (error) {
        // Handle error with callback if provided
        if (options?.onError) {
          const fallback = options.onError(
            error instanceof Error ? error : new Error(String(error))
          )
          return (fallback ?? []) as Record<string, unknown>[]
        }
        throw error
      }
    },

    async find(where: Record<string, unknown>) {
      let results = await getAllEdges()
      for (const [key, value] of Object.entries(where)) {
        results = results.filter((e) => e[key] === value)
      }
      return results.map((e) => ({
        ...e,
        $id: e['$id'] || `${e['from']}:${e['name']}`,
        $type: 'Edge',
      }))
    },

    async search(query: string) {
      const allEdges = await getAllEdges()
      const queryLower = query.toLowerCase()
      return allEdges
        .filter(
          (e) =>
            String(e['from']).toLowerCase().includes(queryLower) ||
            String(e['name']).toLowerCase().includes(queryLower) ||
            String(e['to']).toLowerCase().includes(queryLower)
        )
        .map((e) => ({
          ...e,
          $id: e['$id'] || `${e['from']}:${e['name']}`,
          $type: 'Edge',
        }))
    },

    async create() {
      throw new Error('Cannot manually create Edge records - they are auto-generated')
    },

    async update() {
      throw new Error('Cannot manually update Edge records - they are auto-generated')
    },

    async upsert() {
      throw new Error('Cannot manually upsert Edge records - they are auto-generated')
    },

    async delete() {
      throw new Error('Cannot manually delete Edge records - they are auto-generated')
    },

    async forEach(
      optionsOrCallback: ListOptions | ((entity: Record<string, unknown>) => void | Promise<void>),
      maybeCallback?: (entity: Record<string, unknown>) => void | Promise<void>
    ) {
      const options = typeof optionsOrCallback === 'function' ? undefined : optionsOrCallback
      const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback!
      const items = await this.list(options)
      for (const item of items) {
        await callback(item)
      }
    },

    async semanticSearch() {
      return []
    },

    async hybridSearch() {
      return []
    },
  }
}
