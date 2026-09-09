---
'ai-evaluate': minor
---

ai-evaluate: pass through `limits`, `tails`, `compatibilityFlags` and `compatibilityDate`; wire `validateOptions` and `assertEvaluateResult` into `evaluate()` (aip-263g.5)

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
