# Stack B: DO SQLite + Pipelines → Iceberg + Vectorize

Wire `ai-database` against the **cascade-heavy default** — Cloudflare Durable Object SQLite for transactional writes (per-cascade isolation), Cloudflare Pipelines fanning out to R2 Iceberg as the durable analytical record, ClickHouse as the materialized hot OLAP tier, and Vectorize as the Tier 4 sidecar when similarity search is needed. Aim: zero to first cascade dual-writing into Iceberg in under 45 minutes.

> **When to pick Stack B:** cascade workloads producing more than a few thousand inserts per cascade, deployments that need per-cascade write isolation, or Cloudflare-native shops. For moderate-scale or non-Cloudflare deployments, [Stack A](./stack-a.md) is simpler. See [ADR-0003](../adr/0003-storage-strategy-pg-clickhouse-default.md) for the decision rationale (PG's centralized-write ceiling vs. DO's per-cascade horizontal sharding).

---

## 1. Prerequisites

- A **Cloudflare account** on the **Workers Paid** plan (Pipelines is in beta and requires Paid; DO SQLite, R2, and Vectorize are also Paid-tier features).
- The **`wrangler` CLI** at v3.90+ (DO SQLite class migrations and Pipelines bindings landed late 2024 / early 2025).
- An **R2 bucket** with the **Data Catalog** (Iceberg REST) enabled.
- A **Pipelines stream** configured to write into your R2 Iceberg tables.
- A **Vectorize index** (only if you need Tier 4 similarity search; can be added later).
- Optional: a **ClickHouse Cloud** (or self-hosted) instance reachable over HTTP for the materialized hot OLAP tier — Iceberg is the source of truth, CH is a rebuildable read-tier.
- An **API key** for at least one LLM provider (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, …).

```bash
pnpm add ai-database ai-functions
```

References:
- Cloudflare Pipelines: https://developers.cloudflare.com/pipelines/
- R2 Data Catalog: https://developers.cloudflare.com/r2/data-catalog/
- Vectorize: https://developers.cloudflare.com/vectorize/

---

## 2. Wrangler bindings

Stack B is binding-driven. The shape below is what `ai-database` consumes — every shape is structurally typed (see `do-sqlite-adapter.ts` and `pipelines-iceberg-emitter.ts`), so the same code runs unchanged in Workers production, in Miniflare tests, and against pure-JS mocks for adapter unit tests.

```toml
# wrangler.toml
name = "my-cascade-worker"
main = "src/worker.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# --- Durable Object: per-cascade transactional shard ----------------------
# `DatabaseDO` is the SQLite-backed DO that ai-database's adapter speaks to
# (re-exported from `ai-database/worker`). One DO instance per cascade.
[[durable_objects.bindings]]
name = "DATABASE_DO"
class_name = "DatabaseDO"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["DatabaseDO"]    # SQLite-storage class, not classic KV

# --- Pipelines: analytical fan-out into R2 Iceberg ------------------------
# Configure the stream out-of-band (`wrangler pipelines create ...`) to land
# in R2 Iceberg via the Data Catalog destination.
[[pipelines]]
binding = "CASCADE_PIPELINE"
pipeline = "cascade-iceberg"

# --- R2 bucket holding the Iceberg tables --------------------------------
[[r2_buckets]]
binding = "ANALYTICAL_R2"
bucket_name = "cascade-iceberg"

# --- Vectorize: optional Tier 4 sidecar ----------------------------------
# Provision the index out-of-band:
#   wrangler vectorize create cascade-vectors --dimensions=1536 --metric=cosine
[[vectorize]]
binding = "VECTORIZE"
index_name = "cascade-vectors"

# --- ClickHouse HTTP credentials (optional materialized tier) ------------
# Plain env vars; ai-database's CH provider takes them via createStackA-style
# wiring if you keep CH in the loop for joins/windows over Iceberg.
[vars]
CLICKHOUSE_DATABASE = "aidb"

# Secrets, set with `wrangler secret put`:
#   CLICKHOUSE_URL
#   CLICKHOUSE_USER
#   CLICKHOUSE_PASSWORD
#   ANTHROPIC_API_KEY
```

