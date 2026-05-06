/**
 * Foundation scalar types for the v3 Service primitive (per design v3 §5).
 *
 * This module is the single source of truth for the small primitive type
 * vocabulary the rest of the v3 layer composes against (`Audience`,
 * `SensitivityTier`, `Schema`, `InferOutput`, `ServiceRef`,
 * `EvaluatorPanelRef`).
 *
 * Schemas use the `@standard-schema/spec` interop type so any Standard
 * Schema-compatible validator (Zod, Valibot, ArkType, Effect Schema, …)
 * works as a {@link Schema} without an adapter.
 *
 * @packageDocumentation
 */

import type { StandardSchemaV1 } from '@standard-schema/spec'

// ============================================================================
// Audience
// ============================================================================

/**
 * Who a Service is delivered to. v3 §5 keeps this loose and orthogonal to
 * delivery mechanics; a single Service may serve multiple audiences.
 *
 * - `human`    — end-user-facing; UI shapes derive a customer-runtime view.
 * - `business` — buyer is an organisation (procurement, billing-on-account).
 * - `agent`    — caller is another autonomous Service / Worker / agent.
 */
export type Audience = 'human' | 'business' | 'agent'

// ============================================================================
// Sensitivity tier
// ============================================================================

/**
 * Data-handling tier on a Service's input/output payload. Drives default
 * tenant isolation, retention, and routing policy. v3 §11 keeps this as the
 * coarse-grained classification carried on `OutputContract`; finer-grained
 * field-level marks (PHI, secrets, …) come from the schema vendor.
 *
 * Tiers are ordered by sensitivity (`public` < `internal` < `identified` <
 * `PII` < `regulated`); the runtime treats each higher tier as a strict
 * superset of the lower ones for policy purposes.
 */
export type SensitivityTier = 'public' | 'internal' | 'identified' | 'PII' | 'regulated'

// ============================================================================
// Schema interop
// ============================================================================

/**
 * Standard-Schema-compatible validator for a typed value `T`.
 *
 * Aliased so v3 surface code reads `Schema<T>` rather than the verbose
 * `StandardSchemaV1<unknown, T>`. Use any vendor that implements the spec
 * (Zod 3.24+, Valibot, ArkType, Effect Schema, …).
 */
export type Schema<T> = StandardSchemaV1<unknown, T>

/**
 * Helper: extract the validated output type from a {@link Schema}.
 *
 * @example
 * ```ts
 * const userSchema = z.object({ id: z.string() })
 * type User = InferOutput<typeof userSchema>  // { id: string }
 * ```
 */
export type InferOutput<S> = S extends StandardSchemaV1<infer _I, infer O> ? O : never

// ============================================================================
// Branded refs
// ============================================================================

/**
 * Opaque reference to a Service definition (typically its MDXLD `$id`).
 *
 * Branded with a phantom `__brand` so consumers can't pass arbitrary strings
 * where a Service-shaped reference is required, while still allowing
 * lightweight literal usage (`'svc:claude-code' as ServiceRef`).
 */
export type ServiceRef = string & { __brand?: 'ServiceRef' }

/**
 * Opaque reference to an EvaluatorPanel definition.
 *
 * The EvaluatorPanel value type itself is the next agent's deliverable; this
 * ref already exists so the `OutcomeContract.predicate` (and downstream
 * proof-predicate logic) can resolve panels by id without a circular
 * dependency.
 */
export type EvaluatorPanelRef = string & { __brand?: 'EvaluatorPanelRef' }
