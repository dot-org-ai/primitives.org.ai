/**
 * API() - Define an API
 */

import type { APIDefinition, EndpointDefinition, APIAuthConfig, RateLimitConfig } from './types.js'
import { registerProduct } from './product.js'

/**
 * Create an API definition
 *
 * @example
 * ```ts
 * const myAPI = API({
 *   id: 'my-api',
 *   name: 'My API',
 *   description: 'A RESTful API',
 *   version: '1.0.0',
 *   style: 'rest',
 *   baseUrl: 'https://api.example.com',
 *   endpoints: [
 *     Endpoint('GET', '/users', 'List all users', {
 *       response: {
 *         users: ['Array of user objects'],
 *         total: 'Total count (number)',
 *       },
 *     }),
 *     Endpoint('POST', '/users', 'Create a user', {
 *       request: {
 *         name: 'User name',
 *         email: 'User email',
 *       },
 *       response: {
 *         id: 'User ID',
 *         name: 'User name',
 *         email: 'User email',
 *       },
 *     }),
 *   ],
 *   auth: {
 *     type: 'bearer',
 *     header: 'Authorization',
 *   },
 *   rateLimit: {
 *     requests: 100,
 *     window: 60,
 *   },
 * })
 * ```
 */
export function API(config: Omit<APIDefinition, 'type'>): APIDefinition {
  const api: APIDefinition = {
    type: 'api',
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    style: config.style || 'rest',
    endpoints: config.endpoints || [],
    status: config.status || 'active',
    ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl }),
    ...(config.auth !== undefined && { auth: config.auth }),
    ...(config.rateLimit !== undefined && { rateLimit: config.rateLimit }),
    ...(config.docsUrl !== undefined && { docsUrl: config.docsUrl }),
    ...(config.openapi !== undefined && { openapi: config.openapi }),
    ...(config.metadata !== undefined && { metadata: config.metadata }),
    ...(config.tags !== undefined && { tags: config.tags }),
  }

  return registerProduct(api)
}

/**
 * Helper to create an endpoint definition
 *
 * @example
 * ```ts
 * const endpoint = Endpoint('GET', '/users/:id', 'Get user by ID', {
 *   params: { id: 'User ID' },
 *   response: {
 *     id: 'User ID',
 *     name: 'User name',
 *     email: 'User email',
 *   },
 *   auth: true,
 * })
 * ```
 */
export function Endpoint(
  method: EndpointDefinition['method'],
  path: string,
  description: string,
  options?: Omit<EndpointDefinition, 'method' | 'path' | 'description'>
): EndpointDefinition {
  return {
    method,
    path,
    description,
    ...options,
  }
}

/**
 * Helper to configure API authentication
 *
 * @example
 * ```ts
 * const auth = APIAuth({
 *   type: 'bearer',
 *   header: 'Authorization',
 * })
 *
 * const oauth = APIAuth({
 *   type: 'oauth2',
 *   oauth2: {
 *     authUrl: 'https://auth.example.com/authorize',
 *     tokenUrl: 'https://auth.example.com/token',
 *     scopes: ['read', 'write'],
 *   },
 * })
 * ```
 */
export function APIAuth(config: APIAuthConfig): APIAuthConfig {
  return config
}

/**
 * Helper to configure rate limiting
 *
 * @example
 * ```ts
 * const rateLimit = RateLimit({
 *   requests: 100,
 *   window: 60, // 60 seconds
 *   onExceeded: 'reject',
 * })
 * ```
 */
export function RateLimit(config: RateLimitConfig): RateLimitConfig {
  return config
}
