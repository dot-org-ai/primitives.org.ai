# Storage strategy: transactional/analytical split; cascade generation is the moat

**Status:** accepted
**Date:** 2026-05-05

## Context

`ai-database` needs a storage strategy with first-class adapters. Five candidates and a key insight:

- **DO SQLite** — Cloudflare Durable Objects with SQLite. Native to Workers. Excellent for **transactional** workloads with **per-tenant** isolation; scales by database count, not by size (per-DO limit ~10GB). Hard to query *across* databases. No native vector support (requires Vectorize sidecar).
- **R2 SQL** — Cloudflare R2 with SQL. Native to Workers. Earlier versions were hard-stops; current generation improved but unproven for our workloads.
- **Postgres via Hyperdrive** — Cloudflare's pg connection pooler binding (Workers); standard pg client (Node). Transactional. Runtime-portable. Native vectors via pgvector.
- **ClickHouse** — column-store for analytics, events, experiments, large generation logs. HTTP fetch. Runtime-portable.
- **libSQL / Turso** — SQLite-derivative with **native vector embeddings**. Embeddable (no network round-trips when embedded). **Does not run in Cloudflare Workers** (Node-only or Turso managed service). Per-cascade insert throughput should match DO SQLite (both SQLite-derived); sharding pattern is process-level (one libSQL DB per cascade in-process), not per-actor.

History: DO SQLite was built first as the canonical Workers-native storage. Hit limits on **analytical** workloads (row-store + per-DO scale + cross-database query difficulty). Pivoted to ClickHouse for events/analytics/experiments. R2 SQL was evaluated and found insufficient at the time.

**Key insight:** the meaningful split is **transactional vs analytical**, not adapter-by-adapter. Every adapter does entity CRUD and basic rels (Tier 1+2 are universal). Adapters differ in whether they handle **analytics at scale** (Tier 3). Bridging transactional and analytical is its own concern (CDC / replication / pipelines).

## Decision

### Tier model

The `DBProvider` port serves all four adapters with declared capabilities:

- **Tier 1 — entity CRUD**: define/get/list/search/update/delete Things; record Actions. **Universal**.
- **Tier 2 — relational queries**: graph traversal across Action subject/object/recipient, joins, filters. **Universal** (every adapter supports it; efficiency varies).
- **Tier 3 — analytics**: aggregations, time-series rollups, large-scale event scans. **Declared** — adapters say whether they support this efficiently. CH yes; PG with care; DO SQLite weak; R2 SQL TBD.
- **Tier 4 — vector search**: embedding-similarity queries. **Declared and integration-shaped**. PG has `pgvector` natively; CH has vector functions; DO SQLite has no native vector support and requires **Vectorize as a sidecar** (per-deployment bindings, can't be dynamically provisioned the way DO SQLite databases can); R2 vector search is speculative/experimental and explicitly out of scope.

### Two canonical stacks on the same port — workload-driven choice

**Stack B (cascade-heavy default — Cloudflare-native):** DO SQLite (transactional, per-cascade isolation, scales horizontally by database count) + **R2 Iceberg** (durable analytical ground truth via Cloudflare Pipelines) + ClickHouse (hot OLAP — joins, windows, sessionization) + **Vectorize sidecar** when vector search is needed. **This is the default for the moat workload — cascading AI generations.**

A single cascade can produce thousands of writes (entity + rels + sub-entities + sub-rels). Per-cascade DO isolation gives parallel write paths each at full single-DO throughput. PG's centralized-write model hits its ceiling (few-thousand inserts/sec) within one active cascade.

**Bridge:** No native CDC from DO SQLite to Pipelines exists. Cascade code **dual-writes** — to DO SQLite (transactional, traversal-readable) AND to Pipelines via the Worker Stream binding (analytical fan-out, exactly-once into Iceberg). Single source-of-truth split: DO SQLite owns the cascade's *local* state; Iceberg owns the *cross-cascade* durable record.

**Why Iceberg as ground truth rather than ClickHouse direct:** R2 Data Catalog (open beta) exposes a standard Iceberg REST interface. Multiple engines query the same data: R2 SQL for ad-hoc CF-native (still beta, no joins/windows yet — grows into the workload over time); ClickHouse for hot OLAP that R2 SQL can't handle today; DuckDB / Spark / Snowflake for any Iceberg-aware client. Vendor-neutral durability; CH becomes a materialized hot tier rebuildable from Iceberg, not the system of record.

Vectorize binding is the operational cost for similarity search.

**Stack A (moderate-scale or non-cascade default — portable):** Postgres (transactional + native pgvector) + ClickHouse (analytical + native vector functions). Both run on Workers (PG via Hyperdrive, CH via HTTP) or on Node. Bridge: Debezium-style replication or app-layer fan-out. **Vector search clean, no sidecar.** Right choice for general-purpose AI primitive use, smaller cascades, broader adoption, simpler ops, or callers who specifically don't want Cloudflare lock-in. Hits the write ceiling on cascade-heavy workloads.

**Stack C (SQLite-shape + native vectors — Node-only):** libSQL/Turso (transactional + native vector embeddings + embeddable) + ClickHouse (analytical). SQLite-shape simplicity, native vectors without a sidecar. **Does not run on Cloudflare Workers** — Node-only callers (or Turso managed service). Sweet spot for non-Workers deployments that want SQLite shape with vectors and don't need PG features. Cascade throughput needs validation against DO SQLite; sharding pattern is process-level rather than per-actor.

**Stack D (hybrid — DO SQLite + PG):** DO SQLite for cascade-heavy transactional writes (with Vectorize sidecar for vectors) + Postgres for primary relational data (with pgvector) + ClickHouse for analytics. Two transactional layers: DO handles the high-volume cascade workload; PG handles user-facing relational queries that benefit from joins/transactions/cross-tenant queries. Bridge: app-layer or Pipelines fan-out from DO into PG and CH. Heavier ops (three storage systems instead of two) but addresses both cascade-throughput and traditional relational needs. Worth considering when neither pure Stack B nor pure Stack A fits the deployment.

**Storage choice = workload characteristics, not preference.** Callers running heavy cascade generation pick Stack B; callers running general AI primitives at moderate scale pick Stack A. The same `DBProvider` port serves both.

Both stacks satisfy the same `DBProvider` port. Callers pick based on runtime constraints and existing infrastructure.

### Cascade generation is the moat — and dictates the storage shape

The unique value of `ai-database` is **cascading AI generations** — not the storage adapters, which are infrastructure. The cascade generator sits *above* `DBProvider`: it produces SVO data (Things, Actions) that lands in whichever adapter is configured.

The cascade workload is **write-heavy with read-back-during-traversal**. A single cascade traverses generated relations to inform subsequent generations — meaning point reads against just-written data are on the hot path. CH handles bulk insert but not these reads. PG handles them but only up to its centralized-write ceiling. DO SQLite handles both natively at per-database scale, with horizontal sharding via the per-cascade DO isolation pattern.

This means the **cascade generator must be designed for sharded parallel writes from day one**. It should:

- Write through a partition-aware adapter (one DO per cascade in Stack B; one PG schema or partition per cascade in Stack A's heavy use)
- Read back through the same shard for traversal — no cross-shard reads on the hot path
- Emit to CH for cross-cascade analytics asynchronously (Pipelines or app-layer fan-out)

The `DBProvider` port exposes **shard-awareness** as part of its surface: adapters declare their sharding model (`per-cascade` for DO SQLite; `partitioned-by-tenant` for PG; `unsharded` for callers who don't need scale).

Storage adapter work is necessary infrastructure. Cascade generation work — including the sharded-writes architecture that makes the moat workload viable — is the differentiator.

## Why not "Cloudflare-only"

Locks the audience to Workers. PG+CH is widely adopted; supporting it expands addressable users substantially. The value-prop is **AI primitives + SVO ontology + cascade generation**, not Cloudflare lock-in.

## Why not "external only" (rely on `@dotdo/rdb`)

`@dotdo/rdb` (separate repo, see ADR-0001) bridges to a unified RDB-style abstraction. Its role narrows: it remains the path for **external/user-managed** deployments (bring-your-own-database SaaS scenarios). For canonical first-party use within this monorepo, PG+CH first-class adapters give callers direct access.

## Consequences

- The `DBProvider` port becomes a real seam (four real adapters → strong real seam, per LANGUAGE.md).
- Adapters declare their analytics tier; callers consult capabilities. Tier 1 and 2 are not declared — they're expected.
- Bridging transactional → analytical is a separate concern. Pipeline implementations (Debezium for PG→CH; Cloudflare Pipelines → Iceberg → CH/R2 SQL/DuckDB for DO SQLite path) are infrastructure-level and don't need to live in `ai-database` itself; they're configured by deployment.
- **Cascade code dual-writes in Stack B**: to DO SQLite (transactional + traversal) AND to Pipelines (analytical fan-out into Iceberg). No native CDC from DO SQLite exists today. The cascade generator's sharded-writes adapter must accept this dual-write pattern as part of its contract.
- **Iceberg's ACID + schema evolution + compaction** make it a meaningfully better analytical SOR than direct CH ingestion: vendor-neutral, durable, queryable by any Iceberg client. CH-only architectures lose this; the Iceberg layer recovers it for negligible additional ops cost (Pipelines is managed).
- Wrangler config (Hyperdrive bindings, R2 bindings, DO SQLite bindings) is documented. Each adapter declares its required bindings; callers wire them.
- `ai-experiments`' existing `chdb` (ClickHouse) usage is absorbed into the canonical CH adapter rather than living standalone.
- `rdb-provider-adapter.ts` stays (per ADR-0001) but is no longer the recommended internal path — only the bridge for external / `@dotdo/rdb` users.
- DO SQLite stays first-class but is positioned for **per-tenant hot transactional data**, not as a universal default. Its analytics weakness and 10GB-per-database limit are documented so future architecture reviews don't re-suggest it for cross-tenant analytical queries.
- **R2 SQL is no longer held back categorically — it's a complement, not a replacement.** As of May 2026, R2 SQL has aggregations, ~190 functions, JSON support, single-table CTEs, struct/array/map access. Hard blockers for the canonical analytical workload remain (no joins, no window functions, no UNION, no subqueries, single-table queries only) — meaning R2 SQL alone cannot serve cross-cascade time-series or sessionization. **Solution:** Iceberg in R2 Data Catalog is the durable analytical ground truth; R2 SQL handles ad-hoc single-table queries against it; ClickHouse handles joins/windows/hot OLAP that R2 SQL can't yet. R2 SQL grows into more of the workload as it adds joins/windows post-beta.
- **R2 vector search is explicitly out of scope.** Multiple internal experiments have validated it works and scales, but it's not a canonical Cloudflare primitive yet. `ai-database` should not pull experimental providers; revisit when R2 vector lands as a stable Cloudflare offering.
- **Vector search adds a Vectorize sidecar cost to Stack B** (DO SQLite has no native vectors). Stack A has pgvector clean. This is a real operational cost for cascade-heavy users but acceptable given the cascade-throughput value Stack B delivers — Vectorize is a one-time per-deployment binding, not a per-cascade concern.
- **Cascade write throughput dictates the stack choice, not portability.** Stack A's PG ceiling at ~few-thousand inserts/sec gets blown by a single active cascade. Stack B's DO SQLite per-cascade isolation is what makes the moat workload viable. Callers running heavy cascade generation must pick Stack B regardless of their portability preferences.
- **Cascade generation is the architectural priority** — improving it pays back across all storage adapters and all callers.

## Follow-up beads

- Epic: First-class DBProvider adapters for Postgres + ClickHouse (Stack A)
- DO SQLite first-class adapter (Stack B transactional)
- R2 SQL adapter re-evaluation (Stack B alternative analytics; held back)
- Capability-tier declaration on DBProvider (Tier 3 analytics opt-in)
- Pipeline / replication patterns (separate concern; documented but not implemented in `ai-database`)
- **Epic: Make cascade generation fully real** — the moat
