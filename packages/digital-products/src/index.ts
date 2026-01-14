/**
 * digital-products - Primitives for defining and building digital products
 *
 * This package provides primitives for defining digital products:
 * - Apps: Interactive user-facing applications
 * - APIs: Programmatic interfaces
 * - Content: Text/media content with schemas
 * - Data: Structured data definitions
 * - Datasets: Curated data collections
 * - Sites: Websites and documentation
 * - MCPs: Model Context Protocol servers
 * - SDKs: Software development kits
 *
 * @packageDocumentation
 */

// Export all types (includes core schema.org.ai types: Product, App, API, Site)
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

// Export product constructors
export { Product, createProduct, registerProduct } from './product.js'
export { App, Route, State, Auth } from './app.js'
export { API, Endpoint, APIAuth, RateLimit } from './api.js'
export { Content, Workflow } from './content.js'
export { Data, Index, Relationship, Validate } from './data.js'
export { Dataset } from './dataset.js'
export { Site, Nav, SEO, Analytics } from './site.js'
export { MCP, Tool, Resource, Prompt, MCPConfig } from './mcp.js'
export { SDK, Export, Example } from './sdk.js'
