/**
 * Evaluate code in a sandboxed environment (Node.js version)
 *
 * Runs the exact `evaluate()` from './evaluate.js' - the bytes that ship to
 * Cloudflare - inside a Miniflare 5 host worker whose `env.LOADER` is a real
 * `worker_loaders` binding. There is no separate local template: local
 * behaviour is Dynamic Workers behaviour.
 *
 * - One host worker per process, created lazily on first use; call
 *   `dispose()` to shut it down (test teardown, CLI exit).
 * - When an `env` with a loader binding is supplied (e.g. running inside
 *   workerd via vitest-pool-workers), `evaluate()` is called directly.
 *
 * For Workers-only builds, import from 'ai-evaluate' instead.
 */

import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Miniflare as MiniflareInstance } from 'miniflare'
import type { EvaluateOptions, EvaluateResult, SandboxEnv } from './types.js'
import { evaluate as evaluateInWorker, DEFAULT_TIMEOUT } from './evaluate.js'
import { COMPATIBILITY_DATE, EVALUATE_PATH, normalizeImports } from './shared.js'

/** Name of the Miniflare host worker */
export const HOST_WORKER_NAME = 'ai-evaluate-host'

/** Module name of the bundled host worker inside the Miniflare instance */
const HOST_MODULE = 'host-worker.js'

/**
 * Extra time (ms) the Node side waits past `timeout` before treating the
 * host as wedged. The host worker's own `AbortSignal.timeout` fires first for
 * async hangs; the Node backstop only triggers for CPU-bound loops, which
 * block the single-threaded local workerd (no CPU limits are enforced there).
 */
const TIMEOUT_GRACE_MS = 250

/**
 * Check if code contains JSX syntax that needs transformation
 */
function containsJSX(code: string): boolean {
  if (!code) return false
  const jsxPattern = /<[A-Z][a-zA-Z0-9]*[\s/>]|<[a-z][a-z0-9-]*[\s/>]|<>|<\/>/
  const jsxReturnPattern = /return\s*\(\s*<|return\s+<[A-Za-z]/
  return jsxPattern.test(code) || jsxReturnPattern.test(code)
}

/**
 * Transform JSX in code using esbuild
 */
async function transformJSX(code: string): Promise<string> {
  if (!code || !containsJSX(code)) return code

  try {
    const { transform } = await import('esbuild')
    const result = await transform(code, {
      loader: 'tsx',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      target: 'esnext',
      format: 'esm',
    })
    return result.code
  } catch (error) {
    console.error('JSX transform failed:', error)
    return code
  }
}

/**
 * Apply Node-side preprocessing (JSX transform, import normalization) so the
 * options handed to the worker are plain JavaScript.
 */
async function prepareOptions(options: EvaluateOptions): Promise<EvaluateOptions> {
  const [module, tests, script] = await Promise.all([
    options.module ? transformJSX(options.module) : undefined,
    options.tests ? transformJSX(options.tests) : undefined,
    options.script ? transformJSX(options.script) : undefined,
  ])
  return {
    ...options,
    module,
    tests,
    script,
    imports: normalizeImports(options.imports),
  }
}

/**
 * Bundle `./host-worker` (which imports `./evaluate`) into a single ES module
 * string. Resolves against this file's own directory, so it bundles from
 * `src/*.ts` under vitest and from `dist/*.js` when installed.
 */
export async function bundleHostWorker(): Promise<string> {
  const here = fileURLToPath(import.meta.url)
  const entry = join(dirname(here), `host-worker${extname(here)}`)
  const { build } = await import('esbuild')
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    logLevel: 'silent',
  })
  const output = result.outputFiles?.[0]
  if (!output) throw new Error('Failed to bundle ai-evaluate host worker')
  return output.text
}

/**
 * A local sandbox runtime: one Miniflare 5 host worker with a LOADER binding.
 */
export interface LocalRuntime {
  /** Evaluate code in the sandbox (same semantics as `evaluate` from 'ai-evaluate') */
  evaluate(options: EvaluateOptions): Promise<EvaluateResult>
  /** Shut down the host worker. Safe to call more than once. */
  dispose(): Promise<void>
}

