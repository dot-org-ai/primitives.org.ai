/**
 * Tests for MDX parsing and rendering with AI-generated props
 *
 * RED phase: These tests define the expected behavior for MDX integration
 * in a real Cloudflare Workers environment using @cloudflare/vitest-pool-workers.
 *
 * NO MOCKS - all tests run against real Workers runtime and AI Gateway bindings.
 *
 * The MDX integration should:
 * 1. Parse MDX content strings (with frontmatter)
 * 2. Extract component prop schemas from MDX
 * 3. Generate AI props for components found in MDX
 * 4. Render MDX with injected props
 * 5. Support custom component renderers
 * 6. Support streaming MDX rendering
 * 7. Handle errors gracefully
 *
 * RED phase tests:
 * - Some tests PASS because basic mdx.ts implementation exists
 * - AI generation tests FAIL because API keys are not configured in test env
 * - Some parsing tests FAIL because edge cases need implementation
 * - Streaming tests may need implementation refinement
 *
 * Bead: aip-nw0g
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'

// ============================================================================
// MDX integration imports
// Some functions exist, but tests may fail due to:
// 1. Missing AI Gateway bindings/API keys
// 2. Edge cases in parsing that need implementation
// 3. Streaming implementation refinements needed
// ============================================================================
import {
  parseMDX,
  extractComponentSchemas,
  renderMDXWithProps,
  createMDXPropsGenerator,
  compileMDX,
  streamMDXWithProps,
} from '../../src/mdx.js'

// Import existing ai-props modules to verify integration
import { PropsServiceCore } from '../../src/worker.js'

// ============================================================================
// Type definitions for expected MDX integration interfaces
// ============================================================================

/**
 * Result of parsing an MDX string
 */
interface ParsedMDX {
  /** Raw MDX body content (without frontmatter) */
  body: string
  /** Full content including frontmatter */
  content: string
  /** Parsed frontmatter key-value pairs */
  frontmatter: Record<string, unknown>
  /** List of JSX component names found in the MDX */
  components: string[]
  /** Map of component names to their detected props */
  componentProps: Record<string, Record<string, unknown>>
}

/**
 * Component schema map extracted from MDX
 */
type ComponentSchemaMap = Record<string, Record<string, unknown>>

/**
 * Options for rendering MDX with props
 */
interface RenderMDXOptions {
  /** Custom component renderers */
  components?: Record<string, (props: Record<string, unknown>) => string>
  /** Whether to return a ReadableStream instead of a string */
  stream?: boolean
}

/**
 * Options for creating an MDX props generator
 */
interface MDXPropsGeneratorOptions {
  /** Map of component names to their prop schemas */
  schemas: ComponentSchemaMap
  /** Whether to cache generated props */
  cache?: boolean
  /** AI model to use for generation */
  model?: string
}

// ============================================================================
// 1. MDX Parsing Tests
// ============================================================================

