#!/usr/bin/env npx tsx
/**
 * Build static worker assets for ai-evaluate
 *
 * This script generates:
 * - public/index.mjs - Full worker template with capnweb
 * - public/capnweb.mjs - Standalone capnweb bundle
 * - public/scaffold.mjs - Base scaffold without capnweb
 *
 * Run with: npx tsx scripts/build-static.ts
 * Or: npm run build:static
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const publicDir = join(rootDir, 'public')

// Read package.json for version
const packageJson = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))
const version = packageJson.version

console.log(`Building static assets for ai-evaluate v${version}...`)

// Ensure public directory exists
mkdirSync(publicDir, { recursive: true })

// Read the capnweb bundle source
const capnwebBundlePath = join(rootDir, 'src', 'capnweb-bundle.ts')
const capnwebSource = readFileSync(capnwebBundlePath, 'utf-8')

// Extract the CAPNWEB_SOURCE string content
const match = capnwebSource.match(/export const CAPNWEB_SOURCE = `([\s\S]*?)`/)
if (!match) {
  console.error('Failed to extract CAPNWEB_SOURCE from capnweb-bundle.ts')
  process.exit(1)
}
const capnwebBundle = match[1]

// Read the test generator for the test framework code
const testGeneratorPath = join(rootDir, 'src', 'worker-template', 'test-generator.ts')
const testGeneratorSource = readFileSync(testGeneratorPath, 'utf-8')

// Extract the test framework code
const testFrameworkMatch = testGeneratorSource.match(
  /export function generateTestFrameworkCode\(\): string \{[\s\S]*?return `([\s\S]*?)`[\s\S]*?^\}/m
)
const testFrameworkCode = testFrameworkMatch ? testFrameworkMatch[1] : ''

// Extract the test runner code
const testRunnerMatch = testGeneratorSource.match(
  /export function generateTestRunnerCode\(\): string \{[\s\S]*?return `([\s\S]*?)`[\s\S]*?^\}/m
)
const testRunnerCode = testRunnerMatch ? testRunnerMatch[1] : ''

// Read the sdk generator for the should code
const sdkGeneratorPath = join(rootDir, 'src', 'worker-template', 'sdk-generator.ts')
const sdkGeneratorSource = readFileSync(sdkGeneratorPath, 'utf-8')

// Extract the should code
const shouldMatch = sdkGeneratorSource.match(
  /export function generateShouldCode\(\): string \{[\s\S]*?return `([\s\S]*?)`[\s\S]*?^\}/m
)
const shouldCode = shouldMatch ? shouldMatch[1] : ''

// Version header
const versionHeader = `/**
 * ai-evaluate v${version}
 * Static worker template for evaluate.workers.do
 * Generated: ${new Date().toISOString()}
 *
 * @license MIT
 */
`

// Build capnweb.mjs - standalone capnweb bundle
const capnwebMjs = `${versionHeader}
// Bundled capnweb RPC library for Cloudflare Workers
${capnwebBundle}
`
writeFileSync(join(publicDir, 'capnweb.mjs'), capnwebMjs)
console.log('  -> public/capnweb.mjs')

// Build scaffold.mjs - base scaffold without capnweb
const scaffoldMjs = `${versionHeader}
// Base worker scaffold without capnweb dependency
// Use this for dev mode or when capnweb is not needed

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

${testFrameworkCode}

// Module exports object
const exports = {};
const pendingTests = [];
const testResults = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [], duration: 0 };

// ============================================================
// USER CODE PLACEHOLDER
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
        execute: '/execute'
      });
    }

    // Route: /execute - Run tests and scripts
    let scriptResult = undefined;
    let scriptError = null;

${testRunnerCode}

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
writeFileSync(join(publicDir, 'scaffold.mjs'), scaffoldMjs)
console.log('  -> public/scaffold.mjs')

// Build index.mjs - full template with capnweb
const indexMjs = `${versionHeader}
// Full worker template with capnweb RPC support
// Import capnweb from the capnweb.js module

import { RpcTarget, newWorkersRpcResponse } from 'capnweb.js';

const logs = [];

${shouldCode}

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

${testFrameworkCode}

// Module exports object
const exports = {};
const pendingTests = [];
const testResults = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [], duration: 0 };

// ============================================================
// USER CODE PLACEHOLDER
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

    // USER_SCRIPT_CODE

${testRunnerCode}

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
writeFileSync(join(publicDir, 'index.mjs'), indexMjs)
console.log('  -> public/index.mjs')

console.log(`\nStatic assets built successfully!`)
console.log(`Files written to: ${publicDir}`)
