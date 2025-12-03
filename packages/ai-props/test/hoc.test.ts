/**
 * Tests for ai-props HOC utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createPropsEnhancer,
  createAsyncPropsProvider,
  createPropsTransformer,
  createConditionalGenerator,
  createBatchGenerator,
} from '../src/hoc.js'
import { configureAIProps, resetConfig } from '../src/generate.js'
import { clearCache } from '../src/cache.js'

// Mock the ai-functions generateObject
vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockImplementation(async ({ schema }) => {
    // Generate mock data based on schema
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

describe('createPropsEnhancer', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('creates an enhancer function', () => {
    const enhancer = createPropsEnhancer({
      schema: { name: 'User name' },
    })

    expect(typeof enhancer).toBe('function')
  })

  it('generates missing props', async () => {
    const enhancer = createPropsEnhancer({
      schema: {
        name: 'User name',
        bio: 'User biography',
      },
    })

    const props = await enhancer({})

    expect(props.name).toBe('generated-name')
    expect(props.bio).toBe('generated-bio')
  })

  it('preserves provided props', async () => {
    const enhancer = createPropsEnhancer({
      schema: {
        name: 'User name',
        bio: 'User biography',
      },
    })

    const props = await enhancer({ name: 'John Doe' })

    expect(props.name).toBe('John Doe')
    expect(props.bio).toBe('generated-bio')
  })

  it('applies defaults', async () => {
    const enhancer = createPropsEnhancer({
      schema: {
        name: 'User name',
        role: 'User role',
      },
      defaults: {
        role: 'member',
      },
    })

    const props = await enhancer({})

    expect(props.role).toBe('member')
  })

  it('throws for missing required props', async () => {
    const enhancer = createPropsEnhancer({
      schema: {
        name: 'User name',
        email: 'Email address',
      },
      required: ['email'],
    })

    await expect(enhancer({ name: 'John' })).rejects.toThrow(
      'Missing required props'
    )
  })

  it('excludes specified props from generation', async () => {
    const enhancer = createPropsEnhancer({
      schema: {
        name: 'User name',
        internal: 'Internal data',
      },
      exclude: ['internal'],
    })

    const props = await enhancer({})

    expect(props.name).toBe('generated-name')
    expect(props.internal).toBeUndefined()
  })

  it('uses fallback on error', async () => {
    const enhancer = createPropsEnhancer({
      schema: {
        name: 'User name',
        email: 'Email',
      },
      required: ['email'],
      fallback: {
        name: 'Fallback Name',
        email: 'fallback@example.com',
      },
    })

    // Missing required prop should use fallback instead of throwing
    const props = await enhancer({ name: 'John' })

    expect(props.name).toBe('John')
    expect(props.email).toBe('fallback@example.com')
  })

  it('respects config model', async () => {
    const enhancer = createPropsEnhancer({
      schema: { name: 'User name' },
      config: { model: 'gpt-4' },
    })

    const props = await enhancer({})

    expect(props.name).toBe('generated-name')
  })
})

describe('createAsyncPropsProvider', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('creates provider with getProps method', () => {
    const provider = createAsyncPropsProvider({
      schema: { title: 'Page title' },
    })

    expect(provider.getProps).toBeDefined()
    expect(typeof provider.getProps).toBe('function')
  })

  it('creates provider with getManyProps method', () => {
    const provider = createAsyncPropsProvider({
      schema: { title: 'Page title' },
    })

    expect(provider.getManyProps).toBeDefined()
    expect(typeof provider.getManyProps).toBe('function')
  })

  it('creates provider with getCachedProps method', () => {
    const provider = createAsyncPropsProvider({
      schema: { title: 'Page title' },
    })

    expect(provider.getCachedProps).toBeDefined()
    expect(typeof provider.getCachedProps).toBe('function')
  })

  it('getProps generates props', async () => {
    const provider = createAsyncPropsProvider({
      schema: { title: 'Page title' },
    })

    const props = await provider.getProps({})

    expect(props.title).toBe('generated-title')
  })

  it('getManyProps generates multiple prop sets', async () => {
    const provider = createAsyncPropsProvider({
      schema: { title: 'Page title' },
    })

    const results = await provider.getManyProps([
      { slug: 'page-1' },
      { slug: 'page-2' },
    ])

    expect(results).toHaveLength(2)
    expect(results[0]?.title).toBe('generated-title')
    expect(results[1]?.title).toBe('generated-title')
  })

  it('getCachedProps returns props with revalidate', async () => {
    const provider = createAsyncPropsProvider({
      schema: { title: 'Page title' },
    })

    const result = await provider.getCachedProps({}, 60)

    expect(result.props.title).toBe('generated-title')
    expect(result.revalidate).toBe(60)
  })

  it('getCachedProps without revalidate', async () => {
    const provider = createAsyncPropsProvider({
      schema: { title: 'Page title' },
    })

    const result = await provider.getCachedProps({})

    expect(result.props.title).toBe('generated-title')
    expect(result.revalidate).toBeUndefined()
  })
})

describe('createPropsTransformer', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('creates transformer function', () => {
    const transformer = createPropsTransformer({
      schema: { displayName: 'Display name' },
    })

    expect(typeof transformer).toBe('function')
  })

  it('transforms input props', async () => {
    const transformer = createPropsTransformer({
      schema: { displayName: 'Display name' },
    })

    const result = await transformer({ username: 'johndoe' })

    expect(result.username).toBe('johndoe')
    expect(result.displayName).toBe('generated-displayName')
  })

  it('applies custom transform function', async () => {
    const transformer = createPropsTransformer({
      schema: { displayName: 'Display name' },
      transform: (input, generated) => ({
        fullName: `${generated.displayName} (${input.username})`,
      }),
    })

    const result = await transformer({ username: 'johndoe' })

    expect(result.username).toBe('johndoe')
    expect(result.fullName).toBe('generated-displayName (johndoe)')
  })
})

describe('createConditionalGenerator', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('generates when condition is true', async () => {
    const generator = createConditionalGenerator({
      schema: { summary: 'Article summary' },
      condition: (props) => !props.summary,
    })

    const result = await generator({ title: 'Test' })

    expect(result.summary).toBe('generated-summary')
  })

  it('returns props unchanged when condition is false', async () => {
    const generator = createConditionalGenerator({
      schema: { summary: 'Article summary' },
      condition: (props) => !props.summary,
    })

    const result = await generator({ title: 'Test', summary: 'Existing' })

    expect(result.summary).toBe('Existing')
    expect(result.title).toBe('Test')
  })

  it('uses complex condition', async () => {
    const generator = createConditionalGenerator<{ content?: string; summary?: string }>({
      schema: { summary: 'Article summary' },
      condition: (props) => !props.summary && (props.content?.length || 0) > 10,
    })

    // Short content - should not generate
    const shortResult = await generator({ content: 'Short' })
    expect(shortResult.summary).toBeUndefined()

    // Long content without summary - should generate
    const longResult = await generator({ content: 'This is a longer piece of content' })
    expect(longResult.summary).toBe('generated-summary')
  })
})

describe('createBatchGenerator', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('creates batch generator with generate method', () => {
    const batch = createBatchGenerator({
      schema: { title: 'Item title' },
    })

    expect(batch.generate).toBeDefined()
    expect(typeof batch.generate).toBe('function')
  })

  it('creates batch generator with generateSequential method', () => {
    const batch = createBatchGenerator({
      schema: { title: 'Item title' },
    })

    expect(batch.generateSequential).toBeDefined()
    expect(typeof batch.generateSequential).toBe('function')
  })

  it('generates props for multiple items', async () => {
    const batch = createBatchGenerator({
      schema: { title: 'Item title' },
    })

    const results = await batch.generate([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ])

    expect(results).toHaveLength(3)
    expect(results[0]?.title).toBe('generated-title')
    expect(results[0]?.id).toBe(1)
    expect(results[2]?.id).toBe(3)
  })

  it('generates sequentially', async () => {
    const batch = createBatchGenerator({
      schema: { title: 'Item title' },
    })

    const results = await batch.generateSequential([
      { id: 1 },
      { id: 2 },
    ])

    expect(results).toHaveLength(2)
    expect(results[0]?.title).toBe('generated-title')
  })

  it('respects concurrency setting', async () => {
    const batch = createBatchGenerator({
      schema: { title: 'Item title' },
      concurrency: 2, // Process 2 at a time
    })

    const items = Array.from({ length: 5 }, (_, i) => ({ id: i + 1 }))
    const results = await batch.generate(items)

    expect(results).toHaveLength(5)
  })

  it('preserves input props', async () => {
    const batch = createBatchGenerator({
      schema: { title: 'Item title' },
    })

    const results = await batch.generate([
      { id: 1, category: 'tech' },
      { id: 2, category: 'science' },
    ])

    expect(results[0]?.category).toBe('tech')
    expect(results[1]?.category).toBe('science')
  })
})
