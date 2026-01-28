/**
 * Tests for Email Transport Adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  EmailTransport,
  createEmailTransport,
  createEmailTransportWithProvider,
  createResendProvider,
  generateNotificationEmail,
  generateApprovalEmail,
  parseApprovalReply,
  isApproved,
  isRejected,
  isEmailTransportConfig,
  type EmailProvider,
  type EmailMessage,
  type EmailSendResult,
  type EmailTransportConfig,
  type InboundEmail,
  type ApprovalRequestData,
} from '../../src/transports/email.js'

// =============================================================================
// Mock Provider
// =============================================================================

function createMockProvider(overrides?: Partial<EmailProvider>): EmailProvider {
  return {
    name: 'mock',
    send: vi.fn().mockResolvedValue({
      success: true,
      messageId: 'msg_mock_123',
    } as EmailSendResult),
    verify: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

// =============================================================================
// EmailTransport Tests
// =============================================================================

describe('EmailTransport', () => {
  let mockProvider: EmailProvider
  let transport: EmailTransport

  beforeEach(() => {
    mockProvider = createMockProvider()
    transport = createEmailTransportWithProvider(mockProvider, {
      from: 'test@example.com',
      replyTo: 'replies@example.com',
      approvalBaseUrl: 'https://app.example.com/approvals',
    })
  })

  describe('constructor', () => {
    it('should create transport with custom provider', () => {
      expect(transport.getProvider()).toBe(mockProvider)
      expect(transport.getConfig().from).toBe('test@example.com')
    })

    it('should create transport with API key (Resend)', () => {
      const apiKeyTransport = createEmailTransport({
        apiKey: 'test-api-key',
        from: 'notifications@example.com',
      })
      expect(apiKeyTransport.getProvider().name).toBe('resend')
    })

    it('should throw error without apiKey or provider', () => {
      expect(() => {
        new EmailTransport({ transport: 'email' })
      }).toThrow('Email transport requires either apiKey or customProvider')
    })
  })

  describe('sendNotification', () => {
    it('should send notification email', async () => {
      const result = await transport.sendNotification({
        to: 'user@example.com',
        message: 'Test notification',
      })

      expect(result.success).toBe(true)
      expect(result.transport).toBe('email')
      expect(result.messageId).toBe('msg_mock_123')

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          from: 'test@example.com',
          replyTo: 'replies@example.com',
        })
      )
    })

    it('should send to multiple recipients', async () => {
      await transport.sendNotification({
        to: ['user1@example.com', 'user2@example.com'],
        message: 'Team notification',
      })

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['user1@example.com', 'user2@example.com'],
        })
      )
    })

    it('should include priority in tags', async () => {
      await transport.sendNotification({
        to: 'user@example.com',
        message: 'Urgent!',
        priority: 'urgent',
      })

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: expect.arrayContaining([{ name: 'priority', value: 'urgent' }]),
        })
      )
    })

    it('should include metadata in email content', async () => {
      await transport.sendNotification({
        to: 'user@example.com',
        message: 'Deployment complete',
        metadata: { version: '2.1.0', environment: 'production' },
      })

      const sentEmail = (mockProvider.send as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as EmailMessage
      expect(sentEmail.html).toContain('version')
      expect(sentEmail.html).toContain('2.1.0')
      expect(sentEmail.text).toContain('version: 2.1.0')
    })

    it('should handle send failure', async () => {
      mockProvider.send = vi.fn().mockResolvedValue({
        success: false,
        error: 'Rate limit exceeded',
      })

      const result = await transport.sendNotification({
        to: 'user@example.com',
        message: 'Test',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })
  })

  describe('sendApprovalRequest', () => {
    it('should send approval request email', async () => {
      const result = await transport.sendApprovalRequest({
        to: 'manager@example.com',
        request: 'Expense: $500 for AWS',
        requestId: 'apr_123',
      })

      expect(result.success).toBe(true)
      expect(result.transport).toBe('email')
      expect(result.metadata?.requestId).toBe('apr_123')
    })

    it('should include approval URLs when base URL configured', async () => {
      const result = await transport.sendApprovalRequest({
        to: 'manager@example.com',
        request: 'Deploy v2.0',
        requestId: 'apr_456',
      })

      expect(result.metadata?.approveUrl).toBe('https://app.example.com/approvals/apr_456/approve')
      expect(result.metadata?.rejectUrl).toBe('https://app.example.com/approvals/apr_456/reject')

      const sentEmail = (mockProvider.send as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as EmailMessage
      expect(sentEmail.html).toContain('https://app.example.com/approvals/apr_456/approve')
    })

    it('should include context in email', async () => {
      await transport.sendApprovalRequest({
        to: 'manager@example.com',
        request: 'Expense approval',
        requestId: 'apr_789',
        context: { amount: 500, category: 'Infrastructure' },
      })

      const sentEmail = (mockProvider.send as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as EmailMessage
      expect(sentEmail.html).toContain('amount')
      expect(sentEmail.html).toContain('500')
      expect(sentEmail.html).toContain('Infrastructure')
    })

    it('should include expiration date', async () => {
      const expiresAt = new Date('2025-12-31T23:59:59Z')

      await transport.sendApprovalRequest({
        to: 'manager@example.com',
        request: 'Time-sensitive approval',
        requestId: 'apr_exp',
        expiresAt,
      })

      const sentEmail = (mockProvider.send as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as EmailMessage
      expect(sentEmail.html).toContain('expires')
    })

    it('should include request ID header', async () => {
      await transport.sendApprovalRequest({
        to: 'manager@example.com',
        request: 'Test',
        requestId: 'apr_header',
      })

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Approval-Request-Id': 'apr_header' },
        })
      )
    })
  })

  describe('parseReply', () => {
    it('should parse APPROVED reply', () => {
      const email: InboundEmail = {
        from: 'manager@example.com',
        to: 'approvals@example.com',
        subject: 'Re: Approval Required',
        text: 'APPROVED\n\nLooks good to me.',
      }

      const result = transport.parseReply(email)

      expect(result.isApprovalResponse).toBe(true)
      expect(result.approved).toBe(true)
      expect(result.from).toBe('manager@example.com')
      expect(result.notes).toBe('Looks good to me.')
    })

    it('should parse REJECTED reply', () => {
      const email: InboundEmail = {
        from: 'manager@example.com',
        to: 'approvals@example.com',
        subject: 'Re: Approval Required',
        text: 'REJECTED\n\nBudget exceeded.',
      }

      const result = transport.parseReply(email)

      expect(result.isApprovalResponse).toBe(true)
      expect(result.approved).toBe(false)
      expect(result.notes).toBe('Budget exceeded.')
    })

    it('should handle various approval keywords', () => {
      const approvalKeywords = ['APPROVED', 'Approve', 'yes', 'LGTM', 'ok']

      for (const keyword of approvalKeywords) {
        const email: InboundEmail = {
          from: 'test@example.com',
          to: 'approvals@example.com',
          subject: 'Re: Approval',
          text: keyword,
        }

        const result = transport.parseReply(email)
        expect(result.isApprovalResponse).toBe(true)
        expect(result.approved).toBe(true)
      }
    })

    it('should handle various rejection keywords', () => {
      const rejectionKeywords = ['REJECTED', 'Reject', 'no', 'deny', 'decline']

      for (const keyword of rejectionKeywords) {
        const email: InboundEmail = {
          from: 'test@example.com',
          to: 'approvals@example.com',
          subject: 'Re: Approval',
          text: keyword,
        }

        const result = transport.parseReply(email)
        expect(result.isApprovalResponse).toBe(true)
        expect(result.approved).toBe(false)
      }
    })

    it('should extract request ID from content', () => {
      const email: InboundEmail = {
        from: 'manager@example.com',
        to: 'approvals@example.com',
        subject: 'Re: Approval Required',
        text: 'APPROVED\n\nRequest ID: apr_123',
      }

      const result = transport.parseReply(email)
      expect(result.requestId).toBe('apr_123')
    })

    it('should skip quoted content', () => {
      const email: InboundEmail = {
        from: 'manager@example.com',
        to: 'approvals@example.com',
        subject: 'Re: Approval Required',
        text: 'APPROVED\n\n> Previous message content\n> More quoted text',
      }

      const result = transport.parseReply(email)
      expect(result.isApprovalResponse).toBe(true)
      expect(result.approved).toBe(true)
    })

    it('should handle HTML-only emails', () => {
      const email: InboundEmail = {
        from: 'manager@example.com',
        to: 'approvals@example.com',
        subject: 'Re: Approval',
        html: '<p>APPROVED</p><p>Great work!</p>',
      }

      const result = transport.parseReply(email)
      expect(result.isApprovalResponse).toBe(true)
      expect(result.approved).toBe(true)
    })

    it('should handle non-approval emails', () => {
      const email: InboundEmail = {
        from: 'user@example.com',
        to: 'support@example.com',
        subject: 'Question about the system',
        text: 'I have a question about how approvals work.',
      }

      const result = transport.parseReply(email)
      expect(result.isApprovalResponse).toBe(false)
      expect(result.approved).toBeUndefined()
    })
  })

  describe('toApprovalResult', () => {
    it('should convert parsed reply to ApprovalResult', () => {
      const reply = transport.parseReply({
        from: 'manager@example.com',
        to: 'approvals@example.com',
        subject: 'Re: Approval',
        text: 'APPROVED\n\nGood to go!',
      })

      const result = transport.toApprovalResult(reply, { id: 'manager', name: 'Manager' })

      expect(result.approved).toBe(true)
      expect(result.approvedBy?.id).toBe('manager')
      expect(result.notes).toBe('Good to go!')
      expect(result.via).toBe('email')
    })

    it('should use email from address if no approver provided', () => {
      const reply = transport.parseReply({
        from: 'approver@example.com',
        to: 'approvals@example.com',
        subject: 'Re: Approval',
        text: 'APPROVED',
      })

      const result = transport.toApprovalResult(reply)

      expect(result.approvedBy?.id).toBe('approver@example.com')
    })
  })

  describe('createHandler', () => {
    it('should create handler for notification payloads', async () => {
      const handler = transport.createHandler()

      const result = await handler(
        {
          to: 'user@example.com',
          body: 'Test notification',
          type: 'notification',
        },
        { transport: 'email' }
      )

      expect(result.success).toBe(true)
      expect(mockProvider.send).toHaveBeenCalled()
    })

    it('should create handler for approval payloads', async () => {
      const handler = transport.createHandler()

      const result = await handler(
        {
          to: 'manager@example.com',
          body: 'Approve this request',
          type: 'approval',
          metadata: { requestId: 'apr_handler' },
        },
        { transport: 'email' }
      )

      expect(result.success).toBe(true)
      expect(result.metadata?.requestId).toBe('apr_handler')
    })

    it('should generate request ID if not provided', async () => {
      const handler = transport.createHandler()

      const result = await handler(
        {
          to: 'manager@example.com',
          body: 'Approve this',
          type: 'approval',
        },
        { transport: 'email' }
      )

      expect(result.metadata?.requestId).toMatch(/^apr_/)
    })
  })

  describe('register', () => {
    it('should register transport handler', () => {
      // This just verifies the method exists and doesn't throw
      expect(() => transport.register()).not.toThrow()
    })
  })
})

// =============================================================================
// Email Template Tests
// =============================================================================

describe('Email Templates', () => {
  describe('generateNotificationEmail', () => {
    it('should generate notification email', () => {
      const { subject, html, text } = generateNotificationEmail('Test message')

      expect(subject).toContain('Notification')
      expect(html).toContain('Test message')
      expect(text).toContain('Test message')
    })

    it('should include priority badge for urgent', () => {
      const { subject, html } = generateNotificationEmail('Urgent!', { priority: 'urgent' })

      expect(subject).toContain('URGENT')
      expect(html).toContain('URGENT')
    })

    it('should include metadata in context section', () => {
      const { html, text } = generateNotificationEmail('Deployment complete', {
        metadata: { version: '2.0', env: 'production' },
      })

      expect(html).toContain('version')
      expect(html).toContain('2.0')
      expect(text).toContain('version: 2.0')
    })

    it('should use custom brand name', () => {
      const { subject } = generateNotificationEmail('Test', {
        templates: { brandName: 'Acme Corp' },
      })

      expect(subject).toContain('Acme Corp')
    })

    it('should escape HTML in message', () => {
      const { html } = generateNotificationEmail('<script>alert("xss")</script>')

      expect(html).not.toContain('<script>')
      expect(html).toContain('&lt;script&gt;')
    })
  })

  describe('generateApprovalEmail', () => {
    it('should generate approval email', () => {
      const requestData: ApprovalRequestData = {
        requestId: 'apr_123',
        request: 'Test approval',
      }

      const { subject, html, text } = generateApprovalEmail('Approve this', requestData)

      expect(subject).toContain('Approval Required')
      expect(html).toContain('Approve this')
      expect(text).toContain('APPROVED')
      expect(text).toContain('REJECTED')
    })

    it('should include approval buttons when URLs provided', () => {
      const requestData: ApprovalRequestData = {
        requestId: 'apr_123',
        request: 'Test',
      }

      const { html } = generateApprovalEmail('Test', requestData, {
        approveUrl: 'https://example.com/approve',
        rejectUrl: 'https://example.com/reject',
      })

      expect(html).toContain('https://example.com/approve')
      expect(html).toContain('https://example.com/reject')
      expect(html).toContain('btn-primary')
      expect(html).toContain('btn-danger')
    })

    it('should include context in email', () => {
      const requestData: ApprovalRequestData = {
        requestId: 'apr_123',
        request: 'Expense',
        context: { amount: 500, category: 'Travel' },
      }

      const { html, text } = generateApprovalEmail('Expense approval', requestData)

      expect(html).toContain('amount')
      expect(html).toContain('500')
      expect(text).toContain('amount: 500')
    })

    it('should include expiration notice', () => {
      const requestData: ApprovalRequestData = {
        requestId: 'apr_123',
        request: 'Test',
        expiresAt: Date.now() + 86400000,
      }

      const { html } = generateApprovalEmail('Test', requestData)

      expect(html).toContain('expires')
    })

    it('should include request ID in footer', () => {
      const requestData: ApprovalRequestData = {
        requestId: 'apr_test_id',
        request: 'Test',
      }

      const { html, text } = generateApprovalEmail('Test', requestData)

      expect(html).toContain('apr_test_id')
      expect(text).toContain('apr_test_id')
    })

    it('should include reply instructions', () => {
      const requestData: ApprovalRequestData = {
        requestId: 'apr_123',
        request: 'Test',
      }

      const { html, text } = generateApprovalEmail('Test', requestData)

      expect(html).toContain('Reply via Email')
      expect(text).toContain('reply to this email')
    })
  })
})

// =============================================================================
// Resend Provider Tests
// =============================================================================

describe('createResendProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should create provider with name "resend"', () => {
    const provider = createResendProvider({ apiKey: 'test-key' })
    expect(provider.name).toBe('resend')
  })

  it('should send email via Resend API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'resend_msg_123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const provider = createResendProvider({ apiKey: 'test-api-key' })
    const result = await provider.send({
      to: 'user@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Hello',
    })

    expect(result.success).toBe(true)
    expect(result.messageId).toBe('resend_msg_123')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      })
    )

    vi.unstubAllGlobals()
  })

  it('should handle API errors', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: 'Unauthorized',
      json: () => Promise.resolve({ message: 'Invalid API key' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const provider = createResendProvider({ apiKey: 'invalid-key' })
    const result = await provider.send({
      to: 'user@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Hello',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid API key')

    vi.unstubAllGlobals()
  })

  it('should handle network errors', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const provider = createResendProvider({ apiKey: 'test-key' })
    const result = await provider.send({
      to: 'user@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Hello',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')

    vi.unstubAllGlobals()
  })

  it('should use custom API URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'msg_123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const provider = createResendProvider({
      apiKey: 'test-key',
      apiUrl: 'https://custom.api.com',
    })
    await provider.send({
      to: 'user@example.com',
      from: 'sender@example.com',
      subject: 'Test',
      text: 'Hello',
    })

    expect(mockFetch).toHaveBeenCalledWith('https://custom.api.com/emails', expect.any(Object))

    vi.unstubAllGlobals()
  })

  it('should verify provider configuration', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    const provider = createResendProvider({ apiKey: 'test-key' })
    const isValid = await provider.verify!()

    expect(isValid).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/domains',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    )

    vi.unstubAllGlobals()
  })
})

// =============================================================================
// Type Guard Tests
// =============================================================================

describe('Type Guards', () => {
  describe('isEmailTransportConfig', () => {
    it('should return true for valid email config', () => {
      const config: EmailTransportConfig = {
        transport: 'email',
        apiKey: 'test',
      }
      expect(isEmailTransportConfig(config)).toBe(true)
    })

    it('should return false for other transport types', () => {
      expect(isEmailTransportConfig({ transport: 'slack' })).toBe(false)
      expect(isEmailTransportConfig({ transport: 'sms' })).toBe(false)
    })

    it('should return false for non-objects', () => {
      expect(isEmailTransportConfig(null)).toBe(false)
      expect(isEmailTransportConfig('email')).toBe(false)
      expect(isEmailTransportConfig(undefined)).toBe(false)
    })
  })

  describe('isApproved / isRejected', () => {
    it('should identify approved replies', () => {
      const reply = parseApprovalReply({
        from: 'test@example.com',
        to: 'approvals@example.com',
        subject: 'Re: Approval',
        text: 'APPROVED',
      })

      expect(isApproved(reply)).toBe(true)
      expect(isRejected(reply)).toBe(false)
    })

    it('should identify rejected replies', () => {
      const reply = parseApprovalReply({
        from: 'test@example.com',
        to: 'approvals@example.com',
        subject: 'Re: Approval',
        text: 'REJECTED',
      })

      expect(isApproved(reply)).toBe(false)
      expect(isRejected(reply)).toBe(true)
    })

    it('should return false for non-approval replies', () => {
      const reply = parseApprovalReply({
        from: 'test@example.com',
        to: 'support@example.com',
        subject: 'General question',
        text: 'How does this work?',
      })

      expect(isApproved(reply)).toBe(false)
      expect(isRejected(reply)).toBe(false)
    })
  })
})

// =============================================================================
// Factory Function Tests
// =============================================================================

describe('Factory Functions', () => {
  describe('createEmailTransport', () => {
    it('should create transport with config', () => {
      const transport = createEmailTransport({
        apiKey: 'test-key',
        from: 'test@example.com',
      })

      expect(transport).toBeInstanceOf(EmailTransport)
      expect(transport.getConfig().from).toBe('test@example.com')
    })
  })

  describe('createEmailTransportWithProvider', () => {
    it('should create transport with custom provider', () => {
      const provider = createMockProvider()
      const transport = createEmailTransportWithProvider(provider, {
        from: 'custom@example.com',
      })

      expect(transport.getProvider()).toBe(provider)
      expect(transport.getConfig().from).toBe('custom@example.com')
    })
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration', () => {
  it('should handle full approval workflow', async () => {
    const mockProvider = createMockProvider()
    const transport = createEmailTransportWithProvider(mockProvider, {
      from: 'approvals@example.com',
      approvalBaseUrl: 'https://app.example.com/approve',
    })

    // 1. Send approval request
    const sendResult = await transport.sendApprovalRequest({
      to: 'manager@example.com',
      request: 'Deploy v2.0 to production',
      requestId: 'apr_deploy_123',
      context: { version: '2.0', environment: 'production' },
    })

    expect(sendResult.success).toBe(true)

    // 2. Simulate email reply
    const replyEmail: InboundEmail = {
      from: 'manager@example.com',
      to: 'approvals@example.com',
      subject: 'Re: Approval Required: Deploy v2.0 to production',
      text: 'APPROVED\n\nLooks good, proceed with deployment.\n\nRequest ID: apr_deploy_123',
    }

    // 3. Parse reply
    const parsed = transport.parseReply(replyEmail)

    expect(parsed.isApprovalResponse).toBe(true)
    expect(parsed.approved).toBe(true)
    expect(parsed.requestId).toBe('apr_deploy_123')
    expect(parsed.notes).toContain('proceed with deployment')

    // 4. Convert to ApprovalResult
    const result = transport.toApprovalResult(parsed, { id: 'manager', name: 'Manager' })

    expect(result.approved).toBe(true)
    expect(result.approvedBy?.id).toBe('manager')
    expect(result.via).toBe('email')
  })

  it('should handle notification with rich content', async () => {
    const mockProvider = createMockProvider()
    const transport = createEmailTransportWithProvider(mockProvider, {
      from: 'notifications@example.com',
      templates: {
        brandName: 'Acme Workflows',
        primaryColor: '#007bff',
        footerText: 'Powered by Acme Workflows',
      },
    })

    await transport.sendNotification({
      to: 'team@example.com',
      message: 'Weekly report is ready',
      subject: 'Weekly Status Report',
      priority: 'normal',
      metadata: {
        reportUrl: 'https://reports.example.com/weekly',
        period: '2025-01-20 to 2025-01-27',
        highlights: 'All KPIs met',
      },
    })

    const sentEmail = (mockProvider.send as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as EmailMessage
    expect(sentEmail.subject).toContain('Weekly Status Report')
    expect(sentEmail.html).toContain('Weekly report is ready')
    expect(sentEmail.html).toContain('reportUrl')
    expect(sentEmail.text).toContain('Powered by Acme Workflows')
  })
})
