/**
 * The sandbox boundary against ai-evaluate 3.0 (`src/sandbox.ts`).
 *
 * `runInSandbox(options, env)` switches on `env.loader` only - the uppercase
 * `LOADER` / `TEST` aliases ai-evaluate 2.x accepted are gone - and routes
 * every call without a loader to a `createLocalRuntime()` handle from
 * `ai-evaluate/node` that this module owns (not the process-wide host).
 *
 * Both ai-evaluate entries are mocked here so the routing itself is what is
 * witnessed: which entry was imported, what it was called with, and how the
 * runtime's lifecycle is driven. The real Miniflare path is exercised by
 * test/sandbox-execution.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EvaluateOptions, EvaluateResult, SandboxEnv } from 'ai-evaluate'

const ok = (value: unknown): EvaluateResult => ({ success: true, value, logs: [], duration: 1 })

// The Workers entry: `evaluate(options, env)` on a live loader
const workersEvaluate = vi.fn(async (options: EvaluateOptions, _env?: SandboxEnv) =>
  ok(`workers:${options.script}`)
)

// The Node entry: `createLocalRuntime()` handles, plus the process-wide
// `evaluate` / `dispose` that ai-functions must NOT touch
const runtimes: { evaluate: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[] = []
const createLocalRuntime = vi.fn(() => {
  const runtime = {
    evaluate: vi.fn(async (options: EvaluateOptions) => ok(`local:${options.script}`)),
    dispose: vi.fn(async () => {}),
  }
  runtimes.push(runtime)
  return runtime
})
const processWideEvaluate = vi.fn(async () => ok('process-wide'))
const processWideDispose = vi.fn(async () => {})

vi.mock('ai-evaluate', () => ({ evaluate: workersEvaluate }))
vi.mock('ai-evaluate/node', () => ({
  createLocalRuntime,
  evaluate: processWideEvaluate,
  dispose: processWideDispose,
}))

/** A fresh copy of the module (its runtime handle is module state) */
async function loadSandbox() {
  vi.resetModules()
  return import('../src/sandbox.js')
}

beforeEach(() => {
  vi.clearAllMocks()
  runtimes.length = 0
})

describe('runInSandbox: env.loader routes to the Workers entry', () => {
  it('calls ai-evaluate evaluate(options, env) and never imports the Node runtime', async () => {
    const { runInSandbox } = await loadSandbox()
    const loader = { get: vi.fn(), load: vi.fn() }
    const env = { loader } as unknown as SandboxEnv

    const result = await runInSandbox({ script: 'return 1' }, env)

    expect(result.value).toBe('workers:return 1')
    expect(workersEvaluate).toHaveBeenCalledTimes(1)
    expect(workersEvaluate).toHaveBeenCalledWith({ script: 'return 1' }, env)
    expect(createLocalRuntime).not.toHaveBeenCalled()
    expect(processWideEvaluate).not.toHaveBeenCalled()
  })

  it('does not honour the 2.x LOADER alias: an env with only LOADER takes the Node path', async () => {
    const { runInSandbox } = await loadSandbox()
    const legacy = { LOADER: { get: vi.fn(), load: vi.fn() } } as unknown as SandboxEnv

    const result = await runInSandbox({ script: 'return 2' }, legacy)

    expect(result.value).toBe('local:return 2')
    expect(workersEvaluate).not.toHaveBeenCalled()
    expect(createLocalRuntime).toHaveBeenCalledTimes(1)
  })

  it('SandboxEnv has no LOADER / TEST keys (3.0 type)', () => {
    // A compile-time witness: `loader` is the only way in.
    const env: SandboxEnv = { loader: undefined, test: undefined }
    expect(Object.keys(env)).toEqual(['loader', 'test'])
    // @ts-expect-error - the uppercase alias is not part of SandboxEnv in 3.0
    const legacy: SandboxEnv = { LOADER: undefined }
    expect(legacy).toBeDefined()
  })
})

describe('runInSandbox: no loader routes to an owned createLocalRuntime() handle', () => {
  it('creates one runtime lazily and reuses it across calls', async () => {
    const { runInSandbox } = await loadSandbox()
    expect(createLocalRuntime).not.toHaveBeenCalled() // nothing on import

    const first = await runInSandbox({ script: 'return 1' })
    const second = await runInSandbox({ script: 'return 2' }, undefined)
    const third = await runInSandbox({ script: 'return 3' }, {})

    expect([first.value, second.value, third.value]).toEqual([
      'local:return 1',
      'local:return 2',
      'local:return 3',
    ])
    expect(createLocalRuntime).toHaveBeenCalledTimes(1)
    expect(runtimes[0]!.evaluate).toHaveBeenCalledTimes(3)
    expect(runtimes[0]!.evaluate).toHaveBeenNthCalledWith(1, { script: 'return 1' })
  })

  it('never uses the process-wide evaluate()/dispose() of ai-evaluate/node', async () => {
    const { runInSandbox, disposeSandbox } = await loadSandbox()
    await runInSandbox({ script: 'return 1' })
    await disposeSandbox()
    expect(processWideEvaluate).not.toHaveBeenCalled()
    expect(processWideDispose).not.toHaveBeenCalled()
  })

  it('does not consult the Workers entry', async () => {
    const { runInSandbox } = await loadSandbox()
    await runInSandbox({ script: 'return 1' })
    expect(workersEvaluate).not.toHaveBeenCalled()
  })
})

describe('disposeSandbox', () => {
  it('is a no-op when the Node path was never used', async () => {
    const { disposeSandbox } = await loadSandbox()
    await disposeSandbox()
    expect(createLocalRuntime).not.toHaveBeenCalled()
    expect(processWideDispose).not.toHaveBeenCalled()
  })

  it('disposes the owned runtime, and the next call starts a fresh one', async () => {
    const { runInSandbox, disposeSandbox } = await loadSandbox()
    await runInSandbox({ script: 'return 1' })
    await disposeSandbox()
    expect(runtimes[0]!.dispose).toHaveBeenCalledTimes(1)

    await disposeSandbox() // idempotent
    expect(runtimes[0]!.dispose).toHaveBeenCalledTimes(1)

    const result = await runInSandbox({ script: 'return 2' })
    expect(result.value).toBe('local:return 2')
    expect(createLocalRuntime).toHaveBeenCalledTimes(2)
    expect(runtimes[1]!.evaluate).toHaveBeenCalledTimes(1)
    expect(runtimes[0]!.evaluate).toHaveBeenCalledTimes(1) // the disposed one is not reused
  })
})
