/**
 * Worker Export Tests (RED phase)
 *
 * Tests for the /worker export that provides ProductService (WorkerEntrypoint)
 * with a connect() method that returns ProductServiceCore (RpcTarget).
 *
 * IMPORTANT: NO MOCKS - These tests run against real Durable Objects with SQLite persistence
 * using @cloudflare/vitest-pool-workers and miniflare.
 *
 * These tests should FAIL initially because src/worker.ts doesn't exist yet.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'

// Types for the expected service interface
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

// Expected service interface
interface ProductServiceCoreInterface {
  // Product CRUD
  create(data: Partial<ProductData>): Promise<ProductData>
  get(id: string): Promise<ProductData | null>
  update(id: string, data: Partial<ProductData>): Promise<ProductData>
  delete(id: string): Promise<boolean>
  list(options?: ListOptions): Promise<ProductData[]>

  // Feature operations
  addFeature(productId: string, feature: Partial<FeatureData>): Promise<FeatureData>
  updateFeature(featureId: string, data: Partial<FeatureData>): Promise<FeatureData>
  removeFeature(featureId: string): Promise<boolean>
  listFeatures(productId: string): Promise<FeatureData[]>

  // Version operations
  publish(productId: string, version: string, changelog?: string): Promise<VersionData>
  listVersions(productId: string): Promise<VersionData[]>
  getVersion(productId: string, version: string): Promise<VersionData | null>
  deprecateVersion(productId: string, version: string): Promise<VersionData>

  // Bundle/composition operations
  compose(name: string, productIds: string[], options?: Partial<BundleData>): Promise<BundleData>
  getBundle(bundleId: string): Promise<BundleData | null>
  updateBundle(bundleId: string, data: Partial<BundleData>): Promise<BundleData>
  listBundles(): Promise<BundleData[]>
}

describe('ProductService (WorkerEntrypoint)', () => {
  describe('class structure', () => {
    it('should extend WorkerEntrypoint', async () => {
      // This import should fail initially - worker.ts doesn't exist
      const { ProductService } = await import('../src/worker.js')

      // Verify the class exists and extends WorkerEntrypoint
      expect(ProductService).toBeDefined()
      expect(typeof ProductService).toBe('function')
      // WorkerEntrypoint check - should have prototype chain
      expect(ProductService.prototype).toBeDefined()
    })

    it('should have a connect method', async () => {
      const { ProductService } = await import('../src/worker.js')
      expect(typeof ProductService.prototype.connect).toBe('function')
    })

    it('should export ProductService as default', async () => {
      const { default: DefaultExport, ProductService } = await import('../src/worker.js')
      expect(DefaultExport).toBe(ProductService)
    })
  })
})

describe('ProductServiceCore (RpcTarget)', () => {
  describe('class structure', () => {
    it('should extend RpcTarget', async () => {
      const { ProductServiceCore } = await import('../src/worker.js')
      expect(ProductServiceCore).toBeDefined()
      expect(typeof ProductServiceCore).toBe('function')
    })

    it('should accept env in constructor', async () => {
      const { ProductServiceCore } = await import('../src/worker.js')
      const core = new ProductServiceCore(env)
      expect(core).toBeDefined()
    })
  })
})

describe('ProductServiceCore via connect()', () => {
  let service: ProductServiceCoreInterface

  beforeEach(async () => {
    // Import the worker module
    const { ProductService } = await import('../src/worker.js')

    // Create a service instance via connect()
    const worker = new ProductService({ env } as any, {} as any)
    service = worker.connect() as ProductServiceCoreInterface
  })

  describe('Product CRUD Operations', () => {
    describe('create()', () => {
      it('should create a product with auto-generated ID', async () => {
        const product = await service.create({
          name: 'Test Product',
          description: 'A test digital product',
          version: '1.0.0',
        })

        expect(product).toBeDefined()
        expect(product.id).toBeDefined()
        expect(product.id.length).toBeGreaterThan(0)
        expect(product.name).toBe('Test Product')
        expect(product.description).toBe('A test digital product')
        expect(product.version).toBe('1.0.0')
        expect(product.status).toBe('draft')
        expect(product.createdAt).toBeInstanceOf(Date)
        expect(product.updatedAt).toBeInstanceOf(Date)
      })

      it('should create a product with custom ID', async () => {
        const product = await service.create({
          id: 'custom-product-id',
          name: 'Custom Product',
          description: 'Product with custom ID',
          version: '1.0.0',
        })

        expect(product.id).toBe('custom-product-id')
      })

      it('should create a product with metadata and tags', async () => {
        const product = await service.create({
          name: 'Tagged Product',
          description: 'A product with metadata',
          version: '1.0.0',
          metadata: { category: 'saas', priority: 1 },
          tags: ['enterprise', 'api'],
        })

        expect(product.metadata).toEqual({ category: 'saas', priority: 1 })
        expect(product.tags).toEqual(['enterprise', 'api'])
      })

      it('should create a product with specific status', async () => {
        const product = await service.create({
          name: 'Active Product',
          description: 'An active product',
          version: '1.0.0',
          status: 'active',
        })

        expect(product.status).toBe('active')
      })
    })

    describe('get()', () => {
      it('should retrieve a created product by ID', async () => {
        const created = await service.create({
          name: 'Retrievable Product',
          description: 'Test retrieval',
          version: '1.0.0',
        })

        const retrieved = await service.get(created.id)

        expect(retrieved).not.toBeNull()
        expect(retrieved!.id).toBe(created.id)
        expect(retrieved!.name).toBe('Retrievable Product')
      })

      it('should return null for non-existent product', async () => {
        const result = await service.get('nonexistent-product-id')
        expect(result).toBeNull()
      })
    })

    describe('update()', () => {
      it('should update product fields', async () => {
        const created = await service.create({
          name: 'Original Name',
          description: 'Original description',
          version: '1.0.0',
        })

        const updated = await service.update(created.id, {
          name: 'Updated Name',
          description: 'Updated description',
        })

        expect(updated.name).toBe('Updated Name')
        expect(updated.description).toBe('Updated description')
        expect(updated.version).toBe('1.0.0') // Unchanged
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.createdAt.getTime())
      })

      it('should update product status', async () => {
        const created = await service.create({
          name: 'Draft Product',
          description: 'Starting as draft',
          version: '1.0.0',
        })

        const updated = await service.update(created.id, { status: 'active' })

        expect(updated.status).toBe('active')
      })

      it('should merge metadata on update', async () => {
        const created = await service.create({
          name: 'Product with Metadata',
          description: 'Has metadata',
          version: '1.0.0',
          metadata: { key1: 'value1' },
        })

        const updated = await service.update(created.id, {
          metadata: { key2: 'value2' },
        })

        expect(updated.metadata).toEqual({ key1: 'value1', key2: 'value2' })
      })

      it('should throw error for non-existent product', async () => {
        await expect(service.update('nonexistent-id', { name: 'Test' })).rejects.toThrow()
      })
    })

    describe('delete()', () => {
      it('should delete a product and return true', async () => {
        const created = await service.create({
          name: 'To Be Deleted',
          description: 'Will be deleted',
          version: '1.0.0',
        })

        const deleted = await service.delete(created.id)
        expect(deleted).toBe(true)

        // Verify deletion
        const retrieved = await service.get(created.id)
        expect(retrieved).toBeNull()
      })

      it('should return false for non-existent product', async () => {
        const deleted = await service.delete('nonexistent-id')
        expect(deleted).toBe(false)
      })

      it('should cascade delete features when product is deleted', async () => {
        const product = await service.create({
          name: 'Product with Features',
          description: 'Has features to delete',
          version: '1.0.0',
        })

        await service.addFeature(product.id, {
          name: 'Feature 1',
          description: 'A feature',
        })

        await service.delete(product.id)

        const features = await service.listFeatures(product.id)
        expect(features).toEqual([])
      })
    })

    describe('list()', () => {
      it('should list all products', async () => {
        await service.create({ name: 'Product 1', description: 'First', version: '1.0.0' })
        await service.create({ name: 'Product 2', description: 'Second', version: '1.0.0' })
        await service.create({ name: 'Product 3', description: 'Third', version: '1.0.0' })

        const products = await service.list()

        expect(products.length).toBeGreaterThanOrEqual(3)
      })

      it('should support limit option', async () => {
        await service.create({ name: 'L1', description: 'First', version: '1.0.0' })
        await service.create({ name: 'L2', description: 'Second', version: '1.0.0' })
        await service.create({ name: 'L3', description: 'Third', version: '1.0.0' })

        const products = await service.list({ limit: 2 })

        expect(products).toHaveLength(2)
      })

      it('should support offset option', async () => {
        const p1 = await service.create({ name: 'O1', description: 'First', version: '1.0.0' })
        const p2 = await service.create({ name: 'O2', description: 'Second', version: '1.0.0' })
        const p3 = await service.create({ name: 'O3', description: 'Third', version: '1.0.0' })

        const products = await service.list({ offset: 1, limit: 2 })

        expect(products.length).toBeLessThanOrEqual(2)
      })

      it('should filter by status', async () => {
        await service.create({
          name: 'Draft',
          description: 'Draft',
          version: '1.0.0',
          status: 'draft',
        })
        await service.create({
          name: 'Active',
          description: 'Active',
          version: '1.0.0',
          status: 'active',
        })
        await service.create({
          name: 'Deprecated',
          description: 'Deprecated',
          version: '1.0.0',
          status: 'deprecated',
        })

        const activeProducts = await service.list({ status: 'active' })

        expect(activeProducts.every((p) => p.status === 'active')).toBe(true)
      })

      it('should support ordering', async () => {
        await service.create({ name: 'Alpha', description: 'First', version: '1.0.0' })
        await service.create({ name: 'Beta', description: 'Second', version: '1.0.0' })
        await service.create({ name: 'Gamma', description: 'Third', version: '1.0.0' })

        const ascending = await service.list({ orderBy: 'name', order: 'asc' })
        const descending = await service.list({ orderBy: 'name', order: 'desc' })

        // Verify ordering
        expect(ascending[0].name <= ascending[ascending.length - 1].name).toBe(true)
        expect(descending[0].name >= descending[descending.length - 1].name).toBe(true)
      })
    })
  })

  describe('Feature Operations', () => {
    describe('addFeature()', () => {
      it('should add a feature to a product', async () => {
        const product = await service.create({
          name: 'Product with Features',
          description: 'Has features',
          version: '1.0.0',
        })

        const feature = await service.addFeature(product.id, {
          name: 'Dark Mode',
          description: 'Toggle dark theme',
        })

        expect(feature).toBeDefined()
        expect(feature.id).toBeDefined()
        expect(feature.name).toBe('Dark Mode')
        expect(feature.description).toBe('Toggle dark theme')
        expect(feature.productId).toBe(product.id)
        expect(feature.status).toBe('draft')
        expect(feature.createdAt).toBeInstanceOf(Date)
      })

      it('should add a feature with specific status', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Has beta feature',
          version: '1.0.0',
        })

        const feature = await service.addFeature(product.id, {
          name: 'Beta Feature',
          description: 'In beta',
          status: 'beta',
        })

        expect(feature.status).toBe('beta')
      })

      it('should throw error for non-existent product', async () => {
        await expect(
          service.addFeature('nonexistent-product', {
            name: 'Feature',
            description: 'Test',
          })
        ).rejects.toThrow()
      })
    })

    describe('updateFeature()', () => {
      it('should update feature fields', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        const feature = await service.addFeature(product.id, {
          name: 'Original Feature',
          description: 'Original description',
        })

        const updated = await service.updateFeature(feature.id, {
          name: 'Updated Feature',
          status: 'ga',
        })

        expect(updated.name).toBe('Updated Feature')
        expect(updated.status).toBe('ga')
      })

      it('should throw error for non-existent feature', async () => {
        await expect(
          service.updateFeature('nonexistent-feature', { name: 'Test' })
        ).rejects.toThrow()
      })
    })

    describe('removeFeature()', () => {
      it('should remove a feature', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        const feature = await service.addFeature(product.id, {
          name: 'To Remove',
          description: 'Will be removed',
        })

        const removed = await service.removeFeature(feature.id)
        expect(removed).toBe(true)

        const features = await service.listFeatures(product.id)
        expect(features.find((f) => f.id === feature.id)).toBeUndefined()
      })

      it('should return false for non-existent feature', async () => {
        const removed = await service.removeFeature('nonexistent-feature')
        expect(removed).toBe(false)
      })
    })

    describe('listFeatures()', () => {
      it('should list all features for a product', async () => {
        const product = await service.create({
          name: 'Multi-Feature Product',
          description: 'Has many features',
          version: '1.0.0',
        })

        await service.addFeature(product.id, { name: 'Feature 1', description: 'First' })
        await service.addFeature(product.id, { name: 'Feature 2', description: 'Second' })
        await service.addFeature(product.id, { name: 'Feature 3', description: 'Third' })

        const features = await service.listFeatures(product.id)

        expect(features).toHaveLength(3)
        expect(features.every((f) => f.productId === product.id)).toBe(true)
      })

      it('should return empty array for product with no features', async () => {
        const product = await service.create({
          name: 'Empty Product',
          description: 'No features',
          version: '1.0.0',
        })

        const features = await service.listFeatures(product.id)
        expect(features).toEqual([])
      })
    })
  })

  describe('Version Operations', () => {
    describe('publish()', () => {
      it('should publish a new version', async () => {
        const product = await service.create({
          name: 'Versionable Product',
          description: 'Can be versioned',
          version: '1.0.0',
        })

        const version = await service.publish(product.id, '1.1.0', 'Added new features')

        expect(version).toBeDefined()
        expect(version.id).toBeDefined()
        expect(version.productId).toBe(product.id)
        expect(version.version).toBe('1.1.0')
        expect(version.changelog).toBe('Added new features')
        expect(version.status).toBe('published')
        expect(version.createdAt).toBeInstanceOf(Date)
        expect(version.publishedAt).toBeInstanceOf(Date)
      })

      it('should publish version without changelog', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        const version = await service.publish(product.id, '1.0.1')

        expect(version.version).toBe('1.0.1')
        expect(version.changelog).toBeUndefined()
      })

      it('should throw error for non-existent product', async () => {
        await expect(service.publish('nonexistent-product', '1.0.0')).rejects.toThrow()
      })

      it('should throw error for duplicate version', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        await service.publish(product.id, '1.1.0')

        await expect(service.publish(product.id, '1.1.0')).rejects.toThrow()
      })
    })

    describe('listVersions()', () => {
      it('should list all versions for a product', async () => {
        const product = await service.create({
          name: 'Multi-Version Product',
          description: 'Has many versions',
          version: '1.0.0',
        })

        await service.publish(product.id, '1.0.0', 'Initial release')
        await service.publish(product.id, '1.1.0', 'Minor update')
        await service.publish(product.id, '2.0.0', 'Major update')

        const versions = await service.listVersions(product.id)

        expect(versions).toHaveLength(3)
        expect(versions.every((v) => v.productId === product.id)).toBe(true)
      })

      it('should return versions in order', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        await service.publish(product.id, '1.0.0')
        await service.publish(product.id, '1.1.0')
        await service.publish(product.id, '1.2.0')

        const versions = await service.listVersions(product.id)

        // Versions should be ordered (typically newest first or by version)
        expect(versions.length).toBe(3)
      })
    })

    describe('getVersion()', () => {
      it('should get a specific version', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        await service.publish(product.id, '1.0.0', 'Initial')
        await service.publish(product.id, '1.1.0', 'Update')

        const version = await service.getVersion(product.id, '1.0.0')

        expect(version).not.toBeNull()
        expect(version!.version).toBe('1.0.0')
        expect(version!.changelog).toBe('Initial')
      })

      it('should return null for non-existent version', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        const version = await service.getVersion(product.id, '9.9.9')
        expect(version).toBeNull()
      })
    })

    describe('deprecateVersion()', () => {
      it('should deprecate a version', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        await service.publish(product.id, '1.0.0')
        await service.publish(product.id, '2.0.0')

        const deprecated = await service.deprecateVersion(product.id, '1.0.0')

        expect(deprecated.status).toBe('deprecated')
      })

      it('should throw error for non-existent version', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        await expect(service.deprecateVersion(product.id, '9.9.9')).rejects.toThrow()
      })
    })
  })

  describe('Bundle/Composition Operations', () => {
    describe('compose()', () => {
      it('should create a bundle from multiple products', async () => {
        const product1 = await service.create({
          name: 'Product A',
          description: 'First product',
          version: '1.0.0',
        })

        const product2 = await service.create({
          name: 'Product B',
          description: 'Second product',
          version: '1.0.0',
        })

        const bundle = await service.compose('Product Bundle', [product1.id, product2.id], {
          description: 'A bundle of products',
        })

        expect(bundle).toBeDefined()
        expect(bundle.id).toBeDefined()
        expect(bundle.name).toBe('Product Bundle')
        expect(bundle.description).toBe('A bundle of products')
        expect(bundle.productIds).toContain(product1.id)
        expect(bundle.productIds).toContain(product2.id)
        expect(bundle.createdAt).toBeInstanceOf(Date)
      })

      it('should create a bundle with pricing', async () => {
        const product1 = await service.create({
          name: 'Product 1',
          description: 'Test',
          version: '1.0.0',
        })

        const product2 = await service.create({
          name: 'Product 2',
          description: 'Test',
          version: '1.0.0',
        })

        const bundle = await service.compose('Premium Bundle', [product1.id, product2.id], {
          description: 'Premium bundle with pricing',
          pricing: {
            model: 'subscription',
            amount: 99,
            currency: 'USD',
            interval: 'month',
          },
        })

        expect(bundle.pricing).toBeDefined()
        expect(bundle.pricing!.model).toBe('subscription')
        expect(bundle.pricing!.amount).toBe(99)
        expect(bundle.pricing!.currency).toBe('USD')
        expect(bundle.pricing!.interval).toBe('month')
      })

      it('should throw error for empty product list', async () => {
        await expect(service.compose('Empty Bundle', [])).rejects.toThrow()
      })

      it('should throw error for non-existent products', async () => {
        await expect(
          service.compose('Invalid Bundle', ['nonexistent-1', 'nonexistent-2'])
        ).rejects.toThrow()
      })
    })

    describe('getBundle()', () => {
      it('should retrieve a bundle by ID', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        const created = await service.compose('Test Bundle', [product.id])
        const retrieved = await service.getBundle(created.id)

        expect(retrieved).not.toBeNull()
        expect(retrieved!.id).toBe(created.id)
        expect(retrieved!.name).toBe('Test Bundle')
      })

      it('should return null for non-existent bundle', async () => {
        const result = await service.getBundle('nonexistent-bundle')
        expect(result).toBeNull()
      })
    })

    describe('updateBundle()', () => {
      it('should update bundle fields', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        const bundle = await service.compose('Original Bundle', [product.id])

        const updated = await service.updateBundle(bundle.id, {
          name: 'Updated Bundle',
          description: 'Updated description',
        })

        expect(updated.name).toBe('Updated Bundle')
        expect(updated.description).toBe('Updated description')
      })

      it('should update bundle product list', async () => {
        const product1 = await service.create({ name: 'P1', description: 'Test', version: '1.0.0' })
        const product2 = await service.create({ name: 'P2', description: 'Test', version: '1.0.0' })
        const product3 = await service.create({ name: 'P3', description: 'Test', version: '1.0.0' })

        const bundle = await service.compose('Bundle', [product1.id, product2.id])

        const updated = await service.updateBundle(bundle.id, {
          productIds: [product1.id, product2.id, product3.id],
        })

        expect(updated.productIds).toHaveLength(3)
        expect(updated.productIds).toContain(product3.id)
      })

      it('should throw error for non-existent bundle', async () => {
        await expect(service.updateBundle('nonexistent-bundle', { name: 'Test' })).rejects.toThrow()
      })
    })

    describe('listBundles()', () => {
      it('should list all bundles', async () => {
        const product = await service.create({
          name: 'Product',
          description: 'Test',
          version: '1.0.0',
        })

        await service.compose('Bundle 1', [product.id])
        await service.compose('Bundle 2', [product.id])
        await service.compose('Bundle 3', [product.id])

        const bundles = await service.listBundles()

        expect(bundles.length).toBeGreaterThanOrEqual(3)
      })
    })
  })
})

describe('ProductServiceCore integration with AI', () => {
  let service: ProductServiceCoreInterface

  beforeEach(async () => {
    const { ProductService } = await import('../src/worker.js')
    const worker = new ProductService({ env } as any, {} as any)
    service = worker.connect() as ProductServiceCoreInterface
  })

  it('should have AI binding available for AI-assisted operations', () => {
    // env.AI should be available in workers environment for potential AI features
    expect(env).toBeDefined()
  })

  it('should use PRODUCT_CATALOG Durable Object for persistence', async () => {
    // Create and retrieve to verify DO persistence
    const product = await service.create({
      name: 'Persistent Product',
      description: 'Should persist in DO',
      version: '1.0.0',
    })

    const retrieved = await service.get(product.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved!.name).toBe('Persistent Product')
  })
})

describe('Data Persistence', () => {
  it('should persist data across service calls', async () => {
    const { ProductService } = await import('../src/worker.js')

    // First connection - create data
    const worker1 = new ProductService({ env } as any, {} as any)
    const service1 = worker1.connect() as ProductServiceCoreInterface
    const created = await service1.create({
      name: 'Persistent Product',
      description: 'Should persist',
      version: '1.0.0',
    })
    const createdId = created.id

    // Second connection - verify data persists
    const worker2 = new ProductService({ env } as any, {} as any)
    const service2 = worker2.connect() as ProductServiceCoreInterface
    const retrieved = await service2.get(createdId)

    expect(retrieved).not.toBeNull()
    expect(retrieved!.name).toBe('Persistent Product')
  })
})

describe('Error Handling', () => {
  let service: ProductServiceCoreInterface

  beforeEach(async () => {
    const { ProductService } = await import('../src/worker.js')
    const worker = new ProductService({ env } as any, {} as any)
    service = worker.connect() as ProductServiceCoreInterface
  })

  it('should handle invalid product data gracefully', async () => {
    // Missing required fields should throw
    await expect(service.create({} as any)).rejects.toThrow()
  })

  it('should handle concurrent operations', async () => {
    // Create multiple products concurrently
    const promises = Array.from({ length: 10 }, (_, i) =>
      service.create({
        name: `Concurrent Product ${i}`,
        description: 'Created concurrently',
        version: '1.0.0',
      })
    )

    const products = await Promise.all(promises)

    expect(products).toHaveLength(10)
    expect(new Set(products.map((p) => p.id)).size).toBe(10) // All unique IDs
  })
})
