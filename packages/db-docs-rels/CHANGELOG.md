# Changelog

## 0.1.0 — 2026-05-07

Initial extract from `icps`, `services-builder`, and `startup-builder`.

### Added

- Canonical `createDocsRelsSchema(opts)` Drizzle factory with
  configurable schema name, embedding dim, and embedding model.
- `halfvec(dim)`, `vector(dim)`, `tsvector` custom types.
- `createMigrationSql(opts)` builder returning the canonical
  CREATE TABLE / CREATE INDEX statements.
- `0001-init.sql` parameterised migration template.

### Canonical contract decisions

- **`search` primary key** is `(content_id)` (not `(ns, id)` or `(ns, doc_id)`).
- **`search.embedding`** is `halfvec(1536)` (FP16) — half the disk +
  cache pressure of `vector(1536)`. Requires pgvector >= 0.7.
- **`docs.layer / status / review_state`** are nullable so non-review
  consumers (sb today) don't have to backfill.
- **`rels.evidence_kind`** is nullable for the same reason.
- **`events.payload`** is the canonical free-form payload column (in
  addition to the `prompt`/`output` LLM-event columns that icps + svc carry).
- **Default embedding model id** is `gemini-embedding-2` (no provider prefix).
