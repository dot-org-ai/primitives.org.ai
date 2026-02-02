/**
 * Tests for template.ts module
 *
 * This module provides core utilities for all AI functions:
 * - parseTemplate: Parse tagged template literals with YAML conversion
 * - createChainablePromise: Create promises that support options chaining
 * - createTemplateFunction: Create functions supporting both template and regular calls
 * - withBatch: Add batch capability to template functions
 * - createAsyncIterable: Create async iterables from arrays or generators
 * - createStreamableList: Create dual Promise/AsyncIterable results
 */

import { describe, it, expect, vi } from 'vitest'
import {
  parseTemplate,
  createChainablePromise,
  createTemplateFunction,
  withBatch,
  createAsyncIterable,
  createStreamableList,
  type FunctionOptions,
  type ChainablePromise,
  type TemplateFunction,
  type BatchableFunction,
  type StreamableList,
} from '../src/template.js'

// ============================================================================
// parseTemplate Tests
// ============================================================================

describe('parseTemplate', () => {
  describe('basic interpolation', () => {
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

    it('handles empty template', () => {
      const result = parseTemplate``
      expect(result).toBe('')
    })

    it('handles template with no interpolations', () => {
      const result = parseTemplate`Just plain text`
      expect(result).toBe('Just plain text')
    })

    it('handles adjacent interpolations', () => {
      const a = 'Hello'
      const b = 'World'
      const result = parseTemplate`${a}${b}`
      expect(result).toBe('HelloWorld')
    })
  })

  describe('primitive types', () => {
    it('handles numbers', () => {
      const count = 42
      const result = parseTemplate`Generate ${count} items`
      expect(result).toBe('Generate 42 items')
    })

    it('handles booleans', () => {
      const active = true
      const inactive = false
      const result = parseTemplate`Active: ${active}, Inactive: ${inactive}`
      expect(result).toBe('Active: true, Inactive: false')
    })

    it('handles zero', () => {
      const zero = 0
      const result = parseTemplate`Count: ${zero}`
      expect(result).toBe('Count: 0')
    })

    it('handles empty string', () => {
      const empty = ''
      const result = parseTemplate`Value: ${empty}!`
      expect(result).toBe('Value: !')
    })

    it('handles BigInt', () => {
      const big = BigInt(9007199254740991)
      const result = parseTemplate`Big number: ${big}`
      expect(result).toBe('Big number: 9007199254740991')
    })
  })

  describe('null and undefined handling', () => {
    it('handles undefined at end (trailing template part)', () => {
      const value = undefined
      const result = parseTemplate`Value is ${value}`
      expect(result).toBe('Value is ')
    })

    it('handles undefined in middle', () => {
      const value = undefined
      const result = parseTemplate`Before ${value} after`
      expect(result).toBe('Before  after')
    })

    it('handles null as object (converts to YAML)', () => {
      const value = null
      const result = parseTemplate`Value is ${value}`
      // null is typeof 'object' but === null, so it goes to String()
      expect(result).toContain('Value is')
    })

    it('handles multiple undefined values', () => {
      const a = undefined
      const b = undefined
      const result = parseTemplate`${a} and ${b}`
      expect(result).toBe(' and ')
    })
  })

  describe('object and array YAML conversion', () => {
    it('converts simple objects to YAML', () => {
      const context = { topic: 'TypeScript', level: 'beginner' }
      const result = parseTemplate`Write about ${{ context }}`

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

    it('handles arrays of objects', () => {
      const users = [
        { name: 'Alice', role: 'admin' },
        { name: 'Bob', role: 'user' },
      ]
      const result = parseTemplate`Process users: ${users}`

      expect(result).toContain('- name: Alice')
      expect(result).toContain('role: admin')
      expect(result).toContain('- name: Bob')
      expect(result).toContain('role: user')
    })

    it('handles empty objects', () => {
      const empty = {}
      const result = parseTemplate`Config: ${empty}`
      expect(result).toContain('Config:')
      expect(result).toContain('{}')
    })

    it('handles empty arrays', () => {
      const empty: string[] = []
      const result = parseTemplate`Items: ${empty}`
      expect(result).toContain('Items:')
      expect(result).toContain('[]')
    })

    it('handles deeply nested structures', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              value: 'deep',
            },
          },
        },
      }
      const result = parseTemplate`Data: ${data}`

      expect(result).toContain('level1:')
      expect(result).toContain('level2:')
      expect(result).toContain('level3:')
      expect(result).toContain('value: deep')
    })

    it('adds newline before YAML content', () => {
      const obj = { key: 'value' }
      const result = parseTemplate`Config:${obj}`

      // Should have newline between text and YAML
      expect(result).toMatch(/Config:\n/)
    })
  })

  describe('mixed content', () => {
    it('handles mix of primitives and objects', () => {
      const count = 5
      const options = { format: 'json', verbose: true }
      const result = parseTemplate`Generate ${count} items with ${options}`

      expect(result).toContain('Generate 5 items with')
      expect(result).toContain('format: json')
      expect(result).toContain('verbose: true')
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

  describe('special values', () => {
    it('handles Date objects', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const result = parseTemplate`Date: ${date}`
      // Date objects are converted via YAML
      expect(result).toContain('Date:')
    })

    it('handles RegExp objects', () => {
      const regex = /test\d+/gi
      const result = parseTemplate`Pattern: ${regex}`
      expect(result).toContain('Pattern:')
    })

    it('handles functions (converts to string)', () => {
      const fn = () => 'test'
      // Functions are not objects in typeof sense for this check
      // Actually typeof function is 'function', not 'object'
      const result = parseTemplate`Function: ${fn}`
      expect(result).toContain('Function:')
    })

    it('handles Symbol', () => {
      const sym = Symbol('test')
      const result = parseTemplate`Symbol: ${sym}`
      expect(result).toContain('Symbol(test)')
    })
  })
})

// ============================================================================
// createChainablePromise Tests
// ============================================================================

describe('createChainablePromise', () => {
  describe('basic promise behavior', () => {
    it('can be awaited directly', async () => {
      const executor = vi.fn().mockResolvedValue('result')
      const chainable = createChainablePromise(executor)

      const result = await chainable
      expect(result).toBe('result')
      expect(executor).toHaveBeenCalledTimes(1)
    })

    it('supports .then()', async () => {
      const executor = vi.fn().mockResolvedValue('result')
      const chainable = createChainablePromise(executor)

      const result = await chainable.then((v) => v.toUpperCase())
      expect(result).toBe('RESULT')
    })

    it('supports .catch()', async () => {
      const executor = vi.fn().mockRejectedValue(new Error('test error'))
      const chainable = createChainablePromise(executor)

      const error = await chainable.catch((e) => e.message)
      expect(error).toBe('test error')
    })

    it('supports .finally()', async () => {
      const executor = vi.fn().mockResolvedValue('result')
      const finallyFn = vi.fn()
      const chainable = createChainablePromise(executor)

      await chainable.finally(finallyFn)
      expect(finallyFn).toHaveBeenCalled()
    })

    it('supports chained .then().catch().finally()', async () => {
      const executor = vi.fn().mockResolvedValue(5)
      const finallyFn = vi.fn()
      const chainable = createChainablePromise(executor)

      const result = await chainable
        .then((v) => v * 2)
        .catch(() => 0)
        .finally(finallyFn)

      expect(result).toBe(10)
      expect(finallyFn).toHaveBeenCalled()
    })
  })

  describe('options chaining', () => {
    it('can be called with options', async () => {
      const executor = vi.fn().mockImplementation((opts) => Promise.resolve(opts))
      const chainable = createChainablePromise(executor)

      const result = await chainable({ model: 'claude-opus-4-5' })
      expect(result).toEqual({ model: 'claude-opus-4-5' })
    })

    it('merges options with default options', async () => {
      const executor = vi.fn().mockImplementation((opts) => Promise.resolve(opts))
      const defaultOptions: FunctionOptions = { model: 'sonnet', temperature: 0.5 }
      const chainable = createChainablePromise(executor, defaultOptions)

      const result = await chainable({ temperature: 0.9, maxTokens: 1000 })
      expect(result).toEqual({
        model: 'sonnet',
        temperature: 0.9,
        maxTokens: 1000,
      })
    })

    it('overrides default options when called with same option', async () => {
      const executor = vi.fn().mockImplementation((opts) => Promise.resolve(opts))
      const defaultOptions: FunctionOptions = { model: 'sonnet' }
      const chainable = createChainablePromise(executor, defaultOptions)

      const result = await chainable({ model: 'claude-opus-4-5' })
      expect(result).toEqual({ model: 'claude-opus-4-5' })
    })

    it('uses default options when awaited directly', async () => {
      const executor = vi.fn().mockImplementation((opts) => Promise.resolve(opts))
      const defaultOptions: FunctionOptions = { model: 'sonnet' }
      const chainable = createChainablePromise(executor, defaultOptions)

      const result = await chainable
      expect(result).toEqual({ model: 'sonnet' })
    })

    it('handles undefined options call', async () => {
      const executor = vi.fn().mockImplementation((opts) => Promise.resolve(opts))
      const chainable = createChainablePromise(executor)

      // Calling with undefined merges {...defaultOptions, ...undefined} = {}
      const result = await chainable(undefined)
      expect(result).toEqual({})
    })

    it('handles empty options object', async () => {
      const executor = vi.fn().mockImplementation((opts) => Promise.resolve(opts))
      const defaultOptions: FunctionOptions = { model: 'sonnet' }
      const chainable = createChainablePromise(executor, defaultOptions)

      const result = await chainable({})
      expect(result).toEqual({ model: 'sonnet' })
    })
  })

  describe('executor behavior', () => {
    it('calls executor with default options on creation', () => {
      const executor = vi.fn().mockResolvedValue('result')
      const defaultOptions: FunctionOptions = { model: 'sonnet' }
      createChainablePromise(executor, defaultOptions)

      expect(executor).toHaveBeenCalledWith(defaultOptions)
    })

    it('creates new promise when called with options', async () => {
      const executor = vi.fn().mockResolvedValue('result')
      const chainable = createChainablePromise(executor)

      // First call happens on creation
      expect(executor).toHaveBeenCalledTimes(1)

      // Calling with options creates a new promise
      await chainable({ model: 'claude-opus-4-5' })
      expect(executor).toHaveBeenCalledTimes(2)
    })
  })

  describe('type behavior', () => {
    it('preserves generic type through await', async () => {
      interface User {
        name: string
        age: number
      }
      const user: User = { name: 'Alice', age: 30 }
      const executor = vi.fn().mockResolvedValue(user)
      const chainable = createChainablePromise<User>(executor)

      const result = await chainable
      expect(result.name).toBe('Alice')
      expect(result.age).toBe(30)
    })

    it('preserves generic type through options call', async () => {
      interface User {
        name: string
      }
      const user: User = { name: 'Bob' }
      const executor = vi.fn().mockResolvedValue(user)
      const chainable = createChainablePromise<User>(executor)

      const result = await chainable({ model: 'sonnet' })
      expect(result.name).toBe('Bob')
    })
  })
})

// ============================================================================
// createTemplateFunction Tests
// ============================================================================

describe('createTemplateFunction', () => {
  describe('tagged template literal syntax', () => {
    it('handles tagged template with simple interpolation', async () => {
      let capturedPrompt = ''
      const handler = async (prompt: string) => {
        capturedPrompt = prompt
        return 'result'
      }
      const fn = createTemplateFunction(handler)

      const result = await fn`Hello ${'world'}`
      expect(capturedPrompt).toBe('Hello world')
      expect(result).toBe('result')
    })

    it('handles tagged template with objects', async () => {
      let capturedPrompt = ''
      const handler = async (prompt: string) => {
        capturedPrompt = prompt
        return 'result'
      }
      const fn = createTemplateFunction(handler)

      const data = { name: 'test', value: 42 }
      await fn`Process ${data}`

      expect(capturedPrompt).toContain('name: test')
      expect(capturedPrompt).toContain('value: 42')
    })

    it('handles tagged template without interpolations', async () => {
      let capturedPrompt = ''
      const handler = async (prompt: string) => {
        capturedPrompt = prompt
        return 'result'
      }
      const fn = createTemplateFunction(handler)

      await fn`Plain prompt`
      expect(capturedPrompt).toBe('Plain prompt')
    })

    it('returns chainable promise from tagged template', async () => {
      const handler = async (prompt: string, options?: FunctionOptions) =>
        options?.model ?? 'default'
      const fn = createTemplateFunction(handler)

      // Should be chainable
      const result = await fn`test`({ model: 'claude-opus-4-5' })
      expect(result).toBe('claude-opus-4-5')
    })
  })

  describe('regular function call syntax', () => {
    it('handles regular string call', async () => {
      let capturedPrompt = ''
      const handler = async (prompt: string) => {
        capturedPrompt = prompt
        return 'result'
      }
      const fn = createTemplateFunction(handler)

      await fn('Hello world')
      expect(capturedPrompt).toBe('Hello world')
    })

    it('handles regular call with options', async () => {
      let capturedOptions: FunctionOptions | undefined
      const handler = async (prompt: string, options?: FunctionOptions) => {
        capturedOptions = options
        return 'result'
      }
      const fn = createTemplateFunction(handler)

      await fn('Hello world', { model: 'claude-opus-4-5', temperature: 0.7 })
      expect(capturedOptions).toEqual({ model: 'claude-opus-4-5', temperature: 0.7 })
    })

    it('returns regular promise from string call', async () => {
      const handler = async () => 'result'
      const fn = createTemplateFunction(handler)

      const promise = fn('test')
      expect(promise).toBeInstanceOf(Promise)
      expect(await promise).toBe('result')
    })
  })

  describe('options chaining on tagged templates', () => {
    it('supports model option', async () => {
      let capturedOptions: FunctionOptions | undefined
      const handler = async (_: string, options?: FunctionOptions) => {
        capturedOptions = options
        return 'ok'
      }
      const fn = createTemplateFunction(handler)

      await fn`test`({ model: 'claude-opus-4-5' })
      expect(capturedOptions?.model).toBe('claude-opus-4-5')
    })

    it('supports thinking option', async () => {
      let capturedOptions: FunctionOptions | undefined
      const handler = async (_: string, options?: FunctionOptions) => {
        capturedOptions = options
        return 'ok'
      }
      const fn = createTemplateFunction(handler)

      await fn`analysis`({ thinking: 'high' })
      expect(capturedOptions?.thinking).toBe('high')
    })

    it('supports thinking as token budget', async () => {
      let capturedOptions: FunctionOptions | undefined
      const handler = async (_: string, options?: FunctionOptions) => {
        capturedOptions = options
        return 'ok'
      }
      const fn = createTemplateFunction(handler)

      await fn`analysis`({ thinking: 10000 })
      expect(capturedOptions?.thinking).toBe(10000)
    })

    it('supports temperature option', async () => {
      let capturedOptions: FunctionOptions | undefined
      const handler = async (_: string, options?: FunctionOptions) => {
        capturedOptions = options
        return 'ok'
      }
      const fn = createTemplateFunction(handler)

      await fn`creative`({ temperature: 0.9 })
      expect(capturedOptions?.temperature).toBe(0.9)
    })

    it('supports maxTokens option', async () => {
      let capturedOptions: FunctionOptions | undefined
      const handler = async (_: string, options?: FunctionOptions) => {
        capturedOptions = options
        return 'ok'
      }
      const fn = createTemplateFunction(handler)

      await fn`long article`({ maxTokens: 4000 })
      expect(capturedOptions?.maxTokens).toBe(4000)
    })

    it('supports system option', async () => {
      let capturedOptions: FunctionOptions | undefined
      const handler = async (_: string, options?: FunctionOptions) => {
        capturedOptions = options
        return 'ok'
      }
      const fn = createTemplateFunction(handler)

      await fn`task`({ system: 'You are helpful' })
      expect(capturedOptions?.system).toBe('You are helpful')
    })

    it('supports mode option', async () => {
      let capturedOptions: FunctionOptions | undefined
      const handler = async (_: string, options?: FunctionOptions) => {
        capturedOptions = options
        return 'ok'
      }
      const fn = createTemplateFunction(handler)

      await fn`task`({ mode: 'background' })
      expect(capturedOptions?.mode).toBe('background')
    })

    it('supports multiple options together', async () => {
      let capturedOptions: FunctionOptions | undefined
      const handler = async (_: string, options?: FunctionOptions) => {
        capturedOptions = options
        return 'ok'
      }
      const fn = createTemplateFunction(handler)

      await fn`complex task`({
        model: 'claude-opus-4-5',
        thinking: 'high',
        temperature: 0.7,
        maxTokens: 8000,
        system: 'Be precise',
        mode: 'background',
      })

      expect(capturedOptions).toEqual({
        model: 'claude-opus-4-5',
        thinking: 'high',
        temperature: 0.7,
        maxTokens: 8000,
        system: 'Be precise',
        mode: 'background',
      })
    })
  })

  describe('error handling', () => {
    it('propagates errors from handler in tagged template', async () => {
      const handler = async () => {
        throw new Error('Handler error')
      }
      const fn = createTemplateFunction(handler)

      await expect(fn`test`).rejects.toThrow('Handler error')
    })

    it('propagates errors from handler in regular call', async () => {
      const handler = async () => {
        throw new Error('Handler error')
      }
      const fn = createTemplateFunction(handler)

      await expect(fn('test')).rejects.toThrow('Handler error')
    })

    it('propagates errors from options chaining', async () => {
      const handler = async (_: string, opts?: FunctionOptions) => {
        if (opts?.model === 'invalid') {
          throw new Error('Invalid model')
        }
        return 'ok'
      }
      const fn = createTemplateFunction(handler)

      await expect(fn`test`({ model: 'invalid' })).rejects.toThrow('Invalid model')
    })
  })

  describe('type preservation', () => {
    it('preserves return type', async () => {
      interface Response {
        text: string
        tokens: number
      }
      const handler = async (): Promise<Response> => ({
        text: 'hello',
        tokens: 10,
      })
      const fn = createTemplateFunction(handler)

      const result = await fn`test`
      expect(result.text).toBe('hello')
      expect(result.tokens).toBe(10)
    })
  })
})

// ============================================================================
// withBatch Tests
// ============================================================================

describe('withBatch', () => {
  it('adds batch method to template function', () => {
    const handler = async (prompt: string) => prompt.toUpperCase()
    const fn = createTemplateFunction(handler)
    const batchHandler = async (inputs: string[]) => inputs.map((i) => i.toUpperCase())

    const batchable = withBatch(fn, batchHandler)

    expect(typeof batchable.batch).toBe('function')
  })

  it('batch method processes array of inputs', async () => {
    const handler = async (prompt: string) => prompt.toUpperCase()
    const fn = createTemplateFunction(handler)
    const batchHandler = async (inputs: string[]) => inputs.map((i) => i.toUpperCase())

    const batchable = withBatch(fn, batchHandler)
    const results = await batchable.batch(['hello', 'world'])

    expect(results).toEqual(['HELLO', 'WORLD'])
  })

  it('preserves original template function behavior', async () => {
    let capturedPrompt = ''
    const handler = async (prompt: string) => {
      capturedPrompt = prompt
      return 'result'
    }
    const fn = createTemplateFunction(handler)
    const batchHandler = async (inputs: string[]) => inputs

    const batchable = withBatch(fn, batchHandler)

    // Template syntax still works
    await batchable`test ${'value'}`
    expect(capturedPrompt).toBe('test value')

    // Regular call still works
    await batchable('direct call')
    expect(capturedPrompt).toBe('direct call')
  })

  it('handles empty batch input', async () => {
    const handler = async (prompt: string) => prompt
    const fn = createTemplateFunction(handler)
    const batchHandler = async (inputs: string[]) => inputs.map((i) => i.toUpperCase())

    const batchable = withBatch(fn, batchHandler)
    const results = await batchable.batch([])

    expect(results).toEqual([])
  })

  it('supports typed batch inputs', async () => {
    interface Task {
      id: number
      content: string
    }
    interface Result {
      taskId: number
      output: string
    }

    const handler = async () => ({ taskId: 0, output: '' })
    const fn = createTemplateFunction(handler)
    const batchHandler = async (inputs: Task[]): Promise<Result[]> =>
      inputs.map((t) => ({ taskId: t.id, output: t.content.toUpperCase() }))

    const batchable = withBatch<Result, Task>(fn, batchHandler)
    const results = await batchable.batch([
      { id: 1, content: 'hello' },
      { id: 2, content: 'world' },
    ])

    expect(results).toEqual([
      { taskId: 1, output: 'HELLO' },
      { taskId: 2, output: 'WORLD' },
    ])
  })
})

// ============================================================================
// createAsyncIterable Tests
// ============================================================================

describe('createAsyncIterable', () => {
  describe('from array', () => {
    it('creates async iterable from array', async () => {
      const items = [1, 2, 3]
      const iterable = createAsyncIterable(items)

      const results: number[] = []
      for await (const item of iterable) {
        results.push(item)
      }

      expect(results).toEqual([1, 2, 3])
    })

    it('handles empty array', async () => {
      const items: number[] = []
      const iterable = createAsyncIterable(items)

      const results: number[] = []
      for await (const item of iterable) {
        results.push(item)
      }

      expect(results).toEqual([])
    })

    it('handles array of objects', async () => {
      const items = [{ id: 1 }, { id: 2 }]
      const iterable = createAsyncIterable(items)

      const results: { id: number }[] = []
      for await (const item of iterable) {
        results.push(item)
      }

      expect(results).toEqual([{ id: 1 }, { id: 2 }])
    })

    it('can be iterated multiple times (array source)', async () => {
      const items = [1, 2, 3]
      const iterable = createAsyncIterable(items)

      const results1: number[] = []
      for await (const item of iterable) {
        results1.push(item)
      }

      const results2: number[] = []
      for await (const item of iterable) {
        results2.push(item)
      }

      expect(results1).toEqual([1, 2, 3])
      expect(results2).toEqual([1, 2, 3])
    })
  })

  describe('from generator', () => {
    it('creates async iterable from generator function', async () => {
      async function* generator() {
        yield 1
        yield 2
        yield 3
      }
      const iterable = createAsyncIterable(generator)

      const results: number[] = []
      for await (const item of iterable) {
        results.push(item)
      }

      expect(results).toEqual([1, 2, 3])
    })

    it('handles generator that yields nothing', async () => {
      async function* generator() {
        // yields nothing
      }
      const iterable = createAsyncIterable(generator)

      const results: number[] = []
      for await (const item of iterable) {
        results.push(item)
      }

      expect(results).toEqual([])
    })

    it('handles generator with delays', async () => {
      async function* generator() {
        yield 1
        await new Promise((r) => setTimeout(r, 10))
        yield 2
      }
      const iterable = createAsyncIterable(generator)

      const results: number[] = []
      for await (const item of iterable) {
        results.push(item)
      }

      expect(results).toEqual([1, 2])
    })

    it('propagates generator errors', async () => {
      async function* generator() {
        yield 1
        throw new Error('Generator error')
      }
      const iterable = createAsyncIterable(generator)

      const results: number[] = []
      await expect(async () => {
        for await (const item of iterable) {
          results.push(item)
        }
      }).rejects.toThrow('Generator error')

      expect(results).toEqual([1])
    })
  })
})

// ============================================================================
// createStreamableList Tests
// ============================================================================

describe('createStreamableList', () => {
  describe('promise behavior', () => {
    it('can be awaited to get full array', async () => {
      const getItems = async () => [1, 2, 3]
      const streamable = createStreamableList(getItems)

      const result = await streamable
      expect(result).toEqual([1, 2, 3])
    })

    it('supports .then()', async () => {
      const getItems = async () => [1, 2, 3]
      const streamable = createStreamableList(getItems)

      const result = await streamable.then((items) => items.length)
      expect(result).toBe(3)
    })

    it('supports .catch()', async () => {
      const getItems = async () => {
        throw new Error('Get items error')
      }
      const streamable = createStreamableList<number>(getItems)

      const error = await streamable.catch((e) => e.message)
      expect(error).toBe('Get items error')
    })

    it('supports .finally()', async () => {
      const getItems = async () => [1, 2, 3]
      const finallyFn = vi.fn()
      const streamable = createStreamableList(getItems)

      await streamable.finally(finallyFn)
      expect(finallyFn).toHaveBeenCalled()
    })

    it('has Promise Symbol.toStringTag', () => {
      const getItems = async () => [1, 2, 3]
      const streamable = createStreamableList(getItems)

      expect(Object.prototype.toString.call(streamable)).toBe('[object Promise]')
    })
  })

  describe('async iteration without custom stream', () => {
    it('iterates over resolved items when no streamItems provided', async () => {
      const getItems = async () => [1, 2, 3]
      const streamable = createStreamableList(getItems)

      const results: number[] = []
      for await (const item of streamable) {
        results.push(item)
      }

      expect(results).toEqual([1, 2, 3])
    })

    it('handles empty array', async () => {
      const getItems = async () => [] as number[]
      const streamable = createStreamableList(getItems)

      const results: number[] = []
      for await (const item of streamable) {
        results.push(item)
      }

      expect(results).toEqual([])
    })
  })

  describe('async iteration with custom stream', () => {
    it('uses custom streamItems generator when provided', async () => {
      const getItems = async () => [1, 2, 3]
      async function* streamItems() {
        yield 10
        yield 20
        yield 30
      }
      const streamable = createStreamableList(getItems, streamItems)

      const results: number[] = []
      for await (const item of streamable) {
        results.push(item)
      }

      // Should use the stream, not the array
      expect(results).toEqual([10, 20, 30])
    })

    it('stream can yield different items than getItems returns', async () => {
      // This simulates streaming where you might get incremental items
      const getItems = async () => ['final1', 'final2']
      async function* streamItems() {
        yield 'stream1'
        yield 'stream2'
        yield 'stream3'
      }
      const streamable = createStreamableList(getItems, streamItems)

      // Await gets the promise result
      const awaited = await streamable

      // But iterating uses the stream
      const streamed: string[] = []
      const freshStreamable = createStreamableList(getItems, streamItems)
      for await (const item of freshStreamable) {
        streamed.push(item)
      }

      expect(awaited).toEqual(['final1', 'final2'])
      expect(streamed).toEqual(['stream1', 'stream2', 'stream3'])
    })

    it('handles stream errors separately from promise', async () => {
      const getItems = async () => [1, 2, 3]
      async function* streamItems() {
        yield 1
        throw new Error('Stream error')
      }
      const streamable = createStreamableList(getItems, streamItems)

      // Promise should resolve fine
      const awaited = await streamable
      expect(awaited).toEqual([1, 2, 3])

      // But streaming should error
      const freshStreamable = createStreamableList(getItems, streamItems)
      await expect(async () => {
        for await (const _item of freshStreamable) {
          // iterate
        }
      }).rejects.toThrow('Stream error')
    })
  })

  describe('dual usage patterns', () => {
    it('can await and iterate on same streamable (with default stream)', async () => {
      let callCount = 0
      const getItems = async () => {
        callCount++
        return [1, 2, 3]
      }
      const streamable = createStreamableList(getItems)

      // Await first
      const awaited = await streamable
      expect(awaited).toEqual([1, 2, 3])

      // Then iterate (uses same resolved promise)
      const iterated: number[] = []
      for await (const item of streamable) {
        iterated.push(item)
      }
      expect(iterated).toEqual([1, 2, 3])

      // getItems should only be called once
      expect(callCount).toBe(1)
    })

    it('works with Promise.all', async () => {
      const streamable1 = createStreamableList(async () => [1, 2])
      const streamable2 = createStreamableList(async () => [3, 4])

      const [result1, result2] = await Promise.all([streamable1, streamable2])

      expect(result1).toEqual([1, 2])
      expect(result2).toEqual([3, 4])
    })

    it('works with Promise.race', async () => {
      const slow = createStreamableList(async () => {
        await new Promise((r) => setTimeout(r, 100))
        return ['slow']
      })
      const fast = createStreamableList(async () => ['fast'])

      const result = await Promise.race([slow, fast])
      expect(result).toEqual(['fast'])
    })
  })

  describe('type preservation', () => {
    it('preserves generic type through await', async () => {
      interface Item {
        id: number
        name: string
      }
      const getItems = async (): Promise<Item[]> => [
        { id: 1, name: 'one' },
        { id: 2, name: 'two' },
      ]
      const streamable = createStreamableList(getItems)

      const result = await streamable
      expect(result[0].id).toBe(1)
      expect(result[0].name).toBe('one')
    })

    it('preserves generic type through iteration', async () => {
      interface Item {
        id: number
      }
      const getItems = async (): Promise<Item[]> => [{ id: 1 }, { id: 2 }]
      const streamable = createStreamableList(getItems)

      for await (const item of streamable) {
        expect(typeof item.id).toBe('number')
      }
    })
  })
})

// ============================================================================
// Type Export Tests
// ============================================================================

describe('type exports', () => {
  it('exports FunctionOptions type', () => {
    const opts: FunctionOptions = {
      model: 'claude-opus-4-5',
      thinking: 'high',
      temperature: 0.7,
      maxTokens: 1000,
      system: 'Be helpful',
      mode: 'background',
    }
    expect(opts.model).toBe('claude-opus-4-5')
  })

  it('exports ChainablePromise type', () => {
    // Type check - this should compile
    const _check: ChainablePromise<string> = createChainablePromise(async () => 'test')
    expect(_check).toBeDefined()
  })

  it('exports TemplateFunction type', () => {
    // Type check - this should compile
    const _check: TemplateFunction<string> = createTemplateFunction(async () => 'test')
    expect(_check).toBeDefined()
  })

  it('exports BatchableFunction type', () => {
    const fn = createTemplateFunction(async () => 'test')
    const _check: BatchableFunction<string> = withBatch(fn, async (inputs) =>
      inputs.map(() => 'test')
    )
    expect(_check.batch).toBeDefined()
  })

  it('exports StreamableList type', () => {
    const _check: StreamableList<number> = createStreamableList(async () => [1, 2, 3])
    expect(_check).toBeDefined()
  })
})
