/**
 * Semantic Search and Matching
 *
 * Contains backward fuzzy (<~) and forward fuzzy (~>) resolution functions
 * for semantic search-based relationship matching.
 *
 * @packageDocumentation
 */

import type { ParsedEntity, ParsedSchema, EntitySchema } from '../types.js'

import type { DBProvider } from './provider.js'
import { hasSemanticSearch } from './provider.js'
import { resolveNestedPending } from './resolve.js'
import { generateEntity } from './cascade.js'
import {
  searchUnionTypes,
  createProviderSearcher,
  type FallbackSearchOptions,
} from './union-fallback.js'
import { findBestMatchAcrossTypes } from './search-utils.js'

// =============================================================================
// Text Search Fallback
// =============================================================================

/**
 * Result from text search fallback with type information
 */
interface TextSearchResult {
  $id: string
  $type: string
  [key: string]: unknown
}

/**
 * Perform basic text search across multiple types as fallback when semantic search unavailable
 *
 * This provides graceful degradation for providers that don't support semantic search
 * (e.g., RDB, DigitalObjectsProvider). It uses the provider's basic search() method
 * which typically performs case-insensitive substring matching.
 *
 * @param provider - The database provider
 * @param types - Types to search across
 * @param query - The search query
 * @param limit - Maximum results to return
 * @returns Array of matched entities with $id and $type
 */
async function textSearchFallback(
  provider: DBProvider,
  types: string[],
  query: string,
  limit: number
): Promise<TextSearchResult[]> {
  const results: TextSearchResult[] = []

  for (const type of types) {
    if (results.length >= limit) break

    try {
      const searchResults = await provider.search(type, query, { limit: limit - results.length })
      for (const result of searchResults) {
        if (results.length >= limit) break
        results.push({
          ...result,
          $id: (result['$id'] ?? result['id']) as string,
          $type: type,
        })
      }
    } catch {
      // Ignore search errors for individual types, continue with others
      continue
    }
  }

  return results
}

/**
 * Safely extract the fuzzy threshold from entity schema
 *
 * Checks for the `$fuzzyThreshold` metadata property in the entity schema
 * and returns its value if valid, otherwise returns the default of 0.75.
 *
 * @param entity - The parsed entity definition
 * @returns The fuzzy matching threshold (0-1), defaults to 0.75
 */
export function getFuzzyThreshold(entity: ParsedEntity): number {
  const schema = entity.schema as EntitySchema | undefined
  if (schema && '$fuzzyThreshold' in schema) {
    const threshold = schema['$fuzzyThreshold']
    if (typeof threshold === 'number') {
      return threshold
    }
  }
  return 0.75
}

// =============================================================================
// Backward Fuzzy Resolution
// =============================================================================

/**
 * Resolve backward fuzzy (<~) fields by using semantic search to find existing entities
 *
 * The <~ operator differs from <- in that it uses semantic/fuzzy matching:
 * - Uses AI/embedding-based similarity to find the best match from existing entities
 * - Does NOT generate new entities - only grounds to existing reference data
 * - Uses hint fields (e.g., categoryHint for category field) to guide matching
 *
 * @param typeName - The type of entity being created
 * @param data - The input data including hint fields
 * @param entity - The parsed entity definition
 * @param schema - The parsed schema
 * @param provider - The database provider (must support semanticSearch)
 * @returns The resolved data with backward fuzzy fields populated with matched entity IDs
 */
