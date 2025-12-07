/**
 * Financial Entity Types (Nouns)
 *
 * Financial entities: Budget, Revenue, Expense, Investment, FinancialPeriod.
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Budget
// =============================================================================

/**
 * Budget entity
 *
 * Represents a budget allocation.
 */
export const Budget: Noun = {
  singular: 'budget',
  plural: 'budgets',
  description: 'A budget allocation',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Budget name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Budget description',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Budget type',
      examples: ['operating', 'capital', 'project', 'marketing', 'hiring', 'r&d'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Budget category',
    },

    // Period
    period: {
      type: 'string',
      optional: true,
      description: 'Budget period (e.g., "Q1 2025", "FY2025")',
    },
    startDate: {
      type: 'date',
      optional: true,
      description: 'Period start date',
    },
    endDate: {
      type: 'date',
      optional: true,
      description: 'Period end date',
    },

    // Amounts
    amount: {
      type: 'number',
      description: 'Budgeted amount',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },
    spent: {
      type: 'number',
      optional: true,
      description: 'Amount spent',
    },
    committed: {
      type: 'number',
      optional: true,
      description: 'Amount committed',
    },
    available: {
      type: 'number',
      optional: true,
      description: 'Available amount',
    },

    // Utilization
    utilization: {
      type: 'number',
      optional: true,
      description: 'Utilization percentage',
    },

    // Status
    status: {
      type: 'string',
      description: 'Budget status',
      examples: ['draft', 'approved', 'active', 'frozen', 'closed'],
    },
  },

  relationships: {
    owner: {
      type: 'Worker',
      required: false,
      description: 'Budget owner',
    },
    department: {
      type: 'Department',
      required: false,
      description: 'Owning department',
    },
    team: {
      type: 'Team',
      required: false,
      description: 'Owning team',
    },
    expenses: {
      type: 'Expense[]',
      description: 'Budget expenses',
    },
    parent: {
      type: 'Budget',
      required: false,
      description: 'Parent budget',
    },
    children: {
      type: 'Budget[]',
      description: 'Sub-budgets',
    },
  },

  actions: [
    'create',
    'update',
    'submit',
    'approve',
    'allocate',
    'reallocate',
    'freeze',
    'unfreeze',
    'close',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'submitted',
    'approved',
    'allocated',
    'reallocated',
    'frozen',
    'unfrozen',
    'thresholdWarning',
    'overBudget',
    'closed',
    'archived',
  ],
}

// =============================================================================
// Revenue
// =============================================================================

/**
 * Revenue entity
 *
 * Represents a revenue record.
 */
