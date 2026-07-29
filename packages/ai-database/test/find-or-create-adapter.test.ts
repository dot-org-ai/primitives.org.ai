/**
 * Live FindPorts adapter (aip-cnks.4) — unit tests against an in-memory backend.
 *
 * The ai-functions gate core (`decide` + `collect` + `FindPorts`) is COMMITTED and
 * imported here, never redefined. This suite drives out the ai-database side:
 *  - a live `FindPorts` adapter (exact / lexical / vector / ratify / thresholds)
 *    backed by an in-memory store, and
 *  - the `findOrCreate` / `findOrCreateMany` / `findOrGenerate` materializers that
 *    run collect → decide → (link | mint | escalate).
 *
 * Real pgvector/FTS integration is deferred — see the note in find-or-create.ts.
 */
import { describe, it, expect } from 'vitest'
import { collect, decide } from 'ai-functions/find-or-create'
import type { ResolveInput, FindPorts } from 'ai-functions/find-or-create'
import {
  createFindPorts,
  findOrCreate,
  findOrCreateMany,
  findOrGenerate,
  EscalationRequired,
  InMemoryFindBackend,
} from '../src/find-or-create.js'

const band = { autoLink: 0.93, judgeFloor: 0.85 }

function fresh() {
  return new InMemoryFindBackend()
}

