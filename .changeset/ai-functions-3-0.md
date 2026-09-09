---
'ai-functions': minor
---

ai-functions: `runInSandbox` follows ai-evaluate 3.0 - `env.loader` only, Node >= 22 for the Node fallback (aip-263g.12)

Release decision (aip-263g.12, integrator): only `ai-evaluate` takes the 3.0.0
major; it leaves the fixed changeset group so the other 17 packages are not
cascaded to a new major. `ai-functions` therefore ships this under a minor,
but the first two items below change behaviour for callers that used the
`LOADER` / `TEST` aliases or ran the Node fallback on Node < 22 - read them
as breaking for those callers.

- **Breaking:** `runInSandbox(options, env)` - and so `DefinedFunction.call`
  and `generateAndRunCode` with an `env` - switches on `env.loader` only; the
  uppercase `LOADER` / `TEST` aliases ai-evaluate 2.x accepted are gone, and
  an env carrying only `LOADER` takes the Node fallback instead of the
  Dynamic Workers loader. Rename the wrangler binding to `loader`.
- **Breaking:** the Node fallback runs on `ai-evaluate/node`'s Miniflare 5
  host, which requires **Node >= 22** (Miniflare 5 is skipped at install time
  on older Node; the first sandboxed call then fails with
  `MINIFLARE_UNAVAILABLE_ERROR`). Every package that depends on
  `ai-functions` inherits that floor on Node.
- The Node fallback now holds its own `createLocalRuntime()` handle rather
  than the process-wide host: `disposeSandbox()` tears down only the host
  ai-functions created, and the next sandboxed call starts a fresh one. A
  process still exits on its own without calling it (an idle host is unref'd).
