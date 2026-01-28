/**
 * Tests for Endpoint helper functions
 */

import { describe, it, expect } from 'vitest'
import { Endpoint, GET, POST, PUT, DELETE, PATCH } from '../src/index.js'
import type { ServiceContext } from '../src/types.js'

describe('Endpoint', () => {
  describe('basic creation', () => {
    it('should create an endpoint with required fields', () => {
      const endpoint = Endpoint({
        name: 'test-endpoint',
        handler: async () => ({ ok: true }),
      })

      expect(endpoint.name).toBe('test-endpoint')
      expect(endpoint.handler).toBeDefined()
    })

    it('should default method to POST', () => {
      const endpoint = Endpoint({
        name: 'test',
        handler: async () => ({}),
      })

      expect(endpoint.method).toBe('POST')
    })

    it('should default path to endpoint name', () => {
      const endpoint = Endpoint({
        name: 'my-endpoint',
        handler: async () => ({}),
      })

      expect(endpoint.path).toBe('/my-endpoint')
    })

    it('should default requiresAuth to true', () => {
      const endpoint = Endpoint({
        name: 'test',
        handler: async () => ({}),
      })

      expect(endpoint.requiresAuth).toBe(true)
    })

    it('should allow explicitly setting requiresAuth to false', () => {
      const endpoint = Endpoint({
        name: 'public',
        handler: async () => ({}),
        requiresAuth: false,
      })

      expect(endpoint.requiresAuth).toBe(false)
    })
  })

  describe('configuration options', () => {
    it('should accept description', () => {
      const endpoint = Endpoint({
        name: 'translate',
        description: 'Translate text between languages',
        handler: async () => ({}),
      })

      expect(endpoint.description).toBe('Translate text between languages')
    })

    it('should accept custom path', () => {
      const endpoint = Endpoint({
        name: 'get-user',
        path: '/users/:id',
        handler: async () => ({}),
      })

      expect(endpoint.path).toBe('/users/:id')
    })

    it('should accept input schema', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          text: { type: 'string' },
          to: { type: 'string' },
        },
        required: ['text', 'to'],
      }

      const endpoint = Endpoint({
        name: 'translate',
        input: inputSchema,
        handler: async () => ({}),
      })

      expect(endpoint.input).toEqual(inputSchema)
    })

    it('should accept output schema', () => {
      const outputSchema = {
        type: 'object',
        properties: {
          translatedText: { type: 'string' },
        },
        required: ['translatedText'],
      }

      const endpoint = Endpoint({
        name: 'translate',
        output: outputSchema,
        handler: async () => ({}),
      })

      expect(endpoint.output).toEqual(outputSchema)
    })

    it('should accept pricing config', () => {
      const pricing = {
        model: 'per-use' as const,
        pricePerUnit: 0.01,
        currency: 'USD',
      }

      const endpoint = Endpoint({
        name: 'translate',
        pricing,
        handler: async () => ({}),
      })

      expect(endpoint.pricing).toEqual(pricing)
    })

    it('should accept rate limit config', () => {
      const rateLimit = {
        requests: 100,
        window: 60000,
      }

      const endpoint = Endpoint({
        name: 'api',
        rateLimit,
        handler: async () => ({}),
      })

      expect(endpoint.rateLimit).toEqual(rateLimit)
    })
  })

  describe('handler execution', () => {
    it('should execute handler and return result', async () => {
      const endpoint = Endpoint({
        name: 'echo',
        handler: async (input: { message: string }) => ({
          echoed: input.message,
        }),
      })

      const result = await endpoint.handler({ message: 'hello' })
      expect(result).toEqual({ echoed: 'hello' })
    })

    it('should pass context to handler', async () => {
      let capturedContext: ServiceContext | undefined

      const endpoint = Endpoint({
        name: 'test',
        handler: async (_input: unknown, context?: ServiceContext) => {
          capturedContext = context
          return { ok: true }
        },
      })

      const context: ServiceContext = {
        requestId: 'req-123',
        customerId: 'cust-456',
        entitlements: ['premium'],
      }

      await endpoint.handler({}, context)

      expect(capturedContext).toBeDefined()
      expect(capturedContext?.requestId).toBe('req-123')
      expect(capturedContext?.customerId).toBe('cust-456')
    })

    it('should handle async operations', async () => {
      const endpoint = Endpoint({
        name: 'delay',
        handler: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return { completed: true }
        },
      })

      const result = await endpoint.handler({})
      expect(result).toEqual({ completed: true })
    })

    it('should propagate errors', async () => {
      const endpoint = Endpoint({
        name: 'error',
        handler: async () => {
          throw new Error('Handler error')
        },
      })

      await expect(endpoint.handler({})).rejects.toThrow('Handler error')
    })
  })
})

