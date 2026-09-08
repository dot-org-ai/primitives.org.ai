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
 *
 * Network policy is the loader's `globalOutbound`, never code in the isolate:
 * `null` for `fetch: false`, and for an allowlist or `outboundRpc` a loopback
 * stub of the host worker's `OutboundGateway` entrypoint (see `./outbound.ts`),
 * which the host's main module must export.
 *
 * npm `dependencies` are resolved by `@cloudflare/worker-bundler` inside this
 * worker (see `./bundler.ts`); where it cannot load, or with `bundler: false`,
 * they are fetched from esm.sh as bundled modules instead.
 */

import type {
  EvaluateOptions,
  EvaluateResult,
  Isolation,
  WorkerLoader,
  WorkerEntrypoint,
  WorkerStub,
  SandboxEnv,
  WorkerCode,
  WorkerLimits,
  WorkerModule,
  LogEntry,
} from './types.js'
import {
  generateWorkerCode,
  transformModuleCode,
  getExportNames,
  hoistImports,
} from './worker-template/index.js'
import { CAPNWEB_SOURCE } from './capnweb-bundle.js'
import { transformOptions } from './transform.js'
import { buildSandboxEnv, validateOptions, TEST_BINDING_KEY } from './validation.js'
import { assertEvaluateResult } from './type-guards.js'
import { resolveImports, BundlerUnavailableError } from './bundler.js'
import {
  outboundPolicy,
  loopbackOutboundGateway,
  registerInterceptor,
  releaseInterceptor,
  OUTBOUND_JSON_MODULE,
  OUTBOUND_GATEWAY_UNAVAILABLE_ERROR,
  type OutboundGatewayProps,
} from './outbound.js'
import {
  COMPATIBILITY_DATE,
  SANDBOX_URL,
  PACKAGE_JSON_MODULE,
  workerCodeId,
  normalizeImport,
  extractPackageName,
  parseImportSpecifier,
  partitionImports,
  packageJsonModule,
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
  // The loaded worker is the untrusted side of this boundary: check the shape
  // of what came back before it is returned as an `EvaluateResult`.
  const result: unknown = await response.json()
  assertEvaluateResult(result)
  return result
}

/**
 * Generate a minimal worker for simple script execution
 * This doesn't require capnweb or TEST binding
 */
function generateSimpleWorkerCode(options: {
  module?: string
  script?: string
  /** Import declarations placed at the true top level of the worker module */
  imports?: string[]
  /** Code run once at module scope, after console capture and before the user module */
  preamble?: string
}): string {
  const { module: rawModule = '', script = '', imports = [], preamble = '' } = options

  // Module code may use `exports.x =` or `export const x =`; both become
  // properties of `exports`, then top-level bindings the script can call.
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const exportNames = getExportNames(rawModule)

  const importStatements = imports.join('\n')

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
console.debug = captureConsole('debug');

${preamble}

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
    // Reject malformed options (sizes, timeout, limits, compatibility flags and
    // date, tails, imports) before anything is transformed or loaded; the
    // `ValidationError` is reported as an error result below.
    validateOptions(rawOptions)

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
 * Fetch one esm.sh module as a self-contained bundle.
 *
 * `https://esm.sh/<pkg>?bundle` answers with a short stub that re-exports the
 * real bundle (`export * from "/lodash@4.17.21/es2022/lodash.bundle.mjs"`);
 * the stub is followed once so the module handed to the loader has no
 * `/...` imports of its own. Bundles of packages that touch Node built-ins
 * still import esm.sh's `/node/*.mjs` polyfills, which the sandbox cannot
 * resolve - a limit of this fallback the bundler does not have.
 */
async function fetchEsmShBundle(url: string): Promise<string> {
  const parsed = new URL(url)
  const bundleUrl = parsed.searchParams.has('bundle')
    ? url
    : `${url}${parsed.search ? '&' : '?'}bundle`
  const response = await fetch(bundleUrl, { redirect: 'follow' })
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  const source = await response.text()
  const reexports = [...source.matchAll(/^export\s+(?:\*|\{[^}]*\})\s+from\s+"(\/[^"]+)"/gm)]
  const target = reexports[0]?.[1]
  // A stub: every line is a re-export (or a bare import) of one esm.sh path
  const isStub =
    target !== undefined &&
    source
      .trim()
      .split('\n')
      .every((line) => /^\/\*|^(?:export|import)\b/.test(line.trim())) &&
    reexports.every((match) => match[1] === target)
  if (!isStub) return source
  const bundled = await fetch(new URL(target, parsed.origin), { redirect: 'follow' })
  if (!bundled.ok) throw new Error(`Failed to fetch ${bundled.url}: ${bundled.status}`)
  return bundled.text()
}