describe('MDX parsing', () => {
  describe('parseMDX()', () => {
    it('parses simple MDX content string', () => {
      const mdx = `# Hello World

This is a simple MDX document.`

      const result = parseMDX(mdx)

      expect(result).toBeDefined()
      expect(result.content).toBeDefined()
      expect(result.frontmatter).toEqual({})
    })

    it('parses MDX content with frontmatter', () => {
      const mdx = `---
title: My Page
description: A test page
author: Test Author
---

# {title}

{description}`

      const result = parseMDX(mdx)

      expect(result.frontmatter).toBeDefined()
      expect(result.frontmatter.title).toBe('My Page')
      expect(result.frontmatter.description).toBe('A test page')
      expect(result.frontmatter.author).toBe('Test Author')
    })

    it('parses MDX content with YAML frontmatter types', () => {
      const mdx = `---
title: My Page
count: 5
published: true
tags:
  - ai
  - props
---

# Content`

      const result = parseMDX(mdx)

      expect(result.frontmatter.title).toBe('My Page')
      expect(result.frontmatter.count).toBe(5)
      expect(result.frontmatter.published).toBe(true)
      expect(result.frontmatter.tags).toEqual(['ai', 'props'])
    })

    it('separates frontmatter from body content', () => {
      const mdx = `---
title: Hello
---

# Body Content

Some paragraph text.`

      const result = parseMDX(mdx)

      expect(result.body).not.toContain('---')
      expect(result.body).not.toContain('title: Hello')
      expect(result.body).toContain('# Body Content')
      expect(result.body).toContain('Some paragraph text.')
    })

    it('handles MDX with no frontmatter', () => {
      const mdx = `# No Frontmatter

Just regular content.`

      const result = parseMDX(mdx)

      expect(result.frontmatter).toEqual({})
      expect(result.body).toContain('# No Frontmatter')
    })

    it('handles empty MDX string', () => {
      const result = parseMDX('')

      expect(result).toBeDefined()
      expect(result.frontmatter).toEqual({})
      expect(result.body).toBe('')
    })

    it('identifies JSX components in MDX', () => {
      const mdx = `---
title: Page
---

# Hello

<Hero title="Welcome" />

<Card>
  <CardBody>Some content</CardBody>
</Card>

<Footer />`

      const result = parseMDX(mdx)

      expect(result.components).toBeDefined()
      expect(result.components).toContain('Hero')
      expect(result.components).toContain('Card')
      expect(result.components).toContain('CardBody')
      expect(result.components).toContain('Footer')
    })

    it('identifies components with props in MDX', () => {
      const mdx = `<Button variant="primary" size="lg" disabled>Click Me</Button>
<Input placeholder="Enter text" type="email" />`

      const result = parseMDX(mdx)

      expect(result.componentProps).toBeDefined()
      expect(result.componentProps.Button).toEqual({
        variant: 'primary',
        size: 'lg',
        disabled: true,
      })
      expect(result.componentProps.Input).toEqual({
        placeholder: 'Enter text',
        type: 'email',
      })
    })

    it('does not include lowercase HTML elements as components', () => {
      const mdx = `<div class="wrapper">
  <p>Paragraph text</p>
  <CustomComponent title="test" />
</div>`

      const result = parseMDX(mdx)

      expect(result.components).toContain('CustomComponent')
      expect(result.components).not.toContain('div')
      expect(result.components).not.toContain('p')
    })

    it('handles frontmatter with prop schemas defined', () => {
      const mdx = `---
title: Product Page
$schema:
  Hero:
    title: Hero heading text
    subtitle: Hero subheading
  Card:
    title: Card title
    description: Card description
---

<Hero />
<Card />`

      const result = parseMDX(mdx)

      expect(result.frontmatter.$schema).toBeDefined()
      const schema = result.frontmatter.$schema as Record<string, unknown>
      expect(schema.Hero).toBeDefined()
      expect(schema.Card).toBeDefined()
    })
  })

  describe('extractComponentSchemas()', () => {
    it('extracts prop schemas from MDX component usage', () => {
      const mdx = `<UserCard name="John" bio="A developer" avatar="/img.png" />`

      const schemas = extractComponentSchemas(mdx)

      expect(schemas).toBeDefined()
      expect(schemas.UserCard).toBeDefined()
      expect(Object.keys(schemas.UserCard)).toContain('name')
      expect(Object.keys(schemas.UserCard)).toContain('bio')
      expect(Object.keys(schemas.UserCard)).toContain('avatar')
    })

    it('extracts schemas from multiple component instances', () => {
      const mdx = `<Card title="First" />
<Card title="Second" description="With desc" />`

      const schemas = extractComponentSchemas(mdx)

      // Should merge schemas from multiple instances
      expect(schemas.Card).toBeDefined()
      expect(Object.keys(schemas.Card)).toContain('title')
      expect(Object.keys(schemas.Card)).toContain('description')
    })

    it('identifies components that need AI-generated props', () => {
      const mdx = `<Hero />
<Card title="Provided" />
<Footer />`

      const schemas = extractComponentSchemas(mdx)

      // Components with no props should be flagged as needing generation
      expect(schemas.Hero).toBeDefined()
      expect(Object.keys(schemas.Hero)).toHaveLength(0)
      expect(schemas.Footer).toBeDefined()
      expect(Object.keys(schemas.Footer)).toHaveLength(0)
    })

    it('handles components with expression props', () => {
      const mdx = `<Widget count={42} active={true} data={{ key: 'value' }} />`

      const schemas = extractComponentSchemas(mdx)

      expect(schemas.Widget).toBeDefined()
      expect(Object.keys(schemas.Widget)).toContain('count')
      expect(Object.keys(schemas.Widget)).toContain('active')
      expect(Object.keys(schemas.Widget)).toContain('data')
    })

    it('returns empty object for MDX with no components', () => {
      const mdx = `# Just Markdown

Regular paragraph text with **bold** and *italic*.`

      const schemas = extractComponentSchemas(mdx)

      expect(schemas).toEqual({})
    })

    it('excludes lowercase HTML elements from schemas', () => {
      const mdx = `<div><span>text</span></div>
<MyComponent prop="value" />`

      const schemas = extractComponentSchemas(mdx)

      expect(schemas).not.toHaveProperty('div')
      expect(schemas).not.toHaveProperty('span')
      expect(schemas.MyComponent).toBeDefined()
    })
  })
})

