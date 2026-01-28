/**
 * Tests for Pre-built Tools
 *
 * Covers web, data, and communication tools.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  // Web tools
  fetchUrl,
  parseHtml,
  readUrl,
  webTools,

  // Data tools
  parseJson,
  stringifyJson,
  parseCsv,
  transformData,
  filterData,
  dataTools,

  // Communication tools
  sendEmail,
  sendSlackMessage,
  sendNotification,
  sendSms,
  communicationTools,

  // Utilities
  getBuiltinTools,
  registerBuiltinTools,
  registry,
} from '../src/index.js'

describe('Web Tools', () => {
  describe('fetchUrl', () => {
    it('has correct metadata', () => {
      expect(fetchUrl.id).toBe('web.fetch')
      expect(fetchUrl.name).toBe('Fetch URL')
      expect(fetchUrl.category).toBe('web')
      expect(fetchUrl.subcategory).toBe('fetch')
    })

    it('has required parameters', () => {
      const urlParam = fetchUrl.parameters.find((p) => p.name === 'url')
      expect(urlParam).toBeDefined()
      expect(urlParam?.required).toBe(true)
    })

    it('has optional parameters', () => {
      const methodParam = fetchUrl.parameters.find((p) => p.name === 'method')
      expect(methodParam).toBeDefined()
      expect(methodParam?.required).toBe(false)
    })

    it('has audience and tags', () => {
      expect(fetchUrl.audience).toBe('both')
      expect(fetchUrl.tags).toContain('http')
    })
  })

  describe('parseHtml', () => {
    it('has correct metadata', () => {
      expect(parseHtml.id).toBe('web.parse-html')
      expect(parseHtml.category).toBe('web')
      expect(parseHtml.subcategory).toBe('scrape')
    })

    it('extracts text from HTML', async () => {
      const result = await parseHtml.handler({
        html: '<p>Hello World</p>',
      })

      expect(result.text).toContain('Hello World')
    })

    it('extracts links from HTML', async () => {
      const result = await parseHtml.handler({
        html: '<a href="https://example.com">Link</a>',
      })

      expect(result.links).toContain('https://example.com')
    })

    it('extracts images from HTML', async () => {
      const result = await parseHtml.handler({
        html: '<img src="image.jpg" />',
      })

      expect(result.images).toContain('image.jpg')
    })
  })

  describe('readUrl', () => {
    it('has correct metadata', () => {
      expect(readUrl.id).toBe('web.read')
      expect(readUrl.category).toBe('web')
      expect(readUrl.idempotent).toBe(true)
    })
  })

  describe('webTools array', () => {
    it('contains all web tools', () => {
      expect(webTools).toHaveLength(3)
      expect(webTools.map((t) => t.id)).toContain('web.fetch')
      expect(webTools.map((t) => t.id)).toContain('web.parse-html')
      expect(webTools.map((t) => t.id)).toContain('web.read')
    })
  })
})

describe('Data Tools', () => {
  describe('parseJson', () => {
    it('has correct metadata', () => {
      expect(parseJson.id).toBe('data.json.parse')
      expect(parseJson.category).toBe('data')
      expect(parseJson.subcategory).toBe('transform')
    })

    it('parses valid JSON', async () => {
      const result = await parseJson.handler({
        text: '{"name": "John", "age": 30}',
      })

      expect(result.valid).toBe(true)
      expect(result.data).toEqual({ name: 'John', age: 30 })
    })

    it('handles invalid JSON', async () => {
      const result = await parseJson.handler({
        text: '{invalid}',
      })

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('is idempotent', () => {
      expect(parseJson.idempotent).toBe(true)
    })
  })

  describe('stringifyJson', () => {
    it('has correct metadata', () => {
      expect(stringifyJson.id).toBe('data.json.stringify')
      expect(stringifyJson.category).toBe('data')
    })

    it('stringifies object', async () => {
      const result = await stringifyJson.handler({
        data: { name: 'John' },
      })

      expect(result.text).toBe('{"name":"John"}')
    })

    it('supports pretty printing', async () => {
      const result = await stringifyJson.handler({
        data: { name: 'John' },
        pretty: true,
      })

      expect(result.text).toContain('\n')
      expect(result.text).toContain('  ')
    })
  })

  describe('parseCsv', () => {
    it('has correct metadata', () => {
      expect(parseCsv.id).toBe('data.csv.parse')
      expect(parseCsv.category).toBe('data')
    })

    it('parses CSV with headers', async () => {
      const result = await parseCsv.handler({
        text: 'name,age\nJohn,30\nJane,25',
      })

      expect(result.headers).toEqual(['name', 'age'])
      expect(result.rows).toHaveLength(2)
      expect(result.rows[0]).toEqual({ name: 'John', age: '30' })
    })

    it('parses CSV without headers', async () => {
      const result = await parseCsv.handler({
        text: 'John,30\nJane,25',
        hasHeaders: false,
      })

      expect(result.headers).toEqual(['column1', 'column2'])
      expect(result.rows).toHaveLength(2)
    })

    it('supports custom delimiter', async () => {
      const result = await parseCsv.handler({
        text: 'name;age\nJohn;30',
        delimiter: ';',
      })

      expect(result.rows[0]).toEqual({ name: 'John', age: '30' })
    })

    it('handles empty input', async () => {
      const result = await parseCsv.handler({
        text: '',
      })

      expect(result.rows).toHaveLength(0)
      expect(result.rowCount).toBe(0)
    })
  })

  describe('transformData', () => {
    it('has correct metadata', () => {
      expect(transformData.id).toBe('data.transform')
      expect(transformData.category).toBe('data')
    })

    it('transforms data with field mapping', async () => {
      const result = await transformData.handler({
        data: {
          user: {
            firstName: 'John',
            lastName: 'Doe',
          },
          email: 'john@example.com',
        },
        transform: {
          name: 'user.firstName',
          contact: 'email',
        },
      })

      expect(result.result).toEqual({
        name: 'John',
        contact: 'john@example.com',
      })
    })

    it('handles nested paths', async () => {
      const result = await transformData.handler({
        data: { a: { b: { c: 'deep' } } },
        transform: { value: 'a.b.c' },
      })

      expect(result.result.value).toBe('deep')
    })

    it('handles missing paths', async () => {
      const result = await transformData.handler({
        data: { a: 1 },
        transform: { value: 'b.c.d' },
      })

      expect(result.result.value).toBeUndefined()
    })
  })

  describe('filterData', () => {
    it('has correct metadata', () => {
      expect(filterData.id).toBe('data.filter')
      expect(filterData.category).toBe('data')
    })

    it('filters array by criteria', async () => {
      const result = await filterData.handler({
        data: [
          { name: 'John', status: 'active' },
          { name: 'Jane', status: 'inactive' },
          { name: 'Bob', status: 'active' },
        ],
        filter: { status: 'active' },
      })

      expect(result.results).toHaveLength(2)
      expect(result.count).toBe(2)
    })

    it('handles multiple filter criteria', async () => {
      const result = await filterData.handler({
        data: [
          { name: 'John', status: 'active', role: 'admin' },
          { name: 'Jane', status: 'active', role: 'user' },
          { name: 'Bob', status: 'inactive', role: 'admin' },
        ],
        filter: { status: 'active', role: 'admin' },
      })

      expect(result.results).toHaveLength(1)
      expect(result.results[0]).toEqual({ name: 'John', status: 'active', role: 'admin' })
    })

    it('returns empty for no matches', async () => {
      const result = await filterData.handler({
        data: [{ a: 1 }, { a: 2 }],
        filter: { a: 3 },
      })

      expect(result.results).toHaveLength(0)
    })
  })

  describe('dataTools array', () => {
    it('contains all data tools', () => {
      expect(dataTools).toHaveLength(5)
      const ids = dataTools.map((t) => t.id)
      expect(ids).toContain('data.json.parse')
      expect(ids).toContain('data.json.stringify')
      expect(ids).toContain('data.csv.parse')
      expect(ids).toContain('data.transform')
      expect(ids).toContain('data.filter')
    })
  })
})

describe('Communication Tools', () => {
  describe('sendEmail', () => {
    it('has correct metadata', () => {
      expect(sendEmail.id).toBe('communication.email.send')
      expect(sendEmail.category).toBe('communication')
      expect(sendEmail.subcategory).toBe('email')
    })

    it('has required parameters', () => {
      const toParam = sendEmail.parameters.find((p) => p.name === 'to')
      const subjectParam = sendEmail.parameters.find((p) => p.name === 'subject')
      const bodyParam = sendEmail.parameters.find((p) => p.name === 'body')

      expect(toParam?.required).toBe(true)
      expect(subjectParam?.required).toBe(true)
      expect(bodyParam?.required).toBe(true)
    })

    it('requires confirmation', () => {
      expect(sendEmail.requiresConfirmation).toBe(true)
    })

    it('has permissions', () => {
      expect(sendEmail.permissions).toBeDefined()
      expect(sendEmail.permissions?.[0]?.resource).toBe('email')
    })

    it('simulates sending email', async () => {
      const result = await sendEmail.handler({
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Test body',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
    })
  })

  describe('sendSlackMessage', () => {
    it('has correct metadata', () => {
      expect(sendSlackMessage.id).toBe('communication.slack.send')
      expect(sendSlackMessage.category).toBe('communication')
      expect(sendSlackMessage.subcategory).toBe('slack')
    })

    it('simulates sending message', async () => {
      const result = await sendSlackMessage.handler({
        channel: '#general',
        text: 'Hello Slack!',
      })

      expect(result.success).toBe(true)
      expect(result.ts).toBeDefined()
      expect(result.channel).toBe('#general')
    })
  })

  describe('sendNotification', () => {
    it('has correct metadata', () => {
      expect(sendNotification.id).toBe('communication.notify')
      expect(sendNotification.category).toBe('communication')
      expect(sendNotification.subcategory).toBe('notification')
    })

    it('simulates sending notification', async () => {
      const result = await sendNotification.handler({
        channel: 'email',
        recipients: ['user@example.com'],
        title: 'Alert',
        message: 'This is an alert',
        priority: 'high',
      })

      expect(result.success).toBe(true)
      expect(result.notificationId).toBeDefined()
      expect(result.delivered).toContain('user@example.com')
    })
  })

  describe('sendSms', () => {
    it('has correct metadata', () => {
      expect(sendSms.id).toBe('communication.sms.send')
      expect(sendSms.category).toBe('communication')
      expect(sendSms.subcategory).toBe('sms')
    })

    it('requires confirmation', () => {
      expect(sendSms.requiresConfirmation).toBe(true)
    })

    it('simulates sending SMS', async () => {
      const result = await sendSms.handler({
        to: '+15551234567',
        message: 'Test SMS',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
    })
  })

  describe('communicationTools array', () => {
    it('contains all communication tools', () => {
      expect(communicationTools).toHaveLength(4)
      const ids = communicationTools.map((t) => t.id)
      expect(ids).toContain('communication.email.send')
      expect(ids).toContain('communication.slack.send')
      expect(ids).toContain('communication.notify')
      expect(ids).toContain('communication.sms.send')
    })
  })
})

describe('Builtin Tools Utilities', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('getBuiltinTools', () => {
    it('returns all builtin tools', () => {
      const tools = getBuiltinTools()

      // Note: systemTools are included as of fsx/gitx/bashx integration (aip-3749.3)
      // Use >= to allow for future additions while ensuring the core tools are present
      expect(tools.length).toBeGreaterThanOrEqual(
        webTools.length + dataTools.length + communicationTools.length
      )
    })
  })

  describe('registerBuiltinTools', () => {
    it('registers all builtin tools in registry', () => {
      registerBuiltinTools()

      expect(registry.has('web.fetch')).toBe(true)
      expect(registry.has('data.json.parse')).toBe(true)
      expect(registry.has('communication.email.send')).toBe(true)
    })
  })
})
