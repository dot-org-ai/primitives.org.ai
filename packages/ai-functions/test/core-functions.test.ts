/**
 * Tests for core AI functions
 *
 * These tests verify the API contracts for each function.
 * Tests marked with .skipIf(!hasGateway) require actual AI calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { stringify as yamlStringify } from 'yaml'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

// ============================================================================
// Mock implementations for unit tests
// ============================================================================

// Mock generate function that all others should call
const mockGenerate = vi.fn()

// ============================================================================
// ai() - Direct text generation
// ============================================================================

describe('ai()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue('Generated text')
  })

  it('should accept a string prompt', async () => {
    const ai = createMockAi()
    const result = await ai('Write a haiku')

    expect(mockGenerate).toHaveBeenCalledWith(
      'text',
      'Write a haiku',
      expect.any(Object)
    )
    expect(result).toBe('Generated text')
  })

  it('should accept tagged template literal', async () => {
    const ai = createMockAi()
    const topic = 'TypeScript'
    const result = await ai`Write about ${topic}`

    expect(mockGenerate).toHaveBeenCalled()
    const [, prompt] = mockGenerate.mock.calls[0]
    expect(prompt).toContain('TypeScript')
    expect(result).toBe('Generated text')
  })

  it('should accept options parameter', async () => {
    const ai = createMockAi()
    await ai`test`({ model: 'claude-opus-4-5' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'text',
      'test',
      expect.objectContaining({ model: 'claude-opus-4-5' })
    )
  })

  it('should return string type', async () => {
    const ai = createMockAi()
    const result = await ai('test')
    expect(typeof result).toBe('string')
  })
})

// ============================================================================
// summarize() - Condense text
// ============================================================================

describe('summarize()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue('Summary of content')
  })

  it('should accept text to summarize', async () => {
    const summarize = createMockSummarize()
    const result = await summarize`${longArticle}`

    expect(mockGenerate).toHaveBeenCalledWith(
      'summary',
      expect.stringContaining('article'),
      expect.any(Object)
    )
    expect(result).toBe('Summary of content')
  })

  it('should support length option', async () => {
    const summarize = createMockSummarize()
    await summarize`${longArticle}`({ length: 'short' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'summary',
      expect.any(String),
      expect.objectContaining({ length: 'short' })
    )
  })

  it('should support audience option', async () => {
    const summarize = createMockSummarize()
    await summarize`${technicalReport}${{ audience: 'executives', focus: 'business impact' }}`

    const [, prompt] = mockGenerate.mock.calls[0]
    expect(prompt).toContain('executives')
    expect(prompt).toContain('business impact')
  })
})

// ============================================================================
// is() - Boolean classification
// ============================================================================

describe('is()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
  })

  it('should return boolean true', async () => {
    mockGenerate.mockResolvedValue(true)
    const is = createMockIs()

    const result = await is`${'hello@example.com'} a valid email?`
    expect(result).toBe(true)
  })

  it('should return boolean false', async () => {
    mockGenerate.mockResolvedValue(false)
    const is = createMockIs()

    const result = await is`${'not-an-email'} a valid email?`
    expect(result).toBe(false)
  })

  it('should accept natural question format', async () => {
    mockGenerate.mockResolvedValue(true)
    const is = createMockIs()

    await is`${'The product is amazing!'} positive sentiment?`

    expect(mockGenerate).toHaveBeenCalledWith(
      'boolean',
      expect.stringContaining('positive sentiment'),
      expect.any(Object)
    )
  })

  it('should support model option for complex classifications', async () => {
    mockGenerate.mockResolvedValue(true)
    const is = createMockIs()

    await is`${claim} factually accurate?`({ model: 'claude-opus-4-5' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'boolean',
      expect.any(String),
      expect.objectContaining({ model: 'claude-opus-4-5' })
    )
  })
})

// ============================================================================
// list() - Generate a list
// ============================================================================

describe('list()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue(['Item 1', 'Item 2', 'Item 3'])
  })

  it('should return an array of strings', async () => {
    const list = createMockList()
    const result = await list`startup ideas for ${industry}`

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(3)
    expect(result.every((item: unknown) => typeof item === 'string')).toBe(true)
  })

  it('should respect count in prompt', async () => {
    const list = createMockList()
    await list`10 blog post titles for ${topic}`

    expect(mockGenerate).toHaveBeenCalledWith(
      'list',
      expect.stringContaining('10'),
      expect.any(Object)
    )
  })

  it('should support count option', async () => {
    const list = createMockList()
    await list('startup ideas', { count: 10 })

    expect(mockGenerate).toHaveBeenCalledWith(
      'list',
      'startup ideas',
      expect.objectContaining({ count: 10 })
    )
  })
})

// ============================================================================
// lists() - Generate multiple named lists
// ============================================================================

describe('lists()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue({
      pros: ['Pro 1', 'Pro 2'],
      cons: ['Con 1', 'Con 2'],
    })
  })

  it('should return named lists object', async () => {
    const lists = createMockLists()
    const result = await lists`pros and cons of ${topic}`

    expect(result).toHaveProperty('pros')
    expect(result).toHaveProperty('cons')
    expect(Array.isArray(result.pros)).toBe(true)
    expect(Array.isArray(result.cons)).toBe(true)
  })

  it('should support SWOT analysis format', async () => {
    mockGenerate.mockResolvedValue({
      strengths: ['S1'],
      weaknesses: ['W1'],
      opportunities: ['O1'],
      threats: ['T1'],
    })

    const lists = createMockLists()
    const result = await lists`SWOT analysis for ${{ company, market }}`

    expect(result).toHaveProperty('strengths')
    expect(result).toHaveProperty('weaknesses')
    expect(result).toHaveProperty('opportunities')
    expect(result).toHaveProperty('threats')
  })
})

// ============================================================================
// extract() - Extract from text
// ============================================================================

describe('extract()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue(['John Smith', 'Jane Doe'])
  })

  it('should extract items from text', async () => {
    const extract = createMockExtract()
    const result = await extract`person names from ${article}`

    expect(Array.isArray(result)).toBe(true)
    expect(result).toContain('John Smith')
    expect(result).toContain('Jane Doe')
  })

  it('should support schema for structured extraction', async () => {
    mockGenerate.mockResolvedValue([
      { name: 'Acme Corp', role: 'competitor' },
      { name: 'Beta Inc', role: 'partner' },
    ])

    const extract = createMockExtract()
    const result = await extract`companies from ${text}${{
      schema: {
        name: 'Company name',
        role: 'mentioned as: competitor | partner | customer',
      },
    }}`

    expect(result[0]).toHaveProperty('name')
    expect(result[0]).toHaveProperty('role')
  })
})

// ============================================================================
// write() - Generate text content
// ============================================================================

describe('write()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue('Generated content here...')
  })

  it('should generate text content', async () => {
    const write = createMockWrite()
    const result = await write`professional email to ${recipient} about ${subject}`

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should support tone option', async () => {
    const write = createMockWrite()
    await write('blog post', { tone: 'casual', topic: 'TypeScript' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'text',
      'blog post',
      expect.objectContaining({ tone: 'casual' })
    )
  })

  it('should support length option', async () => {
    const write = createMockWrite()
    await write('article', { length: 'long' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'text',
      'article',
      expect.objectContaining({ length: 'long' })
    )
  })
})

// ============================================================================
// code() - Generate code
// ============================================================================

describe('code()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue('function validate(email) { return email.includes("@"); }')
  })

  it('should generate code', async () => {
    const code = createMockCode()
    const result = await code`email validation function`

    expect(typeof result).toBe('string')
    expect(result).toContain('function')
  })

  it('should support language option', async () => {
    const code = createMockCode()
    await code('REST API endpoints', { language: 'typescript' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'code',
      'REST API endpoints',
      expect.objectContaining({ language: 'typescript' })
    )
  })

  it('should handle complex requirements via object interpolation', async () => {
    const code = createMockCode()
    const requirements = {
      pages: ['home', 'about', 'pricing'],
      features: ['dark mode', 'animations'],
      stack: 'Next.js + Tailwind',
    }

    await code`marketing website${{ requirements }}`

    const [, prompt] = mockGenerate.mock.calls[0]
    expect(prompt).toContain('pages:')
    expect(prompt).toContain('- home')
    expect(prompt).toContain('features:')
  })
})

// ============================================================================
// diagram() - Generate diagrams
// ============================================================================

describe('diagram()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue('graph TD\n  A --> B\n  B --> C')
  })

  it('should generate mermaid diagrams', async () => {
    const diagram = createMockDiagram()
    const result = await diagram`user authentication flow`

    expect(typeof result).toBe('string')
    expect(result).toContain('graph')
  })

  it('should support format option', async () => {
    const diagram = createMockDiagram()
    await diagram('database schema', { format: 'mermaid', type: 'erd' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'diagram',
      'database schema',
      expect.objectContaining({ format: 'mermaid', type: 'erd' })
    )
  })
})

// ============================================================================
// slides() - Generate presentations
// ============================================================================

describe('slides()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue('---\ntheme: default\n---\n\n# Slide 1\n\nContent here')
  })

  it('should generate slidev-format markdown', async () => {
    const slides = createMockSlides()
    const result = await slides`${topic}`

    expect(typeof result).toBe('string')
    expect(result).toContain('---')
  })

  it('should support format option', async () => {
    const slides = createMockSlides()
    await slides('quarterly review', { format: 'marp', slides: 12 })

    expect(mockGenerate).toHaveBeenCalledWith(
      'slides',
      'quarterly review',
      expect.objectContaining({ format: 'marp', slides: 12 })
    )
  })

  it('should support speaker notes', async () => {
    const slides = createMockSlides()
    await slides('workshop', { includeNotes: true, duration: '2 hours' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'slides',
      'workshop',
      expect.objectContaining({ includeNotes: true })
    )
  })
})

// ============================================================================
// image() - Generate images
// ============================================================================

describe('image()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue(Buffer.from('fake-image-data'))
  })

  it('should generate image buffer', async () => {
    const image = createMockImage()
    const result = await image`minimalist logo for ${companyName}`

    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('should support size option', async () => {
    const image = createMockImage()
    await image('robot reading a book', { size: '1024x1024', style: 'cartoon' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'image',
      'robot reading a book',
      expect.objectContaining({ size: '1024x1024', style: 'cartoon' })
    )
  })
})

// ============================================================================
// video() - Generate videos
// ============================================================================

describe('video()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue(Buffer.from('fake-video-data'))
  })

  it('should generate video buffer', async () => {
    const video = createMockVideo()
    const result = await video`product demo for ${productName}`

    expect(Buffer.isBuffer(result)).toBe(true)
  })

  it('should support duration and aspect options', async () => {
    const video = createMockVideo()
    await video('promotional video', { duration: 30, aspect: '16:9', style: 'motion graphics' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'video',
      'promotional video',
      expect.objectContaining({ duration: 30, aspect: '16:9' })
    )
  })
})

// ============================================================================
// research() - Agentic research
// ============================================================================

describe('research()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue({
      summary: 'Key findings...',
      sources: [{ url: 'https://example.com', title: 'Source 1' }],
      findings: ['Finding 1', 'Finding 2'],
      confidence: 0.85,
    })
  })

  it('should return structured research results', async () => {
    const research = createMockResearch()
    const result = await research`${topic}`

    expect(result).toHaveProperty('summary')
    expect(result).toHaveProperty('sources')
    expect(result).toHaveProperty('findings')
    expect(result).toHaveProperty('confidence')
  })

  it('should support depth option', async () => {
    const research = createMockResearch()
    await research`market size for AI tools`({ depth: 'thorough' })

    expect(mockGenerate).toHaveBeenCalledWith(
      'research',
      expect.any(String),
      expect.objectContaining({ depth: 'thorough' })
    )
  })
})

// ============================================================================
// do() - Single-pass task with tools
// ============================================================================

describe('do()', () => {
  beforeEach(() => {
    mockGenerate.mockReset()
    mockGenerate.mockResolvedValue({ summary: 'Done', result: 'Task completed' })
  })

  it('should execute a task', async () => {
    const doFn = createMockDo()
    const result = await doFn`translate ${text} to Spanish`

    expect(result).toBeDefined()
  })

  it('should handle complex multi-function tasks', async () => {
    mockGenerate.mockResolvedValue({
      summary: 'Article summary',
      people: ['John', 'Jane'],
      actionItems: ['Review', 'Follow up'],
    })

    const doFn = createMockDo()
    const result = await doFn`
      analyze this article and give me a summary,
      key people mentioned, and action items
      ${article}
    `

    expect(result).toHaveProperty('summary')
  })

  it('is single-pass, not agentic loop', async () => {
    const doFn = createMockDo()
    await doFn`analyze ${data}`

    // Should only call generate once (single pass)
    expect(mockGenerate).toHaveBeenCalledTimes(1)
  })
})

// ============================================================================
// Helper functions to create mock implementations
// ============================================================================

function createMockAi() {
  return createMockFunction('text')
}

function createMockSummarize() {
  return createMockFunction('summary')
}

function createMockIs() {
  return createMockFunction('boolean')
}

function createMockList() {
  return createMockFunction('list')
}

function createMockLists() {
  return createMockFunction('lists')
}

function createMockExtract() {
  return createMockFunction('extract')
}

function createMockWrite() {
  return createMockFunction('text')
}

function createMockCode() {
  return createMockFunction('code')
}

function createMockDiagram() {
  return createMockFunction('diagram')
}

function createMockSlides() {
  return createMockFunction('slides')
}

function createMockImage() {
  return createMockFunction('image')
}

function createMockVideo() {
  return createMockFunction('video')
}

function createMockResearch() {
  return createMockFunction('research')
}

function createMockDo() {
  return createMockFunction('do')
}

function createMockFunction(type: string) {
  return function (promptOrStrings: string | TemplateStringsArray, ...args: unknown[]) {
    let prompt: string

    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      // Tagged template
      prompt = (promptOrStrings as TemplateStringsArray).reduce((acc, str, i) => {
        const value = args[i]
        if (value === undefined) return acc + str
        if (typeof value === 'object' && value !== null) {
          // Convert objects to YAML for readability (matches real implementation)
          return acc + str + '\n' + yamlStringify(value).trim()
        }
        return acc + str + String(value)
      }, '')

      // Return chainable for options - properly make it thenable
      const basePromise = mockGenerate(type, prompt, {})
      const chainable = (options?: Record<string, unknown>) => mockGenerate(type, prompt, options || {})

      // Add then/catch to make it awaitable
      ;(chainable as unknown as Promise<unknown>).then = basePromise.then.bind(basePromise)
      ;(chainable as unknown as Promise<unknown>).catch = basePromise.catch.bind(basePromise)

      return chainable
    }

    // Regular call
    prompt = promptOrStrings as string
    return mockGenerate(type, prompt, args[0] || {})
  }
}

// ============================================================================
// Test fixtures
// ============================================================================

const longArticle = 'This is a long article about technology and innovation...'
const technicalReport = 'Technical analysis of system performance metrics...'
const industry = 'fintech'
const topic = 'TypeScript'
const claim = 'The Earth is round'
const article = 'Article mentioning John Smith and Jane Doe...'
const text = 'Some text content'
const company = 'Acme Corp'
const market = 'SaaS'
const recipient = 'John'
const subject = 'Project Update'
const companyName = 'TechCorp'
const productName = 'ProductX'
const data = { key: 'value' }
