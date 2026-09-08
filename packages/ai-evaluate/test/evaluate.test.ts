import { describe, it, expect, expectTypeOf } from 'vitest'
import { evaluate } from '../src/node.js'
import {
  evaluate as evaluateWithEnv,
  buildWorkerCode,
  loadWorker,
  DEFAULT_ISOLATION,
} from '../src/evaluate.js'
import { workerCodeId } from '../src/shared.js'
import type { WorkerCode, WorkerLoader, WorkerStub } from '../src/types.js'

/**
 * A fake `worker_loaders` binding that records how it was driven. `get()`
 * calls the factory only the first time an id is seen (as the real loader
 * does while an isolate is live); `load()` never consults the cache.
 */
function createFakeLoader() {
  const stubs = new Map<string, WorkerStub>()
  const calls = { get: 0, load: 0, factory: 0 }
  const ids: string[] = []
  const loaded: WorkerCode[] = []

  const stubFor = (pending: WorkerCode | Promise<WorkerCode>): WorkerStub => ({
    getEntrypoint: () => ({
      fetch: async () => {
        const code = await pending
        loaded.push(code)
        return Response.json({
          success: true,
          value: { mainModule: code.mainModule, modules: Object.keys(code.modules).sort() },
          logs: [],
          duration: 0,
        })
      },
    }),
    getDurableObjectClass: () => undefined,
  })

  const loader: WorkerLoader = {
    get(id, factory) {
      calls.get++
      ids.push(id)
      let stub = stubs.get(id)
      if (!stub) {
        calls.factory++
        stub = stubFor(factory())
        stubs.set(id, stub)
      }
      return stub
    },
    load(code) {
      calls.load++
      return stubFor(code)
    },
  }

  return { loader, calls, ids, loaded }
}

