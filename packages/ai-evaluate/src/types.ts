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
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number | undefined
  /** Environment variables to pass to the sandbox */
  env?: Record<string, string> | undefined
  /**
   * Network access control
   * - true: allow all (default)
   * - false/null: block all
   * - string[]: allowlist of domains (wildcards: '*.example.com')
   */
  fetch?: FetchConfig
  /** RPC services to expose via capnweb (URL -> handler) */
  rpc?: Record<string, unknown> | undefined
  /** Outbound RPC interceptor - intercepts fetch calls to RPC URLs */
  outboundRpc?: ((url: string, request: Request) => Promise<Response> | Response | null) | undefined
  /** SDK configuration - enables $, db, ai, api, on, send globals */
  sdk?: SDKConfig | boolean | undefined
  /** Top-level imports to hoist (for MDX test files with external imports) */
  imports?: string[] | undefined
  /**
   * Isolate reuse policy (default: `'fresh'`)
   * - `'fresh'`: `LOADER.load(spec)` - a new, uncached isolate every call, so
   *   identical evaluations are independent (nothing at module scope of the
   *   user module survives between calls).
   * - `'cached'`: `LOADER.get(workerCodeId(spec), factory)` - identical specs
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
}

/**
 * Isolate reuse policy for `evaluate()`: `'fresh'` (default) loads a new
 * isolate every call (`LOADER.load`); `'cached'` reuses one isolate, and its
 * module-scope state, per unique `WorkerCode` spec (`LOADER.get`).
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
  /** `null` blocks all global `fetch()`; a service routes it; `undefined` inherits */
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
 * Environment with worker loader binding
 */
export interface SandboxEnv {
  loader?: WorkerLoader
  LOADER?: WorkerLoader // Legacy - prefer lowercase
  test?: TestServiceBinding
  TEST?: TestServiceBinding // Legacy - prefer lowercase
}
