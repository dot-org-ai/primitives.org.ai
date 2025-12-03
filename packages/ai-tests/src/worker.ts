/**
 * Test Worker - provides test utilities via RPC
 *
 * This worker can be deployed to Cloudflare Workers or run locally via Miniflare.
 * It exposes expect, should, assert, and a test runner via Workers RPC.
 *
 * Uses Cloudflare Workers RPC (WorkerEntrypoint, RpcTarget) for communication.
 */

import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'
import { Assertion, expect, should, assert } from './assertions.js'
import { TestRunner, createRunner } from './runner.js'

/**
 * Core test service - extends RpcTarget so it can be passed over RPC
 *
 * Contains all test functionality: assertions (expect, should, assert)
 * and test runner (describe, it, test, hooks)
 */
export class TestServiceCore extends RpcTarget {
  protected runner: TestRunner

  constructor() {
    super()
    this.runner = createRunner()
  }

  expect(value: unknown, message?: string): Assertion {
    return expect(value, message)
  }

  should(value: unknown): Assertion {
    return should(value)
  }

  get assert() {
    return assert
  }

  describe(name: string, fn: () => void): void {
    this.runner.describe(name, fn)
  }

  it(name: string, fn: () => void | Promise<void>): void {
    this.runner.it(name, fn)
  }

  test(name: string, fn: () => void | Promise<void>): void {
    this.runner.test(name, fn)
  }

  skip(name: string, fn?: () => void | Promise<void>): void {
    this.runner.skip(name, fn)
  }

  only(name: string, fn: () => void | Promise<void>): void {
    this.runner.only(name, fn)
  }

  beforeEach(fn: () => void | Promise<void>): void {
    this.runner.beforeEach(fn)
  }

  afterEach(fn: () => void | Promise<void>): void {
    this.runner.afterEach(fn)
  }

  beforeAll(fn: () => void | Promise<void>): void {
    this.runner.beforeAll(fn)
  }

  afterAll(fn: () => void | Promise<void>): void {
    this.runner.afterAll(fn)
  }

  async run() {
    return this.runner.run()
  }

  reset(): void {
    this.runner.reset()
  }

  createRunner(): TestRunner {
    return createRunner()
  }
}

/**
 * Main test service exposed via RPC as WorkerEntrypoint
 *
 * Usage:
 *   const tests = await env.TEST.connect()
 *   tests.expect(1).to.equal(1)
 *   tests.describe('suite', () => { ... })
 *   const results = await tests.run()
 */
export class TestService extends WorkerEntrypoint {
  /**
   * Get a test service instance - returns an RpcTarget that can be used directly
   * This avoids boilerplate delegation and allows using `test` method name
   */
  connect(): TestServiceCore {
    return new TestServiceCore()
  }
}

// Export as default for WorkerEntrypoint pattern
export default TestService

// Export aliases
export { TestService as TestWorker }
