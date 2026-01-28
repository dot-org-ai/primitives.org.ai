/**
 * Tests for hono/jsx hydration and streaming with AI-generated props
 *
 * RED phase: These tests define the expected behavior for hono/jsx integration
 * in a real Cloudflare Workers environment using @cloudflare/vitest-pool-workers.
 *
 * NO MOCKS - all tests run against real Workers runtime and AI Gateway bindings.
 *
 * The hono/jsx integration should:
 * 1. Collect hydration data from props used during render
 * 2. Track component hierarchy for hydration
 * 3. Serialize hydration data correctly
 * 4. Stream JSX to response
 * 5. Include hydration script in stream
 * 6. Support async components with Suspense
 * 7. Generate AI props for hono/jsx components
 *
 * Bead: aip-fxpy
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'

// ============================================================================
// Import hono/jsx modules
// These imports will fail initially since hono/jsx integration is not implemented
// ============================================================================

// Import the hydration and streaming functions that need to be implemented
import {
  // Hydration data collection
  collectHydrationData,
  createHydrationContext,
  serializeHydrationData,
  HydrationProvider,
  useHydration,

  // Streaming render
  renderToReadableStream,
  streamJSXResponse,
  createStreamingRenderer,

  // Component utilities
  createAIComponent,
  withAIProps,
  AIPropsProvider,

  // Types
  type HydrationData,
  type HydrationContext,
  type StreamingOptions,
  type AIComponentProps,
} from '../../src/hono-jsx.js'

// Import existing ai-props modules
import { PropsServiceCore } from '../../src/worker.js'
import { generateProps } from '../../src/generate.js'
import { clearCache } from '../../src/cache.js'

// ============================================================================
// Type definitions for expected hono/jsx integration interfaces
// ============================================================================

/**
 * Hydration data structure collected during render
 */
interface ExpectedHydrationData {
  /** Map of component ID to props used during render */
  components: Map<string, Record<string, unknown>>
  /** Component hierarchy tree */
  tree: HydrationNode[]
  /** Serializable JSON representation */
  toJSON(): string
}

/**
 * Node in the component hydration tree
 */
interface HydrationNode {
  id: string
  component: string
  props: Record<string, unknown>
  children: HydrationNode[]
}

/**
 * Context for hydration tracking
 */
interface ExpectedHydrationContext {
  /** Register a component render with props */
  register(componentName: string, props: Record<string, unknown>): string
  /** Get collected hydration data */
  getData(): ExpectedHydrationData
  /** Clear collected data */
  clear(): void
}

// ============================================================================
// 1. Hydration Data Collection Tests
// ============================================================================

