/**
 * Vitest Configuration - Worker Environment (vitest-pool-workers)
 *
 * Runs the shared E2E test suites inside a Cloudflare Workers runtime
 * using @cloudflare/vitest-pool-workers. Tests use service bindings
 * to connect to other workers, exercising the same RPC paths that
 * production worker-to-worker communication uses.
 */

import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
import { resolve } from 'path'

export default defineWorkersConfig({
  test: {
    // Run sequentially to avoid resource exhaustion
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

    include: [resolve(__dirname, './*.test.ts')],
    testTimeout: 30000,
    hookTimeout: 15000,

    poolOptions: {
      workers: {
        wrangler: { configPath: resolve(__dirname, './wrangler.toml') },
      },
    },
  },
})
