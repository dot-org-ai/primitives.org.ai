/**
 * Vitest Configuration - Browser Environment
 *
 * Runs the shared E2E test suites using fetch-based transport
 * inside a real browser (via vitest browser mode). Tests the
 * same code paths that end users would exercise from a browser.
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
    include: [resolve(__dirname, './*.test.ts')],
    testTimeout: 30000,
    hookTimeout: 15000,

    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      headless: true,
    },
  },
})
