/**
 * Test runner - describe, it, test, hooks
 *
 * Provides vitest-compatible test runner API via RPC.
 */

import { RpcTarget } from 'cloudflare:workers'
import type { TestResult, TestResults, TestFn, HookFn, RegisteredTest } from './types.js'

/**
 * Test runner that collects and runs tests
 */
export class TestRunner extends RpcTarget {
  private tests: RegisteredTest[] = []
  private currentSuite: string = ''
  private beforeEachHooks: HookFn[] = []
  private afterEachHooks: HookFn[] = []
  private beforeAllHooks: HookFn[] = []
  private afterAllHooks: HookFn[] = []

  /**
   * Define a test suite
   */
  describe(name: string, fn: () => void): void {
    const prevSuite = this.currentSuite
    const prevBeforeEach = [...this.beforeEachHooks]
    const prevAfterEach = [...this.afterEachHooks]

    this.currentSuite = this.currentSuite ? `${this.currentSuite} > ${name}` : name

    try {
      fn()
    } finally {
      this.currentSuite = prevSuite
      this.beforeEachHooks = prevBeforeEach
      this.afterEachHooks = prevAfterEach
    }
  }

  /**
   * Define a test
   */
  it(name: string, fn: TestFn): void {
    const fullName = this.currentSuite ? `${this.currentSuite} > ${name}` : name
    this.tests.push({
      name: fullName,
      fn,
      hooks: {
        before: [...this.beforeEachHooks],
        after: [...this.afterEachHooks]
      }
    })
  }

  /**
   * Alias for it
   */
  test(name: string, fn: TestFn): void {
    this.it(name, fn)
  }

  /**
   * Skip a test
   */
  skip(name: string, _fn?: TestFn): void {
    const fullName = this.currentSuite ? `${this.currentSuite} > ${name}` : name
    this.tests.push({
      name: fullName,
      fn: null,
      hooks: { before: [], after: [] },
      skip: true
    })
  }

  /**
   * Run only this test
   */
  only(name: string, fn: TestFn): void {
    const fullName = this.currentSuite ? `${this.currentSuite} > ${name}` : name
    this.tests.push({
      name: fullName,
      fn,
      hooks: {
        before: [...this.beforeEachHooks],
        after: [...this.afterEachHooks]
      },
      only: true
    })
  }

  /**
   * Register a beforeEach hook
   */
  beforeEach(fn: HookFn): void {
    this.beforeEachHooks.push(fn)
  }

  /**
   * Register an afterEach hook
   */
  afterEach(fn: HookFn): void {
    this.afterEachHooks.push(fn)
  }

  /**
   * Register a beforeAll hook
   */
  beforeAll(fn: HookFn): void {
    this.beforeAllHooks.push(fn)
  }

  /**
   * Register an afterAll hook
   */
  afterAll(fn: HookFn): void {
    this.afterAllHooks.push(fn)
  }

  /**
   * Run all registered tests and return results
   */
  async run(): Promise<TestResults> {
    const startTime = Date.now()
    const results: TestResult[] = []

    // Check for .only tests
    const hasOnly = this.tests.some(t => t.only)
    const testsToRun = hasOnly
      ? this.tests.filter(t => t.only || t.skip)
      : this.tests

    // Run beforeAll hooks
    for (const hook of this.beforeAllHooks) {
      try {
        await hook()
      } catch (e) {
        // If beforeAll fails, fail all tests
        const error = e instanceof Error ? e.message : String(e)
        for (const test of testsToRun) {
          results.push({
            name: test.name,
            passed: false,
            error: `beforeAll hook failed: ${error}`,
            duration: 0
          })
        }
        return this.buildResults(results, startTime)
      }
    }

    // Run each test
    for (const test of testsToRun) {
      if (test.skip) {
        results.push({
          name: test.name,
          passed: true,
          skipped: true,
          duration: 0
        })
        continue
      }

      const testStart = Date.now()

      try {
        // Run beforeEach hooks
        for (const hook of test.hooks.before) {
          await hook()
        }

        // Run the test
        if (test.fn) {
          await test.fn()
        }

        // Run afterEach hooks
        for (const hook of test.hooks.after) {
          await hook()
        }

        results.push({
          name: test.name,
          passed: true,
          duration: Date.now() - testStart
        })
      } catch (e) {
        results.push({
          name: test.name,
          passed: false,
          error: e instanceof Error ? e.message : String(e),
          duration: Date.now() - testStart
        })
      }
    }

    // Run afterAll hooks
    for (const hook of this.afterAllHooks) {
      try {
        await hook()
      } catch (e) {
        // Log but don't fail tests
        console.error('afterAll hook failed:', e)
      }
    }

    return this.buildResults(results, startTime)
  }

  /**
   * Clear all registered tests and hooks
   */
  reset(): void {
    this.tests = []
    this.currentSuite = ''
    this.beforeEachHooks = []
    this.afterEachHooks = []
    this.beforeAllHooks = []
    this.afterAllHooks = []
  }

  private buildResults(results: TestResult[], startTime: number): TestResults {
    return {
      total: results.length,
      passed: results.filter(r => r.passed && !r.skipped).length,
      failed: results.filter(r => !r.passed).length,
      skipped: results.filter(r => r.skipped).length,
      tests: results,
      duration: Date.now() - startTime
    }
  }
}

/**
 * Create a new test runner instance
 */
export function createRunner(): TestRunner {
  return new TestRunner()
}
