/**
 * Sandbox execution boundary for ai-functions.
 *
 * ALL dynamic code execution in ai-functions is delegated to ai-evaluate's
 * V8-isolate sandbox (Cloudflare Dynamic Workers). `new Function`/`eval` are
 * banned in this package — they are broken under Workers and unsandboxed under
 * Node.
 *
 * ## The env boundary
 *
 * "Zero env plumbing" is NOT achievable:
 * - The Workers entry (`ai-evaluate`) requires a `loader` binding (and, for the
 *   test path, a `test` service binding) to be passed in `env`.
 * - That entry imports `cloudflare:workers` lazily, but is built for workerd;
 *   the local runtime lives in `ai-evaluate/node`, which must not be imported
 *   eagerly in a Worker.
 *
 * The clean boundary is therefore an **explicit, optional `env`**:
 * - When a host Workers `env` carrying `env.loader` is supplied, run on the
 *   real Dynamic Workers loader via `ai-evaluate`. ai-evaluate 3.0 reads
 *   exactly `env.loader` / `env.test`; the uppercase `LOADER` / `TEST` aliases
 *   2.x accepted are gone, so an env with only `LOADER` takes the Node path.
 * - When absent (Node / dev / tests), import from `ai-evaluate/node` and run on
 *   a local runtime (`createLocalRuntime()`: a Miniflare 5 host worker with a
 *   real loader binding, Node >= 22) owned by this module.
 *
 * The `ai-evaluate/node` module is only imported when no `env.loader` is
 * present, so a Node process never pulls in workerd-only code and a Worker
 * never pulls in Miniflare.
 *
 * The local runtime is created lazily on the first Node-path call and reused.
 * Its host is unref'd while idle, so a process exits on its own without any
 * teardown; `disposeSandbox()` releases it early (test teardown) and is a
 * no-op if it was never created. It only touches the runtime this module
 * made, never ai-evaluate's process-wide host.
 */

import type { EvaluateOptions, EvaluateResult, SandboxEnv } from 'ai-evaluate'
import type { LocalRuntime } from 'ai-evaluate/node'

export type { SandboxEnv } from 'ai-evaluate'

/** The local runtime behind the Node fallback, once the Node path has been used */
let localRuntime: LocalRuntime | null = null

/** Create the local runtime on first use; one per module instance */
async function getLocalRuntime(): Promise<LocalRuntime> {
  if (!localRuntime) {
    const { createLocalRuntime } = await import('ai-evaluate/node')
    localRuntime = createLocalRuntime()
  }
  return localRuntime
}

/**
 * Run an evaluation in the appropriate sandbox.
 *
 * @param options - What to evaluate (`script`, or `module` + `tests`, etc.)
 * @param env - Optional host Workers env carrying `loader` (+ `test` for the
 *   test path). When omitted - or when it has no `loader` - falls back to the
 *   local runtime from `ai-evaluate/node`.
 */
export async function runInSandbox(
  options: EvaluateOptions,
  env?: SandboxEnv
): Promise<EvaluateResult> {
  if (env?.loader) {
    // Host Workers env present — use the Dynamic Workers loader entry.
    const { evaluate } = await import('ai-evaluate')
    return evaluate(options, env)
  }

  // No live Worker — use the local runtime (Miniflare 5 host). This module is
  // imported lazily so Workers never pull in Miniflare and Node processes
  // never load it until a sandboxed call needs it.
  const runtime = await getLocalRuntime()
  return runtime.evaluate(options)
}

/**
 * Shut down the local runtime behind the Node fallback, if one was created.
 * Not required for a process to exit (an idle host is unref'd); call it to
 * release the host early, e.g. from test teardown. The next Node-path call
 * starts a fresh runtime.
 */
export async function disposeSandbox(): Promise<void> {
  const runtime = localRuntime
  if (!runtime) return
  localRuntime = null
  await runtime.dispose()
}
