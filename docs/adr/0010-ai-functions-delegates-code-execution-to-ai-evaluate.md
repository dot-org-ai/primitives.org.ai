# ai-functions delegates ALL dynamic code execution to ai-evaluate's sandbox

**Status:** accepted
**Date:** 2026-05-26

## Context

`ai-functions` executed dynamic code via `new Function(...)` in
`runInlineCode` (`function-registry.ts`). That path is **broken under
Cloudflare Workers** (no `Function`/`eval` constructor) and **unsandboxed under
Node** (full host access, no network/timeout controls). Meanwhile `ai-evaluate`
already provides a hardened V8-isolate sandbox built on Cloudflare Dynamic
Workers (worker_loaders), with a Miniflare fallback for Node/dev — exactly the
runtime guarantees the `new Function` path lacked.

Two distinct execution needs were being conflated under the word "code":

1. **Deterministic execution** — `type: 'code'` functions run the *same logic
   every time* with no model in the path (the contract Atlas/explore binds to
   per ADR-0033). A `handler` is a native function reference; an inline `code`
   body is supplied source.
2. **Code generation** — having a model *author* code, then running it. This is
   non-deterministic by nature.

Routing (1) through `new Function` also meant the deterministic path had no
sandbox, while (2) had no first-class "generate → run → test → return" capability
at all (`generateCode` returned source text only).

A blocking bug had to be fixed first: ai-evaluate passed the loaded-worker
binding under `bindings:`, but the Dynamic Workers loader-factory field is
`env:`. The loaded worker reads `env.TEST`, so the test path always returned
"TEST service binding not available." That fix ships in the same branch (commit
1) so the generate → run → **test** path actually works.

## Decision

`ai-functions` delegates **all** dynamic code execution to `ai-evaluate`'s
sandbox. `new Function` and `eval` are **banned** in the package.

Two clearly separated paths preserve the determinism boundary:

- **Path A — `type: 'code'` is deterministic, no model, ever.**
  - `handler: (input) => output` → direct call. No sandbox, no model. Unchanged.
  - inline `code: string` → runs in the sandbox via `evaluate({ script })`. Args
    are injected deterministically by JSON-serializing them into the script
    (`const args = JSON.parse(<json>); <body>`) — **JSON-serializable inputs
    only**; pass a `handler` for non-serializable inputs. Still deterministic;
    no model is consulted.
- **Path B — `generateAndRunCode` is the non-deterministic generate → run →
  test → return capability.** A model authors a module (and, by default, tests),
  the authored code is **run** in the sandbox, **tested** there, and the executed
  **result** is returned (not just source). This is deliberately a *separate*
  entry point from `type: 'code'` so determinism is never blurred. The string-only
  `generateCode()` variant is retained for callers that only want source.

### The env boundary

"Zero env plumbing" is **not** achievable. The Workers entry (`ai-evaluate`)
requires a `LOADER` binding (and `TEST` for the test path) passed via `env`, and
it imports `cloudflare:workers`, which is Node-incompatible and cannot be
imported eagerly in a Node process.

The clean boundary is therefore an **explicit, optional `env`**, threaded
through the execution surface:

- `DefinedFunction.call(args, env?)` and `generateAndRunCode(def, args, env?)`.
- When `env` carries a `LOADER` (and `TEST`), execution runs on the real
  Dynamic Workers loader via `ai-evaluate`.
- When absent (Node / dev / tests), a small `sandbox.ts` shim lazily imports
  `ai-evaluate/node`, which falls back to Miniflare and runs with no live
  Worker. The Node entry is only imported when no `env` is present, so a Node
  process never eagerly pulls in `cloudflare:workers`.

`ai-evaluate` is now a real (`workspace:^`) dependency of `ai-functions`.

## Consequences

- The deterministic-code contract (ADR-0033) is preserved and *strengthened*:
  inline `code` now runs sandboxed instead of via unsandboxed `new Function`,
  and is still verifiably model-free (a model spy asserts zero calls on Path A).
- Inline `code` is now async-and-sandboxed: it incurs sandbox spin-up cost and
  is limited to JSON-serializable args. `handler` remains the zero-overhead,
  full-fidelity deterministic form and is unaffected.
- `generate('code', …)` (the content primitive) keeps its string return for
  backward compatibility; the headline generate → run → test → return capability
  is the new, clearly-distinct `generateAndRunCode`.
- Pre-existing `test/evals/**` model-quality benchmarks that still call
  `define.code().call(...)` expecting model-authored *strings* remain
  red — they encode the pre-split behavior and are out of scope here; they
  should be migrated to `generateAndRunCode` / `generateCode` separately.
- Follow-up (optional): an ai-evaluate "Worker Loaders" → "Dynamic Workers"
  prose/comment sweep was skipped to avoid scope creep; the wrangler
  `worker_loaders` key is correct and unchanged.
