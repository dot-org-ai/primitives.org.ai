/**
 * SDK() - Define a software development kit
 */

import type { SDKDefinition, SDKExport, SDKExample } from './types.js'
import type { SimpleSchema } from 'ai-functions'
import { registerProduct } from './product.js'

/**
 * Create an SDK definition
 *
 * @example
 * ```ts
 * const mySDK = SDK({
 *   id: 'my-sdk',
 *   name: 'My SDK',
 *   description: 'JavaScript SDK for My API',
 *   version: '1.0.0',
 *   language: 'typescript',
 *   api: 'my-api',
 *   exports: [
 *     Export('function', 'createClient', 'Create an API client', {
 *       parameters: {
 *         apiKey: 'API key for authentication',
 *         baseUrl: 'Optional base URL',
 *       },
 *       returns: 'API client instance',
 *     }),
 *     Export('class', 'APIClient', 'Main API client', {
 *       methods: [
 *         Export('function', 'get', 'GET request', {
 *           parameters: { path: 'Request path' },
 *           returns: 'Response data',
 *         }),
 *         Export('function', 'post', 'POST request', {
 *           parameters: { path: 'Request path', data: 'Request body' },
 *           returns: 'Response data',
 *         }),
 *       ],
 *     }),
 *   ],
 *   install: 'npm install my-sdk',
 *   examples: [
 *     Example(
 *       'Basic Usage',
 *       'Create a client and make a request',
 *       `import { createClient } from 'my-sdk'
 *
 * const client = createClient({ apiKey: 'YOUR_API_KEY' })
 * const users = await client.get('/users')
 * console.log(users)`
 *     ),
 *   ],
 * })
 * ```
 */
export function SDK(config: Omit<SDKDefinition, 'type'>): SDKDefinition {
  const sdk: SDKDefinition = {
    type: 'sdk',
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    language: config.language,
    status: config.status || 'active',
    ...(config.api !== undefined && { api: config.api }),
    ...(config.exports !== undefined && { exports: config.exports }),
    ...(config.install !== undefined && { install: config.install }),
    ...(config.docs !== undefined && { docs: config.docs }),
    ...(config.examples !== undefined && { examples: config.examples }),
    ...(config.metadata !== undefined && { metadata: config.metadata }),
    ...(config.tags !== undefined && { tags: config.tags }),
  }

  return registerProduct(sdk)
}

/**
 * Helper to create an SDK export
 *
 * @example
 * ```ts
 * const fn = Export('function', 'calculateTotal', 'Calculate order total', {
 *   parameters: {
 *     items: ['Array of order items'],
 *     taxRate: 'Tax rate (number)',
 *   },
 *   returns: 'Total amount (number)',
 * })
 *
 * const cls = Export('class', 'OrderManager', 'Manage orders', {
 *   methods: [
 *     Export('function', 'create', 'Create order', {
 *       parameters: { order: 'Order data' },
 *       returns: 'Created order',
 *     }),
 *   ],
 * })
 * ```
 */
export function Export(
  type: SDKExport['type'],
  name: string,
  description: string,
  options?: {
    parameters?: SimpleSchema
    returns?: SimpleSchema
    methods?: SDKExport[]
  }
): SDKExport {
  const base = { type, name, description }

  // Build the result object conditionally to satisfy exactOptionalPropertyTypes
  // Cast to Record<string, unknown> to match the local SimpleSchema type
  if (
    options?.parameters !== undefined &&
    options?.returns !== undefined &&
    options?.methods !== undefined
  ) {
    return {
      ...base,
      parameters: options.parameters as Record<string, unknown>,
      returns: options.returns as Record<string, unknown>,
      methods: options.methods,
    }
  }
  if (options?.parameters !== undefined && options?.returns !== undefined) {
    return {
      ...base,
      parameters: options.parameters as Record<string, unknown>,
      returns: options.returns as Record<string, unknown>,
    }
  }
  if (options?.parameters !== undefined && options?.methods !== undefined) {
    return {
      ...base,
      parameters: options.parameters as Record<string, unknown>,
      methods: options.methods,
    }
  }
  if (options?.returns !== undefined && options?.methods !== undefined) {
    return {
      ...base,
      returns: options.returns as Record<string, unknown>,
      methods: options.methods,
    }
  }
  if (options?.parameters !== undefined) {
    return { ...base, parameters: options.parameters as Record<string, unknown> }
  }
  if (options?.returns !== undefined) {
    return { ...base, returns: options.returns as Record<string, unknown> }
  }
  if (options?.methods !== undefined) {
    return { ...base, methods: options.methods }
  }
  return base
}

/**
 * Helper to create an SDK example
 *
 * @example
 * ```ts
 * const example = Example(
 *   'Authentication',
 *   'How to authenticate with the API',
 *   `const client = createClient({
 *     apiKey: process.env.API_KEY,
 *   })`,
 *   '{ authenticated: true }'
 * )
 * ```
 */
export function Example(
  title: string,
  description: string,
  code: string,
  output?: string
): SDKExample {
  return {
    title,
    description,
    code,
    ...(output !== undefined && { output }),
  }
}
