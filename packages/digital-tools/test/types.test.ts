/**
 * Tests for Type Definitions
 *
 * Covers tool categories, subcategories, and type structures.
 * Note: We primarily test via runtime behavior since TypeScript types
 * are compile-time only.
 */

import { describe, it, expect } from 'vitest'
import { defineTool, registry } from '../src/index.js'

describe('Tool Category Type System', () => {
  describe('ToolCategory', () => {
    it('accepts valid categories via defineTool', () => {
      const categories = [
        'communication',
        'data',
        'development',
        'documents',
        'finance',
        'integration',
        'knowledge',
        'media',
        'productivity',
        'security',
        'system',
        'web',
      ]

      // Each category should work in defineTool
      for (const category of categories) {
        const tool = defineTool({
          id: `cat.${category}`,
          name: `${category} Test`,
          description: 'Test',
          category: category as any,
          input: { type: 'object', properties: {} },
          handler: async () => ({}),
        })

        expect(tool.category).toBe(category)
      }
    })
  })

  describe('ToolSubcategory', () => {
    it('accepts valid subcategory values', () => {
      const tool = defineTool({
        id: 'sub.test',
        name: 'Subcategory Test',
        description: 'Test',
        category: 'data',
        subcategory: 'transform',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      })

      expect(tool.subcategory).toBe('transform')
    })
  })
})

describe('Tool Access Types', () => {
  describe('ToolAudience', () => {
    it('accepts agent audience', () => {
      const tool = defineTool({
        id: 'audience.agent',
        name: 'Agent Only',
        description: 'Only for agents',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { audience: 'agent' },
      })

      expect(tool.audience).toBe('agent')
    })

    it('accepts human audience', () => {
      const tool = defineTool({
        id: 'audience.human',
        name: 'Human Only',
        description: 'Only for humans',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { audience: 'human' },
      })

      expect(tool.audience).toBe('human')
    })

    it('accepts both audience', () => {
      const tool = defineTool({
        id: 'audience.both',
        name: 'Both',
        description: 'For both',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { audience: 'both' },
      })

      expect(tool.audience).toBe('both')
    })
  })

  describe('ToolPermission', () => {
    it('can be used in tool definition', () => {
      const tool = defineTool({
        id: 'perm.test',
        name: 'Permission Test',
        description: 'Test',
        category: 'communication',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: {
          permissions: [
            { type: 'write', resource: 'email' },
            { type: 'read', resource: 'contacts' },
          ],
        },
      })

      expect(tool.permissions).toHaveLength(2)
      expect(tool.permissions?.[0].type).toBe('write')
      expect(tool.permissions?.[0].resource).toBe('email')
      expect(tool.permissions?.[1].type).toBe('read')
    })
  })

  describe('RateLimit', () => {
    it('can be used in tool definition', () => {
      const tool = defineTool({
        id: 'rate.test',
        name: 'Rate Test',
        description: 'Test',
        category: 'web',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: {
          rateLimit: {
            maxCalls: 100,
            periodSeconds: 60,
            scope: 'user',
          },
        },
      })

      expect(tool.rateLimit?.maxCalls).toBe(100)
      expect(tool.rateLimit?.periodSeconds).toBe(60)
      expect(tool.rateLimit?.scope).toBe('user')
    })
  })
})

describe('Tool Interface', () => {
  describe('Tool definition structure', () => {
    it('has all required fields', () => {
      const tool = defineTool({
        id: 'structure.test',
        name: 'Structure Test',
        description: 'Tests structure',
        category: 'data',
        input: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
          required: ['value'],
        },
        handler: async (input) => ({ result: input }),
      })

      expect(tool.id).toBeDefined()
      expect(tool.name).toBeDefined()
      expect(tool.description).toBeDefined()
      expect(tool.category).toBeDefined()
      expect(tool.parameters).toBeDefined()
      expect(tool.handler).toBeDefined()
    })

    it('supports optional metadata fields', () => {
      const tool = defineTool({
        id: 'metadata.test',
        name: 'Metadata Test',
        description: 'Tests metadata',
        category: 'web',
        subcategory: 'fetch',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: {
          version: '1.0.0',
          author: 'Test Author',
          docsUrl: 'https://docs.example.com',
          requiresConfirmation: true,
          idempotent: false,
          estimatedDuration: 1000,
          costPerExecution: 0.01,
        },
      })

      expect(tool.version).toBe('1.0.0')
      expect(tool.author).toBe('Test Author')
      expect(tool.docsUrl).toBe('https://docs.example.com')
      expect(tool.requiresConfirmation).toBe(true)
      expect(tool.idempotent).toBe(false)
      expect(tool.estimatedDuration).toBe(1000)
      expect(tool.costPerExecution).toBe(0.01)
    })
  })

  describe('Tool with tags', () => {
    it('supports tags for classification', () => {
      const tool = defineTool({
        id: 'tags.test',
        name: 'Tags Test',
        description: 'Test',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: {
          tags: ['json', 'parse', 'transform'],
        },
      })

      expect(tool.tags).toHaveLength(3)
      expect(tool.tags).toContain('json')
      expect(tool.tags).toContain('parse')
    })
  })

  describe('Tool with security level', () => {
    it('supports security classification', () => {
      const tool = defineTool({
        id: 'security.test',
        name: 'Security Test',
        description: 'Test',
        category: 'security',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: {
          securityLevel: 'confidential',
        },
      })

      expect(tool.securityLevel).toBe('confidential')
    })
  })
})