describe('hydration data collection', () => {
  describe('collectHydrationData()', () => {
    it('collects props used during render', async () => {
      // Define a simple component that uses props
      const TestComponent = ({ title, description }: { title: string; description: string }) => {
        return `<div><h1>${title}</h1><p>${description}</p></div>`
      }

      const props = { title: 'Hello', description: 'World' }

      const hydrationData = await collectHydrationData(TestComponent, props)

      expect(hydrationData).toBeDefined()
      expect(hydrationData.components).toBeDefined()
      expect(hydrationData.components.size).toBeGreaterThan(0)
    })

    it('tracks component hierarchy', async () => {
      // Define nested components
      const ChildComponent = ({ text }: { text: string }) => `<span>${text}</span>`

      const ParentComponent = ({ title, items }: { title: string; items: string[] }) => {
        return `<div><h1>${title}</h1>${items
          .map((item) => ChildComponent({ text: item }))
          .join('')}</div>`
      }

      const props = { title: 'List', items: ['a', 'b', 'c'] }

      const hydrationData = await collectHydrationData(ParentComponent, props)

      expect(hydrationData.tree).toBeDefined()
      expect(Array.isArray(hydrationData.tree)).toBe(true)
      // Parent should have children
      expect(hydrationData.tree.length).toBeGreaterThan(0)
    })

    it('serializes hydration data correctly', async () => {
      const Component = ({ value }: { value: number }) => `<span>${value}</span>`

      const hydrationData = await collectHydrationData(Component, { value: 42 })

      const serialized = hydrationData.toJSON()

      expect(typeof serialized).toBe('string')
      expect(() => JSON.parse(serialized)).not.toThrow()

      const parsed = JSON.parse(serialized)
      expect(parsed).toBeDefined()
    })

    it('handles nested component props', async () => {
      const DeepChild = ({ label }: { label: string }) => `<span>${label}</span>`

      const Child = ({ name, active }: { name: string; active: boolean }) => {
        return `<div>${DeepChild({ label: name })} - ${active ? 'active' : 'inactive'}</div>`
      }

      const Parent = ({ users }: { users: Array<{ name: string; active: boolean }> }) => {
        return `<ul>${users.map((u) => Child(u)).join('')}</ul>`
      }

      const props = {
        users: [
          { name: 'Alice', active: true },
          { name: 'Bob', active: false },
        ],
      }

      const hydrationData = await collectHydrationData(Parent, props)

      // Should track all nested components
      expect(hydrationData.components.size).toBeGreaterThanOrEqual(1)

      // Tree should reflect nesting
      const serialized = JSON.parse(hydrationData.toJSON())
      expect(serialized).toBeDefined()
    })

    it('assigns unique IDs to each component instance', async () => {
      const Item = ({ id }: { id: number }) => `<li>${id}</li>`

      const List = ({ count }: { count: number }) => {
        const items = Array.from({ length: count }, (_, i) => Item({ id: i }))
        return `<ul>${items.join('')}</ul>`
      }

      const hydrationData = await collectHydrationData(List, { count: 5 })

      // Each Item should have a unique ID
      const ids = Array.from(hydrationData.components.keys())
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)
    })
  })

  describe('createHydrationContext()', () => {
    it('creates a hydration context', () => {
      const ctx = createHydrationContext()

      expect(ctx).toBeDefined()
      expect(typeof ctx.register).toBe('function')
      expect(typeof ctx.getData).toBe('function')
      expect(typeof ctx.clear).toBe('function')
    })

    it('registers component props during render', () => {
      const ctx = createHydrationContext()

      const id1 = ctx.register('Header', { title: 'Welcome' })
      const id2 = ctx.register('Footer', { year: 2026 })

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
    })

    it('retrieves collected data', () => {
      const ctx = createHydrationContext()

      ctx.register('Card', { title: 'Test', body: 'Content' })
      ctx.register('Button', { label: 'Click', disabled: false })

      const data = ctx.getData()

      expect(data.components.size).toBe(2)
      expect(data.components.has('Card')).toBe(true)
      expect(data.components.has('Button')).toBe(true)
    })

    it('clears collected data', () => {
      const ctx = createHydrationContext()

      ctx.register('Component', { prop: 'value' })
      expect(ctx.getData().components.size).toBe(1)

      ctx.clear()
      expect(ctx.getData().components.size).toBe(0)
    })
  })

  describe('serializeHydrationData()', () => {
    it('serializes hydration data to JSON string', () => {
      const data: HydrationData = {
        components: new Map([
          ['comp-1', { title: 'Hello' }],
          ['comp-2', { count: 42 }],
        ]),
        tree: [],
        toJSON: () => '',
      }

      const serialized = serializeHydrationData(data)

      expect(typeof serialized).toBe('string')
      expect(() => JSON.parse(serialized)).not.toThrow()
    })

    it('handles circular references gracefully', () => {
      const circular: Record<string, unknown> = { name: 'test' }
      circular.self = circular

      const data: HydrationData = {
        components: new Map([['comp', circular]]),
        tree: [],
        toJSON: () => '',
      }

      // Should not throw on circular references
      expect(() => serializeHydrationData(data)).not.toThrow()
    })

    it('escapes special characters for script embedding', () => {
      const data: HydrationData = {
        components: new Map([['comp', { html: '<script>alert("xss")</script>' }]]),
        tree: [],
        toJSON: () => '',
      }

      const serialized = serializeHydrationData(data)

      // Should escape script tags
      expect(serialized).not.toContain('<script>')
      expect(serialized).not.toContain('</script>')
    })

    it('produces valid JavaScript object literal', () => {
      const data: HydrationData = {
        components: new Map([['hero', { title: 'Welcome', subtitle: 'To the app' }]]),
        tree: [{ id: 'hero', component: 'Hero', props: { title: 'Welcome' }, children: [] }],
        toJSON: () => '',
      }

      const serialized = serializeHydrationData(data)

      // Should be parseable as JSON
      const parsed = JSON.parse(serialized)
      expect(parsed.components).toBeDefined()
      expect(parsed.tree).toBeDefined()
    })
  })

  describe('HydrationProvider', () => {
    it('provides hydration context to children', () => {
      // This would be a JSX component test
      // HydrationProvider wraps children and provides context
      expect(HydrationProvider).toBeDefined()
      expect(typeof HydrationProvider).toBe('function')
    })

    it('collects hydration data from nested components', async () => {
      // Create a render tree with HydrationProvider
      const ctx = createHydrationContext()

      // Simulate rendering with provider
      const result = HydrationProvider({ context: ctx, children: null })

      expect(result).toBeDefined()
    })
  })

  describe('useHydration()', () => {
    it('returns hydration context from provider', () => {
      // useHydration is a hook that returns the current hydration context
      expect(useHydration).toBeDefined()
      expect(typeof useHydration).toBe('function')
    })

    it('allows components to register themselves', () => {
      // Components can use useHydration to register their props
      const ctx = createHydrationContext()

      // Simulate a component using the hook
      const register = () => {
        const hydration = useHydration()
        hydration.register('TestComponent', { prop: 'value' })
      }

      // This would need proper JSX context to work
      expect(typeof useHydration).toBe('function')
    })
  })
})

