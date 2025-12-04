/**
 * Tests for tagged template literal support
 *
 * Every function should support:
 * 1. Tagged template syntax: fn`prompt ${variable}`
 * 2. Objects/arrays auto-convert to YAML in templates
 * 3. Options chaining: fn`prompt`({ model: '...' })
 */

import { describe, it, expect } from 'vitest'
import { stringify } from 'yaml'

// ============================================================================
// Template Parsing Tests (Unit Tests - No AI calls)
// ============================================================================

/**
 * Parse a tagged template literal into a prompt string
 * Objects and arrays are converted to YAML for readability
 */
function parseTemplate(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((result, str, i) => {
    const value = values[i]
    if (value === undefined) {
      return result + str
    }

    // Convert objects/arrays to YAML
    if (typeof value === 'object' && value !== null) {
      const yaml = stringify(value).trim()
      return result + str + '\n' + yaml
    }

    // Primitives use toString()
    return result + str + String(value)
  }, '')
}

/**
 * Create a template function that supports both call styles
 */
function createTemplateFunction<T>(
  handler: (prompt: string, options?: Record<string, unknown>) => Promise<T>
): {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<T> & { (options?: Record<string, unknown>): Promise<T> }
  (prompt: string, options?: Record<string, unknown>): Promise<T>
} {
  function templateFn(promptOrStrings: string | TemplateStringsArray, ...args: unknown[]) {
    // Tagged template literal
    if (Array.isArray(promptOrStrings) && 'raw' in promptOrStrings) {
      const prompt = parseTemplate(promptOrStrings as TemplateStringsArray, ...args)

      // Return a thenable that also accepts options
      const promise = handler(prompt)

      // Allow chaining with options: fn`prompt`({ model: '...' })
      // Create a function that also implements then/catch for Promise interface
      const chainable = (options?: Record<string, unknown>) => handler(prompt, options)

      // Make it thenable by adding then/catch from the original promise
      ;(chainable as unknown as Promise<T>).then = promise.then.bind(promise)
      ;(chainable as unknown as Promise<T>).catch = promise.catch.bind(promise)

      return chainable
    }

    // Regular function call
    return handler(promptOrStrings as string, args[0] as Record<string, unknown> | undefined)
  }

  return templateFn as ReturnType<typeof createTemplateFunction<T>>
}

describe('template parsing', () => {
  it('parses simple string interpolation', () => {
    const topic = 'TypeScript'
    const result = parseTemplate`Write about ${topic}`
    expect(result).toBe('Write about TypeScript')
  })

  it('parses multiple interpolations', () => {
    const topic = 'TypeScript'
    const audience = 'beginners'
    const result = parseTemplate`Write about ${topic} for ${audience}`
    expect(result).toBe('Write about TypeScript for beginners')
  })

  it('converts objects to YAML', () => {
    const context = { topic: 'TypeScript', level: 'beginner' }
    const result = parseTemplate`Write a post about ${{ context }}`

    expect(result).toContain('context:')
    expect(result).toContain('topic: TypeScript')
    expect(result).toContain('level: beginner')
  })

  it('converts arrays to YAML lists', () => {
    const topics = ['React', 'Vue', 'Angular']
    const result = parseTemplate`Compare ${topics}`

    expect(result).toContain('- React')
    expect(result).toContain('- Vue')
    expect(result).toContain('- Angular')
  })

  it('handles nested objects', () => {
    const brand = {
      hero: 'developers',
      problem: {
        internal: 'complexity',
        external: 'time constraints',
      },
    }
    const result = parseTemplate`Create a story for ${{ brand }}`

    expect(result).toContain('brand:')
    expect(result).toContain('hero: developers')
    expect(result).toContain('problem:')
    expect(result).toContain('internal: complexity')
    expect(result).toContain('external: time constraints')
  })

  it('handles numbers and booleans', () => {
    const count = 10
    const active = true
    const result = parseTemplate`Generate ${count} items, active: ${active}`

    expect(result).toBe('Generate 10 items, active: true')
  })

  it('handles null and undefined gracefully', () => {
    const value = null
    const result = parseTemplate`Value is ${value}`
    expect(result).toContain('Value is')
  })

  it('preserves template structure with objects inline', () => {
    const requirements = {
      pages: ['home', 'about', 'contact'],
      features: ['dark mode', 'responsive'],
    }
    const result = parseTemplate`marketing site${{ requirements }}`

    expect(result).toContain('marketing site')
    expect(result).toContain('requirements:')
    expect(result).toContain('pages:')
    expect(result).toContain('- home')
    expect(result).toContain('features:')
    expect(result).toContain('- dark mode')
  })
})

