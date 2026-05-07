# @primitives/db-docs-rels

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

Canonical Drizzle schema for the **`docs + rels + search + events`** four-table spine
on Neon Postgres + pgvector. Lifts the schema that was implemented three times
across `icps`, `services-builder`, and `startup-builder` into a single versioned
package.

## Why

The three repos all carry a near-identical `docs(ns,id,type,data) + rels +
search + events` schema with bespoke pgvector / tsvector custom types
copy-pasted into each one. This package consolidates them so:

- pgvector + tsvector custom types live in one place
- the four-table contract has one canonical definition
- consumers pin a semver and get parity with the others
- migrations + index strategy ship as a unit

## Install

```bash
pnpm add @primitives/db-docs-rels drizzle-orm
```

## Usage

```ts
import { createDocsRelsSchema, createMigrationSql } from '@primitives/db-docs-rels'

// Build a schema bound to a specific Postgres schema name.
const { docs, rels, search, events } = createDocsRelsSchema({
  schemaName: 'icps',
  embeddingDim: 1536,
  embeddingModel: 'gemini-embedding-2',
})

// Run the canonical migrations.
const stmts = createMigrationSql({ schemaName: 'icps' })
for (const stmt of stmts) await db.execute(sql.raw(stmt))
```

## Canonical contract

| Table | Primary key | Notes |
|---|---|---|
| `docs(ns, id, type, data jsonb, ...)` | `(ns, id)` | content-addressed; `layer`, `status`, `review_state` columns are nullable for consumers that don't run a review pipeline |
| `rels(ns, src, rel, dst, data jsonb, ...)` | `(ns, src, rel, dst)` | typed edges; `evidence_kind` nullable |
| `search(content_id, ns, type, embedding halfvec(1536), tsv tsvector, ...)` | `(content_id)` | embedding + FTS spine; canonical type is `halfvec(1536)` (pgvector >= 0.7) for half-precision storage |
| `events(id uuid, ns, doc_id, type, payload, ...)` | `(id)` | append-only event stream with token + cost + latency rollup columns |

### Index strategy

- `docs.data` GIN — jsonb path queries
- `rels.data` GIN — jsonb path queries
- `search.tsv` GIN — full-text search
- `search.embedding` HNSW (cosine ops) — approximate nearest neighbour
- partial indexes on `events.status <> 'success'` (failure tail), `events.run_id`,
  `events.parent_event_id` (causal tree)

### Custom types

- `halfvec(dim)` — canonical FP16 embedding storage. Half the disk + buffer
  cache pressure of `vector(dim)`; recall within rounding error for
  L2-normalized 1536-d Gemini embeddings. Requires pgvector >= 0.7.
- `vector(dim)` — legacy FP32 storage. Retained for migration paths.
- `tsvector` — Postgres full-text search column.

### Embedding model id

Default `gemini-embedding-2` (no provider prefix). startup-builder's
existing `'google/gemini-embedding-2'` is migrating to this canonical form.

## Strict superset

The canonical schema is a strict superset of the three consumer schemas it
replaces:

| Field | startup-builder | icps | services-builder | canonical |
|---|---|---|---|---|
| `docs.layer` | absent | required (enum) | required (text) | optional (nullable) |
| `docs.status` | absent | required enum | required enum | optional (nullable) |
| `docs.review_state` + `review_notes` | absent | required | required | optional (nullable) |
| `docs.review_systemic_issue_id` | absent | optional | absent | optional |
| `rels.evidence_kind` | absent | required | required | optional (nullable) |
| `rels.review_state` + `review_notes` | absent | required | required | optional (nullable) |
| `search` PK | `(ns, id)` | `(ns, doc_id)` | `(ns, doc_id)` | `(content_id)` |
| `search.embedding` type | `vector(1536)` | `vector(1536)` | `vector(1536)` | `halfvec(1536)` |
| `search.embedding_model` default | `'google/gemini-embedding-2'` | `'gemini-embedding-2'` | `'gemini-embedding-2'` | `'gemini-embedding-2'` |
| `events` table | absent (separate package) | present | present | present |
| `events.payload` | n/a | absent | absent | added (canonical) |

Consumers that need a narrower view (e.g. icps's required `layer` enum) can
build it on top of the canonical schema by `.notNull()`-ing the column at
their own boundary, by enforcing it via a `CHECK` constraint, or by
applying it as application-layer validation.

## Version history

- **0.1.0** (initial) — extract canonical four-table spine from sb + icps + svc.
  Adopts `halfvec(1536)` and `(content_id)` PK on `search` per the user's
  canonical spec.

## Breaking-change policy

This package follows semver. Every column rename, primary-key change, or
custom-type swap is a major bump. Consumers pin a major version and audit
explicitly when bumping.

## License

MIT