export const Revenue: Noun = {
  singular: 'revenue',
  plural: 'revenues',
  description: 'A revenue record',

  properties: {
    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Revenue type',
      examples: ['subscription', 'one-time', 'usage', 'professional-services', 'licensing', 'other'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Revenue category',
    },
    source: {
      type: 'string',
      optional: true,
      description: 'Revenue source',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Revenue amount',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Period
    period: {
      type: 'string',
      optional: true,
      description: 'Revenue period',
    },
    date: {
      type: 'date',
      optional: true,
      description: 'Revenue date',
    },

    // Recurring
    isRecurring: {
      type: 'boolean',
      optional: true,
      description: 'Is recurring revenue',
    },
    recurringPeriod: {
      type: 'string',
      optional: true,
      description: 'Recurring period',
      examples: ['monthly', 'quarterly', 'yearly'],
    },

    // Recognition
    recognized: {
      type: 'boolean',
      optional: true,
      description: 'Revenue recognized',
    },
    recognizedAt: {
      type: 'date',
      optional: true,
      description: 'Recognition date',
    },
    deferredAmount: {
      type: 'number',
      optional: true,
      description: 'Deferred revenue amount',
    },

    // Attribution
    segment: {
      type: 'string',
      optional: true,
      description: 'Business segment',
    },
    region: {
      type: 'string',
      optional: true,
      description: 'Geographic region',
    },
  },

  relationships: {
    product: {
      type: 'Product',
      required: false,
      description: 'Revenue product',
    },
    service: {
      type: 'Service',
      required: false,
      description: 'Revenue service',
    },
    customer: {
      type: 'Customer',
      required: false,
      description: 'Customer',
    },
    period: {
      type: 'FinancialPeriod',
      required: false,
      description: 'Financial period',
    },
  },

  actions: [
    'record',
    'update',
    'recognize',
    'defer',
    'void',
  ],

  events: [
    'recorded',
    'updated',
    'recognized',
    'deferred',
    'voided',
  ],
}

// =============================================================================
// Expense
// =============================================================================

/**
 * Expense entity
 *
 * Represents an expense record.
 */
export const Expense: Noun = {
  singular: 'expense',
  plural: 'expenses',
  description: 'An expense record',

  properties: {
    // Identity
    description: {
      type: 'string',
      description: 'Expense description',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Expense type',
      examples: ['payroll', 'cogs', 'marketing', 'sales', 'r&d', 'g&a', 'facilities', 'travel', 'software', 'services'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Expense category',
    },
    subcategory: {
      type: 'string',
      optional: true,
      description: 'Expense subcategory',
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Expense amount',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Date
    date: {
      type: 'date',
      description: 'Expense date',
    },
    period: {
      type: 'string',
      optional: true,
      description: 'Expense period',
    },

    // Recurring
    isRecurring: {
      type: 'boolean',
      optional: true,
      description: 'Is recurring expense',
    },
    recurringPeriod: {
      type: 'string',
      optional: true,
      description: 'Recurring period',
    },

    // Classification
    isCapex: {
      type: 'boolean',
      optional: true,
      description: 'Is capital expenditure',
    },
    isDeductible: {
      type: 'boolean',
      optional: true,
      description: 'Is tax deductible',
    },

    // Vendor
    vendor: {
      type: 'string',
      optional: true,
      description: 'Vendor name',
    },
    invoiceNumber: {
      type: 'string',
      optional: true,
      description: 'Invoice number',
    },

    // Status
    status: {
      type: 'string',
      description: 'Expense status',
      examples: ['draft', 'submitted', 'approved', 'rejected', 'paid', 'voided'],
    },
  },

  relationships: {
    submitter: {
      type: 'Worker',
      required: false,
      description: 'Who submitted',
    },
    approver: {
      type: 'Worker',
      required: false,
      description: 'Who approved',
    },
    budget: {
      type: 'Budget',
      required: false,
      description: 'Budget charged',
    },
    department: {
      type: 'Department',
      required: false,
      description: 'Department',
    },
    period: {
      type: 'FinancialPeriod',
      required: false,
      description: 'Financial period',
    },
  },

  actions: [
    'create',
    'update',
    'submit',
    'approve',
    'reject',
    'pay',
    'void',
  ],

  events: [
    'created',
    'updated',
    'submitted',
    'approved',
    'rejected',
    'paid',
    'voided',
  ],
}

// =============================================================================
// Investment
// =============================================================================

/**
 * Investment entity
 *
 * Represents a funding or investment round.
 */
export const Investment: Noun = {
  singular: 'investment',
  plural: 'investments',
  description: 'A funding or investment round',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Investment name/round',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Investment description',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Investment type',
      examples: ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'series-d', 'growth', 'debt', 'grant'],
    },
    instrumentType: {
      type: 'string',
      optional: true,
      description: 'Instrument type',
      examples: ['equity', 'safe', 'convertible-note', 'debt', 'revenue-based'],
    },

    // Amount
    amount: {
      type: 'number',
      description: 'Investment amount',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Valuation
    preMoneyValuation: {
      type: 'number',
      optional: true,
      description: 'Pre-money valuation',
    },
    postMoneyValuation: {
      type: 'number',
      optional: true,
      description: 'Post-money valuation',
    },
    valuationCap: {
      type: 'number',
      optional: true,
      description: 'Valuation cap (for SAFEs/convertibles)',
    },
    discount: {
      type: 'number',
      optional: true,
      description: 'Discount percentage',
    },

    // Equity
    equityPercentage: {
      type: 'number',
      optional: true,
      description: 'Equity percentage sold',
    },
    sharesIssued: {
      type: 'number',
      optional: true,
      description: 'Shares issued',
    },
    pricePerShare: {
      type: 'number',
      optional: true,
      description: 'Price per share',
    },

    // Timeline
    announcedAt: {
      type: 'date',
      optional: true,
      description: 'Announcement date',
    },
    closedAt: {
      type: 'date',
      optional: true,
      description: 'Closing date',
    },

    // Terms
    interestRate: {
      type: 'number',
      optional: true,
      description: 'Interest rate (for debt)',
    },
    maturityDate: {
      type: 'date',
      optional: true,
      description: 'Maturity date (for debt)',
    },

    // Lead
    leadInvestor: {
      type: 'string',
      optional: true,
      description: 'Lead investor',
    },
    investors: {
      type: 'string',
      array: true,
      optional: true,
      description: 'All investors',
    },

    // Status
    status: {
      type: 'string',
      description: 'Investment status',
      examples: ['prospecting', 'negotiating', 'term-sheet', 'due-diligence', 'closing', 'closed', 'cancelled'],
    },
  },

  relationships: {
    business: {
      type: 'Business',
      description: 'Business receiving investment',
    },
  },

  actions: [
    'create',
    'update',
    'negotiate',
    'signTermSheet',
    'close',
    'announce',
    'cancel',
  ],

  events: [
    'created',
    'updated',
    'negotiated',
    'termSheetSigned',
    'closed',
    'announced',
    'cancelled',
  ],
}

// =============================================================================
// FinancialPeriod
// =============================================================================

/**
 * FinancialPeriod entity
 *
 * Represents a financial reporting period.
 */
export const FinancialPeriod: Noun = {
  singular: 'financial-period',
  plural: 'financial-periods',
  description: 'A financial reporting period',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Period name (e.g., "Q1 2025", "FY2025")',
    },

    // Type
    type: {
      type: 'string',
      description: 'Period type',
      examples: ['month', 'quarter', 'half-year', 'year'],
    },

    // Dates
    startDate: {
      type: 'date',
      description: 'Period start date',
    },
    endDate: {
      type: 'date',
      description: 'Period end date',
    },

    // Financials
    revenue: {
      type: 'number',
      optional: true,
      description: 'Total revenue',
    },
    cogs: {
      type: 'number',
      optional: true,
      description: 'Cost of goods sold',
    },
    grossProfit: {
      type: 'number',
      optional: true,
      description: 'Gross profit',
    },
    grossMargin: {
      type: 'number',
      optional: true,
      description: 'Gross margin percentage',
    },
    operatingExpenses: {
      type: 'number',
      optional: true,
      description: 'Operating expenses',
    },
    operatingIncome: {
      type: 'number',
      optional: true,
      description: 'Operating income (EBIT)',
    },
    operatingMargin: {
      type: 'number',
      optional: true,
      description: 'Operating margin percentage',
    },
    netIncome: {
      type: 'number',
      optional: true,
      description: 'Net income',
    },
    netMargin: {
      type: 'number',
      optional: true,
      description: 'Net margin percentage',
    },
    ebitda: {
      type: 'number',
      optional: true,
      description: 'EBITDA',
    },
    ebitdaMargin: {
      type: 'number',
      optional: true,
      description: 'EBITDA margin percentage',
    },

    // Cash
    cashStart: {
      type: 'number',
      optional: true,
      description: 'Cash at start',
    },
    cashEnd: {
      type: 'number',
      optional: true,
      description: 'Cash at end',
    },
    cashFlow: {
      type: 'number',
      optional: true,
      description: 'Net cash flow',
    },
    burnRate: {
      type: 'number',
      optional: true,
      description: 'Monthly burn rate',
    },
    runway: {
      type: 'number',
      optional: true,
      description: 'Runway in months',
    },

    // SaaS Metrics
    mrr: {
      type: 'number',
      optional: true,
      description: 'Monthly recurring revenue',
    },
    arr: {
      type: 'number',
      optional: true,
      description: 'Annual recurring revenue',
    },
    nrr: {
      type: 'number',
      optional: true,
      description: 'Net revenue retention',
    },
    grr: {
      type: 'number',
      optional: true,
      description: 'Gross revenue retention',
    },
    customers: {
      type: 'number',
      optional: true,
      description: 'Customer count',
    },
    arpu: {
      type: 'number',
      optional: true,
      description: 'Average revenue per user',
    },
    cac: {
      type: 'number',
      optional: true,
      description: 'Customer acquisition cost',
    },
    ltv: {
      type: 'number',
      optional: true,
      description: 'Lifetime value',
    },
    ltvCacRatio: {
      type: 'number',
      optional: true,
      description: 'LTV:CAC ratio',
    },
    churnRate: {
      type: 'number',
      optional: true,
      description: 'Churn rate',
    },

    // Currency
    currency: {
      type: 'string',
      optional: true,
      description: 'Reporting currency',
    },

    // Status
    status: {
      type: 'string',
      description: 'Period status',
      examples: ['open', 'closed', 'audited'],
    },
  },

  relationships: {
    business: {
      type: 'Business',
      description: 'Business',
    },
    revenues: {
      type: 'Revenue[]',
      description: 'Period revenues',
    },
    expenses: {
      type: 'Expense[]',
      description: 'Period expenses',
    },
    budgets: {
      type: 'Budget[]',
      description: 'Period budgets',
    },
    previous: {
      type: 'FinancialPeriod',
      required: false,
      description: 'Previous period',
    },
  },

  actions: [
    'create',
    'update',
    'close',
    'reopen',
    'audit',
  ],

  events: [
    'created',
    'updated',
    'closed',
    'reopened',
    'audited',
  ],
}

