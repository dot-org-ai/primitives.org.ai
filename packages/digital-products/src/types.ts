/**
 * Core types for digital products
 */

import type { SimpleSchema } from 'ai-functions'

/**
 * Product - Base interface for digital products
 *
 * Represents any digital product with schema.org.ai-style identifiers.
 * Extended by App, API, Site, and other specific product types.
 *
 * @see https://schema.org.ai/Product
 */
export interface Product {
  /** Unique identifier URI */
  $id: string
  /** Type URI */
  $type: 'https://schema.org.ai/Product'
  /** Human-readable name */
  name: string
  /** Description of the product */
  description: string
  /** Product status */
  status: 'active' | 'inactive' | 'archived'
}

/**
 * App - Application product (web, mobile, desktop)
 *
 * Represents interactive user-facing applications that run on
 * various platforms including web browsers, mobile devices, and desktops.
 *
 * @see https://schema.org.ai/App
 */
export interface App extends Omit<Product, '$type'> {
  /** Type URI for App */
  $type: 'https://schema.org.ai/App'
  /** Platform the app runs on */
  platform: 'web' | 'mobile' | 'desktop' | 'api'
  /** URL where the app is hosted */
  url: string
}

/**
 * API - API product with versioning and auth
 *
 * Represents programmatic interfaces that expose functionality
 * to other software via HTTP/REST, GraphQL, or other protocols.
 *
 * @see https://schema.org.ai/API
 */
export interface API extends Omit<Product, '$type'> {
  /** Type URI for API */
  $type: 'https://schema.org.ai/API'
  /** Base URL for API endpoints */
  baseUrl: string
  /** API version */
  version: string
  /** Authentication method */
  authentication: 'bearer' | 'api_key' | 'oauth' | 'none'
}

/**
 * Site - Website product (marketing, docs, blog)
 *
 * Represents websites including marketing pages, documentation sites,
 * blogs, and other web-based content destinations.
 *
 * @see https://schema.org.ai/Site
 */
export interface Site extends Omit<Product, '$type'> {
  /** Type URI for Site */
  $type: 'https://schema.org.ai/Site'
  /** URL of the site */
  url: string
  /** Type of website */
  siteType: 'marketing' | 'docs' | 'blog' | 'app'
}

/**
 * Base digital product definition
 */
export interface DigitalProduct {
  /** Unique identifier for this product */
  id: string
  /** Human-readable name */
  name: string
  /** Description of what this product does */
  description: string
  /** Version string (e.g., "1.0.0") */
  version: string
  /** Product metadata */
  metadata?: Record<string, unknown>
  /** Tags for categorization */
  tags?: string[]
  /** Product status */
  status?: 'draft' | 'active' | 'deprecated'
}

/**
 * Application definition - interactive user-facing software
 */
export interface AppDefinition extends DigitalProduct {
  type: 'app'
  /** UI framework/runtime */
  framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'ink' | 'custom'
  /** Application routes/pages */
  routes?: RouteDefinition[]
  /** Application configuration */
  config?: AppConfig
  /** State management */
  state?: StateDefinition
  /** Authentication configuration */
  auth?: AuthConfig
  /** Deployment targets */
  deployments?: DeploymentTarget[]
}

/**
 * Route definition for an app
 */
export interface RouteDefinition {
  /** Route path (e.g., "/", "/about", "/users/:id") */
  path: string
  /** Component or page to render */
  component: string
  /** Route metadata */
  meta?: Record<string, unknown>
  /** Child routes */
  children?: RouteDefinition[]
}

/**
 * Application configuration
 */
export interface AppConfig {
  /** App title */
  title?: string
  /** Theme configuration */
  theme?: Record<string, unknown>
  /** Environment variables */
  env?: Record<string, string>
  /** Feature flags */
  features?: Record<string, boolean>
}

/**
 * State management definition
 */
export interface StateDefinition {
  /** State management library */
  library?: 'react-context' | 'zustand' | 'redux' | 'mobx' | 'jotai' | 'custom'
  /** Initial state schema */
  schema?: SimpleSchema
  /** State persistence */
  persistence?: {
    type: 'local' | 'session' | 'database'
    key?: string
  }
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  /** Auth provider */
  provider?: 'clerk' | 'auth0' | 'firebase' | 'supabase' | 'custom'
  /** Required roles */
  roles?: string[]
  /** Protected routes */
  protectedRoutes?: string[]
}

/**
 * API definition - programmatic interface
 */
export interface APIDefinition extends DigitalProduct {
  type: 'api'
  /** API style */
  style?: 'rest' | 'graphql' | 'rpc' | 'grpc' | 'websocket'
  /** Base URL or endpoint pattern */
  baseUrl?: string
  /** API endpoints */
  endpoints?: EndpointDefinition[]
  /** Authentication method */
  auth?: APIAuthConfig
  /** Rate limiting */
  rateLimit?: RateLimitConfig
  /** API documentation URL */
  docsUrl?: string
  /** OpenAPI/Swagger spec */
  openapi?: Record<string, unknown>
}