/**
 * Pre-fetch the URL entries of `imports` (fallback path, and always for URLs:
 * the bundler resolves packages, not URLs). Returns `__external_<i>__.js`
 * modules, indexed by position in the original `imports` list.
 */
async function prefetchModules(
  urls: { index: number; url: string }[]
): Promise<Record<string, string>> {
  const modules: Record<string, string> = {}
  await Promise.all(
    urls.map(async ({ index, url }) => {
      try {
        modules[`__external_${index}__.js`] = url.includes('esm.sh/')
          ? await fetchEsmShBundle(url)
          : await fetchText(url)
      } catch (error) {
        throw new Error(
          `Failed to fetch import ${url}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })
  )
  return modules
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
  return response.text()
}

/**
 * esm.sh fallback for `dependencies`: each package is fetched as one bundled
 * module from `https://esm.sh/<name>@<version>` and registered under its bare
 * name (`{ js }` form: workerd resolves `import _ from 'lodash'` against a
 * module named `lodash`). Subpath imports (`hono/cors`) are not covered.
 */
async function prefetchDependencies(
  dependencies: Record<string, string>
): Promise<Record<string, WorkerModule>> {
  const modules: Record<string, WorkerModule> = {}
  await Promise.all(
    Object.entries(dependencies).map(async ([name, version]) => {
      const specifier = version === 'latest' ? name : `${name}@${version}`
      try {
        modules[name] = { js: await fetchEsmShBundle(normalizeImport(specifier)) }
      } catch (error) {
        throw new Error(
          `Failed to fetch dependency ${specifier}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    })
  )
  return modules
}

/** The bare specifier of a static import declaration (`'lodash'`, `'hono/cors'`), if any */
function importedPackage(statement: string): string | null {
  const specifier = statement.match(/from\s*['"]([^'"]+)['"]|^import\s*['"]([^'"]+)['"]/)
  const source = specifier?.[1] ?? specifier?.[2]
  if (!source || source.startsWith('.') || source.startsWith('/') || source.includes(':')) {
    return null
  }
  const name = source.startsWith('@')
    ? source.split('/').slice(0, 2).join('/')
    : source.split('/')[0]
  return name && parseImportSpecifier(name) ? name : null
}

/** Whether the `imports` globals deprecation has been printed in this isolate */
let importsGlobalsWarned = false

/**
 * The import layer of one evaluation, computed before any template runs.
 *
 * - `statements`: import declarations for the worker's top level - the
 *   user's own (hoisted out of `module` and `script`, where they would be
 *   syntax errors inside the generated blocks) and one namespace import per
 *   `imports` entry.
 * - `preamble`: the `imports` globals aliasing (`lodash` -> `_`, 2.x
 *   behaviour, deprecated).
 * - `dependencies`: what the bundler installs - `dependencies` plus bare
 *   `imports`, plus any package the hoisted imports name that was not
 *   declared (resolved at `latest`, with a warning).
 * - `urls`: `imports` entries that are URLs, fetched as-is in both modes.
 */
export function planImports(options: EvaluateOptions): {
  module: string
  script: string
  statements: string[]
  preamble: string
  dependencies: Record<string, string>
  urls: { index: number; url: string }[]
  warnings: string[]
} {
  const warnings: string[] = []
  const hoistedModule = hoistImports(options.module ?? '')
  const hoistedScript = hoistImports(options.script ?? '')
  const imports = options.imports ?? []
  const { dependencies, urls: urlList } = partitionImports(imports, options.dependencies ?? {})
  const urls = imports
    .map((url, index) => ({ index, url }))
    .filter(({ url }) => urlList.includes(url))

  const statements = [...hoistedModule.imports, ...hoistedScript.imports]
  for (const statement of statements) {
    const name = importedPackage(statement)
    if (name && !(name in dependencies)) {
      dependencies[name] = 'latest'
      warnings.push(
        `import of '${name}' is not declared in dependencies; resolved as latest - pin it: dependencies: { '${name}': '<version>' }`
      )
    }
  }

  const preambleLines: string[] = []
  imports.forEach((specifier, i) => {
    const parsed = parseImportSpecifier(specifier)
    const source = parsed ? parsed.name : `./__external_${i}__.js`
    statements.push(`import * as __import${i}__ from '${source}';`)
    const pkgName = extractPackageName(specifier, i)
    const varName = pkgName === 'lodash' ? '_' : pkgName
    preambleLines.push(
      `globalThis.${varName} = __import${i}__.default || __import${i}__;`,
      `globalThis.pkg = __import${i}__.default || __import${i}__;`
    )
  })
  if (imports.length > 0 && !importsGlobalsWarned) {
    importsGlobalsWarned = true
    console.warn(
      '[ai-evaluate] `imports` exposes packages as globals (`_`, `pkg`), which is deprecated; ' +
        "declare `dependencies` and `import` them: import { chunk } from 'lodash'"
    )
  }

  return {
    module: hoistedModule.code,
    script: hoistedScript.code,
    statements,
    preamble:
      preambleLines.length > 0
        ? `// \`imports\` globals (deprecated)\n${preambleLines.join('\n')}`
        : '',
    dependencies,
    urls,
    warnings,
  }
}

/** A `WorkerCode` plus the host-side warnings that accompany it */
export interface BuiltWorkerCode {
  code: WorkerCode
  /** Warnings from import resolution, reported to the caller as `warn` logs */
  warnings: string[]
  /**
   * Release what the build registered on the host for this evaluation - the
   * `outboundRpc` interceptor its gateway looks up. Call once the loaded
   * worker is done; a no-op when nothing was registered.
   */
  release(): void
}

/**
 * Build the `WorkerCode` spec for an evaluation - the single object that is
 * both content-addressed (`workerCodeId`) and handed to the loader.
 *
 * Two templates share this path:
 * - without `tests`/`sdk`, the minimal worker (`generateSimpleWorkerCode`);
 * - otherwise the full template (capnweb export RPC, SDK, tests). The
 *   ai-tests binding is optional: without it the worker embeds its own test
 *   runner, and the binding is passed through as `env.TEST` only when present.
 *
 * Imports (see `planImports`) are resolved one of two ways:
 * - with `@cloudflare/worker-bundler` (default, workerd with package
 *   resolution): the generated entry and its `dependencies` are bundled into
 *   one module; `capnweb.js` stays a sibling module;
 * - the esm.sh fallback (`bundler: false`, or the bundler cannot load or
 *   fails): each dependency is fetched from esm.sh as one bundled module and
 *   registered under its bare name.
 * Either way `package.json` (a json module) carries the dependency versions
 * into the content-addressed spec. URL `imports` are fetched as-is on both.
 *
 * Both templates get the same `env`: the allowlisted sandbox env from
 * `buildSandboxEnv` (strings from `options.env`, RPC stubs and cloneable
 * values from `options.bindings`). A value that fails that validator throws a
 * `ValidationError` here, before any loader call.
 *
 * Network policy is `globalOutbound`, set here and enforced by the runtime:
 * `null` for `fetch: false | null`; for `fetch: string[]` or `outboundRpc`
 * (see `outboundPolicy`) a loopback stub of the host worker's
 * `OutboundGateway` entrypoint with the policy in its `props`, which throws
 * `OUTBOUND_GATEWAY_UNAVAILABLE_ERROR` when the host does not export it. The
 * policy also goes into the spec as the `outbound.json` module, so it is part
 * of the content-addressed id. An `outboundRpc` function is registered on the
 * host under an id the gateway resolves; `release()` on the result forgets it.
 *
 * `compatibilityDate` (default `COMPATIBILITY_DATE`), `compatibilityFlags`
 * (default none) and `limits` are passed through as given - they are part of
 * the content-addressed spec. `tails` is a runtime binding, passed through
 * only when present so an absent option and an empty list are the same spec.
 * The `timeout`-derived CPU budget is not added here: it goes on the
 * entrypoint (see `runWorker`) so that it never changes the spec's id.
 */
export async function buildWorkerCode(
  options: EvaluateOptions,
  testService?: unknown
): Promise<WorkerCode> {
  return (await buildWorkerCodeWithWarnings(options, testService)).code
}

/** `buildWorkerCode`, with the import-resolution warnings it produced */
export async function buildWorkerCodeWithWarnings(
  options: EvaluateOptions,
  testService?: unknown
): Promise<BuiltWorkerCode> {
  const useSimpleWorker = !options.tests && !options.sdk
  const env = buildSandboxEnv(options)
  const policy = outboundPolicy(options)
  // Resolve the gateway before any fetching: a host that cannot enforce the
  // policy fails here, closed, without having done any work.
  const gateway = policy ? await loopbackOutboundGateway() : null
  if (policy && !gateway) throw new Error(OUTBOUND_GATEWAY_UNAVAILABLE_ERROR)
  const spec = {
    compatibilityDate: options.compatibilityDate ?? COMPATIBILITY_DATE,
    compatibilityFlags: options.compatibilityFlags ?? [],
    ...(options.limits !== undefined && { limits: options.limits }),
    ...(options.tails !== undefined && { tails: options.tails }),
  }

  const plan = planImports(options)
  const warnings = [...plan.warnings]
  const externalModules = plan.urls.length > 0 ? await prefetchModules(plan.urls) : {}
  // Caller-supplied modules (`options.modules`, validated): files for the
  // bundler, so the entry can import them, and siblings of the worker either
  // way, so a dynamic `import('./name.js')` resolves at runtime too.
  const extraModules: Record<string, string> = options.modules ?? {}
  const hasDependencies = Object.keys(plan.dependencies).length > 0

  const entry = useSimpleWorker
    ? generateSimpleWorkerCode({
        module: plan.module,
        script: plan.script,
        imports: plan.statements,
        preamble: plan.preamble,
      })
    : generateWorkerCode({
        testRunner: testService ? 'rpc' : 'embedded',
        module: plan.module,
        script: plan.script,
        imports: plan.statements,
        preamble: plan.preamble,
        ...(options.tests !== undefined && { tests: options.tests }),
        ...(options.sdk !== undefined && { sdk: options.sdk }),
      })
  // capnweb is a module so the worker can import it (full template only)
  const siblings: Record<string, string> = useSimpleWorker ? {} : { 'capnweb.js': CAPNWEB_SOURCE }
  const packageJson = hasDependencies
    ? { [PACKAGE_JSON_MODULE]: packageJsonModule(plan.dependencies) }
    : {}
  // Cloudflare Dynamic Workers' loader field is `env`, not `bindings`. The
  // loaded worker reads `env.TEST` (see worker-template/core.ts) only in
  // 'rpc' mode, so the binding is passed through only when present - and
  // never to the simple worker, which has no tests to run on it.
  const loaderEnv =
    testService && !useSimpleWorker ? { ...env, [TEST_BINDING_KEY]: testService } : env

  let resolved: { mainModule: string; modules: Record<string, string | WorkerModule> } | null = null
  if (hasDependencies && options.bundler !== false) {
    try {
      const bundled = await resolveImports({
        entry,
        dependencies: plan.dependencies,
        files: { ...externalModules, ...extraModules },
        externals: Object.keys(siblings),
      })
      warnings.push(...bundled.warnings.map((warning) => `bundler: ${warning}`))
      resolved = {
        mainModule: bundled.mainModule,
        modules: { ...bundled.modules, ...extraModules, ...siblings },
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      warnings.push(
        error instanceof BundlerUnavailableError
          ? `${reason}; dependencies resolved from esm.sh instead`
          : `bundler failed (${reason}); dependencies resolved from esm.sh instead`
      )
    }
  }
  if (!resolved) {
    const dependencyModules = hasDependencies ? await prefetchDependencies(plan.dependencies) : {}
    resolved = {
      mainModule: 'worker.js',
      modules: {
        'worker.js': entry,
        ...externalModules,
        ...extraModules,
        ...dependencyModules,
        ...siblings,
      },
    }
  }

  // The outbound policy, last: registering the interceptor is the one side
  // effect of this build, and nothing after it can throw.
  let globalOutbound: null | unknown = null
  let outboundModule: Record<string, WorkerModule> = {}
  let release = (): void => {}
  if (policy && gateway) {
    const props: OutboundGatewayProps = { allowlist: policy.allowlist }
    if (options.outboundRpc) {
      const id = registerInterceptor(options.outboundRpc)
      props.interceptor = id
      release = () => releaseInterceptor(id)
    }
    globalOutbound = gateway({ props })
    outboundModule = { [OUTBOUND_JSON_MODULE]: { json: props } }
  } else if (options.fetch !== false && options.fetch !== null) {
    globalOutbound = undefined
  }

  return {
    code: {
      mainModule: resolved.mainModule,
      modules: { ...resolved.modules, ...packageJson, ...outboundModule },
      ...spec,
      globalOutbound,
      env: loaderEnv,
    },
    warnings,
    release,
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
 * The CPU budget the loaded worker's entrypoint runs under: `limits.cpuMs`
 * when given, else `timeout`.
 *
 * CPU time never exceeds wall time, so `cpuMs = timeout` cannot cut off a
 * script the timeout would have let finish, and it is the only thing that
 * stops a CPU-bound loop: `AbortSignal.timeout` is never observed by code
 * that does not yield. An explicit `limits.cpuMs` is the caller's choice and
 * is not overridden by `timeout`.
 */
export function entrypointLimits(options: EvaluateOptions, timeout: number): WorkerLimits {
  return { cpuMs: options.limits?.cpuMs ?? timeout }
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
  const { code, warnings, release } = await buildWorkerCodeWithWarnings(options, testService)
  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  let result: EvaluateResult
  try {
    const worker = loadWorker(loader, code, options.isolation)
    // Bind the loaded worker's CPU budget to the wall-clock timeout (or the
    // explicit `limits.cpuMs`, see `entrypointLimits`). Limits set on the
    // entrypoint narrow the spec's own `limits` (the lower wins) without
    // changing its content-addressed id, so the same code with different
    // timeouts is still one cached isolate. Cloudflare enforces the limit;
    // open-source workerd (local) accepts and ignores it.
    const entrypoint = worker.getEntrypoint(undefined, {
      limits: entrypointLimits(options, timeout),
    })
    result = await executeWithTimeout(entrypoint, timeout)
  } finally {
    // The gateway's interceptor lives only as long as the evaluation
    release()
  }

  // Import-resolution warnings (bundler warnings, the esm.sh fallback being
  // taken, undeclared dependencies) precede the worker's own console output.
  const hostLogs: LogEntry[] = warnings.map((message) => ({
    level: 'warn',
    message: `[ai-evaluate] ${message}`,
    timestamp: start,
  }))

  return {
    ...result,
    logs: [...hostLogs, ...result.logs],
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
