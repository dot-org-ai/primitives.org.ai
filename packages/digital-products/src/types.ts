/**
 * @packageDocumentation
 * @module digital-products
 *
 * Digital product types for schema.org.ai
 *
 * This package provides product types using JSON-LD conventions:
 * - {@link Product} - Base product interface
 * - {@link App} - Application (web, mobile, desktop)
 * - {@link API} - API with versioning and auth
 * - {@link Site} - Website (marketing, docs, blog)
 * - {@link Service} - Backend service
 * - {@link Feature} - Product feature with lifecycle
 *
 * All types use `$id` and `$type` fields (JSON-LD style).
 *
 * ## Unified Types (Recommended)
 *
 * The unified types use JSON-LD conventions with `$id` and `$type`:
 *
 * @example
 * ```typescript
 * import { createApp, isApp, AppSchema } from 'digital-products'
 *
 * const app = createApp({
 *   $id: 'my-app',
 *   name: 'My App',
 *   description: 'An app',
 *   platform: 'web',
 *   url: 'https://example.com'
 * })
 *
 * if (isApp(data)) {
 *   console.log(data.platform)
 * }
 * ```
 *
 * ## Legacy Definition Types
 *
 * The `*Definition` types (AppDefinition, APIDefinition, etc.) are maintained
 * for backwards compatibility. New code should use the unified types.
 */

import { z } from 'zod'

// Import SimpleSchema from ai-functions if available, otherwise define locally
// This allows the package to work standalone for unified types testing
type SimpleSchema = Record<string, unknown>

// =============================================================================
// UNIFIED TYPES (JSON-LD Style)
// =============================================================================

/**
 * Product - Base interface for digital products
 *
 * All digital products (App, API, Site, Service) extend this base.
 * Uses JSON-LD conventions with `$id` and `$type`.
 *
 * The `$id` field is a unique identifier URI for the product.
 * The `$type` field identifies this as a Product type.
 *
 * @see https://schema.org.ai/Product
 *
 * @example
 * ```typescript
 * const product = createProduct({
 *   $id: 'https://schema.org.ai/products/acme',
 *   name: 'Acme Product',
 *   description: 'A digital product'
 * })
 * // product.status === 'active' (default)
 * // product.$type === 'https://schema.org.ai/Product'
 * ```
 */
export interface Product {
  /** Unique identifier URI (JSON-LD `@id` equivalent) */
  $id: string
  /** Type URI (JSON-LD `@type` equivalent) */
  $type: 'https://schema.org.ai/Product'
  /** Human-readable name */
  name: string
  /** Description of the product */
  description: string
  /** Product status - defaults to 'active' when created via factory */
  status: 'active' | 'inactive' | 'archived'
}

/**
 * Zod schema for validating Product objects
 *
 * Use this schema for runtime validation of Product data.
 *
 * @see {@link Product}
 * @see {@link isProduct}
 *
 * @example
 * ```typescript
 * const result = ProductSchema.safeParse(data)
 * if (result.success) {
 *   console.log(result.data.name)
 * }
 * ```
 */
export const ProductSchema = z.object({
  $id: z.string(),
  $type: z.literal('https://schema.org.ai/Product'),
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'inactive', 'archived'])
})

/**
 * Type guard to check if an object is a valid Product
 *
 * Uses Zod schema validation under the hood for comprehensive checking.
 *
 * @param obj - Object to validate
 * @returns True if valid Product (JSON-LD style with $id/$type)
 *
 * @see {@link Product}
 * @see {@link ProductSchema}
 *
 * @example
 * ```typescript
 * if (isProduct(data)) {
 *   // TypeScript knows data is Product here
 *   console.log(data.$id, data.name)
 * }
 * ```
 */
export function isProduct(obj: unknown): obj is Product {
  return ProductSchema.safeParse(obj).success
}

