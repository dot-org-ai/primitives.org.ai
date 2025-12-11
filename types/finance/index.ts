/**
 * Finance & Accounting Types
 *
 * Comprehensive financial management types for:
 * - Chart of accounts and ledgers
 * - Transactions and journal entries
 * - Invoicing and billing
 * - Banking and reconciliation
 * - Budgeting and forecasting
 * - Tax management
 * - Payroll
 * - Financial reporting
 * - Fixed assets and depreciation
 *
 * @module finance
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// =============================================================================
// Account - Chart of Accounts Entry
// =============================================================================

/**
 * Account type in the chart of accounts.
 */
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

/**
 * Account subtype for more granular classification.
 */
export type AccountSubtype =
  // Asset subtypes
  | 'current_asset'
  | 'fixed_asset'
  | 'other_asset'
  | 'bank'
  | 'accounts_receivable'
  | 'inventory'
  // Liability subtypes
  | 'current_liability'
  | 'long_term_liability'
  | 'accounts_payable'
  | 'credit_card'
  | 'loan'
  // Equity subtypes
  | 'owners_equity'
  | 'retained_earnings'
  | 'paid_in_capital'
  // Revenue subtypes
  | 'operating_revenue'
  | 'non_operating_revenue'
  | 'other_income'
  // Expense subtypes
  | 'operating_expense'
  | 'cost_of_goods_sold'
  | 'depreciation'
  | 'other_expense'

/**
 * Account status.
 */
export type AccountStatus = 'active' | 'inactive' | 'archived'

/**
 * Chart of accounts entry representing a financial account.
 *
 * Accounts form the foundation of double-entry bookkeeping,
 * categorizing all financial transactions by type (asset,
 * liability, equity, revenue, expense).
 *
 * @example
 * ```ts
 * const cashAccount: Account = {
 *   id: 'acc_cash_001',
 *   code: '1000',
 *   name: 'Cash',
 *   type: 'asset',
 *   subtype: 'bank',
 *   status: 'active',
 *   description: 'Primary operating cash account',
 *   currency: 'USD',
 *   balance: 50000.00,
 *   normalBalance: 'debit',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Account {
  /** Unique identifier */
  id: string

  /** Account code/number */
  code: string

  /** Account name */
  name: string

  /** Account type */
  type: AccountType

  /** Account subtype */
  subtype?: AccountSubtype

  /** Current status */
  status: AccountStatus

  /** Description */
  description?: string

  /** Currency code */
  currency: string

  /** Current balance */
  balance?: number

  /** Normal balance type (debit or credit) */
  normalBalance: 'debit' | 'credit'

  /** Parent account ID for hierarchical accounts */
  parentId?: string

  /** Whether this account has sub-accounts */
  hasChildren?: boolean

  /** Tax form line mapping */
  taxLine?: {
    form: string
    line: string
  }

  /** Bank account ID if linked */
  bankAccountId?: string

  /** Opening balance */
  openingBalance?: number

  /** Opening balance date */
  openingBalanceDate?: Date

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    quickbooks?: string
    xero?: string
    netsuite?: string
    sage?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AccountInput = Input<Account>
export type AccountOutput = Output<Account>

// =============================================================================
// Transaction - Financial Transaction
// =============================================================================

/**
 * Transaction type.
 */
export type TransactionType =
  | 'journal'
  | 'payment'
  | 'invoice'
  | 'bill'
  | 'expense'
  | 'transfer'
  | 'deposit'
  | 'withdrawal'
  | 'adjustment'

/**
 * Transaction status.
 */
export type TransactionStatus = 'draft' | 'pending' | 'posted' | 'voided' | 'reconciled'

/**
 * Financial transaction with double-entry bookkeeping.
 *
 * Transactions record the movement of money between accounts,
 * maintaining the accounting equation (Assets = Liabilities + Equity).
 * Each transaction must balance (debits = credits).
 *
 * @example
 * ```ts
 * const paymentTransaction: Transaction = {
 *   id: 'txn_pay_001',
 *   type: 'payment',
 *   status: 'posted',
 *   date: new Date('2024-01-15'),
 *   description: 'Payment received from customer',
 *   currency: 'USD',
 *   amount: 1000.00,
 *   lines: [
 *     { accountId: 'acc_cash', debit: 1000.00, credit: 0 },
 *     { accountId: 'acc_ar', debit: 0, credit: 1000.00 }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Transaction {
  /** Unique identifier */
  id: string

  /** Transaction type */
  type: TransactionType

  /** Current status */
  status: TransactionStatus

  /** Transaction date */
  date: Date

  /** Description/memo */
  description?: string

  /** Reference number */
  referenceNumber?: string

  /** Currency code */
  currency: string

  /** Total transaction amount */
  amount: number

  /** Transaction lines (debits and credits) */
  lines: TransactionLine[]

  /** Related entity ID (customer, vendor, etc) */
  entityId?: string

  /** Related entity type */
  entityType?: 'customer' | 'vendor' | 'employee' | 'other'

  /** Related document ID (invoice, bill, etc) */
  documentId?: string

  /** Related document type */
  documentType?: string

  /** Journal entry ID if linked */
  journalEntryId?: string

  /** Bank transaction ID if linked */
  bankTransactionId?: string

  /** Reconciliation ID if reconciled */
  reconciliationId?: string

  /** Posted date (when transaction was finalized) */
  postedAt?: Date

  /** Voided date if voided */
  voidedAt?: Date

  /** Void reason */
  voidReason?: string

  /** Attachments */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Tags for categorization */
  tags?: string[]

  /** Department/location */
  department?: string
  location?: string

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    quickbooks?: string
    xero?: string
    netsuite?: string
    sage?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

/**
 * Transaction line item (debit or credit entry).
 */
export interface TransactionLine {
  /** Line ID */
  id?: string

  /** Account ID */
  accountId: string

  /** Debit amount */
  debit: number

  /** Credit amount */
  credit: number

  /** Description/memo for this line */
  description?: string

  /** Tax code */
  taxCode?: string

  /** Tax amount */
  taxAmount?: number

  /** Class/category */
  class?: string

  /** Department */
  department?: string

  /** Location */
  location?: string

  /** Custom fields */
  metadata?: Record<string, unknown>
}

export type TransactionInput = Input<Transaction>
export type TransactionOutput = Output<Transaction>

// =============================================================================
// JournalEntry - Manual Journal Entry
// =============================================================================

/**
 * Journal entry status.
 */
export type JournalEntryStatus = 'draft' | 'posted' | 'approved' | 'reversed'

/**
 * Manual journal entry with line items.
 *
 * Journal entries are manual adjustments to the general ledger,
 * used for accruals, deferrals, corrections, and other
 * accounting adjustments.
 *
 * @example
 * ```ts
 * const accrualEntry: JournalEntry = {
 *   id: 'je_001',
 *   number: 'JE-2024-001',
 *   status: 'posted',
 *   date: new Date('2024-01-31'),
 *   description: 'Accrue January rent',
 *   lines: [
 *     { accountId: 'acc_rent_exp', debit: 5000, credit: 0 },
 *     { accountId: 'acc_accrued_exp', debit: 0, credit: 5000 }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface JournalEntry {
  /** Unique identifier */
  id: string

  /** Journal entry number */
  number: string

  /** Current status */
  status: JournalEntryStatus

  /** Entry date */
  date: Date

  /** Description/memo */
  description?: string

  /** Journal entry lines */
  lines: JournalEntryLine[]

  /** Total debits (must equal total credits) */
  totalDebits?: number

  /** Total credits (must equal total debits) */
  totalCredits?: number

  /** Currency */
  currency: string

  /** Is this a reversing entry? */
  isReversing?: boolean

  /** Reversal date if reversing */
  reversalDate?: Date

  /** Original entry ID if this is a reversal */
  reversesEntryId?: string

  /** Reversed by entry ID if reversed */
  reversedByEntryId?: string

  /** Posted date */
  postedAt?: Date

  /** Posted by user ID */
  postedBy?: string

  /** Approved date */
  approvedAt?: Date

  /** Approved by user ID */
  approvedBy?: string

  /** Attachments */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    quickbooks?: string
    xero?: string
    netsuite?: string
    sage?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

/**
 * Journal entry line item.
 */
export interface JournalEntryLine {
  /** Line ID */
  id?: string

  /** Account ID */
  accountId: string

  /** Debit amount */
  debit: number

  /** Credit amount */
  credit: number

  /** Description for this line */
  description?: string

  /** Entity reference */
  entity?: {
    id: string
    type: 'customer' | 'vendor' | 'employee' | 'other'
  }

  /** Department */
  department?: string

  /** Location */
  location?: string

  /** Class */
  class?: string

  /** Custom fields */
  metadata?: Record<string, unknown>
}

export type JournalEntryInput = Input<JournalEntry>
export type JournalEntryOutput = Output<JournalEntry>

// =============================================================================
// Invoice - Accounts Receivable Invoice
// =============================================================================

/**
 * Invoice status.
 */
export type InvoiceStatus =
  | 'draft'
  | 'pending'
  | 'sent'
  | 'viewed'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'void'
  | 'uncollectible'

