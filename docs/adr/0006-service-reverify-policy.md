# Service re-verify policy and revision lifecycle

**Status:** accepted
**Date:** 2026-05-05

## Context

`Service.verify()` runs a synthetic invocation across the full cascade with the configured `EvaluatorPanel`. At ~$0.045/run and an estimated 5 revisions/yr per Service, naively re-verifying on every edit costs ~$225K/yr at 1M Services. Most edits are cosmetic — a tweaked tagline, a new pricing tier headline, an updated category — and don't change cascade behavior at all.

The v2 production-critic review flagged this as a hard cost gap. The boilerplate decision in `docs/plans/2026-05-05-services-as-software-design-v3.md` §11 sketched the field-classification table; this ADR locks it.

## Decision

Re-verify is required only when fields affecting cascade behavior change. `Service.publish()` reads the latest `VerificationReport`, computes a field-diff against the version that was verified, and throws `VerifyRequired` if any **behavioral** field differs.

Field classification (per v3 §11):

| Field changed | Re-verify required? |
|---|---|
| `binding.cascade` (any FunctionRef added/removed/reordered/kind-changed) | YES |
| `binding.toolPermissions` (any added) | YES |
| `outputContract.input.schema`, `outputContract.output.schema` | YES |
| `evaluators.personas` (any added/removed/changed signOff) | YES |
| `outcomeContract.predicate` (any change) | YES |
| `oversight.mode` for any cascade Function | YES |
| `pricing` | NO |
| `catalog`, `order`, `onboarding`, `delivery`, `portal` overrides | NO |
| `name`, `promise`, `description` | NO |
| `lineage` | NO |
| `tags`, `category` | NO |

Field-diff comparison logic lives in `services-as-software/src/service/publish.ts`. The verified-version snapshot is stored on `VerificationReport` so the diff is exact, not heuristic.

Synthetic-input fixtures are cached keyed on the **behavioral-fields hash** — when a re-verify does run, fixture reuse cuts cost ~5× on repeat runs over the same behavioral surface.

## Consequences

- Operators iterate copy, branding, pricing summaries, category, lineage, and catalog hero content freely without triggering re-verify spend.
- Behavioral changes always re-cost — no escape hatch, since these are exactly the changes that can break the outcome contract.
- The field-classification table is load-bearing for the cost model and is part of the `Service` public contract; additions to `ServiceSpec` must declare their classification at definition time.
- Re-verify cost at 1M Services drops from ~$225K/yr (naive) to a workload-driven number governed by behavioral churn — empirically a small fraction of total edits.
- `VerificationReport` becomes a first-class versioned record, not a transient run artifact. ADR-0007's `tenantRef` flows through to it for tenant-scoped audit.
