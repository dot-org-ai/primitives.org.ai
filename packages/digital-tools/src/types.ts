/**
 * Types for digital-tools
 *
 * Core types for tools that can be used by both humans and AI agents.
 * This package provides the foundational tool primitives used across
 * autonomous-agents, human-in-the-loop, and services-as-software.
 *
 * @packageDocumentation
 */

import type { JSONSchema } from 'ai-functions'
import type { z } from 'zod'

// ============================================================================
// Tool Category Ontology
// ============================================================================

/**
 * High-level tool categories - the primary classification
 */
export type ToolCategory =
  | 'communication' // Email, messaging, notifications
  | 'data' // Database, storage, data manipulation
  | 'development' // Code, git, CI/CD, deployment
  | 'documents' // File creation, editing, conversion
  | 'finance' // Payments, invoicing, accounting
  | 'integration' // External APIs, webhooks
  | 'knowledge' // Search, retrieval, RAG
  | 'media' // Image, video, audio processing
  | 'productivity' // Calendar, tasks, notes
  | 'security' // Auth, encryption, access control
  | 'system' // Shell, filesystem, processes
  | 'web' // HTTP, scraping, browser automation

/**
 * Communication subcategories
 */
export type CommunicationSubcategory =
  | 'email'
  | 'sms'
  | 'slack'
  | 'discord'
  | 'teams'
  | 'chat'
  | 'notification'
  | 'voice'
  | 'video-call'

/**
 * Data subcategories
 */
export type DataSubcategory =
  | 'database'
  | 'cache'
  | 'queue'
  | 'stream'
  | 'vector-store'
  | 'object-storage'
  | 'transform'
  | 'validate'

/**
 * Development subcategories
 */
export type DevelopmentSubcategory =
  | 'code-edit'
  | 'code-execute'
  | 'git'
  | 'ci-cd'
  | 'deploy'
  | 'test'
  | 'debug'
  | 'lint'
  | 'format'
  | 'docs'

/**
 * Documents subcategories
 */
export type DocumentsSubcategory =
  | 'pdf'
  | 'spreadsheet'
  | 'presentation'
  | 'word-processor'
  | 'markdown'
  | 'diagram'
  | 'convert'

/**
 * Finance subcategories
 */
export type FinanceSubcategory =
  | 'payment'
  | 'invoice'
  | 'accounting'
  | 'expense'
  | 'payroll'
  | 'tax'
  | 'subscription'

/**
 * Integration subcategories
 */
export type IntegrationSubcategory =
  | 'api'
  | 'webhook'
  | 'oauth'
  | 'graphql'
  | 'grpc'
  | 'soap'
  | 'rpc'

/**
 * Knowledge subcategories
 */
export type KnowledgeSubcategory =
  | 'search'
  | 'rag'
  | 'embedding'
  | 'knowledge-graph'
  | 'wiki'
  | 'faq'
  | 'semantic-search'

/**
 * Media subcategories
 */
export type MediaSubcategory =
  | 'image-generate'
  | 'image-edit'
  | 'video-generate'
  | 'video-edit'
  | 'audio-generate'
  | 'audio-transcribe'
  | 'ocr'
  | 'screenshot'

/**
 * Productivity subcategories
 */
export type ProductivitySubcategory =
  | 'calendar'
  | 'task'
  | 'note'
  | 'reminder'
  | 'time-tracking'
  | 'project-management'
  | 'crm'

/**
 * Security subcategories
 */
export type SecuritySubcategory =
  | 'auth'
  | 'encrypt'
  | 'hash'
  | 'sign'
  | 'access-control'
  | 'secrets'
  | 'audit'

/**
 * System subcategories
 */
export type SystemSubcategory =
  | 'shell'
  | 'filesystem'
  | 'process'
  | 'network'
  | 'environment'
  | 'cron'
  | 'monitor'

/**
 * Web subcategories
 */
export type WebSubcategory =
  | 'fetch'
  | 'scrape'
  | 'browser'
  | 'dom'
  | 'screenshot'
  | 'pdf-capture'
  | 'api-client'

/**
 * Combined subcategory type
 */
export type ToolSubcategory =
  | CommunicationSubcategory
  | DataSubcategory
  | DevelopmentSubcategory
  | DocumentsSubcategory
  | FinanceSubcategory
  | IntegrationSubcategory
  | KnowledgeSubcategory
  | MediaSubcategory
  | ProductivitySubcategory
  | SecuritySubcategory
  | SystemSubcategory
  | WebSubcategory

// ============================================================================
// Tool Access & Permissions
// ============================================================================

/**
 * Who can use this tool
 */
export type ToolAudience = 'agent' | 'human' | 'both'

/**
 * Permission required to use this tool
 */
export interface ToolPermission {
  /** Permission type */
  type: 'read' | 'write' | 'execute' | 'admin' | 'custom'
  /** Resource the permission applies to */
  resource?: string
  /** Custom permission name */
  name?: string
  /** Permission scope */
  scope?: string
}

/**
 * Security classification for the tool
 */
export type SecurityLevel = 'public' | 'internal' | 'confidential' | 'restricted'

/**
 * Rate limiting configuration
 */
export interface RateLimit {
  /** Maximum calls per period */
  maxCalls: number
  /** Time period in seconds */
  periodSeconds: number
  /** Per-user or global */
  scope?: 'user' | 'global' | 'organization'
}

// ============================================================================
// Tool Input/Output Types
// ============================================================================

/**
 * Schema definition - supports both JSON Schema and Zod
 */
