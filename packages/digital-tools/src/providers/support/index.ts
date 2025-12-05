/**
 * Support Providers
 *
 * @packageDocumentation
 */

export { zendeskInfo, zendeskProvider, createZendeskProvider } from './zendesk.js'

import { zendeskProvider } from './zendesk.js'

/**
 * Register all support providers
 */
export function registerSupportProviders(): void {
  zendeskProvider.register()
}

/**
 * All support providers
 */
export const supportProviders = [zendeskProvider]
