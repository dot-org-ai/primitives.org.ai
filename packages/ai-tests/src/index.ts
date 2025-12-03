/**
 * ai-tests - Test utilities via RPC
 *
 * Provides expect, should, assert, and a test runner that can be:
 * - Deployed as a Cloudflare Worker
 * - Run locally via Miniflare
 * - Called via Workers RPC from other workers (like ai-sandbox)
 *
 * @packageDocumentation
 */

// Export assertion utilities
export { Assertion, expect, should, assert } from './assertions.js'

// Export test runner
export { TestRunner, createRunner } from './runner.js'

// Export worker service (WorkerEntrypoint and RpcTarget)
export { TestService, TestService as TestWorker, TestServiceCore } from './worker.js'

// Export the default WorkerEntrypoint class
export { default } from './worker.js'

// Export types
export type {
  TestResult,
  TestResults,
  TestFn,
  HookFn,
  RegisteredTest,
  SuiteContext,
  TestEnv
} from './types.js'
