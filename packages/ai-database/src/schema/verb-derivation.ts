/**
 * Verb Derivation for Backward Cascade Resolution
 *
 * Derives reverse verbs for backward relationships:
 * - manages -> managedBy
 * - owns -> ownedBy
 * - creates -> createdBy
 * - parent_of <-> child_of (bidirectional)
 *
 * Used by the cascade resolver to determine the reverse relationship
 * when traversing relationships in the opposite direction.
 *
 * @example
 * ```ts
 * import { deriveReverseVerb, fieldNameToVerb, isPassiveVerb } from './verb-derivation.js'
 *
 * deriveReverseVerb('manages')     // 'managedBy'
 * deriveReverseVerb('parent_of')   // 'child_of'
 * deriveReverseVerb('managedBy')   // 'manages'
 *
 * fieldNameToVerb('manager')       // 'manages'
 * fieldNameToVerb('owner')         // 'owns'
 *
 * isPassiveVerb('managedBy')       // true
 * isPassiveVerb('manages')         // false
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Forward to Reverse Verb Mapping
// =============================================================================

/**
 * Mutable copy for runtime registration of custom verb pairs.
 * Initialized from INITIAL_FORWARD_TO_REVERSE.
 */
const _forwardToReverse: Record<string, string> = {
  manages: 'managedBy',
  owns: 'ownedBy',
  creates: 'createdBy',
  reviews: 'reviewedBy',
  employs: 'employedBy',
  contains: 'containedBy',
  assigns: 'assignedBy',
}

/**
 * Mutable copy for runtime registration of reverse to forward mappings.
 */
const _reverseToForward: Record<string, string> = {
  managedBy: 'manages',
  ownedBy: 'owns',
  createdBy: 'creates',
  reviewedBy: 'reviews',
  employedBy: 'employs',
  containedBy: 'contains',
  assignedBy: 'assigns',
}

/**
 * Forward verbs to their reverse forms.
 * Common active verbs mapped to their passive counterparts.
 *
 * @example
 * ```ts
 * FORWARD_TO_REVERSE.manages   // 'managedBy'
 * FORWARD_TO_REVERSE.owns      // 'ownedBy'
 * FORWARD_TO_REVERSE.creates   // 'createdBy'
 * ```
 */
export const FORWARD_TO_REVERSE: Readonly<Record<string, string>> = _forwardToReverse

// =============================================================================
// Bidirectional Pairs
// =============================================================================

/**
 * Mutable copy for runtime registration of bidirectional pairs.
 */
const _bidirectionalPairs: Record<string, string> = {
  parent_of: 'child_of',
  child_of: 'parent_of',
}

/**
 * Known verb pairs for bidirectional relationships.
 * These are symmetric - each maps to the other.
 *
 * @example
 * ```ts
 * BIDIRECTIONAL_PAIRS.parent_of  // 'child_of'
 * BIDIRECTIONAL_PAIRS.child_of   // 'parent_of'
 * ```
 */
export const BIDIRECTIONAL_PAIRS: Readonly<Record<string, string>> = _bidirectionalPairs

// =============================================================================
// Field Name to Verb Mapping
// =============================================================================

/**
 * Mutable copy for runtime registration of field to verb mappings.
 */
