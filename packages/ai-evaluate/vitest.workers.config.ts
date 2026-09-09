/**
 * Workers-pool vitest config: runs `test/workers/**` inside workerd via
 * `@cloudflare/vitest-pool-workers`, with a real `worker_loaders` binding
 * (`env.loader`) declared in `test/workers/wrangler.test.jsonc`.
 *
 * `@cloudflare/vitest-pool-workers` >= 0.15 targets Vitest 4 and replaces
 * `defineWorkersConfig` / `test.poolOptions.workers` with the `cloudflareTest`
 * Vite plugin; the pool options are the plugin's argument.
 *
 * The Node pool (`vitest.config.ts`) excludes this directory.
 */
import { cloudflareTest } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

/** Wrangler config for the workers pool, relative to this file */
export const WRANGLER_TEST_CONFIG_PATH = './test/workers/wrangler.test.jsonc'

/** Test files that run inside workerd */
export const WORKERS_TEST_INCLUDE = ['test/workers/**/*.test.ts']

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: WRANGLER_TEST_CONFIG_PATH } })],
  test: {
    // CRITICAL: Limit concurrency to prevent resource exhaustion (one workerd)
    maxConcurrency: 1,
    maxWorkers: 1,
    fileParallelism: false,

    globals: false,
    include: WORKERS_TEST_INCLUDE,
    testTimeout: 30000, // Loader isolates start on first use
    // Expected host-side rejections of the outbound gateway (see the file)
    setupFiles: ['./test/workers/setup.ts'],
  },
})
