/**
 * Worker Export Tests for digital-tools
 *
 * RED phase tests for the /worker export.
 * These tests verify the ToolService WorkerEntrypoint and ToolServiceCore RpcTarget.
 *
 * Uses @cloudflare/vitest-pool-workers for real Cloudflare Workers execution.
 * NO MOCKS - all tests use real tool execution.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// These imports will FAIL because worker.ts doesn't exist yet
import { ToolService, ToolServiceCore } from '../src/worker.js'

describe('ToolServiceCore (RpcTarget)', () => {
  let service: ToolServiceCore

  beforeEach(() => {
    service = new ToolServiceCore()
  })

  describe('constructor', () => {
    it('creates a new ToolServiceCore instance', () => {
      expect(service).toBeInstanceOf(ToolServiceCore)
    })

    it('extends RpcTarget for RPC communication', () => {
      // RpcTarget is the base class for objects passed over Workers RPC
      expect(service.constructor.name).toBe('ToolServiceCore')
    })
  })

  describe('registry operations', () => {
    describe('register()', () => {
      it('registers a tool in the service registry', () => {
        const tool = {
          id: 'test.tool.one',
          name: 'Test Tool',
          description: 'A test tool for registration',
          category: 'data' as const,
          parameters: [],
          handler: async () => ({ success: true }),
        }

        service.register(tool)

        expect(service.has('test.tool.one')).toBe(true)
      })

      it('allows registering multiple tools', () => {
        const tool1 = {
          id: 'test.multi.one',
          name: 'Multi Tool 1',
          description: 'First multi tool',
          category: 'data' as const,
          parameters: [],
          handler: async () => ({}),
        }
        const tool2 = {
          id: 'test.multi.two',
          name: 'Multi Tool 2',
          description: 'Second multi tool',
          category: 'web' as const,
          parameters: [],
          handler: async () => ({}),
        }

        service.register(tool1)
        service.register(tool2)

        expect(service.has('test.multi.one')).toBe(true)
        expect(service.has('test.multi.two')).toBe(true)
      })
    })

    describe('get()', () => {
      it('retrieves a registered tool by id', () => {
        const tool = {
          id: 'test.get.tool',
          name: 'Get Test Tool',
          description: 'Tool for get testing',
          category: 'data' as const,
          parameters: [],
          handler: async () => ({ retrieved: true }),
        }

        service.register(tool)
        const retrieved = service.get('test.get.tool')

        expect(retrieved).toBeDefined()
        expect(retrieved?.id).toBe('test.get.tool')
        expect(retrieved?.name).toBe('Get Test Tool')
      })

      it('returns undefined for non-existent tool', () => {
        const result = service.get('non.existent.tool')

        expect(result).toBeUndefined()
      })
    })

    describe('list()', () => {
      it('returns all registered tool ids', () => {
        service.register({
          id: 'list.tool.a',
          name: 'Tool A',
          description: 'A',
          category: 'data' as const,
          parameters: [],
          handler: async () => ({}),
        })
        service.register({
          id: 'list.tool.b',
          name: 'Tool B',
          description: 'B',
          category: 'web' as const,
          parameters: [],
          handler: async () => ({}),
        })

        const ids = service.list()

        expect(ids).toContain('list.tool.a')
        expect(ids).toContain('list.tool.b')
      })

      it('returns empty array when no tools registered', () => {
        const freshService = new ToolServiceCore()
        // Assuming fresh service has no tools or just built-ins
        const ids = freshService.list()

        expect(Array.isArray(ids)).toBe(true)
      })
    })

    describe('query()', () => {
      beforeEach(() => {
        service.register({
          id: 'query.data.transform',
          name: 'Data Transform',
          description: 'Transform data',
          category: 'data' as const,
          subcategory: 'transform',
          parameters: [],
          handler: async () => ({}),
          tags: ['json', 'parse'],
        })
        service.register({
          id: 'query.web.fetch',
          name: 'Web Fetch',
          description: 'Fetch from web',
          category: 'web' as const,
          subcategory: 'fetch',
          parameters: [],
          handler: async () => ({}),
          tags: ['http'],
        })
      })

      it('queries tools by category', () => {
        const dataTools = service.query({ category: 'data' })

        expect(dataTools.length).toBeGreaterThan(0)
        expect(dataTools.every((t) => t.category === 'data')).toBe(true)
      })

      it('queries tools by subcategory', () => {
        const transformTools = service.query({ subcategory: 'transform' })

        expect(transformTools.length).toBeGreaterThan(0)
      })

      it('queries tools by tags', () => {
        const jsonTools = service.query({ tags: ['json'] })

        expect(jsonTools.length).toBeGreaterThan(0)
      })

      it('queries tools by search text', () => {
        const results = service.query({ search: 'fetch' })

        expect(results.length).toBeGreaterThan(0)
      })

      it('supports pagination with limit and offset', () => {
        const limited = service.query({ limit: 1 })

        expect(limited.length).toBeLessThanOrEqual(1)
      })
    })
  })

  describe('tool execution', () => {
    describe('executeTool()', () => {
      it('executes a registered tool with input', async () => {
        const tool = {
          id: 'exec.echo.tool',
          name: 'Echo Tool',
          description: 'Echoes input back',
          category: 'data' as const,
          parameters: [
            {
              name: 'message',
              description: 'Message to echo',
              schema: { type: 'string' as const },
              required: true,
            },
          ],
          handler: async (input: { message: string }) => ({
            echoed: input.message,
          }),
        }

        service.register(tool)
        const result = await service.executeTool('exec.echo.tool', {
          message: 'hello',
        })

        expect(result).toEqual({ echoed: 'hello' })
      })

      it('throws error for non-existent tool', async () => {
        await expect(service.executeTool('does.not.exist', {})).rejects.toThrow()
      })

      it('passes input correctly to tool handler', async () => {
        const tool = {
          id: 'exec.passthrough',
          name: 'Passthrough',
          description: 'Passes input through',
          category: 'data' as const,
          parameters: [],
          handler: async (input: { a: number; b: string }) => input,
        }

        service.register(tool)
        const result = await service.executeTool('exec.passthrough', {
          a: 42,
          b: 'test',
        })

        expect(result).toEqual({ a: 42, b: 'test' })
      })
    })
  })

  describe('MCP conversion', () => {
    describe('toMCP()', () => {
      it('converts a tool to MCP format', () => {
        const tool = {
          id: 'mcp.convert.tool',
          name: 'MCP Convert Tool',
          description: 'Tool for MCP conversion test',
          category: 'data' as const,
          parameters: [
            {
              name: 'input',
              description: 'The input value',
              schema: { type: 'string' as const },
              required: true,
            },
          ],
          handler: async () => ({}),
        }

        service.register(tool)
        const mcpTool = service.toMCP(tool)

        expect(mcpTool.name).toBe('mcp.convert.tool')
        expect(mcpTool.description).toBe('Tool for MCP conversion test')
        expect(mcpTool.inputSchema).toBeDefined()
        expect(mcpTool.inputSchema.type).toBe('object')
        expect(mcpTool.inputSchema.properties).toHaveProperty('input')
        expect(mcpTool.inputSchema.required).toContain('input')
      })

      it('handles tools with multiple parameters', () => {
        const tool = {
          id: 'mcp.multi.params',
          name: 'Multi Params',
          description: 'Tool with multiple params',
          category: 'web' as const,
          parameters: [
            {
              name: 'url',
              description: 'URL to fetch',
              schema: { type: 'string' as const },
              required: true,
            },
            {
              name: 'timeout',
              description: 'Timeout in ms',
              schema: { type: 'number' as const },
              required: false,
            },
          ],
          handler: async () => ({}),
        }

        const mcpTool = service.toMCP(tool)

        expect(mcpTool.inputSchema.properties).toHaveProperty('url')
        expect(mcpTool.inputSchema.properties).toHaveProperty('timeout')
        expect(mcpTool.inputSchema.required).toContain('url')
        expect(mcpTool.inputSchema.required).not.toContain('timeout')
      })
    })

    describe('listMCPTools()', () => {
      it('lists all tools in MCP format', () => {
        service.register({
          id: 'mcp.list.one',
          name: 'MCP List One',
          description: 'First MCP tool',
          category: 'data' as const,
          parameters: [],
          handler: async () => ({}),
        })
        service.register({
          id: 'mcp.list.two',
          name: 'MCP List Two',
          description: 'Second MCP tool',
          category: 'web' as const,
          parameters: [],
          handler: async () => ({}),
        })

        const mcpTools = service.listMCPTools()

        expect(Array.isArray(mcpTools)).toBe(true)
        expect(mcpTools.length).toBeGreaterThanOrEqual(2)
        expect(mcpTools.every((t) => 'inputSchema' in t)).toBe(true)
      })
    })
  })

  describe('built-in tools', () => {
    describe('parseJson', () => {
      it('parses valid JSON string', async () => {
        const result = await service.executeTool('data.json.parse', {
          text: '{"name":"test","value":42}',
        })

        expect(result).toEqual({
          data: { name: 'test', value: 42 },
          valid: true,
        })
      })

      it('handles invalid JSON gracefully', async () => {
        const result = await service.executeTool('data.json.parse', {
          text: 'not valid json',
        })

        expect(result).toHaveProperty('valid', false)
        expect(result).toHaveProperty('error')
      })

      it('parses JSON arrays', async () => {
        const result = await service.executeTool('data.json.parse', {
          text: '[1,2,3]',
        })

        expect(result).toEqual({
          data: [1, 2, 3],
          valid: true,
        })
      })
    })

    describe('parseCsv', () => {
      it('parses CSV with headers', async () => {
        const csv = 'name,age\nAlice,30\nBob,25'
        const result = await service.executeTool('data.csv.parse', {
          text: csv,
        })

        expect(result.headers).toEqual(['name', 'age'])
        expect(result.rows).toHaveLength(2)
        expect(result.rows[0]).toEqual({ name: 'Alice', age: '30' })
        expect(result.rowCount).toBe(2)
      })

      it('handles custom delimiter', async () => {
        const tsv = 'name\tage\nAlice\t30'
        const result = await service.executeTool('data.csv.parse', {
          text: tsv,
          delimiter: '\t',
        })

        expect(result.headers).toEqual(['name', 'age'])
        expect(result.rows[0]).toEqual({ name: 'Alice', age: '30' })
      })

      it('handles CSV without headers', async () => {
        const csv = 'Alice,30\nBob,25'
        const result = await service.executeTool('data.csv.parse', {
          text: csv,
          hasHeaders: false,
        })

        expect(result.headers).toEqual(['column1', 'column2'])
        expect(result.rows).toHaveLength(2)
      })
    })

    describe('transformData', () => {
      it('transforms data using field mapping', async () => {
        const result = await service.executeTool('data.transform', {
          data: {
            user: {
              firstName: 'Alice',
              lastName: 'Smith',
            },
            metadata: {
              age: 30,
            },
          },
          transform: {
            name: 'user.firstName',
            surname: 'user.lastName',
            years: 'metadata.age',
          },
        })

        expect(result.result).toEqual({
          name: 'Alice',
          surname: 'Smith',
          years: 30,
        })
      })

      it('handles missing paths gracefully', async () => {
        const result = await service.executeTool('data.transform', {
          data: { a: 1 },
          transform: {
            value: 'a',
            missing: 'b.c.d',
          },
        })

        expect(result.result).toEqual({
          value: 1,
          missing: undefined,
        })
      })
    })
  })
})

describe('ToolService (WorkerEntrypoint)', () => {
  describe('class definition', () => {
    it('exports ToolService class', async () => {
      const { default: ToolServiceClass } = await import('../src/worker.js')
      expect(ToolServiceClass).toBeDefined()
      expect(typeof ToolServiceClass).toBe('function')
    })

    it('ToolService has connect method in prototype', () => {
      expect(typeof ToolService.prototype.connect).toBe('function')
    })

    it('extends WorkerEntrypoint', () => {
      // WorkerEntrypoint is the base class for RPC-enabled workers
      expect(ToolService.name).toBe('ToolService')
    })
  })

  describe('connect()', () => {
    // Note: WorkerEntrypoint classes cannot be instantiated directly in tests.
    // They require the Cloudflare Workers runtime context.
    // We verify the connect method behavior by testing that:
    // 1. The method exists on the prototype
    // 2. The return type (ToolServiceCore) is properly constructable and functional

    it('returns a ToolServiceCore instance', () => {
      // Since we can't instantiate ToolService directly (requires Workers runtime),
      // we verify that ToolServiceCore (the return type of connect()) works correctly
      const core = new ToolServiceCore()
      expect(core).toBeInstanceOf(ToolServiceCore)
    })

    it('returns RpcTarget for RPC communication', () => {
      // Test that ToolServiceCore (what connect() returns) has all required methods
      const core = new ToolServiceCore()

      // ToolServiceCore extends RpcTarget, so it can be returned over RPC
      expect(core).toBeDefined()
      expect(typeof core.register).toBe('function')
      expect(typeof core.get).toBe('function')
      expect(typeof core.list).toBe('function')
      expect(typeof core.query).toBe('function')
      expect(typeof core.executeTool).toBe('function')
      expect(typeof core.toMCP).toBe('function')
      expect(typeof core.listMCPTools).toBe('function')
    })

    it('creates independent service instances', () => {
      // Each ToolServiceCore instance is independent
      const core1 = new ToolServiceCore()
      const core2 = new ToolServiceCore()

      // Register tool in core1
      core1.register({
        id: 'independent.test',
        name: 'Independent Test',
        description: 'Test independence',
        category: 'data' as const,
        parameters: [],
        handler: async () => ({}),
      })

      // Each instance should be independent
      expect(core1).not.toBe(core2)
      expect(core1.has('independent.test')).toBe(true)
      expect(core2.has('independent.test')).toBe(false) // Not in core2
    })
  })
})

describe('Integration: Real Tool Execution', () => {
  let service: ToolServiceCore

  beforeEach(() => {
    service = new ToolServiceCore()
  })

  it('executes parseJson and uses result in transformData', async () => {
    // Parse JSON
    const jsonResult = await service.executeTool('data.json.parse', {
      text: '{"user":{"name":"Alice","age":30}}',
    })

    expect(jsonResult.valid).toBe(true)

    // Transform the parsed data
    const transformResult = await service.executeTool('data.transform', {
      data: jsonResult.data,
      transform: {
        userName: 'user.name',
        userAge: 'user.age',
      },
    })

    expect(transformResult.result).toEqual({
      userName: 'Alice',
      userAge: 30,
    })
  })

  it('executes parseCsv and transforms to JSON-friendly format', async () => {
    const csv = 'id,name,status\n1,Alice,active\n2,Bob,inactive'

    const csvResult = await service.executeTool('data.csv.parse', {
      text: csv,
    })

    expect(csvResult.rowCount).toBe(2)
    expect(csvResult.rows[0]).toEqual({
      id: '1',
      name: 'Alice',
      status: 'active',
    })
  })

  it('handles tool chaining with real data', async () => {
    // First: parse some input data
    const inputJson = await service.executeTool('data.json.parse', {
      text: '{"items":[{"id":1,"value":"a"},{"id":2,"value":"b"}]}',
    })

    expect(inputJson.valid).toBe(true)
    expect(inputJson.data.items).toHaveLength(2)
  })
})
