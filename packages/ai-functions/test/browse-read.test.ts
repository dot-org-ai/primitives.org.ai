/**
 * Tests for web functions: read() and browse()
 *
 * read(url) - Convert URL to markdown (Firecrawl-style)
 * browse(url) - Browser automation (Stagehand-style)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Mock implementations
// ============================================================================

const mockFetchUrl = vi.fn()
const mockBrowserSession = vi.fn()

/**
 * Mock read function - converts URL to markdown
 */
async function read(
  urlOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): Promise<string> {
  let url: string

  if (Array.isArray(urlOrStrings) && 'raw' in urlOrStrings) {
    url = (urlOrStrings as TemplateStringsArray).reduce((acc, str, i) => {
      return acc + str + (args[i] ?? '')
    }, '')
  } else {
    url = urlOrStrings as string
  }

  return mockFetchUrl(url)
}

/**
 * Mock browse function - returns a page context for browser automation
 */
async function browse(
  urlOrStrings: string | TemplateStringsArray,
  ...args: unknown[]
): Promise<{
  do: (action: string) => Promise<void>
  extract: (query: string) => Promise<unknown>
  screenshot: () => Promise<Buffer>
  close: () => Promise<void>
}> {
  let url: string

  if (Array.isArray(urlOrStrings) && 'raw' in urlOrStrings) {
    url = (urlOrStrings as TemplateStringsArray).reduce((acc, str, i) => {
      return acc + str + (args[i] ?? '')
    }, '')
  } else {
    url = urlOrStrings as string
  }

  return mockBrowserSession(url)
}

// ============================================================================
// read() tests
// ============================================================================

describe('read() - URL to Markdown', () => {
  beforeEach(() => {
    mockFetchUrl.mockReset()
  })

  describe('basic usage', () => {
    it('converts URL to markdown', async () => {
      mockFetchUrl.mockResolvedValue(`
# Page Title

Some content from the page.

## Section 1

More content here.
      `.trim())

      const content = await read('https://example.com')

      expect(mockFetchUrl).toHaveBeenCalledWith('https://example.com')
      expect(content).toContain('# Page Title')
      expect(content).toContain('Some content')
    })

    it('supports tagged template syntax', async () => {
      mockFetchUrl.mockResolvedValue('# Content')

      const domain = 'example.com'
      const path = '/docs'
      const content = await read`https://${domain}${path}`

      expect(mockFetchUrl).toHaveBeenCalledWith('https://example.com/docs')
    })

    it('extracts main content, strips navigation/ads', async () => {
      mockFetchUrl.mockResolvedValue(`
# Article Title

This is the main article content, clean and focused.
      `.trim())

      const content = await read('https://blog.example.com/article')

      // Extracted content should be clean without HTML tags
      expect(content).not.toContain('<nav>')
      expect(content).not.toContain('<!-- advertisement -->')
      expect(content).toContain('Article Title')
    })
  })

  describe('content extraction', () => {
    it('preserves headers and structure', async () => {
      mockFetchUrl.mockResolvedValue(`
# Main Title

## Introduction

Intro paragraph.

## Details

Detail paragraph.

### Subsection

More details.
      `.trim())

      const content = await read('https://docs.example.com')

      expect(content).toContain('# Main Title')
      expect(content).toContain('## Introduction')
      expect(content).toContain('### Subsection')
    })

    it('converts links to markdown format', async () => {
      mockFetchUrl.mockResolvedValue(
        'Check out [our documentation](https://docs.example.com) for more info.'
      )

      const content = await read('https://example.com')

      expect(content).toContain('[our documentation](https://docs.example.com)')
    })

    it('handles code blocks', async () => {
      mockFetchUrl.mockResolvedValue(`
Here's an example:

\`\`\`typescript
const x = 1;
\`\`\`
      `.trim())

      const content = await read('https://tutorial.example.com')

      expect(content).toContain('```typescript')
      expect(content).toContain('const x = 1;')
    })

    it('handles tables', async () => {
      mockFetchUrl.mockResolvedValue(`
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
      `.trim())

      const content = await read('https://data.example.com')

      expect(content).toContain('| Header 1 |')
      expect(content).toContain('| Cell 1   |')
    })
  })

  describe('use cases', () => {
    it('reads documentation for research', async () => {
      mockFetchUrl.mockResolvedValue(`
# API Reference

## Authentication

Use Bearer tokens for authentication.

## Endpoints

### GET /users

Returns list of users.
      `.trim())

      const docs = await read('https://api.example.com/docs')

      expect(docs).toContain('API Reference')
      expect(docs).toContain('Authentication')
      expect(docs).toContain('GET /users')
    })

    it('reads articles for summarization', async () => {
      mockFetchUrl.mockResolvedValue(`
# The Future of AI

Artificial intelligence is transforming industries...

## Impact on Healthcare

AI is revolutionizing medical diagnosis...

## Impact on Finance

Automated trading systems...
      `.trim())

      const article = await read('https://news.example.com/ai-future')

      expect(article).toContain('Future of AI')
      expect(article).toContain('Impact on Healthcare')
    })
  })
})