const _fieldToVerb: Record<string, string> = {
  manager: 'manages',
  owner: 'owns',
  creator: 'creates',
  reviewer: 'reviews',
  employer: 'employs',
  parent: 'parent_of',
  child: 'child_of',
  assignee: 'assigns',
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Derives the reverse verb for a given forward verb.
 *
 * Resolution order:
 * 1. Check bidirectional pairs first (parent_of <-> child_of)
 * 2. Check known forward verbs (manages -> managedBy)
 * 3. Check if already a reversed verb (managedBy -> manages)
 * 4. Apply standard transformation for verbs ending in 's'
 * 5. Add 'By' suffix for unknown verbs
 *
 * @param verb - The verb to derive the reverse of
 * @returns The reverse verb
 *
 * @example
 * ```ts
 * deriveReverseVerb('manages')        // 'managedBy'
 * deriveReverseVerb('owns')           // 'ownedBy'
 * deriveReverseVerb('parent_of')      // 'child_of'
 * deriveReverseVerb('managedBy')      // 'manages' (already reversed)
 * deriveReverseVerb('customAction')   // 'customActionBy' (unknown verb)
 * ```
 */
export function deriveReverseVerb(verb: string): string {
  // Check bidirectional pairs first
  if (verb in _bidirectionalPairs) {
    return _bidirectionalPairs[verb]!
  }

  // Check known forward verbs
  if (verb in _forwardToReverse) {
    return _forwardToReverse[verb]!
  }

  // Check if this is already a reversed verb (ends with 'By')
  if (verb in _reverseToForward) {
    return _reverseToForward[verb]!
  }

  // Check if verb ends with 'By' - try to find its forward form
  if (verb.endsWith('By')) {
    // Check if there's a known forward form
    const forwardVerb = _reverseToForward[verb]
    if (forwardVerb) {
      return forwardVerb
    }
    // Otherwise just return the base (customActionBy -> customAction)
    return verb.slice(0, -2)
  }

  // Apply standard verb transformation for third person singular verbs
  // (verbs ending in 's' like manages, owns, creates, reviews, employs, contains)
  if (verb.endsWith('s') && verb.length > 2) {
    // Remove trailing 's' to get base form, then add 'edBy'
    // manages -> manage -> managedBy
    // owns -> own -> ownedBy
    // creates -> create -> createdBy
    const base = verb.slice(0, -1)
    return base + 'dBy'
  }

  // For other verbs, just add 'By' suffix
  return verb + 'By'
}

/**
 * Derives a verb from a field name.
 *
 * Common field names like "manager", "owner", "creator" are mapped
 * to their corresponding verbs. Unknown field names are returned as-is.
 *
 * @param fieldName - The field name to derive a verb from
 * @returns The derived verb or the field name if no mapping exists
 *
 * @example
 * ```ts
 * fieldNameToVerb('manager')     // 'manages'
 * fieldNameToVerb('owner')       // 'owns'
 * fieldNameToVerb('creator')     // 'creates'
 * fieldNameToVerb('customField') // 'customField' (no mapping)
 * ```
 */
export function fieldNameToVerb(fieldName: string): string {
  return _fieldToVerb[fieldName] ?? fieldName
}

/**
 * Checks if a verb is in passive form.
 *
 * A verb is considered passive if it ends with:
 * - 'By' (managedBy, ownedBy, createdBy)
 * - 'To' (relatedTo, linkedTo, connectedTo)
 * - 'Of' (parent_of, child_of, partOf)
 *
 * @param verb - The verb to check
 * @returns True if the verb is passive, false otherwise
 *
 * @example
 * ```ts
 * isPassiveVerb('managedBy')   // true
 * isPassiveVerb('relatedTo')   // true
 * isPassiveVerb('parent_of')   // true
 * isPassiveVerb('manages')     // false
 * ```
 */
export function isPassiveVerb(verb: string): boolean {
  if (verb.length === 0) {
    return false
  }

  // Check for common passive suffixes
  return (
    verb.endsWith('By') ||
    verb.endsWith('To') ||
    verb.endsWith('Of') ||
    verb.endsWith('_of')
  )
}

// =============================================================================
// Extensibility Functions
// =============================================================================

/**
 * Register a custom verb pair for forward/reverse derivation.
 *
 * This allows extending the verb derivation system with domain-specific
 * verb mappings at runtime.
 *
 * @param forward - The forward (active) verb
 * @param reverse - The reverse (passive) verb
 *
 * @example
 * ```ts
 * registerVerbPair('sponsors', 'sponsoredBy')
 * deriveReverseVerb('sponsors')     // 'sponsoredBy'
 * deriveReverseVerb('sponsoredBy')  // 'sponsors'
 * ```
 */
export function registerVerbPair(forward: string, reverse: string): void {
  _forwardToReverse[forward] = reverse
  _reverseToForward[reverse] = forward
}

/**
 * Register a bidirectional verb pair.
 *
 * Bidirectional pairs are symmetric relationships where each verb
 * maps to the other. For self-referential relationships, both
 * arguments can be the same verb.
 *
 * @param verbA - The first verb
 * @param verbB - The second verb (can be same as verbA for symmetric)
 *
 * @example
 * ```ts
 * // Asymmetric bidirectional
 * registerBidirectionalPair('mentor_of', 'mentee_of')
 * deriveReverseVerb('mentor_of')  // 'mentee_of'
 * deriveReverseVerb('mentee_of')  // 'mentor_of'
 *
 * // Symmetric (self-referential)
 * registerBidirectionalPair('relatedTo', 'relatedTo')
 * deriveReverseVerb('relatedTo')  // 'relatedTo'
 * ```
 */
export function registerBidirectionalPair(verbA: string, verbB: string): void {
  _bidirectionalPairs[verbA] = verbB
  _bidirectionalPairs[verbB] = verbA
}

/**
 * Register a field name to verb mapping.
 *
 * @param fieldName - The field name
 * @param verb - The verb it derives to
 *
 * @example
 * ```ts
 * registerFieldVerb('coordinator', 'coordinates')
 * fieldNameToVerb('coordinator')  // 'coordinates'
 * ```
 */
export function registerFieldVerb(fieldName: string, verb: string): void {
  _fieldToVerb[fieldName] = verb
}
