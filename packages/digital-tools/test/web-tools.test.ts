/**
 * Comprehensive Tests for Web Tools
 *
 * Tests fetchUrl, parseHtml, and readUrl tools with real network calls
 * where available, and comprehensive edge case testing.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  fetchUrl,
  parseHtml,
  readUrl,
  webTools,
  registry,
  registerBuiltinTools,
} from '../src/index.js'

// Check if we have network access for integration tests
const hasNetwork = true // We'll test with real fetch

describe('Web Tools - fetchUrl', () => {
  describe('metadata', () => {
    it('has correct id', () => {
      expect(fetchUrl.id).toBe('web.fetch')
    })

    it('has correct name', () => {
      expect(fetchUrl.name).toBe('Fetch URL')
    })

    it('has correct category', () => {
      expect(fetchUrl.category).toBe('web')
    })

    it('has correct subcategory', () => {
      expect(fetchUrl.subcategory).toBe('fetch')
    })

    it('has description', () => {
      expect(fetchUrl.description).toBe('Fetch content from a URL using HTTP')
    })

    it('is for both audiences', () => {
      expect(fetchUrl.audience).toBe('both')
    })

    it('has http tag', () => {
      expect(fetchUrl.tags).toContain('http')
    })

    it('has network tag', () => {
      expect(fetchUrl.tags).toContain('network')
    })

    it('has api tag', () => {
      expect(fetchUrl.tags).toContain('api')
    })
  })

  describe('parameters', () => {
    it('has url parameter', () => {
      const urlParam = fetchUrl.parameters.find((p) => p.name === 'url')
      expect(urlParam).toBeDefined()
    })

    it('url parameter is required', () => {
      const urlParam = fetchUrl.parameters.find((p) => p.name === 'url')
      expect(urlParam?.required).toBe(true)
    })

    it('has method parameter', () => {
      const methodParam = fetchUrl.parameters.find((p) => p.name === 'method')
      expect(methodParam).toBeDefined()
    })

    it('method parameter is optional', () => {
      const methodParam = fetchUrl.parameters.find((p) => p.name === 'method')
      expect(methodParam?.required).toBe(false)
    })

    it('has headers parameter', () => {
      const headersParam = fetchUrl.parameters.find((p) => p.name === 'headers')
      expect(headersParam).toBeDefined()
    })

    it('has body parameter', () => {
      const bodyParam = fetchUrl.parameters.find((p) => p.name === 'body')
      expect(bodyParam).toBeDefined()
    })

    it('has 4 parameters total', () => {
      expect(fetchUrl.parameters).toHaveLength(4)
    })
  })

  describe('handler - real network tests', () => {
    it('fetches a real URL with GET', async () => {
      const result = await fetchUrl.handler({
        url: 'https://httpbin.org/get',
      })

      expect(result.status).toBe(200)
      expect(result.body).toBeDefined()
      expect(typeof result.body).toBe('string')
      expect(result.headers).toBeDefined()
    })

    it('fetches with custom headers', async () => {
      const result = await fetchUrl.handler({
        url: 'https://httpbin.org/headers',
        headers: {
          'X-Custom-Header': 'test-value',
        },
      })

      expect(result.status).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.headers['X-Custom-Header']).toBe('test-value')
    })

    it('performs POST request', async () => {
      const result = await fetchUrl.handler({
        url: 'https://httpbin.org/post',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data' }),
      })

      expect(result.status).toBe(200)
      const body = JSON.parse(result.body)
      expect(body.json).toEqual({ test: 'data' })
    })

    it('handles 404 response', async () => {
      const result = await fetchUrl.handler({
        url: 'https://httpbin.org/status/404',
      })

      expect(result.status).toBe(404)
    })

    it('returns headers as object', async () => {
      const result = await fetchUrl.handler({
        url: 'https://httpbin.org/get',
      })

      expect(typeof result.headers).toBe('object')
      expect(result.headers['content-type']).toBeDefined()
    })
  })
})

describe('Web Tools - parseHtml', () => {
  describe('metadata', () => {
    it('has correct id', () => {
      expect(parseHtml.id).toBe('web.parse-html')
    })

    it('has correct name', () => {
      expect(parseHtml.name).toBe('Parse HTML')
    })

    it('has correct category', () => {
      expect(parseHtml.category).toBe('web')
    })

    it('has correct subcategory', () => {
      expect(parseHtml.subcategory).toBe('scrape')
    })

    it('has html tag', () => {
      expect(parseHtml.tags).toContain('html')
    })

    it('has parse tag', () => {
      expect(parseHtml.tags).toContain('parse')
    })

    it('has extract tag', () => {
      expect(parseHtml.tags).toContain('extract')
    })
  })

  describe('parameters', () => {
    it('has html parameter', () => {
      const htmlParam = parseHtml.parameters.find((p) => p.name === 'html')
      expect(htmlParam).toBeDefined()
      expect(htmlParam?.required).toBe(true)
    })

    it('has selector parameter', () => {
      const selectorParam = parseHtml.parameters.find((p) => p.name === 'selector')
      expect(selectorParam).toBeDefined()
      expect(selectorParam?.required).toBe(false)
    })
  })

  describe('handler - text extraction', () => {
    it('extracts text from simple HTML', async () => {
      const result = await parseHtml.handler({
        html: '<p>Hello World</p>',
      })

      expect(result.text).toBe('Hello World')
    })

    it('extracts text from nested elements', async () => {
      const result = await parseHtml.handler({
        html: '<div><p>First</p><span>Second</span></div>',
      })

      expect(result.text).toContain('First')
      expect(result.text).toContain('Second')
    })

    it('handles multiple whitespace', async () => {
      const result = await parseHtml.handler({
        html: '<p>Hello    World</p>',
      })

      expect(result.text).toBe('Hello World')
    })

    it('handles newlines in HTML', async () => {
      const result = await parseHtml.handler({
        html: '<p>Line 1</p>\n<p>Line 2</p>',
      })

      expect(result.text).toContain('Line 1')
      expect(result.text).toContain('Line 2')
    })

    it('strips all HTML tags', async () => {
      const result = await parseHtml.handler({
        html: '<b>Bold</b> and <i>italic</i>',
      })

      expect(result.text).toBe('Bold and italic')
    })
  })

  describe('handler - link extraction', () => {
    it('extracts links from href attributes', async () => {
      const result = await parseHtml.handler({
        html: '<a href="https://example.com">Link</a>',
      })

      expect(result.links).toContain('https://example.com')
    })

    it('extracts multiple links', async () => {
      const result = await parseHtml.handler({
        html: '<a href="https://a.com">A</a><a href="https://b.com">B</a>',
      })

      expect(result.links).toHaveLength(2)
      expect(result.links).toContain('https://a.com')
      expect(result.links).toContain('https://b.com')
    })

    it('extracts relative links', async () => {
      const result = await parseHtml.handler({
        html: '<a href="/path/to/page">Page</a>',
      })

      expect(result.links).toContain('/path/to/page')
    })

    it('returns empty array when no links', async () => {
      const result = await parseHtml.handler({
        html: '<p>No links here</p>',
      })

      expect(result.links).toEqual([])
    })
  })

  describe('handler - image extraction', () => {
    it('extracts jpg images', async () => {
      const result = await parseHtml.handler({
        html: '<img src="image.jpg" />',
      })

      expect(result.images).toContain('image.jpg')
    })

    it('extracts png images', async () => {
      const result = await parseHtml.handler({
        html: '<img src="photo.png" />',
      })

      expect(result.images).toContain('photo.png')
    })

    it('extracts gif images', async () => {
      const result = await parseHtml.handler({
        html: '<img src="animation.gif" />',
      })

      expect(result.images).toContain('animation.gif')
    })

    it('extracts webp images', async () => {
      const result = await parseHtml.handler({
        html: '<img src="modern.webp" />',
      })

      expect(result.images).toContain('modern.webp')
    })

    it('extracts svg images', async () => {
      const result = await parseHtml.handler({
        html: '<img src="icon.svg" />',
      })

      expect(result.images).toContain('icon.svg')
    })

    it('extracts jpeg images', async () => {
      const result = await parseHtml.handler({
        html: '<img src="picture.jpeg" />',
      })

      expect(result.images).toContain('picture.jpeg')
    })

    it('extracts multiple images', async () => {
      const result = await parseHtml.handler({
        html: '<img src="a.jpg" /><img src="b.png" />',
      })

      expect(result.images).toHaveLength(2)
    })

    it('does not extract non-image src attributes', async () => {
      const result = await parseHtml.handler({
        html: '<script src="app.js"></script>',
      })

      expect(result.images).not.toContain('app.js')
    })

    it('returns empty array when no images', async () => {
      const result = await parseHtml.handler({
        html: '<p>No images here</p>',
      })

      expect(result.images).toEqual([])
    })
  })

  describe('handler - complex HTML', () => {
    it('handles complete HTML document', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Welcome</h1>
            <p>This is content.</p>
            <a href="https://example.com">Link</a>
            <img src="photo.jpg" />
          </body>
        </html>
      `

      const result = await parseHtml.handler({ html })

      expect(result.text).toContain('Welcome')
      expect(result.text).toContain('This is content')
      expect(result.links).toContain('https://example.com')
      expect(result.images).toContain('photo.jpg')
    })

    it('handles empty HTML', async () => {
      const result = await parseHtml.handler({ html: '' })

      expect(result.text).toBe('')
      expect(result.links).toEqual([])
      expect(result.images).toEqual([])
    })
  })
})

describe('Web Tools - readUrl', () => {
  describe('metadata', () => {
    it('has correct id', () => {
      expect(readUrl.id).toBe('web.read')
    })

    it('has correct name', () => {
      expect(readUrl.name).toBe('Read URL')
    })

    it('has correct category', () => {
      expect(readUrl.category).toBe('web')
    })

    it('has correct subcategory', () => {
      expect(readUrl.subcategory).toBe('scrape')
    })

    it('is idempotent', () => {
      expect(readUrl.idempotent).toBe(true)
    })

    it('has read tag', () => {
      expect(readUrl.tags).toContain('read')
    })

    it('has scrape tag', () => {
      expect(readUrl.tags).toContain('scrape')
    })

    it('has extract tag', () => {
      expect(readUrl.tags).toContain('extract')
    })
  })

  describe('parameters', () => {
    it('has url parameter', () => {
      const urlParam = readUrl.parameters.find((p) => p.name === 'url')
      expect(urlParam).toBeDefined()
      expect(urlParam?.required).toBe(true)
    })

    it('has only 1 parameter', () => {
      expect(readUrl.parameters).toHaveLength(1)
    })
  })

  describe('handler - real network tests', () => {
    it('reads a real webpage', async () => {
      const result = await readUrl.handler({
        url: 'https://example.com',
      })

      expect(result.title).toBeDefined()
      expect(result.text).toBeDefined()
      expect(result.links).toBeDefined()
    })

    it('extracts title from page', async () => {
      const result = await readUrl.handler({
        url: 'https://example.com',
      })

      expect(typeof result.title).toBe('string')
      expect(result.title.length).toBeGreaterThan(0)
    })

    it('extracts text from page body', async () => {
      const result = await readUrl.handler({
        url: 'https://example.com',
      })

      expect(typeof result.text).toBe('string')
      expect(result.text.length).toBeGreaterThan(0)
    })

    it('extracts unique links', async () => {
      const result = await readUrl.handler({
        url: 'https://example.com',
      })

      expect(Array.isArray(result.links)).toBe(true)
      // Check for uniqueness
      const uniqueLinks = [...new Set(result.links)]
      expect(uniqueLinks.length).toBe(result.links.length)
    })

    it('limits text to 10000 characters', async () => {
      const result = await readUrl.handler({
        url: 'https://example.com',
      })

      expect(result.text.length).toBeLessThanOrEqual(10000)
    })
  })
})

describe('Web Tools Array', () => {
  it('contains fetchUrl', () => {
    expect(webTools.map((t) => t.id)).toContain('web.fetch')
  })

  it('contains parseHtml', () => {
    expect(webTools.map((t) => t.id)).toContain('web.parse-html')
  })

  it('contains readUrl', () => {
    expect(webTools.map((t) => t.id)).toContain('web.read')
  })

  it('has exactly 3 tools', () => {
    expect(webTools).toHaveLength(3)
  })

  it('all tools have web category', () => {
    expect(webTools.every((t) => t.category === 'web')).toBe(true)
  })

  it('all tools have handlers', () => {
    expect(webTools.every((t) => typeof t.handler === 'function')).toBe(true)
  })

  it('all tools have parameters', () => {
    expect(webTools.every((t) => Array.isArray(t.parameters))).toBe(true)
  })
})

describe('Web Tools Registry Integration', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('can register web tools', () => {
    for (const tool of webTools) {
      registry.register(tool)
    }

    expect(registry.has('web.fetch')).toBe(true)
    expect(registry.has('web.parse-html')).toBe(true)
    expect(registry.has('web.read')).toBe(true)
  })

  it('can query web tools by category', () => {
    registerBuiltinTools()

    const tools = registry.byCategory('web')
    expect(tools.length).toBeGreaterThanOrEqual(3)
  })

  it('can find tools by subcategory', () => {
    registerBuiltinTools()

    const fetchTools = registry.query({ subcategory: 'fetch' })
    expect(fetchTools.some((t) => t.id === 'web.fetch')).toBe(true)

    const scrapeTools = registry.query({ subcategory: 'scrape' })
    expect(scrapeTools.some((t) => t.id === 'web.parse-html')).toBe(true)
    expect(scrapeTools.some((t) => t.id === 'web.read')).toBe(true)
  })

  it('can search for tools by text', () => {
    registerBuiltinTools()

    const results = registry.query({ search: 'fetch' })
    expect(results.some((t) => t.id === 'web.fetch')).toBe(true)
  })
})
