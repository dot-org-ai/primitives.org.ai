/**
 * Catalog Services exported from `autonomous-revenue`. Per v3 §12, catalog
 * Services are module-evaluated TypeScript that yield a typed
 * `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `leadQualification.invoke(input)`.
 *
 * @packageDocumentation
 */

export { leadQualification, InboundLeadSchema, QualifiedLeadSchema } from './lead-qualification.js'
export type { InboundLead, QualifiedLead } from './lead-qualification.js'
