/**
 * `Executor` adapter for `@cloudflare/codemode` (0.5+): run the code an
 * agent writes through `evaluate()` instead of the stock
 * `DynamicWorkerExecutor`, so it gets this package's sandbox - the
 * allowlist/outbound gateway, content-addressed isolates, the CPU budget
 * bound to `timeout`, `limits`, `tails`, npm `dependencies` - unchanged.
 *
 * ```ts
 * import { createCodeTool } from '@cloudflare/codemode'
 * import { createExecutor } from 'ai-evaluate/codemode'
 *
 * const executor = createExecutor({ loader: env.loader })
 * const codemode = createCodeTool({ tools, executor })
 * ```
 *
 * The contract is codemode's `Executor`: `execute(code, providersOrFns,
 * options)` resolves to `{ result, logs }` or `{ result: undefined, error,
 * logs }` and never throws; codemode's `runCode` turns `error` into a thrown
 * `Error` for the agent. Tool functions stay on the host: the sandbox reaches
 * them through the outbound gateway (`outboundRpc`), as `POST
 * https://codemode.invalid/<namespace>/<tool>` with the JSON arguments, which
 * the host answers by calling the function. Everything else the sandbox
 * fetches is blocked (`globalOutbound: null`) or routed through the
 * `globalOutbound` `Fetcher` - codemode's own policy, enforced by the runtime.
 * A host worker therefore exports the gateway entrypoint, as it does for a
 * fetch allowlist: `export { OutboundGateway } from 'ai-evaluate/worker'`.
 *
 * Only types are imported from `@cloudflare/codemode` (an optional peer
 * dependency); the two connector control literals it does not export
 * (`__codemode_control__`, `__CODEMODE_PAUSE__`) are mirrored here.
 */

import type {
  ConnectorBinding,
  ExecuteOptions,
  ExecuteResult,
  Executor,
  ResolvedProvider,
} from '@cloudflare/codemode'
import type { EvaluateOptions, LogEntry, WorkerLoader } from './types.js'
import type { OutboundInterceptor } from './outbound.js'
import { evaluate } from './evaluate.js'

/**
 * Host of the sandbox's tool-call requests. `.invalid` is reserved (RFC 2606),
 * so the name never resolves: a request to it exists only for the gateway.
 */
export const CODEMODE_DISPATCH_HOST = 'codemode.invalid'

/** Default `timeout`: codemode's own default, and this package's `MAX_TIMEOUT` */
export const DEFAULT_CODEMODE_TIMEOUT = 60000

/** Namespace of tools passed as a plain record (`execute(code, { add })`) */
const DEFAULT_NAMESPACE = 'codemode'

/**
 * The connector control protocol of `@cloudflare/codemode`: a `callTool`
 * result carrying this key asks the sandbox to pause (throw the sentinel) or
 * to throw `message`. Not exported by codemode; mirrored from 0.5.
 */
const CONNECTOR_CONTROL_KEY = '__codemode_control__'
const PAUSE_SENTINEL = '__CODEMODE_PAUSE__'

/**
 * Identifiers the generated sandbox script uses (and the generated worker
 * around it): a provider or connector may not be named after one, as its
 * namespace becomes a `const` in the same scope.
 */
const RESERVED_NAMES = new Set([
  '__codemodeCall',
  '__codemodeFetch',
  '__codemodeTools',
  '__executeScript__',
  '__result__',
  '__env__',
  '__moduleLogCount__',
  'env',
  'exports',
  'logs',
  'console',
  'fetch',
  'Promise',
  'Proxy',
  'Error',
  'JSON',
  'Object',
  'Request',
  'Response',
  'globalThis',
  'setTimeout',
])

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/

/** ECMAScript reserved words, as `sanitizeToolName` in codemode treats them */
const JS_RESERVED = new Set([
  'abstract',
  'arguments',
  'await',
  'boolean',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'double',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'final',
  'finally',
  'float',
  'for',
  'function',
  'goto',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'int',
  'interface',
  'let',
  'long',
  'native',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'short',
  'static',
  'super',
  'switch',
  'synchronized',
  'this',
  'throw',
  'throws',
  'transient',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'void',
  'volatile',
  'while',
  'with',
  'yield',
])

/**
 * A `Fetcher`-shaped outbound target: a service binding, a loopback stub, or
 * any object with a `fetch` method (the routing runs on the host).
 */
export interface OutboundFetcher {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>
}