/**
 * Customer invoice for accounts receivable.
 *
 * Invoices represent amounts owed by customers for goods
 * or services provided. They create a debit to accounts
 * receivable and a credit to revenue.
 *
 * @example
 * ```ts
 * const invoice: Invoice = {
 *   id: 'inv_001',
 *   number: 'INV-2024-001',
 *   status: 'sent',
 *   customerId: 'cust_123',
 *   issueDate: new Date('2024-01-15'),
 *   dueDate: new Date('2024-02-14'),
 *   currency: 'USD',
 *   subtotal: 1000.00,
 *   taxTotal: 80.00,
 *   total: 1080.00,
 *   amountDue: 1080.00,
 *   items: [
 *     { description: 'Consulting Services', quantity: 10, rate: 100, amount: 1000 }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Invoice {
  /** Unique identifier */
  id: string

  /** Invoice number */
  number: string

  /** Current status */
  status: InvoiceStatus

  /** Customer ID */
  customerId: string

  /** Issue date */
  issueDate: Date

  /** Due date */
  dueDate: Date

  /** Payment terms */
  terms?: string

  /** Currency code */
  currency: string

  /** Subtotal (before tax) */
  subtotal: number

  /** Tax total */
  taxTotal: number

  /** Discount amount */
  discountTotal?: number

  /** Total amount */
  total: number

  /** Amount paid */
  amountPaid?: number

  /** Amount due (total - amountPaid) */
  amountDue: number

  /** Invoice line items */
  items: InvoiceItem[]

  /** Tax lines */
  taxes?: Array<{
    name: string
    rate: number
    amount: number
    taxCode?: string
  }>

  /** Customer notes */
  notes?: string

  /** Internal memo */
  memo?: string

  /** Purchase order number */
  poNumber?: string

  /** Project ID */
  projectId?: string

  /** Sent date */
  sentAt?: Date

  /** Viewed date */
  viewedAt?: Date

  /** Paid date */
  paidAt?: Date

  /** Payment method */
  paymentMethod?: string

  /** Payment IDs */
  paymentIds?: string[]

  /** Email addresses sent to */
  emailedTo?: string[]

  /** PDF URL */
  pdfUrl?: string

  /** Public view URL */
  publicUrl?: string

  /** Billing address */
  billingAddress?: Address

  /** Shipping address */
  shippingAddress?: Address

  /** Attachments */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Recurring invoice ID if part of series */
  recurringInvoiceId?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    quickbooks?: string
    xero?: string
    stripe?: string
    chargebee?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

/**
 * Invoice line item.
 */
export interface InvoiceItem {
  /** Item ID */
  id?: string

  /** Description */
  description: string

  /** Quantity */
  quantity: number

  /** Unit price/rate */
  rate: number

  /** Line amount (quantity * rate) */
  amount: number

  /** Product/service ID */
  productId?: string

  /** Tax code */
  taxCode?: string

  /** Tax amount */
  taxAmount?: number

  /** Discount percentage */
  discountPercent?: number

  /** Discount amount */
  discountAmount?: number

  /** Account ID for revenue recognition */
  accountId?: string

  /** Custom fields */
  metadata?: Record<string, unknown>
}

/**
 * Address structure.
 */
export interface Address {
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

export type InvoiceInput = Input<Invoice>
export type InvoiceOutput = Output<Invoice>

// =============================================================================
// Bill - Accounts Payable Bill
// =============================================================================

/**
 * Bill status.
 */
export type BillStatus = 'draft' | 'pending' | 'approved' | 'partial' | 'paid' | 'overdue' | 'void'

/**
 * Vendor bill for accounts payable.
 *
 * Bills represent amounts owed to vendors for goods or
 * services purchased. They create a debit to expense/asset
 * and a credit to accounts payable.
 *
 * @example
 * ```ts
 * const bill: Bill = {
 *   id: 'bill_001',
 *   number: 'BILL-2024-001',
 *   status: 'approved',
 *   vendorId: 'vend_456',
 *   billDate: new Date('2024-01-15'),
 *   dueDate: new Date('2024-02-14'),
 *   currency: 'USD',
 *   subtotal: 500.00,
 *   taxTotal: 40.00,
 *   total: 540.00,
 *   amountDue: 540.00,
 *   items: [
 *     { description: 'Office Supplies', quantity: 1, rate: 500, amount: 500 }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Bill {
  /** Unique identifier */
  id: string

  /** Bill number */
  number: string

  /** Current status */
  status: BillStatus

  /** Vendor ID */
  vendorId: string

  /** Vendor invoice number */
  vendorInvoiceNumber?: string

  /** Bill date */
  billDate: Date

  /** Due date */
  dueDate: Date

  /** Payment terms */
  terms?: string

  /** Currency code */
  currency: string

  /** Subtotal (before tax) */
  subtotal: number

  /** Tax total */
  taxTotal: number

  /** Total amount */
  total: number

  /** Amount paid */
  amountPaid?: number

  /** Amount due (total - amountPaid) */
  amountDue: number

  /** Bill line items */
  items: BillItem[]

  /** Tax lines */
  taxes?: Array<{
    name: string
    rate: number
    amount: number
    taxCode?: string
  }>

  /** Memo */
  memo?: string

  /** Purchase order number */
  poNumber?: string

  /** Project ID */
  projectId?: string

  /** Approved date */
  approvedAt?: Date

  /** Approved by user ID */
  approvedBy?: string

  /** Paid date */
  paidAt?: Date

  /** Payment IDs */
  paymentIds?: string[]

  /** Billing address */
  billingAddress?: Address

  /** Attachments */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    quickbooks?: string
    xero?: string
    netsuite?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

/**
 * Bill line item.
 */
export interface BillItem {
  /** Item ID */
  id?: string

  /** Description */
  description: string

  /** Quantity */
  quantity: number

  /** Unit price/rate */
  rate: number

  /** Line amount (quantity * rate) */
  amount: number

  /** Product/service ID */
  productId?: string

  /** Tax code */
  taxCode?: string

  /** Tax amount */
  taxAmount?: number

  /** Account ID for expense classification */
  accountId?: string

  /** Is billable to customer? */
  billable?: boolean

  /** Customer ID if billable */
  customerId?: string

  /** Custom fields */
  metadata?: Record<string, unknown>
}

export type BillInput = Input<Bill>
export type BillOutput = Output<Bill>

// =============================================================================
// Payment - Incoming/Outgoing Payment
// =============================================================================

/**
 * Payment type.
 */
export type PaymentType = 'receipt' | 'payment' | 'refund' | 'advance'

/**
 * Payment method.
 */
export type PaymentMethod =
  | 'cash'
  | 'check'
  | 'credit_card'
  | 'debit_card'
  | 'bank_transfer'
  | 'wire'
  | 'ach'
  | 'paypal'
  | 'stripe'
  | 'other'

/**
 * Payment status.
 */
export type PaymentStatus = 'draft' | 'pending' | 'processing' | 'completed' | 'failed' | 'void'

/**
 * Payment record for money received or paid.
 *
 * Payments can be customer payments (receipts) or vendor
 * payments. They may be applied to one or more invoices/bills
 * or recorded as unapplied credits.
 *
 * @example
 * ```ts
 * const payment: Payment = {
 *   id: 'pmt_001',
 *   type: 'receipt',
 *   status: 'completed',
 *   paymentMethod: 'bank_transfer',
 *   entityId: 'cust_123',
 *   entityType: 'customer',
 *   amount: 1080.00,
 *   currency: 'USD',
 *   date: new Date('2024-01-20'),
 *   accountId: 'acc_cash',
 *   appliedTo: [
 *     { documentId: 'inv_001', documentType: 'invoice', amount: 1080.00 }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Payment {
  /** Unique identifier */
  id: string

  /** Payment type */
  type: PaymentType

  /** Current status */
  status: PaymentStatus

  /** Payment method */
  paymentMethod: PaymentMethod

  /** Entity ID (customer or vendor) */
  entityId: string

  /** Entity type */
  entityType: 'customer' | 'vendor' | 'employee'

  /** Payment amount */
  amount: number

  /** Currency code */
  currency: string

  /** Payment date */
  date: Date

  /** Deposit to account ID */
  accountId: string

  /** Reference/check number */
  referenceNumber?: string

  /** Documents this payment is applied to */
  appliedTo?: Array<{
    documentId: string
    documentType: 'invoice' | 'bill' | 'credit_note'
    amount: number
  }>

  /** Unapplied amount */
  unappliedAmount?: number

  /** Transaction ID if linked */
  transactionId?: string

  /** Bank transaction ID if linked */
  bankTransactionId?: string

  /** Processing fee */
  processingFee?: number

  /** Exchange rate if multi-currency */
  exchangeRate?: number

  /** Memo */
  memo?: string

  /** Receipt URL */
  receiptUrl?: string

  /** Attachments */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Gateway details */
  gateway?: {
    provider: string
    transactionId: string
    status: string
    metadata?: Record<string, unknown>
  }

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    quickbooks?: string
    xero?: string
    stripe?: string
    paypal?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PaymentInput = Input<Payment>
export type PaymentOutput = Output<Payment>

// =============================================================================
// Receipt - Receipt Record
// =============================================================================

/**
 * Receipt status.
 */
export type ReceiptStatus = 'pending' | 'approved' | 'rejected' | 'archived'

/**
 * Receipt record with attachments.
 *
 * Receipts document expenses and purchases, typically
 * uploaded as images or PDFs for expense tracking and
 * reimbursement.
 *
 * @example
 * ```ts
 * const receipt: Receipt = {
 *   id: 'rcpt_001',
 *   status: 'approved',
 *   date: new Date('2024-01-15'),
 *   merchant: 'Office Depot',
 *   amount: 45.99,
 *   currency: 'USD',
 *   category: 'Office Supplies',
 *   attachments: [
 *     { id: 'att_001', name: 'receipt.jpg', url: 'https://...', type: 'image/jpeg', size: 123456 }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Receipt {
  /** Unique identifier */
  id: string

