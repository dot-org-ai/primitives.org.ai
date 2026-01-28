/**
 * Worker Export - WorkerEntrypoint for RPC access to Digital Products
 *
 * Exposes ProductServiceCore methods via Cloudflare RPC.
 * Uses in-memory storage for products, features, versions, and bundles.
 *
 * @example
 * ```typescript
 * // wrangler.jsonc
 * {
 *   "services": [
 *     { "binding": "PRODUCTS", "service": "digital-products" }
 *   ]
 * }
 *
 * // worker.ts - consuming service
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const service = env.PRODUCTS.connect()
 *     const product = await service.create({ name: 'My Product', description: 'Test', version: '1.0.0' })
 *     return Response.json(product)
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'

// =============================================================================
// Types
// =============================================================================

export interface ProductData {
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

export interface FeatureData {
  id: string
  name: string
  description: string
  status: 'draft' | 'beta' | 'ga' | 'deprecated'
  productId: string
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface VersionData {
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

export interface BundleData {
  id: string
  name: string
  description: string
  productIds: string[]
  pricing?: PricingData
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface PricingData {
  model: 'free' | 'one-time' | 'subscription' | 'usage-based'
  amount?: number
  currency?: string
  interval?: 'month' | 'year'
}

export interface ListOptions {
  limit?: number
  offset?: number
  status?: string
  type?: string
  orderBy?: string
  order?: 'asc' | 'desc'
}

/**
 * Environment bindings for the worker
 */
export interface Env {
  AI?: unknown
  PRODUCT_CATALOG?: DurableObjectNamespace
}

// =============================================================================
// In-Memory Storage
// =============================================================================

// Global storage maps for persistence across connect() calls
const products = new Map<string, ProductData>()
const features = new Map<string, FeatureData>()
const versions = new Map<string, VersionData>()
const bundles = new Map<string, BundleData>()

/**
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID()
}

// =============================================================================
// ProductServiceCore
// =============================================================================

/**
 * ProductServiceCore - RpcTarget with all product operations
 *
 * Provides CRUD for products, features, versions, and bundles.
 */
export class ProductServiceCore extends RpcTarget {
  private env: Env

  constructor(env: Env) {
    super()
    this.env = env
  }

  // ==================== Product CRUD ====================

  /**
   * Create a new product
   */
  async create(data: Partial<ProductData>): Promise<ProductData> {
    // Validate required fields
    if (!data.name || !data.description || !data.version) {
      throw new Error('Missing required fields: name, description, and version are required')
    }

    const now = new Date()
    const product: ProductData = {
      id: data.id || generateId(),
      name: data.name,
      description: data.description,
      version: data.version,
      status: data.status || 'draft',
      type: data.type,
      metadata: data.metadata,
      tags: data.tags,
      createdAt: now,
      updatedAt: now,
    }

    products.set(product.id, product)
    return product
  }

  /**
   * Get a product by ID
   */
  async get(id: string): Promise<ProductData | null> {
    return products.get(id) || null
  }

  /**
   * Update a product
   */
  async update(id: string, data: Partial<ProductData>): Promise<ProductData> {
    const existing = products.get(id)
    if (!existing) {
      throw new Error(`Product not found: ${id}`)
    }

    const updated: ProductData = {
      ...existing,
      ...data,
      id: existing.id, // ID cannot be changed
      createdAt: existing.createdAt, // createdAt cannot be changed
      updatedAt: new Date(),
      // Merge metadata if provided
      metadata: data.metadata ? { ...existing.metadata, ...data.metadata } : existing.metadata,
    }

    products.set(id, updated)
    return updated
  }

  /**
   * Delete a product
   */
  async delete(id: string): Promise<boolean> {
    const exists = products.has(id)
    if (!exists) {
      return false
    }

    // Cascade delete features
    for (const [featureId, feature] of features) {
      if (feature.productId === id) {
        features.delete(featureId)
      }
    }

    // Cascade delete versions
    for (const [versionId, version] of versions) {
      if (version.productId === id) {
        versions.delete(versionId)
      }
    }

    products.delete(id)
    return true
  }

  /**
   * List products with optional filtering
   */
  async list(options?: ListOptions): Promise<ProductData[]> {
    let result = Array.from(products.values())

    // Filter by status
    if (options?.status) {
      result = result.filter((p) => p.status === options.status)
    }

    // Filter by type
    if (options?.type) {
      result = result.filter((p) => p.type === options.type)
    }

    // Sort
    if (options?.orderBy) {
      const order = options.order || 'asc'
      result.sort((a, b) => {
        const aVal = (a as Record<string, unknown>)[options.orderBy!]
        const bVal = (b as Record<string, unknown>)[options.orderBy!]

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
        }

        if (aVal instanceof Date && bVal instanceof Date) {
          return order === 'asc' ? aVal.getTime() - bVal.getTime() : bVal.getTime() - aVal.getTime()
        }

        return 0
      })
    }

    // Pagination
    const offset = options?.offset || 0
    const limit = options?.limit || result.length
    result = result.slice(offset, offset + limit)