describe('evaluate', () => {
  describe('script execution', () => {
    it('executes simple expressions', async () => {
      const result = await evaluate({
        script: 'return 1 + 1',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(2)
    })

    it('captures console output', async () => {
      const result = await evaluate({
        script: `
          console.log('hello');
          console.warn('warning');
          console.error('error');
          return 'done';
        `,
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe('done')
      expect(result.logs).toHaveLength(3)
      expect(result.logs[0].level).toBe('log')
      expect(result.logs[0].message).toBe('hello')
      expect(result.logs[1].level).toBe('warn')
      expect(result.logs[2].level).toBe('error')
    })

    it('handles script errors', async () => {
      const result = await evaluate({
        script: 'throw new Error("test error")',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('test error')
    })
  })

  describe('module exports', () => {
    it('exposes exports to script', async () => {
      const result = await evaluate({
        module: `
          exports.add = (a, b) => a + b;
          exports.multiply = (a, b) => a * b;
        `,
        script: 'return add(2, 3) + multiply(4, 5)',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(25) // 5 + 20
    })

    it('exposes exports to tests', async () => {
      const result = await evaluate({
        module: `
          exports.double = (n) => n * 2;
        `,
        tests: `
          describe('double', () => {
            it('doubles a number', () => {
              expect(double(5)).toBe(10);
            });
          });
        `,
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(1)
      expect(result.testResults?.passed).toBe(1)
    })
  })

  describe('test framework', () => {
    it('runs passing tests', async () => {
      const result = await evaluate({
        tests: `
          describe('math', () => {
            it('adds', () => {
              expect(1 + 1).toBe(2);
            });
            it('subtracts', () => {
              expect(5 - 3).toBe(2);
            });
          });
        `,
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(2)
      expect(result.testResults?.passed).toBe(2)
      expect(result.testResults?.failed).toBe(0)
    })

    it('reports failing tests', async () => {
      const result = await evaluate({
        tests: `
          it('fails', () => {
            expect(1).toBe(2);
          });
        `,
      })
      expect(result.success).toBe(false)
      expect(result.testResults?.total).toBe(1)
      expect(result.testResults?.failed).toBe(1)
      expect(result.testResults?.tests[0].error).toContain('Expected 2')
    })

    it('supports skipped tests', async () => {
      const result = await evaluate({
        tests: `
          it.skip('skipped', () => {
            expect(1).toBe(2);
          });
          it('runs', () => {
            expect(1).toBe(1);
          });
        `,
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(2)
      expect(result.testResults?.passed).toBe(1)
      expect(result.testResults?.skipped).toBe(1)
    })

    it('supports beforeEach hooks', async () => {
      const result = await evaluate({
        tests: `
          let count = 0;
          beforeEach(() => {
            count++;
          });
          it('first', () => {
            expect(count).toBe(1);
          });
          it('second', () => {
            expect(count).toBe(2);
          });
        `,
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.passed).toBe(2)
    })

    it('supports async tests', async () => {
      const result = await evaluate({
        tests: `
          it('async test', async () => {
            const value = await Promise.resolve(42);
            expect(value).toBe(42);
          });
        `,
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.passed).toBe(1)
    })
  })

  describe('expect matchers', () => {
    it('toBe', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect(1).toBe(1);
            expect('a').toBe('a');
          });
        `,
      })
      expect(result.success).toBe(true)
    })

    it('toEqual', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect({ a: 1 }).toEqual({ a: 1 });
            expect([1, 2]).toEqual([1, 2]);
          });
        `,
      })
      expect(result.success).toBe(true)
    })

    it('toContain', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect([1, 2, 3]).toContain(2);
            expect('hello').toContain('ell');
          });
        `,
      })
      expect(result.success).toBe(true)
    })

    it('toThrow', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect(() => { throw new Error('boom'); }).toThrow('boom');
            expect(() => { throw new Error('boom'); }).toThrow(/boom/);
          });
        `,
      })
      expect(result.success).toBe(true)
    })

    it('toHaveProperty', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect({ a: { b: 1 } }).toHaveProperty('a.b');
            expect({ a: { b: 1 } }).toHaveProperty('a.b', 1);
          });
        `,
      })
      expect(result.success).toBe(true)
    })

    it('toMatchObject', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect({ a: 1, b: 2 }).toMatchObject({ a: 1 });
          });
        `,
      })
      expect(result.success).toBe(true)
    })

    it('not matchers', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect(1).not.toBe(2);
            expect({ a: 1 }).not.toEqual({ a: 2 });
            expect([1, 2]).not.toContain(3);
          });
        `,
      })
      expect(result.success).toBe(true)
    })

    it('toBeCloseTo', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect(0.1 + 0.2).toBeCloseTo(0.3);
          });
        `,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('isolation (fake loader)', () => {
    it('type: WorkerLoader exposes both get() and load()', () => {
      expectTypeOf<WorkerLoader>().toHaveProperty('get')
      expectTypeOf<WorkerLoader>().toHaveProperty('load')
      expectTypeOf<WorkerLoader['load']>().parameter(0).toEqualTypeOf<WorkerCode>()
      expectTypeOf<WorkerLoader['get']>().parameter(0).toEqualTypeOf<string>()
    })

    it("defaults to 'cached'", () => {
      expect(DEFAULT_ISOLATION).toBe('cached')
    })

    it('cached: two identical calls share one isolate (factory invoked once)', async () => {
      const fake = createFakeLoader()
      const options = { script: 'return 1', isolation: 'cached' as const }
      const first = await evaluateWithEnv(options, { loader: fake.loader })
      const second = await evaluateWithEnv(options, { loader: fake.loader })
      expect(first.success).toBe(true)
      expect(second.success).toBe(true)
      expect(fake.calls.get).toBe(2)
      expect(fake.calls.factory).toBe(1)
      expect(fake.calls.load).toBe(0)
      expect(fake.ids[0]).toBe(fake.ids[1])
    })

    it('default (no isolation given) behaves as cached', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1' }, { loader: fake.loader })
      await evaluateWithEnv({ script: 'return 1' }, { loader: fake.loader })
      expect(fake.calls.get).toBe(2)
      expect(fake.calls.factory).toBe(1)
      expect(fake.calls.load).toBe(0)
    })

    it('cached: the id is workerCodeId of the spec handed to the factory', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1' }, { loader: fake.loader })
      expect(fake.ids[0]).toBe(workerCodeId(fake.loaded[0]!))
    })

    it('cached: different scripts get different isolates', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1' }, { loader: fake.loader })
      await evaluateWithEnv({ script: 'return 2' }, { loader: fake.loader })
      expect(fake.calls.factory).toBe(2)
      expect(fake.ids[0]).not.toBe(fake.ids[1])
    })

    it('fresh: calls load(code) every time and never get()', async () => {
      const fake = createFakeLoader()
      const options = { script: 'return 1', isolation: 'fresh' as const }
      const first = await evaluateWithEnv(options, { loader: fake.loader })
      const second = await evaluateWithEnv(options, { loader: fake.loader })
      expect(first.success).toBe(true)
      expect(second.success).toBe(true)
      expect(fake.calls.load).toBe(2)
      expect(fake.calls.get).toBe(0)
      expect(fake.calls.factory).toBe(0)
      expect(fake.loaded[0]?.mainModule).toBe('worker.js')
      expect(fake.loaded[0]?.modules['worker.js']).toContain('return 1')
    })

    it('fresh and cached hand the loader the same spec', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1', isolation: 'fresh' }, { loader: fake.loader })
      await evaluateWithEnv({ script: 'return 1', isolation: 'cached' }, { loader: fake.loader })
      expect(workerCodeId(fake.loaded[0]!)).toBe(workerCodeId(fake.loaded[1]!))
      expect(fake.ids[0]).toBe(workerCodeId(fake.loaded[0]!))
    })

    it('honours the legacy uppercase LOADER binding', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1', isolation: 'fresh' }, { LOADER: fake.loader })
      expect(fake.calls.load).toBe(1)
    })

    it('reports a loader failure as an error result', async () => {
      const loader: WorkerLoader = {
        get: () => {
          throw new Error('get exploded')
        },
        load: () => {
          throw new Error('load exploded')
        },
      }
      const cached = await evaluateWithEnv({ script: 'return 1' }, { loader })
      expect(cached.success).toBe(false)
      expect(cached.error).toContain('get exploded')
      const fresh = await evaluateWithEnv({ script: 'return 1', isolation: 'fresh' }, { loader })
      expect(fresh.success).toBe(false)
      expect(fresh.error).toContain('load exploded')
    })
  })

  describe('buildWorkerCode', () => {
    it('simple path: one worker.js module, compatibility date, no env', async () => {
      const code = await buildWorkerCode({ script: 'return 1' })
      expect(code.mainModule).toBe('worker.js')
      expect(Object.keys(code.modules)).toEqual(['worker.js'])
      expect(code.compatibilityDate).toBeTruthy()
      expect(code.env).toBeUndefined()
      expect(code.globalOutbound).toBeUndefined()
    })

    it('full path: bundles capnweb and passes TEST through as env only when present', async () => {
      const embedded = await buildWorkerCode({ tests: 'it("x", () => {})' })
      expect(Object.keys(embedded.modules).sort()).toEqual(['capnweb.js', 'worker.js'])
      expect(embedded.env).toEqual({})

      const testService = { connect: async () => ({}) }
      const rpc = await buildWorkerCode({ tests: 'it("x", () => {})' }, testService)
      expect(rpc.env).toEqual({ TEST: testService })
    })

    it('fetch: false / null block outbound at the runtime level', async () => {
      expect((await buildWorkerCode({ script: '1', fetch: false })).globalOutbound).toBeNull()
      expect((await buildWorkerCode({ script: '1', fetch: null })).globalOutbound).toBeNull()
      expect((await buildWorkerCode({ script: '1', fetch: true })).globalOutbound).toBeUndefined()
      expect(
        (await buildWorkerCode({ script: '1', fetch: ['a.com'] })).globalOutbound
      ).toBeUndefined()
    })

    it('is content-addressed: identical options hash to the same id', async () => {
      const a = await buildWorkerCode({ script: 'return 1', module: 'exports.x = 1' })
      const b = await buildWorkerCode({ module: 'exports.x = 1', script: 'return 1' })
      expect(workerCodeId(a)).toBe(workerCodeId(b))
    })
  })

  describe('loadWorker', () => {
    const code: WorkerCode = { mainModule: 'w.js', modules: { 'w.js': '' } }

    it('defaults to cached (get)', () => {
      const fake = createFakeLoader()
      loadWorker(fake.loader, code)
      expect(fake.calls.get).toBe(1)
      expect(fake.calls.load).toBe(0)
      expect(fake.ids[0]).toBe(workerCodeId(code))
    })

    it('fresh uses load', () => {
      const fake = createFakeLoader()
      loadWorker(fake.loader, code, 'fresh')
      expect(fake.calls.get).toBe(0)
      expect(fake.calls.load).toBe(1)
    })
  })

  describe('isolation (real local workerd)', () => {
    it("'fresh' evaluates end-to-end", async () => {
      const result = await evaluate({ script: 'return "fresh"', isolation: 'fresh' })
      expect(result.success).toBe(true)
      expect(result.value).toBe('fresh')
    })

    it("'cached' reuses the isolate; 'fresh' never does (module-level state witness)", async () => {
      const script = 'globalThis.__n = (globalThis.__n ?? 0) + 1; return globalThis.__n'
      const cached1 = await evaluate({ script, isolation: 'cached' })
      const cached2 = await evaluate({ script, isolation: 'cached' })
      expect(cached1.value).toBe(1)
      expect(cached2.value).toBe(2)

      const fresh1 = await evaluate({ script, isolation: 'fresh' })
      const fresh2 = await evaluate({ script, isolation: 'fresh' })
      expect(fresh1.value).toBe(1)
      expect(fresh2.value).toBe(1)
    })
  })
})
