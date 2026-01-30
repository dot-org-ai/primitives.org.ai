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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**'],
      thresholds: {
        statements: 65,
        branches: 60,
        functions: 60,
        lines: 65,
      },
    },
  },
})
