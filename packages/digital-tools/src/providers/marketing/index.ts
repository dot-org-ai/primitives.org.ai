/**
 * Marketing Providers
 *
 * @packageDocumentation
 */

export { mailchimpInfo, mailchimpProvider, createMailchimpProvider } from './mailchimp.js'

import { mailchimpProvider } from './mailchimp.js'

/**
 * Register all marketing providers
 */
export function registerMarketingProviders(): void {
  mailchimpProvider.register()
}

/**
 * All marketing providers
 */
export const marketingProviders = [mailchimpProvider]