/**
 * API endpoint definition
 */
export interface EndpointDefinition {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'
  /** Endpoint path */
  path: string
  /** Description of what this endpoint does */
  description: string
  /** Request schema */
  request?: SimpleSchema
  /** Response schema */
  response?: SimpleSchema
  /** Query parameters */
  query?: SimpleSchema
  /** Path parameters */
  params?: Record<string, string>
  /** Headers */
  headers?: Record<string, string>
  /** Authentication required */
  auth?: boolean
  /** Rate limit override */
  rateLimit?: RateLimitConfig
}

/**
 * API authentication configuration
 */
export interface APIAuthConfig {
  /** Auth type */
  type: 'apikey' | 'bearer' | 'basic' | 'oauth2' | 'custom'
  /** Header name for API key/token */
  header?: string
  /** OAuth2 configuration */
  oauth2?: {
    authUrl: string
    tokenUrl: string
    scopes: string[]
  }
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Requests per time window */
  requests: number
  /** Time window in seconds */
  window: number
  /** What to do when limit exceeded */
  onExceeded?: 'reject' | 'queue' | 'custom'
}

/**
 * Content definition - text/media content
 */
export interface ContentDefinition extends DigitalProduct {
  type: 'content'
  /** Content format */
  format?: 'markdown' | 'mdx' | 'html' | 'json' | 'yaml' | 'text'
  /** Content source */
  source?: string
  /** Content schema (for structured content) */
  schema?: SimpleSchema
  /** Frontmatter schema */
  frontmatter?: SimpleSchema
  /** Content categories/taxonomy */
  categories?: string[]
  /** Publishing workflow */
  workflow?: WorkflowDefinition
}

/**
 * Publishing workflow
 */
export interface WorkflowDefinition {
  /** Workflow states */
  states: string[]
  /** Initial state */
  initialState: string
  /** Allowed transitions */
  transitions: { from: string; to: string; action: string }[]
  /** Approval requirements */
  approvals?: { state: string; roles: string[] }[]
}

/**
 * Data definition - structured data/database
 */
export interface DataDefinition extends DigitalProduct {
  type: 'data'
  /** Data schema */
  schema: SimpleSchema
  /** Database provider */
  provider?: 'postgres' | 'mysql' | 'sqlite' | 'mongo' | 'clickhouse' | 'fs'
  /** Indexes */
  indexes?: IndexDefinition[]
  /** Relationships */
  relationships?: RelationshipDefinition[]
  /** Validation rules */
  validation?: ValidationRule[]
}

/**
 * Database index definition
 */
export interface IndexDefinition {
  /** Index name */
  name: string
  /** Fields to index */
  fields: string[]
  /** Index type */
  type?: 'btree' | 'hash' | 'gin' | 'gist' | 'vector'
  /** Unique constraint */
  unique?: boolean
}

/**
 * Relationship definition
 */
export interface RelationshipDefinition {
  /** Relationship type */
  type: 'one-to-one' | 'one-to-many' | 'many-to-many'
  /** Source field */
  from: string
  /** Target entity */
  to: string
  /** Target field */
  field: string
}

/**
 * Validation rule
 */
export interface ValidationRule {
  /** Field to validate */
  field: string
  /** Rule type */
  rule: 'required' | 'unique' | 'email' | 'url' | 'min' | 'max' | 'regex' | 'custom'
  /** Rule parameters */
  params?: unknown
  /** Error message */
  message?: string
}

/**
 * Dataset definition - curated data collection
 */
export interface DatasetDefinition extends DigitalProduct {
  type: 'dataset'
  /** Data format */
  format?: 'json' | 'csv' | 'parquet' | 'arrow' | 'avro'
  /** Dataset schema */
  schema: SimpleSchema
  /** Data source */
  source?: string
  /** Number of records */
  size?: number
  /** License */
  license?: string
  /** Update frequency */
  updateFrequency?: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'static'
}

/**
 * Site definition - website/documentation
 */
export interface SiteDefinition extends DigitalProduct {
  type: 'site'
  /** Site generator */
  generator?: 'next' | 'fumadocs' | 'docusaurus' | 'vitepress' | 'astro' | 'custom'
  /** Site structure */
  structure?: SiteStructure
  /** Navigation */
  navigation?: NavigationDefinition[]
  /** SEO configuration */
  seo?: SEOConfig
  /** Analytics */
  analytics?: AnalyticsConfig
  /** Deployment */
  deployment?: DeploymentTarget
}

/**
 * Site structure
 */
export interface SiteStructure {
  /** Homepage */
  home?: string
  /** Documentation pages */
  docs?: string[]
  /** Blog posts */
  blog?: string[]
  /** Custom pages */
  pages?: { path: string; source: string }[]
}

/**
 * Navigation definition
 */
export interface NavigationDefinition {
  /** Label */
  label: string
  /** URL or path */
  href: string
  /** Icon */
  icon?: string
  /** Child items */
  children?: NavigationDefinition[]
  /** External link */
  external?: boolean
}

/**
 * SEO configuration
 */
