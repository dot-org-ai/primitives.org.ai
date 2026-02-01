/**
 * Extended Tests for Communication Tools
 *
 * Comprehensive tests for sendEmail, sendSlackMessage,
 * sendNotification, and sendSms tools.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  sendEmail,
  sendSlackMessage,
  sendNotification,
  sendSms,
  communicationTools,
  registry,
  registerBuiltinTools,
} from '../src/index.js'

describe('Communication Tools - sendEmail Extended', () => {
  describe('metadata', () => {
    it('has correct id', () => {
      expect(sendEmail.id).toBe('communication.email.send')
    })

    it('has correct name', () => {
      expect(sendEmail.name).toBe('Send Email')
    })

    it('has correct category', () => {
      expect(sendEmail.category).toBe('communication')
    })

    it('has correct subcategory', () => {
      expect(sendEmail.subcategory).toBe('email')
    })

    it('requires confirmation', () => {
      expect(sendEmail.requiresConfirmation).toBe(true)
    })

    it('has email permission', () => {
      expect(sendEmail.permissions).toBeDefined()
      expect(sendEmail.permissions?.[0]?.type).toBe('execute')
      expect(sendEmail.permissions?.[0]?.resource).toBe('email')
    })

    it('is for both audiences', () => {
      expect(sendEmail.audience).toBe('both')
    })

    it('has email tag', () => {
      expect(sendEmail.tags).toContain('email')
    })

    it('has send tag', () => {
      expect(sendEmail.tags).toContain('send')
    })

    it('has notify tag', () => {
      expect(sendEmail.tags).toContain('notify')
    })
  })

  describe('parameters', () => {
    it('has to parameter as required', () => {
      const toParam = sendEmail.parameters.find((p) => p.name === 'to')
      expect(toParam).toBeDefined()
      expect(toParam?.required).toBe(true)
    })

    it('has subject parameter as required', () => {
      const subjectParam = sendEmail.parameters.find((p) => p.name === 'subject')
      expect(subjectParam).toBeDefined()
      expect(subjectParam?.required).toBe(true)
    })

    it('has body parameter as required', () => {
      const bodyParam = sendEmail.parameters.find((p) => p.name === 'body')
      expect(bodyParam).toBeDefined()
      expect(bodyParam?.required).toBe(true)
    })

    it('has cc parameter as optional', () => {
      const ccParam = sendEmail.parameters.find((p) => p.name === 'cc')
      expect(ccParam).toBeDefined()
      expect(ccParam?.required).toBe(false)
    })

    it('has bcc parameter as optional', () => {
      const bccParam = sendEmail.parameters.find((p) => p.name === 'bcc')
      expect(bccParam).toBeDefined()
      expect(bccParam?.required).toBe(false)
    })

    it('has html parameter as optional', () => {
      const htmlParam = sendEmail.parameters.find((p) => p.name === 'html')
      expect(htmlParam).toBeDefined()
      expect(htmlParam?.required).toBe(false)
    })

    it('has attachments parameter as optional', () => {
      const attachmentsParam = sendEmail.parameters.find((p) => p.name === 'attachments')
      expect(attachmentsParam).toBeDefined()
      expect(attachmentsParam?.required).toBe(false)
    })

    it('has 7 parameters total', () => {
      expect(sendEmail.parameters).toHaveLength(7)
    })
  })

  describe('handler', () => {
    it('sends email to single recipient', async () => {
      const result = await sendEmail.handler({
        to: ['test@example.com'],
        subject: 'Test Subject',
        body: 'Test body content',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      expect(result.messageId).toMatch(/^msg_/)
    })

    it('sends email to multiple recipients', async () => {
      const result = await sendEmail.handler({
        to: ['a@example.com', 'b@example.com', 'c@example.com'],
        subject: 'Test',
        body: 'Test',
      })

      expect(result.success).toBe(true)
    })

    it('sends email with cc recipients', async () => {
      const result = await sendEmail.handler({
        to: ['to@example.com'],
        cc: ['cc@example.com'],
        subject: 'Test',
        body: 'Test',
      })

      expect(result.success).toBe(true)
    })

    it('sends email with bcc recipients', async () => {
      const result = await sendEmail.handler({
        to: ['to@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test',
        body: 'Test',
      })

      expect(result.success).toBe(true)
    })

    it('sends email with html content', async () => {
      const result = await sendEmail.handler({
        to: ['test@example.com'],
        subject: 'HTML Email',
        body: 'Plain text fallback',
        html: '<h1>Hello World</h1>',
      })

      expect(result.success).toBe(true)
    })

    it('sends email with attachments', async () => {
      const result = await sendEmail.handler({
        to: ['test@example.com'],
        subject: 'Email with Attachment',
        body: 'See attached file',
        attachments: [
          {
            filename: 'test.txt',
            content: 'SGVsbG8gV29ybGQ=', // base64
            contentType: 'text/plain',
          },
        ],
      })

      expect(result.success).toBe(true)
    })

    it('generates unique message IDs', async () => {
      const result1 = await sendEmail.handler({
        to: ['a@example.com'],
        subject: 'Test 1',
        body: 'Body 1',
      })

      const result2 = await sendEmail.handler({
        to: ['b@example.com'],
        subject: 'Test 2',
        body: 'Body 2',
      })

      expect(result1.messageId).not.toBe(result2.messageId)
    })
  })
})

describe('Communication Tools - sendSlackMessage Extended', () => {
  describe('metadata', () => {
    it('has correct id', () => {
      expect(sendSlackMessage.id).toBe('communication.slack.send')
    })

    it('has correct name', () => {
      expect(sendSlackMessage.name).toBe('Send Slack Message')
    })

    it('has correct category', () => {
      expect(sendSlackMessage.category).toBe('communication')
    })

    it('has correct subcategory', () => {
      expect(sendSlackMessage.subcategory).toBe('slack')
    })

    it('has slack permission', () => {
      expect(sendSlackMessage.permissions).toBeDefined()
      expect(sendSlackMessage.permissions?.[0]?.resource).toBe('slack')
    })

    it('has slack tag', () => {
      expect(sendSlackMessage.tags).toContain('slack')
    })

    it('has message tag', () => {
      expect(sendSlackMessage.tags).toContain('message')
    })

    it('has chat tag', () => {
      expect(sendSlackMessage.tags).toContain('chat')
    })
  })

  describe('parameters', () => {
    it('has channel parameter as required', () => {
      const channelParam = sendSlackMessage.parameters.find((p) => p.name === 'channel')
      expect(channelParam).toBeDefined()
      expect(channelParam?.required).toBe(true)
    })

    it('has text parameter as required', () => {
      const textParam = sendSlackMessage.parameters.find((p) => p.name === 'text')
      expect(textParam).toBeDefined()
      expect(textParam?.required).toBe(true)
    })

    it('has blocks parameter as optional', () => {
      const blocksParam = sendSlackMessage.parameters.find((p) => p.name === 'blocks')
      expect(blocksParam).toBeDefined()
      expect(blocksParam?.required).toBe(false)
    })

    it('has threadTs parameter as optional', () => {
      const threadTsParam = sendSlackMessage.parameters.find((p) => p.name === 'threadTs')
      expect(threadTsParam).toBeDefined()
      expect(threadTsParam?.required).toBe(false)
    })

    it('has unfurlLinks parameter as optional', () => {
      const unfurlParam = sendSlackMessage.parameters.find((p) => p.name === 'unfurlLinks')
      expect(unfurlParam).toBeDefined()
      expect(unfurlParam?.required).toBe(false)
    })

    it('has 5 parameters total', () => {
      expect(sendSlackMessage.parameters).toHaveLength(5)
    })
  })

  describe('handler', () => {
    it('sends message to channel', async () => {
      const result = await sendSlackMessage.handler({
        channel: '#general',
        text: 'Hello from test!',
      })

      expect(result.success).toBe(true)
      expect(result.ts).toBeDefined()
      expect(result.channel).toBe('#general')
    })

    it('sends message to channel by ID', async () => {
      const result = await sendSlackMessage.handler({
        channel: 'C1234567890',
        text: 'Hello!',
      })

      expect(result.success).toBe(true)
      expect(result.channel).toBe('C1234567890')
    })

    it('generates timestamp', async () => {
      const result = await sendSlackMessage.handler({
        channel: '#test',
        text: 'Test message',
      })

      expect(result.ts).toMatch(/^\d+\.\d+$/)
    })

    it('sends message with blocks', async () => {
      const result = await sendSlackMessage.handler({
        channel: '#test',
        text: 'Fallback text',
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: 'Hello *world*' },
          },
        ],
      })

      expect(result.success).toBe(true)
    })

    it('sends threaded reply', async () => {
      const result = await sendSlackMessage.handler({
        channel: '#test',
        text: 'Reply in thread',
        threadTs: '1234567890.123456',
      })

      expect(result.success).toBe(true)
    })
  })
})

describe('Communication Tools - sendNotification Extended', () => {
  describe('metadata', () => {
    it('has correct id', () => {
      expect(sendNotification.id).toBe('communication.notify')
    })

    it('has correct name', () => {
      expect(sendNotification.name).toBe('Send Notification')
    })

    it('has correct category', () => {
      expect(sendNotification.category).toBe('communication')
    })

    it('has correct subcategory', () => {
      expect(sendNotification.subcategory).toBe('notification')
    })

    it('has notify tag', () => {
      expect(sendNotification.tags).toContain('notify')
    })

    it('has alert tag', () => {
      expect(sendNotification.tags).toContain('alert')
    })

    it('has message tag', () => {
      expect(sendNotification.tags).toContain('message')
    })
  })

  describe('parameters', () => {
    it('has channel parameter as required', () => {
      const channelParam = sendNotification.parameters.find((p) => p.name === 'channel')
      expect(channelParam).toBeDefined()
      expect(channelParam?.required).toBe(true)
    })

    it('has recipients parameter as required', () => {
      const recipientsParam = sendNotification.parameters.find((p) => p.name === 'recipients')
      expect(recipientsParam).toBeDefined()
      expect(recipientsParam?.required).toBe(true)
    })

    it('has title parameter as required', () => {
      const titleParam = sendNotification.parameters.find((p) => p.name === 'title')
      expect(titleParam).toBeDefined()
      expect(titleParam?.required).toBe(true)
    })

    it('has message parameter as required', () => {
      const messageParam = sendNotification.parameters.find((p) => p.name === 'message')
      expect(messageParam).toBeDefined()
      expect(messageParam?.required).toBe(true)
    })

    it('has priority parameter as optional', () => {
      const priorityParam = sendNotification.parameters.find((p) => p.name === 'priority')
      expect(priorityParam).toBeDefined()
      expect(priorityParam?.required).toBe(false)
    })

    it('has data parameter as optional', () => {
      const dataParam = sendNotification.parameters.find((p) => p.name === 'data')
      expect(dataParam).toBeDefined()
      expect(dataParam?.required).toBe(false)
    })

    it('has 6 parameters total', () => {
      expect(sendNotification.parameters).toHaveLength(6)
    })
  })

  describe('handler', () => {
    it('sends email notification', async () => {
      const result = await sendNotification.handler({
        channel: 'email',
        recipients: ['user@example.com'],
        title: 'Test Alert',
        message: 'This is a test notification',
      })

      expect(result.success).toBe(true)
      expect(result.notificationId).toMatch(/^notif_/)
      expect(result.delivered).toContain('user@example.com')
    })

    it('sends slack notification', async () => {
      const result = await sendNotification.handler({
        channel: 'slack',
        recipients: ['#general'],
        title: 'Alert',
        message: 'Important update',
      })

      expect(result.success).toBe(true)
    })

    it('sends sms notification', async () => {
      const result = await sendNotification.handler({
        channel: 'sms',
        recipients: ['+15551234567'],
        title: 'Alert',
        message: 'SMS notification',
      })

      expect(result.success).toBe(true)
    })

    it('sends push notification', async () => {
      const result = await sendNotification.handler({
        channel: 'push',
        recipients: ['device-token-123'],
        title: 'Push Alert',
        message: 'Push notification message',
      })

      expect(result.success).toBe(true)
    })

    it('sends webhook notification', async () => {
      const result = await sendNotification.handler({
        channel: 'webhook',
        recipients: ['https://example.com/webhook'],
        title: 'Webhook Event',
        message: 'Data payload',
      })

      expect(result.success).toBe(true)
    })

    it('sends to multiple recipients', async () => {
      const recipients = ['a@example.com', 'b@example.com', 'c@example.com']
      const result = await sendNotification.handler({
        channel: 'email',
        recipients,
        title: 'Bulk Alert',
        message: 'Message to many',
      })

      expect(result.success).toBe(true)
      expect(result.delivered).toEqual(recipients)
    })

    it('handles high priority', async () => {
      const result = await sendNotification.handler({
        channel: 'email',
        recipients: ['user@example.com'],
        title: 'Urgent',
        message: 'High priority message',
        priority: 'high',
      })

      expect(result.success).toBe(true)
    })

    it('handles urgent priority', async () => {
      const result = await sendNotification.handler({
        channel: 'sms',
        recipients: ['+15551234567'],
        title: 'Emergency',
        message: 'Urgent message',
        priority: 'urgent',
      })

      expect(result.success).toBe(true)
    })

    it('includes additional data', async () => {
      const result = await sendNotification.handler({
        channel: 'webhook',
        recipients: ['https://example.com/hook'],
        title: 'Event',
        message: 'Custom data attached',
        data: { userId: 123, action: 'test' },
      })

      expect(result.success).toBe(true)
    })

    it('generates notification IDs with correct format', async () => {
      const result1 = await sendNotification.handler({
        channel: 'email',
        recipients: ['a@example.com'],
        title: 'Test 1',
        message: 'Message 1',
      })

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1))

      const result2 = await sendNotification.handler({
        channel: 'email',
        recipients: ['b@example.com'],
        title: 'Test 2',
        message: 'Message 2',
      })

      expect(result1.notificationId).toMatch(/^notif_\d+$/)
      expect(result2.notificationId).toMatch(/^notif_\d+$/)
    })
  })
})

describe('Communication Tools - sendSms Extended', () => {
  describe('metadata', () => {
    it('has correct id', () => {
      expect(sendSms.id).toBe('communication.sms.send')
    })

    it('has correct name', () => {
      expect(sendSms.name).toBe('Send SMS')
    })

    it('has correct category', () => {
      expect(sendSms.category).toBe('communication')
    })

    it('has correct subcategory', () => {
      expect(sendSms.subcategory).toBe('sms')
    })

    it('requires confirmation', () => {
      expect(sendSms.requiresConfirmation).toBe(true)
    })

    it('has sms permission', () => {
      expect(sendSms.permissions).toBeDefined()
      expect(sendSms.permissions?.[0]?.resource).toBe('sms')
    })

    it('has sms tag', () => {
      expect(sendSms.tags).toContain('sms')
    })

    it('has text tag', () => {
      expect(sendSms.tags).toContain('text')
    })

    it('has mobile tag', () => {
      expect(sendSms.tags).toContain('mobile')
    })
  })

  describe('parameters', () => {
    it('has to parameter as required', () => {
      const toParam = sendSms.parameters.find((p) => p.name === 'to')
      expect(toParam).toBeDefined()
      expect(toParam?.required).toBe(true)
    })

    it('has message parameter as required', () => {
      const messageParam = sendSms.parameters.find((p) => p.name === 'message')
      expect(messageParam).toBeDefined()
      expect(messageParam?.required).toBe(true)
    })

    it('has from parameter as optional', () => {
      const fromParam = sendSms.parameters.find((p) => p.name === 'from')
      expect(fromParam).toBeDefined()
      expect(fromParam?.required).toBe(false)
    })

    it('has 3 parameters total', () => {
      expect(sendSms.parameters).toHaveLength(3)
    })
  })

  describe('handler', () => {
    it('sends sms to phone number', async () => {
      const result = await sendSms.handler({
        to: '+15551234567',
        message: 'Hello via SMS!',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      expect(result.messageId).toMatch(/^sms_/)
    })

    it('sends sms with from number', async () => {
      const result = await sendSms.handler({
        to: '+15551234567',
        message: 'Test message',
        from: '+15559876543',
      })

      expect(result.success).toBe(true)
    })

    it('handles short messages', async () => {
      const result = await sendSms.handler({
        to: '+15551234567',
        message: 'Hi',
      })

      expect(result.success).toBe(true)
    })

    it('handles max length messages', async () => {
      const longMessage = 'A'.repeat(160)
      const result = await sendSms.handler({
        to: '+15551234567',
        message: longMessage,
      })

      expect(result.success).toBe(true)
    })

    it('generates message IDs with correct format', async () => {
      const result1 = await sendSms.handler({
        to: '+15551111111',
        message: 'Message 1',
      })

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 1))

      const result2 = await sendSms.handler({
        to: '+15552222222',
        message: 'Message 2',
      })

      expect(result1.messageId).toMatch(/^sms_\d+$/)
      expect(result2.messageId).toMatch(/^sms_\d+$/)
    })
  })
})

describe('Communication Tools Array', () => {
  it('has 4 tools', () => {
    expect(communicationTools).toHaveLength(4)
  })

  it('contains sendEmail', () => {
    expect(communicationTools.map((t) => t.id)).toContain('communication.email.send')
  })

  it('contains sendSlackMessage', () => {
    expect(communicationTools.map((t) => t.id)).toContain('communication.slack.send')
  })

  it('contains sendNotification', () => {
    expect(communicationTools.map((t) => t.id)).toContain('communication.notify')
  })

  it('contains sendSms', () => {
    expect(communicationTools.map((t) => t.id)).toContain('communication.sms.send')
  })

  it('all tools are in communication category', () => {
    expect(communicationTools.every((t) => t.category === 'communication')).toBe(true)
  })

  it('all tools are for both audiences', () => {
    expect(communicationTools.every((t) => t.audience === 'both')).toBe(true)
  })
})

describe('Communication Tools Registry Integration', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('registers all communication tools', () => {
    registerBuiltinTools()

    expect(registry.has('communication.email.send')).toBe(true)
    expect(registry.has('communication.slack.send')).toBe(true)
    expect(registry.has('communication.notify')).toBe(true)
    expect(registry.has('communication.sms.send')).toBe(true)
  })

  it('can query by communication category', () => {
    registerBuiltinTools()

    const tools = registry.byCategory('communication')
    expect(tools.length).toBeGreaterThanOrEqual(4)
  })

  it('can query by email subcategory', () => {
    registerBuiltinTools()

    const tools = registry.query({ subcategory: 'email' })
    expect(tools.some((t) => t.id === 'communication.email.send')).toBe(true)
  })

  it('can query by sms subcategory', () => {
    registerBuiltinTools()

    const tools = registry.query({ subcategory: 'sms' })
    expect(tools.some((t) => t.id === 'communication.sms.send')).toBe(true)
  })

  it('can search by notify tag', () => {
    registerBuiltinTools()

    const tools = registry.query({ tags: ['notify'] })
    expect(tools.some((t) => t.id === 'communication.email.send')).toBe(true)
    expect(tools.some((t) => t.id === 'communication.notify')).toBe(true)
  })
})
