# ai-primitives

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
