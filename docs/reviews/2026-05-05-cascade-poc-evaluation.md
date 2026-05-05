# Cascade POC + Write-Probes Evaluation

**Date:** 2026-05-05
**Bead:** aip-xrcj
**Reviewer:** Claude (research-only; no canonical code touched)

**Locations evaluated:**

- `/Users/nathanclevenger/projects/startup-builder-experiments/experiments/2026-05-06-cascade-via-ai-database-poc/` (deployed at `cascade-via-ai-poc.dotdo.workers.dev`; e2e green)
- `/Users/nathanclevenger/projects/startup-builder-experiments/experiments/2026-05-05-cascade-data-driven-poc/`
- `/Users/nathanclevenger/projects/startup-builder-experiments/experiments/2026-05-05-cascade-substrate-write-probes/`
- `/Users/nathanclevenger/projects/startup-builder-experiments/cf-substrate/workers/tierA-cascade/` (D1 + Queues fan-out)
- `/Users/nathanclevenger/projects/startup-builder-experiments/cf-substrate/workers/tierA-cascade-pg/` (Hyperdrive variant)
- `/Users/nathanclevenger/projects/startup-builder-experiments/cf-substrate/workers/tierA-v2-cascade/` (DO + Pipelines + R2 SQL)

## Summary

The substrate-write-probes work is high-value, near-canonical input — the CTE write shape and Neon HTTP vs Hyperdrive verdict should land essentially verbatim into the canonical Postgres adapter. The `2026-05-06-cascade-via-ai-database-poc` is a useful **algorithmic** reference for `[->Type]` array expansion, content-hashed idempotency, embed-on-write, and rubric-based `$validate` gating, but its data model is the **pre-SVO `docs+rels`/four-operator shape** — not Things, Actions, Frame, or Action.roles. Cascade-implementation agents should treat the POC as a working prototype to study and *translate*, not as code to port wholesale; the write-probes verdicts should feed directly into the PG adapter and the cascade write-strategy bead. The cf-substrate `tierA-cascade*` workers are a different shape problem (queue fan-out + idempotency hash chains for synthetic 5-stage cascades) and only inform the lineage-key / parentKey discipline, not the cascade engine itself.

## What's reusable

### Substrate write-probes (high value — near-canonical)

- **`experiments/2026-05-05-cascade-substrate-write-probes/src/shapes.ts`** — five hand-written write shapes (`single`, `bulk`, `sequential`, `cte` (CTE jsonb_to_recordset / bulk-VALUES CTE), `prepared`) plus five read shapes against a real `docs+rels` schema. The CTE chain function is the directly-portable shape that should land in the Postgres `DBProvider` adapter for `aip-g1i9` cascade write paths.
- **`experiments/2026-05-05-cascade-substrate-write-probes/results/2026-05-05-phase1-verdict.md`** — the actual numbers and the decision:
  - **HTTP wins ~2× over Hyperdrive across every short-burst write shape.** Verbatim p50: single 24 ms, bulk-50 55 ms, bulk-500 142 ms, **CTE 500-docs+499-rels = 91 ms in one round-trip**, sequential-100 = 4,884 ms.
  - Hyperdrive's response cache only fires on parameterless queries (simple protocol). Once `$1` appears, postgres.js switches to extended protocol and Hyperdrive stops caching. **Load-bearing for `aip-g1i9`**: don't assume Hyperdrive is the default fast path.
  - Sublinear write scaling is ONLY achieved by the CTE shape (everything else is roughly linear in N).
  - 91 ms for 500 docs + 499 rels = **~5,500 startups/sec/worker** ceiling on the pg-write portion alone (LLM cost dominates, not pg).
- **`experiments/2026-05-06-cascade-via-ai-database-poc/src/pg.ts:commitBatch`** — production-shaped TS implementation of that CTE shape with `ON CONFLICT ... DO NOTHING` for idempotency. Directly translatable into the canonical PG adapter once the Things/Actions schema is in place (rename `docs/rels` → `things/actions`, swap `(ns, id, type, data)` for `(id, noun, data)`, swap `(ns, src, rel, dst, data)` for the Action shape with `verb/subject/object/roles/data`).

