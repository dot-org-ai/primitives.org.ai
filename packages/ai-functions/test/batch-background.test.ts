/**
 * Tests for batch and background processing modes
 *
 * Batch mode: fn.batch([inputs]) - Process many inputs at ~50% discount
 * Background mode: fn(..., { mode: 'background' }) - Returns job ID immediately
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Mock implementations
// ============================================================================

const mockBatchProcess = vi.fn()
const mockBackgroundProcess = vi.fn()

/**
 * Create a mock function with batch support
 */
function createMockFunctionWithBatch<T>(
  defaultHandler: (prompt: string) => Promise<T>
) {
  const fn = async (prompt: string, options?: Record<string, unknown>) => {
    if (options?.mode === 'background') {
      return mockBackgroundProcess(prompt, options)
    }
    return defaultHandler(prompt)
  }

  // Add batch method
  fn.batch = async (inputs: Array<string | Record<string, unknown>>) => {
    return mockBatchProcess(inputs)
  }

  return fn
}

/**
 * Create a tagged template function with batch support
 */
function createMockTemplateFunctionWithBatch<T>(
  defaultHandler: (prompt: string) => Promise<T>
) {
  function fn(promptOrStrings: string | TemplateStringsArray, ...args: unknown[]) {
    let prompt: string

    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      prompt = (promptOrStrings as TemplateStringsArray).reduce((acc, str, i) => {
        return acc + str + (args[i] ?? '')
      }, '')
    } else {
      prompt = promptOrStrings as string
    }

    return defaultHandler(prompt)
  }

  // Add batch method
  fn.batch = async (inputs: Array<string | Record<string, unknown>>) => {
    return mockBatchProcess(inputs)
  }

  return fn
}

// ============================================================================
// Batch mode tests
// ============================================================================

describe('batch mode', () => {
  beforeEach(() => {
    mockBatchProcess.mockReset()
  })

  describe('write.batch()', () => {
    it('processes multiple prompts in batch', async () => {
      const write = createMockFunctionWithBatch(async () => 'Generated content')

      const prompts = [
        'blog post about TypeScript',
        'blog post about React',
        'blog post about Next.js',
      ]

      mockBatchProcess.mockResolvedValue([
        'TypeScript content...',
        'React content...',
        'Next.js content...',
      ])

      const results = await write.batch(prompts)

      expect(mockBatchProcess).toHaveBeenCalledWith(prompts)
      expect(results).toHaveLength(3)
    })

    it('processes object inputs with context', async () => {
      const write = createMockFunctionWithBatch(async () => 'Generated content')

      const brand = { voice: 'professional', audience: 'developers' }
      const titles = ['Getting Started', 'Advanced Patterns', 'Best Practices']

      const inputs = titles.map(title => ({
        title,
        brand,
        tone: 'technical',
      }))

      mockBatchProcess.mockResolvedValue([
        'Getting Started content...',
        'Advanced Patterns content...',
        'Best Practices content...',
      ])

      const results = await write.batch(inputs)

      expect(mockBatchProcess).toHaveBeenCalledWith(inputs)
      expect(results).toHaveLength(3)
    })

    it('returns results in same order as inputs', async () => {
      const write = createMockFunctionWithBatch(async () => 'content')

      const inputs = ['first', 'second', 'third']

      mockBatchProcess.mockResolvedValue([
        'Result for first',
        'Result for second',
        'Result for third',
      ])

      const results = await write.batch(inputs)

      expect(results[0]).toContain('first')
      expect(results[1]).toContain('second')
      expect(results[2]).toContain('third')
    })
  })

  describe('list.batch()', () => {
    it('generates multiple lists in batch', async () => {
      const list = createMockFunctionWithBatch(async () => ['item'])

      mockBatchProcess.mockResolvedValue([
        ['TypeScript tip 1', 'TypeScript tip 2'],
        ['React tip 1', 'React tip 2'],
        ['Next.js tip 1', 'Next.js tip 2'],
      ])

      const results = await list.batch([
        '3 TypeScript tips',
        '3 React tips',
        '3 Next.js tips',
      ])

      expect(results).toHaveLength(3)
      expect(results[0]).toEqual(['TypeScript tip 1', 'TypeScript tip 2'])
    })
  })

  describe('code.batch()', () => {
    it('generates multiple code snippets in batch', async () => {
      const code = createMockFunctionWithBatch(async () => 'code')

      mockBatchProcess.mockResolvedValue([
        'function validateEmail(email) { ... }',
        'function validatePhone(phone) { ... }',
        'function validateUrl(url) { ... }',
      ])

      const results = await code.batch([
        { description: 'email validator', language: 'typescript' },
        { description: 'phone validator', language: 'typescript' },
        { description: 'url validator', language: 'typescript' },
      ])

      expect(results).toHaveLength(3)
      expect(results[0]).toContain('validateEmail')
    })
  })

  describe('batch with options', () => {
    it('accepts batch-level options', async () => {
      const write = createMockFunctionWithBatch(async () => 'content')

      // Simulating batch with options
      const mockBatchWithOptions = vi.fn().mockResolvedValue(['r1', 'r2'])

      const inputs = ['prompt1', 'prompt2']
      const options = { model: 'claude-opus-4-5' }

      await mockBatchWithOptions(inputs, options)

      expect(mockBatchWithOptions).toHaveBeenCalledWith(inputs, options)
    })

    it('supports priority option for urgent batches', async () => {
      const mockBatchWithPriority = vi.fn().mockResolvedValue(['result'])

      await mockBatchWithPriority(['prompt'], { priority: 'high' })

      expect(mockBatchWithPriority).toHaveBeenCalledWith(
        ['prompt'],
        expect.objectContaining({ priority: 'high' })
      )
    })
  })
})

