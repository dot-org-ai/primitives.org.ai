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

const result = await evaluate({ script: userCode }, env)
// Runs in isolated V8 context - your system is protected
```

## Quick Start

### REST API (eval.workers.do)

Try it now with curl:

```bash
# Simple script execution
curl -X POST https://eval.workers.do \
  -H "Content-Type: application/json" \
  -d '{"script": "return 1 + 1"}'
# {"success":true,"value":2,"logs":[],"duration":2}

# With module exports
curl -X POST https://eval.workers.do \
  -H "Content-Type: application/json" \
  -d '{"module": "export const add = (a, b) => a + b", "script": "return add(2, 3)"}'
# {"success":true,"value":5,"logs":[],"duration":2}

# With console output
curl -X POST https://eval.workers.do \
  -H "Content-Type: application/json" \
  -d '{"script": "console.log(42); return 42"}'
# {"success":true,"value":42,"logs":[{"level":"log","message":"42",...}],"duration":2}

# With external imports (lodash from esm.sh)
curl -X POST https://eval.workers.do \
  -H "Content-Type: application/json" \
  -d '{"script": "return _.chunk([1, 2, 3, 4, 5, 6], 2)", "imports": ["https://esm.sh/lodash@4.17.21"]}'
# {"success":true,"value":[[1,2],[3,4],[5,6]],"logs":[],"duration":42}
```

### Deploy Your Own

```bash
cd example
pnpm install
pnpm deploy
```

See [`example/`](./example) for a complete working Worker.

### Cloudflare Workers (Production)

**1. Install**

```bash
pnpm add ai-evaluate
```

**2. Configure wrangler.jsonc**

> **Important**: Requires wrangler v4+ (`pnpm add -D wrangler@4`)

```jsonc
{
  "name": "my-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-01",
  "worker_loaders": [
    { "binding": "loader" }
  ]
}
```

**3. Use in your Worker**

```typescript
import { evaluate } from 'ai-evaluate'

export default {
  async fetch(request: Request, env: Env) {
    const result = await evaluate({ script: '1 + 1' }, env)
    return Response.json(result)
    // { success: true, value: 2, logs: [], duration: 5 }
  }
}

interface Env {
  loader: unknown
}
```

### Node.js / Local Development

For local development, import from the `/node` subpath which uses Miniflare:

```bash
pnpm add ai-evaluate miniflare
```

```typescript
import { evaluate } from 'ai-evaluate/node'

const result = await evaluate({ script: '1 + 1' })
// { success: true, value: 2, logs: [], duration: 50 }
```

## API Reference

### evaluate(options, env?)

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

Bind to a Cloudflare Workers environment for cleaner syntax:

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
}, env)
// result.value === 30
```

### Module with Exports

```typescript
const result = await evaluate({
  module: `
    export const greet = (name) => \`Hello, \${name}!\`
    export const sum = (...nums) => nums.reduce((a, b) => a + b, 0)
  `,
  script: `
    console.log(greet('World'))
    return sum(1, 2, 3, 4, 5)
  `
}, env)
// result.value === 15
// result.logs[0].message === 'Hello, World!'
```

### Testing User Code

```typescript
const result = await evaluate({
  module: `
    export const isPrime = (n) => {
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
}, env)

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

## REPL Sessions

For interactive or multi-step evaluations, use the `/repl` export:

```typescript
import { createReplSession } from 'ai-evaluate/repl'

// Create a persistent session
const session = await createReplSession({ local: true })

// Evaluate multiple expressions with shared context
await session.eval('const sum = (a, b) => a + b')
const result = await session.eval('sum(1, 2)')
console.log(result.value) // 3

// Context persists across evaluations
await session.eval('const x = 10')
const result2 = await session.eval('sum(x, 5)')
console.log(result2.value) // 15

// Clean up
await session.close()
```

### REPL Configuration

```typescript
interface ReplSessionConfig {
  local?: boolean           // Use Miniflare (default: false, uses remote)
  auth?: string             // Auth token for remote execution
  sdk?: SDKConfig | boolean // Enable platform primitives ($, db, ai)
  prelude?: string          // Code to run at session start
  timeout?: number          // Eval timeout in ms (default: 5000)
  allowNetwork?: boolean    // Allow fetch (default: true)
}
```

### Quick Eval

For one-off evaluations without session management:

```typescript
import { quickEval } from 'ai-evaluate/repl'

const result = await quickEval('1 + 2 * 3')
console.log(result.value) // 7
```

## Requirements

| Environment | Requirement |
|-------------|-------------|
| Cloudflare Workers | wrangler v4+, `worker_loaders` binding |
| Node.js | miniflare (peer dependency) |

## Security Model

| Protection | Description |
|------------|-------------|
| V8 Isolate | Code runs in isolated V8 context |
| No Network | External access blocked by default |
| No File System | Zero filesystem access |
| Memory Limits | Standard Worker limits apply |
| CPU Limits | Execution time bounded |

## Troubleshooting

### "Unexpected fields found in top-level field: worker_loaders"

Upgrade wrangler to v4+:
```bash
pnpm add -D wrangler@4
```

### "Code generation from strings disallowed"

User code must be embedded at build time, not evaluated with `new Function()` or `eval()`. This is handled automatically by ai-evaluate - just pass your code as strings to `evaluate()`.

### "No loader binding"

Ensure your wrangler.jsonc has the worker_loaders config and you're passing `env` to `evaluate()`:

```jsonc
{
  "worker_loaders": [{ "binding": "loader" }]
}
```

```typescript
await evaluate({ script: code }, env)  // Don't forget env!
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

---

**Stop worrying about untrusted code. Start building.**

```bash
pnpm add ai-evaluate
```
