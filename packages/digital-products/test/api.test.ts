/**
 * Tests for API functionality
 *
 * Covers API creation and helper functions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { API, Endpoint, APIAuth, RateLimit, registry } from '../src/index.js'

describe('API', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('API creation', () => {
    it('creates an API with basic config', () => {
      const api = API({
        id: 'my-api',
        name: 'My API',
        description: 'A RESTful API',
        version: '1.0.0',
        baseUrl: 'https://api.example.com',
      })

      expect(api.id).toBe('my-api')
      expect(api.name).toBe('My API')
      expect(api.type).toBe('api')
      expect(api.baseUrl).toBe('https://api.example.com')
    })

    it('defaults style to rest', () => {
      const api = API({
        id: 'rest-api',
        name: 'REST API',
        description: 'A REST API',
        version: '1.0.0',
      })

      expect(api.style).toBe('rest')
    })

    it('supports graphql style', () => {
      const api = API({
        id: 'graphql-api',
        name: 'GraphQL API',
        description: 'A GraphQL API',
        version: '1.0.0',
        style: 'graphql',
      })

      expect(api.style).toBe('graphql')
    })

    it('creates an API with endpoints', () => {
      const api = API({
        id: 'endpoint-api',
        name: 'Endpoint API',
        description: 'API with endpoints',
        version: '1.0.0',
        endpoints: [
          Endpoint('GET', '/users', 'List users'),
          Endpoint('POST', '/users', 'Create user'),
        ],
      })

      expect(api.endpoints).toHaveLength(2)
      expect(api.endpoints?.[0]?.method).toBe('GET')
      expect(api.endpoints?.[1]?.method).toBe('POST')
    })

    it('creates an API with auth', () => {
      const api = API({
        id: 'auth-api',
        name: 'Auth API',
        description: 'API with auth',
        version: '1.0.0',
        auth: {
          type: 'bearer',
          header: 'Authorization',
        },
      })

      expect(api.auth?.type).toBe('bearer')
      expect(api.auth?.header).toBe('Authorization')
    })

    it('creates an API with rate limiting', () => {
      const api = API({
        id: 'rate-limited-api',
        name: 'Rate Limited API',
        description: 'API with rate limiting',
        version: '1.0.0',
        rateLimit: {
          requests: 100,
          window: 60,
        },
      })

      expect(api.rateLimit?.requests).toBe(100)
      expect(api.rateLimit?.window).toBe(60)
    })

    it('registers the API automatically', () => {
      API({
        id: 'auto-registered',
        name: 'Auto Registered',
        description: 'Automatically registered',
        version: '1.0.0',
      })

      expect(registry.get('auto-registered')).toBeDefined()
    })

    it('supports docsUrl', () => {
      const api = API({
        id: 'documented-api',
        name: 'Documented API',
        description: 'API with docs',
        version: '1.0.0',
        docsUrl: 'https://docs.example.com/api',
      })

      expect(api.docsUrl).toBe('https://docs.example.com/api')
    })

    it('supports openapi spec reference', () => {
      const api = API({
        id: 'openapi-api',
        name: 'OpenAPI API',
        description: 'API with OpenAPI',
        version: '1.0.0',
        openapi: 'https://api.example.com/openapi.json',
      })

      expect(api.openapi).toBe('https://api.example.com/openapi.json')
    })
  })

  describe('Endpoint helper', () => {
    it('creates a basic endpoint', () => {
      const endpoint = Endpoint('GET', '/users', 'List all users')

      expect(endpoint.method).toBe('GET')
      expect(endpoint.path).toBe('/users')
      expect(endpoint.description).toBe('List all users')
    })

    it('creates an endpoint with params', () => {
      const endpoint = Endpoint('GET', '/users/:id', 'Get user by ID', {
        params: { id: 'User ID' },
      })

      expect(endpoint.params).toEqual({ id: 'User ID' })
    })

    it('creates an endpoint with request and response schemas', () => {
      const endpoint = Endpoint('POST', '/users', 'Create user', {
        request: {
          name: 'User name',
          email: 'User email',
        },
        response: {
          id: 'User ID',
          name: 'User name',
          email: 'User email',
        },
      })

      expect(endpoint.request).toEqual({
        name: 'User name',
        email: 'User email',
      })
      expect(endpoint.response).toEqual({
        id: 'User ID',
        name: 'User name',
        email: 'User email',
      })
    })

    it('creates an endpoint with auth requirement', () => {
      const endpoint = Endpoint('DELETE', '/users/:id', 'Delete user', {
        auth: true,
      })

      expect(endpoint.auth).toBe(true)
    })
  })

  describe('APIAuth helper', () => {
    it('creates bearer auth config', () => {
      const auth = APIAuth({
        type: 'bearer',
        header: 'Authorization',
      })

      expect(auth.type).toBe('bearer')
      expect(auth.header).toBe('Authorization')
    })

    it('creates API key auth config', () => {
      const auth = APIAuth({
        type: 'apiKey',
        header: 'X-API-Key',
      })

      expect(auth.type).toBe('apiKey')
      expect(auth.header).toBe('X-API-Key')
    })

    it('creates OAuth2 auth config', () => {
      const auth = APIAuth({
        type: 'oauth2',
        oauth2: {
          authUrl: 'https://auth.example.com/authorize',
          tokenUrl: 'https://auth.example.com/token',
          scopes: ['read', 'write'],
        },
      })

      expect(auth.type).toBe('oauth2')
      expect(auth.oauth2?.authUrl).toBe('https://auth.example.com/authorize')
      expect(auth.oauth2?.scopes).toEqual(['read', 'write'])
    })
  })

  describe('RateLimit helper', () => {
    it('creates basic rate limit config', () => {
      const rateLimit = RateLimit({
        requests: 100,
        window: 60,
      })

      expect(rateLimit.requests).toBe(100)
      expect(rateLimit.window).toBe(60)
    })

    it('supports onExceeded action', () => {
      const rateLimit = RateLimit({
        requests: 100,
        window: 60,
        onExceeded: 'reject',
      })

      expect(rateLimit.onExceeded).toBe('reject')
    })
  })
})
