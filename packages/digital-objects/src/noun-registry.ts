/**
 * Global noun registry
 *
 * Every Noun() call registers its schema here.
 * Used by the SDK to enumerate entities and by providers to initialize.
 */

import type { NounSchema } from './noun-types.js'

const registry = new Map<string, NounSchema>()

/**
 * Register a noun schema in the global registry
 */
export function registerNoun(schema: NounSchema): void {
  registry.set(schema.name, schema)
}

/**
 * Get a noun schema by name
 */
export function getNounSchema(name: string): NounSchema | undefined {
  return registry.get(name)
}

/**
 * Get all registered noun schemas
 */
export function getAllNouns(): Map<string, NounSchema> {
  return registry
}

/**
 * Clear the registry (for testing)
 */
export function clearRegistry(): void {
  registry.clear()
}
