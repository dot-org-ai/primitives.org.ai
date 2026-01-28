/**
 * Node E2E Test Runner
 *
 * Imports the shared test suites and runs them using a fetch-based
 * RPC client in a Node.js environment.
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createFetchClient, getEnvConfig } from '../client.js'
import { registerSuite } from '../runner.js'
import type { RPCClient, TestSuite } from '../types.js'

import { createSmokeTests } from '../suites/smoke.suite.js'
import { createDatabaseTests } from '../suites/ai-database.suite.js'
import { createDigitalObjectsTests } from '../suites/digital-objects.suite.js'
import { createProvidersTests } from '../suites/ai-providers.suite.js'
import { createWorkflowsTests } from '../suites/workflows.suite.js'

// =============================================================================
// Client Setup
// =============================================================================

const config = getEnvConfig()
let client: RPCClient

function getClient(): RPCClient {
  if (!client) {
    client = createFetchClient({
      ...config,
      name: 'node',
    })
  }
  return client
}

// =============================================================================
// Register All Suites
// =============================================================================

describe('E2E Tests (Node)', () => {
  registerSuite(createSmokeTests(getClient))
  registerSuite(createDatabaseTests(getClient))
  registerSuite(createDigitalObjectsTests(getClient))
  registerSuite(createProvidersTests(getClient))
  registerSuite(createWorkflowsTests(getClient))
})
