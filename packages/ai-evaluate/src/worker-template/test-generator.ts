/**
 * Test framework embedding for worker templates
 *
 * Generates the embedded test framework code used in dev mode
 * (vitest-compatible API without external dependencies)
 */

/**
 * Generate the embedded test framework code
 * This creates a vitest-compatible testing API that runs in the sandbox
 */
export function generateTestFrameworkCode(): string {
  return `
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
        throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
      }
    },
    toEqual: (expected) => {
      if (!deepEqual(actual, expected)) {
        throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
      }
    },
    toStrictEqual: (expected) => {
      if (!deepEqual(actual, expected)) {
        throw new Error(\`Expected \${JSON.stringify(expected)} but got \${JSON.stringify(actual)}\`);
      }
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(\`Expected truthy but got \${JSON.stringify(actual)}\`);
    },
    toBeFalsy: () => {
      if (actual) throw new Error(\`Expected falsy but got \${JSON.stringify(actual)}\`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(\`Expected null but got \${JSON.stringify(actual)}\`);
    },
    toBeUndefined: () => {
      if (actual !== undefined) throw new Error(\`Expected undefined but got \${JSON.stringify(actual)}\`);
    },
    toBeDefined: () => {
      if (actual === undefined) throw new Error('Expected defined but got undefined');
    },
    toBeNaN: () => {
      if (!Number.isNaN(actual)) throw new Error(\`Expected NaN but got \${actual}\`);
    },
    toContain: (item) => {
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) throw new Error(\`Expected array to contain \${JSON.stringify(item)}\`);
      } else if (typeof actual === 'string') {
        if (!actual.includes(item)) throw new Error(\`Expected string to contain "\${item}"\`);
      } else {
        throw new Error('toContain only works on arrays and strings');
      }
    },
    toContainEqual: (item) => {
      if (!Array.isArray(actual)) throw new Error('toContainEqual only works on arrays');
      if (!actual.some(v => deepEqual(v, item))) {
        throw new Error(\`Expected array to contain \${JSON.stringify(item)}\`);
      }
    },
    toHaveLength: (length) => {
      if (actual?.length !== length) {
        throw new Error(\`Expected length \${length} but got \${actual?.length}\`);
      }
    },
    toHaveProperty: function(path, value) {
      const parts = typeof path === 'string' ? path.split('.') : [path];
      let obj = actual;
      for (const part of parts) {
        if (obj == null || !(part in obj)) {
          throw new Error(\`Expected object to have property "\${path}"\`);
        }
        obj = obj[part];
      }
      if (arguments.length > 1 && !deepEqual(obj, value)) {
        throw new Error(\`Expected property "\${path}" to be \${JSON.stringify(value)} but got \${JSON.stringify(obj)}\`);
      }
    },
    toMatchObject: (expected) => {
      if (typeof actual !== 'object' || actual === null) {
        throw new Error('toMatchObject expects an object');
      }
      for (const key of Object.keys(expected)) {
        if (!deepEqual(actual[key], expected[key])) {
          throw new Error(\`Expected property "\${key}" to be \${JSON.stringify(expected[key])} but got \${JSON.stringify(actual[key])}\`);
        }
      }
    },
    toThrow: (expected) => {
      if (typeof actual !== 'function') throw new Error('toThrow expects a function');
      let threw = false;
      let error;
      try {
        actual();
      } catch (e) {
        threw = true;
        error = e;
      }
      if (!threw) throw new Error('Expected function to throw');
      if (expected !== undefined) {
        if (typeof expected === 'string' && !error.message.includes(expected)) {
          throw new Error(\`Expected error message to contain "\${expected}" but got "\${error.message}"\`);
        }
        if (expected instanceof RegExp && !expected.test(error.message)) {
          throw new Error(\`Expected error message to match \${expected} but got "\${error.message}"\`);
        }
        if (typeof expected === 'function' && !(error instanceof expected)) {
          throw new Error(\`Expected error to be instance of \${expected.name}\`);
        }
      }
    },
    toBeGreaterThan: (n) => {
      if (!(actual > n)) throw new Error(\`Expected \${actual} to be greater than \${n}\`);
    },
    toBeLessThan: (n) => {
      if (!(actual < n)) throw new Error(\`Expected \${actual} to be less than \${n}\`);
    },
    toBeGreaterThanOrEqual: (n) => {
      if (!(actual >= n)) throw new Error(\`Expected \${actual} to be >= \${n}\`);
    },
    toBeLessThanOrEqual: (n) => {
      if (!(actual <= n)) throw new Error(\`Expected \${actual} to be <= \${n}\`);
    },
    toBeCloseTo: (n, digits = 2) => {
      const diff = Math.abs(actual - n);
      const threshold = Math.pow(10, -digits) / 2;
      if (diff > threshold) {
        throw new Error(\`Expected \${actual} to be close to \${n}\`);
      }
    },
    toMatch: (pattern) => {
      if (typeof actual !== 'string') throw new Error('toMatch expects a string');
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (!regex.test(actual)) {
        throw new Error(\`Expected "\${actual}" to match \${pattern}\`);
      }
    },
    toBeInstanceOf: (cls) => {
      if (!(actual instanceof cls)) {
        throw new Error(\`Expected instance of \${cls.name}\`);
      }
    },
    toBeTypeOf: (type) => {
      if (typeof actual !== type) {
        throw new Error(\`Expected typeof to be "\${type}" but got "\${typeof actual}"\`);
      }
    },
  };

  matchers.not = {
    toBe: (expected) => {
      if (actual === expected) throw new Error(\`Expected not \${JSON.stringify(expected)}\`);
    },
    toEqual: (expected) => {
      if (deepEqual(actual, expected)) {
        throw new Error(\`Expected not equal to \${JSON.stringify(expected)}\`);
      }
    },
    toBeTruthy: () => {
      if (actual) throw new Error('Expected not truthy');
    },
    toBeFalsy: () => {
      if (!actual) throw new Error('Expected not falsy');
    },
    toBeNull: () => {
      if (actual === null) throw new Error('Expected not null');
    },
    toBeUndefined: () => {
      if (actual === undefined) throw new Error('Expected not undefined');
    },
    toBeDefined: () => {
      if (actual !== undefined) throw new Error('Expected undefined');
    },
    toContain: (item) => {
      if (Array.isArray(actual) && actual.includes(item)) {
        throw new Error(\`Expected array not to contain \${JSON.stringify(item)}\`);
      }
      if (typeof actual === 'string' && actual.includes(item)) {
        throw new Error(\`Expected string not to contain "\${item}"\`);
      }
    },
    toHaveProperty: (path) => {
      const parts = typeof path === 'string' ? path.split('.') : [path];
      let obj = actual;
      try {
        for (const part of parts) {
          if (obj == null || !(part in obj)) return;
          obj = obj[part];
        }
        throw new Error(\`Expected object not to have property "\${path}"\`);
      } catch {}
    },
    toThrow: () => {
      if (typeof actual !== 'function') throw new Error('toThrow expects a function');
      try {
        actual();
      } catch (e) {
        throw new Error('Expected function not to throw');
      }
    },
    toMatch: (pattern) => {
      if (typeof actual !== 'string') throw new Error('toMatch expects a string');
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (regex.test(actual)) {
        throw new Error(\`Expected "\${actual}" not to match \${pattern}\`);
      }
    },
  };

  matchers.resolves = new Proxy({}, {
    get: (_, prop) => async (...args) => {
      const resolved = await actual;
      return expect(resolved)[prop](...args);
    }
  });

  matchers.rejects = new Proxy({}, {
    get: (_, prop) => async (...args) => {
      try {
        await actual;
        throw new Error('Expected promise to reject');
      } catch (e) {
        if (e.message === 'Expected promise to reject') throw e;
        return expect(e)[prop](...args);
      }
    }
  });

  return matchers;
};
`
}

/**
 * Generate the test runner code that executes pending tests
 */
export function generateTestRunnerCode(): string {
  return `
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
`
}
