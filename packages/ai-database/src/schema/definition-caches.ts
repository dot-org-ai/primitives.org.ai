/**
 * Definition Caches
 *
 * Provides caching for noun and verb definitions derived from the schema.
 * These caches are used by the Nouns and Verbs APIs.
 */

import type { ParsedSchema, Noun, Verb } from '../types.js'
import { Verbs } from '../types.js'
import { inferNoun } from '../linguistic.js'

/**
 * Result of building definition caches
 */
export interface DefinitionCaches {
  /** Map of entity name to Noun definition */
  nounDefinitions: Map<string, Noun>
  /** Map of verb action to Verb definition */
  verbDefinitions: Map<string, Verb>
}

/**
 * Build noun and verb definition caches from a parsed schema
 *
 * @param parsedSchema - The parsed database schema
 * @returns Caches for noun and verb definitions
 */
export function buildDefinitionCaches(parsedSchema: ParsedSchema): DefinitionCaches {
  // Noun definitions cache - inferred from schema entity names
  const nounDefinitions = new Map<string, Noun>()
  for (const [entityName] of parsedSchema.entities) {
    const noun = inferNoun(entityName)
    nounDefinitions.set(entityName, noun)
  }

  // Verb definitions cache - populated from standard Verbs
  const verbDefinitions = new Map<string, Verb>(Object.entries(Verbs).map(([k, v]) => [k, v]))

  return { nounDefinitions, verbDefinitions }
}
