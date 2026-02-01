/**
 * Extended Tests for Provider Registry
 *
 * Comprehensive tests for provider registration, creation, and discovery.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createProviderRegistry,
  providerRegistry,
  registerProvider,
  getProvider,
  listProviders,
  defineProvider,
  type ProviderInfo,
  type BaseProvider,
  type ProviderConfig,
} from '../src/providers/index.js'

describe('Provider Registry - createProviderRegistry', () => {
  describe('register', () => {
    it('registers a new provider', () => {
      const registry = createProviderRegistry()

      const info: ProviderInfo = {
        id: 'test.provider',
        name: 'Test Provider',
        description: 'A test provider',
        category: 'email',
        requiredConfig: ['apiKey'],
        optionalConfig: ['debug'],
      }

      const factory = async () => ({
        initialize: async () => {},
        getName: () => 'Test',
      })

      registry.register(info, factory)

      expect(registry.has('test.provider')).toBe(true)
    })

    it('throws on duplicate registration', () => {
      const registry = createProviderRegistry()

      const info: ProviderInfo = {
        id: 'duplicate.provider',
        name: 'Duplicate',
        description: 'Duplicate provider',
        category: 'email',
        requiredConfig: [],
      }

      const factory = async () => ({
        initialize: async () => {},
        getName: () => 'Duplicate',
      })

      registry.register(info, factory)

      expect(() => registry.register(info, factory)).toThrow('already registered')
    })
  })

  describe('get', () => {
    it('returns registered provider', () => {
      const registry = createProviderRegistry()

      const info: ProviderInfo = {
        id: 'get.test',
        name: 'Get Test',
        description: 'Test get',
        category: 'messaging',
        requiredConfig: [],
      }

      const factory = async () => ({
        initialize: async () => {},
        getName: () => 'Get Test',
      })

      registry.register(info, factory)

      const result = registry.get('get.test')
      expect(result).toBeDefined()
      expect(result?.info.id).toBe('get.test')
    })

    it('returns undefined for non-existent provider', () => {
      const registry = createProviderRegistry()

      const result = registry.get('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('has', () => {
    it('returns true for registered provider', () => {
      const registry = createProviderRegistry()

      const info: ProviderInfo = {
        id: 'has.test',
        name: 'Has Test',
        description: 'Test has',
        category: 'email',
        requiredConfig: [],
      }

      registry.register(info, async () => ({
        initialize: async () => {},
        getName: () => 'Has Test',
      }))

      expect(registry.has('has.test')).toBe(true)
    })

    it('returns false for unregistered provider', () => {
      const registry = createProviderRegistry()

      expect(registry.has('unregistered')).toBe(false)
    })
  })

  describe('list', () => {
    it('lists all providers', () => {
      const registry = createProviderRegistry()

      const info1: ProviderInfo = {
        id: 'list.test.1',
        name: 'List Test 1',
        description: 'Test 1',
        category: 'email',
        requiredConfig: [],
      }

      const info2: ProviderInfo = {
        id: 'list.test.2',
        name: 'List Test 2',
        description: 'Test 2',
        category: 'messaging',
        requiredConfig: [],
      }

      const factory = async () => ({
        initialize: async () => {},
        getName: () => 'Test',
      })

      registry.register(info1, factory)
      registry.register(info2, factory)

      const all = registry.list()
      expect(all).toHaveLength(2)
    })

    it('lists providers by category', () => {
      const registry = createProviderRegistry()

      registry.register(
        {
          id: 'cat.email',
          name: 'Email',
          description: 'Email provider',
          category: 'email',
          requiredConfig: [],
        },
        async () => ({
          initialize: async () => {},
          getName: () => 'Email',
        })
      )

      registry.register(
        {
          id: 'cat.messaging',
          name: 'Messaging',
          description: 'Messaging provider',
          category: 'messaging',
          requiredConfig: [],
        },
        async () => ({
          initialize: async () => {},
          getName: () => 'Messaging',
        })
      )

      const emailProviders = registry.list('email')
      expect(emailProviders).toHaveLength(1)
      expect(emailProviders[0].info.id).toBe('cat.email')
    })

    it('returns empty array for non-existent category', () => {
      const registry = createProviderRegistry()

      const result = registry.list('email')
      expect(result).toEqual([])
    })
  })

  describe('create', () => {
    it('creates provider instance', async () => {
      const registry = createProviderRegistry()

      let initialized = false

      registry.register(
        {
          id: 'create.test',
          name: 'Create Test',
          description: 'Test creation',
          category: 'email',
          requiredConfig: ['apiKey'],
        },
        async (config) => ({
          initialize: async () => {
            initialized = true
          },
          getName: () => 'Create Test',
          config,
        })
      )

      const instance = await registry.create('create.test', { apiKey: 'test-key' })

      expect(initialized).toBe(true)
      expect(instance).toBeDefined()
      expect(instance.getName()).toBe('Create Test')
    })

    it('throws for non-existent provider', async () => {
      const registry = createProviderRegistry()

      await expect(registry.create('nonexistent', {})).rejects.toThrow('not found')
    })

    it('throws for missing required config', async () => {
      const registry = createProviderRegistry()

      registry.register(
        {
          id: 'missing.config',
          name: 'Missing Config',
          description: 'Test missing config',
          category: 'email',
          requiredConfig: ['apiKey', 'secret'],
        },
        async () => ({
          initialize: async () => {},
          getName: () => 'Missing Config',
        })
      )

      await expect(registry.create('missing.config', { apiKey: 'key' })).rejects.toThrow(
        'missing required config'
      )
    })

    it('passes config to factory', async () => {
      const registry = createProviderRegistry()

      let receivedConfig: ProviderConfig | undefined

      registry.register(
        {
          id: 'config.pass',
          name: 'Config Pass',
          description: 'Test config passing',
          category: 'email',
          requiredConfig: ['apiKey'],
        },
        async (config) => {
          receivedConfig = config
          return {
            initialize: async () => {},
            getName: () => 'Config Pass',
          }
        }
      )

      await registry.create('config.pass', { apiKey: 'test-api-key', extra: 'value' })

      expect(receivedConfig).toEqual({ apiKey: 'test-api-key', extra: 'value' })
    })

    it('calls initialize on provider', async () => {
      const registry = createProviderRegistry()

      let initializeCalledWith: ProviderConfig | undefined

      registry.register(
        {
          id: 'init.test',
          name: 'Init Test',
          description: 'Test initialization',
          category: 'email',
          requiredConfig: [],
        },
        async () => ({
          initialize: async (config) => {
            initializeCalledWith = config
          },
          getName: () => 'Init Test',
        })
      )

      await registry.create('init.test', { setting: 'value' })

      expect(initializeCalledWith).toEqual({ setting: 'value' })
    })
  })
})

describe('defineProvider', () => {
  it('returns info and factory', () => {
    const info: ProviderInfo = {
      id: 'defined.provider',
      name: 'Defined Provider',
      description: 'A defined provider',
      category: 'email',
      requiredConfig: [],
    }

    const factory = async () => ({
      initialize: async () => {},
      getName: () => 'Defined',
    })

    const defined = defineProvider(info, factory)

    expect(defined.info).toBe(info)
    expect(defined.factory).toBe(factory)
  })

  it('provides register method', () => {
    const info: ProviderInfo = {
      id: 'register.method.test',
      name: 'Register Method',
      description: 'Test register method',
      category: 'messaging',
      requiredConfig: [],
    }

    const defined = defineProvider(info, async () => ({
      initialize: async () => {},
      getName: () => 'Register Method',
    }))

    expect(typeof defined.register).toBe('function')
  })
})

describe('Global Registry Functions', () => {
  // Note: These tests use the global providerRegistry which may have state from other tests
  // We test that the functions exist and work correctly

  describe('registerProvider', () => {
    it('is a function', () => {
      expect(typeof registerProvider).toBe('function')
    })
  })

  describe('getProvider', () => {
    it('is a function', () => {
      expect(typeof getProvider).toBe('function')
    })

    it('returns undefined for non-existent', () => {
      const result = getProvider('definitely.not.registered.12345')
      expect(result).toBeUndefined()
    })
  })

  describe('listProviders', () => {
    it('is a function', () => {
      expect(typeof listProviders).toBe('function')
    })

    it('returns an array', () => {
      const result = listProviders()
      expect(Array.isArray(result)).toBe(true)
    })

    it('can filter by category', () => {
      const result = listProviders('email')
      expect(Array.isArray(result)).toBe(true)
    })
  })
})

describe('Provider Info Structure', () => {
  it('supports all required fields', () => {
    const info: ProviderInfo = {
      id: 'structure.test',
      name: 'Structure Test',
      description: 'Testing structure',
      category: 'email',
      requiredConfig: ['apiKey'],
    }

    expect(info.id).toBe('structure.test')
    expect(info.name).toBe('Structure Test')
    expect(info.description).toBe('Testing structure')
    expect(info.category).toBe('email')
    expect(info.requiredConfig).toEqual(['apiKey'])
  })

  it('supports optional config', () => {
    const info: ProviderInfo = {
      id: 'optional.test',
      name: 'Optional Test',
      description: 'Testing optional',
      category: 'messaging',
      requiredConfig: ['token'],
      optionalConfig: ['debug', 'timeout'],
    }

    expect(info.optionalConfig).toEqual(['debug', 'timeout'])
  })

  it('supports all categories', () => {
    const categories = [
      'email',
      'messaging',
      'spreadsheet',
      'document',
      'presentation',
      'calendar',
      'task',
      'phone',
      'crm',
      'finance',
      'ecommerce',
      'support',
      'knowledge',
      'media',
      'storage',
      'analytics',
      'development',
      'project-management',
      'marketing',
      'forms',
      'video-conferencing',
      'signature',
    ] as const

    for (const category of categories) {
      const info: ProviderInfo = {
        id: `category.${category}`,
        name: `Category ${category}`,
        description: `Testing ${category}`,
        category,
        requiredConfig: [],
      }

      expect(info.category).toBe(category)
    }
  })
})

describe('Provider Integration', () => {
  it('factory receives config object', async () => {
    const registry = createProviderRegistry()

    let factoryConfig: ProviderConfig | undefined

    registry.register(
      {
        id: 'factory.config',
        name: 'Factory Config',
        description: 'Test factory config',
        category: 'email',
        requiredConfig: [],
      },
      async (config) => {
        factoryConfig = config
        return {
          initialize: async () => {},
          getName: () => 'Factory Config',
        }
      }
    )

    await registry.create('factory.config', { key: 'value', number: 123 })

    expect(factoryConfig).toEqual({ key: 'value', number: 123 })
  })

  it('provider can access config after creation', async () => {
    const registry = createProviderRegistry()

    registry.register(
      {
        id: 'access.config',
        name: 'Access Config',
        description: 'Test accessing config',
        category: 'email',
        requiredConfig: ['apiKey'],
      },
      async (config) => ({
        initialize: async () => {},
        getName: () => 'Access Config',
        getApiKey: () => config.apiKey,
      })
    )

    const instance = (await registry.create('access.config', { apiKey: 'my-api-key' })) as any

    expect(instance.getApiKey()).toBe('my-api-key')
  })

  it('multiple registries are independent', () => {
    const registry1 = createProviderRegistry()
    const registry2 = createProviderRegistry()

    registry1.register(
      {
        id: 'independent.test',
        name: 'Independent',
        description: 'Test independence',
        category: 'email',
        requiredConfig: [],
      },
      async () => ({
        initialize: async () => {},
        getName: () => 'Independent',
      })
    )

    expect(registry1.has('independent.test')).toBe(true)
    expect(registry2.has('independent.test')).toBe(false)
  })

  it('async factory works correctly', async () => {
    const registry = createProviderRegistry()

    registry.register(
      {
        id: 'async.factory',
        name: 'Async Factory',
        description: 'Test async factory',
        category: 'email',
        requiredConfig: [],
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return {
          initialize: async () => {},
          getName: () => 'Async Factory',
        }
      }
    )

    const instance = await registry.create('async.factory', {})
    expect(instance.getName()).toBe('Async Factory')
  })

  it('async initialize works correctly', async () => {
    const registry = createProviderRegistry()

    let initComplete = false

    registry.register(
      {
        id: 'async.init',
        name: 'Async Init',
        description: 'Test async init',
        category: 'email',
        requiredConfig: [],
      },
      async () => ({
        initialize: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          initComplete = true
        },
        getName: () => 'Async Init',
      })
    )

    await registry.create('async.init', {})
    expect(initComplete).toBe(true)
  })
})
