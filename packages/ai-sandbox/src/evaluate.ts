/**
 * Evaluate code in a sandboxed environment
 *
 * Uses Cloudflare worker_loaders in production,
 * Miniflare in development/Node.
 *
 * Requires ai-tests service binding (TEST) for assertions and test running.
 */

import type {
  EvaluateOptions,
  EvaluateResult,
  WorkerLoader,
  SandboxEnv
} from './types.js'
import { generateWorkerCode, generateDevWorkerCode } from './worker-template.js'

/**
 * Evaluate code in a sandboxed worker
 *
 * @example
 * ```ts
 * import { evaluate } from 'ai-sandbox'
 *
 * // Run a simple script
 * const result = await evaluate({
 *   script: 'return 1 + 1'
 * })
 * // { success: true, value: 2, logs: [], duration: ... }
 *
 * // With a module and tests
 * const result = await evaluate({
 *   module: `
 *     exports.add = (a, b) => a + b;
 *     exports.multiply = (a, b) => a * b;
 *   `,
 *   tests: `
 *     describe('math', () => {
 *       it('adds numbers', () => {
 *         expect(add(2, 3)).toBe(5);
 *       });
 *       it('multiplies numbers', () => {
 *         expect(multiply(2, 3)).toBe(6);
 *       });
 *     });
 *   `,
 *   script: 'return add(10, 20)'
 * })
 * ```
 */
export async function evaluate(
  options: EvaluateOptions,
  env?: SandboxEnv
): Promise<EvaluateResult> {
  const start = Date.now()

  try {
    // Use worker_loaders if available (Cloudflare Workers)
    if (env?.LOADER && env?.TEST) {
      return await evaluateWithWorkerLoader(options, env.LOADER, env.TEST, start)
    }

    // Fall back to Miniflare with local TestService (Node.js)
    return await evaluateWithMiniflare(options, start)
  } catch (error) {
    return {
      success: false,
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start
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
  const workerCode = generateWorkerCode(options)
  const id = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const worker = loader.get(id, async () => ({
    mainModule: 'worker.js',
    modules: {
      'worker.js': workerCode
    },
    compatibilityDate: '2024-01-01',
    // Block network access only if fetch: null
    globalOutbound: options.fetch === null ? null : undefined,
    bindings: {
      TEST: testService
    }
  }))

  const response = await worker.fetch(new Request('http://sandbox/execute'))
  const result = await response.json() as EvaluateResult

  return {
    ...result,
    duration: Date.now() - start
  }
}

/**
 * Evaluate using Miniflare (for Node.js/development)
 *
 * For local dev, we use generateDevWorkerCode which bundles the test
 * framework directly. In production, the sandbox worker uses RPC to
 * a deployed ai-tests worker.
 */
async function evaluateWithMiniflare(
  options: EvaluateOptions,
  start: number
): Promise<EvaluateResult> {
  // Dynamic import to avoid bundling in production
  const { Miniflare } = await import('miniflare')

  const workerCode = generateDevWorkerCode(options)

  const mf = new Miniflare({
    modules: true,
    script: workerCode,
    compatibilityDate: '2024-01-01'
  })

  try {
    const response = await mf.dispatchFetch('http://sandbox/execute')
    const result = await response.json() as EvaluateResult

    return {
      ...result,
      duration: Date.now() - start
    }
  } finally {
    await mf.dispose()
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
