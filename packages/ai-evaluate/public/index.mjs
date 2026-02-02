/**
 * ai-evaluate v2.2.0
 * Static worker template for evaluate.workers.do
 * Generated: 2026-02-02T13:50:07.708Z
 *
 * @license MIT
 */

// Full worker template with capnweb RPC support
// Import capnweb from the capnweb.js module

import { RpcTarget, newWorkersRpcResponse } from 'capnweb.js';

const logs = [];


// ============================================================
// Global .should Chainable Assertions
// ============================================================

const __createShouldChain__ = (actual, negated = false) => {
  const check = (condition, message) => {
    const passes = negated ? !condition : condition;
    if (!passes) throw new Error(negated ? 'Expected NOT: ' + message : message);
  };

  const stringify = (val) => {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  };

  // Create a lazy chain getter - returns 'this' assertion for chaining
  const assertion = {};

  // Core assertion methods
  assertion.equal = (expected) => {
    check(actual === expected, 'Expected ' + stringify(actual) + ' to equal ' + stringify(expected));
    return assertion;
  };
  assertion.deep = {
    equal: (expected) => {
      check(stringify(actual) === stringify(expected), 'Expected deep equal to ' + stringify(expected));
      return assertion;
    },
    include: (expected) => {
      const actualStr = stringify(actual);
      const expectedStr = stringify(expected);
      // Check if expected properties exist with same values
      const matches = Object.entries(expected || {}).every(([k, v]) =>
        actual && stringify(actual[k]) === stringify(v)
      );
      check(matches, 'Expected ' + actualStr + ' to deeply include ' + expectedStr);
      return assertion;
    }
  };
  assertion.include = (value) => {
    if (typeof actual === 'string') check(actual.includes(String(value)), 'Expected "' + actual + '" to include "' + value + '"');
    else if (Array.isArray(actual)) check(actual.includes(value), 'Expected array to include ' + stringify(value));
    return assertion;
  };
  assertion.contain = assertion.include;
  assertion.lengthOf = (n) => {
    check(actual?.length === n, 'Expected length ' + n + ', got ' + actual?.length);
    return assertion;
  };
  assertion.match = (regex) => {
    const str = String(actual);
    check(regex.test(str), 'Expected "' + str + '" to match ' + regex);
    return assertion;
  };
  assertion.matches = assertion.match;

  // .be accessor with type checks
  Object.defineProperty(assertion, 'be', {
    get: () => {
      const beObj = {
        a: (type) => {
          const actualType = actual === null ? 'null' : Array.isArray(actual) ? 'array' : actual instanceof Date ? 'date' : typeof actual;
          check(actualType === type.toLowerCase(), 'Expected ' + stringify(actual) + ' to be a ' + type);
          return assertion;
        },
        above: (n) => { check(actual > n, 'Expected ' + actual + ' to be above ' + n); return assertion; },
        below: (n) => { check(actual < n, 'Expected ' + actual + ' to be below ' + n); return assertion; },
        within: (min, max) => { check(actual >= min && actual <= max, 'Expected ' + actual + ' to be within ' + min + '..' + max); return assertion; },
        oneOf: (arr) => { check(Array.isArray(arr) && arr.includes(actual), 'Expected ' + stringify(actual) + ' to be one of ' + stringify(arr)); return assertion; },
        instanceOf: (cls) => { check(actual instanceof cls, 'Expected to be instance of ' + cls.name); return assertion; }
      };
      beObj.an = beObj.a;
      Object.defineProperty(beObj, 'true', { get: () => { check(actual === true, 'Expected ' + stringify(actual) + ' to be true'); return assertion; } });
      Object.defineProperty(beObj, 'false', { get: () => { check(actual === false, 'Expected ' + stringify(actual) + ' to be false'); return assertion; } });
      Object.defineProperty(beObj, 'ok', { get: () => { check(!!actual, 'Expected ' + stringify(actual) + ' to be truthy'); return assertion; } });
      Object.defineProperty(beObj, 'null', { get: () => { check(actual === null, 'Expected ' + stringify(actual) + ' to be null'); return assertion; } });
      Object.defineProperty(beObj, 'undefined', { get: () => { check(actual === undefined, 'Expected ' + stringify(actual) + ' to be undefined'); return assertion; } });
      Object.defineProperty(beObj, 'empty', { get: () => {
        const isEmpty = actual === '' || (Array.isArray(actual) && actual.length === 0) || (actual && typeof actual === 'object' && Object.keys(actual).length === 0);
        check(isEmpty, 'Expected ' + stringify(actual) + ' to be empty');
        return assertion;
      }});
      return beObj;
    }
  });

  // .have accessor with property/keys/lengthOf/at checks
  Object.defineProperty(assertion, 'have', {
    get: () => ({
      property: (name, value) => {
        const hasIt = actual != null && Object.prototype.hasOwnProperty.call(actual, name);
        if (value !== undefined) {
          check(hasIt && actual[name] === value, "Expected property '" + name + "' = " + stringify(value) + ", got " + stringify(actual?.[name]));
        } else {
          check(hasIt, "Expected to have property '" + name + "'");
        }
        if (hasIt) return __createShouldChain__(actual[name], negated);
        return assertion;
      },
      keys: (...keys) => {
        const actualKeys = Object.keys(actual || {});
        check(keys.every(k => actualKeys.includes(k)), 'Expected to have keys ' + stringify(keys));
        return assertion;
      },
      lengthOf: (n) => {
        check(actual?.length === n, 'Expected length ' + n + ', got ' + actual?.length);
        return assertion;
      },
      at: {
        least: (n) => {
          check(actual?.length >= n, 'Expected length at least ' + n + ', got ' + actual?.length);
          return assertion;
        },
        most: (n) => {
          check(actual?.length <= n, 'Expected length at most ' + n + ', got ' + actual?.length);
          return assertion;
        }
      }
    })
  });

  // .not negation
  Object.defineProperty(assertion, 'not', {
    get: () => __createShouldChain__(actual, !negated)
  });

  // .with passthrough for readability
  Object.defineProperty(assertion, 'with', {
    get: () => assertion
  });

  // .that passthrough for chaining (e.g. .have.property('x').that.matches(/.../) )
  Object.defineProperty(assertion, 'that', {
    get: () => assertion
  });

  // .and passthrough for chaining
  Object.defineProperty(assertion, 'and', {
    get: () => assertion
  });

  return assertion;
};

// Add .should to Object.prototype
Object.defineProperty(Object.prototype, 'should', {
  get: function() { return __createShouldChain__(this); },
  configurable: true,
  enumerable: false
});


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
        return Response.json({ error: `Export "${name}" not found` }, { status: 404 });
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
