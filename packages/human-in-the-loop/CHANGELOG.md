# human-in-the-loop

## 2.2.0

### Minor Changes

- **request-lifecycle** — pure state machine for Human Function request lifecycle:
  transitions (`claim`, `startProgress`, `release`, `resolve`, `timeout`, `escalate`, `cancel`),
  queries (`forAssignee`, `sortByPriorityThenSLA`, `timeToDeadline`, `isBreached`),
  and migration helpers (`LEGACY_KIND_MAP`, `legacyKindToRequestKind`).

- **escalation-engine** — pure SLA evaluation and escalation routing:
  `evaluateEscalation`, `batchEvaluate`, `buildEscalatedItem`, `buildVantageLadder`,
  and canonical Vantage ladder fixture policies (`FIXTURE_IC`, `FIXTURE_TEAM`,
  `FIXTURE_BUSINESS`, `FIXTURE_STUDIO`, `FIXTURE_POLICIES`, `getFixturePolicy`).

- **LifecycleStore** (port + in-memory impl) — lifecycle-native persistence layer:
  `LifecycleStore` interface (`LifecycleStoreFilters`, `LifecycleItemPatch`, `LifecycleResponse`)
  and `LifecycleStoreMemory` in-memory implementation.

- **LifecycleChannelAdapter** (port + stubs) — deliver + inbound-response seam:
  `LifecycleChannelAdapter` interface, `LifecycleAdapterRegistry`, `adapterRegistry`,
  and no-op stub adapters `emailAdapter` and `slackAdapter` (replace with real impls).

- **Deprecated legacy aliases retained for back-compat** — `LegacyRequestKind`,
  `LEGACY_KIND_MAP`, `legacyKindToRequestKind` exported from `request-lifecycle` for
  consumers upgrading from v2.1.4 verbose types.

## 2.1.3

### Patch Changes

- Updated dependencies
  - ai-functions@2.1.3
  - digital-workers@2.1.3

## 2.1.1

### Patch Changes

- Updated dependencies [6beb531]
  - ai-functions@2.1.1
  - digital-workers@2.1.1

## 2.0.3

### Patch Changes

- Updated dependencies
  - rpc.do@0.2.0
  - ai-functions@2.0.3
  - digital-workers@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies
  - ai-functions@2.0.2
  - digital-workers@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies
  - ai-functions@2.0.1
  - digital-workers@2.0.1
