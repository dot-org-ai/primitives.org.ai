# ai-evaluate

## 3.0.0

### Major Changes

- d574ed8: ai-evaluate 3.0: Cloudflare Dynamic Workers native - one code path local and production (aip-263g)

  The `evaluate()` that ships to Cloudflare is the `evaluate()` that runs
  locally: `ai-evaluate/node` loads it into a Miniflare 5 host worker with a real
  `worker_loaders` binding. The full guide, with before/after for every item
  below, is `packages/ai-evaluate/MIGRATION.md`.

  **Requirements**

  - Node >= 22 (`engines.node`); `miniflare` optional dependency `^3` ->
    `^5.20260907.0-alpha`; `esbuild` removed from `optionalDependencies` (the
    JSX/TypeScript transform is a bundled sucrase inside the worker; the host
    worker is embedded at build time).
  - A host Worker using `fetch: string[]`, `outboundRpc` or `facet` needs a
    compatibility date of `2025-11-17` or later (`ctx.exports`).

  **Breaking**

  - `SandboxEnv` has exactly `loader` and `test`; the uppercase `LOADER` / `TEST`
    aliases are gone (rename the wrangler binding to `loader`).
  - `ai-evaluate/node` exports exactly `evaluate`, `createEvaluator`,
    `createLocalRuntime`, `dispose`, `WEDGED_HOST_ERROR`, `DISPOSED_HOST_ERROR`,
    `MINIFLARE_UNAVAILABLE_ERROR`. The `miniflare-pool` API is removed; importing
    the Node entry no longer installs `process.on('exit' | 'SIGINT' | 'SIGTERM')`
    handlers. A CPU-bound loop is ended by `limits.cpuMs` on Cloudflare and by a
    Node-side backstop (`timeout + 250ms`, host replaced) locally.
  - Fetch allowlists and `outboundRpc` are enforced as the loaded worker's
    `globalOutbound` through the host's `OutboundGateway` entrypoint, which the
    host must export (`export { OutboundGateway } from 'ai-evaluate/worker'`);
    nothing inside the isolate patches `fetch` any more. A `fetch: false`
    sandbox sees workerd's own rejection message.
  - `isolation` defaults to `'fresh'` (a new isolate per call, `loader.load`);
    `'cached'` (`loader.get(workerCodeId(spec), ...)`) is the opt-in that
    carries module-scope state across calls. `outboundRpc` + `'cached'` is
    rejected (`OUTBOUND_RPC_CACHED_ERROR`).
  - `EvaluateOptions.env` now reaches the sandbox and is strings only; RPC stubs
    and structured-cloneable values go in the new `bindings`; raw host bindings
    and closures are rejected with a `ValidationError` before any loader call.
  - `evaluate()` validates every option first (`validateOptions`) and checks the
    worker's response (`assertEvaluateResult`); both are reported as error
    results.
  - `facet` requires the host to export `SandboxHost` with a Durable Object
    namespace configured; `createReplSession` is a thin client over `evaluate()`
    with a `ReplState` facet: `ReplEvalResult.exports` is gone, `ReplEvalResult`
    is an alias of `EvaluateResult`, `getContext()` is deprecated,
    `ReplSessionConfig.sandboxId` / `ReplSession.sandboxId` are new.
  - The separate dev worker template is gone: the embedded test runner is
    `generateWorkerCode({ testRunner: 'embedded' })`, selected automatically
    without `env.test`; `buildWorkerTemplate({ dev: true })` keeps meaning that.
  - `imports` is deprecated (still works, warns once) in favour of
    `dependencies` + real `import` syntax, resolved by
    `@cloudflare/worker-bundler` inside workerd with esm.sh as fallback only.

  **Removed symbols**

  - `ai-evaluate` (types): `SandboxEnv.LOADER`, `SandboxEnv.TEST`.
  - `ai-evaluate/node`: `configurePool`, `getPoolConfig`, `getPoolStats`,
    `warmPool`, `acquireInstance`, `disposePool`, `resetPool`, `PoolConfig`,
    `WorkerOptions`, `OutboundServiceHandler`; the import-time process signal
    handlers; `bundleHostWorker`, `loadHostWorker`, `HOST_MODULE`,
    `HOST_WORKER_NAME` (internal).
  - `ai-evaluate/static`: `getDomainCheckCode`, `BuildWorkerOptions.fetch`.
  - `ai-evaluate/repl`: `ReplEvalResult.exports`; `buildContextModule` (internal).
  - Internal (worker-template): `generateDevWorkerCode`,
    `generateDomainCheckCode`, `generateFetchControlCode`, `generateSandboxId`,
    the `fetch` option of `generateWorkerCode` / `buildWorkerTemplate`.
  - `package.json`: `optionalDependencies.esbuild`; `miniflare@^3`.

  **New**

  - Options: `limits`, `tails`, `compatibilityFlags`, `compatibilityDate`,
    `bindings`, `isolation`, `facet`, `sandboxId`, `jsx`, `dependencies`,
    `bundler`, `modules`; `outboundRpc` now works.
  - Subpaths: `ai-evaluate/worker` (`OutboundGateway`, `SandboxHost`) and
    `ai-evaluate/codemode` (`createExecutor` for `@cloudflare/codemode` 0.5+).
  - `VERSION` exported from `ai-evaluate` and `ai-evaluate/static`, equal to
    the package version (2.x shipped `2.1.8` from a 2.4.0 package); kept in sync
    by `pnpm sync:version`, which the root `version-packages` script runs after
    `changeset version` and `pnpm build` runs first, and witnessed by
    `test/static.test.ts`.
  - The runtime export list of `ai-evaluate` is documented under "Exports" in
    the README and pinned by `test/index.test.ts`.

  **Versioning:** `ai-evaluate` is removed from the fixed changeset group for
  this release, so only `ai-evaluate` goes to 3.0.0; packages that depend on it
  (`ai-functions`, `ai-primitives`) get the dependency-range bump and the fixed
  group moves by `ai-functions`' own minor. `ai-functions`' consumer-facing
  changes (`env.loader` only, Node >= 22 for the Node fallback) are recorded in
  its changeset and in MIGRATION.md "Versioning".