    return result
  }

  // ==================== Feature Operations ====================

  /**
   * Add a feature to a product
   */
  async addFeature(productId: string, featureData: Partial<FeatureData>): Promise<FeatureData> {
    const product = products.get(productId)
    if (!product) {
      throw new Error(`Product not found: ${productId}`)
    }

    if (!featureData.name || !featureData.description) {
      throw new Error('Missing required fields: name and description are required')
    }

    const now = new Date()
    const feature: FeatureData = {
      id: featureData.id || generateId(),
      name: featureData.name,
      description: featureData.description,
      status: featureData.status || 'draft',
      productId,
      metadata: featureData.metadata,
      createdAt: now,
      updatedAt: now,
    }

    features.set(feature.id, feature)
    return feature
  }

  /**
   * Update a feature
   */
  async updateFeature(featureId: string, data: Partial<FeatureData>): Promise<FeatureData> {
    const existing = features.get(featureId)
    if (!existing) {
      throw new Error(`Feature not found: ${featureId}`)
    }

    const updated: FeatureData = {
      ...existing,
      ...data,
      id: existing.id,
      productId: existing.productId,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    }

    features.set(featureId, updated)
    return updated
  }

  /**
   * Remove a feature
   */
  async removeFeature(featureId: string): Promise<boolean> {
    return features.delete(featureId)
  }

  /**
   * List features for a product
   */
  async listFeatures(productId: string): Promise<FeatureData[]> {
    return Array.from(features.values()).filter((f) => f.productId === productId)
  }

  // ==================== Version Operations ====================

  /**
   * Publish a new version
   */
  async publish(productId: string, versionStr: string, changelog?: string): Promise<VersionData> {
    const product = products.get(productId)
    if (!product) {
      throw new Error(`Product not found: ${productId}`)
    }

    // Check for duplicate version
    const existingVersion = Array.from(versions.values()).find(
      (v) => v.productId === productId && v.version === versionStr
    )
    if (existingVersion) {
      throw new Error(`Version ${versionStr} already exists for product ${productId}`)
    }

    const now = new Date()
    const version: VersionData = {
      id: generateId(),
      productId,
      version: versionStr,
      changelog,
      status: 'published',
      createdAt: now,
      publishedAt: now,
    }

    versions.set(version.id, version)
    return version
  }

  /**
   * List versions for a product
   */
  async listVersions(productId: string): Promise<VersionData[]> {
    return Array.from(versions.values()).filter((v) => v.productId === productId)
  }

  /**
   * Get a specific version
   */
  async getVersion(productId: string, versionStr: string): Promise<VersionData | null> {
    return (
      Array.from(versions.values()).find(
        (v) => v.productId === productId && v.version === versionStr
      ) || null
    )
  }

  /**
   * Deprecate a version
   */
  async deprecateVersion(productId: string, versionStr: string): Promise<VersionData> {
    const version = Array.from(versions.values()).find(
      (v) => v.productId === productId && v.version === versionStr
    )

    if (!version) {
      throw new Error(`Version ${versionStr} not found for product ${productId}`)
    }

    version.status = 'deprecated'
    versions.set(version.id, version)
    return version
  }

  // ==================== Bundle Operations ====================

  /**
   * Compose a bundle from multiple products
   */
  async compose(
    name: string,
    productIds: string[],
    options?: Partial<BundleData>
  ): Promise<BundleData> {
    if (!productIds || productIds.length === 0) {
      throw new Error('Bundle must contain at least one product')
    }

    // Verify all products exist
    for (const productId of productIds) {
      if (!products.has(productId)) {
        throw new Error(`Product not found: ${productId}`)
      }
    }

    const now = new Date()
    const bundle: BundleData = {
      id: generateId(),
      name,
      description: options?.description || '',
      productIds,
      pricing: options?.pricing,
      metadata: options?.metadata,
      createdAt: now,
      updatedAt: now,
    }

    bundles.set(bundle.id, bundle)
    return bundle
  }

  /**
   * Get a bundle by ID
   */
  async getBundle(bundleId: string): Promise<BundleData | null> {
    return bundles.get(bundleId) || null
  }

  /**
   * Update a bundle
   */
  async updateBundle(bundleId: string, data: Partial<BundleData>): Promise<BundleData> {
    const existing = bundles.get(bundleId)
    if (!existing) {
      throw new Error(`Bundle not found: ${bundleId}`)
    }

    const updated: BundleData = {
      ...existing,
      ...data,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    }

    bundles.set(bundleId, updated)
    return updated
  }

  /**
   * List all bundles
   */
  async listBundles(): Promise<BundleData[]> {
    return Array.from(bundles.values())
  }
}

// =============================================================================
// ProductService (WorkerEntrypoint)
// =============================================================================

/**
 * ProductService - WorkerEntrypoint for RPC access
 *
 * Provides `connect()` method that returns a ProductServiceCore instance
 * with all product management operations.
 */
export class ProductService extends WorkerEntrypoint<Env> {
  /**
   * Connect and get an RPC-enabled service
   *
   * @returns ProductServiceCore instance for RPC calls
   */
  connect(): ProductServiceCore {
    return new ProductServiceCore(this.env)
  }
}

/**
 * Default export for Cloudflare Workers
 */
export default ProductService
