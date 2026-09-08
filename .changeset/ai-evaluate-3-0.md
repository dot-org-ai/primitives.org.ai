---
'ai-evaluate': major
---

ai-evaluate 3.0: Cloudflare Dynamic Workers native - one code path local and production (aip-263g)

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
  `changeset version`, and witnessed by `test/static.test.ts`.
- The runtime export list of `ai-evaluate` is documented under "Exports" in
  the README and pinned by `test/index.test.ts`.

**Versioning:** `ai-evaluate` stays in the fixed changeset group, so the whole
group goes to 3.0.0. The major is real for the group: `ai-functions` routes
all dynamic code execution through `ai-evaluate`, and its Node fallback now
needs Miniflare 5 - Node >= 22 - which every dependent inherits (see the
`ai-functions` changeset and MIGRATION.md "Versioning").
