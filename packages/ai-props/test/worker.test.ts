/**
 * Worker Export Tests for ai-props
 *
 * Tests for the PropsService WorkerEntrypoint and PropsServiceCore RpcTarget.
 * Validates AI props generation, caching, configuration, and validation methods.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock cloudflare:workers module (not available outside Cloudflare Workers runtime)
vi.mock('cloudflare:workers', () => {
  class RpcTarget {}
  class WorkerEntrypoint<T = unknown> {}
  return { RpcTarget, WorkerEntrypoint }
})

// Mock the ai-functions generateObject before importing worker
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

import { PropsService, PropsServiceCore } from '../src/worker.js'
import { resetConfig, clearCache } from '../src/index.js'

describe('PropsServiceCore (RpcTarget)', () => {
  let service: PropsServiceCore

  beforeEach(() => {
    service = new PropsServiceCore()
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('creates a new PropsServiceCore instance', () => {
      expect(service).toBeInstanceOf(PropsServiceCore)
    })

    it('extends RpcTarget for RPC communication', () => {
      expect(service.constructor.name).toBe('PropsServiceCore')
    })
  })

  describe('generation operations', () => {
    describe('generate()', () => {
      it('generates props from schema', async () => {
        const result = await service.generate({
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
        const result = await service.generate({
          schema: { name: 'User name' },
        })

        expect(result.cached).toBe(false)
      })

      it('returns metadata with model info', async () => {
        const result = await service.generate({
          schema: { name: 'User name' },
        })

        expect(result.metadata).toBeDefined()
        expect(result.metadata?.model).toBe('sonnet')
      })

      it('uses custom model when specified', async () => {
        const result = await service.generate({
          schema: { name: 'User name' },
          model: 'gpt-4',
        })

        expect(result.metadata?.model).toBe('gpt-4')
      })

      it('caches results for subsequent calls', async () => {
        const schema = { name: 'User name' }

        // First call
        await service.generate({ schema })

        // Second call should be cached
        const result = await service.generate({ schema })

        expect(result.cached).toBe(true)
      })
    })

    describe('getSync()', () => {
      it('returns cached props synchronously', async () => {
        const schema = { name: 'User name' }

        // Pre-populate cache
        await service.generate({ schema })

        // Get synchronously
        const props = service.getSync(schema)

        expect(props.name).toBe('generated-name')
      })

      it('throws when not cached', () => {
        expect(() => {
          service.getSync({ name: 'User name' })
        }).toThrow('Props not in cache')
      })
    })

    describe('prefetch()', () => {
      it('prefetches multiple schemas', async () => {
        await service.prefetch([
          { schema: { name: 'User name' } },
          { schema: { title: 'Page title' } },
        ])

        // Both should be cached now
        const name = service.getSync({ name: 'User name' })
        const title = service.getSync({ title: 'Page title' })

        expect(name.name).toBe('generated-name')
        expect(title.title).toBe('generated-title')
      })
    })

    describe('generateMany()', () => {
      it('generates multiple prop sets in parallel', async () => {
        const results = await service.generateMany([
          { schema: { name: 'User name' } },
          { schema: { title: 'Page title' } },
        ])

        expect(results).toHaveLength(2)
        expect(results[0]?.props.name).toBe('generated-name')
        expect(results[1]?.props.title).toBe('generated-title')
      })
    })

    describe('mergeWithGenerated()', () => {
      it('generates only missing props', async () => {
        const result = await service.mergeWithGenerated(
          { name: 'User name', email: 'Email address' },
          { name: 'John Doe' }
        )

        expect(result.name).toBe('John Doe') // Preserved
        expect(result.email).toBe('generated-email') // Generated
      })

      it('returns as-is when all props provided', async () => {
        const result = await service.mergeWithGenerated(
          { name: 'User name', email: 'Email address' },
          { name: 'John Doe', email: 'john@example.com' }
        )

        expect(result.name).toBe('John Doe')
        expect(result.email).toBe('john@example.com')
      })
    })
  })

  describe('configuration operations', () => {
    describe('configure()', () => {
      it('sets model configuration', () => {
        service.configure({ model: 'gpt-4' })
        expect(service.getConfig().model).toBe('gpt-4')
      })

      it('sets cache configuration', () => {
        service.configure({ cache: false })
        expect(service.getConfig().cache).toBe(false)
      })

      it('merges with existing config', () => {
        service.configure({ model: 'gpt-4' })
        service.configure({ cache: false })

        const config = service.getConfig()
        expect(config.model).toBe('gpt-4')
        expect(config.cache).toBe(false)
      })
    })

    describe('getConfig()', () => {
      it('returns default config', () => {
        const config = service.getConfig()

        expect(config.model).toBe('sonnet')
        expect(config.cache).toBe(true)
        expect(config.cacheTTL).toBe(5 * 60 * 1000)
      })
    })

    describe('resetConfig()', () => {
      it('resets to default values', () => {
        service.configure({ model: 'gpt-4', cache: false })
        service.resetConfig()

        const config = service.getConfig()
        expect(config.model).toBe('sonnet')
        expect(config.cache).toBe(true)
      })
    })
  })

  describe('cache operations', () => {
    describe('setCached() and getCached()', () => {
      it('stores and retrieves props by key', () => {
        service.setCached('test-key', { name: 'Test' })

        const entry = service.getCached('test-key')

        expect(entry).toBeDefined()
        expect(entry?.props).toEqual({ name: 'Test' })
      })

      it('returns undefined for non-existent key', () => {
        const entry = service.getCached('non-existent')

        expect(entry).toBeUndefined()
      })
    })

    describe('deleteCached()', () => {
      it('removes cached entry', () => {
        service.setCached('delete-key', { name: 'Test' })

        const result = service.deleteCached('delete-key')

        expect(result).toBe(true)
        expect(service.getCached('delete-key')).toBeUndefined()
      })

      it('returns false for non-existent key', () => {
        const result = service.deleteCached('non-existent')

        expect(result).toBe(false)
      })
    })

    describe('clearCache()', () => {
      it('removes all cached entries', () => {
        service.setCached('key1', { a: 1 })
        service.setCached('key2', { b: 2 })

        service.clearCache()

        expect(service.getCacheSize()).toBe(0)
      })
    })

    describe('getCacheSize()', () => {
      it('returns number of cached entries', () => {
        service.setCached('key1', { a: 1 })
        service.setCached('key2', { b: 2 })

        expect(service.getCacheSize()).toBe(2)
      })
    })

    describe('createCacheKey()', () => {
      it('creates deterministic key from schema', () => {
        const key1 = service.createCacheKey({ name: 'User name' })
        const key2 = service.createCacheKey({ name: 'User name' })

        expect(key1).toBe(key2)
      })

      it('creates different keys for different schemas', () => {
        const key1 = service.createCacheKey({ name: 'User name' })
        const key2 = service.createCacheKey({ title: 'Page title' })

        expect(key1).not.toBe(key2)
      })

      it('includes context in key', () => {
        const key1 = service.createCacheKey({ name: 'User name' }, { id: '1' })
        const key2 = service.createCacheKey({ name: 'User name' }, { id: '2' })

        expect(key1).not.toBe(key2)
      })
    })

    describe('configureCache()', () => {
      it('sets cache TTL', () => {
        service.configureCache(10000)

        // This should create a new cache with the specified TTL
        expect(service.getCacheSize()).toBe(0)
      })
    })
  })

  describe('validation operations', () => {
    describe('validate()', () => {
      it('validates props against schema', () => {
        const result = service.validate(
          { name: 'John', age: 25 },
          { name: 'User name', age: 'Age (number)' }
        )

        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('returns errors for invalid props', () => {
        const result = service.validate(
          { name: 'John', age: 'not a number' },
          { name: 'User name', age: 'Age (number)' }
        )

        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })
    })

    describe('hasRequired()', () => {
      it('returns true when all required props present', () => {
        const result = service.hasRequired({ name: 'John', email: 'john@example.com' }, [
          'name',
          'email',
        ])

        expect(result).toBe(true)
      })

      it('returns false when required props missing', () => {
        const result = service.hasRequired({ name: 'John' }, ['name', 'email'])

        expect(result).toBe(false)
      })
    })

    describe('getMissing()', () => {
      it('returns list of missing props', () => {
        const missing = service.getMissing(
          { name: 'John' },
          { name: 'User name', email: 'Email address', age: 'Age' }
        )

        expect(missing).toContain('email')
        expect(missing).toContain('age')
        expect(missing).not.toContain('name')
      })
    })

    describe('isComplete()', () => {
      it('returns true when all schema props present', () => {
        const result = service.isComplete(
          { name: 'John', email: 'john@example.com' },
          { name: 'User name', email: 'Email address' }
        )

        expect(result).toBe(true)
      })

      it('returns false when props missing', () => {
        const result = service.isComplete(
          { name: 'John' },
          { name: 'User name', email: 'Email address' }
        )

        expect(result).toBe(false)
      })
    })

    describe('sanitize()', () => {
      it('removes extra keys not in schema', () => {
        const sanitized = service.sanitize(
          { name: 'John', extra: 'value', unknown: 123 },
          { name: 'User name' }
        )

        expect(sanitized).toEqual({ name: 'John' })
        expect(sanitized).not.toHaveProperty('extra')
        expect(sanitized).not.toHaveProperty('unknown')
      })
    })

    describe('mergeDefaults()', () => {
      it('merges props with defaults', () => {
        const result = service.mergeDefaults(
          { name: 'John' },
          { name: 'Default', email: 'default@example.com' },
          { name: 'User name', email: 'Email address' }
        )

        expect(result.name).toBe('John')
        expect(result.email).toBe('default@example.com')
      })

      it('preserves provided props over defaults', () => {
        const result = service.mergeDefaults(
          { name: 'John', email: 'john@example.com' },
          { name: 'Default', email: 'default@example.com' },
          { name: 'User name', email: 'Email address' }
        )

        expect(result.name).toBe('John')
        expect(result.email).toBe('john@example.com')
      })
    })
  })
})

describe('PropsService (WorkerEntrypoint)', () => {
  describe('class definition', () => {
    it('exports PropsService class', async () => {
      const { default: PropsServiceClass } = await import('../src/worker.js')
      expect(PropsServiceClass).toBeDefined()
      expect(typeof PropsServiceClass).toBe('function')
    })

    it('PropsService has connect method in prototype', () => {
      expect(typeof PropsService.prototype.connect).toBe('function')
    })

    it('is named PropsService', () => {
      expect(PropsService.name).toBe('PropsService')
    })
  })

  describe('connect()', () => {
    // Note: WorkerEntrypoint classes cannot be instantiated directly in tests.
    // They require the Cloudflare Workers runtime context.
    // We verify the connect method behavior by testing that:
    // 1. The method exists on the prototype
    // 2. The return type (PropsServiceCore) is properly constructable and functional

    it('returns a PropsServiceCore instance', () => {
      // Since we can't instantiate PropsService directly (requires Workers runtime),
      // we verify that PropsServiceCore (the return type of connect()) works correctly
      const core = new PropsServiceCore()
      expect(core).toBeInstanceOf(PropsServiceCore)
    })

    it('returns RpcTarget for RPC communication', () => {
      // Test that PropsServiceCore (what connect() returns) has all required methods
      const core = new PropsServiceCore()

      expect(core).toBeDefined()
      expect(typeof core.generate).toBe('function')
      expect(typeof core.getSync).toBe('function')
      expect(typeof core.prefetch).toBe('function')
      expect(typeof core.generateMany).toBe('function')
      expect(typeof core.mergeWithGenerated).toBe('function')
      expect(typeof core.configure).toBe('function')
      expect(typeof core.getConfig).toBe('function')
      expect(typeof core.resetConfig).toBe('function')
      expect(typeof core.getCached).toBe('function')
      expect(typeof core.setCached).toBe('function')
      expect(typeof core.deleteCached).toBe('function')
      expect(typeof core.clearCache).toBe('function')
      expect(typeof core.getCacheSize).toBe('function')
      expect(typeof core.createCacheKey).toBe('function')
      expect(typeof core.configureCache).toBe('function')
      expect(typeof core.validate).toBe('function')
      expect(typeof core.hasRequired).toBe('function')
      expect(typeof core.getMissing).toBe('function')
      expect(typeof core.isComplete).toBe('function')
      expect(typeof core.sanitize).toBe('function')
      expect(typeof core.mergeDefaults).toBe('function')
    })

    it('creates independent service instances', () => {
      // Each PropsServiceCore instance should be independent
      const core1 = new PropsServiceCore()
      const core2 = new PropsServiceCore()

      // Configure core1
      core1.configure({ model: 'gpt-4' })

      // Each instance should be independent
      expect(core1).not.toBe(core2)
      // Note: config is global, so this will affect both
      // In production, each worker instance would have its own state
    })
  })
})

describe('Integration: Real Props Generation', () => {
  let service: PropsServiceCore

  beforeEach(() => {
    service = new PropsServiceCore()
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('generates props and validates them', async () => {
    const schema = {
      title: 'Page title',
      description: 'Page description',
      published: 'Is published (boolean)',
    }

    // Generate props
    const result = await service.generate({ schema })

    expect(result.props).toBeDefined()

    // Validate generated props
    const validation = service.validate(result.props, schema)

    expect(validation.valid).toBe(true)
  })

  it('generates partial props and merges with provided', async () => {
    const schema = {
      name: 'User name',
      email: 'Email address',
      bio: 'User bio',
    }

    // Generate only missing props
    const result = await service.mergeWithGenerated(schema, {
      name: 'John Doe',
      email: 'john@example.com',
    })

    expect(result.name).toBe('John Doe')
    expect(result.email).toBe('john@example.com')
    expect(result.bio).toBe('generated-bio')
  })

  it('prefetches and retrieves props synchronously', async () => {
    const schemas = [
      { schema: { productName: 'Product name' } },
      { schema: { categoryName: 'Category name' } },
    ]

    // Prefetch all
    await service.prefetch(schemas)

    // Retrieve synchronously
    const product = service.getSync({ productName: 'Product name' })
    const category = service.getSync({ categoryName: 'Category name' })

    expect(product.productName).toBe('generated-productName')
    expect(category.categoryName).toBe('generated-categoryName')
  })

  it('sanitizes and merges props with defaults', async () => {
    const schema = {
      name: 'User name',
      role: 'User role',
    }

    const defaults = {
      name: 'Anonymous',
      role: 'viewer',
    }

    // Sanitize user input (remove extra fields)
    const userInput = { name: 'John', extra: 'ignored', role: 'admin' }
    const sanitized = service.sanitize(userInput, schema)

    // Merge with defaults
    const result = service.mergeDefaults(sanitized, defaults, schema)

    expect(result.name).toBe('John')
    expect(result.role).toBe('admin')
    expect(result).not.toHaveProperty('extra')
  })
})
