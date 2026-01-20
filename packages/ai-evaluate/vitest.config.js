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
        include: ['test/**/*.test.ts'],
        testTimeout: 30000, // Allow time for Miniflare startup
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: ['src/types.ts']
        }
    },
});
