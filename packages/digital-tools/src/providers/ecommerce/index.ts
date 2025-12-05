/**
 * E-commerce Providers
 *
 * @packageDocumentation
 */

export { shopifyInfo, shopifyProvider, createShopifyProvider } from './shopify.js'

import { shopifyProvider } from './shopify.js'

/**
 * Register all e-commerce providers
 */
export function registerEcommerceProviders(): void {
  shopifyProvider.register()
}

/**
 * All e-commerce providers
 */
export const ecommerceProviders = [shopifyProvider]