/**
 * Factory function to create a new Product
 *
 * Automatically sets `$type` to 'https://schema.org.ai/Product' and
 * defaults `status` to 'active' if not provided.
 *
 * @param input - Product data (status defaults to 'active')
 * @returns Complete Product with $type auto-filled
 *
 * @see {@link Product}
 *
 * @example
 * ```typescript
 * const product = createProduct({
 *   $id: 'https://schema.org.ai/products/acme',
 *   name: 'Acme Product',
 *   description: 'A digital product'
 * })
 * // product.status === 'active'
 * // product.$type === 'https://schema.org.ai/Product'
 * ```
 */
export function createProduct(input: Omit<Product, '$type' | 'status'> & { status?: Product['status'] }): Product {
  return {
    ...input,
    $type: 'https://schema.org.ai/Product',
    status: input.status ?? 'active'
  }
}

/**
 * App - Application product (web, mobile, desktop)
 *
 * Interactive user-facing applications that run on various platforms
 * including web browsers, mobile devices, and desktops.
 *
 * This record is the **offering-catalog row** — "a business-as-code offers
 * a digital product" (SG-1). It says a business ships this app at this url;
 * it is NOT the app's definition. The abstract App definition is a
 * composition of primitives (Nouns + Tools + workflows + roster + plans) —
 * see the stack vault `specs/studio/SOFTWARE.md` (rulings SG-1/SG-6).
 *
 * Extends {@link Product} with platform-specific fields.
 *
 * @see https://schema.org.ai/App
 *
 * @example
 * ```typescript
 * const app = createApp({
 *   $id: 'https://schema.org.ai/apps/dashboard',
 *   name: 'Dashboard',
 *   description: 'Admin dashboard',
 *   platform: 'web',
 *   url: 'https://dashboard.example.com'
 * })
 * // app.$type === 'https://schema.org.ai/App'
 * // app.status === 'active' (default)
 * ```
 */
export interface App extends Omit<Product, '$type'> {
  /** Type URI for App (JSON-LD `@type` equivalent) */
  $type: 'https://schema.org.ai/App'
  /** Platform the app runs on - web, mobile, desktop, or api */
  platform: 'web' | 'mobile' | 'desktop' | 'api'
  /** URL where the app is hosted or accessible */
  url: string
}

/**
 * Zod schema for validating App objects
 *
 * Use this schema for runtime validation of App data.
 *
 * @see {@link App}
 * @see {@link isApp}
 *
 * @example
 * ```typescript
 * const result = AppSchema.safeParse(data)
 * if (result.success) {
 *   console.log(result.data.platform, result.data.url)
 * }
 * ```
 */
export const AppSchema = z.object({
  $id: z.string(),
  $type: z.literal('https://schema.org.ai/App'),
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'inactive', 'archived']),
  platform: z.enum(['web', 'mobile', 'desktop', 'api']),
  url: z.string()
})

/**
 * Type guard to check if an object is a valid App
 *
 * Uses Zod schema validation under the hood.
 *
 * @param obj - Object to validate
 * @returns True if valid App (JSON-LD style with $id/$type and platform/url)
 *
 * @see {@link App}
 * @see {@link AppSchema}
 *
 * @example
 * ```typescript
 * if (isApp(data)) {
 *   // TypeScript knows data is App here
 *   console.log(data.platform, data.url)
 * }
 * ```
 */
export function isApp(obj: unknown): obj is App {
  return AppSchema.safeParse(obj).success
}

/**
 * Factory function to create a new App
 *
 * Automatically sets `$type` to 'https://schema.org.ai/App' and
 * defaults `status` to 'active' if not provided.
 *
 * @param input - App data (status defaults to 'active')
 * @returns Complete App with $type auto-filled
 *
 * @see {@link App}
 *
 * @example
 * ```typescript
 * const app = createApp({
 *   $id: 'https://schema.org.ai/apps/dashboard',
 *   name: 'Dashboard',
 *   description: 'Admin dashboard',
 *   platform: 'web',
 *   url: 'https://dashboard.example.com'
 * })
 * ```
 */
export function createApp(input: Omit<App, '$type' | 'status'> & { status?: App['status'] }): App {
  return {
    ...input,
    $type: 'https://schema.org.ai/App',
    status: input.status ?? 'active'
  }
}

