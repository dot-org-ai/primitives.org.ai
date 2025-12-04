/**
 * Tests for Site functionality
 *
 * Covers site creation and helper functions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Site, Nav, SEO, Analytics, registry } from '../src/index.js'

describe('Site', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('Site creation', () => {
    it('creates a site with basic config', () => {
      const site = Site({
        id: 'docs',
        name: 'Documentation Site',
        description: 'Product documentation',
        version: '1.0.0',
      })

      expect(site.id).toBe('docs')
      expect(site.name).toBe('Documentation Site')
      expect(site.type).toBe('site')
    })

    it('defaults generator to next', () => {
      const site = Site({
        id: 'default-gen',
        name: 'Default Generator',
        description: 'Uses default generator',
        version: '1.0.0',
      })

      expect(site.generator).toBe('next')
    })

    it('supports fumadocs generator', () => {
      const site = Site({
        id: 'fumadocs-site',
        name: 'Fumadocs Site',
        description: 'Uses Fumadocs',
        version: '1.0.0',
        generator: 'fumadocs',
      })

      expect(site.generator).toBe('fumadocs')
    })

    it('creates a site with structure', () => {
      const site = Site({
        id: 'structured-site',
        name: 'Structured Site',
        description: 'Site with structure',
        version: '1.0.0',
        structure: {
          home: '/docs/index.mdx',
          docs: [
            '/docs/getting-started.mdx',
            '/docs/api-reference.mdx',
          ],
        },
      })

      expect(site.structure?.home).toBe('/docs/index.mdx')
      expect(site.structure?.docs).toHaveLength(2)
    })

    it('creates a site with navigation', () => {
      const site = Site({
        id: 'navigated-site',
        name: 'Navigated Site',
        description: 'Site with navigation',
        version: '1.0.0',
        navigation: [
          Nav('Home', '/'),
          Nav('Docs', '/docs'),
        ],
      })

      expect(site.navigation).toHaveLength(2)
      expect(site.navigation?.[0]?.label).toBe('Home')
    })

    it('creates a site with SEO', () => {
      const site = Site({
        id: 'seo-site',
        name: 'SEO Site',
        description: 'Site with SEO',
        version: '1.0.0',
        seo: {
          titleTemplate: '%s | My Product',
          description: 'Official documentation',
          keywords: ['docs', 'api'],
        },
      })

      expect(site.seo?.titleTemplate).toBe('%s | My Product')
      expect(site.seo?.keywords).toContain('docs')
    })

    it('creates a site with analytics', () => {
      const site = Site({
        id: 'analytics-site',
        name: 'Analytics Site',
        description: 'Site with analytics',
        version: '1.0.0',
        analytics: {
          provider: 'plausible',
          id: 'docs.example.com',
        },
      })

      expect(site.analytics?.provider).toBe('plausible')
      expect(site.analytics?.id).toBe('docs.example.com')
    })

    it('creates a site with deployment config', () => {
      const site = Site({
        id: 'deployed-site',
        name: 'Deployed Site',
        description: 'Site with deployment',
        version: '1.0.0',
        deployment: {
          provider: 'vercel',
          url: 'https://docs.example.com',
        },
      })

      expect(site.deployment?.provider).toBe('vercel')
    })

    it('registers site automatically', () => {
      Site({
        id: 'auto-registered',
        name: 'Auto Registered',
        description: 'Automatically registered',
        version: '1.0.0',
      })

      expect(registry.get('auto-registered')).toBeDefined()
    })
  })

  describe('Nav helper', () => {
    it('creates a basic nav item', () => {
      const nav = Nav('Home', '/')

      expect(nav.label).toBe('Home')
      expect(nav.href).toBe('/')
    })

    it('creates a nav item with icon', () => {
      const nav = Nav('Documentation', '/docs', {
        icon: 'book',
      })

      expect(nav.icon).toBe('book')
    })

    it('creates a nav item with children', () => {
      const nav = Nav('Docs', '/docs', {
        children: [
          Nav('Getting Started', '/docs/getting-started'),
          Nav('API Reference', '/docs/api'),
        ],
      })

      expect(nav.children).toHaveLength(2)
      expect(nav.children?.[0]?.label).toBe('Getting Started')
    })

    it('creates nested navigation', () => {
      const nav = Nav('Products', '/products', {
        children: [
          Nav('Apps', '/products/apps', {
            children: [
              Nav('Web', '/products/apps/web'),
              Nav('Mobile', '/products/apps/mobile'),
            ],
          }),
          Nav('APIs', '/products/apis'),
        ],
      })

      expect(nav.children?.[0]?.children).toHaveLength(2)
    })
  })

  describe('SEO helper', () => {
    it('creates SEO config', () => {
      const seo = SEO({
        titleTemplate: '%s | My Site',
        description: 'My awesome site',
      })

      expect(seo.titleTemplate).toBe('%s | My Site')
      expect(seo.description).toBe('My awesome site')
    })

    it('creates SEO config with keywords', () => {
      const seo = SEO({
        keywords: ['keyword1', 'keyword2'],
      })

      expect(seo.keywords).toHaveLength(2)
    })

    it('creates SEO config with ogImage', () => {
      const seo = SEO({
        ogImage: '/og-image.png',
        twitterCard: 'summary_large_image',
      })

      expect(seo.ogImage).toBe('/og-image.png')
      expect(seo.twitterCard).toBe('summary_large_image')
    })
  })

  describe('Analytics helper', () => {
    it('creates Google analytics config', () => {
      const analytics = Analytics('google', 'G-XXXXXXXXXX')

      expect(analytics.provider).toBe('google')
      expect(analytics.id).toBe('G-XXXXXXXXXX')
    })

    it('creates Plausible analytics config', () => {
      const analytics = Analytics('plausible', 'example.com')

      expect(analytics.provider).toBe('plausible')
      expect(analytics.id).toBe('example.com')
    })

    it('creates analytics config with custom options', () => {
      const analytics = Analytics('google', 'G-XXXXXXXXXX', {
        anonymizeIp: true,
      })

      expect(analytics.config?.anonymizeIp).toBe(true)
    })
  })
})
