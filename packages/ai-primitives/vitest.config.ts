import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'

// Load .env files manually (dotenv may not be available)
function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return

  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  } catch {
    // Ignore errors loading env files
  }
}

// Load .env from current directory, parent directories, and root
// This supports primitives being used as a submodule
const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '..', '.env'),
  resolve(process.cwd(), '..', '..', '.env'),
  resolve(process.cwd(), '..', '..', '..', '.env'),
]

for (const envPath of envPaths) {
  loadEnvFile(envPath)
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
    include: ['test/**/*.test.ts'],
    // Exclude e2e tests (they have their own config)
    exclude: ['e2e/**', 'node_modules/**'],
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
        statements: 50,
        branches: 40,
        functions: 40,
        lines: 50,
      },
    },
  },
})
