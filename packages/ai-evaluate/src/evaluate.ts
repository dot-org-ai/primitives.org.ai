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
import { generateWorkerCode } from './worker-template/index.js'
import { CAPNWEB_SOURCE } from './capnweb-bundle.js'
import { COMPATIBILITY_DATE, normalizeImport, extractPackageName } from './shared.js'

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
  })

  const id = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const worker = loader.get(id, async () => ({
    mainModule: 'worker.js',
    modules: {
      'worker.js': workerCode,
      ...externalModules,
    },
    compatibilityDate: COMPATIBILITY_DATE,
    // Block network if fetch is false or null
    globalOutbound: options.fetch === false || options.fetch === null ? null : undefined,
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
    ...(options.module !== undefined && { module: options.module }),
    ...(options.tests !== undefined && { tests: options.tests }),
    ...(options.script !== undefined && { script: options.script }),
    ...(options.sdk !== undefined && { sdk: options.sdk }),
    ...(options.imports !== undefined && { imports: options.imports }),
    ...(options.fetch !== undefined && { fetch: options.fetch }),
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
    // Block network if fetch is false or null
    globalOutbound: options.fetch === false || options.fetch === null ? null : undefined,
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
