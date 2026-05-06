/**
 * OutputContract — the *technical* schema contract on a Service.
 *
 * Distinct from `OutcomeContract` (lives in `autonomous-finance`), which
 * captures the *definition-of-done* predicate that releases escrow. v3 §11
 * locks the separation:
 *
 * | Concept            | Package              | Question it answers           |
 * | ------------------ | -------------------- | ----------------------------- |
 * | `OutputContract`   | services-as-software | "What shape is the result?"   |
 * | `OutcomeContract`  | autonomous-finance   | "When did the buyer get paid?"|
 *
 * The OutputContract carries the input/output {@link Schema}s, the data
 * {@link SensitivityTier}, optional UI hints, and (optionally) example
 * payloads the catalog can render.
 *
 * @packageDocumentation
 */

import type { Schema, SensitivityTier } from './types.js'

// ============================================================================
// Field-level UI hints
// ============================================================================

/**
 * Rendering hint for an individual schema field. Consumed by the
 * customer-runtime UI so an `OrderShape` can be auto-derived from the
 * `OutputContract.input` schema without a separate definition.
 *
 * Kept loose — a richer `FieldUIHint` set ships with the dedicated UI shapes
 * agent later; this is enough to drive an MVP order form.
 */
export interface FieldUIHint {
  /**
   * Form control to render. Common values: `'text' | 'textarea' | 'select' |
   * 'number' | 'checkbox' | 'date' | 'file' | 'json'`. Kept open so the
   * shapes layer can introduce new controls without a type change here.
   */
  control?: string
  /** Display label; defaults to a humanised field name. */
  label?: string
  /** Placeholder text on input controls. */
  placeholder?: string
  /** Help text rendered below the control. */
  helpText?: string
  /** Whether a textarea control should render multi-line. */
  multiline?: boolean
}

// ============================================================================
// SchemaWithUI
// ============================================================================

/**
 * A {@link Schema} paired with optional UI hints + example payloads.
 *
 * The schema is the source of truth for validation; `uiHints` and `examples`
 * are pure presentation/documentation and never mutate the validated value.
 */
export interface SchemaWithUI<T> {
  schema: Schema<T>
  /** Per-field UI hints keyed by JSON-pointer-style field path (`'/name'`). */
  uiHints?: Record<string, FieldUIHint>
  /** Example values rendered in catalog UI; must validate against `schema`. */
  examples?: T[]
}

// ============================================================================
// OutputContract
// ============================================================================

/**
 * Technical input/output contract for a Service. v3 §11 separates this from
 * the `OutcomeContract` (definition-of-done predicate; lives in
 * `autonomous-finance`).
 *
 * `sensitivityTier` is mandatory — every Service must classify its data so
 * default tenant isolation, retention, and routing policy apply correctly.
 */
export interface OutputContract<TIn, TOut> {
  input: SchemaWithUI<TIn>
  output: SchemaWithUI<TOut>
  sensitivityTier: SensitivityTier
}
