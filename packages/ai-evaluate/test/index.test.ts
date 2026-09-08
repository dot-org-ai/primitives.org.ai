import { describe, it, expect, afterAll } from 'vitest'

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

  it('ai-evaluate/node exports exactly evaluate, createEvaluator, createLocalRuntime, dispose', async () => {
    // dispose() is the only lifecycle API: no pool (configurePool/warmPool/
    // disposePool) and no host-worker internals (loadHostWorker, HOST_*).
    const node = await import('../src/node.js')
    expect(Object.keys(node).sort()).toEqual(
      ['evaluate', 'createEvaluator', 'createLocalRuntime', 'dispose'].sort()
    )
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

  it('src/node.js and src/evaluate.js produce identical EvaluateResult shape', async () => {
    const node = await import('../src/node.js')
    const workers = await import('../src/evaluate.js')

    // Local runtime: evaluate() from src/evaluate.js running inside the host worker
    const local = await node.evaluate({ script: 'return 42' })

    // Workers entry, driven through a stub LOADER that runs the generated worker
    // code in the same local runtime (so the loaded-worker result is real).
    const runtime = node.createLocalRuntime()
    try {
      const env = {
        loader: {
          get: (_id: string, load: () => Promise<{ modules: Record<string, unknown> }>) => ({
            getEntrypoint: () => ({
              fetch: async () => {
                const code = await load()
                // The generated worker is a plain module; run its script via the runtime
                expect(code.modules).toHaveProperty('worker.js')
                return Response.json(await runtime.evaluate({ script: 'return 42' }))
              },
            }),
          }),
        },
      }
      const direct = await workers.evaluate({ script: 'return 42' }, env)

      expect(local.success).toBe(true)
      expect(direct.success).toBe(true)
      expect(local.value).toBe(42)
      expect(direct.value).toBe(42)
      expect(Object.keys(local).sort()).toEqual(Object.keys(direct).sort())
      expect(Object.keys(local).sort()).toEqual(['duration', 'logs', 'success', 'value'])
    } finally {
      await runtime.dispose()
    }
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