export interface SEOConfig {
  /** Site title template */
  titleTemplate?: string
  /** Default description */
  description?: string
  /** Keywords */
  keywords?: string[]
  /** Open Graph image */
  ogImage?: string
  /** Twitter card type */
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player'
}

/**
 * Analytics configuration
 */
export interface AnalyticsConfig {
  /** Analytics provider */
  provider: 'google' | 'plausible' | 'fathom' | 'custom'
  /** Tracking ID */
  id: string
  /** Additional config */
  config?: Record<string, unknown>
}

/**
 * MCP (Model Context Protocol) server definition
 */
export interface MCPDefinition extends DigitalProduct {
  type: 'mcp'
  /** Transport type */
  transport: 'stdio' | 'http' | 'websocket'
  /** Tools provided by this MCP server */
  tools?: MCPTool[]
  /** Resources provided */
  resources?: MCPResource[]
  /** Prompts provided */
  prompts?: MCPPrompt[]
  /** Server configuration */
  config?: MCPConfig
}

/**
 * MCP tool definition
 */
export interface MCPTool {
  /** Tool name */
  name: string
  /** Description for AI */
  description: string
  /** Input schema */
  inputSchema: SimpleSchema
  /** Handler implementation */
  handler?: (input: unknown) => Promise<unknown>
}

/**
 * MCP resource definition
 */
export interface MCPResource {
  /** Resource URI */
  uri: string
  /** Resource name */
  name: string
  /** Description */
  description: string
  /** MIME type */
  mimeType?: string
}

/**
 * MCP prompt definition
 */
export interface MCPPrompt {
  /** Prompt name */
  name: string
  /** Description */
  description: string
  /** Prompt template */
  template: string
  /** Arguments schema */
  arguments?: SimpleSchema
}

/**
 * MCP server configuration
 */
export interface MCPConfig {
  /** Port (for HTTP/WebSocket) */
  port?: number
  /** Host */
  host?: string
  /** Authentication */
  auth?: {
    type: 'bearer' | 'apikey'
    token?: string
  }
}

/**
 * SDK (Software Development Kit) definition
 */
export interface SDKDefinition extends DigitalProduct {
  type: 'sdk'
  /** Target language/platform */
  language: 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'csharp'
  /** API it wraps */
  api?: string
  /** Exported functions/classes */
  exports?: SDKExport[]
  /** Installation instructions */
  install?: string
  /** Documentation */
  docs?: string
  /** Examples */
  examples?: SDKExample[]
}

/**
 * SDK export definition
 */
export interface SDKExport {
  /** Export name */
  name: string
  /** Export type */
  type: 'function' | 'class' | 'constant' | 'type'
  /** Description */
  description: string
  /** Parameters (for functions) */
  parameters?: SimpleSchema
  /** Return type */
  returns?: SimpleSchema
  /** Class methods (for classes) */
  methods?: SDKExport[]
}

/**
 * SDK example
 */
export interface SDKExample {
  /** Example title */
  title: string
  /** Description */
  description: string
  /** Code sample */
  code: string
  /** Expected output */
  output?: string
}

/**
 * Deployment target
 */
export interface DeploymentTarget {
  /** Platform */
  platform: 'vercel' | 'netlify' | 'cloudflare' | 'aws' | 'gcp' | 'azure' | 'custom'
  /** Environment */
  environment?: 'production' | 'staging' | 'preview' | 'development'
  /** URL */
  url?: string
  /** Build command */
  buildCommand?: string
  /** Output directory */
  outputDir?: string
  /** Environment variables */
  env?: Record<string, string>
}

/**
 * Union of all product types
 */
export type ProductDefinition =
  | AppDefinition
  | APIDefinition
  | ContentDefinition
  | DataDefinition
  | DatasetDefinition
  | SiteDefinition
  | MCPDefinition
  | SDKDefinition

/**
 * Product builder - chainable API for creating products
 */
export interface ProductBuilder<T extends ProductDefinition> {
  /** Set product ID */
  id(id: string): ProductBuilder<T>
  /** Set product name */
  name(name: string): ProductBuilder<T>
  /** Set description */
  description(description: string): ProductBuilder<T>
  /** Set version */
  version(version: string): ProductBuilder<T>
  /** Set metadata */
  metadata(metadata: Record<string, unknown>): ProductBuilder<T>
  /** Add tags */
  tags(...tags: string[]): ProductBuilder<T>
  /** Set status */
  status(status: 'draft' | 'active' | 'deprecated'): ProductBuilder<T>
  /** Build the product definition */
  build(): T
}

/**
 * Product registry for storing products
 */
export interface ProductRegistry {
  /** Register a product */
  register(product: ProductDefinition): void
  /** Get a product by ID */
  get(id: string): ProductDefinition | undefined
  /** List all products */
  list(): ProductDefinition[]
  /** List products by type */
  listByType<T extends ProductDefinition['type']>(type: T): Extract<ProductDefinition, { type: T }>[]
  /** Remove a product */
  remove(id: string): boolean
  /** Clear all products */
  clear(): void
}