### POC algorithmic patterns (study, don't port)

- **`experiments/2026-05-06-cascade-via-ai-database-poc/src/array-expander.ts`** — non-trivial logic worth studying for the canonical cascade engine:
  - Topo walk of a parsed schema with sibling-parallel field expansion (`Promise.all` per array field) + sequential-per-item child generation so backrefs land cleanly. This is the right execution shape for cascade writes against a sharded provider.
  - One `generateObject` call yields N children for an array field (rather than N separate LLM calls). This is the closest thing in the POC to BatchProvider semantics.
  - Pre-derives stable child IDs *before* parent commit so grandchildren backrefs point at the right parent — the cascade-implementation agents should preserve this discipline.
  - `$validate` hook plumbed end-to-end with rejected-but-not-persisted children captured separately. The `verdict.passed=false` short-circuits the persist path.
- **`experiments/2026-05-06-cascade-via-ai-database-poc/src/worker.ts:makeValidator` + `normalizeValidate` + `applyPolicy`** — rubric-style LLM-as-judge gate with four verdict policies (`all-load-bearing-pass`, `all-pass`, `mean-ge-threshold`, `weighted-ge-threshold`). Each rubric criterion graded in **one** LLM call. This is a reasonable shape for the canonical `$validate` semantics — keep the abstraction (rubric + policy + threshold), but rebuild on top of the canonical model registry / generate() rather than direct `@ai-sdk/gateway`.
- **Content-hash idempotency** (`shortHash` FNV-1a in `pg.ts`, used by `deriveId` in `provider.ts`): same-input → same-id → `ON CONFLICT DO NOTHING` makes re-runs free. The canonical cascade should use this exact discipline.
- **Embed-on-write** (`provider.ts:create` calls `upsertEmbedding` synchronously before returning): every cascade-generated entity is searchable from creation, no separate backfill. Directly informs how the canonical `digital-objects-provider` should wire pgvector + the embedding model when Tier 4 is requested.
- **`embedTextFor`**: prefers human-readable string fields (`name`, `label`, `title`, `description`, `tagline`, `rationale`) over a blind JSON dump for embedding text. Small detail, real signal-quality win.

### Data-driven POC orchestration

- **`experiments/2026-05-05-cascade-data-driven-poc/src/workflow.ts:NamingBatchWorkflow`** — minimal Cloudflare Workflow with one `step.do` per (batch × phase) and `retries: { limit: 3, backoff: 'exponential', delay: '5 seconds' }`. Confirms step-granularity decision: durability checkpoints, NOT per-stage and NOT per-startup. Useful template for the canonical `DurableExecutionAdapter` (aip-fgq5).
- **Registry-as-data pattern** (`registry.ts`): PromptTemplate rows live in the same docs table as the data. Cleaner than a separate config/registry table; the canonical AIPromise / ModelPolicy work could pick this up.

### CF-substrate tierA-cascade* workers

- **`cf-substrate/workers/tierA-cascade/src/worker.ts`** — only the **lineage-key discipline** is reusable: every child carries its parent's full idempotency key (`parentKey`), not just an index. The bug they document — "parentIndex-only would silently dedup siblings" — is a real trap the canonical sharded-write design must avoid. Sibling children with identical local positions can collide on identity hash unless the parent's key is in the hash.
- The rest (5-stage queue fan-out across `cascade-{a..e}-q`, D1 vs Hyperdrive vs DO+Pipelines benchmark) is **substrate-comparison work**, not cascade engine. Doesn't directly inform the canonical engine; it's evidence that informed Stack B vs Stack A in ADR-0003.

## What's outdated relative to post-SVO design

The dominant outdated assumption: **the POC's data model is `docs/rels` jsonb tables — generic graph storage with type-as-jsonb-tag and arbitrary string `rel` names. It is NOT Things + Actions + Frame + Action.roles.**

Specifically:

