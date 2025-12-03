/**
 * Tests for AI() wrapper and component functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AI,
  createAIComponent,
  definePropsSchema,
  createComponentFactory,
  composeAIComponents,
} from '../src/ai.js'
import { configureAIProps, resetConfig, clearCache } from '../src/index.js'

// Mock the generateObject function
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

describe('AI()', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('creates an AI component wrapper', () => {
    const UserCard = AI({
      schema: {
        name: 'User name',
        bio: 'User biography',
      },
    })

    expect(typeof UserCard).toBe('function')
    expect(UserCard.schema).toBeDefined()
    expect(UserCard.generateProps).toBeDefined()
  })

  it('generates missing props', async () => {
    const UserCard = AI({
      schema: {
        name: 'User name',
        bio: 'User biography',
      },
    })

    const props = await UserCard({})

    expect(props.name).toBe('generated-name')
    expect(props.bio).toBe('generated-bio')
  })

  it('preserves provided props', async () => {
    const UserCard = AI({
      schema: {
        name: 'User name',
        bio: 'User biography',
      },
    })

    const props = await UserCard({ name: 'John Doe' })

    expect(props.name).toBe('John Doe')
    expect(props.bio).toBe('generated-bio')
  })

  it('applies defaults', async () => {
    const UserCard = AI({
      schema: {
        name: 'User name',
        role: 'User role',
      },
      defaults: {
        role: 'member',
      },
    })

    const props = await UserCard({})

    expect(props.role).toBe('member')
  })

  it('throws for missing required props', async () => {
    const UserCard = AI({
      schema: {
        name: 'User name',
        email: 'Email address',
      },
      required: ['email'],
    })

    await expect(UserCard({ name: 'John' })).rejects.toThrow('Missing required props')
  })

  it('excludes specified props from generation', async () => {
    const UserCard = AI({
      schema: {
        name: 'User name',
        avatar: 'Avatar URL',
        internal: 'Internal data',
      },
      exclude: ['internal'],
    })

    const props = await UserCard({})

    expect(props.name).toBe('generated-name')
    expect(props.avatar).toBe('generated-avatar')
    // internal should not be generated
    expect(props.internal).toBeUndefined()
  })

  it('exposes generateProps method', async () => {
    const UserCard = AI({
      schema: {
        name: 'User name',
      },
    })

    const props = await UserCard.generateProps({ name: 'Context Name' })

    expect(props).toBeDefined()
    expect(props.name).toBe('Context Name')
  })
})

describe('createAIComponent', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('creates typed AI component', async () => {
    const ProductCard = createAIComponent<{
      title: string
      price: number
      description: string
    }>({
      schema: {
        title: 'Product title',
        price: 'Price (number)',
        description: 'Description',
      },
    })

    const props = await ProductCard({})

    expect(typeof props.title).toBe('string')
    expect(typeof props.price).toBe('number')
  })
})

describe('definePropsSchema', () => {
  it('returns schema unchanged', () => {
    const schema = definePropsSchema({
      name: 'User name',
      email: 'Email address',
    })

    expect(schema).toEqual({
      name: 'User name',
      email: 'Email address',
    })
  })

  it('preserves complex schemas', () => {
    const schema = definePropsSchema({
      user: {
        name: 'Name',
        profile: {
          bio: 'Biography',
        },
      },
      tags: ['Tag list'],
    })

    expect(schema.user).toBeDefined()
    expect(schema.tags).toBeDefined()
  })
})

describe('createComponentFactory', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('creates component factory with generate method', async () => {
    const factory = createComponentFactory({
      schema: {
        name: 'Product name',
        price: 'Price (number)',
      },
    })

    expect(factory.component).toBeDefined()
    expect(factory.generate).toBeDefined()
    expect(factory.generateMany).toBeDefined()
    expect(factory.generateWith).toBeDefined()
  })

  it('generates single instance', async () => {
    const factory = createComponentFactory({
      schema: {
        name: 'Product name',
      },
    })

    const product = await factory.generate({ category: 'electronics' })

    expect(product.name).toBeDefined()
  })

  it('generates multiple instances', async () => {
    const factory = createComponentFactory({
      schema: {
        name: 'Product name',
      },
    })

    const products = await factory.generateMany([
      { category: 'electronics' },
      { category: 'clothing' },
      { category: 'food' },
    ])

    expect(products).toHaveLength(3)
    expect(products[0]?.name).toBeDefined()
  })

  it('generates with overrides', async () => {
    const factory = createComponentFactory({
      schema: {
        name: 'Product name',
        price: 'Price (number)',
      },
    })

    const product = await factory.generateWith(
      { category: 'tech' },
      { price: 99 }
    )

    expect(product.price).toBe(99)
    expect(product.name).toBeDefined()
  })
})

describe('composeAIComponents', () => {
  beforeEach(() => {
    resetConfig()
    clearCache()
    vi.clearAllMocks()
  })

  it('composes multiple schemas', async () => {
    const FullProfile = composeAIComponents({
      user: {
        schema: { name: 'User name' },
      },
      settings: {
        schema: { theme: 'Theme preference' },
      },
    })

    expect(FullProfile.schema).toBeDefined()
    expect(typeof FullProfile).toBe('function')
  })

  it('generates composed props', async () => {
    const FullProfile = composeAIComponents({
      user: {
        schema: { name: 'User name' },
      },
      settings: {
        schema: { theme: 'Theme preference' },
      },
    })

    const profile = await FullProfile({
      user: { name: 'John' },
      settings: {},
    })

    expect(profile.user.name).toBe('John')
    expect(profile.settings.theme).toBeDefined()
  })

  it('generates all missing sections', async () => {
    const FullProfile = composeAIComponents({
      user: {
        schema: { name: 'User name' },
      },
      prefs: {
        schema: { notifications: 'Notifications (boolean)' },
      },
    })

    const profile = await FullProfile({})

    expect(profile.user).toBeDefined()
    expect(profile.prefs).toBeDefined()
  })
})