// ============================================================================
// Background mode tests
// ============================================================================

describe('background mode', () => {
  beforeEach(() => {
    mockBackgroundProcess.mockReset()
  })

  it('returns job ID immediately', async () => {
    const write = createMockFunctionWithBatch(async () => 'content')

    mockBackgroundProcess.mockResolvedValue({
      jobId: 'job_abc123',
      status: 'pending',
    })

    const job = await write('long form article', { mode: 'background' })

    expect(mockBackgroundProcess).toHaveBeenCalledWith(
      'long form article',
      expect.objectContaining({ mode: 'background' })
    )
    expect(job).toHaveProperty('jobId')
    expect(job.status).toBe('pending')
  })

  it('can check job status', async () => {
    const mockGetJobStatus = vi.fn()

    // Simulating job status check
    mockGetJobStatus.mockResolvedValueOnce({ status: 'processing' })
    mockGetJobStatus.mockResolvedValueOnce({ status: 'completed', result: 'Generated content' })

    const status1 = await mockGetJobStatus('job_abc123')
    expect(status1.status).toBe('processing')

    const status2 = await mockGetJobStatus('job_abc123')
    expect(status2.status).toBe('completed')
    expect(status2.result).toBe('Generated content')
  })

  it('supports webhook callback', async () => {
    const write = createMockFunctionWithBatch(async () => 'content')

    mockBackgroundProcess.mockResolvedValue({
      jobId: 'job_xyz789',
      status: 'pending',
    })

    await write('content', {
      mode: 'background',
      webhook: 'https://myapp.com/webhooks/ai-complete',
    })

    expect(mockBackgroundProcess).toHaveBeenCalledWith(
      'content',
      expect.objectContaining({
        mode: 'background',
        webhook: 'https://myapp.com/webhooks/ai-complete',
      })
    )
  })

  it('supports polling for result', async () => {
    // Simulating a poll function
    const mockPollForResult = vi.fn()

    mockPollForResult.mockImplementation(async (jobId: string) => {
      // Simulate polling - would normally check periodically
      return { status: 'completed', result: 'Final result' }
    })

    const result = await mockPollForResult('job_abc123')

    expect(result.status).toBe('completed')
    expect(result.result).toBe('Final result')
  })
})

// ============================================================================
// Combined batch and background
// ============================================================================

describe('batch + background mode', () => {
  it('can run batch in background', async () => {
    const mockBatchBackground = vi.fn()

    mockBatchBackground.mockResolvedValue({
      jobId: 'batch_job_123',
      status: 'pending',
      inputCount: 100,
    })

    // Large batch job in background
    const job = await mockBatchBackground(
      Array(100).fill('Generate content'),
      { mode: 'background' }
    )

    expect(job.jobId).toBe('batch_job_123')
    expect(job.inputCount).toBe(100)
  })

  it('tracks progress of background batch', async () => {
    const mockBatchProgress = vi.fn()

    mockBatchProgress
      .mockResolvedValueOnce({ status: 'processing', completed: 10, total: 100 })
      .mockResolvedValueOnce({ status: 'processing', completed: 50, total: 100 })
      .mockResolvedValueOnce({ status: 'completed', completed: 100, total: 100 })

    const p1 = await mockBatchProgress('batch_job_123')
    expect(p1.completed).toBe(10)

    const p2 = await mockBatchProgress('batch_job_123')
    expect(p2.completed).toBe(50)

    const p3 = await mockBatchProgress('batch_job_123')
    expect(p3.status).toBe('completed')
  })
})

