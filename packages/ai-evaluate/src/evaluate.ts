/**
 * Evaluate code in a sandboxed environment
 *
 * Uses Cloudflare worker_loaders for secure code execution.
 * For Node.js/local development, import from 'ai-evaluate/node' instead.
 *
 * Requires:
 * - LOADER binding (worker_loaders)
 * - TEST binding (ai-tests service)
 */

import type { EvaluateOptions, EvaluateResult, WorkerLoader, SandboxEnv } from './types.js'
import { generateWorkerCode } from './worker-template.js'

/**
 * Evaluate code in a sandboxed worker
 *
 * @example
 * ```ts
 * import { evaluate } from 'ai-evaluate'
 *
 * // Run a simple script
 * const result = await evaluate({
 *   script: 'return 1 + 1'
 * }, env)
 * // { success: true, value: 2, logs: [], duration: ... }
 * ```
 */
export async function evaluate(
  options: EvaluateOptions,
  env?: SandboxEnv
): Promise<EvaluateResult> {
  const start = Date.now()

  try {
    // Require worker_loaders binding (check lowercase first, then legacy uppercase)
    const loader = env?.loader || env?.LOADER
    if (!loader) {
      return {
        success: false,
        logs: [],
        error:
          'Sandbox requires worker_loaders binding. Add to wrangler.jsonc: "worker_loaders": [{ "binding": "loader" }]. For Node.js, use: import { evaluate } from "ai-evaluate/node"',
        duration: Date.now() - start,
      }
    }

    return await evaluateWithWorkerLoader(options, loader, env?.TEST, start)
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
 * Evaluate using Cloudflare worker_loaders binding
 */
async function evaluateWithWorkerLoader(
  options: EvaluateOptions,
  loader: WorkerLoader,
  testService: unknown,
  start: number
): Promise<EvaluateResult> {
  const workerCode = generateWorkerCode({
    module: options.module,
    tests: options.tests,
    script: options.script,
    sdk: options.sdk,
    imports: options.imports,
  })
  const id = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const worker = loader.get(id, async () => ({
    mainModule: 'worker.js',
    modules: {
      'worker.js': workerCode,
    },
    compatibilityDate: '2026-01-01',
    // Block network access only if fetch: null
    globalOutbound: options.fetch === null ? null : undefined,
    bindings: {
      TEST: testService,
    },
  }))

  // Get the entrypoint and call fetch (required by Cloudflare worker_loaders API)
  const entrypoint = worker.getEntrypoint()
  const response = await entrypoint.fetch(new Request('http://sandbox/execute'))
  const result = (await response.json()) as EvaluateResult

  return {
    ...result,
    duration: Date.now() - start,
  }
}

/**
 * Create an evaluate function bound to a specific environment
 *
 * Useful for Cloudflare Workers where env is passed to fetch handler.
 *
 * @example
 * ```ts
 * // In a Cloudflare Worker
 * export default {
 *   async fetch(request, env) {
 *     const sandbox = createEvaluator(env)
 *     const result = await sandbox({ script: '1 + 1' })
 *     return Response.json(result)
 *   }
 * }
 * ```
 */
export function createEvaluator(env: SandboxEnv) {
  return (options: EvaluateOptions) => evaluate(options, env)
}
