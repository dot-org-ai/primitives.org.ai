/**
 * Worker template for sandbox execution
 *
 * This code is stringified and sent to the worker loader.
 * It uses the TEST service binding (ai-tests) for assertions and test running.
 *
 * The user's code (module, tests, script) is embedded directly into
 * the worker source - no eval() or new Function() needed. The security
 * comes from running in an isolated V8 context via worker_loaders.
 *
 * Routes:
 * - POST /execute - Run tests and scripts, return results
 * - POST /rpc or WebSocket upgrade - capnweb RPC to module exports
 * - GET / - Return info about available exports
 */
import type { SDKConfig } from './types.js';
/**
 * Generate worker code for production (uses RPC to ai-tests)
 */
export declare function generateWorkerCode(options: {
    module?: string | undefined;
    tests?: string | undefined;
    script?: string | undefined;
    sdk?: SDKConfig | boolean | undefined;
    imports?: string[] | undefined;
}): string;
/**
 * Generate worker code for development (embedded test framework)
 *
 * This version bundles the test framework directly into the worker,
 * avoiding the need for RPC service bindings in local development.
 */
export declare function generateDevWorkerCode(options: {
    module?: string | undefined;
    tests?: string | undefined;
    script?: string | undefined;
    sdk?: SDKConfig | boolean | undefined;
    imports?: string[] | undefined;
    fetch?: null | undefined;
}): string;
//# sourceMappingURL=worker-template.d.ts.map