- 2d48c58: ai-evaluate: Durable Object facets for per-sandbox persistent state; the REPL is a thin client over `evaluate()` (aip-263g.10)

  New `EvaluateOptions.facet: { class, id?, binding? }` and `sandboxId`: the
  named class of `module` runs as a SQLite-backed Durable Object facet owned by
  the host worker's `SandboxHost` Durable Object for `sandboxId`, and the script
  calls it as `env.<BINDING>` (`State` -> `env.STATE`). Facet storage survives
  across evaluations and isolates, and is isolated per `sandboxId` - under
  `isolation: 'cached'` too: the sandbox identity is part of the script worker's
  content-addressed spec (the `sandbox.json` module, `SANDBOX_JSON_MODULE`), so
  a cached isolate is one per sandbox and never carries one sandbox's
  `SandboxHost` stub into another's evaluation (aip-263g.39). A plain
  class is wrapped in a `DurableObject` subclass; one that extends
  `DurableObject` runs as it is. A changed module restarts the facet on the new
  class with its storage kept; `fetch: false` / allowlists apply to facet code
  too (`outboundRpc` does not).

  **Breaking:** a Worker that calls `evaluate()` with `facet` must export
  `SandboxHost` from its main module (`export { SandboxHost } from
'ai-evaluate/worker'`) and declare it in wrangler (`durable_objects.bindings`
  with `class_name: "SandboxHost"` and a `new_sqlite_classes` migration).
  Without it the evaluation fails closed. The Miniflare host of
  `ai-evaluate/node` has it already (in-memory storage). The env key
  `__ai_evaluate_sandbox_host__` is reserved.

  **Breaking (REPL):** `createReplSession` no longer fakes persistence by
  re-serializing its context into module source (`buildContextModule` is
  gone). A session is one `sandboxId` with a `ReplState` facet: each `eval`
  hydrates the known variables from the facet, runs the code, and stores every
  structured-cloneable value back; the code that declared a function, class
  instance or symbol is replayed at the start of later evaluations instead.
  The value of an `eval` is its last expression statement (`counter.n += 1;
counter.n` -> 2). `getContext()` is deprecated (warns once, returns a snapshot
  of the stored values); `setContext` / `clearContext` apply at the next
  evaluation; `ReplSession.sandboxId` is new, and `ReplSessionConfig.sandboxId`
  resumes a sandbox (a session without one drops its storage on `close()`).
  `ReplEvalResult.exports` (never populated) is gone.

  - New `src/facets.ts`: `createFacetHost` (the logic `SandboxHost` delegates
    to), `generateFacetWorkerCode`, `facetEnvSource`, `facetBindingName`,
    `loopbackSandboxHost` and the constants, exported from `ai-evaluate`;
    `src/loopback.ts` (`loopbackExport`) now serves both loopback lookups.
  - `buildWorkerCodeWithWarnings` returns `facet` (host stub, name, spec) when
    set; `evaluate()` attaches it before running the script.
  - Workers suite: test/workers/facets.workers.test.ts; Node pool:
    test/facets.test.ts (fake loader, mocked loopback), test/repl.test.ts.

