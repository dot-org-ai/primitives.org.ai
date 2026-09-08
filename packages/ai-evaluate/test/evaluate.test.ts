import { describe, it, expect, expectTypeOf } from 'vitest'
import { evaluate } from '../src/node.js'
import {
  evaluate as evaluateWithEnv,
  buildWorkerCode,
  loadWorker,
  entrypointLimits,
  DEFAULT_ISOLATION,
  DEFAULT_TIMEOUT,
} from '../src/evaluate.js'
import { COMPATIBILITY_DATE, workerCodeId } from '../src/shared.js'
import { OUTBOUND_GATEWAY_UNAVAILABLE_ERROR } from '../src/outbound.js'
import { ValidationError } from '../src/validation.js'
import type { WorkerCode, WorkerEntrypointOptions, WorkerLoader, WorkerStub } from '../src/types.js'

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
  /** `getEntrypoint()` options, one per evaluation */
  const entrypoints: (WorkerEntrypointOptions | undefined)[] = []

  const stubFor = (pending: WorkerCode | Promise<WorkerCode>): WorkerStub => ({
    getEntrypoint: (_name, options) => {
      entrypoints.push(options)
      return {
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
      }
    },
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

  return { loader, calls, ids, loaded, entrypoints }
}

/**
 * A fake loader whose worker answers with whatever `body` is - for the
 * response-shape check `evaluate()` runs on what comes back.
 */
function createRespondingLoader(body: unknown): WorkerLoader {
  const stub: WorkerStub = {
    getEntrypoint: () => ({ fetch: async () => Response.json(body) }),
    getDurableObjectClass: () => undefined,
  }
  return { get: () => stub, load: () => stub }
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

    it("defaults to 'fresh'", () => {
      expect(DEFAULT_ISOLATION).toBe('fresh')
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

    it('default (no isolation given) behaves as fresh: load() every call, never get()', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1' }, { loader: fake.loader })
      await evaluateWithEnv({ script: 'return 1' }, { loader: fake.loader })
      expect(fake.calls.load).toBe(2)
      expect(fake.calls.get).toBe(0)
      expect(fake.calls.factory).toBe(0)
    })

    it('cached: the id is workerCodeId of the spec handed to the factory', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1', isolation: 'cached' }, { loader: fake.loader })
      expect(fake.ids[0]).toBe(workerCodeId(fake.loaded[0]!))
    })

    it('cached: different scripts get different isolates', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1', isolation: 'cached' }, { loader: fake.loader })
      await evaluateWithEnv({ script: 'return 2', isolation: 'cached' }, { loader: fake.loader })
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

    it('no longer honours the uppercase LOADER alias (3.0: `loader` only)', async () => {
      const fake = createFakeLoader()
      const result = await evaluateWithEnv({ script: 'return 1', isolation: 'fresh' }, {
        LOADER: fake.loader,
      } as unknown as Parameters<typeof evaluateWithEnv>[1])
      expect(result.success).toBe(false)
      expect(result.error).toContain('worker_loaders')
      expect(fake.calls.load).toBe(0)
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
      const cached = await evaluateWithEnv({ script: 'return 1', isolation: 'cached' }, { loader })
      expect(cached.success).toBe(false)
      expect(cached.error).toContain('get exploded')
      const fresh = await evaluateWithEnv({ script: 'return 1' }, { loader })
      expect(fresh.success).toBe(false)
      expect(fresh.error).toContain('load exploded')
    })
  })

  describe('buildWorkerCode', () => {
    it('simple path: one worker.js module, compatibility date, empty env', async () => {
      const code = await buildWorkerCode({ script: 'return 1' })
      expect(code.mainModule).toBe('worker.js')
      expect(Object.keys(code.modules)).toEqual(['worker.js'])
      expect(code.compatibilityDate).toBeTruthy()
      expect(code.env).toEqual({})
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
    })

    it('an allowlist or outboundRpc fails closed where the host has no OutboundGateway', async () => {
      // Node has no `cloudflare:workers` loopback bindings, so the gateway the
      // policy needs cannot be bound; the build refuses rather than loading a
      // worker whose fetch would be unrestricted.
      await expect(buildWorkerCode({ script: '1', fetch: ['a.com'] })).rejects.toThrow(
        OUTBOUND_GATEWAY_UNAVAILABLE_ERROR
      )
      await expect(buildWorkerCode({ script: '1', outboundRpc: () => null })).rejects.toThrow(
        OUTBOUND_GATEWAY_UNAVAILABLE_ERROR
      )
      // ... and evaluate() reports it as an error result, before any load
      const loader: WorkerLoader = {
        get: () => {
          throw new Error('loader must not be reached')
        },
        load: () => {
          throw new Error('loader must not be reached')
        },
      }
      const result = await evaluateWithEnv({ script: 'return 1', fetch: ['a.com'] }, { loader })
      expect(result.success).toBe(false)
      expect(result.error).toBe(OUTBOUND_GATEWAY_UNAVAILABLE_ERROR)
    })

    it('is content-addressed: identical options hash to the same id', async () => {
      const a = await buildWorkerCode({ script: 'return 1', module: 'exports.x = 1' })
      const b = await buildWorkerCode({ module: 'exports.x = 1', script: 'return 1' })
      expect(workerCodeId(a)).toBe(workerCodeId(b))
    })
  })

  // aip-263g.5: limits, tails, compatibility flags and date reach the loader
  // through the spec; the timeout-derived CPU budget reaches the entrypoint.
  describe('limits, tails, compatibility (fake loader)', () => {
    const tail = { fetch: async () => new Response('tail') }

    it('explicit limits are handed to the loader on the spec', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv(
        { script: 'return 1', limits: { cpuMs: 50, subrequests: 2 }, isolation: 'cached' },
        { loader: fake.loader }
      )
      expect(fake.loaded[0]?.limits).toEqual({ cpuMs: 50, subrequests: 2 })
    })

    it('no limits: the spec carries none, and the entrypoint CPU budget is the timeout', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1', timeout: 200 }, { loader: fake.loader })
      expect(fake.loaded[0]?.limits).toBeUndefined()
      expect(fake.entrypoints[0]?.limits).toEqual({ cpuMs: 200 })
    })

    it('no limits and no timeout: the entrypoint CPU budget is DEFAULT_TIMEOUT', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1' }, { loader: fake.loader })
      expect(fake.entrypoints[0]?.limits).toEqual({ cpuMs: DEFAULT_TIMEOUT })
    })

    it('an explicit limits.cpuMs wins over the timeout on the entrypoint', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv(
        { script: 'return 1', timeout: 200, limits: { cpuMs: 50 } },
        { loader: fake.loader }
      )
      expect(fake.entrypoints[0]?.limits).toEqual({ cpuMs: 50 })
      expect(fake.loaded[0]?.limits).toEqual({ cpuMs: 50 })
    })

    it('entrypointLimits maps timeout -> cpuMs only when limits.cpuMs is unset', () => {
      expect(entrypointLimits({ script: '1' }, 200)).toEqual({ cpuMs: 200 })
      expect(entrypointLimits({ script: '1', limits: { subrequests: 2 } }, 200)).toEqual({
        cpuMs: 200,
      })
      expect(entrypointLimits({ script: '1', limits: { cpuMs: 50 } }, 200)).toEqual({ cpuMs: 50 })
    })

    it('limits are part of the content-addressed id; the timeout is not', async () => {
      const plain = await buildWorkerCode({ script: 'return 1' })
      const slow = await buildWorkerCode({ script: 'return 1', timeout: 30000 })
      const capped = await buildWorkerCode({ script: 'return 1', limits: { cpuMs: 50 } })
      expect(workerCodeId(plain)).toBe(workerCodeId(slow))
      expect(workerCodeId(plain)).not.toBe(workerCodeId(capped))
    })

    it('compatibilityFlags and compatibilityDate appear in the spec as given', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv(
        {
          script: 'return 1',
          compatibilityFlags: ['nodejs_compat'],
          compatibilityDate: '2026-06-01',
        },
        { loader: fake.loader }
      )
      expect(fake.loaded[0]?.compatibilityFlags).toEqual(['nodejs_compat'])
      expect(fake.loaded[0]?.compatibilityDate).toBe('2026-06-01')
    })

    it('omitted: COMPATIBILITY_DATE and no flags', async () => {
      const fake = createFakeLoader()
      await evaluateWithEnv({ script: 'return 1' }, { loader: fake.loader })
      expect(fake.loaded[0]?.compatibilityDate).toBe(COMPATIBILITY_DATE)
      expect(fake.loaded[0]?.compatibilityFlags).toEqual([])
    })

    it('the full (tests) template gets the same compatibility settings and limits', async () => {
      const code = await buildWorkerCode({
        tests: 'it("x", () => {})',
        compatibilityFlags: ['nodejs_compat'],
        compatibilityDate: '2026-06-01',
        limits: { subrequests: 3 },
      })
      expect(Object.keys(code.modules).sort()).toEqual(['capnweb.js', 'worker.js'])
      expect(code.compatibilityFlags).toEqual(['nodejs_compat'])
      expect(code.compatibilityDate).toBe('2026-06-01')
      expect(code.limits).toEqual({ subrequests: 3 })
    })

    it('compatibility flags and date change the content-addressed id', async () => {
      const plain = await buildWorkerCode({ script: 'return 1' })
      const flagged = await buildWorkerCode({
        script: 'return 1',
        compatibilityFlags: ['nodejs_compat'],
      })
      const dated = await buildWorkerCode({ script: 'return 1', compatibilityDate: '2026-06-01' })
      expect(workerCodeId(plain)).not.toBe(workerCodeId(flagged))
      expect(workerCodeId(plain)).not.toBe(workerCodeId(dated))
    })

    it('tails: WorkerCode.tails is the same array, and never changes the id', async () => {
      const fake = createFakeLoader()
      const tails = [tail]
      await evaluateWithEnv({ script: 'return 1', tails }, { loader: fake.loader })
      expect(fake.loaded[0]?.tails).toBe(tails)

      const plain = await buildWorkerCode({ script: 'return 1' })
      const tailed = await buildWorkerCode({ script: 'return 1', tails })
      expect(plain.tails).toBeUndefined()
      expect(workerCodeId(plain)).toBe(workerCodeId(tailed))
    })

    it('a malformed limit is rejected before the loader is touched', async () => {
      const fake = createFakeLoader()
      const result = await evaluateWithEnv(
        { script: 'return 1', limits: { cpuMs: -1 } },
        { loader: fake.loader }
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/limits\.cpuMs/)
      expect(fake.calls.load + fake.calls.get).toBe(0)
    })
  })

  // aip-263g.5: what the loaded worker answers is checked before it is
  // returned as an EvaluateResult.
  describe('response shape (assertEvaluateResult)', () => {
    it('passes a well-formed result through', async () => {
      const loader = createRespondingLoader({
        success: true,
        value: 42,
        logs: [{ level: 'log', message: 'hi', timestamp: 1 }],
        duration: 0,
      })
      const result = await evaluateWithEnv({ script: 'return 42' }, { loader })
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
      expect(result.logs).toEqual([{ level: 'log', message: 'hi', timestamp: 1 }])
    })

    it('reports a malformed worker response as an error result', async () => {
      const loader = createRespondingLoader({ success: 'yes', logs: 'none' })
      const result = await evaluateWithEnv({ script: 'return 1' }, { loader })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Invalid EvaluateResult/)
    })

    it('rejects a log entry with an unknown level', async () => {
      const loader = createRespondingLoader({
        success: true,
        logs: [{ level: 'trace', message: 'x', timestamp: 1 }],
        duration: 0,
      })
      const result = await evaluateWithEnv({ script: 'return 1' }, { loader })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/logs\[0\]\.level/)
    })
  })

  // aip-263g.6: the sandbox env is an explicit allowlist. `env` carries
  // strings, `bindings` carries RPC stubs and structured-cloneable values;
  // anything else (a raw KV/D1/R2/DO binding, a closure) never reaches the
  // loader, so host bindings cannot leak into the isolate.
  describe('env and bindings (allowlisted sandbox env)', () => {
    const rawKV = { get: async () => null, put: async () => undefined, list: async () => ({}) }
    const stub = { fetch: async () => new Response('ok'), ping: async () => 'pong' }

    it('WorkerCode.env is exactly env when there is no test service', async () => {
      const code = await buildWorkerCode({ script: 'return env.FOO', env: { FOO: 'bar' } })
      expect(code.env).toEqual({ FOO: 'bar' })
    })

    it('WorkerCode.env is env plus TEST only when tests run on the RPC runner', async () => {
      const testService = { connect: async () => ({}) }
      const withTests = await buildWorkerCode(
        { tests: 'it("x", () => {})', env: { FOO: 'bar' } },
        testService
      )
      expect(withTests.env).toEqual({ FOO: 'bar', TEST: testService })

      const embedded = await buildWorkerCode({ tests: 'it("x", () => {})', env: { FOO: 'bar' } })
      expect(embedded.env).toEqual({ FOO: 'bar' })

      // A test service is never handed to a worker that has no tests to run on it
      const scriptOnly = await buildWorkerCode(
        { script: 'return 1', env: { FOO: 'bar' } },
        testService
      )
      expect(scriptOnly.env).toEqual({ FOO: 'bar' })
    })

    it('passes an RPC stub (has fetch) through bindings by reference', async () => {
      const code = await buildWorkerCode({ script: 'return 1', bindings: { svc: stub } })
      expect(code.env?.svc).toBe(stub)
    })

    it('passes structured-cloneable bindings through', async () => {
      const config = { nested: [1, 2, { three: 3 }], when: new Date(0), set: new Set([1]) }
      const code = await buildWorkerCode({ script: 'return 1', bindings: { config, n: 42 } })
      expect(code.env).toEqual({ config, n: 42 })
    })

    it('rejects a raw KV namespace: not structured-cloneable and not an RPC stub', async () => {
      await expect(
        buildWorkerCode({ script: 'return 1', bindings: { KV: rawKV } })
      ).rejects.toThrow(ValidationError)
      await expect(
        buildWorkerCode({ script: 'return 1', bindings: { KV: rawKV } })
      ).rejects.toThrow(/not structured-cloneable|not an RPC stub/)
    })

    it('rejects a closure (would carry host state into the isolate)', async () => {
      await expect(
        buildWorkerCode({ script: 'return 1', bindings: { fn: () => 'secret' } })
      ).rejects.toThrow(/not structured-cloneable|not an RPC stub/)
    })

    it('evaluate() reports the rejected binding as an error result, and never loads', async () => {
      const fake = createFakeLoader()
      const result = await evaluateWithEnv(
        { script: 'return 1', bindings: { KV: rawKV } },
        { loader: fake.loader }
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/not structured-cloneable|not an RPC stub/)
      expect(result.error).toContain('KV')
      expect(fake.calls.load + fake.calls.get).toBe(0)
    })

    it('rejects non-string env values (stubs and objects belong in bindings)', async () => {
      await expect(
        buildWorkerCode({ script: 'return 1', env: { N: 1 as unknown as string } })
      ).rejects.toThrow(/env\.N must be a string/)
      await expect(
        buildWorkerCode({ script: 'return 1', env: { svc: stub as unknown as string } })
      ).rejects.toThrow(ValidationError)
    })

    it('rejects a key that is both an env and a binding', async () => {
      await expect(
        buildWorkerCode({ script: 'return 1', env: { X: 'a' }, bindings: { X: 'b' } })
      ).rejects.toThrow(/X.*both env and bindings/)
    })

    it('reserves TEST for the ai-tests service binding', async () => {
      await expect(buildWorkerCode({ script: 'return 1', env: { TEST: 'x' } })).rejects.toThrow(
        /TEST.*reserved/
      )
      await expect(
        buildWorkerCode({ script: 'return 1', bindings: { TEST: stub } })
      ).rejects.toThrow(/TEST.*reserved/)
    })

    it('env never changes the content-addressed id', async () => {
      const a = await buildWorkerCode({ script: 'return env.FOO', env: { FOO: 'a' } })
      const b = await buildWorkerCode({
        script: 'return env.FOO',
        env: { FOO: 'b' },
        bindings: { svc: stub },
      })
      expect(workerCodeId(a)).toBe(workerCodeId(b))
    })
  })

  describe('env (real local workerd)', () => {
    it('env.FOO reaches the script', async () => {
      const result = await evaluate({ script: 'return env.FOO', env: { FOO: 'bar' } })
      expect(result.error).toBeUndefined()
      expect(result.value).toBe('bar')
    })

    it('env is frozen and holds only what was passed', async () => {
      const result = await evaluate({
        script: `
          let frozen = Object.isFrozen(env);
          try { env.FOO = 'changed'; } catch { frozen = frozen && true; }
          return { frozen, keys: Object.keys(env), foo: env.FOO };
        `,
        env: { FOO: 'bar' },
      })
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({ frozen: true, keys: ['FOO'], foo: 'bar' })
    })

    it('env reaches tests on the embedded runner', async () => {
      const result = await evaluate({
        tests: 'it("sees env", () => expect(env.FOO).toBe("bar"))',
        env: { FOO: 'bar' },
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.passed).toBe(1)
    })

    it('tails cannot cross from Node into the local host either', async () => {
      const result = await evaluate({
        script: 'return 1',
        tails: [{ fetch: async () => new Response('tail') }],
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/tails/)
      expect(result.error).toMatch(/loader/)
    })

    it('compatibilityFlags reach the loaded worker (nodejs_compat exposes Buffer)', async () => {
      const without = await evaluate({ script: 'return typeof Buffer' })
      expect(without.value).toBe('undefined')
      const withFlag = await evaluate({
        script: 'return typeof Buffer',
        compatibilityFlags: ['nodejs_compat'],
      })
      expect(withFlag.error).toBeUndefined()
      expect(withFlag.value).toBe('function')
    })

    it('limits are accepted by the local loader (not enforced by open-source workerd)', async () => {
      const result = await evaluate({ script: 'return 1', limits: { cpuMs: 100, subrequests: 1 } })
      expect(result.error).toBeUndefined()
      expect(result.value).toBe(1)
    })

    it('bindings cannot cross from Node into the local host (no live loader to hand a stub to)', async () => {
      const result = await evaluate({
        script: 'return 1',
        bindings: { svc: { fetch: async () => new Response('ok') } },
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/bindings/)
      expect(result.error).toMatch(/loader/)
    })
  })

  describe('loadWorker', () => {
    const code: WorkerCode = { mainModule: 'w.js', modules: { 'w.js': '' } }

    it('defaults to fresh (load)', () => {
      const fake = createFakeLoader()
      loadWorker(fake.loader, code)
      expect(fake.calls.load).toBe(1)
      expect(fake.calls.get).toBe(0)
    })

    it('cached uses get with the content-addressed id', () => {
      const fake = createFakeLoader()
      loadWorker(fake.loader, code, 'cached')
      expect(fake.calls.get).toBe(1)
      expect(fake.calls.load).toBe(0)
      expect(fake.ids[0]).toBe(workerCodeId(code))
    })
  })

  describe('isolation (real local workerd)', () => {
    it("'fresh' evaluates end-to-end", async () => {
      const result = await evaluate({ script: 'return "fresh"', isolation: 'fresh' })
      expect(result.success).toBe(true)
      expect(result.value).toBe('fresh')
    })

    it("'cached' reuses the isolate; 'fresh' never does (globalThis witness)", async () => {
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

    // aip-263g.30: the user module runs at module scope of the generated
    // worker, so a reused isolate carries let/const bindings and exported
    // objects (not just globalThis) into the next evaluation. The default
    // must keep identical calls independent.
    it('default: module-scope state (let counter, exported array) does not survive between identical calls', async () => {
      const options = {
        module: 'let n = 0; export const inc = () => ++n; export const seen = []',
        script: 'seen.push("x"); return { n: inc(), seen: seen.length }',
      }
      expect((await evaluate(options)).value).toEqual({ n: 1, seen: 1 })
      expect((await evaluate(options)).value).toEqual({ n: 1, seen: 1 })
      expect((await evaluate({ ...options, isolation: 'fresh' })).value).toEqual({ n: 1, seen: 1 })
    })

    it("'cached' (opt-in) carries module-scope state across identical calls", async () => {
      const options = {
        module: 'let n = 0; export const inc = () => ++n; export const seen = []',
        script: 'seen.push("y"); return { n: inc(), seen: seen.length }',
        isolation: 'cached' as const,
      }
      expect((await evaluate(options)).value).toEqual({ n: 1, seen: 1 })
      expect((await evaluate(options)).value).toEqual({ n: 2, seen: 2 })
      // The default is not affected by an earlier cached isolate for the same spec
      const { isolation: _isolation, ...defaults } = options
      expect((await evaluate(defaults)).value).toEqual({ n: 1, seen: 1 })
    })
  })
})
