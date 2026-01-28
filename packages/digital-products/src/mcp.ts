/**
 * MCP() - Define a Model Context Protocol server
 */

import type { MCPDefinition, MCPTool, MCPResource, MCPPrompt, MCPConfig } from './types.js'
import type { SimpleSchema } from 'ai-functions'
import { registerProduct } from './product.js'

/**
 * Create an MCP server definition
 *
 * @example
 * ```ts
 * const mcpServer = MCP({
 *   id: 'my-mcp',
 *   name: 'My MCP Server',
 *   description: 'Custom MCP server for AI tools',
 *   version: '1.0.0',
 *   transport: 'stdio',
 *   tools: [
 *     Tool('searchFiles', 'Search for files in the project', {
 *       query: 'Search query',
 *       path: 'Directory to search in',
 *     }),
 *     Tool('readFile', 'Read file contents', {
 *       path: 'File path to read',
 *     }),
 *   ],
 *   resources: [
 *     Resource('file://', 'Project Files', 'Access to project files'),
 *   ],
 *   prompts: [
 *     Prompt('codeReview', 'Review code for best practices',
 *       'Review the following code:\n\n{{code}}'),
 *   ],
 * })
 * ```
 */
export function MCP(config: Omit<MCPDefinition, 'type'>): MCPDefinition {
  const mcp: MCPDefinition = {
    type: 'mcp',
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    transport: config.transport,
    status: config.status || 'active',
    ...(config.tools !== undefined && { tools: config.tools }),
    ...(config.resources !== undefined && { resources: config.resources }),
    ...(config.prompts !== undefined && { prompts: config.prompts }),
    ...(config.config !== undefined && { config: config.config }),
    ...(config.metadata !== undefined && { metadata: config.metadata }),
    ...(config.tags !== undefined && { tags: config.tags }),
  }

  return registerProduct(mcp)
}

/**
 * Helper to create an MCP tool
 *
 * @example
 * ```ts
 * const tool = Tool(
 *   'searchCode',
 *   'Search code using regex',
 *   {
 *     pattern: 'Regex pattern to search for',
 *     path: 'Directory to search in',
 *   },
 *   async (input) => {
 *     // Tool implementation
 *     return { matches: [] }
 *   }
 * )
 * ```
 */
export function Tool(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  handler?: (input: unknown) => Promise<unknown>
): MCPTool {
  return {
    name,
    description,
    inputSchema: inputSchema as MCPTool['inputSchema'],
    ...(handler !== undefined && { handler }),
  }
}

/**
 * Helper to create an MCP resource
 *
 * @example
 * ```ts
 * const resource = Resource(
 *   'file://project',
 *   'Project Files',
 *   'Access to all project files',
 *   'application/json'
 * )
 * ```
 */
export function Resource(
  uri: string,
  name: string,
  description: string,
  mimeType?: string
): MCPResource {
  return {
    uri,
    name,
    description,
    ...(mimeType !== undefined && { mimeType }),
  }
}

/**
 * Helper to create an MCP prompt
 *
 * @example
 * ```ts
 * const prompt = Prompt(
 *   'summarize',
 *   'Summarize text',
 *   'Summarize the following:\n\n{{text}}',
 *   { text: 'Text to summarize' }
 * )
 * ```
 */
export function Prompt(
  name: string,
  description: string,
  template: string,
  args?: SimpleSchema
): MCPPrompt {
  if (args !== undefined) {
    return {
      name,
      description,
      template,
      arguments: args as Record<string, unknown>,
    }
  }
  return {
    name,
    description,
    template,
  }
}

/**
 * Helper to configure MCP server
 *
 * @example
 * ```ts
 * const config = MCPConfig({
 *   port: 3000,
 *   host: 'localhost',
 *   auth: {
 *     type: 'bearer',
 *     token: process.env.MCP_TOKEN,
 *   },
 * })
 * ```
 */
export function MCPConfig(config: MCPConfig): MCPConfig {
  return config
}
