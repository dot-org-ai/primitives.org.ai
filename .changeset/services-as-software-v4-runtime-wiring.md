---
'services-as-software': minor
---

aip-cnks.10: wire the v4 invocation runtime to real execution / verification / settlement (replacing the aip-cnks.5-deferred stubs).

- **Executor** — an ai-functions step-walker over the Deliverable's `binding.cascade`: Code→ai-evaluate sandbox (ADR-0010), Generative→`generateObject`, Agentic→`generateText`, Human→an injected port; dispatch via an injected `FunctionRunner` (`aiFunctionsRunner()` default), with `$ref` resolution, `outputAs` binding, and cost/progress events.
- **Verifier** — adapts v3 `EvaluatorPanel.run(output)` → `VerificationVerdict`.
- **Settler** — adapts business-as-code `FinanceProvider.charge/refund`; refuses a live $0 capture (`ZeroChargeError`).
- `Service().invoke()` now runs a declarative `binding.cascade` end-to-end (executor precedence: injected › cascade › `run` › stub).
- `resolve('resume')` re-drives the delivery tail; `attach()` is a clean injected `DurableStore` seam.

Port evolutions (within the v4 surface): `VerifyCtx` gains `output`; `Settler` charge/refund carry `Money`/`buyer`/`chargeId`; `Settlement` gains `chargeId`; `OrderOpts` gains `buyer`; `binding.cascade` is typed `CascadeStep[]`.
