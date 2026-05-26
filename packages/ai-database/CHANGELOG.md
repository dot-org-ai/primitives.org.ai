# ai-database

## 2.4.0

### Patch Changes

- Updated dependencies [4d58f5f]
  - ai-functions@2.4.0
  - @org.ai/types@2.4.0

## 2.3.0

### Minor Changes

- b7c7c57: Fold db-docs-rels primitive into ai-database (consolidate accidentally-scoped @primitives/db-docs-rels).

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

### Patch Changes

- Updated dependencies [9e2779a]
- Updated dependencies [aff0c81]
  - ai-functions@2.3.0
  - @graphdl/core@0.4.0
  - @org.ai/types@2.3.0

## 2.1.3

### Patch Changes

- Documentation and testing improvements

  - Add deterministic AI testing suite with self-validating patterns
  - Apply StoryBrand narrative to all package READMEs
  - Update TESTING.md with four principles of deterministic AI testing
  - Fix duplicate examples package name conflict

- Updated dependencies
  - ai-functions@2.1.3

## 2.1.1

### Patch Changes

- 6beb531: Add TDD RED phase tests for type system unification

  - ai-functions: Add tests for AIFunction<Output, Input> generic order flip
  - ai-workflows: Add tests for EventHandler<TOutput, TInput> order and OnProxy/EveryProxy autocomplete
  - ai-database: Existing package - no changes in this release
  - @org.ai/types: New shared types package with failing tests for RED phase

  These tests document the expected behavior for the GREEN phase implementation where generic type parameters will be reordered to put Output first (matching Promise<T> convention).

- Updated dependencies [6beb531]
  - ai-functions@2.1.1

## 2.1.0

### Minor Changes

- **Natural Language Query Execution**: Wire up tagged template literal handler (`db.Lead\`query\``) and `db.ask()`method for natural language database queries. Supports AI-powered query generation via`setNLQueryGenerator()` with fallback to keyword search.

- **Schema Input Validation**: Comprehensive validation for entity names, field names, field types, and operator syntax. Prevents SQL injection, XSS, and provides helpful error messages. Throws `SchemaValidationError` with error codes and paths for programmatic handling.

### Patch Changes

- Fixed TypeScript build error in parse.ts operator validation

## 2.0.3

### Patch Changes

- Updated dependencies
  - rpc.do@0.2.0
  - ai-functions@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies
  - ai-functions@2.0.2

## 2.0.1

### Patch Changes

- fixed dependencies
- Updated dependencies
  - ai-functions@2.0.1
