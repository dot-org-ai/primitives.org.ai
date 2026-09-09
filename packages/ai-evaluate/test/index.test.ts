import { describe, it, expect, expectTypeOf, beforeAll, afterAll } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { SandboxEnv } from '../src/types.js'
import { createLoaderBridge, type LoaderBridge } from './helpers/loader-bridge.js'
import { SCRIPT_RESULT_KEYS, TESTS_RESULT_KEYS, resultKeys } from './fixtures/result-shape.js'

/**
 * The documented 3.0 runtime surface of `ai-evaluate` (the `.` export), as
 * listed under "Exports" in README.md and in MIGRATION.md. Types are not
 * visible at runtime and are covered by the typecheck. A name added here is a
 * public commitment: add it to the README too.
 */
const AI_EVALUATE_EXPORTS = [
  // evaluate
  'VERSION',
  'evaluate',
  'createEvaluator',
  'buildWorkerCode',
  'buildWorkerCodeWithWarnings',
  'planImports',
  'loadWorker',
  'entrypointLimits',
  'DEFAULT_ISOLATION',
  'DEFAULT_TIMEOUT',
  // shared
  'normalizeImport',
  'normalizeImports',
  'parseImportSpecifier',
  'partitionImports',
  'packageJsonModule',
  'workerCodeId',
  'COMPATIBILITY_DATE',
  'PACKAGE_JSON_MODULE',
  // bundler
  'resolveImports',
  'dependenciesHash',
  'clearBundlerCache',
  'BundlerUnavailableError',
  // validation
  'ValidationError',
  'validateOptions',
  'buildSandboxEnv',
  'isRpcStubLike',
  'isStructuredCloneable',
  'TEST_BINDING_KEY',
  'MAX_TIMEOUT',
  // type guards
  'isEvaluateResult',
  'assertEvaluateResult',
  // outbound gateway
  'createOutboundGateway',
  'outboundPolicy',
  'blockedHostError',
  'OUTBOUND_GATEWAY_EXPORT',
  'OUTBOUND_JSON_MODULE',
  'OUTBOUND_GATEWAY_UNAVAILABLE_ERROR',
  'INTERCEPTOR_UNAVAILABLE_ERROR',
  'OUTBOUND_RPC_CACHED_ERROR',
  // facets
  'createFacetHost',
  'facetBindingName',
  'facetEnvSource',
  'generateFacetWorkerCode',
  'loopbackSandboxHost',
  'facetNotAttachedError',
  'isIdentifier',
  'SANDBOX_ENV_FUNCTION',
  'SANDBOX_HOST_EXPORT',
  'SANDBOX_HOST_BINDING_KEY',
  'SANDBOX_JSON_MODULE',
  'SANDBOX_HOST_UNAVAILABLE_ERROR',
  'loopbackExport',
  // transform
  'transformSource',
  'transformOptions',
  'containsJSX',
] as const

/** Names 2.x callers could reach that 3.0 does not export anywhere */
const REMOVED_IN_3_0 = [
  'configurePool',
  'getPoolConfig',
  'getPoolStats',
  'warmPool',
  'acquireInstance',
  'disposePool',
  'resetPool',
  'generateDevWorkerCode',
  'generateDomainCheckCode',
  'generateFetchControlCode',
  'getDomainCheckCode',
  'generateSandboxId',
  'bundleHostWorker',
  'loadHostWorker',
  'HOST_MODULE',
  'HOST_WORKER_NAME',
  'buildContextModule',
] as const

afterAll(async () => {
  const { dispose } = await import('../src/node.js')
  await dispose()
})

describe('index exports', () => {
  it('exports evaluate function', async () => {
    const { evaluate } = await import('../src/node.js')
    expect(typeof evaluate).toBe('function')
  })

  it('exports createEvaluator function', async () => {
    const { createEvaluator } = await import('../src/node.js')
    expect(typeof createEvaluator).toBe('function')
  })

  it('exports types', async () => {
    // Types are compile-time only, so we just check the module loads
    await import('../src/node.js')
  })

  it('ai-evaluate/node exports exactly evaluate, createEvaluator, createLocalRuntime, dispose and the documented error constants', async () => {
    // dispose() is the only lifecycle API: no pool (configurePool/warmPool/
    // disposePool) and no host-worker internals (loadHostWorker, HOST_*).
    // WEDGED_HOST_ERROR / DISPOSED_HOST_ERROR are the documented messages an
    // evaluation caught in flight reports when the host is reset (aip-263g.14),
    // exported so callers can match them to decide whether to retry.
    // MINIFLARE_UNAVAILABLE_ERROR is what evaluate() reports when the optional
    // `miniflare` dependency is not installed (aip-263g.13).
    const node = await import('../src/node.js')
    expect(Object.keys(node).sort()).toEqual(
      [
        'evaluate',
        'createEvaluator',
        'createLocalRuntime',
        'dispose',
        'WEDGED_HOST_ERROR',
        'DISPOSED_HOST_ERROR',
        'MINIFLARE_UNAVAILABLE_ERROR',
      ].sort()
    )
  })
})

