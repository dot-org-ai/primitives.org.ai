/**
 * Stripe Finance Provider Tests
 *
 * Tests for the Stripe payment provider implementation covering:
 * - Provider initialization with API keys
 * - Invoice creation and management
 * - Payment processing
 * - Customer management
 * - Refund operations
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest'
import { createStripeProvider, stripeInfo } from '../../src/providers/finance/stripe.js'
import type { FinanceProvider } from '../../src/providers/types.js'
import {
  setupMockFetch,
  resetMockFetch,
  mockJsonResponse,
  mockErrorResponse,
  mockNetworkError,
  getLastFetchCall,
  getFetchCall,
  parseFetchFormBody,
  stripeMocks,
  createTestLineItems,
} from './helpers.js'

describe('Stripe Finance Provider', () => {
  let mockFetch: MockInstance
  let provider: FinanceProvider

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
      const provider = createStripeProvider({})
      expect(provider.info).toBe(stripeInfo)
      expect(provider.info.id).toBe('finance.stripe')
      expect(provider.info.name).toBe('Stripe')
      expect(provider.info.category).toBe('finance')
    })

    it('should require API key for initialization', async () => {
      provider = createStripeProvider({})
      await expect(provider.initialize({})).rejects.toThrow('Stripe API key is required')
    })

    it('should initialize successfully with valid API key', async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await expect(provider.initialize({ apiKey: 'sk_test_123' })).resolves.toBeUndefined()
    })

    it('should include requiredConfig in provider info', () => {
      provider = createStripeProvider({})
      expect(provider.info.requiredConfig).toContain('apiKey')
    })

    it('should include optionalConfig in provider info', () => {
      provider = createStripeProvider({})
      expect(provider.info.optionalConfig).toContain('webhookSecret')
    })
  })

  // ===========================================================================
  // Health Check Tests
  // ===========================================================================

  describe('healthCheck', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should return healthy status on successful balance check', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ available: [{ amount: 1000 }], pending: [] })
      )

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(true)
      expect(health.message).toBe('Connected')
      expect(health.latencyMs).toBeGreaterThanOrEqual(0)
      expect(health.checkedAt).toBeInstanceOf(Date)
    })

    it('should call balance endpoint for health check', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse({}))

      await provider.healthCheck()

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('/balance')
    })

    it('should return unhealthy status on API error', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(stripeMocks.error('Invalid API Key', 'authentication_error'), 401)
      )

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Invalid API Key')
    })

    it('should return unhealthy status on network error', async () => {
      mockFetch.mockRejectedValueOnce(mockNetworkError('Network unavailable'))

      const health = await provider.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.message).toBe('Network unavailable')
    })
  })

  // ===========================================================================
  // Invoice Operations Tests
  // ===========================================================================

  describe('createInvoice', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should create invoice with line items', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))
        .mockResolvedValueOnce(mockJsonResponse({})) // line item 1
        .mockResolvedValueOnce(mockJsonResponse({})) // line item 2
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))

      const result = await provider.createInvoice({
        customerId: 'cus_123',
        lineItems: createTestLineItems(2),
        currency: 'usd',
      })

      expect(result.id).toBe('inv_123')
      expect(result.customerId).toBe('cus_123')
    })

    it('should use form-encoded body for Stripe API', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))
        .mockResolvedValueOnce(mockJsonResponse({}))
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))

      await provider.createInvoice({
        customerId: 'cus_123',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
        currency: 'usd',
      })

      const { options } = getFetchCall(mockFetch, 0)
      expect(options?.headers).toHaveProperty('Content-Type', 'application/x-www-form-urlencoded')
    })

    it('should include customer ID in request', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))
        .mockResolvedValueOnce(mockJsonResponse({}))
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))

      await provider.createInvoice({
        customerId: 'cus_456',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      })

      // Parse the first call (invoice creation)
      const { options } = getFetchCall(mockFetch, 0)
      const params = new URLSearchParams(options?.body as string)
      expect(params.get('customer')).toBe('cus_456')
    })

    it('should convert unit price to cents', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))
        .mockResolvedValueOnce(mockJsonResponse({}))
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))

      await provider.createInvoice({
        customerId: 'cus_123',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 49.99 }],
      })

      // Check the invoiceitem call
      const { options } = getFetchCall(mockFetch, 1)
      const params = new URLSearchParams(options?.body as string)
      expect(params.get('unit_amount')).toBe('4999')
    })

    it('should set due date when provided', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))
        .mockResolvedValueOnce(mockJsonResponse({}))
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))

      const dueDate = new Date('2024-12-31')
      await provider.createInvoice({
        customerId: 'cus_123',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
        dueDate,
      })

      // Parse the first call (invoice creation)
      const { options } = getFetchCall(mockFetch, 0)
      const params = new URLSearchParams(options?.body as string)
      expect(parseInt(params.get('due_date')!)).toBe(Math.floor(dueDate.getTime() / 1000))
    })

    it('should include memo as description', async () => {
      mockFetch
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))
        .mockResolvedValueOnce(mockJsonResponse({}))
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))

      await provider.createInvoice({
        customerId: 'cus_123',
        lineItems: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
        memo: 'Thank you for your business',
      })

      // Parse the first call (invoice creation)
      const { options } = getFetchCall(mockFetch, 0)
      const params = new URLSearchParams(options?.body as string)
      expect(params.get('description')).toBe('Thank you for your business')
    })
  })

  describe('getInvoice', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should retrieve invoice by ID', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123')))

      const invoice = await provider.getInvoice('inv_123')

      expect(invoice).not.toBeNull()
      expect(invoice?.id).toBe('inv_123')
    })

    it('should return null for non-existent invoice', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(stripeMocks.error('No such invoice'), 404))

      const invoice = await provider.getInvoice('inv_nonexistent')

      expect(invoice).toBeNull()
    })

    it('should convert amounts from cents to dollars', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(stripeMocks.invoice('inv_123', { subtotal: 5000, total: 5250 }))
      )

      const invoice = await provider.getInvoice('inv_123')

      expect(invoice?.subtotal).toBe(50)
      expect(invoice?.total).toBe(52.5)
    })

    it('should parse status correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(stripeMocks.invoice('inv_123', { status: 'paid' }))
      )

      const invoice = await provider.getInvoice('inv_123')

      expect(invoice?.status).toBe('paid')
    })
  })

  describe('listInvoices', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should return paginated invoices', async () => {
      const invoices = [stripeMocks.invoice('inv_1'), stripeMocks.invoice('inv_2')]
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.listResponse(invoices, true)))

      const result = await provider.listInvoices()

      expect(result.items).toHaveLength(2)
      expect(result.hasMore).toBe(true)
    })

    it('should apply pagination options', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.listResponse([])))

      await provider.listInvoices({ limit: 25, cursor: 'inv_last' })

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('limit=25')
      expect(url).toContain('starting_after=inv_last')
    })

    it('should filter by customer ID', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.listResponse([])))

      await provider.listInvoices({ customerId: 'cus_123' })

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('customer=cus_123')
    })

    it('should filter by status', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.listResponse([])))

      await provider.listInvoices({ status: 'open' })

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('status=open')
    })
  })

  describe('sendInvoice', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should finalize and send draft invoice', async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse(stripeMocks.invoice('inv_123', { status: 'draft' }))
        )
        .mockResolvedValueOnce(mockJsonResponse(stripeMocks.invoice('inv_123', { status: 'open' })))
        .mockResolvedValueOnce(mockJsonResponse({}))

      const result = await provider.sendInvoice!('inv_123')

      expect(result).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should return false on failure', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(stripeMocks.error('Invoice not found'), 404)
      )

      const result = await provider.sendInvoice!('inv_nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('voidInvoice', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should void invoice successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(stripeMocks.invoice('inv_123', { status: 'void' }))
      )

      const result = await provider.voidInvoice!('inv_123')

      expect(result).toBe(true)
      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('/invoices/inv_123/void')
    })
  })

  // ===========================================================================
  // Payment Operations Tests
  // ===========================================================================

  describe('createPayment', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should create payment intent', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.paymentIntent('pi_123')))

      const result = await provider.createPayment({
        amount: 100,
        currency: 'usd',
        paymentMethod: 'pm_123',
      })

      expect(result.id).toBe('pi_123')
      expect(result.amount).toBe(100)
      expect(result.status).toBe('succeeded')
    })

    it('should convert amount to cents', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.paymentIntent('pi_123')))

      await provider.createPayment({
        amount: 49.99,
        currency: 'usd',
        paymentMethod: 'pm_123',
      })

      const body = parseFetchFormBody(mockFetch)
      expect(body.amount).toBe('4999')
    })

    it('should include customer ID when provided', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.paymentIntent('pi_123')))

      await provider.createPayment({
        amount: 100,
        currency: 'usd',
        paymentMethod: 'pm_123',
        customerId: 'cus_123',
      })

      const body = parseFetchFormBody(mockFetch)
      expect(body.customer).toBe('cus_123')
    })

    it('should set confirm to true', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.paymentIntent('pi_123')))

      await provider.createPayment({
        amount: 100,
        currency: 'usd',
        paymentMethod: 'pm_123',
      })

      const body = parseFetchFormBody(mockFetch)
      expect(body.confirm).toBe('true')
    })
  })

  describe('getPayment', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should retrieve payment intent by ID', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.paymentIntent('pi_123')))

      const payment = await provider.getPayment('pi_123')

      expect(payment).not.toBeNull()
      expect(payment?.id).toBe('pi_123')
    })

    it('should return null for non-existent payment', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(stripeMocks.error('No such payment_intent'), 404)
      )

      const payment = await provider.getPayment('pi_nonexistent')

      expect(payment).toBeNull()
    })

    it('should map payment status correctly', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(stripeMocks.paymentIntent('pi_123', { status: 'requires_payment_method' }))
      )

      const payment = await provider.getPayment('pi_123')

      expect(payment?.status).toBe('pending')
    })
  })

  describe('listPayments', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should return paginated payment intents', async () => {
      const intents = [stripeMocks.paymentIntent('pi_1'), stripeMocks.paymentIntent('pi_2')]
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.listResponse(intents)))

      const result = await provider.listPayments()

      expect(result.items).toHaveLength(2)
    })
  })

  describe('refundPayment', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should create full refund', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.refund('re_123', 'pi_123')))

      const refund = await provider.refundPayment!('pi_123')

      expect(refund.id).toBe('re_123')
      expect(refund.paymentId).toBe('pi_123')
    })

    it('should create partial refund', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(stripeMocks.refund('re_123', 'pi_123', { amount: 2500 }))
      )

      const refund = await provider.refundPayment!('pi_123', 25)

      const body = parseFetchFormBody(mockFetch)
      expect(body.amount).toBe('2500')
      expect(refund.amount).toBe(25)
    })
  })

  // ===========================================================================
  // Customer Operations Tests
  // ===========================================================================

  describe('createCustomer', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should create customer with basic info', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.customer('cus_123')))

      const result = await provider.createCustomer!({
        name: 'John Doe',
        email: 'john@example.com',
      })

      expect(result.id).toBe('cus_123')
      expect(result.name).toBe('John Doe')
    })

    it('should include address when provided', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.customer('cus_123')))

      await provider.createCustomer!({
        name: 'John Doe',
        address: {
          line1: '123 Main St',
          line2: 'Suite 100',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'US',
        },
      })

      const body = parseFetchFormBody(mockFetch)
      expect(body['address[line1]']).toBe('123 Main St')
      expect(body['address[city]']).toBe('San Francisco')
      expect(body['address[postal_code]']).toBe('94105')
    })
  })

  describe('getCustomer', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should retrieve customer by ID', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.customer('cus_123')))

      const customer = await provider.getCustomer!('cus_123')

      expect(customer).not.toBeNull()
      expect(customer?.id).toBe('cus_123')
    })

    it('should convert balance from cents', async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse(stripeMocks.customer('cus_123', { balance: -5000 }))
      )

      const customer = await provider.getCustomer!('cus_123')

      expect(customer?.balance).toBe(-50)
    })
  })

  describe('listCustomers', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should return paginated customers', async () => {
      const customers = [stripeMocks.customer('cus_1'), stripeMocks.customer('cus_2')]
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.listResponse(customers)))

      const result = await provider.listCustomers!()

      expect(result.items).toHaveLength(2)
    })
  })

  // ===========================================================================
  // API Request Formatting Tests
  // ===========================================================================

  describe('API request formatting', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should use Bearer token authentication', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.customer('cus_123')))

      await provider.getCustomer!('cus_123')

      const { options } = getLastFetchCall(mockFetch)
      expect(options?.headers).toHaveProperty('Authorization', 'Bearer sk_test_123')
    })

    it('should use correct base URL', async () => {
      mockFetch.mockResolvedValueOnce(mockJsonResponse(stripeMocks.customer('cus_123')))

      await provider.getCustomer!('cus_123')

      const { url } = getLastFetchCall(mockFetch)
      expect(url).toContain('https://api.stripe.com/v1')
    })
  })

  // ===========================================================================
  // Error Handling Tests
  // ===========================================================================

  describe('error handling', () => {
    beforeEach(async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })
    })

    it('should handle card declined errors', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(
          stripeMocks.error('Your card was declined', 'card_error', 'card_declined'),
          402
        )
      )

      await expect(
        provider.createPayment({ amount: 100, currency: 'usd', paymentMethod: 'pm_123' })
      ).rejects.toThrow('Your card was declined')
    })

    it('should handle rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(stripeMocks.error('Rate limit exceeded', 'rate_limit_error'), 429)
      )

      await expect(provider.listInvoices()).rejects.toThrow('Rate limit exceeded')
    })

    it('should handle invalid request errors', async () => {
      mockFetch.mockResolvedValueOnce(
        mockErrorResponse(stripeMocks.error('Invalid currency', 'invalid_request_error'), 400)
      )

      await expect(
        provider.createInvoice({
          customerId: 'cus_123',
          lineItems: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
          currency: 'invalid',
        })
      ).rejects.toThrow('Invalid currency')
    })
  })

  // ===========================================================================
  // Dispose Tests
  // ===========================================================================

  describe('dispose', () => {
    it('should dispose without error', async () => {
      provider = createStripeProvider({ apiKey: 'sk_test_123' })
      await provider.initialize({ apiKey: 'sk_test_123' })

      await expect(provider.dispose()).resolves.toBeUndefined()
    })
  })
})
