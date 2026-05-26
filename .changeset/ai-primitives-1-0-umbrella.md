---
"ai-primitives": major
---

Backfill changeset for ai-primitives 1.0.0 (restructure from `9bf89c4`, 2026-01-28).

`ai-primitives` was reconceived as the umbrella package re-exporting every AI primitive. The previous `0.1.0` on npm was an unrelated early stub (published 2025-05-06). The umbrella incarnation is a fresh contract and was authored at `1.0.0` deliberately; this changeset documents that intent so the version-bump is traceable.

BREAKING CHANGES (carried from `9bf89c4`):
- Removed `ai-core` package (merged into `ai-functions`).
- `org.ai` is now types-focused (use `ai-primitives` for umbrella).
- `autonomous-agents` no longer exports duplicate primitives.

Migration:
- `import { ... } from 'ai-primitives'` for the full umbrella surface.
- `import { ... } from 'ai-functions'` for what previously came from `@org.ai/core`.
- `import type { ... } from 'org.ai'` for shared types.
