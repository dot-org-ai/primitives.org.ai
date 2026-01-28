import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        main: './src/worker.ts',
        miniflare: {
          compatibilityDate: '2025-01-20',
          compatibilityFlags: ['nodejs_compat_v2'],
          durableObjects: {
            DIGITAL_OBJECTS: 'DigitalObjectsWorker',
          },
        },
      },
    },
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
})
