/**
 * RPC Client for Digital Products
 *
 * Provides a typed RPC client that connects to the deployed
 * digital-products worker using rpc.do for remote procedure calls.
 *
 * @example
 * ```ts
 * import { createDigitalProductsClient } from 'digital-products/client'
 *
 * const client = createDigitalProductsClient('https://digital-products.workers.dev')
 * const product = await client.create({ name: 'My Product', description: 'A great product', version: '1.0.0' })
 * const feature = await client.addFeature(product.id, { name: 'Search', description: 'Full-text search' })
 * ```
 *
 * @packageDocumentation
 */

import { RPC, http } from 'rpc.do'

// ==================== Types ====================

interface ProductData {
  id: string
  name: string
  description: string
  version: string
  status: 'draft' | 'active' | 'deprecated' | 'archived'
  type?: string
  features?: FeatureData[]
  metadata?: Record<string, unknown>
  tags?: string[]
  createdAt: Date
  updatedAt: Date
}

interface FeatureData {
  id: string
  name: string
  description: string
  status: 'draft' | 'beta' | 'ga' | 'deprecated'
  productId: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

interface VersionData {
  id: string
  productId: string
  version: string
  changelog?: string
  status: 'draft' | 'published' | 'deprecated'
  features?: string[]
  metadata?: Record<string, unknown>
  createdAt: Date
  publishedAt?: Date
}

interface BundleData {
  id: string
  name: string
  description: string
  productIds: string[]
  pricing?: PricingData
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

interface PricingData {
  model: 'free' | 'one-time' | 'subscription' | 'usage-based'
  amount?: number
  currency?: string
  interval?: 'month' | 'year'
}

interface ListOptions {
  limit?: number
  offset?: number
  status?: string
  type?: string
  orderBy?: string
  order?: 'asc' | 'desc'
}

// ==================== API Type ====================

/**
 * DigitalProductsAPI - Type-safe interface matching ProductServiceCore RPC methods
 *
 * This interface mirrors all public methods on ProductServiceCore so that
 * the RPC client provides full type safety when calling remote methods.
 */
export interface DigitalProductsAPI {
  // Product CRUD
  create(data: Partial<ProductData>): Promise<ProductData>
  get(id: string): Promise<ProductData | null>
  update(id: string, data: Partial<ProductData>): Promise<ProductData>
  delete(id: string): Promise<boolean>
  list(options?: ListOptions): Promise<ProductData[]>

  // Feature Operations
  addFeature(productId: string, featureData: Partial<FeatureData>): Promise<FeatureData>
  updateFeature(featureId: string, data: Partial<FeatureData>): Promise<FeatureData>
  removeFeature(featureId: string): Promise<boolean>
  listFeatures(productId: string): Promise<FeatureData[]>

  // Version Operations
  publish(productId: string, versionStr: string, changelog?: string): Promise<VersionData>
  listVersions(productId: string): Promise<VersionData[]>
  getVersion(productId: string, versionStr: string): Promise<VersionData | null>
  deprecateVersion(productId: string, versionStr: string): Promise<VersionData>

  // Bundle Operations
  compose(name: string, productIds: string[], options?: Partial<BundleData>): Promise<BundleData>
  getBundle(bundleId: string): Promise<BundleData | null>
  updateBundle(bundleId: string, data: Partial<BundleData>): Promise<BundleData>
  listBundles(): Promise<BundleData[]>
}

// ==================== Client Options ====================

/**
 * Options for creating a digital products RPC client
 */
export interface DigitalProductsClientOptions {
  /** Authentication token or API key */
  token?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Custom headers to include in requests */
  headers?: Record<string, string>
}

// ==================== Client Factory ====================

/** Default URL for the digital-products worker */
const DEFAULT_URL = 'https://digital-products.workers.dev'

/**
 * Create a typed RPC client for the digital-products worker
 *
 * @param url - The URL of the deployed digital-products worker
 * @param options - Optional client configuration
 * @returns A typed RPC client with all ProductServiceCore methods
 *
 * @example
 * ```ts
 * import { createDigitalProductsClient } from 'digital-products/client'
 *
 * // Connect to production
 * const client = createDigitalProductsClient('https://digital-products.workers.dev')
 *
 * // Create a product
 * const product = await client.create({
 *   name: 'My API',
 *   description: 'A powerful API service',
 *   version: '1.0.0',
 * })
 *
 * // Add features
 * await client.addFeature(product.id, { name: 'Rate Limiting', description: 'API rate limiting' })
 * await client.addFeature(product.id, { name: 'Analytics', description: 'Usage analytics' })
 *
 * // Publish a version
 * await client.publish(product.id, '1.0.0', 'Initial release')
 *
 * // Create a bundle
 * const bundle = await client.compose('Enterprise Bundle', [product.id, otherProduct.id])
 * ```
 */
export function createDigitalProductsClient(
  url: string = DEFAULT_URL,
  options?: DigitalProductsClientOptions
) {
  return RPC<DigitalProductsAPI>(http(url, options?.token))
}

/**
 * Default client instance connected to the production digital-products worker
 *
 * @example
 * ```ts
 * import client from 'digital-products/client'
 *
 * const product = await client.create({ name: 'My Product', description: 'Great', version: '1.0.0' })
 * ```
 */
const client = createDigitalProductsClient()

export default client
