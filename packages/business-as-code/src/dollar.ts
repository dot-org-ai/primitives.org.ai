/**
 * $ - Business operations helper
 *
 * Provides convenient functions for common business calculations and formatting
 */

import type { BusinessOperations, BusinessContext, Currency } from './types.js'
import {
  formatCurrency,
  calculateGrowthRate,
  calculateGrossMargin,
  calculateROI,
  calculateLTV,
  calculateCAC,
  calculateBurnRate,
  calculateRunway,
} from './financials.js'

/**
 * Create a business operations helper with context
 *
 * @example
 * ```ts
 * import { $ } from 'business-as-code'
 *
 * // Format currency
 * console.log($.format(1234.56)) // "$1,234.56"
 * console.log($.format(1000, 'EUR')) // "€1,000"
 *
 * // Calculate percentage
 * console.log($.percent(25, 100)) // 25
 *
 * // Calculate growth
 * console.log($.growth(120, 100)) // 20
 *
 * // Calculate margin
 * console.log($.margin(100, 60)) // 40
 *
 * // Calculate ROI
 * console.log($.roi(150, 100)) // 50
 *
 * // Calculate LTV
 * console.log($.ltv(100, 12, 24)) // 28800
 *
 * // Calculate CAC
 * console.log($.cac(10000, 100)) // 100
 *
 * // Calculate burn rate
 * console.log($.burnRate(100000, 70000, 3)) // 10000
 *
 * // Calculate runway
 * console.log($.runway(100000, 10000)) // 10
 * ```
 */
export function createBusinessOperations(initialContext?: BusinessContext): BusinessOperations {
  const context: BusinessContext = initialContext || {}

  return {
    format: (amount: number, currency?: Currency) => {
      return formatCurrency(
        amount,
        currency || (context.business?.metadata?.['currency'] as Currency) || 'USD'
      )
    },

    percent: (value: number, total: number) => {
      if (total === 0) return 0
      return (value / total) * 100
    },

    growth: (current: number, previous: number) => {
      return calculateGrowthRate(current, previous)
    },

    margin: (revenue: number, cost: number) => {
      return calculateGrossMargin(revenue, cost)
    },

    roi: (gain: number, cost: number) => {
      return calculateROI(gain, cost)
    },

    ltv: (averageValue: number, frequency: number, lifetime: number) => {
      // frequency = purchases per year, lifetime = years
      const annualValue = averageValue * frequency
      return annualValue * lifetime
    },

    cac: (marketingSpend: number, newCustomers: number) => {
      return calculateCAC(marketingSpend, newCustomers)
    },

    burnRate: (cashStart: number, cashEnd: number, months: number) => {
      return calculateBurnRate(cashStart, cashEnd, months)
    },

    runway: (cash: number, burnRate: number) => {
      return calculateRunway(cash, burnRate)
    },

    context,

    log: (event: string, data?: unknown) => {
      console.log(`[Business Event] ${event}`, data || '')
    },
  }
}

/**
 * Default business operations instance
 */
export const $: BusinessOperations = createBusinessOperations()

/**
 * Update business context
 */
export function updateContext(updates: Partial<BusinessContext>): void {
  Object.assign($.context, updates)
}

/**
 * Get current business context
 */
export function getContext(): BusinessContext {
  return $.context
}

/**
 * Reset business context
 */
export function resetContext(): void {
  Object.keys($.context).forEach((key) => {
    delete $.context[key]
  })
}
