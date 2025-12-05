# ai-sandbox

Secure code execution in sandboxed environments. Run untrusted code safely using Cloudflare Workers or Miniflare.

## Installation

```bash
pnpm add ai-sandbox
```

## Quick Start

```typescript
import { evaluate } from 'ai-sandbox'

// Run a simple script
const result = await evaluate({
  script: '1 + 1'
})
// { success: true, value: 2, logs: [], duration: 5 }

// With a module and tests
const result = await evaluate({
  module: `
    export const add = (a, b) => a + b
    export const multiply = (a, b) => a * b
  `,
  tests: `
    describe('math', () => {
      it('adds numbers', () => {
        expect(add(2, 3)).toBe(5);
      })
      it('multiplies numbers', () => {
        expect(multiply(2, 3)).toBe(6);
      })
    })
  `,
  script: 'add(10, 20)'
})
```

## Features

- **Secure isolation** - Code runs in a sandboxed V8 isolate
- **Vitest-compatible tests** - `describe`, `it`, `expect` in global scope
- **Module exports** - Define modules and use exports in scripts/tests
- **Cloudflare Workers** - Uses worker_loaders in production
- **Miniflare** - Uses Miniflare for local development and Node.js
- **Network isolation** - External network access blocked by default

## API

### evaluate(options)

Execute code in a sandboxed environment.

```typescript
interface EvaluateOptions {
  /** Module code with exports */
  module?: string
  /** Test code using vitest-style API */
  tests?: string
  /** Script code to run (module exports in scope) */
  script?: string
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number
  /** Environment variables */
  env?: Record<string, string>
}

interface EvaluateResult {
  /** Whether execution succeeded */
  success: boolean
  /** Return value from script */
  value?: unknown
  /** Console output */
  logs: LogEntry[]
  /** Test results (if tests provided) */
  testResults?: TestResults
  /** Error message if failed */
  error?: string
  /** Execution time in ms */
  duration: number
}
```

### createEvaluator(env)

Create an evaluate function bound to a specific environment. Useful for Cloudflare Workers.

```typescript
import { createEvaluator } from 'ai-sandbox'

export default {
  async fetch(request, env) {
    const sandbox = createEvaluator(env)
    const result = await sandbox({
      script: '1 + 1'
    })
    return Response.json(result)
  }
}
```

## Usage Patterns

### Simple Script Execution

```typescript
const result = await evaluate({
  script: `
    const x = 10;
    const y = 20;
    return x + y;
  `
})
// result.value === 30
```

### Module with Exports

```typescript
const result = await evaluate({
  module: `
    exports.greet = (name) => \`Hello, \${name}!\`;
    exports.sum = (...nums) => nums.reduce((a, b) => a + b, 0);
  `,
  script: `
    console.log(greet('World'));
    return sum(1, 2, 3, 4, 5);
  `
})
// result.value === 15
// result.logs[0].message === 'Hello, World!'
```

### Running Tests

```typescript
const result = await evaluate({
  module: `
    exports.isPrime = (n) => {
      if (n < 2) return false;
      for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) return false;
      }
      return true;
    };
  `,
  tests: `
    describe('isPrime', () => {
      it('returns false for numbers less than 2', () => {
        expect(isPrime(0)).toBe(false);
        expect(isPrime(1)).toBe(false);
      });

      it('returns true for prime numbers', () => {
        expect(isPrime(2)).toBe(true);
        expect(isPrime(3)).toBe(true);
        expect(isPrime(17)).toBe(true);
      });

      it('returns false for composite numbers', () => {
        expect(isPrime(4)).toBe(false);
        expect(isPrime(9)).toBe(false);
        expect(isPrime(100)).toBe(false);
      });
    });
  `
})

