import { describe, it, expect } from 'vitest'
import { DO } from '../src/do'

describe('Code functions', () => {
  it('detects function as code function', () => {
    const Math = DO({
      $type: 'Math',
      double: (n: number) => n * 2,
    })

    expect(Math.functions).toHaveProperty('double')
    expect(typeof Math.functions.double).toBe('function')
  })

  it('executes code function via call()', async () => {
    const Math = DO({
      $type: 'Math',
      double: (n: number) => n * 2,
      add: (a: number, b: number) => a + b,
    })

    expect(await Math.call('double', 5)).toBe(10)
    expect(await Math.call('add', 2, 3)).toBe(5)
  })

  it('throws for unknown function', async () => {
    const Math = DO({ $type: 'Math' })
    await expect(Math.call('unknown')).rejects.toThrow("Function 'unknown' not found")
  })
})

describe('Generative functions (string shorthand)', () => {
  it('detects string with template vars as generative', () => {
    const Startup = DO({
      $type: 'Startup',
      name: 'Company name', // field (no vars)
      pitch: 'Generate pitch for {name}', // generative (has vars)
    })

    // pitch should be in functions, not fields
    expect(Startup.functions).toHaveProperty('pitch')
    expect(Startup.fields).not.toHaveProperty('pitch')

    // name should be in fields
    expect(Startup.fields).toHaveProperty('name')
    expect(Startup.functions).not.toHaveProperty('name')
  })

  it('extracts template variables', () => {
    const Writer = DO({
      $type: 'Writer',
      summarize: 'Summarize {text} in {style} style',
    })

    const fn = Writer.functions.summarize as { mdx: string }
    expect(fn.mdx).toBe('Summarize {text} in {style} style')
  })

  it('returns generation stub from call()', async () => {
    const Startup = DO({
      $type: 'Startup',
      pitch: 'Generate pitch for {name}',
    })

    const result = await Startup.call('pitch', { name: 'Acme' })
    expect(result).toMatchObject({
      _generate: true,
      mdx: 'Generate pitch for {name}',
    })
  })
})

describe('Generative functions (explicit)', () => {
  it('detects object with mdx property', () => {
    const Analyzer = DO({
      $type: 'Analyzer',
      score: {
        mdx: 'Rate {text} for quality',
        schema: { score: 'Quality score (number)' },
        model: 'reasoning',
      },
    })

    expect(Analyzer.functions).toHaveProperty('score')
    const fn = Analyzer.functions.score as { mdx: string; schema: object; model: string }
    expect(fn.mdx).toBe('Rate {text} for quality')
    expect(fn.schema).toEqual({ score: 'Quality score (number)' })
    expect(fn.model).toBe('reasoning')
  })
})

describe('Function serialization', () => {
  it('serializes code functions to string', () => {
    const Math = DO({
      $type: 'Math',
      double: (n: number) => n * 2,
    })

    const json = Math.toJSON()
    expect(typeof json.double).toBe('string')
    expect(json.double).toContain('n * 2')
  })

  it('preserves generative function in JSON', () => {
    const Writer = DO({
      $type: 'Writer',
      summarize: 'Summarize {text}',
    })

    const json = Writer.toJSON()
    // String generative should stay as string or become { mdx: ... }
    expect(json.summarize).toBeDefined()
  })
})