export async function resolveBackwardFuzzy(
  typeName: string,
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider
): Promise<Record<string, unknown>> {
  const resolved = { ...data }
  const threshold = getFuzzyThreshold(entity)

  for (const [fieldName, field] of entity.fields) {
    if (field.operator === '<~' && field.direction === 'backward') {
      // Skip if value already provided
      if (resolved[fieldName] !== undefined && resolved[fieldName] !== null) {
        continue
      }

      // Get the hint field value - uses fieldNameHint convention
      const hintKey = `${fieldName}Hint`
      let searchQuery = (data[hintKey] as string) || field.prompt || ''

      // If no explicit hint or prompt, build context from entity's data
      // This allows backward fuzzy to match based on the entity's own fields
      // Only use entity context for required fields - optional fields should stay null
      if (!searchQuery && !field.isOptional) {
        const contextParts: string[] = []
        for (const [key, value] of Object.entries(data)) {
          if (!key.startsWith('$') && !key.startsWith('_') && typeof value === 'string' && value) {
            contextParts.push(value)
          }
        }
        searchQuery = contextParts.join(' ')
      }

      // Skip if no search query available (optional fields without hint, or entity has no string fields)
      if (!searchQuery) {
        continue
      }

      // Determine which types to search - all union types or just the primary type
      const typesToSearch =
        field.unionTypes && field.unionTypes.length > 0 ? field.unionTypes : [field.relatedType!]

      // Filter to only types that exist in the schema
      const validTypes = typesToSearch.filter((t) => schema.entities.has(t))
      if (validTypes.length === 0) continue

      // Check if provider supports semantic search
      if (hasSemanticSearch(provider)) {
        // Create a searcher from the provider
        const searcher = createProviderSearcher(provider)

        // Determine search mode:
        // - For single fields with union types, use ordered fallback (search in order, stop on first match)
        // - For array fields, use parallel mode to collect all matches
        const searchMode: FallbackSearchOptions['mode'] = field.isArray ? 'parallel' : 'ordered'

        const searchResult = await searchUnionTypes(validTypes, searchQuery, {
          mode: searchMode,
          threshold,
          searcher,
          returnAll: field.isArray, // For arrays, get all matches
          limit: field.isArray ? 10 : 1, // Single fields only need 1 result per type
        })

        if (field.isArray) {
          // For array fields, collect all matches sorted by score
          if (searchResult.matches.length > 0) {
            resolved[fieldName] = searchResult.matches.map((m) => m.$id)
            // Track metadata about the search
            if (searchResult.fallbackTriggered) {
              resolved[`${fieldName}$fallbackUsed`] = true
            }
            resolved[`${fieldName}$searchedTypes`] = searchResult.searchedTypes
          }
        } else {
          // For single fields, use the best match (or first match in ordered mode)
          if (searchResult.matches.length > 0) {
            const bestMatch = searchResult.matches[0]!
            resolved[fieldName] = bestMatch.$id
            resolved[`${fieldName}$matchedType`] = bestMatch.$type
            resolved[`${fieldName}$score`] = bestMatch.$score

            // Track if fallback was used (matched type != first type in union)
            if (searchResult.fallbackTriggered) {
              resolved[`${fieldName}$fallbackUsed`] = true
              resolved[`${fieldName}$searchOrder`] = searchResult.searchOrder
            }
          }
        }
      } else {
        // Fallback to basic text search when semantic search is unavailable
        // This provides graceful degradation for providers like RDB
        const textSearchResults = await textSearchFallback(
          provider,
          validTypes,
          searchQuery,
          field.isArray ? 10 : 1
        )

        if (field.isArray) {
          if (textSearchResults.length > 0) {
            resolved[fieldName] = textSearchResults.map((r) => r.$id)
            resolved[`${fieldName}$searchedTypes`] = validTypes
            resolved[`${fieldName}$textFallback`] = true
          }
        } else {
          if (textSearchResults.length > 0) {
            const bestMatch = textSearchResults[0]!
            resolved[fieldName] = bestMatch.$id
            resolved[`${fieldName}$matchedType`] = bestMatch.$type
            resolved[`${fieldName}$textFallback`] = true
          }
        }
      }
      // Note: <~ typically doesn't generate - it grounds to existing data
      // If no match found and field is optional, leave as undefined
    }
  }

  return resolved
}

// =============================================================================
// Forward Fuzzy Resolution
// =============================================================================

/**
 * Resolve forward fuzzy (~>) fields via semantic search then generation
 *
 * The ~> operator differs from -> in that it first attempts semantic search:
 * - Searches existing entities via embedding similarity
 * - If a match is found above threshold, reuses the existing entity
 * - If no match is found, generates a new entity
 * - Respects configurable similarity threshold ($fuzzyThreshold or field-level)
 *
 * @param typeName - The type of entity being created
 * @param data - The input data including hint fields
 * @param entity - The parsed entity definition
 * @param schema - The parsed schema
 * @param provider - The database provider (must support semanticSearch)
 * @param parentId - Pre-generated ID of the parent entity for backward refs
 * @returns Object with resolved data and pending relations for array fields
 */