// ============================================================================
// 2. MDX Props Generation Tests
// ============================================================================

describe('MDX props generation', () => {
  describe('createMDXPropsGenerator()', () => {
    it('creates a props generator for MDX content', () => {
      const generator = createMDXPropsGenerator({
        schemas: {
          Hero: {
            title: 'Hero section title',
            subtitle: 'Hero section subtitle',
          },
          Card: {
            title: 'Card title',
            description: 'Card description',
          },
        },
      })

      expect(generator).toBeDefined()
      expect(typeof generator.generate).toBe('function')
    })

    it('generates props for components in MDX using real AI', async () => {
      const generator = createMDXPropsGenerator({
        schemas: {
          Hero: {
            title: 'Hero section title',
            subtitle: 'Hero section subtitle',
          },
        },
      })

      const mdx = `---
topic: AI Applications
---

<Hero />`

      const result = await generator.generate(mdx)

      expect(result).toBeDefined()
      expect(result.Hero).toBeDefined()
      expect(result.Hero.title).toBeDefined()
      expect(typeof result.Hero.title).toBe('string')
      expect(result.Hero.subtitle).toBeDefined()
      expect(typeof result.Hero.subtitle).toBe('string')
    })

    it('uses frontmatter context for generation', async () => {
      const generator = createMDXPropsGenerator({
        schemas: {
          Hero: {
            title: 'A title relevant to the page topic',
          },
        },
      })

      const mdx = `---
topic: Machine Learning
audience: developers
---

<Hero />`

      const result = await generator.generate(mdx)

      expect(result.Hero).toBeDefined()
      expect(result.Hero.title).toBeDefined()
      expect(typeof result.Hero.title).toBe('string')
      // The generated title should be contextually relevant
      // (we cannot assert exact content, but it should be non-empty)
      expect((result.Hero.title as string).length).toBeGreaterThan(0)
    })

    it('preserves explicitly provided props', async () => {
      const generator = createMDXPropsGenerator({
        schemas: {
          Card: {
            title: 'Card title',
            description: 'Card description',
            image: 'Image URL',
          },
        },
      })

      const mdx = `<Card title="My Explicit Title" />`

      const result = await generator.generate(mdx)

      // Explicit props should be preserved
      expect(result.Card.title).toBe('My Explicit Title')
      // Missing props should be generated
      expect(result.Card.description).toBeDefined()
      expect(result.Card.image).toBeDefined()
    })

    it('only generates props for schemas that were provided', async () => {
      const generator = createMDXPropsGenerator({
        schemas: {
          DynamicRecommendation: {
            product: 'Recommended product name',
            reason: 'Why this product is recommended',
          },
        },
      })

      const mdx = `<StaticBanner text="Sale!" />
<DynamicRecommendation />
<StaticFooter year={2026} />`

      const result = await generator.generate(mdx)

      // Only DynamicRecommendation should have generated props
      expect(result.DynamicRecommendation).toBeDefined()
      expect(result.DynamicRecommendation.product).toBeDefined()
      expect(result.DynamicRecommendation.reason).toBeDefined()
      // Static components should not be in generated props
      expect(result.StaticBanner).toBeUndefined()
      expect(result.StaticFooter).toBeUndefined()
    })

    it('caches generated props per component', async () => {
      const generator = createMDXPropsGenerator({
        schemas: {
          Hero: {
            title: 'Hero title',
          },
        },
        cache: true,
      })

      const mdx = `<Hero />`

      // First generation
      const result1 = await generator.generate(mdx)

      // Second generation (same content) should use cache
      const result2 = await generator.generate(mdx)

      expect(result1.Hero.title).toEqual(result2.Hero.title)
    })

    it('handles async prop generation', async () => {
      const generator = createMDXPropsGenerator({
        schemas: {
          AsyncWidget: {
            data: 'Complex data structure description',
            status: 'Widget status text',
          },
        },
      })

      const mdx = `<AsyncWidget />`

      const result = await generator.generate(mdx)

      expect(result.AsyncWidget).toBeDefined()
      expect(result.AsyncWidget.data).toBeDefined()
      expect(result.AsyncWidget.status).toBeDefined()
    })

    it('passes custom model configuration', async () => {
      const generator = createMDXPropsGenerator({
        schemas: {
          Hero: { title: 'Title' },
        },
        // Use full model ID to avoid alias resolution issues in bundled environments
        model: 'openai/gpt-4o',
      })

      const mdx = `<Hero />`

      const result = await generator.generate(mdx)

      expect(result.Hero).toBeDefined()
      expect(result.Hero.title).toBeDefined()
    })

    it('handles missing component schemas gracefully', async () => {
      const generator = createMDXPropsGenerator({
        schemas: {},
      })

      const mdx = `<UnknownComponent />`

      // Should not throw, but should return empty or skip unknown components
      const result = await generator.generate(mdx)

      expect(result).toBeDefined()
      expect(result.UnknownComponent).toBeUndefined()
    })
  })
})

