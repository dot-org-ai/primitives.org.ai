/**
 * $generation Noun-policy gating + the ~>/<~ gate-routing seam (aip-cnks.4).
 *
 * Covers: the conditional-type that makes `generate`/`findOrGenerate` ABSENT on a
 * `$generation:'never'` Noun, the runtime cascade-safety invariant (CREATE on a
 * 'never' Noun escalates, never generates), and `routeFuzzyRef` (the shared
 * decision core the `~>`/`<~` operators delegate to).
 */
import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  createFindPorts,
  findOrGenerate,
  routeFuzzyRef,
  EscalationRequired,
  InMemoryFindBackend,
} from '../src/find-or-create.js'
import type { GeneratableVerbs, BaseSemanticVerbs, GeneratableOnly } from '../src/find-or-create.js'

const band = { autoLink: 0.93, judgeFloor: 0.85 }

interface CustomerData extends Record<string, unknown> {
  name: string
  email: string
}
interface BlogPostData extends Record<string, unknown> {
  title: string
  body: string
}

describe('$generation type-gating (conditional type)', () => {
  it("'never' Noun → generatable verbs are ABSENT (only base verbs)", () => {
    type CustomerVerbs = GeneratableVerbs<CustomerData, CustomerData, 'never'>
    // base verbs present
    expectTypeOf<CustomerVerbs>().toHaveProperty('findOrCreate')
    expectTypeOf<CustomerVerbs>().toHaveProperty('create')
    expectTypeOf<CustomerVerbs>().toHaveProperty('find')
    // generatable verbs ABSENT — equal to the base interface exactly
    expectTypeOf<CustomerVerbs>().toEqualTypeOf<BaseSemanticVerbs<CustomerData>>()
    // @ts-expect-error generate must not exist on a 'never' Noun
    type _NoGen = CustomerVerbs['generate']
    // @ts-expect-error findOrGenerate must not exist on a 'never' Noun
    type _NoFog = CustomerVerbs['findOrGenerate']
  })

  it("'auto' Noun → generatable verbs PRESENT", () => {
    type BlogVerbs = GeneratableVerbs<BlogPostData, BlogPostData, 'auto'>
    expectTypeOf<BlogVerbs>().toHaveProperty('generate')
    expectTypeOf<BlogVerbs>().toHaveProperty('findOrGenerate')
    expectTypeOf<BlogVerbs>().toMatchTypeOf<GeneratableOnly<BlogPostData, BlogPostData>>()
  })

  it("'review' Noun → generatable verbs PRESENT (HITL handled by onEscalate)", () => {
    type OfferVerbs = GeneratableVerbs<BlogPostData, BlogPostData, 'review'>
    expectTypeOf<OfferVerbs>().toHaveProperty('generate')
    expectTypeOf<OfferVerbs>().toHaveProperty('findOrGenerate')
  })
})

describe('$generation runtime cascade-safety invariant', () => {
  it("CREATE on a 'never' Noun escalates, never generates", async () => {
    const backend = new InMemoryFindBackend()
    const ports = createFindPorts(backend, { thresholds: () => band })
    let generated = false
    await expect(
      findOrGenerate(
        { noun: 'Customer', mode: 'symmetric-collapse', text: 'Acme Corp', seed: { name: 'Acme Corp' }, generation: 'never' },
        {
          ports,
          backend,
          generate: async () => {
            generated = true
            return { name: 'Acme Corp', email: 'x@y.z' }
          },
        }
      )
    ).rejects.toBeInstanceOf(EscalationRequired)
    expect(generated).toBe(false)
    expect(backend.count('Customer')).toBe(0)
  })

  it("'review' Noun → mint routes through onEscalate (HITL hook), generator runs only when committed", async () => {
    const backend = new InMemoryFindBackend()
    const ports = createFindPorts(backend, { thresholds: () => band })
    // 'review' is generatable, so a greenfield CREATE generates and commits ('auto'-like
    // at the gate; the review escalation is the onEscalate hook on the proxy/HITL layer).
    const res = await findOrGenerate(
      { noun: 'Offer', mode: 'symmetric-collapse', text: 'New offer', seed: { title: 'New offer' }, generation: 'review' },
      { ports, backend, generate: async (s) => ({ ...(s as object), body: 'drafted' }) }
    )
    expect(res.decision).toBe('minted')
    expect(backend.count('Offer')).toBe(1)
  })
})

describe('routeFuzzyRef — the ~>/<~ gate seam', () => {
  it('~> resolves a name to an existing node (link)', async () => {
    const backend = new InMemoryFindBackend()
    const node = await backend.create('Industry', { name: 'Software Development' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    const verdict = await routeFuzzyRef(
      { text: 'software development', noun: 'Industry', operator: '~>' },
      ports
    )
    expect(verdict.kind).toBe('link')
    if (verdict.kind === 'link') expect(verdict.canonical).toBe(node.$id)
  })

  it('~> against a closed pool with no exact match → quarantine (escalate, never mint)', async () => {
    const backend = new InMemoryFindBackend()
    await backend.create('Industry', { name: 'Software' })
    const ports = createFindPorts(backend, { thresholds: () => band })
    const verdict = await routeFuzzyRef(
      { text: 'a wholly novel vertical', noun: 'Industry', operator: '~>', closedPool: true },
      ports
    )
    expect(verdict.kind).toBe('quarantine')
  })

  it('~> with no candidates (open pool) → mint', async () => {
    const backend = new InMemoryFindBackend()
    const ports = createFindPorts(backend, { thresholds: () => band })
    const verdict = await routeFuzzyRef(
      { text: 'brand new tag', noun: 'Tag', operator: '~>' },
      ports
    )
    expect(verdict.kind).toBe('mint')
  })
})
