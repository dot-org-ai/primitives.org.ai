/**
 * Catalog Services exported from `autonomous-finance`. Per v3 §12, catalog
 * Services are module-evaluated TypeScript that yield a typed
 * `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `bookkeeper.invoke(input)`.
 *
 * @packageDocumentation
 */

export { bookkeeper, TxIngestSchema, ClosedBooksSchema } from './bookkeeper.js'
export type { TxIngest, ClosedBooks } from './bookkeeper.js'

export {
  controller,
  ReviewedBooksInputSchema,
  AttestedStatementsOutputSchema,
} from './controller.js'
export type { ReviewedBooksInput, AttestedStatementsOutput } from './controller.js'

export { ap, InvoiceIntakeSchema, PaidInvoiceOutputSchema } from './ap.js'
export type { InvoiceIntake, PaidInvoiceOutput } from './ap.js'

export { ar, ARInvoiceSchema, CollectedARSchema } from './ar.js'
export type { ARInvoice, CollectedAR } from './ar.js'

export { tax, TaxPeriodSchema, FiledReturnSchema } from './tax.js'
export type { TaxPeriod, FiledReturn } from './tax.js'
