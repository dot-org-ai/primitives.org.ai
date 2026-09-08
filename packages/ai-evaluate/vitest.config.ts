import { defineConfig } from 'vitest/config'

/**
 * Node-pool vitest config. Tests under `test/workers/**` run inside workerd
 * via `vitest.workers.config.ts` and are excluded here.
 */
export default defineConfig({
  test: {
    // CRITICAL: Limit concurrency to prevent resource exhaustion
    maxConcurrency: 1,
    maxWorkers: 1,
    fileParallelism: false,

    globals: false,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/workers/**', '**/node_modules/**'],
    testTimeout: 30000, // Allow time for Miniflare startup
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', '**/*.test.ts', '**/__tests__/**'],
      thresholds: {
        statements: 65,
        branches: 60,
        functions: 60,
        lines: 65,
      },
    },
  },
})