describe('ai-evaluate (Workers entry) exports', () => {
  it('src/index.ts exports exactly the documented 3.0 runtime surface', async () => {
    // `cloudflare:workers` is only imported lazily (facets, the gateway), so
    // the entry loads on Node. Order-insensitive; sorted for a readable diff.
    const entry = await import('../src/index.js')
    expect(Object.keys(entry).sort()).toEqual([...AI_EVALUATE_EXPORTS].sort())
  })

  it('exports none of the 2.x symbols 3.0 removed, on any public subpath', async () => {
    const surfaces = await Promise.all([
      import('../src/index.js'),
      import('../src/node.js'),
      import('../src/static/index.js'),
      import('../src/repl.js'),
    ])
    for (const surface of surfaces) {
      for (const name of REMOVED_IN_3_0) expect(surface).not.toHaveProperty(name)
    }
  })

  it('the README documents every runtime export by name', async () => {
    const readme = await readFile(resolve(import.meta.dirname, '..', 'README.md'), 'utf8')
    const section = readme.slice(readme.indexOf('\n## Exports'))
    expect(section.length).toBeGreaterThan(0)
    for (const name of AI_EVALUATE_EXPORTS) expect(section).toContain(`\`${name}\``)
  })
})

describe('SandboxEnv (3.0: `loader` and `test` only)', () => {
  it('has no LOADER / TEST aliases at the type level', () => {
    expectTypeOf<SandboxEnv>().toHaveProperty('loader')
    expectTypeOf<SandboxEnv>().toHaveProperty('test')
    expectTypeOf<SandboxEnv>().not.toHaveProperty('LOADER')
    expectTypeOf<SandboxEnv>().not.toHaveProperty('TEST')
    expectTypeOf<keyof SandboxEnv>().toEqualTypeOf<'loader' | 'test'>()
  })

  it('declares exactly `loader` and `test` in src/types.ts (source witness)', async () => {
    // `expectTypeOf` only bites under a typecheck that includes test files;
    // this reads the interface as written so the Node pool fails on its own
    // if an alias comes back.
    const source = await readFile(resolve(import.meta.dirname, '..', 'src', 'types.ts'), 'utf8')
    const match = source.match(/export interface SandboxEnv \{([^}]*)\}/)
    expect(match).not.toBeNull()
    const keys = [...match![1]!.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1])
    expect(keys).toEqual(['loader', 'test'])
  })
})

