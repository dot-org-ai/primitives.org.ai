/**
 * Tests for Tool Definition functionality
 *
 * Covers defineTool, defineAndRegister, createToolExecutor, and toolBuilder.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  defineTool,
  defineAndRegister,
  createToolExecutor,
  toolBuilder,
  registry,
} from '../src/index.js'

describe('defineTool', () => {
  it('creates a tool with basic config', () => {
    const tool = defineTool({
      id: 'basic.tool',
      name: 'Basic Tool',
      description: 'A basic tool',
      category: 'data',
      input: {
        type: 'object',
        properties: {
          value: { type: 'string', description: 'Input value' },
        },
        required: ['value'],
      },
      handler: async (input) => ({ result: input }),
    })

    expect(tool.id).toBe('basic.tool')
    expect(tool.name).toBe('Basic Tool')
    expect(tool.description).toBe('A basic tool')
    expect(tool.category).toBe('data')
  })

  it('converts input schema to parameters', () => {
    const tool = defineTool({
      id: 'param.tool',
      name: 'Param Tool',
      description: 'Tool with parameters',
      category: 'data',
      input: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name input' },
          age: { type: 'number', description: 'Age input' },
        },
        required: ['name'],
      },
      handler: async (input) => input,
    })

    expect(tool.parameters).toHaveLength(2)
    expect(tool.parameters[0].name).toBe('name')
    expect(tool.parameters[0].required).toBe(true)
    expect(tool.parameters[1].name).toBe('age')
    expect(tool.parameters[1].required).toBe(false)
  })

  it('sets subcategory', () => {
    const tool = defineTool({
      id: 'subcat.tool',
      name: 'Subcategory Tool',
      description: 'Tool with subcategory',
      category: 'data',
      subcategory: 'transform',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    expect(tool.subcategory).toBe('transform')
  })

  it('sets output schema', () => {
    const tool = defineTool({
      id: 'output.tool',
      name: 'Output Tool',
      description: 'Tool with output',
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
    expect(tool.output?.schema).toHaveProperty('properties')
  })

  it('applies options', () => {
    const tool = defineTool({
      id: 'options.tool',
      name: 'Options Tool',
      description: 'Tool with options',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
      options: {
        audience: 'agent',
        tags: ['test', 'example'],
        idempotent: true,
      },
    })

    expect(tool.audience).toBe('agent')
    expect(tool.tags).toContain('test')
    expect(tool.idempotent).toBe(true)
  })

  it('handler is callable', async () => {
    const tool = defineTool({
      id: 'callable.tool',
      name: 'Callable Tool',
      description: 'Tool with callable handler',
      category: 'data',
      input: {
        type: 'object',
        properties: { x: { type: 'number' } },
        required: ['x'],
      },
      handler: async (input: { x: number }) => ({ doubled: input.x * 2 }),
    })

    const result = await tool.handler({ x: 5 })

    expect(result).toEqual({ doubled: 10 })
  })
})

describe('defineAndRegister', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('creates and registers a tool', () => {
    const tool = defineAndRegister({
      id: 'register.tool',
      name: 'Register Tool',
      description: 'Auto-registered tool',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    expect(tool.id).toBe('register.tool')
    expect(registry.has('register.tool')).toBe(true)
  })
})

describe('createToolExecutor', () => {
  beforeEach(() => {
    registry.clear()

    registry.register(defineTool({
      id: 'exec.test',
      name: 'Exec Test',
      description: 'Test execution',
      category: 'data',
      input: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
      },
      handler: async (input: { value: string }) => ({
        upper: input.value.toUpperCase(),
      }),
    }))

    registry.register(defineTool({
      id: 'exec.agent-only',
      name: 'Agent Only',
      description: 'Agent only tool',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({ result: 'agent' }),
      options: { audience: 'agent' },
    }))

    registry.register(defineTool({
      id: 'exec.error',
      name: 'Error Tool',
      description: 'Tool that throws',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('Tool error')
      },
    }))
  })

  it('executes a tool with context', async () => {
    const executor = createToolExecutor({
      executor: { type: 'agent', id: 'agent_1', name: 'Test Agent' },
      environment: 'test',
    })

    const result = await executor.execute<{ value: string }, { upper: string }>(
      'exec.test',
      { value: 'hello' }
    )

    expect(result.success).toBe(true)
    expect(result.data?.upper).toBe('HELLO')
  })

  it('returns error for non-existent tool', async () => {
    const executor = createToolExecutor({
      executor: { type: 'agent', id: 'agent_1', name: 'Test Agent' },
    })

    const result = await executor.execute('non.existent', {})

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('TOOL_NOT_FOUND')
  })

  it('checks audience restrictions', async () => {
    const executor = createToolExecutor({
      executor: { type: 'human', id: 'user_1', name: 'Test User' },
    })

    const result = await executor.execute('exec.agent-only', {})

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('ACCESS_DENIED')
  })

  it('handles execution errors', async () => {
    const executor = createToolExecutor({
      executor: { type: 'agent', id: 'agent_1', name: 'Test Agent' },
    })

    const result = await executor.execute('exec.error', {})

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe('EXECUTION_ERROR')
    expect(result.error?.message).toBe('Tool error')
  })

  it('tracks execution metadata', async () => {
    const executor = createToolExecutor({
      executor: { type: 'agent', id: 'agent_1', name: 'Test Agent' },
      requestId: 'req_123',
    })

    const result = await executor.execute('exec.test', { value: 'test' })

    expect(result.metadata?.duration).toBeGreaterThanOrEqual(0)
    expect(result.metadata?.requestId).toBe('req_123')
  })

  it('lists available tools', () => {
    const executor = createToolExecutor({
      executor: { type: 'human', id: 'user_1', name: 'Test User' },
    })

    const available = executor.listAvailable()

    // Should not include agent-only tool
    expect(available.some(t => t.id === 'exec.test')).toBe(true)
    expect(available.some(t => t.id === 'exec.agent-only')).toBe(false)
  })
})

describe('toolBuilder', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('builds a tool with fluent API', () => {
    const tool = toolBuilder('builder.test')
      .name('Builder Test')
      .description('Built with builder')
      .category('data')
      .subcategory('transform')
      .input({
        type: 'object',
        properties: {
          value: { type: 'string' },
        },
        required: ['value'],
      })
      .handler(async (input: { value: string }) => ({ result: input.value }))
      .build()

    expect(tool.id).toBe('builder.test')
    expect(tool.name).toBe('Builder Test')
    expect(tool.category).toBe('data')
    expect(tool.subcategory).toBe('transform')
  })

  it('sets output schema', () => {
    const tool = toolBuilder('output.test')
      .name('Output Test')
      .description('With output')
      .category('data')
      .input({ type: 'object', properties: {} })
      .output({ type: 'object', properties: { result: { type: 'string' } } })
      .handler(async () => ({ result: 'done' }))
      .build()

    expect(tool.output).toBeDefined()
  })

  it('sets options', () => {
    const tool = toolBuilder('options.test')
      .name('Options Test')
      .description('With options')
      .category('data')
      .input({ type: 'object', properties: {} })
      .options({
        audience: 'both',
        tags: ['builder'],
      })
      .handler(async () => ({}))
      .build()

    expect(tool.audience).toBe('both')
    expect(tool.tags).toContain('builder')
  })

  it('registers tool with register()', () => {
    const tool = toolBuilder('register.test')
      .name('Register Test')
      .description('Auto register')
      .category('data')
      .input({ type: 'object', properties: {} })
      .handler(async () => ({}))
      .register()

    expect(registry.has('register.test')).toBe(true)
  })

  it('throws if required fields are missing', () => {
    expect(() => {
      toolBuilder('incomplete.test')
        .name('Incomplete')
        // Missing description, category, input, handler
        .build()
    }).toThrow()
  })

  it('handler is callable after build', async () => {
    const tool = toolBuilder('callable.test')
      .name('Callable')
      .description('Callable handler')
      .category('data')
      .input({
        type: 'object',
        properties: { n: { type: 'number' } },
        required: ['n'],
      })
      .handler(async (input: { n: number }) => ({ squared: input.n * input.n }))
      .build()

    const result = await tool.handler({ n: 4 })

    expect(result).toEqual({ squared: 16 })
  })
})
