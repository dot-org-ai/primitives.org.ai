/**
 * Cascade orchestrator tests — the moat work (aip-8yal).
 *
 * Behavioral spec target: the
 * `2026-05-06-cascade-via-ai-database-poc` (FoundingHypothesis → 5
 * NameCandidates → Brand) — we don't port that test fixture verbatim but
 * cover its algorithmic shape:
 *
 * - single-level cascade (1 root + N siblings)
 * - multi-level cascade (root → children → grandchildren) with
 *   pre-derived ids so grandchildren's parentId points at the right child
 * - sibling-parallel fan-out (concurrent generation across array fields)
 * - validation policies (`accept`/`reject`/`regenerate`/`escalate`) — one
 *   verdict per policy
 * - embed-on-write (mock embedder; verify the vector lands in the data)
 * - failure paths (LLM error path bubbles; validation reject yields
 *   rejected entries without write)
 * - idempotency: same cascadeId twice yields the same shape (re-run is
 *   safe because content-hashed ids land in the same shard rows)
 *
 * All LLM calls are mocked — CI never reaches a real provider.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  generateCascade,
  CascadeValidationEscalation,
  buildEmbedText,
  type CascadeGenerator,
  type CascadeValidator,
  type CascadeSpec,
} from '../src/cascade-orchestrator.js'
import { createMemoryProvider } from '../src/memory-provider.js'

// =============================================================================
// Mock generator helpers — deterministic stubs so tests don't hit a real LLM.
// =============================================================================

/**
 * Build a deterministic generator that produces stable data per
 * (noun, siblingIndex). Ensures content-hashed ids are stable across runs.
 */
function makeMockGenerator(
  fields: Record<string, (siblingIndex: number) => Record<string, unknown>> = {}
): CascadeGenerator {
  return async (input) => {
    const builder = fields[input.noun]
    if (builder) {
      return builder(input.siblingIndex ?? 0)
    }
    // Default: produce a name + description per noun + sibling index.
    const idx = input.siblingIndex ?? 0
    return {
      name: `${input.noun} ${idx}`,
      description: `${input.noun} #${idx} for cascade ${input.cascadeId.slice(0, 8)}`,
    }
  }
}

/** Validator that always passes with score 1 across criteria. */
const acceptAllValidator: CascadeValidator = async (input) => {
  const scores: Record<string, number> = {}
  for (const c of input.rubric.criteria) scores[c.name] = 1
  return { scores }
}

/** Validator that always fails (score 0). */
const failAllValidator: CascadeValidator = async (input) => {
  const scores: Record<string, number> = {}
  for (const c of input.rubric.criteria) scores[c.name] = 0
  return { scores, feedback: 'fails everything' }
}

// =============================================================================
// Tests — single-level cascade
// =============================================================================

describe('generateCascade — single-level (root + N siblings)', () => {
  it('generates a Customer + 5 Orders, all written through the adapter', async () => {
    const adapter = createMemoryProvider()
    const generator = makeMockGenerator({
      Customer: () => ({ name: 'Acme Co', industry: 'B2B SaaS' }),
      Order: (idx) => ({ id: `order-${idx}`, total: 100 + idx * 10 }),
    })

    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      rootHints: { industry: 'B2B SaaS' },
      children: [
        {
          noun: 'Order',
          count: 5,
          verb: 'placedBy',
        },
      ],
      generator,
    })

    expect(result.root.$type).toBe('Customer')
    expect(result.stats.written).toBe(6) // 1 customer + 5 orders
    expect(result.stats.actionsRecorded).toBe(5) // each order → placedBy → customer
    expect(result.stats.rejectedCount).toBe(0)
    expect(result.thingsById.size).toBe(6)

    // Verify writes landed in the adapter.
    const customer = await adapter.get('Customer', result.root.$id)
    expect(customer).not.toBeNull()
    expect((customer as Record<string, unknown>)['name']).toBe('Acme Co')

    // All Orders should be retrievable.
    let orderCount = 0
    for (const entity of result.thingsById.values()) {
      if (entity.$type === 'Order') {
        orderCount += 1
        const fetched = await adapter.get('Order', entity.$id)
        expect(fetched).not.toBeNull()
      }
    }
    expect(orderCount).toBe(5)
  })

  it('records each child Action with subject=child, object=parent', async () => {
    const adapter = createMemoryProvider()
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [{ noun: 'Order', count: 3, verb: 'placedBy' }],
      generator: makeMockGenerator(),
    })

    expect(result.actions.length).toBe(3)
    for (const a of result.actions) {
      expect(a.verb).toBe('placedBy')
      expect(a.subject).not.toBe(result.root.$id)
      expect(a.object).toBe(result.root.$id)
    }
  })
})