- **Storage shape (`docs_rels.docs` and `docs_rels.rels`)** vs canonical **Things + Actions**. The POC's `rels` row is `(src, rel, dst, data)` — a flat string verb. Post-SVO design says relationships are Actions: `verb` + `subject` + `object` + structured `roles: Partial<Record<FrameRole, ThingRef|string>>`. The POC has nowhere to put `recipient`/`source`/`destination`/`instrument`/`topic`/`cause`/`manner` — they'd all collapse into `data` jsonb. **Cascade-implementation agents must rebuild rel-emission to produce Actions with proper Frame role assignment, not flat `(src, rel, dst)` triples.**
- **Four-operator schema syntax (`->`, `<-`, `~>`, `<~`)** vs **the canonical schema language** (the schema engine in `packages/ai-database/src/schema/cascade.ts` already exists). The POC re-implements its own array-expander and parseRefField regex; it does not call into ai-database's existing cascade engine. **The POC's schema is its own DSL, not ai-database's.** Anchoring on POC code instead of fixing the ai-database engine would fragment the cascade abstraction across two codebases.
- **No Verb registration.** The POC writes rel rows with bare strings (`'derives'`, the array field name like `'candidates'`, etc.). Canonical: every Verb is registered with conjugations + Frame; `relate()` calls should route through `defineVerb()` semantics. Today's POC produces `data → POOL grounding via field name as rel` strings that do not exist in any Verb registry.
- **No Action lifecycle.** Canonical `Action` carries `status` (`pending`/`active`/`completed`/`failed`/`cancelled`) and `completedAt`. The POC's rel rows have neither — they are written-once edges. The cascade engine needs to write a `pending` Action, run the LLM, then transition to `completed` (or `failed`). The POC's "best-effort embed; swallow errors" pattern in `provider.create` would lose the failure record entirely.
- **No Subject/Identity.** Cascade-generated entities have no Worker subject in the POC — there's no `subject` ThingRef on the generated rel rows. Canonical: the cascade run is initiated by *some* Worker (Person/Agent/System); every generated Action has that Worker as Subject. Audit / authorization can't be reconstructed from the POC's `rels` rows.
- **No ModelPolicy / model-choice escalation.** The POC hard-codes `anthropic/claude-haiku-4-5-20251001` in `worker.ts`. Canonical AIPromise + ModelPolicy should let the cascade choose a model per stage/criterion. The validator hard-codes Haiku for grading too — fine for a POC, wrong for a moat workload that may grade with Sonnet.
- **No BatchProvider.** The POC issues one `generateObject` per array field, parallelized at the sibling level via `Promise.all`. There's no concept of cross-cascade batching, no provider-level batch queue, no merging across simultaneous cascade runs. The aip-8yal epic explicitly calls for AIPromise + BatchProvider + ModelPolicy — none of those primitives exist in the POC code path.
- **Storage strategy mismatch.** The POC commits to **Stack A (Postgres + jsonb)** as the only adapter. ADR-0003 says Stack B (DO SQLite + R2 Iceberg + ClickHouse + Vectorize sidecar) is the **default for the moat workload**. The POC has not been built against DO SQLite at all; the `cf-substrate/workers/tierA-cascade*` workers explored DO/D1/Pipelines but did NOT exercise the cascade-via-schema pattern there. **Stack B's per-cascade DO isolation pattern is unproven by these experiments.** The POC's Stack A choice is fine for POC purposes but cannot be the canonical default.
- **Sharding is `unsharded` in the POC.** Single Neon DB, one `ns` namespace per deployment. ADR-0003 declares three sharding models on `DBProvider` — `per-cascade` (DO), `partitioned-by-tenant` (PG), `unsharded`. The POC implements only the third. **aip-g1i9 (cascade write strategy) cannot be derived from this POC's behavior alone** — it confirms unsharded works at small scale but says nothing about the per-cascade or per-tenant partition cases.
- **No dual-write to analytical store** (the aip-0ypt pattern). POC has zero Pipelines / Iceberg / ClickHouse path. All writes go to Neon Postgres only. The `tierA-v2-cascade` worker explored DO + Pipelines + R2 SQL but is unrelated to the cascade engine; it's substrate-only.
- **No telemetry beyond cascade_events table.** Canonical telemetry lives in `digital-objects-provider`'s Action records and the new `language-models` telemetry types. The POC's `cascade_events` table is a separate schema with its own columns — would be replaced by Action records carrying status transitions.