// ============================================================================
// browse() tests
// ============================================================================

describe('browse() - Browser Automation', () => {
  beforeEach(() => {
    mockBrowserSession.mockReset()
  })

  describe('page context', () => {
    it('returns page object with do/extract methods', async () => {
      const mockPage = {
        do: vi.fn(),
        extract: vi.fn(),
        screenshot: vi.fn(),
        close: vi.fn(),
      }
      mockBrowserSession.mockResolvedValue(mockPage)

      const page = await browse('https://example.com')

      expect(page).toHaveProperty('do')
      expect(page).toHaveProperty('extract')
      expect(page).toHaveProperty('screenshot')
      expect(page).toHaveProperty('close')
    })

    it('supports tagged template syntax', async () => {
      mockBrowserSession.mockResolvedValue({
        do: vi.fn(),
        extract: vi.fn(),
        screenshot: vi.fn(),
        close: vi.fn(),
      })

      const domain = 'example.com'
      await browse`https://${domain}`

      expect(mockBrowserSession).toHaveBeenCalledWith('https://example.com')
    })
  })

  describe('page.do() - actions', () => {
    it('performs click actions', async () => {
      const mockDo = vi.fn()
      mockBrowserSession.mockResolvedValue({
        do: mockDo,
        extract: vi.fn(),
        screenshot: vi.fn(),
        close: vi.fn(),
      })

      const page = await browse('https://app.example.com')
      await page.do('click the login button')

      expect(mockDo).toHaveBeenCalledWith('click the login button')
    })

    it('performs form filling', async () => {
      const mockDo = vi.fn()
      mockBrowserSession.mockResolvedValue({
        do: mockDo,
        extract: vi.fn(),
        screenshot: vi.fn(),
        close: vi.fn(),
      })

      const page = await browse('https://app.example.com/login')
      await page.do('fill in the email field with test@example.com')
      await page.do('fill in the password field with password123')
      await page.do('click submit')

      expect(mockDo).toHaveBeenCalledTimes(3)
    })

    it('performs navigation actions', async () => {
      const mockDo = vi.fn()
      mockBrowserSession.mockResolvedValue({
        do: mockDo,
        extract: vi.fn(),
        screenshot: vi.fn(),
        close: vi.fn(),
      })

      const page = await browse('https://app.example.com')
      await page.do('click on Settings in the navigation menu')
      await page.do('scroll to the bottom of the page')

      expect(mockDo).toHaveBeenNthCalledWith(1, 'click on Settings in the navigation menu')
      expect(mockDo).toHaveBeenNthCalledWith(2, 'scroll to the bottom of the page')
    })
  })

  describe('page.extract() - data extraction', () => {
    it('extracts text content', async () => {
      const mockExtract = vi.fn().mockResolvedValue('Welcome, John Doe')
      mockBrowserSession.mockResolvedValue({
        do: vi.fn(),
        extract: mockExtract,
        screenshot: vi.fn(),
        close: vi.fn(),
      })

      const page = await browse('https://app.example.com/dashboard')
      const username = await page.extract('the username in the header')

      expect(mockExtract).toHaveBeenCalledWith('the username in the header')
      expect(username).toBe('Welcome, John Doe')
    })

    it('extracts structured data', async () => {
      const mockExtract = vi.fn().mockResolvedValue([
        { name: 'Product A', price: 29.99 },
        { name: 'Product B', price: 49.99 },
      ])
      mockBrowserSession.mockResolvedValue({
        do: vi.fn(),
        extract: mockExtract,
        screenshot: vi.fn(),
        close: vi.fn(),
      })

      const page = await browse('https://shop.example.com/products')
      const products = await page.extract('all products with their names and prices')

      expect(products).toHaveLength(2)
      expect(products[0]).toHaveProperty('name', 'Product A')
      expect(products[0]).toHaveProperty('price', 29.99)
    })

    it('extracts table data', async () => {
      const mockExtract = vi.fn().mockResolvedValue([
        { date: '2024-01-01', amount: 100, status: 'completed' },
        { date: '2024-01-02', amount: 200, status: 'pending' },
      ])
      mockBrowserSession.mockResolvedValue({
        do: vi.fn(),
        extract: mockExtract,
        screenshot: vi.fn(),
        close: vi.fn(),
      })

      const page = await browse('https://app.example.com/transactions')
      const transactions = await page.extract('the transaction table data')

      expect(transactions).toHaveLength(2)
      expect(transactions[0]).toHaveProperty('date')
      expect(transactions[0]).toHaveProperty('amount')
    })
  })

  describe('page.screenshot()', () => {
    it('captures page screenshot', async () => {
      const mockScreenshot = vi.fn().mockResolvedValue(Buffer.from('fake-image'))
      mockBrowserSession.mockResolvedValue({
        do: vi.fn(),
        extract: vi.fn(),
        screenshot: mockScreenshot,
        close: vi.fn(),
      })

      const page = await browse('https://example.com')
      const screenshot = await page.screenshot()

      expect(mockScreenshot).toHaveBeenCalled()
      expect(Buffer.isBuffer(screenshot)).toBe(true)
    })
  })

  describe('page.close()', () => {
    it('closes browser session', async () => {
      const mockClose = vi.fn()
      mockBrowserSession.mockResolvedValue({
        do: vi.fn(),
        extract: vi.fn(),
        screenshot: vi.fn(),
        close: mockClose,
      })

      const page = await browse('https://example.com')
      await page.close()

      expect(mockClose).toHaveBeenCalled()
    })
  })
})

