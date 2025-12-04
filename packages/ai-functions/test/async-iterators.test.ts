/**
 * Tests for async iterator support on list and extract
 *
 * Functions that return lists can be streamed with `for await`:
 * - list`...` - streams items as they're generated
 * - extract`...` - streams extracted items
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Mock async generators
// ============================================================================

const mockStreamItems = vi.fn()

/**
 * Create an async iterable from an array (simulates streaming)
 */
async function* createAsyncIterable<T>(items: T[], delayMs = 10): AsyncIterable<T> {
  for (const item of items) {
    await new Promise(resolve => setTimeout(resolve, delayMs))
    yield item
  }
}

/**
 * Mock list function that returns both a promise and an async iterable
 */
function createMockStreamingList() {
  return function list(promptOrStrings: string | TemplateStringsArray, ...args: unknown[]) {
    let prompt: string

    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      prompt = (promptOrStrings as TemplateStringsArray).reduce((acc, str, i) => {
        return acc + str + (args[i] ?? '')
      }, '')
    } else {
      prompt = promptOrStrings as string
    }

    const items = mockStreamItems(prompt)

    // Return an object that is both a Promise and AsyncIterable
    const asyncIterable = createAsyncIterable(items)

    const result = {
      // Promise interface - resolve to full array
      then: (resolve: (value: string[]) => void, reject?: (error: Error) => void) => {
        return Promise.resolve(items).then(resolve, reject)
      },

      // AsyncIterable interface - stream items
      [Symbol.asyncIterator]: () => asyncIterable[Symbol.asyncIterator](),
    }

    return result as Promise<string[]> & AsyncIterable<string>
  }
}

/**
 * Mock extract function with streaming support
 */
function createMockStreamingExtract() {
  return function extract(promptOrStrings: string | TemplateStringsArray, ...args: unknown[]) {
    let prompt: string

    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      prompt = (promptOrStrings as TemplateStringsArray).reduce((acc, str, i) => {
        return acc + str + (args[i] ?? '')
      }, '')
    } else {
      prompt = promptOrStrings as string
    }

    const items = mockStreamItems(prompt)
    const asyncIterable = createAsyncIterable(items)

    const result = {
      then: (resolve: (value: string[]) => void, reject?: (error: Error) => void) => {
        return Promise.resolve(items).then(resolve, reject)
      },
      [Symbol.asyncIterator]: () => asyncIterable[Symbol.asyncIterator](),
    }

    return result as Promise<string[]> & AsyncIterable<string>
  }
}

// ============================================================================
// list() async iterator tests
// ============================================================================

describe('list() async iteration', () => {
  beforeEach(() => {
    mockStreamItems.mockReset()
  })

  it('can be awaited to get full array', async () => {
    mockStreamItems.mockReturnValue(['Idea 1', 'Idea 2', 'Idea 3'])
    const list = createMockStreamingList()

    const result = await list`startup ideas`

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(3)
  })

  it('can be iterated with for await', async () => {
    mockStreamItems.mockReturnValue(['Idea 1', 'Idea 2', 'Idea 3'])
    const list = createMockStreamingList()

    const collected: string[] = []
    for await (const item of list`startup ideas`) {
      collected.push(item)
    }

    expect(collected).toHaveLength(3)
    expect(collected).toEqual(['Idea 1', 'Idea 2', 'Idea 3'])
  })

  it('allows early termination with break', async () => {
    mockStreamItems.mockReturnValue(['Idea 1', 'Billion Dollar Idea', 'Idea 3', 'Idea 4', 'Idea 5'])
    const list = createMockStreamingList()

    const collected: string[] = []
    for await (const idea of list`startup ideas`) {
      collected.push(idea)
      if (idea.includes('Billion')) {
        break
      }
    }

    // Should have stopped after finding the billion dollar idea
    expect(collected).toHaveLength(2)
    expect(collected[1]).toBe('Billion Dollar Idea')
  })

  it('supports nested iteration pattern from README', async () => {
    const marketList = createMockStreamingList()
    const icpList = createMockStreamingList()

    // Simulate the nested pattern
    mockStreamItems
      .mockReturnValueOnce(['Market A', 'Market B'])
      .mockReturnValueOnce(['ICP 1', 'ICP 2'])
      .mockReturnValueOnce(['ICP 3', 'ICP 4'])

    const results: Array<{ market: string; icp: string }> = []

    for await (const market of marketList`market segments`) {
      for await (const icp of icpList`customer profiles for ${market}`) {
        results.push({ market, icp })
      }
    }

    expect(results).toHaveLength(4)
    expect(results[0]).toEqual({ market: 'Market A', icp: 'ICP 1' })
    expect(results[3]).toEqual({ market: 'Market B', icp: 'ICP 4' })
  })

  it('processes items as they stream in', async () => {
    mockStreamItems.mockReturnValue(['Item 1', 'Item 2', 'Item 3'])
    const list = createMockStreamingList()

    const processedAt: number[] = []
    const startTime = Date.now()

    for await (const _item of list`items`) {
      processedAt.push(Date.now() - startTime)
    }

    // Items should be processed incrementally, not all at once
    expect(processedAt[1]).toBeGreaterThan(processedAt[0])
    expect(processedAt[2]).toBeGreaterThan(processedAt[1])
  })
})

