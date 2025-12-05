/**
 * Standardized SaaS Metrics
 *
 * First-class types for common SaaS/subscription business metrics
 * with auto-calculation over time periods.
 *
 * @packageDocumentation
 */

import type { Currency, TimePeriod } from './types.js'

// =============================================================================
// Time Period Types
// =============================================================================

/**
 * Date range for metric calculations
 */
export interface DateRange {
  start: Date
  end: Date
}

/**
 * Time period with explicit dates
 */
export interface MetricPeriod {
  period: TimePeriod
  range: DateRange
  label?: string // e.g., "Q4 2024", "December 2024"
}

/**
 * Time-series data point
 */
export interface DataPoint<T = number> {
  timestamp: Date
  value: T
  metadata?: Record<string, unknown>
}

/**
 * Time series of metric values
 */
export interface TimeSeries<T = number> {
  metric: string
  unit: string
  dataPoints: DataPoint<T>[]
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'last' | 'first'
}

// =============================================================================
// Revenue Metrics
// =============================================================================

/**
 * Monthly Recurring Revenue (MRR)
 */
export interface MRR {
  total: number
  newMRR: number           // From new customers
  expansionMRR: number     // From upgrades
  contractionMRR: number   // From downgrades
  churnedMRR: number       // From cancellations
  reactivationMRR: number  // From reactivations
  netNewMRR: number        // newMRR + expansionMRR - contractionMRR - churnedMRR + reactivationMRR
  currency: Currency
  period: MetricPeriod
}

/**
 * Annual Recurring Revenue (ARR)
 */
export interface ARR {
  total: number
  fromMRR?: number         // MRR * 12
  contracted?: number      // From annual contracts
  currency: Currency
  asOf: Date
}

/**
 * Net Revenue Retention (NRR) / Dollar-based Net Retention (DBNR)
 */
export interface NRR {
  rate: number             // Percentage (e.g., 115 = 115%)
  startingMRR: number
  endingMRR: number
  expansion: number
  contraction: number
  churn: number
  period: MetricPeriod
}

/**
 * Gross Revenue Retention (GRR)
 */
export interface GRR {
  rate: number             // Percentage (max 100%)
  startingMRR: number
  endingMRR: number
  contraction: number
  churn: number
  period: MetricPeriod
}

/**
 * Average Revenue Per User/Account
 */
export interface ARPU {
  value: number
  totalRevenue: number
  totalUsers: number
  currency: Currency
  period: MetricPeriod
  segment?: string         // Optional segment (e.g., "enterprise", "smb")
}

/**
 * Revenue by segment/cohort
 */
export interface RevenueSegment {
  name: string
  mrr: number
  arr: number
  customers: number
  arpu: number
  growth: number           // MoM or YoY growth rate
  currency: Currency
}

// =============================================================================
// Customer Metrics
// =============================================================================

/**
 * Customer Acquisition Cost (CAC)
 */
export interface CAC {
  value: number
  totalSalesMarketingSpend: number
  newCustomersAcquired: number
  currency: Currency
  period: MetricPeriod
  byChannel?: Record<string, number>
}

/**
 * Customer Lifetime Value (LTV/CLV)
 */
export interface LTV {
  value: number
  arpu: number
  grossMargin: number      // Percentage
  churnRate: number        // Monthly churn rate
  averageLifetimeMonths: number
  currency: Currency
}

/**
 * LTV:CAC Ratio
 */
export interface LTVtoCAC {
  ratio: number
  ltv: number
  cac: number
  paybackMonths: number    // CAC / (ARPU * Gross Margin)
  healthy: boolean         // > 3 is generally healthy
}

/**
 * Churn metrics
 */
export interface Churn {
  // Customer churn (logo churn)
  customerChurnRate: number    // Percentage
  customersLost: number
  customersStart: number

  // Revenue churn
  revenueChurnRate: number     // Percentage (gross churn)
  mrrChurned: number

