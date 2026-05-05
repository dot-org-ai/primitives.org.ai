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
import type { Frame, ActionRef } from 'digital-objects'
import type { Identity, PaymentReceipt } from 'id.org.ai'
import type { z } from 'zod'

// Re-export for downstream consumers (digital-tasks/digital-workers can use the same Frame)
export type { Frame, ActionRef } from 'digital-objects'

// Re-export id.org.ai canonical types so consumers don't need a separate import.
// `wrapTool()` populates these on `ToolHandlerContext` after broker gating.
export type { Identity, PaymentReceipt } from 'id.org.ai'

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
  | 'channel' // Brand-agnostic team messaging (Slack/Teams/Discord)
  | 'workspace' // Team messaging workspace/organization
  | 'direct-message' // Private/DM conversations
  | 'chat' // Generic chat
  | 'notification'
  | 'voice'
  | 'video-call'
  // Legacy brand-specific (for backward compatibility)
  | 'slack'
  | 'discord'
  | 'teams'

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
// SVO Co-Design Types (aip-oejp): verb / frame / auth / pricing / handler ctx
// ============================================================================

/**
 * Reference to an Identity in `id.org.ai`.
 *
 * Currently a string ID; the canonical type will move to `id.org.ai`
 * once that package is published. Until then, treat as opaque.
 */
export type IdentityRef = string

/**
 * Payment rail used to satisfy a tool's `pricing` requirement.
 *
 * Minimal local definition — the canonical type will come from
 * `id.org.ai` (PaymentBroker) once that package is published.
 */
export interface PaymentRail {
  /** Rail used to settle the payment */
  rail: 'x402' | 'mpp'
  /** Optional receipt / proof of payment from the broker */
  receipt?: string
}

/**
 * Authentication requirement for invoking a tool.
 *
 * Declares which auth scheme and scopes the caller must present
 * before the handler is executed.
 */
export interface AuthRequirement {
  /** OAuth scopes / API key scopes required */
  scopes: string[]
  /** Auth mechanism the tool requires; `none` means public */
  required: 'oauth' | 'apiKey' | 'none'
}

/**
 * Payment requirement attached to a tool, MDXLD-shaped and
 * compatible with x402 / MPP payment rails.
 *
 * When present, callers must satisfy this before the handler runs;
 * the broker (id.org.ai) negotiates an acceptable rail and injects
 * a `PaymentRail` into the handler context.
 */
export interface PaymentRequired {
  /** MDXLD type discriminator */
  $type: 'PaymentRequired'
  /** Amount as a string (preserves precision for crypto/fiat) */
  amount: string
  /** ISO 4217 currency code or asset symbol (e.g. 'USD', 'USDC') */
  currency: string
  /** Payment rails this tool will accept */
  accepts: ('x402' | 'mpp')[]
  /** Wallet address or stripeAccountId of the recipient */
  recipient: string
  /** Optional facilitator URL/identifier */
  facilitator?: string
}

/**
 * Context object passed to a tool handler when invoked through
 * an SVO-aware dispatcher.
 *
 * This is distinct from the registry-level `ToolContext` (executor
 * metadata for tracing/audit) — `ToolHandlerContext` carries
 * runtime resources the handler needs to perform the action:
 * the caller's identity, an injected payment rail (if `pricing`
 * was satisfied), and the parent Action that caused the call.
 *
 * Handlers that don't need any of this can keep the arity-1
 * `(args) => result` signature; arity-2 `(args, ctx) => result`
 * is opt-in.
 *
 * `wrapTool()` (the broker-aware HTTP wrapper) populates `identity`
 * with a full id.org.ai `Identity` record and, when `pricing` is
 * satisfied, populates `paymentReceipt` with the canonical receipt
 * from `PaymentBroker.settle()`. Older dispatchers that pass an
 * opaque `IdentityRef` string and/or the local `PaymentRail` shape
 * remain supported (the handler signature widens, not narrows).
 */
export interface ToolHandlerContext {
  /**
   * Identity of the caller. Either:
   *   - the canonical {@link Identity} record from `id.org.ai`
   *     (populated by `wrapTool()` after `AuthBroker.gate()`), or
   *   - an opaque {@link IdentityRef} string for legacy dispatchers.
   */
  identity: Identity | IdentityRef
  /**
   * Backwards-compatible local `PaymentRail` shape. Older dispatchers
   * may set this; new code should prefer {@link paymentReceipt} which
   * carries the full id.org.ai receipt (txRef, settledAt, response
   * header, …).
   */
  payment?: PaymentRail
  /**
   * Canonical {@link PaymentReceipt} from `PaymentBroker.settle()`.
   * Populated by `wrapTool()` when the tool's `pricing` is satisfied.
   */
  paymentReceipt?: PaymentReceipt
  /** Parent Action that caused this tool invocation, if any */
  parentAction?: ActionRef
}

