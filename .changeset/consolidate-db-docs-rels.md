---
"ai-database": minor
---

Fold db-docs-rels primitive into ai-database (consolidate accidentally-scoped @primitives/db-docs-rels).

The canonical Drizzle schema for the four-table docs+rels+search+events spine (Neon Postgres + pgvector, halfvec(1536) embeddings, HNSW cosine index, plus the parametric `createMigrationSql()` migration builder and the `halfvec` / `tsvector` Drizzle custom-type factories) now lives inside `ai-database` under `src/docs-rels/`.

Import via the subpath:

```ts
import {
  createDocsRelsSchema,
  createMigrationSql,
  halfvec,
  tsvector,
  DEFAULT_EMBEDDING_DIM,
} from 'ai-database/docs-rels'
```

`drizzle-orm` is added as an OPTIONAL peer dependency on `ai-database` — it is only required when consumers actually import from the `docs-rels` subpath. Existing ai-database consumers that never touch docs-rels are unaffected.

The standalone `@primitives/db-docs-rels` package is removed — it was accidentally scoped under `@primitives/`, an npm scope we do not own, and was always intended to live alongside ai-database's other persistence primitives.
