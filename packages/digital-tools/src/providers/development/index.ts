/**
 * Development Providers
 *
 * @packageDocumentation
 */

export { githubInfo, githubProvider, createGitHubProvider } from './github.js'

import { githubProvider } from './github.js'

/**
 * Register all development providers
 */
export function registerDevelopmentProviders(): void {
  githubProvider.register()
}

/**
 * All development providers
 */
export const developmentProviders = [githubProvider]
