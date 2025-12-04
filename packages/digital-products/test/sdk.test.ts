/**
 * Tests for SDK functionality
 *
 * Covers SDK creation and helper functions.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { SDK, Export, Example, registry } from '../src/index.js'

describe('SDK', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('SDK creation', () => {
    it('creates an SDK with basic config', () => {
      const sdk = SDK({
        id: 'my-sdk',
        name: 'My SDK',
        description: 'JavaScript SDK for My API',
        version: '1.0.0',
        language: 'typescript',
      })

      expect(sdk.id).toBe('my-sdk')
      expect(sdk.name).toBe('My SDK')
      expect(sdk.type).toBe('sdk')
      expect(sdk.language).toBe('typescript')
    })

    it('creates an SDK with API reference', () => {
      const sdk = SDK({
        id: 'api-sdk',
        name: 'API SDK',
        description: 'SDK for API',
        version: '1.0.0',
        language: 'typescript',
        api: 'my-api',
      })

      expect(sdk.api).toBe('my-api')
    })

    it('creates an SDK with exports', () => {
      const sdk = SDK({
        id: 'export-sdk',
        name: 'Export SDK',
        description: 'SDK with exports',
        version: '1.0.0',
        language: 'typescript',
        exports: [
          Export('function', 'createClient', 'Create an API client'),
          Export('class', 'APIClient', 'Main API client'),
        ],
      })

      expect(sdk.exports).toHaveLength(2)
      expect(sdk.exports?.[0]?.name).toBe('createClient')
    })

    it('creates an SDK with install command', () => {
      const sdk = SDK({
        id: 'install-sdk',
        name: 'Install SDK',
        description: 'SDK with install command',
        version: '1.0.0',
        language: 'typescript',
        install: 'npm install my-sdk',
      })

      expect(sdk.install).toBe('npm install my-sdk')
    })

    it('creates an SDK with docs URL', () => {
      const sdk = SDK({
        id: 'docs-sdk',
        name: 'Docs SDK',
        description: 'SDK with docs',
        version: '1.0.0',
        language: 'typescript',
        docs: 'https://docs.example.com/sdk',
      })

      expect(sdk.docs).toBe('https://docs.example.com/sdk')
    })

    it('creates an SDK with examples', () => {
      const sdk = SDK({
        id: 'example-sdk',
        name: 'Example SDK',
        description: 'SDK with examples',
        version: '1.0.0',
        language: 'typescript',
        examples: [
          Example(
            'Basic Usage',
            'Create a client and make a request',
            `import { createClient } from 'my-sdk'\nconst client = createClient({ apiKey: 'key' })`
          ),
        ],
      })

      expect(sdk.examples).toHaveLength(1)
      expect(sdk.examples?.[0]?.title).toBe('Basic Usage')
    })

    it('registers SDK automatically', () => {
      SDK({
        id: 'auto-registered',
        name: 'Auto Registered',
        description: 'Automatically registered',
        version: '1.0.0',
        language: 'typescript',
      })

      expect(registry.get('auto-registered')).toBeDefined()
    })

    it('supports Python language', () => {
      const sdk = SDK({
        id: 'python-sdk',
        name: 'Python SDK',
        description: 'Python SDK',
        version: '1.0.0',
        language: 'python',
        install: 'pip install my-sdk',
      })

      expect(sdk.language).toBe('python')
    })
  })

  describe('Export helper', () => {
    it('creates a function export', () => {
      const exp = Export('function', 'createClient', 'Create an API client', {
        parameters: {
          apiKey: 'API key for authentication',
          baseUrl: 'Optional base URL',
        },
        returns: 'API client instance',
      })

      expect(exp.type).toBe('function')
      expect(exp.name).toBe('createClient')
      expect(exp.description).toBe('Create an API client')
      expect(exp.parameters?.apiKey).toBe('API key for authentication')
      expect(exp.returns).toBe('API client instance')
    })

    it('creates a class export', () => {
      const exp = Export('class', 'APIClient', 'Main API client', {
        methods: [
          Export('function', 'get', 'GET request', {
            parameters: { path: 'Request path' },
            returns: 'Response data',
          }),
          Export('function', 'post', 'POST request', {
            parameters: { path: 'Request path', data: 'Request body' },
            returns: 'Response data',
          }),
        ],
      })

      expect(exp.type).toBe('class')
      expect(exp.methods).toHaveLength(2)
      expect(exp.methods?.[0]?.name).toBe('get')
    })

    it('creates a type export', () => {
      const exp = Export('type', 'ClientOptions', 'Client configuration options', {
        parameters: {
          apiKey: 'API key',
          timeout: 'Request timeout (number)',
          retries: 'Number of retries (number)',
        },
      })

      expect(exp.type).toBe('type')
    })

    it('creates a constant export', () => {
      const exp = Export('constant', 'VERSION', 'SDK version string')

      expect(exp.type).toBe('constant')
      expect(exp.name).toBe('VERSION')
    })
  })

  describe('Example helper', () => {
    it('creates a basic example', () => {
      const example = Example(
        'Getting Started',
        'How to get started with the SDK',
        `import { SDK } from 'my-sdk'\nconst sdk = new SDK()`
      )

      expect(example.title).toBe('Getting Started')
      expect(example.description).toBe('How to get started with the SDK')
      expect(example.code).toContain('import')
    })

    it('creates an example with output', () => {
      const example = Example(
        'Authentication',
        'How to authenticate',
        `const client = createClient({ apiKey: 'key' })`,
        '{ authenticated: true }'
      )

      expect(example.output).toBe('{ authenticated: true }')
    })

    it('creates a multi-line example', () => {
      const code = `
import { createClient } from 'my-sdk'

const client = createClient({
  apiKey: process.env.API_KEY,
  baseUrl: 'https://api.example.com',
})

const users = await client.get('/users')
console.log(users)
`.trim()

      const example = Example(
        'Complete Example',
        'Full usage example',
        code
      )

      expect(example.code).toContain('createClient')
      expect(example.code).toContain('console.log')
    })
  })
})
