# Storage strategy: transactional/analytical split; cascade generation is the moat

**Status:** accepted
**Date:** 2026-05-05

## Context

`ai-database` needs a storage strategy with first-class adapters. Four candidates and a key insight:

- **DO SQLite** — Cloudflare Durable Objects with SQLite. Native to Workers. Excellent for **transactional** workloads with **per-tenant** isolation; scales by database count, not by size (per-DO limit ~10GB). Hard to query *across* databases — which is exactly the analytics gap.
- **R2 SQL** — Cloudflare R2 with SQL. Native to Workers. Earlier versions were hard-stops for our analytics needs; current generation is significantly improved but unproven for our workloads.
- **Postgres via Hyperdrive** — Cloudflare's pg connection pooler binding (Workers); standard pg client (Node). Transactional. Runtime-portable.
- **ClickHouse** — column-store for analytics, events, experiments, large generation logs. HTTP fetch. Runtime-portable.

History: DO SQLite was built first as the canonical Workers-native storage. Hit limits on **analytical** workloads (row-store + per-DO scale + cross-database query difficulty). Pivoted to ClickHouse for events/analytics/experiments. R2 SQL was evaluated and found insufficient at the time.

**Key insight:** the meaningful split is **transactional vs analytical**, not adapter-by-adapter. Every adapter does entity CRUD and basic rels (Tier 1+2 are universal). Adapters differ in whether they handle **analytics at scale** (Tier 3). Bridging transactional and analytical is its own concern (CDC / replication / pipelines).

## Decision

### Tier model

The `DBProvider` port serves all four adapters with declared capabilities:

- **Tier 1 — entity CRUD**: define/get/list/search/update/delete Things; record Actions. **Universal**.
- **Tier 2 — relational queries**: graph traversal across Action subject/object/recipient, joins, filters. **Universal** (every adapter supports it; efficiency varies).
- **Tier 3 — analytics**: aggregations, time-series rollups, large-scale event scans. **Declared** — adapters say whether they support this efficiently. CH yes; PG with care; DO SQLite weak; R2 SQL TBD.
- **Tier 4 — vector search**: embedding-similarity queries. **Declared and integration-shaped**. PG has `pgvector` natively; CH has vector functions; DO SQLite has no native vector support and requires **Vectorize as a sidecar** (per-deployment bindings, can't be dynamically provisioned the way DO SQLite databases can); R2 vector search is speculative/experimental and explicitly out of scope.

### Two canonical stacks on the same port

**Stack A (portable, default for broader adoption):** Postgres (transactional + native pgvector) + ClickHouse (analytical + native vector functions). Both run on Workers (PG via Hyperdrive, CH via HTTP) or on Node. Bridge: Debezium-style replication or app-layer fan-out. **Vector search clean, no sidecar.** This is the recommended default for users who want portability.

**Stack B (Cloudflare-native):** DO SQLite (transactional, per-tenant, scales by database count) + ClickHouse (analytical) + **Vectorize sidecar** when vector search is needed. Bridge: Pipelines → R2 → S3 Queue → CH ingest. Vectorize introduces operational coupling — bindings must be provisioned per deployment, indexes can't be dynamically created the way DO SQLite databases can. R2 SQL becomes the alternative analytical layer once proven for our workloads.

Both stacks satisfy the same `DBProvider` port. Callers pick based on runtime constraints and existing infrastructure.

### Cascade generation is the moat

The unique value of `ai-database` is **cascading AI generations** — not the storage adapters, which are infrastructure. The cascade generator sits *above* `DBProvider`: it produces SVO data (Things, Actions) that lands in whichever adapter is configured. Cascade is what gets the AIPromise / BatchProvider / ModelPolicy treatment. Architectural attention should concentrate on cascade quality, not on storage breadth.

Storage adapter work is necessary infrastructure. Cascade generation work is the differentiator.

## Why not "Cloudflare-only"

Locks the audience to Workers. PG+CH is widely adopted; supporting it expands addressable users substantially. The value-prop is **AI primitives + SVO ontology + cascade generation**, not Cloudflare lock-in.

## Why not "external only" (rely on `@dotdo/rdb`)

`@dotdo/rdb` (separate repo, see ADR-0001) bridges to a unified RDB-style abstraction. Its role narrows: it remains the path for **external/user-managed** deployments (bring-your-own-database SaaS scenarios). For canonical first-party use within this monorepo, PG+CH first-class adapters give callers direct access.

## Consequences

- The `DBProvider` port becomes a real seam (four real adapters → strong real seam, per LANGUAGE.md).
- Adapters declare their analytics tier; callers consult capabilities. Tier 1 and 2 are not declared — they're expected.
- Bridging transactional → analytical is a separate concern. Pipeline implementations (Debezium for PG→CH; Pipelines→R2→CH for DO SQLite→CH) are infrastructure-level and don't need to live in `ai-database` itself; they're configured by deployment.
- Wrangler config (Hyperdrive bindings, R2 bindings, DO SQLite bindings) is documented. Each adapter declares its required bindings; callers wire them.
- `ai-experiments`' existing `chdb` (ClickHouse) usage is absorbed into the canonical CH adapter rather than living standalone.
- `rdb-provider-adapter.ts` stays (per ADR-0001) but is no longer the recommended internal path — only the bridge for external / `@dotdo/rdb` users.
- DO SQLite stays first-class but is positioned for **per-tenant hot transactional data**, not as a universal default. Its analytics weakness and 10GB-per-database limit are documented so future architecture reviews don't re-suggest it for cross-tenant analytical queries.
- R2 SQL is held back from initial implementation. PG + CH (Stack A) and DO SQLite + CH (Stack B) cover the canonical needs. Adding R2 SQL speculatively before it's proven creates surface that must be maintained for unclear payoff.
- **R2 vector search is explicitly out of scope.** Multiple internal experiments have validated it works and scales, but it's not a canonical Cloudflare primitive yet. `ai-database` should not pull experimental providers; revisit when R2 vector lands as a stable Cloudflare offering.
- **Vector search tilts the default toward Stack A.** pgvector is mature, no sidecar, works on Workers via Hyperdrive and on Node directly. Stack B requires Vectorize coupling when similarity search is needed — acceptable for callers who specifically want per-tenant DO SQLite isolation, but a real operational cost.
- **Cascade generation is the architectural priority** — improving it pays back across all storage adapters and all callers.

## Follow-up beads

- Epic: First-class DBProvider adapters for Postgres + ClickHouse (Stack A)
- DO SQLite first-class adapter (Stack B transactional)
- R2 SQL adapter re-evaluation (Stack B alternative analytics; held back)
- Capability-tier declaration on DBProvider (Tier 3 analytics opt-in)
- Pipeline / replication patterns (separate concern; documented but not implemented in `ai-database`)
- **Epic: Make cascade generation fully real** — the moat
