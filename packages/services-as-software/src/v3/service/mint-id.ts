/**
 * `mintServiceId(spec)` — deterministic MDXLD `$id` for a Service.
 *
 * Per v3 §5, every Service carries a stable `$id` derived from its
 * (name + cascade-signature + version) so re-running `Service.define()` with
 * the same spec yields the same id (idempotent registration), while a
 * material change to the cascade produces a new id (so the catalog can
 * coexist v1 and v2 of the same name — see v3 §14 versioning open decision).
 *
 * Format: `'svc:' + slug(name) + ':' + hash16`
 *
 * Where `hash16` is the first 16 hex chars of a stable hash of:
 *   - the Service name
 *   - the cascade signature (ordered list of `<kind>:<name>` per FunctionRef)
 *   - the optional version string (defaults to `'1'`)
 *
 * The 16-hex-char prefix gives 64 bits of collision resistance — comfortably
 * enough for catalog uniqueness within a single tenant. Round-5 work may add
 * a tenant-id prefix once persistence wires through.
 *
 * @packageDocumentation
 */

import type { ServiceSpec } from '../service-spec.js'

// ============================================================================
// Slug + hash helpers
// ============================================================================

/**
 * Reduce an arbitrary name to a stable, lowercase, hyphen-joined slug.
 * Mirrors the helper in `digital-tools/src/function-sugar.ts`.
 */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * FNV-1a 64-bit hash, returned as a 16-character zero-padded hex string.
 *
 * We avoid `crypto.subtle` because:
 *   - it returns a Promise (would force `mintServiceId` async)
 *   - it pulls in WebCrypto polyfills on older Node targets
 *
 * FNV-1a is *not* cryptographically secure, but is sufficient for the
 * catalog-uniqueness use case (no adversarial input — the Service author
 * controls the spec).
 */
function fnv1a64(input: string): string {
  // FNV-1a 64-bit constants (BigInt-safe)
  const offset = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn

  let hash = offset
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i)
    hash ^= BigInt(code)
    hash = (hash * prime) & mask
  }
  return hash.toString(16).padStart(16, '0')
}

// ============================================================================
// Cascade signature
// ============================================================================

/**
 * Build a stable, ordered signature of the spec's cascade. Order matters —
 * reordering steps yields a different signature (and therefore a different
 * id), per ADR-0006 re-verify rules in v3 §11.
 */
function cascadeSignature(spec: ServiceSpec<unknown, unknown>): string {
  const steps = spec.binding?.cascade ?? []
  return steps.map((fn) => `${fn.kind}:${fn.name}`).join('|')
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Mint a deterministic `svc:<slug>:<hash16>` MDXLD `$id` for the spec.
 *
 * The result is stable for any spec with the same `(name, cascade-signature,
 * version)` triple — so calling `Service.define()` twice with the same spec
 * registers the same id (idempotent overwrite path in
 * `ServiceLifecycle.draft()`).
 *
 * @param spec  the {@link ServiceSpec} after archetype-default merging
 * @param version optional version string; defaults to `'1'`
 */
export function mintServiceId(spec: ServiceSpec<unknown, unknown>, version: string = '1'): string {
  const key = JSON.stringify({
    name: spec.name,
    cascade: cascadeSignature(spec),
    version,
  })
  return `svc:${slug(spec.name)}:${fnv1a64(key)}`
}
