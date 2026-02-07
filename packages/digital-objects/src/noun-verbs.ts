/**
 * Verb conjugation system for Noun()
 *
 * Default CRUD verbs: create, update, delete (auto-added unless null)
 * Read verbs: get, find (always present, not event-sourced)
 * Custom verbs: detected from PascalCase values, conjugated via deriveVerb()
 */

import type { NounSchema, VerbConjugation, ParsedProperty, NounDefinitionInput } from './noun-types.js'
import { deriveVerb } from './linguistic.js'

/**
 * Default CRUD verb names that are automatically added to every Noun
 * unless explicitly disabled with null
 */
const DEFAULT_CRUD_VERBS = ['create', 'update', 'delete'] as const

/**
 * Build a VerbConjugation from a base verb name using deriveVerb()
 */
function conjugate(action: string): VerbConjugation {
  const derived = deriveVerb(action)
  return {
    action: derived.action,
    activity: derived.activity,
    event: derived.event,
    reverseBy: derived.reverseBy,
    reverseAt: derived.reverseAt,
  }
}

/**
 * Build the complete verb map for a NounSchema
 *
 * 1. Add default CRUD verbs (create, update, delete)
 * 2. Remove disabled verbs (definition value = null)
 * 3. Add custom verbs from verb declarations
 */
export function buildVerbMap(
  schema: NounSchema,
  _definition: NounDefinitionInput,
  verbDeclarations: Map<string, ParsedProperty>,
  disabled: Set<string>,
): void {
  // Add default CRUD verbs
  for (const verb of DEFAULT_CRUD_VERBS) {
    if (!disabled.has(verb)) {
      schema.verbs.set(verb, conjugate(verb))
    }
  }

  // Record disabled verbs
  for (const verb of disabled) {
    schema.disabledVerbs.add(verb)
  }

  // Add custom verbs from declarations
  for (const [key, _prop] of verbDeclarations) {
    schema.verbs.set(key, conjugate(key))
  }
}
