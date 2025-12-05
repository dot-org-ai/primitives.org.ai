/**
 * Finance Providers
 *
 * @packageDocumentation
 */

export { stripeInfo, stripeProvider, createStripeProvider } from './stripe.js'

import { stripeProvider } from './stripe.js'

/**
 * Register all finance providers
 */
export function registerFinanceProviders(): void {
  stripeProvider.register()
}

/**
 * All finance providers
 */
export const financeProviders = [stripeProvider]
