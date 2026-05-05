# Cascade + Storage + Durable Execution: Implementation Plan

**Date:** 2026-05-05
**Status:** Approved
**Related:** [ADR-0003](../adr/0003-storage-strategy-pg-clickhouse-default.md), [ADR-0004](../adr/0004-durable-execution-cf-workflows-default.md), [CONTEXT.md](../../CONTEXT.md), [SVO co-design plan](./2026-05-05-svo-co-design.md)

## Summary

Implement the storage and durable-execution architecture decided in ADRs 0003 and 0004, culminating in the cascade-generation moat work that makes `ai-database` unique. The architecture has three layers landing in sequence:

1. **Ports** (`DBProvider`, `DurableExecutionAdapter`) — the seams. Define once; then everything else builds on them.
2. **Adapters** — concrete implementations satisfying the ports. Stack A (PG + pgvector + CH) and Stack B (DO SQLite + CF Pipelines → Iceberg + CH).
3. **Cascade** — the moat. Replaces placeholder generation with real LLM-driven cascade. Uses both ports.

Total scope: ~7 new beads + ~10 existing beads, organized into four phases. Phases 0+1 are largely parallel; Phase 2 (cascade) is partially sequential; Phase 3 (migration/docs) is parallel.

## Goals

- `DBProvider` port in `ai-database` with Tier 1+2 universal capabilities (entity CRUD, rels) plus declared Tier 3 (analytics) and Tier 4 (vector search).
- `DurableExecutionAdapter` port at `ai-workflows/durable-execution` subpath export, with three adapters (in-process, Cloudflare Workflows, Vercel WDK).
- Stack A working end-to-end: PG + pgvector + ClickHouse.
- Stack B working end-to-end: DO SQLite + Pipelines → Iceberg + ClickHouse, with Vectorize sidecar for vectors.
- Cascade generation fully real: replaces `PlaceholderValueGenerator` with LLM-driven generation using AIPromise + BatchProvider + ModelPolicy. Supports sharded parallel writes for cascade-scale throughput.
- Cascade dual-write pattern in Stack B (DO SQLite for transactional + Pipelines→Iceberg for analytical fan-out).
- `ai-experiments`' existing `chdb` usage migrates to the new ClickHouse adapter (DRY).
- Per-Stack getting-started docs and Wrangler binding documentation.

## Non-Goals (explicitly deferred)

- **libSQL/Turso adapter** (Stack C). Node-only; revisit when there's a justifying user (`aip-ho3i`).
- **R2 SQL as primary analytical layer.** Tracked as ad-hoc complement to Iceberg SOR; full re-evaluation when joins/windows land (`aip-dowa`).
- **Stack D hybrid** (DO SQLite + PG + CH). Only when neither Stack A nor B fits (`aip-riu9`).
- **Vercel WDK adapter** for `DurableExecutionAdapter`. Deferred until there's a Vercel-hosted or self-hosted user requesting it; port shape is designed to accommodate it.
- **Investigation: port WDK syntax to CF backend** (`'use workflow'`/`'use step'` directives over CF Workflows). Design idea, not in scope.
- **R2 vector search.** Out of scope per ADR-0003 (experimental).
- **`@dotdo/rdb` integration changes.** Stays as the bridge for external users (per ADR-0001); not the recommended internal path.

## Phases

### Phase 0 — Port definitions (parallel-safe)

Foundations. Two new beads. No internal dependencies.

| Bead | What | Package |
|---|---|---|
| `aip-???-A` (NEW) | `DBProvider` port: SVO-shaped Tier 1+2 interface; capability declarations for Tier 3/4 and sharding model | `ai-database` |
| `aip-???-B` (NEW) | `DurableExecutionAdapter` port at `ai-workflows/durable-execution` subpath export | `ai-workflows` |

**Acceptance:** Port interfaces compile, exported, with TSDoc explaining the contract. No adapters yet. In-memory test stubs for both, satisfying the interface, used to validate the port shape.

### Phase 1 — Adapters (parallel-safe by package)

Concrete implementations of the ports.

| Bead | What | Package | Phase 0 dep |
|---|---|---|---|
| `aip-peb5` (existing) | DBProvider adapters: **PG+pgvector** (Stack A transactional) + **ClickHouse** (Stack A+B analytical) | `ai-database` | A |
| `aip-55u8` (existing) | DBProvider adapter: **DO SQLite** (Stack B transactional) | `ai-database` | A |
| `aip-???-C` (NEW) | DBProvider adapter: **in-memory** for tests | `ai-database` | A |
| `aip-j3il` (existing) | Capability tier declaration on DBProvider (Tier 3 analytics opt-in; sharding model) | `ai-database` | A |
| `aip-kh9l` (existing) | Vector search Tier 4 (pgvector + CH vector + Vectorize sidecar) | `ai-database` | A |
| `aip-???-D` (NEW) | DurableExecutionAdapter: **in-process** (wraps existing WorkflowRuntime from `1e5ff39`) | `ai-workflows` | B |
| `aip-i456` (existing) | DurableExecutionAdapter: **Cloudflare Workflows** | `ai-workflows` | B |