/**
 * API - API product with versioning and auth
 *
 * Programmatic interfaces for other software to consume.
 * Includes versioning and authentication configuration.
 *
 * Extends {@link Product} with API-specific fields.
 *
 * @see https://schema.org.ai/API
 *
 * @example
 * ```typescript
 * const api = createAPI({
 *   $id: 'https://schema.org.ai/apis/users',
 *   name: 'Users API',
 *   description: 'User management API',
 *   baseUrl: 'https://api.example.com/v1',
 *   version: '1.0.0',
 *   authentication: 'bearer'
 * })
 * // api.$type === 'https://schema.org.ai/API'
 * ```
 */
export interface API extends Omit<Product, '$type'> {
  /** Type URI for API (JSON-LD `@type` equivalent) */
  $type: 'https://schema.org.ai/API'
  /** Base URL for API endpoints */
  baseUrl: string
  /** API version string (e.g., '1.0.0', 'v2') */
  version: string
  /** Authentication method - bearer token, API key, OAuth, or none */
  authentication: 'bearer' | 'api_key' | 'oauth' | 'none'
}

/**
 * Zod schema for validating API objects
 *
 * Use this schema for runtime validation of API data.
 *
 * @see {@link API}
 * @see {@link isAPI}
 *
 * @example
 * ```typescript
 * const result = APISchema.safeParse(data)
 * if (result.success) {
 *   console.log(result.data.baseUrl, result.data.version)
 * }
 * ```
 */
export const APISchema = z.object({
  $id: z.string(),
  $type: z.literal('https://schema.org.ai/API'),
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'inactive', 'archived']),
  baseUrl: z.string(),
  version: z.string(),
  authentication: z.enum(['bearer', 'api_key', 'oauth', 'none'])
})

/**
 * Type guard to check if an object is a valid API
 *
 * Uses Zod schema validation under the hood.
 *
 * @param obj - Object to validate
 * @returns True if valid API (JSON-LD style with baseUrl, version, authentication)
 *
 * @see {@link API}
 * @see {@link APISchema}
 *
 * @example
 * ```typescript
 * if (isAPI(data)) {
 *   // TypeScript knows data is API here
 *   console.log(data.baseUrl, data.authentication)
 * }
 * ```
 */
export function isAPI(obj: unknown): obj is API {
  return APISchema.safeParse(obj).success
}

/**
 * Factory function to create a new API
 *
 * Automatically sets `$type` to 'https://schema.org.ai/API' and
 * defaults `status` to 'active' if not provided.
 *
 * @param input - API data (status defaults to 'active')
 * @returns Complete API with $type auto-filled
 *
 * @see {@link API}
 *
 * @example
 * ```typescript
 * const api = createAPI({
 *   $id: 'https://schema.org.ai/apis/users',
 *   name: 'Users API',
 *   description: 'User management API',
 *   baseUrl: 'https://api.example.com/v1',
 *   version: '1.0.0',
 *   authentication: 'bearer'
 * })
 * ```
 */
export function createAPI(input: Omit<API, '$type' | 'status'> & { status?: API['status'] }): API {
  return {
    ...input,
    $type: 'https://schema.org.ai/API',
    status: input.status ?? 'active'
  }
}

/**
 * Site - Website product (marketing, docs, blog)
 *
 * Content-focused websites including marketing pages, documentation sites,
 * blogs, and web applications.
 *
 * Extends {@link Product} with site-specific fields.
 *
 * @see https://schema.org.ai/Site
 *
 * @example
 * ```typescript
 * const site = createSite({
 *   $id: 'https://schema.org.ai/sites/docs',
 *   name: 'Documentation',
 *   description: 'Product documentation site',
 *   url: 'https://docs.example.com',
 *   siteType: 'docs'
 * })
 * // site.$type === 'https://schema.org.ai/Site'
 * ```
 */
export interface Site extends Omit<Product, '$type'> {
  /** Type URI for Site (JSON-LD `@type` equivalent) */
  $type: 'https://schema.org.ai/Site'
  /** URL of the site */
  url: string
  /** Type of website - marketing, docs, blog, or app */
  siteType: 'marketing' | 'docs' | 'blog' | 'app'
}

