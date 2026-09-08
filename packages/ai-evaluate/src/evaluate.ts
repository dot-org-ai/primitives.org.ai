/**
 * Evaluate code in a sandboxed environment
 *
 * Uses Cloudflare Dynamic Workers (the `worker_loaders` binding) for secure
 * code execution. For Node.js/local development, import from 'ai-evaluate/node',
 * which runs this exact module inside a Miniflare host worker with a real
 * `LOADER` binding, so local and production share one code path.
 *
 * Requires:
 * - LOADER binding (worker_loaders)
 * - TEST binding (ai-tests service) - optional. When absent, tests run on the
 *   embedded (in-worker) test runner instead of the ai-tests RPC runner.
 */

import type {
  EvaluateOptions,
  EvaluateResult,
  FetchConfig,
  WorkerLoader,
  WorkerEntrypoint,
  SandboxEnv,
  WorkerCode,
} from './types.js'
import {
  generateWorkerCode,
  generateFetchControlCode,
  transformModuleCode,
  getExportNames,
} from './worker-template/index.js'
import { CAPNWEB_SOURCE } from './capnweb-bundle.js'
import { transformOptions } from './transform.js'
import {
  COMPATIBILITY_DATE,
  SANDBOX_URL,
  generateSandboxId,
  normalizeImport,
  extractPackageName,
} from './shared.js'

/** Default per-evaluation timeout in milliseconds */
export const DEFAULT_TIMEOUT = 5000

/**
 * Run the sandbox worker's `/execute` route with a wall-clock timeout.
 *
 * Uses `AbortSignal.timeout` so the timeout is enforced by whichever runtime
 * hosts `evaluate()` (Cloudflare in production, the Miniflare host worker
 * locally). Note that a CPU-bound loop in the loaded worker cannot be
 * interrupted from JS; Cloudflare enforces CPU limits for that case, and the
 * local runtime (`ai-evaluate/node`) adds a Node-side backstop.
 */
async function executeWithTimeout(
  entrypoint: WorkerEntrypoint,
  timeout: number
): Promise<EvaluateResult> {
  const signal = AbortSignal.timeout(timeout)
  const timeoutError = () => new Error(`Timeout: Script execution exceeded ${timeout}ms`)
  const timedOut = new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(timeoutError()))
  })
  const response = await Promise.race([
    entrypoint.fetch(new Request(SANDBOX_URL, { signal })).catch((error: unknown) => {
      // The runtime's own cancellation message must not shadow the timeout
      throw signal.aborted ? timeoutError() : error
    }),
    timedOut,
  ])
  return (await response.json()) as EvaluateResult
}

/**
 * Generate a minimal worker for simple script execution
 * This doesn't require capnweb or TEST binding
 */
