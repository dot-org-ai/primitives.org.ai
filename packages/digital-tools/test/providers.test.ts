/**
 * Tests for Provider Registry and Provider Definitions
 *
 * Covers provider registration, discovery, and instantiation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  // Provider registry
  providerRegistry,
  createProviderRegistry,
  registerProvider,
  getProvider,
  listProviders,
  defineProvider,

  // Provider info exports
  sendgridInfo,
  resendInfo,
  slackInfo,
  twilioSmsInfo,
  xlsxInfo,
  googleSheetsInfo,
  cloudinaryInfo,
  todoistInfo,
  stripeInfo,
  zendeskInfo,
  linearInfo,
  notionInfo,
  hubspotInfo,
  shopifyInfo,
  githubInfo,
  typeformInfo,
  mixpanelInfo,
  zoomInfo,
  googleMeetInfo,
  teamsInfo,
  jitsiInfo,
  googleCalendarInfo,
  s3Info,

  // Registration helpers
  registerAllProviders,
  registerEmailProviders,
  registerMessagingProviders,
  registerSpreadsheetProviders,

  // Provider collections
  allProviders,
} from '../src/providers/index.js'

import type {
  BaseProvider,
  ProviderCategory,
  ProviderConfig,
  ProviderInfo,
  ProviderHealth,
  EmailProvider,
  MessagingProvider,
  SpreadsheetProvider,
} from '../src/providers/types.js'

describe('Provider Registry', () => {
  describe('createProviderRegistry', () => {
    it('creates an isolated registry', () => {
      const registry = createProviderRegistry()

      expect(registry.list()).toHaveLength(0)
    })

    it('registries are independent', () => {
      const registry1 = createProviderRegistry()
      const registry2 = createProviderRegistry()

      const mockInfo: ProviderInfo = {
        id: 'test.provider',
        name: 'Test Provider',
        description: 'Test',
        category: 'email',
        requiredConfig: [],
      }

      registry1.register(mockInfo, async () => createMockProvider(mockInfo))

      expect(registry1.has('test.provider')).toBe(true)
      expect(registry2.has('test.provider')).toBe(false)
    })
  })

  describe('register', () => {
    it('registers a provider', () => {
      const registry = createProviderRegistry()

      const mockInfo: ProviderInfo = {
        id: 'mock.email',
        name: 'Mock Email',
        description: 'A mock email provider',
        category: 'email',
        requiredConfig: ['apiKey'],
      }

      registry.register(mockInfo, async (config) => createMockProvider(mockInfo))

      expect(registry.has('mock.email')).toBe(true)
    })

    it('throws on duplicate registration', () => {
      const registry = createProviderRegistry()

      const mockInfo: ProviderInfo = {
        id: 'duplicate.provider',
        name: 'Duplicate',
        description: 'Test',
        category: 'email',
        requiredConfig: [],
      }

      registry.register(mockInfo, async () => createMockProvider(mockInfo))

      expect(() => {
        registry.register(mockInfo, async () => createMockProvider(mockInfo))
      }).toThrow("Provider 'duplicate.provider' is already registered")
    })
  })

  describe('get', () => {
    it('returns registered provider', () => {
      const registry = createProviderRegistry()

      const mockInfo: ProviderInfo = {
        id: 'get.test',
        name: 'Get Test',
        description: 'Test',
        category: 'messaging',
        requiredConfig: [],
      }

      registry.register(mockInfo, async () => createMockProvider(mockInfo))

      const result = registry.get('get.test')

      expect(result).toBeDefined()
      expect(result?.info.id).toBe('get.test')
      expect(result?.info.category).toBe('messaging')
    })

    it('returns undefined for non-existent provider', () => {
      const registry = createProviderRegistry()

      expect(registry.get('non.existent')).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns all providers', () => {
      const registry = createProviderRegistry()

      registry.register(
        { id: 'list.a', name: 'A', description: 'A', category: 'email', requiredConfig: [] },
        async (config) => createMockProvider({ id: 'list.a', name: 'A', description: 'A', category: 'email', requiredConfig: [] })
      )
      registry.register(
        { id: 'list.b', name: 'B', description: 'B', category: 'messaging', requiredConfig: [] },
        async (config) => createMockProvider({ id: 'list.b', name: 'B', description: 'B', category: 'messaging', requiredConfig: [] })
      )

      const all = registry.list()

      expect(all).toHaveLength(2)
    })

    it('filters by category', () => {
      const registry = createProviderRegistry()

      registry.register(
        { id: 'cat.email', name: 'Email', description: 'Email', category: 'email', requiredConfig: [] },
        async () => createMockProvider({ id: 'cat.email', name: 'Email', description: 'Email', category: 'email', requiredConfig: [] })
      )
      registry.register(
        { id: 'cat.sms', name: 'SMS', description: 'SMS', category: 'messaging', requiredConfig: [] },
        async () => createMockProvider({ id: 'cat.sms', name: 'SMS', description: 'SMS', category: 'messaging', requiredConfig: [] })
      )
      registry.register(
        { id: 'cat.email2', name: 'Email2', description: 'Email2', category: 'email', requiredConfig: [] },
        async () => createMockProvider({ id: 'cat.email2', name: 'Email2', description: 'Email2', category: 'email', requiredConfig: [] })
      )

      const emailProviders = registry.list('email')

      expect(emailProviders).toHaveLength(2)
      expect(emailProviders.every((p) => p.info.category === 'email')).toBe(true)
    })
  })

  describe('create', () => {
    it('creates provider instance', async () => {
      const registry = createProviderRegistry()

      const mockInfo: ProviderInfo = {
        id: 'create.test',
        name: 'Create Test',
        description: 'Test',
        category: 'email',
        requiredConfig: [],
      }

      registry.register(mockInfo, async (config) => createMockProvider(mockInfo))

      const provider = await registry.create('create.test', {})

      expect(provider.info.id).toBe('create.test')
    })

    it('throws for non-existent provider', async () => {
      const registry = createProviderRegistry()

      await expect(registry.create('non.existent', {})).rejects.toThrow(
        "Provider 'non.existent' not found"
      )
    })

    it('validates required config', async () => {
      const registry = createProviderRegistry()

      const mockInfo: ProviderInfo = {
        id: 'config.test',
        name: 'Config Test',
        description: 'Test',
        category: 'email',
        requiredConfig: ['apiKey', 'apiSecret'],
      }

      registry.register(mockInfo, async (config) => createMockProvider(mockInfo))

      await expect(registry.create('config.test', { apiKey: 'key' })).rejects.toThrow(
        "missing required config: apiSecret"
      )
    })

    it('passes config to factory', async () => {
      const registry = createProviderRegistry()
      let receivedConfig: ProviderConfig | undefined

      const mockInfo: ProviderInfo = {
        id: 'factory.test',
        name: 'Factory Test',
        description: 'Test',
        category: 'email',
        requiredConfig: ['apiKey'],
      }

      registry.register(mockInfo, async (config) => {
        receivedConfig = config
        return createMockProvider(mockInfo)
      })

      await registry.create('factory.test', { apiKey: 'test-key' })

      expect(receivedConfig?.apiKey).toBe('test-key')
    })
  })

  describe('has', () => {
    it('returns true for registered provider', () => {
      const registry = createProviderRegistry()

      registry.register(
        { id: 'has.test', name: 'Has', description: 'Has', category: 'email', requiredConfig: [] },
        async () => createMockProvider({ id: 'has.test', name: 'Has', description: 'Has', category: 'email', requiredConfig: [] })
      )

      expect(registry.has('has.test')).toBe(true)
    })

    it('returns false for non-existent provider', () => {
      const registry = createProviderRegistry()

      expect(registry.has('non.existent')).toBe(false)
    })
  })
})

describe('defineProvider', () => {
  it('creates provider definition', () => {
    const mockInfo: ProviderInfo = {
      id: 'define.test',
      name: 'Define Test',
      description: 'Test',
      category: 'email',
      requiredConfig: [],
    }

    const definition = defineProvider(mockInfo, async () => createMockProvider(mockInfo))

    expect(definition.info).toBe(mockInfo)
    expect(typeof definition.factory).toBe('function')
    expect(typeof definition.register).toBe('function')
  })
})

describe('Provider Info Exports', () => {
  describe('Email Providers', () => {
    it('sendgrid info is valid', () => {
      expect(sendgridInfo.id).toBe('email.sendgrid')
      expect(sendgridInfo.name).toBe('SendGrid')
      expect(sendgridInfo.category).toBe('email')
      expect(sendgridInfo.requiredConfig).toContain('apiKey')
    })

    it('resend info is valid', () => {
      expect(resendInfo.id).toBe('email.resend')
      expect(resendInfo.name).toBe('Resend')
      expect(resendInfo.category).toBe('email')
      expect(resendInfo.requiredConfig).toContain('apiKey')
    })
  })

  describe('Messaging Providers', () => {
    it('slack info is valid', () => {
      expect(slackInfo.id).toBe('messaging.slack')
      expect(slackInfo.name).toBe('Slack')
      expect(slackInfo.category).toBe('messaging')
      expect(slackInfo.requiredConfig).toContain('accessToken')
    })

    it('twilio sms info is valid', () => {
      expect(twilioSmsInfo.id).toBe('messaging.twilio-sms')
      expect(twilioSmsInfo.name).toBe('Twilio SMS')
      expect(twilioSmsInfo.category).toBe('messaging')
      expect(twilioSmsInfo.requiredConfig).toContain('accountSid')
      expect(twilioSmsInfo.requiredConfig).toContain('authToken')
    })
  })

  describe('Spreadsheet Providers', () => {
    it('xlsx info is valid', () => {
      expect(xlsxInfo.id).toBe('spreadsheet.xlsx')
      expect(xlsxInfo.name).toBe('XLSX (SheetJS)')
      expect(xlsxInfo.category).toBe('spreadsheet')
      expect(xlsxInfo.requiredConfig).toHaveLength(0) // No required config for local xlsx
    })

    it('google sheets info is valid', () => {
      expect(googleSheetsInfo.id).toBe('spreadsheet.google-sheets')
      expect(googleSheetsInfo.name).toBe('Google Sheets')
      expect(googleSheetsInfo.category).toBe('spreadsheet')
    })
  })

  describe('Media Providers', () => {
    it('cloudinary info is valid', () => {
      expect(cloudinaryInfo.id).toBe('media.cloudinary')
      expect(cloudinaryInfo.name).toBe('Cloudinary')
      expect(cloudinaryInfo.category).toBe('media')
      expect(cloudinaryInfo.requiredConfig).toContain('cloudName')
      expect(cloudinaryInfo.requiredConfig).toContain('apiKey')
      expect(cloudinaryInfo.requiredConfig).toContain('apiSecret')
    })
  })

  describe('Task Providers', () => {
    it('todoist info is valid', () => {
      expect(todoistInfo.id).toBe('tasks.todoist')
      expect(todoistInfo.name).toBe('Todoist')
      expect(todoistInfo.category).toBe('tasks')
      expect(todoistInfo.requiredConfig).toContain('apiKey')
    })
  })

  describe('Finance Providers', () => {
    it('stripe info is valid', () => {
      expect(stripeInfo.id).toBe('finance.stripe')
      expect(stripeInfo.name).toBe('Stripe')
      expect(stripeInfo.category).toBe('finance')
      expect(stripeInfo.requiredConfig).toContain('apiKey')
    })
  })

  describe('Support Providers', () => {
    it('zendesk info is valid', () => {
      expect(zendeskInfo.id).toBe('support.zendesk')
      expect(zendeskInfo.name).toBe('Zendesk')
      expect(zendeskInfo.category).toBe('support')
      expect(zendeskInfo.requiredConfig).toContain('subdomain')
    })
  })

  describe('Project Management Providers', () => {
    it('linear info is valid', () => {
      expect(linearInfo.id).toBe('project-management.linear')
      expect(linearInfo.name).toBe('Linear')
      expect(linearInfo.category).toBe('project-management')
      expect(linearInfo.requiredConfig).toContain('apiKey')
    })
  })

  describe('Knowledge Providers', () => {
    it('notion info is valid', () => {
      expect(notionInfo.id).toBe('knowledge.notion')
      expect(notionInfo.name).toBe('Notion')
      expect(notionInfo.category).toBe('knowledge')
      expect(notionInfo.requiredConfig).toContain('integrationToken')
    })
  })

  describe('CRM Providers', () => {
    it('hubspot info is valid', () => {
      expect(hubspotInfo.id).toBe('crm.hubspot')
      expect(hubspotInfo.name).toBe('HubSpot')
      expect(hubspotInfo.category).toBe('crm')
      expect(hubspotInfo.requiredConfig).toContain('accessToken')
    })
  })

  describe('E-commerce Providers', () => {
    it('shopify info is valid', () => {
      expect(shopifyInfo.id).toBe('ecommerce.shopify')
      expect(shopifyInfo.name).toBe('Shopify')
      expect(shopifyInfo.category).toBe('ecommerce')
      expect(shopifyInfo.requiredConfig).toContain('shopDomain')
      expect(shopifyInfo.requiredConfig).toContain('accessToken')
    })
  })

  describe('Development Providers', () => {
    it('github info is valid', () => {
      expect(githubInfo.id).toBe('development.github')
      expect(githubInfo.name).toBe('GitHub')
      expect(githubInfo.category).toBe('development')
      expect(githubInfo.requiredConfig).toContain('accessToken')
    })
  })

  describe('Forms Providers', () => {
    it('typeform info is valid', () => {
      expect(typeformInfo.id).toBe('forms.typeform')
      expect(typeformInfo.name).toBe('Typeform')
      expect(typeformInfo.category).toBe('forms')
      expect(typeformInfo.requiredConfig).toContain('accessToken')
    })
  })

  describe('Analytics Providers', () => {
    it('mixpanel info is valid', () => {
      expect(mixpanelInfo.id).toBe('analytics.mixpanel')
      expect(mixpanelInfo.name).toBe('Mixpanel')
      expect(mixpanelInfo.category).toBe('analytics')
      expect(mixpanelInfo.requiredConfig).toContain('projectToken')
    })
  })

  describe('Video Conferencing Providers', () => {
    it('zoom info is valid', () => {
      expect(zoomInfo.id).toBe('video-conferencing.zoom')
      expect(zoomInfo.name).toBe('Zoom')
      expect(zoomInfo.category).toBe('video-conferencing')
    })

    it('google meet info is valid', () => {
      expect(googleMeetInfo.id).toBe('meeting.google-meet')
      expect(googleMeetInfo.name).toBe('Google Meet')
      expect(googleMeetInfo.category).toBe('video-conferencing')
    })

    it('teams info is valid', () => {
      expect(teamsInfo.id).toBe('meeting.teams')
      expect(teamsInfo.name).toBe('Microsoft Teams')
      expect(teamsInfo.category).toBe('video-conferencing')
    })

    it('jitsi info is valid', () => {
      expect(jitsiInfo.id).toBe('meeting.jitsi')
      expect(jitsiInfo.name).toBe('Jitsi Meet')
      expect(jitsiInfo.category).toBe('video-conferencing')
    })
  })

  describe('Calendar Providers', () => {
    it('google calendar info is valid', () => {
      expect(googleCalendarInfo.id).toBe('calendar.google-calendar')
      expect(googleCalendarInfo.name).toBe('Google Calendar')
      expect(googleCalendarInfo.category).toBe('calendar')
    })
  })

  describe('Storage Providers', () => {
    it('s3 info is valid', () => {
      expect(s3Info.id).toBe('storage.s3')
      expect(s3Info.name).toBe('AWS S3')
      expect(s3Info.category).toBe('storage')
      expect(s3Info.requiredConfig).toContain('accessKeyId')
      expect(s3Info.requiredConfig).toContain('secretAccessKey')
      expect(s3Info.requiredConfig).toContain('bucket')
      expect(s3Info.requiredConfig).toContain('region')
    })
  })
})

describe('All Providers Collection', () => {
  it('organizes providers by category', () => {
    expect(allProviders.email).toContain('email.sendgrid')
    expect(allProviders.email).toContain('email.resend')

    expect(allProviders.messaging).toContain('messaging.slack')
    expect(allProviders.messaging).toContain('messaging.twilio-sms')

    expect(allProviders.spreadsheet).toContain('spreadsheet.xlsx')
    expect(allProviders.spreadsheet).toContain('spreadsheet.google-sheets')

    expect(allProviders.task).toContain('task.todoist')

    expect(allProviders.project).toContain('project.linear')

    expect(allProviders.code).toContain('code.github')

    expect(allProviders.sales).toContain('sales.hubspot')

    expect(allProviders.finance).toContain('finance.stripe')

    expect(allProviders.support).toContain('support.zendesk')

    expect(allProviders.commerce).toContain('commerce.shopify')

    expect(allProviders.knowledge).toContain('knowledge.notion')

    expect(allProviders.media).toContain('media.cloudinary')

    expect(allProviders.form).toContain('form.typeform')

    expect(allProviders.analytics).toContain('analytics.mixpanel')

    expect(allProviders.meeting).toContain('meeting.zoom')
    expect(allProviders.meeting).toContain('meeting.google-meet')
    expect(allProviders.meeting).toContain('meeting.teams')
    expect(allProviders.meeting).toContain('meeting.jitsi')

    expect(allProviders.storage).toContain('storage.s3')
  })

  it('has category keys for all provider types', () => {
    const categories = Object.keys(allProviders)

    expect(categories).toContain('email')
    expect(categories).toContain('messaging')
    expect(categories).toContain('calendar')
    expect(categories).toContain('task')
    expect(categories).toContain('project')
    expect(categories).toContain('code')
    expect(categories).toContain('sales')
    expect(categories).toContain('finance')
    expect(categories).toContain('support')
    expect(categories).toContain('commerce')
    expect(categories).toContain('knowledge')
    expect(categories).toContain('media')
    expect(categories).toContain('form')
    expect(categories).toContain('analytics')
    expect(categories).toContain('document')
    expect(categories).toContain('spreadsheet')
    expect(categories).toContain('presentation')
    expect(categories).toContain('meeting')
    expect(categories).toContain('storage')
    expect(categories).toContain('signature')
  })
})

// Helper function to create mock providers for testing
function createMockProvider(info: ProviderInfo): BaseProvider {
  return {
    info,
    initialize: async (config: ProviderConfig) => {},
    healthCheck: async (): Promise<ProviderHealth> => ({
      healthy: true,
      latencyMs: 10,
      checkedAt: new Date(),
    }),
    dispose: async () => {},
  }
}