## What's POC-quality

- **Error handling**: `provider.create` swallows embedding errors silently (`} catch { /* swallow */ }`). The doc commits, the embedding does not, and there is no record. Production needs at least an error log + a backfill path for failed embeddings.
- **`update` is a no-op upsert** (`provider.ts:update` says "ON CONFLICT DO NOTHING means update-after-create is a no-op"). Real updates are explicitly deferred. Production cascade requires real updates (status transitions, validation results being attached after the fact).
- **`delete` and `unrelate` throw `not implemented`.** No soft-delete, no lifecycle.
- **No transactions.** `beginTransaction` is not implemented; the cascade relies on content-hashed idempotency for replay. This is fine for the cascade write path itself (CTE is atomic per round-trip) but means cross-call invariants (parent + children + rel rows must all commit) are not enforced — partial failures leak partial state.
- **`expandArrays`'s validator runs *after* generating the child but *before* expanding grandchildren is gated by parent's validation result.** Look at line ~487: `await createChild(…, childExpanded.data)` runs after the parent's own validate but child-of-child generation runs unconditionally. A failed validate at any level still has cost upstream.
- **Count extraction by regex** (`COUNT_PATTERNS` in `array-expander.ts`): "Generate exactly 5 …" → 5. Brittle. "Generate 3-5 …" → 3 (first int wins). Canonical generation should pass count as structured config, not parse English.
- **Hard-coded 50-item array bound** (`arraySchema` uses `min(count/2).max(count+2)`) — works for naming candidates, will fail on cascades that need larger or smaller fanouts.
- **No retry policy / circuit breaker.** Single `generateObject` call; one failure throws. Canonical resilience (RetryPolicy + CircuitBreaker + FallbackChain in `ai-functions`) is not wired.
- **No observability beyond per-batch wall time + counts.** No Action-level audit, no per-Verb metrics, no provider capabilities readout. The data-driven POC's `cascade_events` table is the closest thing — but it's an experiment-specific schema.
- **Idempotency is by content hash only.** No batch-version prefix; re-running with a non-deterministic LLM produces new IDs and double-inserts (Phase-2 verdict explicitly flags this — `temperature=0` and/or gateway response cache are required for correct re-run semantics, neither was actually enabled in the POC).
- **Hard dependency on Vercel AI Gateway.** Worker hard-codes `createGateway` from `@ai-sdk/gateway`. Phase-2 verdict already calls this out — Vercel cache is project-dashboard-only, not toggleable from code. They plan to migrate to CF AI Gateway + OpenRouter. Canonical cascade should depend on `language-models` provider abstraction, not a specific gateway.
- **One model registered per worker build.** `build(env)` in `worker.ts` constructs one Haiku model and one embedding model per request. No model failover, no policy escalation. Reasonable for POC; not for moat.

## Specific informs for canonical beads

### aip-8yal (Epic: cascade fully real)

- **Do not port the POC's `array-expander.ts` wholesale.** Its execution algorithm (sibling-parallel, sequential-per-item, pre-derived child IDs, validate-before-persist) is correct in shape — copy that shape into the canonical cascade engine, but as new code on top of `Things` + `Actions` + `Frame`, not on top of `docs/rels`. The existing `packages/ai-database/src/schema/cascade.ts` is the right place to land it.
- **Treat the POC's working e2e as a behavioral spec.** When the canonical cascade engine is wired, run the same FoundingHypothesis → NameCandidate × 5 → Brand fixture and compare entity counts, sample outputs, and wall time.
- **Adopt the rubric-style `$validate` shape (string OR `{ rubric, policy, threshold }`) directly.** It's a clean abstraction and the four verdict policies cover the realistic gating cases. Reimplement on top of canonical `generate()` / `language-models`, not `@ai-sdk/gateway` direct.
- **Adopt the embed-on-write discipline** in the canonical PG adapter when Tier 4 is requested by the deployment. Pre-derive child IDs, embed text built from preferred string fields, swallow-and-log on embed failure (not silent).
- **AIPromise + BatchProvider + ModelPolicy must be net-new.** None of the POC code exercises them. Don't anchor on POC's "one Haiku model per request" pattern.
- **Lineage-key discipline from `cf-substrate/tierA-cascade`**: when the canonical engine generates child Actions for an array field, the child's identity hash MUST include the parent's full idempotency key (the cf-substrate worker calls this `parentKey`), not just position. Sibling children at the same position across two cascade runs would otherwise collide.

