# Migrating ai-evaluate from 2.x to 3.0

3.0 makes Cloudflare Dynamic Workers the one code path. The `evaluate()` that
ships to Cloudflare is the `evaluate()` that runs locally: `ai-evaluate/node`
loads it into a Miniflare 5 host worker with a real `worker_loaders` binding
instead of running a separate dev template through a per-call Miniflare 3
instance. Everything below follows from that.

Every breaking change is listed here with its 2.x form, its 3.0 form and what
to do. The [CHANGELOG](./CHANGELOG.md) has the per-change detail; the
[README](./README.md) documents the 3.0 API.

## At a glance

| 2.x                                                                  | 3.0                                                                                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `miniflare@^3` (optional), `esbuild` (optional), Node 18+            | `miniflare@^5.20260907.0-alpha` (optional), no esbuild, **Node >= 22**                                                                                |
| `env.LOADER` / `env.TEST` accepted as aliases                        | `env.loader` / `env.test` only                                                                                                                        |
| Per-call Miniflare instance; `configurePool`, `warmPool`, ...        | One Miniflare 5 host worker per process; `dispose()`, `createLocalRuntime()`                                                                          |
| Separate dev worker template (`generateDevWorkerCode`)               | One template; the embedded test runner is `testRunner: 'embedded'` (`buildWorkerTemplate({ dev: true })`)                                             |
| `fetch: string[]` enforced by a patched `fetch` inside the isolate   | Enforced by the runtime as the loaded worker's `globalOutbound`; host must `export { OutboundGateway } from 'ai-evaluate/worker'`                     |
| `imports: ['lodash']` exposes packages as globals via esm.sh         | `dependencies: { lodash: '4.17.21' }` + real `import`; bundled by `@cloudflare/worker-bundler`; `imports` deprecated (still works, warns once)         |
| Identical code reused one cached isolate (`LOADER.get`, random id)   | `isolation: 'fresh'` (default, `loader.load`) - a new isolate per call; `'cached'` opts in, keyed by `workerCodeId(spec)`                             |
| `env` option documented but never reached the sandbox               | `env` (strings) reaches the sandbox; `bindings` carries RPC stubs and cloneable values; raw host bindings are rejected                                 |
| REPL context re-serialized into source; `ReplEvalResult.exports`     | REPL is a thin client over `evaluate()` with a `ReplState` facet; `sandboxId` resumes a session; `exports` gone, `getContext()` deprecated            |
| JSX/TypeScript via esbuild on the Node side                          | Transformed inside the worker by bundled sucrase (`jsx` option); works identically on both paths                                                      |
| No `limits`, `tails`, `compatibilityFlags`, `facet`, `modules`, ...  | All passed through to the Dynamic Workers spec (see [New options](#new-options))                                                                      |

## Requirements

| Environment                  | 2.x                                     | 3.0                                                                                                                        |
| ---------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Workers           | wrangler v4, `worker_loaders`           | the same, plus a compatibility date of `2025-11-17` or later where `fetch` allowlists, `outboundRpc` or `facet` are used (`ctx.exports`) |
| Node.js (`ai-evaluate/node`) | Node 18+, `miniflare@^3`, `esbuild`     | **Node >= 22**, `miniflare@^5.20260907.0-alpha` (optional dependency; older Node skips it at install time and `evaluate()` reports `MINIFLARE_UNAVAILABLE_ERROR`) |

`esbuild` is no longer needed for anything: JSX/TypeScript sources are
transformed inside the worker by a bundled copy of sucrase, and the host
worker is embedded into the package at build time
(`dist/host-worker-modules.js`), so `ai-evaluate/node` can itself be bundled
into your artifact. Keep `miniflare` external when you bundle.

```bash
pnpm remove esbuild            # if you added it for ai-evaluate
pnpm add ai-evaluate@3 miniflare@^5.20260907.0-alpha   # Node >= 22
```

## Breaking changes

### 1. Host env: the `LOADER` / `TEST` aliases are gone

`evaluate(options, env)` reads exactly `env.loader` (the `worker_loaders`
binding) and `env.test` (the optional ai-tests service binding).

```jsonc
// wrangler.jsonc - before
"worker_loaders": [{ "binding": "LOADER" }]
// after
"worker_loaders": [{ "binding": "loader" }]
```

```ts
// before
interface Env { LOADER: unknown; TEST?: unknown }
// after
interface Env { loader: unknown; test?: unknown }
```

A host env that only has `LOADER` now fails with
`Sandbox requires worker_loaders binding \`loader\`` (an error result, before
any loader call). The `SandboxEnv` type no longer has the uppercase keys, so
this is a type error as well as a runtime one. `ai-functions`' `runInSandbox`
follows: an env without `env.loader` takes the Node fallback.

### 2. Local runtime: one Miniflare 5 host, no pool API

`ai-evaluate/node` exports exactly `evaluate`, `createEvaluator`,
`createLocalRuntime`, `dispose` and the error constants `WEDGED_HOST_ERROR`,
`DISPOSED_HOST_ERROR`, `MINIFLARE_UNAVAILABLE_ERROR`.

- **Removed:** `src/miniflare-pool.ts` and its API - `configurePool`,
  `getPoolConfig`, `getPoolStats`, `warmPool`, `acquireInstance`,
  `disposePool`, `resetPool`, `PoolConfig`, `WorkerOptions`,
  `OutboundServiceHandler`. There is nothing to pool: one host worker per
  process is created lazily on the first call and reused (the 2.x test suite
  went from ~100s to ~13s).
- **Removed:** the `process.on('exit' | 'SIGINT' | 'SIGTERM')` handlers that
  importing the Node entry installed. An idle host is unref'd and does not
  keep the process alive, so most callers need no shutdown code. `dispose()`
  releases the host early (test teardown); `createLocalRuntime()` gives you an
  isolated host with its own `dispose()`.
- **Changed:** a CPU-bound loop (`while (true) {}`) wedges the single-threaded
  local workerd. The Node side now aborts at `timeout + 250ms`, SIGKILLs the
  host and starts a fresh one on the next call; other evaluations in flight
  fail with `WEDGED_HOST_ERROR` (retry them). On Cloudflare `limits.cpuMs`
  (bound to `timeout`) ends the loop instead.
- **Removed (internal):** `bundleHostWorker`, `loadHostWorker`, `HOST_MODULE`,
  `HOST_WORKER_NAME` are no longer exported from any entry.

```ts
// before
import { configurePool, warmPool, disposePool, evaluate } from 'ai-evaluate/node'
configurePool({ maxInstances: 4 })
await warmPool(2)
// ... process.on('exit') handlers installed for you
await disposePool()

// after
import { evaluate, dispose, createLocalRuntime } from 'ai-evaluate/node'
const result = await evaluate({ script: 'return 1' }) // host created on first use
await dispose() // optional

const runtime = createLocalRuntime() // e.g. one per test file
await runtime.evaluate({ script: 'return 1' })
await runtime.dispose()
```

### 3. Fetch allowlists are enforced by a gateway, not by code in the isolate

2.x rebound `globalThis.fetch` inside the sandbox and kept the original as
`__originalFetch__` in module scope, where sandboxed code could reach it. 3.0
generates no fetch control at all: the policy is the loaded worker's
`globalOutbound` - `null` for `fetch: false | null`, and for an allowlist (or
`outboundRpc`) a loopback stub of the **`OutboundGateway` entrypoint of the
host worker** with the policy in its `props`.

**What you must do:** export the gateway from the main module of every Worker
that calls `evaluate()` with `fetch: string[]` or `outboundRpc`, and run it on
a compatibility date of `2025-11-17` or later (for `ctx.exports`):

```ts
import { evaluate } from 'ai-evaluate'
export { OutboundGateway } from 'ai-evaluate/worker' // new subpath
```

Without the export an evaluation that needs it fails closed with an error
result naming the export. The Miniflare host of `ai-evaluate/node` exports it
already, so allowlists work locally with no setup.

**What changes for the sandboxed code:**

| `fetch`          | 2.x rejection                                             | 3.0 rejection                                                        |
| ---------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| `false` / `null` | `fetch is disabled in this sandbox`                       | workerd's own message (`... not permitted to access the internet`)   |
| `string[]`       | `Network access blocked: domain not in allowlist. ...`    | unchanged                                                            |

`outboundRpc` (declared in 2.x, never wired) now works: it is asked first for
every request; a `Response` answers, `null` falls through to the `fetch`
policy. It is a host function, so `ai-evaluate/node` without a host env
rejects it, and it cannot be combined with `isolation: 'cached'`
(`OUTBOUND_RPC_CACHED_ERROR`).

**Removed:** `getDomainCheckCode` from `ai-evaluate/static`, and the `fetch`
field of `BuildWorkerOptions` (`buildWorkerTemplate` / `buildWorkerBundle`);
internally `generateDomainCheckCode`, `generateFetchControlCode` and the
`fetch` option of `generateWorkerCode`. A static template has no network
policy of its own: load it with a `globalOutbound`.

### 4. `isolation` defaults to `'fresh'`; ids are `workerCodeId(spec)`

2.4.0 reused one cached isolate per distinct worker code (`LOADER.get` with a
content hash). 3.0 loads a **new isolate per call** by default
(`isolation: 'fresh'`, `loader.load(spec)`), because a reused isolate carries
the user module's module-scope state into the next evaluation. Opt back into
reuse - the per-unique-worker cost control - with `isolation: 'cached'`, for
code that is safe to re-enter:

```ts
await evaluate({ script, isolation: 'cached' }, env)
```

`generateSandboxId(code)` is replaced by `workerCodeId(spec: WorkerCode)`,
which hashes the whole spec (modules, compatibility date and flags, limits,
whether outbound is blocked); `env`, `tails` and a `globalOutbound` service
never change the id. The consequence under `'cached'`: the isolate keeps the
`env`, `bindings` and `tails` of the call that loaded it, and a later call with
the same spec but other values is served by that isolate with its own values
ignored. Do not pass per-caller secrets or stubs with `'cached'`.

### 5. The sandbox `env` is an explicit allowlist

`EvaluateOptions.env` was documented as environment variables but never
reached the sandbox. It now does - as a frozen `env` object visible to
`tests` and `script` (`module` code runs at module scope, before any request,
and does not see `env`; pass values in as arguments) - and it is **strings
only**. Everything else
goes in the new `bindings`:

| Option     | Accepts                                                                                            | Rejected (`ValidationError`, as an error result)              |
| ---------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `env`      | strings                                                                                            | any non-string                                                |
| `bindings` | RPC stubs (service bindings, `WorkerEntrypoint` stubs, `ctx.exports.X`) and structured-cloneable values | raw KV / D1 / R2 / DO namespaces, functions and closures      |

The key `TEST` is reserved; a key may not appear in both. `ai-evaluate/node`
without a host env rejects `bindings` (its JSON boundary cannot carry a stub).

### 6. `imports` (globals) is deprecated in favour of `dependencies` + `import`

```ts
// 2.x - still works in 3.0, prints a one-time deprecation warning
await evaluate({ imports: ['lodash'], script: 'return _.chunk([1, 2], 1)' }, env)

// 3.0
await evaluate(
  {
    module: `import { chunk } from 'lodash'; export const pairs = chunk([1, 2], 1)`,
    script: 'return pairs',
    dependencies: { lodash: '4.17.21' },
  },
  env
)
```

Inside workerd, `@cloudflare/worker-bundler` installs the packages from the
npm registry and bundles them with the generated entry; esm.sh is the fallback
only (the local Miniflare host, a bundler failure, or `bundler: false`), and
announces itself with a `warn` log. `ai-evaluate/node` no longer rewrites bare
`imports` to esm.sh URLs on the Node side. `validateOptions` now rejects
`file:` specifiers and malformed names.

### 7. The dev worker template is gone

There is one generated worker. What the 2.x "dev" template did - run tests on
an embedded vitest-compatible runner because no `test` binding was around - is
now `generateWorkerCode({ testRunner: 'embedded' })`, which `evaluate()`
selects automatically when `env.test` is absent. The internal alias
`generateDevWorkerCode` is removed. On `ai-evaluate/static`,
`buildWorkerTemplate({ dev: true })` keeps meaning "embedded runner".

### 8. Facets: `SandboxHost` is required for `facet`, and the REPL uses one

New in 3.0, but the REPL depends on it, so its requirements are breaking for
REPL users on Cloudflare:

- A Worker that calls `evaluate()` with `facet` (or hosts `createReplSession`)
  must export `SandboxHost` from its main module and declare it in wrangler:

  ```ts
  export { OutboundGateway, SandboxHost } from 'ai-evaluate/worker'
  ```

  ```jsonc
  "durable_objects": { "bindings": [{ "name": "SANDBOX_HOST", "class_name": "SandboxHost" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["SandboxHost"] }]
  ```

  Without it the evaluation fails closed. The Miniflare host of
  `ai-evaluate/node` has it (in-memory storage). The env key
  `__ai_evaluate_sandbox_host__` is reserved.

- `createReplSession` no longer re-serializes its context into module source
  (`buildContextModule` is gone). A session is one `sandboxId` with a
  `ReplState` facet; structured-cloneable values are stored in the sandbox,
  the code that declared functions / class instances / symbols is replayed.
  `ReplEvalResult.exports` (never populated) is gone; `ReplEvalResult` is now
  an alias of `EvaluateResult`. `getContext()` is deprecated (warns once,
  returns a snapshot). New: `ReplSessionConfig.sandboxId` and
  `ReplSession.sandboxId`; the value of an `eval` is its last expression
  statement. `local` defaults to the local host when no env is given.

### 9. Options are validated before anything runs

`evaluate()` now calls `validateOptions` first (sizes, `timeout`, `limits`,
compatibility settings, `tails`, `dependencies`, `imports`, `modules`,
`bindings`, `env`) and reports a `ValidationError` as an error result
(`success: false`, `error` naming the option) - 2.x forwarded some of these
and let the worker fail. The worker's response is checked too
(`assertEvaluateResult`): a malformed one is reported as
`Invalid EvaluateResult: ...`.

### 10. Behaviour the dev template had masked (fixed, may change results)

Because local and production now run the same bytes, three 2.x local-only
behaviours are gone: script/module evaluation without tests now declares
`exports` (`exports.add = ...` + `script: 'return add(2, 3)'` works on both
paths), the `fetch` option is honoured on the Workers path, and
`console.debug` is captured. Logs no longer leak between requests on a
reused isolate.

## New options

All of these reach the Dynamic Workers spec the loader receives.

| Option               | What                                                                                                                                               | Content-addressed? |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `limits`             | `{ cpuMs?, subRequests? }` (`subRequests` in camel case, as workerd spells it; `subrequests` is rejected) enforced by Cloudflare (accepted, not enforced, by local workerd); `cpuMs` defaults to `timeout`                         | yes                |
| `tails`              | tail workers (service bindings with a `tail()` handler) receiving the loaded worker's trace events; needs a live loader                            | no                 |
| `compatibilityFlags` | e.g. `['nodejs_compat']` (default none)                                                                                                            | yes                |
| `compatibilityDate`  | `YYYY-MM-DD` (default `COMPATIBILITY_DATE`, `2026-01-01`)                                                                                           | yes                |
| `bindings`           | RPC stubs and structured-cloneable values, as `env.NAME` in the sandbox                                                                            | no                 |
| `isolation`          | `'fresh'` (default) or `'cached'` - see [above](#4-isolation-defaults-to-fresh-ids-are-workercodeidspec)                                            | -                  |
| `facet`, `sandboxId` | a class of `module` as a SQLite-backed Durable Object facet of the sandbox `sandboxId`, called as `env.<BINDING>`                                   | yes (`sandbox.json`) |
| `jsx`                | `{ factory?, fragment?, importSource? }` for JSX in `module` / `tests` / `script` (default `h` / `Fragment`)                                        | yes (the transformed source) |
| `dependencies`       | npm packages, package.json style, imported with real `import` syntax                                                                               | yes (`package.json`) |
| `bundler`            | `false` skips `@cloudflare/worker-bundler` and uses the esm.sh fallback                                                                             | -                  |
| `modules`            | extra ES modules of the worker by name, importable as `./name.js`                                                                                  | yes                |
| `outboundRpc`        | host-side interceptor asked first for every outbound request (now wired; see [3](#3-fetch-allowlists-are-enforced-by-a-gateway-not-by-code-in-the-isolate)) | id only            |

New subpaths: `ai-evaluate/worker` (`OutboundGateway`, `SandboxHost`) and
`ai-evaluate/codemode` (`createExecutor`, an `Executor` for
`@cloudflare/codemode` 0.5+). The full runtime export list of `ai-evaluate`
is under "Exports" in the README and pinned by `test/index.test.ts`.

## Removed symbols

| Entry                   | Removed                                                                                                                                     | Use instead                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `ai-evaluate` (types)   | `SandboxEnv.LOADER`, `SandboxEnv.TEST`                                                                                                      | `SandboxEnv.loader`, `SandboxEnv.test`                                   |
| `ai-evaluate/node`      | `configurePool`, `getPoolConfig`, `getPoolStats`, `warmPool`, `acquireInstance`, `disposePool`, `resetPool`, `PoolConfig`, `WorkerOptions`, `OutboundServiceHandler` (the `miniflare-pool` module) | `dispose()`, `createLocalRuntime()`                                      |
| `ai-evaluate/node`      | the `process.on('exit' / 'SIGINT' / 'SIGTERM')` handlers installed on import                                                                | nothing needed; `dispose()` to release early                             |
| `ai-evaluate/node`      | `bundleHostWorker`, `loadHostWorker`, `HOST_MODULE`, `HOST_WORKER_NAME` (internal)                                                          | -                                                                        |
| `ai-evaluate/static`    | `getDomainCheckCode`, `BuildWorkerOptions.fetch`                                                                                            | the loader's `globalOutbound` (`fetch` option of `evaluate()`)           |
| `ai-evaluate/repl`      | `ReplEvalResult.exports`; `buildContextModule` (internal)                                                                                   | `ReplSession.sandboxId` / a facet; the value is the last expression      |
| internal (worker-template) | `generateDevWorkerCode`, `generateDomainCheckCode`, `generateFetchControlCode`, `generateSandboxId`, the `fetch` option of `generateWorkerCode` / `buildWorkerTemplate` | `generateWorkerCode({ testRunner: 'embedded' })`, `workerCodeId(spec)` |
| `package.json`          | `optionalDependencies.esbuild`; `miniflare@^3`                                                                                              | `miniflare@^5.20260907.0-alpha`, Node >= 22                              |

Deprecated (still present, warns once): `EvaluateOptions.imports`,
`ReplSession.getContext()`.

## Versioning: only `ai-evaluate` goes to 3.0.0

`ai-evaluate` was in the fixed changeset group with `ai-functions`,
`ai-database`, `ai-workflows` and the other core packages, so a major here
would have cascaded all 18 of them to 3.0.0. The release decision (aip-263g.12)
is the opposite: `.changeset/config.json` removes `ai-evaluate` from the fixed
group, so `changeset version` bumps

- `ai-evaluate` to **3.0.0**;
- the packages that depend on it - `ai-functions` (`workspace:^`, published as
  `^3.0.0`) and the `ai-primitives` umbrella (`workspace:*`) - by the dependency
  range change plus their own changesets; the fixed group moves together with
  `ai-functions` (a minor: `disposeSandbox()` and the `env.loader`-only
  routing);
- nothing else.

What that means for `ai-functions` users, even though its version is not a
new major:

- `ai-functions` routes all dynamic code execution through `ai-evaluate`
  (ADR-0010). Its Node fallback (`runInSandbox` without an env) now needs
  Miniflare 5, so **`ai-functions` on Node requires Node >= 22**; the monorepo
  root `engines.node` moved with it.
- `ai-functions`' `runInSandbox(options, env)` no longer honours `env.LOADER`
  / `env.TEST`; an env without `env.loader` takes the Node fallback.

Both are stated in the `ai-functions` changeset so they appear in its
CHANGELOG entry.

## Checklist

- [ ] Node >= 22; `miniflare@^5.20260907.0-alpha` installed where `ai-evaluate/node` is used; `esbuild` removed
- [ ] `worker_loaders` binding renamed to `loader` (and ai-tests to `test`); `Env` types updated
- [ ] `export { OutboundGateway } from 'ai-evaluate/worker'` in every Worker using `fetch: string[]` or `outboundRpc`; compatibility date >= `2025-11-17`
- [ ] `export { SandboxHost }` + Durable Object binding and migration where `facet` or the REPL is used
- [ ] Pool calls (`configurePool` / `warmPool` / `disposePool` / ...) removed; `dispose()` in test teardown if you want the host gone early
- [ ] Code that relied on a reused isolate (module-scope state across calls) passes `isolation: 'cached'`
- [ ] Non-string `env` values moved to `bindings` (stubs) or dropped (raw bindings wrapped in a `WorkerEntrypoint`)
- [ ] `imports: [...]` migrated to `dependencies` + `import` syntax (optional; the old form warns)
- [ ] Any use of `getDomainCheckCode` / `BuildWorkerOptions.fetch` / `ReplEvalResult.exports` / `getContext()` removed
