# ai-evaluate

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

Runtime sandboxed execution of AI-generated (or otherwise untrusted) code in V8 isolates, backed by Cloudflare Workers `worker_loaders` in production and Miniflare locally.

## Lifecycle

**Runtime (production).** `ai-evaluate` is for executing untrusted code while your application is serving real requests — agent-generated scripts, user-supplied snippets, dynamic tool implementations. Reach for it when you need to run code you didn't write at request time without exposing your host environment.

## Not for

- **Replacing your test runner.** Unit and integration tests should use [`ai-tests`](../ai-tests) plus `vitest`. `ai-evaluate` runs *inside* production; it isn't a vitest substitute.
- **A/B testing variants under traffic.** Use [`ai-experiments`](../ai-experiments) for production traffic splitting and outcome measurement.
- **Trusted, statically-known code.** If you wrote and shipped the code yourself, just call it directly — sandboxing has overhead.

---

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

# With npm dependencies (real import syntax)
curl -X POST https://eval.workers.do \
  -H "Content-Type: application/json" \
  -d '{"script": "import { chunk } from \"lodash\"; return chunk([1, 2, 3, 4, 5, 6], 2)", "dependencies": {"lodash": "4.17.21"}}'
# {"success":true,"value":[[1,2],[3,4],[5,6]],"logs":[],"duration":42}

# A module that imports, a script that uses its exports
curl -X POST https://eval.workers.do \
  -H "Content-Type: application/json" \
  -d '{"module": "import dayjs from \"dayjs\"; export const today = () => dayjs().format(\"YYYY-MM-DD\")", "script": "return today()", "dependencies": {"dayjs": "1.11.10"}}'
# {"success":true,"value":"2026-01-25","logs":[],"duration":35}
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

// Needed for `fetch: [...]` allowlists and `outboundRpc`: evaluate() binds a
// loopback stub of this entrypoint as the sandbox's outbound (see
// "Network Access Control" below)
export { OutboundGateway } from 'ai-evaluate/worker'

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

For local development, import from the `/node` subpath. It runs the **same
`evaluate()` that ships to Cloudflare** inside a Miniflare 5 host worker whose
`env.loader` is a real `worker_loaders` binding, so local behaviour is Dynamic
Workers behaviour rather than a separate dev template.

```bash
pnpm add ai-evaluate miniflare   # Miniflare 5 requires Node >= 22
```

`miniflare` is an optional dependency of ai-evaluate, pinned to
`^5.20260907.0-alpha`: every Miniflare 5 release so far is an `-alpha`
prerelease (it is the `latest` dist-tag), and under npm semver a bare `^5`
matches no prerelease, so the range names the alpha tuple explicitly. It also
admits the first stable 5.x once one ships; re-pin to plain `^5` then. Miniflare
5 declares `engines.node >= 22`, so on older Node your package manager skips
the optional dependency at install time and the first `evaluate()` fails with
`MINIFLARE_UNAVAILABLE_ERROR` (exported from `ai-evaluate/node`) saying so.
`ai-evaluate` declares `engines.node >= 22` for the same reason; the `.`
export runs inside Workers and is unaffected.

```typescript
import { evaluate, dispose } from 'ai-evaluate/node'

const result = await evaluate({ script: '1 + 1' })
// { success: true, value: 2, logs: [], duration: 50 }

await dispose() // optional: release the process-wide host worker early (test teardown)
```

One host worker is created lazily per process and reused for every call; each
`evaluate()` still runs in its own dynamically-loaded isolate. While no
evaluation is in flight the host's handles (workerd child, loopback server) are
unref'd, so a script or CLI that never calls `dispose()` still exits on its own
as soon as its work is done; workerd is reaped on exit. `dispose()` only
matters when you want the host gone before the process ends.

The host is constructed with native Miniflare 5 options - one
`workers[].config` carrying a `manifest` of modules and the loader as
`env.loader: { type: 'worker-loader' }` - not the Miniflare 4 shape
(`modules: true`, `script`, `workerLoaders`), which Miniflare 5 accepts only
through its `convertV4MiniflareOptions()` shim. ai-evaluate no longer uses that
shim anywhere.

The host worker's modules are embedded in the published package at build time
(`dist/host-worker-modules.js`), so `ai-evaluate/node` can be bundled into your
own artifact - a single-file CLI, a Next.js server bundle - and still work:
nothing is read from disk beside the package at runtime. Only `miniflare` has
to stay resolvable (keep it external when you bundle).

For an isolated runtime (e.g. per test file) use `createLocalRuntime()`:

```typescript
import { createLocalRuntime } from 'ai-evaluate/node'

const runtime = createLocalRuntime()
const result = await runtime.evaluate({ script: 'return 1 + 1' })
await runtime.dispose()
```

#### Timeouts and CPU-bound scripts

`timeout` is enforced in two layers, and which one fires depends on what the
script is doing:

| Script | Cloudflare | Local (`ai-evaluate/node`) |
|--------|------------|----------------------------|
| Slow but yielding (`await setTimeout(...)`) | `AbortSignal.timeout` in `evaluate()` → `Timeout: Script execution exceeded {timeout}ms` | same |
| Promise that never settles | workerd hang detection, or the timeout | same |
| CPU-bound loop (`while (true) {}`) | the loaded worker's `limits.cpuMs`, bound to `timeout`, throws out of the loop (the runtime's CPU-limit error) | Node backstop: `Timeout: ...` at `timeout + 250ms`, then the host is replaced |

A loop that never yields is never interrupted by `AbortSignal.timeout` - the
signal is only observed when the script returns to the event loop. On
Cloudflare `evaluate()` therefore also passes `limits: { cpuMs: limits.cpuMs ??
timeout }` to the loaded worker's entrypoint (per-entrypoint limits do not
change the content-addressed isolate id, so cached isolates are unaffected; an
explicit `limits.cpuMs` is used as given). **Open-source
workerd accepts `limits.cpuMs` but does not enforce it**, and runs every loaded
worker on the host worker's single thread, so locally a CPU-bound loop also
stalls the host's own timers. The Node side is the local contract for that case:

- The evaluation that looped returns `Timeout: Script execution exceeded
  {timeout}ms` about 250ms after its timeout; the wedged host is then
  SIGKILLed and the next `evaluate()` starts a fresh one (~1s cold start).
- Any other evaluation in flight on that host fails with `WEDGED_HOST_ERROR`
  (exported from `ai-evaluate/node`) rather than a transport error, and can be
  retried.
- `dispose()` while evaluations are in flight fails them with
  `DISPOSED_HOST_ERROR`; the runtime is reusable afterwards.
- Host startup never counts against `timeout`: both clocks start once the host
  is ready.

The backstop only exists on the Node side. When `evaluate()` from `ai-evaluate`
is called directly inside a local workerd with a loader binding (e.g. under
`@cloudflare/vitest-pool-workers`), a CPU-bound loop wedges that workerd until
the process is restarted - there is nothing outside it to abort the request.

When the environment has no `test` (ai-tests) binding, tests run on the worker's
embedded vitest-compatible runner (`generateWorkerCode({ testRunner: 'embedded' })`);
with the binding they proxy to ai-tests over RPC (`testRunner: 'rpc'`).

### Host env: `loader` and `test`

`evaluate(options, env)` reads exactly two bindings from the host env:

```typescript
interface SandboxEnv {
  loader?: WorkerLoader        // worker_loaders binding - required
  test?: TestServiceBinding    // ai-tests service binding - optional
}
```

**3.0 breaking change:** the uppercase aliases `LOADER` and `TEST` accepted by
2.x are gone. A wrangler config with `"worker_loaders": [{ "binding": "LOADER" }]`
now fails with "Sandbox requires worker_loaders binding `loader`" - rename the
binding to `loader` (and an ai-tests service binding to `test`).

## API Reference

### evaluate(options, env?)

```typescript
interface EvaluateOptions {
  module?: string              // Module code with exports
  tests?: string               // Vitest-style test code
  script?: string              // Script to execute
  timeout?: number             // Default: 5000ms, max: 60000ms (wall clock)
  limits?: { cpuMs?: number; subrequests?: number } // Runtime-enforced limits (see below)
  tails?: unknown[]            // Tail workers receiving trace events (see below)
  compatibilityFlags?: string[] // e.g. ['nodejs_compat'] (default: none)
  compatibilityDate?: string   // YYYY-MM-DD (default: the package's COMPATIBILITY_DATE)
  env?: Record<string, string> // String environment variables (see below)
  bindings?: Record<string, unknown> // RPC stubs and structured-cloneable values (see below)
  sdk?: SDKConfig | boolean    // Enable $, db, ai globals
  dependencies?: Record<string, string> // npm packages to import (see External Imports)
  bundler?: boolean            // Resolve them with @cloudflare/worker-bundler (default: true)
  imports?: string[]           // Deprecated: packages as globals (see External Imports)
  isolation?: 'fresh' | 'cached' // Isolate reuse policy (default: 'fresh', see below)
}
```

