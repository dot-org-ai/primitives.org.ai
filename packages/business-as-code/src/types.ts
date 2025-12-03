/**
 * Core types for business-as-code primitives
 */

/**
 * Currency types supported by the system
 */
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | 'CAD' | 'AUD' | string

/**
 * Time period for metrics and financial calculations
 */
export type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

/**
 * Business entity definition
 */
export interface BusinessDefinition {
  /** Business name */
  name: string
  /** Business description */
  description?: string
  /** Industry/sector */
  industry?: string
  /** Mission statement */
  mission?: string
  /** Core values */
  values?: string[]
  /** Target market */
  targetMarket?: string
  /** Founding date */
  foundedAt?: Date
  /** Team size */
  teamSize?: number
  /** Organizational structure */
  structure?: OrganizationalStructure
  /** Business metadata */
  metadata?: Record<string, unknown>
}

/**
 * Goal definition
 */
export interface GoalDefinition {
  /** Goal name/title */
  name: string
  /** Goal description */
  description?: string
  /** Goal category */
  category?: 'strategic' | 'operational' | 'financial' | 'customer' | 'internal' | 'learning'
  /** Target completion date */
  targetDate?: Date
  /** Owner responsible for the goal */
  owner?: string
  /** Success metrics */
  metrics?: string[]
  /** Current status */
  status?: 'not-started' | 'in-progress' | 'at-risk' | 'completed' | 'cancelled'
  /** Progress percentage */
  progress?: number
  /** Dependencies on other goals */
  dependencies?: string[]
  /** Goal metadata */
  metadata?: Record<string, unknown>
}

/**
 * Department definition
 */
export interface Department {
  /** Department name */
  name: string
  /** Department description */
  description?: string
  /** Department head */
  head?: string
  /** Team members */
  members?: string[]
  /** Department budget */
  budget?: number
  /** Department goals */
  goals?: GoalDefinition[]
}

/**
 * Team definition
 */
export interface Team {
  /** Team name */
  name: string
  /** Team description */
  description?: string
  /** Team lead */
  lead?: string
  /** Team members */
  members?: string[]
  /** Team objectives */
  objectives?: string[]
}

/**
 * Organizational structure
 */
export interface OrganizationalStructure {
  /** Departments/divisions */
  departments?: Department[]
  /** Reporting hierarchy */
  hierarchy?: Record<string, string[]>
  /** Team compositions */
  teams?: Team[]
}

/**
 * Vision statement definition
 */
export interface VisionDefinition {
  /** Vision statement */
  statement: string
  /** Target timeframe */
  timeframe?: string
  /** Success indicators */
  successIndicators?: string[]
  /** Vision metadata */
  metadata?: Record<string, unknown>
}

/**
 * Product definition
 */
export interface ProductDefinition {
  /** Product name */
  name: string
  /** Product description */
  description?: string
  /** Product category */
  category?: string
  /** Target customer segment */
  targetSegment?: string
  /** Value proposition */
  valueProposition?: string
  /** Pricing model */
  pricingModel?: 'one-time' | 'subscription' | 'usage-based' | 'freemium' | 'tiered'
  /** Price */
  price?: number
  /** Currency */
  currency?: Currency
  /** Cost of goods sold */
  cogs?: number
  /** Features */
  features?: string[]
  /** Product roadmap */
  roadmap?: RoadmapItem[]
  /** Product metadata */
  metadata?: Record<string, unknown>
}

/**
 * Service definition
 */
export interface ServiceDefinition {
  /** Service name */
  name: string
  /** Service description */
  description?: string
  /** Service category */
  category?: string
  /** Target customer segment */
  targetSegment?: string
  /** Value proposition */
  valueProposition?: string
  /** Pricing model */
  pricingModel?: 'hourly' | 'fixed' | 'retainer' | 'value-based'
  /** Base price */
  price?: number
  /** Currency */
  currency?: Currency
  /** Estimated delivery time */
  deliveryTime?: string
  /** Service level agreement */
  sla?: ServiceLevelAgreement
  /** Service metadata */
  metadata?: Record<string, unknown>
}

/**
 * Roadmap item for products
 */
export interface RoadmapItem {
  /** Item name */
  name: string
  /** Description */
  description?: string
  /** Target quarter/date */
  targetDate?: Date
  /** Priority */
  priority?: 'critical' | 'high' | 'medium' | 'low'
  /** Status */
  status?: 'planned' | 'in-progress' | 'completed' | 'cancelled'
}

/**
 * Service level agreement
 */
export interface ServiceLevelAgreement {
  /** Uptime percentage */
  uptime?: number
  /** Response time */
  responseTime?: string
  /** Support hours */
  supportHours?: string
  /** Penalties for SLA violations */
  penalties?: string
}

/**
 * Business process definition
 */
export interface ProcessDefinition {
  /** Process name */
  name: string
  /** Process description */
  description?: string
  /** Process category */
  category?: 'core' | 'support' | 'management'
  /** Process owner */
  owner?: string
  /** Process steps */
  steps?: ProcessStep[]
  /** Inputs required */
  inputs?: string[]
  /** Outputs produced */
  outputs?: string[]
  /** Process metrics */
  metrics?: ProcessMetric[]
  /** Process metadata */
  metadata?: Record<string, unknown>
}

/**
 * Process step definition
 */
export interface ProcessStep {
  /** Step number */
  order: number
  /** Step name */
  name: string
  /** Step description */
  description?: string
  /** Responsible role/person */
  responsible?: string
  /** Estimated duration */
  duration?: string
  /** Step automation level */
  automationLevel?: 'manual' | 'semi-automated' | 'automated'
}