> **Notes.** `new_sqlite_classes` (not `new_classes`) is required for SQLite-backed DOs — the per-cascade scale model in ADR-0003 depends on it. Pipelines and Vectorize bindings are fixed at deploy time (per ADR-0003: Vectorize is a per-deployment cost, not dynamically provisionable the way DO databases are).

---

## 3. Define the Database DO

`ai-database/worker` exports the `DatabaseDO` class — the SQLite-backed Durable Object the DO SQLite adapter speaks to over its `/data`, `/rels`, `/query/*`, and `/traverse` routes.

```ts
// src/worker.ts
import { DatabaseDO } from 'ai-database/worker'

export { DatabaseDO }

export interface Env {
  DATABASE_DO: DurableObjectNamespace
  CASCADE_PIPELINE: { send(records: ReadonlyArray<Record<string, unknown>>): Promise<void> }
  ANALYTICAL_R2: R2Bucket
  VECTORIZE?: VectorizeIndex
  CLICKHOUSE_URL?: string
  CLICKHOUSE_USER?: string
  CLICKHOUSE_PASSWORD?: string
  CLICKHOUSE_DATABASE?: string
  ANTHROPIC_API_KEY: string
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    // route to your handlers; see the cascade example below.
    return new Response('ok')
  },
}
```

If you want the canonical worker entrypoint (with built-in HTTP routes for entity CRUD), re-export `DatabaseWorker` instead:

```ts
import { DatabaseWorker, DatabaseDO } from 'ai-database/worker'
export { DatabaseDO }
export default DatabaseWorker
```

---

## 4. Wire the adapter and analytical emitter

The DO SQLite adapter and the Pipelines→Iceberg emitter are independent — the adapter handles transactional writes; the emitter handles fan-out. Pass both into `generateCascade` and the orchestrator dual-writes per ADR-0003.

```ts
// src/db.ts
import {
  createDOSqliteAdapter,
  createPipelinesIcebergEmitter,
} from 'ai-database'
import type { Env } from './worker.js'

export function createStackB(env: Env, cascadeId: string) {
  // Per-cascade sharding: every cascade gets its own DO instance, so
  // reads-back-during-traversal stay local (no cross-DO hot-path reads).
  const adapter = createDOSqliteAdapter({
    namespace: env.DATABASE_DO,
    sharding: 'per-cascade',
    defaultCascadeId: cascadeId,
    vectorize: env.VECTORIZE,             // optional; Tier 4 sidecar
    vectorizeDimensions: 1536,            // matches Vectorize index provision
  })

  // Dual-write fan-out into R2 Iceberg via Pipelines. The emitter is
  // fire-and-forget on the cascade hot path (failures are logged, never
  // throw — DO SQLite remains the source of truth for traversal).
  const analyticalEmitter = createPipelinesIcebergEmitter({
    binding: env.CASCADE_PIPELINE,
    thingsTable: 'aidb.things',
    actionsTable: 'aidb.actions',
  })

  return { adapter, analyticalEmitter }
}
```

> **Naming note.** The factory is `createDOSqliteAdapter` (not `createDOSqliteProvider`); it returns a `DOSqliteAdapter` that satisfies `DBProvider` + `DBProviderSVO` + `VectorSearchPort`. Plug it into `generateCascade` via the `adapter` option.

---

## 5. Your first cascade with dual-write

```ts
// src/cascade.ts
import { generateCascade } from 'ai-database'
import { createStackB } from './db.js'
import type { Env } from './worker.js'

export async function runCascade(env: Env, cascadeId: string) {
  const { adapter, analyticalEmitter } = createStackB(env, cascadeId)

  const cascade = await generateCascade({
    adapter,
    analyticalEmitter,                  // dual-write into Iceberg
    sharding: 'per-cascade',            // each cascade = one DO instance
    cascadeId,                          // stable id → idempotent re-runs
    rootNoun: 'Customer',
    rootHints: {
      industry: 'B2B SaaS',
      description: 'a SaaS startup founder mid-Series-A',
    },
    children: [
      {
        noun: 'Order',
        count: [3, 5],
        verb: 'placedBy',
        children: [{ noun: 'OrderItem', count: [2, 4], verb: 'partOf' }],
      },
    ],
    model: 'sonnet',
  })

  return cascade
}
```

