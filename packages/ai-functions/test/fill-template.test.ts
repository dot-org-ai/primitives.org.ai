/**
 * Tests for fillTemplate in function-registry.ts
 *
 * fillTemplate replaces {{key}} placeholders in a template string with values
 * from an args record. Non-primitive values (objects/arrays) must serialize
 * via JSON.stringify, not String(), to avoid "[object Object]" corruption.
 */

import { describe, it, expect } from 'vitest'
import { fillTemplate } from '../src/function-registry.js'

describe('fillTemplate', () => {
  describe('primitive values', () => {
    it('interpolates a string value', () => {
      expect(fillTemplate('Hello {{name}}!', { name: 'world' })).toBe('Hello world!')
    })

    it('interpolates a number value', () => {
      expect(fillTemplate('Count: {{n}}', { n: 42 })).toBe('Count: 42')
    })

    it('interpolates a boolean value', () => {
      expect(fillTemplate('Active: {{flag}}', { flag: true })).toBe('Active: true')
    })

    it('interpolates zero without stripping it', () => {
      expect(fillTemplate('Value: {{v}}', { v: 0 })).toBe('Value: 0')
    })

    it('leaves placeholder empty when key is missing', () => {
      expect(fillTemplate('{{missing}} value', {})).toBe(' value')
    })

    it('replaces multiple distinct placeholders', () => {
      expect(fillTemplate('{{a}} + {{b}} = {{c}}', { a: 1, b: 2, c: 3 })).toBe('1 + 2 = 3')
    })
  })

  describe('object and array values — must NOT produce [object Object]', () => {
    it('serializes a plain object via JSON.stringify', () => {
      const result = fillTemplate('Data: {{obj}}', { obj: { foo: 'bar', n: 1 } })
      expect(result).not.toContain('[object Object]')
      expect(result).toBe('Data: {"foo":"bar","n":1}')
    })

    it('serializes an array via JSON.stringify', () => {
      const result = fillTemplate('Items: {{list}}', { list: ['a', 'b', 'c'] })
      expect(result).not.toContain('[object Object]')
      expect(result).toBe('Items: ["a","b","c"]')
    })

    it('serializes a nested object', () => {
      const payload = { subject: 'AI', stats: { count: 5, tags: ['fast', 'smart'] } }
      const result = fillTemplate('Payload: {{payload}}', { payload })
      expect(result).not.toContain('[object Object]')
      const parsed = JSON.parse(result.replace('Payload: ', ''))
      expect(parsed.subject).toBe('AI')
      expect(parsed.stats.count).toBe(5)
    })

    it('serializes an array of objects (upstream cascade step output pattern)', () => {
      const steps = [{ id: 1, label: 'Subject' }, { id: 2, label: 'Problem' }]
      const result = fillTemplate('Steps: {{steps}}', { steps })
      expect(result).not.toContain('[object Object]')
      const parsed = JSON.parse(result.replace('Steps: ', ''))
      expect(parsed).toHaveLength(2)
      expect(parsed[0].label).toBe('Subject')
    })
  })

  describe('edge cases', () => {
    it('keeps null as empty string (null coalesces to empty via ?? fallback)', () => {
      // null ?? '' → '' → String('') → ''
      expect(fillTemplate('{{v}}', { v: null as unknown as string })).toBe('')
    })

    it('keeps undefined key as empty string', () => {
      expect(fillTemplate('{{v}}', {})).toBe('')
    })

    it('handles template with no placeholders', () => {
      expect(fillTemplate('no placeholders here', { x: 1 })).toBe('no placeholders here')
    })

    it('handles empty template', () => {
      expect(fillTemplate('', { x: 1 })).toBe('')
    })
  })
})
