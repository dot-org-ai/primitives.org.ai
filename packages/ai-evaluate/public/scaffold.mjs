/**
 * ai-evaluate v2.1.8
 * Static worker template for evaluate.workers.do
 * Generated: 2026-01-26T01:42:47.000Z
 *
 * @license MIT
 */

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


// Test framework (vitest-compatible API)
let currentDescribe = '';
let beforeEachFns = [];
let afterEachFns = [];

const describe = (name, fn) => {
  const prev = currentDescribe;
  const prevBeforeEach = [...beforeEachFns];
  const prevAfterEach = [...afterEachFns];
  currentDescribe = currentDescribe ? currentDescribe + ' > ' + name : name;
  try { fn(); } finally {
    currentDescribe = prev;
    beforeEachFns = prevBeforeEach;
    afterEachFns = prevAfterEach;
  }
};

// Hooks
const beforeEach = (fn) => { beforeEachFns.push(fn); };
const afterEach = (fn) => { afterEachFns.push(fn); };

const it = (name, fn) => {
  const fullName = currentDescribe ? currentDescribe + ' > ' + name : name;
  const hooks = { before: [...beforeEachFns], after: [...afterEachFns] };
  pendingTests.push({ name: fullName, fn, hooks });
};
const test = it;

it.skip = (name, fn) => {
  const fullName = currentDescribe ? currentDescribe + ' > ' + name : name;
  pendingTests.push({ name: fullName, fn: null, skip: true });
};
test.skip = it.skip;

it.only = (name, fn) => {
  const fullName = currentDescribe ? currentDescribe + ' > ' + name : name;
  const hooks = { before: [...beforeEachFns], after: [...afterEachFns] };
  pendingTests.push({ name: fullName, fn, hooks, only: true });
};
test.only = it.only;

// Deep equality check
const deepEqual = (a, b) => {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(k => deepEqual(a[k], b[k]));
};

// Expect implementation with vitest-compatible matchers
const expect = (actual) => {
  const matchers = {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(\

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


    // Run all pending tests
    const testStart = Date.now();
    const hasOnly = pendingTests.some(t => t.only);
    const testsToRun = hasOnly ? pendingTests.filter(t => t.only || t.skip) : pendingTests;

    for (const { name, fn, hooks, skip } of testsToRun) {
      testResults.total++;

      if (skip) {
        testResults.skipped++;
        testResults.tests.push({ name, passed: true, skipped: true, duration: 0 });
        continue;
      }

      const start = Date.now();
      try {
        // Run beforeEach hooks
        if (hooks?.before) {
          for (const hook of hooks.before) {
            const hookResult = hook();
            if (hookResult && typeof hookResult.then === 'function') {
              await hookResult;
            }
          }
        }

        // Run the test
        const result = fn();
        if (result && typeof result.then === 'function') {
          await result;
        }

        // Run afterEach hooks
        if (hooks?.after) {
          for (const hook of hooks.after) {
            const hookResult = hook();
            if (hookResult && typeof hookResult.then === 'function') {
              await hookResult;
            }
          }
        }

        testResults.passed++;
        testResults.tests.push({ name, passed: true, duration: Date.now() - start });
      } catch (e) {
        testResults.failed++;
        testResults.tests.push({
          name,
          passed: false,
          error: e.message || String(e),
          duration: Date.now() - start
        });
      }
    }

    testResults.duration = Date.now() - testStart;


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