export type Schema = JSONSchema | z.ZodType

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  /** Parameter name */
  name: string
  /** Human-readable description */
  description: string
  /** Parameter type schema */
  schema: Schema
  /** Whether parameter is required */
  required?: boolean
  /** Default value */
  default?: unknown
  /** Example values */
  examples?: unknown[]
}

/**
 * Tool output definition
 */
export interface ToolOutput {
  /** Output description */
  description: string
  /** Output schema */
  schema: Schema
  /** Whether the tool streams output */
  streaming?: boolean
}

// ============================================================================
// Core Tool Interface
// ============================================================================

/**
 * Core Tool definition - the foundational type
 *
 * Tools can be used by both humans and AI agents. They provide
 * a standardized interface for performing actions.
 */
export interface Tool<TInput = unknown, TOutput = unknown> {
  /** Unique tool identifier (e.g., 'communication.email.send') */
  id: string

  /** Human-readable name */
  name: string

  /** Detailed description of what the tool does */
  description: string

  /** Tool version (semver) */
  version?: string

  // Classification
  /** Primary category */
  category: ToolCategory

  /** Subcategory for more specific classification */
  subcategory?: ToolSubcategory

  /** Tags for additional classification */
  tags?: string[]

  // Access Control
  /** Who can use this tool */
  audience?: ToolAudience

  /** Required permissions */
  permissions?: ToolPermission[]

  /** Security classification */
  securityLevel?: SecurityLevel

  /** Rate limiting */
  rateLimit?: RateLimit

  // Input/Output
  /** Input parameters */
  parameters: ToolParameter[]

  /** Output definition */
  output?: ToolOutput

  /** The tool implementation */
  handler: (input: TInput) => TOutput | Promise<TOutput>

  // Metadata
  /** Tool author/owner */
  author?: string

  /** Documentation URL */
  docsUrl?: string

  /** Whether this tool requires human confirmation */
  requiresConfirmation?: boolean

  /** Whether this tool is idempotent */
  idempotent?: boolean

  /** Estimated execution time in ms */
  estimatedDuration?: number

  /** Cost per execution (for billing) */
  costPerExecution?: number
}

/**
 * Any tool type - used for arrays and collections of tools
 * with different input/output types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any, any>

// ============================================================================
// Tool Builder Types
// ============================================================================

/**
 * Options for defining a tool
 */
export interface DefineToolOptions<TInput, TOutput> {
  /** Tool ID */
  id: string
  /** Tool name */
  name: string
  /** Tool description */
  description: string
  /** Primary category */
  category: ToolCategory
  /** Subcategory */
  subcategory?: ToolSubcategory
  /** Input schema (Zod or JSON Schema) */
  input: Schema
  /** Output schema (optional) */
  output?: Schema
  /** The handler function */
  handler: (input: TInput) => TOutput | Promise<TOutput>
  /** Additional options */
  options?: Partial<Omit<Tool<TInput, TOutput>, 'id' | 'name' | 'description' | 'category' | 'parameters' | 'handler'>>
}

/**
 * Tool execution context
 */
export interface ToolContext {
  /** Who is executing the tool */
  executor: {
    type: 'agent' | 'human'
    id: string
    name?: string
  }
  /** Request ID for tracing */
  requestId?: string
  /** Organization ID */
  organizationId?: string
  /** User ID (if human or on behalf of) */
  userId?: string
  /** Environment */
  environment?: 'development' | 'staging' | 'production'
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Tool execution result
 */
export interface ToolResult<TOutput = unknown> {
  /** Whether execution succeeded */
  success: boolean
  /** Output data */
  data?: TOutput
  /** Error if failed */
  error?: {
    code: string
    message: string
    details?: unknown
  }
  /** Execution metadata */
  metadata?: {
    /** Duration in ms */
    duration: number
    /** Tokens used (if AI tool) */
    tokensUsed?: number
    /** Cost incurred */
    cost?: number
    /** Request ID */
    requestId?: string
  }
}

// ============================================================================
// Tool Registry Types
// ============================================================================

/**
 * Options for querying tools
 */
export interface ToolQuery {
  /** Filter by category */
  category?: ToolCategory
  /** Filter by subcategory */
  subcategory?: ToolSubcategory
  /** Filter by tags */
  tags?: string[]
  /** Filter by audience */
  audience?: ToolAudience
  /** Text search */
  search?: string
  /** Maximum results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  /** Register a tool */
  register(tool: AnyTool): void

  /** Unregister a tool */
  unregister(id: string): boolean

  /** Get a tool by ID */
  get(id: string): AnyTool | undefined

  /** Check if a tool exists */
  has(id: string): boolean

  /** List all tool IDs */
  list(): string[]

  /** Query tools */
  query(options: ToolQuery): AnyTool[]

  /** Get tools by category */
  byCategory(category: ToolCategory): AnyTool[]

  /** Clear all tools */
  clear(): void
}

// ============================================================================
// MCP Compatibility Types
// ============================================================================

/**
 * MCP-compatible tool definition
 * Model Context Protocol standard format
 */
export interface MCPTool {
  /** Tool name */
  name: string
  /** Tool description */
  description: string
  /** Input schema as JSON Schema */
  inputSchema: JSONSchema
}

/**
 * MCP tool call request
 */
export interface MCPToolCall {
  /** Tool name */
  name: string
  /** Arguments */
  arguments: Record<string, unknown>
}

/**
 * MCP tool call result
 */
export interface MCPToolResult {
  /** Result content */
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  /** Whether this is an error */
  isError?: boolean
}