/**
 * Process metric
 */
export interface ProcessMetric {
  /** Metric name */
  name: string
  /** Metric description */
  description?: string
  /** Target value */
  target?: number
  /** Current value */
  current?: number
  /** Unit of measurement */
  unit?: string
}

/**
 * Workflow definition (automation sequence)
 */
export interface WorkflowDefinition {
  /** Workflow name */
  name: string
  /** Workflow description */
  description?: string
  /** Trigger conditions */
  trigger?: WorkflowTrigger
  /** Workflow actions */
  actions?: WorkflowAction[]
  /** Workflow metadata */
  metadata?: Record<string, unknown>
}

/**
 * Workflow trigger
 */
export interface WorkflowTrigger {
  /** Trigger type */
  type: 'event' | 'schedule' | 'webhook' | 'manual'
  /** Event name (for event triggers) */
  event?: string
  /** Schedule expression (for scheduled triggers) */
  schedule?: string
  /** Webhook URL (for webhook triggers) */
  webhook?: string
}

/**
 * Workflow action
 */
export interface WorkflowAction {
  /** Action order */
  order: number
  /** Action type */
  type: 'send' | 'create' | 'update' | 'delete' | 'notify' | 'call' | 'wait'
  /** Action description */
  description?: string
  /** Action parameters */
  params?: Record<string, unknown>
  /** Condition for executing this action */
  condition?: string
}

/**
 * Key Performance Indicator
 */
export interface KPIDefinition {
  /** KPI name */
  name: string
  /** KPI description */
  description?: string
  /** KPI category */
  category?: 'financial' | 'customer' | 'operations' | 'people' | 'growth'
  /** Measurement unit */
  unit?: string
  /** Target value */
  target?: number
  /** Current value */
  current?: number
  /** Measurement frequency */
  frequency?: TimePeriod
  /** Data source */
  dataSource?: string
  /** Calculation formula */
  formula?: string
  /** KPI metadata */
  metadata?: Record<string, unknown>
}

/**
 * Objective and Key Results (OKR)
 */
export interface OKRDefinition {
  /** Objective statement */
  objective: string
  /** Objective description */
  description?: string
  /** Time period */
  period?: string
  /** Owner */
  owner?: string
  /** Key results */
  keyResults?: KeyResult[]
  /** Status */
  status?: 'not-started' | 'on-track' | 'at-risk' | 'completed'
  /** Confidence level */
  confidence?: number
  /** OKR metadata */
  metadata?: Record<string, unknown>
}

/**
 * Key result within an OKR
 */
export interface KeyResult {
  /** Key result description */
  description: string
  /** Metric to measure */
  metric: string
  /** Starting value */
  startValue?: number
  /** Target value */
  targetValue: number
  /** Current value */
  currentValue?: number
  /** Unit of measurement */
  unit?: string
  /** Progress percentage */
  progress?: number
}

/**
 * Financial metrics and calculations
 */
export interface FinancialMetrics {
  /** Revenue */
  revenue?: number
  /** Cost of goods sold */
  cogs?: number
  /** Gross profit */
  grossProfit?: number
  /** Gross margin percentage */
  grossMargin?: number
  /** Operating expenses */
  operatingExpenses?: number
  /** Operating income */
  operatingIncome?: number
  /** Operating margin percentage */
  operatingMargin?: number
  /** Net income */
  netIncome?: number
  /** Net margin percentage */
  netMargin?: number
  /** EBITDA */
  ebitda?: number
  /** EBITDA margin percentage */
  ebitdaMargin?: number
  /** Cash flow from operations */
  operatingCashFlow?: number
  /** Free cash flow */
  freeCashFlow?: number
  /** Currency */
  currency?: Currency
  /** Period */
  period?: TimePeriod
}

/**
 * Financial statement data
 */
export interface FinancialStatement {
  /** Statement type */
  type: 'income' | 'balance-sheet' | 'cash-flow'
  /** Period */
  period: string
  /** Line items */
  lineItems: Record<string, number>
  /** Currency */
  currency: Currency
  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Business context for $ helper
 */
export interface BusinessContext {
  /** Current business entity */
  business?: BusinessDefinition
  /** Active goals */
  goals?: GoalDefinition[]
  /** Active OKRs */
  okrs?: OKRDefinition[]
  /** Tracked KPIs */
  kpis?: KPIDefinition[]
  /** Financial data */
  financials?: FinancialMetrics
  /** Custom context data */
  [key: string]: unknown
}

/**
 * $ helper for business operations
 */
export interface BusinessOperations {
  /** Format currency value */
  format: (amount: number, currency?: Currency) => string

  /** Calculate percentage */
  percent: (value: number, total: number) => number

  /** Calculate growth rate */
  growth: (current: number, previous: number) => number

  /** Calculate margin */
  margin: (revenue: number, cost: number) => number

  /** Calculate return on investment */
  roi: (gain: number, cost: number) => number

  /** Calculate customer lifetime value */
  ltv: (averageValue: number, frequency: number, lifetime: number) => number

  /** Calculate customer acquisition cost */
  cac: (marketingSpend: number, newCustomers: number) => number

  /** Calculate burn rate */
  burnRate: (cashStart: number, cashEnd: number, months: number) => number

  /** Calculate runway */
  runway: (cash: number, burnRate: number) => number

  /** Access business context */
  context: BusinessContext

  /** Log business event */
  log: (event: string, data?: unknown) => void
}
