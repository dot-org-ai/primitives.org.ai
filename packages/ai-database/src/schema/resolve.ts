/**
 * Reference Resolution Functions
 *
 * Contains forward/backward resolution functions for relationships,
 * context resolution, and entity hydration.
 *
 * @packageDocumentation
 */

import type { ParsedField, ParsedEntity, ParsedSchema, EntitySchema } from '../types.js'

import type { DBProvider } from './provider.js'
import { hasSemanticSearch } from './provider.js'
import type { ReferenceSpec } from './types.js'
import { isPrimitiveType } from './parse.js'
import { findBestMatchAcrossTypes } from './search-utils.js'

// =============================================================================
// Context Resolution - Template Variables and $instructions
// =============================================================================

/**
 * Check if a string looks like an entity ID (UUID format or type-prefixed)
 */
export function isEntityId(value: string): boolean {
  // UUID pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidPattern.test(value)) return true
  // Type-prefixed ID pattern (e.g., "post-123")
  if (/^[a-z]+-[a-z0-9-]+$/i.test(value)) return true
  return false
}

/**
 * Infer the entity type from a field name using schema relationships
 */
export function inferTypeFromField(
  fieldName: string,
  entity: ParsedEntity,
  schema: ParsedSchema
): string | undefined {
  // First check if field is a relation in the current entity
  const field = entity.fields.get(fieldName)
  if (field?.isRelation && field.relatedType) {
    return field.relatedType
  }

  // Check for camelCase field name that might match a type (e.g., "occupation" -> "Occupation")
  const capitalizedName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1)
  if (schema.entities.has(capitalizedName)) {
    return capitalizedName
  }

  return undefined
}

/**
 * Resolve a context path like "task.occupation.industry.name" against an entity
 *
 * This traverses relationships and fetches related entities as needed.
 */
export async function resolveContextPath(
  path: string,
  entity: Record<string, unknown>,
  currentTypeName: string,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<unknown> {
  const parts = path.split('.')
  let current: unknown = entity
  let currentType = schema.entities.get(currentTypeName)

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!
    if (current == null || typeof current !== 'object') return undefined

    const record = current as Record<string, unknown>
    const value = record[part]

    // If it's a string that looks like an entity ID, try to fetch the entity
    if (typeof value === 'string' && isEntityId(value) && currentType) {
      const typeName = inferTypeFromField(part, currentType, schema)
      if (typeName) {
        const fetched = await provider.get(typeName, value)
        if (fetched) {
          current = fetched
          currentType = schema.entities.get(typeName)
          continue
        }
      }
    }

    current = value

    // Update currentType for next iteration if we have a valid field reference
    if (currentType) {
      const nextTypeName = inferTypeFromField(part, currentType, schema)
      if (nextTypeName) {
        currentType = schema.entities.get(nextTypeName)
      }
    }
  }

  return current
}

/**
 * Resolve template variables in $instructions
 *
 * Template variables use the syntax {path.to.field} where the path
 * can traverse relationships (e.g., {task.occupation.title})
 *
 * @param instructions - The instruction string with template variables
 * @param entity - The current entity data
 * @param typeName - The current entity type name
 * @param schema - The parsed schema
 * @param provider - The database provider for fetching related entities
 * @returns The instructions with all template variables resolved
 */
export async function resolveInstructions(
  instructions: string,
  entity: Record<string, unknown>,
  typeName: string,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<string> {
  const pattern = /\{([^}]+)\}/g
  let resolved = instructions

  // Find all matches first to avoid issues with modifying string during iteration
  const matches = [...instructions.matchAll(pattern)]

  for (const match of matches) {
    const path = match[1]!
    const value = await resolveContextPath(path, entity, typeName, schema, provider)
    resolved = resolved.replace(match[0], String(value ?? ''))
  }

  return resolved
}

/**
 * Find the field in the entity that references a given type
 */
