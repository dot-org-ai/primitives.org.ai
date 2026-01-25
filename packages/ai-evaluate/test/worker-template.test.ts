import { describe, it, expect } from 'vitest'
import { generateWorkerCode, generateDevWorkerCode } from '../src/worker-template/index.js'

describe('generateWorkerCode (production)', () => {
  describe('basic structure', () => {
    it('generates valid worker code', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('export default')
      expect(code).toContain('async fetch(request, env)')
    })

    it('includes console capture', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('captureConsole')
      expect(code).toContain('console.log = captureConsole')
      expect(code).toContain('console.warn = captureConsole')
      expect(code).toContain('console.error = captureConsole')
    })

    it('checks for TEST service binding', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('env.TEST')
      expect(code).toContain('TEST service binding not available')
    })
  })

  describe('module embedding', () => {
    it('embeds module code when provided', () => {
      const code = generateWorkerCode({
        module: 'exports.foo = 42;',
      })
      expect(code).toContain('exports.foo = 42;')
    })

    it('extracts export names from exports.name pattern', () => {
      const code = generateWorkerCode({
        module: 'exports.add = (a, b) => a + b; exports.sub = (a, b) => a - b;',
      })
      expect(code).toContain('const { add, sub } = exports')
    })

    it('extracts export names from exports["name"] pattern', () => {
      const code = generateWorkerCode({
        module: 'exports["myFunc"] = () => {};',
      })
      expect(code).toContain('myFunc')
    })

    it('handles no module code', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('// No module code provided')
    })
  })

  describe('test embedding', () => {
    it('embeds test code when provided', () => {
      const code = generateWorkerCode({
        tests: 'describe("test", () => {});',
      })
      expect(code).toContain('describe("test", () => {});')
    })

    it('handles no test code', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('// No test code provided')
    })
  })

  describe('script embedding', () => {
    it('embeds script code when provided', () => {
      const code = generateWorkerCode({
        script: 'return 42;',
      })
      expect(code).toContain('return 42;')
    })

    it('handles no script code', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('// No script code provided')
    })
  })

  describe('RPC setup', () => {
    it('connects to test service via RPC', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('env.TEST.connect()')
      expect(code).toContain('const testService = await env.TEST.connect()')
    })

    it('sets up test functions from RPC service', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('const describe = (name, fn) => testService.describe(name, fn)')
      expect(code).toContain('const it = (name, fn) => testService.it(name, fn)')
      expect(code).toContain(
        'const expect = (value, message) => testService.expect(value, message)'
      )
    })

    it('includes skip and only modifiers', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('it.skip')
      expect(code).toContain('it.only')
      expect(code).toContain('test.skip')
      expect(code).toContain('test.only')
    })
  })

  describe('capnweb RPC', () => {
    it('imports capnweb', () => {
      const code = generateWorkerCode({})
      expect(code).toContain("import { RpcTarget, newWorkersRpcResponse } from 'capnweb.js'")
    })

    it('creates ExportsRpcTarget class', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('class ExportsRpcTarget extends RpcTarget')
    })

    it('handles /rpc route', () => {
      const code = generateWorkerCode({})
      expect(code).toContain("url.pathname === '/rpc'")
      expect(code).toContain('newWorkersRpcResponse(request, new ExportsRpcTarget())')
    })

    it('handles GET / route for info', () => {
      const code = generateWorkerCode({})
      expect(code).toContain("url.pathname === '/'")
      expect(code).toContain('exports: Object.keys(exports)')
    })
  })

  describe('GET /:name endpoint', () => {
    it('handles GET requests to export names', () => {
      const code = generateWorkerCode({})
      expect(code).toContain("request.method === 'GET'")
      expect(code).toContain('url.pathname.slice(1)')
      expect(code).toContain('exports[name]')
    })

    it('returns non-function exports directly', () => {
      const code = generateWorkerCode({})
      expect(code).toContain("typeof value !== 'function'")
      expect(code).toContain('return Response.json({ result: value })')
    })

    it('supports args query parameter with JSON array', () => {
      const code = generateWorkerCode({})
      expect(code).toContain("url.searchParams.get('args')")
      expect(code).toContain('JSON.parse(argsParam)')
    })

    it('supports named query parameters as object', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('Object.fromEntries(url.searchParams.entries())')
    })

    it('returns 404 for missing exports', () => {
      const code = generateWorkerCode({})
      expect(code).toContain('not found')
      expect(code).toContain('status: 404')
    })
  })

  describe('ES module syntax support', () => {
    it('transforms export const to CommonJS', () => {
      const code = generateWorkerCode({
        module: 'export const add = (a, b) => a + b',
      })
      expect(code).toContain('const add = exports.add =')
      expect(code).toContain('const { add } = exports')
    })

    it('transforms export function to CommonJS', () => {
      const code = generateWorkerCode({
        module: 'export function multiply(a, b) { return a * b }',
      })
      expect(code).toContain('function multiply')
      expect(code).toContain('exports.multiply = multiply')
      expect(code).toContain('const { multiply } = exports')
    })

    it('handles mixed ES and CommonJS exports', () => {
      const code = generateWorkerCode({
        module: `
          export const foo = 1
          exports.bar = 2
        `,
      })
      expect(code).toContain('const foo = exports.foo =')
      expect(code).toContain('exports.bar = 2')
      expect(code).toContain('foo')
      expect(code).toContain('bar')
    })
  })

  describe('script auto-return', () => {
    it('auto-returns single expressions', () => {
      const code = generateWorkerCode({
        script: 'add(1, 2)',
      })
      expect(code).toContain('return add(1, 2)')
    })

    it('does not modify scripts with return', () => {
      const code = generateWorkerCode({
        script: 'return add(1, 2)',
      })
      expect(code).toContain('return add(1, 2)')
      expect(code).not.toContain('return return')
    })

    it('does not modify throw statements', () => {
      const code = generateWorkerCode({
        script: 'throw new Error("test")',
      })
      expect(code).toContain('throw new Error("test")')
      expect(code).not.toContain('return throw')
    })

    it('auto-returns last expression in multi-line scripts', () => {
      const code = generateWorkerCode({
        script: `
          const x = 1
          x + 1
        `,
      })
      expect(code).toContain('return x + 1')
    })
  })
})