  // Net revenue churn (can be negative with good expansion)
  netRevenueChurnRate: number

  period: MetricPeriod
}

/**
 * Retention cohort
 */
export interface RetentionCohort {
  cohortDate: Date
  cohortLabel: string          // e.g., "Jan 2024"
  initialCustomers: number
  initialMRR: number
  retentionByMonth: number[]   // Array of retention rates by month
  revenueByMonth: number[]     // Array of MRR by month
}

// =============================================================================
// Growth Metrics
// =============================================================================

/**
 * Growth rate metrics
 */
export interface GrowthRate {
  mom: number              // Month-over-month
  qoq: number              // Quarter-over-quarter
  yoy: number              // Year-over-year
  cagr?: number            // Compound annual growth rate
  metric: string           // What metric this growth rate is for
  period: MetricPeriod
}

/**
 * Quick ratio (growth efficiency)
 * (New MRR + Expansion MRR) / (Churned MRR + Contraction MRR)
 */
export interface QuickRatio {
  ratio: number
  newMRR: number
  expansionMRR: number
  churnedMRR: number
  contractionMRR: number
  healthy: boolean         // > 4 is good, > 1 means growing
  period: MetricPeriod
}

// =============================================================================
// Efficiency Metrics
// =============================================================================

/**
 * Magic Number
 * Net New ARR / Sales & Marketing Spend (previous quarter)
 */
export interface MagicNumber {
  value: number
  netNewARR: number
  salesMarketingSpend: number
  efficient: boolean       // > 0.75 is efficient
  period: MetricPeriod
}

/**
 * Burn Multiple
 * Net Burn / Net New ARR
 */
export interface BurnMultiple {
  value: number
  netBurn: number
  netNewARR: number
  efficient: boolean       // < 1.5 is good
  period: MetricPeriod
}

/**
 * Rule of 40
 * Growth Rate + Profit Margin >= 40%
 */
export interface RuleOf40 {
  score: number
  revenueGrowthRate: number
  profitMargin: number     // Or EBITDA margin
  passing: boolean         // >= 40 is passing
  period: MetricPeriod
}

/**
 * SaaS Efficiency Score
 * Combines multiple efficiency metrics
 */
export interface EfficiencyScore {
  overall: number          // 0-100 score
  components: {
    ltvCacRatio: number
    magicNumber: number
    quickRatio: number
    nrr: number
    ruleOf40: number
  }
  period: MetricPeriod
}

// =============================================================================
// Pipeline & Sales Metrics
// =============================================================================

/**
 * Sales pipeline metrics
 */
export interface Pipeline {
  totalValue: number
  weightedValue: number    // Probability-adjusted
  stages: PipelineStage[]
  velocity: number         // Average days to close
  conversionRate: number   // Win rate
  currency: Currency
  asOf: Date
}

/**
 * Pipeline stage
 */
export interface PipelineStage {
  name: string
  value: number
  count: number
  probability: number
  averageDaysInStage: number
}

/**
 * Sales velocity
 * (Opportunities * Win Rate * Average Deal Size) / Sales Cycle Length
 */
export interface SalesVelocity {
  value: number            // Revenue per day
  opportunities: number
  winRate: number
  averageDealSize: number
  salesCycleLength: number // Days
  currency: Currency
  period: MetricPeriod
}

// =============================================================================
// Operational Metrics
// =============================================================================

/**
 * Net Promoter Score
 */
export interface NPS {
  score: number            // -100 to 100
  promoters: number        // 9-10
  passives: number         // 7-8
  detractors: number       // 0-6
  responses: number
  responseRate?: number
  asOf: Date
}

/**
 * Customer health score
 */
export interface CustomerHealth {
  averageScore: number     // 0-100
  healthy: number          // Count
  atRisk: number           // Count
  critical: number         // Count
  factors: HealthFactor[]
  asOf: Date
}

/**
 * Health factor
 */
export interface HealthFactor {
  name: string
  weight: number
  score: number
}

