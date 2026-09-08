/**
 * Types for ai-sandbox
 */

/**
 * SDK configuration for the sandbox environment
 */
export interface SDKConfig {
  /** Execution context: local (in-memory) or remote (RPC) */
  context?: 'local' | 'remote'
  /** RPC endpoint URL for all services (default: https://rpc.do) */
  rpcUrl?: string
  /** Database RPC URL (default: https://db.do/rpc) */
  dbUrl?: string
  /** AI RPC URL (default: https://ai.do/rpc) */
  aiUrl?: string
  /** Authentication token */
  token?: string
  /** Default namespace for database operations */
  ns?: string
  /** Cloudflare AI Gateway URL (e.g., https://gateway.ai.cloudflare.com/v1/{account}/{gateway}) */
  aiGatewayUrl?: string
  /** Cloudflare AI Gateway authentication token */
  aiGatewayToken?: string
}

/**
 * Network access configuration
 *
 * @example
 * fetch: true           // allow all (default)
 * fetch: false          // block all
 * fetch: null           // block all (backwards compat)
 * fetch: ['api.example.com', '*.trusted.com']  // allowlist with wildcards
 */
export type FetchConfig = boolean | null | string[]

/**
 * JSX settings for `module`, `tests` and `script` source
 *
 * The transform runs inside the worker that runs `evaluate()`, so JSX and
 * TypeScript work identically on Cloudflare and locally.
 *
 * @example
 * jsx: { factory: 'h', fragment: 'Fragment' }          // classic runtime (default)
 * jsx: { factory: 'React.createElement' }              // classic, React
 * jsx: { importSource: 'preact' }                      // automatic runtime: preact/jsx-runtime
 */
export interface JSXOptions {
  /** Element factory for the classic runtime (default: `h`) */
  factory?: string | undefined
  /** Fragment component for the classic runtime (default: `Fragment`) */
  fragment?: string | undefined
  /**
   * Package whose `/jsx-runtime` provides `jsx`/`jsxs`/`Fragment` (automatic
   * runtime). When set, `factory` and `fragment` are ignored. The generated
   * import must be resolvable by the sandbox (see `imports`).
   */
  importSource?: string | undefined
}

/**
 * A Durable Object facet of the sandbox: a class that `module` exports, run
 * as a SQLite-backed Durable Object of its own, owned by the host worker's
 * `SandboxHost` Durable Object for the evaluation's `sandboxId`.
 *
 * The script reaches it as `env.<binding>` (an RPC stub-like proxy: every
 * method call is an RPC into the facet, `fetch()` reaches its `fetch`
 * handler). The class receives `(ctx, env)` like any Durable Object and may
 * extend `DurableObject` from `cloudflare:workers` or be a plain class - a
 * plain class is wrapped in one that does. Its `ctx.storage` (SQLite) is
 * isolated per `sandboxId` and per class name, and survives across
 * evaluations, isolates and the host's own restarts.
 *
 * @example
 * await evaluate({
 *   module: `export class State {
 *     constructor(ctx) { this.sql = ctx.storage.sql }
 *     incr() { ... }
 *   }`,
 *   script: 'return await env.STATE.incr()',
 *   facet: { class: 'State' },
 *   sandboxId: 'user-42',
 * }, env)
 */
export interface FacetOptions {
  /** Name of the class `module` exports (`export class State {}` -> `'State'`) */
  class: string
  /**
   * Durable Object id of the facet (any string). Default: derived by the
   * runtime from the sandbox and the class name, so it need not be set.
   */
  id?: string | undefined
  /**
   * Name under which the script sees the facet, as `env.<binding>`. Default:
   * the class name in CONSTANT_CASE (`State` -> `STATE`, `ReplState` ->
   * `REPL_STATE`). May not collide with `env`, `bindings` or `TEST`.
   */
  binding?: string | undefined
}

/**
 * Options for evaluate()
 */
