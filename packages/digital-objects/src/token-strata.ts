/**
 * Token strata — sugar factories for FieldDefinition with stratum classification.
 *
 * Token strata classify how a field mutates and composes, orthogonal to
 * Frame (which classifies the role a Thing plays in an Action).
 *
 * - `Frozen`      set once at creation; never mutates; identity-bearing
 * - `Negotiable`  intentionally null; downstream stage may fill ONCE
 * - `Expression`  free-form mutable content (default; prose, copy, attrs)
 * - `Composition` bandit-eligible variants picked at render-time
 *
 * @example
 * ```ts
 * const Service = defineNoun({
 *   name: 'Service',
 *   schema: {
 *     id:           Frozen('string'),
 *     name:         Frozen('string'),
 *     description:  Expression('string'),
 *     pricingTier:  Composition('string', ['basic', 'pro', 'enterprise']),
 *     industryHint: Negotiable('string'),
 *   },
 * })
 * ```
 */

import type { ExtendedFieldDefinition, PrimitiveType } from './types.js'

/**
 * Type accepted by the sugar factories — a primitive/object/array type
 * literal. Matches `ExtendedFieldDefinition.type`.
 */
export type StratumFieldType = PrimitiveType | 'object' | 'array'

/**
 * Options accepted by the sugar factories. `type` and `stratum` are
 * managed by the factory itself; everything else passes through.
 */
export type StratumOpts = Omit<ExtendedFieldDefinition, 'type' | 'stratum' | 'variants'>

/**
 * `Frozen` — set once at creation; updates throw `TokenStratumViolation`.
 *
 * Identity-bearing fields (id, name, namespace) typically use this.
 */
export const Frozen = <T extends StratumFieldType>(
  type: T,
  opts?: StratumOpts
): ExtendedFieldDefinition => ({
  ...opts,
  type,
  stratum: 'frozen',
})

/**
 * `Negotiable` — intentionally null; one downstream fill is allowed.
 *
 * The first update to a non-null value succeeds; subsequent updates
 * throw `TokenStratumViolation`.
 */
export const Negotiable = <T extends StratumFieldType>(
  type: T,
  opts?: StratumOpts
): ExtendedFieldDefinition => ({
  ...opts,
  type,
  stratum: 'negotiable',
})

/**
 * `Expression` — always mutable. Default stratum when unspecified.
 *
 * Prose, copy, attributes, free-form text — anything where re-writing
 * is the expected workflow.
 */
export const Expression = <T extends StratumFieldType>(
  type: T,
  opts?: StratumOpts
): ExtendedFieldDefinition => ({
  ...opts,
  type,
  stratum: 'expression',
})

/**
 * `Composition` — bandit-eligible variant set; mutation only via
 * `pickComposition(thingRef, fieldName, variantIdx)`.
 *
 * Direct assignment in `update()` throws `TokenStratumViolation`. The
 * `variants` array is required and carries the selectable values.
 */
export const Composition = <T extends StratumFieldType>(
  type: T,
  variants: unknown[],
  opts?: StratumOpts
): ExtendedFieldDefinition => ({
  ...opts,
  type,
  stratum: 'composition',
  variants,
})