console.log(result.testResults)
// {
//   total: 3,
//   passed: 3,
//   failed: 0,
//   skipped: 0,
//   tests: [...]
// }
```

## Test Framework

The sandbox provides a vitest-compatible test API with async support.

### describe / it / test

```typescript
describe('group name', () => {
  it('test name', () => {
    // test code
  });

  test('another test', () => {
    // test code
  });

  it.skip('skipped test', () => {
    // won't run
  });

  it.only('only this test', () => {
    // when .only is used, only these tests run
  });
});
```

### Async Tests

```typescript
describe('async operations', () => {
  it('supports async/await', async () => {
    const result = await someAsyncFunction();
    expect(result).toBe('expected');
  });

  it('supports promises', () => {
    return fetchData().then(data => {
      expect(data).toBeDefined();
    });
  });
});
```

### Hooks

```typescript
describe('with setup', () => {
  let data;

  beforeEach(() => {
    data = { count: 0 };
  });

  afterEach(() => {
    data = null;
  });

  it('uses setup data', () => {
    data.count++;
    expect(data.count).toBe(1);
  });
});
```

### expect matchers

```typescript
// Equality
expect(value).toBe(expected)           // Strict equality (===)
expect(value).toEqual(expected)        // Deep equality
expect(value).toStrictEqual(expected)  // Strict deep equality

// Truthiness
expect(value).toBeTruthy()             // Truthy check
expect(value).toBeFalsy()              // Falsy check
expect(value).toBeNull()               // null check
expect(value).toBeUndefined()          // undefined check
expect(value).toBeDefined()            // not undefined
expect(value).toBeNaN()                // NaN check

// Numbers
expect(value).toBeGreaterThan(n)       // > comparison
expect(value).toBeLessThan(n)          // < comparison
expect(value).toBeGreaterThanOrEqual(n)// >= comparison
expect(value).toBeLessThanOrEqual(n)   // <= comparison
expect(value).toBeCloseTo(n, digits)   // Floating point comparison

// Strings
expect(value).toMatch(/pattern/)       // Regex match
expect(value).toMatch('substring')     // Contains substring

// Arrays & Strings
expect(value).toContain(item)          // Array/string contains
expect(value).toContainEqual(item)     // Array contains (deep equality)
expect(value).toHaveLength(n)          // Length check

// Objects
expect(value).toHaveProperty('path')   // Has property
expect(value).toHaveProperty('path', v)// Has property with value
expect(value).toMatchObject(partial)   // Partial object match

// Types
expect(value).toBeInstanceOf(Class)    // instanceof check
expect(value).toBeTypeOf('string')     // typeof check

// Errors
expect(fn).toThrow()                   // Throws any error
expect(fn).toThrow('message')          // Throws with message
expect(fn).toThrow(/pattern/)          // Throws matching pattern
expect(fn).toThrow(ErrorClass)         // Throws specific error type

// Negated matchers
expect(value).not.toBe(expected)
expect(value).not.toEqual(expected)
expect(value).not.toContain(item)
expect(fn).not.toThrow()

// Promise matchers
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow('error')
```

## Cloudflare Workers Setup

To use in Cloudflare Workers with worker_loaders:

### wrangler.toml

```toml
name = "my-worker"
main = "src/index.ts"

[[worker_loaders]]
binding = "LOADER"
```

### Worker Code

```typescript
import { createEvaluator } from 'ai-sandbox'

export interface Env {
  LOADER: unknown
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const sandbox = createEvaluator(env)

    const { code, tests } = await request.json()

    const result = await sandbox({
      module: code,
      tests: tests
    })

    return Response.json(result)
  }
}
```

## Node.js / Development

In Node.js or during development, the evaluate function automatically uses Miniflare:

```typescript
import { evaluate } from 'ai-sandbox'

// Miniflare is used automatically when LOADER binding is not present
const result = await evaluate({
  script: 'return "Hello from Node!"'
})
```

Make sure `miniflare` is installed:

```bash
pnpm add miniflare
```

## Security

The sandbox provides several security features:

1. **V8 Isolate** - Code runs in an isolated V8 context
2. **No Network** - External network access is blocked (`globalOutbound: null`)
3. **No File System** - No access to the file system
4. **Memory Limits** - Standard Worker memory limits apply
5. **CPU Limits** - Execution time is limited

## Example: Code Evaluation API

```typescript
import { evaluate } from 'ai-sandbox'
import { Hono } from 'hono'

const app = new Hono()

app.post('/evaluate', async (c) => {
  const { module, tests, script } = await c.req.json()

  const result = await evaluate({
    module,
    tests,
    script,
    timeout: 5000
  })

  return c.json(result)
})

export default app
```

## Types

```typescript
interface LogEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug'
  message: string
  timestamp: number
}

interface TestResults {
  total: number
  passed: number
  failed: number
  skipped: number
  tests: TestResult[]
  duration: number
}

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}
```
