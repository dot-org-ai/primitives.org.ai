/**
 * Tests for the cascade orchestrator (queue-spine, ④).
 *
 * TDD: the pure expander/queue core, driven entirely by in-memory fake ports —
 * no DB, no LLM, no embeddings. Drives out cycle detection (visited-set),
 * Draft/Resolve two-phase expansion, online/offline per-Noun timing, prompt-context
 * chaining, and admission control via the injected findOrCreate gate
 * (link → reuse / mint → enqueue / escalate → defer).
 */

import { describe, it, expect } from 'vitest'
import {
  runCascade,
  type AdmissionVerdict,
  type CascadeRef,
  type Draft,
  type GeneratePort,
  type AdmitPort,
  type StorePort,
  type NounPolicy,
  type CascadeResult,
} from '../src/cascade/index.js'

// ---------------------------------------------------------------------------
// In-memory fake ports
// ---------------------------------------------------------------------------

/** A canned graph: each (noun,text) generates a fixed output + child refs. */
type Spec = Record<string, { output: unknown; refs?: CascadeRef[] }>

function fakeGenerate(spec: Spec, log?: string[]): GeneratePort {
  return {
    async generate(node) {
      log?.push(`gen:${node.ref.noun}:${node.ref.text}`)
      const entry = spec[`${node.ref.noun}:${node.ref.text}`]
      const refs = entry?.refs ?? []
      // Prove prompt-context chaining: child refs inherit a context derived
      // from this node's output unless they set their own.
      const chained = refs.map((r) =>
        r.context === undefined ? { ...r, context: { parent: entry?.output } } : r
      )
      return { output: entry?.output ?? { generated: node.ref.text }, refs: chained }
    },
  }
}

/**
 * An admit port driven by a canonical map: text → existing canonical id (link),
 * a set of escalating texts (escalate), else mint. Records each call.
 */
function fakeAdmit(opts: {
  links?: Record<string, string>
  escalate?: string[]
  calls?: CascadeRef[]
}): AdmitPort {
  return {
    async admit(ref) {
      opts.calls?.push(ref)
      const key = `${ref.noun}:${ref.text}`
      if (opts.escalate?.includes(key)) {
        return { kind: 'escalate', reason: 'ambiguous', confidence: 0.88 }
      }
      const canonical = opts.links?.[key]
      if (canonical) {
        return { kind: 'link', canonical, reason: 'exact', confidence: 1 }
      }
      return { kind: 'mint', reason: 'greenfield', confidence: 0 }
    },
  }
}

function fakeStore(): { port: StorePort; stored: Array<{ ref: CascadeRef; output: unknown }> } {
  const stored: Array<{ ref: CascadeRef; output: unknown }> = []
  return {
    stored,
    port: {
      async store(node) {
        const id = `${node.ref.noun}#${stored.length}`
        stored.push({ ref: node.ref, output: node.output })
        return id
      },
    },
  }
}

function ref(noun: string, text: string, extra: Partial<CascadeRef> = {}): CascadeRef {
  return { noun, text, mode: 'symmetric-collapse', ...extra }
}

