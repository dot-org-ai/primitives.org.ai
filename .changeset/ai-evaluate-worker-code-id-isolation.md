---
'ai-evaluate': minor
---

ai-evaluate: content-address the full `WorkerCode` spec; `isolation: 'cached' | 'fresh'`

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
