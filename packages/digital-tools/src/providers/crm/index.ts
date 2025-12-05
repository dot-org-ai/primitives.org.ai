/**
 * CRM Providers
 *
 * @packageDocumentation
 */

export { hubspotInfo, hubspotProvider, createHubSpotProvider } from './hubspot.js'

import { hubspotProvider } from './hubspot.js'

/**
 * Register all CRM providers
 */
export function registerCRMProviders(): void {
  hubspotProvider.register()
}

/**
 * All CRM providers
 */
export const crmProviders = [hubspotProvider]