/**
 * Create a local sandbox runtime backed by a Miniflare 5 host worker.
 *
 * The host worker is the bundled `./host-worker` module - the same
 * `evaluate()` that runs on Cloudflare - with `env.LOADER` provided by
 * Miniflare's `worker-loader` binding. It is created lazily on the first
 * `evaluate()` call and reused for every call after that.
 *
 * @example
 * ```ts
 * const runtime = createLocalRuntime()
 * const result = await runtime.evaluate({ script: 'return 1 + 1' })
 * await runtime.dispose()
 * ```
 */
export function createLocalRuntime(): LocalRuntime {
  let hostPromise: Promise<MiniflareInstance> | null = null
  let bundlePromise: Promise<string> | null = null

  const getBundle = (): Promise<string> => {
    bundlePromise ??= bundleHostWorker()
    return bundlePromise
  }

  const createHost = async (): Promise<MiniflareInstance> => {
    const { Miniflare } = await import('miniflare')
    const script = await getBundle()
    return new Miniflare({
      workers: [
        {
          config: {
            name: HOST_WORKER_NAME,
            type: 'worker',
            compatibilityDate: COMPATIBILITY_DATE,
            manifest: {
              mainModule: HOST_MODULE,
              modules: { [HOST_MODULE]: { type: 'esm', contents: script } },
            },
            env: { LOADER: { type: 'worker-loader' } },
          },
        },
      ],
    })
  }

  const getHost = (): Promise<MiniflareInstance> => {
    hostPromise ??= createHost().catch((error) => {
      hostPromise = null
      throw error
    })
    return hostPromise
  }

  const dispose = async (): Promise<void> => {
    const pending = hostPromise
    hostPromise = null
    if (!pending) return
    try {
      const host = await pending
      await host.dispose()
    } catch {
      // Already gone (failed to start, or wedged and killed) - nothing to release
    }
  }

  const evaluate = async (options: EvaluateOptions): Promise<EvaluateResult> => {
    const start = Date.now()
    const timeout = options.timeout ?? DEFAULT_TIMEOUT
    try {
      const host = await getHost()
      const response = await host.dispatchFetch(`http://${HOST_WORKER_NAME}${EVALUATE_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(options),
        signal: AbortSignal.timeout(timeout + TIMEOUT_GRACE_MS),
      })
      const result = (await response.json()) as EvaluateResult
      return { ...result, duration: Date.now() - start }
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        // The host did not answer in time: a CPU-bound loop has wedged the
        // local workerd. Tear it down so the next call gets a fresh host.
        await dispose()
        return {
          success: false,
          logs: [],
          error: `Timeout: Script execution exceeded ${timeout}ms`,
          duration: Date.now() - start,
        }
      }
      return {
        success: false,
        logs: [],
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      }
    }
  }

  return { evaluate, dispose }
}

/** The process-wide local runtime, created on first use */
let sharedRuntime: LocalRuntime | null = null

function getSharedRuntime(): LocalRuntime {
  sharedRuntime ??= createLocalRuntime()
  return sharedRuntime
}

/**
 * Dispose the process-wide local runtime (if one was created).
 *
 * Call from test teardown or before process exit. The next `evaluate()`
 * without an env creates a fresh runtime.
 */
export async function dispose(): Promise<void> {
  const runtime = sharedRuntime
  sharedRuntime = null
  await runtime?.dispose()
}

/**
 * Evaluate code in a sandboxed worker (Node.js version)
 *
 * With an `env` that carries a `loader`/`LOADER` binding this calls
 * `evaluate()` from 'ai-evaluate' directly. Without one it runs that same
 * function inside the process-wide Miniflare host worker.
 */
export async function evaluate(
  options: EvaluateOptions,
  env?: SandboxEnv
): Promise<EvaluateResult> {
  const start = Date.now()
  try {
    const prepared = await prepareOptions(options)
    if (env?.loader || env?.LOADER) {
      return await evaluateInWorker(prepared, env)
    }
    return await getSharedRuntime().evaluate(prepared)
  } catch (error) {
    return {
      success: false,
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    }
  }
}

/**
 * Create an evaluate function bound to a specific environment
 */
export function createEvaluator(env?: SandboxEnv) {
  return (options: EvaluateOptions) => evaluate(options, env)
}

// Re-export types
export type { EvaluateOptions, EvaluateResult, SandboxEnv } from './types.js'