/**
 * Zod schema for validating Site objects
 *
 * Use this schema for runtime validation of Site data.
 *
 * @see {@link Site}
 * @see {@link isSite}
 *
 * @example
 * ```typescript
 * const result = SiteSchema.safeParse(data)
 * if (result.success) {
 *   console.log(result.data.url, result.data.siteType)
 * }
 * ```
 */
export const SiteSchema = z.object({
  $id: z.string(),
  $type: z.literal('https://schema.org.ai/Site'),
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'inactive', 'archived']),
  url: z.string(),
  siteType: z.enum(['marketing', 'docs', 'blog', 'app'])
})

/**
 * Type guard to check if an object is a valid Site
 *
 * Uses Zod schema validation under the hood.
 *
 * @param obj - Object to validate
 * @returns True if valid Site (JSON-LD style with url and siteType)
 *
 * @see {@link Site}
 * @see {@link SiteSchema}
 *
 * @example
 * ```typescript
 * if (isSite(data)) {
 *   // TypeScript knows data is Site here
 *   console.log(data.url, data.siteType)
 * }
 * ```
 */
export function isSite(obj: unknown): obj is Site {
  return SiteSchema.safeParse(obj).success
}

/**
 * Factory function to create a new Site
 *
 * Automatically sets `$type` to 'https://schema.org.ai/Site' and
 * defaults `status` to 'active' if not provided.
 *
 * @param input - Site data (status defaults to 'active')
 * @returns Complete Site with $type auto-filled
 *
 * @see {@link Site}
 *
 * @example
 * ```typescript
 * const site = createSite({
 *   $id: 'https://schema.org.ai/sites/docs',
 *   name: 'Documentation',
 *   description: 'Product documentation site',
 *   url: 'https://docs.example.com',
 *   siteType: 'docs'
 * })
 * ```
 */
export function createSite(input: Omit<Site, '$type' | 'status'> & { status?: Site['status'] }): Site {
  return {
    ...input,
    $type: 'https://schema.org.ai/Site',
    status: input.status ?? 'active'
  }
}

/**
 * Service - Backend service product
 *
 * Backend services with optional endpoints. Services are typically
 * internal components that power applications and APIs.
 *
 * Unlike {@link API}, Service represents internal infrastructure
 * rather than public programmatic interfaces.
 *
 * @see https://schema.org.ai/Service
 *
 * @example
 * ```typescript
 * const service = createService({
 *   $id: 'https://schema.org.ai/services/auth',
 *   name: 'Auth Service',
 *   description: 'Authentication and authorization service',
 *   endpoints: ['/login', '/logout', '/refresh']
 * })
 * // service.$type === 'https://schema.org.ai/Service'
 * // service.status === 'active' (default)
 * ```
 */
export interface Service {
  /** Unique identifier URI (JSON-LD `@id` equivalent) */
  $id: string
  /** Type URI (JSON-LD `@type` equivalent) */
  $type: 'https://schema.org.ai/Service'
  /** Human-readable name */
  name: string
  /** Description of the service */
  description: string
  /** Service status - defaults to 'active' when created via factory */
  status: 'active' | 'inactive' | 'archived'
  /** Optional list of endpoint paths this service exposes */
  endpoints?: string[]
}

/**
 * Zod schema for validating Service objects
 *
 * Use this schema for runtime validation of Service data.
 *
 * @see {@link Service}
 * @see {@link isService}
 *
 * @example
 * ```typescript
 * const result = ServiceSchema.safeParse(data)
 * if (result.success) {
 *   console.log(result.data.name, result.data.endpoints)
 * }
 * ```
 */
export const ServiceSchema = z.object({
  $id: z.string(),
  $type: z.literal('https://schema.org.ai/Service'),
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'inactive', 'archived']),
  endpoints: z.array(z.string()).optional()
})

