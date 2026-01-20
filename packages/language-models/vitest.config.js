import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
    // CRITICAL: Limit concurrency to prevent resource exhaustion
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

        globals: false,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        testTimeout: 10000,
        hookTimeout: 10000,
    },
});
