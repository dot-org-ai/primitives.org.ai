/**
 * Worker scaffold and main template generation
 *
 * This module contains generateWorkerCode, which produces the complete worker
 * code for sandbox execution in both production (RPC test runner) and local
 * (embedded test runner) modes from a single template.
 */

import type { SDKConfig } from '../types.js'
import { getExportNames, wrapScriptForReturn } from './helpers.js'
import { transformModuleCode } from './code-transforms.js'
import { generateSDKCode, generateShouldCode } from './sdk-generator.js'
import { generateTestFrameworkCode, generateTestRunnerCode } from './test-generator.js'
import { SANDBOX_ENV_FUNCTION, facetEnvSource } from '../facets.js'

/**
 * Which test runner the generated worker uses for `/execute`.
 *
 * - `'rpc'` (default): proxies `describe`/`it`/`expect` to the loaded
 *   worker's `env.TEST` service binding (ai-tests, passed through by
 *   `buildWorkerCode`) over capnweb RPC. Requires the binding.
 * - `'embedded'`: bundles a vitest-compatible test framework into the worker
 *   itself, so no `TEST` binding is needed. This is what `evaluate()` falls
 *   back to when the environment has no TEST binding (local dev, or a
 *   deployment without ai-tests).
 *
 * Everything else about the worker (console capture, module embedding,
 * capnweb export RPC, GET /:name) is identical in both modes, so local and
 * production run the same template. Network policy is not in the template at
 * all: it is the loader's `globalOutbound` (see `../outbound.ts`).
 */
export type TestRunner = 'rpc' | 'embedded'

export interface GenerateWorkerCodeOptions {
  module?: string | undefined
  tests?: string | undefined
  script?: string | undefined
  sdk?: SDKConfig | boolean | undefined
  /** Import declarations placed at the true top level of the worker module */
  imports?: string[] | undefined
  /** Code run once at module scope, after console capture and before the user module */
  preamble?: string | undefined
  testRunner?: TestRunner | undefined
  /** The sandbox's facet, exposed to the script as `env.<binding>` (see ../facets.ts) */
  facet?: { binding: string; name: string } | undefined
}

/**
 * Generate the sandbox worker module.
 *
 * The result is a self-contained ES module that the Dynamic Workers loader
 * (`env.loader.get(id, ...)`) runs as `worker.js` alongside `capnweb.js`.
 */