describe('Registry Types', () => {
  describe('ToolRegistry interface', () => {
    it('has all required methods', () => {
      expect(typeof registry.register).toBe('function')
      expect(typeof registry.unregister).toBe('function')
      expect(typeof registry.get).toBe('function')
      expect(typeof registry.has).toBe('function')
      expect(typeof registry.list).toBe('function')
      expect(typeof registry.query).toBe('function')
      expect(typeof registry.byCategory).toBe('function')
      expect(typeof registry.clear).toBe('function')
    })

    it('registers and retrieves tools', () => {
      const tool = defineTool({
        id: 'registry.integration.test',
        name: 'Registry Test',
        description: 'Test',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      })

      registry.register(tool)

      expect(registry.has('registry.integration.test')).toBe(true)
      expect(registry.get('registry.integration.test')).toBe(tool)

      // Cleanup
      registry.unregister('registry.integration.test')
    })

    it('queries tools by category', () => {
      const dataTool = defineTool({
        id: 'query.data.test',
        name: 'Data Tool',
        description: 'Test',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      })

      registry.register(dataTool)

      const dataTools = registry.byCategory('data')
      expect(dataTools.some((t) => t.id === 'query.data.test')).toBe(true)

      // Cleanup
      registry.unregister('query.data.test')
    })

    it('queries tools with filters', () => {
      const tool = defineTool({
        id: 'query.filter.test',
        name: 'Filter Test',
        description: 'A test tool for filtering',
        category: 'web',
        subcategory: 'fetch',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: {
          tags: ['http', 'network'],
          audience: 'both',
        },
      })

      registry.register(tool)

      const results = registry.query({
        category: 'web',
        subcategory: 'fetch',
      })

      expect(results.some((t) => t.id === 'query.filter.test')).toBe(true)

      // Cleanup
      registry.unregister('query.filter.test')
    })
  })
})

describe('Tool Execution', () => {
  it('executes handler with input', async () => {
    const tool = defineTool<{ a: number; b: number }, { sum: number }>({
      id: 'exec.test',
      name: 'Add',
      description: 'Add two numbers',
      category: 'data',
      input: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
        required: ['a', 'b'],
      },
      handler: async (input) => ({ sum: input.a + input.b }),
    })

    const result = await tool.handler({ a: 2, b: 3 })

    expect(result.sum).toBe(5)
  })

  it('handles async operations', async () => {
    const tool = defineTool<{ delay: number }, { completed: boolean }>({
      id: 'exec.async.test',
      name: 'Async Test',
      description: 'Test async',
      category: 'system',
      input: {
        type: 'object',
        properties: {
          delay: { type: 'number' },
        },
      },
      handler: async (input) => {
        await new Promise((resolve) => setTimeout(resolve, input.delay))
        return { completed: true }
      },
    })

    const result = await tool.handler({ delay: 10 })

    expect(result.completed).toBe(true)
  })

  it('handles errors in handler', async () => {
    const tool = defineTool<{ shouldError: boolean }, { success: boolean }>({
      id: 'exec.error.test',
      name: 'Error Test',
      description: 'Test error',
      category: 'system',
      input: {
        type: 'object',
        properties: {
          shouldError: { type: 'boolean' },
        },
      },
      handler: async (input) => {
        if (input.shouldError) {
          throw new Error('Intentional error')
        }
        return { success: true }
      },
    })

    await expect(tool.handler({ shouldError: true })).rejects.toThrow('Intentional error')
    await expect(tool.handler({ shouldError: false })).resolves.toEqual({ success: true })
  })
})