**Acceptance per adapter:** Implements the full port contract. Has integration tests (against real or in-process backend). Documented in package README.

### Phase 2 — Cascade (sequential within phase)

The moat work. Sequential because each step builds on the previous.

| Bead | What | Depends on |
|---|---|---|
| `aip-g1i9` (existing) | Cascade write strategy: sharded parallel writes (per-cascade DO in Stack B; partitioned schema in Stack A) | Phase 1 DBProvider adapters |
| `aip-8yal` (existing) | **Epic: cascade fully real** — replace `PlaceholderValueGenerator` with AIPromise + BatchProvider + ModelPolicy LLM-driven generation | `aip-g1i9`, Phase 1 DurableExecutionAdapter in-process |
| `aip-0ypt` (existing) | Cascade dual-write pattern: DO SQLite (transactional) + Pipelines → Iceberg (analytical fan-out) | `aip-8yal`, DO SQLite adapter |

**Acceptance:** A cascade can generate a real entity tree (e.g., Customer + Orders + OrderItems with rels) using real LLM calls, run reliably under thousands of writes, persist to either Stack A or Stack B, and survive process crashes via the durable execution backend.

### Phase 3 — Migration & polish (parallel-safe)

Absorb existing usage; document.

| Bead | What |
|---|---|
| `aip-???-E` (NEW) | Migrate `ai-experiments` `chdb` usage to canonical ClickHouse adapter (DRY) |
| `aip-???-F` (NEW) | Stack A getting-started doc (PG+pgvector+CH wiring + Wrangler bindings) |
| `aip-???-G` (NEW) | Stack B getting-started doc (DO SQLite + Pipelines → Iceberg + CH + Vectorize bindings) |

**Acceptance:** Existing tests still pass; new users can wire either Stack from a getting-started doc in <30 min.

## Implementation order

```
Phase 0  ─┬─ aip-???-A (DBProvider port)
          └─ aip-???-B (DurableExecutionAdapter port)
                                ↓
Phase 1  ─┬─ DBProvider adapters: aip-peb5, aip-55u8, aip-???-C, aip-j3il, aip-kh9l
          └─ DurableExecution adapters: aip-???-D, aip-i456
                                ↓
Phase 2  ── aip-g1i9 → aip-8yal → aip-0ypt   (sequential)
                                ↓
Phase 3  ─┬─ aip-???-E (chdb migration)
          ├─ aip-???-F (Stack A docs)
          └─ aip-???-G (Stack B docs)
```

## Risks & mitigations

1. **CF Workflows beta surface changes** during implementation. Mitigation: pin versions, track [changelog](https://developers.cloudflare.com/changelog/).
2. **Pipelines → Iceberg latency** unknown at scale. Mitigation: measure during Stack B implementation; if too slow, fall back to direct CH ingestion (CH stays in Stack B regardless).
3. **DO SQLite per-cascade isolation** may need workaround if Worker→DO routing has surprises at scale. Mitigation: design the sharding model (`aip-g1i9`) to support multiple sharding strategies, not lock to per-cascade DO.
4. **Vector search dimensionality** across pgvector / CH / Vectorize may not be uniform. Mitigation: capability declaration (`aip-kh9l`) includes max dimension and similarity-metric support.
5. **`PlaceholderValueGenerator` to real LLM substitution** changes test behavior. Mitigation: keep the placeholder available for tests; make real generation opt-in initially via config; gradually flip default once confidence is built.

## Open questions

- **Cascade-emitted Action records**: do they go through the same DBProvider write path as Things, or a separate fast path? (Likely same path; declares its own tier.)
- **Sharding model granularity**: per-cascade DO is nice but may be too fine for some workloads. Per-tenant DO with multi-cascade sharing is the alternative. The sharding declaration on DBProvider should leave this configurable.
- **Cross-stack migration**: a user starts on Stack A, hits cascade ceiling, wants to migrate to Stack B. Is there a documented path? (Likely Phase 3 doc, not a bead in itself.)

## How the implementation loop runs

1. Beads list is the source of truth. `bd ready` surfaces what's unblocked.
2. Each bead has the design doc to reference. ADR-0003 / ADR-0004 are load-bearing.
3. Subagents execute one bead at a time; coordinator launches them in parallel where the dependency graph allows.
4. Pattern from prior waves (per ADR-0001/0002): premise validation first, escalate if reality doesn't match. Subagents have learned this discipline.
5. Loop completes when Phase 3 closes; remaining deferred beads (Stacks C/D, R2 SQL, WDK adapter, etc.) are explicitly out of scope and remain open as backlog.