  /** Current status */
  status: ReceiptStatus

  /** Receipt date */
  date: Date

  /** Merchant/vendor name */
  merchant: string

  /** Total amount */
  amount: number

  /** Currency code */
  currency: string

  /** Expense category */
  category?: string

  /** Payment method */
  paymentMethod?: PaymentMethod

  /** Description */
  description?: string

  /** Employee ID if employee expense */
  employeeId?: string

  /** Expense report ID if linked */
  expenseReportId?: string

  /** Transaction ID if linked */
  transactionId?: string

  /** Is reimbursable? */
  reimbursable?: boolean

  /** Reimbursement status */
  reimbursementStatus?: 'pending' | 'approved' | 'paid' | 'rejected'

  /** Tax amount */
  taxAmount?: number

  /** Tax rate */
  taxRate?: number

  /** Attachments (images, PDFs) */
  attachments: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** OCR extracted data */
  ocrData?: {
    merchant?: string
    date?: Date
    total?: number
    items?: Array<{
      description: string
      amount: number
    }>
    confidence?: number
  }

  /** Account ID for expense classification */
  accountId?: string

  /** Project ID */
  projectId?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    expensify?: string
    concur?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReceiptInput = Input<Receipt>
export type ReceiptOutput = Output<Receipt>

// =============================================================================
// Budget - Budget with Periods
// =============================================================================

/**
 * Budget status.
 */
export type BudgetStatus = 'draft' | 'active' | 'closed' | 'archived'

/**
 * Budget period type.
 */
export type BudgetPeriod = 'monthly' | 'quarterly' | 'annual' | 'custom'

/**
 * Budget with periods and line items.
 *
 * Budgets define planned income and expenses for a period,
 * used for forecasting, variance analysis, and financial
 * planning.
 *
 * @example
 * ```ts
 * const budget: Budget = {
 *   id: 'bdgt_001',
 *   name: '2024 Annual Budget',
 *   status: 'active',
 *   fiscalYear: 2024,
 *   period: 'annual',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-12-31'),
 *   currency: 'USD',
 *   totalRevenue: 1000000,
 *   totalExpenses: 750000,
 *   netIncome: 250000,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Budget {
  /** Unique identifier */
  id: string

  /** Budget name */
  name: string

  /** Current status */
  status: BudgetStatus

  /** Fiscal year */
  fiscalYear: number

  /** Budget period type */
  period: BudgetPeriod

  /** Start date */
  startDate: Date

  /** End date */
  endDate: Date

  /** Currency code */
  currency: string

  /** Total budgeted revenue */
  totalRevenue?: number

  /** Total budgeted expenses */
  totalExpenses?: number

  /** Net income (revenue - expenses) */
  netIncome?: number

  /** Description */
  description?: string

  /** Department */
  department?: string

  /** Owner user ID */
  ownerId?: string

  /** Approved date */
  approvedAt?: Date

  /** Approved by user ID */
  approvedBy?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    quickbooks?: string
    netsuite?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BudgetInput = Input<Budget>
export type BudgetOutput = Output<Budget>

// =============================================================================
// BudgetItem - Budget Line Item
// =============================================================================

/**
 * Budget item type.
 */
export type BudgetItemType = 'revenue' | 'expense'

/**
 * Individual budget line item.
 *
 * Budget items represent planned amounts for specific
 * accounts over the budget period.
 *
 * @example
 * ```ts
 * const budgetItem: BudgetItem = {
 *   id: 'bitem_001',
 *   budgetId: 'bdgt_001',
 *   type: 'expense',
 *   accountId: 'acc_marketing',
 *   amount: 50000,
 *   actualAmount: 45000,
 *   variance: -5000,
 *   variancePercent: -10.0,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface BudgetItem {
  /** Unique identifier */
  id: string

  /** Budget ID */
  budgetId: string

  /** Item type */
  type: BudgetItemType

  /** Account ID */
  accountId: string

  /** Budgeted amount */
  amount: number

  /** Actual amount (for comparison) */
  actualAmount?: number

  /** Variance (actual - budget) */
  variance?: number

  /** Variance percentage */
  variancePercent?: number

  /** Period start date (for sub-periods) */
  periodStart?: Date

  /** Period end date (for sub-periods) */
  periodEnd?: Date

  /** Notes */
  notes?: string

  /** Department */
  department?: string

  /** Project ID */
  projectId?: string

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BudgetItemInput = Input<BudgetItem>
export type BudgetItemOutput = Output<BudgetItem>

// =============================================================================
// Forecast - Financial Forecast
// =============================================================================

/**
 * Forecast status.
 */
export type ForecastStatus = 'draft' | 'active' | 'archived'

/**
 * Forecast type.
 */
export type ForecastType = 'revenue' | 'expense' | 'cash_flow' | 'comprehensive'

/**
 * Financial forecast.
 *
 * Forecasts project future financial performance based on
 * historical data, trends, and assumptions.
 *
 * @example
 * ```ts
 * const forecast: Forecast = {
 *   id: 'fcst_001',
 *   name: 'Q1 2024 Revenue Forecast',
 *   status: 'active',
 *   type: 'revenue',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-03-31'),
 *   currency: 'USD',
 *   projectedRevenue: 300000,
 *   confidenceLevel: 0.85,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Forecast {
  /** Unique identifier */
  id: string

  /** Forecast name */
  name: string

  /** Current status */
  status: ForecastStatus

  /** Forecast type */
  type: ForecastType

  /** Start date */
  startDate: Date

  /** End date */
  endDate: Date

  /** Currency code */
  currency: string

  /** Projected revenue */
  projectedRevenue?: number

  /** Projected expenses */
  projectedExpenses?: number

  /** Projected net income */
  projectedNetIncome?: number

  /** Projected cash flow */
  projectedCashFlow?: number

  /** Confidence level (0-1) */
  confidenceLevel?: number

  /** Methodology used */
  methodology?: string

  /** Assumptions */
  assumptions?: string[]

  /** Description */
  description?: string

  /** Owner user ID */
  ownerId?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    netsuite?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ForecastInput = Input<Forecast>
export type ForecastOutput = Output<Forecast>

// =============================================================================
// TaxRate - Tax Rate Configuration
// =============================================================================

/**
 * Tax rate status.
 */
export type TaxRateStatus = 'active' | 'inactive' | 'archived'

/**
 * Tax type.
 */
export type TaxType = 'sales' | 'purchase' | 'vat' | 'gst' | 'excise' | 'other'

/**
 * Tax rate and jurisdiction configuration.
 *
 * Tax rates define the applicable tax percentages for
 * different jurisdictions and transaction types.
 *
 * @example
 * ```ts
 * const taxRate: TaxRate = {
 *   id: 'tax_001',
 *   name: 'California Sales Tax',
 *   code: 'CA-SALES',
 *   type: 'sales',
 *   status: 'active',
 *   rate: 0.0725,
 *   jurisdiction: 'California',
 *   effectiveDate: new Date('2024-01-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TaxRate {
  /** Unique identifier */
  id: string

  /** Tax rate name */
  name: string

  /** Tax code */
  code: string

  /** Tax type */
  type: TaxType

  /** Current status */
  status: TaxRateStatus

  /** Tax rate (as decimal, e.g., 0.0725 for 7.25%) */
  rate: number

  /** Description */
  description?: string

  /** Jurisdiction (state, province, country) */
  jurisdiction?: string

  /** Is compound tax? (applied on top of other taxes) */
  isCompound?: boolean

  /** Effective start date */
  effectiveDate: Date

  /** End date (if no longer effective) */
  endDate?: Date

  /** Tax account ID for liabilities */
  taxAccountId?: string

  /** Component rates for composite taxes */
  components?: Array<{
    name: string
    rate: number
    accountId?: string
  }>

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    avalara?: string
    taxjar?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TaxRateInput = Input<TaxRate>
export type TaxRateOutput = Output<TaxRate>

// =============================================================================
// TaxFiling - Tax Filing Record
// =============================================================================

/**
 * Tax filing status.
 */
export type TaxFilingStatus = 'draft' | 'pending' | 'filed' | 'accepted' | 'amended' | 'rejected'

/**
 * Tax filing period.
 */
export type TaxFilingPeriod = 'monthly' | 'quarterly' | 'annual'

/**
 * Tax filing record.
 *
 * Tax filings track tax returns and submissions to
 * tax authorities.
 *
 * @example
 * ```ts
 * const filing: TaxFiling = {
 *   id: 'filing_001',
 *   name: '2024 Q1 Sales Tax',
 *   status: 'filed',
 *   period: 'quarterly',
 *   taxYear: 2024,
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-03-31'),
 *   dueDate: new Date('2024-04-30'),
 *   taxOwed: 15000,
 *   taxPaid: 15000,
 *   filedAt: new Date('2024-04-15'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TaxFiling {
  /** Unique identifier */
  id: string

