/**
 * Site() - Define a website
 */

import type { SiteDefinition, NavigationDefinition, SEOConfig, AnalyticsConfig } from './types.js'
import { registerProduct } from './product.js'

/**
 * Create a site definition
 *
 * @example
 * ```ts
 * const docsSite = Site({
 *   id: 'docs',
 *   name: 'Documentation Site',
 *   description: 'Product documentation',
 *   version: '1.0.0',
 *   generator: 'fumadocs',
 *   structure: {
 *     home: '/docs/index.mdx',
 *     docs: [
 *       '/docs/getting-started.mdx',
 *       '/docs/api-reference.mdx',
 *     ],
 *   },
 *   navigation: [
 *     Nav('Home', '/'),
 *     Nav('Docs', '/docs', {
 *       children: [
 *         Nav('Getting Started', '/docs/getting-started'),
 *         Nav('API Reference', '/docs/api-reference'),
 *       ],
 *     }),
 *   ],
 *   seo: {
 *     titleTemplate: '%s | My Product',
 *     description: 'Official documentation for My Product',
 *     keywords: ['docs', 'api', 'reference'],
 *   },
 *   analytics: {
 *     provider: 'plausible',
 *     id: 'docs.example.com',
 *   },
 * })
 * ```
 */
export function Site(config: Omit<SiteDefinition, 'type'>): SiteDefinition {
  const site: SiteDefinition = {
    type: 'site',
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    generator: config.generator || 'next',
    status: config.status || 'active',
    ...(config.structure !== undefined && { structure: config.structure }),
    ...(config.navigation !== undefined && { navigation: config.navigation }),
    ...(config.seo !== undefined && { seo: config.seo }),
    ...(config.analytics !== undefined && { analytics: config.analytics }),
    ...(config.deployment !== undefined && { deployment: config.deployment }),
    ...(config.metadata !== undefined && { metadata: config.metadata }),
    ...(config.tags !== undefined && { tags: config.tags }),
  }

  return registerProduct(site)
}

/**
 * Helper to create a navigation item
 *
 * @example
 * ```ts
 * const nav = Nav('Documentation', '/docs', {
 *   icon: 'book',
 *   children: [
 *     Nav('Getting Started', '/docs/getting-started'),
 *     Nav('API Reference', '/docs/api'),
 *   ],
 * })
 * ```
 */
export function Nav(
  label: string,
  href: string,
  options?: Omit<NavigationDefinition, 'label' | 'href'>
): NavigationDefinition {
  return {
    label,
    href,
    ...options,
  }
}

/**
 * Helper to configure SEO
 *
 * @example
 * ```ts
 * const seo = SEO({
 *   titleTemplate: '%s | My Site',
 *   description: 'My awesome site',
 *   keywords: ['keyword1', 'keyword2'],
 *   ogImage: '/og-image.png',
 *   twitterCard: 'summary_large_image',
 * })
 * ```
 */
export function SEO(config: SEOConfig): SEOConfig {
  return config
}

/**
 * Helper to configure analytics
 *
 * @example
 * ```ts
 * const analytics = Analytics('google', 'G-XXXXXXXXXX')
 * const analytics = Analytics('plausible', 'example.com')
 * ```
 */
export function Analytics(
  provider: AnalyticsConfig['provider'],
  id: string,
  config?: Record<string, unknown>
): AnalyticsConfig {
  return {
    provider,
    id,
    ...(config !== undefined && { config }),
  }
}
