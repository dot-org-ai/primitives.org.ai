/**
 * Service definition and management
 */

import type { ServiceDefinition } from './types.js'

/**
 * Define a service with pricing, SLA, and delivery information
 *
 * @example
 * ```ts
 * const service = Service({
 *   name: 'Widget Consulting',
 *   description: 'Expert widget implementation and optimization',
 *   category: 'Consulting',
 *   targetSegment: 'Enterprise',
 *   valueProposition: 'Get expert help implementing widgets in 2 weeks',
 *   pricingModel: 'fixed',
 *   price: 5000,
 *   currency: 'USD',
 *   deliveryTime: '2 weeks',
 *   sla: {
 *     uptime: 99.9,
 *     responseTime: '< 24 hours',
 *     supportHours: 'Business hours (9-5 EST)',
 *     penalties: '10% refund per day of delay',
 *   },
 * })
 * ```
 */
export function Service(definition: ServiceDefinition): ServiceDefinition {
  if (!definition.name) {
    throw new Error('Service name is required')
  }

  return {
    ...definition,
    pricingModel: definition.pricingModel || 'hourly',
    currency: definition.currency || 'USD',
    metadata: definition.metadata || {},
  }
}

/**
 * Calculate service price based on hours (for hourly pricing)
 */
export function calculateHourlyPrice(service: ServiceDefinition, hours: number): number {
  if (service.pricingModel !== 'hourly' || !service.price) {
    throw new Error('Service must use hourly pricing model')
  }
  return service.price * hours
}

/**
 * Calculate monthly retainer equivalent
 */
export function calculateMonthlyRetainer(service: ServiceDefinition, hoursPerMonth: number): number {
  if (service.pricingModel !== 'hourly' || !service.price) {
    throw new Error('Service must use hourly pricing model')
  }
  return service.price * hoursPerMonth
}

/**
 * Check if service meets SLA uptime requirement
 */
export function checkSLAUptime(service: ServiceDefinition, actualUptime: number): boolean {
  if (!service.sla?.uptime) return true
  return actualUptime >= service.sla.uptime
}

/**
 * Parse delivery time to days
 */
export function parseDeliveryTimeToDays(deliveryTime?: string): number {
  if (!deliveryTime) return 0

  const lower = deliveryTime.toLowerCase()

  // Parse patterns like "2 weeks", "3 days", "1 month"
  const match = lower.match(/(\d+)\s*(day|days|week|weeks|month|months|hour|hours)/)
  if (!match) return 0

  const value = parseInt(match[1] || '0', 10)
  const unit = match[2]

  switch (unit) {
    case 'hour':
    case 'hours':
      return value / 24
    case 'day':
    case 'days':
      return value
    case 'week':
    case 'weeks':
      return value * 7
    case 'month':
    case 'months':
      return value * 30
    default:
      return 0
  }
}

/**
 * Estimate service completion date
 */
export function estimateCompletionDate(service: ServiceDefinition, startDate?: Date): Date {
  const start = startDate || new Date()
  const days = parseDeliveryTimeToDays(service.deliveryTime)
  const completion = new Date(start)
  completion.setDate(completion.getDate() + days)
  return completion
}

/**
 * Calculate service value (for value-based pricing)
 */
export function calculateValueBasedPrice(
  service: ServiceDefinition,
  customerValue: number,
  valueSharePercentage: number
): number {
  if (service.pricingModel !== 'value-based') {
    throw new Error('Service must use value-based pricing model')
  }

  if (valueSharePercentage < 0 || valueSharePercentage > 100) {
    throw new Error('Value share percentage must be between 0 and 100')
  }

  return customerValue * (valueSharePercentage / 100)
}

/**
 * Validate service definition
 */
export function validateService(service: ServiceDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!service.name) {
    errors.push('Service name is required')
  }

  if (service.price && service.price < 0) {
    errors.push('Service price cannot be negative')
  }

  if (service.sla?.uptime && (service.sla.uptime < 0 || service.sla.uptime > 100)) {
    errors.push('SLA uptime must be between 0 and 100')
  }

  if (
    service.pricingModel &&
    !['hourly', 'fixed', 'retainer', 'value-based'].includes(service.pricingModel)
  ) {
    errors.push('Invalid pricing model')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
