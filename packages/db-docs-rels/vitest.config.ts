import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
})
