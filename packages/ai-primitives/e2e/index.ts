/**
 * AI Primitives E2E Test Architecture
 *
 * Unified E2E testing across three environments:
 * - Node (fetch-based transport)
 * - Browser (fetch-based transport via vitest browser mode)
 * - Worker (service binding transport via vitest-pool-workers)
 *
 * All three environments share the same test suites -- zero code duplication.
 *
 * ## Quick Start
 *
 * Run in a specific environment:
 *
 * ```bash
 * # Node (default)
 * E2E_BASE_URL=https://api.primitives.org.ai pnpm vitest run --config e2e/node/vitest.config.ts
 *
 * # Browser
 * E2E_BASE_URL=https://api.primitives.org.ai pnpm vitest run --config e2e/browser/vitest.config.ts
 *
 * # Worker (vitest-pool-workers)
 * pnpm vitest run --config e2e/worker/vitest.config.ts
 * ```
 *
 * ## Architecture
 *
 * ```
 * e2e/
 * |-- types.ts              # Shared types (RPCClient, TestSuite, etc.)
 * |-- client.ts             # Client factories (fetch-based, service binding)
 * |-- helpers.ts            # Assertion helpers and utilities
 * |-- runner.ts             # TestSuite -> vitest adapter
 * |-- suites/               # Environment-agnostic test suites
 * |   |-- index.ts          # Re-exports all suites
 * |   |-- smoke.suite.ts    # Connectivity smoke tests
 * |   |-- ai-database.suite.ts
 * |   |-- ai-providers.suite.ts
 * |   |-- digital-objects.suite.ts
 * |   |-- workflows.suite.ts
 * |-- node/                 # Node runner
 * |   |-- vitest.config.ts
 * |   |-- e2e.test.ts
 * |-- browser/              # Browser runner
 * |   |-- vitest.config.ts
 * |   |-- e2e.test.ts
 * |-- worker/               # Worker pool runner
 *     |-- vitest.config.ts
 *     |-- wrangler.toml
 *     |-- e2e.test.ts
 *     |-- src/index.ts
 * ```
 *
 * @packageDocumentation
 */

// Types
export type {
  RPCClient,
  DatabaseClient,
  DigitalObjectsClient,
  ProvidersClient,
  WorkflowsClient,
  ClientFactory,
  TestSuite,
  TestCase,
  TestSuiteFactory,
  EnvironmentConfig,
  EntityResult,
  SearchResult,
  SemanticSearchResult,
  HybridSearchResult,
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  Thing,
  Action,
  ProviderInfo,
  ModelInfo,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowTrigger,
  WorkflowInstance,
  WorkflowRun,
} from './types.js'

// Client factories
export { createFetchClient, createServiceBindingClient, getEnvConfig } from './client.js'

// Helpers
export {
  testId,
  testNamespace,
  retry,
  sleep,
  assertDefined,
  assertEqual,
  assertTrue,
  assertFalse,
  assertLength,
  assertNotEmpty,
  assertThrows,
  assertContains,
  assertType,
  assertDeepEqual,
  assertIncludes,
  assertGreaterThan,
  assertGreaterThanOrEqual,
} from './helpers.js'

// Runner
export { registerSuite, registerSuites, registerAllSuites } from './runner.js'

// Test suite factories
export {
  createSmokeTests,
  createDatabaseTests,
  createDigitalObjectsTests,
  createProvidersTests,
  createWorkflowsTests,
} from './suites/index.js'
