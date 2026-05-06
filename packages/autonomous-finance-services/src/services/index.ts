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

export { treasury, TreasuryDayInputSchema, TreasuryPositionOutputSchema } from './treasury.js'
export type { TreasuryDayInput, TreasuryPositionOutput } from './treasury.js'

export { payroll, PayrollPeriodInputSchema, PayrollRunOutputSchema } from './payroll.js'
export type { PayrollPeriodInput, PayrollRunOutput } from './payroll.js'

export {
  auditPrep,
  AuditPeriodInputSchema,
  AuditBinderOutputSchema,
  SupportingDocTypeSchema,
} from './audit-prep.js'
export type { AuditPeriodInput, AuditBinderOutput, SupportingDocType } from './audit-prep.js'

export {
  expensePolicyEnforcer,
  ExpenseClaimSchema,
  PolicyDecisionSchema,
} from './expense-policy-enforcer.js'
export type { ExpenseClaim, PolicyDecision } from './expense-policy-enforcer.js'
