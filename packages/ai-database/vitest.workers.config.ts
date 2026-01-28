import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    // CRITICAL: Limit concurrency to prevent resource exhaustion
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

    poolOptions: {
      workers: {
        wrangler: { configPath: './wrangler.jsonc' },
        // Disable isolated storage for SQLite DO tests
        // SQLite DOs require non-isolated mode due to how miniflare handles SQLite files
        isolatedStorage: false,
        singleWorker: true,
      },
    },

    // Only include the DO SQLite worker tests
    include: ['test/worker/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
  },
})
