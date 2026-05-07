/**
 * FNV-1a 64-bit → sha256-prefix-12 migration helpers.
 *
 * Used by icps's FNV-1a → sha256 migration (see dot-do/icps#2). The
 * critical property: re-hashing the original CANONICAL INPUT is what
 * produces the new id. Re-hashing the FNV-1a id itself would lose the
 * content-addressability and break determinism across producers.
 *
 * Migration plan (icps-side):
 *
 *   1. For every existing `{type}_{16hex}` (FNV-1a) row in `docs`, look
 *      up the original canonical input that produced it (the `data` JSONB
 *      column IS the canonical input, by construction).
 *   2. Call `migrateFromFnv1a(type, data, oldId)` to get the new id.
 *   3. Update the row's primary key + every `rels` row that references
 *      it. Optionally write the old id into `data._migration.oldId` for
 *      audit.
 *
 * Migration plan (startup-builder + services-builder):
 *
 *   - startup-builder already uses sha256, but with a DIFFERENT format
 *     (`{prefix}:{16hex}:v1`). For that style, callers should NOT use
 *     this migration helper — they're already on sha256, just with a
 *     different shape. A separate `studio-format → primitives-format`
 *     codec can be added if/when the studio adopts this package.
 *   - services-builder hasn't picked yet (this is why the package is P0
 *     URGENT). Once they consume `@primitives/content-derived-id` from
 *     day one, no migration is ever needed on their side.
 */

import { deriveContentId, type DeriveOpts } from './derive.js'

/**
 * Result of a FNV-1a → sha256 migration step.
 */
export interface MigrateResult {
  /** The new sha256-prefix-12 (or -16) id, ready to write to the row. */
  newId: string
  /** The previous FNV-1a id, preserved for audit/rollback. */
  oldId: string
  /** The type-tag prefix, preserved across the migration. */
  type: string
}

/**
 * Migrate one row from FNV-1a 64-bit (`{type}_{16hex}`) to sha256-prefix-12
 * (`{type}_{12hex}`).
 *
 * Inputs:
 *
 *   - `type`: the type-tag prefix. MUST match the prefix on `oldId`
 *     (asserted at runtime).
 *   - `canonicalInput`: the ORIGINAL canonical input that produced
 *     `oldId`. NOT the `oldId` itself — re-hashing the id would lose
 *     content-addressability.
 *   - `oldId`: the existing FNV-1a id. Preserved on the result for
 *     audit / rollback.
 *   - `opts`: forwarded to `deriveContentId`. Defaults to `{ prefix: 12 }`.
 *
 * Throws if `oldId` does not start with `{type}_`.
 */
export function migrateFromFnv1a(
  type: string,
  canonicalInput: unknown,
  oldId: string,
  opts: DeriveOpts = {}
): MigrateResult {
  const expectedPrefix = `${type}_`
  if (!oldId.startsWith(expectedPrefix)) {
    throw new Error(
      `migrateFromFnv1a: oldId ${JSON.stringify(oldId)} does not start with ` +
        `expected type prefix ${JSON.stringify(expectedPrefix)}`
    )
  }
  const newId = deriveContentId(type, canonicalInput, opts)
  return { newId, oldId, type }
}

/**
 * Batch helper: migrate an array of rows in one call. Each row is
 * `{ type, canonicalInput, oldId }`. Returns the migration results in
 * the same order.
 *
 * Pure / no-IO — callers handle the actual database UPDATE statements.
 */
export function migrateFromFnv1aBatch(
  rows: ReadonlyArray<{
    type: string
    canonicalInput: unknown
    oldId: string
  }>,
  opts: DeriveOpts = {}
): MigrateResult[] {
  return rows.map((r) => migrateFromFnv1a(r.type, r.canonicalInput, r.oldId, opts))
}