export interface EvaluateOptions {
  /** Module code with exports (JavaScript, TypeScript or JSX) */
  module?: string | undefined
  /** Test code using vitest (describe, expect, it in global scope) */
  tests?: string | undefined
  /** Script code to run immediately (module exports in scope) */
  script?: string | undefined
  /** JSX factory/fragment/runtime for the source fields (default: `h` / `Fragment`) */
  jsx?: JSXOptions | undefined
  /**
   * Wall-clock timeout in milliseconds (default: 5000, max: 60000), enforced
   * host-side with `AbortSignal.timeout`. Also the loaded worker's CPU budget
   * unless `limits.cpuMs` says otherwise (see `limits`).
   */
  timeout?: number | undefined
  /**
   * Resource limits the runtime enforces on the loaded worker (Cloudflare
   * Dynamic Workers `limits`): `cpuMs` caps CPU time per request, `subrequests`
   * caps outbound requests (fetch and binding calls) per request. Part of the
   * `WorkerCode` spec, so they are content-addressed with the code.
   *
   * `cpuMs` defaults to `timeout`: a CPU-bound loop never observes the
   * wall-clock signal, so the CPU limit is what ends it. The effective CPU
   * budget (`limits.cpuMs ?? timeout`) is applied on the entrypoint, where it
   * does not change the isolate id. Cloudflare enforces both limits;
   * open-source workerd (local) accepts and ignores them.
   */
  limits?: WorkerLimits | undefined
  /**
   * Tail workers (service bindings / `WorkerEntrypoint` stubs with a `tail()`
   * handler) that receive the loaded worker's trace events - console output,
   * exceptions, outcome - after each request. A runtime binding: it never
   * changes the isolate id. Needs a live loader: `ai-evaluate/node` without a
   * host env cannot carry a stub over its JSON boundary and rejects `tails`.
   */
  tails?: unknown[] | undefined
  /**
   * Compatibility flags for the loaded worker (e.g. `['nodejs_compat']`).
   * Default: none. Part of the content-addressed spec.
   */
  compatibilityFlags?: string[] | undefined
  /**
   * Compatibility date for the loaded worker (`YYYY-MM-DD`). Default:
   * `COMPATIBILITY_DATE`. Part of the content-addressed spec.
   */
  compatibilityDate?: string | undefined
  /**
   * String environment variables, visible to `module`, `tests` and `script`
   * as `env.NAME` (a frozen object). Strings only: anything else is rejected
   * with a `ValidationError` - stubs and structured values go in `bindings`.
   */
  env?: Record<string, string> | undefined
  /**
   * Bindings visible to the sandbox as `env.NAME` next to `env`. The sandbox
   * env is an explicit allowlist: each value must be either an RPC stub (a
   * service binding, a `WorkerEntrypoint` stub, `ctx.exports.X` - anything
   * with a `fetch` method, see `isRpcStubLike`) or structured-cloneable.
   * A raw host binding (KV, D1, R2, a Durable Object namespace) or a closure
   * is neither and is rejected with a `ValidationError` before the loader
   * ever sees it; wrap it in a `WorkerEntrypoint` service to expose it.
   * The key `TEST` is reserved for the ai-tests service binding.
   *
   * Only available when `evaluate()` runs inside a Worker with a `loader`
   * binding: the local Node host cannot receive a stub over its JSON
   * boundary, so `ai-evaluate/node` without an env rejects `bindings`.
   */
  bindings?: Record<string, unknown> | undefined
  /**
   * Network access control, enforced by the runtime as the loaded worker's
   * `globalOutbound` - never by code inside the isolate:
   * - true: allow all (default)
   * - false/null: block all (`globalOutbound: null`; `fetch()` rejects with
   *   the runtime's own message)
   * - string[]: allowlist of hosts (wildcards: '*.example.com'), served by
   *   the host worker's `OutboundGateway` entrypoint, which the host's main
   *   module must export (`export { OutboundGateway } from
   *   'ai-evaluate/worker'`); a request to any other host rejects with
   *   "Network access blocked: domain not in allowlist". Part of the
   *   content-addressed spec.
   */
  fetch?: FetchConfig
  /** RPC services to expose via capnweb (URL -> handler) */
  rpc?: Record<string, unknown> | undefined
  /**
   * Host-side interceptor for the sandbox's outbound requests. Asked first
   * for every `fetch()` the sandbox makes: a `Response` answers it, `null`
   * declines it and the `fetch` policy decides (a declined request under
   * `fetch: false` is blocked, under an allowlist checked against it, under
   * `fetch: true` forwarded). Runs through the same `OutboundGateway`
   * entrypoint as an allowlist, so the host's main module must export it.
   * A function: it cannot cross the `ai-evaluate/node` JSON boundary, so the
   * local Node host without an env rejects it.
   */
  outboundRpc?:
    | ((url: string, request: Request) => Promise<Response | null> | Response | null)
    | undefined
  /** SDK configuration - enables $, db, ai, api, on, send globals */
  sdk?: SDKConfig | boolean | undefined
  /**
   * npm dependencies of the sandboxed code, package.json style
   * (`{ lodash: '4.17.21', hono: '^4.0.0' }`). `module` and `script` then
   * import them with real ES module syntax (`import { chunk } from 'lodash'`).
   *
   * Resolved against the npm registry and bundled into the worker by
   * `@cloudflare/worker-bundler` inside the worker that runs `evaluate()`
   * (workerd only). Where the bundler cannot load - the local Miniflare host
   * of `ai-evaluate/node`, or `bundler: false` - each dependency is fetched
   * from esm.sh as a single bundled module instead and registered under its
   * bare name, so the same `import` syntax keeps working. Part of the
   * content-addressed spec: different versions are different workers.
   */
  dependencies?: Record<string, string> | undefined
  /**
   * External packages exposed as globals (deprecated - use `dependencies`
   * and `import` syntax). Bare names (`lodash`, `dayjs@1.11.10`,
   * `@scope/pkg@1.0.0`) are treated as `dependencies` and resolved by the
   * bundler; http(s) URLs are fetched as-is. Each package is also aliased
   * onto `globalThis` under its name (`lodash` -> `_`), which is the 2.x
   * behaviour this option keeps for compatibility.
   */
  imports?: string[] | undefined
  /**
   * Whether to resolve `dependencies` and bare `imports` with
   * `@cloudflare/worker-bundler` (default: `true`). `false` skips the bundler
   * and uses the esm.sh fallback directly - the path the local Miniflare
   * host takes anyway, since the bundler only loads inside workerd with
   * package resolution.
   */
  bundler?: boolean | undefined
  /**
   * Extra ES modules of the loaded worker, by name
   * (`{ 'helper.js': 'export const answer = 42' }`), importable from `module`
   * and `script` as `./helper.js`. Bundled with the entry when `dependencies`
   * go through the bundler, and always present as sibling modules of the
   * worker. Part of the content-addressed spec. The names the generated
   * worker uses (`worker.js`, `capnweb.js`, `package.json`, `outbound.json`,
   * `__external_<i>__.js`) are reserved.
   */
  modules?: Record<string, string> | undefined
  /**
   * Isolate reuse policy (default: `'fresh'`)
   * - `'fresh'`: `loader.load(spec)` - a new, uncached isolate every call, so
   *   identical evaluations are independent (nothing at module scope of the
   *   user module survives between calls).
   * - `'cached'`: `loader.get(workerCodeId(spec), factory)` - identical specs
   *   share one isolate; the id content-addresses the full `WorkerCode`
   *   (modules, compatibility date/flags, limits), never `env`. The user
   *   module body runs once per isolate, so all of its module-scope state
   *   (let/const bindings, exported arrays and objects, the `exports`
   *   record, `globalThis`) persists across calls; only script locals and
   *   logs are per-request.
   *
   * Dynamic Workers are billed per unique worker per day, so `'cached'` is
   * the opt-in cost control for code that is safe to re-enter.
   */
  isolation?: Isolation | undefined
  /**
   * A Durable Object facet of the sandbox (see `FacetOptions`): the named
   * class of `module` runs as a SQLite-backed Durable Object owned by the
   * host worker's `SandboxHost` Durable Object for `sandboxId`, and the
   * script calls it as `env.<binding>`. Requires `sandboxId`, and a host
   * worker that exports `SandboxHost` from its main module with a namespace
   * configured (`export { SandboxHost } from 'ai-evaluate/worker'`, plus
   * `durable_objects.bindings` and a `new_sqlite_classes` migration in
   * wrangler); the local host of `ai-evaluate/node` has it already.
   *
   * The facet worker (the module and its imports, without the script) is
   * content-addressed separately from the script worker: the facet stays
   * hot across evaluations of the same module, and a changed module restarts
   * it on the new class while its SQLite storage is kept.
   */
  facet?: FacetOptions | undefined
  /**
   * Identity of the sandbox whose persistent state this evaluation runs
   * against: the name of the `SandboxHost` Durable Object that owns its
   * facets. Two evaluations with the same `sandboxId` share facet storage;
   * different ids are isolated - under `isolation: 'cached'` too: with a
   * facet the sandbox identity is part of the script worker's
   * content-addressed spec (as the `sandbox.json` module), so a cached
   * isolate is one per sandbox, reused across evaluations of the same
   * `sandboxId` and never across sandboxes. Meaningful only with `facet`,
   * which requires it.
   */
  sandboxId?: string | undefined
}