// =============================================================================
// Financial Summary
// =============================================================================

/**
 * Comprehensive SaaS metrics snapshot
 */
export interface SaaSMetrics {
  // Revenue
  mrr: MRR
  arr: ARR
  nrr: NRR
  grr: GRR
  arpu: ARPU

  // Customers
  cac: CAC
  ltv: LTV
  ltvCac: LTVtoCAC
  churn: Churn

  // Growth
  growthRate: GrowthRate
  quickRatio: QuickRatio

  // Efficiency
  magicNumber?: MagicNumber
  burnMultiple?: BurnMultiple
  ruleOf40?: RuleOf40

  // Operational
  nps?: NPS
  customerHealth?: CustomerHealth

  // Period
  period: MetricPeriod
  generatedAt: Date
}

// =============================================================================
// Calculation Functions
// =============================================================================

/**
 * Calculate MRR from components
 */
export function calculateMRR(input: {
  newMRR: number
  expansionMRR: number
  contractionMRR: number
  churnedMRR: number
  reactivationMRR?: number
  previousMRR: number
  currency?: Currency
  period: MetricPeriod
}): MRR {
  const reactivationMRR = input.reactivationMRR || 0
  const netNewMRR = input.newMRR + input.expansionMRR - input.contractionMRR - input.churnedMRR + reactivationMRR
  const total = input.previousMRR + netNewMRR

  return {
    total,
    newMRR: input.newMRR,
    expansionMRR: input.expansionMRR,
    contractionMRR: input.contractionMRR,
    churnedMRR: input.churnedMRR,
    reactivationMRR,
    netNewMRR,
    currency: input.currency || 'USD',
    period: input.period,
  }
}

/**
 * Calculate ARR from MRR
 */
export function calculateARRFromMRR(mrr: number, currency: Currency = 'USD'): ARR {
  return {
    total: mrr * 12,
    fromMRR: mrr * 12,
    currency,
    asOf: new Date(),
  }
}

/**
 * Calculate NRR
 */
export function calculateNRR(input: {
  startingMRR: number
  expansion: number
  contraction: number
  churn: number
  period: MetricPeriod
}): NRR {
  const endingMRR = input.startingMRR + input.expansion - input.contraction - input.churn
  const rate = input.startingMRR > 0 ? (endingMRR / input.startingMRR) * 100 : 0

  return {
    rate,
    startingMRR: input.startingMRR,
    endingMRR,
    expansion: input.expansion,
    contraction: input.contraction,
    churn: input.churn,
    period: input.period,
  }
}

/**
 * Calculate GRR
 */
export function calculateGRR(input: {
  startingMRR: number
  contraction: number
  churn: number
  period: MetricPeriod
}): GRR {
  const endingMRR = input.startingMRR - input.contraction - input.churn
  const rate = input.startingMRR > 0 ? Math.min((endingMRR / input.startingMRR) * 100, 100) : 0

  return {
    rate,
    startingMRR: input.startingMRR,
    endingMRR,
    contraction: input.contraction,
    churn: input.churn,
    period: input.period,
  }
}

/**
 * Calculate CAC
 */
export function calculateCACMetric(input: {
  salesMarketingSpend: number
  newCustomers: number
  currency?: Currency
  period: MetricPeriod
  byChannel?: Record<string, { spend: number; customers: number }>
}): CAC {
  const value = input.newCustomers > 0 ? input.salesMarketingSpend / input.newCustomers : 0

  let byChannel: Record<string, number> | undefined
  if (input.byChannel) {
    byChannel = {}
    for (const [channel, data] of Object.entries(input.byChannel)) {
      byChannel[channel] = data.customers > 0 ? data.spend / data.customers : 0
    }
  }

  return {
    value,
    totalSalesMarketingSpend: input.salesMarketingSpend,
    newCustomersAcquired: input.newCustomers,
    currency: input.currency || 'USD',
    period: input.period,
    byChannel,
  }
}

