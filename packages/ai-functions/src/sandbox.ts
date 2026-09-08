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
 * - The Workers entry (`ai-evaluate`) requires a `LOADER` binding (and, for the
 *   test path, a `TEST` service binding) to be passed in `env`.
 * - That entry imports `cloudflare:workers`, which is Node-incompatible, so it
 *   cannot be imported eagerly in a Node/dev process.
 *
 * The clean boundary is therefore an **explicit, optional `env`**:
 * - When a host Workers `env` (carrying `LOADER` + `TEST`) is supplied, run on
 *   the real Dynamic Workers loader via `ai-evaluate`.
 * - When absent (Node / dev / tests), import from `ai-evaluate/node`, which
 *   falls back to Miniflare and runs with no live Worker.
 *
 * The `ai-evaluate/node` module is only imported when no `env` is present, so a
 * Node process never pulls in `cloudflare:workers`.
 *
 * The Node entry keeps one Miniflare host per process. It is unref'd while
 * idle, so a process exits on its own without any teardown; `disposeSandbox()`
 * releases it early (test teardown) and is a no-op if it was never used.
 */

import type { EvaluateOptions, EvaluateResult, SandboxEnv } from 'ai-evaluate'

export type { SandboxEnv } from 'ai-evaluate'

/** Set once the Node entry has been imported, so `disposeSandbox` never loads it just to dispose */
let usedNodeEntry = false

/**
 * Run an evaluation in the appropriate sandbox.
 *
 * @param options - What to evaluate (`script`, or `module` + `tests`, etc.)
 * @param env - Optional host Workers env carrying `LOADER` (+ `TEST` for the
 *   test path). When omitted, falls back to the Miniflare-backed Node entry.
 */
export async function runInSandbox(
  options: EvaluateOptions,
  env?: SandboxEnv
): Promise<EvaluateResult> {
  if (env && (env.loader || env.LOADER)) {
    // Host Workers env present — use the Dynamic Workers loader entry.
    const { evaluate } = await import('ai-evaluate')
    return evaluate(options, env)
  }

  // No live Worker — use the Node entry (Miniflare fallback). This module is
  // imported lazily so Node processes never eagerly pull in `cloudflare:workers`.
  const { evaluate } = await import('ai-evaluate/node')
  usedNodeEntry = true
  return evaluate(options, env)
}

/**
 * Shut down the process-wide Miniflare host behind the Node fallback, if one
 * was created. Not required for a process to exit (an idle host is unref'd);
 * call it to release the host early, e.g. from test teardown.
 */
export async function disposeSandbox(): Promise<void> {
  if (!usedNodeEntry) return
  const { dispose } = await import('ai-evaluate/node')
  await dispose()
}
