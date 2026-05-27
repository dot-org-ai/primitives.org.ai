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
        wrangler: { configPath: './wrangler.sm.jsonc' },
        // Non-isolated storage so the DO's state.storage + alarms persist
        // across requests within a test (mirrors the SQLite-DO config).
        isolatedStorage: false,
        singleWorker: true,
        miniflare: {
          compatibilityDate: '2025-01-20',
          compatibilityFlags: ['nodejs_compat_v2'],
        },
      },
    },

    // Only the state-machine DO integration test.
    include: ['test/worker/state-machine-durable-object.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
  },
})