/**
 * Type guard to check if an object is a valid Service
 *
 * Uses Zod schema validation under the hood.
 *
 * @param obj - Object to validate
 * @returns True if valid Service (JSON-LD style with optional endpoints)
 *
 * @see {@link Service}
 * @see {@link ServiceSchema}
 *
 * @example
 * ```typescript
 * if (isService(data)) {
 *   // TypeScript knows data is Service here
 *   console.log(data.name, data.endpoints)
 * }
 * ```
 */
export function isService(obj: unknown): obj is Service {
  return ServiceSchema.safeParse(obj).success
}

/**
 * Factory function to create a new Service
 *
 * Automatically sets `$type` to 'https://schema.org.ai/Service' and
 * defaults `status` to 'active' if not provided.
 *
 * @param input - Service data (status defaults to 'active')
 * @returns Complete Service with $type auto-filled
 *
 * @see {@link Service}
 *
 * @example
 * ```typescript
 * const service = createService({
 *   $id: 'https://schema.org.ai/services/auth',
 *   name: 'Auth Service',
 *   description: 'Authentication service',
 *   endpoints: ['/login', '/logout']
 * })
 * ```
 */
export function createService(input: Omit<Service, '$type' | 'status'> & { status?: Service['status'] }): Service {
  return {
    ...input,
    $type: 'https://schema.org.ai/Service',
    status: input.status ?? 'active'
  }
}

/**
 * Feature lifecycle status type
 *
 * Represents the lifecycle stage of a feature:
 * - `draft` - Feature is being designed/developed (default)
 * - `beta` - Feature is available for testing
 * - `ga` - Feature is generally available (stable)
 * - `deprecated` - Feature is being phased out
 *
 * @see {@link Feature}
 */
export type FeatureStatus = 'draft' | 'beta' | 'ga' | 'deprecated'

/**
 * Feature - Product feature with lifecycle status
 *
 * Individual features within a product. Features have their own
 * lifecycle status independent of the parent product.
 *
 * @see https://schema.org.ai/Feature
 *
 * @example
 * ```typescript
 * const feature = createFeature({
 *   $id: 'https://schema.org.ai/features/dark-mode',
 *   name: 'Dark Mode',
 *   description: 'Toggle dark theme',
 *   productId: 'https://schema.org.ai/products/dashboard',
 *   status: 'ga'
 * })
 * // feature.$type === 'https://schema.org.ai/Feature'
 * ```
 *
 * @example Feature lifecycle progression
 * ```typescript
 * // Feature starts as draft
 * const feature = createFeature({
 *   $id: 'new-feature',
 *   name: 'New Feature',
 *   description: 'A new feature',
 *   productId: 'my-product'
 * })
 * // feature.status === 'draft' (default)
 *
 * // Later, promote to beta, then ga, or deprecate
 * ```
 */
export interface Feature {
  /** Unique identifier URI (JSON-LD `@id` equivalent) */
  $id: string
  /** Type URI (JSON-LD `@type` equivalent) */
  $type: 'https://schema.org.ai/Feature'
  /** Human-readable name */
  name: string
  /** Description of the feature */
  description: string
  /** Reference to parent product $id */
  productId: string
  /** Feature lifecycle status - defaults to 'draft' when created via factory */
  status: FeatureStatus
}

/**
 * Zod schema for validating Feature objects
 *
 * Use this schema for runtime validation of Feature data.
 *
 * @see {@link Feature}
 * @see {@link isFeature}
 *
 * @example
 * ```typescript
 * const result = FeatureSchema.safeParse(data)
 * if (result.success) {
 *   console.log(result.data.name, result.data.status)
 * }
 * ```
 */
export const FeatureSchema = z.object({
  $id: z.string(),
  $type: z.literal('https://schema.org.ai/Feature'),
  name: z.string(),
  description: z.string(),
  productId: z.string(),
  status: z.enum(['draft', 'beta', 'ga', 'deprecated'])
})

/**
 * Type guard to check if an object is a valid Feature
 *
 * Uses Zod schema validation under the hood.
 *
 * @param obj - Object to validate
 * @returns True if valid Feature (JSON-LD style with productId and lifecycle status)
 *
 * @see {@link Feature}
 * @see {@link FeatureSchema}
 *
 * @example
 * ```typescript
 * if (isFeature(data)) {
 *   // TypeScript knows data is Feature here
 *   console.log(data.name, data.status, data.productId)
 * }
 * ```
 */
