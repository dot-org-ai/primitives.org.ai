# `rdb-provider-adapter.ts` is a real seam, not single-adapter indirection

**Status:** accepted
**Date:** 2026-05-05

## Context

The 2026-05-05 architecture review (`docs/plans/2026-05-05-svo-co-design.md`) flagged `packages/ai-database/src/rdb-provider-adapter.ts` as a candidate for inlining under the rule "one adapter means a hypothetical seam — don't introduce a port unless something actually varies across it." The reviewer assumed there was a single in-repo RDB provider this file wrapped.

That was wrong. `@dotdo/rdb` is an **external package** in a separate repository (`/Users/nathanclevenger/projects/rdb`), not part of this monorepo's workspace. The file isn't single-adapter indirection — it bridges two distinct interfaces:

- `ai-database`'s internal `DBProvider` shape
- `@dotdo/rdb`'s external `DBProvider` shape

Real adaptation lives here: string-query → `$regex` filter conversion, MDXLD field translation (`id`/`type` ↔ `$id`/`$type`), per-field deduplication, and client-side `where`/`limit`/`offset` because RDB lacks top-level `$or`. The structural-typing shims for `RDBProvider`, `RDBEntity`, `Filter`, `FilterOperator` exist because TypeScript can't import types from an unworkspaced package without a hard dep.

## Decision

Keep `rdb-provider-adapter.ts`. It is a load-bearing impedance-match between two real interfaces, not an internal seam to flatten. Inlining the conversion logic into `@dotdo/rdb` would require `@dotdo/rdb` to depend on `ai-database` — wrong layer direction.

## Consequences

- Future architecture reviews will not re-suggest inlining this file.
- If a second non-RDB SQL backend ever lands inside this monorepo, *that* would justify extracting an internal port — but the current adapter still earns its keep against `@dotdo/rdb`.
- Bead `aip-cg2y` is closed as `wontfix` with this ADR as the reason.
