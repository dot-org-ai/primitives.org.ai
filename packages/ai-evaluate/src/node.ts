/**
 * Evaluate code in a sandboxed environment (Node.js version)
 *
 * Runs the exact `evaluate()` from './evaluate.js' - the bytes that ship to
 * Cloudflare - inside a Miniflare 5 host worker whose `env.LOADER` is a real
 * `worker_loaders` binding. There is no separate local template: local
 * behaviour is Dynamic Workers behaviour.
 *
 * - One host worker per process, created lazily on first use. Its handles
 *   (workerd child, loopback server) are unref'd while idle, so a script or
 *   CLI exits on its own once its work is done; Miniflare's own exit hook
 *   reaps workerd. Call `dispose()` to release the host early (test teardown).
 * - When an `env` with a loader binding is supplied (e.g. running inside
 *   workerd via vitest-pool-workers), `evaluate()` is called directly.
 *
 * For Workers-only builds, import from 'ai-evaluate' instead.
 */

import { ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { Server, Socket } from 'node:net'
import { basename, dirname, extname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Miniflare as MiniflareInstance } from 'miniflare'
import type { EvaluateOptions, EvaluateResult, SandboxEnv } from './types.js'
import { evaluate as evaluateInWorker, DEFAULT_TIMEOUT } from './evaluate.js'
import { COMPATIBILITY_DATE, EVALUATE_PATH, normalizeImports } from './shared.js'
import { stripTypes } from './transform.js'

/** Name of the Miniflare host worker */
export const HOST_WORKER_NAME = 'ai-evaluate-host'

/** Entry module of the host worker inside the Miniflare instance */
export const HOST_MODULE = 'host-worker.js'

/**
 * Extra time (ms) the Node side waits past `timeout` before treating the
 * host as wedged. The host worker's own `AbortSignal.timeout` fires first for
 * async hangs; the Node backstop only triggers for CPU-bound loops, which
 * block the single-threaded local workerd (no CPU limits are enforced there).
 */
const TIMEOUT_GRACE_MS = 250

/**
 * Node-side preprocessing: import normalization only. JSX/TypeScript are
 * transformed by `evaluate()` itself, inside the host worker (see
 * `./transform.ts`), so the source reaches the worker exactly as written.
 */
function prepareOptions(options: EvaluateOptions): EvaluateOptions {
  return { ...options, imports: normalizeImports(options.imports) }
}

/** The host worker as workerd modules: its entry name and `name -> ESM source` */
export interface HostWorkerModules {
  mainModule: string
  modules: Record<string, string>
}

/**
 * Relative `import ... from './x.js'` / `export ... from './x.js'` /
 * `import './x.js'` specifiers in an ES module. Specifiers that only appear
 * inside generated-code string literals are filtered out later by existence.
 */
const RELATIVE_IMPORT =
  /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"](\.\.?\/[^'"]+)['"]|\bimport\s*['"](\.\.?\/[^'"]+)['"]/g

function relativeImports(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(RELATIVE_IMPORT)) {
    const specifier = match[1] ?? match[2]
    if (specifier && !specifier.includes('${')) specifiers.push(specifier)
  }
  return specifiers
}

/**
 * Collect `./host-worker` (which imports `./evaluate`) and everything it
 * imports as a set of ES modules for the Miniflare host - no bundler involved.
 *
 * Resolves against this file's own directory: from `dist/*.js` when installed
 * (used as-is) and from `src/*.ts` under vitest (TypeScript stripped with the
 * same bundled sucrase that `evaluate()` uses for sandbox code). Module names
 * are paths relative to that directory (`evaluate.js`,
 * `worker-template/core.js`), which is how their relative imports resolve
 * inside workerd.
 */
export function loadHostWorker(): HostWorkerModules {
  const here = fileURLToPath(import.meta.url)
  const root = dirname(here)
  const fromSource = extname(here) === '.ts'
  const fileFor = (name: string): string =>
    join(root, ...(fromSource ? name.replace(/\.js$/, '.ts') : name).split('/'))

  const modules: Record<string, string> = {}
  const queue = [HOST_MODULE]
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    if (name in modules) continue
    const source = readFileSync(fileFor(name), 'utf8')
    const code = fromSource ? stripTypes(source) : source
    modules[name] = code
    for (const specifier of relativeImports(code)) {
      const target = posix.normalize(posix.join(posix.dirname(name), specifier))
      // A specifier with no file behind it came from a string literal of
      // generated sandbox code (e.g. `./__external_0__.js`); workerd reports
      // any real miss when the host loads.
      if (!target.startsWith('../') && existsSync(fileFor(target))) queue.push(target)
    }
  }
  return { mainModule: HOST_MODULE, modules }
}

/** Host worker modules, loaded once per process */
let hostWorkerModules: HostWorkerModules | null = null

function getHostWorker(): HostWorkerModules {
  hostWorkerModules ??= loadHostWorker()
  return hostWorkerModules
}

/**
 * Something that can be detached from / re-attached to the Node event loop.
 * `ChildProcess`, `net.Server` and `net.Socket` all implement this pair.
 */
interface RefCounted {
  ref(): unknown
  unref(): unknown
}

/**
 * The handles a Miniflare host opens in this process: the workerd child, its
 * stdio pipes, and the loopback HTTP server. None of them is reachable through
 * Miniflare's public API, so they are found by diffing the process's active
 * handles across host startup (see `findHostHandles`).
 */