- bd4697a: ai-evaluate: local runtime is one Miniflare 5 host worker with a real LOADER binding (same `evaluate()` bytes as prod)

  **Breaking:** `ai-evaluate/node` now requires `miniflare@^5.20260907.0-alpha` (Node >= 22).
  The Miniflare 3 per-call instance and the separate dev worker template are gone.

  - `ai-evaluate/node` loads `src/host-worker.ts` (which imports `evaluate()` from
    `src/evaluate.ts`) and its module graph into a Miniflare 5 host worker whose
    `env.LOADER` is a `worker-loader` binding. Local and production execute the same
    code path.
  - New: `createLocalRuntime()` -> `{ evaluate, dispose }` and process-wide `dispose()`.
    One host per process, lazily created, reused across calls
    (test suite: ~100s -> ~13s). The host's handles are unref'd while idle, so a
    script or CLI that never calls `dispose()` still exits on its own (as with the
    per-call Miniflare 3 instance); `dispose()` is only needed to release the host
    early. `ai-functions` exposes this as `disposeSandbox()`.
  - `generateDevWorkerCode` is merged into `generateWorkerCode` as
    `testRunner: 'rpc' | 'embedded'`; it remains as a deprecated alias. `evaluate()`
    falls back to the embedded test runner when no `TEST` binding is present, so the
    `loader && test` pre-check in `node.ts` is dropped.
  - `evaluate()` now enforces `timeout` with `AbortSignal.timeout` (host-worker side).
    Locally, a CPU-bound loop wedges single-threaded workerd, so the Node side adds a
    backstop that disposes and recreates the host.
  - Fixes in the Workers entry (`evaluate.ts`) that the dev template had masked:
    script/module evaluation without tests now declares `exports` (so
    `exports.add = ...` + `script: 'return add(2, 3)'` works), honours the `fetch`
    allowlist / block option, and captures `console.debug`. Logs no longer leak between
    requests on a reused content-addressed isolate.
  - `miniflare-pool.ts` (`configurePool`, `warmPool`, `acquireInstance`, `disposePool`,
    `resetPool`) is removed - see the "remove miniflare-pool" changeset.

