# ai-tests

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

Test utilities via RPC. Run tests anywhere—Workers, sandboxes, or locally.

```typescript
import { expect, createRunner } from 'ai-tests'

const runner = createRunner()

runner.describe('math', () => {
  runner.it('adds numbers', () => {
    expect(1 + 1).to.equal(2)
  })
})

const results = await runner.run()
// { total: 1, passed: 1, failed: 0 }
```

## Installation

```bash
pnpm add ai-tests
```

## Why RPC?

Traditional test frameworks assume local execution. `ai-tests` extends testing to distributed environments:

- **Cloudflare Workers** — Deploy as a Worker and call tests via RPC
- **ai-sandbox** — Run tests in isolated sandboxes with AI-generated code
- **Miniflare** — Local development with Workers RPC

## Assertions

Chai-compatible assertions with both BDD and Vitest-style APIs:

```typescript
import { expect, assert, should } from 'ai-tests'

// BDD style (expect/should)
expect(result).to.equal(42)
expect(array).to.have.length(3)
expect(obj).to.deep.equal({ name: 'test' })
expect(value).to.be.ok

// Vitest-compatible
expect(result).toBe(42)
expect(array).toHaveLength(3)
expect(obj).toEqual({ name: 'test' })
expect(value).toBeTruthy()

// TDD style (assert)
assert.equal(result, 42)
assert.lengthOf(array, 3)
assert.deepEqual(obj, { name: 'test' })
```

## Test Runner

Full test runner with suites, hooks, and result aggregation:

```typescript
import { createRunner } from 'ai-tests'

const runner = createRunner()

runner.describe('user service', () => {
  runner.beforeEach(() => {
    // Setup before each test
  })

  runner.afterEach(() => {
    // Cleanup after each test
  })

  runner.it('creates users', async () => {
    const user = await createUser({ name: 'Alice' })
    expect(user.id).to.exist
  })

  runner.it('validates email', () => {
    expect(() => createUser({ email: 'invalid' })).to.throw()
  })

  runner.skip('pending feature', () => {
    // This test is skipped
  })
})

const results = await runner.run()
console.log(`${results.passed}/${results.total} tests passed`)
```

### Hooks

```typescript
runner.beforeAll(() => { /* once before all tests */ })
runner.beforeEach(() => { /* before each test */ })
runner.afterEach(() => { /* after each test */ })
runner.afterAll(() => { /* once after all tests */ })
```

### Focus and Skip

```typescript
runner.only('focus on this', () => { /* only this runs */ })
runner.skip('skip this', () => { /* skipped */ })
```

## Worker Deployment

Deploy as a Cloudflare Worker for remote test execution:

```typescript
// worker.ts
export { default } from 'ai-tests'
```

```toml
# wrangler.toml
name = "test-worker"
main = "worker.ts"
```

Call from other workers via RPC:

```typescript
// In ai-sandbox or another worker
const results = await env.TEST.run(testCode)
```

## Assertion Chain Reference

### Flags
- `.not` — Negate the assertion
- `.deep` — Deep equality
- `.nested` — Nested property access
- `.own` — Own properties only
- `.ordered` — Ordered array matching
- `.any` / `.all` — Member quantifiers

### Value Checks
- `.equal(val)` / `.eq()` — Strict equality
- `.eql(val)` — Deep equality
- `.above(n)` / `.gt()` — Greater than
- `.below(n)` / `.lt()` — Less than
- `.within(min, max)` — Range check
- `.closeTo(n, delta)` — Approximate equality

### Type Checks
- `.ok` — Truthy
- `.true` / `.false` — Boolean
- `.null` / `.undefined` — Nullish
- `.NaN` — Not a number
- `.a(type)` / `.an()` — Type check

### Property Checks
- `.property(name)` — Has property
- `.lengthOf(n)` — Length check
- `.keys(...keys)` — Has keys
- `.include(val)` — Contains value
- `.members(arr)` — Array members

### Vitest Compatibility
- `.toBe()` — Strict equality
- `.toEqual()` — Deep equality
- `.toBeTruthy()` / `.toBeFalsy()`
- `.toBeNull()` / `.toBeUndefined()`
- `.toContain()` — Contains
- `.toHaveLength()` — Length
- `.toHaveProperty()` — Property
- `.toMatch()` — Regex/string match
- `.toThrow()` — Throws error
- `.toBeGreaterThan()` / `.toBeLessThan()`
- `.toBeInstanceOf()` — Instance check

## API Reference

| Export | Description |
|--------|-------------|
| `expect(value)` | BDD-style assertion |
| `should(value)` | Should-style assertion |
| `assert` | TDD-style assertions |
| `Assertion` | Assertion class (RpcTarget) |
| `createRunner()` | Create test runner |
| `TestRunner` | Test runner class |
| `TestService` | Worker entrypoint |

## Types

```typescript
interface TestResult {
  name: string
  passed: boolean
  skipped?: boolean
  error?: string
  duration: number
}

interface TestResults {
  total: number
  passed: number
  failed: number
  skipped: number
  tests: TestResult[]
  duration: number
}
```

## Related Packages

- [`ai-sandbox`](../ai-sandbox) — Sandboxed code execution with test integration
- [`ai-functions`](../ai-functions) — AI-powered test generation