interface HostHandles {
  workerd: ChildProcess | null
  others: RefCounted[]
}

/**
 * Snapshot of the process's active libuv handles (`process._getActiveHandles`
 * is undocumented but present in every supported Node release). Returns an
 * empty list where it is unavailable, in which case the host keeps the loop
 * alive until `dispose()` - the behaviour the exit test guards against.
 */
function activeHandles(): unknown[] {
  const getter = (process as { _getActiveHandles?: () => unknown[] })._getActiveHandles
  return typeof getter === 'function' ? getter.call(process) : []
}

/**
 * Pick out, from the handles that appeared during host startup, the ones that
 * belong to Miniflare: the `workerd` child (matched by its executable name,
 * plus its stdio pipes) and the loopback `http.Server` (Miniflare wraps it
 * with `stoppable`, hence the `stop` method). Anything else that happened to
 * open in the same window - a caller's own request or server - is left alone.
 */
function findHostHandles(before: Set<unknown>, after: unknown[]): HostHandles {
  let workerd: ChildProcess | null = null
  const others: RefCounted[] = []
  for (const handle of after) {
    if (before.has(handle)) continue
    if (handle instanceof ChildProcess) {
      if (!basename(handle.spawnfile).startsWith('workerd')) continue
      workerd ??= handle
      for (const pipe of handle.stdio) if (pipe instanceof Socket) others.push(pipe)
    } else if (handle instanceof Server) {
      if (typeof (handle as { stop?: unknown }).stop === 'function') others.push(handle)
    }
  }
  return { workerd, others }
}

/**
 * Attach (`active`) or detach (idle) the host's handles from the event loop.
 * Detached, an idle host does not stop the process from exiting; attached,
 * an in-flight evaluation is guaranteed to be waited for.
 */
function setHandlesActive(handles: HostHandles, active: boolean): void {
  const targets: RefCounted[] = handles.workerd
    ? [handles.workerd, ...handles.others]
    : handles.others
  for (const target of targets) {
    try {
      if (active) target.ref()
      else target.unref()
    } catch {
      // Handle already closed - nothing to (un)ref
    }
  }
}

/** A started Miniflare host together with the process handles it owns */
interface Host {
  miniflare: MiniflareInstance
  handles: HostHandles
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
 * The host worker is the `./host-worker` module graph (see `loadHostWorker`) -
 * the same `evaluate()` that runs on Cloudflare - with `env.LOADER` provided
 * by Miniflare's `worker-loader` binding. It is created lazily on the first
 * `evaluate()` call and reused for every call after that. While no evaluation
 * is in flight the host's handles are unref'd, so it never keeps the process
 * alive on its own; `dispose()` releases it early.
 *
 * @example
 * ```ts
 * const runtime = createLocalRuntime()
 * const result = await runtime.evaluate({ script: 'return 1 + 1' })
 * await runtime.dispose()
 * ```
 */
export function createLocalRuntime(): LocalRuntime {
  let hostPromise: Promise<Host> | null = null
  /** Evaluations currently awaiting the host; the host is unref'd at zero */
  let inFlight = 0

  const createHost = async (): Promise<Host> => {
    const { Miniflare } = await import('miniflare')
    const { mainModule, modules } = getHostWorker()
    const before = new Set(activeHandles())
    const miniflare = new Miniflare({
      workers: [
        {
          config: {
            name: HOST_WORKER_NAME,
            type: 'worker',
            compatibilityDate: COMPATIBILITY_DATE,
            manifest: {
              mainModule,
              modules: Object.fromEntries(
                Object.entries(modules).map(([name, contents]) => [name, { type: 'esm', contents }])
              ),
            },
            env: { LOADER: { type: 'worker-loader' } },
          },
        },
      ],
    })
    try {
      await miniflare.ready
    } catch (error) {
      await miniflare.dispose().catch(() => {})
      throw error
    }
    const handles = findHostHandles(before, activeHandles())
    // Whoever awaited this is about to evaluate; `evaluate` re-syncs anyway.
    setHandlesActive(handles, inFlight > 0)
    return { miniflare, handles }
  }

  const getHost = (): Promise<Host> => {
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
      await host.miniflare.dispose()
    } catch {
      // Already gone (failed to start, or wedged and killed) - nothing to release
    }
  }

  const evaluate = async (options: EvaluateOptions): Promise<EvaluateResult> => {
    const start = Date.now()
    const timeout = options.timeout ?? DEFAULT_TIMEOUT
    inFlight++
    let host: Host | null = null
    try {
      host = await getHost()
      setHandlesActive(host.handles, true)
      const response = await host.miniflare.dispatchFetch(
        `http://${HOST_WORKER_NAME}${EVALUATE_PATH}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(options),
          signal: AbortSignal.timeout(timeout + TIMEOUT_GRACE_MS),
        }
      )
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
    } finally {
      inFlight--
      if (inFlight === 0 && host && hostPromise) setHandlesActive(host.handles, false)
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
 * Optional: an idle runtime does not keep the process alive, so a script or
 * CLI exits on its own. Call it to release the host early (test teardown, or
 * before a long idle stretch). The next `evaluate()` without an env creates a
 * fresh runtime.
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
    const prepared = prepareOptions(options)
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