describe('types', () => {
  it('EvaluateOptions interface is usable', async () => {
    const { evaluate } = await import('../src/node.js')

    // Test that options conform to EvaluateOptions
    const options = {
      module: 'exports.x = 1;',
      tests: 'it("test", () => {});',
      script: 'return 1;',
      timeout: 5000,
      env: { FOO: 'bar' },
      fetch: null as null,
    }

    const result = await evaluate(options)
    expect(result).toHaveProperty('success')
  })

  it('EvaluateResult has correct shape', async () => {
    const { evaluate } = await import('../src/node.js')

    const result = await evaluate({ script: 'return 42;' })

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('logs')
    expect(result).toHaveProperty('duration')
    expect(typeof result.success).toBe('boolean')
    expect(Array.isArray(result.logs)).toBe(true)
    expect(typeof result.duration).toBe('number')
  })

  describe('src/node.js and src/evaluate.js produce identical EvaluateResult shape', () => {
    // Both sides are real executions of the generated worker inside workerd:
    // - local: `ai-evaluate/node` -> Miniflare host worker -> its LOADER;
    // - direct: `src/evaluate.ts` in this Node process -> loader bridge ->
    //   a real `worker_loaders` binding that loads the WorkerCode evaluate()
    //   built and returns the loaded worker's own Response.
    // Neither result is canned or borrowed from the other path, and each is
    // held to the key set shared with the workers-pool suite.
    let bridge: LoaderBridge

    beforeAll(() => {
      bridge = createLoaderBridge()
    })

    afterAll(async () => {
      await bridge.dispose()
    })

    it('the bridge loader executes the WorkerCode it is handed', async () => {
      const workers = await import('../src/evaluate.js')
      const result = await workers.evaluate(
        { script: 'console.log("ran in isolate"); return 6 * 7' },
        { loader: bridge.loader }
      )
      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      // The value and the captured log can only come from running the script
      expect(result.value).toBe(42)
      expect(result.logs.map((l) => l.message)).toEqual(['ran in isolate'])
      // ...and the script ran from the WorkerCode evaluate() built
      const code = bridge.loaded.at(-1)
      expect(code?.mainModule).toBe('worker.js')
      expect(code?.modules['worker.js']).toContain('return 6 * 7')
    })

    it('{ script }: same keys on both paths, matching the shared contract', async () => {
      const node = await import('../src/node.js')
      const workers = await import('../src/evaluate.js')
      const options = { script: 'console.log("x"); return 42' }

      const local = await node.evaluate(options)
      const direct = await workers.evaluate(options, { loader: bridge.loader })

      expect(local.error).toBeUndefined()
      expect(direct.error).toBeUndefined()
      expect(local.value).toBe(42)
      expect(direct.value).toBe(42)
      expect(local.logs.map((l) => l.message)).toEqual(['x'])
      expect(direct.logs.map((l) => l.message)).toEqual(['x'])
      expect(resultKeys(local)).toEqual(resultKeys(direct))
      expect(resultKeys(direct)).toEqual([...SCRIPT_RESULT_KEYS])
    })

    it('{ tests }: same keys on both paths (full template, embedded runner)', async () => {
      const node = await import('../src/node.js')
      const workers = await import('../src/evaluate.js')
      const options = { tests: 'it("t", () => { expect(1).toBe(1) })' }

      const local = await node.evaluate(options)
      const direct = await workers.evaluate(options, { loader: bridge.loader })

      expect(local.success).toBe(true)
      expect(direct.success).toBe(true)
      expect(local.testResults?.passed).toBe(1)
      expect(direct.testResults?.passed).toBe(1)
      expect(resultKeys(local)).toEqual(resultKeys(direct))
      expect(resultKeys(direct)).toEqual([...TESTS_RESULT_KEYS])
      expect(resultKeys(local.testResults!)).toEqual(resultKeys(direct.testResults!))
    })

    it('a thrown script error: same keys on both paths', async () => {
      const node = await import('../src/node.js')
      const workers = await import('../src/evaluate.js')
      const options = { script: 'throw new Error("boom")' }

      const local = await node.evaluate(options)
      const direct = await workers.evaluate(options, { loader: bridge.loader })

      expect(local.success).toBe(false)
      expect(direct.success).toBe(false)
      expect(local.error).toContain('boom')
      expect(direct.error).toContain('boom')
      expect(resultKeys(local)).toEqual(resultKeys(direct))
    })
  })

  it('LogEntry has correct shape', async () => {
    const { evaluate } = await import('../src/node.js')

    const result = await evaluate({
      script: 'console.log("test"); return true;',
    })

    const log = result.logs[0]
    expect(log).toHaveProperty('level')
    expect(log).toHaveProperty('message')
    expect(log).toHaveProperty('timestamp')
    expect(['log', 'warn', 'error', 'info', 'debug']).toContain(log.level)
  })

  it('TestResults has correct shape when tests provided', async () => {
    const { evaluate } = await import('../src/node.js')

    const result = await evaluate({
      tests: 'it("test", () => { expect(1).toBe(1); });',
    })

    expect(result.testResults).toBeDefined()
    expect(result.testResults).toHaveProperty('total')
    expect(result.testResults).toHaveProperty('passed')
    expect(result.testResults).toHaveProperty('failed')
    expect(result.testResults).toHaveProperty('skipped')
    expect(result.testResults).toHaveProperty('tests')
    expect(result.testResults).toHaveProperty('duration')
  })

  it('TestResult has correct shape', async () => {
    const { evaluate } = await import('../src/node.js')

    const result = await evaluate({
      tests: 'it("my test", () => {});',
    })

    const test = result.testResults?.tests[0]
    expect(test).toHaveProperty('name')
    expect(test).toHaveProperty('passed')
    expect(test).toHaveProperty('duration')
    expect(test?.name).toBe('my test')
    expect(test?.passed).toBe(true)
  })
})