/**
 * The `EvaluateOptions` an executor passes through to every evaluation:
 * everything but the fields the adapter owns (`script`, `timeout`, `fetch`,
 * `outboundRpc`, `bindings`, `modules`) and the ones that do not apply to
 * codemode's plain-JavaScript code (`module`, `tests`, `jsx`, `sdk`, `rpc`,
 * the deprecated `imports`).
 */
export type CodemodeEvaluateOptions = Pick<
  EvaluateOptions,
  | 'limits'
  | 'tails'
  | 'compatibilityFlags'
  | 'compatibilityDate'
  | 'env'
  | 'isolation'
  | 'dependencies'
  | 'bundler'
>

/**
 * Options of `createExecutor`: the `DynamicWorkerExecutorOptions` of
 * `@cloudflare/codemode`, against this package's loader type, plus a
 * pass-through of the `EvaluateOptions` codemode has no equivalent for.
 */
export interface CodemodeExecutorOptions {
  /** `worker_loaders` binding (`env.loader`) */
  loader: WorkerLoader
  /**
   * Wall-clock timeout per execution in milliseconds (default: 60000, the
   * maximum). Also the loaded worker's CPU budget (`limits.cpuMs`), so a
   * CPU-bound loop ends with it on Cloudflare.
   */
  timeout?: number | undefined
  /**
   * Network access of the sandboxed code, beyond its tool calls:
   * - `null` (default): none - `fetch()` rejects, runtime-enforced;
   * - a `Fetcher`: every request goes through it, on the host.
   */
  globalOutbound?: OutboundFetcher | null | undefined
  /**
   * Extra ES modules of the sandbox worker, by name; the code imports them
   * as `./name.js` (`EvaluateOptions.modules`).
   */
  modules?: Record<string, string> | undefined
  /**
   * Bindings visible to the sandbox as `env.NAME`: RPC stubs (service
   * bindings, `WorkerEntrypoint` stubs) and structured-cloneable values only
   * (`EvaluateOptions.bindings`).
   */
  bindings?: Record<string, unknown> | undefined
  /** Further `EvaluateOptions`, passed through to every execution */
  evaluate?: CodemodeEvaluateOptions | undefined
}

/** A namespace the sandbox can call into, host side */
type DispatchEntry =
  | { kind: 'provider'; fns: Record<string, (...args: unknown[]) => Promise<unknown>> }
  | { kind: 'connector'; binding: ConnectorBinding['binding'] }

/** Tool names by namespace, embedded in the sandbox so unknown tools fail locally */
type ToolNames = Record<string, string[]>

/**
 * codemode's `sanitizeToolName`: hyphens, dots and spaces to `_`, other
 * invalid characters dropped, a leading digit prefixed, a reserved word
 * suffixed with `_`. The sandbox calls tools by the sanitized name.
 */
export function sanitizeToolName(name: string): string {
  if (!name) return '_'
  let sanitized = name.replace(/[-.\s]/g, '_').replace(/[^a-zA-Z0-9_$]/g, '')
  if (!sanitized) return '_'
  if (/^[0-9]/.test(sanitized)) sanitized = `_${sanitized}`
  if (JS_RESERVED.has(sanitized)) sanitized = `${sanitized}_`
  return sanitized
}

/** `ResolvedProvider[]` from either form of `providersOrFns` */
function normalizeProviders(
  providersOrFns: ResolvedProvider[] | Record<string, (...args: unknown[]) => Promise<unknown>>
): ResolvedProvider[] {
  return Array.isArray(providersOrFns)
    ? providersOrFns
    : [{ name: DEFAULT_NAMESPACE, fns: providersOrFns }]
}

/** The error result codemode expects for a rejected call (never a throw) */
function failure(error: string, logs: string[] = []): ExecuteResult {
  return { result: undefined, error, logs }
}

/**
 * Build the host-side dispatch table and the tool-name lists for the sandbox,
 * or the error message that rejects the call: a reserved, invalid or
 * duplicate namespace, or two tool names that sanitize to one.
 */
