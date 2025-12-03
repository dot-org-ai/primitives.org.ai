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
    globals: false,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 60000, // AI calls can take time
    hookTimeout: 30000,
    // Run tests sequentially to avoid rate limiting
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
})