describe('runCascade — queue-spine orchestrator', () => {
  it('expands a linear chain, minting each node and storing it', async () => {
    const spec: Spec = {
      'Post:hello': { output: { title: 'hello' }, refs: [ref('Author', 'ada')] },
      'Author:ada': { output: { name: 'ada' }, refs: [] },
    }
    const store = fakeStore()
    const result = await runCascade({
      root: ref('Post', 'hello'),
      ports: { generate: fakeGenerate(spec), admit: fakeAdmit({}), store: store.port },
    })

    expect(result.minted).toEqual(['Post#0', 'Author#1'])
    expect(result.linked).toEqual([])
    expect(result.escalated).toEqual([])
    expect(store.stored.map((s) => s.ref.text)).toEqual(['hello', 'ada'])
  })

  it('LINK short-circuits: a linked ref reuses the canonical, never enqueues a child', async () => {
    const spec: Spec = {
      'Post:hello': { output: { title: 'hello' }, refs: [ref('Author', 'ada')] },
      // If Author:ada were ever generated this would add a child — it must NOT be.
      'Author:ada': { output: { name: 'ada' }, refs: [ref('Org', 'should-not-appear')] },
    }
    const store = fakeStore()
    const result = await runCascade({
      root: ref('Post', 'hello'),
      ports: {
        generate: fakeGenerate(spec),
        admit: fakeAdmit({ links: { 'Author:ada': 'canonical-ada' } }),
        store: store.port,
      },
    })

    expect(result.minted).toEqual(['Post#0'])
    expect(result.linked).toEqual([{ ref: 'Author:ada', canonical: 'canonical-ada' }])
    expect(store.stored.map((s) => s.ref.text)).toEqual(['hello'])
  })

  it('ESCALATE defers: an escalated ref is recorded and never generated/enqueued', async () => {
    const spec: Spec = {
      'Post:hello': { output: { title: 'hello' }, refs: [ref('Author', 'ambiguous')] },
      'Author:ambiguous': { output: {}, refs: [ref('Org', 'should-not-appear')] },
    }
    const store = fakeStore()
    const result = await runCascade({
      root: ref('Post', 'hello'),
      ports: {
        generate: fakeGenerate(spec),
        admit: fakeAdmit({ escalate: ['Author:ambiguous'] }),
        store: store.port,
      },
    })

    expect(result.minted).toEqual(['Post#0'])
    expect(result.escalated).toEqual([{ ref: 'Author:ambiguous', reason: 'ambiguous' }])
    expect(store.stored.map((s) => s.ref.text)).toEqual(['hello'])
  })

  it('detects cycles via the visited-set (Post → Author → Org → Posts), no infinite recursion', async () => {
    const spec: Spec = {
      'Post:p': { output: {}, refs: [ref('Author', 'a')] },
      'Author:a': { output: {}, refs: [ref('Org', 'o')] },
      'Org:o': { output: {}, refs: [ref('Post', 'p')] }, // cycle back to the root
    }
    const gens: string[] = []
    const store = fakeStore()
    const result = await runCascade({
      root: ref('Post', 'p'),
      ports: { generate: fakeGenerate(spec, gens), admit: fakeAdmit({}), store: store.port },
    })

    // Each distinct node generated exactly once; the back-edge is dropped.
    expect(gens.sort()).toEqual(['gen:Author:a', 'gen:Org:o', 'gen:Post:p'])
    expect(result.minted.length).toBe(3)
    expect(result.skipped).toEqual([{ ref: 'Post:p', reason: 'visited' }])
  })

  it('within-parent dedup: array refs ["AI","ML","AI"] resolve AI once', async () => {
    const spec: Spec = {
      'Doc:d': {
        output: {},
        refs: [ref('Tag', 'AI'), ref('Tag', 'ML'), ref('Tag', 'AI')],
      },
      'Tag:AI': { output: {}, refs: [] },
      'Tag:ML': { output: {}, refs: [] },
    }
    const calls: CascadeRef[] = []
    const store = fakeStore()
    const result = await runCascade({
      root: ref('Doc', 'd'),
      ports: { generate: fakeGenerate(spec), admit: fakeAdmit({ calls }), store: store.port },
    })

    const admittedTags = calls.filter((c) => c.noun === 'Tag').map((c) => c.text)
    expect(admittedTags).toEqual(['AI', 'ML']) // second AI deduped, not re-admitted
    expect(result.minted.filter((m) => m.startsWith('Tag')).length).toBe(2)
  })
})

