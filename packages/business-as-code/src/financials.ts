/**
 * Financial metrics and calculations
 */

import type { FinancialMetrics, FinancialStatement, Currency, TimePeriod } from './types.js'

/**
 * Calculate financial metrics from basic inputs
 *
 * @example
 * ```ts
 * const metrics = financials({
 *   revenue: 1000000,
 *   cogs: 300000,
 *   operatingExpenses: 500000,
 *   currency: 'USD',
 *   period: 'monthly',
 * })
 *
 * console.log(metrics.grossMargin) // 70%
 * console.log(metrics.operatingMargin) // 20%
 * console.log(metrics.netMargin) // 20%
 * ```
 */
export function financials(metrics: Partial<FinancialMetrics>): FinancialMetrics {
  const revenue = metrics.revenue || 0
  const cogs = metrics.cogs || 0
  const operatingExpenses = metrics.operatingExpenses || 0

  // Calculate derived metrics
  const grossProfit = revenue - cogs
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

  const operatingIncome = grossProfit - operatingExpenses
  const operatingMargin = revenue > 0 ? (operatingIncome / revenue) * 100 : 0

  const netIncome = metrics.netIncome ?? operatingIncome
  const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0

  // EBITDA (simplified - would need D&A for accurate calculation)
  const ebitda = metrics.ebitda ?? operatingIncome
  const ebitdaMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0

  return {
    ...metrics,
    revenue,
    cogs,
    grossProfit,
    grossMargin,
    operatingExpenses,
    operatingIncome,
    operatingMargin,
    netIncome,
    netMargin,
    ebitda,
    ebitdaMargin,
    currency: metrics.currency || 'USD',
    period: metrics.period || 'monthly',
  }
}

/**
 * Calculate gross margin
 */
export function calculateGrossMargin(revenue: number, cogs: number): number {
  if (revenue === 0) return 0
  return ((revenue - cogs) / revenue) * 100
}

/**
 * Calculate operating margin
 */
export function calculateOperatingMargin(
  revenue: number,
  cogs: number,
  operatingExpenses: number
): number {
  if (revenue === 0) return 0
  const operatingIncome = revenue - cogs - operatingExpenses
  return (operatingIncome / revenue) * 100
}

/**
 * Calculate net margin
 */
export function calculateNetMargin(revenue: number, netIncome: number): number {
  if (revenue === 0) return 0
  return (netIncome / revenue) * 100
}

/**
 * Calculate EBITDA margin
 */
export function calculateEBITDAMargin(revenue: number, ebitda: number): number {
  if (revenue === 0) return 0
  return (ebitda / revenue) * 100
}

/**
 * Calculate burn rate (monthly cash burn)
 */
export function calculateBurnRate(
  cashStart: number,
  cashEnd: number,
  months: number
): number {
  if (months === 0) return 0
  return (cashStart - cashEnd) / months
}

/**
 * Calculate runway (months until cash runs out)
 */
export function calculateRunway(cash: number, monthlyBurnRate: number): number {
  if (monthlyBurnRate === 0) return Infinity
  if (monthlyBurnRate < 0) return Infinity // Company is profitable
  return cash / monthlyBurnRate
}

/**
 * Calculate customer acquisition cost (CAC)
 */
export function calculateCAC(marketingSpend: number, newCustomers: number): number {
  if (newCustomers === 0) return 0
  return marketingSpend / newCustomers
}

/**
 * Calculate customer lifetime value (LTV)
 */
export function calculateLTV(
  averageRevenuePerCustomer: number,
  averageCustomerLifetimeMonths: number,
  grossMarginPercent: number
): number {
  return averageRevenuePerCustomer * averageCustomerLifetimeMonths * (grossMarginPercent / 100)
}

/**
 * Calculate LTV:CAC ratio
 */
export function calculateLTVtoCAC(ltv: number, cac: number): number {
  if (cac === 0) return 0
  return ltv / cac
}

/**
 * Calculate payback period (months to recover CAC)
 */
export function calculatePaybackPeriod(cac: number, monthlyRevPerCustomer: number): number {
  if (monthlyRevPerCustomer === 0) return 0
  return cac / monthlyRevPerCustomer
}

/**
 * Calculate annual recurring revenue (ARR)
 */
export function calculateARR(mrr: number): number {
  return mrr * 12
}

