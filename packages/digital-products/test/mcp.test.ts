/**
 * Tests for MCP functionality
 *
 * Covers MCP server creation and helper functions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MCP, Tool, Resource, Prompt, MCPConfig, registry } from '../src/index.js'

describe('MCP', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('MCP creation', () => {
    it('creates an MCP with basic config', () => {
      const mcp = MCP({
        id: 'my-mcp',
        name: 'My MCP Server',
        description: 'Custom MCP server',
        version: '1.0.0',
      })

      expect(mcp.id).toBe('my-mcp')
      expect(mcp.name).toBe('My MCP Server')
      expect(mcp.type).toBe('mcp')
    })

    it('creates an MCP with transport', () => {
      const mcp = MCP({
        id: 'stdio-mcp',
        name: 'Stdio MCP',
        description: 'MCP with stdio',
        version: '1.0.0',
        transport: 'stdio',
      })

      expect(mcp.transport).toBe('stdio')
    })

    it('creates an MCP with tools', () => {
      const mcp = MCP({
        id: 'tool-mcp',
        name: 'Tool MCP',
        description: 'MCP with tools',
        version: '1.0.0',
        tools: [
          Tool('searchFiles', 'Search for files', {
            query: 'Search query',
            path: 'Directory to search',
          }),
          Tool('readFile', 'Read file contents', {
            path: 'File path to read',
          }),
        ],
      })

      expect(mcp.tools).toHaveLength(2)
      expect(mcp.tools?.[0]?.name).toBe('searchFiles')
    })

    it('creates an MCP with resources', () => {
      const mcp = MCP({
        id: 'resource-mcp',
        name: 'Resource MCP',
        description: 'MCP with resources',
        version: '1.0.0',
        resources: [
          Resource('file://', 'Project Files', 'Access to project files'),
        ],
      })

      expect(mcp.resources).toHaveLength(1)
      expect(mcp.resources?.[0]?.uri).toBe('file://')
    })

    it('creates an MCP with prompts', () => {
      const mcp = MCP({
        id: 'prompt-mcp',
        name: 'Prompt MCP',
        description: 'MCP with prompts',
        version: '1.0.0',
        prompts: [
          Prompt('codeReview', 'Review code', 'Review the following code:\n\n{{code}}'),
        ],
      })

      expect(mcp.prompts).toHaveLength(1)
      expect(mcp.prompts?.[0]?.name).toBe('codeReview')
    })

    it('creates an MCP with config', () => {
      const mcp = MCP({
        id: 'config-mcp',
        name: 'Config MCP',
        description: 'MCP with config',
        version: '1.0.0',
        config: {
          port: 3000,
          host: 'localhost',
        },
      })

      expect(mcp.config?.port).toBe(3000)
    })

    it('registers MCP automatically', () => {
      MCP({
        id: 'auto-registered',
        name: 'Auto Registered',
        description: 'Automatically registered',
        version: '1.0.0',
      })

      expect(registry.get('auto-registered')).toBeDefined()
    })
  })

  describe('Tool helper', () => {
    it('creates a basic tool', () => {
      const tool = Tool('myTool', 'My tool description', {
        param1: 'First parameter',
        param2: 'Second parameter',
      })

      expect(tool.name).toBe('myTool')
      expect(tool.description).toBe('My tool description')
      expect(tool.inputSchema).toHaveProperty('param1')
    })

    it('creates a tool with handler', () => {
      const handler = async (input: unknown) => ({ result: 'done' })
      const tool = Tool('handlerTool', 'Tool with handler', {
        input: 'Input value',
      }, handler)

      expect(tool.handler).toBe(handler)
    })

    it('creates a tool with complex schema', () => {
      const tool = Tool('complexTool', 'Tool with complex schema', {
        query: 'Search query (required)',
        options: {
          limit: 'Maximum results (number)',
          offset: 'Result offset (number)',
        },
      })

      expect(tool.inputSchema?.query).toBe('Search query (required)')
      expect(tool.inputSchema?.options).toHaveProperty('limit')
    })
  })

  describe('Resource helper', () => {
    it('creates a basic resource', () => {
      const resource = Resource(
        'file://project',
        'Project Files',
        'Access to all project files'
      )

      expect(resource.uri).toBe('file://project')
      expect(resource.name).toBe('Project Files')
      expect(resource.description).toBe('Access to all project files')
    })

    it('creates a resource with mimeType', () => {
      const resource = Resource(
        'file://config.json',
        'Config',
        'Configuration file',
        'application/json'
      )

      expect(resource.mimeType).toBe('application/json')
    })
  })

  describe('Prompt helper', () => {
    it('creates a basic prompt', () => {
      const prompt = Prompt(
        'summarize',
        'Summarize text',
        'Summarize the following:\n\n{{text}}'
      )

      expect(prompt.name).toBe('summarize')
      expect(prompt.description).toBe('Summarize text')
      expect(prompt.template).toContain('{{text}}')
    })

    it('creates a prompt with arguments', () => {
      const prompt = Prompt(
        'translate',
        'Translate text',
        'Translate {{text}} to {{language}}',
        {
          text: 'Text to translate',
          language: 'Target language',
        }
      )

      expect(prompt.arguments).toHaveProperty('text')
      expect(prompt.arguments).toHaveProperty('language')
    })
  })

  describe('MCPConfig helper', () => {
    it('creates MCP config', () => {
      const config = MCPConfig({
        port: 3000,
        host: 'localhost',
      })

      expect(config.port).toBe(3000)
      expect(config.host).toBe('localhost')
    })

    it('creates MCP config with auth', () => {
      const config = MCPConfig({
        auth: {
          type: 'bearer',
          token: 'secret-token',
        },
      })

      expect(config.auth?.type).toBe('bearer')
    })
  })
})