/**
 * Calculate LTV
 */
export function calculateLTVMetric(input: {
  arpu: number
  grossMargin: number
  churnRate: number
  currency?: Currency
}): LTV {
  // LTV = (ARPU * Gross Margin) / Churn Rate
  const averageLifetimeMonths = input.churnRate > 0 ? 1 / input.churnRate : 0
  const value = input.churnRate > 0 ? (input.arpu * input.grossMargin / 100) / input.churnRate : 0

  return {
    value,
    arpu: input.arpu,
    grossMargin: input.grossMargin,
    churnRate: input.churnRate,
    averageLifetimeMonths,
    currency: input.currency || 'USD',
  }
}

/**
 * Calculate LTV:CAC ratio
 */
export function calculateLTVtoCACRatio(ltv: LTV, cac: CAC): LTVtoCAC {
  const ratio = cac.value > 0 ? ltv.value / cac.value : 0
  const paybackMonths = ltv.arpu > 0 && ltv.grossMargin > 0
    ? cac.value / (ltv.arpu * ltv.grossMargin / 100)
    : 0

  return {
    ratio,
    ltv: ltv.value,
    cac: cac.value,
    paybackMonths,
    healthy: ratio >= 3,
  }
}

/**
 * Calculate Quick Ratio
 */
export function calculateQuickRatioMetric(mrr: MRR): QuickRatio {
  const growth = mrr.newMRR + mrr.expansionMRR
  const loss = mrr.churnedMRR + mrr.contractionMRR
  const ratio = loss > 0 ? growth / loss : growth > 0 ? Infinity : 0

  return {
    ratio,
    newMRR: mrr.newMRR,
    expansionMRR: mrr.expansionMRR,
    churnedMRR: mrr.churnedMRR,
    contractionMRR: mrr.contractionMRR,
    healthy: ratio >= 4,
    period: mrr.period,
  }
}

/**
 * Calculate Magic Number
 */
export function calculateMagicNumberMetric(input: {
  netNewARR: number
  salesMarketingSpend: number
  period: MetricPeriod
}): MagicNumber {
  const value = input.salesMarketingSpend > 0 ? input.netNewARR / input.salesMarketingSpend : 0

  return {
    value,
    netNewARR: input.netNewARR,
    salesMarketingSpend: input.salesMarketingSpend,
    efficient: value >= 0.75,
    period: input.period,
  }
}

/**
 * Calculate Burn Multiple
 */
export function calculateBurnMultipleMetric(input: {
  netBurn: number
  netNewARR: number
  period: MetricPeriod
}): BurnMultiple {
  const value = input.netNewARR > 0 ? input.netBurn / input.netNewARR : Infinity

  return {
    value,
    netBurn: input.netBurn,
    netNewARR: input.netNewARR,
    efficient: value <= 1.5,
    period: input.period,
  }
}

/**
 * Calculate Rule of 40
 */
export function calculateRuleOf40Metric(input: {
  revenueGrowthRate: number
  profitMargin: number
  period: MetricPeriod
}): RuleOf40 {
  const score = input.revenueGrowthRate + input.profitMargin

  return {
    score,
    revenueGrowthRate: input.revenueGrowthRate,
    profitMargin: input.profitMargin,
    passing: score >= 40,
    period: input.period,
  }
}

/**
 * Calculate growth rates
 */
export function calculateGrowthRates(input: {
  current: number
  previousMonth?: number
  previousQuarter?: number
  previousYear?: number
  metric: string
  period: MetricPeriod
}): GrowthRate {
  const mom = input.previousMonth && input.previousMonth > 0
    ? ((input.current - input.previousMonth) / input.previousMonth) * 100
    : 0
  const qoq = input.previousQuarter && input.previousQuarter > 0
    ? ((input.current - input.previousQuarter) / input.previousQuarter) * 100
    : 0
  const yoy = input.previousYear && input.previousYear > 0
    ? ((input.current - input.previousYear) / input.previousYear) * 100
    : 0

  return {
    mom,
    qoq,
    yoy,
    metric: input.metric,
    period: input.period,
  }
}