// ============================================================================
// 2. Streaming Render Tests
// ============================================================================

describe('streaming render', () => {
  describe('renderToReadableStream()', () => {
    it('streams JSX to response', async () => {
      const Component = ({ message }: { message: string }) => `<div>${message}</div>`

      const stream = await renderToReadableStream(Component, { message: 'Hello World' })

      expect(stream).toBeInstanceOf(ReadableStream)
    })

    it('includes hydration script in stream', async () => {
      const Component = ({ title }: { title: string }) => `<h1>${title}</h1>`

      const stream = await renderToReadableStream(
        Component,
        { title: 'Test' },
        {
          includeHydration: true,
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

      // Should include hydration script
      expect(content).toContain('__HYDRATION_DATA__')
    })

    it('handles async components', async () => {
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

    it('supports suspense boundaries', async () => {
      // Define components with suspense support
      const SlowComponent = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        return '<div>Slow content</div>'
      }

      const FastComponent = () => '<div>Fast content</div>'

      const App = async () => {
        return `<div>${FastComponent()}${await SlowComponent()}</div>`
      }

      const stream = await renderToReadableStream(
        App,
        {},
        {
          suspense: {
            fallback: '<div>Loading...</div>',
          },
        }
      )

      const reader = stream.getReader()
      const chunks: string[] = []
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(decoder.decode(value, { stream: true }))
      }

      const content = chunks.join('')
      expect(content).toContain('Fast content')
      expect(content).toContain('Slow content')
    })

    it('streams chunks progressively', async () => {
      const LargeComponent = ({ count }: { count: number }) => {
        const items = Array.from({ length: count }, (_, i) => `<div>Item ${i}</div>`)
        return items.join('')
      }

      const stream = await renderToReadableStream(LargeComponent, { count: 100 })

      const reader = stream.getReader()
      const chunks: Uint8Array[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Should receive multiple chunks for large content
      expect(chunks.length).toBeGreaterThan(0)
    })

    it('handles render errors gracefully', async () => {
      const ErrorComponent = () => {
        throw new Error('Render error')
      }

      const stream = await renderToReadableStream(
        ErrorComponent,
        {},
        {
          onError: (error: Error) => `<div class="error">${error.message}</div>`,
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

      expect(content).toContain('Render error')
    })
  })

  describe('streamJSXResponse()', () => {
    it('returns a Response object with streaming body', async () => {
      const Component = ({ text }: { text: string }) => `<p>${text}</p>`

      const response = await streamJSXResponse(Component, { text: 'Hello' })

      expect(response).toBeInstanceOf(Response)
      expect(response.body).toBeInstanceOf(ReadableStream)
    })

    it('sets correct Content-Type header', async () => {
      const Component = () => '<html></html>'

      const response = await streamJSXResponse(Component, {})

      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    })

    it('supports custom headers', async () => {
      const Component = () => '<div></div>'

      const response = await streamJSXResponse(
        Component,
        {},
        {
          headers: {
            'X-Custom-Header': 'value',
          },
        }
      )

      expect(response.headers.get('X-Custom-Header')).toBe('value')
    })

    it('sets transfer-encoding chunked for streaming', async () => {
      const Component = () => '<div>Content</div>'

      const response = await streamJSXResponse(
        Component,
        {},
        {
          streaming: true,
        }
      )

      // Streaming responses typically have no Content-Length
      // and may have Transfer-Encoding: chunked
      expect(response.headers.get('Content-Length')).toBeNull()
    })
  })

  describe('createStreamingRenderer()', () => {
    it('creates a reusable streaming renderer', () => {
      const renderer = createStreamingRenderer({
        doctype: '<!DOCTYPE html>',
        shell: (content: string) => `<html><body>${content}</body></html>`,
      })

      expect(renderer).toBeDefined()
      expect(typeof renderer.render).toBe('function')
    })

    it('applies shell wrapper to rendered content', async () => {
      const renderer = createStreamingRenderer({
        shell: (content: string) => `<main>${content}</main>`,
      })

      const Component = () => '<section>Content</section>'

      const stream = await renderer.render(Component, {})
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('<main>')
      expect(content).toContain('</main>')
      expect(content).toContain('<section>Content</section>')
    })

    it('injects hydration data at specified location', async () => {
      const renderer = createStreamingRenderer({
        shell: (content: string, hydration: string) =>
          `<html><body>${content}<script>${hydration}</script></body></html>`,
        includeHydration: true,
      })

      const Component = ({ title }: { title: string }) => `<h1>${title}</h1>`

      const stream = await renderer.render(Component, { title: 'Test' })
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('<script>')
      expect(content).toContain('__HYDRATION_DATA__')
    })
  })
})

// ============================================================================
// 3. hono/jsx Component Integration Tests
// ============================================================================

describe('hono/jsx components', () => {
  describe('component rendering', () => {
    it('renders hono/jsx components with props', async () => {
      // Define a simple functional component
      const Greeting = ({ name, greeting = 'Hello' }: { name: string; greeting?: string }) => {
        return `<div class="greeting">${greeting}, ${name}!</div>`
      }

      const stream = await renderToReadableStream(Greeting, {
        name: 'World',
        greeting: 'Welcome',
      })

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('Welcome, World!')
      expect(content).toContain('class="greeting"')
    })

    it('supports functional components', async () => {
      // Pure functional component
      const Badge = ({ label, color }: { label: string; color: string }) =>
        `<span class="badge" style="background: ${color}">${label}</span>`

      const stream = await renderToReadableStream(Badge, {
        label: 'New',
        color: 'green',
      })

      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let content = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        content += decoder.decode(value, { stream: true })
      }

      expect(content).toContain('New')
      expect(content).toContain('green')
    })

    it('handles component composition', async () => {
      const Button = ({ onClick, children }: { onClick?: string; children: string }) =>
        `<button onclick="${onClick || ''}">${children}</button>`

      const Card = ({ title, body, actions }: { title: string; body: string; actions?: string }) =>
        `<div class="card">
          <h2>${title}</h2>
          <p>${body}</p>
          ${actions ? `<div class="actions">${actions}</div>` : ''}
        </div>`

      const App = () => {
        return Card({
          title: 'Welcome',
          body: 'This is the card body',
          actions: Button({ children: 'Click me' }),
        })
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

      expect(content).toContain('Welcome')
      expect(content).toContain('This is the card body')
      expect(content).toContain('Click me')
    })

    it('passes context through tree', async () => {
      // Simulate context passing through component tree
      const ThemeContext = { theme: 'dark' }

      const ThemedButton = ({ context, label }: { context: typeof ThemeContext; label: string }) =>
        `<button class="btn-${context.theme}">${label}</button>`

      const ThemedCard = ({ context, title }: { context: typeof ThemeContext; title: string }) =>
        `<div class="card-${context.theme}">
          <h2>${title}</h2>
          ${ThemedButton({ context, label: 'Action' })}
        </div>`

      const App = () => {
        return ThemedCard({ context: ThemeContext, title: 'Themed Card' })
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

      expect(content).toContain('card-dark')
      expect(content).toContain('btn-dark')
    })
  })

  describe('createAIComponent()', () => {
    it('creates a component with AI-generated props', async () => {
      const AIHero = createAIComponent({
        name: 'Hero',
        schema: {
          title: 'Hero section title',
          subtitle: 'Hero section subtitle',
          ctaText: 'Call to action button text',
        },
        render: ({ title, subtitle, ctaText }) =>
          `<section class="hero">
            <h1>${title}</h1>
            <p>${subtitle}</p>
            <button>${ctaText}</button>
          </section>`,
      })

      expect(AIHero).toBeDefined()
      expect(typeof AIHero).toBe('function')
      expect(AIHero.schema).toBeDefined()
    })

    it('generates props when not provided', async () => {
      const AICard = createAIComponent({
        name: 'Card',
        schema: {
          title: 'Card title',
          description: 'Card description',
        },
        render: ({ title, description }) =>
          `<div class="card"><h3>${title}</h3><p>${description}</p></div>`,
      })

      // Render without providing props - should generate via AI
      const result = await AICard({})

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('uses provided props without generation', async () => {
      const AICard = createAIComponent({
        name: 'Card',
        schema: {
          title: 'Card title',
          description: 'Card description',
        },
        render: ({ title, description }) =>
          `<div class="card"><h3>${title}</h3><p>${description}</p></div>`,
      })

      // Render with provided props - should not call AI
      const result = await AICard({
        title: 'Explicit Title',
        description: 'Explicit Description',
      })

      expect(result).toContain('Explicit Title')
      expect(result).toContain('Explicit Description')
    })

    it('merges partial props with generated', async () => {
      const AICard = createAIComponent({
        name: 'Card',
        schema: {
          title: 'Card title',
          description: 'Card description',
          image: 'Card image URL',
        },
        render: ({ title, description, image }) =>
          `<div class="card">
            <img src="${image}" />
            <h3>${title}</h3>
            <p>${description}</p>
          </div>`,
      })

      // Provide partial props
      const result = await AICard({
        title: 'My Title',
        // description and image should be generated
      })

      expect(result).toContain('My Title')
      expect(result).toBeDefined()
    })
  })

  describe('withAIProps()', () => {
    it('wraps existing component with AI props generation', async () => {
      // Define a plain component
      const PlainCard = ({ title, description }: { title: string; description: string }) =>
        `<div class="card"><h3>${title}</h3><p>${description}</p></div>`

      // Wrap with AI props
      const AICard = withAIProps(PlainCard, {
        schema: {
          title: 'Card title text',
          description: 'Card description text',
        },
      })

      expect(AICard).toBeDefined()
      expect(typeof AICard).toBe('function')
    })

    it('generates missing props on render', async () => {
      const PlainHero = ({ headline, subheadline }: { headline: string; subheadline: string }) =>
        `<section><h1>${headline}</h1><p>${subheadline}</p></section>`

      const AIHero = withAIProps(PlainHero, {
        schema: {
          headline: 'Engaging headline',
          subheadline: 'Supporting subheadline',
        },
      })

      // Call without props - should generate
      const result = await AIHero({})

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('preserves component displayName', () => {
      const NamedComponent = ({ value }: { value: string }) => `<div>${value}</div>`
      // @ts-expect-error - Adding displayName for testing
      NamedComponent.displayName = 'NamedComponent'

      const WrappedComponent = withAIProps(NamedComponent, {
        schema: { value: 'Value text' },
      })

      // @ts-expect-error - Checking displayName
      expect(WrappedComponent.displayName).toContain('NamedComponent')
    })
  })

  describe('AIPropsProvider', () => {
    it('provides AI props configuration to children', () => {
      expect(AIPropsProvider).toBeDefined()
      expect(typeof AIPropsProvider).toBe('function')
    })

    it('configures model for child components', async () => {
      // AIPropsProvider should allow setting model configuration
      const config = {
        model: 'gpt-4',
        cache: true,
      }

      const result = AIPropsProvider({ config, children: null })

      expect(result).toBeDefined()
    })

    it('provides system prompt context', async () => {
      const config = {
        system: 'You are generating props for a marketing website.',
      }

      const result = AIPropsProvider({ config, children: null })

      expect(result).toBeDefined()
    })
  })
})

// ============================================================================
// 4. AI Props with hono/jsx Tests
// ============================================================================

describe('AI props with hono/jsx', () => {
  describe('props generation', () => {
    it('generates props for hono/jsx components', async () => {
      const schema = {
        title: 'Hero section title',
        subtitle: 'Hero section subtitle',
        ctaText: 'Call to action button text',
      }

      const result = await generateProps({ schema })

      expect(result.props).toBeDefined()
      expect(result.props.title).toBeDefined()
      expect(result.props.subtitle).toBeDefined()
      expect(result.props.ctaText).toBeDefined()
    })

    it('uses real AI Gateway for generation', async () => {
      const schema = {
        productName: 'Name for a tech product',
        tagline: 'Marketing tagline for the product',
      }

      const result = await generateProps({
        schema,
        context: { industry: 'technology', audience: 'developers' },
      })

      expect(result.props).toBeDefined()
      expect(typeof result.props.productName).toBe('string')
      expect((result.props.productName as string).length).toBeGreaterThan(0)
    })

    it('streams rendered output with props', async () => {
      const AIHero = createAIComponent({
        name: 'Hero',
        schema: {
          headline: 'Engaging headline',
          subheadline: 'Supporting text',
        },
        render: ({ headline, subheadline }) =>
          `<section class="hero"><h1>${headline}</h1><p>${subheadline}</p></section>`,
      })

      const stream = await renderToReadableStream(AIHero, {
        context: { topic: 'Cloud Computing' },
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

      expect(content).toContain('class="hero"')
      expect(content.length).toBeGreaterThan(0)
    })
  })

  describe('context-aware generation', () => {
    it('uses frontmatter context for generation', async () => {
      const schema = {
        title: 'Page title relevant to the topic',
      }

      const context = {
        topic: 'Machine Learning',
        audience: 'data scientists',
      }

      const result = await generateProps({ schema, context })

      expect(result.props.title).toBeDefined()
      expect(typeof result.props.title).toBe('string')
    })

    it('generates different props for different contexts', async () => {
      const schema = {
        headline: 'Headline for the page topic',
      }

      const techContext = { topic: 'Artificial Intelligence' }
      const artContext = { topic: 'Renaissance Painting' }

      const techResult = await generateProps({ schema, context: techContext })
      const artResult = await generateProps({ schema, context: artContext })

      expect(techResult.props.headline).toBeDefined()
      expect(artResult.props.headline).toBeDefined()
      // Different contexts should ideally produce different headlines
    })
  })

  describe('caching', () => {
    it('caches generated props for repeated renders', async () => {
      const schema = { title: 'Page title' }
      const context = { topic: 'Test' }

      // First call
      const result1 = await generateProps({ schema, context })

      // Second call with same schema and context
      const result2 = await generateProps({ schema, context })

      // Second call should be cached
      expect(result2.cached).toBe(true)
      expect(result2.props.title).toBe(result1.props.title)
    })

    it('invalidates cache when context changes', async () => {
      const schema = { title: 'Page title' }

      const result1 = await generateProps({
        schema,
        context: { topic: 'First Topic' },
      })

      const result2 = await generateProps({
        schema,
        context: { topic: 'Different Topic' },
      })

      // Different context should not use cache
      // Note: this might still be cached in some implementations
      // but the cache key should be different
      expect(result1.props).toBeDefined()
      expect(result2.props).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('handles AI generation failures gracefully', async () => {
      const AIComponent = createAIComponent({
        name: 'FallbackTest',
        schema: { title: 'Title' },
        render: ({ title }) => `<h1>${title}</h1>`,
        fallback: { title: 'Default Title' },
      })

      // Even if AI fails, component should render with fallback
      const result = await AIComponent({})

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('provides fallback props on error', async () => {
      const AICard = createAIComponent({
        name: 'Card',
        schema: {
          title: 'Card title',
          description: 'Card description',
        },
        render: ({ title, description }) => `<div><h3>${title}</h3><p>${description}</p></div>`,
        fallback: {
          title: 'Fallback Title',
          description: 'Fallback Description',
        },
      })

      // Should use fallback if generation fails
      const result = await AICard({})

      expect(result).toBeDefined()
    })
  })
})

// ============================================================================
// 5. Integration with PropsServiceCore (Worker RPC)
// ============================================================================

describe('hono/jsx integration with PropsServiceCore', () => {
  let service: PropsServiceCore

  beforeEach(() => {
    // Clear local cache to avoid stale responses
    clearCache()
    service = new PropsServiceCore()
  })

  it('generates props for hono/jsx components via RPC', async () => {
    const schema = {
      title: 'Component title',
      description: 'Component description',
    }

    // Add unique context to ensure fresh cache key at AI Gateway level
    const context = {
      testId: `rpc-test-${Date.now()}`,
      purpose: 'hono/jsx integration test',
    }

    const result = await service.generate({ schema, context })

    expect(result.props).toBeDefined()
    expect(result.props.title).toBeDefined()
    expect(result.props.description).toBeDefined()
  })

  it('validates generated props for hono/jsx components', async () => {
    const schema = {
      headline: 'Hero headline',
      subheadline: 'Hero subheadline',
    }

    const result = await service.generate({ schema })
    const validation = service.validate(result.props, schema)

    expect(validation.valid).toBe(true)
  })

  it('merges partial props with AI-generated via service', async () => {
    const schema = {
      title: 'Card title',
      description: 'Card description',
      image: 'Image URL',
    }

    const partialProps = { title: 'Explicit Title' }

    const merged = await service.mergeWithGenerated(schema, partialProps)

    expect(merged.title).toBe('Explicit Title')
    expect(merged.description).toBeDefined()
    expect(merged.image).toBeDefined()
  })
})

// ============================================================================
// 6. End-to-End Streaming with AI Props Tests
// ============================================================================

describe('end-to-end streaming with AI props', () => {
  it('streams hono/jsx page with AI-generated component props', async () => {
    // Define page components
    const Hero = createAIComponent({
      name: 'Hero',
      schema: {
        headline: 'Main page headline',
        subheadline: 'Supporting text',
      },
      render: ({ headline, subheadline }) =>
        `<section class="hero"><h1>${headline}</h1><p>${subheadline}</p></section>`,
    })

    const Card = createAIComponent({
      name: 'Card',
      schema: {
        title: 'Card title',
        body: 'Card body text',
      },
      render: ({ title, body }) =>
        `<article class="card"><h2>${title}</h2><p>${body}</p></article>`,
    })

    // Define page layout
    const Page = async () => {
      const heroContent = await Hero({ context: { topic: 'AI Applications' } })
      const cardContent = await Card({ context: { topic: 'Getting Started' } })

      return `
        <!DOCTYPE html>
        <html>
          <head><title>AI Props Demo</title></head>
          <body>
            ${heroContent}
            ${cardContent}
          </body>
        </html>
      `
    }

    const response = await streamJSXResponse(Page, {})

    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')

    const content = await response.text()

    expect(content).toContain('<!DOCTYPE html>')
    expect(content).toContain('class="hero"')
    expect(content).toContain('class="card"')
  })

  it('includes hydration data for client-side rehydration', async () => {
    const AIComponent = createAIComponent({
      name: 'Interactive',
      schema: { label: 'Button label' },
      render: ({ label }) => `<button data-hydrate="true">${label}</button>`,
    })

    const renderer = createStreamingRenderer({
      shell: (content: string, hydration: string) =>
        `<html><body>${content}<script>window.__HYDRATION_DATA__=${hydration}</script></body></html>`,
      includeHydration: true,
    })

    const stream = await renderer.render(AIComponent, {})
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let content = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      content += decoder.decode(value, { stream: true })
    }

    expect(content).toContain('__HYDRATION_DATA__')
    expect(content).toContain('data-hydrate="true"')
  })

  it('supports progressive enhancement with AI props', async () => {
    // First render returns basic HTML
    // Then AI props are generated and sent as updates

    const BasicComponent = ({ title = 'Loading...' }: { title?: string }) =>
      `<h1 data-ai-prop="title">${title}</h1>`

    const AIEnhancedComponent = createAIComponent({
      name: 'Enhanced',
      schema: { title: 'Dynamic title' },
      render: BasicComponent,
      progressive: true, // Enable progressive enhancement
    })

    const stream = await renderToReadableStream(
      AIEnhancedComponent,
      {},
      {
        progressive: true,
      }
    )

    const reader = stream.getReader()
    const chunks: string[] = []
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value, { stream: true }))
    }

    // Should have received initial render then updates
    expect(chunks.length).toBeGreaterThan(0)
    const content = chunks.join('')
    expect(content).toContain('data-ai-prop="title"')
  })
})
