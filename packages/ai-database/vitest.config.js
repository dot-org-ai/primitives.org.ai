import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
    // CRITICAL: Limit concurrency to prevent resource exhaustion
    maxConcurrency: 1,
    maxWorkers: 1,
    minWorkers: 1,
    fileParallelism: false,

        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
        exclude: ['node_modules/**', 'dist/**'],
        testTimeout: 30000,
        hookTimeout: 15000,
        // Run tests sequentially for database operations
        pool: 'forks',
        poolOptions: {
            forks: {
                singleFork: true,
            },
        },
    },
});
