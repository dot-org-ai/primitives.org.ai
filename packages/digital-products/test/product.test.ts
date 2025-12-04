/**
 * Tests for Product functionality
 *
 * Covers product creation and registration.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Product, createProduct, registerProduct, registry } from '../src/index.js'

describe('Product', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('Product creation', () => {
    it('creates a product with basic config', () => {
      const product = Product({
        id: 'my-product',
        name: 'My Product',
        description: 'A digital product',
        version: '1.0.0',
      })

      expect(product.id).toBe('my-product')
      expect(product.name).toBe('My Product')
      expect(product.description).toBe('A digital product')
      expect(product.version).toBe('1.0.0')
    })

    it('defaults status to active', () => {
      const product = Product({
        id: 'test',
        name: 'Test',
        description: 'Test product',
        version: '1.0.0',
      })

      expect(product.status).toBe('active')
    })

    it('allows custom status', () => {
      const product = Product({
        id: 'test',
        name: 'Test',
        description: 'Test product',
        version: '1.0.0',
        status: 'deprecated',
      })

      expect(product.status).toBe('deprecated')
    })

    it('supports metadata', () => {
      const product = Product({
        id: 'test',
        name: 'Test',
        description: 'Test product',
        version: '1.0.0',
        metadata: { author: 'John', license: 'MIT' },
      })

      expect(product.metadata).toEqual({ author: 'John', license: 'MIT' })
    })

    it('supports tags', () => {
      const product = Product({
        id: 'test',
        name: 'Test',
        description: 'Test product',
        version: '1.0.0',
        tags: ['api', 'production'],
      })

      expect(product.tags).toEqual(['api', 'production'])
    })
  })

  describe('createProduct', () => {
    it('creates a product', () => {
      const product = createProduct({
        id: 'created-product',
        name: 'Created Product',
        description: 'A created product',
        version: '1.0.0',
      })

      expect(product.id).toBe('created-product')
      expect(product.name).toBe('Created Product')
    })
  })

  describe('registerProduct', () => {
    it('registers a product in the registry', () => {
      const product = Product({
        id: 'registered-product',
        name: 'Registered',
        description: 'Registered product',
        version: '1.0.0',
      })

      registerProduct(product)

      expect(registry.get('registered-product')).toBeDefined()
    })

    it('returns the registered product', () => {
      const product = Product({
        id: 'returned-product',
        name: 'Returned',
        description: 'Returned product',
        version: '1.0.0',
      })

      const result = registerProduct(product)

      expect(result).toBe(product)
    })
  })
})

describe('Registry', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('register', () => {
    it('adds a product to the registry', () => {
      const product = Product({
        id: 'test-product',
        name: 'Test',
        description: 'Test',
        version: '1.0.0',
      })

      registerProduct(product)

      expect(registry.get('test-product')).toEqual(product)
    })
  })

  describe('get', () => {
    it('returns product by id', () => {
      const product = Product({
        id: 'get-test',
        name: 'Get Test',
        description: 'Test',
        version: '1.0.0',
      })

      registerProduct(product)

      expect(registry.get('get-test')?.name).toBe('Get Test')
    })

    it('returns undefined for non-existent id', () => {
      expect(registry.get('non-existent')).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns all products', () => {
      registerProduct(Product({ id: 'p1', name: 'P1', description: 'D1', version: '1.0.0' }))
      registerProduct(Product({ id: 'p2', name: 'P2', description: 'D2', version: '1.0.0' }))

      const products = registry.list()

      expect(products).toHaveLength(2)
    })

    it('returns empty array when no products', () => {
      expect(registry.list()).toHaveLength(0)
    })
  })

  describe('remove', () => {
    it('removes a product from the registry', () => {
      registerProduct(Product({ id: 'to-remove', name: 'Remove', description: 'D', version: '1.0.0' }))

      const result = registry.remove('to-remove')

      expect(result).toBe(true)
      expect(registry.get('to-remove')).toBeUndefined()
    })

    it('returns false for non-existent product', () => {
      expect(registry.remove('non-existent')).toBe(false)
    })
  })

  describe('clear', () => {
    it('removes all products', () => {
      registerProduct(Product({ id: 'p1', name: 'P1', description: 'D1', version: '1.0.0' }))
      registerProduct(Product({ id: 'p2', name: 'P2', description: 'D2', version: '1.0.0' }))

      registry.clear()

      expect(registry.list()).toHaveLength(0)
    })
  })
})
