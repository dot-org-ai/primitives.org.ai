/**
 * Worker scaffold and main template generation
 *
 * This module contains the main generateWorkerCode and generateDevWorkerCode functions
 * that produce the complete worker code for sandbox execution.
 */

import type { SDKConfig, FetchConfig } from '../types.js'
import { getExportNames, wrapScriptForReturn } from './helpers.js'
import { transformModuleCode } from './code-transforms.js'
import { generateSDKCode, generateShouldCode } from './sdk-generator.js'
import { generateTestFrameworkCode, generateTestRunnerCode } from './test-generator.js'
import { generateDomainCheckCode } from '../shared.js'

/**
 * Generate worker code for production (uses RPC to ai-tests)
 */
export function generateWorkerCode(options: {
  module?: string | undefined
  tests?: string | undefined
  script?: string | undefined
  sdk?: SDKConfig | boolean | undefined
  imports?: string[] | undefined
  fetch?: FetchConfig
}): string {
  const {
    module: rawModule = '',
    tests = '',
    script: rawScript = '',
    sdk,
    imports = [],
    fetch: fetchOption,
  } = options
  const sdkConfig = sdk === true ? {} : sdk || null
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const script = rawScript ? wrapScriptForReturn(rawScript) : ''
  const exportNames = getExportNames(rawModule)

  // Hoisted imports (from MDX test files) - placed at true module top level
  const hoistedImports = imports.length > 0 ? imports.join('\n') + '\n' : ''

  // Generate fetch control code for allowlist (block is handled by globalOutbound)
  const allowlistDomains = Array.isArray(fetchOption) ? fetchOption : null
  const fetchControlCode = allowlistDomains ? generateDomainCheckCode(allowlistDomains) : ''

  return `
// Sandbox Worker Entry Point
import { RpcTarget, newWorkersRpcResponse } from 'capnweb.js';
${hoistedImports}
const logs = [];

${fetchControlCode}

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
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
    // Check for TEST service binding
    if (!env.TEST) {
      return Response.json({
        success: false,
        error: 'TEST service binding not available. Ensure ai-tests worker is bound.',
        logs,
        duration: 0
      });
    }

    // Connect to get the TestServiceCore via RPC
    const testService = await env.TEST.connect();

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

    let scriptResult = undefined;
    let scriptError = null;
    let testResults = undefined;

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
    ${
      tests
        ? `
    try {
      testResults = await testService.run();
    } catch (e) {
      console.error('Test run error:', e.message);
      testResults = { total: 0, passed: 0, failed: 1, skipped: 0, tests: [], duration: 0, error: e.message };
    }
    `
        : ''
    }

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
  }
};
`
}

/**
 * Generate worker code for development (embedded test framework)
 *
 * This version bundles the test framework directly into the worker,
 * avoiding the need for RPC service bindings in local development.
 */
export function generateDevWorkerCode(options: {
  module?: string | undefined
  tests?: string | undefined
  script?: string | undefined
  sdk?: SDKConfig | boolean | undefined
  imports?: string[] | undefined
  fetch?: null | FetchConfig | undefined
}): string {
  const {
    module: rawModule = '',
    tests = '',
    script: rawScript = '',
    sdk,
    imports = [],
    fetch: fetchOption,
  } = options
  const sdkConfig = sdk === true ? {} : sdk || null
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const script = rawScript ? wrapScriptForReturn(rawScript) : ''
  const exportNames = getExportNames(rawModule)

  // Determine fetch handling mode
  // - false or null -> block all network
  // - string[] -> domain allowlist
  // - true or undefined -> allow all (no wrapper needed)
  const blockFetch = fetchOption === false || fetchOption === null
  const allowlistDomains = Array.isArray(fetchOption) ? fetchOption : null

  // Hoisted imports (from MDX test files) - placed at true module top level
  const hoistedImports = imports.length > 0 ? imports.join('\n') + '\n' : ''

  // Generate fetch control code based on mode
  let fetchControlCode = ''
  if (blockFetch) {
    fetchControlCode = `
// Block fetch when fetch: false or null is specified
const __originalFetch__ = globalThis.fetch;
globalThis.fetch = async (...args) => {
  throw new Error('Network access blocked: fetch is disabled in this sandbox');
};
`
  } else if (allowlistDomains) {
    fetchControlCode = generateDomainCheckCode(allowlistDomains)
  }

  return `
// Sandbox Worker Entry Point (Dev Mode - embedded test framework)
${hoistedImports}
const logs = [];
const testResults = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [], duration: 0 };
const pendingTests = [];

${fetchControlCode}

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

${generateTestFrameworkCode()}

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

// ============================================================
// SIMPLE RPC HANDLER (dev mode - no capnweb dependency)
// ============================================================
async function handleRpc(request) {
  try {
    const { method, args = [] } = await request.json();
    if (method === 'list') {
      return Response.json({ result: Object.keys(exports) });
    }
    if (method === 'get') {
      const [name] = args;
      const value = exports[name];
      if (typeof value === 'function') {
        return Response.json({ result: { type: 'function', name } });
      }
      return Response.json({ result: value });
    }
    // Call an exported function
    const fn = exports[method];
    if (typeof fn !== 'function') {
      return Response.json({ error: \`Export "\${method}" is not a function\` }, { status: 400 });
    }
    const result = await fn(...args);
    return Response.json({ result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// ============================================================
// WORKER ENTRY POINT
// ============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route: GET / - Return info about exports
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({
        exports: Object.keys(exports),
        rpc: '/rpc',
        execute: '/execute'
      });
    }

    // Route: POST /rpc - Simple RPC to module exports
    if (url.pathname === '/rpc' && request.method === 'POST') {
      return handleRpc(request);
    }

    // Route: GET /:name - Simple JSON endpoint to access exports
    if (request.method === 'GET' && url.pathname !== '/execute') {
      const name = url.pathname.slice(1);
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
          try {
            const parsed = JSON.parse(argsParam);
            if (Array.isArray(parsed)) args.push(...parsed);
            else args.push(parsed);
          } catch {
            args.push(argsParam);
          }
        } else {
          const params = Object.fromEntries(url.searchParams.entries());
          if (Object.keys(params).length > 0) {
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
    let scriptResult = undefined;
    let scriptError = null;

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

${generateTestRunnerCode()}

    const hasTests = ${tests ? 'true' : 'false'};
    const success = scriptError === null && (!hasTests || testResults.failed === 0);

    return Response.json({
      success,
      value: scriptResult,
      logs,
      testResults: hasTests ? testResults : undefined,
      error: scriptError || undefined,
      duration: 0
    });
  }
};
`
}
