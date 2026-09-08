/**
 * Evaluate code in a sandboxed environment (Node.js version)
 *
 * Runs the exact `evaluate()` from './evaluate.js' - the bytes that ship to
 * Cloudflare - inside a Miniflare 5 host worker whose `env.loader` is a real
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
import { Server, Socket } from 'node:net'
import { basename } from 'node:path'
import type { Miniflare as MiniflareInstance } from 'miniflare'
import type * as MiniflareModule from 'miniflare'
import type { EvaluateOptions, EvaluateResult, SandboxEnv } from './types.js'
import { evaluate as evaluateInWorker, DEFAULT_TIMEOUT } from './evaluate.js'
import { COMPATIBILITY_DATE, EVALUATE_PATH, normalizeImports } from './shared.js'
import { HOST_WORKER_NAME, loadHostWorker, type HostWorkerModules } from './host-modules.js'

/**
 * Extra time (ms) the Node side waits past `timeout` before treating the
 * host as wedged. The host worker's own `AbortSignal.timeout` fires first for
 * async hangs; the Node backstop only triggers for CPU-bound loops, which
 * block the single-threaded local workerd (no CPU limits are enforced there).
 *
 * Local workerd runs every loaded worker on the host's one thread, so a
 * `while (true) {}` stalls the host worker's timers - `AbortSignal.timeout`
 * inside `evaluate()` never fires - and `limits.cpuMs` is accepted but not
 * enforced by open-source workerd. Cloudflare enforces both. The backstop is
 * therefore the local contract for CPU-bound scripts: the Node side aborts the
 * request, kills the host (SIGKILL via `Miniflare#dispose`), and the next call
 * starts a fresh one. Every other evaluation in flight on that host fails too;
 * it is reported as `WEDGED_HOST_ERROR` rather than a bare `fetch failed`.
 */
const TIMEOUT_GRACE_MS = 250

/** Error reported by evaluations caught in flight when a wedged host is reset */
export const WEDGED_HOST_ERROR =
  'Host worker reset: a concurrent evaluation exceeded its timeout with a CPU-bound loop ' +
  'and wedged the local runtime; retry this evaluation'

/** Error reported by evaluations caught in flight when the runtime is disposed */
export const DISPOSED_HOST_ERROR = 'Host worker disposed while this evaluation was in flight'

/** Lowest Node major that Miniflare 5 (`engines.node`) runs on */
const MINIFLARE_MIN_NODE_MAJOR = 22

/**
 * Error reported when the local runtime cannot load `miniflare`.
 *
 * `miniflare` is an optional dependency of ai-evaluate: Miniflare 5 (the only
 * line with a `worker-loader` binding) is published as `5.x-alpha` and declares
 * `engines.node >= 22`, so package managers skip it silently on older Node and
 * the first `evaluate()` without an `env` would otherwise fail with a bare
 * "Cannot find package 'miniflare'".
 */
export const MINIFLARE_UNAVAILABLE_ERROR =
  "ai-evaluate/node needs 'miniflare' (Miniflare 5, an optional dependency that requires " +
  `Node >= ${MINIFLARE_MIN_NODE_MAJOR}); install it with your package manager on Node ` +
  `${MINIFLARE_MIN_NODE_MAJOR}+ - older Node skips the optional dependency at install time`

function isModuleNotFound(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND'
}