// =============================================================================
// Tests — multi-level cascade with pre-derived ids
// =============================================================================

describe('generateCascade — multi-level (Customer → Orders → OrderItems)', () => {
  it('generates a 3-level tree with valid grandchildren backrefs', async () => {
    const adapter = createMemoryProvider()
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [
        {
          noun: 'Order',
          count: 2,
          verb: 'placedBy',
          children: [{ noun: 'OrderItem', count: 3, verb: 'partOf' }],
        },
      ],
      generator: makeMockGenerator(),
    })

    // 1 + 2 + (2 * 3) = 9 things
    expect(result.stats.written).toBe(9)
    // 2 placedBy + 6 partOf = 8 actions
    expect(result.stats.actionsRecorded).toBe(8)

    // Every OrderItem's path includes the Order it belongs to.
    const orderItems = [...result.thingsById.values()].filter((e) => e.$type === 'OrderItem')
    expect(orderItems.length).toBe(6)
    for (const item of orderItems) {
      expect(item.path[0]).toBe('Customer')
      expect(item.path[1]?.startsWith('Order:')).toBe(true)
      expect(item.path[2]?.startsWith('OrderItem:')).toBe(true)
      expect(item.parentId).toBeDefined()
    }

    // Every partOf Action's object should point at one of the 2 generated Orders.
    const orders = [...result.thingsById.values()].filter((e) => e.$type === 'Order')
    const orderIds = new Set(orders.map((o) => o.$id))
    const partOfActions = result.actions.filter((a) => a.verb === 'partOf')
    expect(partOfActions.length).toBe(6)
    for (const a of partOfActions) {
      expect(orderIds.has(a.object!)).toBe(true)
    }
  })

  it('respects maxDepth — does not descend past the cap', async () => {
    const adapter = createMemoryProvider()
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      maxDepth: 2,
      children: [
        {
          noun: 'Order',
          count: 1,
          verb: 'placedBy',
          children: [
            {
              noun: 'OrderItem',
              count: 5, // Should NOT be generated — depth 2 means depth=1 children only.
              verb: 'partOf',
            },
          ],
        },
      ],
      generator: makeMockGenerator(),
    })

    // 1 Customer + 1 Order; OrderItems blocked by maxDepth.
    expect(result.stats.written).toBe(2)
  })
})

// =============================================================================
// Tests — sibling-parallel fan-out
// =============================================================================

describe('generateCascade — sibling-parallel fan-out', () => {
  it('generates 10 sibling Orders concurrently (Promise.all)', async () => {
    const adapter = createMemoryProvider()
    let inFlight = 0
    let maxInFlight = 0

    const generator: CascadeGenerator = async (input) => {
      if (input.noun === 'Order') {
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        // Tiny await to give Promise.all a chance to overlap.
        await Promise.resolve()
        await Promise.resolve()
        inFlight -= 1
      }
      return { name: `${input.noun}-${input.siblingIndex ?? 0}` }
    }

    await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [{ noun: 'Order', count: 10, verb: 'placedBy' }],
      generator,
    })

    // All 10 siblings should have been in-flight simultaneously.
    expect(maxInFlight).toBe(10)
  })
})

// =============================================================================
// Tests — validation policies (one per verdict)
// =============================================================================

