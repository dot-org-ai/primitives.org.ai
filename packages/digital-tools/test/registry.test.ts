/**
 * Tests for Tool Registry functionality
 *
 * Covers tool registration, querying, and MCP conversion.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  registry,
  createRegistry,
  registerTool,
  getTool,
  executeTool,
  toMCP,
  listMCPTools,
  defineTool,
} from '../src/index.js'

describe('Registry', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('register', () => {
    it('registers a tool', () => {
      const tool = defineTool({
        id: 'test.tool',
        name: 'Test Tool',
        description: 'A test tool',
        category: 'data',
        input: {
          type: 'object',
          properties: { value: { type: 'string' } },
          required: ['value'],
        },
        handler: async (input) => ({ result: input }),
      })

      registry.register(tool)

      expect(registry.has('test.tool')).toBe(true)
    })

    it('overwrites existing tool with same id', () => {
      const tool1 = defineTool({
        id: 'test.tool',
        name: 'Tool V1',
        description: 'Version 1',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({ v: 1 }),
      })

      const tool2 = defineTool({
        id: 'test.tool',
        name: 'Tool V2',
        description: 'Version 2',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({ v: 2 }),
      })

      registry.register(tool1)
      registry.register(tool2)

      expect(registry.get('test.tool')?.name).toBe('Tool V2')
    })
  })

  describe('get', () => {
    it('returns tool by id', () => {
      const tool = defineTool({
        id: 'get.test',
        name: 'Get Test',
        description: 'Test get',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      })

      registry.register(tool)

      expect(registry.get('get.test')?.name).toBe('Get Test')
    })

    it('returns undefined for non-existent tool', () => {
      expect(registry.get('non.existent')).toBeUndefined()
    })
  })

  describe('has', () => {
    it('returns true for registered tool', () => {
      const tool = defineTool({
        id: 'has.test',
        name: 'Has Test',
        description: 'Test has',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      })

      registry.register(tool)

      expect(registry.has('has.test')).toBe(true)
    })

    it('returns false for non-existent tool', () => {
      expect(registry.has('non.existent')).toBe(false)
    })
  })

  describe('unregister', () => {
    it('removes a tool from registry', () => {
      const tool = defineTool({
        id: 'unregister.test',
        name: 'Unregister Test',
        description: 'Test unregister',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      })

      registry.register(tool)
      const result = registry.unregister('unregister.test')

      expect(result).toBe(true)
      expect(registry.has('unregister.test')).toBe(false)
    })

    it('returns false for non-existent tool', () => {
      expect(registry.unregister('non.existent')).toBe(false)
    })
  })

  describe('list', () => {
    it('returns all tool ids', () => {
      registry.register(defineTool({
        id: 'list.a',
        name: 'A',
        description: 'A',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }))

      registry.register(defineTool({
        id: 'list.b',
        name: 'B',
        description: 'B',
        category: 'web',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }))

      const ids = registry.list()

      expect(ids).toContain('list.a')
      expect(ids).toContain('list.b')
    })

    it('returns empty array when no tools', () => {
      expect(registry.list()).toHaveLength(0)
    })
  })

  describe('query', () => {
    beforeEach(() => {
      registry.register(defineTool({
        id: 'query.data.1',
        name: 'Data Tool 1',
        description: 'Data tool',
        category: 'data',
        subcategory: 'transform',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { audience: 'agent', tags: ['json', 'parse'] },
      }))

      registry.register(defineTool({
        id: 'query.web.1',
        name: 'Web Tool 1',
        description: 'Web tool',
        category: 'web',
        subcategory: 'fetch',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { audience: 'human', tags: ['http'] },
      }))

      registry.register(defineTool({
        id: 'query.data.2',
        name: 'Data Tool 2',
        description: 'Another data tool',
        category: 'data',
        subcategory: 'validate',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
        options: { audience: 'both', tags: ['validate'] },
      }))
    })

    it('filters by category', () => {
      const results = registry.query({ category: 'data' })

      expect(results).toHaveLength(2)
      expect(results.every(t => t.category === 'data')).toBe(true)
    })

    it('filters by subcategory', () => {
      const results = registry.query({ subcategory: 'transform' })

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('query.data.1')
    })

    it('filters by tags', () => {
      const results = registry.query({ tags: ['json'] })

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('query.data.1')
    })

    it('filters by audience', () => {
      const agentResults = registry.query({ audience: 'agent' })
      // agent can use tools with audience: agent, both, or undefined

      expect(agentResults.length).toBeGreaterThanOrEqual(1)
    })

    it('searches by text', () => {
      const results = registry.query({ search: 'another' })

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('query.data.2')
    })

    it('applies pagination', () => {
      const results = registry.query({ limit: 2 })

      expect(results).toHaveLength(2)
    })

    it('applies offset', () => {
      const all = registry.query({})
      const offset = registry.query({ offset: 1 })

      expect(offset).toHaveLength(all.length - 1)
    })
  })

  describe('byCategory', () => {
    it('returns tools by category', () => {
      registry.register(defineTool({
        id: 'cat.web.1',
        name: 'Web',
        description: 'Web',
        category: 'web',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }))

      registry.register(defineTool({
        id: 'cat.data.1',
        name: 'Data',
        description: 'Data',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }))

      const webTools = registry.byCategory('web')

      expect(webTools).toHaveLength(1)
      expect(webTools[0].id).toBe('cat.web.1')
    })
  })

  describe('clear', () => {
    it('removes all tools', () => {
      registry.register(defineTool({
        id: 'clear.1',
        name: 'Clear',
        description: 'Clear',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }))

      registry.clear()

      expect(registry.list()).toHaveLength(0)
    })
  })
})

describe('createRegistry', () => {
  it('creates a new isolated registry', () => {
    const reg1 = createRegistry()
    const reg2 = createRegistry()

    reg1.register(defineTool({
      id: 'isolated.1',
      name: 'Isolated',
      description: 'Isolated',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    }))

    expect(reg1.has('isolated.1')).toBe(true)
    expect(reg2.has('isolated.1')).toBe(false)
  })
})

describe('registerTool', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('registers tool in global registry', () => {
    const tool = defineTool({
      id: 'global.test',
      name: 'Global',
      description: 'Global',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    registerTool(tool)

    expect(registry.has('global.test')).toBe(true)
  })
})

describe('getTool', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('gets tool from global registry', () => {
    const tool = defineTool({
      id: 'get.global',
      name: 'Get Global',
      description: 'Get global',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    registry.register(tool)

    expect(getTool('get.global')?.name).toBe('Get Global')
  })
})

describe('executeTool', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('executes a registered tool', async () => {
    const tool = defineTool({
      id: 'execute.test',
      name: 'Execute',
      description: 'Execute',
      category: 'data',
      input: { type: 'object', properties: { value: { type: 'string' } } },
      handler: async (input: { value: string }) => ({ doubled: input.value + input.value }),
    })

    registry.register(tool)

    const result = await executeTool<{ value: string }, { doubled: string }>(
      'execute.test',
      { value: 'test' }
    )

    expect(result.doubled).toBe('testtest')
  })

  it('throws for non-existent tool', async () => {
    await expect(executeTool('non.existent', {})).rejects.toThrow('not found')
  })
})

describe('toMCP', () => {
  it('converts tool to MCP format', () => {
    const tool = defineTool({
      id: 'mcp.test',
      name: 'MCP Test',
      description: 'Test MCP conversion',
      category: 'data',
      input: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL to fetch' },
          timeout: { type: 'number', description: 'Timeout in ms' },
        },
        required: ['url'],
      },
      handler: async () => ({}),
    })

    const mcp = toMCP(tool)

    expect(mcp.name).toBe('mcp.test')
    expect(mcp.description).toBe('Test MCP conversion')
    expect(mcp.inputSchema.type).toBe('object')
    expect(mcp.inputSchema.properties).toHaveProperty('url')
    expect(mcp.inputSchema.required).toContain('url')
  })
})

describe('listMCPTools', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('lists all tools in MCP format', () => {
    registry.register(defineTool({
      id: 'mcp.list.1',
      name: 'Tool 1',
      description: 'Tool 1',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    }))

    registry.register(defineTool({
      id: 'mcp.list.2',
      name: 'Tool 2',
      description: 'Tool 2',
      category: 'web',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    }))

    const mcpTools = listMCPTools()

    expect(mcpTools).toHaveLength(2)
    expect(mcpTools.every(t => 'inputSchema' in t)).toBe(true)
  })
})
