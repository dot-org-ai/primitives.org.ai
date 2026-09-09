# ai-primitives

## 2.0.2

### Patch Changes

- Updated dependencies [d574ed8]
- Updated dependencies [3111c86]
- Updated dependencies [b97d038]
- Updated dependencies [9ba30c2]
- Updated dependencies [eb9ec75]
- Updated dependencies [2d48c58]
- Updated dependencies [b907460]
- Updated dependencies [0f7dd9e]
- Updated dependencies [21a77e7]
- Updated dependencies [bd4697a]
- Updated dependencies [5c4c588]
- Updated dependencies [815a9ce]
- Updated dependencies [aef9570]
- Updated dependencies [fbad990]
- Updated dependencies [db0ede1]
- Updated dependencies [f9a8899]
- Updated dependencies [93803c4]
- Updated dependencies [d574ed8]
- Updated dependencies [b2c1c83]
  - ai-evaluate@3.0.0
  - ai-functions@2.5.0
  - ai-database@2.5.0
  - ai-experiments@2.5.0
  - ai-props@2.5.0
  - autonomous-agents@2.5.0
  - business-as-code@2.5.0
  - digital-products@2.5.0
  - digital-tasks@2.5.0
  - digital-tools@2.5.0
  - digital-workers@2.5.0
  - human-in-the-loop@2.5.0
  - services-as-software@2.5.0
  - ai-workflows@2.5.0
  - ai-providers@2.5.0
  - language-models@2.5.0

## 2.0.1

### Patch Changes

- Updated dependencies [4d58f5f]
- Updated dependencies [d30c2e8]
  - ai-functions@2.4.0
  - ai-evaluate@2.4.0
  - business-as-code@2.4.0
  - ai-database@2.4.0
  - ai-experiments@2.4.0
  - ai-props@2.4.0
  - autonomous-agents@2.4.0
  - digital-products@2.4.0
  - digital-tasks@2.4.0
  - digital-tools@2.4.0
  - digital-workers@2.4.0
  - human-in-the-loop@2.4.0
  - services-as-software@2.4.0
  - ai-workflows@2.4.0
  - ai-providers@2.4.0
  - language-models@2.4.0

## 2.0.0

### Major Changes

- d02083f: Backfill changeset for ai-primitives 1.0.0 (restructure from `9bf89c4`, 2026-01-28).

  `ai-primitives` was reconceived as the umbrella package re-exporting every AI primitive. The previous `0.1.0` on npm was an unrelated early stub (published 2025-05-06). The umbrella incarnation is a fresh contract and was authored at `1.0.0` deliberately; this changeset documents that intent so the version-bump is traceable.

  BREAKING CHANGES (carried from `9bf89c4`):

  - Removed `ai-core` package (merged into `ai-functions`).
  - `org.ai` is now types-focused (use `ai-primitives` for umbrella).
  - `autonomous-agents` no longer exports duplicate primitives.

  Migration:

  - `import { ... } from 'ai-primitives'` for the full umbrella surface.
  - `import { ... } from 'ai-functions'` for what previously came from `@org.ai/core`.
  - `import type { ... } from 'org.ai'` for shared types.

### Patch Changes

- Updated dependencies [9e2779a]
- Updated dependencies [b7c7c57]
- Updated dependencies [2787830]
- Updated dependencies [c858725]
  - ai-functions@2.3.0
  - ai-database@2.3.0
  - language-models@2.3.0
  - ai-evaluate@2.3.0
  - ai-experiments@2.3.0
  - ai-props@2.3.0
  - autonomous-agents@2.3.0
  - business-as-code@2.3.0
  - digital-products@2.3.0
  - digital-tasks@2.3.0
  - digital-tools@2.3.0
  - digital-workers@2.3.0
  - services-as-software@2.3.0
  - ai-providers@2.3.0
  - ai-workflows@2.3.0
  - human-in-the-loop@2.3.0