  /** Filing name */
  name: string

  /** Current status */
  status: TaxFilingStatus

  /** Filing period */
  period: TaxFilingPeriod

  /** Tax year */
  taxYear: number

  /** Period start date */
  startDate: Date

  /** Period end date */
  endDate: Date

  /** Due date */
  dueDate: Date

  /** Form type (e.g., '1040', '1120', 'VAT Return') */
  formType?: string

  /** Jurisdiction */
  jurisdiction?: string

  /** Tax owed */
  taxOwed?: number

  /** Tax paid */
  taxPaid?: number

  /** Penalties */
  penalties?: number

  /** Interest */
  interest?: number

  /** Currency */
  currency?: string

  /** Filed date */
  filedAt?: Date

  /** Filed by user ID */
  filedBy?: string

  /** Confirmation number */
  confirmationNumber?: string

  /** Return URL/attachment */
  returnUrl?: string

  /** Attachments */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Notes */
  notes?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    irs?: string
    state?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TaxFilingInput = Input<TaxFiling>
export type TaxFilingOutput = Output<TaxFiling>

// =============================================================================
// BankAccount - Bank Account Connection
// =============================================================================

/**
 * Bank account status.
 */
export type BankAccountStatus = 'active' | 'disconnected' | 'error' | 'closed'

/**
 * Bank account type.
 */
export type BankAccountType = 'checking' | 'savings' | 'credit_card' | 'loan' | 'investment' | 'other'

/**
 * Bank account connection.
 *
 * Bank accounts represent connections to financial institutions
 * for automatic transaction feeds and reconciliation.
 *
 * @example
 * ```ts
 * const bankAccount: BankAccount = {
 *   id: 'bank_001',
 *   name: 'Business Checking',
 *   type: 'checking',
 *   status: 'active',
 *   institution: 'Chase Bank',
 *   accountNumber: '****1234',
 *   currency: 'USD',
 *   currentBalance: 50000.00,
 *   accountId: 'acc_cash',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface BankAccount {
  /** Unique identifier */
  id: string

  /** Account name/nickname */
  name: string

  /** Account type */
  type: BankAccountType

  /** Current status */
  status: BankAccountStatus

  /** Financial institution name */
  institution: string

  /** Masked account number */
  accountNumber: string

  /** Routing number */
  routingNumber?: string

  /** Currency code */
  currency: string

  /** Current balance */
  currentBalance?: number

  /** Available balance */
  availableBalance?: number

  /** Linked GL account ID */
  accountId?: string

  /** Last sync date */
  lastSyncedAt?: Date

  /** Connection provider (Plaid, Yodlee, etc) */
  provider?: string

  /** Provider account ID */
  providerAccountId?: string

  /** Is auto-sync enabled? */
  autoSync?: boolean

  /** Sync frequency (daily, weekly, etc) */
  syncFrequency?: string

  /** Connection error if any */
  error?: {
    code: string
    message: string
    timestamp: Date
  }

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    plaid?: string
    yodlee?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BankAccountInput = Input<BankAccount>
export type BankAccountOutput = Output<BankAccount>

// =============================================================================
// BankTransaction - Bank Feed Transaction
// =============================================================================

/**
 * Bank transaction status.
 */
export type BankTransactionStatus = 'pending' | 'posted' | 'matched' | 'categorized' | 'ignored'

/**
 * Bank transaction type.
 */
export type BankTransactionType = 'debit' | 'credit' | 'fee' | 'interest' | 'transfer' | 'other'

/**
 * Bank feed transaction.
 *
 * Bank transactions are imported from bank feeds and
 * need to be matched/categorized for reconciliation.
 *
 * @example
 * ```ts
 * const bankTxn: BankTransaction = {
 *   id: 'btxn_001',
 *   bankAccountId: 'bank_001',
 *   type: 'credit',
 *   status: 'matched',
 *   date: new Date('2024-01-15'),
 *   description: 'STRIPE PAYMENT',
 *   amount: 1080.00,
 *   currency: 'USD',
 *   balance: 51080.00,
 *   transactionId: 'txn_pay_001',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface BankTransaction {
  /** Unique identifier */
  id: string

  /** Bank account ID */
  bankAccountId: string

  /** Transaction type */
  type: BankTransactionType

  /** Current status */
  status: BankTransactionStatus

  /** Transaction date */
  date: Date

  /** Description from bank */
  description: string

  /** Transaction amount */
  amount: number

  /** Currency code */
  currency: string

  /** Account balance after transaction */
  balance?: number

  /** Check number if applicable */
  checkNumber?: string

  /** Payee/merchant */
  payee?: string

  /** Category */
  category?: string

  /** Matched transaction ID */
  transactionId?: string

  /** Matched payment ID */
  paymentId?: string

  /** Suggested matches */
  suggestedMatches?: Array<{
    id: string
    type: 'transaction' | 'payment' | 'invoice' | 'bill'
    confidence: number
  }>

  /** Provider transaction ID */
  providerTransactionId?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BankTransactionInput = Input<BankTransaction>
export type BankTransactionOutput = Output<BankTransaction>

// =============================================================================
// Reconciliation - Bank Reconciliation
// =============================================================================

/**
 * Reconciliation status.
 */
export type ReconciliationStatus = 'in_progress' | 'completed' | 'approved' | 'discarded'

/**
 * Bank reconciliation record.
 *
 * Reconciliations match bank statement balances with
 * general ledger account balances to ensure accuracy.
 *
 * @example
 * ```ts
 * const reconciliation: Reconciliation = {
 *   id: 'recon_001',
 *   bankAccountId: 'bank_001',
 *   status: 'completed',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-01-31'),
 *   openingBalance: 45000.00,
 *   closingBalance: 50000.00,
 *   statementBalance: 50000.00,
 *   reconciledBalance: 50000.00,
 *   difference: 0,
 *   currency: 'USD',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Reconciliation {
  /** Unique identifier */
  id: string

  /** Bank account ID */
  bankAccountId: string

  /** Current status */
  status: ReconciliationStatus

  /** Statement start date */
  startDate: Date

  /** Statement end date */
  endDate: Date

  /** Opening balance */
  openingBalance: number

  /** Closing balance */
  closingBalance: number

  /** Statement balance from bank */
  statementBalance: number

  /** Reconciled balance in GL */
  reconciledBalance: number

  /** Difference (should be 0 when complete) */
  difference: number

  /** Currency code */
  currency: string

  /** Reconciled transaction IDs */
  reconciledTransactionIds?: string[]

  /** Outstanding checks */
  outstandingChecks?: Array<{
    transactionId: string
    amount: number
  }>

  /** Deposits in transit */
  depositsInTransit?: Array<{
    transactionId: string
    amount: number
  }>

  /** Bank fees not in GL */
  unreconciledBankFees?: Array<{
    date: Date
    description: string
    amount: number
  }>

  /** GL entries not in bank statement */
  unreconciledGLEntries?: Array<{
    transactionId: string
    amount: number
  }>

  /** Reconciled date */
  reconciledAt?: Date

  /** Reconciled by user ID */
  reconciledBy?: string

  /** Approved date */
  approvedAt?: Date

  /** Approved by user ID */
  approvedBy?: string

  /** Notes */
  notes?: string

  /** Attachments (bank statement) */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReconciliationInput = Input<Reconciliation>
export type ReconciliationOutput = Output<Reconciliation>

// =============================================================================
// FinancialReport - Financial Report
// =============================================================================

/**
 * Financial report type.
 */
export type FinancialReportType =
  | 'balance_sheet'
  | 'income_statement'
  | 'cash_flow'
  | 'trial_balance'
  | 'general_ledger'
  | 'ar_aging'
  | 'ap_aging'
  | 'custom'

/**
 * Report status.
 */
export type ReportStatus = 'generating' | 'ready' | 'error'

/**
 * Financial report (P&L, Balance Sheet, Cash Flow, etc).
 *
 * Financial reports provide snapshots and summaries of
 * financial data for analysis and compliance.
 *
 * @example
 * ```ts
 * const report: FinancialReport = {
 *   id: 'rpt_001',
 *   name: 'January 2024 P&L',
 *   type: 'income_statement',
 *   status: 'ready',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-01-31'),
 *   currency: 'USD',
 *   generatedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface FinancialReport {
  /** Unique identifier */
  id: string

  /** Report name */
  name: string

  /** Report type */
  type: FinancialReportType

  /** Current status */
  status: ReportStatus

  /** Report start date */
  startDate: Date

  /** Report end date */
  endDate: Date

  /** Currency code */
  currency: string

  /** Report data (structure varies by type) */
  data?: {
    /** For income statement */
    revenue?: number
    expenses?: number
    netIncome?: number

    /** For balance sheet */
    assets?: number
    liabilities?: number
    equity?: number

    /** For cash flow */
    operatingCashFlow?: number
    investingCashFlow?: number
    financingCashFlow?: number
    netCashFlow?: number

    /** Line items */
    lineItems?: Array<{
      accountId: string
      accountName: string
      amount: number
      percentage?: number
    }>

    /** Sections/categories */
    sections?: Array<{
      name: string
      total: number
      items: Array<{
        accountId: string
        accountName: string
        amount: number
      }>
    }>
  }

