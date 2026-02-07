/**
 * Noun() — The Digital Objects factory function
 *
 * Creates a typed, event-sourced entity with CRUD + custom verbs.
 *
 * @example
 * const Contact = Noun('Contact', {
 *   name: 'string!',
 *   email: 'string?#',
 *   stage: 'Lead | Qualified | Customer | Churned | Partner',
 *   company: '-> Company.contacts',
 *   deals: '<- Deal.contact[]',
 *   qualify: 'Qualified',
 * })
 *
 * await Contact.create({ name: 'Alice', stage: 'Lead' })
 * Contact.qualified(contact => { ... })
 */

import type { NounDefinitionInput, NounSchema } from './noun-types.js'
import { deriveNoun } from './linguistic.js'
import { parseNounDefinition } from './noun-parse.js'
import { buildVerbMap } from './noun-verbs.js'
import { registerNoun } from './noun-registry.js'
import { createNounProxy } from './noun-proxy.js'

/**
 * Define a Digital Object entity
 *
 * @param name - PascalCase entity name (e.g., 'Contact', 'Deal', 'Subscription')
 * @param definition - Property definitions using string patterns
 * @returns A Proxy with CRUD methods, custom verbs, and event hooks
 */
export function Noun<T extends NounDefinitionInput>(
  name: string,
  definition: T,
): Record<string, unknown> {
  // Derive linguistic forms
  const derived = deriveNoun(name)

  // Parse property definitions
  const { fields, relationships, verbDeclarations, disabled } = parseNounDefinition(definition)

  // Build schema
  const schema: NounSchema = {
    name,
    singular: derived.singular,
    plural: derived.plural,
    slug: derived.slug,
    fields,
    relationships,
    verbs: new Map(),
    disabledVerbs: new Set(),
    raw: definition,
  }

  // Build verb map (CRUD + custom verbs)
  buildVerbMap(schema, definition, verbDeclarations, disabled)

  // Register in global registry
  registerNoun(schema)

  // Create and return the proxy
  return createNounProxy(schema)
}