export function generateWorkerCode(options: GenerateWorkerCodeOptions): string {
  const {
    module: rawModule = '',
    tests = '',
    script: rawScript = '',
    sdk,
    imports = [],
    preamble = '',
    testRunner = 'rpc',
    facet,
  } = options
  const sdkConfig = sdk === true ? {} : sdk || null
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const script = rawScript ? wrapScriptForReturn(rawScript) : ''
  const exportNames = getExportNames(rawModule)
  const embedded = testRunner === 'embedded'

  // Hoisted imports (the user module's own, and the `imports` option's
  // bindings) - placed at true module top level
  const hoistedImports = imports.length > 0 ? imports.join('\n') + '\n' : ''

  // Test registration + run for /execute, per runner.
  const testSetupCode = embedded
    ? `
    // Embedded test framework (no TEST binding required)
    const pendingTests = [];
    const testResults = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [], duration: 0 };
${generateTestFrameworkCode()}
`
    : `
    // Check for TEST service binding
    if (!__testBinding__) {
      return Response.json({
        success: false,
        error: 'TEST service binding not available. Ensure ai-tests worker is bound.',
        logs,
        duration: 0
      });
    }

    // Connect to get the TestServiceCore via RPC
    const testService = await __testBinding__.connect();

    // Create global test functions that proxy to the RPC service
    const describe = (name, fn) => testService.describe(name, fn);
    const it = (name, fn) => testService.it(name, fn);
    const test = (name, fn) => testService.test(name, fn);
    const expect = (value, message) => testService.expect(value, message);
    const should = (value) => testService.should(value);
    const assert = testService.assert;
    const beforeEach = (fn) => testService.beforeEach(fn);
    const afterEach = (fn) => testService.afterEach(fn);
    const beforeAll = (fn) => testService.beforeAll(fn);
    const afterAll = (fn) => testService.afterAll(fn);

    // Add skip/only modifiers
    it.skip = (name, fn) => testService.skip(name, fn);
    it.only = (name, fn) => testService.only(name, fn);
    test.skip = it.skip;
    test.only = it.only;
`

  const testRunCode = embedded
    ? generateTestRunnerCode()
    : `
    try {
      testResults = await testService.run();
    } catch (e) {
      console.error('Test run error:', e.message);
      testResults = { total: 0, passed: 0, failed: 1, skipped: 0, tests: [], duration: 0, error: e.message };
    }
`

  return `
// Sandbox Worker Entry Point (testRunner: ${testRunner})
import { RpcTarget, newWorkersRpcResponse } from 'capnweb.js';
${hoistedImports}
const logs = [];

${sdkConfig ? generateShouldCode() : ''}

${sdkConfig ? generateSDKCode(sdkConfig) : '// SDK not enabled'}

// Capture console output
const originalConsole = { ...console };
const captureConsole = (level) => (...args) => {
  logs.push({
    level,
    message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
    timestamp: Date.now()
  });
  originalConsole[level](...args);
};
console.log = captureConsole('log');
console.warn = captureConsole('warn');
console.error = captureConsole('error');
console.info = captureConsole('info');
console.debug = captureConsole('debug');

${preamble}

// ============================================================
// USER MODULE CODE (embedded at generation time)
// ============================================================
// Module exports object - exports become top-level variables
const exports = {};

${
  module
    ? `
// Execute module code
try {
${module}
} catch (e) {
  console.error('Module error:', e.message);
}
`
    : '// No module code provided'
}

// Expose all exports as top-level variables for tests and scripts
// This allows: export const add = (a, b) => a + b; then later: add(1, 2)
${
  rawModule
    ? `
const { ${exportNames} } = exports;
`.trim()
    : ''
}

// Logs emitted while evaluating the module belong to every request; logs from a
// previous /execute on a reused (content-addressed) isolate do not.
const __moduleLogCount__ = logs.length;

// ============================================================
// RPC SERVER - Expose exports via capnweb
// ============================================================
class ExportsRpcTarget extends RpcTarget {
  // Dynamically expose all exports as RPC methods
  constructor() {
    super();
    for (const [key, value] of Object.entries(exports)) {
      if (typeof value === 'function') {
        this[key] = value;
      }
    }
  }

  // List available exports
  list() {
    return Object.keys(exports);
  }

  // Get an export by name
  get(name) {
    return exports[name];
  }
}

// ============================================================
// WORKER ENTRY POINT
// ============================================================
// The sandbox env, as tests and the script see it: a frozen copy of the
// allowlisted bindings the loader was given (see buildSandboxEnv), minus
// the reserved SandboxHost stub, plus the facet proxy when there is one.
${facetEnvSource(facet)}

// The request, in a scope of its own: tests and the script are inlined here
// and see \`env\` (the sandbox env) and the TEST service, but neither the
// loader env nor the SandboxHost stub, which only the fetch handler and
// ${SANDBOX_ENV_FUNCTION} name.
const __handleRequest__ = async (request, env, __testBinding__) => {
    const url = new URL(request.url);
    logs.splice(__moduleLogCount__);

    // Route: GET / - Return info about exports
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({
        exports: Object.keys(exports),
        rpc: '/rpc',
        execute: '/execute'
      });
    }

    // Route: /rpc - capnweb RPC to module exports
    if (url.pathname === '/rpc') {
      return newWorkersRpcResponse(request, new ExportsRpcTarget());
    }

    // Route: GET /:name - Simple JSON endpoint to access exports
    if (request.method === 'GET' && url.pathname !== '/execute') {
      const name = url.pathname.slice(1); // Remove leading /
      const value = exports[name];

      // Check if export exists
      if (!(name in exports)) {
        return Response.json({ error: \`Export "\${name}" not found\` }, { status: 404 });
      }

      // If it's not a function, just return the value
      if (typeof value !== 'function') {
        return Response.json({ result: value });
      }

      // It's a function - parse args and call it
      try {
        const args = [];
        const argsParam = url.searchParams.get('args');
        if (argsParam) {
          // Support JSON array: ?args=[1,2,3]
          try {
            const parsed = JSON.parse(argsParam);
            if (Array.isArray(parsed)) {
              args.push(...parsed);
            } else {
              args.push(parsed);
            }
          } catch {
            // Not JSON, use as single string arg
            args.push(argsParam);
          }
        } else {
          // Support named params: ?a=1&b=2 -> passed as object
          const params = Object.fromEntries(url.searchParams.entries());
          if (Object.keys(params).length > 0) {
            // Try to parse numeric values
            for (const [key, val] of Object.entries(params)) {
              const num = Number(val);
              params[key] = !isNaN(num) && val !== '' ? num : val;
            }
            args.push(params);
          }
        }

        const result = await value(...args);
        return Response.json({ result });
      } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
      }
    }

    // Route: /execute - Run tests and scripts
${testSetupCode}
    let scriptResult = undefined;
    let scriptError = null;
    ${embedded ? '' : 'let testResults = undefined;'}

    // ============================================================
    // USER TEST CODE (embedded at generation time)
    // ============================================================

    ${
      tests
        ? `
    // Register tests
    try {
${tests}
    } catch (e) {
      console.error('Test registration error:', e.message);
    }
    `
        : '// No test code provided'
    }

    // Execute user script
    ${
      script
        ? `
    try {
      scriptResult = await (async () => {
${script}
      })();
    } catch (e) {
      console.error('Script error:', e.message);
      scriptError = e.message;
    }
    `
        : '// No script code provided'
    }

    // Run tests if any were registered
    ${tests ? testRunCode : ''}

    const hasTests = ${tests ? 'true' : 'false'};
    const success = scriptError === null && (!hasTests || (testResults && testResults.failed === 0));

    return Response.json({
      success,
      value: scriptResult,
      logs,
      testResults: hasTests ? testResults : undefined,
      error: scriptError || undefined,
      duration: 0
    });
};

export default {
  fetch(request, __env__) {
    return __handleRequest__(request, ${SANDBOX_ENV_FUNCTION}(__env__)${
    embedded ? '' : ', __env__.TEST'
  });
  }
};
`
}

/**
 * @deprecated Use `generateWorkerCode({ ...options, testRunner: 'embedded' })`.
 *
 * Kept as a compatibility alias: the former "dev" template is now the same
 * worker template with the embedded test runner, so local and production
 * sandboxes run identical code.
 */
export function generateDevWorkerCode(
  options: Omit<GenerateWorkerCodeOptions, 'testRunner'>
): string {
  return generateWorkerCode({ ...options, testRunner: 'embedded' })
}
