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
 * Options for evaluate()
 */
export interface EvaluateOptions {
  /** Module code with exports */
  module?: string | undefined
  /** Test code using vitest (describe, expect, it in global scope) */
  tests?: string | undefined
  /** Script code to run immediately (module exports in scope) */
  script?: string | undefined
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
}

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
 * Worker loader binding type (Cloudflare)
 */
export interface WorkerLoader {
  get(id: string, loader: () => Promise<WorkerCode>): WorkerStub
}

/**
 * Worker code configuration
 */
export interface WorkerCode {
  mainModule: string
  modules: Record<string, string | { js?: string; cjs?: string; text?: string; json?: unknown }>
  compatibilityDate?: string
  env?: Record<string, unknown>
  globalOutbound?: null | unknown
}

/**
 * Worker entrypoint with fetch method
 */
export interface WorkerEntrypoint {
  fetch(request: Request): Promise<Response>
}

/**
 * Worker stub returned by loader
 */
export interface WorkerStub {
  getEntrypoint(): WorkerEntrypoint
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
