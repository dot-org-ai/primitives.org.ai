/**
 * @org.ai/examples - Real-world examples of digital businesses
 *
 * This package provides comprehensive, real-world examples of various digital
 * business models implemented using the primitives.org.ai packages:
 * - business-as-code
 * - ai-database
 * - digital-workers
 * - ai-functions
 *
 * Each example includes:
 * - Business definition (mission, values, structure)
 * - Vision & goals
 * - Products & services
 * - Organization & roles (with FGA/RBAC integration)
 * - KPIs & OKRs
 * - Processes & workflows
 * - Financials & metrics
 *
 * @example
 * ```ts
 * import { saas, apiPlatform, directory, marketplace, startupStudio, vcFirm } from '@org.ai/examples'
 *
 * // Access a complete SaaS business model
 * const { business, kpis, okrs, metrics } = saas.getBusinessSummary()
 * console.log(business.name) // 'CloudMetrics Inc.'
 * console.log(metrics.mrr) // 780000
 *
 * // Use the VC firm example
 * const portfolio = vcFirm.getPortfolioSummary()
 * console.log(portfolio.unicorns) // 6
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// SaaS Business (CloudMetrics)
// =============================================================================

export * as saas from './saas/index.js'
export { default as SaaSExample } from './saas/index.js'

// =============================================================================
// API Business (APIHub)
// =============================================================================

export * as apiPlatform from './api-business/index.js'
export { default as APIBusinessExample } from './api-business/index.js'

// =============================================================================
// Directory Business (TechDirectory)
// =============================================================================

export * as directory from './directory/index.js'
export { default as DirectoryExample } from './directory/index.js'

// =============================================================================
// Marketplace Business (TalentHub)
// =============================================================================

export * as marketplace from './marketplace/index.js'
export { default as MarketplaceExample } from './marketplace/index.js'

// =============================================================================
// Startup Studio (VentureForge)
// =============================================================================

export * as startupStudio from './startup-studio/index.js'
export { default as StartupStudioExample } from './startup-studio/index.js'

// =============================================================================
// VC Firm (Catalyst Ventures)
// =============================================================================

export * as vcFirm from './vc-firm/index.js'
export { default as VCFirmExample } from './vc-firm/index.js'

// =============================================================================
// Convenience exports
// =============================================================================

/**
 * All examples as a single object
 */
export const examples = {
  saas: () => import('./saas/index.js'),
  apiPlatform: () => import('./api-business/index.js'),
  directory: () => import('./directory/index.js'),
  marketplace: () => import('./marketplace/index.js'),
  startupStudio: () => import('./startup-studio/index.js'),
  vcFirm: () => import('./vc-firm/index.js'),
}

/**
 * Example business types
 */
export type ExampleType = keyof typeof examples

/**
 * Get a list of all available examples
 */
export function listExamples(): Array<{
  id: ExampleType
  name: string
  description: string
}> {
  return [
    {
      id: 'saas',
      name: 'SaaS Business',
      description: 'B2B SaaS analytics platform (CloudMetrics)',
    },
    {
      id: 'apiPlatform',
      name: 'API Business',
      description: 'Developer-focused API platform (APIHub)',
    },
    {
      id: 'directory',
      name: 'Directory Business',
      description: 'Curated software tools directory (TechDirectory)',
    },
    {
      id: 'marketplace',
      name: 'Marketplace',
      description: 'Two-sided freelance marketplace (TalentHub)',
    },
    {
      id: 'startupStudio',
      name: 'Startup Studio',
      description: 'B2B SaaS venture builder (VentureForge)',
    },
    {
      id: 'vcFirm',
      name: 'VC Firm',
      description: 'Early-stage enterprise VC (Catalyst Ventures)',
    },
  ]
}

/**
 * Load an example by its ID
 */
export async function loadExample(id: ExampleType) {
  const loader = examples[id]
  if (!loader) {
    throw new Error(`Unknown example: ${id}. Available: ${Object.keys(examples).join(', ')}`)
  }
  return loader()
}
