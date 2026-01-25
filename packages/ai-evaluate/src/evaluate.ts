/**
 * Evaluate code in a sandboxed environment
 *
 * Uses Cloudflare worker_loaders for secure code execution.
 * For Node.js/local development, import from 'ai-evaluate/node' instead.
 *
 * Requires:
 * - LOADER binding (worker_loaders)
 * - TEST binding (ai-tests service) - optional, only needed for test assertions
 */

import type { EvaluateOptions, EvaluateResult, WorkerLoader, SandboxEnv } from './types.js'
import { generateWorkerCode } from './worker-template.js'
import { CAPNWEB_SOURCE } from './capnweb-bundle.js'

/**
 * Compatibility date for dynamic workers (2026)
 */
const COMPATIBILITY_DATE = '2026-01-01'

/**
 * Generate a minimal worker for simple script execution
 * This doesn't require capnweb or TEST binding
 */
function generateSimpleWorkerCode(options: {
  module?: string
  script?: string
  imports?: string[]
}): string {
  const { module = '', script = '', imports = [] } = options

  // Build import statements for ESM imports (e.g., from esm.sh)
  const importStatements = imports
    .map((url, i) => `import __import${i}__ from '${url}';`)
    .join('\n')

  // Make imports available as globals
  const importGlobals = imports
    .map((url, i) => {
      // Extract package name from URL for variable naming
      const match = url.match(/esm\.sh\/([^@/]+)/)
      const pkgName = match ? match[1].replace(/-/g, '_') : `pkg${i}`
      const varName = pkgName === 'lodash' ? '_' : pkgName
      return `globalThis.${varName} = __import${i}__;
globalThis.pkg = __import${i}__;`
    })
    .join('\n')

  // Wrap script to capture return value (code is embedded at build time, no eval)
  const wrappedScript = script
    ? `const __executeScript__ = async () => { ${script} }; const __result__ = await __executeScript__();`
    : 'const __result__ = undefined;'

  return `
// Simple Sandbox Worker
${importStatements}

const logs = [];

// Capture console output
const originalConsole = { ...console };
const captureConsole = (level) => (...args) => {
  logs.push({
    level,
    message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
    timestamp: Date.now()
  });
  originalConsole[level](...args);
};
console.log = captureConsole('log');
console.warn = captureConsole('warn');
console.error = captureConsole('error');
console.info = captureConsole('info');

// Make imports available globally
${importGlobals}

// User module code (if any)
${module}

export default {
  async fetch(request, env) {
    try {
      // Execute the script (embedded at generation time - no new Function())
      ${wrappedScript}

      return Response.json({
        success: true,
        value: __result__,
        logs,
        duration: 0
      });
    } catch (error) {
      return Response.json({
        success: false,
        error: error.message || String(error),
        logs,
        duration: 0
      });
    }
  }
};
`
}

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
          'Sandbox requires worker_loaders binding. Add to wrangler.toml: [[worker_loaders]] binding = "LOADER". For Node.js, use: import { evaluate } from "ai-evaluate/node"',
        duration: Date.now() - start,
      }
    }

    // Use simple worker for basic script execution (no tests, no SDK)
    const useSimpleWorker = !options.tests && !options.sdk

    if (useSimpleWorker) {
      return await evaluateSimple(options, loader, start)
    }

    // Use full worker template for tests and SDK features
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
 * Simple evaluation without capnweb/TEST dependencies
 */
async function evaluateSimple(
  options: EvaluateOptions,
  loader: WorkerLoader,
  start: number
): Promise<EvaluateResult> {
  const workerCode = generateSimpleWorkerCode({
    module: options.module,
    script: options.script,
    imports: options.imports,
  })

  const id = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const worker = loader.get(id, async () => ({
    mainModule: 'worker.js',
    modules: {
      'worker.js': workerCode,
    },
    compatibilityDate: COMPATIBILITY_DATE,
    // Block network access only if fetch: null
    globalOutbound: options.fetch === null ? null : undefined,
  }))

  // Get the entrypoint and call fetch
  const entrypoint = worker.getEntrypoint()
  const response = await entrypoint.fetch(new Request('http://sandbox/execute'))
  const result = (await response.json()) as EvaluateResult

  return {
    ...result,
    duration: Date.now() - start,
  }
}

/**
 * Evaluate using full worker template with capnweb and TEST binding
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
      // Include capnweb as a module so the worker can import it
      'capnweb.js': CAPNWEB_SOURCE,
    },
    compatibilityDate: COMPATIBILITY_DATE,
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
