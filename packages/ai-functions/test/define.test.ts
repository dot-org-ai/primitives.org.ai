/**
 * Tests for define and function registry
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { define, defineFunction, functions } from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe('functions registry', () => {
  beforeEach(() => {
    functions.clear()
  })

  it('starts empty', () => {
    expect(functions.list()).toEqual([])
  })

  it('tracks defined functions', () => {
    const fn = defineFunction({
      type: 'generative',
      name: 'testFunc',
      args: { input: 'Input text' },
      output: 'string',
    })
    functions.set('testFunc', fn)

    expect(functions.has('testFunc')).toBe(true)
    expect(functions.list()).toContain('testFunc')
  })

  it('retrieves defined functions', () => {
    const fn = defineFunction({
      type: 'generative',
      name: 'testFunc',
      args: { input: 'Input text' },
      output: 'string',
    })
    functions.set('testFunc', fn)

    const retrieved = functions.get('testFunc')
    expect(retrieved).toBeDefined()
    expect(retrieved?.definition.name).toBe('testFunc')
  })

  it('deletes functions', () => {
    const fn = defineFunction({
      type: 'generative',
      name: 'testFunc',
      args: { input: 'Input text' },
      output: 'string',
    })
    functions.set('testFunc', fn)

    expect(functions.delete('testFunc')).toBe(true)
    expect(functions.has('testFunc')).toBe(false)
  })

  it('clears all functions', () => {
    const fn1 = defineFunction({
      type: 'generative',
      name: 'func1',
      args: {},
      output: 'string',
    })
    const fn2 = defineFunction({
      type: 'generative',
      name: 'func2',
      args: {},
      output: 'string',
    })
    functions.set('func1', fn1)
    functions.set('func2', fn2)

    functions.clear()
    expect(functions.list()).toEqual([])
  })
})

describe('defineFunction', () => {
  beforeEach(() => {
    functions.clear()
  })

  it('creates a generative function definition', () => {
    const fn = defineFunction({
      type: 'generative',
      name: 'summarize',
      args: { text: 'Text to summarize' },
      output: 'string',
      system: 'You are a summarizer.',
    })

    expect(fn.definition.type).toBe('generative')
    expect(fn.definition.name).toBe('summarize')
    expect(typeof fn.call).toBe('function')
    expect(typeof fn.asTool).toBe('function')
  })

  it('creates an agentic function definition', () => {
    const fn = defineFunction({
      type: 'agentic',
      name: 'research',
      args: { topic: 'Research topic' },
      instructions: 'Research the topic thoroughly.',
      maxIterations: 5,
    })

    expect(fn.definition.type).toBe('agentic')
    expect(fn.definition.name).toBe('research')
  })

  it('creates a human function definition', () => {
    const fn = defineFunction({
      type: 'human',
      name: 'approve',
      args: { amount: 'Amount (number)' },
      channel: 'workspace',
      instructions: 'Review and approve.',
    })

    expect(fn.definition.type).toBe('human')
    expect((fn.definition as { channel: string }).channel).toBe('workspace')
  })

  it('creates a code function definition', () => {
    const fn = defineFunction({
      type: 'code',
      name: 'implement',
      args: { spec: 'Function specification' },
      language: 'typescript',
    })

    expect(fn.definition.type).toBe('code')
    expect((fn.definition as { language: string }).language).toBe('typescript')
  })

  it('generates asTool with correct parameters', () => {
    const fn = defineFunction({
      type: 'generative',
      name: 'translate',
      description: 'Translate text to another language',
      args: {
        text: 'Text to translate',
        targetLang: 'Target language',
      },
      output: 'string',
    })

    const tool = fn.asTool()
    expect(tool.name).toBe('translate')
    expect(tool.description).toBe('Translate text to another language')
    expect(tool.parameters.type).toBe('object')
    expect(tool.parameters.properties).toHaveProperty('text')
    expect(tool.parameters.properties).toHaveProperty('targetLang')
    expect(tool.parameters.required).toContain('text')
    expect(tool.parameters.required).toContain('targetLang')
  })
})

describe('define helpers', () => {
  beforeEach(() => {
    functions.clear()
  })

  it('define.generative registers function', () => {
    const fn = define.generative({
      name: 'greet',
      args: { name: 'Name to greet' },
      output: 'string',
    })

    expect(functions.has('greet')).toBe(true)
    expect(fn.definition.type).toBe('generative')
  })

  it('define.agentic registers function', () => {
    const fn = define.agentic({
      name: 'analyze',
      args: { data: 'Data to analyze' },
      instructions: 'Analyze the data.',
    })

    expect(functions.has('analyze')).toBe(true)
    expect(fn.definition.type).toBe('agentic')
  })

  it('define.human registers function', () => {
    const fn = define.human({
      name: 'review',
      args: { content: 'Content to review' },
      channel: 'web',
      instructions: 'Review the content.',
    })

    expect(functions.has('review')).toBe(true)
    expect(fn.definition.type).toBe('human')
  })

  it('define.code registers function', () => {
    const fn = define.code({
      name: 'generate',
      args: { prompt: 'Code generation prompt' },
      language: 'python',
    })

    expect(functions.has('generate')).toBe(true)
    expect(fn.definition.type).toBe('code')
  })
})

describe.skipIf(!hasGateway)('generative function execution', () => {
  beforeEach(() => {
    functions.clear()
  })

  it('executes a generative string function', async () => {
    const greet = define.generative({
      name: 'greet',
      args: { name: 'Name to greet' },
      output: 'string',
      promptTemplate: 'Say hello to {{name}}',
    })

    const result = await greet.call({ name: 'World' })
    expect(typeof result).toBe('string')
    expect((result as string).toLowerCase()).toContain('hello')
  })

  it('executes a generative object function', async () => {
    const analyze = define.generative({
      name: 'analyze',
      args: { text: 'Text to analyze' },
      output: 'object',
      returnType: {
        sentiment: 'positive | negative | neutral',
        confidence: 'Confidence 0-1 (number)',
      },
      promptTemplate: 'Analyze the sentiment of: {{text}}',
    })

    const result = await analyze.call({ text: 'I love this!' }) as { sentiment: string; confidence: number }
    expect(result).toBeDefined()
    expect(['positive', 'negative', 'neutral']).toContain(result.sentiment)
    expect(typeof result.confidence).toBe('number')
  })
})

describe.skipIf(!hasGateway)('auto-define', () => {
  beforeEach(() => {
    functions.clear()
  })

  it('auto-defines a function from name and args', async () => {
    const fn = await define('translateText', {
      text: 'Hello',
      targetLanguage: 'French',
    })

    expect(fn).toBeDefined()
    expect(fn.definition.name).toBe('translateText')
    expect(functions.has('translateText')).toBe(true)
  })

  it('returns cached function on second call', async () => {
    const fn1 = await define('greetUser', { name: 'Alice' })
    const fn2 = await define('greetUser', { name: 'Bob' })

    expect(fn1).toBe(fn2)
  })
})
