import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/noun.test.ts', 'test/pipelining.test.ts', 'test/rpc-promise.test.ts'],
  },
})
