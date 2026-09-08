---
'ai-evaluate': patch
---

ai-evaluate: CPU-bound loops - `limits.cpuMs` bound to `timeout`, hardened local host recovery (aip-263g.14)

- `evaluate()` now passes `limits: { cpuMs: timeout }` to the loaded worker's
  entrypoint. `AbortSignal.timeout` is never observed by a loop that does not
  yield; on Cloudflare the CPU limit ends it instead. Per-entrypoint limits do
  not change the content-addressed isolate id, so cached isolates are unaffected.
- `ai-evaluate/node`: evaluations caught in flight when a CPU-bound loop wedges
  the local host now fail with the exported `WEDGED_HOST_ERROR` (retryable)
  instead of a bare transport error; evaluations in flight during `dispose()`
  fail with `DISPOSED_HOST_ERROR`. Only the host that wedged is retired, even
  when several loops hit the backstop together; host startup never counts
  against `timeout`.
- Documented the limitation: open-source workerd accepts `limits.cpuMs` but does
  not enforce it and is single-threaded, so locally the Node backstop
  (`timeout + 250ms`, then SIGKILL and a fresh host on the next call) is the
  contract. Calling `evaluate()` directly inside a local workerd (vitest-pool-
  workers) has no backstop.
- The three "infinite loop" security tests are un-skipped against that contract.