/**
 * Calculate monthly recurring revenue (MRR)
 */
export function calculateMRR(arr: number): number {
  return arr / 12
}

/**
 * Calculate revenue growth rate
 */
export function calculateGrowthRate(currentRevenue: number, previousRevenue: number): number {
  if (previousRevenue === 0) return 0
  return ((currentRevenue - previousRevenue) / previousRevenue) * 100
}

/**
 * Calculate compound annual growth rate (CAGR)
 */
export function calculateCAGR(
  beginningValue: number,
  endingValue: number,
  years: number
): number {
  if (beginningValue === 0 || years === 0) return 0
  return (Math.pow(endingValue / beginningValue, 1 / years) - 1) * 100
}

/**
 * Calculate return on investment (ROI)
 */
export function calculateROI(gain: number, cost: number): number {
  if (cost === 0) return 0
  return ((gain - cost) / cost) * 100
}

/**
 * Calculate return on equity (ROE)
 */
export function calculateROE(netIncome: number, shareholderEquity: number): number {
  if (shareholderEquity === 0) return 0
  return (netIncome / shareholderEquity) * 100
}

/**
 * Calculate return on assets (ROA)
 */
export function calculateROA(netIncome: number, totalAssets: number): number {
  if (totalAssets === 0) return 0
  return (netIncome / totalAssets) * 100
}

/**
 * Calculate quick ratio (liquidity)
 */
export function calculateQuickRatio(
  currentAssets: number,
  inventory: number,
  currentLiabilities: number
): number {
  if (currentLiabilities === 0) return 0
  return (currentAssets - inventory) / currentLiabilities
}

/**
 * Calculate current ratio (liquidity)
 */
export function calculateCurrentRatio(currentAssets: number, currentLiabilities: number): number {
  if (currentLiabilities === 0) return 0
  return currentAssets / currentLiabilities
}

/**
 * Calculate debt-to-equity ratio
 */
export function calculateDebtToEquity(totalDebt: number, totalEquity: number): number {
  if (totalEquity === 0) return 0
  return totalDebt / totalEquity
}

/**
 * Format currency value
 */
export function formatCurrency(amount: number, currency: Currency = 'USD'): string {
  const symbol = getCurrencySymbol(currency)
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })

  const sign = amount < 0 ? '-' : ''
  return `${sign}${symbol}${formatted}`
}

/**
 * Get currency symbol
 */
function getCurrencySymbol(currency: Currency): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    CNY: '¥',
    CAD: 'C$',
    AUD: 'A$',
  }
  return symbols[currency] || currency + ' '
}

/**
 * Create a financial statement
 */
export function createStatement(
  type: FinancialStatement['type'],
  period: string,
  lineItems: Record<string, number>,
  currency: Currency = 'USD'
): FinancialStatement {
  return {
    type,
    period,
    lineItems,
    currency,
  }
}

/**
 * Get line item from financial statement
 */
export function getLineItem(statement: FinancialStatement, name: string): number {
  return statement.lineItems[name] || 0
}

/**
 * Compare financial metrics between periods
 */
export function compareMetrics(
  current: FinancialMetrics,
  previous: FinancialMetrics
): Record<string, { change: number; changePercent: number }> {
  const comparison: Record<string, { change: number; changePercent: number }> = {}

  const keys: (keyof FinancialMetrics)[] = [
    'revenue',
    'grossProfit',
    'operatingIncome',
    'netIncome',
    'ebitda',
  ]

  for (const key of keys) {
    const currentVal = (current[key] as number) || 0
    const previousVal = (previous[key] as number) || 0
    const change = currentVal - previousVal
    const changePercent = previousVal !== 0 ? (change / previousVal) * 100 : 0

    comparison[key] = { change, changePercent }
  }

  return comparison
}

/**
 * Validate financial metrics
 */
export function validateFinancials(
  metrics: FinancialMetrics
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (metrics.revenue && metrics.revenue < 0) {
    errors.push('Revenue cannot be negative')
  }

  if (metrics.cogs && metrics.cogs < 0) {
    errors.push('COGS cannot be negative')
  }

  if (metrics.operatingExpenses && metrics.operatingExpenses < 0) {
    errors.push('Operating expenses cannot be negative')
  }

  if (metrics.revenue && metrics.cogs && metrics.cogs > metrics.revenue) {
    errors.push('COGS cannot exceed revenue')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