### aip-g1i9 (Cascade write strategy: sharded parallel writes)

- **Phase-1 verdict is canonical input.** Land the CTE jsonb-bulk write shape and the Neon HTTP driver decision verbatim in the Postgres adapter. Do NOT re-bench. Numbers: bulk-VALUES-CTE-with-ON-CONFLICT-DO-NOTHING, 91 ms p50 for 500 docs + 499 rels in one round-trip on Neon HTTP, ~5,500 startups/sec/worker write ceiling, sublinear scaling above N=100.
- **Hyperdrive's parameterless-only cache is a concrete trap to document in the adapter README** so callers don't assume Hyperdrive accelerates parameterized cascade reads.
- **The probes only cover Stack A's `partitioned-by-tenant` storyline (and barely — it's actually `unsharded` in the POC).** The DO SQLite (`per-cascade`) story has NOT been benchmarked at the cascade level. The cf-substrate `tierA-cascade` D1 + Queues experiments are not directly comparable — they measured queue/D1 fan-out for synthetic 5-stage cascades, not LLM-driven cascade writes. **The aip-g1i9 design must include a separate DO SQLite write-probe.** ADR-0003's claim that Stack A's PG ceiling "gets blown by a single active cascade" is intuition, not benchmarked — but the 91ms-for-500-rows number suggests one PG can support many concurrent moderate-sized cascades. Worth re-examining the absolute "must use Stack B for cascade-heavy" claim with these probe numbers in hand.
- **Sibling-parallel sharding model**: the POC's parallel-`Promise.all` over array fields is single-DB; in the canonical sharded model, fan-out should write to whichever shard owns the cascade. Adopt the POC's parallelism shape, route writes through the shard-aware adapter.
- **Preserve content-hashed IDs** as the idempotency mechanism — the probes' `ON CONFLICT DO NOTHING` discipline only works because IDs are deterministic.

### aip-0ypt (Cascade dual-write pattern: DO SQLite + Pipelines → Iceberg)

- **The POC does NOT inform this bead.** Single-store (Neon PG only). No dual-write, no Pipelines, no Iceberg.
- **`cf-substrate/workers/tierA-v2-cascade`** is the closest related work — it exercises DO + Pipelines + R2 SQL — but is substrate-comparison rather than cascade-shape. Worth a separate read by whoever picks up aip-0ypt; this evaluation does not cover it in depth.
- **Net advice for aip-0ypt**: design from ADR-0003 + the canonical `digital-objects-provider`, not from these experiments.

## Recommendation

**Cascade-implementation agents should READ the `2026-05-06-cascade-via-ai-database-poc` source for behavioral reference and the `2026-05-05-cascade-substrate-write-probes/results/2026-05-05-phase1-verdict.md` for write-shape decisions, but should NOT port code from either.** The POC's working e2e is best treated as a regression-test fixture target — when the canonical cascade engine is wired against Things + Actions + Frame + Action.roles, expect to reproduce its FoundingHypothesis-cascade outputs (entity counts, sample names, validation verdicts) end-to-end at comparable wall time. For aip-g1i9, the write-probes verdicts are near-canonical and should land directly in the Postgres adapter; supplement with a missing DO-SQLite-cascade probe before declaring Stack B's per-cascade isolation a benchmarked default. For aip-0ypt, this body of work has nothing to contribute — design from scratch against ADR-0003.