What happened:

- One **DO instance** was selected by `idFromName('cascade:<cascadeId>')`. All of this cascade's Things, Actions, and traversal reads stayed inside that DO.
- Each generated **Thing** and **Action** was written via the DO's `/data` and `/rels` routes (SQLite local, transactional).
- After the local commit, the orchestrator handed the same batch to `analyticalEmitter`, which serialised rows into the Iceberg `things` / `actions` shape (see `pipelines-iceberg-emitter.ts` for the column list) and `send()`-ed them through the Pipelines binding into R2 Iceberg.
- Re-running with the same `cascadeId` re-uses content-hashed entity ids; the adapter's `ON CONFLICT` semantics short-circuit duplicate writes, and Iceberg MERGE-on-read collapses duplicates downstream (the emitter stamps a `_dedup_key` column).

Per-cascade isolation is what makes the moat workload viable. PG's centralized writer hits its ceiling within one active cascade; DO SQLite gives every cascade its own writer at full single-DO throughput. See ADR-0003 for the full argument.

---

## 6. Reading the Iceberg analytical layer

R2 Data Catalog exposes a standard Iceberg REST interface, so any Iceberg-aware engine can read your cascade history. Pick the engine that fits the query shape:

**R2 SQL** for ad-hoc single-table queries (Cloudflare-native, no infra):

```sql
-- Recent cascade volume by day.
SELECT
  cascade_id,
  COUNT(*) AS thing_count
FROM things
WHERE created_at >= NOW() - INTERVAL '7' DAY
GROUP BY cascade_id
ORDER BY thing_count DESC
LIMIT 50;
```

R2 SQL handles aggregations, ~190 functions, JSON, single-table CTEs, struct/array/map access. It does **not** yet support joins, window functions, UNION, or subqueries (per ADR-0003 — re-evaluate as the beta evolves).

**ClickHouse** for joins, windows, sessionization (the materialized hot tier):

```ts
// Top verbs across all cascades in the last 30 days.
const rows = await ch.analyticsQuery(`
  SELECT verb, toDate(timestamp) AS day, count() AS n
  FROM iceberg('s3://cascade-iceberg/aidb/actions')
  WHERE timestamp >= now() - INTERVAL 30 DAY
  GROUP BY verb, day
  ORDER BY day DESC, n DESC
  LIMIT 100
`)
```

