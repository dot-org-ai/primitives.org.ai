import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';
// Load .env from current directory, parent directories, and root
// This supports primitives being used as a submodule
const envPaths = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '..', '.env'),
    resolve(process.cwd(), '..', '..', '.env'),
    resolve(process.cwd(), '..', '..', '..', '.env'),
];
for (const envPath of envPaths) {
    if (existsSync(envPath)) {
        config({ path: envPath });
    }
}
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
        // Exclude runtime-specific tests (use separate configs)
        exclude: [
            'test/rpc/workers/**',
            'test/rpc/bun/**',
            'node_modules/**',
        ],
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
});