/** `import('miniflare')`, with a missing package explained rather than passed through */
async function loadMiniflare(): Promise<typeof MiniflareModule> {
  try {
    return await import('miniflare')
  } catch (error) {
    if (!isModuleNotFound(error)) throw error
    const major = Number(process.versions.node.split('.')[0])
    const running =
      major < MINIFLARE_MIN_NODE_MAJOR ? ` (running Node ${process.versions.node})` : ''
    throw new Error(
      `${MINIFLARE_UNAVAILABLE_ERROR}${running}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    )
  }
}

/**
 * Node-side preprocessing: import normalization only. JSX/TypeScript are
 * transformed by `evaluate()` itself, inside the host worker (see
 * `./transform.ts`), so the source reaches the worker exactly as written.
 */
function prepareOptions(options: EvaluateOptions): EvaluateOptions {
  return { ...options, imports: normalizeImports(options.imports) }
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
  /**
   * Set the moment teardown of this host begins, before workerd is killed.
   * An evaluation still in flight on the host reports it instead of the
   * transport error the kill produces.
   */
  teardown: string | null
}

/**
 * A local sandbox runtime: one Miniflare 5 host worker with a `loader` binding.
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
 * the same `evaluate()` that runs on Cloudflare - with `env.loader` provided
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
  /** The host `hostPromise` resolved to, once it has; null while starting or after teardown */
  let current: Host | null = null
  /** Evaluations currently awaiting the host; the host is unref'd at zero */
  let inFlight = 0

  const createHost = async (): Promise<Host> => {
    const { Miniflare } = await loadMiniflare()
    const { mainModule, modules } = getHostWorker()
    const before = new Set(activeHandles())
    // Native Miniflare 5 options: one `workers[].config` per worker with a
    // `manifest` of modules and the loader as `env.loader: { type:
    // 'worker-loader' }`. The Miniflare 4 shape (`modules: true`, `script`,
    // `workerLoaders: { loader: {} }`) is not used; Miniflare 5 only accepts it
    // through its `convertV4MiniflareOptions()` shim, which went with the pool.
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
            env: { loader: { type: 'worker-loader' } },
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
    return { miniflare, handles, teardown: null }
  }

  const getHost = (): Promise<Host> => {
    if (hostPromise) return hostPromise
    const starting: Promise<Host> = createHost().then(
      (host) => {
        // Unless torn down while it was still starting
        if (hostPromise === starting) current = host
        return host
      },
      (error: unknown) => {
        if (hostPromise === starting) hostPromise = null
        throw error
      }
    )
    hostPromise = starting
    return starting
  }

  /**
   * Tear down the current host, if there is one. `reason` is what evaluations
   * still in flight on it report. The next `getHost()` starts a fresh host,
   * possibly while this teardown is still running - the two never share
   * handles, so that is fine.
   */
  const teardown = async (reason: string): Promise<void> => {
    const pending = hostPromise
    hostPromise = null
    current = null
    if (!pending) return
    let host: Host
    try {
      host = await pending
    } catch {
      return // Failed to start - nothing to release
    }
    host.teardown = reason
    // An idle host's handles are unref'd; hold the loop open until teardown
    // (kill workerd, close the loopback server) has actually completed, or
    // an `await dispose()` at the tail of a script exits unsettled.
    setHandlesActive(host.handles, true)
    // Miniflare SIGKILLs workerd, so a wedged child cannot hold this up.
    await host.miniflare.dispose().catch(() => {})
  }

  /**
   * Retire `host` because an evaluation on it hit the Node backstop. Only the
   * host that wedged is torn down: if it has already been replaced (another
   * evaluation got there first, or the caller disposed), the replacement is
   * left alone.
   */
  const retire = (host: Host): Promise<void> =>
    current === host ? teardown(WEDGED_HOST_ERROR) : Promise.resolve()

  const dispose = (): Promise<void> => teardown(DISPOSED_HOST_ERROR)

  const evaluate = async (options: EvaluateOptions): Promise<EvaluateResult> => {
    const start = Date.now()
    const timeout = options.timeout ?? DEFAULT_TIMEOUT
    const fail = (error: string): EvaluateResult => ({
      success: false,
      logs: [],
      error,
      duration: Date.now() - start,
    })
    // The host is reached over an HTTP/JSON boundary, which cannot carry an
    // RPC stub, and a structured value would arrive silently JSON-narrowed.
    // Refuse instead of forwarding something other than what was passed.
    const bindingKeys = Object.keys(options.bindings ?? {})
    if (bindingKeys.length > 0) {
      return fail(
        `bindings (${bindingKeys.join(
          ', '
        )}) need a live worker_loaders binding: pass the host env ` +
          '(with `loader`) to evaluate(), or use `env` for string values. The local Node host ' +
          'cannot receive RPC stubs from the Node side.'
      )
    }
    // Tail workers are stubs too: JSON would turn them into `{}`.
    if (options.tails !== undefined && options.tails.length > 0) {
      return fail(
        'tails need a live worker_loaders binding: pass the host env (with `loader`) to ' +
          'evaluate(). The local Node host cannot receive tail worker stubs from the Node side.'
      )
    }
    inFlight++
    let host: Host | null = null
    // The backstop clock starts once the host is ready: host startup is not
    // the script's time, and a cold start must never register as a timeout.
    let backstop: AbortSignal | null = null
    try {
      host = await getHost()
      setHandlesActive(host.handles, true)
      backstop = AbortSignal.timeout(timeout + TIMEOUT_GRACE_MS)
      const response = await host.miniflare.dispatchFetch(
        `http://${HOST_WORKER_NAME}${EVALUATE_PATH}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(options),
          signal: backstop,
        }
      )
      const result = (await response.json()) as EvaluateResult
      return { ...result, duration: Date.now() - start }
    } catch (error) {
      if (host && backstop?.aborted) {
        // The host did not answer in time: a CPU-bound loop has wedged the
        // local workerd. Tear it down so the next call gets a fresh host.
        await retire(host)
        return fail(`Timeout: Script execution exceeded ${timeout}ms`)
      }
      if (host?.teardown) {
        // Killed out from under this evaluation by a retire or a dispose
        return fail(host.teardown)
      }
      return fail(error instanceof Error ? error.message : String(error))
    } finally {
      inFlight--
      // Idle the host that is current now - not `host`, which may since have
      // been retired and replaced while this evaluation was in flight.
      if (inFlight === 0 && current) setHandlesActive(current.handles, false)
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
 * With an `env` that carries a `loader` binding this calls
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
    if (env?.loader) {
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