describe('generateCascade — validation policies', () => {
  it('accepts when rubric verdict passes (all-pass policy)', async () => {
    const adapter = createMemoryProvider()
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      validate: {
        criteria: [
          { name: 'specific', description: 'is specific' },
          { name: 'plausible', description: 'is plausible' },
        ],
        policy: 'all-pass',
        threshold: 0.8,
      },
      generator: makeMockGenerator(),
      validator: acceptAllValidator,
    })

    expect(result.stats.written).toBe(1)
    expect(result.stats.rejectedCount).toBe(0)
    expect(result.root.validationScores).toEqual({ specific: 1, plausible: 1 })
  })

  it('rejects when rubric verdict fails and onFail=reject', async () => {
    const adapter = createMemoryProvider()
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      validate: {
        criteria: [{ name: 'specific', description: 'is specific' }],
        policy: 'all-pass',
        onFail: 'reject',
      },
      generator: makeMockGenerator(),
      validator: failAllValidator,
    })

    // Root rejected → no children generated, root not written.
    expect(result.stats.written).toBe(0)
    expect(result.stats.rejectedCount).toBe(1)
    expect(result.rejected[0]?.scores['specific']).toBe(0)
  })

  it('regenerates up to maxRegenerationAttempts before rejecting', async () => {
    const adapter = createMemoryProvider()
    let attempts = 0
    const generator: CascadeGenerator = async (input) => {
      attempts += 1
      return { name: `${input.noun} attempt ${attempts}` }
    }

    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      maxRegenerationAttempts: 2,
      validate: {
        criteria: [{ name: 'good', description: 'is good' }],
        policy: 'all-pass',
        onFail: 'regenerate',
      },
      generator,
      validator: failAllValidator,
    })

    // Initial + 2 regenerations = 3 attempts; then reject (no escalate).
    expect(attempts).toBe(3)
    expect(result.stats.regenerationAttempts).toBe(2)
    expect(result.stats.written).toBe(0)
    expect(result.stats.rejectedCount).toBe(1)
  })

  it('escalates when onFail=escalate (throws CascadeValidationEscalation)', async () => {
    const adapter = createMemoryProvider()
    await expect(
      generateCascade({
        adapter,
        rootNoun: 'Customer',
        validate: {
          criteria: [{ name: 'good', description: 'is good' }],
          policy: 'all-pass',
          onFail: 'escalate',
        },
        generator: makeMockGenerator(),
        validator: failAllValidator,
      })
    ).rejects.toBeInstanceOf(CascadeValidationEscalation)
  })

  it('mean-ge-threshold passes when mean >= threshold', async () => {
    const adapter = createMemoryProvider()
    const validator: CascadeValidator = async () => ({
      scores: { a: 0.8, b: 0.6 }, // mean 0.7
    })
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      validate: {
        criteria: [
          { name: 'a', description: 'a' },
          { name: 'b', description: 'b' },
        ],
        policy: 'mean-ge-threshold',
        threshold: 0.7,
      },
      generator: makeMockGenerator(),
      validator,
    })
    expect(result.stats.written).toBe(1)
  })

  it('weighted-ge-threshold uses per-criterion weights', async () => {
    const adapter = createMemoryProvider()
    const validator: CascadeValidator = async () => ({
      scores: { a: 1.0, b: 0.0 }, // weighted: (1*3 + 0*1)/4 = 0.75
    })
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      validate: {
        criteria: [
          { name: 'a', description: 'a', weight: 3 },
          { name: 'b', description: 'b', weight: 1 },
        ],
        policy: 'weighted-ge-threshold',
        threshold: 0.7,
      },
      generator: makeMockGenerator(),
      validator,
    })
    expect(result.stats.written).toBe(1)
  })

  it('all-load-bearing-pass ignores non-load-bearing criteria', async () => {
    const adapter = createMemoryProvider()
    const validator: CascadeValidator = async () => ({
      scores: { critical: 1, advisory: 0 },
    })
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      validate: {
        criteria: [
          { name: 'critical', description: 'critical', loadBearing: true },
          { name: 'advisory', description: 'advisory', loadBearing: false },
        ],
        policy: 'all-load-bearing-pass',
      },
      generator: makeMockGenerator(),
      validator,
    })
    expect(result.stats.written).toBe(1)
  })
})

// =============================================================================
// Tests — embed-on-write
// =============================================================================

