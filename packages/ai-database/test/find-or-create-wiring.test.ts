/**
 * aip-jo1o.1 + .2 — ai-database runtime wiring of the findOrCreate gate.
 *
 * .1: the `~>` (forward-fuzzy) and `<~` (backward-fuzzy) schema resolvers delegate
 *     their match-vs-mint DECISION to the committed gate core (collect → decide via
 *     `routeFuzzyRef`) instead of an ad-hoc `$score >= threshold` cutoff — while
 *     preserving the union-fallback metadata, array fan-out, $score/$scores, pending
 *     relations, nested resolution, and $generated metadata. The forward-fuzzy /
 *     backward-fuzzy / relation-operators suites are the regression net for that.
 *
 * .2: `findOrCreate` / `findOrGenerate` / `generate` are attached to the per-Noun
 *     proxy (alongside create/get/list/search/upsert), backed by `createFindPorts`
 *     over a live `DBProvider`-adapter backend, type-gated by the Noun's `$generation`
 *     policy (default 'auto'); a `$generation:'never'` Noun escalates CREATE.
 */
import { describe, it, expect, beforeEach, expectTypeOf } from 'vitest'
import { DB, setProvider, createMemoryProvider, EscalationRequired } from '../src/index.js'

describe('aip-jo1o.2 — $generation type-gating on the typed Noun proxy', () => {
  it('default (no $generation) Noun → generate / findOrGenerate PRESENT', () => {
    const { db } = DB({ BlogPost: { title: 'string', body: 'string' } })
    expectTypeOf(db.BlogPost).toHaveProperty('findOrCreate')
    expectTypeOf(db.BlogPost).toHaveProperty('generate')
    expectTypeOf(db.BlogPost).toHaveProperty('findOrGenerate')
  })

  it("'never' Noun → generate / findOrGenerate ABSENT at the type level", () => {
    const { db } = DB({ Customer: { name: 'string', $generation: 'never' } } as const)
    // findOrCreate is always present
    expectTypeOf(db.Customer).toHaveProperty('findOrCreate')
    // @ts-expect-error generate must be type-absent on a 'never' Noun
    db.Customer.generate
    // @ts-expect-error findOrGenerate must be type-absent on a 'never' Noun
    db.Customer.findOrGenerate
  })

  it("'auto' / 'review' Nouns → generate / findOrGenerate PRESENT", () => {
    const { db } = DB({
      Offer: { title: 'string', $generation: 'review' },
      Article: { title: 'string', $generation: 'auto' },
    } as const)
    expectTypeOf(db.Offer).toHaveProperty('generate')
    expectTypeOf(db.Article).toHaveProperty('findOrGenerate')
  })
})

describe('aip-jo1o.2 — per-Noun semantic-identity verbs on the proxy', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  it('exposes findOrCreate / generate / findOrGenerate alongside create/get/list', () => {
    const { db } = DB({
      Problem: { name: 'string' },
    })
    expect(typeof (db.Problem as Record<string, unknown>)['create']).toBe('function')
    expect(typeof (db.Problem as Record<string, unknown>)['findOrCreate']).toBe('function')
    expect(typeof (db.Problem as Record<string, unknown>)['generate']).toBe('function')
    expect(typeof (db.Problem as Record<string, unknown>)['findOrGenerate']).toBe('function')
  })

  it('findOrCreate mints a new row when greenfield, then links the duplicate', async () => {
    const { db } = DB({
      Problem: { name: 'string' },
    })
    const ops = db.Problem as unknown as {
      findOrCreate(input: {
        text: string
        data: Record<string, unknown>
      }): Promise<{ decision: string; thing: { $id: string } | null }>
    }

    const first = await ops.findOrCreate({
      text: 'Keep audit trails accurate',
      data: { name: 'Keep audit trails accurate' },
    })
    expect(first.decision).toBe('minted')
    expect(first.thing).not.toBeNull()

    const dup = await ops.findOrCreate({
      text: 'keep audit trails accurate',
      data: { name: 'keep audit trails accurate' },
    })
    expect(dup.decision).toBe('linked')
    expect(dup.thing!.$id).toBe(first.thing!.$id)
  })

  it("a Noun's generate verb persists a generated entity", async () => {
    const { db } = DB({
      BlogPost: { title: 'string', body: 'string' },
    })
    const ops = db.BlogPost as unknown as {
      generate(seed: Record<string, unknown>): Promise<{ $id: string; $type: string }>
    }
    const post = await ops.generate({ title: 'Hello world' })
    expect(post.$id).toBeDefined()
    expect(post.$type).toBe('BlogPost')
  })

  it("CREATE on a $generation:'never' Noun escalates rather than generating", async () => {
    const { db } = DB({
      Customer: { name: 'string', $generation: 'never' },
    })
    const ops = db.Customer as unknown as {
      findOrGenerate(input: { text: string; seed: Record<string, unknown> }): Promise<unknown>
    }
    await expect(
      ops.findOrGenerate({ text: 'Acme Corp', seed: { name: 'Acme Corp' } })
    ).rejects.toBeInstanceOf(EscalationRequired)
    // nothing minted
    const all = await db.Customer.list()
    expect(all).toHaveLength(0)
  })
})

describe('aip-jo1o.1 — ~>/<~ resolvers delegate the decision to the gate', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  it('~> links to an existing match (gate link → reuse the canonical id)', async () => {
    const { db } = DB({
      Startup: { customer: 'Who is the customer? ~>Customer' },
      Customer: { name: 'string', description: 'string' },
    })
    const existing = await db.Customer.create({
      name: 'Enterprise Buyer',
      description: 'VP of Engineering at Fortune 500',
    })
    const startup = await db.Startup.create({
      name: 'Acme',
      customerHint: 'Senior tech leaders at big companies',
    })
    const customer = await startup.customer
    expect(customer.$id).toBe(existing.$id)
  })

  it('~> mints (generates) when no match clears the band (gate mint → generate path)', async () => {
    const { db } = DB({
      Startup: { customer: 'Who is the customer? ~>Customer', $fuzzyThreshold: 0.99 },
      Customer: { name: 'string', description: 'string' },
    })
    await db.Customer.create({ name: 'Chef', description: 'Cooks food' })
    const startup = await db.Startup.create({
      name: 'Acme',
      customerHint: 'Machine learning researcher',
    })
    const customer = await startup.customer
    expect(customer.$generated).toBe(true)
  })

  it('<~ links to existing reference data and never generates', async () => {
    const { db } = DB({
      Company: { sector: 'Business sector <~Sector' },
      Sector: { name: 'string', code: 'string' },
    })
    const tech = await db.Sector.create({ name: 'Technology', code: 'TECH' })
    const company = await db.Company.create({
      name: 'MedTech Inc',
      sectorHint: 'Technology and software',
    })
    const sector = await company.sector
    expect([tech.$id]).toContain(sector.$id)
    const all = await db.Sector.list()
    expect(all).toHaveLength(1)
  })
})