describe('generateDevWorkerCode (development)', () => {
  describe('basic structure', () => {
    it('generates valid worker code', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('export default')
      expect(code).toContain('async fetch(request, env)')
    })

    it('includes embedded test framework', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('const describe = (name, fn)')
      expect(code).toContain('const it = (name, fn)')
      expect(code).toContain('const expect = (actual)')
    })

    it('does not require TEST service', () => {
      const code = generateDevWorkerCode({})
      expect(code).not.toContain('env.TEST')
    })
  })

  describe('embedded test framework', () => {
    it('includes describe function', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('const describe = (name, fn)')
      expect(code).toContain('currentDescribe')
    })

    it('includes it/test functions', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('const it = (name, fn)')
      expect(code).toContain('const test = it')
    })

    it('includes skip and only', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('it.skip')
      expect(code).toContain('it.only')
    })

    it('includes beforeEach/afterEach hooks', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('const beforeEach = (fn)')
      expect(code).toContain('const afterEach = (fn)')
    })

    it('includes deep equality check', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('const deepEqual = (a, b)')
    })
  })

  describe('embedded expect matchers', () => {
    it('includes toBe', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBe:')
    })

    it('includes toEqual', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toEqual:')
    })

    it('includes toStrictEqual', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toStrictEqual:')
    })

    it('includes toBeTruthy', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeTruthy:')
    })

    it('includes toBeFalsy', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeFalsy:')
    })

    it('includes toBeNull', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeNull:')
    })

    it('includes toBeUndefined', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeUndefined:')
    })

    it('includes toBeDefined', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeDefined:')
    })

    it('includes toBeNaN', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeNaN:')
    })

    it('includes toContain', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toContain:')
    })

    it('includes toContainEqual', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toContainEqual:')
    })

    it('includes toHaveLength', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toHaveLength:')
    })

    it('includes toHaveProperty', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toHaveProperty:')
    })

    it('includes toMatchObject', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toMatchObject:')
    })

    it('includes toThrow', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toThrow:')
    })

    it('includes toBeGreaterThan', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeGreaterThan:')
    })

    it('includes toBeLessThan', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeLessThan:')
    })

    it('includes toBeCloseTo', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeCloseTo:')
    })

    it('includes toMatch', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toMatch:')
    })

    it('includes toBeInstanceOf', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeInstanceOf:')
    })

    it('includes toBeTypeOf', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('toBeTypeOf:')
    })

    it('includes not matchers', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('matchers.not = {')
    })

    it('includes resolves proxy', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('matchers.resolves')
    })

    it('includes rejects proxy', () => {
      const code = generateDevWorkerCode({})
      expect(code).toContain('matchers.rejects')
    })
  })

  describe('module embedding', () => {
    it('embeds module code when provided', () => {
      const code = generateDevWorkerCode({
        module: 'exports.foo = 42;',
      })
      expect(code).toContain('exports.foo = 42;')
    })
  })

  describe('test embedding', () => {
    it('embeds test code when provided', () => {
      const code = generateDevWorkerCode({
        tests: 'describe("test", () => {});',
      })
      expect(code).toContain('describe("test", () => {});')
    })
  })

  describe('script embedding', () => {
    it('embeds script code when provided', () => {
      const code = generateDevWorkerCode({
        script: 'return 42;',
      })
      expect(code).toContain('return 42;')
    })
  })
})
