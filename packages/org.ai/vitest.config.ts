import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // CRITICAL: Limit concurrency to prevent resource exhaustion
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],

    // Server deps configuration for node compatibility
    server: {
      deps: {
        inline: [/@org\.ai\/types/, /zod/],
      },
    },
  },
  // Mock cloudflare:workers since it's a worker-specific import
  resolve: {
    alias: {
      'cloudflare:workers': resolve(__dirname, 'src/__mocks__/cloudflare-workers.ts'),
    },
  },
})
