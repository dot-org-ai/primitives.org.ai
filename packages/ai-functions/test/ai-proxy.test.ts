/**
 * Tests for the ai proxy and AI() schema functions
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ai, AI, functions, withTemplate } from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe('ai proxy', () => {
  beforeEach(() => {
    functions.clear()
  })

  it('exposes functions registry', () => {
    expect(ai.functions).toBeDefined()
    expect(typeof ai.functions.list).toBe('function')
    expect(typeof ai.functions.get).toBe('function')
    expect(typeof ai.functions.set).toBe('function')
    expect(typeof ai.functions.has).toBe('function')
    expect(typeof ai.functions.clear).toBe('function')
    expect(typeof ai.functions.delete).toBe('function')
  })

  it('exposes define helpers', () => {
    expect(ai.define).toBeDefined()
    expect(typeof ai.define).toBe('function')
    expect(typeof ai.define.generative).toBe('function')
    expect(typeof ai.define.agentic).toBe('function')
    expect(typeof ai.define.human).toBe('function')
    expect(typeof ai.define.code).toBe('function')
  })

  it('exposes defineFunction', () => {
    expect(typeof ai.defineFunction).toBe('function')
  })
})

describe.skipIf(!hasGateway)('ai proxy auto-define', () => {
  beforeEach(() => {
    functions.clear()
  })

  it('auto-defines a function on first call', async () => {
    expect(functions.has('greetPerson')).toBe(false)

    const result = await (ai as Record<string, (args: unknown) => Promise<unknown>>).greetPerson({
      name: 'Alice',
      style: 'friendly',
    })

    expect(result).toBeDefined()
    expect(functions.has('greetPerson')).toBe(true)
  })

  it('uses cached definition on second call', async () => {
    // First call - defines the function
    await (ai as Record<string, (args: unknown) => Promise<unknown>>).capitalizeText({
      text: 'hello',
    })

    const fn1 = functions.get('capitalizeText')
    expect(fn1).toBeDefined()

    // Second call - uses cached definition
    await (ai as Record<string, (args: unknown) => Promise<unknown>>).capitalizeText({
      text: 'world',
    })

    const fn2 = functions.get('capitalizeText')
    expect(fn1).toBe(fn2) // Same cached function
  })
})

describe.skipIf(!hasGateway)('AI() schema functions', () => {
  it('creates schema-based functions', async () => {
    const client = AI({
      sentiment: {
        sentiment: 'positive | negative | neutral',
        score: 'Confidence score 0-1 (number)',
        explanation: 'Brief explanation',
      },
    })

    expect(client.sentiment).toBeDefined()
    expect(typeof client.sentiment).toBe('function')
  })

  it('generates structured output from schema', async () => {
    const client = AI({
      person: {
        name: 'Full name',
        age: 'Age (number)',
        occupation: 'Job title',
      },
    })

    const result = await client.person('A software engineer named Alice who is 30')

    expect(result).toBeDefined()
    expect(typeof result.name).toBe('string')
    expect(typeof result.age).toBe('number')
    expect(typeof result.occupation).toBe('string')
  })

  it('generates nested objects', async () => {
    const client = AI({
      profile: {
        user: {
          name: 'Name',
          email: 'Email address',
        },
        preferences: {
          theme: 'light | dark',
          notifications: 'Enabled? (boolean)',
        },
      },
    })

    const result = await client.profile('User Alice who prefers dark mode and has notifications on')

    expect(result).toBeDefined()
    expect(result.user).toBeDefined()
    expect(result.preferences).toBeDefined()
    expect(['light', 'dark']).toContain(result.preferences.theme)
    expect(typeof result.preferences.notifications).toBe('boolean')
  })

  it('generates arrays', async () => {
    const client = AI({
      todoList: {
        title: 'List title',
        items: ['Todo items'],
        priority: 'high | medium | low',
      },
    })

    const result = await client.todoList('A high priority shopping list with 3 items')

    expect(result).toBeDefined()
    expect(typeof result.title).toBe('string')
    expect(Array.isArray(result.items)).toBe(true)
    expect(result.items.length).toBeGreaterThan(0)
    expect(['high', 'medium', 'low']).toContain(result.priority)
  })
})

describe('withTemplate helper', () => {
  it('handles regular function calls', () => {
    const fn = withTemplate((prompt: string) => prompt.toUpperCase())

    const result = fn('hello world')
    expect(result).toBe('HELLO WORLD')
  })

  it('handles tagged template literals', () => {
    const fn = withTemplate((prompt: string) => prompt.toUpperCase())

    const result = fn`hello world`
    expect(result).toBe('HELLO WORLD')
  })

  it('handles tagged template literals with interpolation', () => {
    const fn = withTemplate((prompt: string) => prompt.toUpperCase())

    const name = 'Alice'
    const result = fn`hello ${name}!`
    expect(result).toBe('HELLO ALICE!')
  })

  it('handles multiple interpolations', () => {
    const fn = withTemplate((prompt: string) => prompt)

    const a = 'one'
    const b = 'two'
    const c = 'three'
    const result = fn`${a}, ${b}, ${c}`
    expect(result).toBe('one, two, three')
  })

  it('works with async functions', async () => {
    const fn = withTemplate(async (prompt: string) => {
      return `Result: ${prompt}`
    })

    const result = await fn`async test`
    expect(result).toBe('Result: async test')
  })
})
