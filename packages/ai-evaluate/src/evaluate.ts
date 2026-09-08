/**
 * Evaluate code in a sandboxed environment
 *
 * Uses Cloudflare Dynamic Workers (the `worker_loaders` binding) for secure
 * code execution. For Node.js/local development, import from 'ai-evaluate/node',
 * which runs this exact module inside a Miniflare host worker with a real
 * `loader` binding, so local and production share one code path.
 *
 * Requires (see `SandboxEnv`):
 * - `env.loader` (worker_loaders binding)
 * - `env.test` (ai-tests service binding) - optional. When absent, tests run
 *   on the embedded (in-worker) test runner instead of the ai-tests RPC runner.
 *
 * The loaded worker's own `env` is an explicit allowlist built by
 * `buildSandboxEnv`: strings from `options.env`, RPC stubs and
 * structured-cloneable values from `options.bindings`, plus the ai-tests
 * binding as `TEST` on the RPC runner. Nothing else from the host env reaches
 * the isolate.
 */

import type {
  EvaluateOptions,
  EvaluateResult,
  FetchConfig,
  Isolation,
  WorkerLoader,
  WorkerEntrypoint,
  WorkerStub,
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
import { buildSandboxEnv, TEST_BINDING_KEY } from './validation.js'
import {
  COMPATIBILITY_DATE,
  SANDBOX_URL,
  workerCodeId,
  normalizeImport,
  extractPackageName,
} from './shared.js'

/** Default per-evaluation timeout in milliseconds */
export const DEFAULT_TIMEOUT = 5000

/**
 * Default isolate reuse policy: a new, uncached isolate per evaluation.
 *
 * The user module runs at module scope of the generated worker, so a reused
 * isolate carries every module-scope binding (let/const, exported arrays and
 * objects, the `exports` record) into the next evaluation of the same spec.
 * `'fresh'` keeps identical calls independent (the 2.x behaviour); `'cached'`
 * is the opt-in per-unique-worker/day cost control.
 */
export const DEFAULT_ISOLATION: Isolation = 'fresh'

/**
 * Run the sandbox worker's `/execute` route with a wall-clock timeout.
 *
 * Uses `AbortSignal.timeout` so the timeout is enforced by whichever runtime
 * hosts `evaluate()` (Cloudflare in production, the Miniflare host worker
 * locally). A CPU-bound loop in the loaded worker cannot be interrupted from
 * JS - the signal is only observed when the loop yields, which it never does:
 *
 * - On Cloudflare the loaded worker's CPU budget is bound to `timeout` via
 *   the entrypoint's `limits.cpuMs` (see `runWorker`), so the runtime throws
 *   out of the loop and this call rejects with the runtime's CPU-limit error.
 * - Local open-source workerd accepts `limits.cpuMs` but does not enforce
 *   it, and runs every loaded worker on the host's single thread, so the loop
 *   also stalls this timer. `ai-evaluate/node` adds a Node-side backstop that
 *   aborts the request and replaces the wedged host (see `node.ts`).
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
  async fetch(request, __env__) {
    logs.splice(__moduleLogCount__);
    // The sandbox env, as the script sees it: a frozen copy of the allowlisted
    // bindings the loader was given (see buildSandboxEnv), nothing else.
    const env = Object.freeze({ ...__env__ });
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
    // Require the worker_loaders binding as `env.loader` (3.0: no uppercase alias)
    const loader = env?.loader
    if (!loader) {
      return {
        success: false,
        logs: [],
        error:
          'Sandbox requires worker_loaders binding `loader`. Add to wrangler.jsonc: "worker_loaders": [{ "binding": "loader" }]. For Node.js, use: import { evaluate } from "ai-evaluate/node"',
        duration: Date.now() - start,
      }
    }

    // JSX / TypeScript -> JavaScript here, in the worker that runs evaluate(),
    // before any worker code is generated: the content id then hashes the
    // source that actually runs, and local and production see the same bytes.
    const options = transformOptions(rawOptions)

    return await runWorker(options, loader, env?.test, start)
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
 * Build the `WorkerCode` spec for an evaluation - the single object that is
 * both content-addressed (`workerCodeId`) and handed to the loader.
 *
 * Two templates share this path:
 * - without `tests`/`sdk`, the minimal worker (`generateSimpleWorkerCode`),
 *   plus any pre-fetched `imports` as sibling modules;
 * - otherwise the full template (capnweb export RPC, SDK, tests). The
 *   ai-tests binding is optional: without it the worker embeds its own test
 *   runner, and the binding is passed through as `env.TEST` only when present.
 *
 * Both templates get the same `env`: the allowlisted sandbox env from
 * `buildSandboxEnv` (strings from `options.env`, RPC stubs and cloneable
 * values from `options.bindings`). A value that fails that validator throws a
 * `ValidationError` here, before any loader call.
 *
 * `fetch: false | null` blocks outbound network at the runtime level
 * (`globalOutbound: null`) in addition to the in-worker fetch control.
 */
export async function buildWorkerCode(
  options: EvaluateOptions,
  testService?: unknown
): Promise<WorkerCode> {
  const useSimpleWorker = !options.tests && !options.sdk
  const globalOutbound = options.fetch === false || options.fetch === null ? null : undefined
  const env = buildSandboxEnv(options)

  if (useSimpleWorker) {
    const externalModules =
      options.imports && options.imports.length > 0 ? await prefetchModules(options.imports) : {}
    const workerCode = generateSimpleWorkerCode({
      ...(options.module !== undefined && { module: options.module }),
      ...(options.script !== undefined && { script: options.script }),
      ...(options.imports !== undefined && { imports: options.imports }),
      ...(options.fetch !== undefined && { fetch: options.fetch }),
    })
    return {
      mainModule: 'worker.js',
      modules: { 'worker.js': workerCode, ...externalModules },
      compatibilityDate: COMPATIBILITY_DATE,
      globalOutbound,
      env,
    }
  }

  const workerCode = generateWorkerCode({
    testRunner: testService ? 'rpc' : 'embedded',
    ...(options.module !== undefined && { module: options.module }),
    ...(options.tests !== undefined && { tests: options.tests }),
    ...(options.script !== undefined && { script: options.script }),
    ...(options.sdk !== undefined && { sdk: options.sdk }),
    ...(options.imports !== undefined && { imports: options.imports }),
    ...(options.fetch !== undefined && { fetch: options.fetch }),
  })
  return {
    mainModule: 'worker.js',
    modules: {
      'worker.js': workerCode,
      // capnweb is a module so the worker can import it
      'capnweb.js': CAPNWEB_SOURCE,
    },
    compatibilityDate: COMPATIBILITY_DATE,
    globalOutbound,
    // Cloudflare Dynamic Workers' loader field is `env`, not `bindings`. The
    // loaded worker reads `env.TEST` (see worker-template/core.ts) only in
    // 'rpc' mode, so the binding is passed through only when present.
    env: testService ? { ...env, [TEST_BINDING_KEY]: testService } : env,
  }
}

/**
 * Obtain a worker stub for a spec under the requested isolation policy.
 *
 * - `'fresh'` (default): `loader.load(code)` - a new, uncached isolate;
 *   nothing at module scope survives between evaluations.
 * - `'cached'`: `loader.get(workerCodeId(code), () => code)` - the loader
 *   calls the factory only when no isolate with that id is live, so identical
 *   specs share one isolate (one unique worker per distinct spec) and its
 *   module-scope state.
 */
export function loadWorker(
  loader: WorkerLoader,
  code: WorkerCode,
  isolation: Isolation = DEFAULT_ISOLATION
): WorkerStub {
  if (isolation === 'fresh') return loader.load(code)
  return loader.get(workerCodeId(code), () => code)
}

/**
 * Build, load and run the sandbox worker for one evaluation.
 */
async function runWorker(
  options: EvaluateOptions,
  loader: WorkerLoader,
  testService: unknown,
  start: number
): Promise<EvaluateResult> {
  const code = await buildWorkerCode(options, testService)
  const worker = loadWorker(loader, code, options.isolation)
  const timeout = options.timeout ?? DEFAULT_TIMEOUT

  // Bind the loaded worker's CPU budget to the wall-clock timeout. CPU time
  // never exceeds wall time, so `cpuMs = timeout` cannot cut off a script the
  // timeout would have let finish, and it is the only thing that stops a
  // CPU-bound loop: `AbortSignal.timeout` is never observed by code that does
  // not yield. Limits set on the entrypoint narrow the spec's own `limits`
  // (the lower wins) without changing its content-addressed id, so the same
  // code with different timeouts is still one cached isolate. Cloudflare
  // enforces the limit; open-source workerd (local) accepts and ignores it.
  const entrypoint = worker.getEntrypoint(undefined, { limits: { cpuMs: timeout } })
  const result = await executeWithTimeout(entrypoint, timeout)

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