Every option is validated at the top of `evaluate()` (`validateOptions`):
sizes, `timeout`, `limits`, `compatibilityFlags`, `compatibilityDate`, `tails`,
`dependencies` and `imports` are checked before anything is transformed or loaded, and a
`ValidationError` comes back as an error result (`success: false`, `error`
naming the option). What the loaded worker answers is checked too
(`assertEvaluateResult`): a response that is not a well-formed `EvaluateResult`
is reported as `Invalid EvaluateResult: ...` rather than returned as one.

### Limits, tails and compatibility

These map directly onto the Dynamic Workers spec the loader receives:

| Option | Where it lands | Content-addressed? |
|--------|----------------|--------------------|
| `limits.cpuMs` | `WorkerCode.limits` (as given) and the entrypoint's CPU budget | yes (the spec's `limits`; the entrypoint budget is not) |
| `limits.subrequests` | `WorkerCode.limits` | yes |
| `compatibilityFlags` | `WorkerCode.compatibilityFlags` (default `[]`) | yes |
| `compatibilityDate` | `WorkerCode.compatibilityDate` (default `COMPATIBILITY_DATE`) | yes |
| `tails` | `WorkerCode.tails` (the same array) | no - a runtime binding |

```typescript
await evaluate({
  script: 'console.log("hi"); return Buffer.from("hi").toString("base64")',
  limits: { cpuMs: 50, subrequests: 2 },   // CPU and outbound-request caps, enforced by the runtime
  compatibilityFlags: ['nodejs_compat'],   // Buffer, process, node: builtins
  tails: [env.TAIL],                       // a tail worker: gets console output, exceptions, outcome
}, env)
```

