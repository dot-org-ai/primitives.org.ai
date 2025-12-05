/**
 * Analytics Providers
 *
 * @packageDocumentation
 */

export { mixpanelInfo, mixpanelProvider, createMixpanelProvider } from './mixpanel.js'

import { mixpanelProvider } from './mixpanel.js'

/**
 * Register all analytics providers
 */
export function registerAnalyticsProviders(): void {
  mixpanelProvider.register()
}

/**
 * All analytics providers
 */
export const analyticsProviders = [mixpanelProvider]
