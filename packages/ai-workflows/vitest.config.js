import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
    // CRITICAL: Limit concurrency to prevent resource exhaustion
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

        globals: true,
        include: ['test/**/*.test.ts'],
    },
});
