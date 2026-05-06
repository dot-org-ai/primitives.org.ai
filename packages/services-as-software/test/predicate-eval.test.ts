/**
 * Tests for the v3 ProofPredicate evaluator (cluster-1 sb-v3-migration
 * gap-fix). Covers all 9 leaf predicate kinds + AND/OR composition + the
 * ExternalVerifier registry.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

import {
  AND,
  OR,
  SchemaMatch,
  EvaluatorPass,
  HumanSign,
  External,
  LoadBearingPass,
  OverallFloor,
  UnmetRequirementsPass,
} from 'autonomous-finance'
import {
  evaluatePredicate,
  registerVerifier,
  __resetVerifiersForTests,
  type EvaluationContext,
  type ExternalVerifier,
} from '../src/v3/index.js'
import type { PanelVerdict } from '../src/v3/evaluator-panel.js'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function panelVerdict(opts: {
  verdict: 'all-approved' | 'partial' | 'rejected'
  approvals?: number
  rejections?: number
}): PanelVerdict {
  const approvals = Array.from({ length: opts.approvals ?? 0 }, (_, i) => ({
    reviewer: `r${i}`,
    rationale: 'lgtm',
  }))
  const rejections = Array.from({ length: opts.rejections ?? 0 }, (_, i) => ({
    reviewer: `j${i}`,
    rationale: 'nope',
  }))
  return {
    verdict: opts.verdict,
    approvals,
    rejections,
    rounds: 1,
    costUsd: 0,
  }
}

beforeEach(() => {
  __resetVerifiersForTests()
})

afterEach(() => {
  __resetVerifiersForTests()
})

// ----------------------------------------------------------------------------
// schema-match
// ----------------------------------------------------------------------------

describe('predicate-eval: schema-match', () => {
  const schema = z.object({ id: z.string(), score: z.number() })

  it('passes when output matches the Zod schema', async () => {
    const r = await evaluatePredicate(SchemaMatch(schema), {
      output: { id: 'abc', score: 7 },
    })
    expect(r.passed).toBe(true)
    expect(r.failures).toEqual([])
  })

  it('fails when output does not match the Zod schema', async () => {
    const r = await evaluatePredicate(SchemaMatch(schema), {
      output: { id: 'abc', score: 'not-a-number' },
    })
    expect(r.passed).toBe(false)
    expect(r.failures.length).toBeGreaterThan(0)
    expect(r.failures[0]).toContain('schema-match')
  })

  it('fails when no output is captured', async () => {
    const r = await evaluatePredicate(SchemaMatch(schema), {})
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('no output captured')
  })
})

// ----------------------------------------------------------------------------
// evaluator-pass
// ----------------------------------------------------------------------------

describe('predicate-eval: evaluator-pass', () => {
  it("passes when verdict is 'all-approved' and minScore is 'all-approved'", async () => {
    const r = await evaluatePredicate(
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      { panelVerdict: panelVerdict({ verdict: 'all-approved', approvals: 3 }) }
    )
    expect(r.passed).toBe(true)
  })

  it("fails when verdict is 'partial' and minScore is 'all-approved'", async () => {
    const r = await evaluatePredicate(
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      {
        panelVerdict: panelVerdict({ verdict: 'partial', approvals: 2, rejections: 1 }),
      }
    )
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('evaluator-pass')
  })

  it('passes numeric threshold when ratio meets it', async () => {
    const r = await evaluatePredicate(EvaluatorPass({ panelRef: 'self', minScore: 0.66 }), {
      panelVerdict: panelVerdict({ verdict: 'partial', approvals: 2, rejections: 1 }),
    })
    expect(r.passed).toBe(true)
  })

  it('fails when no panelVerdict is wired and predicate is composed inside AND', async () => {
    // Composed predicates always go through the full evaluator (the legacy
    // shortcut only applies to bare evaluator-pass at the top level via
    // verifyService).
    const composed = AND(EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }))
    const r = await evaluatePredicate(composed, {})
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('no PanelVerdict captured')
  })
})

// ----------------------------------------------------------------------------
// human-sign
// ----------------------------------------------------------------------------

describe('predicate-eval: human-sign', () => {
  it('passes when every required role has a recorded signature', async () => {
    const r = await evaluatePredicate(HumanSign({ signerRoles: ['controller', 'cfo'] }), {
      humanSignatures: [{ signerRole: 'controller' }, { signerRole: 'cfo' }],
    })
    expect(r.passed).toBe(true)
  })

  it('fails when a required role is missing', async () => {
    const r = await evaluatePredicate(HumanSign({ signerRoles: ['controller', 'cfo'] }), {
      humanSignatures: [{ signerRole: 'controller' }],
    })
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('cfo')
  })
})

// ----------------------------------------------------------------------------
// external + ExternalVerifier registry
// ----------------------------------------------------------------------------

describe('predicate-eval: external + verifier registry', () => {
  it('passes when the registered verifier returns passed: true', async () => {
    const fake: ExternalVerifier = {
      name: 'github',
      async verify() {
        return { passed: true }
      },
    }
    registerVerifier(fake)
    const r = await evaluatePredicate(External({ verifier: 'github', spec: { merged: true } }), {})
    expect(r.passed).toBe(true)
  })

  it('fails with detail when the verifier returns passed: false', async () => {
    registerVerifier({
      name: 'stripe',
      async verify() {
        return { passed: false, detail: 'charge not paid' }
      },
    })
    const r = await evaluatePredicate(External({ verifier: 'stripe', spec: { paid: true } }), {})
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('charge not paid')
  })

  it('fails when no verifier is registered', async () => {
    const r = await evaluatePredicate(
      External({ verifier: 'docusign', spec: { signed: true } }),
      {}
    )
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('no verifier registered for "docusign"')
  })

  it('fails when the verifier throws', async () => {
    registerVerifier({
      name: 'flaky',
      async verify() {
        throw new Error('network down')
      },
    })
    const r = await evaluatePredicate(External({ verifier: 'flaky', spec: {} }), {})
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('network down')
  })

  it('uses cached externalResults when present, bypassing the registry', async () => {
    // No verifier registered, yet the predicate passes via cached result.
    const ctx: EvaluationContext = {
      externalResults: { github: { passed: true } },
    }
    const r = await evaluatePredicate(External({ verifier: 'github', spec: {} }), ctx)
    expect(r.passed).toBe(true)
  })
})

// ----------------------------------------------------------------------------
// load-bearing-pass
// ----------------------------------------------------------------------------

describe('predicate-eval: load-bearing-pass', () => {
  it('passes when every load-bearing item passes (numeric score shape)', async () => {
    const r = await evaluatePredicate(LoadBearingPass(['C1', 'C5']), {
      rubricBreakdown: [
        { id: 'C1', score: 1 },
        { id: 'C2', score: 0 },
        { id: 'C5', score: 1 },
      ],
    })
    expect(r.passed).toBe(true)
  })

  it('passes when every load-bearing item passes (passed: boolean shape)', async () => {
    const r = await evaluatePredicate(LoadBearingPass(['C1', 'C5']), {
      rubricBreakdown: [
        { id: 'C1', passed: true },
        { id: 'C5', passed: true },
      ],
    })
    expect(r.passed).toBe(true)
  })

  it('fails when a load-bearing item fails', async () => {
    const r = await evaluatePredicate(LoadBearingPass(['C1', 'C5']), {
      rubricBreakdown: [
        { id: 'C1', score: 1 },
        { id: 'C5', score: 0 },
      ],
    })
    expect(r.passed).toBe(false)
    expect(r.failures.join(' ')).toContain('C5')
  })

  it('fails when a load-bearing item is missing from the breakdown', async () => {
    const r = await evaluatePredicate(LoadBearingPass(['C1', 'C9']), {
      rubricBreakdown: [{ id: 'C1', score: 1 }],
    })
    expect(r.passed).toBe(false)
    expect(r.failures.join(' ')).toContain('C9')
  })
})

// ----------------------------------------------------------------------------
// overall-floor
// ----------------------------------------------------------------------------

describe('predicate-eval: overall-floor', () => {
  it('passes when the count of passing items meets minPasses', async () => {
    const r = await evaluatePredicate(OverallFloor({ minPasses: 2, outOfTotal: 3 }), {
      rubricBreakdown: [
        { id: 'A', score: 1 },
        { id: 'B', score: 1 },
        { id: 'C', score: 0 },
      ],
    })
    expect(r.passed).toBe(true)
  })

  it('fails when fewer items pass than minPasses', async () => {
    const r = await evaluatePredicate(OverallFloor({ minPasses: 7, outOfTotal: 9 }), {
      rubricBreakdown: [
        { id: 'A', score: 1 },
        { id: 'B', score: 0 },
      ],
    })
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('overall-floor')
  })
})

// ----------------------------------------------------------------------------
// unmet-requirements-pass (sb-n7d)
// ----------------------------------------------------------------------------

describe('predicate-eval: unmet-requirements-pass', () => {
  it('passes when no blocking requirement is present', async () => {
    const r = await evaluatePredicate(UnmetRequirementsPass(), {
      unmetRequirements: [{ category: 'docs', description: 'rephrase x', severity: 'warning' }],
    })
    expect(r.passed).toBe(true)
  })

  it('fails when a blocking requirement is present', async () => {
    const r = await evaluatePredicate(UnmetRequirementsPass(), {
      unmetRequirements: [
        { category: 'compliance', description: 'KYC missing', severity: 'blocking' },
      ],
    })
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('KYC missing')
  })

  it('only checks the specified categories when filter is provided', async () => {
    const r = await evaluatePredicate(UnmetRequirementsPass({ categories: ['security'] }), {
      unmetRequirements: [
        { category: 'compliance', description: 'KYC missing', severity: 'blocking' },
        { category: 'security', description: 'ok', severity: 'warning' },
      ],
    })
    // Blocking item is in 'compliance' which is filtered out → predicate
    // passes.
    expect(r.passed).toBe(true)
  })

  it('fails when the filtered category has a blocking requirement', async () => {
    const r = await evaluatePredicate(
      UnmetRequirementsPass({ categories: ['security', 'compliance'] }),
      {
        unmetRequirements: [
          { category: 'compliance', description: 'KYC missing', severity: 'blocking' },
        ],
      }
    )
    expect(r.passed).toBe(false)
  })
})

// ----------------------------------------------------------------------------
// AND / OR composition
// ----------------------------------------------------------------------------

describe('predicate-eval: AND / OR composition', () => {
  it('AND short-circuits on first failure and preserves the failure chain', async () => {
    const ctx: EvaluationContext = {
      rubricBreakdown: [{ id: 'C1', score: 0 }],
      unmetRequirements: [],
    }
    const composed = AND(LoadBearingPass(['C1']), UnmetRequirementsPass())
    const r = await evaluatePredicate(composed, ctx)
    expect(r.passed).toBe(false)
    // Only the first child's failure is captured (short-circuit).
    expect(r.failures.length).toBe(1)
    expect(r.failures[0]).toContain('load-bearing-pass')
  })

  it('AND passes when all children pass', async () => {
    const composed = AND(
      LoadBearingPass(['C1']),
      OverallFloor({ minPasses: 1, outOfTotal: 2 }),
      UnmetRequirementsPass()
    )
    const r = await evaluatePredicate(composed, {
      rubricBreakdown: [
        { id: 'C1', score: 1 },
        { id: 'C2', score: 0 },
      ],
      unmetRequirements: [],
    })
    expect(r.passed).toBe(true)
  })

  it('OR short-circuits on first success', async () => {
    const composed = OR(LoadBearingPass(['MISSING']), UnmetRequirementsPass())
    const r = await evaluatePredicate(composed, {
      rubricBreakdown: [],
      unmetRequirements: [],
    })
    expect(r.passed).toBe(true)
  })

  it('OR aggregates every failure when all children fail', async () => {
    const composed = OR(LoadBearingPass(['MISSING']), OverallFloor({ minPasses: 5, outOfTotal: 5 }))
    const r = await evaluatePredicate(composed, {
      rubricBreakdown: [{ id: 'A', score: 0 }],
    })
    expect(r.passed).toBe(false)
    expect(r.failures.length).toBeGreaterThanOrEqual(2)
  })

  it("matches cluster 1's killThreshold pattern: AND(LoadBearingPass, OverallFloor)", async () => {
    const composed = AND(
      LoadBearingPass(['C1', 'C5']),
      OverallFloor({ minPasses: 7, outOfTotal: 9 })
    )
    // Build a 9-item breakdown — 8 pass, including both load-bearing items.
    const breakdown = [
      { id: 'C1', score: 1 as const },
      { id: 'C2', score: 1 as const },
      { id: 'C3', score: 1 as const },
      { id: 'C4', score: 1 as const },
      { id: 'C5', score: 1 as const },
      { id: 'C6', score: 1 as const },
      { id: 'C7', score: 1 as const },
      { id: 'C8', score: 1 as const },
      { id: 'C9', score: 0 as const },
    ]
    const r = await evaluatePredicate(composed, { rubricBreakdown: breakdown })
    expect(r.passed).toBe(true)
  })

  it("cluster 1's killThreshold fails when load-bearing item fails", async () => {
    const composed = AND(
      LoadBearingPass(['C1', 'C5']),
      OverallFloor({ minPasses: 7, outOfTotal: 9 })
    )
    const breakdown = [
      { id: 'C1', score: 1 as const },
      { id: 'C2', score: 1 as const },
      { id: 'C3', score: 1 as const },
      { id: 'C4', score: 1 as const },
      { id: 'C5', score: 0 as const }, // load-bearing fail
      { id: 'C6', score: 1 as const },
      { id: 'C7', score: 1 as const },
      { id: 'C8', score: 1 as const },
      { id: 'C9', score: 1 as const }, // overall-floor would pass alone
    ]
    const r = await evaluatePredicate(composed, { rubricBreakdown: breakdown })
    expect(r.passed).toBe(false)
    expect(r.failures[0]).toContain('C5')
  })
})