// ============================================================================
// Core Tool Interface
// ============================================================================

/**
 * Core Tool definition - the foundational type for digital tools.
 *
 * Tools can be used by both humans and AI agents. They provide a standardized
 * interface for performing actions across various categories including
 * communication, data, development, documents, finance, and more.
 *
 * @typeParam TInput - The type of input the tool handler accepts
 * @typeParam TOutput - The type of output the tool handler returns
 *
 * @example Basic tool definition
 * ```typescript
 * import { Tool, defineTool } from 'digital-tools'
 *
 * const greetTool: Tool<{ name: string }, string> = {
 *   id: 'communication.greeting.hello',
 *   name: 'Greet User',
 *   description: 'Generates a greeting message for the specified user',
 *   category: 'communication',
 *   parameters: [{
 *     name: 'name',
 *     description: 'Name of the person to greet',
 *     schema: { type: 'string' },
 *     required: true,
 *   }],
 *   handler: ({ name }) => `Hello, ${name}!`,
 * }
 * ```
 *
 * @example Using defineTool helper with Zod schema
 * ```typescript
 * import { defineTool } from 'digital-tools'
 * import { z } from 'zod'
 *
 * const fetchTool = defineTool({
 *   id: 'web.fetch.url',
 *   name: 'Fetch URL',
 *   description: 'Fetches content from a URL',
 *   category: 'web',
 *   input: z.object({ url: z.string().url() }),
 *   handler: async ({ url }) => {
 *     const response = await fetch(url)
 *     return response.text()
 *   },
 * })
 * ```
 *
 * @see {@link ToolCategory} for available categories
 * @see {@link ToolRegistry} for tool registration and discovery
 * @see {@link defineTool} for the recommended way to create tools
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

  // SVO Co-Design (aip-oejp) — all optional, additive over existing tools
  /**
   * Canonical Verb name this tool implements (e.g. 'send', 'transcribe').
   *
   * Used by SVO-aware dispatchers to resolve a Verb in `digital-objects`
   * and pick a Tool registered for it. Cross-package Verb auto-registration
   * is intentionally NOT performed here — see follow-up bead.
   */
  verb?: string

  /**
   * Frame declaring the complement-role types this tool accepts.
   *
   * Reuses the canonical {@link Frame} type from `digital-objects` so
   * Tool frames and Verb frames stay in lockstep. When absent, the tool
   * is treated as permissive (frame inferred from input shape).
   */
  frame?: Frame

  /** Auth requirement gate; absent means no auth required */
  auth?: AuthRequirement

  /** Pricing requirement (x402/MPP); absent means free */
  pricing?: PaymentRequired

  // Input/Output
  /** Input parameters */
  parameters: ToolParameter[]

  /** Output definition */
  output?: ToolOutput

  /**
   * The tool implementation.
   *
   * Backward-compatible: handlers may take just `(input)` (arity-1) or
   * opt into the SVO handler context with `(input, ctx)` (arity-2).
   * Dispatchers that don't have a {@link ToolHandlerContext} should
   * call the handler with the input only — TypeScript permits this
   * because the second parameter is optional.
   */
  handler: (input: TInput, ctx?: ToolHandlerContext) => TOutput | Promise<TOutput>

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
 * Any tool type - used for arrays and collections of tools with different
 * input/output types.
 *
 * Use this type when you need to work with heterogeneous collections of tools,
 * such as in registries, tool lists, or when the specific input/output types
 * are not known at compile time.
 *
 * @example Tool collection
 * ```typescript
 * import { AnyTool } from 'digital-tools'
 *
 * const tools: AnyTool[] = [emailTool, slackTool, fetchTool]
 * tools.forEach(tool => console.log(tool.name))
 * ```
 *
 * @see {@link Tool} for the base tool type with specific type parameters
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

  // SVO Co-Design (aip-oejp) — all optional, additive
  /** Canonical Verb name this tool implements */
  verb?: string
  /** Frame from `digital-objects` declaring complement-role types */
  frame?: Frame
  /** Auth requirement; absent means no auth required */
  auth?: AuthRequirement
  /** Pricing requirement (x402/MPP); absent means free */
  pricing?: PaymentRequired

  /**
   * The handler function.
   *
   * Backward-compatible: arity-1 `(input)` handlers continue to work;
   * arity-2 `(input, ctx)` handlers receive the SVO {@link ToolHandlerContext}.
   */
  handler: (input: TInput, ctx?: ToolHandlerContext) => TOutput | Promise<TOutput>
  /** Additional options */
  options?: Partial<
    Omit<
      Tool<TInput, TOutput>,
      'id' | 'name' | 'description' | 'category' | 'parameters' | 'handler'
    >
  >
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