function findFieldByRelatedType(
  entityDef: ParsedEntity,
  relatedType: string
): { fieldName: string; field: ParsedField } | undefined {
  for (const [fieldName, field] of entityDef.fields) {
    if (field.isRelation && field.relatedType === relatedType) {
      return { fieldName, field }
    }
  }
  return undefined
}

/**
 * Pre-fetch context dependencies declared in $context using dotted paths
 *
 * The $context field declares explicit context dependencies that should
 * be pre-fetched before generating AI fields. Supports dotted paths like
 * 'Startup.icp.industry' for deeply nested context fetching.
 *
 * Context paths can be:
 * - Simple type names: 'Startup' - finds field that references Startup type
 * - Dotted paths: 'Startup.icp.industry' - traverses relationships
 *
 * @param contextDeps - Array of context dependency paths (e.g., ['Startup', 'Startup.icp.industry'])
 * @param entity - The current entity data
 * @param typeName - The current entity type name
 * @param schema - The parsed schema
 * @param provider - The database provider for fetching related entities
 * @returns Map of context path to fetched entity data
 */
export async function prefetchContextPaths(
  contextDeps: string[],
  entity: Record<string, unknown>,
  typeName: string,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<Map<string, Record<string, unknown>>> {
  const contextData = new Map<string, Record<string, unknown>>()
  const currentEntity = schema.entities.get(typeName)
  if (!currentEntity) return contextData

  // Track already fetched entities to avoid duplicate fetches
  // Key: "TypeName:entityId", Value: fetched entity data
  const fetchCache = new Map<string, Record<string, unknown>>()

  // Deduplicate context deps
  const uniqueDeps = [...new Set(contextDeps)]

  for (const dep of uniqueDeps) {
    // Parse the path - could be "Startup" or "Startup.icp.industry"
    const pathParts = dep.split('.')

    // Start from the current entity and traverse the path
    let currentData: Record<string, unknown> = entity
    let currentEntityDef = currentEntity
    let currentPath = ''

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i]!
      // Try two approaches:
      // 1. Convert PascalCase type name to camelCase field name
      // 2. Find field by related type
      const camelCaseFieldName = part.charAt(0).toLowerCase() + part.slice(1)

      let fieldInfo: { fieldName: string; field: ParsedField } | undefined

      // First try exact field name match
      const directField = currentEntityDef.fields.get(camelCaseFieldName)
      if (directField?.isRelation && directField.relatedType) {
        fieldInfo = { fieldName: camelCaseFieldName, field: directField }
      }

      // If no direct match, try to find field by related type (e.g., 'Related' -> find field that points to Related)
      if (!fieldInfo) {
        fieldInfo = findFieldByRelatedType(currentEntityDef, part)
      }

      if (!fieldInfo) {
        // Path invalid - no field found
        break
      }

      const { fieldName, field } = fieldInfo
      currentPath = currentPath ? `${currentPath}.${fieldName}` : fieldName

      // Get the entity ID from current data
      const entityId = currentData[fieldName]
      if (typeof entityId !== 'string') {
        // Path invalid - no entity ID
        break
      }

      // Check cache first
      const cacheKey = `${field.relatedType}:${entityId}`
      let fetched = fetchCache.get(cacheKey)

      if (!fetched) {
        // Fetch the related entity
        const fetchedResult = await provider.get(field.relatedType!, entityId)
        if (fetchedResult) {
          fetched = fetchedResult
          fetchCache.set(cacheKey, fetched)
        }
      }

      if (!fetched) {
        // Path invalid - entity not found
        break
      }

      // Store the result with the actual field name path
      contextData.set(currentPath, fetched)

      // Update for next iteration
      currentData = fetched
      const nextEntityDef = schema.entities.get(field.relatedType!)
      if (!nextEntityDef) {
        // Path invalid - entity type not in schema
        break
      }
      currentEntityDef = nextEntityDef
    }
  }

  return contextData
}

