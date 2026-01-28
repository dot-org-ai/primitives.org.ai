/**
 * Browser E2E Test Runner
 *
 * Imports the shared test suites and runs them using a fetch-based
 * RPC client inside a browser environment (via vitest browser mode).
 *
 * This validates that the same API calls work correctly from a browser
 * context, exercising CORS, browser fetch, and real network paths.
 */

import { describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { createFetchClient } from '../client.js'
import { registerSuite } from '../runner.js'
import type { RPCClient, EnvironmentConfig } from '../types.js'

import { createSmokeTests } from '../suites/smoke.suite.js'
import { createDatabaseTests } from '../suites/ai-database.suite.js'
import { createDigitalObjectsTests } from '../suites/digital-objects.suite.js'
import { createProvidersTests } from '../suites/ai-providers.suite.js'
import { createWorkflowsTests } from '../suites/workflows.suite.js'

// =============================================================================
// Client Setup
// =============================================================================

/**
 * In browser mode, environment variables are not directly accessible.
 * Configuration is injected via vitest's `define` or read from
 * the page's meta tags / query params at runtime.
 */
function getBrowserConfig(): EnvironmentConfig {
  // Vitest can inject these via define in the config
  const baseUrl = (globalThis as any).__E2E_BASE_URL__ || 'https://api.primitives.org.ai'

  const token = (globalThis as any).__E2E_TOKEN__ || undefined

  return {
    name: 'browser',
    baseUrl,
    token,
    timeout: 30000,
  }
}

let client: RPCClient

function getClient(): RPCClient {
  if (!client) {
    client = createFetchClient(getBrowserConfig())
  }
  return client
}

// =============================================================================
// Register All Suites
// =============================================================================

describe('E2E Tests (Browser)', () => {
  registerSuite(createSmokeTests(getClient))
  registerSuite(createDatabaseTests(getClient))
  registerSuite(createDigitalObjectsTests(getClient))
  registerSuite(createProvidersTests(getClient))
  registerSuite(createWorkflowsTests(getClient))
})
