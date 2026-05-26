/**
 * Verification for routing ALL dynamic code execution through ai-evaluate's
 * V8-isolate sandbox (Cloudflare Dynamic Workers, Miniflare fallback in Node).
 *
 * Two distinct paths are exercised:
 *
 *  - Path A — `type: 'code'` is DETERMINISTIC. A `handler` is a direct call; an
 *    inline `code` body runs in the sandbox. NO model is ever consulted. We spy
 *    on the model entry points and assert zero calls, and assert identical
 *    output across repeated calls.
 *
 *  - Path B — `generateAndRunCode` is the NON-deterministic generate → run →
 *    test → return capability. The model AUTHORS the code; we mock that author
 *    step, but the run + test + return plumbing executes against the REAL
 *    Miniflare sandbox (no live Worker, no model).
 *
 * What is mocked: ONLY the model-author step in Path B (`generateObject` from
 * `./generate.js`). The sandbox itself (Miniflare) is real. Path A mocks
 * nothing — it only spies to prove the model is never touched.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Spy targets for Path A: prove no model is consulted on the deterministic path.
import * as generateModule from '../src/generate.js'

describe('Path A — type:code is deterministic (no model, no network)', () => {
  let generateObjectSpy: ReturnType<typeof vi.spyOn>
  let generateTextSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    generateObjectSpy = vi.spyOn(generateModule, 'generateObject')
    generateTextSpy = vi.spyOn(generateModule, 'generateText')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handler functions are a direct call — deterministic, no model', async () => {
    const { defineFunction } = await import('../src/function-registry.js')
    const calculateTax = defineFunction<number, { amount: number; rate: number }>({
      type: 'code',
      name: 'calculateTax',
      args: { amount: 'Amount (number)', rate: 'Rate (number)' },
      handler: ({ amount, rate }) => amount * rate,
    })

    const a = await calculateTax.call({ amount: 100, rate: 0.2 })
    const b = await calculateTax.call({ amount: 100, rate: 0.2 })

    expect(a).toBe(20)
    expect(b).toBe(20) // identical across repeated calls
    expect(generateObjectSpy).not.toHaveBeenCalled()
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it('inline code bodies run in the sandbox — deterministic, no model', async () => {
    const { defineFunction } = await import('../src/function-registry.js')
    const sum = defineFunction<number, { items: number[] }>({
      type: 'code',
      name: 'sum',
      args: { items: ['Numbers'] },
      language: 'typescript',
      code: 'return args.items.reduce((a, b) => a + b, 0)',
    })

    const a = await sum.call({ items: [1, 2, 3, 4] })
    const b = await sum.call({ items: [1, 2, 3, 4] })

    expect(a).toBe(10)
    expect(b).toBe(10) // identical across repeated calls — fully deterministic
    expect(generateObjectSpy).not.toHaveBeenCalled()
    expect(generateTextSpy).not.toHaveBeenCalled()
  })

  it('an inline code body that throws surfaces the sandbox error', async () => {
    const { defineFunction } = await import('../src/function-registry.js')
    // Use an explicit statement body (contains `return`) so the runtime throw
    // is reached rather than being mis-wrapped as a `return (expr)`.
    const boom = defineFunction<number, Record<string, never>>({
      type: 'code',
      name: 'boom',
      args: {},
      language: 'typescript',
      code: "if (true) { throw new Error('kaboom') }\nreturn 0",
    })

    await expect(boom.call({})).rejects.toThrow(/kaboom/)
    expect(generateObjectSpy).not.toHaveBeenCalled()
  })
}, 60000)

// Path B mocks ONLY the model-author step; the run+test runs in real Miniflare.
vi.mock('../src/generate.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/generate.js')>()
  return { ...actual }
})

describe('Path B — generateAndRunCode: generate → run → test → return', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('runs MODEL-AUTHORED code in the real sandbox and returns the computed result', async () => {
    const gen = await import('../src/generate.js')

    // Mock ONLY the model-author step. Everything downstream (run, test,
    // return) executes against the REAL Miniflare sandbox.
    const authoredModule = `export function calculateTax(args) {\n  return args.amount * args.rate;\n}`
    const authoredTests = `describe('calculateTax', () => {\n  it('multiplies amount by rate', () => {\n    expect(calculateTax({ amount: 100, rate: 0.2 })).toBe(20);\n  });\n});`

    const spy = vi.spyOn(gen, 'generateObject').mockResolvedValue({
      object: { code: authoredModule, tests: authoredTests },
    } as Awaited<ReturnType<typeof gen.generateObject>>)

    const { generateAndRunCode } = await import('../src/function-registry.js')

    const result = await generateAndRunCode<number, { amount: number; rate: number }>(
      {
        name: 'calculateTax',
        description: 'Calculate tax owed',
        args: { amount: '(number)', rate: '(number)' },
        returnType: '(number)',
      },
      { amount: 100, rate: 0.2 }
    )

    // The model was consulted exactly once (the author step).
    expect(spy).toHaveBeenCalledTimes(1)

    // The RESULT was actually computed by running the authored code (not just
    // returned as source).
    expect(result.value).toBe(20)
    expect(result.code).toContain('function calculateTax')

    // Tests ran in the same sandbox and passed.
    expect(result.testResults).toBeDefined()
    expect(result.testResults!.failed).toBe(0)
    expect(result.testResults!.passed).toBeGreaterThanOrEqual(1)
  })

  it('surfaces a sandbox failure when authored code throws at runtime', async () => {
    const gen = await import('../src/generate.js')
    vi.spyOn(gen, 'generateObject').mockResolvedValue({
      object: { code: `export function bad(args) { throw new Error('runtime boom'); }` },
    } as Awaited<ReturnType<typeof gen.generateObject>>)

    const { generateAndRunCode } = await import('../src/function-registry.js')

    await expect(
      generateAndRunCode({ name: 'bad', args: { x: '(number)' }, includeTests: false }, { x: 1 })
    ).rejects.toThrow(/runtime boom/)
  })
}, 60000)
