---
'ai-evaluate': minor
---

ai-evaluate: reject `outboundRpc` with `isolation: 'cached'` instead of silently loading one unique worker per call (aip-263g.40)

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
