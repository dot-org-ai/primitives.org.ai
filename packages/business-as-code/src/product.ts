/**
 * Product definition and management
 */

import type { ProductDefinition, RoadmapItem } from './types.js'

/**
 * Define a product with pricing, features, and roadmap
 *
 * @example
 * ```ts
 * const product = Product({
 *   name: 'Widget Pro',
 *   description: 'Enterprise-grade widget management platform',
 *   category: 'SaaS',
 *   targetSegment: 'Enterprise',
 *   valueProposition: 'Reduce widget management costs by 50%',
 *   pricingModel: 'subscription',
 *   price: 99,
 *   currency: 'USD',
 *   cogs: 20,
 *   features: [
 *     'Unlimited widgets',
 *     'Advanced analytics',
 *     'API access',
 *     '24/7 support',
 *   ],
 *   roadmap: [
 *     {
 *       name: 'Mobile app',
 *       description: 'Native iOS and Android apps',
 *       targetDate: new Date('2024-09-01'),
 *       priority: 'high',
 *       status: 'in-progress',
 *     },
 *     {
 *       name: 'AI-powered insights',
 *       description: 'Automated widget optimization suggestions',
 *       targetDate: new Date('2024-12-01'),
 *       priority: 'high',
 *       status: 'planned',
 *     },
 *   ],
 * })
 * ```
 */
export function Product(definition: ProductDefinition): ProductDefinition {
  if (!definition.name) {
    throw new Error('Product name is required')
  }

  return {
    ...definition,
    pricingModel: definition.pricingModel || 'one-time',
    currency: definition.currency || 'USD',
    features: definition.features || [],
    roadmap: definition.roadmap || [],
    metadata: definition.metadata || {},
  }
}

/**
 * Calculate gross margin for a product
 */
export function calculateGrossMargin(product: ProductDefinition): number {
  if (!product.price || !product.cogs) return 0
  return ((product.price - product.cogs) / product.price) * 100
}

/**
 * Calculate gross profit for a product
 */
export function calculateGrossProfit(product: ProductDefinition, unitsSold: number): number {
  if (!product.price || !product.cogs) return 0
  return (product.price - product.cogs) * unitsSold
}

/**
 * Get roadmap items by status
 */
export function getRoadmapByStatus(
  product: ProductDefinition,
  status: RoadmapItem['status']
): RoadmapItem[] {
  return product.roadmap?.filter(item => item.status === status) || []
}

/**
 * Get roadmap items by priority
 */
export function getRoadmapByPriority(
  product: ProductDefinition,
  priority: RoadmapItem['priority']
): RoadmapItem[] {
  return product.roadmap?.filter(item => item.priority === priority) || []
}

/**
 * Get overdue roadmap items
 */
export function getOverdueRoadmapItems(product: ProductDefinition): RoadmapItem[] {
  const now = new Date()
  return (
    product.roadmap?.filter(
      item =>
        item.targetDate &&
        item.targetDate < now &&
        item.status !== 'completed' &&
        item.status !== 'cancelled'
    ) || []
  )
}

/**
 * Update roadmap item status
 */
export function updateRoadmapItem(
  product: ProductDefinition,
  itemName: string,
  updates: Partial<RoadmapItem>
): ProductDefinition {
  const roadmap = product.roadmap?.map(item =>
    item.name === itemName ? { ...item, ...updates } : item
  )

  return {
    ...product,
    roadmap,
  }
}

/**
 * Add feature to product
 */
export function addFeature(product: ProductDefinition, feature: string): ProductDefinition {
  return {
    ...product,
    features: [...(product.features || []), feature],
  }
}

/**
 * Remove feature from product
 */
export function removeFeature(product: ProductDefinition, feature: string): ProductDefinition {
  return {
    ...product,
    features: product.features?.filter(f => f !== feature) || [],
  }
}

/**
 * Validate product definition
 */
export function validateProduct(product: ProductDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!product.name) {
    errors.push('Product name is required')
  }

  if (product.price && product.price < 0) {
    errors.push('Product price cannot be negative')
  }

  if (product.cogs && product.cogs < 0) {
    errors.push('Product COGS cannot be negative')
  }

  if (product.price && product.cogs && product.cogs > product.price) {
    errors.push('Product COGS cannot exceed price')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
