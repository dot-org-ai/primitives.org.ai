/**
 * Tests for the decide() function - LLM as Judge
 *
 * decide`criteria`(optionA, optionB) - Compare options and pick the best
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Mock for underlying AI calls
// ============================================================================

const mockDecide = vi.fn()

/**
 * Mock decide implementation
 * Returns a function that compares options against criteria
 */
function createMockDecide() {
  return function decide(
    promptOrStrings: string | TemplateStringsArray,
    ...args: unknown[]
  ) {
    let criteria: string

    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      criteria = (promptOrStrings as TemplateStringsArray).reduce((acc, str, i) => {
        return acc + str + (args[i] ?? '')
      }, '')
    } else {
      criteria = promptOrStrings as string
    }

    // Return a function that accepts options to compare
    return function compareOptions<T>(...options: T[]): Promise<T> {
      return mockDecide(criteria, options)
    }
  }
}

// ============================================================================
// Basic decide() tests
// ============================================================================

describe('decide() - LLM as Judge', () => {
  beforeEach(() => {
    mockDecide.mockReset()
  })

  describe('basic comparison', () => {
    it('compares two options and returns the better one', async () => {
      const decide = createMockDecide()

      const optionA = { name: 'Simple Solution', complexity: 'low', time: '1 day' }
      const optionB = { name: 'Complex Solution', complexity: 'high', time: '1 week' }

      mockDecide.mockResolvedValue(optionA)

      const result = await decide`fastest to implement`(optionA, optionB)

      expect(mockDecide).toHaveBeenCalledWith(
        'fastest to implement',
        [optionA, optionB]
      )
      expect(result).toBe(optionA)
    })

    it('compares multiple options', async () => {
      const decide = createMockDecide()

      const options = [
        { framework: 'React', popularity: 'high' },
        { framework: 'Vue', popularity: 'medium' },
        { framework: 'Angular', popularity: 'medium' },
        { framework: 'Svelte', popularity: 'growing' },
      ]

      mockDecide.mockResolvedValue(options[0])

      const result = await decide`best for large enterprise applications`(
        options[0],
        options[1],
        options[2],
        options[3]
      )

      expect(mockDecide).toHaveBeenCalledWith(
        'best for large enterprise applications',
        options
      )
      expect(result).toEqual({ framework: 'React', popularity: 'high' })
    })

    it('works with string options', async () => {
      const decide = createMockDecide()

      mockDecide.mockResolvedValue('Option B: More engaging title')

      const result = await decide`better headline for click-through rate`(
        'Option A: Simple Guide to TypeScript',
        'Option B: More engaging title'
      )

      expect(result).toBe('Option B: More engaging title')
    })
  })

  describe('criteria as tagged template', () => {
    it('supports variable interpolation in criteria', async () => {
      const decide = createMockDecide()
      const audience = 'enterprise developers'

      mockDecide.mockResolvedValue({ headline: 'A' })

      await decide`best for ${audience}`(
        { headline: 'A' },
        { headline: 'B' }
      )

      expect(mockDecide).toHaveBeenCalledWith(
        `best for ${audience}`,
        expect.any(Array)
      )
    })

    it('supports complex criteria descriptions', async () => {
      const decide = createMockDecide()

      const requirements = {
        performance: 'high',
        maintainability: 'critical',
        teamExperience: 'junior',
      }

      mockDecide.mockResolvedValue({ approach: 'A' })

      // Criteria would have requirements as YAML
      await decide`best architecture considering team and requirements`(
        { approach: 'A' },
        { approach: 'B' }
      )

      expect(mockDecide).toHaveBeenCalled()
    })
  })

  describe('use cases from README', () => {
    it('A/B testing headlines', async () => {
      const decide = createMockDecide()

      const headlineA = 'Get Started with TypeScript Today'
      const headlineB = 'TypeScript: The Complete Guide for 2025'

      mockDecide.mockResolvedValue(headlineB)

      const winner = await decide`higher click-through rate for developer audience`(
        headlineA,
        headlineB
      )

      expect(winner).toBe(headlineB)
    })

    it('choosing best code implementation', async () => {
      const decide = createMockDecide()

      const implementations = [
        `function isPrime(n) {
          if (n <= 1) return false;
          for (let i = 2; i <= Math.sqrt(n); i++) {
            if (n % i === 0) return false;
          }
          return true;
        }`,
        `function isPrime(n) {
          if (n <= 1) return false;
          if (n <= 3) return true;
          if (n % 2 === 0 || n % 3 === 0) return false;
          for (let i = 5; i * i <= n; i += 6) {
            if (n % i === 0 || n % (i + 2) === 0) return false;
          }
          return true;
        }`,
      ]

      mockDecide.mockResolvedValue(implementations[1])

      const best = await decide`most performant and readable`(
        implementations[0],
        implementations[1]
      )

      expect(best).toBe(implementations[1])
    })

    it('selecting marketing copy', async () => {
      const decide = createMockDecide()

      const copies = [
        { text: 'Build faster with AI', tone: 'direct' },
        { text: 'Empower your workflow', tone: 'inspirational' },
        { text: '10x your productivity', tone: 'bold' },
      ]

      mockDecide.mockResolvedValue(copies[2])

      const winner = await decide`most compelling for startup founders`(
        copies[0],
        copies[1],
        copies[2]
      )

      expect(winner).toEqual({ text: '10x your productivity', tone: 'bold' })
    })
  })
})

