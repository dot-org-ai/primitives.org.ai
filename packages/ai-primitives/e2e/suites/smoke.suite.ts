/**
 * Smoke Test Suite
 *
 * Quick connectivity and health checks against deployed workers.
 * These tests validate that the services are reachable and responding.
 * Run first before running the full E2E suite.
 *
 * @packageDocumentation
 */

import type { TestSuite, ClientFactory } from '../types.js'
import { assertDefined, assertTrue, assertType, retry } from '../helpers.js'

/**
 * Create the Smoke test suite
 */
export function createSmokeTests(getClient: ClientFactory): TestSuite {
  return {
    name: 'Smoke Tests',

    tests: [
      {
        name: 'should connect to the database service',
        fn: async () => {
          const client = getClient()
          assertDefined(client.database, 'Database client should be available')

          // Basic connectivity check - list should not throw
          const result = await retry(() => client.database.list('__smoke_test__', { limit: 1 }), {
            maxRetries: 2,
            delayMs: 500,
          })

          assertDefined(result, 'Should get a response from database')
          assertTrue(Array.isArray(result), 'Should return an array')
        },
        timeout: 15000,
      },

      {
        name: 'should connect to the digital objects service',
        fn: async () => {
          const client = getClient()
          assertDefined(client.objects, 'Objects client should be available')

          // Basic connectivity check
          const result = await retry(() => client.objects.list('__smoke_test__', { limit: 1 }), {
            maxRetries: 2,
            delayMs: 500,
          })

          assertDefined(result, 'Should get a response from objects')
          assertTrue(Array.isArray(result), 'Should return an array')
        },
        timeout: 15000,
      },

      {
        name: 'should connect to the providers service',
        fn: async () => {
          const client = getClient()
          assertDefined(client.providers, 'Providers client should be available')

          // Basic connectivity check
          const result = await retry(() => client.providers.list(), { maxRetries: 2, delayMs: 500 })

          assertDefined(result, 'Should get a response from providers')
          assertTrue(Array.isArray(result), 'Should return an array')
        },
        timeout: 15000,
      },

      {
        name: 'should connect to the workflows service',
        fn: async () => {
          const client = getClient()
          assertDefined(client.workflows, 'Workflows client should be available')

          // Basic connectivity check
          const result = await retry(() => client.workflows.list({ limit: 1 }), {
            maxRetries: 2,
            delayMs: 500,
          })

          assertDefined(result, 'Should get a response from workflows')
          assertTrue(Array.isArray(result), 'Should return an array')
        },
        timeout: 15000,
      },

      {
        name: 'should perform a database round-trip',
        fn: async () => {
          const client = getClient()
          const db = client.database
          const id = `smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`

          // Create
          const created = await db.create('SmokeTst', { ping: 'pong' }, id)
          assertDefined(created, 'Should create entity')

          // Read
          const retrieved = await db.get('SmokeTst', id)
          assertDefined(retrieved, 'Should retrieve entity')
          assertTrue(
            (retrieved as Record<string, unknown>).ping === 'pong',
            'Should have correct data'
          )

          // Delete (cleanup)
          await db.delete('SmokeTst', id)
        },
        timeout: 15000,
      },
    ],
  }
}