// ============================================================================
// extract() async iterator tests
// ============================================================================

describe('extract() async iteration', () => {
  beforeEach(() => {
    mockStreamItems.mockReset()
  })

  it('can be awaited to get full array', async () => {
    mockStreamItems.mockReturnValue(['John Smith', 'Jane Doe', 'Bob Wilson'])
    const extract = createMockStreamingExtract()

    const result = await extract`names from article`

    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(3)
  })

  it('can be iterated with for await', async () => {
    mockStreamItems.mockReturnValue(['email1@example.com', 'email2@example.com'])
    const extract = createMockStreamingExtract()

    const collected: string[] = []
    for await (const email of extract`email addresses from document`) {
      collected.push(email)
    }

    expect(collected).toHaveLength(2)
  })

  it('supports the research + extract pattern from README', async () => {
    mockStreamItems.mockReturnValue(['Competitor A', 'Competitor B', 'Competitor C'])
    const extract = createMockStreamingExtract()

    const competitors: string[] = []
    const marketResearch = 'Report mentioning Competitor A, Competitor B, and Competitor C...'

    for await (const competitor of extract`company names from ${marketResearch}`) {
      competitors.push(competitor)
      // In real code, you would do: await research`${competitor} vs ${ourProduct}`
    }

    expect(competitors).toHaveLength(3)
  })

  it('allows processing each extraction as it completes', async () => {
    mockStreamItems.mockReturnValue(['email1@test.com', 'email2@test.com'])
    const extract = createMockStreamingExtract()

    const notifications: string[] = []
    for await (const email of extract`emails from document`) {
      // Simulate sending notification
      notifications.push(`Notified: ${email}`)
    }

    expect(notifications).toHaveLength(2)
    expect(notifications[0]).toBe('Notified: email1@test.com')
  })
})

// ============================================================================
// Combined patterns
// ============================================================================

describe('combined async iteration patterns', () => {
  beforeEach(() => {
    mockStreamItems.mockReset()
  })

  it('supports the full market research pattern from README', async () => {
    const list = createMockStreamingList()
    const extract = createMockStreamingExtract()

    // Mock different results for each call
    mockStreamItems
      .mockReturnValueOnce(['Market A']) // markets
      .mockReturnValueOnce(['ICP 1']) // ICPs for Market A
      .mockReturnValueOnce(['Blog 1', 'Blog 2']) // blog titles

    const results: string[] = []

    // Simplified version of README example
    for await (const market of list`market segments for idea`) {
      for await (const icp of list`customer profiles for ${market}`) {
        for await (const title of list`blog titles for ${icp}`) {
          results.push(`${market} > ${icp} > ${title}`)
        }
      }
    }

    expect(results).toHaveLength(2)
    expect(results[0]).toBe('Market A > ICP 1 > Blog 1')
    expect(results[1]).toBe('Market A > ICP 1 > Blog 2')
  })
})

// ============================================================================
// Type safety
// ============================================================================

describe('async iterator type safety', () => {
  it('list returns string items by default', async () => {
    mockStreamItems.mockReturnValue(['a', 'b', 'c'])
    const list = createMockStreamingList()

    for await (const item of list`items`) {
      expect(typeof item).toBe('string')
    }
  })

  it('extract can return typed objects with schema', async () => {
    // This tests the concept - actual implementation would use schema
    const items = [
      { name: 'Acme', role: 'competitor' },
      { name: 'Beta', role: 'partner' },
    ]

    mockStreamItems.mockReturnValue(items)
    const extract = createMockStreamingExtract()

    const collected: Array<{ name: string; role: string }> = []
    for await (const company of extract`companies from text`) {
      collected.push(company as { name: string; role: string })
    }

    expect(collected[0]).toHaveProperty('name')
    expect(collected[0]).toHaveProperty('role')
  })
})

// ============================================================================
// Error handling
// ============================================================================

describe('async iterator error handling', () => {
  it('propagates errors during iteration', async () => {
    mockStreamItems.mockImplementation(() => {
      throw new Error('Generation failed')
    })
    const list = createMockStreamingList()

    await expect(async () => {
      for await (const _item of list`items`) {
        // Should not reach here
      }
    }).rejects.toThrow('Generation failed')
  })
})