function buildDispatchTable(
  providers: ResolvedProvider[],
  connectors: ConnectorBinding[]
): { table: Map<string, DispatchEntry>; toolNames: ToolNames } | string {
  const table = new Map<string, DispatchEntry>()
  const toolNames: ToolNames = {}

  for (const provider of providers) {
    if (RESERVED_NAMES.has(provider.name)) return `Provider name "${provider.name}" is reserved`
    if (!VALID_IDENTIFIER.test(provider.name)) {
      return `Provider name "${provider.name}" is not a valid JavaScript identifier`
    }
    if (table.has(provider.name)) return `Duplicate provider name "${provider.name}"`
    const fns: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
    const originals = new Map<string, string>()
    for (const [name, fn] of Object.entries(provider.fns)) {
      const sanitized = sanitizeToolName(name)
      const existing = originals.get(sanitized)
      if (existing !== undefined && existing !== name) {
        return `Tool names "${existing}" and "${name}" both sanitize to "${sanitized}" in provider "${provider.name}"`
      }
      originals.set(sanitized, name)
      fns[sanitized] = fn
    }
    table.set(provider.name, { kind: 'provider', fns })
    toolNames[provider.name] = Object.keys(fns)
  }

  for (const connector of connectors) {
    if (RESERVED_NAMES.has(connector.name)) return `Connector name "${connector.name}" is reserved`
    if (!VALID_IDENTIFIER.test(connector.name)) {
      return `Connector name "${connector.name}" is not a valid JavaScript identifier`
    }
    if (table.has(connector.name)) {
      return `Duplicate name "${connector.name}" (connector clashes with provider)`
    }
    table.set(connector.name, { kind: 'connector', binding: connector.binding })
  }

  return { table, toolNames }
}

/**
 * Whether `code` is a function to call (`async () => { ... }`, the form
 * codemode's `normalizeCode` produces, or a `function` expression) rather
 * than a bare function body (`return 1 + 1`).
 */
export function isFunctionSource(code: string): boolean {
  return /^\s*(?:async\s*)?(?:\([^)]*\)\s*=>|[a-zA-Z_$][\w$]*\s*=>|function\b)/.test(code)
}

/**
 * The sandbox script for one call: the tool proxies in scope, then the code.
 *
 * Every provider namespace is a `Proxy` whose properties are async functions
 * that POST their arguments to the dispatch host; a name the provider does
 * not have fails in the sandbox without a request (`Tool "x" not found`). Own
 * properties of the proxy target win, so a provider `prelude` can define real
 * in-sandbox functions on its namespace, as codemode's executor allows.
 * A connector namespace forwards every method to `callTool` on the host.
 */
export function generateSandboxScript(
  code: string,
  providers: ResolvedProvider[],
  connectors: ConnectorBinding[],
  toolNames: ToolNames
): string {
  const dispatchUrl = `https://${CODEMODE_DISPATCH_HOST}/`
  const lines = [
    'const __codemodeFetch = fetch;',
    `const __codemodeTools = ${JSON.stringify(toolNames)};`,
    'const __codemodeCall = async (namespace, tool, args) => {',
    `  const response = await __codemodeFetch(${JSON.stringify(
      dispatchUrl
    )} + encodeURIComponent(namespace) + '/' + encodeURIComponent(tool), {`,
    "    method: 'POST',",
    "    headers: { 'content-type': 'application/json' },",
    '    body: JSON.stringify(args),',
    '  });',
    '  const data = await response.json();',
    '  if (data.error !== undefined) throw new Error(data.error);',
    '  return data.result;',
    '};',
  ]
  for (const provider of providers) {
    const namespace = JSON.stringify(provider.name)
    lines.push(
      `const ${provider.name} = new Proxy({}, {`,
      '  get: (target, toolName) => {',
      '    if (Object.prototype.hasOwnProperty.call(target, toolName)) return target[toolName];',
      "    if (typeof toolName !== 'string') return undefined;",
      '    return async (...args) => {',
      `      if (!__codemodeTools[${namespace}].includes(toolName)) throw new Error('Tool "' + toolName + '" not found');`,
      `      return __codemodeCall(${namespace}, toolName, args);`,
      '    };',
      '  },',
      '});'
    )
  }
  for (const connector of connectors) {
    const namespace = JSON.stringify(connector.name)
    lines.push(
      `const ${connector.name} = new Proxy({}, {`,
      '  get: (_, toolName) => {',
      "    if (typeof toolName !== 'string') return undefined;",
      `    return (...args) => __codemodeCall(${namespace}, toolName, args.slice(0, 1));`,
      '  },',
      '});'
    )
  }
  for (const provider of providers) {
    if (provider.prelude) lines.push(provider.prelude)
  }
  lines.push(isFunctionSource(code) ? `return await (${code})();` : code)
  return lines.join('\n')
}

/** The control marker of a connector result, if it carries one */
function controlOf(outcome: unknown): { control: unknown; message: unknown } | null {
  if (outcome === null || typeof outcome !== 'object') return null
  const record = outcome as Record<string, unknown>
  if (!(CONNECTOR_CONTROL_KEY in record)) return null
  return { control: record[CONNECTOR_CONTROL_KEY], message: record['message'] }
}