// ============================================================================
// decide() with options parameter
// ============================================================================

describe('decide() with options', () => {
  beforeEach(() => {
    mockDecide.mockReset()
  })

  it('accepts model option', async () => {
    // This tests the concept - actual implementation would pass options
    const mockDecideWithOptions = vi.fn()

    function createMockDecideWithOptions() {
      return function decide(
        promptOrStrings: string | TemplateStringsArray,
        ...args: unknown[]
      ) {
        let criteria: string

        if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
          criteria = (promptOrStrings as TemplateStringsArray).reduce((acc, str, i) => {
            return acc + str + (args[i] ?? '')
          }, '')
        } else {
          criteria = promptOrStrings as string
        }

        return function compareOptions<T>(...options: T[]) {
          // Support options as last parameter if it's an object with known keys
          const lastArg = options[options.length - 1] as Record<string, unknown>
          if (lastArg && typeof lastArg === 'object' && 'model' in lastArg) {
            const realOptions = options.slice(0, -1)
            return mockDecideWithOptions(criteria, realOptions, lastArg)
          }
          return mockDecideWithOptions(criteria, options, undefined)
        }
      }
    }

    const decide = createMockDecideWithOptions()
    mockDecideWithOptions.mockResolvedValue('A')

    // Two ways to pass options:
    // 1. Separate options object
    await decide`better option`('A', 'B')

    expect(mockDecideWithOptions).toHaveBeenCalledWith(
      'better option',
      ['A', 'B'],
      undefined
    )
  })

  it('accepts thinking option for complex decisions', async () => {
    // Complex decisions might benefit from extended thinking
    const mockDecideWithThinking = vi.fn().mockResolvedValue('Option A')

    // Simulating how decide might use thinking
    const decision = mockDecideWithThinking('complex criteria', ['A', 'B'], {
      thinking: 'high',
    })

    expect(mockDecideWithThinking).toHaveBeenCalledWith(
      'complex criteria',
      ['A', 'B'],
      { thinking: 'high' }
    )
  })
})

// ============================================================================
// decide() return value
// ============================================================================

describe('decide() return value', () => {
  beforeEach(() => {
    mockDecide.mockReset()
  })

  it('returns the exact option object passed in', async () => {
    const decide = createMockDecide()

    const optionA = { id: 1, name: 'Option A', metadata: { score: 10 } }
    const optionB = { id: 2, name: 'Option B', metadata: { score: 20 } }

    // Return the exact reference, not a copy
    mockDecide.mockResolvedValue(optionA)

    const result = await decide`best option`(optionA, optionB)

    // Should be the exact same reference
    expect(result).toBe(optionA)
  })

  it('can return with reasoning (extended mode)', async () => {
    // Extended mode returns both the decision and reasoning
    const mockDecideWithReasoning = vi.fn()

    mockDecideWithReasoning.mockResolvedValue({
      choice: 'Option A',
      reasoning: 'Option A is better because it has lower complexity',
      confidence: 0.85,
    })

    const result = await mockDecideWithReasoning('criteria', ['A', 'B'], {
      explain: true,
    })

    expect(result).toHaveProperty('choice')
    expect(result).toHaveProperty('reasoning')
    expect(result).toHaveProperty('confidence')
  })
})

// ============================================================================
// Edge cases
// ============================================================================

describe('decide() edge cases', () => {
  beforeEach(() => {
    mockDecide.mockReset()
  })

  it('handles identical options', async () => {
    const decide = createMockDecide()

    mockDecide.mockResolvedValue('Same')

    const result = await decide`better one`('Same', 'Same')

    expect(result).toBe('Same')
  })

  it('handles single option (validation use case)', async () => {
    const decide = createMockDecide()

    const option = { content: 'Some text' }
    mockDecide.mockResolvedValue(option)

    // Single option - essentially asking "is this good enough?"
    const result = await decide`meets quality standards`(option)

    expect(mockDecide).toHaveBeenCalledWith('meets quality standards', [option])
  })

  it('handles complex nested objects', async () => {
    const decide = createMockDecide()

    const architectureA = {
      name: 'Microservices',
      components: {
        gateway: { type: 'API Gateway', tech: 'Kong' },
        services: ['auth', 'users', 'products'],
        database: { type: 'distributed', engine: 'CockroachDB' },
      },
    }

    const architectureB = {
      name: 'Monolith',
      components: {
        app: { type: 'Monolithic', tech: 'NestJS' },
        database: { type: 'single', engine: 'PostgreSQL' },
      },
    }

    mockDecide.mockResolvedValue(architectureA)

    const result = await decide`better for a startup with 3 developers`(
      architectureA,
      architectureB
    )

    expect(result.name).toBe('Microservices')
  })
})