/**
 * Calculate churn metrics
 */
export function calculateChurnMetrics(input: {
  customersStart: number
  customersLost: number
  mrrStart: number
  mrrChurned: number
  expansionMRR: number
  period: MetricPeriod
}): Churn {
  const customerChurnRate = input.customersStart > 0
    ? (input.customersLost / input.customersStart) * 100
    : 0
  const revenueChurnRate = input.mrrStart > 0
    ? (input.mrrChurned / input.mrrStart) * 100
    : 0
  const netRevenueChurnRate = input.mrrStart > 0
    ? ((input.mrrChurned - input.expansionMRR) / input.mrrStart) * 100
    : 0

  return {
    customerChurnRate,
    customersLost: input.customersLost,
    customersStart: input.customersStart,
    revenueChurnRate,
    mrrChurned: input.mrrChurned,
    netRevenueChurnRate,
    period: input.period,
  }
}

// =============================================================================
// Aggregation Functions
// =============================================================================

/**
 * Aggregate time series data by period
 */
export function aggregateTimeSeries<T extends number>(
  series: TimeSeries<T>,
  targetPeriod: TimePeriod
): TimeSeries<T> {
  const buckets = new Map<string, DataPoint<T>[]>()

  for (const point of series.dataPoints) {
    const key = getBucketKey(point.timestamp, targetPeriod)
    const existing = buckets.get(key) || []
    buckets.set(key, [...existing, point])
  }

  const aggregatedPoints: DataPoint<T>[] = []
  const aggregation = series.aggregation || 'sum'

  for (const [key, points] of buckets) {
    const values = points.map(p => p.value as number)
    let aggregatedValue: number

    switch (aggregation) {
      case 'sum':
        aggregatedValue = values.reduce((a, b) => a + b, 0)
        break
      case 'avg':
        aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length
        break
      case 'min':
        aggregatedValue = Math.min(...values)
        break
      case 'max':
        aggregatedValue = Math.max(...values)
        break
      case 'last':
        aggregatedValue = values[values.length - 1] ?? 0
        break
      case 'first':
        aggregatedValue = values[0] ?? 0
        break
      default:
        aggregatedValue = values.reduce((a, b) => a + b, 0)
    }

    aggregatedPoints.push({
      timestamp: new Date(key),
      value: aggregatedValue as T,
    })
  }

  return {
    ...series,
    dataPoints: aggregatedPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
  }
}

/**
 * Get bucket key for time aggregation
 */
function getBucketKey(date: Date, period: TimePeriod): string {
  switch (period) {
    case 'daily':
      return date.toISOString().split('T')[0] || date.toISOString()
    case 'weekly':
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      return weekStart.toISOString().split('T')[0] || weekStart.toISOString()
    case 'monthly':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    case 'quarterly':
      const quarter = Math.floor(date.getMonth() / 3)
      return `${date.getFullYear()}-Q${quarter + 1}`
    case 'yearly':
      return `${date.getFullYear()}-01-01`
    default:
      return date.toISOString()
  }
}

/**
 * Create metric period from dates
 */
export function createMetricPeriod(
  period: TimePeriod,
  start: Date,
  end: Date,
  label?: string
): MetricPeriod {
  return {
    period,
    range: { start, end },
    label: label || formatPeriodLabel(period, start, end),
  }
}

/**
 * Format period label
 */
function formatPeriodLabel(period: TimePeriod, start: Date, end: Date): string {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  switch (period) {
    case 'monthly':
      return `${monthNames[start.getMonth()]} ${start.getFullYear()}`
    case 'quarterly':
      const quarter = Math.floor(start.getMonth() / 3) + 1
      return `Q${quarter} ${start.getFullYear()}`
    case 'yearly':
      return `${start.getFullYear()}`
    default:
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`
  }
}
