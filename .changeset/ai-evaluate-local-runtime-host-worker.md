---
'ai-evaluate': major
---

ai-evaluate: local runtime is one Miniflare 5 host worker with a real LOADER binding (same `evaluate()` bytes as prod)

**Breaking:** `ai-evaluate/node` now requires `miniflare@^5.20260907.0-alpha` (Node >= 22) and `esbuild`.
The Miniflare 3 per-call instance and the separate dev worker template are gone.

- `ai-evaluate/node` bundles `src/host-worker.ts` (which imports `evaluate()` from
  `src/evaluate.ts`) and runs it inside a Miniflare 5 host worker whose `env.LOADER`
  is a `worker-loader` binding. Local and production execute the same code path.
- New: `createLocalRuntime()` -> `{ evaluate, dispose }`, process-wide `dispose()`,
  `bundleHostWorker()`. One host per process, lazily created, reused across calls
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
- `miniflare-pool.ts` is ported to Miniflare 5 via `convertV4MiniflareOptions`
  pending its removal.
