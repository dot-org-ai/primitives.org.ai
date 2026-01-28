/**
 * Generic Product() constructor
 */

import type { DigitalProduct, ProductDefinition } from './types.js'
import { registry } from './registry.js'

/**
 * Create a generic digital product definition
 *
 * @example
 * ```ts
 * const product = Product({
 *   id: 'my-product',
 *   name: 'My Product',
 *   description: 'A digital product',
 *   version: '1.0.0',
 * })
 * ```
 */
export function Product(config: Omit<DigitalProduct, 'type'>): DigitalProduct {
  const product: DigitalProduct = {
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    status: config.status || 'active',
    ...(config.metadata !== undefined && { metadata: config.metadata }),
    ...(config.tags !== undefined && { tags: config.tags }),
  }

  return product
}

/**
 * Create and register a product in one step
 *
 * @example
 * ```ts
 * const product = createProduct({
 *   id: 'my-product',
 *   name: 'My Product',
 *   description: 'A digital product',
 *   version: '1.0.0',
 * })
 * ```
 */
export function createProduct(config: Omit<DigitalProduct, 'type'>): DigitalProduct {
  const product = Product(config)
  return product
}

/**
 * Create and register any product definition
 */
export function registerProduct<T extends ProductDefinition>(product: T): T {
  registry.register(product)
  return product
}
