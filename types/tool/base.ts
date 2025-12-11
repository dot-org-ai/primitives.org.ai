/**
 * Tool Base Types
 *
 * Base types and abstractions for tool integrations.
 * Tools are capabilities that agents and humans can use
 * to interact with external systems.
 *
 * @module tool/base
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
} from '@/core/rpc'

// =============================================================================
// Tool - Base Interface
// =============================================================================

/**
 * Tool type.
 */
export type ToolType = 'function' | 'api' | 'integration' | 'utility' | 'workflow'

/**
 * Tool status.
 */
export type ToolStatus = 'available' | 'unavailable' | 'degraded' | 'maintenance'

/**
 * Capability that agents and humans can use.
 *
 * Tools provide a standardized interface for interacting
 * with external systems, APIs, and services.
 *
 * @example
 * ```ts
 * const slackTool: Tool = {
 *   id: 'tool_slack',
 *   name: 'Slack',
 *   type: 'integration',
 *   status: 'available',
 *   description: 'Send and receive messages via Slack',
 *   provider: '@tools.org.ai/slack',
 *   actions: ['sendMessage', 'createChannel', 'inviteUser'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Tool {
  /** Unique identifier */
  id: string

  /** Tool name */
  name: string

  /** Tool type */
  type: ToolType

  /** Current status */
  status: ToolStatus

  /** Human-readable description */
  description?: string

  /** Provider package name */
  provider?: string

  /** Available actions */
  actions?: string[]

  /** Required scopes/permissions */
  scopes?: string[]

  /** Configuration schema */
  configSchema?: Record<string, unknown>

  /** Rate limits */
  rateLimits?: {
    requests?: number
    window?: string
  }

  /** Icon URL */
  iconUrl?: string

  /** Documentation URL */
  docsUrl?: string

  /** Version */
  version?: string

  /** Owner business ID */
  businessId?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ToolInput = Input<Tool>
export type ToolOutput = Output<Tool>

// =============================================================================
// Tool Connection
// =============================================================================

/**
 * Connection status.
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'expired'

/**
 * A user's connection to a tool (OAuth, API key, etc.).
 */
export interface ToolConnection {
  /** Unique identifier */
  id: string

  /** Tool ID */
  toolId: string

  /** User/business ID */
  ownerId: string

  /** Connection status */
  status: ConnectionStatus

  /** Connection name/label */
  name?: string

  /** Authentication type */
  authType: 'oauth2' | 'api_key' | 'basic' | 'token' | 'custom'

  /** Granted scopes */
  scopes?: string[]

  /** Token expiration */
  expiresAt?: Date

  /** Last used */
  lastUsedAt?: Date

  /** Error message (if status is error) */
  error?: string

  /** Custom configuration */
  config?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ToolConnectionInput = Input<ToolConnection>
export type ToolConnectionOutput = Output<ToolConnection>

// =============================================================================
// Tool Actions
// =============================================================================

export interface ToolActions extends CRUDResource<Tool, ToolInput> {
  /** Check tool availability */
  check: Action<{ id: string }, { available: boolean; latency?: number }>

  /** Get tool configuration */
  getConfig: Action<{ id: string }, Record<string, unknown>>

  /** Update tool configuration */
  updateConfig: Action<{ id: string; config: Record<string, unknown> }, Tool>

  /** Get available actions */
  getActions: Action<{ id: string }, ToolActionDefinition[]>

  /** Execute a tool action */
  execute: Action<{ id: string; action: string; input: unknown }, unknown>
}

export interface ToolConnectionActions extends CRUDResource<ToolConnection, ToolConnectionInput> {
  /** Connect to a tool (start OAuth flow, etc.) */
  connect: Action<{ toolId: string; config?: Record<string, unknown> }, { authUrl?: string; connection?: ToolConnection }>

  /** Disconnect from a tool */
  disconnect: Action<{ id: string }, void>

  /** Refresh token */
  refresh: Action<{ id: string }, ToolConnection>

  /** Test connection */
  test: Action<{ id: string }, { connected: boolean; error?: string }>
}

// =============================================================================
// Supporting Types
// =============================================================================

/**
 * Tool action definition.
 */
export interface ToolActionDefinition {
  name: string
  description?: string
  input?: Record<string, unknown>
  output?: Record<string, unknown>
  examples?: Array<{ input: unknown; output: unknown }>
}

// =============================================================================
// Events
// =============================================================================

export interface ToolEvents {
  created: BaseEvent<'tool.created', Tool>
  updated: BaseEvent<'tool.updated', Tool>
  deleted: BaseEvent<'tool.deleted', { id: string }>
  status_changed: BaseEvent<'tool.status_changed', { toolId: string; oldStatus: ToolStatus; newStatus: ToolStatus }>
  executed: BaseEvent<'tool.executed', { toolId: string; action: string; input: unknown; output: unknown; duration: number }>
  error: BaseEvent<'tool.error', { toolId: string; action: string; error: string }>
}

export interface ToolConnectionEvents {
  created: BaseEvent<'tool_connection.created', ToolConnection>
  updated: BaseEvent<'tool_connection.updated', ToolConnection>
  deleted: BaseEvent<'tool_connection.deleted', { id: string }>
  connected: BaseEvent<'tool_connection.connected', ToolConnection>
  disconnected: BaseEvent<'tool_connection.disconnected', { id: string }>
  refreshed: BaseEvent<'tool_connection.refreshed', ToolConnection>
  expired: BaseEvent<'tool_connection.expired', { id: string }>
  error: BaseEvent<'tool_connection.error', { id: string; error: string }>
}

// =============================================================================
// Resources
// =============================================================================

export interface ToolResource extends ToolActions {
  on: <K extends keyof ToolEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ToolEvents[K], TProxy>
  ) => () => void
}

export interface ToolConnectionResource extends ToolConnectionActions {
  on: <K extends keyof ToolConnectionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ToolConnectionEvents[K], TProxy>
  ) => () => void
}