  /** Basis of accounting */
  basis?: 'accrual' | 'cash'

  /** Comparison period */
  comparison?: {
    startDate: Date
    endDate: Date
    data: Record<string, unknown>
  }

  /** Generated date */
  generatedAt?: Date

  /** Generated by user ID */
  generatedBy?: string

  /** Report URL (PDF, etc) */
  reportUrl?: string

  /** Attachments */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Department filter */
  department?: string

  /** Location filter */
  location?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    quickbooks?: string
    xero?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FinancialReportInput = Input<FinancialReport>
export type FinancialReportOutput = Output<FinancialReport>

// =============================================================================
// ExpenseReport - Employee Expense Report
// =============================================================================

/**
 * Expense report status.
 */
export type ExpenseReportStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'paid'
  | 'cancelled'

/**
 * Employee expense report.
 *
 * Expense reports aggregate employee expenses for
 * approval and reimbursement.
 *
 * @example
 * ```ts
 * const expenseReport: ExpenseReport = {
 *   id: 'expr_001',
 *   number: 'EXP-2024-001',
 *   status: 'approved',
 *   employeeId: 'emp_123',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-01-31'),
 *   currency: 'USD',
 *   total: 1500.00,
 *   submittedAt: new Date('2024-02-01'),
 *   approvedAt: new Date('2024-02-03'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ExpenseReport {
  /** Unique identifier */
  id: string

  /** Report number */
  number: string

  /** Current status */
  status: ExpenseReportStatus

  /** Employee ID */
  employeeId: string

  /** Report period start date */
  startDate: Date

  /** Report period end date */
  endDate: Date

  /** Currency code */
  currency: string

  /** Total amount */
  total: number

  /** Reimbursable amount */
  reimbursableAmount?: number

  /** Non-reimbursable amount */
  nonReimbursableAmount?: number

  /** Purpose/description */
  purpose?: string

  /** Submitted date */
  submittedAt?: Date

  /** Reviewed date */
  reviewedAt?: Date

  /** Reviewed by user ID */
  reviewedBy?: string

  /** Approved date */
  approvedAt?: Date

  /** Approved by user ID */
  approvedBy?: string

  /** Rejected date */
  rejectedAt?: Date

  /** Rejection reason */
  rejectionReason?: string

  /** Paid date */
  paidAt?: Date

  /** Payment ID */
  paymentId?: string

  /** Notes */
  notes?: string

  /** Attachments */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    expensify?: string
    concur?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ExpenseReportInput = Input<ExpenseReport>
export type ExpenseReportOutput = Output<ExpenseReport>

// =============================================================================
// ExpenseItem - Expense Report Line Item
// =============================================================================

/**
 * Expense item status.
 */
export type ExpenseItemStatus = 'pending' | 'approved' | 'rejected'

/**
 * Individual expense line item.
 *
 * Expense items represent individual expenses within
 * an expense report.
 *
 * @example
 * ```ts
 * const expenseItem: ExpenseItem = {
 *   id: 'expi_001',
 *   expenseReportId: 'expr_001',
 *   status: 'approved',
 *   date: new Date('2024-01-15'),
 *   merchant: 'Uber',
 *   category: 'Transportation',
 *   amount: 45.00,
 *   currency: 'USD',
 *   reimbursable: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ExpenseItem {
  /** Unique identifier */
  id: string

  /** Expense report ID */
  expenseReportId: string

  /** Current status */
  status: ExpenseItemStatus

  /** Expense date */
  date: Date

  /** Merchant/vendor */
  merchant: string

  /** Expense category */
  category: string

  /** Amount */
  amount: number

  /** Currency code */
  currency: string

  /** Is reimbursable? */
  reimbursable: boolean

  /** Description */
  description?: string

  /** Payment method */
  paymentMethod?: PaymentMethod

  /** Receipt ID */
  receiptId?: string

  /** Account ID for expense classification */
  accountId?: string

  /** Project ID */
  projectId?: string

  /** Billable to customer? */
  billable?: boolean

  /** Customer ID if billable */
  customerId?: string

  /** Tax amount */
  taxAmount?: number

  /** Mileage (if mileage expense) */
  mileage?: {
    distance: number
    unit: 'miles' | 'kilometers'
    rate: number
  }

  /** Per diem (if per diem expense) */
  perDiem?: {
    days: number
    rate: number
  }

  /** Rejection reason if rejected */
  rejectionReason?: string

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ExpenseItemInput = Input<ExpenseItem>
export type ExpenseItemOutput = Output<ExpenseItem>

// =============================================================================
// Payroll - Payroll Run
// =============================================================================

/**
 * Payroll status.
 */
export type PayrollStatus = 'draft' | 'processing' | 'approved' | 'paid' | 'cancelled'

/**
 * Payroll period type.
 */
export type PayrollPeriodType = 'weekly' | 'bi_weekly' | 'semi_monthly' | 'monthly'

/**
 * Payroll run.
 *
 * Payroll runs process employee compensation for a
 * specific pay period.
 *
 * @example
 * ```ts
 * const payroll: Payroll = {
 *   id: 'pay_001',
 *   number: 'PAY-2024-001',
 *   status: 'paid',
 *   periodType: 'bi_weekly',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-01-14'),
 *   payDate: new Date('2024-01-19'),
 *   currency: 'USD',
 *   grossPay: 100000,
 *   netPay: 75000,
 *   totalDeductions: 25000,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Payroll {
  /** Unique identifier */
  id: string

  /** Payroll run number */
  number: string

  /** Current status */
  status: PayrollStatus

  /** Pay period type */
  periodType: PayrollPeriodType

  /** Period start date */
  startDate: Date

  /** Period end date */
  endDate: Date

  /** Pay date */
  payDate: Date

  /** Currency code */
  currency: string

  /** Total gross pay */
  grossPay: number

  /** Total net pay */
  netPay: number

  /** Total deductions */
  totalDeductions: number

  /** Total employer taxes */
  employerTaxes?: number

  /** Employee count */
  employeeCount?: number

  /** Processed date */
  processedAt?: Date

  /** Processed by user ID */
  processedBy?: string

  /** Approved date */
  approvedAt?: Date

  /** Approved by user ID */
  approvedBy?: string

  /** Paid date */
  paidAt?: Date

  /** Journal entry ID */
  journalEntryId?: string

  /** Notes */
  notes?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    gusto?: string
    adp?: string
    paychex?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PayrollInput = Input<Payroll>
export type PayrollOutput = Output<Payroll>

// =============================================================================
// PayrollItem - Individual Payroll Entry
// =============================================================================

/**
 * Payroll item status.
 */
export type PayrollItemStatus = 'pending' | 'processed' | 'paid' | 'cancelled'

/**
 * Individual payroll entry for an employee.
 *
 * Payroll items represent compensation for individual
 * employees within a payroll run.
 *
 * @example
 * ```ts
 * const payrollItem: PayrollItem = {
 *   id: 'payi_001',
 *   payrollId: 'pay_001',
 *   employeeId: 'emp_123',
 *   status: 'paid',
 *   grossPay: 5000,
 *   netPay: 3750,
 *   currency: 'USD',
 *   earnings: [
 *     { type: 'salary', amount: 5000 }
 *   ],
 *   deductions: [
 *     { type: 'federal_tax', amount: 750 },
 *     { type: 'state_tax', amount: 250 },
 *     { type: '401k', amount: 250 }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface PayrollItem {
  /** Unique identifier */
  id: string

  /** Payroll run ID */
  payrollId: string

  /** Employee ID */
  employeeId: string

  /** Current status */
  status: PayrollItemStatus

  /** Gross pay */
  grossPay: number

  /** Net pay */
  netPay: number

  /** Currency code */
  currency: string

  /** Earnings breakdown */
  earnings?: Array<{
    type: 'salary' | 'hourly' | 'overtime' | 'bonus' | 'commission' | 'other'
    amount: number
    hours?: number
    rate?: number
    description?: string
  }>

  /** Deductions breakdown */
  deductions?: Array<{
    type: 'federal_tax' | 'state_tax' | 'social_security' | 'medicare' | '401k' | 'health_insurance' | 'other'
    amount: number
    description?: string
  }>

  /** Employer contributions */
  employerContributions?: Array<{
    type: 'social_security' | 'medicare' | '401k_match' | 'health_insurance' | 'other'
    amount: number
    description?: string
  }>

  /** Hours worked */
  hoursWorked?: {
    regular: number
    overtime: number
    double: number
  }

  /** Payment method */
  paymentMethod?: 'direct_deposit' | 'check' | 'cash'

  /** Bank account (if direct deposit) */
  bankAccount?: {
    accountNumber: string
    routingNumber: string
  }

