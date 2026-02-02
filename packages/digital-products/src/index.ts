/**
 * digital-products - Primitives for defining and building digital products
 *
 * This package provides primitives for defining digital products using JSON-LD
 * style conventions with `$id` and `$type` fields for schema.org.ai compatibility.
 *
 * ## Product Types
 *
 * - {@link Product} - Base product interface
 * - {@link App} - Interactive user-facing applications (web, mobile, desktop)
 * - {@link API} - Programmatic interfaces with versioning and auth
 * - {@link Site} - Websites (marketing, docs, blog)
 * - {@link Service} - Backend services with endpoints
 * - {@link Feature} - Product features with lifecycle status
 *
 * ## Validation & Type Guards
 *
 * Each product type includes:
 * - Zod schema for runtime validation (e.g., {@link AppSchema})
 * - Type guard function (e.g., {@link isApp})
 * - Factory function with defaults (e.g., {@link createApp})
 *
 * ## Builder Pattern (Legacy)
 *
 * The `*Builder` functions and `*Definition` types are maintained for
 * backwards compatibility. New code should use the unified JSON-LD types.
 *
 * @packageDocumentation
 *
 * @example Creating an App
 * ```typescript
 * import { createApp, isApp, AppSchema, App } from 'digital-products'
 *
 * // Using factory function (recommended)
 * const app = createApp({
 *   $id: 'https://schema.org.ai/apps/dashboard',
 *   name: 'Dashboard',
 *   description: 'Admin dashboard application',
 *   platform: 'web',
 *   url: 'https://dashboard.example.com'
 * })
 * // app.$type === 'https://schema.org.ai/App'
 * // app.status === 'active' (default)
 *
 * // Type guard
 * if (isApp(data)) {
 *   console.log(data.platform) // TypeScript knows this is App
 * }
 *
 * // Zod validation
 * const result = AppSchema.safeParse(untrustedData)
 * if (result.success) {
 *   console.log(result.data.name)
 * }
 * ```
 *
 * @example Creating an API
 * ```typescript
 * import { createAPI, API, APISchema } from 'digital-products'
 *
 * const api = createAPI({
 *   $id: 'https://schema.org.ai/apis/users',
 *   name: 'Users API',
 *   description: 'User management REST API',
 *   baseUrl: 'https://api.example.com/v1',
 *   version: '1.0.0',
 *   authentication: 'bearer'
 * })
 * // api.$type === 'https://schema.org.ai/API'
 * ```
 *
 * @example Creating a Site
 * ```typescript
 * import { createSite, Site, SiteSchema } from 'digital-products'
 *
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

// =============================================================================
// UNIFIED TYPES (JSON-LD Style) - Recommended
// =============================================================================
//
// These exports from types.ts include:
//
// INTERFACES (JSON-LD style with $id/$type):
//   - Product      - Base product interface
//   - App          - Application (web, mobile, desktop)
//   - API          - API with versioning and authentication
//   - Site         - Website (marketing, docs, blog)
//   - Service      - Backend service with endpoints
//   - Feature      - Product feature with lifecycle
//
// ZOD SCHEMAS (runtime validation):
//   - ProductSchema, AppSchema, APISchema, SiteSchema, ServiceSchema, FeatureSchema
//
// TYPE GUARDS:
//   - isProduct, isApp, isAPI, isSite, isService, isFeature
//
// FACTORY FUNCTIONS (with sensible defaults):
//   - createProduct, createApp, createAPI, createSite, createService, createFeature
//
// LEGACY TYPES (for backwards compatibility):
//   - DigitalProduct, AppDefinition, APIDefinition, SiteDefinition, etc.
//
export * from './types.js'

// Export entity definitions (Nouns) as namespace to avoid conflicts with types
export * as Nouns from './entities/index.js'

// Also export individual entity collections for convenience
export {
  AllDigitalProductEntities,
  DigitalProductEntityCategories,
  Entities,
  // Category exports
  ProductEntities,
  ProductCategories,
  InterfaceEntities,
  InterfaceCategories,
  ContentEntities,
  ContentCategories,
  WebEntities,
  WebCategories,
  AIEntities,
  AICategories,
  LifecycleEntities,
  LifecycleCategories,
} from './entities/index.js'

// Export registry
export { registry } from './registry.js'

// =============================================================================
// BUILDER PATTERN (Legacy API)
// =============================================================================
//
// These builder functions create *Definition types (e.g., AppDefinition),
// which use `id` and `type` fields instead of JSON-LD `$id`/`$type`.
//
// For new code, prefer the unified types above:
//   - createApp()  creates App with $id/$type (JSON-LD)
//   - AppBuilder() creates AppDefinition with id/type (legacy)
//
// The *Builder exports are renamed to avoid conflicts with the type interfaces.
// The original function names (App, API, Site) are also exported for backwards
// compatibility - TypeScript allows functions and types to share the same name.
//

/** @deprecated Use createProduct() from unified types instead */
export {
  Product as ProductBuilder,
  createProduct as createProductDefinition,
  registerProduct,
} from './product.js'

/** @deprecated Use createApp() from unified types instead */
export { App as AppBuilder, Route, State, Auth } from './app.js'

/** @deprecated Use createAPI() from unified types instead */
export { API as APIBuilder, Endpoint, APIAuth, RateLimit } from './api.js'

export { Content, Workflow } from './content.js'
export { Data, Index, Relationship, Validate } from './data.js'
export { Dataset } from './dataset.js'

/** @deprecated Use createSite() from unified types instead */
export { Site as SiteBuilder, Nav, SEO, Analytics } from './site.js'

export { MCP, Tool, Resource, Prompt, MCPConfig } from './mcp.js'
export { SDK, Export, Example } from './sdk.js'

// Re-export builder functions under original names for backwards compatibility.
// This allows: import { Site } from 'digital-products'; Site({...}) // builder
// While also: import type { Site } from 'digital-products'; const x: Site = {...} // type
// TypeScript allows function and type/interface with same name.
import { Product as ProductFn } from './product.js'
import { App as AppFn } from './app.js'
import { API as APIFn } from './api.js'
import { Site as SiteFn } from './site.js'

// Export builder functions - these shadow the type exports at runtime
// (which is fine since TypeScript types are erased at compile time)
export { ProductFn as Product, AppFn as App, APIFn as API, SiteFn as Site }