`limits.cpuMs` defaults to `timeout`: CPU time never exceeds wall time, so the
default cannot cut off a script the timeout would have let finish, and it is
what ends a CPU-bound loop (see [Timeouts and CPU-bound
scripts](#timeouts-and-cpu-bound-scripts)). The effective CPU budget
(`limits.cpuMs ?? timeout`) is applied on the entrypoint, where it does not
change the isolate id, so the same code with different timeouts is still one
cached isolate; an explicit `limits` object is part of the spec and does.

Cloudflare enforces `limits`; **open-source workerd (local) accepts and ignores
them** - `compatibilityFlags`, `compatibilityDate` and `tails` are honoured
locally. `tails` need a live loader: like `bindings`, they cannot cross the
`ai-evaluate/node` JSON boundary, so the local Node host rejects them; a
`WorkerEntrypoint` with a `tail(events)` handler bound as a service is the
usual tail worker.

### Sandbox env: `env` and `bindings`

The loaded worker's `env` is an explicit allowlist, so a host binding can never
leak into the isolate by accident. `module`, `tests` and `script` all see it as
a frozen `env` object:

```typescript
await evaluate({
  script: 'return { who: env.WHO, pong: await env.svc.ping() }',
  env: { WHO: 'sandbox' },          // strings only
  bindings: { svc: env.PING },      // RPC stubs and structured-cloneable values
}, env)
```

| Option | Accepts | Rejected with `ValidationError` |
|--------|---------|---------------------------------|
| `env` | strings | anything that is not a string |
| `bindings` | RPC stubs (a service binding, a `WorkerEntrypoint` stub, `ctx.exports.X` - anything with a `fetch` method, see `isRpcStubLike`) and structured-cloneable values (`structuredClone` accepts them) | raw KV / D1 / R2 / Durable Object namespace bindings, functions and closures |

To give the sandbox access to a raw binding, wrap it in a `WorkerEntrypoint`
service and pass that stub: the isolate then holds a capability you wrote, not
the binding itself. The key `TEST` is reserved for the ai-tests service binding,
and a key may not appear in both `env` and `bindings`. The validator runs in
`buildWorkerCode()` before any loader call; `evaluate()` reports its
`ValidationError` as an error result (`success: false`, `error` matching
`not structured-cloneable and not an RPC stub`).

`bindings` need a live loader: `ai-evaluate/node` without a host env reaches
its Miniflare host over an HTTP/JSON boundary that cannot carry a stub, so it
rejects `bindings` instead of forwarding a silently narrowed value. `env`
(strings) works on every path.

### Isolate reuse: `isolation`

Every evaluation is one `WorkerCode` spec (modules, compatibility date and
flags, limits). `isolation` decides how the Dynamic Workers loader turns that
spec into an isolate:

| `isolation` | Loader call | When |
|-------------|-------------|------|
| `'fresh'` (default) | `LOADER.load(spec)` | A new, uncached isolate every call: nothing at module scope survives between evaluations, so identical calls return identical results. |
| `'cached'` | `LOADER.get(workerCodeId(spec), factory)` | Identical specs share one isolate, and its module-scope state. Dynamic Workers are billed per unique worker per day, so this is the opt-in cost control for code that is safe to re-enter. |

`workerCodeId(spec)` content-addresses the spec - `mainModule`, `modules`,
`compatibilityDate`, `compatibilityFlags`, `allowExperimental`, `limits`, and
whether outbound fetch is blocked. Bindings (`env`, `tails`, a `globalOutbound`
service) never change the id, so the same code with different bindings is still
one unique worker.

What persists on a reused (`'cached'`) isolate: your `module` runs once, at
module scope of the generated worker, so **everything it declares** persists
across evaluations of the same spec - `let`/`const` bindings, exported arrays
and objects, the `exports` record, and anything on `globalThis`. Only `script`
locals and captured logs are per-request. A `let n = 0; export const inc = () =>
++n` module returns `1`, then `2`, then `3` under `'cached'`; under `'fresh'`
(the default, and the 2.x behaviour) every call returns `1`.

```typescript
import { evaluate, buildWorkerCode, workerCodeId } from 'ai-evaluate'

await evaluate({ script: 'return 1' }, env)                        // fresh (default): new isolate
await evaluate({ script: 'return 1', isolation: 'cached' }, env)   // one isolate per unique spec

// Inspect the id an evaluation will be cached under
const id = workerCodeId(await buildWorkerCode({ script: 'return 1' }))
```

### External Imports

Sandboxed code can `import` npm packages. Declare them in `dependencies`
(package.json style) and import them with ordinary ES module syntax in
`module` or `script`:

```typescript
const result = await evaluate({
  module: `
    import { chunk } from 'lodash'
    import dayjs from 'dayjs'
    export const chunks = chunk([1, 2, 3, 4, 5, 6], 2)
    export const today = () => dayjs().format('YYYY-MM-DD')
  `,
  script: 'return { chunks, today: today() }',
  dependencies: { lodash: '4.17.21', dayjs: '^1.11.0' },
}, env)
```

Versions are anything npm accepts (`4.17.21`, `^4`, `latest`); subpaths
(`import { cors } from 'hono/cors'`) and scoped packages work. A package the
code imports but does not declare is resolved at `latest` and reported in
`logs` as a warning - pin it. `dependencies` are part of the content-addressed
spec (a `package.json` module in the loaded worker), so `lodash@4.17.21` and
`lodash@4.17.20` are two workers.

**How they are resolved.** Inside the worker that runs `evaluate()`,
[`@cloudflare/worker-bundler`](https://www.npmjs.com/package/@cloudflare/worker-bundler)
installs the packages from the npm registry and bundles them with the
generated entry (esbuild-wasm) into one module - real packages, CommonJS
interop, no CDN in the loop. The bundler runs only inside workerd with package
resolution (a wrangler-bundled deployment, `@cloudflare/vitest-pool-workers`);
its warnings (an install failure, a package it could not fully resolve)
appear in `result.logs` at `warn` level. Resolved bundles are cached per
isolate by their input, and installed `node_modules` per set of dependencies,
so repeated evaluations over the same packages do not touch the registry.

**esm.sh is the fallback, not the path.** Where the bundler cannot load -
the local Miniflare host of `ai-evaluate/node`, which runs `evaluate()` as a
plain module graph - or when it fails, or with `bundler: false`, each
dependency is fetched from `https://esm.sh/<name>@<version>` as a single
bundled module and registered under its bare name, so the same `import`
syntax keeps working. The fallback is announced with a `warn` log entry
(except under an explicit `bundler: false`). Its limits: no subpath imports
(`hono/cors`), and packages whose esm.sh bundle pulls Node polyfills
(`/node/buffer.mjs`) will not load; on the bundler path these work.

Known bundler limits (0.2.x, experimental): a flat `node_modules` (one
version per package across the tree), text-only tarball extraction (no
`.wasm` / `.node` files), and no PAX tar headers (paths over 100 characters
are dropped).

**`imports` (deprecated).** The 2.x option still works: bare specifiers
(`lodash`, `dayjs@1.11.10`, `@faker-js/faker`) are treated as `dependencies`
and resolved the same way; http(s) URLs are fetched as-is on both paths. Each
package is additionally aliased onto `globalThis` under its name (`lodash` →
`_` and `lodash`, `dayjs` → `dayjs`, `@faker-js/faker` → `faker_js_faker`;
the last one also as `pkg`). This aliasing prints a one-time deprecation
warning; prefer `dependencies` and `import`.

```typescript
// 2.x style, still supported
await evaluate({ imports: ['lodash'], script: 'return _.chunk([1, 2], 1)' }, env)

// Full URLs (custom CDNs) are fetched as-is and exposed the same way
await evaluate({ imports: ['https://esm.sh/lodash@4.17.21'], script: 'return _.chunk([1, 2], 1)' }, env)
```

### EvaluateResult

```typescript
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
| Node.js (`ai-evaluate/node`) | Node >= 22, `miniflare@^5.20260907.0-alpha` (optional dependency) |

## Security Model

| Protection | Description |
|------------|-------------|
| V8 Isolate | Code runs in isolated V8 context |
| Network Control | Configurable: allow, block, or allowlist - enforced as the loaded worker's `globalOutbound` (see [Network Access Control](#network-access-control)), never by code in the isolate |
| No File System | Zero filesystem access |
| Memory Limits | Standard Worker limits apply |
| CPU Limits | `limits.cpuMs` (default: `timeout`) - the runtime throws out of a CPU-bound loop on Cloudflare; Node-side backstop locally (see [Timeouts and CPU-bound scripts](#timeouts-and-cpu-bound-scripts)) |
| Subrequest Limits | `limits.subrequests` caps outbound requests (fetch and binding calls) per evaluation on Cloudflare (see [Limits, tails and compatibility](#limits-tails-and-compatibility)) |
| Input Validation | `validateOptions` rejects oversized sources, malformed `timeout` / `limits` / compatibility settings / `tails` / `dependencies` / `imports` before anything runs; `assertEvaluateResult` checks the worker's response shape |
| Dependencies | `dependencies` come from the npm registry via `@cloudflare/worker-bundler` (esm.sh only as fallback); `imports` accept bare package names and http(s) URLs only (`file:` and other schemes are rejected) |

### Network Access Control

```typescript
// Allow all network (default)
await evaluate({ script: '...', fetch: true })

// Block all network
await evaluate({ script: '...', fetch: false })

// Allowlist specific domains (wildcards supported)
await evaluate({
  script: '...',
  fetch: ['api.example.com', '*.trusted.com']
})

// Answer some requests from the host instead of the network
await evaluate({
  script: 'return (await fetch("https://rpc.internal/users")).json()',
  fetch: ['api.example.com'],
  outboundRpc: (url, request) =>
    new URL(url).hostname === 'rpc.internal' ? Response.json({ users: [] }) : null,
})
```

The policy is the loaded worker's `globalOutbound`, enforced by the runtime.
Nothing inside the isolate checks hosts: there is no patched `globalThis.fetch`
and no `__originalFetch__` in module scope for the sandboxed code to reach
(2.x had both, and the allowlist was bypassable through them).

| `fetch` | `globalOutbound` | A blocked `fetch()` rejects with |
|---------|------------------|----------------------------------|
| `true` / absent | inherited (the host's) | - |
| `false` / `null` | `null` | workerd's own "not permitted to access the internet" |
| `string[]` | the host's `OutboundGateway` entrypoint | `Network access blocked: domain not in allowlist. Attempted: <host>` |

An allowlist (and `outboundRpc`) is served by the **`OutboundGateway`
entrypoint of the host worker** - the Worker that calls `evaluate()`. Its main
module must export it (`export { OutboundGateway } from 'ai-evaluate/worker'`)
and run on a compatibility date of `2025-11-17` or later, so `evaluate()` can
create a loopback stub of it (`ctx.exports.OutboundGateway({ props })`) with
the policy in `props`. Without the export, an evaluation that needs it fails
closed: an error result that says so, before anything is loaded. The host of
`ai-evaluate/node` (`src/host-worker.ts`) exports it, so allowlists work
locally with no setup. Cloudflare Dynamic Workers cannot use an entrypoint of
another dynamically loaded worker as an outbound, which is why the gateway is
an entrypoint of the host itself.

`outboundRpc` is asked first, for every request the sandbox makes: a
`Response` answers it, `null` declines it to the `fetch` policy (blocked under
`fetch: false`, checked under an allowlist, forwarded under `fetch: true`).
The function runs on the host and is registered for the duration of the
evaluation; it cannot cross the `ai-evaluate/node` JSON boundary, so the local
Node host without an env rejects it. A gateway whose interceptor is not held
by the isolate serving it fails closed rather than forwarding.

The allowlist is part of the content-addressed spec (as the `outbound.json`
module), so a `'cached'` isolate is never reused under another policy. A
request the gateway refuses (or that fails at the transport after being
forwarded) is recorded as an exception of the host worker's `OutboundGateway`
in its logs and tail events - that is how a `Fetcher` makes its caller's
`fetch()` reject.

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
