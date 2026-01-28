/**
 * App() - Define an application
 */

import type { AppDefinition, RouteDefinition, StateDefinition, AuthConfig } from './types.js'
import { registerProduct } from './product.js'

/**
 * Create an application definition
 *
 * @example
 * ```ts
 * const myApp = App({
 *   id: 'my-app',
 *   name: 'My App',
 *   description: 'A web application',
 *   version: '1.0.0',
 *   framework: 'react',
 *   routes: [
 *     { path: '/', component: 'Home' },
 *     { path: '/about', component: 'About' },
 *     { path: '/users/:id', component: 'UserDetail' },
 *   ],
 *   state: {
 *     library: 'zustand',
 *     schema: {
 *       user: 'Current user object',
 *       settings: 'App settings object',
 *     },
 *   },
 *   auth: {
 *     provider: 'clerk',
 *     protectedRoutes: ['/dashboard', '/profile'],
 *   },
 * })
 * ```
 */
export function App(config: Omit<AppDefinition, 'type'>): AppDefinition {
  const app: AppDefinition = {
    type: 'app',
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    framework: config.framework || 'react',
    routes: config.routes || [],
    status: config.status || 'active',
    ...(config.config !== undefined && { config: config.config }),
    ...(config.state !== undefined && { state: config.state }),
    ...(config.auth !== undefined && { auth: config.auth }),
    ...(config.deployments !== undefined && { deployments: config.deployments }),
    ...(config.metadata !== undefined && { metadata: config.metadata }),
    ...(config.tags !== undefined && { tags: config.tags }),
  }

  return registerProduct(app)
}

/**
 * Helper to create a route definition
 *
 * @example
 * ```ts
 * const userRoute = Route('/users/:id', 'UserDetail', {
 *   meta: { title: 'User Profile' },
 * })
 * ```
 */
export function Route(
  path: string,
  component: string,
  options?: Omit<RouteDefinition, 'path' | 'component'>
): RouteDefinition {
  return {
    path,
    component,
    ...options,
  }
}

/**
 * Helper to configure state management
 *
 * @example
 * ```ts
 * const state = State({
 *   library: 'zustand',
 *   schema: {
 *     user: 'Current user',
 *     settings: 'User settings',
 *   },
 *   persistence: {
 *     type: 'local',
 *     key: 'app-state',
 *   },
 * })
 * ```
 */
export function State(config: StateDefinition): StateDefinition {
  return config
}

/**
 * Helper to configure authentication
 *
 * @example
 * ```ts
 * const auth = Auth({
 *   provider: 'clerk',
 *   protectedRoutes: ['/dashboard', '/profile'],
 *   roles: ['admin', 'user'],
 * })
 * ```
 */
export function Auth(config: AuthConfig): AuthConfig {
  return config
}
