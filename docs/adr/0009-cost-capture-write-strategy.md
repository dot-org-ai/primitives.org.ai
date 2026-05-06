# Cost-capture write strategy and rollup model

**Status:** accepted
**Date:** 2026-05-05

## Context

Every Function in a cascade emits a Cost row. A typical mint cascade runs ~28 Function calls; at 1M Services, that's 28M LedgerEntry writes for the mint workload alone — before any post-mint Invocation traffic. Live Invocations then add a continuous tail of cost rows for as long as the Service exists.

The v2 production-critic review flagged this as a hard write-path gap. Two anti-patterns to avoid: (a) writing every cost row to ClickHouse directly (CH is poor at high-cardinality append-only writes at this rate), and (b) updating LedgerEntry rows in-place to "roll up" (kills auditability and breaks autonomous-finance's append-only contract).

## Decision

LedgerEntry writes go to the **transactional store** — DO SQLite per Stack B or PG per Stack A (per ADR-0003). Append-only, never updated. The transactional store is canonical: every cost is captured exactly once at write-time, scoped by `tenantRef` (per ADR-0007).

Aggregations live in **ClickHouse materialized views**, populated from the same Pipelines→Iceberg fan-out used by ADR-0005:

- `cost_per_service_mv` — rollup by `(service_id, day)`
- `cost_per_function_mv` — rollup by `(function_id, day)`
- `cost_per_tenant_mv` — rollup by `(tenant, day)`

MV refresh cadence: 5 minutes. Per-Invocation cumulative cost queries (the dashboard hot path, the autocomplete hover from v3 §14) hit the CH MV. Per-LedgerEntry detail (audit, dispute, reconciliation) hits the transactional store directly.

Retention: transactional store keeps 90 days, then archives to Iceberg (already the durable analytical SOR per ADR-0003). CH MVs retain 24 months. Iceberg is forever.

Cascade cost-attribution traces (`Service.invoke().handle.events.kind === 'cost-incurred'`) emit live and write to the transactional store async via the Worker Stream binding — same Pipelines path as ADR-0003's analytical fan-out.

## Consequences

- Real-time spend gates (autonomous-finance `SpendControl`) read the CH MV at 5-minute granularity by default. For sub-5-minute spend gates, callers query the transactional store directly — slower but accurate to the last write.
- Auditability is preserved — LedgerEntry is genuinely append-only; rollups are derived, not authoritative.
- ADR-0007's `tenantRef` partitions the cost rollups; cross-tenant cost queries are admin-only.
- ADR-0008's refund Actions are LedgerEntry writes like any other cost row — no special path, no special schema.
- The 5-minute MV refresh window is the load-bearing trade-off. Tightening it costs CH ingestion cycles; loosening it widens the spend-gate blast radius. 5 minutes is the v3 default; per-tenant overrides for high-spend enterprise tenants are deferred to v4.
- Storage at scale: transactional store hot tier is bounded by the 90-day retention; CH MV size scales with tenant × service × day cardinality, well within a single CH cluster at 1M Services.
