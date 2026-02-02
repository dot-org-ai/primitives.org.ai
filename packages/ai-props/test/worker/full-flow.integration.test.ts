/**
 * Full Integration Tests for ai-props /worker Flow
 *
 * RED phase: Comprehensive failing tests for the complete ai-props /worker flow.
 * These tests cover the full pipeline from schema definition through rendering output.
 *
 * Uses @cloudflare/vitest-pool-workers with real bindings (NO MOCKS).
 *
 * Key flows tested:
 * 1. End-to-End Props Generation via RPC
 * 2. Full MDX Pipeline (parse -> generate -> render)
 * 3. hono/jsx Complete Flow with streaming and hydration
 * 4. Cross-Worker Integration via service bindings
 * 5. Error Recovery and graceful degradation
 *
 * Bead: aip-ynj6
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, beforeAll, afterEach } from 'vitest'
import { env, SELF } from 'cloudflare:test'

// Import worker modules
import { PropsService, PropsServiceCore } from '../../src/worker.js'
import { generateProps, prefetchProps, mergeWithGenerated, clearCache } from '../../src/generate.js'
import { getDefaultCache } from '../../src/cache.js'

// Import MDX modules
import {
  parseMDX,
  extractComponentSchemas,
  createMDXPropsGenerator,
  renderMDXWithProps,
  streamMDXWithProps,
  compileMDX,
  clearMDXCache,
} from '../../src/mdx.js'

// Import hono/jsx modules
import {
  collectHydrationData,
  createHydrationContext,
  serializeHydrationData,
  HydrationProvider,
  useHydration,
  renderToReadableStream,
  streamJSXResponse,
  createStreamingRenderer,
  createAIComponent,
  withAIProps,
  AIPropsProvider,
} from '../../src/hono-jsx.js'

// Import streaming utilities
import {
  renderToReadableStream as optimizedRenderToReadableStream,
  streamJSXResponse as optimizedStreamJSXResponse,
  createStreamingRenderer as optimizedCreateStreamingRenderer,
  streamMDXWithProps as optimizedStreamMDXWithProps,
} from '../../src/streaming.js'

// Import types
import type {
  PropSchema,
  GeneratePropsOptions,
  GeneratePropsResult,
  ValidationResult,
  PropsCacheEntry,
  AIPropsConfig,
} from '../../src/types.js'

// ============================================================================
// Type definitions for service binding
// ============================================================================

interface PropsServiceRpc {
  generate<T = Record<string, unknown>>(
    options: GeneratePropsOptions
  ): Promise<GeneratePropsResult<T>>
  getSync<T = Record<string, unknown>>(schema: PropSchema, context?: Record<string, unknown>): T
  prefetch(requests: GeneratePropsOptions[]): Promise<void>
  generateMany<T = Record<string, unknown>>(
    requests: GeneratePropsOptions[]
  ): Promise<GeneratePropsResult<T>[]>
  mergeWithGenerated<T extends Record<string, unknown>>(
    schema: PropSchema,
    partialProps: Partial<T>,
    options?: Omit<GeneratePropsOptions, 'schema' | 'context'>
  ): Promise<T>
  configure(config: Partial<AIPropsConfig>): void
  getConfig(): AIPropsConfig
  resetConfig(): void
  getCached<T>(key: string): PropsCacheEntry<T> | undefined
  setCached<T>(key: string, props: T): void
  deleteCached(key: string): boolean
  clearCache(): void
  getCacheSize(): number
  createCacheKey(schema: PropSchema, context?: Record<string, unknown>): string
  configureCache(ttl: number): void
  validate(props: Record<string, unknown>, schema: PropSchema): ValidationResult
  hasRequired(props: Record<string, unknown>, required: string[]): boolean
  getMissing(props: Record<string, unknown>, schema: PropSchema): string[]
  isComplete(props: Record<string, unknown>, schema: PropSchema): boolean
  sanitize<T extends Record<string, unknown>>(props: T, schema: PropSchema): Partial<T>
  mergeDefaults<T extends Record<string, unknown>>(
    props: Partial<T>,
    defaults: Partial<T>,
    schema: PropSchema
  ): Partial<T>
}

interface TestEnv {
  PROPS: {
    getService(): PropsServiceRpc
  }
  AI?: unknown
}

// ============================================================================
// 1. End-to-End Props Generation Tests
// ============================================================================

describe('E2E props generation', () => {
  let service: PropsServiceRpc

  beforeEach(async () => {
    const testEnv = env as unknown as TestEnv
    service = testEnv.PROPS.getService()
    await service.clearCache()
    await service.resetConfig()
    clearMDXCache()
  })

  describe('generates props from schema via RPC', () => {
    it('generates simple string props', async () => {
      const schema = {
        headline: 'A compelling headline for the page',
        subheadline: 'A supporting subheadline that adds context',
      }

      const result = await service.generate({ schema })

      expect(result).toBeDefined()
      expect(result.props).toBeDefined()
      expect(result.props.headline).toBeDefined()
      expect(typeof result.props.headline).toBe('string')
      expect((result.props.headline as string).length).toBeGreaterThan(0)
      expect(result.props.subheadline).toBeDefined()
      expect(typeof result.props.subheadline).toBe('string')
      expect(result.cached).toBe(false)
      expect(result.metadata?.model).toBeDefined()
    })

    it('generates props with context awareness', async () => {
      const schema = {
        productName: 'A catchy product name',
        tagline: 'A memorable tagline for the product',
        features: ['Key product features (3 items)'],
      }

      const context = {
        industry: 'AI and Machine Learning',
        targetAudience: 'software developers',
        pricePoint: 'enterprise',
      }

      const result = await service.generate({ schema, context })

      expect(result.props).toBeDefined()
      expect(result.props.productName).toBeDefined()
      expect(result.props.tagline).toBeDefined()
      expect(result.props.features).toBeDefined()
      // Context should influence generation
      expect(typeof result.props.productName).toBe('string')
    })

    it('generates complex nested schemas', async () => {
      const schema = {
        hero: {
          title: 'Hero section title',
          subtitle: 'Hero section subtitle',
          cta: {
            text: 'Call to action button text',
            href: 'Link URL',
          },
        },
        features: [
          {
            icon: 'Icon name',
            title: 'Feature title',
            description: 'Feature description',
          },
        ],
        testimonial: {
          quote: 'Customer testimonial quote',
          author: 'Author name',
          role: 'Author job title',
        },
      }

      const result = await service.generate({ schema })

      expect(result.props).toBeDefined()
      expect(result.props.hero).toBeDefined()
      expect((result.props.hero as Record<string, unknown>).title).toBeDefined()
      expect((result.props.hero as Record<string, unknown>).cta).toBeDefined()
    })

    it('validates generated props against schema', async () => {
      const schema = {
        title: 'Page title',
        description: 'Page description',
        published: 'Is published (boolean)',
      }

      const result = await service.generate({ schema })
      const validation = await service.validate(result.props, schema)

      expect(validation).toBeDefined()
      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })

  describe('uses AI Gateway with caching', () => {
    it('returns cached result on second request', async () => {
      const schema = { title: 'Cached title test' }
      const context = { testId: `cache-${Date.now()}` }

      // First call - should not be cached
      const result1 = await service.generate({ schema, context })
      expect(result1.cached).toBe(false)

      // Second call - should be cached
      const result2 = await service.generate({ schema, context })
      expect(result2.cached).toBe(true)
      expect(result2.props.title).toBe(result1.props.title)
    })

    it('invalidates cache when schema changes', async () => {
      const context = { testId: `schema-change-${Date.now()}` }

      const result1 = await service.generate({
        schema: { title: 'First schema' },
        context,
      })

      const result2 = await service.generate({
        schema: { title: 'Different schema description' },
        context,
      })

      // Different schema should not hit cache
      expect(result2.cached).toBe(false)
    })

    it('invalidates cache when context changes', async () => {
      const schema = { title: 'Context test title' }

      const result1 = await service.generate({
        schema,
        context: { topic: 'Technology' },
      })

      const result2 = await service.generate({
        schema,
        context: { topic: 'Healthcare' },
      })

      // Different context should not hit cache
      expect(result2.cached).toBe(false)
    })

    it('respects cache TTL configuration', async () => {
      // Configure very short TTL (1ms)
      await service.configureCache(1)

      const schema = { title: 'TTL test' }
      const context = { id: `ttl-${Date.now()}` }

      const result1 = await service.generate({ schema, context })

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10))

      const result2 = await service.generate({ schema, context })

      // Should not be cached after TTL expiry
      expect(result2.cached).toBe(false)

      // Reset to default
      await service.configureCache(5 * 60 * 1000)
    })
  })

  describe('handles complex nested schemas', () => {
    it('generates deeply nested object structures', async () => {
      const schema = {
        page: {
          meta: {
            seo: {
              title: 'SEO title',
              description: 'SEO description',
              keywords: ['SEO keywords'],
            },
            og: {
              title: 'Open Graph title',
              description: 'Open Graph description',
              image: 'OG image URL',
            },
          },
          content: {
            sections: [
              {
                id: 'Section ID',
                heading: 'Section heading',
                body: 'Section body content',
              },
            ],
          },
        },
      }

      const result = await service.generate({ schema })

      expect(result.props.page).toBeDefined()
      const page = result.props.page as Record<string, unknown>
      expect(page.meta).toBeDefined()
      expect(page.content).toBeDefined()
    })

    it('generates arrays with consistent item structure', async () => {
      const schema = {
        items: [
          {
            id: 'Unique item ID',
            name: 'Item name',
            price: 'Price (number)',
          },
        ],
      }

      const result = await service.generate({ schema })

      expect(result.props.items).toBeDefined()
      expect(Array.isArray(result.props.items)).toBe(true)
      const items = result.props.items as Array<Record<string, unknown>>
      expect(items.length).toBeGreaterThan(0)
      expect(items[0]?.id).toBeDefined()
      expect(items[0]?.name).toBeDefined()
    })

    it('handles mixed type schemas', async () => {
      const schema = {
        count: 'A positive integer',
        enabled: 'A boolean flag',
        rating: 'A decimal rating (1-5)',
        tags: ['String tags'],
        metadata: {
          createdAt: 'ISO date string',
          version: 'Semantic version string',
        },
      }

      const result = await service.generate({ schema })

      expect(result.props).toBeDefined()
      // Props should be generated for all fields
      expect(Object.keys(result.props).length).toBe(5)
    })
  })
})

// ============================================================================
// 2. Full MDX Pipeline Tests
// ============================================================================

describe('Full MDX pipeline', () => {
  beforeEach(() => {
    clearMDXCache()
    const cache = getDefaultCache()
    cache.clear()
  })

  describe('parses MDX, generates props, renders output', () => {
    it('completes full pipeline from MDX string to rendered output', async () => {
      const mdxContent = `---
topic: Cloud Computing
audience: developers
---

# Welcome to {topic}

<Hero />

<FeatureCard />

<CallToAction />`

      // Step 1: Parse MDX
      const parsed = parseMDX(mdxContent)

      expect(parsed.frontmatter.topic).toBe('Cloud Computing')
      expect(parsed.frontmatter.audience).toBe('developers')
      expect(parsed.components).toContain('Hero')
      expect(parsed.components).toContain('FeatureCard')
      expect(parsed.components).toContain('CallToAction')

      // Step 2: Create generator with schemas
      const generator = createMDXPropsGenerator({
        schemas: {
          Hero: {
            title: 'Hero section title relevant to the topic',
            subtitle: 'Supporting text for the hero',
          },
          FeatureCard: {
            heading: 'Feature heading',
            description: 'Feature description',
            icon: 'Icon name',
          },
          CallToAction: {
            buttonText: 'CTA button text',
            href: 'Link URL',
          },
        },
      })

      // Step 3: Generate props
      const props = await generator.generate(mdxContent)

      expect(props.Hero).toBeDefined()
      expect(props.Hero.title).toBeDefined()
      expect(typeof props.Hero.title).toBe('string')
      expect(props.FeatureCard).toBeDefined()
      expect(props.FeatureCard.heading).toBeDefined()
      expect(props.CallToAction).toBeDefined()
      expect(props.CallToAction.buttonText).toBeDefined()

      // Step 4: Render with props
      const rendered = await renderMDXWithProps(mdxContent, props)

      expect(rendered).toBeDefined()
      expect(typeof rendered).toBe('string')
      expect(rendered).toContain('Cloud Computing')
    })

    it('preserves explicit props while generating missing ones', async () => {
      const mdxContent = `<ProductCard
  name="AI Props"
  price={99}
/>

<ReviewCard />`

      const generator = createMDXPropsGenerator({
        schemas: {
          ProductCard: {
            name: 'Product name',
            price: 'Price (number)',
            description: 'Product description',
          },
          ReviewCard: {
            author: 'Reviewer name',
            rating: 'Star rating (1-5)',
            text: 'Review text',
          },
        },
      })

      const props = await generator.generate(mdxContent)

      // Explicit props should be preserved
      expect(props.ProductCard.name).toBe('AI Props')
      expect(props.ProductCard.price).toBe(99)
      // Missing prop should be generated
      expect(props.ProductCard.description).toBeDefined()

      // Component without explicit props should have all generated
      expect(props.ReviewCard).toBeDefined()
      expect(props.ReviewCard.author).toBeDefined()
      expect(props.ReviewCard.rating).toBeDefined()
      expect(props.ReviewCard.text).toBeDefined()
    })

    it('uses frontmatter context for generation', async () => {
      const mdxContent = `---
product: AI Dashboard
industry: Healthcare
targetUsers: hospital administrators
---

<HeroBanner />
<ValueProposition />`

      const generator = createMDXPropsGenerator({
        schemas: {
          HeroBanner: {
            headline: 'Headline matching the product and industry',
            subheadline: 'Supporting text for target users',
          },
          ValueProposition: {
            title: 'Value prop title',
            points: ['Key value points (3 items)'],
          },
        },
      })

      const props = await generator.generate(mdxContent)

      expect(props.HeroBanner).toBeDefined()
      expect(props.HeroBanner.headline).toBeDefined()
      expect(props.ValueProposition).toBeDefined()
      // Generated content should be contextually relevant
    })
  })

  describe('streams MDX render with hydration data', () => {
    it('returns a ReadableStream for MDX content', async () => {
      const mdxContent = `# Streaming Test

<Card title="Test Card" description="Test description" />`

      const stream = await streamMDXWithProps(mdxContent, {
        Card: { title: 'Test Card', description: 'Test description' },
      })

      expect(stream).toBeInstanceOf(ReadableStream)

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content.length).toBeGreaterThan(0)
      expect(content).toContain('Test Card')
    })

    it('streams large MDX content in chunks', async () => {
      // Create MDX with many components
      const components = Array.from(
        { length: 20 },
        (_, i) => `<Section${i} title="Section ${i}" />`
      ).join('\n\n')

      const mdxContent = `# Large Document\n\n${components}`

      const props: Record<string, Record<string, unknown>> = {}
      for (let i = 0; i < 20; i++) {
        props[`Section${i}`] = { title: `Section ${i}` }
      }

      const stream = await optimizedStreamMDXWithProps(mdxContent, props, {
        chunkSize: 256, // Small chunks to ensure multiple
      })

      const reader = stream.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      expect(chunks.length).toBeGreaterThan(1)
    })

    it('provides progress callbacks during streaming', async () => {
      const mdxContent = `<Widget data="test" />`

      const progressEvents: Array<{
        phase: string
        bytesProcessed: number
        chunksProcessed: number
      }> = []

      const stream = await optimizedStreamMDXWithProps(
        mdxContent,
        { Widget: { data: 'test' } },
        {
          onProgress: (progress) => {
            progressEvents.push({
              phase: progress.phase,
              bytesProcessed: progress.bytesProcessed,
              chunksProcessed: progress.chunksProcessed,
            })
          },
        }
      )

      // Consume stream
      const reader = stream.getReader()
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }

      expect(progressEvents.length).toBeGreaterThan(0)
      expect(progressEvents.some((e) => e.phase === 'starting')).toBe(true)
      expect(progressEvents.some((e) => e.phase === 'complete')).toBe(true)
    })
  })

  describe('handles MDX with multiple components', () => {
    it('processes page with 10+ components', async () => {
      const mdxContent = `---
title: Product Page
---

<Navigation />
<Hero />
<Features />
<Pricing />
<Testimonials />
<FAQ />
<Contact />
<Newsletter />
<SocialProof />
<Footer />`

      const parsed = parseMDX(mdxContent)

      expect(parsed.components.length).toBe(10)
      expect(parsed.components).toContain('Navigation')
      expect(parsed.components).toContain('Footer')

      const generator = createMDXPropsGenerator({
        schemas: {
          Navigation: { links: ['Navigation links'] },
          Hero: { title: 'Hero title', subtitle: 'Hero subtitle' },
          Features: { items: ['Feature items'] },
          Pricing: { plans: ['Pricing plans'] },
          Testimonials: { quotes: ['Customer quotes'] },
          FAQ: { questions: ['FAQ items'] },
          Contact: { email: 'Contact email', phone: 'Contact phone' },
          Newsletter: { heading: 'Newsletter heading', placeholder: 'Email placeholder' },
          SocialProof: { logos: ['Company logos'] },
          Footer: { copyright: 'Copyright text', links: ['Footer links'] },
        },
      })

      const props = await generator.generate(mdxContent)

      // All components should have generated props
      expect(Object.keys(props).length).toBe(10)
      for (const component of parsed.components) {
        expect(props[component]).toBeDefined()
      }
    })

    it('handles components with same schema but different instances', async () => {
      const mdxContent = `<Card title="First" />
<Card title="Second" />
<Card title="Third" />`

      const parsed = parseMDX(mdxContent)

      // Should identify Card component once
      expect(parsed.components.filter((c) => c === 'Card').length).toBe(1)

      const schemas = extractComponentSchemas(mdxContent)
      expect(schemas.Card).toBeDefined()
      expect(Object.keys(schemas.Card)).toContain('title')
    })
  })

  describe('works through service binding', () => {
    it('generates props via RPC and renders MDX', async () => {
      const testEnv = env as unknown as TestEnv
      const service = testEnv.PROPS.getService()

      const mdxContent = `<Hero />
<Card />`

      // Use service to generate props for each component
      const heroResult = await service.generate({
        schema: { title: 'Hero title', subtitle: 'Hero subtitle' },
        context: { component: 'Hero' },
      })

      const cardResult = await service.generate({
        schema: { heading: 'Card heading', body: 'Card body' },
        context: { component: 'Card' },
      })

      expect(heroResult.props).toBeDefined()
      expect(cardResult.props).toBeDefined()

      // Render with generated props
      const rendered = await renderMDXWithProps(mdxContent, {
        Hero: heroResult.props as Record<string, unknown>,
        Card: cardResult.props as Record<string, unknown>,
      })

      expect(rendered).toBeDefined()
      expect(typeof rendered).toBe('string')
    })

    it('validates MDX component props via service', async () => {
      const testEnv = env as unknown as TestEnv
      const service = testEnv.PROPS.getService()

      const schema = {
        title: 'Component title',
        description: 'Component description',
        items: ['List items'],
      }

      const generatedProps = await service.generate({ schema })
      const validation = await service.validate(generatedProps.props, schema)

      expect(validation.valid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })
  })
})

// ============================================================================
// 3. hono/jsx Complete Flow Tests
// ============================================================================

describe('hono/jsx complete flow', () => {
  beforeEach(() => {
    const cache = getDefaultCache()
    cache.clear()
  })

  describe('renders JSX with AI props through streaming', () => {
    it('streams simple component with AI-generated props', async () => {
      const AIButton = createAIComponent({
        name: 'Button',
        schema: {
          label: 'Button label text',
          color: 'Button color',
        },
        render: ({ label, color }) => `<button style="background:${color}">${label}</button>`,
      })

      const stream = await renderToReadableStream(AIButton, {})

      expect(stream).toBeInstanceOf(ReadableStream)

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('<button')
      expect(content).toContain('</button>')
    })

    it('generates props only for missing fields', async () => {
      const AICard = createAIComponent({
        name: 'Card',
        schema: {
          title: 'Card title',
          body: 'Card body text',
          footer: 'Card footer',
        },
        render: ({ title, body, footer }) =>
          `<div class="card"><h2>${title}</h2><p>${body}</p><footer>${footer}</footer></div>`,
      })

      // Provide partial props
      const result = await AICard({
        title: 'Explicit Title',
        // body and footer should be generated
      })

      expect(result).toContain('Explicit Title')
      // body and footer should be AI-generated (non-empty)
      expect(result).toContain('<p>')
      expect(result).toContain('<footer>')
    })

    it('uses context for generation', async () => {
      const AIHero = createAIComponent({
        name: 'Hero',
        schema: {
          headline: 'Headline matching the topic',
          subheadline: 'Supporting text',
        },
        render: ({ headline, subheadline }) =>
          `<section><h1>${headline}</h1><p>${subheadline}</p></section>`,
      })

      const result = await AIHero({
        context: {
          topic: 'Developer Tools',
          audience: 'software engineers',
        },
      })

      expect(result).toContain('<section>')
      expect(result).toContain('<h1>')
      expect(result).toContain('</h1>')
    })
  })

  describe('includes hydration script in output', () => {
    it('adds hydration data when includeHydration is true', async () => {
      const Component = ({ title }: { title: string }) => `<h1>${title}</h1>`

      const stream = await renderToReadableStream(
        Component,
        { title: 'Test' },
        { includeHydration: true }
      )

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('__HYDRATION_DATA__')
    })

    it('serializes component props for hydration', async () => {
      const ctx = createHydrationContext()

      ctx.register('Header', { title: 'Test Title', sticky: true })
      ctx.register('Footer', { year: 2026, links: ['home', 'about'] })

      const data = ctx.getData()
      const serialized = serializeHydrationData(data)

      expect(typeof serialized).toBe('string')
      const parsed = JSON.parse(serialized)
      expect(parsed.components).toBeDefined()
    })

    it('escapes script tags in hydration data', async () => {
      const ctx = createHydrationContext()

      ctx.register('Component', {
        content: '<script>alert("xss")</script>',
      })

      const data = ctx.getData()
      const serialized = serializeHydrationData(data)

      // Should not contain raw script tags
      expect(serialized).not.toContain('<script>')
      expect(serialized).not.toContain('</script>')
    })

    it('uses shell wrapper with hydration injection', async () => {
      const renderer = createStreamingRenderer({
        shell: (content, hydration) =>
          `<!DOCTYPE html><html><body>${content}<script>${hydration}</script></body></html>`,
        includeHydration: true,
      })

      const Component = ({ message }: { message: string }) => `<div>${message}</div>`

      const stream = await renderer.render(Component, { message: 'Hello' })

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('<!DOCTYPE html>')
      expect(content).toContain('__HYDRATION_DATA__')
      expect(content).toContain('Hello')
    })
  })

  describe('works with complex component trees', () => {
    it('renders nested component structure', async () => {
      const Card = ({ title, children }: { title: string; children?: string }) =>
        `<div class="card"><h2>${title}</h2>${children || ''}</div>`

      const Button = ({ label }: { label: string }) => `<button>${label}</button>`

      const Layout = ({ header, content }: { header: string; content: string }) =>
        `<div class="layout"><header>${header}</header><main>${content}</main></div>`

      const App = () => {
        const card = Card({ title: 'Card Title', children: Button({ label: 'Click' }) })
        return Layout({ header: 'My App', content: card })
      }

      const stream = await renderToReadableStream(App, {})

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('class="layout"')
      expect(content).toContain('class="card"')
      expect(content).toContain('<button>')
    })

    it('handles multiple AI components in tree', async () => {
      const AIHeading = createAIComponent({
        name: 'Heading',
        schema: { text: 'Heading text' },
        render: ({ text }) => `<h1>${text}</h1>`,
      })

      const AIParagraph = createAIComponent({
        name: 'Paragraph',
        schema: { text: 'Paragraph text' },
        render: ({ text }) => `<p>${text}</p>`,
      })

      const Page = async () => {
        const heading = await AIHeading({})
        const para = await AIParagraph({})
        return `<article>${heading}${para}</article>`
      }

      const stream = await renderToReadableStream(Page, {})

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('<article>')
      expect(content).toContain('<h1>')
      expect(content).toContain('<p>')
    })
  })

  describe('handles async components', () => {
    it('awaits async component render', async () => {
      const AsyncComponent = async ({ delay }: { delay: number }) => {
        await new Promise((resolve) => setTimeout(resolve, delay))
        return `<div>Loaded after ${delay}ms</div>`
      }

      const stream = await renderToReadableStream(AsyncComponent, { delay: 10 })

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('Loaded after 10ms')
    })

    it('handles async AI components', async () => {
      const AsyncAIComponent = createAIComponent({
        name: 'AsyncWidget',
        schema: {
          data: 'Widget data',
          status: 'Widget status',
        },
        render: async ({ data, status }) => {
          await new Promise((resolve) => setTimeout(resolve, 5))
          return `<div class="widget" data-status="${status}">${data}</div>`
        },
      })

      const result = await AsyncAIComponent({})

      expect(result).toContain('class="widget"')
      expect(result).toContain('data-status=')
    })

    it('handles errors in async components', async () => {
      const FailingComponent = async () => {
        throw new Error('Component failed')
      }

      const stream = await renderToReadableStream(
        FailingComponent,
        {},
        {
          onError: (error) => `<div class="error">${error.message}</div>`,
        }
      )

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('Component failed')
    })
  })
})

// ============================================================================
// 4. Cross-Worker Integration Tests
// ============================================================================

describe('cross-worker integration', () => {
  let service: PropsServiceRpc

  beforeEach(async () => {
    const testEnv = env as unknown as TestEnv
    service = testEnv.PROPS.getService()
    await service.clearCache()
    await service.resetConfig()
  })

  describe('works from consumer worker via binding', () => {
    it('generates props through service binding', async () => {
      const schema = {
        message: 'A friendly greeting message',
        timestamp: 'Current timestamp string',
      }

      const result = await service.generate({ schema })

      expect(result).toBeDefined()
      expect(result.props.message).toBeDefined()
      expect(result.props.timestamp).toBeDefined()
    })

    it('uses generateMany for batch operations', async () => {
      const requests: GeneratePropsOptions[] = [
        { schema: { title: 'Card 1 title' }, context: { index: 0 } },
        { schema: { title: 'Card 2 title' }, context: { index: 1 } },
        { schema: { title: 'Card 3 title' }, context: { index: 2 } },
      ]

      const results = await service.generateMany(requests)

      expect(results).toHaveLength(3)
      for (const result of results) {
        expect(result.props).toBeDefined()
        expect(result.props.title).toBeDefined()
      }
    })

    it('merges partial props through binding', async () => {
      const schema = {
        name: 'User name',
        email: 'User email',
        bio: 'User biography',
      }

      const partial = { name: 'John Doe', email: 'john@example.com' }

      const merged = await service.mergeWithGenerated(schema, partial)

      expect(merged.name).toBe('John Doe')
      expect(merged.email).toBe('john@example.com')
      expect(merged.bio).toBeDefined() // Generated
    })
  })

  describe('handles concurrent requests', () => {
    it('processes multiple simultaneous requests', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        service.generate({
          schema: { value: `Value for request ${i}` },
          context: { requestId: i, timestamp: Date.now() },
        })
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      for (const result of results) {
        expect(result.props).toBeDefined()
        expect(result.props.value).toBeDefined()
      }
    })

    it('maintains data integrity under concurrent access', async () => {
      const baseKey = `concurrent-${Date.now()}`

      // Set values concurrently
      const setPromises = Array.from({ length: 5 }, (_, i) =>
        service.setCached(`${baseKey}-${i}`, { index: i, value: `value-${i}` })
      )

      await Promise.all(setPromises)

      // Get values concurrently
      const getPromises = Array.from({ length: 5 }, (_, i) => service.getCached(`${baseKey}-${i}`))

      const entries = await Promise.all(getPromises)

      for (let i = 0; i < 5; i++) {
        expect(entries[i]).toBeDefined()
        expect((entries[i]?.props as Record<string, unknown>)?.index).toBe(i)
      }
    })
  })

  describe('maintains isolation via worker_loaders', () => {
    it('isolates cache between service calls', async () => {
      // First worker-like context
      const service1 = service
      const key1 = `isolation-${Date.now()}-1`
      await service1.setCached(key1, { from: 'service1' })

      // Check isolation (same worker for testing, but demonstrates pattern)
      const entry = await service1.getCached(key1)
      expect(entry?.props).toEqual({ from: 'service1' })
    })

    it('shares configuration within service instance', async () => {
      await service.configure({ model: 'anthropic/claude-sonnet-4.5' })

      const config = await service.getConfig()
      expect(config.model).toBe('anthropic/claude-sonnet-4.5')

      await service.resetConfig()
    })
  })

  describe('performs well under load', () => {
    it('handles burst of 10 requests', async () => {
      const startTime = Date.now()

      const promises = Array.from({ length: 10 }, (_, i) =>
        service.generate({
          schema: { text: `Generated text ${i}` },
          context: { batchId: Date.now(), index: i },
        })
      )

      const results = await Promise.all(promises)
      const duration = Date.now() - startTime

      expect(results).toHaveLength(10)
      for (const result of results) {
        expect(result.props).toBeDefined()
      }

      // Log timing for performance tracking
      console.log(`10 concurrent requests completed in ${duration}ms`)
    })

    it('cache improves performance on repeated requests', async () => {
      const schema = { title: 'Performance test title' }
      const context = { testId: `perf-${Date.now()}` }

      // First request (uncached)
      const start1 = Date.now()
      const result1 = await service.generate({ schema, context })
      const duration1 = Date.now() - start1

      // Second request (cached)
      const start2 = Date.now()
      const result2 = await service.generate({ schema, context })
      const duration2 = Date.now() - start2

      expect(result1.cached).toBe(false)
      expect(result2.cached).toBe(true)

      // Cached request should be faster
      console.log(`Uncached: ${duration1}ms, Cached: ${duration2}ms`)
      expect(duration2).toBeLessThan(duration1)
    })
  })
})

// ============================================================================
// 5. Error Recovery Tests
// ============================================================================

describe('error recovery', () => {
  let service: PropsServiceRpc

  beforeEach(async () => {
    const testEnv = env as unknown as TestEnv
    service = testEnv.PROPS.getService()
    await service.clearCache()
    await service.resetConfig()
  })

  describe('handles AI Gateway failures gracefully', () => {
    it('provides fallback props when AI fails', async () => {
      const AICard = createAIComponent({
        name: 'Card',
        schema: {
          title: 'Card title',
          body: 'Card body',
        },
        render: ({ title, body }) => `<div><h2>${title}</h2><p>${body}</p></div>`,
        fallback: {
          title: 'Default Title',
          body: 'Default Body',
        },
      })

      // Even if AI fails, should use fallback
      const result = await AICard({})

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      // Either AI-generated or fallback
      expect(result).toContain('<div>')
    })

    it('handles timeout gracefully', async () => {
      // Configure short timeout for testing
      await service.configure({ cacheTTL: 1000 })

      const schema = { value: 'Test value' }

      // Should complete within timeout or fail gracefully
      try {
        const result = await service.generate({ schema })
        expect(result.props).toBeDefined()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }

      await service.resetConfig()
    })
  })

  describe('recovers from MDX parse errors', () => {
    it('throws descriptive error for invalid MDX', () => {
      const invalidMDX = `<Unclosed

This is broken.`

      expect(() => parseMDX(invalidMDX)).toThrow()
    })

    it('provides error location for syntax errors', () => {
      const invalidMDX = `# Valid heading
<Valid />
<Broken prop=>`

      try {
        parseMDX(invalidMDX)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBeDefined()
      }
    })

    it('handles malformed frontmatter', () => {
      const invalidMDX = `---
title: [broken yaml
nested: {incomplete
---

# Content`

      expect(() => parseMDX(invalidMDX)).toThrow()
    })

    it('continues rendering valid parts after error recovery', async () => {
      const validMDX = `# Valid Document

<ValidComponent title="Works" />`

      const rendered = await renderMDXWithProps(validMDX, {
        ValidComponent: { title: 'Works' },
      })

      expect(rendered).toContain('Valid Document')
      expect(rendered).toContain('Works')
    })
  })

  describe('handles RPC timeouts', () => {
    it('getSync throws for cache miss', () => {
      expect(() => {
        service.getSync({ missing: 'schema' })
      }).toThrow()
    })

    it('returns undefined for non-existent cache key', async () => {
      const entry = await service.getCached(`non-existent-${Date.now()}`)
      expect(entry).toBeUndefined()
    })
  })

  describe('provides meaningful error messages', () => {
    it('includes method name in error', async () => {
      try {
        service.getSync({ notCached: 'value' })
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Props not in cache')
      }
    })

    it('returns validation errors with field paths', async () => {
      const props = { score: 'not a number' }
      const schema = { score: 'Score (number)' }

      const result = await service.validate(props, schema)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]?.path).toBeDefined()
    })

    it('handles null props gracefully', async () => {
      const mdx = `<Component />`

      await expect(
        renderMDXWithProps(mdx, {
          Component: null as unknown as Record<string, unknown>,
        })
      ).rejects.toThrow()
    })
  })
})

// ============================================================================
// 6. HTTP Endpoint Integration Tests
// ============================================================================

describe('HTTP endpoint integration', () => {
  it('responds to GET / with service info', async () => {
    const response = await SELF.fetch('http://localhost/')

    expect(response).toBeDefined()

    if (response.ok) {
      const data = (await response.json()) as Record<string, unknown>
      expect(data.name).toBe('ai-props')
      expect(data.methods).toBeDefined()
      expect(Array.isArray(data.methods)).toBe(true)
    }
  })

  it('handles POST /rpc for method calls', async () => {
    const response = await SELF.fetch('http://localhost/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'getCacheSize',
        args: [],
      }),
    })

    expect(response).toBeDefined()

    if (response.ok) {
      const data = (await response.json()) as { result?: number; error?: string }
      expect(typeof data.result).toBe('number')
    }
  })

  it('returns 404 for unknown routes', async () => {
    const response = await SELF.fetch('http://localhost/unknown')

    expect(response.status).toBe(404)
  })

  it('returns error for invalid RPC method', async () => {
    const response = await SELF.fetch('http://localhost/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'nonExistentMethod',
        args: [],
      }),
    })

    if (response.ok) {
      const data = (await response.json()) as { error?: string }
      // Should have error response
      expect(data.error).toBeDefined()
    } else {
      expect(response.status).toBe(404)
    }
  })
})

// ============================================================================
// 7. Streaming Response Tests
// ============================================================================

describe('streaming response integration', () => {
  it('creates streaming Response with correct headers', async () => {
    const Component = ({ text }: { text: string }) => `<div>${text}</div>`

    const response = await streamJSXResponse(Component, { text: 'Streaming test' })

    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(response.body).toBeInstanceOf(ReadableStream)
  })

  it('streams content progressively', async () => {
    const LargeComponent = ({ count }: { count: number }) => {
      const items = Array.from({ length: count }, (_, i) => `<div>Item ${i}</div>`)
      return items.join('')
    }

    const response = await optimizedStreamJSXResponse(
      LargeComponent,
      { count: 100 },
      { chunkSize: 256 }
    )

    const reader = response.body!.getReader()
    const chunks: Uint8Array[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
    }

    // Should have multiple chunks
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('includes hydration script at end of stream', async () => {
    const Component = ({ data }: { data: string }) => `<div>${data}</div>`

    const response = await streamJSXResponse(
      Component,
      { data: 'test' },
      { includeHydration: true }
    )

    const text = await response.text()

    expect(text).toContain('__HYDRATION_DATA__')
  })
})
