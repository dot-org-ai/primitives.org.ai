import { describe, expect, it } from 'vitest'

import { canonicalize, deriveContentHash, deriveContentId } from '../src/ids/index.js'
import { migrateFromFnv1a, migrateFromFnv1aBatch } from '../src/ids/migrate.js'

// ─────────────────────────────────────────────────────────────────────────────
// canonicalize
// ─────────────────────────────────────────────────────────────────────────────

describe('canonicalize', () => {
  it('sorts keys deterministically', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }))
  })

  it('handles nested objects', () => {
    expect(canonicalize({ a: { y: 2, x: 1 } })).toBe(canonicalize({ a: { x: 1, y: 2 } }))
  })

  it('preserves array ordering', () => {
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]))
  })

  it('handles primitives', () => {
    expect(canonicalize(null)).toBe('null')
    expect(canonicalize(42)).toBe('42')
    expect(canonicalize('hello')).toBe('"hello"')
    expect(canonicalize(true)).toBe('true')
  })

  it('produces no whitespace', () => {
    expect(canonicalize({ a: 1, b: { c: 2 } })).toBe('{"a":1,"b":{"c":2}}')
  })

  it('converts Date via toISOString', () => {
    const d = new Date('2026-05-07T00:00:00.000Z')
    expect(canonicalize({ at: d })).toBe('{"at":"2026-05-07T00:00:00.000Z"}')
  })

  it('idempotent: canonicalize(canonicalize-shape) === canonicalize(input)', () => {
    const input = { z: 1, a: { y: 2, x: 1 } }
    const once = canonicalize(input)
    const reparsed = JSON.parse(once) as unknown
    const twice = canonicalize(reparsed)
    expect(twice).toBe(once)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deriveContentId — determinism + format
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveContentId', () => {
  it('is deterministic across calls', () => {
    const a = deriveContentId('companytype', { name: 'Foo', kind: 'B2B' })
    const b = deriveContentId('companytype', { name: 'Foo', kind: 'B2B' })
    expect(a).toBe(b)
  })

  it('is deterministic regardless of object key order', () => {
    const a = deriveContentId('service', { name: 'X', tier: 1, owner: 'a' })
    const b = deriveContentId('service', { tier: 1, owner: 'a', name: 'X' })
    const c = deriveContentId('service', { owner: 'a', name: 'X', tier: 1 })
    expect(a).toBe(b)
    expect(b).toBe(c)
  })

  it('preserves type prefix exactly', () => {
    expect(deriveContentId('companytype', { x: 1 })).toMatch(/^companytype_/)
    expect(deriveContentId('Service', { x: 1 })).toMatch(/^Service_/)
    expect(deriveContentId('mme', { x: 1 })).toMatch(/^mme_/)
  })

  it('default prefix is 12 hex chars', () => {
    expect(deriveContentId('t', { x: 1 })).toMatch(/^t_[0-9a-f]{12}$/)
  })

  it('prefix=16 returns 16 hex chars', () => {
    expect(deriveContentId('t', { x: 1 }, { prefix: 16 })).toMatch(/^t_[0-9a-f]{16}$/)
  })

  it('different inputs → different ids (basic)', () => {
    expect(deriveContentId('t', { x: 1 })).not.toBe(deriveContentId('t', { x: 2 }))
  })

  it('different types → different ids even with same content (type not mixed into hash)', () => {
    const a = deriveContentId('A', { x: 1 })
    const b = deriveContentId('B', { x: 1 })
    expect(a).not.toBe(b)
    // BUT the hex suffix is identical because type is not part of the hash.
    expect(a.slice(2)).toBe(b.slice(2))
  })

  it('arrays and objects with same shape but different element order → different ids', () => {
    expect(deriveContentId('t', [1, 2, 3])).not.toBe(deriveContentId('t', [3, 2, 1]))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deriveContentHash — bare hash without {type}_ wrapper
// ─────────────────────────────────────────────────────────────────────────────

describe('deriveContentHash', () => {
  it('returns 12 hex by default', () => {
    expect(deriveContentHash({ x: 1 })).toMatch(/^[0-9a-f]{12}$/)
  })

  it('honors prefix=16', () => {
    expect(deriveContentHash({ x: 1 }, { prefix: 16 })).toMatch(/^[0-9a-f]{16}$/)
  })

  it('matches the suffix of deriveContentId for the same input', () => {
    const id = deriveContentId('t', { x: 1 })
    const hash = deriveContentHash({ x: 1 })
    expect(id.endsWith(hash)).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Property-style: 100k random distinct inputs → no collisions
// ─────────────────────────────────────────────────────────────────────────────

describe('collision resistance (property test)', () => {
  it('100k distinct inputs produce 100k distinct ids (prefix=12)', () => {
    const seen = new Set<string>()
    let collisions = 0
    for (let i = 0; i < 100_000; i++) {
      // Distinct input via incrementing counter — guaranteed unique.
      const id = deriveContentId('t', { i, kind: 'collision-test' })
      if (seen.has(id)) collisions++
      seen.add(id)
    }
    expect(collisions).toBe(0)
    expect(seen.size).toBe(100_000)
  })

  it('100k distinct inputs produce 100k distinct ids (prefix=16)', () => {
    const seen = new Set<string>()
    let collisions = 0
    for (let i = 0; i < 100_000; i++) {
      const id = deriveContentId('t', { i, kind: 'wide' }, { prefix: 16 })
      if (seen.has(id)) collisions++
      seen.add(id)
    }
    expect(collisions).toBe(0)
    expect(seen.size).toBe(100_000)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// migrateFromFnv1a — FNV-1a → sha256
// ─────────────────────────────────────────────────────────────────────────────

describe('migrateFromFnv1a', () => {
  it('produces a deterministic new id from canonical input', () => {
    const input = { name: 'Foo', kind: 'B2B' }
    const oldId = 'companytype_a1b2c3d4e5f6a7b8' // synthetic FNV-1a id (16 hex)
    const r1 = migrateFromFnv1a('companytype', input, oldId)
    const r2 = migrateFromFnv1a('companytype', input, oldId)
    expect(r1.newId).toBe(r2.newId)
  })

  it('does NOT hash the old id — re-hashing the input is what produces the new id', () => {
    // If the helper accidentally hashed `oldId`, two different oldIds
    // with the same canonical input would produce different newIds.
    const input = { x: 1 }
    const a = migrateFromFnv1a('t', input, 't_aaaaaaaaaaaaaaaa')
    const b = migrateFromFnv1a('t', input, 't_bbbbbbbbbbbbbbbb')
    expect(a.newId).toBe(b.newId)
    expect(a.oldId).not.toBe(b.oldId)
  })

  it('preserves the type prefix on the new id', () => {
    const r = migrateFromFnv1a('companytype', { x: 1 }, 'companytype_a1b2c3d4e5f6a7b8')
    expect(r.newId.startsWith('companytype_')).toBe(true)
    expect(r.newId).toMatch(/^companytype_[0-9a-f]{12}$/)
    expect(r.type).toBe('companytype')
  })

  it('throws when oldId prefix does not match type', () => {
    expect(() => migrateFromFnv1a('companytype', { x: 1 }, 'service_a1b2c3d4e5f6a7b8')).toThrow(
      /does not start with/
    )
  })

  it('matches deriveContentId for the same canonical input', () => {
    const input = { foo: 'bar', n: 42 }
    const direct = deriveContentId('t', input)
    const migrated = migrateFromFnv1a('t', input, 't_dead0000beef0000').newId
    expect(migrated).toBe(direct)
  })

  it('honors prefix=16 opt', () => {
    const r = migrateFromFnv1a('t', { x: 1 }, 't_aaaaaaaaaaaaaaaa', { prefix: 16 })
    expect(r.newId).toMatch(/^t_[0-9a-f]{16}$/)
  })
})

describe('migrateFromFnv1aBatch', () => {
  it('returns results in input order, preserving oldId on each row', () => {
    const rows = [
      { type: 't', canonicalInput: { x: 1 }, oldId: 't_1111111111111111' },
      { type: 't', canonicalInput: { x: 2 }, oldId: 't_2222222222222222' },
      { type: 't', canonicalInput: { x: 3 }, oldId: 't_3333333333333333' },
    ]
    const results = migrateFromFnv1aBatch(rows)
    expect(results.length).toBe(3)
    expect(results[0]?.oldId).toBe(rows[0]?.oldId)
    expect(results[1]?.oldId).toBe(rows[1]?.oldId)
    expect(results[2]?.oldId).toBe(rows[2]?.oldId)
    // All newIds distinct (different inputs).
    expect(new Set(results.map((r) => r.newId)).size).toBe(3)
  })
})
