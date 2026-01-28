/**
 * Static worker template exports for ai-evaluate
 *
 * This module exports pre-built templates and builder functions
 * for creating worker code with capnweb RPC support.
 *
 * @example
 * ```typescript
 * import { WORKER_TEMPLATE, CAPNWEB_BUNDLE, buildWorkerTemplate } from 'ai-evaluate/static'
 *
 * // Use pre-built full template
 * const workerCode = WORKER_TEMPLATE
 *
 * // Or build a custom template
 * const customWorker = buildWorkerTemplate({
 *   module: 'export const add = (a, b) => a + b',
 *   tests: 'it("adds", () => expect(add(1, 2)).toBe(3))'
 * })
 * ```
 */

import { CAPNWEB_SOURCE } from '../capnweb-bundle.js'
import { generateWorkerCode, generateDevWorkerCode } from '../worker-template/index.js'
import {
  generateTestFrameworkCode,
  generateTestRunnerCode,
} from '../worker-template/test-generator.js'
import { generateSDKCode, generateShouldCode } from '../worker-template/sdk-generator.js'
import { generateDomainCheckCode } from '../shared.js'
import type { SDKConfig, FetchConfig } from '../types.js'

/**
 * Version of the static assets
 */
export const VERSION = '2.1.8'

/**
 * The bundled capnweb RPC library source code
 * This is the full capnweb library for Cloudflare Workers
 */
export const CAPNWEB_BUNDLE = CAPNWEB_SOURCE

/**
 * Base scaffold template without capnweb or user code
 * This is the minimal worker structure with console capture and test framework
 */
export const SCAFFOLD_TEMPLATE = `// Sandbox Worker Scaffold
// Version: ${VERSION}

const logs = [];

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

// Module exports object
const exports = {};

// ============================================================
// USER CODE PLACEHOLDER
// Replace this section with module, test, and script code
// ============================================================

// USER_MODULE_CODE
// USER_TEST_CODE
// USER_SCRIPT_CODE

// ============================================================
// WORKER ENTRY POINT
// ============================================================
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route: GET / - Return info
    if (request.method === 'GET' && url.pathname === '/') {
      return Response.json({
        exports: Object.keys(exports),
        rpc: '/rpc',
        execute: '/execute'
      });
    }

    // Route: /execute - Run tests and scripts
    let scriptResult = undefined;
    let scriptError = null;
    const testResults = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [], duration: 0 };
    const pendingTests = [];

${generateTestRunnerCode()}

    const hasTests = pendingTests.length > 0;
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

/**
 * Full worker template with capnweb RPC support
 * This is a complete worker ready to be deployed
 */
export const WORKER_TEMPLATE = `// Sandbox Worker Template with capnweb RPC
// Version: ${VERSION}
// ai-evaluate static export

import { RpcTarget, newWorkersRpcResponse } from 'capnweb.js';

const logs = [];

${generateShouldCode()}

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

// Module exports object
const exports = {};

// ============================================================
// USER CODE PLACEHOLDER
// Replace this section with module, test, and script code
// ============================================================

// USER_MODULE_CODE
// USER_TEST_CODE

// ============================================================
// RPC SERVER - Expose exports via capnweb
// ============================================================
class ExportsRpcTarget extends RpcTarget {
  constructor() {
    super();
    for (const [key, value] of Object.entries(exports)) {
      if (typeof value === 'function') {
        this[key] = value;
      }
    }
  }

  list() {
    return Object.keys(exports);
  }

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
      const name = url.pathname.slice(1);
      const value = exports[name];

      if (!(name in exports)) {
        return Response.json({ error: \`Export "\${name}" not found\` }, { status: 404 });
      }

      if (typeof value !== 'function') {
        return Response.json({ result: value });
      }

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
    const testResults = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [], duration: 0 };
    const pendingTests = [];

    // USER_SCRIPT_CODE

${generateTestRunnerCode()}

    const hasTests = pendingTests.length > 0;
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

/**
 * Options for building worker templates
 */
export interface BuildWorkerOptions {
  /** Module code with exports */
  module?: string
  /** Test code using vitest-style API */
  tests?: string
  /** Script code to run immediately */
  script?: string
  /** Enable SDK globals ($, db, ai, etc.) */
  sdk?: SDKConfig | boolean
  /** Top-level imports to hoist */
  imports?: string[]
  /** Network access configuration */
  fetch?: FetchConfig
  /** Use dev mode (embedded test framework, no capnweb) */
  dev?: boolean
}

/**
 * Build a complete worker template with user code embedded
 *
 * @param options - Worker configuration
 * @returns Complete worker source code
 *
 * @example
 * ```typescript
 * const worker = buildWorkerTemplate({
 *   module: 'export const add = (a, b) => a + b',
 *   tests: 'it("adds numbers", () => expect(add(1, 2)).toBe(3))',
 *   sdk: true
 * })
 * ```
 */
export function buildWorkerTemplate(options: BuildWorkerOptions = {}): string {
  if (options.dev) {
    return generateDevWorkerCode({
      ...(options.module !== undefined && { module: options.module }),
      ...(options.tests !== undefined && { tests: options.tests }),
      ...(options.script !== undefined && { script: options.script }),
      ...(options.sdk !== undefined && { sdk: options.sdk }),
      ...(options.imports !== undefined && { imports: options.imports }),
      ...(options.fetch !== undefined && { fetch: options.fetch }),
    })
  }
  return generateWorkerCode({
    ...(options.module !== undefined && { module: options.module }),
    ...(options.tests !== undefined && { tests: options.tests }),
    ...(options.script !== undefined && { script: options.script }),
    ...(options.sdk !== undefined && { sdk: options.sdk }),
    ...(options.imports !== undefined && { imports: options.imports }),
    ...(options.fetch !== undefined && { fetch: options.fetch }),
  })
}

/**
 * Build a worker module bundle including capnweb
 * Returns an object with mainModule and modules for worker_loaders
 *
 * @param options - Worker configuration
 * @returns Worker code configuration for worker_loaders
 */
export function buildWorkerBundle(options: BuildWorkerOptions = {}): {
  mainModule: string
  modules: Record<string, string>
} {
  const mainModule = buildWorkerTemplate(options)
  return {
    mainModule,
    modules: {
      'capnweb.js': CAPNWEB_BUNDLE,
    },
  }
}

/**
 * Get the test framework code for embedding
 * This is the vitest-compatible test API (describe, it, expect)
 */
export function getTestFrameworkCode(): string {
  return generateTestFrameworkCode()
}

/**
 * Get the test runner code for embedding
 * This executes the pending tests registered by the test framework
 */
export function getTestRunnerCode(): string {
  return generateTestRunnerCode()
}

/**
 * Get the SDK code for embedding
 * This provides the $, db, ai, api globals
 */
export function getSDKCode(config?: SDKConfig): string {
  return generateSDKCode(config)
}

/**
 * Get the .should chainable assertions code
 */
export function getShouldCode(): string {
  return generateShouldCode()
}

/**
 * Get domain check code for fetch allowlisting
 */
export function getDomainCheckCode(allowedDomains: string[]): string {
  return generateDomainCheckCode(allowedDomains)
}

// Re-export types
export type { SDKConfig, FetchConfig }
