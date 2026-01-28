/**
 * Common test helpers and mock utilities for provider tests
 *
 * Provides reusable mock patterns and test utilities for provider implementations.
 */

import { vi, type MockInstance } from 'vitest'

// =============================================================================
// Mock Fetch Response Types
// =============================================================================

export interface MockFetchResponse {
  ok: boolean
  status?: number
  statusText?: string
  json: () => Promise<unknown>
  text?: () => Promise<string>
  arrayBuffer?: () => Promise<ArrayBuffer>
}

// =============================================================================
// Mock Fetch Utilities
// =============================================================================

/**
 * Create a mock fetch function that can be configured per test
 */
export function createMockFetch() {
  return vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>()
}

/**
 * Create a successful JSON response
 */
export function mockJsonResponse<T>(data: T, status = 200): MockFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
    arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(data)).buffer,
  }
}

/**
 * Create an error response
 */
export function mockErrorResponse(
  error: { message?: string; error?: string; code?: string },
  status = 400
): MockFetchResponse {
  return {
    ok: false,
    status,
    statusText: 'Bad Request',
    json: async () => error,
    text: async () => JSON.stringify(error),
  }
}

/**
 * Create a network error (simulates fetch rejection)
 */
export function mockNetworkError(message = 'Network error'): Error {
  return new Error(message)
}

/**
 * Setup mock fetch on global
 */
export function setupMockFetch(): MockInstance<
  [RequestInfo | URL, RequestInit?],
  Promise<Response>
> {
  const mockFetch = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>()
  global.fetch = mockFetch as unknown as typeof fetch
  return mockFetch
}

/**
 * Reset mock fetch between tests
 */
export function resetMockFetch(mockFetch: MockInstance) {
  mockFetch.mockReset()
}

// =============================================================================
// Request Assertion Helpers
// =============================================================================

/**
 * Get the last call's request info from mock fetch
 */
export function getLastFetchCall(mockFetch: MockInstance) {
  const calls = mockFetch.mock.calls
  if (calls.length === 0) {
    throw new Error('No fetch calls recorded')
  }
  const [url, options] = calls[calls.length - 1]
  return { url: String(url), options }
}

/**
 * Get a specific call's request info by index
 */
export function getFetchCall(mockFetch: MockInstance, index: number) {
  const calls = mockFetch.mock.calls
  if (index >= calls.length) {
    throw new Error(`Fetch call at index ${index} not found. Only ${calls.length} calls recorded.`)
  }
  const [url, options] = calls[index]
  return { url: String(url), options }
}

/**
 * Assert that fetch was called with specific URL pattern
 */
export function assertFetchCalledWithUrl(mockFetch: MockInstance, urlPattern: string | RegExp) {
  const { url } = getLastFetchCall(mockFetch)
  if (typeof urlPattern === 'string') {
    if (!url.includes(urlPattern)) {
      throw new Error(`Expected URL to contain "${urlPattern}", got "${url}"`)
    }
  } else {
    if (!urlPattern.test(url)) {
      throw new Error(`Expected URL to match ${urlPattern}, got "${url}"`)
    }
  }
}

/**
 * Assert that fetch was called with specific method
 */
export function assertFetchCalledWithMethod(mockFetch: MockInstance, method: string) {
  const { options } = getLastFetchCall(mockFetch)
  const actualMethod = options?.method || 'GET'
  if (actualMethod.toUpperCase() !== method.toUpperCase()) {
    throw new Error(`Expected method "${method}", got "${actualMethod}"`)
  }
}

/**
 * Assert that fetch was called with specific header
 */
export function assertFetchCalledWithHeader(
  mockFetch: MockInstance,
  headerName: string,
  expectedValue: string
) {
  const { options } = getLastFetchCall(mockFetch)
  const headers = options?.headers as Record<string, string> | undefined
  if (!headers) {
    throw new Error('No headers in fetch call')
  }
  const actualValue = headers[headerName]
  if (actualValue !== expectedValue) {
    throw new Error(
      `Expected header "${headerName}" to be "${expectedValue}", got "${actualValue}"`
    )
  }
}

/**
 * Assert that fetch was called with Authorization header
 */
export function assertFetchCalledWithAuth(
  mockFetch: MockInstance,
  authType: 'Bearer' | 'Basic',
  token: string
) {
  const expectedAuth = `${authType} ${token}`
  assertFetchCalledWithHeader(mockFetch, 'Authorization', expectedAuth)
}