describe('generateCascade — embed-on-write', () => {
  it('embeds preferred string fields and stores the vector under $embedding', async () => {
    const adapter = createMemoryProvider()
    const embedCalls: string[] = []
    const embedder = vi.fn(async (text: string) => {
      embedCalls.push(text)
      return Array.from({ length: 8 }, (_, i) => i / 8)
    })

    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [{ noun: 'Order', count: 2, verb: 'placedBy' }],
      generator: makeMockGenerator({
        Customer: () => ({ name: 'Acme', description: 'Big SaaS firm' }),
        Order: (idx) => ({ title: `Order #${idx + 1}` }),
      }),
      embedder,
    })

    expect(result.stats.embedded).toBe(3) // 1 customer + 2 orders
    expect(embedder).toHaveBeenCalledTimes(3)
    // Customer embedding text combines name + description.
    expect(embedCalls[0]).toContain('Acme')
    expect(embedCalls[0]).toContain('Big SaaS firm')

    // Verify $embedding landed in the stored data.
    const stored = await adapter.get('Customer', result.root.$id)
    expect(stored).not.toBeNull()
    expect(Array.isArray((stored as Record<string, unknown>)['$embedding'])).toBe(true)
    expect(((stored as Record<string, unknown>)['$embedding'] as number[]).length).toBe(8)
  })

  it('continues the cascade when the embedder throws', async () => {
    const adapter = createMemoryProvider()
    const embedder = vi.fn(async () => {
      throw new Error('embedding service down')
    })

    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [{ noun: 'Order', count: 2, verb: 'placedBy' }],
      generator: makeMockGenerator(),
      embedder,
    })

    // Cascade still wrote 3 things; just no embeddings.
    expect(result.stats.written).toBe(3)
    expect(result.stats.embedded).toBe(0)
  })
})

// =============================================================================
// Tests — buildEmbedText helper
// =============================================================================

describe('buildEmbedText', () => {
  it('prefers human-readable fields and joins them', () => {
    expect(buildEmbedText({ name: 'Acme', description: 'big saas' })).toContain('Acme')
    expect(buildEmbedText({ title: 'Order 1', summary: 'payment pending' })).toContain('Order 1')
  })

  it('falls back to scalar fields when no preferred fields exist', () => {
    expect(buildEmbedText({ total: 100, currency: 'USD' })).toMatch(/total/)
  })

  it('skips $-prefixed and _-prefixed internal fields', () => {
    expect(buildEmbedText({ $id: 'abc', _internal: 'secret', name: 'visible' })).toBe('visible')
  })
})

// =============================================================================
// Tests — failure / retry paths
// =============================================================================

describe('generateCascade — failure paths', () => {
  it('propagates generator errors', async () => {
    const adapter = createMemoryProvider()
    const generator: CascadeGenerator = async () => {
      throw new Error('LLM 500')
    }
    await expect(
      generateCascade({
        adapter,
        rootNoun: 'Customer',
        generator,
      })
    ).rejects.toThrow(/LLM 500/)
  })

  it('rejected children do not block sibling generation', async () => {
    const adapter = createMemoryProvider()
    let validateCount = 0
    const validator: CascadeValidator = async (input) => {
      validateCount += 1
      // First validation fails; rest pass.
      const scores: Record<string, number> = {}
      for (const c of input.rubric.criteria) scores[c.name] = validateCount === 1 ? 0 : 1
      return { scores, feedback: validateCount === 1 ? 'first fails' : undefined }
    }

    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [
        {
          noun: 'Order',
          count: 3,
          verb: 'placedBy',
          validate: {
            criteria: [{ name: 'good', description: 'good' }],
            policy: 'all-pass',
            onFail: 'reject',
          },
        },
      ],
      generator: makeMockGenerator(),
      validator,
    })

    // 1 root + 2 accepted children (+ 1 rejected).
    expect(result.stats.written).toBe(3)
    expect(result.stats.rejectedCount).toBe(1)
    expect(result.stats.actionsRecorded).toBe(2)
  })
})

// =============================================================================
// Tests — idempotency (same cascadeId yields same shape)
// =============================================================================

