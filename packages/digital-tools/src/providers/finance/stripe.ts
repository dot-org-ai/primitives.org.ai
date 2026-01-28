/**
 * Stripe Finance Provider
 *
 * Concrete implementation of FinanceProvider using Stripe API.
 *
 * @packageDocumentation
 */

import type {
  FinanceProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  CreateInvoiceOptions,
  InvoiceData,
  InvoiceListOptions,
  CreatePaymentOptions,
  PaymentData,
  PaymentListOptions,
  RefundData,
  CreateFinanceCustomerOptions,
  FinanceCustomerData,
  PaginatedResult,
  PaginationOptions,
} from '../types.js'
import { defineProvider } from '../registry.js'

const STRIPE_API_URL = 'https://api.stripe.com/v1'

// =============================================================================
// Stripe API Response Types
// =============================================================================

/** Stripe API error response */
interface StripeErrorResponse {
  error?: {
    message?: string
    type?: string
    code?: string
  }
}

/** Stripe status transitions for invoices */
interface StripeStatusTransitions {
  paid_at?: number
}

/** Stripe invoice from API */
interface StripeInvoice {
  id: string
  number?: string
  customer: string
  status: string
  currency: string
  subtotal: number
  tax?: number
  total: number
  amount_due: number
  amount_paid: number
  due_date?: number
  status_transitions?: StripeStatusTransitions
  hosted_invoice_url?: string
  created: number
}

/** Stripe payment intent from API */
interface StripePaymentIntent {
  id: string
  amount: number
  currency: string
  status: string
  customer?: string
  invoice?: string
  payment_method?: string
  description?: string
  created: number
}

/** Stripe refund from API */
interface StripeRefund {
  id: string
  payment_intent: string
  amount: number
  status: string
  created: number
}

/** Stripe customer from API */
interface StripeCustomer {
  id: string
  name?: string
  email?: string
  phone?: string
  balance?: number
  created: number
}

/** Stripe list response wrapper */
interface StripeListResponse<T> {
  data: T[]
  has_more: boolean
}

/**
 * Stripe provider info
 */
export const stripeInfo: ProviderInfo = {
  id: 'finance.stripe',
  name: 'Stripe',
  description: 'Stripe payment processing and invoicing platform',
  category: 'finance',
  website: 'https://stripe.com',
  docsUrl: 'https://stripe.com/docs/api',
  requiredConfig: ['apiKey'],
  optionalConfig: ['webhookSecret'],
}

/**
 * Create Stripe finance provider
 */
