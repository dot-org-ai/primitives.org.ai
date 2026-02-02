import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

// Manually load .env file since dotenv may not be available
const envPath = resolve(__dirname, '../../.env')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        process.env[key] = valueParts.join('=')
      }
    }
  }
}

export default defineConfig({
  test: {
    // CRITICAL: Limit concurrency to prevent resource exhaustion
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // test/worker/** and test/core-schema.test.ts require @cloudflare/vitest-pool-workers
    // (they import 'cloudflare:test' and use DurableObject stubs with SQLite storage).
    // They cannot run in the Node.js vitest environment configured here.
    // To enable them, create a separate vitest config with:
    //   pool: '@cloudflare/vitest-pool-workers'
    // and the wrangler.jsonc bindings (DATABASE DO, AI Gateway).
    // These are RED-phase TDD tests for the DO SQLite layer covering: core schema CRUD,
    // events/pipeline, query operations, relationships, and semantic search.
    exclude: ['node_modules/**', 'dist/**', 'test/worker/**', 'test/core-schema.test.ts'],
    testTimeout: 30000,
    hookTimeout: 15000,
    // Run tests sequentially for database operations
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Coverage configuration - targeting 85% line coverage
    // Current coverage: ~59% lines, ~85% branches, ~81% functions
    // See: https://vitest.dev/config/#coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        '**/node_modules/**',
        'src/**/*.d.ts',
        'src/tests.ts', // Test utilities export, not production code
      ],
      // Thresholds set to current passing levels with goal of 85% lines
      // Incrementally increase as coverage improves
      thresholds: {
        statements: 58,
        branches: 84,
        functions: 80,
        lines: 58,
      },
      // Clean coverage directory before running
      clean: true,
      // Show all files including uncovered
      all: true,
    },
  },
})
