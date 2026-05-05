# Stack A: Postgres + pgvector + ClickHouse

Wire `ai-database` against the **portable** stack — Postgres for transactional state plus native vector search, ClickHouse for analytics. Both run on Cloudflare Workers (PG via Neon HTTP or Hyperdrive, CH via HTTP) or on Node. Aim: zero to first cascade in under 30 minutes.

> **When to pick Stack A:** moderate-scale cascades, broad adoption, simpler ops, or callers who don't want Cloudflare lock-in. For cascade-heavy workloads (thousands of writes per cascade) consider Stack B (DO SQLite + Pipelines → Iceberg). See [ADR-0003](../adr/0003-storage-strategy-pg-clickhouse-default.md).

---

## 1. Prerequisites

- **Node 18+** (or a Cloudflare Worker with `compatibility_date >= 2024-09-23` for `nodejs_compat`).
- **A Postgres instance** with the `pgvector` extension. Recommended:
  - **[Neon](https://neon.tech)** — serverless Postgres with HTTP driver. **Recommended for cascade workloads** per ADR-0003: ~2× faster than Hyperdrive for short-burst writes; the only driver/shape combination that achieves sublinear scaling above N=100 (substrate-write-probes Phase 1 verdict — 91 ms p50 for 500 things + 499 actions in one round-trip).
  - Any managed Postgres (Supabase, RDS, etc.) with `CREATE EXTENSION vector`.
- **A ClickHouse instance** reachable over HTTP. ClickHouse Cloud, self-hosted, or `chDB` for embedded use.
- An **API key** for at least one LLM provider (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc.).

```bash
pnpm add ai-database ai-functions @neondatabase/serverless
```

---

## 2. Bootstrap the schemas

`ai-database` ships idempotent DDL helpers that create the `things`, `actions`, `verbs`, and `embeddings` tables. Run them once at deploy time (or wire them into a migration step).

```ts
// scripts/bootstrap.ts
import { neon } from '@neondatabase/serverless'
import {
  bootstrapPostgresSchema,
  bootstrapClickHouseSchema,
  createNeonHttpExecutor,
  createClickHouseHttpFetcher,
} from 'ai-database'

const pgSql = neon(process.env.DATABASE_URL!)
const pgExecutor = createNeonHttpExecutor(pgSql)

await bootstrapPostgresSchema(pgExecutor, {
  schema: 'aidb',
  withVector: true,
  vectorDimensions: 1536,
})

const chFetcher = createClickHouseHttpFetcher({
  url: process.env.CLICKHOUSE_URL!,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: 'aidb',
})

await bootstrapClickHouseSchema(chFetcher, { database: 'aidb' })
```

The PG bootstrapper is idempotent (`CREATE EXTENSION IF NOT EXISTS vector`, `CREATE TABLE IF NOT EXISTS …`). It is convenient, **not** a migration framework — production deployments typically run schema migrations via `dbmate`, `node-pg-migrate`, or your existing tool. The full DDL is documented in `pg-adapter.ts` and `ch-adapter.ts` if you prefer to manage it directly.

---

## 3. Wire the providers

```ts
// src/db.ts
import { neon } from '@neondatabase/serverless'
import {
  createPostgresProvider,
  createNeonHttpExecutor,
  createClickHouseProvider,
  createClickHouseHttpFetcher,
} from 'ai-database'

export function createStackA(env: {
  DATABASE_URL: string
  CLICKHOUSE_URL: string
  CLICKHOUSE_USER?: string
  CLICKHOUSE_PASSWORD?: string
}) {
  const pgSql = neon(env.DATABASE_URL)
  const pg = createPostgresProvider({
    executor: createNeonHttpExecutor(pgSql),
    namespace: 'tenant-default',
    schema: 'aidb',
    vectorDimensions: 1536,
    driver: 'neon-http',
  })

  const ch = createClickHouseProvider({
    fetcher: createClickHouseHttpFetcher({
      url: env.CLICKHOUSE_URL,
      username: env.CLICKHOUSE_USER,
      password: env.CLICKHOUSE_PASSWORD,
      database: 'aidb',
    }),
    namespace: 'tenant-default',
    database: 'aidb',
    vectorDimensions: 1536,
  })

  return { pg, ch }
}
```

`namespace` is the partition / tenant key (`partitioned-by-tenant` is the default sharding model on PG). Every Thing and Action is written under that namespace; queries are scoped to it.

---

## 4. Optional: Workers via Hyperdrive

If you specifically need Hyperdrive (connection pooling for an existing PG instance you don't want to expose over HTTP), wrap a `postgres.js` client:

```ts
// src/worker.ts
import postgres from 'postgres'
import { createPostgresProvider, createPgClientExecutor } from 'ai-database'

export default {
  async fetch(req: Request, env: Env) {
    const sql = postgres(env.HYPERDRIVE.connectionString)
    const pg = createPostgresProvider({
      executor: createPgClientExecutor(sql),
      namespace: 'tenant-default',
      driver: 'postgres-js',
    })
    // ...
  },
}
```

```toml
# wrangler.toml
name = "my-worker"
main = "src/worker.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[hyperdrive]]
binding = "HYPERDRIVE"
id = "<your-hyperdrive-id>"
```

> **Tradeoff (per ADR-0003):** Hyperdrive's response cache only fires on **parameterless** queries (simple protocol). Once `$1` appears, `postgres.js` switches to extended protocol and Hyperdrive stops caching. For cascade workloads — which always parameterize — **Neon HTTP wins ~2× across every short-burst write shape**. Use Hyperdrive only when you have a specific reason to (e.g., a non-Neon PG instance you want pooled). For the default cascade fast path, prefer Neon HTTP.

---

## 5. Your first cascade

```ts
// src/cascade.ts
import { generateCascade } from 'ai-database'
import { createStackA } from './db.js'

const { pg } = createStackA({
  DATABASE_URL: process.env.DATABASE_URL!,
  CLICKHOUSE_URL: process.env.CLICKHOUSE_URL!,
})

const cascade = await generateCascade({
  adapter: pg,
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
      hints: { stage: 'closed-won' },
      children: [
        { noun: 'OrderItem', count: [2, 4], verb: 'partOf' },
      ],
    },
  ],
  model: 'sonnet',
})

console.log('cascade id:', cascade.cascadeId)
console.log('root:', cascade.root.$id, cascade.root.data)
console.log('total written:', cascade.stats.written)
console.log('actions recorded:', cascade.stats.actionsRecorded)
console.log('duration ms:', cascade.stats.durationMs)
```

What happened:

- One **Customer** Thing was generated by the LLM and written via the bulk-VALUES CTE fast path (`commitBatch`).
- 3–5 **Order** siblings were generated **in parallel** (sibling-fan-out per `count`), then committed in **one round-trip** along with their `placedBy` Actions.
- For each accepted Order, 2–4 **OrderItem** siblings descended recursively.
- All Actions (relations) were recorded with `subject` = child id, `object` = parent id (SVO Frame conventions).
- Re-running with the same `rootHints` produces stable content-hashed ids; `ON CONFLICT DO NOTHING` short-circuits duplicate writes (idempotency).

For deterministic tests, pass a mock `generator`:

```ts
const cascade = await generateCascade({
  adapter: pg,
  rootNoun: 'Customer',
  generator: async ({ noun, siblingIndex }) => ({
    name: `${noun}-${siblingIndex ?? 'root'}`,
  }),
  // ...
})
```

---

## 6. Vector search via pgvector

The cascade can embed-on-write: pass an `embedder` and every generated Thing's preferred text fields (`name`, `description`, `summary`, …) get embedded and stored alongside the data — so reads-back-during-traversal include the vector.

```ts
import { generateCascade } from 'ai-database'

const cascade = await generateCascade({
  adapter: pg,
  rootNoun: 'Document',
  rootHints: { topic: 'a technical blog post about cascades' },
  embedder: async (text) => {
    // Call your embedding provider; return number[] of length <= vectorDimensions.
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    })
    const json = (await res.json()) as { data: { embedding: number[] }[] }
    return json.data[0]!.embedding
  },
  model: 'sonnet',
})
```

`generateCascade` populates `$embedding` on each Thing. To seed embeddings outside a cascade, call `provider.upsertEmbedding(...)` directly:

```ts
await pg.upsertEmbedding('Document', 'doc-1', new Array(1536).fill(0.0))
```

Query similarity:

```ts
const queryVec = await embed('how do cascades work?')
const hits = await pg.vectorSearch('Document', queryVec, {
  metric: 'cosine',  // 'cosine' | 'l2' | 'dot'
  limit: 10,
  minScore: 0.7,
})

for (const hit of hits) {
  console.log(hit.entity.$id, hit.score, hit.entity['name'])
}
```

The pgvector adapter supports `cosine`, `l2`, and `dot` metrics (no `hamming`). Scores are normalised so **higher is more similar** regardless of the underlying pgvector operator.

---

## 7. ClickHouse for cross-cascade analytics

Stack A's analytical leg shines on aggregations and time-series rollups across many cascades. The recommended pattern: **fan-out** Action records to ClickHouse asynchronously (via app-layer copy or a CDC tool like Debezium) so PG owns the transactional cascade state and CH owns the analytical record.

For ad-hoc analytical queries against the canonical `actions` table:

```ts
// Top verbs across all cascades, by daily count.
const rows = await ch.analyticsQuery(`
  SELECT
    verb,
    toDate(created_at) AS day,
    count() AS n
  FROM aidb.actions
  WHERE ns = 'tenant-default'
    AND created_at >= now() - INTERVAL 30 DAY
  GROUP BY verb, day
  ORDER BY day DESC, n DESC
  LIMIT 100
`)

// Distribution of cascade sizes (Things per cascade) over the last week.
const sizes = await ch.analyticsQuery(`
  SELECT
    JSONExtractString(data, 'cascadeId') AS cascade_id,
    count() AS thing_count
  FROM aidb.things
  WHERE ns = 'tenant-default'
    AND created_at >= now() - INTERVAL 7 DAY
  GROUP BY cascade_id
  ORDER BY thing_count DESC
  LIMIT 50
`)
```

Tier 4 (vector search) is also native on ClickHouse:

```ts
const hits = await ch.vectorSearch('Document', queryVec, {
  metric: 'cosine',
  limit: 10,
})
```

CH supports vectors up to ~64,000 dimensions via `cosineDistance` / `L2Distance` / `dotProduct`.

---

## 8. Common pitfalls

- **`pgvector` not installed.** `bootstrapPostgresSchema` swallows the `CREATE EXTENSION` error so non-vector deployments still work. If `vectorSearch` fails with an opaque error, run `CREATE EXTENSION vector;` against your DB. Neon enables it via the dashboard (Settings → Extensions).
- **Hyperdrive cache trap.** Once any `$1` appears in your SQL, Hyperdrive stops caching the response. The PG adapter parameterises everything for safety, so Hyperdrive **does not accelerate** it. Use Neon HTTP for the cascade fast path; reserve Hyperdrive for cases where you specifically need pooling.
- **`schema` collision.** The PG adapter defaults to a schema named `aidb`. If your DB already has an `aidb` schema with different tables, pass `schema: 'my_other_name'` to both `createPostgresProvider({ schema })` and `bootstrapPostgresSchema({ schema })`.
- **ClickHouse cold-start.** ClickHouse Cloud's idle-pause can add 1–5 s to the first query after a cold period. For cascade flows that read CH during traversal, keep a heartbeat or accept the cold latency.
- **Embedding dimensions mismatch.** The adapter validates `embedding.length <= vectorDimensions`. Set `vectorDimensions` to your model's output (`text-embedding-3-small` is 1536; `text-embedding-3-large` is 3072) at provider construction; all downstream `upsertEmbedding` and `vectorSearch` calls use it.
- **Connection pooling on Node.** Neon HTTP is request-scoped (no pool needed). For `postgres.js` over Hyperdrive, instantiate the client **inside** the request handler — Workers reuse the runtime, not the connection.
- **`namespace` cardinality.** Every row is keyed `(ns, id)`. Treat `namespace` as a tenant boundary; per-cascade isolation is **not** what PG is for (that's Stack B's per-cascade DO model). For the cascade workload here, one `namespace` per tenant is the right granularity.
- **`completed_at` on Actions.** Actions land with `status: 'pending'` unless you pass `status: 'completed'` to `recordAction` / `relate`. The cascade orchestrator always writes `'completed'` for relations.

---

## Next steps

- **Stack B** (DO SQLite + Pipelines → Iceberg + ClickHouse + Vectorize sidecar) — the cascade-heavy default for Cloudflare-native deployments. See `docs/getting-started/stack-b.md`.
- **DBProvider port reference** — every adapter satisfies the same surface; you can swap `pg` for the in-memory provider for tests, then back to `pg` for production. See `packages/ai-database/src/db-provider-port.ts`.
- **Cascade orchestrator deep-dive** — rubric-based `$validate`, regeneration policies, sibling-parallel fan-out. See `packages/ai-database/src/cascade-orchestrator.ts`.

For *why* this stack looks the way it does (transactional vs analytical split, Tier model, sharding declarations, why Iceberg as ground truth in Stack B but not Stack A), read [ADR-0003](../adr/0003-storage-strategy-pg-clickhouse-default.md).
