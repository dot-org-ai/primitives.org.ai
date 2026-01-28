/**
 * Worker E2E Test Runner (vitest-pool-workers)
 *
 * Imports the shared test suites and runs them using service binding
 * transport inside a Cloudflare Workers runtime. This exercises the
 * same RPC code paths used in production worker-to-worker communication.
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { env } from 'cloudflare:test'
import { createServiceBindingClient } from '../client.js'
import { registerSuite } from '../runner.js'
import type { RPCClient } from '../types.js'

import { createSmokeTests } from '../suites/smoke.suite.js'
import { createDatabaseTests } from '../suites/ai-database.suite.js'
import { createDigitalObjectsTests } from '../suites/digital-objects.suite.js'
import { createProvidersTests } from '../suites/ai-providers.suite.js'
import { createWorkflowsTests } from '../suites/workflows.suite.js'

// =============================================================================
// Client Setup
// =============================================================================

let client: RPCClient

function getClient(): RPCClient {
  if (!client) {
    client = createServiceBindingClient(env as any)
  }
  return client
}

// =============================================================================
// Register All Suites
// =============================================================================

describe('E2E Tests (Worker)', () => {
  registerSuite(createSmokeTests(getClient))
  registerSuite(createDatabaseTests(getClient))
  registerSuite(createDigitalObjectsTests(getClient))
  registerSuite(createProvidersTests(getClient))
  registerSuite(createWorkflowsTests(getClient))
})