describe('createFindPorts — exact tier (normalized-key/name)', () => {
  it('finds an exact normalized-name match (case/space-insensitive)', async () => {
    const backend = fresh()
    const canonical = await backend.create('Problem', { name: 'Keep audit trails accurate' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    const input: ResolveInput = {
      text: '  keep   AUDIT trails accurate ',
      noun: 'Problem',
      mode: 'symmetric-collapse',
    }
    const hit = await ports.exact(input)
    expect(hit).not.toBeNull()
    expect(hit!.id).toBe(canonical.$id)
    expect(hit!.exact).toBe(true)
    expect(hit!.score).toBe(1)
  })

  it('matches on an explicit normalized key when provided', async () => {
    const backend = fresh()
    const sku = await backend.create('SKU', { code: 'ABC-123', key: 'abc-123' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    const hit = await ports.exact({ text: 'whatever', key: 'abc-123', noun: 'SKU', mode: 'symmetric-collapse' })
    expect(hit!.id).toBe(sku.$id)
  })

  it('returns null when there is no exact match', async () => {
    const backend = fresh()
    await backend.create('Problem', { name: 'Something else' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    const hit = await ports.exact({ text: 'no such name', noun: 'Problem', mode: 'symmetric-collapse' })
    expect(hit).toBeNull()
  })
})

describe('createFindPorts — lexical (FTS) + vector (ANN) tiers', () => {
  it('lexical returns keyword overlap candidates scored in [0,1]', async () => {
    const backend = fresh()
    await backend.create('Problem', { name: 'reconcile accounts receivable discrepancies' })
    await backend.create('Problem', { name: 'totally unrelated topic' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    const res = await ports.lexical({ text: 'reconcile discrepancies', noun: 'Problem', mode: 'asymmetric-match' })
    expect(res.length).toBeGreaterThan(0)
    expect(res[0]!.score).toBeGreaterThan(0)
    expect(res[0]!.score).toBeLessThanOrEqual(1)
    expect(res.every((c) => c.exact === false)).toBe(true)
  })

  it('vector embeds via the injected socket then runs ANN', async () => {
    const backend = fresh()
    const a = await backend.create('Problem', { name: 'keep audit trails accurate' })
    await backend.create('Problem', { name: 'ship the product faster' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    const res = await ports.vector({ text: 'maintain accurate audit logs', noun: 'Problem', mode: 'symmetric-collapse' })
    expect(res.length).toBeGreaterThan(0)
    // the audit-trail row should rank above the unrelated one
    expect(res[0]!.id).toBe(a.$id)
    expect(res[0]!.exact).toBe(false)
  })

  it('thresholds default to null (fail-safe) when no calibration injected', () => {
    const backend = fresh()
    const ports = createFindPorts(backend)
    expect(ports.thresholds('Problem')).toBeNull()
  })
})

describe('collect + the live adapter — ladder short-circuits', () => {
  it('an exact hit short-circuits the ladder (decide → link/exact)', async () => {
    const backend = fresh()
    const canonical = await backend.create('Problem', { name: 'Keep audit trails accurate' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    const evidence = await collect(
      { text: 'keep audit trails accurate', noun: 'Problem', mode: 'symmetric-collapse' },
      ports
    )
    expect(evidence.candidates).toHaveLength(1)
    expect(evidence.candidates[0]!.exact).toBe(true)
    const verdict = decide(evidence)
    expect(verdict.kind).toBe('link')
    if (verdict.kind === 'link') {
      expect(verdict.canonical).toBe(canonical.$id)
      expect(verdict.mechanism).toBe('exact')
    }
  })

  it('greenfield (no candidates) → decide mints', async () => {
    const backend = fresh()
    const ports = createFindPorts(backend, { thresholds: () => band })
    const evidence = await collect({ text: 'a brand new idea', noun: 'Problem', mode: 'symmetric-collapse' }, ports)
    expect(evidence.candidates).toHaveLength(0)
    expect(decide(evidence).kind).toBe('mint')
  })

  it('uncalibrated band fails safe to quarantine on a fuzzy match', async () => {
    const backend = fresh()
    await backend.create('Problem', { name: 'keep audit trails accurate' })
    const ports = createFindPorts(backend) // no thresholds → null band
    const evidence = await collect(
      { text: 'maintain accurate audit logs', noun: 'Problem', mode: 'symmetric-collapse' },
      ports
    )
    expect(evidence.band).toBeNull()
    expect(decide(evidence).kind).toBe('quarantine')
  })
})

describe('findOrCreate materializer', () => {
  it('link → reuses the canonical Thing (no new row)', async () => {
    const backend = fresh()
    const canonical = await backend.create('Problem', { name: 'Keep audit trails accurate' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    const before = backend.count('Problem')
    const res = await findOrCreate(
      { noun: 'Problem', mode: 'symmetric-collapse', text: 'keep audit trails accurate', data: { name: 'keep audit trails accurate' } },
      { ports, backend }
    )
    expect(res.decision).toBe('linked')
    expect(res.thing!.$id).toBe(canonical.$id)
    expect(backend.count('Problem')).toBe(before)
  })

  it('mint → persists a new Thing (embed-on-write so future finds match)', async () => {
    const backend = fresh()
    const ports = createFindPorts(backend, { thresholds: () => band })
    const res = await findOrCreate(
      { noun: 'Problem', mode: 'symmetric-collapse', text: 'a totally new problem', data: { name: 'a totally new problem' } },
      { ports, backend }
    )
    expect(res.decision).toBe('minted')
    expect(res.thing).not.toBeNull()
    expect(backend.count('Problem')).toBe(1)
    // embed-on-write: a follow-up exact find now links it
    const again = await findOrCreate(
      { noun: 'Problem', mode: 'symmetric-collapse', text: 'a totally new problem', data: { name: 'a totally new problem' } },
      { ports, backend }
    )
    expect(again.decision).toBe('linked')
    expect(again.thing!.$id).toBe(res.thing!.$id)
    expect(backend.count('Problem')).toBe(1)
  })

  it('quarantine → throws EscalationRequired by default', async () => {
    const backend = fresh()
    await backend.create('Industry', { name: 'Software' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    // closed pool + a fuzzy (non-exact) probe → quarantine
    await expect(
      findOrCreate(
        { noun: 'Industry', mode: 'asymmetric-match', text: 'off-rail unknown industry name', data: { name: 'off-rail unknown industry name' }, closedPool: true },
        { ports, backend }
      )
    ).rejects.toBeInstanceOf(EscalationRequired)
  })

  it('quarantine + onEscalate:mint → mints instead of throwing', async () => {
    const backend = fresh()
    const ports = createFindPorts(backend, { thresholds: () => band })
    const res = await findOrCreate(
      { noun: 'Industry', mode: 'asymmetric-match', text: 'novel industry', data: { name: 'novel industry' }, closedPool: true },
      { ports, backend, onEscalate: 'mint' }
    )
    expect(res.decision).toBe('minted')
    expect(backend.count('Industry')).toBe(1)
  })

  it('quarantine + onEscalate:skip → returns quarantined with a null thing', async () => {
    const backend = fresh()
    const ports = createFindPorts(backend, { thresholds: () => band })
    const res = await findOrCreate(
      { noun: 'Industry', mode: 'asymmetric-match', text: 'novel industry', data: { name: 'novel industry' }, closedPool: true },
      { ports, backend, onEscalate: 'skip' }
    )
    expect(res.decision).toBe('quarantined')
    expect(res.thing).toBeNull()
    expect(backend.count('Industry')).toBe(0)
  })
})

describe('findOrCreateMany — per-item verdicts (cohort)', () => {
  it('N references to one entity collapse to a single mint then links (cohort dedup)', async () => {
    const backend = fresh()
    const ports = createFindPorts(backend, { thresholds: () => band })
    const inputs = Array.from({ length: 5 }, () => ({
      noun: 'Founder',
      mode: 'symmetric-collapse' as const,
      text: 'Software Engineer',
      data: { name: 'Software Engineer' },
    }))
    const results = await findOrCreateMany(inputs, { ports, backend })
    expect(results).toHaveLength(5)
    expect(results.filter((r) => r.decision === 'minted')).toHaveLength(1)
    expect(results.filter((r) => r.decision === 'linked')).toHaveLength(4)
    expect(backend.count('Founder')).toBe(1)
    const ids = new Set(results.map((r) => r.thing!.$id))
    expect(ids.size).toBe(1)
  })
})

describe('findOrGenerate — gate then GENERATE on create', () => {
  it('link short-circuits without generating', async () => {
    const backend = fresh()
    const canonical = await backend.create('BlogPost', { title: 'Hello world', body: 'hi' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    let generated = false
    const res = await findOrGenerate(
      { noun: 'BlogPost', mode: 'symmetric-collapse', text: 'Hello world', seed: { title: 'Hello world' } },
      {
        ports,
        backend,
        generate: async () => {
          generated = true
          return { title: 'Hello world', body: 'generated' }
        },
      }
    )
    expect(res.decision).toBe('linked')
    expect(res.thing!.$id).toBe(canonical.$id)
    expect(generated).toBe(false)
  })

  it('mint → delegates to generate, then persists the generated entity', async () => {
    const backend = fresh()
    const ports = createFindPorts(backend, { thresholds: () => band })
    const res = await findOrGenerate(
      { noun: 'BlogPost', mode: 'symmetric-collapse', text: 'A novel post topic', seed: { title: 'A novel post topic' } },
      {
        ports,
        backend,
        generate: async (seed) => ({ title: (seed as { title: string }).title, body: 'AUTHORED BODY' }),
      }
    )
    expect(res.decision).toBe('minted')
    expect(res.thing!['body']).toBe('AUTHORED BODY')
    expect(backend.count('BlogPost')).toBe(1)
  })
})

describe('regression cases from the design doc', () => {
  it('two ICP junctions producing the same problem → one canonical, provenance kept', async () => {
    const backend = fresh()
    const ports = createFindPorts(backend, { thresholds: () => band })
    const r1 = await findOrCreate(
      { noun: 'Problem', mode: 'symmetric-collapse', text: 'Keep audit trails accurate', data: { name: 'Keep audit trails accurate' }, provenance: 'ICP:A' },
      { ports, backend }
    )
    const r2 = await findOrCreate(
      { noun: 'Problem', mode: 'symmetric-collapse', text: 'keep audit trails accurate', data: { name: 'keep audit trails accurate' }, provenance: 'ICP:B' },
      { ports, backend }
    )
    expect(r1.decision).toBe('minted')
    expect(r2.decision).toBe('linked')
    expect(r2.thing!.$id).toBe(r1.thing!.$id)
    expect(backend.count('Problem')).toBe(1)
    // provenance from BOTH sources is tracked on the canonical (never destructive merge)
    const prov = backend.provenanceOf('Problem', r1.thing!.$id)
    expect(prov).toContain('ICP:A')
    expect(prov).toContain('ICP:B')
  })

  it('closed pool → escalate, never mint', async () => {
    const backend = fresh()
    const ports = createFindPorts(backend, { thresholds: () => band })
    await expect(
      findOrCreate(
        { noun: 'Industry', mode: 'asymmetric-match', text: 'wholly unknown vertical', data: { name: 'wholly unknown vertical' }, closedPool: true },
        { ports, backend }
      )
    ).rejects.toBeInstanceOf(EscalationRequired)
    expect(backend.count('Industry')).toBe(0)
  })

  it('deterministic tie-break: equal-score candidates resolve to the lower id', async () => {
    // Two candidates at exactly equal score: decide() must pick the smaller id.
    const ports: FindPorts = {
      exact: async () => null,
      lexical: async () => [
        { id: 'id-b', score: 0.9, exact: false },
        { id: 'id-a', score: 0.9, exact: false },
      ],
      vector: async () => [],
      thresholds: () => ({ autoLink: 0.85, judgeFloor: 0.8 }),
    }
    const evidence = await collect({ text: 'x', noun: 'Problem', mode: 'symmetric-collapse' }, ports)
    const verdict = decide(evidence)
    expect(verdict.kind).toBe('link')
    if (verdict.kind === 'link') expect(verdict.canonical).toBe('id-a')
  })
})
