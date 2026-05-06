# Service catalog read-path = ClickHouse materialized view from Iceberg

**Status:** accepted
**Date:** 2026-05-05

## Context

The 1M-Service thesis (per `docs/plans/2026-05-05-services-as-software-design-v3.md`) means the catalog UI must page, filter, sort, and search across an order of magnitude more Services than DO SQLite can serve. ADR-0003 places canonical transactional Service records in DO SQLite per-tenant — excellent for hot per-Service detail pages, but no cross-DO query path exists. A buyer browsing "every bookkeeper Service for a Series-A SaaS" cannot be served by per-tenant DO shards.

The v2 production-critic review flagged this as a hard gap: catalog reads are an analytical workload (cross-tenant scans, aggregation by archetype/category/audience, popularity ranking) layered on top of a transactional substrate. Stack B's Pipelines→Iceberg fan-out (per ADR-0003) already lands every Service mutation in R2 Iceberg; what's missing is the hot read-path.

## Decision

Catalog reads are served by a ClickHouse materialized view, `services_catalog_mv`, populated from R2 Iceberg via the Pipelines fan-out established in ADR-0003.

Schema:

```
(service_id, tenant, archetype, category, audience, state,
 published_at, lineage_cell_id, lineage_icp_id,
 name, promise, pricing_summary, popularity_score)
```

ORDER BY `(tenant, archetype, category, popularity_score DESC)`. Secondary indexes on `lineage_cell_id` and `lineage_icp_id` to support reverse queries — e.g., "every Service for occupation X" or "every Service in cell Y."

Search over `name + promise + description` is delegated to a **Vectorize sidecar**, indexed on the same Service mutation events that feed the MV. Pagination uses keyset on `(popularity_score, service_id)` — never OFFSET, which degrades sharply past the first few pages at this scale.

Hot per-Service detail still hits DO SQLite (the canonical record per ADR-0003); the CH MV is a slice optimized for browse, filter, and search.

A new primitive `Service.collection(filter, opts)` in `services-as-software` returns a CH-backed cursor over the MV. Direct callers wanting the canonical record continue to use `Service.get(id)` against the per-tenant DO.

## Consequences

- Catalog UI scales to 1M+ Services without the per-DO ceiling.
- Vectorize becomes a hard dependency for catalog search — ~400 MB index at 1M Services × 1536-dim embeddings, a fixed Stack B operational cost beyond the per-cascade Vectorize use already accepted in ADR-0003.
- The MV inherits Iceberg's ~minutes-of-staleness from Pipelines fan-out. Hot read-after-write for the publishing operator goes via DO SQLite; cross-tenant browse accepts the lag.
- ADR-0007's `tenantRef` flows into the MV's `tenant` column; the public catalog is a CH view filtered to `visibility='public'`.
- Schema evolution on `services_catalog_mv` requires Iceberg-side migration plus MV rebuild — established Stack B pattern, not a new operational concern.
