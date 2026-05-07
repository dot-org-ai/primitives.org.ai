# @primitives/content-derived-id

Canonical sha256-prefix-12 content-derived ID generator for icps,
services-builder, and startup-builder.

```ts
import { deriveContentId } from '@primitives/content-derived-id'

deriveContentId('companytype', { name: 'Foo', kind: 'B2B' })
// → 'companytype_8f3a91b2c0e5'

deriveContentId('service', payload, { prefix: 16 })
// → 'service_8f3a91b2c0e51234'  (64-bit width)
```

## Format

```
{type}_{12hex}        // default — 48-bit hash
{type}_{16hex}        // opt-in via { prefix: 16 } — 64-bit hash
```

The hex prefix is taken from
`sha256(canonicalJSON(input)).slice(0, prefix)`. The `type` tag is the
entity type (`'companytype'`, `'service'`, `'startup'`, `'mme'`, …); it
prefixes the id but is NOT mixed into the hash. Two distinct types with
byte-identical input produce different ids (different prefixes) but the
same hex suffix.

The `_` separator (not `-`) is so the id is selectable with one
double-click in terminals/editors — `_` is a word character in standard
word-boundary regex; `-` is not.

## Why sha256-prefix-12 (not FNV-1a 64-bit)

icps's predecessor `content-hash.ts` used FNV-1a 64-bit
(`{type}_{16hex}`) — birthday-bound collision threshold ~4 billion (2^32),
fine for icps's ~290K row corpus.

startup-builder operates at 1M+ scale (1M Services × ~5 brands per
Service = ~5M startups + 50M+ artifacts). At that scale FNV-1a 64-bit's
birthday threshold isn't comfortable, AND FNV-1a is not collision-
resistant against adversarial inputs. Cross-repo writes into a shared
Neon `docs` table need a stronger guarantee.

sha256 prefix-12 (48-bit hash):

| Population | P(collision) |
|---:|---:|
| 1k    | ~1.8 × 10⁻⁸ |
| 100k  | ~1.8 × 10⁻⁴ |
| 1M    | ~1.8 × 10⁻² (≈ 1.8%) |
| 5M    | ~44%        |
| 16M   | ~63%        |

For ≥100M scale, opt into `prefix: 16` (~4 billion threshold, matching
icps's old FNV-1a width but with cryptographic collision resistance):

| Population | P(collision) |
|---:|---:|
| 1M    | ~1.1 × 10⁻⁷ |
| 100M  | ~1.1 × 10⁻³ |
| 1B    | ~10.8%      |

For startup-builder's projected 5M startups, the default (prefix=12)
sits at ~44% birthday-bound probability — that's the upper bound under
worst-case uniform random sampling. In practice the inputs are NOT
uniform random; they're structured (entity name + canonical fields) and
the type-tag partitions the keyspace. Real collision rates are
substantially lower. For 100M+ scale or shared-tenancy databases, use
`prefix: 16`.

## Canonical JSON normalization rule

The same logical input MUST produce the same hash regardless of object
key ordering on the producer side. This package normalizes input by:

1. **Recursive sort of object keys** (alphabetical, code-point order).
2. **Arrays preserve their order** — `[1, 2]` and `[2, 1]` are distinct.
3. **`JSON.stringify` with no replacer and no indent** — no incidental
   whitespace, no trailing newlines.
4. **`undefined` values inside objects are dropped**; inside arrays they
   become `null` (matches native `JSON.stringify`).
5. **`Date` is converted via `.toISOString()`** (matches native
   `JSON.stringify`).
6. **Non-finite numbers (`NaN`, `±Infinity`) become `null`** (matches
   native `JSON.stringify`).

Producer-side `JSON.stringify` is NOT enough — V8 preserves insertion
order which differs across producers, network round-trips, and
deserializers. Always use `canonicalize` before hashing.

This implementation INTENTIONALLY does NOT strip timestamp keys (the
icps predecessor stripped `createdAt/updatedAt/timestamp/...`). Callers
who want that behavior should pre-process their input before passing
it in. Keeping the canonicalization rule simple here is more valuable
than smuggling a domain-specific opinion into a primitive.

## Migration from FNV-1a 64-bit

icps's existing rows use `{type}_{16hex}` FNV-1a ids. To migrate to
sha256-prefix-12:

```ts
import { migrateFromFnv1a } from '@primitives/content-derived-id/migrate'

// For each existing row in `docs`:
const result = migrateFromFnv1a('companytype', row.data, row.id)
// result.newId  → 'companytype_8f3a91b2c0e5' (sha256-prefix-12)
// result.oldId  → 'companytype_a1b2c3d4e5f6a7b8' (preserved for audit)

// Update the row's id + every `rels` row referencing it.
// Optionally write { _migration: { oldId: result.oldId } } into data.
```

The migration helper re-hashes the **canonical input** that originally
produced the FNV-1a id. It does NOT hash the FNV-1a id itself — that
would lose content-addressability and make the migration
non-deterministic across producers.

See [dot-do/icps#2](https://github.com/dot-do/icps/issues/2) for the
icps-side migration plan.

## API

```ts
// Main entry — derive a `{type}_{12hex}` (or `{type}_{16hex}`) id.
deriveContentId(type: string, input: unknown, opts?: { prefix?: 12 | 16 }): string

// Bare hash without the `{type}_` wrapper. Useful for callers who
// build their own id format (e.g. studio's `:v1`-suffixed strings).
deriveContentHash(input: unknown, opts?: { prefix?: 12 | 16 }): string

// Canonical-JSON normalization. Exposed for callers who want to
// pre-canonicalize / cache the canonical string.
canonicalize(value: unknown): string

// FNV-1a → sha256 migration helper.
migrateFromFnv1a(
  type: string,
  canonicalInput: unknown,
  oldId: string,
  opts?: { prefix?: 12 | 16 },
): { newId: string; oldId: string; type: string }

// Batch migration helper.
migrateFromFnv1aBatch(
  rows: ReadonlyArray<{ type: string; canonicalInput: unknown; oldId: string }>,
  opts?: { prefix?: 12 | 16 },
): MigrateResult[]
```

## Cross-repo lock

This package locks the ID format for:

- **icps** — migrate FNV-1a → sha256-prefix-12 via `migrateFromFnv1a`
- **services-builder** — adopt from day one (P0 URGENT — pre-mint)
- **startup-builder** — already on sha256, with a different shape
  (`{prefix}:{16hex}:v1`); separate codec required for studio adoption
