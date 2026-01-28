/**
 * Tests for Provider implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Provider, providers } from '../src/index.js'

// Mock fetch globally
const mockFetch = vi.fn()

describe('Provider', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('basic creation', () => {
    it('should create a provider with required fields', () => {
      const provider = Provider({
        name: 'TestProvider',
        baseUrl: 'https://api.test.com',
      })

      expect(provider.name).toBe('TestProvider')
      expect(provider.baseUrl).toBe('https://api.test.com')
    })

    it('should default services to empty array', () => {
      const provider = Provider({
        name: 'TestProvider',
        baseUrl: 'https://api.test.com',
      })

      expect(provider.services).toEqual([])
    })

    it('should store provided services list', () => {
      const provider = Provider({
        name: 'TestProvider',
        baseUrl: 'https://api.test.com',
        services: ['translate', 'speech', 'vision'],
      })

      expect(provider.services).toEqual(['translate', 'speech', 'vision'])
    })

    it('should store auth configuration', () => {
      const provider = Provider({
        name: 'TestProvider',
        baseUrl: 'https://api.test.com',
        auth: {
          type: 'api-key',
          credentials: { apiKey: 'test-key' },
        },
      })

      expect(provider.auth).toEqual({
        type: 'api-key',
        credentials: { apiKey: 'test-key' },
      })
    })
  })

  describe('service method', () => {
    it('should create a service client with correct URL', () => {
      const provider = Provider({
        name: 'TestProvider',
        baseUrl: 'https://api.test.com',
      })

      const client = provider.service('translate')

      expect(client).toBeDefined()
      expect(client.ask).toBeDefined()
      expect(client.do).toBeDefined()
    })

    it('should pass auth configuration to service client', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const provider = Provider({
        name: 'TestProvider',
        baseUrl: 'https://api.test.com',
        auth: {
          type: 'api-key',
          credentials: { apiKey: 'provider-key' },
        },
      })

      const client = provider.service('translate')
      await client.do('translate', { text: 'Hello' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('translate'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer provider-key',
          }),
        })
      )
    })

    it('should construct service URL correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const provider = Provider({
        name: 'TestProvider',
        baseUrl: 'https://api.test.com',
      })

      const client = provider.service('translate')
      await client.do('action', {})

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/translate/do',
        expect.any(Object)
      )
    })
  })
})

describe('providers preset configurations', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('providers.aws', () => {
    it('should create AWS provider with default region', () => {
      const aws = providers.aws({
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      })

      expect(aws.name).toBe('AWS')
      expect(aws.baseUrl).toBe('https://api.us-east-1.amazonaws.com')
    })

    it('should create AWS provider with custom region', () => {
      const aws = providers.aws({
        accessKeyId: 'test-key-id',
        secretAccessKey: 'test-secret',
        region: 'eu-west-1',
      })

      expect(aws.baseUrl).toBe('https://api.eu-west-1.amazonaws.com')
    })

    it('should have expected AWS services', () => {
      const aws = providers.aws({
        accessKeyId: 'test',
        secretAccessKey: 'test',
      })

      expect(aws.services).toContain('translate')
      expect(aws.services).toContain('comprehend')
      expect(aws.services).toContain('polly')
      expect(aws.services).toContain('rekognition')
      expect(aws.services).toContain('textract')
      expect(aws.services).toContain('transcribe')
    })

    it('should configure auth correctly', () => {
      const aws = providers.aws({
        accessKeyId: 'AKIATEST',
        secretAccessKey: 'secrettest',
      })

      expect(aws.auth?.type).toBe('api-key')
      expect(aws.auth?.credentials.apiKey).toBe('AKIATEST')
      expect(aws.auth?.credentials.secret).toBe('secrettest')
    })
  })

  describe('providers.gcp', () => {
    it('should create Google Cloud provider', () => {
      const gcp = providers.gcp({
        apiKey: 'gcp-api-key',
      })

      expect(gcp.name).toBe('Google Cloud')
      expect(gcp.baseUrl).toBe('https://api.googleapis.com')
    })

    it('should have expected GCP services', () => {
      const gcp = providers.gcp({ apiKey: 'test' })

      expect(gcp.services).toContain('translate')
      expect(gcp.services).toContain('language')
      expect(gcp.services).toContain('speech')
      expect(gcp.services).toContain('texttospeech')
      expect(gcp.services).toContain('vision')
    })

    it('should configure auth correctly', () => {
      const gcp = providers.gcp({ apiKey: 'my-gcp-key' })

      expect(gcp.auth?.type).toBe('api-key')
      expect(gcp.auth?.credentials.apiKey).toBe('my-gcp-key')
    })
  })

  describe('providers.azure', () => {
    it('should create Azure provider with default region', () => {
      const azure = providers.azure({
        subscriptionKey: 'azure-sub-key',
      })

      expect(azure.name).toBe('Azure')
      expect(azure.baseUrl).toBe('https://eastus.api.cognitive.microsoft.com')
    })

    it('should create Azure provider with custom region', () => {
      const azure = providers.azure({
        subscriptionKey: 'azure-sub-key',
        region: 'westeurope',
      })

      expect(azure.baseUrl).toBe('https://westeurope.api.cognitive.microsoft.com')
    })

    it('should have expected Azure services', () => {
      const azure = providers.azure({ subscriptionKey: 'test' })

      expect(azure.services).toContain('translator')
      expect(azure.services).toContain('language')
      expect(azure.services).toContain('speech')
      expect(azure.services).toContain('vision')
      expect(azure.services).toContain('form-recognizer')
    })
  })

  describe('providers.openai', () => {
    it('should create OpenAI provider', () => {
      const openai = providers.openai({
        apiKey: 'sk-openai-key',
      })

      expect(openai.name).toBe('OpenAI')
      expect(openai.baseUrl).toBe('https://api.openai.com/v1')
    })

    it('should have expected OpenAI services', () => {
      const openai = providers.openai({ apiKey: 'test' })

      expect(openai.services).toContain('chat')
      expect(openai.services).toContain('completions')
      expect(openai.services).toContain('embeddings')
      expect(openai.services).toContain('images')
      expect(openai.services).toContain('audio')
    })

    it('should configure auth correctly', () => {
      const openai = providers.openai({ apiKey: 'sk-test' })

      expect(openai.auth?.type).toBe('api-key')
      expect(openai.auth?.credentials.apiKey).toBe('sk-test')
    })
  })

  describe('providers.anthropic', () => {
    it('should create Anthropic provider', () => {
      const anthropic = providers.anthropic({
        apiKey: 'anthropic-api-key',
      })

      expect(anthropic.name).toBe('Anthropic')
      expect(anthropic.baseUrl).toBe('https://api.anthropic.com/v1')
    })

    it('should have expected Anthropic services', () => {
      const anthropic = providers.anthropic({ apiKey: 'test' })

      expect(anthropic.services).toContain('messages')
      expect(anthropic.services).toContain('completions')
    })

    it('should configure auth correctly', () => {
      const anthropic = providers.anthropic({ apiKey: 'sk-ant-test' })

      expect(anthropic.auth?.type).toBe('api-key')
      expect(anthropic.auth?.credentials.apiKey).toBe('sk-ant-test')
    })
  })

  describe('providers.custom', () => {
    it('should create custom provider', () => {
      const custom = providers.custom({
        name: 'MyProvider',
        baseUrl: 'https://api.myprovider.com',
        services: ['service1', 'service2'],
        auth: {
          type: 'jwt',
          credentials: { token: 'jwt-token' },
        },
      })

      expect(custom.name).toBe('MyProvider')
      expect(custom.baseUrl).toBe('https://api.myprovider.com')
      expect(custom.services).toEqual(['service1', 'service2'])
      expect(custom.auth?.type).toBe('jwt')
    })

    it('should work without optional fields', () => {
      const custom = providers.custom({
        name: 'SimpleProvider',
        baseUrl: 'https://api.simple.com',
      })

      expect(custom.name).toBe('SimpleProvider')
      expect(custom.services).toEqual([])
    })
  })
})

describe('Provider integration scenarios', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should get service client from OpenAI provider', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ content: 'Generated text' }),
    })

    const openai = providers.openai({ apiKey: 'sk-test' })
    const chat = openai.service('chat')

    await chat.generate('Write a poem')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/generate',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
        }),
      })
    )
  })

  it('should get translate service from AWS provider', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ translatedText: 'Hola' }),
    })

    const aws = providers.aws({
      accessKeyId: 'AKIA',
      secretAccessKey: 'secret',
      region: 'us-west-2',
    })

    const translate = aws.service('translate')
    await translate.do('translate', { text: 'Hello', to: 'es' })

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.us-west-2.amazonaws.com/translate/do',
      expect.any(Object)
    )
  })

  it('should allow chaining multiple service calls', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'transcribed' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'translated' }),
      })

    const gcp = providers.gcp({ apiKey: 'gcp-key' })

    const speech = gcp.service('speech')
    const translate = gcp.service('translate')

    await speech.do('transcribe', { audio: 'audio-data' })
    await translate.do('translate', { text: 'Hello', to: 'fr' })

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should work with custom enterprise provider', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: 'Enterprise answer' }),
    })

    const enterprise = providers.custom({
      name: 'EnterpriseAI',
      baseUrl: 'https://api.enterprise.internal',
      auth: {
        type: 'basic',
        credentials: { username: 'service', password: 'secret' },
      },
      services: ['qa', 'summarize', 'classify'],
    })

    const qa = enterprise.service('qa')
    await qa.ask('What is our policy?')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.enterprise.internal/qa/ask',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
        }),
      })
    )
  })
})