/**
 * Pre-fetch context dependencies declared in $context
 *
 * The $context field declares explicit context dependencies that should
 * be pre-fetched before generating AI fields. This ensures all referenced
 * entities are available for template variable resolution.
 *
 * @param contextDeps - Array of context dependency types (e.g., ['Startup', 'ICP'])
 * @param entity - The current entity data
 * @param typeName - The current entity type name
 * @param schema - The parsed schema
 * @param provider - The database provider for fetching related entities
 * @returns Map of context name to fetched entity data
 */
export async function prefetchContext(
  contextDeps: string[],
  entity: Record<string, unknown>,
  typeName: string,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<Map<string, Record<string, unknown>>> {
  // Use the new path-based implementation which handles both simple and dotted paths
  return prefetchContextPaths(contextDeps, entity, typeName, schema, provider)
}

/**
 * Check if a field type is a prompt (contains spaces, indicating AI generation)
 */
export function isPromptField(field: ParsedField): boolean {
  // Fields with spaces in their type are prompts for AI generation
  return (
    field.type.includes(' ') ||
    (field.type === 'string' && !field.isRelation && !isPrimitiveType(field.type))
  )
}

// =============================================================================
// Nested Pending Resolution
// =============================================================================

/**
 * Resolve pending nested relations in generated data
 *
 * When generateEntity encounters nested -> relations, it stores them as
 * _pending_fieldName entries. This function creates those entities and
 * replaces the pending entries with actual IDs.
 */
export async function resolveNestedPending(
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<Record<string, unknown>> {
  const resolved = { ...data }

  for (const key of Object.keys(resolved)) {
    if (key.startsWith('_pending_')) {
      const fieldName = key.replace('_pending_', '')
      const pending = resolved[key] as { type: string; data: Record<string, unknown> }
      delete resolved[key]

      // Get the related entity to resolve its nested pending relations too
      const relatedEntity = schema.entities.get(pending.type)
      if (relatedEntity) {
        const resolvedNested = await resolveNestedPending(
          pending.data,
          relatedEntity,
          schema,
          provider
        )
        const created = await provider.create(pending.type, undefined, resolvedNested)
        resolved[fieldName] = created['$id']
      }
    }
  }

  return resolved
}

// =============================================================================
// Reference Resolution
// =============================================================================

/**
 * Resolve a single reference specification to an entity ID
 *
 * For exact matches (-> and <-), creates new entities.
 * For fuzzy matches (~> and <~), searches for existing entities first.
 */
export async function resolveReferenceSpec(
  spec: ReferenceSpec,
  contextData: Record<string, unknown>,
  schema: ParsedSchema,
  provider: DBProvider,
  generateContextAwareValue: (
    fieldName: string,
    type: string,
    fullContext: string,
    hint: string | undefined,
    parentData: Record<string, unknown>
  ) => string,
  generateEntityWithAI?: (
    type: string,
    prompt: string | undefined,
    context: { parent: string; parentData: Record<string, unknown>; parentId?: string },
    schema: ParsedSchema
  ) => Promise<Record<string, unknown>>
): Promise<string | null> {
  const targetEntity = schema.entities.get(spec.type)
  if (!targetEntity) {
    throw new Error(`Unknown target type: ${spec.type}`)
  }

  if (spec.matchMode === 'fuzzy') {
    // For fuzzy references, try to find an existing entity first
    if (hasSemanticSearch(provider)) {
      const searchQuery = spec.generatedText || spec.prompt || spec.field
      // Use threshold from spec, or default to 0.75
      const threshold = spec.threshold ?? 0.75

      // Determine which types to search - all union types or just the primary type
      const typesToSearch =
        spec.unionTypes && spec.unionTypes.length > 0 ? spec.unionTypes : [spec.type]

      // Search all types and find the best match using shared utility
      const bestMatchResult = await findBestMatchAcrossTypes(typesToSearch, searchQuery, {
        threshold,
        limit: 5,
        schema,
        provider,
      })

      if (bestMatchResult) {
        // Update the matched entity with metadata
        await provider.update(bestMatchResult.type, bestMatchResult.match.$id, {
          $matchedType: bestMatchResult.type,
          $similarity: bestMatchResult.match.$score,
        })
        // Also set metadata on contextData for edge creation later
        contextData[`${spec.field}$matchedType`] = bestMatchResult.type
        contextData[`${spec.field}$score`] = bestMatchResult.match.$score
        return bestMatchResult.match.$id
      }
    }

    // If no match found for fuzzy, fall through to create
  }

  // Create a new entity
  let generatedData: Record<string, unknown> = {}
  const hint = spec.generatedText || spec.prompt || spec.field
  const parentType = contextData['$type'] as string | undefined
  const parentId = contextData['$id'] as string | undefined

  // Try AI generation first if available
  if (generateEntityWithAI && parentType) {
    try {
      const aiData = await generateEntityWithAI(
        spec.type,
        hint,
        {
          parent: parentType,
          parentData: contextData,
          ...(parentId !== undefined ? { parentId } : {}),
        },
        schema
      )
      if (aiData && Object.keys(aiData).length > 0) {
        // Resolve any nested pending relations (from generateEntity)
        generatedData = await resolveNestedPending(aiData, targetEntity, schema, provider)
      }
    } catch (error) {
      // Log AI generation failure for debugging before falling through to placeholder
      // This prevents silent failures from hiding issues
      console.debug(
        `AI generation failed for ${spec.type} (parent: ${parentType}), falling back to placeholder:`,
        error instanceof Error ? error.message : error
      )
      // Fall through to placeholder generation
    }
  }

  // If AI generation didn't produce data, fall back to placeholder generation
  if (Object.keys(generatedData).length === 0) {
    // Build context for generation
    const parentContextFields: string[] = []
    for (const [key, value] of Object.entries(contextData)) {
      if (!key.startsWith('$') && !key.startsWith('_') && typeof value === 'string' && value) {
        parentContextFields.push(`${key}: ${value}`)
      }
    }

    // Include source entity's $instructions (parent context) and target entity's $instructions
    const sourceInstructions = spec.sourceInstructions
    const targetInstructions = targetEntity.schema?.['$instructions'] as string | undefined
    const contextParts: string[] = []
    // Source instructions first (parent context propagation)
    if (sourceInstructions) {
      contextParts.push(sourceInstructions)
    }
    // Then target instructions (child entity's own context)
    if (targetInstructions) {
      contextParts.push(targetInstructions)
    }
    if (hint) {
      contextParts.push(hint)
    }
    contextParts.push(...parentContextFields)
    const fullContext = contextParts.filter(Boolean).join(' | ')

    // Generate default values for the target entity's fields
    for (const [fieldName, field] of targetEntity.fields) {
      if (!field.isRelation && !field.isOptional) {
        // Check if it's a prompt field (type contains spaces, slashes, or question marks)
        const isPromptField =
          field.type.includes(' ') || field.type.includes('/') || field.type.includes('?')

        if (field.type === 'string' || isPromptField) {
          // For prompt fields, use the type as additional context for generation
          const fieldHint = isPromptField ? field.type : hint
          generatedData[fieldName] = generateContextAwareValue(
            fieldName,
            spec.type,
            fullContext,
            fieldHint,
            contextData
          )
        } else if (field.type === 'number') {
          generatedData[fieldName] = 0
        } else if (field.type === 'boolean') {
          generatedData[fieldName] = false
        }
      } else if (
        field.isRelation &&
        field.operator === '->' &&
        !field.isArray &&
        !field.isOptional
      ) {
        // Recursively resolve nested forward exact relations
        const nestedSpec: ReferenceSpec = {
          field: fieldName,
          operator: '->',
          type: field.relatedType!,
          matchMode: 'exact',
          resolved: false,
          ...(field.prompt !== undefined ? { prompt: field.prompt } : {}),
        }
        const nestedId = await resolveReferenceSpec(
          nestedSpec,
          generatedData,
          schema,
          provider,
          generateContextAwareValue,
          generateEntityWithAI
        )
        if (nestedId) {
          generatedData[fieldName] = nestedId
        }
      }
    }
  }

  // Use parent ID if available, otherwise use a descriptive string
  const created = await provider.create(spec.type, undefined, {
    ...generatedData,
    $generated: true,
    $generatedBy:
      parentId || (spec.matchMode === 'fuzzy' ? 'fuzzy-resolution' : 'reference-resolution'),
    $sourceField: spec.field,
  })
  return created['$id'] as string
}

// =============================================================================
// Entity Hydration
// =============================================================================

/**
 * Hydrate an entity with lazy-loaded relations
 *
 * For backward edges (direction === 'backward'), we query for entities
 * of the related type that have a reference pointing TO this entity.
 * This enables reverse lookups like "get all comments for a post".
 *
 * ## Backward Exact (<-) vs Backward Fuzzy (<~) Resolution
 *
 * This function handles both backward exact and backward fuzzy resolution,
 * but the resolution strategies differ:
 *
 * **Backward Exact (`<-`)**: Uses foreign key lookup (exact ID match)
 * - Queries `provider.list(type, { where: { backrefField: id } })`
 * - Returns all entities that explicitly reference the current entity
 * - Example: `Blog.posts: ['<-Post']` finds Posts where `post.blog === blog.$id`
 *
 * **Backward Fuzzy (`<~`)**: Uses pre-resolved IDs from semantic search
 * - During creation, `resolveBackwardFuzzy()` stores matched IDs
 * - Hydration retrieves entities using those stored IDs
 * - Example: `ICP.as: '<~Occupation'` was resolved via semantic search at creation time
 *
 * ## Resolution Cases
 *
 * - Single backward ref with stored ID: resolve directly (e.g., member.team = teamId)
 * - Single backward ref without stored ID: find related entity that points to us via relations
 * - Array backward ref with stored IDs: resolve each stored ID (backward fuzzy case)
 * - Array backward ref without stored IDs: query via backref lookup (backward exact case)
 */
export function hydrateEntity(
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  resolveProvider: () => Promise<DBProvider>
): Record<string, unknown> {
  const hydrated: Record<string, unknown> = { ...data }
  const id = (data['$id'] || data['id']) as string
  const typeName = entity.name

  // Add lazy getters for relations
  for (const [fieldName, field] of entity.fields) {
    if (field.isRelation && field.relatedType) {
      const relatedEntity = schema.entities.get(field.relatedType)
      if (!relatedEntity) continue

      // Check if this is a backward edge
      const isBackward = field.direction === 'backward'

      // For forward single relations with stored IDs, create a proxy that:
      // - Acts like a string (for .toMatch(), String(), etc.)
      // - Can be awaited to get the related entity (thenable)
      if (!isBackward && !field.isArray && data[fieldName]) {
        const storedId = data[fieldName] as string
        // For union types, we need to check all possible types
        const typesToSearch =
          field.unionTypes && field.unionTypes.length > 0 ? field.unionTypes : [field.relatedType!]
        // Check if we have a stored matchedType from the creation
        const storedMatchedType = data[`${fieldName}$matchedType`] as string | undefined

        const thenableProxy = new Proxy({} as Record<string, unknown>, {
          get(target, prop) {
            if (prop === 'then') {
              return (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
                return (async () => {
                  const provider = await resolveProvider()

                  // If we have a stored matched type, use it directly
                  if (storedMatchedType && typesToSearch.includes(storedMatchedType)) {
                    const result = await provider.get(storedMatchedType, storedId)
                    if (result) {
                      const matchedEntity = schema.entities.get(storedMatchedType)
                      if (matchedEntity) {
                        const hydrated = hydrateEntity(
                          result,
                          matchedEntity,
                          schema,
                          resolveProvider
                        )
                        return { ...hydrated, $matchedType: storedMatchedType }
                      }
                    }
                  }

                  // For union types, try each type until we find the entity
                  for (const searchType of typesToSearch) {
                    const searchEntity = schema.entities.get(searchType)
                    if (!searchEntity) continue

                    const result = await provider.get(searchType, storedId)
                    if (result) {
                      const hydrated = hydrateEntity(result, searchEntity, schema, resolveProvider)
                      // Include $matchedType to indicate which union type matched
                      return { ...hydrated, $matchedType: searchType }
                    }
                  }
                  return null
                })().then(resolve, reject)
              }
            }
            if (prop === Symbol.toPrimitive || prop === 'valueOf') {
              return () => storedId
            }
            if (prop === 'toString') {
              return () => storedId
            }
            if (prop === 'match') {
              return (regex: RegExp) => storedId.match(regex)
            }
            if (prop === '$type') {
              return storedMatchedType || field.relatedType
            }
            // Return the stored ID for $id property access (useful for equality checks)
            if (prop === '$id') {
              return storedId
            }
            // For any other property access, return undefined
            // Note: Use problem.task.$id or String(problem.task) for equality checks
            return undefined
          },
        })
        hydrated[fieldName] = thenableProxy
        continue
      }

      // For forward array relations with stored IDs, create a thenable array that:
      // - Behaves like a normal array of IDs (has length, can be iterated, etc.)
      // - Can be awaited to fetch and hydrate the full entities
      // Note: we create the proxy even for empty arrays so they have $type for batch loading detection
      if (!isBackward && field.isArray && Array.isArray(data[fieldName])) {
        const storedIds = data[fieldName] as string[]
        // For union types, we need to check all possible types
        const typesToSearch =
          field.unionTypes && field.unionTypes.length > 0 ? field.unionTypes : [field.relatedType!]

        // Create a proxy that wraps the array but adds thenable behavior
        const thenableArray = new Proxy(storedIds, {
          get(target, prop) {
            if (prop === 'then') {
              return (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
                return (async () => {
                  const provider = await resolveProvider()
                  const results: Array<Record<string, unknown>> = []

                  for (const targetId of storedIds) {
                    // For union types, try each type until we find the entity
                    for (const searchType of typesToSearch) {
                      const searchEntity = schema.entities.get(searchType)
                      if (!searchEntity) continue

                      const result = await provider.get(searchType, targetId)
                      if (result) {
                        const hydrated = hydrateEntity(
                          result,
                          searchEntity,
                          schema,
                          resolveProvider
                        )
                        // Include $matchedType to indicate which union type matched
                        results.push({ ...hydrated, $matchedType: searchType })
                        break
                      }
                    }
                  }
                  return results
                })().then(resolve, reject)
              }
            }
            // Expose $type for batch loading detection
            if (prop === '$type') {
              return field.relatedType
            }
            // Expose $isArrayRelation marker for batch loading
            if (prop === '$isArrayRelation') {
              return true
            }
            // For all other properties, delegate to the actual array
            const value = Reflect.get(target, prop)
            // Bind methods to the target array
            if (typeof value === 'function') {
              return value.bind(target)
            }
            return value
          },
        })
        hydrated[fieldName] = thenableArray
        continue
      }

      // Define lazy getter
      Object.defineProperty(hydrated, fieldName, {
        get: () => {
          // Check if this is a backward edge
          if (isBackward && !field.isArray) {
            // Case 1: Single backward ref
            // Returns a Promise that resolves to the related entity
            const storedId = data[fieldName] as string | undefined

            return (async () => {
              const provider = await resolveProvider()

              if (storedId) {
                // Has stored ID - directly fetch the related entity
                const result = await provider.get(field.relatedType!, storedId)
                return result ? hydrateEntity(result, relatedEntity, schema, resolveProvider) : null
              }

              // No stored ID - find via inverse relation lookup
              // Find entities of relatedType that have this entity in their relations
              for (const [relFieldName, relField] of relatedEntity.fields) {
                if (
                  relField.isRelation &&
                  relField.relatedType === typeName &&
                  relField.direction !== 'backward' &&
                  relField.isArray
                ) {
                  // Found a forward array relation on related entity pointing to us
                  // Check if any entity of relatedType has this entity in that relation
                  const allRelated = await provider.list(field.relatedType!)
                  for (const candidate of allRelated) {
                    const candidateId = (candidate['$id'] || candidate['id']) as string
                    const related = await provider.related(
                      field.relatedType!,
                      candidateId,
                      relFieldName
                    )
                    if (related.some((r) => (r['$id'] || r['id']) === id)) {
                      return hydrateEntity(candidate, relatedEntity, schema, resolveProvider)
                    }
                  }
                }
              }
              return null
            })()
          }

          // For forward relations and backward arrays, return async resolver
          return (async () => {
            const provider = await resolveProvider()

            if (isBackward) {
              // Case 2: Array backward ref
              // For union types, we need to check all possible types
              const typesToSearch =
                field.unionTypes && field.unionTypes.length > 0
                  ? field.unionTypes
                  : [field.relatedType!]

              // Check if we have stored IDs (e.g., from backward fuzzy resolution)
              const storedIds = data[fieldName] as string[] | undefined
              if (Array.isArray(storedIds) && storedIds.length > 0) {
                // Use stored IDs directly - this handles backward fuzzy (<~) array fields
                // For union types, try each type until we find the entity
                const hydrated: Array<Record<string, unknown>> = []
                for (const targetId of storedIds) {
                  for (const searchType of typesToSearch) {
                    const searchEntity = schema.entities.get(searchType)
                    if (!searchEntity) continue

                    const result = await provider.get(searchType, targetId)
                    if (result) {
                      const hydratedEntity = hydrateEntity(
                        result,
                        searchEntity,
                        schema,
                        resolveProvider
                      )
                      hydrated.push({ ...hydratedEntity, $matchedType: searchType })
                      break
                    }
                  }
                }
                return hydrated
              }

              // No stored IDs - use backref lookup across all union types
              // e.g., Blog.posts: ['<-Post'] - find Posts where post.blog === blog.$id
              // The backref tells us which field on the related type stores our ID
              const allResults: Array<Record<string, unknown>> = []

              for (const searchType of typesToSearch) {
                const searchEntity = schema.entities.get(searchType)
                if (!searchEntity) continue

                // If no explicit backref, infer from schema relationships
                let backrefField = field.backref

                if (!backrefField) {
                  // Infer backref: look for a field on related entity that points to us
                  for (const [relFieldName, relField] of searchEntity.fields) {
                    if (
                      relField.isRelation &&
                      relField.relatedType === typeName &&
                      relField.direction !== 'backward' &&
                      !relField.isArray
                    ) {
                      // Found a forward single relation pointing to us - use its name
                      backrefField = relFieldName
                      break
                    }
                  }

                  // Fallback to entity name lowercase if no explicit relation found
                  if (!backrefField) {
                    backrefField = typeName.toLowerCase()
                  }
                }

                // Query the related type for entities that reference this entity
                const results = await provider.list(searchType, {
                  where: { [backrefField]: id },
                })

                for (const r of results) {
                  const hydratedEntity = hydrateEntity(r, searchEntity, schema, resolveProvider)
                  allResults.push({ ...hydratedEntity, $matchedType: searchType })
                }
              }

              return allResults
            } else if (field.isArray) {
              // Forward array relation - get related entities via relationship
              const results = await provider.related(entity.name, id, fieldName)
              return Promise.all(
                results.map((r) => hydrateEntity(r, relatedEntity, schema, resolveProvider))
              )
            } else {
              // Forward single relation - get the stored ID and fetch
              const relatedId = data[fieldName] as string | undefined
              if (!relatedId) return null
              const result = await provider.get(field.relatedType!, relatedId)
              return result ? hydrateEntity(result, relatedEntity, schema, resolveProvider) : null
            }
          })()
        },
        enumerable: true,
        configurable: true,
      })
    }
  }

  return hydrated
}
