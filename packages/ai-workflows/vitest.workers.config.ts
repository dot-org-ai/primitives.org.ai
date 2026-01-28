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
        // Disable isolated storage for Workflows tests
        // Workflows require non-isolated mode due to how miniflare handles them
        isolatedStorage: false,
        singleWorker: true,
        miniflare: {
          compatibilityDate: '2025-01-20',
          compatibilityFlags: ['nodejs_compat_v2'],
        },
      },
    },

    // Only include worker-specific tests
    include: ['test/worker/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__tests__/**', '**/node_modules/**'],
    },
  },
})