/**
 * Parse JSON body from fetch call
 */
export function parseFetchJsonBody(mockFetch: MockInstance): unknown {
  const { options } = getLastFetchCall(mockFetch)
  if (!options?.body) {
    return undefined
  }
  if (typeof options.body === 'string') {
    return JSON.parse(options.body)
  }
  throw new Error('Body is not a JSON string')
}

/**
 * Parse form-urlencoded body from fetch call
 */
export function parseFetchFormBody(mockFetch: MockInstance): Record<string, string> {
  const { options } = getLastFetchCall(mockFetch)
  if (!options?.body) {
    return {}
  }
  if (typeof options.body === 'string') {
    const params = new URLSearchParams(options.body)
    const result: Record<string, string> = {}
    params.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
  throw new Error('Body is not a URL-encoded string')
}

// =============================================================================
// Common Mock Response Generators
// =============================================================================

/**
 * Create HubSpot-style API responses
 */
export const hubspotMocks = {
  contact(id: string, overrides?: Record<string, unknown>) {
    return {
      id,
      properties: {
        firstname: 'John',
        lastname: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Acme Inc',
        jobtitle: 'Developer',
        createdate: '2024-01-01T00:00:00Z',
        lastmodifieddate: '2024-01-15T00:00:00Z',
        ...overrides,
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    }
  },
  deal(id: string, overrides?: Record<string, unknown>) {
    return {
      id,
      properties: {
        dealname: 'New Deal',
        amount: '10000',
        dealstage: 'negotiation',
        hs_deal_stage_probability: '0.5',
        createdate: '2024-01-01T00:00:00Z',
        hs_lastmodifieddate: '2024-01-15T00:00:00Z',
        ...overrides,
      },
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
    }
  },
  engagement(id: string, type = 'note', overrides?: Record<string, unknown>) {
    return {
      id,
      properties: {
        hs_engagement_type: type,
        hs_engagement_subject: 'Test Subject',
        hs_note_body: 'Test note body',
        hs_createdate: '2024-01-01T00:00:00Z',
        ...overrides,
      },
      createdAt: '2024-01-01T00:00:00Z',
    }
  },
  listResponse<T>(items: T[], hasMore = false, after?: string) {
    return {
      results: items,
      total: items.length,
      paging: hasMore ? { next: { after } } : undefined,
    }
  },
  error(message: string, status = 'error') {
    return { message, status }
  },
}

/**
 * Create Stripe-style API responses
 */
export const stripeMocks = {
  customer(id: string, overrides?: Record<string, unknown>) {
    return {
      id,
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      balance: 0,
      created: Math.floor(Date.now() / 1000),
      ...overrides,
    }
  },
  invoice(id: string, overrides?: Record<string, unknown>) {
    return {
      id,
      number: 'INV-001',
      customer: 'cus_123',
      status: 'draft',
      currency: 'usd',
      subtotal: 10000,
      tax: 0,
      total: 10000,
      amount_due: 10000,
      amount_paid: 0,
      due_date: Math.floor(Date.now() / 1000) + 86400 * 30,
      created: Math.floor(Date.now() / 1000),
      ...overrides,
    }
  },
  paymentIntent(id: string, overrides?: Record<string, unknown>) {
    return {
      id,
      amount: 10000,
      currency: 'usd',
      status: 'succeeded',
      customer: 'cus_123',
      payment_method: 'pm_123',
      created: Math.floor(Date.now() / 1000),
      ...overrides,
    }
  },
  refund(id: string, paymentIntentId: string, overrides?: Record<string, unknown>) {
    return {
      id,
      payment_intent: paymentIntentId,
      amount: 5000,
      status: 'succeeded',
      created: Math.floor(Date.now() / 1000),
      ...overrides,
    }
  },
  listResponse<T>(items: T[], hasMore = false) {
    return {
      data: items,
      has_more: hasMore,
    }
  },
  error(message: string, type = 'invalid_request_error', code?: string) {
    return {
      error: { message, type, code },
    }
  },
}

/**
 * Create Google Sheets-style API responses
 */
export const googleSheetsMocks = {
  spreadsheet(id: string, name: string, sheets?: { id: number; title: string }[]) {
    return {
      spreadsheetId: id,
      properties: { title: name },
      sheets: (sheets || [{ id: 0, title: 'Sheet1' }]).map((s, i) => ({
        properties: {
          sheetId: s.id,
          title: s.title,
          index: i,
          gridProperties: { rowCount: 1000, columnCount: 26 },
        },
      })),
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${id}`,
    }
  },
  sheetWithData(sheetId: number, title: string, data: unknown[][]) {
    return {
      properties: {
        sheetId,
        title,
        index: 0,
        gridProperties: { rowCount: data.length, columnCount: data[0]?.length || 0 },
      },
      data: [
        {
          rowData: data.map((row) => ({
            values: row.map((cell) => ({
              effectiveValue:
                typeof cell === 'number'
                  ? { numberValue: cell }
                  : typeof cell === 'boolean'
                  ? { boolValue: cell }
                  : cell === null
                  ? {}
                  : { stringValue: String(cell) },
            })),
          })),
        },
      ],
    }
  },
  valueRange(range: string, values: unknown[][]) {
    return { range, values }
  },
  updateResponse(range: string, rows: number, cols: number, cells: number) {
    return {
      spreadsheetId: 'test-id',
      updatedRange: range,
      updatedRows: rows,
      updatedColumns: cols,
      updatedCells: cells,
    }
  },
  batchUpdateResponse(replies: unknown[]) {
    return { replies }
  },
  driveFile(id: string, name: string) {
    return {
      id,
      name,
      createdTime: '2024-01-01T00:00:00Z',
      modifiedTime: '2024-01-15T00:00:00Z',
    }
  },
  driveListResponse(files: unknown[], nextPageToken?: string) {
    return { files, nextPageToken }
  },
  error(message: string, code = 400) {
    return { error: { message, code } }
  },
}

/**
 * Create Slack-style API responses
 */
export const slackMocks = {
  message(ts: string, channel: string, text: string, overrides?: Record<string, unknown>) {
    return {
      ts,
      channel,
      user: 'U123',
      text,
      ...overrides,
    }
  },
  channel(id: string, name: string, overrides?: Record<string, unknown>) {
    return {
      id,
      name,
      topic: { value: 'Test topic' },
      purpose: { value: 'Test purpose' },
      is_private: false,
      is_archived: false,
      num_members: 10,
      created: Math.floor(Date.now() / 1000),
      ...overrides,
    }
  },
  user(id: string, name: string, overrides?: Record<string, unknown>) {
    return {
      id,
      name,
      real_name: `Real ${name}`,
      profile: {
        display_name: name,
        email: `${name}@example.com`,
        image_192: 'https://example.com/avatar.png',
        title: 'Developer',
      },
      is_admin: false,
      is_owner: false,
      is_bot: false,
      deleted: false,
      tz: 'America/New_York',
      ...overrides,
    }
  },
  team(id: string, name: string, domain: string) {
    return {
      id,
      name,
      domain,
      icon: { image_132: 'https://example.com/icon.png' },
    }
  },
  okResponse(data: Record<string, unknown> = {}) {
    return { ok: true, ...data }
  },
  errorResponse(error: string) {
    return { ok: false, error }
  },
  postMessageResponse(ts: string, channel: string) {
    return { ok: true, ts, channel }
  },
  conversationsHistoryResponse(messages: unknown[], hasMore = false, nextCursor?: string) {
    return {
      ok: true,
      messages,
      has_more: hasMore,
      response_metadata: nextCursor ? { next_cursor: nextCursor } : {},
    }
  },
  conversationsListResponse(channels: unknown[], nextCursor?: string) {
    return {
      ok: true,
      channels,
      response_metadata: nextCursor ? { next_cursor: nextCursor } : {},
    }
  },
  usersListResponse(members: unknown[], nextCursor?: string) {
    return {
      ok: true,
      members,
      response_metadata: nextCursor ? { next_cursor: nextCursor } : {},
    }
  },
}

// =============================================================================
// Test Data Factories
// =============================================================================

/**
 * Generate test contact data
 */
export function createTestContact(
  overrides?: Partial<{
    firstName: string
    lastName: string
    email: string
    phone: string
    company: string
    title: string
  }>
) {
  return {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    phone: '+1234567890',
    company: 'Test Company',
    title: 'Developer',
    ...overrides,
  }
}

/**
 * Generate test invoice line items
 */
export function createTestLineItems(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    description: `Item ${i + 1}`,
    quantity: i + 1,
    unitPrice: (i + 1) * 100,
  }))
}

/**
 * Generate test spreadsheet data
 */
export function createTestSpreadsheetData(rows = 3, cols = 3): (string | number | null)[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) =>
      row === 0 ? `Header${col + 1}` : `Value${row}-${col + 1}`
    )
  )
}
