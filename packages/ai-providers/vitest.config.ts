import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'
import { resolve } from 'path'
import { existsSync } from 'fs'

// Load .env from current directory, parent directories, and root
// This supports primitives being used as a submodule
const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '..', '.env'),
  resolve(process.cwd(), '..', '..', '.env'),
  resolve(process.cwd(), '..', '..', '..', '.env'),
]

for (const envPath of envPaths) {
  if (existsSync(envPath)) {
    config({ path: envPath })
  }
}

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
    testTimeout: 60000, // AI calls can take time
    hookTimeout: 30000,
    // Run tests sequentially to avoid rate limiting
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__tests__/**', '**/node_modules/**'],
      thresholds: {
        statements: 65,
        branches: 60,
        functions: 60,
        lines: 65,
      },
    },
  },
})
