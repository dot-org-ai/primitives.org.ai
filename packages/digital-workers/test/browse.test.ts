/**
 * Tests for browse() - Browser automation primitive
 *
 * The browse() function routes browser automation tasks to appropriate Workers
 * (AI Agents or Humans) based on capability matching. It uses AI to plan and
 * execute browser actions with human fallback support.
 *
 * These tests verify the structure and exports of the browse module.
 * Integration tests with real browser automation are skipped unless
 * a browser automation environment is configured.
 */

import { describe, it, expect } from 'vitest'
import { browse } from '../src/index.js'
import type {
  BrowseOptions,
  BrowseResult,
  BrowseAction,
  Viewport,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  ScreenshotOptions,
  ExtractOptions,
} from '../src/browse.js'

describe('browse() - Browser Automation Primitive', () => {
  describe('Structure Tests', () => {
    it('should be exported from index', () => {
      expect(browse).toBeDefined()
      expect(typeof browse).toBe('function')
    })

    it('should have click method', () => {
      expect(browse.click).toBeDefined()
      expect(typeof browse.click).toBe('function')
    })

    it('should have type method', () => {
      expect(browse.type).toBeDefined()
      expect(typeof browse.type).toBe('function')
    })

    it('should have scroll method', () => {
      expect(browse.scroll).toBeDefined()
      expect(typeof browse.scroll).toBe('function')
    })

    it('should have screenshot method', () => {
      expect(browse.screenshot).toBeDefined()
      expect(typeof browse.screenshot).toBe('function')
    })

    it('should have extract method', () => {
      expect(browse.extract).toBeDefined()
      expect(typeof browse.extract).toBe('function')
    })

    it('should have waitFor method', () => {
      expect(browse.waitFor).toBeDefined()
      expect(typeof browse.waitFor).toBe('function')
    })

    it('should have fill method', () => {
      expect(browse.fill).toBeDefined()
      expect(typeof browse.fill).toBe('function')
    })

    it('should have crawl method', () => {
      expect(browse.crawl).toBeDefined()
      expect(typeof browse.crawl).toBe('function')
    })
  })

  describe('Type Tests', () => {
    it('should accept valid BrowseOptions', () => {
      const options: BrowseOptions = {
        url: 'https://example.com',
        task: 'Extract page title',
        timeout: 30000,
        headless: true,
        viewport: { width: 1280, height: 720 },
        context: { key: 'value' },
        waitFor: '.content',
        humanFallback: false,
      }

      expect(options.url).toBe('https://example.com')
      expect(options.task).toBe('Extract page title')
      expect(options.timeout).toBe(30000)
      expect(options.headless).toBe(true)
      expect(options.viewport?.width).toBe(1280)
      expect(options.viewport?.height).toBe(720)
    })

    it('should accept valid BrowseResult', () => {
      const result: BrowseResult = {
        success: true,
        data: { title: 'Example' },
        screenshot: 'base64string',
        actions: [
          { type: 'navigate', target: 'https://example.com', success: true },
          { type: 'click', target: '#button', success: true },
        ],
        duration: 1500,
        finalUrl: 'https://example.com/page',
        title: 'Example Page',
      }

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ title: 'Example' })
      expect(result.actions.length).toBe(2)
      expect(result.duration).toBe(1500)
    })

    it('should accept valid BrowseAction types', () => {
      const actions: BrowseAction[] = [
        { type: 'navigate', target: 'https://example.com' },
        { type: 'click', target: '#submit' },
        { type: 'type', target: '#input', value: 'hello' },
        { type: 'scroll', value: '500' },
        { type: 'wait', value: '1000' },
        { type: 'screenshot' },
        { type: 'extract' },
      ]

      expect(actions.length).toBe(7)
      expect(actions[0].type).toBe('navigate')
      expect(actions[2].value).toBe('hello')
    })

    it('should accept valid Viewport', () => {
      const viewport: Viewport = {
        width: 1920,
        height: 1080,
      }

      expect(viewport.width).toBe(1920)
      expect(viewport.height).toBe(1080)
    })

    it('should accept valid ClickOptions', () => {
      const options: ClickOptions = {
        waitForNavigation: true,
        offset: { x: 10, y: 10 },
        clickCount: 2,
        button: 'left',
      }

      expect(options.waitForNavigation).toBe(true)
      expect(options.clickCount).toBe(2)
      expect(options.button).toBe('left')
    })

    it('should accept valid TypeOptions', () => {
      const options: TypeOptions = {
        clear: true,
        delay: 50,
        pressEnter: true,
      }

      expect(options.clear).toBe(true)
      expect(options.delay).toBe(50)
      expect(options.pressEnter).toBe(true)
    })

    it('should accept valid ScrollOptions', () => {
      const options: ScrollOptions = {
        direction: 'down',
        amount: 500,
        toElement: '#target',
        smooth: true,
      }

      expect(options.direction).toBe('down')
      expect(options.amount).toBe(500)
      expect(options.toElement).toBe('#target')
      expect(options.smooth).toBe(true)
    })

    it('should accept valid ScreenshotOptions', () => {
      const options: ScreenshotOptions = {
        fullPage: true,
        selector: '#content',
        format: 'png',
        quality: 80,
      }

      expect(options.fullPage).toBe(true)
      expect(options.selector).toBe('#content')
      expect(options.format).toBe('png')
      expect(options.quality).toBe(80)
    })

    it('should accept valid ExtractOptions', () => {
      const options: ExtractOptions = {
        schema: { title: 'Page title' },
        selector: 'article',
        multiple: true,
        includeHtml: false,
      }

      expect(options.schema).toEqual({ title: 'Page title' })
      expect(options.selector).toBe('article')
      expect(options.multiple).toBe(true)
      expect(options.includeHtml).toBe(false)
    })
  })

  describe('Unit Tests (no browser)', () => {
    it('should return function signature for browse', () => {
      // browse(url, task, options?) => Promise<BrowseResult>
      expect(browse.length).toBeGreaterThanOrEqual(2)
    })

    it('should return function signature for browse.click', () => {
      // browse.click(url, selector, options?) => Promise<BrowseResult>
      expect(browse.click.length).toBeGreaterThanOrEqual(2)
    })

    it('should return function signature for browse.type', () => {
      // browse.type(url, selector, text, options?) => Promise<BrowseResult>
      expect(browse.type.length).toBeGreaterThanOrEqual(3)
    })

    it('should return function signature for browse.scroll', () => {
      // browse.scroll(url, direction, amount?, options?) => Promise<BrowseResult>
      expect(browse.scroll.length).toBeGreaterThanOrEqual(2)
    })

    it('should return function signature for browse.screenshot', () => {
      // browse.screenshot(url, options?) => Promise<BrowseResult>
      expect(browse.screenshot.length).toBeGreaterThanOrEqual(1)
    })

    it('should return function signature for browse.extract', () => {
      // browse.extract(url, schema, options?) => Promise<BrowseResult>
      expect(browse.extract.length).toBeGreaterThanOrEqual(2)
    })

    it('should return function signature for browse.waitFor', () => {
      // browse.waitFor(url, selector, timeout?) => Promise<BrowseResult>
      expect(browse.waitFor.length).toBeGreaterThanOrEqual(2)
    })

    it('should return function signature for browse.fill', () => {
      // browse.fill(url, formData, submitSelector?) => Promise<BrowseResult>
      expect(browse.fill.length).toBeGreaterThanOrEqual(2)
    })

    it('should return function signature for browse.crawl', () => {
      // browse.crawl(urls, taskPerPage) => Promise<BrowseResult[]>
      expect(browse.crawl.length).toBeGreaterThanOrEqual(2)
    })
  })

  // Skip integration tests if no AI gateway configured
  const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

  describe.skipIf(!hasGateway)('Integration Tests (with AI)', () => {
    it('should execute a simple browse task', async () => {
      const result = await browse('https://example.com', 'Get the page title', {
        timeout: 30000,
      })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(Array.isArray(result.actions)).toBe(true)
      expect(result.actions.length).toBeGreaterThan(0)
      expect(result.actions[0].type).toBe('navigate')
    })

    it('should include duration in result', async () => {
      const result = await browse('https://example.com', 'Check if page loaded', {
        timeout: 30000,
      })

      expect(result.duration).toBeDefined()
      expect(typeof result.duration).toBe('number')
      expect(result.duration).toBeGreaterThan(0)
    })

    it('should handle timeout option', async () => {
      const result = await browse('https://example.com', 'Perform complex task', {
        timeout: 1, // Very short timeout
      })

      // Should fail or succeed quickly
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    it('should support human fallback option', async () => {
      const result = await browse('https://example.com', 'Complete complex form', {
        humanFallback: true,
        timeout: 1, // Force failure
      })

      expect(result).toBeDefined()
      // When AI fails with humanFallback, executedBy should indicate pending
      if (!result.success && result.executedBy) {
        expect(result.executedBy).toBe('pending-human-fallback')
      }
    })

    it('should execute click helper', async () => {
      const result = await browse.click('https://example.com', 'a')

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(Array.isArray(result.actions)).toBe(true)
    })

    it('should execute type helper', async () => {
      const result = await browse.type('https://example.com', 'input', 'test text')

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('should execute scroll helper', async () => {
      const result = await browse.scroll('https://example.com', 'down', 100)

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('should execute screenshot helper', async () => {
      const result = await browse.screenshot('https://example.com')

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('should execute extract helper', async () => {
      const result = await browse.extract('https://example.com', {
        title: 'Page title',
      })

      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
    })

    it('should execute crawl for multiple URLs', async () => {
      const results = await browse.crawl(
        ['https://example.com', 'https://example.org'],
        'Get page title'
      )

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(2)
      results.forEach((result) => {
        expect(typeof result.success).toBe('boolean')
      })
    })
  })
})
