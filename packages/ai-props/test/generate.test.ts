/**
 * Tests for ai-props generation utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateProps,
  getPropsSync,
  prefetchProps,
  generatePropsMany,
  mergeWithGenerated,
  configureAIProps,
  getConfig,
  resetConfig,
} from '../src/generate.js'
import { clearCache, getDefaultCache } from '../src/cache.js'

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

describe('configureAIProps', () => {
  beforeEach(() => {
    resetConfig()
  })

  it('sets model configuration', () => {
    configureAIProps({ model: 'gpt-4' })
    expect(getConfig().model).toBe('gpt-4')
  })

  it('sets cache configuration', () => {
    configureAIProps({ cache: false })
    expect(getConfig().cache).toBe(false)
  })

  it('sets cacheTTL configuration', () => {
    configureAIProps({ cacheTTL: 10000 })
    expect(getConfig().cacheTTL).toBe(10000)
  })

  it('sets system prompt configuration', () => {
    configureAIProps({ system: 'Custom system prompt' })
    expect(getConfig().system).toBe('Custom system prompt')
  })

  it('merges with existing config', () => {
    configureAIProps({ model: 'gpt-4' })
    configureAIProps({ cache: false })

    const config = getConfig()
    expect(config.model).toBe('gpt-4')
    expect(config.cache).toBe(false)
  })
})

describe('getConfig', () => {
  beforeEach(() => {
    resetConfig()
  })

  it('returns default config', () => {
    const config = getConfig()

    expect(config.model).toBe('sonnet')
    expect(config.cache).toBe(true)
    expect(config.cacheTTL).toBe(5 * 60 * 1000)
  })

  it('returns a copy of config', () => {
    const config1 = getConfig()
    const config2 = getConfig()

    expect(config1).not.toBe(config2)
    expect(config1).toEqual(config2)
  })
})

describe('resetConfig', () => {
  it('resets to default values', () => {
    configureAIProps({ model: 'gpt-4', cache: false })
    resetConfig()

    const config = getConfig()
    expect(config.model).toBe('sonnet')
    expect(config.cache).toBe(true)
  })
})

describe('generateProps', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('generates props from schema', async () => {
    const result = await generateProps({
      schema: {
        title: 'Page title',
        description: 'Page description',
      },
    })

    expect(result.props).toBeDefined()
    expect(result.props.title).toBe('generated-title')
    expect(result.props.description).toBe('generated-description')
  })

  it('returns cached flag', async () => {
    const result = await generateProps({
      schema: { name: 'User name' },
    })

    expect(result.cached).toBe(false)
  })

  it('returns metadata', async () => {
    const result = await generateProps({
      schema: { name: 'User name' },
    })

    expect(result.metadata).toBeDefined()
    expect(result.metadata.model).toBe('sonnet')
  })

  it('uses custom model', async () => {
    const result = await generateProps({
      schema: { name: 'User name' },
      model: 'gpt-4',
    })

    expect(result.metadata.model).toBe('gpt-4')
  })

  it('caches results', async () => {
    const schema = { name: 'User name' }

    // First call
    await generateProps({ schema })

    // Second call should be cached
    const result = await generateProps({ schema })

    expect(result.cached).toBe(true)
  })

  it('respects cache disabled', async () => {
    configureAIProps({ cache: false })

    const schema = { name: 'User name' }

    // First call
    await generateProps({ schema })

    // Second call should not be cached
    const result = await generateProps({ schema })

    expect(result.cached).toBe(false)
  })

  it('handles string schema', async () => {
    const result = await generateProps({
      schema: 'A user name',
    })

    expect(result.props).toBeDefined()
    expect(result.props.value).toBe('generated-value')
  })

  it('uses custom generator', async () => {
    configureAIProps({
      generate: async <T>() => ({ custom: 'value' } as T),
    })

    const result = await generateProps({
      schema: { name: 'User name' },
    })

    expect(result.props.custom).toBe('value')
    expect(result.metadata.model).toBe('custom')
  })

  it('includes context in generation', async () => {
    const result = await generateProps({
      schema: { name: 'User name' },
      context: { userId: '123' },
    })

    expect(result.props).toBeDefined()
  })

  it('includes prompt in generation', async () => {
    const result = await generateProps({
      schema: { name: 'User name' },
      prompt: 'Generate a creative name',
    })

    expect(result.props).toBeDefined()
  })

  it('includes system in generation', async () => {
    const result = await generateProps({
      schema: { name: 'User name' },
      system: 'You are a naming expert',
    })

    expect(result.props).toBeDefined()
  })

  it('tracks duration in metadata', async () => {
    const result = await generateProps({
      schema: { name: 'User name' },
    })

    expect(result.metadata.duration).toBeDefined()
    expect(typeof result.metadata.duration).toBe('number')
  })
})

describe('getPropsSync', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
  })

  it('returns cached props', async () => {
    const schema = { name: 'User name' }

    // Pre-populate cache
    await generateProps({ schema })

    // Get synchronously
    const props = getPropsSync(schema)

    expect(props.name).toBe('generated-name')
  })

  it('throws when not cached', () => {
    expect(() => {
      getPropsSync({ name: 'User name' })
    }).toThrow('Props not in cache')
  })

  it('respects context in cache key', async () => {
    const schema = { name: 'User name' }
    const context = { userId: '123' }

    // Pre-populate cache with context
    await generateProps({ schema, context })

    // Get synchronously with same context
    const props = getPropsSync(schema, context)
    expect(props.name).toBe('generated-name')

    // Different context should throw
    expect(() => {
      getPropsSync(schema, { userId: '456' })
    }).toThrow('Props not in cache')
  })
})

describe('prefetchProps', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('prefetches multiple schemas', async () => {
    await prefetchProps([
      { schema: { name: 'User name' } },
      { schema: { title: 'Page title' } },
    ])

    // Both should be cached now
    const name = getPropsSync({ name: 'User name' })
    const title = getPropsSync({ title: 'Page title' })

    expect(name.name).toBe('generated-name')
    expect(title.title).toBe('generated-title')
  })

  it('prefetches in parallel', async () => {
    const startTime = Date.now()

    await prefetchProps([
      { schema: { a: 'Value A' } },
      { schema: { b: 'Value B' } },
      { schema: { c: 'Value C' } },
    ])

    // Should complete quickly since they run in parallel
    expect(Date.now() - startTime).toBeLessThan(1000)
  })
})

describe('generatePropsMany', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('generates multiple prop sets', async () => {
    const results = await generatePropsMany([
      { schema: { name: 'User name' } },
      { schema: { title: 'Page title' } },
    ])

    expect(results).toHaveLength(2)
    expect(results[0]?.props.name).toBe('generated-name')
    expect(results[1]?.props.title).toBe('generated-title')
  })

  it('returns all results with metadata', async () => {
    const results = await generatePropsMany([
      { schema: { a: 'Value A' } },
      { schema: { b: 'Value B' } },
    ])

    expect(results[0]?.metadata).toBeDefined()
    expect(results[1]?.metadata).toBeDefined()
  })
})

describe('mergeWithGenerated', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('generates only missing props', async () => {
    const result = await mergeWithGenerated(
      { name: 'User name', email: 'Email address' },
      { name: 'John Doe' }
    )

    expect(result.name).toBe('John Doe') // Preserved
    expect(result.email).toBe('generated-email') // Generated
  })

  it('returns as-is when all props provided', async () => {
    const result = await mergeWithGenerated(
      { name: 'User name', email: 'Email address' },
      { name: 'John Doe', email: 'john@example.com' }
    )

    expect(result.name).toBe('John Doe')
    expect(result.email).toBe('john@example.com')
  })

  it('generates all props when none provided', async () => {
    const result = await mergeWithGenerated(
      { name: 'User name', email: 'Email address' },
      {}
    )

    expect(result.name).toBe('generated-name')
    expect(result.email).toBe('generated-email')
  })

  it('handles string schema', async () => {
    const result = await mergeWithGenerated('A value', {})

    expect(result.value).toBe('generated-value')
  })

  it('preserves provided values for string schema', async () => {
    const result = await mergeWithGenerated('A value', { value: 'provided' })

    expect(result.value).toBe('provided')
  })

  it('accepts additional options', async () => {
    const result = await mergeWithGenerated(
      { name: 'User name' },
      {},
      { model: 'gpt-4' }
    )

    expect(result.name).toBe('generated-name')
  })
})
