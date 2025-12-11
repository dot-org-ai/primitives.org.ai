/**
 * Application Types
 *
 * Types for applications and developer interfaces:
 * App, API, CLI, Dashboard, SDK.
 *
 * @module app
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
// Common Types
// =============================================================================

/**
 * Development lifecycle status.
 */
export type LifecycleStatus = 'development' | 'alpha' | 'beta' | 'stable' | 'deprecated' | 'sunset'

/**
 * Platform target.
 */
export type Platform = 'web' | 'ios' | 'android' | 'macos' | 'windows' | 'linux' | 'cross-platform'

// =============================================================================
// App - User Application
// =============================================================================

/**
 * Application type.
 */
export type AppType = 'web' | 'mobile' | 'desktop' | 'native' | 'hybrid' | 'pwa'

/**
 * Application that users interact with.
 *
 * Apps are the user-facing interfaces that provide
 * functionality through visual and interactive experiences.
 *
 * @example
 * ```ts
 * const crmApp: App = {
 *   id: 'app_crm',
 *   name: 'CRM Pro',
 *   type: 'web',
 *   status: 'stable',
 *   description: 'Customer relationship management application',
 *   url: 'https://crm.example.com',
 *   version: '2.5.0',
 *   platforms: ['web', 'ios', 'android'],
 *   features: ['contacts', 'deals', 'email', 'analytics'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface App {
  /** Unique identifier */
  id: string

  /** Application name */
  name: string

  /** Application type */
  type: AppType

  /** Lifecycle status */
  status: LifecycleStatus

  /** Human-readable description */
  description?: string

  /** Primary URL */
  url?: string

  /** Current version */
  version?: string

  /** Supported platforms */
  platforms?: Platform[]

  /** Feature list */
  features?: string[]

  /** Icon URL */
  iconUrl?: string

  /** Screenshots */
  screenshots?: string[]

  /** App store links */
  storeLinks?: {
    ios?: string
    android?: string
    web?: string
  }

  /** Authentication methods */
  auth?: {
    methods: Array<'email' | 'oauth' | 'sso' | 'api_key' | 'magic_link'>
    providers?: string[]
  }

  /** Related API ID */
  apiId?: string

  /** Product ID this app belongs to */
  productId?: string

  /** Owner/team ID */
  ownerId?: string

  /** Analytics configuration */
  analytics?: {
    enabled: boolean
    provider?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AppInput = Input<App>
export type AppOutput = Output<App>

// =============================================================================
// API - Programmatic Interface
// =============================================================================

/**
 * API type.
 */
export type APIType = 'rest' | 'graphql' | 'grpc' | 'websocket' | 'trpc' | 'rpc'

/**
 * API authentication method.
 */
export type APIAuthMethod = 'api_key' | 'bearer' | 'basic' | 'oauth2' | 'jwt' | 'none'

/**
 * Interface for programmatic access.
 *
 * APIs define the contract for machine-to-machine
 * communication, including endpoints, authentication,
 * and rate limiting.
 *
 * @example
 * ```ts
 * const crmAPI: API = {
 *   id: 'api_crm',
 *   name: 'CRM API',
 *   type: 'rest',
 *   status: 'stable',
 *   version: 'v2',
 *   baseUrl: 'https://api.crm.example.com/v2',
 *   auth: {
 *     methods: ['bearer', 'api_key'],
 *     scopes: ['read', 'write', 'admin']
 *   },
 *   rateLimit: {
 *     requests: 1000,
 *     window: '1h'
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface API {
  /** Unique identifier */
  id: string

  /** API name */
  name: string

  /** API type/protocol */
  type: APIType

  /** Lifecycle status */
  status: LifecycleStatus

  /** Human-readable description */
  description?: string

  /** Current version */
  version?: string

  /** Base URL */
  baseUrl?: string

  /** Documentation URL */
  docsUrl?: string

  /** OpenAPI/Swagger spec URL */
  specUrl?: string

  /** Authentication configuration */
  auth?: {
    methods: APIAuthMethod[]
    scopes?: string[]
    tokenUrl?: string
    authorizeUrl?: string
  }

  /** Rate limiting */
  rateLimit?: {
    requests: number
    window: string
    strategy?: 'sliding' | 'fixed'
  }

  /** CORS configuration */
  cors?: {
    origins: string[]
    methods?: string[]
    headers?: string[]
  }

  /** Endpoint categories */
  categories?: string[]

  /** Health check endpoint */
  healthEndpoint?: string

  /** Product ID */
  productId?: string

  /** Owner/team ID */
  ownerId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type APIInput = Input<API>
export type APIOutput = Output<API>

// =============================================================================
// CLI - Command Line Interface
// =============================================================================

/**
 * CLI installation method.
 */
export type CLIInstallMethod = 'npm' | 'brew' | 'curl' | 'binary' | 'docker'

/**
 * Command-line interface for developers.
 *
 * CLIs provide terminal-based access to functionality,
 * with commands, flags, and interactive prompts.
 *
 * @example
 * ```ts
 * const crmCLI: CLI = {
 *   id: 'cli_crm',
 *   name: 'crm',
 *   status: 'stable',
 *   description: 'CRM command-line interface',
 *   version: '1.2.0',
 *   packageName: '@crm/cli',
 *   installMethods: ['npm', 'brew'],
 *   commands: [
 *     { name: 'init', description: 'Initialize CRM configuration' },
 *     { name: 'contacts', description: 'Manage contacts' },
 *     { name: 'sync', description: 'Sync data' }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface CLI {
  /** Unique identifier */
  id: string

  /** CLI command name */
  name: string

  /** Lifecycle status */
  status: LifecycleStatus

  /** Human-readable description */
  description?: string

  /** Current version */
  version?: string

  /** npm/package name */
  packageName?: string

  /** Installation methods */
  installMethods?: CLIInstallMethod[]

  /** Binary name */
  binaryName?: string

  /** Available commands */
  commands?: Array<{
    name: string
    description?: string
    aliases?: string[]
    args?: Array<{
      name: string
      required?: boolean
      description?: string
    }>
    flags?: Array<{
      name: string
      short?: string
      description?: string
      type?: 'boolean' | 'string' | 'number'
      default?: unknown
    }>
  }>

  /** Global flags */
  globalFlags?: Array<{
    name: string
    short?: string
    description?: string
  }>

  /** Shell completions */
  completions?: Array<'bash' | 'zsh' | 'fish' | 'powershell'>

  /** Configuration file name */
  configFile?: string

  /** Related API ID */
  apiId?: string

  /** Product ID */
  productId?: string

  /** Owner/team ID */
  ownerId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CLIInput = Input<CLI>
export type CLIOutput = Output<CLI>

// =============================================================================
// Dashboard - Visual Interface
// =============================================================================

/**
 * Dashboard type.
 */
export type DashboardType = 'analytics' | 'operations' | 'admin' | 'monitoring' | 'custom'

/**
 * Widget type.
 */
export type WidgetType = 'chart' | 'metric' | 'table' | 'list' | 'map' | 'timeline' | 'custom'

/**
 * Dashboard widget definition.
 */
export interface DashboardWidget {
  id?: string
  type: WidgetType
  name: string
  chartType?: 'line' | 'bar' | 'pie' | 'funnel' | 'scatter' | 'area'
  dataSource?: string
  query?: string
  config?: Record<string, unknown>
  position?: { x: number; y: number; w: number; h: number }
}

/**
 * Visual interface for monitoring and control.
 *
 * Dashboards aggregate data into visualizations
 * for real-time monitoring and decision making.
 *
 * @example
 * ```ts
 * const salesDashboard: Dashboard = {
 *   id: 'dash_sales',
 *   name: 'Sales Dashboard',
 *   type: 'analytics',
 *   status: 'stable',
 *   description: 'Real-time sales metrics',
 *   widgets: [
 *     { type: 'metric', name: 'Revenue', dataSource: 'deals.sum(amount)' },
 *     { type: 'chart', name: 'Pipeline', chartType: 'funnel', dataSource: 'deals.byStage()' },
 *     { type: 'table', name: 'Recent Deals', dataSource: 'deals.recent(10)' }
 *   ],
 *   refreshInterval: 60000,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Dashboard {
  /** Unique identifier */
  id: string

  /** Dashboard name */
  name: string

  /** Dashboard type */
  type: DashboardType

  /** Lifecycle status */
  status: LifecycleStatus

  /** Human-readable description */
  description?: string

  /** Dashboard URL/path */
  url?: string

  /** Widgets/components */
  widgets?: DashboardWidget[]

  /** Available filters */
  filters?: Array<{
    name: string
    type: 'date_range' | 'select' | 'multi_select' | 'search'
    options?: string[]
    default?: unknown
  }>

  /** Auto-refresh interval (ms) */
  refreshInterval?: number

  /** Layout configuration */
  layout?: {
    columns?: number
    gap?: number
    responsive?: boolean
  }

  /** Access permissions */
  permissions?: {
    public?: boolean
    roles?: string[]
    users?: string[]
  }

  /** Owner/team ID */
  ownerId?: string

  /** Related app ID */
  appId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DashboardInput = Input<Dashboard>
export type DashboardOutput = Output<Dashboard>

// =============================================================================
// SDK - Software Development Kit
// =============================================================================

/**
 * Programming language.
 */
export type SDKLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'ruby' | 'csharp' | 'swift' | 'kotlin' | 'php'

/**
 * Developer kit for building integrations.
 *
 * SDKs provide language-specific libraries for
 * interacting with APIs and building applications.
 *
 * @example
 * ```ts
 * const crmSDK: SDK = {
 *   id: 'sdk_crm_ts',
 *   name: 'CRM TypeScript SDK',
 *   language: 'typescript',
 *   status: 'stable',
 *   version: '3.0.0',
 *   packageName: '@crm/sdk',
 *   repository: 'https://github.com/crm/sdk-typescript',
 *   features: ['type-safe', 'async', 'tree-shakeable'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SDK {
  /** Unique identifier */
  id: string

  /** SDK name */
  name: string

  /** Programming language */
  language: SDKLanguage

  /** Lifecycle status */
  status: LifecycleStatus

  /** Human-readable description */
  description?: string

  /** Current version */
  version?: string

  /** Package name (npm, pip, etc.) */
  packageName?: string

  /** Package registry */
  registry?: 'npm' | 'pypi' | 'crates' | 'maven' | 'nuget' | 'rubygems' | 'packagist'

  /** Source repository URL */
  repository?: string

  /** Documentation URL */
  docsUrl?: string

  /** API reference URL */
  apiReferenceUrl?: string

  /** Feature highlights */
  features?: string[]

  /** Supported API version */
  apiVersion?: string

  /** Runtime requirements */
  requirements?: {
    runtime?: string
    minVersion?: string
    dependencies?: string[]
  }

  /** Code examples */
  examples?: Array<{
    name: string
    description?: string
    code: string
    language?: string
  }>

  /** Related API ID */
  apiId?: string

  /** Product ID */
  productId?: string

  /** Owner/team ID */
  ownerId?: string

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SDKInput = Input<SDK>
export type SDKOutput = Output<SDK>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface AppActions extends CRUDResource<App, AppInput> {
  /** Deploy app to environment */
  deploy: Action<{ id: string; environment: string; version?: string }, { deploymentId: string; url?: string }>

  /** Publish app to store */
  publish: Action<{ id: string; store: 'ios' | 'android' | 'web' }, { published: boolean; url?: string }>

  /** Get app analytics */
  getAnalytics: Action<{ id: string; from?: Date; to?: Date }, AppAnalytics>

  /** Deprecate app */
  deprecate: Action<{ id: string; sunsetDate?: Date; message?: string }, App>
}

export interface APIActions extends CRUDResource<API, APIInput> {
  /** Create API key */
  createKey: Action<{ id: string; name: string; scopes?: string[]; expiresAt?: Date }, APIKey>

  /** Revoke API key */
  revokeKey: Action<{ id: string; keyId: string }, void>

  /** List API keys */
  listKeys: Action<{ id: string }, APIKey[]>

  /** Get API usage stats */
  getUsage: Action<{ id: string; from?: Date; to?: Date }, APIUsage>

  /** Deprecate API version */
  deprecate: Action<{ id: string; version: string; sunsetDate: Date }, API>
}

export interface CLIActions extends CRUDResource<CLI, CLIInput> {
  /** Publish CLI version */
  publish: Action<{ id: string; version: string; changelog?: string }, { published: boolean }>

  /** Generate completions */
  generateCompletions: Action<{ id: string; shell: string }, string>

  /** Get download stats */
  getDownloads: Action<{ id: string; from?: Date; to?: Date }, { total: number; byVersion: Record<string, number> }>
}

export interface DashboardActions extends CRUDResource<Dashboard, DashboardInput> {
  /** Clone dashboard */
  clone: Action<{ id: string; name: string }, Dashboard>

  /** Add widget */
  addWidget: Action<{ id: string; widget: DashboardWidget }, Dashboard>

  /** Remove widget */
  removeWidget: Action<{ id: string; widgetId: string }, Dashboard>

  /** Update widget */
  updateWidget: Action<{ id: string; widgetId: string; widget: Partial<DashboardWidget> }, Dashboard>

  /** Share dashboard */
  share: Action<{ id: string; userIds?: string[]; roles?: string[]; public?: boolean }, Dashboard>

  /** Export dashboard */
  export: Action<{ id: string; format: 'json' | 'pdf' | 'png' }, { url: string }>
}

export interface SDKActions extends CRUDResource<SDK, SDKInput> {
  /** Publish SDK version */
  publish: Action<{ id: string; version: string; changelog?: string }, { published: boolean; url?: string }>

  /** Generate SDK from API spec */
  generate: Action<{ apiId: string; language: SDKLanguage; options?: Record<string, unknown> }, SDK>

  /** Get download stats */
  getDownloads: Action<{ id: string; from?: Date; to?: Date }, { total: number; byVersion: Record<string, number> }>

  /** Deprecate SDK */
  deprecate: Action<{ id: string; message?: string }, SDK>
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface AppAnalytics {
  appId: string
  period: { from: Date; to: Date }
  users: {
    total: number
    active: number
    new: number
  }
  sessions: {
    total: number
    avgDuration: number
  }
  events: Record<string, number>
  platforms: Record<string, number>
}

export interface APIKey {
  id: string
  name: string
  key: string
  scopes: string[]
  createdAt: Date
  expiresAt?: Date
  lastUsedAt?: Date
}

export interface APIUsage {
  apiId: string
  period: { from: Date; to: Date }
  requests: {
    total: number
    successful: number
    failed: number
  }
  latency: {
    avg: number
    p50: number
    p95: number
    p99: number
  }
  byEndpoint: Record<string, { count: number; latency: number }>
  byStatusCode: Record<string, number>
}

// =============================================================================
// Events
// =============================================================================

export interface AppEvents {
  created: BaseEvent<'app.created', App>
  updated: BaseEvent<'app.updated', App>
  deleted: BaseEvent<'app.deleted', { id: string }>
  deployed: BaseEvent<'app.deployed', { appId: string; environment: string; version: string; url?: string }>
  published: BaseEvent<'app.published', { appId: string; store: string; url?: string }>
  deprecated: BaseEvent<'app.deprecated', { appId: string; sunsetDate?: Date }>
}

export interface APIEvents {
  created: BaseEvent<'api.created', API>
  updated: BaseEvent<'api.updated', API>
  deleted: BaseEvent<'api.deleted', { id: string }>
  key_created: BaseEvent<'api.key_created', { apiId: string; keyId: string; name: string }>
  key_revoked: BaseEvent<'api.key_revoked', { apiId: string; keyId: string }>
  rate_limited: BaseEvent<'api.rate_limited', { apiId: string; keyId?: string; requests: number }>
  deprecated: BaseEvent<'api.deprecated', { apiId: string; version: string; sunsetDate: Date }>
}

export interface CLIEvents {
  created: BaseEvent<'cli.created', CLI>
  updated: BaseEvent<'cli.updated', CLI>
  deleted: BaseEvent<'cli.deleted', { id: string }>
  published: BaseEvent<'cli.published', { cliId: string; version: string }>
  installed: BaseEvent<'cli.installed', { cliId: string; method: string }>
}

export interface DashboardEvents {
  created: BaseEvent<'dashboard.created', Dashboard>
  updated: BaseEvent<'dashboard.updated', Dashboard>
  deleted: BaseEvent<'dashboard.deleted', { id: string }>
  cloned: BaseEvent<'dashboard.cloned', { sourceId: string; newId: string }>
  shared: BaseEvent<'dashboard.shared', { dashboardId: string; userIds?: string[]; public?: boolean }>
  exported: BaseEvent<'dashboard.exported', { dashboardId: string; format: string; url: string }>
  widget_added: BaseEvent<'dashboard.widget_added', { dashboardId: string; widget: DashboardWidget }>
  widget_removed: BaseEvent<'dashboard.widget_removed', { dashboardId: string; widgetId: string }>
}

export interface SDKEvents {
  created: BaseEvent<'sdk.created', SDK>
  updated: BaseEvent<'sdk.updated', SDK>
  deleted: BaseEvent<'sdk.deleted', { id: string }>
  published: BaseEvent<'sdk.published', { sdkId: string; version: string; url?: string }>
  generated: BaseEvent<'sdk.generated', { apiId: string; sdkId: string; language: string }>
  deprecated: BaseEvent<'sdk.deprecated', { sdkId: string; message?: string }>
}

// =============================================================================
// Resources (Actions + Events)
// =============================================================================

export interface AppResource extends AppActions {
  on: <K extends keyof AppEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AppEvents[K], TProxy>
  ) => () => void
}

export interface APIResource extends APIActions {
  on: <K extends keyof APIEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<APIEvents[K], TProxy>
  ) => () => void
}

export interface CLIResource extends CLIActions {
  on: <K extends keyof CLIEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CLIEvents[K], TProxy>
  ) => () => void
}

export interface DashboardResource extends DashboardActions {
  on: <K extends keyof DashboardEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DashboardEvents[K], TProxy>
  ) => () => void
}

export interface SDKResource extends SDKActions {
  on: <K extends keyof SDKEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SDKEvents[K], TProxy>
  ) => () => void
}