/**
 * Isolate reuse policy for `evaluate()`: `'fresh'` (default) loads a new
 * isolate every call (`loader.load`); `'cached'` reuses one isolate, and its
 * module-scope state, per unique `WorkerCode` spec (`loader.get`).
 */
export type Isolation = 'cached' | 'fresh'

/**
 * Result from evaluate()
 */
export interface EvaluateResult {
  /** Whether execution succeeded */
  success: boolean
  /** Return value from script (if any) */
  value?: unknown
  /** Console output */
  logs: LogEntry[]
  /** Test results (if tests were provided) */
  testResults?: TestResults
  /** Error message if execution failed */
  error?: string
  /** Execution time in milliseconds */
  duration: number
}

/**
 * A log entry from console.log/warn/error
 */
export interface LogEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug'
  message: string
  timestamp: number
}

/**
 * Test results from vitest-style tests
 */
export interface TestResults {
  /** Total number of tests */
  total: number
  /** Number of passed tests */
  passed: number
  /** Number of failed tests */
  failed: number
  /** Number of skipped tests */
  skipped: number
  /** Individual test results */
  tests: TestResult[]
  /** Total duration in milliseconds */
  duration: number
}

/**
 * Individual test result
 */
export interface TestResult {
  /** Test name (describe > it) */
  name: string
  /** Whether the test passed */
  passed: boolean
  /** Error message if failed */
  error?: string
  /** Test duration in milliseconds */
  duration: number
}

