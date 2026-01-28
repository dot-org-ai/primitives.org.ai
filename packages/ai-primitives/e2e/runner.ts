/**
 * Test Suite Runner Adapter
 *
 * Bridges the environment-agnostic TestSuite format into vitest's
 * describe/it/beforeAll/afterAll API. This allows the same suite
 * definitions to be consumed by any vitest configuration.
 *
 * @packageDocumentation
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import type { TestSuite, ClientFactory } from './types.js'
import {
  createSmokeTests,
  createDatabaseTests,
  createDigitalObjectsTests,
  createProvidersTests,
  createWorkflowsTests,
} from './suites/index.js'

/**
 * Register a TestSuite with vitest
 *
 * Converts the suite's test cases into vitest's describe/it blocks,
 * wiring up lifecycle hooks (beforeAll, afterAll, beforeEach, afterEach).
 *
 * @param suite - The test suite to register
 */
export function registerSuite(suite: TestSuite): void {
  describe(suite.name, () => {
    if (suite.beforeAll) {
      beforeAll(suite.beforeAll)
    }
    if (suite.afterAll) {
      afterAll(suite.afterAll)
    }
    if (suite.beforeEach) {
      beforeEach(suite.beforeEach)
    }
    if (suite.afterEach) {
      afterEach(suite.afterEach)
    }

    for (const test of suite.tests) {
      if (test.skip) {
        it.skip(test.name, test.fn, test.timeout)
      } else if (test.only) {
        it.only(test.name, test.fn, test.timeout)
      } else {
        it(test.name, test.fn, test.timeout)
      }
    }
  })
}

/**
 * Register multiple test suites with vitest
 *
 * @param suites - Array of test suites to register
 */
export function registerSuites(suites: TestSuite[]): void {
  for (const suite of suites) {
    registerSuite(suite)
  }
}

/**
 * Create and register all standard E2E suites with a given client factory.
 *
 * This is the main entry point for environment runners -- call this once
 * with the appropriate client factory and all suites will be registered.
 *
 * @param getClient - Factory function that returns an RPCClient
 * @param options - Options controlling which suites to run
 */
export function registerAllSuites(getClient: ClientFactory, options: RegisterOptions = {}): void {
  const {
    smoke = true,
    database = true,
    objects = true,
    providers = true,
    workflows = true,
  } = options

  const suites: TestSuite[] = []

  if (smoke) suites.push(createSmokeTests(getClient))
  if (database) suites.push(createDatabaseTests(getClient))
  if (objects) suites.push(createDigitalObjectsTests(getClient))
  if (providers) suites.push(createProvidersTests(getClient))
  if (workflows) suites.push(createWorkflowsTests(getClient))

  registerSuites(suites)
}

/**
 * Options for which suites to register
 */
export interface RegisterOptions {
  /** Run smoke tests (default: true) */
  smoke?: boolean
  /** Run database tests (default: true) */
  database?: boolean
  /** Run digital objects tests (default: true) */
  objects?: boolean
  /** Run providers tests (default: true) */
  providers?: boolean
  /** Run workflows tests (default: true) */
  workflows?: boolean
}
