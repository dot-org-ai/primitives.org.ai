/**
 * Tests for MDX parsing and rendering with AI-generated props
 *
 * RED phase: These tests define the expected behavior for MDX integration.
 * They will fail because the MDX parsing module does not exist yet.
 *
 * The MDX integration should:
 * 1. Parse MDX content strings (with frontmatter)
 * 2. Extract component prop schemas from MDX
 * 3. Generate AI props for components found in MDX
 * 4. Render MDX with injected props
 * 5. Handle errors gracefully
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the ai-functions generateObject (same pattern as other test files)
vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockImplementation(async ({ schema }) => {
    const mockData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(schema)) {
      if (typeof value === 'string') {
        if (value.includes('(number)')) {
          mockData[key] = 42
        } else if (value.includes('(boolean)')) {
          mockData[key] = true
        } else {
          mockData[key] = `generated-${key}`
        }
      } else if (Array.isArray(value)) {
        mockData[key] = ['item1', 'item2']
      } else if (typeof value === 'object') {
        mockData[key] = { nested: 'value' }
      }
    }
    return { object: mockData }
  }),
  schema: vi.fn((s) => s),
}))

// These imports will fail since the mdx module does not exist yet
import {
  parseMDX,
  extractComponentSchemas,
  renderMDXWithProps,
  createMDXPropsGenerator,
  compileMDX,
} from '../src/mdx.js'
import { resetConfig, clearCache } from '../src/index.js'

describe('MDX parsing', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

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
  })
})

describe('MDX props generation', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

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

    it('generates props for components in MDX', async () => {
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
      expect(result.Hero.subtitle).toBeDefined()
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
      // The generator should have used frontmatter as context
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

    it('generates props for multiple component instances', async () => {
      const generator = createMDXPropsGenerator({
        schemas: {
          Card: {
            title: 'Card title',
            description: 'Card description',
          },
        },
      })

      const mdx = `<Card />
<Card />
<Card />`

      const result = await generator.generate(mdx)

      // Should generate props for each instance
      expect(result.Card).toBeDefined()
      expect(Array.isArray(result.Card) || typeof result.Card === 'object').toBe(true)
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
            data: 'Complex data structure',
            status: 'Widget status',
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
        model: 'gpt-4',
      })

      const mdx = `<Hero />`

      const result = await generator.generate(mdx)

      expect(result.Hero).toBeDefined()
    })
  })
})

describe('MDX rendering with props', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

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

    it('renders MDX with frontmatter variables', async () => {
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

    it('handles streaming render', async () => {
      const mdx = `# Hello

<Hero title="Welcome" />

Some content after.`

      const stream = await renderMDXWithProps(
        mdx,
        {
          Hero: { title: 'Welcome' },
        },
        { stream: true }
      )

      expect(stream).toBeDefined()
      // Stream should be iterable or a ReadableStream
      if (stream instanceof ReadableStream) {
        const reader = stream.getReader()
        const { value } = await reader.read()
        expect(value).toBeDefined()
        reader.releaseLock()
      }
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

    it('handles MDX with imports', async () => {
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

describe('MDX error handling', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

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

  it('handles missing component schemas gracefully in generator', async () => {
    const generator = createMDXPropsGenerator({
      schemas: {},
    })

    const mdx = `<UnknownComponent />`

    // Should not throw, but should return empty or skip unknown components
    const result = await generator.generate(mdx)

    expect(result).toBeDefined()
    expect(result.UnknownComponent).toBeUndefined()
  })

  it('handles render errors for invalid props', async () => {
    const mdx = `<StrictComponent />`

    // Rendering with invalid/missing required props
    await expect(
      renderMDXWithProps(mdx, {
        StrictComponent: null as unknown as Record<string, unknown>,
      })
    ).rejects.toThrow()
  })
})

describe('MDX with AI props end-to-end', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

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

    // Step 3: Generate props
    const generatedProps = await generator.generate(mdx)

    expect(generatedProps.Hero).toBeDefined()
    expect(generatedProps.Card).toBeDefined()
    expect(generatedProps.Footer).toBeDefined()

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
    expect(props.DynamicRecommendation.reason).toBeDefined()
    // Static components should not be in generated props
    expect(props.StaticBanner).toBeUndefined()
    expect(props.StaticFooter).toBeUndefined()
  })
})