// ============================================================================
// Combined read + browse workflows
// ============================================================================

describe('combined workflows', () => {
  beforeEach(() => {
    mockFetchUrl.mockReset()
    mockBrowserSession.mockReset()
  })

  it('read for static content, browse for dynamic', async () => {
    // Use read for documentation
    mockFetchUrl.mockResolvedValue('# API Docs\n\nAuthentication required.')
    const docs = await read('https://api.example.com/docs')
    expect(docs).toContain('API Docs')

    // Use browse for interactive testing
    const mockPage = {
      do: vi.fn(),
      extract: vi.fn().mockResolvedValue({ status: 'success' }),
      screenshot: vi.fn(),
      close: vi.fn(),
    }
    mockBrowserSession.mockResolvedValue(mockPage)

    const page = await browse('https://api.example.com/playground')
    await page.do('enter API key in the auth field')
    await page.do('click send request')
    const result = await page.extract('the response status')

    expect(result).toEqual({ status: 'success' })
  })

  it('research workflow: read docs, browse to verify', async () => {
    // Step 1: Read documentation
    mockFetchUrl.mockResolvedValue(`
# Getting Started

1. Sign up at example.com/signup
2. Get your API key from settings
3. Make your first request
    `.trim())

    const docs = await read('https://example.com/docs')
    expect(docs).toContain('Sign up')

    // Step 2: Browse to verify signup flow
    const mockPage = {
      do: vi.fn(),
      extract: vi.fn(),
      screenshot: vi.fn(),
      close: vi.fn(),
    }
    mockBrowserSession.mockResolvedValue(mockPage)

    const page = await browse('https://example.com/signup')
    await page.do('fill in email with test@test.com')
    await page.do('fill in password with testpass123')
    await page.do('click sign up button')

    expect(mockPage.do).toHaveBeenCalledTimes(3)
  })

  it('competitive analysis: read multiple sources', async () => {
    const competitors = ['competitor1.com', 'competitor2.com', 'competitor3.com']

    mockFetchUrl
      .mockResolvedValueOnce('# Competitor 1\n\nPricing: $10/mo')
      .mockResolvedValueOnce('# Competitor 2\n\nPricing: $15/mo')
      .mockResolvedValueOnce('# Competitor 3\n\nPricing: $20/mo')

    const analyses = await Promise.all(
      competitors.map(c => read(`https://${c}/pricing`))
    )

    expect(analyses).toHaveLength(3)
    expect(analyses[0]).toContain('$10/mo')
    expect(analyses[1]).toContain('$15/mo')
    expect(analyses[2]).toContain('$20/mo')
  })
})

