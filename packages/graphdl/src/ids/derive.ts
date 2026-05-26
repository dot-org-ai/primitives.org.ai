/**
 * Canonical content-derived ID generator.
 *
 * Format: `{type}_{12hex}` (default) or `{type}_{16hex}` (opt-in).
 *
 * The hex is the prefix of `sha256(canonicalJSON(input))` — see
 * `./canonical-json.ts` for the JSON normalization rules.
 *
 * ── Why sha256-prefix-12 (not FNV-1a 64-bit) ──────────────────────────
 *
 * 12 hex chars = 48 bits. Birthday-bound collision threshold ~16M (2^24).
 * For startup-builder's projected scale (1M Services × ~5 brands each =
 * ~5M startups), 16M is a comfortable margin.
 *
 * 16 hex chars = 64 bits. Birthday threshold ~4B (2^32). Use this when
 * the address space is genuinely 100M+; opt in via `{ prefix: 16 }`.
 *
 * The icps repo previously used FNV-1a 64-bit. FNV-1a is fast but is NOT
 * a cryptographic hash — adversaries can construct collisions. Inside a
 * single repo where IDs are derived from internal data, that's tolerable;
 * across three repos sharing the same address space (icps + services-
 * builder + startup-builder all writing to the same Neon `docs` rows),
 * the collision-resistance guarantee starts to matter. sha256 also makes
 * id == hash a single-step verification (`sha256(canonicalJSON(input))
 * .startsWith(idHexPart)`), useful for content-addressing audits.
 *
 * ── Why underscore separator (not hyphen) ─────────────────────────────
 *
 * `_` is a word character in standard word-boundary regex; `-` is not.
 * `companytype_8f3a91b2c0e5` is selectable with one double-click in
 * terminals/editors; `companytype-8f3a91b2c0e5` requires triple-click
 * or manual highlight. Inherited from icps + sb conventions.
 */

import { createHash } from 'node:crypto'

import { canonicalize } from './canonical-json.js'

export type Prefix = 12 | 16

export interface DeriveOpts {
  /** Hex-prefix length. 12 (default, ~16M threshold) or 16 (~4B threshold). */
  prefix?: Prefix
}

const DEFAULT_PREFIX: Prefix = 12

/**
 * Derive a content-derived ID for the given input.
 *
 * `type` is the entity-type tag prefixed onto the id (e.g. `'companytype'`,
 * `'service'`, `'startup'`). It is NOT mixed into the hash — two distinct
 * types with byte-identical input will produce DIFFERENT ids
 * (`companytype_<hex>` vs `service_<hex>`) but the SAME hex suffix.
 * Callers who want the type to influence the hash should include it
 * inside `input`.
 *
 * Idempotent: same `(type, input)` → same id, byte-identical, across
 * processes / machines / restarts / Node versions.
 */
export function deriveContentId(type: string, input: unknown, opts: DeriveOpts = {}): string {
  const prefix = opts.prefix ?? DEFAULT_PREFIX
  const hex = sha256Hex(canonicalize(input)).slice(0, prefix)
  return `${type}_${hex}`
}

/**
 * Hash arbitrary canonical-JSON-shaped input and return the prefix-N hex
 * (no `{type}_` wrapper). Useful for callers who want the hash but build
 * their own id format (e.g. `:v1`-suffixed strings in startup-builder's
 * studio).
 */
export function deriveContentHash(input: unknown, opts: DeriveOpts = {}): string {
  const prefix = opts.prefix ?? DEFAULT_PREFIX
  return sha256Hex(canonicalize(input)).slice(0, prefix)
}

/**
 * Node-native sha256 → lowercase hex. Inlined so the package has zero
 * runtime dependencies (only `node:crypto`).
 *
 * For Cloudflare Worker / web-runtime callers, the SubtleCrypto
 * (`crypto.subtle.digest('SHA-256', ...)`) path produces byte-identical
 * output but is async; a `deriveContentIdAsync` variant can be added in
 * a future minor version if needed.
 */
function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}
