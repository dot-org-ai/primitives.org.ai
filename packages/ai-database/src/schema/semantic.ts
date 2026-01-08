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

      // Check if provider supports semantic search
      if (hasSemanticSearch(provider)) {
        const matches: SemanticSearchResult[] = await provider.semanticSearch(
          field.relatedType!,
          searchQuery,
          { minScore: threshold, limit: field.isArray ? 10 : 1 }
        )

        if (matches.length > 0) {
          if (field.isArray) {
            // For array fields, return all matches above threshold
            resolved[fieldName] = matches
              .filter((m: SemanticSearchResult) => m.$score >= threshold)
              .map((m: SemanticSearchResult) => m.$id)
          } else {
            // For single fields, return the best match
            const firstMatch = matches[0]
            if (firstMatch) {
              resolved[fieldName] = firstMatch.$id
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
): Promise<{ data: Record<string, unknown>; pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string; similarity?: number }> }> {
  const resolved = { ...data }
  const pendingRelations: Array<{ fieldName: string; targetType: string; targetId: string; similarity?: number }> = []
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

        for (const hint of hints) {
          const hintStr = String(hint || fieldName)
          let matched = false

          // Try semantic search first
          if (hasSemanticSearch(provider)) {
            const matches: SemanticSearchResult[] = await provider.semanticSearch(
              field.relatedType!,
              hintStr,
              { minScore: threshold, limit: 10 } // Get more results to find unused matches
            )

            // Find the best match that hasn't been used yet
            for (const match of matches) {
              const matchId = match.$id
              if (match.$score >= threshold && !usedEntityIds.has(matchId)) {
                resultIds.push(matchId)
                usedEntityIds.add(matchId)
                pendingRelations.push({
                  fieldName,
                  targetType: field.relatedType!,
                  targetId: matchId,
                  similarity: match.$score
                })
                // Update the matched entity with $generated: false and similarity metadata
                await provider.update(field.relatedType!, matchId, {
                  $generated: false,
                  $similarity: match.$score
                })
                matched = true
                break
              }
            }
          }

          // Generate if no match found (or all matches were already used)
          if (!matched) {
            const generated = await generateEntity(
              field.relatedType!,
              hintStr,
              { parent: typeName, parentData: data, parentId },
              schema
            )

            // Resolve any pending nested relations
            const relatedEntity = schema.entities.get(field.relatedType!)
            if (relatedEntity) {
              const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
              const created = await provider.create(field.relatedType!, undefined, {
                ...resolvedGenerated,
                $generated: true,
                $generatedBy: parentId,
                $sourceField: fieldName
              })
              resultIds.push(created.$id as string)
              pendingRelations.push({
                fieldName,
                targetType: field.relatedType!,
                targetId: created.$id as string
              })
            }
          }
        }

        resolved[fieldName] = resultIds
      } else {
        // Single fuzzy field
        let matched = false

        // Try semantic search first
        if (hasSemanticSearch(provider)) {
          const matches: SemanticSearchResult[] = await provider.semanticSearch(
            field.relatedType!,
            searchQuery,
            { minScore: threshold, limit: 5 }
          )

          const firstMatch = matches[0]
          if (firstMatch && firstMatch.$score >= threshold) {
            const matchedId = firstMatch.$id
            resolved[fieldName] = matchedId
            resolved[`${fieldName}$matched`] = true
            resolved[`${fieldName}$score`] = firstMatch.$score
            pendingRelations.push({
              fieldName,
              targetType: field.relatedType!,
              targetId: matchedId,
              similarity: firstMatch.$score
            })
            // Update the matched entity with $generated: false and similarity metadata
            await provider.update(field.relatedType!, matchedId, {
              $generated: false,
              $similarity: firstMatch.$score
            })
            matched = true
          }
        }

        // Generate if no match found
        if (!matched) {
          const generated = await generateEntity(
            field.relatedType!,
            searchQuery,  // Use searchQuery which prioritizes hint over field.prompt
            { parent: typeName, parentData: data, parentId },
            schema
          )

          // Resolve any pending nested relations
          const relatedEntity = schema.entities.get(field.relatedType!)
          if (relatedEntity) {
            const resolvedGenerated = await resolveNestedPending(generated, relatedEntity, schema, provider)
            const created = await provider.create(field.relatedType!, undefined, {
              ...resolvedGenerated,
              $generated: true,
              $generatedBy: parentId,
              $sourceField: fieldName
            })
            resolved[fieldName] = created.$id
            pendingRelations.push({
              fieldName,
              targetType: field.relatedType!,
              targetId: created.$id as string
            })
          }
        }
      }
    }
  }

  return { data: resolved, pendingRelations }
}