/**
 * Resource limits for a dynamically loaded worker (Cloudflare Dynamic Workers)
 */
export interface WorkerLimits {
  /** CPU time per request, in milliseconds */
  cpuMs?: number | undefined
  /** Subrequests (fetch, bindings) per request */
  subrequests?: number | undefined
}

/**
 * Worker loader binding type (Cloudflare Dynamic Workers, `worker_loaders`)
 *
 * - `get(id, factory)`: returns the isolate cached under `id`, calling
 *   `factory` only when no isolate with that id is live. `evaluate()` derives
 *   `id` with `workerCodeId(spec)`, so identical specs share one isolate.
 * - `load(code)`: always loads a new, uncached isolate.
 */
export interface WorkerLoader {
  get(id: string, loader: () => WorkerCode | Promise<WorkerCode>): WorkerStub
  load(code: WorkerCode): WorkerStub
}

/**
 * A module of a dynamically loaded worker, by kind
 */
export interface WorkerModule {
  js?: string
  cjs?: string
  text?: string
  json?: unknown
  data?: ArrayBuffer
  py?: string
  wasm?: ArrayBuffer
}

/**
 * Worker code configuration: the full spec of a dynamically loaded worker.
 *
 * `workerCodeId()` content-addresses `mainModule`, `modules`,
 * `compatibilityDate`, `compatibilityFlags`, `allowExperimental`, `limits`
 * and whether `globalOutbound` is blocked; `env`, `globalOutbound` services
 * and `tails` are runtime bindings and do not change the id.
 */
