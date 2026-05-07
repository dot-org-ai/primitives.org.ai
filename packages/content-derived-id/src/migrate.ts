/**
 * RED stub — implementation lands in the GREEN commit.
 */
import type { DeriveOpts } from './derive.js'

export interface MigrateResult {
  newId: string
  oldId: string
  type: string
}

export function migrateFromFnv1a(
  _type: string,
  _canonicalInput: unknown,
  _oldId: string,
  _opts: DeriveOpts = {}
): MigrateResult {
  throw new Error('migrateFromFnv1a: not implemented (RED)')
}

export function migrateFromFnv1aBatch(
  _rows: ReadonlyArray<{
    type: string
    canonicalInput: unknown
    oldId: string
  }>,
  _opts: DeriveOpts = {}
): MigrateResult[] {
  throw new Error('migrateFromFnv1aBatch: not implemented (RED)')
}