export function createStripeProvider(config: ProviderConfig): FinanceProvider {
  let apiKey: string

  /**
   * Helper to make Stripe API requests
   */
  async function stripeRequest<T>(
    endpoint: string,
    options: {
      method?: string
      body?: Record<string, unknown>
      params?: Record<string, string>
    } = {}
  ): Promise<T> {
    const { method = 'GET', body, params } = options
    const url = new URL(`${STRIPE_API_URL}${endpoint}`)

    // Add query params for GET requests
    if (params && method === 'GET') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value)
        }
      })
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    }

    let requestBody: string | undefined
    if (body && method !== 'GET') {
      // Stripe uses form-encoded data
      const params = new URLSearchParams()
      Object.entries(body).forEach(([key, value]) => {
        params.append(key, String(value))
      })
      requestBody = params.toString()
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: requestBody,
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as StripeErrorResponse
      throw new Error(error.error?.message || `Stripe API error: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  /**
   * Convert Stripe nested params to form format
   */
  function flattenParams(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
    const result: Record<string, string> = {}

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}[${key}]` : key

      if (value === null || value === undefined) {
        continue
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === 'object' && item !== null) {
            Object.assign(
              result,
              flattenParams(item as Record<string, unknown>, `${fullKey}[${index}]`)
            )
          } else {
            result[`${fullKey}[${index}]`] = String(item)
          }
        })
      } else if (typeof value === 'object') {
        Object.assign(result, flattenParams(value as Record<string, unknown>, fullKey))
      } else {
        result[fullKey] = String(value)
      }
    }

    return result
  }

  /**
   * Make Stripe API request with nested params support
   */
  async function stripeRequestWithParams<T>(
    endpoint: string,
    options: {
      method?: string
      data?: Record<string, unknown>
      params?: Record<string, string>
    } = {}
  ): Promise<T> {
    const { method = 'GET', data, params } = options
    const url = new URL(`${STRIPE_API_URL}${endpoint}`)

    // Add query params for GET requests
    if (params && method === 'GET') {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, value)
        }
      })
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    }

    let requestBody: string | undefined
    if (data && method !== 'GET') {
      // Flatten nested objects for Stripe's form format
      const flatParams = flattenParams(data)
      requestBody = new URLSearchParams(flatParams).toString()
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: requestBody,
    })

    if (!response.ok) {
      const error = (await response.json().catch(() => ({}))) as StripeErrorResponse
      throw new Error(error.error?.message || `Stripe API error: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  return {
    info: stripeInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      apiKey = cfg.apiKey as string

      if (!apiKey) {
        throw new Error('Stripe API key is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        // Use balance endpoint to verify API key
        await stripeRequest('/balance')

        return {
          healthy: true,
          latencyMs: Date.now() - start,
          message: 'Connected',
          checkedAt: new Date(),
        }
      } catch (error) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          message: error instanceof Error ? error.message : 'Unknown error',
          checkedAt: new Date(),
        }
      }
    },

    async dispose(): Promise<void> {
      // No cleanup needed
    },

    async createInvoice(invoice: CreateInvoiceOptions): Promise<InvoiceData> {
      const data: Record<string, unknown> = {
        customer: invoice.customerId,
        currency: invoice.currency || 'usd',
        auto_advance: false, // Don't auto-finalize
      }

      if (invoice.dueDate) {
        data.due_date = Math.floor(invoice.dueDate.getTime() / 1000)
      }

      if (invoice.memo) {
        data.description = invoice.memo
      }

      // Create the invoice
      const stripeInvoice = await stripeRequestWithParams<any>('/invoices', {
        method: 'POST',
        data,
      })

      // Add line items
      for (const item of invoice.lineItems) {
        await stripeRequestWithParams('/invoiceitems', {
          method: 'POST',
          data: {
            customer: invoice.customerId,
            invoice: stripeInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_amount: Math.round(item.unitPrice * 100), // Convert to cents
            currency: invoice.currency || 'usd',
          },
        })
      }

      // Retrieve updated invoice with line items
      const updatedInvoice = await stripeRequest<any>(`/invoices/${stripeInvoice.id}`)

      return {
        id: updatedInvoice.id,
        number: updatedInvoice.number || updatedInvoice.id,
        customerId: updatedInvoice.customer,
        status: mapStripeInvoiceStatus(updatedInvoice.status),
        currency: updatedInvoice.currency,
        subtotal: updatedInvoice.subtotal / 100,
        tax: updatedInvoice.tax ? updatedInvoice.tax / 100 : undefined,
        total: updatedInvoice.total / 100,
        amountDue: updatedInvoice.amount_due / 100,
        amountPaid: updatedInvoice.amount_paid / 100,
        dueDate: updatedInvoice.due_date ? new Date(updatedInvoice.due_date * 1000) : undefined,
        paidAt: updatedInvoice.status_transitions?.paid_at
          ? new Date(updatedInvoice.status_transitions.paid_at * 1000)
          : undefined,
        url: updatedInvoice.hosted_invoice_url,
        createdAt: new Date(updatedInvoice.created * 1000),
      }
    },

    async getInvoice(invoiceId: string): Promise<InvoiceData | null> {
      try {
        const invoice = await stripeRequest<any>(`/invoices/${invoiceId}`)

        return {
          id: invoice.id,
          number: invoice.number || invoice.id,
          customerId: invoice.customer,
          status: mapStripeInvoiceStatus(invoice.status),
          currency: invoice.currency,
          subtotal: invoice.subtotal / 100,
          tax: invoice.tax ? invoice.tax / 100 : undefined,
          total: invoice.total / 100,
          amountDue: invoice.amount_due / 100,
          amountPaid: invoice.amount_paid / 100,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
          paidAt: invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000)
            : undefined,
          url: invoice.hosted_invoice_url,
          createdAt: new Date(invoice.created * 1000),
        }
      } catch (error) {
        return null
      }
    },

    async updateInvoice(
      invoiceId: string,
      updates: Partial<CreateInvoiceOptions>
    ): Promise<InvoiceData> {
      const data: Record<string, unknown> = {}

      if (updates.dueDate) {
        data.due_date = Math.floor(updates.dueDate.getTime() / 1000)
      }

      if (updates.memo) {
        data.description = updates.memo
      }

      const invoice = await stripeRequestWithParams<any>(`/invoices/${invoiceId}`, {
        method: 'POST',
        data,
      })

      return {
        id: invoice.id,
        number: invoice.number || invoice.id,
        customerId: invoice.customer,
        status: mapStripeInvoiceStatus(invoice.status),
        currency: invoice.currency,
        subtotal: invoice.subtotal / 100,
        tax: invoice.tax ? invoice.tax / 100 : undefined,
        total: invoice.total / 100,
        amountDue: invoice.amount_due / 100,
        amountPaid: invoice.amount_paid / 100,
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
        paidAt: invoice.status_transitions?.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : undefined,
        url: invoice.hosted_invoice_url,
        createdAt: new Date(invoice.created * 1000),
      }
    },

    async listInvoices(options: InvoiceListOptions = {}): Promise<PaginatedResult<InvoiceData>> {
      const params: Record<string, string> = {}

      if (options.limit) {
        params.limit = String(options.limit)
      }

      if (options.cursor) {
        params.starting_after = options.cursor
      }

      if (options.customerId) {
        params.customer = options.customerId
      }

      if (options.status) {
        params.status = options.status
      }

      const response = await stripeRequest<any>('/invoices', { params })

      return {
        items: response.data.map((invoice: any) => ({
          id: invoice.id,
          number: invoice.number || invoice.id,
          customerId: invoice.customer,
          status: mapStripeInvoiceStatus(invoice.status),
          currency: invoice.currency,
          subtotal: invoice.subtotal / 100,
          tax: invoice.tax ? invoice.tax / 100 : undefined,
          total: invoice.total / 100,
          amountDue: invoice.amount_due / 100,
          amountPaid: invoice.amount_paid / 100,
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : undefined,
          paidAt: invoice.status_transitions?.paid_at
            ? new Date(invoice.status_transitions.paid_at * 1000)
            : undefined,
          url: invoice.hosted_invoice_url,
          createdAt: new Date(invoice.created * 1000),
        })),
        hasMore: response.has_more,
        nextCursor: response.has_more ? response.data[response.data.length - 1]?.id : undefined,
      }
    },

    async sendInvoice(invoiceId: string): Promise<boolean> {
      try {
        // First finalize the invoice if it's a draft
        const invoice = await stripeRequest<any>(`/invoices/${invoiceId}`)
        if (invoice.status === 'draft') {
          await stripeRequestWithParams(`/invoices/${invoiceId}/finalize`, {
            method: 'POST',
          })
        }

        // Send the invoice
        await stripeRequestWithParams(`/invoices/${invoiceId}/send`, {
          method: 'POST',
        })

        return true
      } catch (error) {
        return false
      }
    },

    async voidInvoice(invoiceId: string): Promise<boolean> {
      try {
        await stripeRequestWithParams(`/invoices/${invoiceId}/void`, {
          method: 'POST',
        })
        return true
      } catch (error) {
        return false
      }
    },

    async createPayment(payment: CreatePaymentOptions): Promise<PaymentData> {
      const data: Record<string, unknown> = {
        amount: Math.round(payment.amount * 100), // Convert to cents
        currency: payment.currency,
        payment_method: payment.paymentMethod,
        confirm: true,
      }

      if (payment.customerId) {
        data.customer = payment.customerId
      }

      if (payment.description) {
        data.description = payment.description
      }

      // For Stripe, we create a PaymentIntent
      const intent = await stripeRequestWithParams<any>('/payment_intents', {
        method: 'POST',
        data,
      })

      return {
        id: intent.id,
        amount: intent.amount / 100,
        currency: intent.currency,
        status: mapStripePaymentStatus(intent.status),
        customerId: intent.customer || undefined,
        invoiceId: intent.invoice || undefined,
        paymentMethod: payment.paymentMethod,
        description: intent.description,
        createdAt: new Date(intent.created * 1000),
      }
    },

    async getPayment(paymentId: string): Promise<PaymentData | null> {
      try {
        const intent = await stripeRequest<any>(`/payment_intents/${paymentId}`)

        return {
          id: intent.id,
          amount: intent.amount / 100,
          currency: intent.currency,
          status: mapStripePaymentStatus(intent.status),
          customerId: intent.customer || undefined,
          invoiceId: intent.invoice || undefined,
          paymentMethod: intent.payment_method || 'unknown',
          description: intent.description,
          createdAt: new Date(intent.created * 1000),
        }
      } catch (error) {
        return null
      }
    },

    async listPayments(options: PaymentListOptions = {}): Promise<PaginatedResult<PaymentData>> {
      const params: Record<string, string> = {}

      if (options.limit) {
        params.limit = String(options.limit)
      }

      if (options.cursor) {
        params.starting_after = options.cursor
      }

      if (options.customerId) {
        params.customer = options.customerId
      }

      const response = await stripeRequest<any>('/payment_intents', { params })

      return {
        items: response.data.map((intent: any) => ({
          id: intent.id,
          amount: intent.amount / 100,
          currency: intent.currency,
          status: mapStripePaymentStatus(intent.status),
          customerId: intent.customer || undefined,
          invoiceId: intent.invoice || undefined,
          paymentMethod: intent.payment_method || 'unknown',
          description: intent.description,
          createdAt: new Date(intent.created * 1000),
        })),
        hasMore: response.has_more,
        nextCursor: response.has_more ? response.data[response.data.length - 1]?.id : undefined,
      }
    },

    async refundPayment(paymentId: string, amount?: number): Promise<RefundData> {
      const data: Record<string, unknown> = {
        payment_intent: paymentId,
      }

      if (amount !== undefined) {
        data.amount = Math.round(amount * 100)
      }

      const refund = await stripeRequestWithParams<any>('/refunds', {
        method: 'POST',
        data,
      })

      return {
        id: refund.id,
        paymentId: refund.payment_intent,
        amount: refund.amount / 100,
        status: refund.status,
        createdAt: new Date(refund.created * 1000),
      }
    },

    async createCustomer(customer: CreateFinanceCustomerOptions): Promise<FinanceCustomerData> {
      const data: Record<string, unknown> = {
        name: customer.name,
      }

      if (customer.email) {
        data.email = customer.email
      }

      if (customer.phone) {
        data.phone = customer.phone
      }

      if (customer.address) {
        data.address = {
          line1: customer.address.line1,
          line2: customer.address.line2,
          city: customer.address.city,
          state: customer.address.state,
          postal_code: customer.address.postalCode,
          country: customer.address.country,
        }
      }

      const stripeCustomer = await stripeRequestWithParams<any>('/customers', {
        method: 'POST',
        data,
      })

      return {
        id: stripeCustomer.id,
        name: stripeCustomer.name,
        email: stripeCustomer.email,
        phone: stripeCustomer.phone,
        balance: stripeCustomer.balance ? stripeCustomer.balance / 100 : undefined,
        createdAt: new Date(stripeCustomer.created * 1000),
      }
    },

    async getCustomer(customerId: string): Promise<FinanceCustomerData | null> {
      try {
        const customer = await stripeRequest<any>(`/customers/${customerId}`)

        return {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          balance: customer.balance ? customer.balance / 100 : undefined,
          createdAt: new Date(customer.created * 1000),
        }
      } catch (error) {
        return null
      }
    },

    async listCustomers(
      options: PaginationOptions = {}
    ): Promise<PaginatedResult<FinanceCustomerData>> {
      const params: Record<string, string> = {}

      if (options.limit) {
        params.limit = String(options.limit)
      }

      if (options.cursor) {
        params.starting_after = options.cursor
      }

      const response = await stripeRequest<any>('/customers', { params })

      return {
        items: response.data.map((customer: any) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          balance: customer.balance ? customer.balance / 100 : undefined,
          createdAt: new Date(customer.created * 1000),
        })),
        hasMore: response.has_more,
        nextCursor: response.has_more ? response.data[response.data.length - 1]?.id : undefined,
      }
    },
  }
}

/**
 * Map Stripe invoice status to standard status
 */
function mapStripeInvoiceStatus(
  status: string
): 'draft' | 'open' | 'paid' | 'void' | 'uncollectible' {
  switch (status) {
    case 'draft':
      return 'draft'
    case 'open':
      return 'open'
    case 'paid':
      return 'paid'
    case 'void':
      return 'void'
    case 'uncollectible':
      return 'uncollectible'
    default:
      return 'draft'
  }
}

/**
 * Map Stripe payment status to standard status
 */
function mapStripePaymentStatus(status: string): 'pending' | 'succeeded' | 'failed' | 'refunded' {
  switch (status) {
    case 'requires_payment_method':
    case 'requires_confirmation':
    case 'requires_action':
    case 'processing':
      return 'pending'
    case 'succeeded':
      return 'succeeded'
    case 'canceled':
    case 'requires_capture':
      return 'failed'
    default:
      return 'pending'
  }
}

/**
 * Stripe provider definition
 */
export const stripeProvider = defineProvider(stripeInfo, async (config) =>
  createStripeProvider(config)
)
