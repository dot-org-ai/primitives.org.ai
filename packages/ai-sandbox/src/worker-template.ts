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

/**
 * Extract export names from module code
 * Supports both CommonJS (exports.foo) and ES module (export const foo) syntax
 */
function getExportNames(moduleCode: string): string {
  const names = new Set<string>()

  // Match exports.name = ...
  const dotPattern = /exports\.(\w+)\s*=/g
  let match
  while ((match = dotPattern.exec(moduleCode)) !== null) {
    names.add(match[1])
  }

  // Match exports['name'] = ... or exports["name"] = ...
  const bracketPattern = /exports\[['"](\w+)['"]\]\s*=/g
  while ((match = bracketPattern.exec(moduleCode)) !== null) {
    names.add(match[1])
  }

  // Match export const name = ... or export let name = ... or export var name = ...
  const esConstPattern = /export\s+(?:const|let|var)\s+(\w+)\s*=/g
  while ((match = esConstPattern.exec(moduleCode)) !== null) {
    names.add(match[1])
  }

  // Match export function name(...) or export async function name(...)
  const esFunctionPattern = /export\s+(?:async\s+)?function\s+(\w+)\s*\(/g
  while ((match = esFunctionPattern.exec(moduleCode)) !== null) {
    names.add(match[1])
  }

  // Match export class name
  const esClassPattern = /export\s+class\s+(\w+)/g
  while ((match = esClassPattern.exec(moduleCode)) !== null) {
    names.add(match[1])
  }

  return Array.from(names).join(', ') || '_unused'
}

/**
 * Transform module code to work in sandbox
 * Converts ES module exports to CommonJS-style for the sandbox
 */
function transformModuleCode(moduleCode: string): string {
  let code = moduleCode

  // Transform: export const foo = ... → const foo = ...; exports.foo = foo;
  code = code.replace(
    /export\s+(const|let|var)\s+(\w+)\s*=/g,
    '$1 $2 = exports.$2 ='
  )

  // Transform: export function foo(...) → function foo(...) exports.foo = foo;
  code = code.replace(
    /export\s+(async\s+)?function\s+(\w+)/g,
    '$1function $2'
  )
  // Add exports for functions after their definition
  const funcNames = [...moduleCode.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)]
  for (const [, name] of funcNames) {
    code += `\nexports.${name} = ${name};`
  }

  // Transform: export class Foo → class Foo; exports.Foo = Foo;
  code = code.replace(/export\s+class\s+(\w+)/g, 'class $1')
  const classNames = [...moduleCode.matchAll(/export\s+class\s+(\w+)/g)]
  for (const [, name] of classNames) {
    code += `\nexports.${name} = ${name};`
  }

  return code
}

/**
 * Wrap script to auto-return the last expression
 * Converts: `add(1, 2)` → `return add(1, 2)`
 */
function wrapScriptForReturn(script: string): string {
  const trimmed = script.trim()
  if (!trimmed) return script

  // If script already contains a return statement anywhere, don't modify
  if (/\breturn\b/.test(trimmed)) return script

  // If script starts with throw, don't modify
  if (/^\s*throw\b/.test(trimmed)) return script

  // If it's a single expression (no newlines, no semicolons except at end), wrap it
  const withoutTrailingSemi = trimmed.replace(/;?\s*$/, '')
  const isSingleLine = !withoutTrailingSemi.includes('\n')

  // Check if it looks like a single expression (no control flow, no declarations)
  const startsWithKeyword = /^\s*(const|let|var|if|for|while|switch|try|class|function|async\s+function)\b/.test(withoutTrailingSemi)

  if (isSingleLine && !startsWithKeyword) {
    return `return ${withoutTrailingSemi}`
  }

  // For multi-statement scripts, try to return the last expression
  const lines = trimmed.split('\n')
  const lastLine = lines[lines.length - 1].trim()

  // If last line is an expression (not a declaration, control flow, or throw)
  if (lastLine && !/^\s*(const|let|var|if|for|while|switch|try|class|function|return|throw)\b/.test(lastLine)) {
    lines[lines.length - 1] = `return ${lastLine.replace(/;?\s*$/, '')}`
    return lines.join('\n')
  }

  return script
}

/**
 * Generate worker code for production (uses RPC to ai-tests)
 */
export function generateWorkerCode(options: {
  module?: string
  tests?: string
  script?: string
}): string {
  const { module: rawModule = '', tests = '', script: rawScript = '' } = options
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const script = rawScript ? wrapScriptForReturn(rawScript) : ''
  const exportNames = getExportNames(rawModule)

  return `
// Sandbox Worker Entry Point
import { RpcTarget, newWorkersRpcResponse } from 'capnweb';

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

// ============================================================
// USER MODULE CODE (embedded at generation time)
// ============================================================
// Module exports object - exports become top-level variables
const exports = {};

${module ? `
// Execute module code
try {
${module}
} catch (e) {
  console.error('Module error:', e.message);
}
` : '// No module code provided'}

// Expose all exports as top-level variables for tests and scripts
// This allows: export const add = (a, b) => a + b; then later: add(1, 2)
${rawModule ? `
const { ${exportNames} } = exports;
`.trim() : ''}

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
    ${tests ? `
    // Register tests
    try {
${tests}
    } catch (e) {
      console.error('Test registration error:', e.message);
    }
    ` : '// No test code provided'}

    // Execute user script
    ${script ? `
    try {
      scriptResult = await (async () => {
${script}
      })();
    } catch (e) {
      console.error('Script error:', e.message);
      scriptError = e.message;
    }
    ` : '// No script code provided'}

    // Run tests if any were registered
    ${tests ? `
    try {
      testResults = await testService.run();
    } catch (e) {
      console.error('Test run error:', e.message);
      testResults = { total: 0, passed: 0, failed: 1, skipped: 0, tests: [], duration: 0, error: e.message };
    }
    ` : ''}

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
  module?: string
  tests?: string
  script?: string
}): string {
  const { module: rawModule = '', tests = '', script: rawScript = '' } = options
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const script = rawScript ? wrapScriptForReturn(rawScript) : ''
  const exportNames = getExportNames(rawModule)

  return `
// Sandbox Worker Entry Point (Dev Mode - embedded test framework)
const logs = [];
const testResults = { total: 0, passed: 0, failed: 0, skipped: 0, tests: [], duration: 0 };
const pendingTests = [];

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

// ============================================================
// USER MODULE CODE (embedded at generation time)
// ============================================================
// Module exports object - exports become top-level variables
const exports = {};

${module ? `
// Execute module code
try {
${module}
} catch (e) {
  console.error('Module error:', e.message);
}
` : '// No module code provided'}

// Expose all exports as top-level variables for tests and scripts
// This allows: export const add = (a, b) => a + b; then later: add(1, 2)
${rawModule ? `
const { ${exportNames} } = exports;
`.trim() : ''}

// ============================================================
// USER TEST CODE (embedded at generation time)
// ============================================================
${tests ? `
// Register tests
try {
${tests}
} catch (e) {
  console.error('Test registration error:', e.message);
}
` : '// No test code provided'}

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
    ${script ? `
    try {
      scriptResult = (() => {
${script}
      })();
      // Support async scripts
      if (scriptResult && typeof scriptResult.then === 'function') {
        scriptResult = await scriptResult;
      }
    } catch (e) {
      console.error('Script error:', e.message);
      scriptError = e.message;
    }
    ` : '// No script code provided'}

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