  /** Check number (if check) */
  checkNumber?: string

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PayrollItemInput = Input<PayrollItem>
export type PayrollItemOutput = Output<PayrollItem>

// =============================================================================
// Asset - Fixed Asset
// =============================================================================

/**
 * Asset status.
 */
export type AssetStatus = 'active' | 'disposed' | 'fully_depreciated' | 'inactive'

/**
 * Asset type.
 */
export type AssetType =
  | 'building'
  | 'equipment'
  | 'vehicle'
  | 'furniture'
  | 'computer'
  | 'software'
  | 'leasehold_improvement'
  | 'other'

/**
 * Fixed asset with depreciation tracking.
 *
 * Assets represent long-term property owned by the business
 * that provides value over multiple accounting periods.
 *
 * @example
 * ```ts
 * const asset: Asset = {
 *   id: 'asset_001',
 *   name: 'Company Vehicle',
 *   type: 'vehicle',
 *   status: 'active',
 *   purchaseDate: new Date('2023-01-15'),
 *   purchasePrice: 50000,
 *   currency: 'USD',
 *   depreciationMethod: 'straight_line',
 *   usefulLife: 5,
 *   salvageValue: 5000,
 *   accumulatedDepreciation: 9000,
 *   netBookValue: 41000,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Asset {
  /** Unique identifier */
  id: string

  /** Asset name */
  name: string

  /** Asset type */
  type: AssetType

  /** Current status */
  status: AssetStatus

  /** Description */
  description?: string

  /** Purchase date */
  purchaseDate: Date

  /** Purchase price */
  purchasePrice: number

  /** Currency code */
  currency: string

  /** Depreciation method */
  depreciationMethod: 'straight_line' | 'declining_balance' | 'sum_of_years' | 'units_of_production' | 'none'

  /** Useful life (in years) */
  usefulLife: number

  /** Salvage/residual value */
  salvageValue?: number

  /** Accumulated depreciation */
  accumulatedDepreciation: number

  /** Net book value (purchase price - accumulated depreciation) */
  netBookValue: number

  /** Asset account ID */
  assetAccountId?: string

  /** Accumulated depreciation account ID */
  depreciationAccountId?: string

  /** Depreciation expense account ID */
  expenseAccountId?: string

  /** Location */
  location?: string

  /** Department */
  department?: string

  /** Serial number */
  serialNumber?: string

  /** Model/make */
  model?: string

  /** Disposed date if disposed */
  disposedAt?: Date

  /** Disposal proceeds */
  disposalProceeds?: number

  /** Disposal gain/loss */
  disposalGainLoss?: number

  /** Attachments (receipts, titles, etc) */
  attachments?: Array<{
    id: string
    name: string
    url: string
    type: string
    size: number
  }>

  /** Tags */
  tags?: string[]

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    quickbooks?: string
    netsuite?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AssetInput = Input<Asset>
export type AssetOutput = Output<Asset>

// =============================================================================
// Depreciation - Depreciation Schedule Entry
// =============================================================================

/**
 * Depreciation status.
 */
export type DepreciationStatus = 'scheduled' | 'posted' | 'reversed'

/**
 * Depreciation schedule entry.
 *
 * Depreciation entries record the periodic expense of
 * fixed assets over their useful life.
 *
 * @example
 * ```ts
 * const depreciation: Depreciation = {
 *   id: 'dep_001',
 *   assetId: 'asset_001',
 *   status: 'posted',
 *   date: new Date('2024-01-31'),
 *   amount: 750,
 *   currency: 'USD',
 *   accumulatedDepreciation: 9750,
 *   netBookValue: 40250,
 *   journalEntryId: 'je_dep_001',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Depreciation {
  /** Unique identifier */
  id: string

  /** Asset ID */
  assetId: string

  /** Current status */
  status: DepreciationStatus

  /** Depreciation date */
  date: Date

  /** Depreciation amount for this period */
  amount: number

  /** Currency code */
  currency: string

  /** Accumulated depreciation after this entry */
  accumulatedDepreciation: number

  /** Net book value after this entry */
  netBookValue: number

  /** Journal entry ID if posted */
  journalEntryId?: string

  /** Transaction ID if posted */
  transactionId?: string

  /** Notes */
  notes?: string

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DepreciationInput = Input<Depreciation>
export type DepreciationOutput = Output<Depreciation>

// =============================================================================
// Currency - Currency Definition
// =============================================================================

/**
 * Currency status.
 */
export type CurrencyStatus = 'active' | 'inactive'

/**
 * Currency definition.
 *
 * Currencies define the monetary units used in
 * financial transactions.
 *
 * @example
 * ```ts
 * const currency: Currency = {
 *   id: 'cur_usd',
 *   code: 'USD',
 *   name: 'US Dollar',
 *   symbol: '$',
 *   status: 'active',
 *   decimalPlaces: 2,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Currency {
  /** Unique identifier */
  id: string

  /** ISO 4217 currency code */
  code: string

  /** Currency name */
  name: string

  /** Currency symbol */
  symbol: string

  /** Current status */
  status: CurrencyStatus

  /** Number of decimal places */
  decimalPlaces: number

  /** Is base currency? */
  isBase?: boolean

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CurrencyInput = Input<Currency>
export type CurrencyOutput = Output<Currency>

// =============================================================================
// ExchangeRate - Currency Exchange Rate
// =============================================================================

/**
 * Exchange rate status.
 */
export type ExchangeRateStatus = 'active' | 'historical'

/**
 * Currency exchange rate.
 *
 * Exchange rates define conversion rates between currencies
 * for multi-currency accounting.
 *
 * @example
 * ```ts
 * const exchangeRate: ExchangeRate = {
 *   id: 'exr_001',
 *   fromCurrency: 'EUR',
 *   toCurrency: 'USD',
 *   rate: 1.12,
 *   status: 'active',
 *   effectiveDate: new Date('2024-01-15'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ExchangeRate {
  /** Unique identifier */
  id: string

  /** From currency code */
  fromCurrency: string

  /** To currency code */
  toCurrency: string

  /** Exchange rate */
  rate: number

  /** Current status */
  status: ExchangeRateStatus

  /** Effective date */
  effectiveDate: Date

  /** End date (if no longer effective) */
  endDate?: Date

  /** Source (manual, API, etc) */
  source?: string

  /** Custom fields */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ExchangeRateInput = Input<ExchangeRate>
export type ExchangeRateOutput = Output<ExchangeRate>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface AccountActions extends CRUDResource<Account, AccountInput> {
  /** Get account balance */
  getBalance: Action<{ id: string; asOf?: Date }, { balance: number; currency: string }>

  /** Get account hierarchy */
  getHierarchy: Action<{ id: string }, Account[]>

  /** Get transactions for account */
  getTransactions: Action<{ id: string; from?: Date; to?: Date } & ListParams, PaginatedResult<Transaction>>

  /** Close account */
  close: Action<{ id: string }, Account>

  /** Reopen account */
  reopen: Action<{ id: string }, Account>
}

export interface TransactionActions extends CRUDResource<Transaction, TransactionInput> {
  /** Post transaction */
  post: Action<{ id: string }, Transaction>

  /** Void transaction */
  void: Action<{ id: string; reason?: string }, Transaction>

  /** Reconcile transaction */
  reconcile: Action<{ id: string; reconciliationId: string }, Transaction>

  /** Batch create transactions */
  batchCreate: Action<{ transactions: TransactionInput[] }, Transaction[]>
}

export interface JournalEntryActions extends CRUDResource<JournalEntry, JournalEntryInput> {
  /** Post journal entry */
  post: Action<{ id: string }, JournalEntry>

  /** Approve journal entry */
  approve: Action<{ id: string }, JournalEntry>

  /** Reverse journal entry */
  reverse: Action<{ id: string; date: Date; description?: string }, JournalEntry>
}

export interface InvoiceActions extends CRUDResource<Invoice, InvoiceInput> {
  /** Send invoice to customer */
  send: Action<{ id: string; to: string[]; subject?: string; message?: string }, Invoice>

  /** Mark invoice as sent */
  markSent: Action<{ id: string }, Invoice>

  /** Mark invoice as paid */
  markPaid: Action<{ id: string; paymentDate?: Date; paymentMethod?: string }, Invoice>

  /** Void invoice */
  void: Action<{ id: string }, Invoice>

  /** Apply payment to invoice */
  applyPayment: Action<{ id: string; paymentId: string; amount: number }, Invoice>

  /** Get invoice PDF */
  getPDF: Action<{ id: string }, { url: string }>
}

export interface BillActions extends CRUDResource<Bill, BillInput> {
  /** Approve bill */
  approve: Action<{ id: string }, Bill>

  /** Mark bill as paid */
  markPaid: Action<{ id: string; paymentDate?: Date; paymentMethod?: string }, Bill>

  /** Void bill */
  void: Action<{ id: string }, Bill>

  /** Apply payment to bill */
  applyPayment: Action<{ id: string; paymentId: string; amount: number }, Bill>
}

export interface PaymentActions extends CRUDResource<Payment, PaymentInput> {
  /** Process payment */
  process: Action<{ id: string }, Payment>

  /** Void payment */
  void: Action<{ id: string }, Payment>

  /** Apply to invoice/bill */
  apply: Action<{ id: string; documentId: string; documentType: string; amount: number }, Payment>

  /** Unapply from invoice/bill */
  unapply: Action<{ id: string; documentId: string }, Payment>
}

export interface ReceiptActions extends CRUDResource<Receipt, ReceiptInput> {
  /** Approve receipt */
  approve: Action<{ id: string }, Receipt>

  /** Reject receipt */
  reject: Action<{ id: string; reason: string }, Receipt>

  /** Process OCR on receipt */
  processOCR: Action<{ id: string }, Receipt>