export function isFeature(obj: unknown): obj is Feature {
  return FeatureSchema.safeParse(obj).success
}

/**
 * Factory function to create a new Feature
 *
 * Automatically sets `$type` to 'https://schema.org.ai/Feature' and
 * defaults `status` to 'draft' if not provided.
 *
 * @param input - Feature data (status defaults to 'draft')
 * @returns Complete Feature with $type auto-filled
 *
 * @see {@link Feature}
 * @see {@link FeatureStatus}
 *
 * @example
 * ```typescript
 * const feature = createFeature({
 *   $id: 'https://schema.org.ai/features/dark-mode',
 *   name: 'Dark Mode',
 *   description: 'Toggle dark theme',
 *   productId: 'https://schema.org.ai/products/dashboard'
 * })
 * // feature.status === 'draft' (default)
 * ```
 */
export function createFeature(input: Omit<Feature, '$type' | 'status'> & { status?: FeatureStatus }): Feature {
  return {
    ...input,
    $type: 'https://schema.org.ai/Feature',
    status: input.status ?? 'draft'
  }
}

// =============================================================================
// BUILDER PATTERN TYPES
// =============================================================================
//
// These *Definition types support the fluent builder API (ProductBuilder, AppBuilder, etc.).
// They use `id` and `type` fields (without $ prefix) for builder ergonomics.
//
// For JSON-LD compatible types with `$id`/`$type`, use the unified types above:
// - Product, App, API, Site, Service, Feature
//
// Both type systems are valid and serve different purposes:
// - Unified types ($id/$type): JSON-LD semantics, API responses, schema.org.ai
// - Definition types (id/type): Builder pattern, DSL definitions, config files

/**
 * Base digital product definition for builder pattern
 *
 * Used by ProductBuilder and related fluent APIs.
 * Uses `id` (without $ prefix) for builder ergonomics.
 *
 * @example
 * ```typescript
 * const product: DigitalProduct = {
 *   id: 'my-product',
 *   name: 'My Product',
 *   description: 'A product',
 *   version: '1.0.0'
 * }
 * ```
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
 * Application definition for builder pattern
 *
 * Used by AppBuilder for fluent API definitions.
 *
 * Scope note (SG-1/SG-6): this is the **code-projection descriptor** of one
 * rendering path — it describes generated app code, which is why it may name
 * a `framework`, a state `library`, or an auth `provider`. Those fields are
 * projection internals. They are NOT fields of the abstract App: the abstract
 * App definition is a composition of primitives and, by the framework razor,
 * never names an implementation. See the stack vault `specs/studio/SOFTWARE.md`.
 *
 * @see {@link App} for JSON-LD compatible type
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
 * API definition for builder pattern
 *
 * Used by APIBuilder for fluent API definitions.
 *
 * @see {@link API} for JSON-LD compatible type
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
 * Content definition for builder pattern
 *
 * Defines text/media content structure for the Content builder.
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
 * Data definition for builder pattern
 *
 * Defines structured data/database schemas for the Data builder.
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
 * Dataset definition for builder pattern
 *
 * Defines curated data collection structure for the Dataset builder.
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
 * Site definition for builder pattern
 *
 * Used by SiteBuilder for fluent API definitions.
 *
 * @see {@link Site} for JSON-LD compatible type
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
 * MCP (Model Context Protocol) server definition for builder pattern
 *
 * Defines MCP server structure for the MCP builder.
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
 * SDK (Software Development Kit) definition for builder pattern
 *
 * Defines SDK structure for the SDK builder.
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
 * Union of all builder pattern product definition types
 *
 * Represents any product definition created through the builder API.
 * For JSON-LD compatible types, use Product, App, API, Site, Service, Feature.
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
 *
 * Provides a fluent interface for building ProductDefinition types.
 * For simpler creation, use factory functions (createProduct, createApp, etc.).
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
 *
 * Registry for managing legacy ProductDefinition types.
 * Provides CRUD operations for products by ID.
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