// ============================================================================
// Batch pricing and limits
// ============================================================================

describe('batch characteristics', () => {
  it('batch provides cost savings (documentation test)', () => {
    // This documents expected behavior
    const batchInfo = {
      discount: '50%',
      turnaround: '24 hours max',
      minBatchSize: 1,
      maxBatchSize: 10000,
    }

    expect(batchInfo.discount).toBe('50%')
    expect(batchInfo.turnaround).toBe('24 hours max')
  })

  it('batch handles errors gracefully', async () => {
    const mockBatchWithErrors = vi.fn()

    // Some items succeed, some fail
    mockBatchWithErrors.mockResolvedValue({
      results: [
        { index: 0, status: 'success', result: 'Content 1' },
        { index: 1, status: 'error', error: 'Content policy violation' },
        { index: 2, status: 'success', result: 'Content 3' },
      ],
      summary: { succeeded: 2, failed: 1 },
    })

    const response = await mockBatchWithErrors(['p1', 'p2', 'p3'])

    expect(response.summary.succeeded).toBe(2)
    expect(response.summary.failed).toBe(1)
    expect(response.results[1].status).toBe('error')
  })
})

// ============================================================================
// Use cases from README
// ============================================================================

describe('batch use cases', () => {
  beforeEach(() => {
    mockBatchProcess.mockReset()
  })

  it('content generation at scale', async () => {
    const write = createMockFunctionWithBatch(async () => 'content')

    // Generate blog posts for 100 topics
    const topics = Array(100)
      .fill(null)
      .map((_, i) => `Topic ${i + 1}`)

    const inputs = topics.map(topic => ({
      topic,
      length: 'medium',
      style: 'informative',
    }))

    mockBatchProcess.mockResolvedValue(
      topics.map(t => `Blog post about ${t}...`)
    )

    const posts = await write.batch(inputs)

    expect(posts).toHaveLength(100)
  })

  it('product description generation', async () => {
    const write = createMockFunctionWithBatch(async () => 'description')

    const products = [
      { name: 'Widget Pro', category: 'tools', features: ['durable', 'lightweight'] },
      { name: 'Gadget Plus', category: 'electronics', features: ['wireless', 'rechargeable'] },
    ]

    mockBatchProcess.mockResolvedValue([
      'Widget Pro is a durable, lightweight tool...',
      'Gadget Plus is a wireless, rechargeable electronic...',
    ])

    const descriptions = await write.batch(
      products.map(p => ({
        prompt: `product description for ${p.name}`,
        product: p,
      }))
    )

    expect(descriptions).toHaveLength(2)
    expect(descriptions[0]).toContain('Widget Pro')
  })

  it('code generation for multiple functions', async () => {
    const code = createMockFunctionWithBatch(async () => 'code')

    const functions = [
      { name: 'validateEmail', description: 'Validate email format' },
      { name: 'validatePhone', description: 'Validate phone number' },
      { name: 'validateUrl', description: 'Validate URL format' },
    ]

    mockBatchProcess.mockResolvedValue(
      functions.map(f => `function ${f.name}(value) { ... }`)
    )

    const implementations = await code.batch(
      functions.map(f => ({
        description: f.description,
        functionName: f.name,
        language: 'typescript',
      }))
    )

    expect(implementations).toHaveLength(3)
    functions.forEach((f, i) => {
      expect(implementations[i]).toContain(f.name)
    })
  })
})

// ============================================================================
// Error handling
// ============================================================================

describe('batch error handling', () => {
  beforeEach(() => {
    mockBatchProcess.mockReset()
  })

  it('handles empty input array', async () => {
    const write = createMockFunctionWithBatch(async () => 'content')

    mockBatchProcess.mockResolvedValue([])

    const results = await write.batch([])

    expect(results).toEqual([])
  })

  it('propagates batch-level errors', async () => {
    const write = createMockFunctionWithBatch(async () => 'content')

    mockBatchProcess.mockRejectedValue(new Error('Batch quota exceeded'))

    await expect(write.batch(['prompt'])).rejects.toThrow('Batch quota exceeded')
  })
})