  /** Match to transaction */
  match: Action<{ id: string; transactionId: string }, Receipt>
}

export interface BudgetActions extends CRUDResource<Budget, BudgetInput> {
  /** Approve budget */
  approve: Action<{ id: string }, Budget>

  /** Close budget */
  close: Action<{ id: string }, Budget>

  /** Get budget items */
  getItems: Action<{ id: string } & ListParams, PaginatedResult<BudgetItem>>

  /** Get variance analysis */
  getVariance: Action<{ id: string }, BudgetVarianceAnalysis>

  /** Clone budget for new period */
  clone: Action<{ id: string; name: string; fiscalYear: number; startDate: Date; endDate: Date }, Budget>
}

export interface BudgetItemActions extends CRUDResource<BudgetItem, BudgetItemInput> {
  /** Update actual amount */
  updateActual: Action<{ id: string }, BudgetItem>

  /** Recalculate variance */
  recalculateVariance: Action<{ id: string }, BudgetItem>
}

export interface ForecastActions extends CRUDResource<Forecast, ForecastInput> {
  /** Generate forecast */
  generate: Action<{ id: string }, Forecast>

  /** Update forecast */
  updateProjections: Action<{ id: string; projections: Partial<Forecast> }, Forecast>
}

export interface TaxRateActions extends CRUDResource<TaxRate, TaxRateInput> {
  /** Get effective rate for date */
  getEffectiveRate: Action<{ id: string; date: Date }, { rate: number }>

  /** Deactivate tax rate */
  deactivate: Action<{ id: string; endDate: Date }, TaxRate>
}

export interface TaxFilingActions extends CRUDResource<TaxFiling, TaxFilingInput> {
  /** Submit filing */
  submit: Action<{ id: string }, TaxFiling>

  /** Mark as filed */
  markFiled: Action<{ id: string; filedDate: Date; confirmationNumber?: string }, TaxFiling>

  /** Generate tax report */
  generateReport: Action<{ id: string }, { url: string }>
}

export interface BankAccountActions extends CRUDResource<BankAccount, BankAccountInput> {
  /** Sync transactions */
  sync: Action<{ id: string }, BankAccount>

  /** Disconnect bank account */
  disconnect: Action<{ id: string }, BankAccount>

  /** Reconnect bank account */
  reconnect: Action<{ id: string }, BankAccount>

  /** Get transactions */
  getTransactions: Action<{ id: string; from?: Date; to?: Date } & ListParams, PaginatedResult<BankTransaction>>
}

export interface BankTransactionActions extends CRUDResource<BankTransaction, BankTransactionInput> {
  /** Match to transaction */
  match: Action<{ id: string; transactionId: string }, BankTransaction>

  /** Categorize transaction */
  categorize: Action<{ id: string; category: string; accountId?: string }, BankTransaction>

  /** Ignore transaction */
  ignore: Action<{ id: string }, BankTransaction>

  /** Create transaction from bank transaction */
  createTransaction: Action<{ id: string; transactionData: TransactionInput }, Transaction>
}

export interface ReconciliationActions extends CRUDResource<Reconciliation, ReconciliationInput> {
  /** Complete reconciliation */
  complete: Action<{ id: string }, Reconciliation>

  /** Approve reconciliation */
  approve: Action<{ id: string }, Reconciliation>

  /** Discard reconciliation */
  discard: Action<{ id: string }, Reconciliation>

  /** Add transaction to reconciliation */
  addTransaction: Action<{ id: string; transactionId: string }, Reconciliation>

  /** Remove transaction from reconciliation */
  removeTransaction: Action<{ id: string; transactionId: string }, Reconciliation>
}

export interface FinancialReportActions extends CRUDResource<FinancialReport, FinancialReportInput> {
  /** Generate report */
  generate: Action<{ id: string }, FinancialReport>

  /** Export report */
  export: Action<{ id: string; format: 'pdf' | 'xlsx' | 'csv' }, { url: string }>

  /** Schedule report generation */
  schedule: Action<{ id: string; frequency: string; recipients: string[] }, void>
}

export interface ExpenseReportActions extends CRUDResource<ExpenseReport, ExpenseReportInput> {
  /** Submit for approval */
  submit: Action<{ id: string }, ExpenseReport>

  /** Approve expense report */
  approve: Action<{ id: string }, ExpenseReport>

  /** Reject expense report */
  reject: Action<{ id: string; reason: string }, ExpenseReport>

  /** Pay expense report */
  pay: Action<{ id: string; paymentId: string }, ExpenseReport>

  /** Get expense items */
  getItems: Action<{ id: string } & ListParams, PaginatedResult<ExpenseItem>>
}

export interface ExpenseItemActions extends CRUDResource<ExpenseItem, ExpenseItemInput> {
  /** Approve expense item */
  approve: Action<{ id: string }, ExpenseItem>

  /** Reject expense item */
  reject: Action<{ id: string; reason: string }, ExpenseItem>

  /** Attach receipt */
  attachReceipt: Action<{ id: string; receiptId: string }, ExpenseItem>
}

export interface PayrollActions extends CRUDResource<Payroll, PayrollInput> {
  /** Process payroll */
  process: Action<{ id: string }, Payroll>

  /** Approve payroll */
  approve: Action<{ id: string }, Payroll>

  /** Pay employees */
  pay: Action<{ id: string }, Payroll>

  /** Cancel payroll */
  cancel: Action<{ id: string }, Payroll>

  /** Get payroll items */
  getItems: Action<{ id: string } & ListParams, PaginatedResult<PayrollItem>>

  /** Generate payroll report */
  generateReport: Action<{ id: string }, { url: string }>
}

export interface PayrollItemActions extends CRUDResource<PayrollItem, PayrollItemInput> {
  /** Recalculate payroll item */
  recalculate: Action<{ id: string }, PayrollItem>
}

export interface AssetActions extends CRUDResource<Asset, AssetInput> {
  /** Depreciate asset */
  depreciate: Action<{ id: string; date: Date }, Asset>

  /** Dispose asset */
  dispose: Action<{ id: string; date: Date; proceeds?: number }, Asset>

  /** Get depreciation schedule */
  getDepreciationSchedule: Action<{ id: string }, Depreciation[]>

  /** Revalue asset */
  revalue: Action<{ id: string; newValue: number; date: Date }, Asset>
}

export interface DepreciationActions extends CRUDResource<Depreciation, DepreciationInput> {
  /** Post depreciation */
  post: Action<{ id: string }, Depreciation>

  /** Reverse depreciation */
  reverse: Action<{ id: string }, Depreciation>
}

export interface CurrencyActions extends CRUDResource<Currency, CurrencyInput> {
  /** Set as base currency */
  setBase: Action<{ id: string }, Currency>

  /** Get exchange rates */
  getExchangeRates: Action<{ id: string; toCurrency?: string } & ListParams, PaginatedResult<ExchangeRate>>
}

export interface ExchangeRateActions extends CRUDResource<ExchangeRate, ExchangeRateInput> {
  /** Get current rate */
  getCurrent: Action<{ fromCurrency: string; toCurrency: string }, { rate: number }>

  /** Get historical rate */
  getHistorical: Action<{ fromCurrency: string; toCurrency: string; date: Date }, { rate: number }>