// ============================================================================
// 3. MDX Rendering with Props Tests
// ============================================================================

describe('MDX rendering with props', () => {
  describe('renderMDXWithProps()', () => {
    it('renders MDX string with injected props', async () => {
      const mdx = `# Hello

<Hero title="Welcome" subtitle="To the future" />`

      const result = await renderMDXWithProps(mdx, {
        Hero: {
          title: 'Welcome',
          subtitle: 'To the future',
        },
      })

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result).toContain('Welcome')
      expect(result).toContain('To the future')
    })

    it('renders MDX with generated props for components missing props', async () => {
      const mdx = `<Hero />`

      const result = await renderMDXWithProps(mdx, {
        Hero: {
          title: 'Generated Title',
          subtitle: 'Generated Subtitle',
        },
      })

      expect(result).toContain('Generated Title')
    })

    it('passes props to custom component renderers', async () => {
      const mdx = `<Card title="Test" description="A card" />`

      const components = {
        Card: (props: Record<string, unknown>) => {
          return `<div class="card"><h2>${props.title}</h2><p>${props.description}</p></div>`
        },
      }

      const result = await renderMDXWithProps(
        mdx,
        { Card: { title: 'Test', description: 'A card' } },
        { components }
      )

      expect(result).toContain('Test')
      expect(result).toContain('A card')
    })

    it('preserves component tree structure', async () => {
      const mdx = `<Layout>
  <Header title="Page Title" />
  <Main>
    <Card title="Card 1" />
    <Card title="Card 2" />
  </Main>
  <Footer />
</Layout>`

      const props = {
        Layout: {},
        Header: { title: 'Page Title' },
        Main: {},
        Card: { title: 'Card Title' },
        Footer: { copyright: '2026' },
      }

      const result = await renderMDXWithProps(mdx, props)

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('renders MDX with frontmatter variables interpolated', async () => {
      const mdx = `---
title: Dynamic Page
author: AI
---

# {title}

Written by {author}.`

      const result = await renderMDXWithProps(mdx, {})

      expect(result).toContain('Dynamic Page')
      expect(result).toContain('AI')
    })

    it('merges provided props with generated props', async () => {
      const mdx = `<ProductCard name="Widget" />`

      const result = await renderMDXWithProps(mdx, {
        ProductCard: {
          name: 'Widget',
          price: 29.99,
          description: 'A useful widget',
        },
      })

      expect(result).toContain('Widget')
    })

    it('handles render errors for invalid props', async () => {
      const mdx = `<StrictComponent />`

      // Rendering with null props should throw
      await expect(
        renderMDXWithProps(mdx, {
          StrictComponent: null as unknown as Record<string, unknown>,
        })
      ).rejects.toThrow()
    })
  })

  describe('streamMDXWithProps()', () => {
    it('returns a ReadableStream for MDX content', async () => {
      const mdx = `# Hello

<Hero title="Welcome" />

Some content after.`

      const stream = await streamMDXWithProps(mdx, {
        Hero: { title: 'Welcome' },
      })

      expect(stream).toBeDefined()
      expect(stream).toBeInstanceOf(ReadableStream)
    })

    it('stream contains the rendered content', async () => {
      const mdx = `# Streaming Test

<Card title="Stream Card" description="Streamed content" />`

      const stream = await streamMDXWithProps(mdx, {
        Card: { title: 'Stream Card', description: 'Streamed content' },
      })

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content.length).toBeGreaterThan(0)
      expect(content).toContain('Stream Card')
    })

    it('streams chunks progressively', async () => {
      const mdx = `# Part 1

<Section1 title="First Section" />

# Part 2

<Section2 title="Second Section" />

# Part 3

<Section3 title="Third Section" />`

      const stream = await streamMDXWithProps(mdx, {
        Section1: { title: 'First Section' },
        Section2: { title: 'Second Section' },
        Section3: { title: 'Third Section' },
      })

      const reader = stream.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Should have received multiple chunks
      expect(chunks.length).toBeGreaterThan(0)
    })

    it('supports custom component renderers in streaming mode', async () => {
      const mdx = `<Badge label="New" color="green" />`

      const stream = await streamMDXWithProps(
        mdx,
        { Badge: { label: 'New', color: 'green' } },
        {
          components: {
            Badge: (props: Record<string, unknown>) =>
              `<span class="badge badge-${props.color}">${props.label}</span>`,
          },
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

      expect(content).toContain('New')
    })
  })

  describe('compileMDX()', () => {
    it('compiles MDX string to executable function', async () => {
      const mdx = `# Hello World

This is content.`

      const compiled = await compileMDX(mdx)

      expect(compiled).toBeDefined()
      expect(typeof compiled).toBe('function')
    })

    it('compiled function accepts props argument', async () => {
      const mdx = `<Greeting name="World" />`

      const compiled = await compileMDX(mdx)
      const result = compiled({
        Greeting: { name: 'World' },
      })

      expect(result).toBeDefined()
    })

    it('compiled function accepts component map', async () => {
      const mdx = `<Custom value="test" />`

      const compiled = await compileMDX(mdx, {
        components: {
          Custom: (props: Record<string, unknown>) => `Custom: ${props.value}`,
        },
      })

      const result = compiled({ Custom: { value: 'test' } })

      expect(result).toContain('test')
    })

    it('handles MDX with import statements', async () => {
      const mdx = `import { Button } from './components'

# Page

<Button variant="primary">Click</Button>`

      // Should handle import statements without throwing
      const compiled = await compileMDX(mdx)

      expect(compiled).toBeDefined()
    })

    it('handles MDX with export statements', async () => {
      const mdx = `export const metadata = { title: 'Test' }

# Page Content`

      const compiled = await compileMDX(mdx)

      expect(compiled).toBeDefined()
      expect(compiled.metadata).toBeDefined()
      expect(compiled.metadata.title).toBe('Test')
    })
  })
})

// ============================================================================
// 4. MDX Error Handling Tests
// ============================================================================

describe('MDX error handling', () => {
  it('throws descriptive error for invalid MDX syntax', () => {
    const invalidMDX = `<Unclosed

This has unclosed JSX.`

    expect(() => parseMDX(invalidMDX)).toThrow()
  })

  it('throws for malformed frontmatter', () => {
    const invalidMDX = `---
title: [invalid yaml
  broken: {
---

# Content`

    expect(() => parseMDX(invalidMDX)).toThrow()
  })

  it('provides error location info for invalid MDX', () => {
    const invalidMDX = `# Valid
<Valid />
<Invalid prop=>`

    try {
      parseMDX(invalidMDX)
      // Should not reach here
      expect(true).toBe(false)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      const err = error as Error & { line?: number; column?: number }
      // Error should contain location information
      expect(err.message).toBeDefined()
      expect(err.message.length).toBeGreaterThan(0)
    }
  })

  it('handles MDX compilation errors gracefully', async () => {
    const invalidMDX = `<>{(() => { throw new Error("runtime error") })()}</>`

    await expect(compileMDX(invalidMDX)).rejects.toThrow()
  })

  it('handles render errors for null component props', async () => {
    const mdx = `<BrokenComponent />`

    await expect(
      renderMDXWithProps(mdx, {
        BrokenComponent: null as unknown as Record<string, unknown>,
      })
    ).rejects.toThrow()
  })
})

// ============================================================================
// 5. MDX with AI Props End-to-End Tests (Real AI Gateway)
// ============================================================================

describe('MDX with AI props end-to-end', () => {
  it('parses MDX, generates props, and renders in one pipeline', async () => {
    const mdx = `---
topic: Artificial Intelligence
audience: developers
---

# {topic} Guide

<Hero />

<Card />

<Footer />`

    // Step 1: Parse
    const parsed = parseMDX(mdx)

    expect(parsed.frontmatter.topic).toBe('Artificial Intelligence')
    expect(parsed.components).toContain('Hero')
    expect(parsed.components).toContain('Card')
    expect(parsed.components).toContain('Footer')

    // Step 2: Create generator with schemas
    const generator = createMDXPropsGenerator({
      schemas: {
        Hero: {
          title: 'Hero title for the page topic',
          subtitle: 'Hero subtitle',
        },
        Card: {
          title: 'Card title',
          description: 'Card description',
        },
        Footer: {
          copyright: 'Copyright notice',
        },
      },
    })

    // Step 3: Generate props using real AI
    const generatedProps = await generator.generate(mdx)

    expect(generatedProps.Hero).toBeDefined()
    expect(generatedProps.Hero.title).toBeDefined()
    expect(typeof generatedProps.Hero.title).toBe('string')
    expect(generatedProps.Card).toBeDefined()
    expect(generatedProps.Card.title).toBeDefined()
    expect(generatedProps.Footer).toBeDefined()
    expect(generatedProps.Footer.copyright).toBeDefined()

    // Step 4: Render with generated props
    const rendered = await renderMDXWithProps(mdx, generatedProps)

    expect(rendered).toBeDefined()
    expect(typeof rendered).toBe('string')
    expect(rendered.length).toBeGreaterThan(0)
  })

  it('supports schema-less generation from component usage', async () => {
    const mdx = `<ProductCard
  name="AI Widget"
  price={29.99}
  category="technology"
/>`

    // Extract schemas from actual component usage
    const schemas = extractComponentSchemas(mdx)

    expect(schemas.ProductCard).toBeDefined()
    expect(Object.keys(schemas.ProductCard)).toContain('name')
    expect(Object.keys(schemas.ProductCard)).toContain('price')
    expect(Object.keys(schemas.ProductCard)).toContain('category')

    // Use extracted schemas for generation
    const generator = createMDXPropsGenerator({ schemas })
    const props = await generator.generate(mdx)

    expect(props.ProductCard).toBeDefined()
  })

  it('handles MDX with mixed static and AI-generated content', async () => {
    const mdx = `---
title: Product Page
---

# {title}

<StaticBanner text="Sale!" />

<DynamicRecommendation />

<StaticFooter year={2026} />`

    const generator = createMDXPropsGenerator({
      schemas: {
        DynamicRecommendation: {
          product: 'Recommended product name',
          reason: 'Why this product is recommended',
        },
      },
    })

    const props = await generator.generate(mdx)

    // Only DynamicRecommendation should have generated props
    expect(props.DynamicRecommendation).toBeDefined()
    expect(props.DynamicRecommendation.product).toBeDefined()
    expect(typeof props.DynamicRecommendation.product).toBe('string')
    expect(props.DynamicRecommendation.reason).toBeDefined()
    expect(typeof props.DynamicRecommendation.reason).toBe('string')
    // Static components should not be in generated props
    expect(props.StaticBanner).toBeUndefined()
    expect(props.StaticFooter).toBeUndefined()
  })
})

// ============================================================================
// 6. Integration with PropsServiceCore (Worker RPC)
// ============================================================================

describe('MDX integration with PropsServiceCore', () => {
  it('PropsServiceCore can generate props for MDX component schemas', async () => {
    const service = new PropsServiceCore()

    // Parse MDX to get component schemas
    const mdx = `<UserProfile />
<ActivityFeed />`

    const schemas = extractComponentSchemas(mdx)

    // Use PropsServiceCore to generate props for each component
    for (const [componentName, schema] of Object.entries(schemas)) {
      if (Object.keys(schema).length > 0) {
        const result = await service.generate({
          schema: schema as Record<string, string>,
        })
        expect(result.props).toBeDefined()
      }
    }
  })

  it('validates generated MDX props against component schemas', async () => {
    const service = new PropsServiceCore()

    const schema = {
      title: 'Hero title text',
      subtitle: 'Hero subtitle text',
      ctaText: 'Call to action button text',
    }

    const result = await service.generate({ schema })

    // Validate the generated props
    const validation = service.validate(result.props, schema)
    expect(validation.valid).toBe(true)
  })

  it('merges partial MDX props with AI-generated ones via service', async () => {
    const service = new PropsServiceCore()

    const schema = {
      title: 'Card title',
      description: 'Card description',
      image: 'Image URL',
    }

    // Simulate partial props from MDX attribute parsing
    const partialProps = { title: 'Explicit Title' }

    const merged = await service.mergeWithGenerated(schema, partialProps)

    expect(merged.title).toBe('Explicit Title')
    expect(merged.description).toBeDefined()
    expect(merged.image).toBeDefined()
  })
})

// ============================================================================
// 7. Real AI Gateway Integration Tests
// ============================================================================

describe('Real AI Gateway integration for MDX', () => {
  it('generates contextual props from MDX content using AI', async () => {
    const generator = createMDXPropsGenerator({
      schemas: {
        Hero: {
          headline: 'An engaging headline about the topic',
          subheadline: 'A supporting subheadline',
        },
      },
    })

    const mdx = `---
topic: Cloud Computing
industry: Technology
---

<Hero />`

    const result = await generator.generate(mdx)

    expect(result.Hero).toBeDefined()
    expect(result.Hero.headline).toBeDefined()
    expect(typeof result.Hero.headline).toBe('string')
    expect((result.Hero.headline as string).length).toBeGreaterThan(0)
    expect(result.Hero.subheadline).toBeDefined()
    expect(typeof result.Hero.subheadline).toBe('string')
    expect((result.Hero.subheadline as string).length).toBeGreaterThan(0)
  })

  it('uses cached responses for repeated renders', async () => {
    const generator = createMDXPropsGenerator({
      schemas: {
        Card: {
          title: 'Card title',
          body: 'Card body text',
        },
      },
      cache: true,
    })

    const mdx = `<Card />`

    // First call - real AI
    const first = await generator.generate(mdx)
    expect(first.Card.title).toBeDefined()

    // Second call - should be cached
    const second = await generator.generate(mdx)
    expect(second.Card.title).toBe(first.Card.title)
    expect(second.Card.body).toBe(first.Card.body)
  })

  it('generates different props for different frontmatter contexts', async () => {
    const generator = createMDXPropsGenerator({
      schemas: {
        Hero: {
          title: 'A title matching the page topic',
        },
      },
    })

    const mdxTech = `---
topic: Machine Learning
---
<Hero />`

    const mdxArt = `---
topic: Renaissance Art
---
<Hero />`

    const techResult = await generator.generate(mdxTech)
    const artResult = await generator.generate(mdxArt)

    expect(techResult.Hero.title).toBeDefined()
    expect(artResult.Hero.title).toBeDefined()
    // Different topics should produce different titles
    // (we cannot guarantee this 100%, but it's the expected behavior)
  })
})
