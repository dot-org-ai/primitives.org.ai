/**
 * Tests for App functionality
 *
 * Covers application creation and helper functions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { App, Route, State, Auth, registry } from '../src/index.js'

describe('App', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('App creation', () => {
    it('creates an app with basic config', () => {
      const app = App({
        id: 'my-app',
        name: 'My App',
        description: 'A web application',
        version: '1.0.0',
      })

      expect(app.id).toBe('my-app')
      expect(app.name).toBe('My App')
      expect(app.type).toBe('app')
    })

    it('defaults framework to react', () => {
      const app = App({
        id: 'react-app',
        name: 'React App',
        description: 'Default framework',
        version: '1.0.0',
      })

      expect(app.framework).toBe('react')
    })

    it('supports custom frameworks', () => {
      const app = App({
        id: 'vue-app',
        name: 'Vue App',
        description: 'Vue application',
        version: '1.0.0',
        framework: 'vue',
      })

      expect(app.framework).toBe('vue')
    })

    it('creates an app with routes', () => {
      const app = App({
        id: 'routed-app',
        name: 'Routed App',
        description: 'App with routes',
        version: '1.0.0',
        routes: [
          Route('/', 'Home'),
          Route('/about', 'About'),
          Route('/users/:id', 'UserDetail'),
        ],
      })

      expect(app.routes).toHaveLength(3)
      expect(app.routes?.[0]?.path).toBe('/')
      expect(app.routes?.[2]?.path).toBe('/users/:id')
    })

    it('creates an app with state config', () => {
      const app = App({
        id: 'stateful-app',
        name: 'Stateful App',
        description: 'App with state',
        version: '1.0.0',
        state: {
          library: 'zustand',
          schema: {
            user: 'Current user object',
            settings: 'App settings object',
          },
        },
      })

      expect(app.state?.library).toBe('zustand')
      expect(app.state?.schema?.user).toBe('Current user object')
    })

    it('creates an app with auth config', () => {
      const app = App({
        id: 'authed-app',
        name: 'Authed App',
        description: 'App with auth',
        version: '1.0.0',
        auth: {
          provider: 'clerk',
          protectedRoutes: ['/dashboard', '/profile'],
        },
      })

      expect(app.auth?.provider).toBe('clerk')
      expect(app.auth?.protectedRoutes).toContain('/dashboard')
    })

    it('registers the app automatically', () => {
      App({
        id: 'auto-registered',
        name: 'Auto Registered',
        description: 'Automatically registered',
        version: '1.0.0',
      })

      expect(registry.get('auto-registered')).toBeDefined()
    })

    it('supports deployments config', () => {
      const app = App({
        id: 'deployed-app',
        name: 'Deployed App',
        description: 'App with deployments',
        version: '1.0.0',
        deployments: {
          production: 'https://app.example.com',
          staging: 'https://staging.example.com',
        },
      })

      expect(app.deployments?.production).toBe('https://app.example.com')
    })
  })

  describe('Route helper', () => {
    it('creates a basic route', () => {
      const route = Route('/', 'Home')

      expect(route.path).toBe('/')
      expect(route.component).toBe('Home')
    })

    it('creates a route with meta', () => {
      const route = Route('/about', 'About', {
        meta: { title: 'About Us' },
      })

      expect(route.meta).toEqual({ title: 'About Us' })
    })

    it('creates a route with children', () => {
      const route = Route('/dashboard', 'Dashboard', {
        children: [
          Route('/dashboard/stats', 'Stats'),
          Route('/dashboard/settings', 'Settings'),
        ],
      })

      expect(route.children).toHaveLength(2)
    })

    it('creates a protected route', () => {
      const route = Route('/admin', 'Admin', {
        protected: true,
        roles: ['admin'],
      })

      expect(route.protected).toBe(true)
      expect(route.roles).toContain('admin')
    })
  })

  describe('State helper', () => {
    it('creates a state config', () => {
      const state = State({
        library: 'zustand',
        schema: {
          user: 'Current user',
          settings: 'User settings',
        },
      })

      expect(state.library).toBe('zustand')
      expect(state.schema).toHaveProperty('user')
    })

    it('supports persistence config', () => {
      const state = State({
        library: 'zustand',
        schema: {},
        persistence: {
          type: 'local',
          key: 'app-state',
        },
      })

      expect(state.persistence?.type).toBe('local')
      expect(state.persistence?.key).toBe('app-state')
    })
  })

  describe('Auth helper', () => {
    it('creates an auth config', () => {
      const auth = Auth({
        provider: 'clerk',
        protectedRoutes: ['/dashboard', '/profile'],
      })

      expect(auth.provider).toBe('clerk')
      expect(auth.protectedRoutes).toHaveLength(2)
    })

    it('supports roles', () => {
      const auth = Auth({
        provider: 'auth0',
        protectedRoutes: ['/admin'],
        roles: ['admin', 'user'],
      })

      expect(auth.roles).toContain('admin')
    })
  })
})