/**
 * The host side of the sandbox's outbound traffic: a request to the dispatch
 * host is a tool call, answered here as `{ result }` or `{ error }`; any
 * other request goes to `upstream` (the `globalOutbound` `Fetcher`) or, with
 * none, is declined to the gateway - which blocks it, as the executor sets
 * `fetch: false`.
 */
export function createDispatcher(
  table: Map<string, DispatchEntry>,
  upstream: OutboundFetcher | null
): OutboundInterceptor {
  return async (url, request) => {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    if (parsed.hostname !== CODEMODE_DISPATCH_HOST) {
      return upstream ? upstream.fetch(request) : null
    }

    let namespace = ''
    let tool = ''
    try {
      ;[namespace = '', tool = ''] = parsed.pathname.split('/').slice(1).map(decodeURIComponent)
    } catch {
      return Response.json({ error: 'Malformed tool call' })
    }
    const notFound = () => Response.json({ error: `Tool "${tool}" not found` })
    const entry = table.get(namespace)
    if (!entry) return notFound()

    let args: unknown[]
    try {
      const body: unknown = await request.json()
      args = Array.isArray(body) ? body : [body]
    } catch {
      return Response.json({ error: 'Malformed tool call: arguments must be a JSON array' })
    }

    try {
      if (entry.kind === 'connector') {
        const outcome = await entry.binding.callTool(tool, args[0])
        const marker = controlOf(outcome)
        if (marker?.control === 'pause') return Response.json({ error: PAUSE_SENTINEL })
        if (marker?.control === 'error') return Response.json({ error: String(marker.message) })
        return Response.json({ result: outcome })
      }
      const fn = entry.fns[tool]
      if (!fn) return notFound()
      return Response.json({ result: await fn(...args) })
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) })
    }
  }
}

/** A log entry as codemode reports it: the message, prefixed by any level but `log` */
function formatLog(entry: LogEntry): string {
  return entry.level === 'log' ? entry.message : `[${entry.level}] ${entry.message}`
}

/**
 * Create a codemode `Executor` that runs each call through `evaluate()`.
 *
 * Per call: the providers (or the plain `fns` record, as the `codemode`
 * namespace) and connectors become a host-side dispatch table and in-sandbox
 * proxies; the code runs as the script of a fresh (or, with
 * `evaluate.isolation: 'cached'`, content-addressed) isolate under `timeout`;
 * the result is `{ result, logs }`, or `{ result: undefined, error, logs }`
 * with the sandbox's own error string - an evaluation is never reported as
 * a `success: false` object and never thrown. Codemode's `runCode` raises
 * `error` as `Error('Code execution failed: ...')`.
 *
 * The gateway is bound only when a call has something to dispatch (a tool,
 * a connector, or a `globalOutbound` `Fetcher`); a call without any runs
 * under `globalOutbound: null` with no host entrypoint involved.
 *
 * @example
 * ```ts
 * const executor = createExecutor({ loader: env.loader, timeout: 10000 })
 * const { result } = await executor.execute('async () => codemode.add(1, 2)', {
 *   add: async (a, b) => (a as number) + (b as number),
 * })
 * // result: 3
 * ```
 */
export function createExecutor(options: CodemodeExecutorOptions): Executor {
  const {
    loader,
    timeout = DEFAULT_CODEMODE_TIMEOUT,
    globalOutbound = null,
    modules,
    bindings,
    evaluate: passthrough,
  } = options

  return {
    async execute(
      code: string,
      providersOrFns: ResolvedProvider[] | Record<string, (...args: unknown[]) => Promise<unknown>>,
      executeOptions?: ExecuteOptions
    ): Promise<ExecuteResult> {
      const providers = normalizeProviders(providersOrFns)
      const connectors = executeOptions?.connectors ?? []
      const built = buildDispatchTable(providers, connectors)
      if (typeof built === 'string') return failure(built)
      const { table, toolNames } = built

      const hasTools = [...table.values()].some(
        (entry) => entry.kind === 'connector' || Object.keys(entry.fns).length > 0
      )
      const needsGateway = hasTools || globalOutbound !== null

      const evaluateOptions: EvaluateOptions = {
        ...passthrough,
        script: generateSandboxScript(code, providers, connectors, toolNames),
        timeout,
        fetch: false,
        ...(needsGateway && { outboundRpc: createDispatcher(table, globalOutbound) }),
        ...(modules !== undefined && { modules }),
        ...(bindings !== undefined && { bindings }),
      }

      const result = await evaluate(evaluateOptions, { loader })
      const logs = result.logs.map(formatLog)
      if (!result.success) return failure(result.error ?? 'Unknown error', logs)
      return { result: result.value, logs }
    },
  }
}
