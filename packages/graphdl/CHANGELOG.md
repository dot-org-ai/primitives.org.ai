# @graphdl/core

## 0.4.0

### Minor Changes

- aff0c81: Fold content-derived-id primitive into @graphdl/core (consolidate accidentally-scoped @primitives/content-derived-id).

  The canonical sha256-prefix-12 content-derived ID generator (`{type}_{12hex}` format with key-sorted JSON canonicalization, plus the FNV-1a → sha256 migration helper) now lives inside `@graphdl/core` under `src/ids/`.

  Two ways to import:

  - Subpath: `import { deriveContentId, canonicalize } from '@graphdl/core/ids'`
  - Root: `import { deriveContentId, canonicalize } from '@graphdl/core'` (re-exported for convenience)

  The standalone `@primitives/content-derived-id` package is removed — it was accidentally scoped under `@primitives/`, an npm scope we do not own, and is content-addressing machinery that belongs alongside graphdl's noun/verb/relationship primitives.