Use the [ClickHouse Iceberg table function](https://clickhouse.com/docs/en/sql-reference/table-functions/iceberg) to read R2-hosted Iceberg directly, or replicate Iceberg into a CH MergeTree for hot-path queries.

**DuckDB** for local analysis: `INSTALL iceberg; ATTACH 'r2://cascade-iceberg/aidb' AS catalog (TYPE iceberg);`

---

## 7. Vector search via Vectorize

DO SQLite has no native vector index — Tier 4 is sidecared via Vectorize per ADR-0003. The adapter wires the binding once at construction; subsequent `vectorSearch()` calls route through the Vectorize `query()` API.

```ts
// Provision the index once, out-of-band:
//   wrangler vectorize create cascade-vectors \
//     --dimensions=1536 --metric=cosine
//
// Then add the binding to wrangler.toml (see Section 2) and pass it
// through createDOSqliteAdapter:

const adapter = createDOSqliteAdapter({
  namespace: env.DATABASE_DO,
  sharding: 'per-cascade',
  defaultCascadeId: cascadeId,
  vectorize: env.VECTORIZE,
  vectorizeDimensions: 1536,
})

// Query similarity. Vectorize pins the metric at index creation time, so
// the `metric` option is a documentation hint only.
const hits = await adapter.vectorSearch('Document', queryVec, {
  limit: 10,
  minScore: 0.7,
})

for (const hit of hits) {
  console.log(hit.entity.$id, hit.score, hit.entity['name'])
}
```

The adapter stores Thing data inside the DO; Vectorize stores only the embedding (plus optional `metadata` for fast reconstitution). Seed Vectorize from your cascade by calling `env.VECTORIZE.insert(...)` after `generateCascade` returns — that wiring lives in your worker, not the adapter, because Vectorize indexes are deploy-pinned and the seeding policy varies by use case.

Without a `vectorize` binding the adapter's capabilities omit Tier 4 and `vectorSearch()` throws `VectorSearchUnavailableError`. Check `adapter.capabilities.vectorSearch` before issuing a query if you might run with or without the binding.

---

## 8. Common pitfalls

- **Per-DO 10 GB cap.** Each DO SQLite database has a hard 10 GB limit (declared on `adapter.maxStorageBytes`). The per-cascade strategy keeps you well below this for a single cascade — but long-running cascades, write-heavy verbs, or per-tenant sharding for tenants with massive cascade volume can hit it. Plan a rotation strategy (new cascade id) before reaching the cap; cross-DO migration is not built in.
- **Pipelines is beta.** Configuration knobs (dedup keys, batch sizing, retry behaviour) are evolving. The emitter is fire-and-forget by design — failures log via `options.logger` and never break the cascade hot path. If you need synchronous "did the analytical write land?" semantics, set `awaitSend: true` for diagnostics, but errors are still swallowed (different failure semantics would require a typed error path; deferred).
- **Vectorize is per-deployment.** Bindings are fixed in `wrangler.toml`; you can't dynamically provision a Vectorize index per cascade the way you can per-cascade DOs. For multi-tenant deployments scope a single index using the `vectorizeNamespace` option (passes through to Vectorize's per-query `namespace` filter).
- **`new_sqlite_classes` migration trap.** If you originally deployed `DatabaseDO` as a classic (KV-backed) DO, you cannot re-tag it as SQLite-backed in place. New deployments only — see Cloudflare's DO migration docs.
- **Wrangler local-dev quirks.** `wrangler dev` simulates DOs and Pipelines locally, but Pipelines local fan-out lands in a local file rather than R2 Iceberg. End-to-end Iceberg verification requires `wrangler dev --remote` or a deployed worker.
- **Verb registry is per-shard.** Because each per-cascade DO has its own SQLite database, the SVO Verb registry (`__svo_verb` records) is **per-cascade**. For most cascade workloads that's correct (cascades are short-lived). Long-lived workloads needing a global Verb registry should layer it via `digital-objects` upstream of the adapter.
- **No native CDC from DO SQLite.** Per ADR-0003, the cascade dual-writes (DO + Pipelines emitter) are how analytical data leaves the DO — there is no CDC-from-DO-to-Iceberg primitive. Your code is responsible for emitting at write time; the orchestrator does this when `analyticalEmitter` is wired.
- **Action ordering across DOs.** Per-cascade isolation gives correctness inside one cascade; cross-cascade ordering of Actions is not guaranteed. Use the Iceberg `timestamp` column for cross-cascade time-series; don't assume monotonic sequencing across DOs.

---

## Next steps

- **Stack A** (Postgres + pgvector + ClickHouse) — the portable default for moderate-scale or non-Cloudflare deployments. See [stack-a.md](./stack-a.md).
- **Cascade orchestrator deep-dive** — rubric-based `$validate`, regeneration policies, sibling-parallel fan-out. See `packages/ai-database/src/cascade-orchestrator.ts`.
- **Cascade write strategy + analytical emitter contracts.** See `packages/ai-database/src/cascade-write-strategy.ts` and `packages/ai-database/src/pipelines-iceberg-emitter.ts` — both are the seams you extend if you want a non-Pipelines analytical fan-out (e.g. Kafka, Kinesis).

For *why* this stack looks the way it does (cascade-throughput economics, per-cascade DO isolation as the moat enabler, Iceberg-as-ground-truth so CH is rebuildable, Vectorize as the operational cost for vector search), read [ADR-0003](../adr/0003-storage-strategy-pg-clickhouse-default.md). The substrate-write-probes findings cited in [stack-a.md](./stack-a.md) explain why PG's centralized-write ceiling pushed cascade-heavy workloads to Stack B.
