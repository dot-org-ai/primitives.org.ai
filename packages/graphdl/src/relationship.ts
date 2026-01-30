/**
 * Relationship Operator Parsing
 *
 * Provides parseOperator() for extracting relationship semantics from field definitions.
 *
 * @packageDocumentation
 */

import type { ParsedRelationship, RelationshipOperator } from './types.js'

// =============================================================================
// Operator Semantics
// =============================================================================

/**
 * Relationship operator semantics
 *
 * | Operator | Direction | Match Mode | Use Case |
 * |----------|-----------|------------|----------|
 * | `->` | forward | exact | Foreign key reference |
 * | `~>` | forward | fuzzy | AI-matched semantic reference |
 * | `<-` | backward | exact | Backlink/parent reference |
 * | `<~` | backward | fuzzy | AI-matched backlink |
 */
export const OPERATOR_SEMANTICS: Record<
  RelationshipOperator,
  { direction: 'forward' | 'backward'; matchMode: 'exact' | 'fuzzy' }
> = {
  '->': { direction: 'forward', matchMode: 'exact' },
  '~>': { direction: 'forward', matchMode: 'fuzzy' },
  '<-': { direction: 'backward', matchMode: 'exact' },
  '<~': { direction: 'backward', matchMode: 'fuzzy' },
}

/**
 * All supported relationship operators (in order of specificity for parsing)
 */
export const OPERATORS: readonly RelationshipOperator[] = ['~>', '<~', '->', '<-']

// =============================================================================
// Parse Operator
// =============================================================================

/**
 * Parse relationship operator from field definition
 *
 * Extracts operator semantics from a field definition string. Supports
 * four relationship operators with different semantics.
 *
 * ## Supported Formats
 *
 * - `'->Type'`           - Forward exact reference to Type
 * - `'~>Type'`           - Forward fuzzy (semantic search) to Type
 * - `'<-Type'`           - Backward exact reference from Type
 * - `'<~Type'`           - Backward fuzzy reference from Type
 * - `'Prompt text ->Type'` - With generation prompt (text before operator)
 * - `'->TypeA|TypeB'`    - Union types (polymorphic reference)
 * - `'->Type.backref'`   - With explicit backref field name
 * - `'->Type?'`          - Optional reference
 * - `'->Type[]'`         - Array of references
 * - `'~>Type(0.8)'`      - Fuzzy with threshold
 *
 * @param definition - The field definition string to parse
 * @returns Parsed relationship, or null if no operator found
 *
 * @example Basic usage
 * ```ts
 * parseOperator('->Author')
 * // => { operator: '->', direction: 'forward', matchMode: 'exact', targetType: 'Author' }
 *
 * parseOperator('~>Category')
 * // => { operator: '~>', direction: 'forward', matchMode: 'fuzzy', targetType: 'Category' }
 *
 * parseOperator('<-Post')
 * // => { operator: '<-', direction: 'backward', matchMode: 'exact', targetType: 'Post' }
 * ```
 *
 * @example With prompt
 * ```ts
 * parseOperator('What is the main category? ~>Category')
 * // => {
 * //   prompt: 'What is the main category?',
 * //   operator: '~>',
 * //   direction: 'forward',
 * //   matchMode: 'fuzzy',
 * //   targetType: 'Category'
 * // }
 * ```
 *
 * @example Union types
 * ```ts
 * parseOperator('->Person|Company|Organization')
 * // => {
 * //   operator: '->',
 * //   direction: 'forward',
 * //   matchMode: 'exact',
 * //   targetType: 'Person',
 * //   unionTypes: ['Person', 'Company', 'Organization']
 * // }
 * ```
 *
 * @example With backref
 * ```ts
 * parseOperator('->User.posts')
 * // => {
 * //   operator: '->',
 * //   direction: 'forward',
 * //   matchMode: 'exact',
 * //   targetType: 'User',
 * //   backref: 'posts'
 * // }
 * ```
 *
 * @example With threshold
 * ```ts
 * parseOperator('~>Category(0.8)')
 * // => {
 * //   operator: '~>',
 * //   direction: 'forward',
 * //   matchMode: 'fuzzy',
 * //   targetType: 'Category',
 * //   threshold: 0.8
 * // }
 * ```
 */
