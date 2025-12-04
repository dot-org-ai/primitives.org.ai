/**
 * Web Tools - HTTP, scraping, browser automation
 *
 * @packageDocumentation
 */

import { defineTool } from '../define.js'
import type { AnyTool } from '../types.js'

/**
 * Fetch content from a URL
 */
export const fetchUrl = defineTool<
  { url: string; method?: string; headers?: Record<string, string>; body?: string },
  { status: number; headers: Record<string, string>; body: string }
>({
  id: 'web.fetch',
  name: 'Fetch URL',
  description: 'Fetch content from a URL using HTTP',
  category: 'web',
  subcategory: 'fetch',
  input: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      method: { type: 'string', description: 'HTTP method (default: GET)', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] },
      headers: { type: 'object', description: 'Request headers' },
      body: { type: 'string', description: 'Request body (for POST/PUT/PATCH)' },
    },
    required: ['url'],
  },
  handler: async (input) => {
    const response = await fetch(input.url, {
      method: input.method || 'GET',
      headers: input.headers,
      body: input.body,
    })

    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })

    return {
      status: response.status,
      headers,
      body: await response.text(),
    }
  },
  options: {
    audience: 'both',
    tags: ['http', 'network', 'api'],
  },
})

/**
 * Parse HTML and extract content
 */
export const parseHtml = defineTool<
  { html: string; selector?: string },
  { text: string; links: string[]; images: string[] }
>({
  id: 'web.parse-html',
  name: 'Parse HTML',
  description: 'Parse HTML content and extract text, links, and images',
  category: 'web',
  subcategory: 'scrape',
  input: {
    type: 'object',
    properties: {
      html: { type: 'string', description: 'HTML content to parse' },
      selector: { type: 'string', description: 'CSS selector to filter content (optional)' },
    },
    required: ['html'],
  },
  handler: async (input) => {
    // Basic HTML parsing without DOM (would use cheerio or jsdom in production)
    const text = input.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    // Extract links
    const linkRegex = /href="([^"]+)"/g
    const links: string[] = []
    let match
    while ((match = linkRegex.exec(input.html)) !== null) {
      links.push(match[1])
    }

    // Extract images
    const imgRegex = /src="([^"]+)"/g
    const images: string[] = []
    while ((match = imgRegex.exec(input.html)) !== null) {
      if (match[1].match(/\.(jpg|jpeg|png|gif|webp|svg)/i)) {
        images.push(match[1])
      }
    }

    return { text, links, images }
  },
  options: {
    audience: 'both',
    tags: ['html', 'parse', 'extract'],
  },
})

/**
 * Read content from a URL (combines fetch + parse)
 */
export const readUrl = defineTool<
  { url: string },
  { title: string; text: string; links: string[] }
>({
  id: 'web.read',
  name: 'Read URL',
  description: 'Read and extract content from a webpage',
  category: 'web',
  subcategory: 'scrape',
  input: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to read' },
    },
    required: ['url'],
  },
  handler: async (input) => {
    const response = await fetch(input.url)
    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ''

    // Extract body text
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    const body = bodyMatch ? bodyMatch[1] : html
    const text = body.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Extract links
    const linkRegex = /href="(https?:\/\/[^"]+)"/g
    const links: string[] = []
    let match
    while ((match = linkRegex.exec(html)) !== null) {
      links.push(match[1])
    }

    return { title, text: text.slice(0, 10000), links: [...new Set(links)] }
  },
  options: {
    audience: 'both',
    tags: ['read', 'scrape', 'extract'],
    idempotent: true,
  },
})

/**
 * All web tools
 */
export const webTools: AnyTool[] = [fetchUrl, parseHtml, readUrl]
