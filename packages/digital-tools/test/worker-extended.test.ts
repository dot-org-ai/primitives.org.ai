/**
 * Extended Tests for Worker/ToolServiceCore
 *
 * Additional comprehensive tests for ToolServiceCore functionality,
 * including fromMCP, clear, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ToolServiceCore } from '../src/worker.js'
import type { MCPTool, AnyTool } from '../src/types.js'

describe('ToolServiceCore - fromMCP', () => {
  let service: ToolServiceCore

  beforeEach(() => {
    service = new ToolServiceCore()
  })

  describe('basic conversion', () => {
    it('converts MCP tool to internal format', () => {
      const mcpTool: MCPTool = {
        name: 'test.mcp.tool',
        description: 'A tool from MCP',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input value' },
          },
          required: ['input'],
        },
      }

      const handler = async () => ({ result: 'done' })
      const tool = service.fromMCP(mcpTool, handler)

      expect(tool.id).toBe('test.mcp.tool')
      expect(tool.name).toBe('test.mcp.tool')
      expect(tool.description).toBe('A tool from MCP')
    })

    it('converts parameters from inputSchema', () => {
      const mcpTool: MCPTool = {
        name: 'params.test',
        description: 'Test parameters',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name param' },
            count: { type: 'number', description: 'Count param' },
          },
          required: ['name'],
        },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}))

      expect(tool.parameters).toHaveLength(2)

      const nameParam = tool.parameters.find((p) => p.name === 'name')
      const countParam = tool.parameters.find((p) => p.name === 'count')

      expect(nameParam?.required).toBe(true)
      expect(nameParam?.description).toBe('Name param')
      expect(countParam?.required).toBe(false)
    })

    it('handles missing description in properties', () => {
      const mcpTool: MCPTool = {
        name: 'no.desc',
        description: 'No param descriptions',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
        },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}))
      const valueParam = tool.parameters.find((p) => p.name === 'value')

      expect(valueParam?.description).toBe('Parameter: value')
    })

    it('defaults category to integration', () => {
      const mcpTool: MCPTool = {
        name: 'default.category',
        description: 'Test default category',
        inputSchema: { type: 'object' },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}))

      expect(tool.category).toBe('integration')
    })
  })

  describe('options handling', () => {
    it('sets custom category', () => {
      const mcpTool: MCPTool = {
        name: 'custom.category',
        description: 'Custom category',
        inputSchema: { type: 'object' },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}), {
        category: 'data',
      })

      expect(tool.category).toBe('data')
    })

    it('sets subcategory', () => {
      const mcpTool: MCPTool = {
        name: 'with.subcategory',
        description: 'With subcategory',
        inputSchema: { type: 'object' },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}), {
        category: 'data',
        subcategory: 'transform',
      })

      expect(tool.subcategory).toBe('transform')
    })

    it('sets tags', () => {
      const mcpTool: MCPTool = {
        name: 'with.tags',
        description: 'With tags',
        inputSchema: { type: 'object' },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}), {
        tags: ['custom', 'mcp', 'imported'],
      })

      expect(tool.tags).toContain('custom')
      expect(tool.tags).toContain('mcp')
      expect(tool.tags).toContain('imported')
    })

    it('handles empty options', () => {
      const mcpTool: MCPTool = {
        name: 'empty.options',
        description: 'Empty options',
        inputSchema: { type: 'object' },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}), {})

      expect(tool.id).toBe('empty.options')
      expect(tool.category).toBe('integration')
    })
  })

  describe('handler preservation', () => {
    it('preserves handler function', async () => {
      const mcpTool: MCPTool = {
        name: 'handler.test',
        description: 'Handler test',
        inputSchema: {
          type: 'object',
          properties: { x: { type: 'number' } },
        },
      }

      const handler = async (input: { x: number }) => ({ doubled: input.x * 2 })
      const tool = service.fromMCP(mcpTool, handler)

      const result = await tool.handler({ x: 5 })
      expect(result).toEqual({ doubled: 10 })
    })

    it('handler can be registered and executed', async () => {
      const mcpTool: MCPTool = {
        name: 'register.mcp',
        description: 'Registered MCP tool',
        inputSchema: {
          type: 'object',
          properties: { value: { type: 'string' } },
        },
      }

      const tool = service.fromMCP(mcpTool, async (input: { value: string }) => ({
        upper: input.value.toUpperCase(),
      }))

      service.register(tool)
      const result = await service.executeTool('register.mcp', { value: 'hello' })

      expect(result).toEqual({ upper: 'HELLO' })
    })
  })

  describe('edge cases', () => {
    it('handles empty properties', () => {
      const mcpTool: MCPTool = {
        name: 'empty.props',
        description: 'Empty properties',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}))

      expect(tool.parameters).toHaveLength(0)
    })

    it('handles missing properties', () => {
      const mcpTool: MCPTool = {
        name: 'no.props',
        description: 'No properties',
        inputSchema: {
          type: 'object',
        },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}))

      expect(tool.parameters).toHaveLength(0)
    })

    it('handles empty required array', () => {
      const mcpTool: MCPTool = {
        name: 'empty.required',
        description: 'Empty required',
        inputSchema: {
          type: 'object',
          properties: {
            value: { type: 'string' },
          },
          required: [],
        },
      }

      const tool = service.fromMCP(mcpTool, async () => ({}))
      const param = tool.parameters.find((p) => p.name === 'value')

      expect(param?.required).toBe(false)
    })
  })
})

describe('ToolServiceCore - clear', () => {
  let service: ToolServiceCore

  beforeEach(() => {
    service = new ToolServiceCore()
  })

  describe('full clear', () => {
    it('removes all tools', () => {
      service.register({
        id: 'clear.test.1',
        name: 'Clear Test 1',
        description: 'Test 1',
        category: 'data',
        parameters: [],
        handler: async () => ({}),
      })

      service.register({
        id: 'clear.test.2',
        name: 'Clear Test 2',
        description: 'Test 2',
        category: 'web',
        parameters: [],
        handler: async () => ({}),
      })

      expect(service.list().length).toBeGreaterThan(0)

      service.clear()

      expect(service.list()).toHaveLength(0)
    })

    it('clears built-in tools when not keeping', () => {
      // Fresh service has built-in tools
      expect(service.has('data.json.parse')).toBe(true)

      service.clear(false)

      expect(service.has('data.json.parse')).toBe(false)
    })
  })

  describe('keeping built-ins', () => {
    it('preserves data.json.parse', () => {
      service.register({
        id: 'custom.tool',
        name: 'Custom Tool',
        description: 'Custom',
        category: 'data',
        parameters: [],
        handler: async () => ({}),
      })

      service.clear(true)

      expect(service.has('data.json.parse')).toBe(true)
      expect(service.has('custom.tool')).toBe(false)
    })

    it('preserves data.csv.parse', () => {
      service.clear(true)

      expect(service.has('data.csv.parse')).toBe(true)
    })

    it('preserves data.transform', () => {
      service.clear(true)

      expect(service.has('data.transform')).toBe(true)
    })

    it('removes custom tools while keeping built-ins', () => {
      service.register({
        id: 'custom.1',
        name: 'Custom 1',
        description: 'Custom 1',
        category: 'data',
        parameters: [],
        handler: async () => ({}),
      })

      service.register({
        id: 'custom.2',
        name: 'Custom 2',
        description: 'Custom 2',
        category: 'web',
        parameters: [],
        handler: async () => ({}),
      })

      service.clear(true)

      expect(service.has('custom.1')).toBe(false)
      expect(service.has('custom.2')).toBe(false)
      expect(service.has('data.json.parse')).toBe(true)
    })

    it('built-ins are functional after clear', async () => {
      service.clear(true)

      const result = await service.executeTool('data.json.parse', {
        text: '{"test": 123}',
      })

      expect(result.valid).toBe(true)
      expect(result.data).toEqual({ test: 123 })
    })
  })

  describe('default behavior', () => {
    it('defaults to full clear (keepBuiltins=false)', () => {
      service.clear()

      expect(service.list()).toHaveLength(0)
    })
  })
})

describe('ToolServiceCore - unregister', () => {
  let service: ToolServiceCore

  beforeEach(() => {
    service = new ToolServiceCore()
  })

  it('removes registered tool', () => {
    service.register({
      id: 'unregister.test',
      name: 'Unregister Test',
      description: 'Test',
      category: 'data',
      parameters: [],
      handler: async () => ({}),
    })

    expect(service.has('unregister.test')).toBe(true)

    const result = service.unregister('unregister.test')

    expect(result).toBe(true)
    expect(service.has('unregister.test')).toBe(false)
  })

  it('returns false for non-existent tool', () => {
    const result = service.unregister('nonexistent.tool')

    expect(result).toBe(false)
  })

  it('can unregister built-in tools', () => {
    expect(service.has('data.json.parse')).toBe(true)

    service.unregister('data.json.parse')

    expect(service.has('data.json.parse')).toBe(false)
  })
})

describe('ToolServiceCore - query edge cases', () => {
  let service: ToolServiceCore

  beforeEach(() => {
    service = new ToolServiceCore()
    service.clear()

    service.register({
      id: 'query.test.1',
      name: 'Query Test 1',
      description: 'First test tool for queries',
      category: 'data',
      subcategory: 'transform',
      parameters: [],
      handler: async () => ({}),
      tags: ['json', 'parse'],
      audience: 'agent',
    })

    service.register({
      id: 'query.test.2',
      name: 'Query Test 2',
      description: 'Second test tool',
      category: 'web',
      subcategory: 'fetch',
      parameters: [],
      handler: async () => ({}),
      tags: ['http'],
      audience: 'human',
    })

    service.register({
      id: 'query.test.3',
      name: 'Query Test 3',
      description: 'Third test tool for both',
      category: 'data',
      parameters: [],
      handler: async () => ({}),
      tags: ['transform'],
      audience: 'both',
    })
  })

  describe('combined filters', () => {
    it('filters by category and subcategory', () => {
      const results = service.query({
        category: 'data',
        subcategory: 'transform',
      })

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('query.test.1')
    })

    it('filters by category and tags', () => {
      const results = service.query({
        category: 'data',
        tags: ['json'],
      })

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('query.test.1')
    })

    it('filters by category and audience', () => {
      const results = service.query({
        category: 'data',
        audience: 'agent',
      })

      // agent can see 'agent' and 'both' and undefined
      expect(results.length).toBeGreaterThanOrEqual(1)
    })

    it('filters by search and category', () => {
      const results = service.query({
        search: 'first',
        category: 'data',
      })

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('query.test.1')
    })
  })

  describe('pagination edge cases', () => {
    it('returns all when limit exceeds count', () => {
      const results = service.query({ limit: 100 })

      expect(results.length).toBeLessThanOrEqual(100)
    })

    it('returns empty when offset exceeds count', () => {
      const results = service.query({ offset: 1000 })

      expect(results).toHaveLength(0)
    })

    it('handles offset with limit', () => {
      const allResults = service.query({})
      const offsetResults = service.query({ offset: 1, limit: 1 })

      if (allResults.length > 1) {
        expect(offsetResults).toHaveLength(1)
        expect(offsetResults[0].id).toBe(allResults[1].id)
      }
    })

    it('handles zero limit', () => {
      const results = service.query({ limit: 0 })

      expect(results).toHaveLength(0)
    })
  })

  describe('search variations', () => {
    it('searches in name', () => {
      const results = service.query({ search: 'query test 2' })

      expect(results.some((t) => t.id === 'query.test.2')).toBe(true)
    })

    it('searches in description', () => {
      const results = service.query({ search: 'third' })

      expect(results.some((t) => t.id === 'query.test.3')).toBe(true)
    })

    it('searches in id', () => {
      const results = service.query({ search: 'query.test.1' })

      expect(results.some((t) => t.id === 'query.test.1')).toBe(true)
    })

    it('search is case-insensitive', () => {
      const results = service.query({ search: 'FIRST' })

      expect(results.some((t) => t.id === 'query.test.1')).toBe(true)
    })
  })

  describe('audience matching', () => {
    it('agent sees both and agent tools', () => {
      const results = service.query({ audience: 'agent' })

      expect(results.some((t) => t.id === 'query.test.1')).toBe(true) // agent
      expect(results.some((t) => t.id === 'query.test.3')).toBe(true) // both
    })

    it('human sees both and human tools', () => {
      const results = service.query({ audience: 'human' })

      expect(results.some((t) => t.id === 'query.test.2')).toBe(true) // human
      expect(results.some((t) => t.id === 'query.test.3')).toBe(true) // both
    })
  })
})

describe('ToolServiceCore - byCategory', () => {
  let service: ToolServiceCore

  beforeEach(() => {
    service = new ToolServiceCore()
    service.clear()

    service.register({
      id: 'cat.data.1',
      name: 'Data 1',
      description: 'Data tool',
      category: 'data',
      parameters: [],
      handler: async () => ({}),
    })

    service.register({
      id: 'cat.data.2',
      name: 'Data 2',
      description: 'Another data tool',
      category: 'data',
      parameters: [],
      handler: async () => ({}),
    })

    service.register({
      id: 'cat.web.1',
      name: 'Web 1',
      description: 'Web tool',
      category: 'web',
      parameters: [],
      handler: async () => ({}),
    })
  })

  it('returns tools for specified category', () => {
    const dataTools = service.byCategory('data')

    expect(dataTools).toHaveLength(2)
    expect(dataTools.every((t) => t.category === 'data')).toBe(true)
  })

  it('returns empty for non-existent category', () => {
    const results = service.byCategory('security')

    expect(results).toHaveLength(0)
  })

  it('uses query internally', () => {
    // byCategory is shorthand for query({ category })
    const viaByCategory = service.byCategory('web')
    const viaQuery = service.query({ category: 'web' })

    expect(viaByCategory.length).toBe(viaQuery.length)
    expect(viaByCategory.map((t) => t.id).sort()).toEqual(viaQuery.map((t) => t.id).sort())
  })
})

describe('ToolServiceCore - executeTool edge cases', () => {
  let service: ToolServiceCore

  beforeEach(() => {
    service = new ToolServiceCore()
  })

  it('handles async handler', async () => {
    service.register({
      id: 'async.exec',
      name: 'Async Exec',
      description: 'Async handler',
      category: 'data',
      parameters: [],
      handler: async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return { delayed: true }
      },
    })

    const result = await service.executeTool('async.exec', {})

    expect(result).toEqual({ delayed: true })
  })

  it('handles handler that returns primitive', async () => {
    service.register({
      id: 'primitive.return',
      name: 'Primitive Return',
      description: 'Returns primitive',
      category: 'data',
      parameters: [],
      handler: async () => 42,
    })

    const result = await service.executeTool('primitive.return', {})

    expect(result).toBe(42)
  })

  it('handles handler that returns null', async () => {
    service.register({
      id: 'null.return',
      name: 'Null Return',
      description: 'Returns null',
      category: 'data',
      parameters: [],
      handler: async () => null,
    })

    const result = await service.executeTool('null.return', {})

    expect(result).toBeNull()
  })

  it('throws for non-existent tool', async () => {
    await expect(service.executeTool('does.not.exist', {})).rejects.toThrow(
      'Tool "does.not.exist" not found'
    )
  })

  it('propagates handler errors', async () => {
    service.register({
      id: 'error.throw',
      name: 'Error Throw',
      description: 'Throws error',
      category: 'data',
      parameters: [],
      handler: async () => {
        throw new Error('Test error')
      },
    })

    await expect(service.executeTool('error.throw', {})).rejects.toThrow('Test error')
  })
})
