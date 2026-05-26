# business-as-code

## 2.4.0

### Minor Changes

- d30c2e8: Make `business-as-code` the source of truth for the outcome-contract economic
  substrate.

  The substrate (Money/Cost/Budget/SpendControl/CostModel value types,
  Account/Card/Ledger/Identity payment types, Pricing, OutcomeContract,
  ProofPredicate, SLAPolicy, RefundContract, AuthorityBoundary, and the
  FinanceProvider/Merchant ports) now lives in `business-as-code` and is exposed
  via the new `business-as-code/finance` subpath export. Finance is foundational
  here because it is the core of the default OKRs (Revenue/Growth/Profit).

  `autonomous-finance` becomes a thin re-export shim (`export * from
'business-as-code/finance'`) so every existing importer — including the 16
  `autonomous-*` catalog packages — keeps compiling unchanged. Its dependency
  flips from `zod` to `business-as-code`, and its stale package description
  (falsely advertising Stripe/Tempo/x402/Privy/Lightspark adapters and finance
  Services) is corrected.

  Core consumers are repointed off the shim onto `business-as-code/finance`:
  `services-as-software` (14 files) and `digital-tools` (2 files) now import the
  substrate directly and add `business-as-code` as a workspace dependency.

  This is part of the fixed-version group, so the minor bump cascades across the
  group (including the repointed `digital-tools` and `services-as-software`).

  LAYERING NOTE (awaiting owner sign-off): placing the substrate in
  `business-as-code` (Layer 5) means `digital-tools` (Layer 4) now imports a
  higher layer. The inversion is intentional — the economic substrate is
  conceptually foundational (Layer 0) — and is acyclic (`business-as-code`'s
  dependency closure contains neither `digital-tools` nor `services-as-software`).
  If the owner prefers, the substrate can instead move to a dedicated Layer 0
  foundation module.

### Patch Changes

- Updated dependencies [4d58f5f]
  - ai-functions@2.4.0
  - ai-database@2.4.0
  - digital-workers@2.4.0

## 2.3.0

### Patch Changes

- Updated dependencies [9e2779a]
- Updated dependencies [b7c7c57]
  - ai-functions@2.3.0
  - ai-database@2.3.0
  - digital-workers@2.3.0

## 2.1.3

### Patch Changes

- Updated dependencies
  - ai-functions@2.1.3
  - ai-database@2.1.3

## 2.1.1

### Patch Changes

- Updated dependencies [6beb531]
  - ai-functions@2.1.1
  - ai-database@2.1.1

## 2.0.3

### Patch Changes

- Updated dependencies
  - rpc.do@0.2.0
  - ai-database@2.0.3
  - ai-functions@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies
  - ai-functions@2.0.2
  - ai-database@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies
  - ai-database@2.0.1
  - ai-functions@2.0.1
