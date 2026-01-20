import { defineConfig } from 'vitest/config'
import path from 'path'

const packagesDir = path.resolve(__dirname, '..')

export default defineConfig({
  test: {
    // CRITICAL: Limit concurrency to prevent resource exhaustion
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.test.js'],
    globals: true,

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
  resolve: {
    alias: {
      // Resolve workspace dependencies to source files for testing
      // Handle subpath exports first (more specific)
      'ai-providers/cloudflare': path.resolve(packagesDir, 'ai-providers/src/providers/cloudflare.ts'),

      // Main exports
      'ai-functions': path.resolve(packagesDir, 'ai-functions/src/index.ts'),
      '@org.ai/core': path.resolve(packagesDir, 'ai-core/src/index.ts'),
      'ai-providers': path.resolve(packagesDir, 'ai-providers/src/index.ts'),
      'language-models': path.resolve(packagesDir, 'language-models/src/index.ts'),
      'digital-objects': path.resolve(packagesDir, 'digital-objects/src/index.ts'),
      'ai-database': path.resolve(packagesDir, 'ai-database/src/index.ts'),
    },
  },
})