describe('generateCascade — idempotency', () => {
  it('same cascadeId + same generator yields same root id and same shape', async () => {
    const spec: CascadeSpec = {
      rootNoun: 'Customer',
      rootHints: { industry: 'B2B' },
      children: [{ noun: 'Order', count: 3, verb: 'placedBy' }],
    }

    const adapter1 = createMemoryProvider()
    const r1 = await generateCascade({
      ...spec,
      adapter: adapter1,
      cascadeId: 'fixed-cascade-id',
      generator: makeMockGenerator(),
    })

    const adapter2 = createMemoryProvider()
    const r2 = await generateCascade({
      ...spec,
      adapter: adapter2,
      cascadeId: 'fixed-cascade-id',
      generator: makeMockGenerator(),
    })

    // Cascade id echo and root id are stable across re-runs.
    expect(r1.cascadeId).toBe('fixed-cascade-id')
    expect(r2.cascadeId).toBe('fixed-cascade-id')
    expect(r1.root.$id).toBe(r2.root.$id)

    // Sibling Order ids are stable across re-runs (deterministic generator,
    // same parent key, same path).
    const orders1 = [...r1.thingsById.values()].filter((e) => e.$type === 'Order').map((e) => e.$id)
    const orders2 = [...r2.thingsById.values()].filter((e) => e.$type === 'Order').map((e) => e.$id)
    expect(orders1.sort()).toEqual(orders2.sort())
  })

  it('re-running against the same adapter is a no-op (or near-no-op) thanks to ON CONFLICT DO NOTHING semantics', async () => {
    // Memory adapter throws on duplicate; the cascade-write-strategy
    // fallback path swallows already-exists errors. We re-run to verify
    // the cascade doesn't crash on the second pass.
    const adapter = createMemoryProvider()
    const spec: CascadeSpec = {
      rootNoun: 'Customer',
      children: [{ noun: 'Order', count: 2, verb: 'placedBy' }],
    }

    const r1 = await generateCascade({
      ...spec,
      adapter,
      cascadeId: 'idempotent-test',
      generator: makeMockGenerator(),
    })
    expect(r1.stats.written).toBe(3)

    // Second run reuses the same content-hashed ids; the strategy's per-op
    // fallback path swallows the resulting "already exists" errors and
    // reports 0 inserted on the duplicate path. The cascade itself still
    // returns a successful result (no throw).
    const r2 = await generateCascade({
      ...spec,
      adapter,
      cascadeId: 'idempotent-test',
      generator: makeMockGenerator(),
    })
    expect(r2.cascadeId).toBe('idempotent-test')
    expect(r2.root.$id).toBe(r1.root.$id)
  })
})

// =============================================================================
// Tests — Frame role assignment + role token resolution
// =============================================================================

describe('generateCascade — Frame role assignments', () => {
  it('resolves $parent token to the parent Thing id', async () => {
    const adapter = createMemoryProvider()
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [
        {
          noun: 'Order',
          count: 2,
          verb: 'placedBy',
          roles: { recipient: '$parent' },
        },
      ],
      generator: makeMockGenerator(),
    })

    for (const a of result.actions) {
      expect(a.roles?.recipient).toBe(result.root.$id)
    }
  })

  it('resolves $root token to the cascade root id', async () => {
    const adapter = createMemoryProvider()
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [
        {
          noun: 'Order',
          count: 1,
          verb: 'placedBy',
          children: [
            {
              noun: 'OrderItem',
              count: 1,
              verb: 'partOf',
              roles: { topic: '$root' },
            },
          ],
        },
      ],
      generator: makeMockGenerator(),
    })

    const partOfActions = result.actions.filter((a) => a.verb === 'partOf')
    expect(partOfActions.length).toBe(1)
    expect(partOfActions[0]?.roles?.topic).toBe(result.root.$id)
  })
})

// =============================================================================
// Tests — count ranges
// =============================================================================

describe('generateCascade — count ranges', () => {
  beforeEach(() => {
    // Stabilize Math.random so [min, max] resolves predictably.
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  it('honours an integer count', async () => {
    const adapter = createMemoryProvider()
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [{ noun: 'Order', count: 4, verb: 'placedBy' }],
      generator: makeMockGenerator(),
    })
    expect(result.stats.written).toBe(5) // 1 + 4
  })

  it('honours a [min, max] range', async () => {
    const adapter = createMemoryProvider()
    const result = await generateCascade({
      adapter,
      rootNoun: 'Customer',
      children: [{ noun: 'Order', count: [2, 5], verb: 'placedBy' }],
      generator: makeMockGenerator(),
    })
    // With Math.random()=0, count = floor(2 + 0 * 4) = 2.
    expect(result.stats.written).toBe(3) // 1 + 2
  })
})