describe('runCascade — DAG re-convergence (provenance, not a cycle)', () => {
  it('a ref re-reached after it was minted links to the minted canonical (provenance kept)', async () => {
    // Two ICP junctions both surface the same Problem. The first mints it; the
    // second re-convergence must LINK to the minted canonical, not silently drop
    // and not re-mint (regression case 1: one canonical Problem linked to ≥2 ICPs).
    const spec: Spec = {
      'Root:r': { output: {}, refs: [ref('Icp', 'a'), ref('Icp', 'b')] },
      'Icp:a': { output: {}, refs: [ref('Problem', 'audit-trails')] },
      'Icp:b': { output: {}, refs: [ref('Problem', 'audit-trails')] },
      'Problem:audit-trails': { output: {}, refs: [] },
    }
    const gens: string[] = []
    const store = fakeStore()
    const result = await runCascade({
      root: ref('Root', 'r'),
      ports: { generate: fakeGenerate(spec, gens), admit: fakeAdmit({}), store: store.port },
    })

    // Problem generated/minted exactly once.
    expect(gens.filter((g) => g === 'gen:Problem:audit-trails').length).toBe(1)
    expect(result.minted.filter((m) => m.startsWith('Problem')).length).toBe(1)
    // The second ICP's reference is recorded as a link to the minted canonical.
    const problemCanonical = store.stored.find((s) => s.ref.text === 'audit-trails')
    expect(result.linked).toContainEqual({
      ref: 'Problem:audit-trails',
      canonical: `Problem#${store.stored.indexOf(problemCanonical!)}`,
    })
  })
})

describe('runCascade — cohort dedup across siblings (regression case 5)', () => {
  it('100 Startups referencing one Founder mint the Founder once, link the other 99', async () => {
    const startups = Array.from({ length: 100 }, (_, i) => `s${i}`)
    const spec: Spec = {
      'Market:m': { output: {}, refs: startups.map((s) => ref('Startup', s)) },
    }
    for (const s of startups) {
      spec[`Startup:${s}`] = { output: {}, refs: [ref('Founder', 'software-engineer')] }
    }
    spec['Founder:software-engineer'] = { output: {}, refs: [] }

    const gens: string[] = []
    const store = fakeStore()
    const result = await runCascade({
      root: ref('Market', 'm'),
      ports: { generate: fakeGenerate(spec, gens), admit: fakeAdmit({}), store: store.port },
    })

    // Founder generated/minted exactly once (not 100×, db4's N+1 fixed).
    expect(gens.filter((g) => g === 'gen:Founder:software-engineer').length).toBe(1)
    expect(result.minted.filter((m) => m.startsWith('Founder')).length).toBe(1)
    // The other 99 references link to the single canonical (provenance kept).
    const founderLinks = result.linked.filter((l) => l.ref === 'Founder:software-engineer')
    expect(founderLinks.length).toBe(99)
    expect(new Set(founderLinks.map((l) => l.canonical)).size).toBe(1)
  })
})

describe('runCascade — maxDepth backstop', () => {
  it('drops refs deeper than maxDepth (in addition to cycle detection)', async () => {
    const spec: Spec = {
      'A:0': { output: {}, refs: [ref('B', '1')] },
      'B:1': { output: {}, refs: [ref('C', '2')] },
      'C:2': { output: {}, refs: [ref('D', '3')] },
    }
    const store = fakeStore()
    const result = await runCascade({
      root: ref('A', '0'),
      maxDepth: 1,
      ports: { generate: fakeGenerate(spec), admit: fakeAdmit({}), store: store.port },
    })

    // depth 0 (A) and depth 1 (B) minted; depth 2 (C) dropped by the backstop.
    expect(result.minted).toEqual(['A#0', 'B#1'])
    expect(result.skipped).toContainEqual({ ref: 'C:2', reason: 'max-depth' })
  })
})