export function parseOperator(definition: string): ParsedRelationship | null {
  // Handle empty or whitespace-only input
  if (!definition || !definition.trim()) {
    return null
  }

  for (const op of OPERATORS) {
    const opIndex = definition.indexOf(op)
    if (opIndex !== -1) {
      // Extract prompt (text before operator)
      const beforeOp = definition.slice(0, opIndex).trim()
      const prompt = beforeOp || undefined

      // Extract target type (text after operator)
      let targetType = definition.slice(opIndex + op.length).trim()

      // Get direction and match mode from operator semantics
      const { direction, matchMode } = OPERATOR_SEMANTICS[op]

      // Parse field-level threshold from ~>Type(0.9) syntax
      let threshold: number | undefined
      const thresholdMatch = targetType.match(/^([^(]+)\(([0-9.]+)\)(.*)$/)
      if (thresholdMatch) {
        const [, typePart, thresholdStr, suffix] = thresholdMatch
        threshold = parseFloat(thresholdStr!)
        if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
          // Reconstruct targetType without the threshold
          targetType = (typePart ?? '') + (suffix ?? '')
        } else {
          threshold = undefined
        }
      } else {
        // Handle malformed threshold syntax (missing closing paren)
        const malformedThresholdMatch = targetType.match(/^([A-Za-z][A-Za-z0-9_]*)\([^)]*$/)
        if (malformedThresholdMatch) {
          // Strip the malformed threshold part, keep just the type name
          targetType = malformedThresholdMatch[1]!
          // threshold stays undefined
        }
      }

      // Parse modifiers: ?, [], !, #
      // Modifiers can appear in any order at the end of the type
      let isOptional = false
      let isArray = false
      let isRequired = false
      let isUnique = false
      let isIndexed = false

      // Parse modifiers from the end, handling any order
      let parsing = true
      while (parsing) {
        if (targetType.endsWith('#')) {
          isIndexed = true
          targetType = targetType.slice(0, -1)
        } else if (targetType.endsWith('!')) {
          isRequired = true
          isUnique = true
          targetType = targetType.slice(0, -1)
        } else if (targetType.endsWith('?')) {
          isOptional = true
          targetType = targetType.slice(0, -1)
        } else if (targetType.endsWith('[]')) {
          isArray = true
          targetType = targetType.slice(0, -2)
        } else {
          parsing = false
        }
      }

      // Parse backref syntax (Type.field)
      let backref: string | undefined
      const dotIndex = targetType.indexOf('.')
      if (dotIndex !== -1) {
        backref = targetType.slice(dotIndex + 1)
        targetType = targetType.slice(0, dotIndex)
      }

      // Parse union types (A|B|C syntax)
      let unionTypes: string[] | undefined
      if (targetType.includes('|')) {
        unionTypes = targetType
          .split('|')
          .map((t) => t.trim())
          .filter(Boolean)
        // The primary targetType is the first union type
        targetType = unionTypes[0]!
      }

      const result: ParsedRelationship = {
        operator: op,
        direction,
        matchMode,
        targetType,
      }
      if (prompt !== undefined) result.prompt = prompt
      if (backref !== undefined) result.backref = backref
      if (isArray) result.isArray = true
      if (isOptional) result.isOptional = true
      if (isRequired) result.isRequired = true
      if (isUnique) result.isUnique = true
      if (isIndexed) result.isIndexed = true
      if (unionTypes !== undefined && unionTypes.length > 1) result.unionTypes = unionTypes
      if (threshold !== undefined) result.threshold = threshold
      return result
    }
  }

  return null
}

/**
 * Check if a string contains a relationship operator
 */
export function hasOperator(definition: string): boolean {
  return OPERATORS.some((op) => definition.includes(op))
}

/**
 * Get the operator from a definition, if present
 */
export function getOperator(definition: string): RelationshipOperator | null {
  for (const op of OPERATORS) {
    if (definition.includes(op)) {
      return op
    }
  }
  return null
}

/**
 * Check if an operator is forward-direction
 */
export function isForwardOperator(op: RelationshipOperator): boolean {
  return op === '->' || op === '~>'
}

/**
 * Check if an operator is backward-direction
 */
export function isBackwardOperator(op: RelationshipOperator): boolean {
  return op === '<-' || op === '<~'
}

/**
 * Check if an operator is fuzzy-match
 */
export function isFuzzyOperator(op: RelationshipOperator): boolean {
  return op === '~>' || op === '<~'
}

/**
 * Check if an operator is exact-match
 */
export function isExactOperator(op: RelationshipOperator): boolean {
  return op === '->' || op === '<-'
}
