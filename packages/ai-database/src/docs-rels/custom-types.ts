/**
 * Canonical Postgres custom types: pgvector + tsvector.
 *
 * These three types are copy-pasted in three downstream repos
 * (icps, services-builder, startup-builder). Lifting them to a shared module
 * eliminates drift and gives every consumer a single canonical
 * representation.
 *
 * The canonical embedding storage type is `halfvec(1536)` — half-precision
 * (FP16) storage for 1536-dimension Gemini embeddings. This halves disk +
 * RAM relative to `vector(1536)` while keeping cosine recall within rounding
 * error for the gemini-embedding-2 distribution. Every consumer should
 * migrate from `vector` → `halfvec` on the next schema bump; the legacy
 * `vector(dim)` factory is retained for staged migrations.
 */

import { customType } from 'drizzle-orm/pg-core'

/**
 * Half-precision (FP16) pgvector column. Canonical embedding storage.
 *
 * Requires pgvector >= 0.7 (halfvec was added in 0.7.0). On Neon Postgres
 * the `vector` extension at default version satisfies this.
 *
 * Storage: 2 bytes/dim (vs 4 bytes/dim for `vector`). At 1536d that's
 * 3072 bytes/row vs 6144 — half the disk + buffer cache pressure.
 *
 * Recall: empirically within rounding error of FP32 cosine for gemini-
 * embedding-2's distribution (the embedding vectors are L2-normalized at
 * generation time so the half-precision quantization noise is uniform).
 */
export const halfvec = (dim: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType: () => `halfvec(${dim})`,
    toDriver: (v) => `[${v.join(',')}]`,
    fromDriver: (v) => JSON.parse(v) as number[],
  })

/**
 * Full-precision (FP32) pgvector column. Legacy storage type.
 *
 * Retained for migration paths off the existing `vector(1536)` columns
 * shipped in icps + services-builder + startup-builder before the
 * canonical halfvec spine was extracted.
 */
export const vector = (dim: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType: () => `vector(${dim})`,
    toDriver: (v) => `[${v.join(',')}]`,
    fromDriver: (v) => JSON.parse(v) as number[],
  })

/**
 * Postgres tsvector column for full-text search. The actual `to_tsvector`
 * computation is set up as a generated-stored expression on the column
 * definition — this customType is just the storage-side declaration.
 */
export const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
})

/**
 * Default embedding dimension for the canonical schema.
 *
 * 1536 is the native output dim of `gemini-embedding-2`.
 */
export const DEFAULT_EMBEDDING_DIM = 1536

/**
 * Default embedding model id for the canonical schema.
 *
 * Plain `gemini-embedding-2` with no provider prefix. This matches the
 * choice made by icps + services-builder. startup-builder's existing
 * `'google/gemini-embedding-2'` (with provider prefix) is migrating to
 * this canonical form.
 */
export const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-2'
