---
'ai-evaluate': major
---

ai-evaluate: Durable Object facets for per-sandbox persistent state; the REPL is a thin client over `evaluate()` (aip-263g.10)

New `EvaluateOptions.facet: { class, id?, binding? }` and `sandboxId`: the
named class of `module` runs as a SQLite-backed Durable Object facet owned by
the host worker's `SandboxHost` Durable Object for `sandboxId`, and the script
calls it as `env.<BINDING>` (`State` -> `env.STATE`). Facet storage survives
across evaluations and isolates, and is isolated per `sandboxId`. A plain
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
