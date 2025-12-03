/**
 * Types for ai-test
 */

/**
 * Test result for a single test
 */
export interface TestResult {
  name: string
  passed: boolean
  skipped?: boolean
  error?: string
  duration: number
}

/**
 * Aggregated test results
 */
export interface TestResults {
  total: number
  passed: number
  failed: number
  skipped: number
  tests: TestResult[]
  duration: number
}

/**
 * Test function
 */
export type TestFn = () => void | Promise<void>

/**
 * Hook function (beforeEach, afterEach, etc.)
 */
export type HookFn = () => void | Promise<void>

/**
 * Registered test
 */
export interface RegisteredTest {
  name: string
  fn: TestFn | null
  hooks: {
    before: HookFn[]
    after: HookFn[]
  }
  skip?: boolean
  only?: boolean
}

/**
 * Test suite context
 */
export interface SuiteContext {
  name: string
  beforeEach: HookFn[]
  afterEach: HookFn[]
  beforeAll: HookFn[]
  afterAll: HookFn[]
}

/**
 * Environment with test worker binding
 */
export interface TestEnv {
  TEST?: unknown
}