function generateSimpleWorkerCode(options: {
  module?: string
  script?: string
  imports?: string[]
  fetch?: FetchConfig | undefined
}): string {
  const { module: rawModule = '', script = '', imports = [], fetch: fetchOption } = options

  // Module code may use `exports.x =` or `export const x =`; both become
  // properties of `exports`, then top-level bindings the script can call.
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const exportNames = getExportNames(rawModule)

  // Build import statements for pre-fetched external modules
  // Modules are fetched by the host worker and included in the worker definition
  const importStatements = imports
    .map((url, i) => `import * as __import${i}__ from './__external_${i}__.js';`)
    .join('\n')

  // Make imports available as globals
  const importGlobals = imports
    .map((specifier, i) => {
      const pkgName = extractPackageName(specifier, i)
      const varName = pkgName === 'lodash' ? '_' : pkgName
      return `globalThis.${varName} = __import${i}__.default || __import${i}__;
globalThis.pkg = __import${i}__.default || __import${i}__;`
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

${generateFetchControlCode(fetchOption)}

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
console.debug = captureConsole('debug');

// Make imports available globally
${importGlobals}

// User module code (if any)
const exports = {};
${
  module
    ? `
try {
${module}
} catch (e) {
  console.error('Module error:', e.message);
}
const { ${exportNames} } = exports;
`
    : '// No module code provided'
}

// Logs from module evaluation belong to every request; logs from a previous
// request on a reused (content-addressed) isolate do not.
const __moduleLogCount__ = logs.length;

export default {
  async fetch(request, env) {
    logs.splice(__moduleLogCount__);
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
  rawOptions: EvaluateOptions,
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

    // JSX / TypeScript -> JavaScript here, in the worker that runs evaluate(),
    // before any worker code is generated: the content id then hashes the
    // source that actually runs, and local and production see the same bytes.
    const options = transformOptions(rawOptions)

    // Use simple worker for basic script execution (no tests, no SDK)
    const useSimpleWorker = !options.tests && !options.sdk

    if (useSimpleWorker) {
      return await evaluateSimple(options, loader, start)
    }

    // Use full worker template for tests and SDK features. The TEST (ai-tests)
    // binding is optional: without it the worker embeds its own test runner.
    return await evaluateWithWorkerLoader(options, loader, env?.test || env?.TEST, start)
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
 * Pre-fetch external modules from URLs or package names
 * Returns a map of module name to source code
 *
 * Supports:
 * - Full URLs: https://esm.sh/lodash@4.17.21
 * - Bare package names: lodash, lodash@4.17.21, @scope/pkg
 *
 * Handles esm.sh's redirect-style modules by following the internal import paths.
 */
async function prefetchModules(imports: string[]): Promise<Record<string, string>> {
  const modules: Record<string, string> = {}

  await Promise.all(
    imports.map(async (specifier, i) => {
      try {
        // Normalize bare package names to esm.sh URLs
        const url = normalizeImport(specifier)

        // For esm.sh URLs, try to get the bundled version directly
        let fetchUrl = url
        if (url.includes('esm.sh/') && !url.includes('.mjs') && !url.includes('.js')) {
          // Parse the esm.sh URL to construct the bundle path
          // e.g., https://esm.sh/lodash@4.17.21 -> https://esm.sh/lodash@4.17.21/es2022/lodash.bundle.mjs
          const urlObj = new URL(url)
          const pathParts = urlObj.pathname.slice(1).split('/')
          const pkgSpec = pathParts[0] // e.g., "lodash@4.17.21"
          const pkgName = pkgSpec?.split('@')[0] ?? 'pkg'
          fetchUrl = `${urlObj.origin}/${pkgSpec}/es2022/${pkgName}.bundle.mjs`
        }

        const response = await fetch(fetchUrl, { redirect: 'follow' })
        if (!response.ok) {
          // Fallback to original URL if bundle URL fails
          const fallbackResponse = await fetch(url, { redirect: 'follow' })
          if (!fallbackResponse.ok) {
            throw new Error(`Failed to fetch ${url}: ${fallbackResponse.status}`)
          }
          const source = await fallbackResponse.text()
          modules[`__external_${i}__.js`] = source
          return
        }
        const source = await response.text()
        // Use a simple module name that can be imported
        const moduleName = `__external_${i}__.js`
        modules[moduleName] = source
      } catch (error) {
        throw new Error(
          `Failed to fetch import ${specifier}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    })
  )

  return modules
}

/**
 * Simple evaluation without capnweb/TEST dependencies
 */
async function evaluateSimple(
  options: EvaluateOptions,
  loader: WorkerLoader,
  start: number
): Promise<EvaluateResult> {
  // Pre-fetch any external modules
  let externalModules: Record<string, string> = {}
  if (options.imports && options.imports.length > 0) {
    try {
      externalModules = await prefetchModules(options.imports)
    } catch (error) {
      return {
        success: false,
        logs: [],
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      }
    }
  }

  const workerCode = generateSimpleWorkerCode({
    ...(options.module !== undefined && { module: options.module }),
    ...(options.script !== undefined && { script: options.script }),
    ...(options.imports !== undefined && { imports: options.imports }),
    ...(options.fetch !== undefined && { fetch: options.fetch }),
  })

  const id = generateSandboxId(workerCode)

  const worker = loader.get(
    id,
    async (): Promise<WorkerCode> => ({
      mainModule: 'worker.js',
      modules: {
        'worker.js': workerCode,
        ...externalModules,
      },
      compatibilityDate: COMPATIBILITY_DATE,
      // Block network if fetch is false or null
      globalOutbound: options.fetch === false || options.fetch === null ? null : undefined,
    })
  )

  // Get the entrypoint and call fetch
  const result = await executeWithTimeout(
    worker.getEntrypoint(),
    options.timeout ?? DEFAULT_TIMEOUT
  )

  return {
    ...result,
    duration: Date.now() - start,
  }
}

/**
 * Evaluate using the full worker template (capnweb export RPC, SDK, tests).
 *
 * With a TEST binding the worker proxies assertions to ai-tests over RPC;
 * without one it runs the embedded test framework.
 */
async function evaluateWithWorkerLoader(
  options: EvaluateOptions,
  loader: WorkerLoader,
  testService: unknown,
  start: number
): Promise<EvaluateResult> {
  const workerCode = generateWorkerCode({
    testRunner: testService ? 'rpc' : 'embedded',
    ...(options.module !== undefined && { module: options.module }),
    ...(options.tests !== undefined && { tests: options.tests }),
    ...(options.script !== undefined && { script: options.script }),
    ...(options.sdk !== undefined && { sdk: options.sdk }),
    ...(options.imports !== undefined && { imports: options.imports }),
    ...(options.fetch !== undefined && { fetch: options.fetch }),
  })
  const id = generateSandboxId(workerCode)

  const worker = loader.get(
    id,
    async (): Promise<WorkerCode> => ({
      mainModule: 'worker.js',
      modules: {
        'worker.js': workerCode,
        // Include capnweb as a module so the worker can import it
        'capnweb.js': CAPNWEB_SOURCE,
      },
      compatibilityDate: COMPATIBILITY_DATE,
      // Block network if fetch is false or null
      globalOutbound: options.fetch === false || options.fetch === null ? null : undefined,
      // Cloudflare Dynamic Workers' loader-factory field is `env`, not `bindings`.
      // The loaded worker reads `env.TEST` (see worker-template/core.ts) only in
      // 'rpc' mode, so the binding is passed through only when present.
      env: testService ? { TEST: testService } : {},
    })
  )

  // Get the entrypoint and call fetch (required by Cloudflare worker_loaders API)
  const result = await executeWithTimeout(
    worker.getEntrypoint(),
    options.timeout ?? DEFAULT_TIMEOUT
  )

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
