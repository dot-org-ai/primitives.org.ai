# Tenant scoping for Services and Invocations

**Status:** accepted
**Date:** 2026-05-05

## Context

The v2 design assumed all published Services land in a single global catalog, with `MarketplaceListing` controlling discovery but not isolation. The v2 production-critic review flagged this as a hard gap for three real buyer segments:

- **Enterprise** customers who need their internal Services invisible to competitors.
- **Regulated** verticals (healthcare, finance) where cross-tenant data leakage is a compliance violation, not just a privacy concern.
- **White-label** buyers (agencies, platforms) who resell our Services under their own brand and require their tenant to be the only namespace their end-users see.

Without tenant scoping, ADR-0003's per-tenant DO SQLite isolation is nominal — there's no consistent `tenantRef` flowing through the system to enforce it, and the catalog (per ADR-0005) has no tenant filter to apply.

## Decision

`ServiceSpec` gains a required `tenantRef: ThingRef` field. `MarketplaceListing` gains `visibility: 'public' | 'tenant' | 'tenants[]'`. The default for first-party Services published into the open catalog is `tenantRef = <org.ai>` and `visibility = 'public'`.

DO SQLite shard key includes `tenantRef` (the per-tenant isolation pattern in ADR-0003 becomes a contract, not a convention). The CH MV from ADR-0005 carries a `tenant` column; partition by `tenant` for large enterprise tenants, share with a `tenant` filter for SMB.

Per-Invocation `tenantRef` is set at invocation time and flows through the entire cascade: every cascade Function inherits it, every LedgerEntry written by autonomous-finance carries it (per ADR-0009's transactional-store schema), every emitted Action records it.

Cross-tenant queries are explicitly admin-only — exposed through a separate `AdminCollection` primitive, never through `Service.collection()`.

Connect Marketplace Wallets (autonomous-finance Stripe adapter) align to `tenantRef` — a tenant's payouts and chargebacks are isolated to that tenant's wallet, not commingled.

## Consequences

- The public catalog becomes a CH view filtered to `visibility='public'`. Per-tenant catalog dashboards filter to one tenant by `tenantRef`. Both share the same MV from ADR-0005.
- Enterprise and regulated buyers get real isolation, not opt-in privacy filters. White-label resale becomes natively supported.
- Every primitive that touches Services or Invocations (publish, invoke, list, search, ledger write, marketplace listing, refund) must thread `tenantRef`. The required-field shape is enforced at the type level on `ServiceSpec` and `Invocation`.
- ADR-0008's refund flows scope by tenant — refunds land in the originating tenant's wallet, not a global pool.
- ADR-0009's cost rollups are partitioned by tenant, giving each tenant accurate spend visibility without cross-tenant aggregation leakage.
- Migration: existing Services without a `tenantRef` are bulk-assigned to the default `<org.ai>` tenant at the migration cutover; the field becomes required for new definitions immediately.