describe('GET helper', () => {
  it('should create endpoint with GET method', () => {
    const endpoint = GET({
      name: 'list',
      handler: async () => ({ items: [] }),
    })

    expect(endpoint.method).toBe('GET')
    expect(endpoint.name).toBe('list')
  })

  it('should inherit other configurations', () => {
    const endpoint = GET({
      name: 'list',
      path: '/items',
      description: 'List all items',
      requiresAuth: false,
      handler: async () => ({}),
    })

    expect(endpoint.path).toBe('/items')
    expect(endpoint.description).toBe('List all items')
    expect(endpoint.requiresAuth).toBe(false)
  })
})

describe('POST helper', () => {
  it('should create endpoint with POST method', () => {
    const endpoint = POST({
      name: 'create',
      handler: async () => ({}),
    })

    expect(endpoint.method).toBe('POST')
  })

  it('should default path correctly', () => {
    const endpoint = POST({
      name: 'users',
      handler: async () => ({}),
    })

    expect(endpoint.path).toBe('/users')
  })
})

describe('PUT helper', () => {
  it('should create endpoint with PUT method', () => {
    const endpoint = PUT({
      name: 'update',
      handler: async () => ({}),
    })

    expect(endpoint.method).toBe('PUT')
  })

  it('should accept path with parameter', () => {
    const endpoint = PUT({
      name: 'update-user',
      path: '/users/:id',
      handler: async () => ({}),
    })

    expect(endpoint.method).toBe('PUT')
    expect(endpoint.path).toBe('/users/:id')
  })
})

describe('DELETE helper', () => {
  it('should create endpoint with DELETE method', () => {
    const endpoint = DELETE({
      name: 'remove',
      handler: async () => ({}),
    })

    expect(endpoint.method).toBe('DELETE')
  })

  it('should handle typical delete configuration', () => {
    const endpoint = DELETE({
      name: 'delete-item',
      path: '/items/:id',
      requiresAuth: true,
      handler: async () => ({ deleted: true }),
    })

    expect(endpoint.method).toBe('DELETE')
    expect(endpoint.requiresAuth).toBe(true)
  })
})

describe('PATCH helper', () => {
  it('should create endpoint with PATCH method', () => {
    const endpoint = PATCH({
      name: 'partial-update',
      handler: async () => ({}),
    })

    expect(endpoint.method).toBe('PATCH')
  })

  it('should work with input/output schemas', () => {
    const endpoint = PATCH({
      name: 'update-status',
      path: '/users/:id/status',
      input: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      },
      output: {
        type: 'object',
        properties: {
          updated: { type: 'boolean' },
        },
      },
      handler: async () => ({ updated: true }),
    })

    expect(endpoint.method).toBe('PATCH')
    expect(endpoint.input).toBeDefined()
    expect(endpoint.output).toBeDefined()
  })
})

describe('complete endpoint workflow', () => {
  it('should create a fully configured translation endpoint', () => {
    const translateEndpoint = Endpoint({
      name: 'translate',
      description: 'Translate text between languages',
      method: 'POST',
      path: '/translate',
      input: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to translate' },
          from: { type: 'string', description: 'Source language code' },
          to: { type: 'string', description: 'Target language code' },
        },
        required: ['text', 'to'],
        additionalProperties: false,
      },
      output: {
        type: 'object',
        properties: {
          translatedText: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['translatedText'],
      },
      handler: async (input: { text: string; from?: string; to: string }) => ({
        translatedText: `Translated: ${input.text}`,
        confidence: 0.95,
      }),
      pricing: {
        model: 'per-use',
        pricePerUnit: 0.01,
        currency: 'USD',
      },
      rateLimit: {
        requests: 100,
        window: 60000,
      },
    })

    expect(translateEndpoint.name).toBe('translate')
    expect(translateEndpoint.method).toBe('POST')
    expect(translateEndpoint.path).toBe('/translate')
    expect(translateEndpoint.requiresAuth).toBe(true)
    expect(translateEndpoint.pricing?.model).toBe('per-use')
    expect(translateEndpoint.rateLimit?.requests).toBe(100)
  })

  it('should execute the translation endpoint handler', async () => {
    const translateEndpoint = POST({
      name: 'translate',
      handler: async (input: { text: string; to: string }) => ({
        translatedText: `[${input.to}] ${input.text}`,
        detectedLanguage: 'en',
      }),
    })

    const result = await translateEndpoint.handler({ text: 'Hello', to: 'es' })

    expect(result.translatedText).toBe('[es] Hello')
    expect(result.detectedLanguage).toBe('en')
  })
})