describe('runCascade — per-Noun online/offline timing', () => {
  it('online Noun: admission runs DURING expansion (pre-gen), link skips generation', async () => {
    // Author is online → its ref is admitted before generating; a link means
    // Author is never generated.
    const spec: Spec = {
      'Post:hello': { output: {}, refs: [ref('Author', 'ada')] },
      'Author:ada': { output: { name: 'ada' }, refs: [] },
    }
    const gens: string[] = []
    const store = fakeStore()
    const policies: Record<string, NounPolicy> = { Author: { timing: 'online' } }
    const result = await runCascade({
      root: ref('Post', 'hello'),
      policies,
      ports: {
        generate: fakeGenerate(spec, gens),
        admit: fakeAdmit({ links: { 'Author:ada': 'canonical-ada' } }),
        store: store.port,
      },
    })

    expect(gens).not.toContain('gen:Author:ada')
    expect(result.linked).toEqual([{ ref: 'Author:ada', canonical: 'canonical-ada' }])
  })

  it('offline Noun: generation happens first; admission/collapse is deferred to a batch phase', async () => {
    // Problem is offline → it is generated+stored eagerly; collapse decisions are
    // returned in the deferred cohort, not applied inline.
    const spec: Spec = {
      'Idea:i': { output: {}, refs: [ref('Problem', 'dup-problem')] },
      'Problem:dup-problem': { output: { p: 1 }, refs: [] },
    }
    const gens: string[] = []
    const store = fakeStore()
    const policies: Record<string, NounPolicy> = { Problem: { timing: 'offline' } }
    const result = await runCascade({
      root: ref('Idea', 'i'),
      policies,
      ports: {
        // even though admit would link it, offline timing generates first
        generate: fakeGenerate(spec, gens),
        admit: fakeAdmit({ links: { 'Problem:dup-problem': 'canonical-dup' } }),
        store: store.port,
      },
    })

    // Offline node WAS generated and stored (no pre-gen gate).
    expect(gens).toContain('gen:Problem:dup-problem')
    expect(store.stored.map((s) => s.ref.text)).toContain('dup-problem')
    // The collapse decision is deferred, not applied as an inline link.
    expect(result.linked).toEqual([])
    expect(result.deferredCollapse).toEqual([
      { ref: 'Problem:dup-problem', stored: 'Problem#1', canonical: 'canonical-dup' },
    ])
  })
})

describe('runCascade — prompt-context chaining', () => {
  it('threads parent output into the child ref context on the queue item', async () => {
    const spec: Spec = {
      'Outline:o': { output: { sections: ['intro'] }, refs: [ref('Section', 'intro')] },
      'Section:intro': { output: {}, refs: [] },
    }
    let seenContext: unknown
    const store = fakeStore()
    const generate: GeneratePort = {
      async generate(node) {
        if (node.ref.noun === 'Section') seenContext = node.ref.context
        const entry = spec[`${node.ref.noun}:${node.ref.text}`]
        const refs = (entry?.refs ?? []).map((r) => ({ ...r, context: { parent: entry?.output } }))
        return { output: entry?.output ?? {}, refs }
      },
    }
    await runCascade({
      root: ref('Outline', 'o'),
      ports: { generate, admit: fakeAdmit({}), store: store.port },
    })

    expect(seenContext).toEqual({ parent: { sections: ['intro'] } })
  })
})

describe('exported types', () => {
  it('AdmissionVerdict is the link|mint|escalate union', () => {
    const link: AdmissionVerdict = { kind: 'link', canonical: 'c', reason: 'r', confidence: 1 }
    const mint: AdmissionVerdict = { kind: 'mint', reason: 'r', confidence: 0 }
    const esc: AdmissionVerdict = { kind: 'escalate', reason: 'r', confidence: 0.5 }
    expect([link.kind, mint.kind, esc.kind]).toEqual(['link', 'mint', 'escalate'])
  })

  it('Draft carries an output and child refs', () => {
    const d: Draft = { output: { a: 1 }, refs: [ref('X', 'y')] }
    expect(d.refs[0]?.noun).toBe('X')
  })

  it('CascadeResult aggregates the four outcome lists', () => {
    const r: CascadeResult = {
      minted: [],
      linked: [],
      escalated: [],
      skipped: [],
      deferredCollapse: [],
    }
    expect(Object.keys(r).sort()).toEqual([
      'deferredCollapse',
      'escalated',
      'linked',
      'minted',
      'skipped',
    ])
  })
})