// =============================================================================
// Forecast
// =============================================================================

/**
 * Forecast entity
 *
 * Represents a financial forecast.
 */
export const Forecast: Noun = {
  singular: 'forecast',
  plural: 'forecasts',
  description: 'A financial forecast',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Forecast name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Forecast description',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Forecast type',
      examples: ['revenue', 'expense', 'cash', 'headcount', 'arr'],
    },
    scenario: {
      type: 'string',
      optional: true,
      description: 'Scenario',
      examples: ['base', 'optimistic', 'pessimistic', 'stretch'],
    },

    // Period
    startDate: {
      type: 'date',
      description: 'Forecast start date',
    },
    endDate: {
      type: 'date',
      description: 'Forecast end date',
    },
    granularity: {
      type: 'string',
      optional: true,
      description: 'Forecast granularity',
      examples: ['monthly', 'quarterly', 'yearly'],
    },

    // Values
    values: {
      type: 'json',
      optional: true,
      description: 'Forecast values by period',
    },
    total: {
      type: 'number',
      optional: true,
      description: 'Total forecasted amount',
    },
    currency: {
      type: 'string',
      optional: true,
      description: 'Currency code',
    },

    // Assumptions
    assumptions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Forecast assumptions',
    },
    growthRate: {
      type: 'number',
      optional: true,
      description: 'Assumed growth rate',
    },

    // Accuracy
    confidenceLevel: {
      type: 'number',
      optional: true,
      description: 'Confidence level (0-100)',
    },

    // Versioning
    version: {
      type: 'number',
      optional: true,
      description: 'Forecast version',
    },

    // Status
    status: {
      type: 'string',
      description: 'Forecast status',
      examples: ['draft', 'review', 'approved', 'superseded'],
    },
  },

  relationships: {
    owner: {
      type: 'Worker',
      required: false,
      description: 'Forecast owner',
    },
    basedOn: {
      type: 'FinancialPeriod[]',
      description: 'Historical periods used',
    },
  },

  actions: [
    'create',
    'update',
    'submit',
    'approve',
    'supersede',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'submitted',
    'approved',
    'superseded',
    'archived',
  ],
}

// =============================================================================
// Exports
// =============================================================================

export const FinancialEntities = {
  Budget,
  Revenue,
  Expense,
  Investment,
  FinancialPeriod,
  Forecast,
}

export const FinancialCategories = {
  planning: ['Budget', 'Forecast'],
  transactions: ['Revenue', 'Expense'],
  funding: ['Investment'],
  reporting: ['FinancialPeriod'],
} as const