describe('template function creation', () => {
  it('creates a function that handles tagged templates', async () => {
    const mockHandler = async (prompt: string) => `Processed: ${prompt}`
    const fn = createTemplateFunction(mockHandler)

    const result = await fn`Hello ${'world'}`
    expect(result).toBe('Processed: Hello world')
  })

  it('creates a function that handles regular calls', async () => {
    const mockHandler = async (prompt: string) => `Processed: ${prompt}`
    const fn = createTemplateFunction(mockHandler)

    const result = await fn('Hello world')
    expect(result).toBe('Processed: Hello world')
  })

  it('supports options chaining on tagged templates', async () => {
    let capturedOptions: Record<string, unknown> | undefined
    const mockHandler = async (prompt: string, options?: Record<string, unknown>) => {
      capturedOptions = options
      return `Processed: ${prompt}`
    }
    const fn = createTemplateFunction(mockHandler)

    const result = await fn`Hello world`({ model: 'claude-opus-4-5' })

    expect(result).toBe('Processed: Hello world')
    expect(capturedOptions).toEqual({ model: 'claude-opus-4-5' })
  })

  it('passes options in regular calls', async () => {
    let capturedOptions: Record<string, unknown> | undefined
    const mockHandler = async (prompt: string, options?: Record<string, unknown>) => {
      capturedOptions = options
      return `Processed: ${prompt}`
    }
    const fn = createTemplateFunction(mockHandler)

    await fn('Hello world', { model: 'gpt-5-1', temperature: 0.7 })

    expect(capturedOptions).toEqual({ model: 'gpt-5-1', temperature: 0.7 })
  })

  it('converts complex objects to YAML in templates', async () => {
    let capturedPrompt = ''
    const mockHandler = async (prompt: string) => {
      capturedPrompt = prompt
      return 'ok'
    }
    const fn = createTemplateFunction(mockHandler)

    const brand = { hero: 'developers', guide: 'ai-functions' }
    await fn`Create story for ${{ brand }}`

    expect(capturedPrompt).toContain('brand:')
    expect(capturedPrompt).toContain('hero: developers')
    expect(capturedPrompt).toContain('guide: ai-functions')
  })
})

describe('options parameter', () => {
  it('supports model option', async () => {
    let capturedOptions: Record<string, unknown> | undefined
    const mockHandler = async (_prompt: string, options?: Record<string, unknown>) => {
      capturedOptions = options
      return 'ok'
    }
    const fn = createTemplateFunction(mockHandler)

    await fn`test`({ model: 'claude-opus-4-5' })

    expect(capturedOptions?.model).toBe('claude-opus-4-5')
  })

  it('supports thinking option', async () => {
    let capturedOptions: Record<string, unknown> | undefined
    const mockHandler = async (_prompt: string, options?: Record<string, unknown>) => {
      capturedOptions = options
      return 'ok'
    }
    const fn = createTemplateFunction(mockHandler)

    await fn`complex analysis`({ thinking: 'high' })

    expect(capturedOptions?.thinking).toBe('high')
  })

  it('supports thinking as token budget number', async () => {
    let capturedOptions: Record<string, unknown> | undefined
    const mockHandler = async (_prompt: string, options?: Record<string, unknown>) => {
      capturedOptions = options
      return 'ok'
    }
    const fn = createTemplateFunction(mockHandler)

    await fn`complex analysis`({ thinking: 10000 })

    expect(capturedOptions?.thinking).toBe(10000)
  })

  it('supports temperature option', async () => {
    let capturedOptions: Record<string, unknown> | undefined
    const mockHandler = async (_prompt: string, options?: Record<string, unknown>) => {
      capturedOptions = options
      return 'ok'
    }
    const fn = createTemplateFunction(mockHandler)

    await fn`creative writing`({ temperature: 0.9 })

    expect(capturedOptions?.temperature).toBe(0.9)
  })

  it('supports maxTokens option', async () => {
    let capturedOptions: Record<string, unknown> | undefined
    const mockHandler = async (_prompt: string, options?: Record<string, unknown>) => {
      capturedOptions = options
      return 'ok'
    }
    const fn = createTemplateFunction(mockHandler)

    await fn`long article`({ maxTokens: 4000 })

    expect(capturedOptions?.maxTokens).toBe(4000)
  })

  it('supports multiple options together', async () => {
    let capturedOptions: Record<string, unknown> | undefined
    const mockHandler = async (_prompt: string, options?: Record<string, unknown>) => {
      capturedOptions = options
      return 'ok'
    }
    const fn = createTemplateFunction(mockHandler)

    await fn`complex task`({
      model: 'claude-opus-4-5',
      thinking: 'high',
      temperature: 0.7,
      maxTokens: 8000,
    })

    expect(capturedOptions).toEqual({
      model: 'claude-opus-4-5',
      thinking: 'high',
      temperature: 0.7,
      maxTokens: 8000,
    })
  })
})
