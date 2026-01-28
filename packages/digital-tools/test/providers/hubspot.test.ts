/**
 * HubSpot CRM Provider Tests
 *
 * Tests for the HubSpot CRM provider implementation covering:
 * - Provider initialization with access tokens
 * - API request formatting and headers
 * - Response parsing for contacts, deals, and activities
 * - Error handling and edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { createHubSpotProvider, hubspotInfo } from '../../src/providers/crm/hubspot.js'
import type { CRMProvider } from '../../src/providers/types.js'
import {
  setupMockFetch,
  resetMockFetch,
  mockJsonResponse,
  mockErrorResponse,
  mockNetworkError,
  getLastFetchCall,
  getFetchCall,
  parseFetchJsonBody,
  hubspotMocks,
  createTestContact,
} from './helpers.js'

describe('HubSpot CRM Provider', () => {
  let mockFetch: MockInstance
  let provider: CRMProvider

  beforeEach(() => {
    mockFetch = setupMockFetch()
  })

  afterEach(() => {
    resetMockFetch(mockFetch)
  })

  // ===========================================================================
  // Provider Initialization Tests
  // ===========================================================================

  describe('initialization', () => {
    it('should have correct provider info', () => {
      const provider = createHubSpotProvider({})
      expect(provider.info).toBe(hubspotInfo)
      expect(provider.info.id).toBe('crm.hubspot')
      expect(provider.info.name).toBe('HubSpot')
      expect(provider.info.category).toBe('crm')
    })

    it('should require access token for initialization', async () => {
      provider = createHubSpotProvider({})
      await expect(provider.initialize({})).rejects.toThrow('HubSpot access token is required')
    })

    it('should initialize successfully with valid access token', async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await expect(provider.initialize({ accessToken: 'test-token' })).resolves.toBeUndefined()
    })

    it('should use default API URL when baseUrl not provided', async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })

      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))
      await provider.getContact('123')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('https://api.hubapi.com/crm/v3')
    })

    it('should use custom baseUrl when provided', async () => {
      provider = createHubSpotProvider({
        accessToken: 'test-token',
        baseUrl: 'https://custom-api.hubspot.com/v3',
      })
      await provider.initialize({
        accessToken: 'test-token',
        baseUrl: 'https://custom-api.hubspot.com/v3',
      })

      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))
      await provider.getContact('123')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('https://custom-api.hubspot.com/v3')
    })
  })

  // ===========================================================================
  // Health Check Tests
  // ===========================================================================

  describe('healthCheck', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should return healthy status on successful API call', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.listResponse([])))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.message).toBe('Connected')
      expect(health.latencyMs).toBeGreaterThanOrEqual(0)
      expect(health.checkedAt).toBeInstanceOf(Date)
    })

    it('should return unhealthy status on API error', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse({ message: 'Unauthorized' }, 401))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('HTTP 401')
    })

    it('should return unhealthy status on network error', async () => {
      mockFetch.mockRejectedValueOnce(mockNetworkError('Connection refused'))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Connection refused')
    })

    it('should include Authorization header in health check request', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.listResponse([])))

      await provider.healthCheck()

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.headers).toHaveProperty('Authorization', 'Bearer test-token')
    })
  })

  // ===========================================================================
  // Contact Operations Tests
  // ===========================================================================

  describe('createContact', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should create contact with required fields', async () => {
      const mockContact = hubspotMocks.contact('123')
      mockFetch.mockResolvedValueOnce(mockJsonResponse(mockContact))

      const result = await provider.createContact({
        firstName: 'John',
        lastName: 'Doe',
      })

      expect(result.id).toBe('123')
      expect(result.firstName).toBe('John')
      expect(result.lastName).toBe('Doe')
    })

    it('should format request body correctly', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))

      await provider.createContact({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Acme',
        title: 'Developer',
      })

      const body = parseFetchJsonBody(mockFetch) as { properties: Record<string, string> }
      expect(body.properties.firstname).toBe('John')
      expect(body.properties.lastname).toBe('Doe')
      expect(body.properties.email).toBe('john@example.com')
      expect(body.properties.phone).toBe('+1234567890')
      expect(body.properties.company).toBe('Acme')
      expect(body.properties.jobtitle).toBe('Developer')
    })

    it('should include custom fields in request', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))

      await provider.createContact({
        firstName: 'John',
        lastName: 'Doe',
        customFields: {
          custom_field_1: 'value1',
          custom_field_2: 123,
        },
      })

      const body = parseFetchJsonBody(mockFetch) as { properties: Record<string, string | number> }
      expect(body.properties.custom_field_1).toBe('value1')
      // The provider converts numbers to strings
      expect(String(body.properties.custom_field_2)).toBe('123')
    })

    it('should use POST method and correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))

      await provider.createContact({ firstName: 'John', lastName: 'Doe' })

      const { url, options } = getLastFetchCall(mockFetch)
      expect(url).toContain('/objects/contacts')
      expect(options?.method).toBe('POST')
    })

    it('should throw error on API failure', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse({ message: 'Validation error' }, 400))

      await expect(provider.createContact({ firstName: 'John', lastName: 'Doe' })).rejects.toThrow(
        'Failed to create contact: Validation error'
      )
    })
  })

  describe('getContact', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should retrieve contact by ID', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))

      const contact = await provider.getContact('123')

      expect(contact).not.toBeNull()
      expect(contact?.id).toBe('123')
      expect(contact?.firstName).toBe('John')
      expect(contact?.lastName).toBe('Doe')
    })

    it('should return null for non-existent contact', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse({ message: 'Not found' }, 404))

      const contact = await provider.getContact('nonexistent')

      expect(contact).toBeNull()
    })

    it('should parse dates correctly', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))

      const contact = await provider.getContact('123')

      expect(contact?.createdAt).toBeInstanceOf(Date)
      expect(contact?.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('updateContact', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should update contact with partial data', async () => {
      const updatedContact = hubspotMocks.contact('123', { email: 'newemail@example.com' })
      mockFetch.mockResolvedValueOnce(mockJsonResponse(updatedContact))

      const result = await provider.updateContact('123', { email: 'newemail@example.com' })

      expect(result.id).toBe('123')
      const body = parseFetchJsonBody(mockFetch) as { properties: Record<string, string> }
      expect(body.properties.email).toBe('newemail@example.com')
    })

    it('should use PATCH method', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))

      await provider.updateContact('123', { firstName: 'Jane' })

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.method).toBe('PATCH')
    })
  })

  describe('listContacts', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should return paginated contacts', async () => {
      const contacts = [hubspotMocks.contact('1'), hubspotMocks.contact('2')]
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(hubspotMocks.listResponse(contacts, true, 'cursor123'))
      )

      const result = await provider.listContacts({ limit: 10 })

      expect(result.items).toHaveLength(2)
      expect(result.hasMore).toBe(true)
      expect(result.nextCursor).toBe('cursor123')
    })

    it('should apply pagination options', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.listResponse([])))

      await provider.listContacts({ limit: 50, cursor: 'page2' })

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('limit=50')
      expect(url).toContain('after=page2')
    })
  })

  describe('searchContacts', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should search contacts by query', async () => {
      const contacts = [hubspotMocks.contact('1')]
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.listResponse(contacts)))

      const result = await provider.searchContacts!('john')

      expect(result).toHaveLength(1)
      const body = parseFetchJsonBody(mockFetch) as { filterGroups: unknown[] }
      expect(body.filterGroups).toBeDefined()
    })
  })

  // ===========================================================================
  // Deal Operations Tests
  // ===========================================================================

  describe('createDeal', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should create deal with required fields', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.deal('deal-123')))

      const result = await provider.createDeal({
        name: 'New Deal',
        stage: 'negotiation',
      })

      expect(result.id).toBe('deal-123')
      expect(result.name).toBe('New Deal')
      expect(result.stage).toBe('negotiation')
    })

    it('should format deal properties correctly', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.deal('deal-123')))

      await provider.createDeal({
        name: 'Big Deal',
        stage: 'qualified',
        value: 50000,
        currency: 'USD',
        probability: 0.75,
        closeDate: new Date('2024-12-31'),
      })

      const body = parseFetchJsonBody(mockFetch) as { properties: Record<string, string> }
      expect(body.properties.dealname).toBe('Big Deal')
      expect(body.properties.dealstage).toBe('qualified')
      expect(body.properties.amount).toBe('50000')
      expect(body.properties.deal_currency_code).toBe('USD')
      expect(body.properties.hs_deal_stage_probability).toBe('0.75')
    })

    it('should associate deal with contact when contactId provided', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(hubspotMocks.deal('deal-123')))
        .mockResolvedValueOnce(mockJsonResponse({})) // association call

      await provider.createDeal({
        name: 'Deal',
        stage: 'negotiation',
        contactId: 'contact-456',
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      const { url } = getFetchCall(mockFetch, 1)
      expect(url).toContain('associations/contacts/contact-456')
    })
  })

  describe('getDeal', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should retrieve deal by ID', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.deal('deal-123')))

      const deal = await provider.getDeal('deal-123')

      expect(deal).not.toBeNull()
      expect(deal?.id).toBe('deal-123')
      expect(deal?.value).toBe(10000)
    })

    it('should return null for non-existent deal', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse({ message: 'Not found' }, 404))

      const deal = await provider.getDeal('nonexistent')

      expect(deal).toBeNull()
    })
  })

  describe('listDeals', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should return paginated deals', async () => {
      const deals = [hubspotMocks.deal('1'), hubspotMocks.deal('2')]
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.listResponse(deals)))

      const result = await provider.listDeals()

      expect(result.items).toHaveLength(2)
    })
  })

  // ===========================================================================
  // Activity Operations Tests
  // ===========================================================================

  describe('logActivity', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should log activity for contact', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(hubspotMocks.engagement('eng-123', 'note')))
        .mockResolvedValueOnce(mockJsonResponse({})) // association call

      const result = await provider.logActivity!('contact-456', {
        type: 'note',
        subject: 'Follow up',
        body: 'Called about proposal',
      })

      expect(result.id).toBe('eng-123')
      expect(result.type).toBe('note')
      expect(result.contactId).toBe('contact-456')
    })

    it('should map activity types correctly', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(hubspotMocks.engagement('eng-123', 'email')))
        .mockResolvedValueOnce(mockJsonResponse({}))

      await provider.logActivity!('contact-456', {
        type: 'email',
        subject: 'Email Subject',
        body: 'Email body content',
      })

      // Get the first call (engagement creation)
      const { options } = getFetchCall(mockFetch, 0)
      const body = JSON.parse(options?.body as string) as { properties: Record<string, string> }
      expect(body.properties.hs_engagement_type).toBe('email')
      expect(body.properties.hs_email_text).toBe('Email body content')
    })
  })

  describe('listActivities', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should return empty array when no activities', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({ results: [] }))

      const activities = await provider.listActivities!('contact-123')

      expect(activities).toEqual([])
    })

    it('should fetch and return activities for contact', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse({ results: [{ id: 'eng-1' }, { id: 'eng-2' }] }))
        .mockResolvedValueOnce(mockJsonResponse(hubspotMocks.engagement('eng-1', 'note')))
        .mockResolvedValueOnce(mockJsonResponse(hubspotMocks.engagement('eng-2', 'call')))

      const activities = await provider.listActivities!('contact-123')

      expect(activities).toHaveLength(2)
    })
  })

  // ===========================================================================
  // API Request Formatting Tests
  // ===========================================================================

  describe('API request formatting', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should include correct Content-Type header', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))

      await provider.createContact({ firstName: 'John', lastName: 'Doe' })

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.headers).toHaveProperty('Content-Type', 'application/json')
    })

    it('should include Bearer token in Authorization header', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(hubspotMocks.contact('123')))

      await provider.getContact('123')

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.headers).toHaveProperty('Authorization', 'Bearer test-token')
    })
  })

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    beforeEach(async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })
    })

    it('should handle rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse({ message: 'Rate limit exceeded' }, 429))

      await expect(provider.createContact({ firstName: 'John', lastName: 'Doe' })).rejects.toThrow(
        'Failed to create contact'
      )
    })

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse({ message: 'Invalid API key' }, 401))

      await expect(provider.getContact('123')).rejects.toThrow('Failed to get contact')
    })

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      await expect(provider.listContacts()).rejects.toThrow('Failed to list contacts')
    })
  })

  // ===========================================================================
  // Dispose Tests
  // ===========================================================================

  describe('dispose', () => {
    it('should dispose without error', async () => {
      provider = createHubSpotProvider({ accessToken: 'test-token' })
      await provider.initialize({ accessToken: 'test-token' })

      await expect(provider.dispose()).resolves.toBeUndefined()
    })
  })
})
