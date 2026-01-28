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
        miniflare: {
          compatibilityDate: '2025-01-20',
          compatibilityFlags: ['nodejs_compat_v2'],
          durableObjects: {
            DATABASE: 'DatabaseDO',
          },
        },
      },
    },

    // Only include the DO SQLite worker tests
    include: ['test/worker/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
  },
})
