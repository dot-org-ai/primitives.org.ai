/**
 * Vitest Configuration - Node Environment
 *
 * Runs the shared E2E test suites using fetch-based transport
 * in a Node.js runtime. This is the default environment for CI.
 */

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Run sequentially to avoid resource exhaustion against deployed workers
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

    globals: false,
    environment: 'node',
    include: [resolve(__dirname, './*.test.ts')],
    testTimeout: 30000,
    hookTimeout: 15000,

    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
