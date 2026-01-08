/**
 * Reference Resolution Functions
 *
 * Contains forward/backward resolution functions for relationships,
 * context resolution, and entity hydration.
 *
 * @packageDocumentation
 */

import type {
  ParsedField,
  ParsedEntity,
  ParsedSchema,
  EntitySchema,
} from '../types.js'

import type { DBProvider, SemanticSearchResult } from './provider.js'
import { hasSemanticSearch } from './provider.js'
import type { ReferenceSpec } from './types.js'
import { isPrimitiveType } from './parse.js'

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
export function inferTypeFromField(fieldName: string, entity: ParsedEntity, schema: ParsedSchema): string | undefined {
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
  const contextData = new Map<string, Record<string, unknown>>()
  const currentEntity = schema.entities.get(typeName)
  if (!currentEntity) return contextData

  for (const dep of contextDeps) {
    // Convert to camelCase for field lookup (e.g., "Startup" -> "startup")
    const fieldName = dep.charAt(0).toLowerCase() + dep.slice(1)

    // Check if we have a field that references this type
    const field = currentEntity.fields.get(fieldName)
    if (field?.isRelation && field.relatedType) {
      const entityId = entity[fieldName]
      if (typeof entityId === 'string') {
        const fetched = await provider.get(field.relatedType, entityId)
        if (fetched) {
          contextData.set(fieldName, fetched)
          // Also store nested relationships
          const relatedEntity = schema.entities.get(field.relatedType)
          if (relatedEntity) {
            for (const [nestedFieldName, nestedField] of relatedEntity.fields) {
              if (nestedField.isRelation && nestedField.relatedType) {
                const nestedId = fetched[nestedFieldName]
                if (typeof nestedId === 'string') {
                  const nestedFetched = await provider.get(nestedField.relatedType, nestedId)
                  if (nestedFetched) {
                    contextData.set(`${fieldName}.${nestedFieldName}`, nestedFetched)
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return contextData
}

/**
 * Check if a field type is a prompt (contains spaces, indicating AI generation)
 */
export function isPromptField(field: ParsedField): boolean {
  // Fields with spaces in their type are prompts for AI generation
  return field.type.includes(' ') ||
    (field.type === 'string' && !field.isRelation && !isPrimitiveType(field.type))
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
        const resolvedNested = await resolveNestedPending(pending.data, relatedEntity, schema, provider)
        const created = await provider.create(pending.type, undefined, resolvedNested)
        resolved[fieldName] = created.$id
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
  ) => string
): Promise<string | null> {
  const targetEntity = schema.entities.get(spec.type)
  if (!targetEntity) {
    throw new Error(`Unknown target type: ${spec.type}`)
  }

  if (spec.matchMode === 'fuzzy') {
    // For fuzzy references, try to find an existing entity first
    if (hasSemanticSearch(provider)) {
      const searchQuery = spec.generatedText || spec.prompt || spec.field
      const matches: SemanticSearchResult[] = await provider.semanticSearch(spec.type, searchQuery, {
        minScore: 0.5,
        limit: 1,
      })

      const firstMatch = matches[0]
      if (firstMatch) {
        return firstMatch.$id
      }
    }

    // If no match found for fuzzy, fall through to create
  }

  // Create a new entity
  const generatedData: Record<string, unknown> = {}

  // Build context for generation
  const hint = spec.generatedText || spec.prompt || spec.field
  const parentContextFields: string[] = []
  for (const [key, value] of Object.entries(contextData)) {
    if (!key.startsWith('$') && !key.startsWith('_') && typeof value === 'string' && value) {
      parentContextFields.push(`${key}: ${value}`)
    }
  }
  const fullContext = [hint, ...parentContextFields].filter(Boolean).join(' | ')

  // Generate default values for the target entity's fields
  for (const [fieldName, field] of targetEntity.fields) {
    if (!field.isRelation && !field.isOptional) {
      if (field.type === 'string') {
        generatedData[fieldName] = generateContextAwareValue(fieldName, spec.type, fullContext, hint, contextData)
      } else if (field.type === 'number') {
        generatedData[fieldName] = 0
      } else if (field.type === 'boolean') {
        generatedData[fieldName] = false
      }
    } else if (field.isRelation && field.operator === '->' && !field.isArray && !field.isOptional) {
      // Recursively resolve nested forward exact relations
      const nestedSpec: ReferenceSpec = {
        field: fieldName,
        operator: '->',
        type: field.relatedType!,
        matchMode: 'exact',
        resolved: false,
        prompt: field.prompt,
      }
      const nestedId = await resolveReferenceSpec(nestedSpec, generatedData, schema, provider, generateContextAwareValue)
      if (nestedId) {
        generatedData[fieldName] = nestedId
      }
    }
  }

  // Use parent ID if available, otherwise use a descriptive string
  const parentId = contextData.$id as string | undefined
  const created = await provider.create(spec.type, undefined, {
    ...generatedData,
    $generated: true,
    $generatedBy: parentId || (spec.matchMode === 'fuzzy' ? 'fuzzy-resolution' : 'reference-resolution'),
    $sourceField: spec.field,
  })
  return created.$id as string
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
 * Backward reference resolution:
 * - Single backward ref with stored ID: resolve directly (e.g., member.team = teamId -> get Team by ID)
 * - Single backward ref without stored ID: find related entity that points to us via relations
 * - Array backward ref: find all entities of related type where their forward ref points to us
 */
export function hydrateEntity(
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  resolveProvider: () => Promise<DBProvider>
): Record<string, unknown> {
  const hydrated: Record<string, unknown> = { ...data }
  const id = (data.$id || data.id) as string
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
        const thenableProxy = new Proxy({} as Record<string, unknown>, {
          get(target, prop) {
            if (prop === 'then') {
              return (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
                return (async () => {
                  const provider = await resolveProvider()
                  const result = await provider.get(field.relatedType!, storedId)
                  return result ? hydrateEntity(result, relatedEntity, schema, resolveProvider) : null
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
              return field.relatedType
            }
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
        // Create a proxy that wraps the array but adds thenable behavior
        const thenableArray = new Proxy(storedIds, {
          get(target, prop) {
            if (prop === 'then') {
              return (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => {
                return (async () => {
                  const provider = await resolveProvider()
                  const results = await Promise.all(
                    storedIds.map(targetId => provider.get(field.relatedType!, targetId))
                  )
                  return results.filter(r => r !== null).map((r) => hydrateEntity(r!, relatedEntity, schema, resolveProvider))
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
                return result
                  ? hydrateEntity(result, relatedEntity, schema, resolveProvider)
                  : null
              }

              // No stored ID - find via inverse relation lookup
              // Find entities of relatedType that have this entity in their relations
              for (const [relFieldName, relField] of relatedEntity.fields) {
                if (relField.isRelation &&
                    relField.relatedType === typeName &&
                    relField.direction !== 'backward' &&
                    relField.isArray) {
                  // Found a forward array relation on related entity pointing to us
                  // Check if any entity of relatedType has this entity in that relation
                  const allRelated = await provider.list(field.relatedType!)
                  for (const candidate of allRelated) {
                    const candidateId = (candidate.$id || candidate.id) as string
                    const related = await provider.related(field.relatedType!, candidateId, relFieldName)
                    if (related.some(r => (r.$id || r.id) === id)) {
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
              // Check if we have stored IDs (e.g., from backward fuzzy resolution)
              const storedIds = data[fieldName] as string[] | undefined
              if (Array.isArray(storedIds) && storedIds.length > 0) {
                // Use stored IDs directly - this handles backward fuzzy (<~) array fields
                const results = await Promise.all(
                  storedIds.map(targetId => provider.get(field.relatedType!, targetId))
                )
                return Promise.all(
                  results.filter(r => r !== null).map((r) => hydrateEntity(r!, relatedEntity, schema, resolveProvider))
                )
              }

              // No stored IDs - use backref lookup
              // e.g., Blog.posts: ['<-Post'] - find Posts where post.blog === blog.$id
              // The backref tells us which field on the related type stores our ID
              // If no explicit backref, infer from schema relationships
              let backrefField = field.backref

              if (!backrefField) {
                // Infer backref: look for a field on related entity that points to us
                for (const [relFieldName, relField] of relatedEntity.fields) {
                  if (relField.isRelation &&
                      relField.relatedType === typeName &&
                      relField.direction !== 'backward' &&
                      !relField.isArray) {
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
              const results = await provider.list(field.relatedType!, {
                where: { [backrefField]: id },
              })

              return Promise.all(
                results.map((r) => hydrateEntity(r, relatedEntity, schema, resolveProvider))
              )
            } else if (field.isArray) {
              // Forward array relation - get related entities via relationship
              const results = await provider.related(
                entity.name,
                id,
                fieldName
              )
              return Promise.all(
                results.map((r) => hydrateEntity(r, relatedEntity, schema, resolveProvider))
              )
            } else {
              // Forward single relation - get the stored ID and fetch
              const relatedId = data[fieldName] as string | undefined
              if (!relatedId) return null
              const result = await provider.get(field.relatedType!, relatedId)
              return result
                ? hydrateEntity(result, relatedEntity, schema, resolveProvider)
                : null
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
