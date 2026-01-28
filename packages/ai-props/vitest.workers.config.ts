import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

// Load .env file from project root for AI Gateway credentials
const envPath = resolve(__dirname, '../../.env')
const envBindings: Record<string, string> = {}
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=')
        process.env[key] = value
        envBindings[key] = value
      }
    }
  }
}

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
          // Pass environment variables as bindings to the worker
          bindings: envBindings,
        },
      },
    },

    // Only include worker-specific tests
    include: ['test/worker/**/*.test.ts'],
    // Setup file to configure AI providers from bindings
    setupFiles: ['./test/worker/setup.ts'],
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