export interface WorkerCode {
  mainModule: string
  modules: Record<string, string | WorkerModule>
  compatibilityDate?: string | undefined
  compatibilityFlags?: string[] | undefined
  /** Allow experimental compatibility flags */
  allowExperimental?: boolean | undefined
  /** Bindings visible to the loaded worker as `env` */
  env?: Record<string, unknown> | undefined
  /**
   * `null` blocks all global `fetch()`; a service (a `Fetcher`: a service
   * binding or a loopback `ctx.exports.X(...)` stub - never an entrypoint of
   * another dynamically loaded worker) routes it; `undefined` inherits
   */
  globalOutbound?: null | unknown
  /** Resource limits enforced by the runtime */
  limits?: WorkerLimits | undefined
  /** Tail workers receiving this worker's trace events */
  tails?: unknown[] | undefined
  /** Tail workers receiving streaming trace events */
  streamingTails?: unknown[] | undefined
}

/**
 * Worker entrypoint with fetch method
 */
export interface WorkerEntrypoint {
  fetch(request: Request): Promise<Response>
}

/**
 * Options for `WorkerStub.getEntrypoint()`
 */
export interface WorkerEntrypointOptions {
  /** `ctx.props` of the entrypoint */
  props?: unknown
  /** Per-entrypoint limits, narrowing the worker's `limits` */
  limits?: WorkerLimits | undefined
}

/**
 * Worker stub returned by the loader
 */
export interface WorkerStub {
  getEntrypoint(name?: string, options?: WorkerEntrypointOptions): WorkerEntrypoint
  getDurableObjectClass(name?: string, options?: WorkerEntrypointOptions): unknown
}

/**
 * Test service core - returned by connect() (from ai-tests)
 */
export interface TestServiceCore {
  expect(value: unknown, message?: string): unknown
  should(value: unknown): unknown
  assert: unknown
  describe(name: string, fn: () => void): void
  it(name: string, fn: () => void | Promise<void>): void
  test(name: string, fn: () => void | Promise<void>): void
  skip(name: string, fn?: () => void | Promise<void>): void
  only(name: string, fn: () => void | Promise<void>): void
  beforeEach(fn: () => void | Promise<void>): void
  afterEach(fn: () => void | Promise<void>): void
  beforeAll(fn: () => void | Promise<void>): void
  afterAll(fn: () => void | Promise<void>): void
  run(): Promise<TestResults>
  reset(): void
}

/**
 * Test service binding type - WorkerEntrypoint (from ai-tests)
 */
export interface TestServiceBinding {
  /** Get a test service instance via RPC */
  connect(): Promise<TestServiceCore>
}

/**
 * The host Worker environment `evaluate()` runs against.
 *
 * Bindings are looked up by these exact (lowercase) names; the 2.x uppercase
 * aliases `LOADER` / `TEST` are gone in 3.0. Declare the loader in wrangler as
 * `worker_loaders: [{ binding: "loader" }]`.
 */
export interface SandboxEnv {
  /** `worker_loaders` binding (Dynamic Workers) - required */
  loader?: WorkerLoader
  /** ai-tests service binding - optional; without it tests run on the embedded runner */
  test?: TestServiceBinding
}
