/**
 * @graphdl/core / ids — content-derived IDs.
 *
 * Canonical sha256-prefix-12 content-derived ID generator. Locks the ID
 * shape across icps + services-builder + startup-builder (and any future
 * graphdl consumer) so multiple repos can share a single address space
 * without birthday collisions or silent format drift.
 *
 * Consume via the subpath export:
 *
 *   import { deriveContentId, canonicalize } from '@graphdl/core/ids'
 *
 * Equivalent symbols are also re-exported from the package root for
 * convenience (`@graphdl/core` works too).
 *
 * See `derive.ts` for the full spec + collision math + migration plan.
 */

export { deriveContentId, deriveContentHash, type DeriveOpts, type Prefix } from './derive.js'

export { canonicalize } from './canonical-json.js'

export { migrateFromFnv1a, migrateFromFnv1aBatch, type MigrateResult } from './migrate.js'