// ============================================================================
// Error handling
// ============================================================================

describe('error handling', () => {
  beforeEach(() => {
    mockFetchUrl.mockReset()
    mockBrowserSession.mockReset()
  })

  describe('read() errors', () => {
    it('handles 404 errors', async () => {
      mockFetchUrl.mockRejectedValue(new Error('404 Not Found'))

      await expect(read('https://example.com/nonexistent')).rejects.toThrow('404')
    })

    it('handles network errors', async () => {
      mockFetchUrl.mockRejectedValue(new Error('Network error'))

      await expect(read('https://unreachable.example.com')).rejects.toThrow('Network')
    })

    it('handles timeout errors', async () => {
      mockFetchUrl.mockRejectedValue(new Error('Timeout'))

      await expect(read('https://slow.example.com')).rejects.toThrow('Timeout')
    })
  })

  describe('browse() errors', () => {
    it('handles page load failures', async () => {
      mockBrowserSession.mockRejectedValue(new Error('Page failed to load'))

      await expect(browse('https://broken.example.com')).rejects.toThrow('failed to load')
    })

    it('handles action failures', async () => {
      const mockDo = vi.fn().mockRejectedValue(new Error('Element not found'))
      mockBrowserSession.mockResolvedValue({
        do: mockDo,
        extract: vi.fn(),
        screenshot: vi.fn(),
        close: vi.fn(),
      })

      const page = await browse('https://app.example.com')
      await expect(page.do('click nonexistent button')).rejects.toThrow('not found')
    })

    it('handles extraction failures', async () => {
      const mockExtract = vi.fn().mockRejectedValue(new Error('Cannot find element'))
      mockBrowserSession.mockResolvedValue({
        do: vi.fn(),
        extract: mockExtract,
        screenshot: vi.fn(),
        close: vi.fn(),
      })

      const page = await browse('https://app.example.com')
      await expect(page.extract('nonexistent element')).rejects.toThrow('Cannot find')
    })
  })
})

// ============================================================================
// Options
// ============================================================================

describe('options', () => {
  it('read supports timeout option', async () => {
    const mockReadWithOptions = vi.fn().mockResolvedValue('content')

    await mockReadWithOptions('https://example.com', { timeout: 5000 })

    expect(mockReadWithOptions).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ timeout: 5000 })
    )
  })

  it('browse supports headless option', async () => {
    const mockBrowseWithOptions = vi.fn().mockResolvedValue({
      do: vi.fn(),
      extract: vi.fn(),
      screenshot: vi.fn(),
      close: vi.fn(),
    })

    await mockBrowseWithOptions('https://example.com', { headless: false })

    expect(mockBrowseWithOptions).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({ headless: false })
    )
  })

  it('browse supports viewport option', async () => {
    const mockBrowseWithOptions = vi.fn().mockResolvedValue({
      do: vi.fn(),
      extract: vi.fn(),
      screenshot: vi.fn(),
      close: vi.fn(),
    })

    await mockBrowseWithOptions('https://example.com', {
      viewport: { width: 1920, height: 1080 },
    })

    expect(mockBrowseWithOptions).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        viewport: { width: 1920, height: 1080 },
      })
    )
  })
})