  /** Update from source */
  updateFromSource: Action<{ source: string }, ExchangeRate[]>
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface BudgetVarianceAnalysis {
  budgetId: string
  period: { from: Date; to: Date }
  totalBudget: number
  totalActual: number
  totalVariance: number
  variancePercent: number
  byAccount: Array<{
    accountId: string
    accountName: string
    budgeted: number
    actual: number
    variance: number
    variancePercent: number
  }>
  byCategory: Array<{
    category: string
    budgeted: number
    actual: number
    variance: number
    variancePercent: number
  }>
}

// =============================================================================
// Events
// =============================================================================

export interface AccountEvents {
  created: BaseEvent<'account.created', Account>
  updated: BaseEvent<'account.updated', Account>
  deleted: BaseEvent<'account.deleted', { id: string }>
  closed: BaseEvent<'account.closed', Account>
  reopened: BaseEvent<'account.reopened', Account>
}

export interface TransactionEvents {
  created: BaseEvent<'transaction.created', Transaction>
  updated: BaseEvent<'transaction.updated', Transaction>
  deleted: BaseEvent<'transaction.deleted', { id: string }>
  posted: BaseEvent<'transaction.posted', Transaction>
  voided: BaseEvent<'transaction.voided', Transaction>
  reconciled: BaseEvent<'transaction.reconciled', Transaction>
}

export interface JournalEntryEvents {
  created: BaseEvent<'journal_entry.created', JournalEntry>
  updated: BaseEvent<'journal_entry.updated', JournalEntry>
  deleted: BaseEvent<'journal_entry.deleted', { id: string }>
  posted: BaseEvent<'journal_entry.posted', JournalEntry>
  approved: BaseEvent<'journal_entry.approved', JournalEntry>
  reversed: BaseEvent<'journal_entry.reversed', JournalEntry>
}

export interface InvoiceEvents {
  created: BaseEvent<'invoice.created', Invoice>
  updated: BaseEvent<'invoice.updated', Invoice>
  deleted: BaseEvent<'invoice.deleted', { id: string }>
  sent: BaseEvent<'invoice.sent', Invoice>
  viewed: BaseEvent<'invoice.viewed', Invoice>
  paid: BaseEvent<'invoice.paid', Invoice>
  overdue: BaseEvent<'invoice.overdue', Invoice>
  voided: BaseEvent<'invoice.voided', Invoice>
  payment_applied: BaseEvent<'invoice.payment_applied', { invoiceId: string; paymentId: string; amount: number }>
}

export interface BillEvents {
  created: BaseEvent<'bill.created', Bill>
  updated: BaseEvent<'bill.updated', Bill>
  deleted: BaseEvent<'bill.deleted', { id: string }>
  approved: BaseEvent<'bill.approved', Bill>
  paid: BaseEvent<'bill.paid', Bill>
  overdue: BaseEvent<'bill.overdue', Bill>
  voided: BaseEvent<'bill.voided', Bill>
  payment_applied: BaseEvent<'bill.payment_applied', { billId: string; paymentId: string; amount: number }>
}

export interface PaymentEvents {
  created: BaseEvent<'payment.created', Payment>
  updated: BaseEvent<'payment.updated', Payment>
  deleted: BaseEvent<'payment.deleted', { id: string }>
  processed: BaseEvent<'payment.processed', Payment>
  failed: BaseEvent<'payment.failed', { id: string; error: string }>
  voided: BaseEvent<'payment.voided', Payment>
  applied: BaseEvent<'payment.applied', { paymentId: string; documentId: string; amount: number }>
}

export interface ReceiptEvents {
  created: BaseEvent<'receipt.created', Receipt>
  updated: BaseEvent<'receipt.updated', Receipt>
  deleted: BaseEvent<'receipt.deleted', { id: string }>
  approved: BaseEvent<'receipt.approved', Receipt>
  rejected: BaseEvent<'receipt.rejected', Receipt>
  ocr_processed: BaseEvent<'receipt.ocr_processed', Receipt>
}

export interface BudgetEvents {
  created: BaseEvent<'budget.created', Budget>
  updated: BaseEvent<'budget.updated', Budget>
  deleted: BaseEvent<'budget.deleted', { id: string }>
  approved: BaseEvent<'budget.approved', Budget>
  closed: BaseEvent<'budget.closed', Budget>
}

export interface ForecastEvents {
  created: BaseEvent<'forecast.created', Forecast>
  updated: BaseEvent<'forecast.updated', Forecast>
  deleted: BaseEvent<'forecast.deleted', { id: string }>
  generated: BaseEvent<'forecast.generated', Forecast>
}

export interface ReconciliationEvents {
  created: BaseEvent<'reconciliation.created', Reconciliation>
  updated: BaseEvent<'reconciliation.updated', Reconciliation>
  deleted: BaseEvent<'reconciliation.deleted', { id: string }>
  completed: BaseEvent<'reconciliation.completed', Reconciliation>
  approved: BaseEvent<'reconciliation.approved', Reconciliation>
  discarded: BaseEvent<'reconciliation.discarded', { id: string }>
}

export interface ExpenseReportEvents {
  created: BaseEvent<'expense_report.created', ExpenseReport>
  updated: BaseEvent<'expense_report.updated', ExpenseReport>
  deleted: BaseEvent<'expense_report.deleted', { id: string }>
  submitted: BaseEvent<'expense_report.submitted', ExpenseReport>
  approved: BaseEvent<'expense_report.approved', ExpenseReport>
  rejected: BaseEvent<'expense_report.rejected', ExpenseReport>
  paid: BaseEvent<'expense_report.paid', ExpenseReport>
}

export interface PayrollEvents {
  created: BaseEvent<'payroll.created', Payroll>
  updated: BaseEvent<'payroll.updated', Payroll>
  deleted: BaseEvent<'payroll.deleted', { id: string }>
  processed: BaseEvent<'payroll.processed', Payroll>
  approved: BaseEvent<'payroll.approved', Payroll>
  paid: BaseEvent<'payroll.paid', Payroll>
  cancelled: BaseEvent<'payroll.cancelled', Payroll>
}

export interface AssetEvents {
  created: BaseEvent<'asset.created', Asset>
  updated: BaseEvent<'asset.updated', Asset>
  deleted: BaseEvent<'asset.deleted', { id: string }>
  depreciated: BaseEvent<'asset.depreciated', { assetId: string; depreciationId: string }>
  disposed: BaseEvent<'asset.disposed', Asset>
  revalued: BaseEvent<'asset.revalued', Asset>
}

// =============================================================================
// Resources (Actions + Events)
// =============================================================================

export interface AccountResource extends AccountActions {
  on: <K extends keyof AccountEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AccountEvents[K], TProxy>
  ) => () => void
}

export interface TransactionResource extends TransactionActions {
  on: <K extends keyof TransactionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TransactionEvents[K], TProxy>
  ) => () => void
}

export interface JournalEntryResource extends JournalEntryActions {
  on: <K extends keyof JournalEntryEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<JournalEntryEvents[K], TProxy>
  ) => () => void
}

export interface InvoiceResource extends InvoiceActions {
  on: <K extends keyof InvoiceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<InvoiceEvents[K], TProxy>
  ) => () => void
}

export interface BillResource extends BillActions {
  on: <K extends keyof BillEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<BillEvents[K], TProxy>
  ) => () => void
}

export interface PaymentResource extends PaymentActions {
  on: <K extends keyof PaymentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PaymentEvents[K], TProxy>
  ) => () => void
}

export interface ReceiptResource extends ReceiptActions {
  on: <K extends keyof ReceiptEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ReceiptEvents[K], TProxy>
  ) => () => void
}

export interface BudgetResource extends BudgetActions {
  on: <K extends keyof BudgetEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<BudgetEvents[K], TProxy>
  ) => () => void
}

export interface BudgetItemResource extends CRUDResource<BudgetItem, BudgetItemInput> {}

export interface ForecastResource extends ForecastActions {
  on: <K extends keyof ForecastEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ForecastEvents[K], TProxy>
  ) => () => void
}

export interface TaxRateResource extends TaxRateActions {}

export interface TaxFilingResource extends TaxFilingActions {}

export interface BankAccountResource extends BankAccountActions {}

export interface BankTransactionResource extends BankTransactionActions {}

export interface ReconciliationResource extends ReconciliationActions {
  on: <K extends keyof ReconciliationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ReconciliationEvents[K], TProxy>
  ) => () => void
}

export interface FinancialReportResource extends FinancialReportActions {}

export interface ExpenseReportResource extends ExpenseReportActions {
  on: <K extends keyof ExpenseReportEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ExpenseReportEvents[K], TProxy>
  ) => () => void
}

export interface ExpenseItemResource extends ExpenseItemActions {}

export interface PayrollResource extends PayrollActions {
  on: <K extends keyof PayrollEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PayrollEvents[K], TProxy>
  ) => () => void
}

export interface PayrollItemResource extends PayrollItemActions {}

export interface AssetResource extends AssetActions {
  on: <K extends keyof AssetEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AssetEvents[K], TProxy>
  ) => () => void
}

export interface DepreciationResource extends DepreciationActions {}

export interface CurrencyResource extends CurrencyActions {}

export interface ExchangeRateResource extends ExchangeRateActions {}

// =============================================================================
// Finance Proxy - Combined Interface
// =============================================================================

/**
 * Finance proxy combining all finance resources.
 *
 * Provides unified access to all financial management
 * capabilities including accounting, invoicing, expenses,
 * budgeting, and reporting.
 *
 * @example
 * ```ts
 * // Access via RPC proxy
 * const invoice = await $.finance.invoices.create({
 *   customerId: 'cust_123',
 *   items: [{ description: 'Service', quantity: 1, rate: 1000, amount: 1000 }],
 *   total: 1000
 * })
 *
 * // Listen to events
 * $.finance.invoices.on('paid', async (event, ctx) => {
 *   console.log('Invoice paid:', event.data.id)
 * })
 * ```
 */
export interface FinanceProxy {
  /** Account management */
  accounts: AccountResource

  /** Transaction management */
  transactions: TransactionResource

  /** Journal entry management */
  journalEntries: JournalEntryResource

  /** Invoice management */
  invoices: InvoiceResource

  /** Bill management */
  bills: BillResource

  /** Payment management */
  payments: PaymentResource

  /** Receipt management */
  receipts: ReceiptResource

  /** Budget management */
  budgets: BudgetResource

  /** Budget item management */
  budgetItems: BudgetItemResource

  /** Forecast management */
  forecasts: ForecastResource

  /** Tax rate management */
  taxRates: TaxRateResource

  /** Tax filing management */
  taxFilings: TaxFilingResource

  /** Bank account management */
  bankAccounts: BankAccountResource

  /** Bank transaction management */
  bankTransactions: BankTransactionResource

  /** Reconciliation management */
  reconciliations: ReconciliationResource

  /** Financial report management */
  financialReports: FinancialReportResource

  /** Expense report management */
  expenseReports: ExpenseReportResource

  /** Expense item management */
  expenseItems: ExpenseItemResource

  /** Payroll management */
  payrolls: PayrollResource

  /** Payroll item management */
  payrollItems: PayrollItemResource

  /** Asset management */
  assets: AssetResource

  /** Depreciation management */
  depreciations: DepreciationResource

  /** Currency management */
  currencies: CurrencyResource

  /** Exchange rate management */
  exchangeRates: ExchangeRateResource
}
