/**
 * Extended Tests for Tool Definition Utilities
 *
 * Comprehensive tests for defineTool, defineAndRegister, createToolExecutor, and toolBuilder.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  defineTool,
  defineAndRegister,
  createToolExecutor,
  toolBuilder,
  registry,
} from '../src/index.js'

describe('defineTool - Extended Cases', () => {
  describe('input schema handling', () => {
    it('handles non-object schema', () => {
      const tool = defineTool({
        id: 'single.param',
        name: 'Single Param',
        description: 'Tool with single non-object input',
        category: 'data',
        input: { type: 'string', description: 'A string input' },
        handler: async (input) => input,
      })

      // Should wrap in 'input' parameter
      expect(tool.parameters).toHaveLength(1)
      expect(tool.parameters[0].name).toBe('input')
    })

    it('handles schema without properties', () => {
      const tool = defineTool({
        id: 'no.props',
        name: 'No Props',
        description: 'Schema without properties',
        category: 'data',
        input: { type: 'object' },
        handler: async () => ({}),
      })

      // Should create 'input' parameter
      expect(tool.parameters).toHaveLength(1)
    })

    it('handles empty properties object', () => {
      const tool = defineTool({
        id: 'empty.props',
        name: 'Empty Props',
        description: 'Empty properties',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      })

      expect(tool.parameters).toHaveLength(0)
    })

    it('extracts default values from schema', () => {
      const tool = defineTool({
        id: 'defaults.test',
        name: 'Defaults Test',
        description: 'Test default values',
        category: 'data',
        input: {
          type: 'object',
          properties: {
            name: { type: 'string', default: 'Anonymous' },
          },
        },
        handler: async (input) => input,
      })

      expect(tool.parameters[0].default).toBe('Anonymous')
    })

    it('handles required array in schema', () => {
      const tool = defineTool({
        id: 'required.test',
        name: 'Required Test',
        description: 'Test required fields',
        category: 'data',
        input: {
          type: 'object',
          properties: {
            requiredField: { type: 'string' },
            optionalField: { type: 'string' },
          },
          required: ['requiredField'],
        },
        handler: async (input) => input,
      })

      const required = tool.parameters.find((p) => p.name === 'requiredField')
      const optional = tool.parameters.find((p) => p.name === 'optionalField')

      expect(required?.required).toBe(true)
      expect(optional?.required).toBe(false)
    })
  })

  describe('output schema', () => {
    it('sets output with description', () => {
      const tool = defineTool({
        id: 'output.test',
        name: 'Output Test',
        description: 'Test output schema',
        category: 'data',
        input: { type: 'object', properties: {} },
        output: {
          type: 'object',
          properties: {
            result: { type: 'string' },
          },
        },
        handler: async () => ({ result: 'done' }),
      })

      expect(tool.output).toBeDefined()
      expect(tool.output?.description).toBe('Tool output')
      expect(tool.output?.schema).toHaveProperty('properties')
    })

    it('handles tool without output schema', () => {
      const tool = defineTool({
        id: 'no.output',
        name: 'No Output',
        description: 'No output schema',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      })

      expect(tool.output).toBeUndefined()
    })
  })

  describe('optional options', () => {
    it('sets version', () => {
      const tool = defineTool({
        id: 'version.test',
        name: 'Version Test',
        description: 'Test version',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { version: '1.2.3' },
      })

      expect(tool.version).toBe('1.2.3')
    })

    it('sets author', () => {
      const tool = defineTool({
        id: 'author.test',
        name: 'Author Test',
        description: 'Test author',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { author: 'Test Author' },
      })

      expect(tool.author).toBe('Test Author')
    })

    it('sets docsUrl', () => {
      const tool = defineTool({
        id: 'docs.test',
        name: 'Docs Test',
        description: 'Test docs URL',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { docsUrl: 'https://docs.example.com' },
      })

      expect(tool.docsUrl).toBe('https://docs.example.com')
    })

    it('sets requiresConfirmation', () => {
      const tool = defineTool({
        id: 'confirm.test',
        name: 'Confirm Test',
        description: 'Test confirmation',
        category: 'communication',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { requiresConfirmation: true },
      })

      expect(tool.requiresConfirmation).toBe(true)
    })

    it('sets idempotent', () => {
      const tool = defineTool({
        id: 'idempotent.test',
        name: 'Idempotent Test',
        description: 'Test idempotency',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { idempotent: true },
      })

      expect(tool.idempotent).toBe(true)
    })

    it('sets estimatedDuration', () => {
      const tool = defineTool({
        id: 'duration.test',
        name: 'Duration Test',
        description: 'Test duration',
        category: 'web',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { estimatedDuration: 5000 },
      })

      expect(tool.estimatedDuration).toBe(5000)
    })

    it('sets costPerExecution', () => {
      const tool = defineTool({
        id: 'cost.test',
        name: 'Cost Test',
        description: 'Test cost',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { costPerExecution: 0.01 },
      })

      expect(tool.costPerExecution).toBe(0.01)
    })

    it('sets rateLimit', () => {
      const tool = defineTool({
        id: 'rate.test',
        name: 'Rate Test',
        description: 'Test rate limiting',
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

    it('sets securityLevel', () => {
      const tool = defineTool({
        id: 'security.test',
        name: 'Security Test',
        description: 'Test security level',
        category: 'security',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { securityLevel: 'restricted' },
      })

      expect(tool.securityLevel).toBe('restricted')
    })

    it('sets permissions array', () => {
      const tool = defineTool({
        id: 'perms.test',
        name: 'Permissions Test',
        description: 'Test permissions',
        category: 'system',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: {
          permissions: [
            { type: 'read', resource: 'filesystem' },
            { type: 'write', resource: 'filesystem' },
          ],
        },
      })

      expect(tool.permissions).toHaveLength(2)
      expect(tool.permissions?.[0]?.type).toBe('read')
      expect(tool.permissions?.[1]?.type).toBe('write')
    })
  })

  describe('all categories', () => {
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
    ] as const

    for (const category of categories) {
      it(`supports ${category} category`, () => {
        const tool = defineTool({
          id: `${category}.test`,
          name: `${category} Test`,
          description: `Test ${category} category`,
          category,
          input: { type: 'object', properties: {} },
          handler: async () => ({}),
        })

        expect(tool.category).toBe(category)
      })
    }
  })
})

describe('defineAndRegister - Extended', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('returns the created tool', () => {
    const tool = defineAndRegister({
      id: 'return.test',
      name: 'Return Test',
      description: 'Test return value',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    expect(tool.id).toBe('return.test')
  })

  it('tool is immediately available in registry', () => {
    defineAndRegister({
      id: 'immediate.test',
      name: 'Immediate Test',
      description: 'Test immediate registration',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    expect(registry.has('immediate.test')).toBe(true)
  })

  it('handler is executable from registry', async () => {
    defineAndRegister({
      id: 'exec.from.registry',
      name: 'Exec From Registry',
      description: 'Test execution',
      category: 'data',
      input: {
        type: 'object',
        properties: { value: { type: 'number' } },
      },
      handler: async (input: { value: number }) => ({ doubled: input.value * 2 }),
    })

    const tool = registry.get('exec.from.registry')
    const result = await tool?.handler({ value: 5 })

    expect(result).toEqual({ doubled: 10 })
  })
})

describe('createToolExecutor - Extended', () => {
  beforeEach(() => {
    registry.clear()

    registry.register(
      defineTool({
        id: 'exec.test.tool',
        name: 'Exec Test Tool',
        description: 'Tool for testing',
        category: 'data',
        input: {
          type: 'object',
          properties: { value: { type: 'string' } },
        },
        handler: async (input: { value: string }) => ({
          result: input.value.toUpperCase(),
        }),
      })
    )

    registry.register(
      defineTool({
        id: 'exec.slow.tool',
        name: 'Slow Tool',
        description: 'Tool that takes time',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          return { done: true }
        },
      })
    )

    registry.register(
      defineTool({
        id: 'exec.throwing.tool',
        name: 'Throwing Tool',
        description: 'Tool that throws',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => {
          throw new Error('Intentional test error')
        },
      })
    )

    registry.register(
      defineTool({
        id: 'exec.human.only',
        name: 'Human Only Tool',
        description: 'Only for humans',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({ human: true }),
        options: { audience: 'human' },
      })
    )

    registry.register(
      defineTool({
        id: 'exec.both.audiences',
        name: 'Both Audiences',
        description: 'For both',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({ both: true }),
        options: { audience: 'both' },
      })
    )

    registry.register(
      defineTool({
        id: 'exec.no.audience',
        name: 'No Audience',
        description: 'No audience specified',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({ noAudience: true }),
      })
    )
  })

  describe('execute method', () => {
    it('executes tool and returns success', async () => {
      const executor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
      })

      const result = await executor.execute('exec.test.tool', { value: 'hello' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ result: 'HELLO' })
    })

    it('returns error for missing tool', async () => {
      const executor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
      })

      const result = await executor.execute('nonexistent.tool', {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('TOOL_NOT_FOUND')
    })

    it('tracks execution duration', async () => {
      const executor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
      })

      const result = await executor.execute('exec.slow.tool', {})

      expect(result.success).toBe(true)
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(40)
    })

    it('handles handler errors', async () => {
      const executor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
      })

      const result = await executor.execute('exec.throwing.tool', {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('EXECUTION_ERROR')
      expect(result.error?.message).toBe('Intentional test error')
    })

    it('includes error duration in metadata', async () => {
      const executor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
      })

      const result = await executor.execute('exec.throwing.tool', {})

      expect(result.metadata?.duration).toBeDefined()
      expect(result.metadata?.duration).toBeGreaterThanOrEqual(0)
    })

    it('includes requestId in success metadata', async () => {
      const executor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
        requestId: 'req-abc-123',
      })

      const result = await executor.execute('exec.test.tool', { value: 'test' })

      expect(result.metadata?.requestId).toBe('req-abc-123')
    })

    it('includes requestId in error metadata', async () => {
      const executor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
        requestId: 'req-error-456',
      })

      const result = await executor.execute('exec.throwing.tool', {})

      expect(result.metadata?.requestId).toBe('req-error-456')
    })
  })

  describe('audience restrictions', () => {
    it('agent cannot access human-only tools', async () => {
      const executor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
      })

      const result = await executor.execute('exec.human.only', {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('ACCESS_DENIED')
    })

    it('human cannot access agent-only tools', async () => {
      // Register an agent-only tool
      registry.register(
        defineTool({
          id: 'exec.agent.only',
          name: 'Agent Only',
          description: 'Only for agents',
          category: 'data',
          input: { type: 'object', properties: {} },
          handler: async () => ({ agent: true }),
          options: { audience: 'agent' },
        })
      )

      const executor = createToolExecutor({
        executor: { type: 'human', id: 'user-1' },
      })

      const result = await executor.execute('exec.agent.only', {})

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('ACCESS_DENIED')
    })

    it('both audiences can access both-audience tools', async () => {
      const agentExecutor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
      })
      const humanExecutor = createToolExecutor({
        executor: { type: 'human', id: 'user-1' },
      })

      const agentResult = await agentExecutor.execute('exec.both.audiences', {})
      const humanResult = await humanExecutor.execute('exec.both.audiences', {})

      expect(agentResult.success).toBe(true)
      expect(humanResult.success).toBe(true)
    })

    it('tools without audience are accessible to all', async () => {
      const agentExecutor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
      })
      const humanExecutor = createToolExecutor({
        executor: { type: 'human', id: 'user-1' },
      })

      const agentResult = await agentExecutor.execute('exec.no.audience', {})
      const humanResult = await humanExecutor.execute('exec.no.audience', {})

      expect(agentResult.success).toBe(true)
      expect(humanResult.success).toBe(true)
    })
  })

  describe('listAvailable method', () => {
    it('lists tools available to agents', () => {
      const executor = createToolExecutor({
        executor: { type: 'agent', id: 'agent-1' },
      })

      const available = executor.listAvailable()

      // Should not include human-only tools
      expect(available.some((t) => t.id === 'exec.human.only')).toBe(false)
      // Should include both-audience and no-audience tools
      expect(available.some((t) => t.id === 'exec.both.audiences')).toBe(true)
      expect(available.some((t) => t.id === 'exec.no.audience')).toBe(true)
    })

    it('lists tools available to humans', () => {
      const executor = createToolExecutor({
        executor: { type: 'human', id: 'user-1' },
      })

      const available = executor.listAvailable()

      // Should include human-only tools
      expect(available.some((t) => t.id === 'exec.human.only')).toBe(true)
      // Should include both-audience and no-audience tools
      expect(available.some((t) => t.id === 'exec.both.audiences')).toBe(true)
    })
  })
})

describe('toolBuilder - Extended', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('fluent API', () => {
    it('chains all methods', () => {
      const tool = toolBuilder('chain.test')
        .name('Chain Test')
        .description('Test chaining')
        .category('data')
        .subcategory('transform')
        .input({ type: 'object', properties: {} })
        .output({ type: 'object', properties: { result: { type: 'string' } } })
        .options({ audience: 'both', tags: ['test'] })
        .handler(async () => ({ result: 'done' }))
        .build()

      expect(tool.id).toBe('chain.test')
      expect(tool.name).toBe('Chain Test')
      expect(tool.description).toBe('Test chaining')
      expect(tool.category).toBe('data')
      expect(tool.subcategory).toBe('transform')
      expect(tool.output).toBeDefined()
      expect(tool.audience).toBe('both')
      expect(tool.tags).toContain('test')
    })

    it('allows methods in any order', () => {
      const tool = toolBuilder('order.test')
        .handler(async () => ({}))
        .category('web')
        .name('Order Test')
        .input({ type: 'object', properties: {} })
        .description('Test order')
        .build()

      expect(tool.id).toBe('order.test')
      expect(tool.name).toBe('Order Test')
      expect(tool.category).toBe('web')
    })
  })

  describe('build validation', () => {
    it('throws when name is missing', () => {
      expect(() => {
        toolBuilder('missing.name')
          .description('Description')
          .category('data')
          .input({ type: 'object', properties: {} })
          .handler(async () => ({}))
          .build()
      }).toThrow()
    })

    it('throws when description is missing', () => {
      expect(() => {
        toolBuilder('missing.desc')
          .name('Name')
          .category('data')
          .input({ type: 'object', properties: {} })
          .handler(async () => ({}))
          .build()
      }).toThrow()
    })

    it('throws when category is missing', () => {
      expect(() => {
        toolBuilder('missing.category')
          .name('Name')
          .description('Description')
          .input({ type: 'object', properties: {} })
          .handler(async () => ({}))
          .build()
      }).toThrow()
    })

    it('throws when input is missing', () => {
      expect(() => {
        toolBuilder('missing.input')
          .name('Name')
          .description('Description')
          .category('data')
          .handler(async () => ({}))
          .build()
      }).toThrow()
    })

    it('throws when handler is missing', () => {
      expect(() => {
        toolBuilder('missing.handler')
          .name('Name')
          .description('Description')
          .category('data')
          .input({ type: 'object', properties: {} })
          .build()
      }).toThrow()
    })
  })

  describe('register method', () => {
    it('builds and registers tool', () => {
      const tool = toolBuilder('builder.register')
        .name('Builder Register')
        .description('Test register')
        .category('data')
        .input({ type: 'object', properties: {} })
        .handler(async () => ({}))
        .register()

      expect(tool.id).toBe('builder.register')
      expect(registry.has('builder.register')).toBe(true)
    })

    it('returns the registered tool', () => {
      const tool = toolBuilder('return.registered')
        .name('Return Registered')
        .description('Test return')
        .category('data')
        .input({ type: 'object', properties: {} })
        .handler(async () => ({}))
        .register()

      const fromRegistry = registry.get('return.registered')
      expect(tool.id).toBe(fromRegistry?.id)
    })
  })

  describe('handler execution', () => {
    it('handler receives input correctly', async () => {
      const tool = toolBuilder('input.receive')
        .name('Input Receive')
        .description('Test input')
        .category('data')
        .input({
          type: 'object',
          properties: { x: { type: 'number' }, y: { type: 'number' } },
        })
        .handler(async (input: { x: number; y: number }) => ({
          sum: input.x + input.y,
        }))
        .build()

      const result = await tool.handler({ x: 3, y: 4 })

      expect(result).toEqual({ sum: 7 })
    })

    it('handler can be async', async () => {
      const tool = toolBuilder('async.handler')
        .name('Async Handler')
        .description('Test async')
        .category('data')
        .input({ type: 'object', properties: {} })
        .handler(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return { delayed: true }
        })
        .build()

      const result = await tool.handler({})

      expect(result).toEqual({ delayed: true })
    })

    it('handler can throw errors', async () => {
      const tool = toolBuilder('error.handler')
        .name('Error Handler')
        .description('Test errors')
        .category('data')
        .input({ type: 'object', properties: {} })
        .handler(async () => {
          throw new Error('Handler error')
        })
        .build()

      await expect(tool.handler({})).rejects.toThrow('Handler error')
    })
  })
})
