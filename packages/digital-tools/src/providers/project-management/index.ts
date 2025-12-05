/**
 * Project Management Providers
 *
 * @packageDocumentation
 */

export { linearInfo, linearProvider, createLinearProvider } from './linear.js'

import { linearProvider } from './linear.js'

/**
 * Register all project management providers
 */
export function registerProjectManagementProviders(): void {
  linearProvider.register()
}

/**
 * All project management providers
 */
export const projectManagementProviders = [linearProvider]
