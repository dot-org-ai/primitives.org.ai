# ai-evaluate

**You need to run user code. But untrusted code is terrifying.**

One malicious snippet could crash your server, access your file system, or make unauthorized network requests. You've seen the horror stories. You know the risks.

What if you could run any code with confidence?

## The Solution

`ai-evaluate` runs untrusted code in V8 isolates with zero access to your system. No file system. No network (by default). No risk.

```typescript
// Before: Dangerous eval
const result = eval(userCode) // Could do ANYTHING

// After: Sandboxed execution
import { evaluate } from 'ai-evaluate'

const result = await evaluate({
  script: userCode
})
// Runs in isolated V8 context - your system is protected
```

## Quick Start

**1. Install**

```bash
pnpm add ai-evaluate
```

**2. Evaluate code safely**

```typescript
import { evaluate } from 'ai-evaluate'

const result = await evaluate({
  script: '1 + 1'
})
// { success: true, value: 2, logs: [], duration: 5 }
```

**3. Run tests on user code**

```typescript
const result = await evaluate({
  module: `
    export const add = (a, b) => a + b
  `,
  tests: `
    describe('add', () => {
      it('adds numbers', () => {
        expect(add(2, 3)).toBe(5)
      })
    })
  `
})
// result.testResults.passed === 1
```

## What You Get

- **Complete isolation** - Code runs in sandboxed V8 isolates
- **Built-in testing** - Vitest-compatible `describe`, `it`, `expect`
- **Module support** - Define exports and use them in scripts/tests
- **Production-ready** - Cloudflare Workers in production, Miniflare locally
- **Network blocked** - External access disabled by default

## API Reference

### evaluate(options)

```typescript
interface EvaluateOptions {
  module?: string              // Module code with exports
  tests?: string               // Vitest-style test code
  script?: string              // Script to execute
  timeout?: number             // Default: 5000ms
  env?: Record<string, string> // Environment variables
  sdk?: SDKConfig | boolean    // Enable $, db, ai globals
}

interface EvaluateResult {
  success: boolean             // Execution succeeded
  value?: unknown              // Script return value
  logs: LogEntry[]             // Console output
  testResults?: TestResults    // Test results if tests provided
  error?: string               // Error message if failed
  duration: number             // Execution time in ms
}
```

### createEvaluator(env)

Bind to a Cloudflare Workers environment.

```typescript
import { createEvaluator } from 'ai-evaluate'

export default {
  async fetch(request, env) {
    const sandbox = createEvaluator(env)
    const result = await sandbox({ script: '1 + 1' })
    return Response.json(result)
  }
}
```

## Usage Examples

### Simple Script

```typescript
const result = await evaluate({
  script: `
    const x = 10
    const y = 20
    return x + y
  `
})
// result.value === 30
```

### Module with Exports

```typescript
const result = await evaluate({
  module: `
    exports.greet = (name) => \`Hello, \${name}!\`
    exports.sum = (...nums) => nums.reduce((a, b) => a + b, 0)
  `,
  script: `
    console.log(greet('World'))
    return sum(1, 2, 3, 4, 5)
  `
})
// result.value === 15
// result.logs[0].message === 'Hello, World!'
```

### Testing User Code

```typescript
const result = await evaluate({
  module: `
    exports.isPrime = (n) => {
      if (n < 2) return false
      for (let i = 2; i <= Math.sqrt(n); i++) {
        if (n % i === 0) return false
      }
      return true
    }
  `,
  tests: `
    describe('isPrime', () => {
      it('returns false for numbers less than 2', () => {
        expect(isPrime(0)).toBe(false)
        expect(isPrime(1)).toBe(false)
      })

      it('returns true for prime numbers', () => {
        expect(isPrime(2)).toBe(true)
        expect(isPrime(17)).toBe(true)
      })

      it('returns false for composite numbers', () => {
        expect(isPrime(4)).toBe(false)
        expect(isPrime(100)).toBe(false)
      })
    })
  `
})

// result.testResults = { total: 3, passed: 3, failed: 0, ... }
```

## Test Framework

Full vitest-compatible API with async support.

### Test Structure

```typescript
describe('group', () => {
  it('test name', () => { /* ... */ })
  test('another test', () => { /* ... */ })
  it.skip('skipped', () => { /* ... */ })
  it.only('focused', () => { /* ... */ })
})
```

### Async Tests

```typescript
it('async/await', async () => {
  const result = await someAsyncFunction()
  expect(result).toBe('expected')
})
```

### Hooks

```typescript
describe('with setup', () => {
  let data

  beforeEach(() => { data = { count: 0 } })
  afterEach(() => { data = null })

  it('uses setup', () => {
    data.count++
    expect(data.count).toBe(1)
  })
})
```

### Matchers

```typescript
// Equality
expect(value).toBe(expected)
expect(value).toEqual(expected)
expect(value).toStrictEqual(expected)

// Truthiness
expect(value).toBeTruthy()
expect(value).toBeFalsy()
expect(value).toBeNull()
expect(value).toBeUndefined()
expect(value).toBeDefined()

// Numbers
expect(value).toBeGreaterThan(n)
expect(value).toBeLessThan(n)
expect(value).toBeCloseTo(n, digits)

// Strings & Arrays
expect(value).toMatch(/pattern/)
expect(value).toContain(item)
expect(value).toHaveLength(n)

// Objects
expect(value).toHaveProperty('path')
expect(value).toMatchObject(partial)

// Errors
expect(fn).toThrow()
expect(fn).toThrow('message')

// Negation
expect(value).not.toBe(expected)

// Promises
await expect(promise).resolves.toBe(value)
await expect(promise).rejects.toThrow('error')
```

## Cloudflare Workers Setup

### wrangler.toml

```toml
name = "my-worker"
main = "src/index.ts"

[[worker_loaders]]
binding = "LOADER"
```

### Worker

```typescript
import { createEvaluator } from 'ai-evaluate'

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

## Local Development

In Node.js, Miniflare is used automatically:

```typescript
import { evaluate } from 'ai-evaluate'

const result = await evaluate({
  script: 'return "Hello from Node!"'
})
```

Ensure Miniflare is installed:

```bash
pnpm add miniflare
```

## Security Model

| Protection | Description |
|------------|-------------|
| V8 Isolate | Code runs in isolated V8 context |
| No Network | External access blocked by default |
| No File System | Zero filesystem access |
| Memory Limits | Standard Worker limits apply |
| CPU Limits | Execution time bounded |

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

---

**Stop worrying about untrusted code. Start building.**

```bash
pnpm add ai-evaluate
```
