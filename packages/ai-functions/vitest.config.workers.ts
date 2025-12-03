/**
 * Vitest configuration for Cloudflare Workers tests
 *
 * Uses @cloudflare/vitest-pool-workers for running tests in miniflare.
 */

import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    globals: false,
    include: ['test/rpc/workers/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 15000,
    poolOptions: {
      workers: {
        wrangler: {
          configPath: './test/rpc/workers/wrangler.toml',
        },
        miniflare: {
          compatibilityDate: '2024-12-01',
          compatibilityFlags: ['nodejs_compat'],
        },
      },
    },
  },
})
