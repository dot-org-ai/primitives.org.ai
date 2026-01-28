/**
 * Endpoint helper for defining service endpoints
 */

import type { EndpointDefinition, PricingConfig, JSONSchema } from './types.js'

/**
 * Endpoint configuration (input to Endpoint function)
 */
export interface EndpointConfig<TInput = unknown, TOutput = unknown> {
  /** Endpoint name */
  name: string
  /** Description of what this endpoint does */
  description?: string
  /** HTTP method (for REST endpoints) */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /** Path pattern (e.g., '/users/:id') */
  path?: string
  /** Input schema */
  input?: JSONSchema
  /** Output schema */
  output?: JSONSchema
  /** Handler function */
  handler: EndpointDefinition<TInput, TOutput>['handler']
  /** Pricing specific to this endpoint */
  pricing?: PricingConfig
  /** Rate limiting */
  rateLimit?: {
    requests: number
    window: number // milliseconds
  }
  /** Whether authentication is required */
  requiresAuth?: boolean
}

/**
 * Create an endpoint definition
 *
 * @example
 * ```ts
 * const translateEndpoint = Endpoint({
 *   name: 'translate',
 *   description: 'Translate text between languages',
 *   method: 'POST',
 *   path: '/translate',
 *   input: {
 *     type: 'object',
 *     properties: {
 *       text: { type: 'string', description: 'Text to translate' },
 *       from: { type: 'string', description: 'Source language code' },
 *       to: { type: 'string', description: 'Target language code' },
 *     },
 *     required: ['text', 'to'],
 *     additionalProperties: false,
 *   },
 *   output: {
 *     type: 'object',
 *     properties: {
 *       translatedText: { type: 'string' },
 *       confidence: { type: 'number' },
 *     },
 *     required: ['translatedText'],
 *     additionalProperties: false,
 *   },
 *   handler: async (input, context) => {
 *     // Translation logic here
 *     return {
 *       translatedText: `Translated: ${input.text}`,
 *       confidence: 0.95,
 *     }
 *   },
 *   pricing: {
 *     model: 'per-use',
 *     pricePerUnit: 0.01,
 *     currency: 'USD',
 *   },
 *   rateLimit: {
 *     requests: 100,
 *     window: 60000, // 1 minute
 *   },
 * })
 * ```
 */
export function Endpoint<TInput = unknown, TOutput = unknown>(
  config: EndpointConfig<TInput, TOutput>
): EndpointDefinition<TInput, TOutput> {
  return {
    name: config.name,
    ...(config.description !== undefined && { description: config.description }),
    method: config.method || 'POST',
    path: config.path || `/${config.name}`,
    ...(config.input !== undefined && { input: config.input }),
    ...(config.output !== undefined && { output: config.output }),
    handler: config.handler,
    ...(config.pricing !== undefined && { pricing: config.pricing }),
    ...(config.rateLimit !== undefined && { rateLimit: config.rateLimit }),
    requiresAuth: config.requiresAuth !== false, // Default to true
  }
}

/**
 * Create a GET endpoint
 */
export function GET<TInput = unknown, TOutput = unknown>(
  config: Omit<EndpointConfig<TInput, TOutput>, 'method'>
): EndpointDefinition<TInput, TOutput> {
  return Endpoint({ ...config, method: 'GET' })
}

/**
 * Create a POST endpoint
 */
export function POST<TInput = unknown, TOutput = unknown>(
  config: Omit<EndpointConfig<TInput, TOutput>, 'method'>
): EndpointDefinition<TInput, TOutput> {
  return Endpoint({ ...config, method: 'POST' })
}

/**
 * Create a PUT endpoint
 */
export function PUT<TInput = unknown, TOutput = unknown>(
  config: Omit<EndpointConfig<TInput, TOutput>, 'method'>
): EndpointDefinition<TInput, TOutput> {
  return Endpoint({ ...config, method: 'PUT' })
}

/**
 * Create a DELETE endpoint
 */
export function DELETE<TInput = unknown, TOutput = unknown>(
  config: Omit<EndpointConfig<TInput, TOutput>, 'method'>
): EndpointDefinition<TInput, TOutput> {
  return Endpoint({ ...config, method: 'DELETE' })
}

/**
 * Create a PATCH endpoint
 */
export function PATCH<TInput = unknown, TOutput = unknown>(
  config: Omit<EndpointConfig<TInput, TOutput>, 'method'>
): EndpointDefinition<TInput, TOutput> {
  return Endpoint({ ...config, method: 'PATCH' })
}
