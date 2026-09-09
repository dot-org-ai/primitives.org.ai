---
'ai-evaluate': major
---

ai-evaluate: remove `miniflare-pool` and per-call Miniflare instantiation

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
