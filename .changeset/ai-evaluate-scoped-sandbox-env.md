---
'ai-evaluate': major
---

ai-evaluate: scope the sandbox env to RPC stubs and structured-cloneable values (aip-263g.6)

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