export async function resolveForwardFuzzy(
  typeName: string,
  data: Record<string, unknown>,
  entity: ParsedEntity,
  schema: ParsedSchema,
  provider: DBProvider,
  parentId: string
): Promise<{
  data: Record<string, unknown>
  pendingRelations: Array<{
    fieldName: string
    targetType: string
    targetId: string
    similarity?: number
    matchedType?: string
  }>
}> {
  const resolved = { ...data }
  const pendingRelations: Array<{
    fieldName: string
    targetType: string
    targetId: string
    similarity?: number
    matchedType?: string
  }> = []
  // Default threshold from entity schema or 0.75
  const defaultThreshold = getFuzzyThreshold(entity)

  for (const [fieldName, field] of entity.fields) {
    if (field.operator === '~>' && field.direction === 'forward') {
      // If value already provided, still need to track for edge creation
      if (resolved[fieldName] !== undefined && resolved[fieldName] !== null) {
        // Get matchedType from metadata if available, otherwise use relatedType
        const matchedTypeKey = `${fieldName}$matchedType`
        const matchedType = (resolved[matchedTypeKey] as string) || field.relatedType!
        const similarityKey = `${fieldName}$score`
        const similarity = resolved[similarityKey] as number | undefined

        if (field.isArray && Array.isArray(resolved[fieldName])) {
          const ids = resolved[fieldName] as string[]
          for (const targetId of ids) {
            const relation: {
              fieldName: string
              targetType: string
              targetId: string
              similarity?: number
              matchedType?: string
            } = {
              fieldName,
              targetType: matchedType,
              targetId,
              matchedType,
            }
            if (similarity !== undefined) relation.similarity = similarity
            pendingRelations.push(relation)
          }
        } else if (typeof resolved[fieldName] === 'string') {
          // Single fuzzy field with value already set - add to pendingRelations for edge creation
          const relation: {
            fieldName: string
            targetType: string
            targetId: string
            similarity?: number
            matchedType?: string
          } = {
            fieldName,
            targetType: matchedType,
            targetId: resolved[fieldName] as string,
            matchedType,
          }
          if (similarity !== undefined) relation.similarity = similarity
          pendingRelations.push(relation)
        }
        continue
      }

      // Get the hint field value - uses fieldNameHint convention
      const hintKey = `${fieldName}Hint`
      const hintValue = data[hintKey]
      const searchQuery =
        (typeof hintValue === 'string' ? hintValue : undefined) || field.prompt || fieldName

      // Get threshold - field-level overrides entity-level
      const threshold = field.threshold ?? defaultThreshold

      if (field.isArray) {
        // Array fuzzy field - can contain both matched and generated
        const hints = Array.isArray(hintValue) ? hintValue : [hintValue].filter(Boolean)
        const resultIds: string[] = []
        const usedEntityIds = new Set<string>() // Track already-matched entities to avoid duplicates

        // Determine which types to search - all union types or just the primary type
        const typesToSearch =
          field.unionTypes && field.unionTypes.length > 0 ? field.unionTypes : [field.relatedType!]

        for (const hint of hints) {
          const hintStr = String(hint || fieldName)
          let matched = false
          let matchedType: string | undefined

          // Try semantic search first - search across all union types
          if (hasSemanticSearch(provider)) {
            const bestMatchResult = await findBestMatchAcrossTypes(typesToSearch, hintStr, {
              threshold,
              limit: 10,
              excludeIds: usedEntityIds,
              schema,
              provider,
            })

            if (bestMatchResult) {
              const matchId = bestMatchResult.match.$id
              matchedType = bestMatchResult.type
              resultIds.push(matchId)
              usedEntityIds.add(matchId)
              pendingRelations.push({
                fieldName,
                targetType: matchedType,
                targetId: matchId,
                similarity: bestMatchResult.match.$score,
                matchedType,
              })
              // Update the matched entity with $generated: false and similarity metadata
              await provider.update(matchedType, matchId, {
                $generated: false,
                $similarity: bestMatchResult.match.$score,
                $matchedType: matchedType,
              })
              matched = true
            }
          } else {
            // Fallback to text search when semantic search unavailable
            const textResults = await textSearchFallback(provider, typesToSearch, hintStr, 10)
            // Filter out already used IDs
            const availableResults = textResults.filter((r) => !usedEntityIds.has(r.$id))
            if (availableResults.length > 0) {
              const bestMatch = availableResults[0]!
              matchedType = bestMatch.$type
              resultIds.push(bestMatch.$id)
              usedEntityIds.add(bestMatch.$id)
              pendingRelations.push({
                fieldName,
                targetType: matchedType,
                targetId: bestMatch.$id,
                matchedType,
              })
              await provider.update(matchedType, bestMatch.$id, {
                $generated: false,
                $matchedType: matchedType,
              })
              matched = true
            }
          }

          // Generate if no match found (or all matches were already used)
          if (!matched) {
            // For generation, use the first union type (or primary relatedType)
            const generateType = typesToSearch[0]!
            const generated = await generateEntity(
              generateType,
              hintStr,
              { parent: typeName, parentData: data, parentId },
              schema
            )

            // Resolve any pending nested relations
            const relatedEntity = schema.entities.get(generateType)
            if (relatedEntity) {
              const resolvedGenerated = await resolveNestedPending(
                generated,
                relatedEntity,
                schema,
                provider
              )
              const created = await provider.create(generateType, undefined, {
                ...resolvedGenerated,
                $generated: true,
                $generatedBy: parentId,
                $sourceField: fieldName,
                $matchedType: generateType,
              })
              resultIds.push(created['$id'] as string)
              pendingRelations.push({
                fieldName,
                targetType: generateType,
                targetId: created['$id'] as string,
                matchedType: generateType,
              })
            }
          }
        }

        resolved[fieldName] = resultIds
      } else {
        // Single fuzzy field
        let matched = false
        let matchedType: string | undefined

        // Determine which types to search - all union types or just the primary type
        const typesToSearch =
          field.unionTypes && field.unionTypes.length > 0 ? field.unionTypes : [field.relatedType!]

        // Try semantic search first - search across all union types
        if (hasSemanticSearch(provider)) {
          const bestMatchResult = await findBestMatchAcrossTypes(typesToSearch, searchQuery, {
            threshold,
            limit: 5,
            schema,
            provider,
          })

          if (bestMatchResult) {
            const matchedId = bestMatchResult.match.$id
            matchedType = bestMatchResult.type
            resolved[fieldName] = matchedId
            resolved[`${fieldName}$matched`] = true
            resolved[`${fieldName}$score`] = bestMatchResult.match.$score
            resolved[`${fieldName}$matchedType`] = matchedType
            pendingRelations.push({
              fieldName,
              targetType: matchedType,
              targetId: matchedId,
              similarity: bestMatchResult.match.$score,
              matchedType,
            })
            // Update the matched entity with $generated: false and similarity metadata
            await provider.update(matchedType, matchedId, {
              $generated: false,
              $similarity: bestMatchResult.match.$score,
              $matchedType: matchedType,
            })
            matched = true
          }
        } else {
          // Fallback to text search when semantic search unavailable
          const textResults = await textSearchFallback(provider, typesToSearch, searchQuery, 5)
          if (textResults.length > 0) {
            const bestMatch = textResults[0]!
            matchedType = bestMatch.$type
            resolved[fieldName] = bestMatch.$id
            resolved[`${fieldName}$matched`] = true
            resolved[`${fieldName}$matchedType`] = matchedType
            resolved[`${fieldName}$textFallback`] = true
            pendingRelations.push({
              fieldName,
              targetType: matchedType,
              targetId: bestMatch.$id,
              matchedType,
            })
            await provider.update(matchedType, bestMatch.$id, {
              $generated: false,
              $matchedType: matchedType,
            })
            matched = true
          }
        }

        // Generate if no match found
        if (!matched) {
          // For generation, use the first union type (or primary relatedType)
          const generateType = typesToSearch[0]!
          const generated = await generateEntity(
            generateType,
            searchQuery, // Use searchQuery which prioritizes hint over field.prompt
            { parent: typeName, parentData: data, parentId },
            schema
          )

          // Resolve any pending nested relations
          const relatedEntity = schema.entities.get(generateType)
          if (relatedEntity) {
            const resolvedGenerated = await resolveNestedPending(
              generated,
              relatedEntity,
              schema,
              provider
            )
            const created = await provider.create(generateType, undefined, {
              ...resolvedGenerated,
              $generated: true,
              $generatedBy: parentId,
              $sourceField: fieldName,
              $matchedType: generateType,
            })
            resolved[fieldName] = created['$id']
            resolved[`${fieldName}$matchedType`] = generateType
            pendingRelations.push({
              fieldName,
              targetType: generateType,
              targetId: created['$id'] as string,
              matchedType: generateType,
            })
          }
        }
      }
    }
  }

  return { data: resolved, pendingRelations }
}
