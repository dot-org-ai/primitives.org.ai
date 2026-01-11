/**
 * Semantic Search and Matching
 *
 * Contains backward fuzzy (<~) and forward fuzzy (~>) resolution functions
 * for semantic search-based relationship matching.
 *
 * @packageDocumentation
 */

import type {
  ParsedEntity,
  ParsedSchema,
  EntitySchema,
} from '../types.js'

import type { DBProvider, SemanticSearchResult } from './provider.js'
import { hasSemanticSearch } from './provider.js'
import { resolveNestedPending } from './resolve.js'
import { generateEntity } from './cascade.js'
import { searchUnionTypes, createProviderSearcher, type FallbackSearchOptions } from './union-fallback.js'

/**
 * Safely extract the fuzzy threshold from entity schema
 *
 * Checks for the `$fuzzyThreshold` metadata property in the entity schema
 * and returns its value if valid, otherwise returns the default of 0.75.
 *
 * @param entity - The parsed entity definition
 * @returns The fuzzy matching threshold (0-1), defaults to 0.75
 *
 * @internal
 */
function getFuzzyThreshold(entity: ParsedEntity): number {
  const schema = entity.schema as EntitySchema | undefined
  if (schema && '$fuzzyThreshold' in schema) {
    const threshold = schema.$fuzzyThreshold
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
      const searchQuery = (data[hintKey] as string) || field.prompt || ''

      // Skip if no search query available (optional fields without hint)
      if (!searchQuery) {
        continue
      }

      // Determine which types to search - all union types or just the primary type
      const typesToSearch = field.unionTypes && field.unionTypes.length > 0
        ? field.unionTypes
        : [field.relatedType!]

      // Check if provider supports semantic search
      if (hasSemanticSearch(provider)) {
        // Filter to only types that exist in the schema
        const validTypes = typesToSearch.filter(t => schema.entities.has(t))
        if (validTypes.length === 0) continue

        // Create a searcher from the provider
        const searcher = createProviderSearcher(provider)

        // Determine search mode:
        // - For single fields with union types, use ordered fallback (search in order, stop on first match)
        // - For array fields, use parallel mode to collect all matches
        const searchMode: FallbackSearchOptions['mode'] = field.isArray ? 'parallel' : 'ordered'

        const searchResult = await searchUnionTypes(
          validTypes,
          searchQuery,
          {
            mode: searchMode,
            threshold,
            searcher,
            returnAll: field.isArray, // For arrays, get all matches
            limit: field.isArray ? 10 : 1, // Single fields only need 1 result per type
          }
        )

        if (field.isArray) {
          // For array fields, collect all matches sorted by score
          if (searchResult.matches.length > 0) {
            resolved[fieldName] = searchResult.matches.map(m => m.$id)
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
): Promise<{ data: Record<string, unknown>; pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string; similarity?: number; matchedType?: string }> }> {
  const resolved = { ...data }
  const pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string; similarity?: number; matchedType?: string }> = []
  // Default threshold from entity schema or 0.75
  const defaultThreshold = getFuzzyThreshold(entity)

  for (const [fieldName, field] of entity.fields) {
    if (field.operator === '~>' && field.direction === 'forward') {
      // Skip if value already provided
      if (resolved[fieldName] !== undefined && resolved[fieldName] !== null) {
        // If value is provided for array field, we still need to create relationships
        if (field.isArray && Array.isArray(resolved[fieldName])) {
          const ids = resolved[fieldName] as string[]
          for (const targetId of ids) {
            pendingRelations.push({ fieldName, targetType: field.relatedType!, targetId })
          }
        }
        continue
      }

      // Get the hint field value - uses fieldNameHint convention
      const hintKey = `${fieldName}Hint`
      const hintValue = data[hintKey]
      const searchQuery = (typeof hintValue === 'string' ? hintValue : undefined) || field.prompt || fieldName

      // Get threshold - field-level overrides entity-level
      const threshold = field.threshold ?? defaultThreshold

      if (field.isArray) {
        // Array fuzzy field - can contain both matched and generated
        const hints = Array.isArray(hintValue) ? hintValue : [hintValue].filter(Boolean)
        const resultIds: string[] = []
        const usedEntityIds = new Set<string>() // Track already-matched entities to avoid duplicates

        // Determine which types to search - all union types or just the primary type
        const typesToSearch = field.unionTypes && field.unionTypes.length > 0
          ? field.unionTypes
          : [field.relatedType!]

        for (const hint of hints) {
          const hintStr = String(hint || fieldName)
          let matched = false
          let matchedType: string | undefined

          // Try semantic search first - search across all union types
          if (hasSemanticSearch(provider)) {
            // Collect best match from all union types
            let bestMatch: SemanticSearchResult | undefined
            let bestMatchType: string | undefined

            for (const searchType of typesToSearch) {
              // Only search types that exist in the schema
              if (!schema.entities.has(searchType)) continue

              const matches: SemanticSearchResult[] = await provider.semanticSearch(
                searchType,
                hintStr,
                { minScore: threshold, limit: 10 } // Get more results to find unused matches
              )

              // Find the best match that hasn't been used yet
              for (const match of matches) {
                const matchId = match.$id
                if (match.$score >= threshold && !usedEntityIds.has(matchId)) {
                  // Track the best match across all types
                  if (!bestMatch || match.$score > bestMatch.$score) {
                    bestMatch = match
                    bestMatchType = searchType
                  }
                  break // Found valid match in this type, move to next type
                }
              }
            }

            if (bestMatch && bestMatchType) {
              const matchId = bestMatch.$id
              matchedType = bestMatchType
              resultIds.push(matchId)
              usedEntityIds.add(matchId)
              pendingRelations.push({
                fieldName,
                targetType: matchedType,
                targetId: matchId,
                similarity: bestMatch.$score,
                matchedType
              })
              // Update the matched entity with $generated: false and similarity metadata
              await provider.update(matchedType, matchId, {
                $generated: false,
                $similarity: bestMatch.$score,
                $matchedType: matchedType
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
              const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
              const created = await provider.create(generateType, undefined, {
                ...resolvedGenerated,
                $generated: true,
                $generatedBy: parentId,
                $sourceField: fieldName,
                $matchedType: generateType
              })
              resultIds.push(created.$id as string)
              pendingRelations.push({
                fieldName,
                targetType: generateType,
                targetId: created.$id as string,
                matchedType: generateType
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
        const typesToSearch = field.unionTypes && field.unionTypes.length > 0
          ? field.unionTypes
          : [field.relatedType!]

        // Try semantic search first - search across all union types
        if (hasSemanticSearch(provider)) {
          // Collect best match from all union types
          let bestMatch: SemanticSearchResult | undefined
          let bestMatchType: string | undefined

          for (const searchType of typesToSearch) {
            // Only search types that exist in the schema
            if (!schema.entities.has(searchType)) continue

            const matches: SemanticSearchResult[] = await provider.semanticSearch(
              searchType,
              searchQuery,
              { minScore: threshold, limit: 5 }
            )

            const firstMatch = matches[0]
            if (firstMatch && firstMatch.$score >= threshold) {
              // Track the best match across all types
              if (!bestMatch || firstMatch.$score > bestMatch.$score) {
                bestMatch = firstMatch
                bestMatchType = searchType
              }
            }
          }

          if (bestMatch && bestMatchType) {
            const matchedId = bestMatch.$id
            matchedType = bestMatchType
            resolved[fieldName] = matchedId
            resolved[`${fieldName}$matched`] = true
            resolved[`${fieldName}$score`] = bestMatch.$score
            resolved[`${fieldName}$matchedType`] = matchedType
            pendingRelations.push({
              fieldName,
              targetType: matchedType,
              targetId: matchedId,
              similarity: bestMatch.$score,
              matchedType
            })
            // Update the matched entity with $generated: false and similarity metadata
            await provider.update(matchedType, matchedId, {
              $generated: false,
              $similarity: bestMatch.$score,
              $matchedType: matchedType
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
            searchQuery,  // Use searchQuery which prioritizes hint over field.prompt
            { parent: typeName, parentData: data, parentId },
            schema
          )

          // Resolve any pending nested relations
          const relatedEntity = schema.entities.get(generateType)
          if (relatedEntity) {
            const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
            const created = await provider.create(generateType, undefined, {
              ...resolvedGenerated,
              $generated: true,
              $generatedBy: parentId,
              $sourceField: fieldName,
              $matchedType: generateType
            })
            resolved[fieldName] = created.$id
            resolved[`${fieldName}$matchedType`] = generateType
            pendingRelations.push({
              fieldName,
              targetType: generateType,
              targetId: created.$id as string,
              matchedType: generateType
            })
          }
        }
      }
    }
  }

  return { data: resolved, pendingRelations }
}