- 815a9ce: ai-evaluate: enforce fetch allowlists and `outboundRpc` with a `globalOutbound` gateway, not an in-isolate fetch patch (aip-263g.7)

  **Breaking:** a `fetch: string[]` allowlist (and `outboundRpc`) now needs the
  `OutboundGateway` entrypoint exported from the main module of the Worker that
  calls `evaluate()`: `export { OutboundGateway } from 'ai-evaluate/worker'`
  (new subpath; compatibility date `2025-11-17` or later for `ctx.exports`).
  Without it an evaluation that needs the gateway fails closed with an error
  result. The Miniflare host of `ai-evaluate/node` exports it already.

  - 2.x rebound `globalThis.fetch` inside the sandbox and kept the original as
    `__originalFetch__` in module scope, where the sandboxed code could reach it
    (and the prototype's `fetch` was another way past an own-property patch).
    The generated worker no longer contains any fetch control; the policy is
    the loader's `globalOutbound`: `null` for `fetch: false | null`, and for an
    allowlist or `outboundRpc` a loopback stub of `OutboundGateway` with the
    policy in its `props`. A blocked request still rejects with
    `Network access blocked: domain not in allowlist. Attempted: <host>`; a
    `fetch: false` sandbox now sees workerd's own message instead of the
    template's "fetch is disabled in this sandbox".
  - `outboundRpc` works: the gateway asks it first for every request (a
    `Response` answers, `null` declines to the `fetch` policy). It is a host
    function registered for the duration of the evaluation; `ai-evaluate/node`
    without a host env rejects it, as it does `bindings` and `tails`.
  - The allowlist joins the content-addressed spec as the `outbound.json`
    module, so a `'cached'` isolate is never reused under another policy.
  - New `src/outbound.ts`: `createOutboundGateway(allowlist, outboundRpc?,
upstream?)`, `outboundPolicy`, `blockedHostError`, and the gateway's
    constants, exported from `ai-evaluate`. `generateDomainCheckCode`,
    `generateFetchControlCode`, `getDomainCheckCode` and the `fetch` option of
    `generateWorkerCode` / `buildWorkerTemplate` are gone.
  - `buildWorkerCodeWithWarnings` returns `release()`, which forgets the
    registered interceptor once the loaded worker is done.

- fbad990: ai-evaluate: remove `miniflare-pool` and per-call Miniflare instantiation

  **Breaking:** `src/miniflare-pool.ts` is gone. `configurePool`, `getPoolConfig`,
  `getPoolStats`, `warmPool`, `acquireInstance`, `disposePool` and `resetPool` no
  longer exist; the process-wide Miniflare 5 host worker made the pool unreachable
  (nothing called `acquireInstance`) and redundant.

  - `ai-evaluate/node` exports exactly `evaluate`, `createEvaluator`,
    `createLocalRuntime` and `dispose`. `dispose()` (process-wide, or the one on a
    `createLocalRuntime()` handle) is the only lifecycle API.
  - Importing `ai-evaluate/node` no longer installs `process.on('exit' | 'SIGINT' |
'SIGTERM')` handlers - callers own shutdown. (An idle host does not keep the
    process alive, so most callers need no shutdown code at all.)
  - `loadHostWorker()` / `HOST_MODULE` / `HOST_WORKER_NAME` are internal to the
    local runtime and are no longer exported.

- db0ede1: ai-evaluate: scope the sandbox env to RPC stubs and structured-cloneable values (aip-263g.6)

  **Breaking:** `SandboxEnv` no longer accepts the uppercase `LOADER` / `TEST`
  aliases. `evaluate(options, env)` reads exactly `env.loader` (worker_loaders)
  and `env.test` (ai-tests); a wrangler config with `"binding": "LOADER"` must
  rename it to `loader`. The Miniflare host behind `ai-evaluate/node` binds its
  loader as `loader` too. `ai-functions`' `runInSandbox` follows (`env.loader`).

  **Fixed:** `EvaluateOptions.env` was documented as environment variables but
  never reached the sandbox. It now does, and it is an explicit allowlist:

  - `env?: Record<string, string>` - strings only, visible to `module`, `tests`
    and `script` as a frozen `env` object.
  - New `bindings?: Record<string, unknown>` - RPC stubs (a service binding, a
    `WorkerEntrypoint` stub, `ctx.exports.X`: anything with a `fetch` method,
    `isRpcStubLike`) and structured-cloneable values.
  - `buildWorkerCode()` merges both through the new `buildSandboxEnv()` and
    throws `ValidationError` for a non-string `env` value, a `bindings` value that
    is "not structured-cloneable and not an RPC stub" (a raw KV/D1/R2/DO binding,
    a closure), a key in both, or the reserved `TEST` key. `evaluate()` reports
    that as an error result before any loader call, so `WorkerCode.env` never
    carries a value that fails the validator and a raw host binding cannot leak.
  - The ai-tests binding is passed through as `env.TEST` only on the RPC runner
    (tests present and a `test` service bound), never for a script-only worker.
  - `ai-evaluate/node` without a host env rejects `bindings` (its HTTP/JSON
    boundary cannot carry a stub) instead of forwarding a silently narrowed value.

  New exports: `ValidationError`, `buildSandboxEnv`, `isRpcStubLike`,
  `isStructuredCloneable`, `TEST_BINDING_KEY`.

### Minor Changes

- 3111c86: ai-evaluate: reject `outboundRpc` with `isolation: 'cached'` instead of silently loading one unique worker per call (aip-263g.40)

  - The `outboundRpc` interceptor is registered per evaluation under a fresh id
    that is part of the content-addressed `outbound.json` module (so a gateway
    can never serve a released interceptor). Under `'cached'` that made every
    call a never-before-seen `loader.get` id: one unique worker per call, with
    no module-scope reuse and no warning - the cost `'cached'` exists to avoid.
    `evaluate()` now reports `OUTBOUND_RPC_CACHED_ERROR` (a `ValidationError`,
    as an error result) for the combination, before anything is registered or
    loaded. A `fetch` allowlist without `outboundRpc` is content-stable and
    caches as documented.
  - `ai-evaluate/codemode`: every call with tools, a connector or a
    `globalOutbound` goes through `outboundRpc`, so the advertised
    `evaluate.isolation: 'cached'` was inert. `isolation` is no longer part of
    `CodemodeEvaluateOptions`; `createExecutor` throws `CODEMODE_CACHED_ERROR`
    for `evaluate.isolation: 'cached'` at construction. The executor loads a
    fresh isolate per call, as codemode's own `DynamicWorkerExecutor` does.
  - New exports: `OUTBOUND_RPC_CACHED_ERROR` (`ai-evaluate`) and
    `CODEMODE_CACHED_ERROR` (`ai-evaluate/codemode`).

- b97d038: ai-evaluate: `ai-evaluate/codemode` - an `Executor` for `@cloudflare/codemode` on top of `evaluate()`; `EvaluateOptions.modules` (aip-263g.11)

  - New subpath `ai-evaluate/codemode` exporting `createExecutor(options)`: a
    `@cloudflare/codemode` (0.5+) `Executor` that runs the agent's code through
    `evaluate()` in place of the stock `DynamicWorkerExecutor`, so it gets the
    outbound gateway, content-addressed isolates, `timeout` as the CPU budget,
    `limits`, `tails` and npm `dependencies`. Options are codemode's own
    (`loader`, `timeout` default 60000, `globalOutbound` default `null`,
    `modules`, `bindings`) plus `evaluate` for the remaining `EvaluateOptions`.
    Use it as the `executor` of `createCodeTool({ tools, executor })` or
    `createCodemodeRuntime({ ctx, connectors, executor })`.
  - The contract is codemode's: `execute(code, providersOrFns, options)`
    resolves to `{ result, logs }` or `{ result: undefined, error, logs }` with
    the sandbox's error string, never a `success: false` object and never a
    throw (codemode's `runCode` raises `error` as a thrown `Error`).
  - Tool functions stay on the host: each provider namespace is a proxy in the
    sandbox whose calls are `POST https://codemode.invalid/<namespace>/<tool>`,
    answered by the host's `OutboundGateway` (`outboundRpc`) - so the host
    worker exports the gateway as it does for a fetch allowlist. Everything else
    the sandbox fetches is blocked (`globalOutbound: null`) or routed through
    the given `Fetcher`. Connectors dispatch the same way to `callTool`.
  - `@cloudflare/codemode@^0.5` is an optional peer dependency; only its types
    are imported.
  - `EvaluateOptions.modules`: extra ES modules of the loaded worker by name
    (`{ 'helper.js': '...' }`, importable as `./helper.js`), validated
    (reserved names, size) and part of the content-addressed spec.

- 0f7dd9e: ai-evaluate: JSX/TypeScript transform runs inside the worker (bundled sucrase); no esbuild

  `evaluate()` now transforms `module`, `tests` and `script` from JSX/TypeScript to
  JavaScript itself, before generating worker code, using sucrase bundled into the
  package (`src/transform-bundle.ts`). The transform therefore runs wherever
  `evaluate()` runs - Cloudflare in production, the Miniflare host worker locally -
  so JSX works identically on both paths and the content-addressed sandbox id
  hashes the source that actually runs.

  - New `jsx?: { factory?, fragment?, importSource? }` on `EvaluateOptions`
    (default `h` / `Fragment`, classic runtime; `importSource` selects the
    automatic runtime). Plain JavaScript passes through byte-identical.
  - New exports: `transformSource`, `transformOptions`, `containsJSX`, `JSXOptions`.
  - `esbuild` is gone from `optionalDependencies`. `ai-evaluate/node` no longer
    bundles the host worker at runtime: `loadHostWorker()` (replaces
    `bundleHostWorker()`) collects `host-worker` and its imports as plain ES
    modules for Miniflare - from `dist/` when installed, from `src/` (types
    stripped by the same sucrase) under vitest.

- 21a77e7: ai-evaluate: pass through `limits`, `tails`, `compatibilityFlags` and `compatibilityDate`; wire `validateOptions` and `assertEvaluateResult` into `evaluate()` (aip-263g.5)

  - `EvaluateOptions` gains `limits` (`cpuMs`, `subRequests`), `tails`,
    `compatibilityFlags` (default none) and `compatibilityDate` (default
    `COMPATIBILITY_DATE`). All four reach the Dynamic Workers spec the loader
    receives; `limits`, flags and date are content-addressed with the code,
    `tails` is a runtime binding and never changes the isolate id.
  - `limits.cpuMs` defaults to `timeout`: the effective CPU budget
    (`limits.cpuMs ?? timeout`) is applied on the entrypoint (`entrypointLimits`),
    so the same code with different timeouts still shares one cached isolate;
    the host-side `AbortSignal.timeout(timeout)` stays as the wall-clock guard.
  - `evaluate()` now calls `validateOptions` first (sizes, `timeout`, `limits`,
    compatibility settings, `tails`, `imports`) and reports a `ValidationError`
    as an error result; the worker's response is checked with
    `assertEvaluateResult` before it is returned. `validateOptions` accepts bare
    package specifiers in `imports` (`lodash`, `dayjs@1.11.10`, `@scope/pkg`),
    as the README and `evaluate()` always have.
  - `ai-evaluate/node` without a host env rejects `tails` (stubs cannot cross
    its JSON boundary), as it already did for `bindings`.
  - Workers suite: a `TailStub` tail worker (`env.TAIL`) witnesses trace
    delivery; `nodejs_compat` is witnessed via `Buffer`. Local workerd accepts
    but does not enforce `limits.cpuMs` / `limits.subRequests` (aip-263g.34), so
    those two enforcement tests probe the runtime and skip themselves until it
    does.

- f9a8899: ai-evaluate: `dependencies` resolved by `@cloudflare/worker-bundler`; real `import` syntax; esm.sh as fallback only (aip-263g.9)

  - `EvaluateOptions.dependencies` (package.json style, `{ lodash: '4.17.21' }`)
    lets `module` and `script` import npm packages with ordinary ES module
    syntax (`import { chunk } from 'lodash'`). Static imports are hoisted out of
    the user code to the worker's top level (`hoistImports`).
  - Inside workerd, `@cloudflare/worker-bundler` (0.2.3, experimental) installs
    the packages from the npm registry and bundles them with the generated
    entry (new `src/bundler.ts`, `resolveImports`). Bundler warnings are
    surfaced in `result.logs` at `warn` level. Resolved module maps are cached
    by input and installed `node_modules` by dependencies hash, per isolate.
    A package the code imports but does not declare resolves at `latest` with
    a warning.
  - `package.json` (a json module carrying the dependencies) joins the
    loaded worker's modules, so `workerCodeId` differs by dependency version.
  - esm.sh is now the fallback only: where the bundler cannot load (the
    Miniflare host of `ai-evaluate/node`), when it fails, or with
    `bundler: false`, each dependency is fetched from esm.sh as one bundled
    module and registered under its bare name; the fallback is reported as a
    `warn` log (not under an explicit `bundler: false`).
  - `imports` is deprecated: bare specifiers become `dependencies` (and are
    still aliased onto `globalThis` - `lodash` -> `_` - with a one-time
    deprecation warning); URLs are fetched as-is on both paths. `validateOptions`
    accepts bare names (`lodash`, `@scope/pkg@1.0.0`) and http(s) URLs, rejects
    `file:` and malformed names, and validates `dependencies` / `bundler`.
  - `ai-evaluate/node` no longer rewrites bare `imports` to esm.sh URLs on the
    Node side; the host worker decides how to resolve them.
  - Tests: workers suite imports real lodash through the bundler inside workerd;
    Node suite drives `resolveImports` against a stand-in bundler and the real
    installer against a mocked registry, and witnesses the esm.sh fallback with
    a fetch spy.

- 93803c4: ai-evaluate: content-address the full `WorkerCode` spec; `isolation: 'cached' | 'fresh'`

  - `generateSandboxId(code)` is replaced by `workerCodeId(spec: WorkerCode)`, which
    hashes a stable (sorted-key) serialization of the whole spec - `mainModule`,
    `modules`, `compatibilityDate`, `compatibilityFlags`, `allowExperimental`,
    `limits`, and whether `globalOutbound` is blocked - so callers with different
    compatibility flags, limits or extra modules no longer collide on one cached
    isolate. `env`, `tails` and a `globalOutbound` service do not change the id.
  - New `EvaluateOptions.isolation`: `'fresh'` (default) uses `LOADER.load(spec)` for a
    new, uncached isolate every call, so identical evaluations stay independent - the
    same per-call module scope 2.4.0 had; `'cached'` uses `LOADER.get(id, factory)` and
    shares one isolate per unique spec (the opt-in per-unique-worker/day cost control).
    Under `'cached'` the user module body runs once per isolate, so all of its
    module-scope state (`let`/`const` bindings, exported arrays and objects, the
    `exports` record, `globalThis`) persists across calls; only script locals and
    logs are per-request. Opt in only for code that is safe to re-enter.
  - `WorkerLoader` / `WorkerCode` / `WorkerStub` types track the current Dynamic
    Workers API (`load`, `compatibilityFlags`, `allowExperimental`, `limits`, `tails`,
    `getEntrypoint(name?, { props?, limits? })`, `getDurableObjectClass`).
  - `buildWorkerCode(options, testService?)`, `loadWorker(loader, code, isolation?)`,
    `workerCodeId` and `DEFAULT_ISOLATION` are exported; the two duplicated
    loader-factory closures in `evaluate.ts` are gone.

### Patch Changes

- 9ba30c2: ai-evaluate: CPU-bound loops - `limits.cpuMs` bound to `timeout`, hardened local host recovery (aip-263g.14)

  - `evaluate()` now passes `limits: { cpuMs: timeout }` to the loaded worker's
    entrypoint. `AbortSignal.timeout` is never observed by a loop that does not
    yield; on Cloudflare the CPU limit ends it instead. Per-entrypoint limits do
    not change the content-addressed isolate id, so cached isolates are unaffected.
  - `ai-evaluate/node`: evaluations caught in flight when a CPU-bound loop wedges
    the local host now fail with the exported `WEDGED_HOST_ERROR` (retryable)
    instead of a bare transport error; evaluations in flight during `dispose()`
    fail with `DISPOSED_HOST_ERROR`. Only the host that wedged is retired, even
    when several loops hit the backstop together; host startup never counts
    against `timeout`.
  - Documented the limitation: open-source workerd accepts `limits.cpuMs` but does
    not enforce it and is single-threaded, so locally the Node backstop
    (`timeout + 250ms`, then SIGKILL and a fresh host on the next call) is the
    contract. Calling `evaluate()` directly inside a local workerd (vitest-pool-
    workers) has no backstop.
  - The three "infinite loop" security tests are un-skipped against that contract.

- eb9ec75: ai-evaluate: `ai-evaluate/node` embeds the host worker at build time, so it survives being bundled

  `loadHostWorker()` located `dist/host-worker.js` and its imports beside
  `dist/node.js` via `import.meta.url`. A consumer that bundled `ai-evaluate/node`
  into its own artifact (a single-file CLI, a Next server bundle) had no such
  sibling and failed on the first `evaluate()`.

  - `scripts/build-host-worker.ts` (part of `npm run build`, after `tsc`) walks
    the emitted `dist/host-worker.js` graph once and writes the module map into
    `dist/host-worker-modules.js`; `loadHostWorker()` uses that embedded map and
    only falls back to the disk walk (`walkHostWorker()`) where the embed is the
    `src/` placeholder (vitest, `tsc --watch`).
  - New test builds a scratch `dist/`, bundles `dist/node.js` into a lone file
    with Vite the way a consumer would, and runs it from an unrelated cwd.
  - Fix: `dispose()` on an idle host re-attaches the host's handles for the
    duration of teardown. Previously an `await dispose()` at the tail of a script
    exited with Node's "unsettled top-level await" (code 13) because the idle
    host's unref'd handles let the loop drain before Miniflare had finished.

- b907460: ai-evaluate: fixes from the 3.0 integration review (aip-263g)

  - `limits.subRequests` replaces `limits.subrequests`: workerd's field is camel
    case, so the old spelling was accepted by the loader and silently ignored
    locally and in production. `validateOptions` now rejects `subrequests`
    (aip-263g.35).
  - Facets: the facet worker's spec carries `sandbox.json` too, so it is one
    isolate per sandbox. Before, the facet worker (always `loader.get`, env not
    hashed) loaded for the first sandbox served every later `sandboxId` with the
    same module, with the first sandbox's `env` and `bindings` (aip-lrjh.5).
  - `validateOptions` checks `fetch` (a string or malformed list no longer fails
    open to "allow all"), `isolation` (aip-263g.38), `outboundRpc` and `jsx`;
    `sandbox.json` is a reserved module name.
  - The outbound gateway forwards with `redirect: 'manual'`, so a redirect from
    an allowlisted host is followed by the sandbox through the gateway again,
    never by the gateway.
  - The bundler's shared install cache keeps `node_modules` only: one build's
    entry, `package.json` and `files` are no longer readable by a later build
    over the same dependencies.
  - `ai-evaluate/codemode`: tool lookup uses own properties only (`constructor`
    is not a tool); `__proto__` is reserved and never a sanitized tool name.
  - REPL `setContext(key)` requires an identifier key (it is interpolated into
    every later chunk).
  - An `outboundRpc` registration is released if building the facet spec throws.
  - Docs: `env` is visible to `script` and `tests`, not to `module` code
    (aip-263g.37, aip-lrjh.12); a `'cached'` isolate keeps the `env`, `bindings`
    and `tails` of the call that loaded it (aip-263g.36); allowlist patterns
    match the hostname only. Each has a workerd witness.

- 5c4c588: ai-evaluate: reconcile the Miniflare 5 pin, engines, and options shape (aip-263g.13)

  - `miniflare` stays pinned to `^5.20260907.0-alpha` (optional dependency): every
    Miniflare 5 release is an `-alpha` prerelease, and a bare `^5` matches none of
    them under npm semver. The range admits the first stable 5.x; re-pin to `^5`
    once one ships.
  - `ai-evaluate` now declares `engines.node >= 22`, matching Miniflare 5's own
    `engines`. On older Node, package managers skip the optional dependency at
    install time; `ai-evaluate/node` now reports the exported
    `MINIFLARE_UNAVAILABLE_ERROR` (what is missing and why, plus the resolver's
    message) instead of a bare "Cannot find package 'miniflare'". Other import
    failures pass through unchanged.
  - Documented that the local host is built with native Miniflare 5 options
    (`workers[].config` + `manifest` + `env.LOADER: { type: 'worker-loader' }`);
    the Miniflare 4 shape and `convertV4MiniflareOptions()` are no longer used
    anywhere.
  - Monorepo: CI and the root `engines.node` move to Node 22 (Node 20 is
    end-of-life and cannot install Miniflare 5).

- aef9570: ai-evaluate: `pnpm build` runs `sync:version` first, and the root `release` script orders `version-packages` -> `build` -> `publish-packages`, so `dist/version.js` and the `public/*.mjs` headers ship at the bumped version (aip-lrjh.11)

## 2.4.0

### Minor Changes

- 4d58f5f: Route ALL dynamic code execution in `ai-functions` through `ai-evaluate`'s
  V8-isolate sandbox (Cloudflare Dynamic Workers, Miniflare fallback in Node), and
  ban `new Function`/`eval`.

  - **ai-evaluate fix:** the loaded-worker binding now passes under the Dynamic
    Workers loader-factory `env:` field (was `bindings:`), so the loaded worker's
    `env.TEST` resolves and the tests/SDK eval path works. Both `loader.get`
    callbacks are annotated `Promise<WorkerCode>` so a `bindings:` typo fails
    typecheck.
  - **Path A — `type: 'code'` stays deterministic, no model:** `handler` is a
    direct call (unchanged); inline `code` now runs via `evaluate({ script })`
    instead of `new Function` (JSON-serializable args only).
  - **Path B — new `generateAndRunCode`:** the non-deterministic generate → run →
    test → return capability. A model authors code, the sandbox runs and tests it,
    and the executed result is returned. Separate from `type: 'code'` so
    determinism is never blurred; string-only `generateCode()` is retained.
  - An optional `env` (host Workers env carrying `LOADER` + `TEST`) threads through
    `DefinedFunction.call(args, env?)` and `generateAndRunCode(def, args, env?)`;
    when absent, execution falls back to the Miniflare-backed Node runtime.

  `ai-functions` now depends on `ai-evaluate` (`workspace:^`). Both packages are in
  the fixed-version group, so this minor bump cascades across the group.

## 2.3.0

### Patch Changes

- c858725: Fix worker_loaders API to use getEntrypoint().fetch() instead of worker.fetch()

## 2.1.3

### Patch Changes

- Documentation and testing improvements

  - Add deterministic AI testing suite with self-validating patterns
  - Apply StoryBrand narrative to all package READMEs
  - Update TESTING.md with four principles of deterministic AI testing
  - Fix duplicate examples package name conflict

- Updated dependencies
  - ai-functions@2.1.3
  - ai-tests@2.1.3

## 2.1.1

### Patch Changes

- Updated dependencies [6beb531]
  - ai-functions@2.1.1
  - ai-tests@2.1.1

## 2.0.3

### Patch Changes

- Updated dependencies
  - rpc.do@0.2.0
  - ai-functions@2.0.3
  - ai-tests@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies
  - ai-functions@2.0.2
  - ai-tests@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies
  - ai-functions@2.0.1
  - ai-tests@2.0.1
