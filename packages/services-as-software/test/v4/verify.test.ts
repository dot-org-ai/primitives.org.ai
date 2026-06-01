/**
 * v4 VERIFICATION-adapter tests (aip-cnks.10 pass 2).
 *
 * `makeEvaluatorPanelVerifier` adapts a v3 {@link EvaluatorPanel} into the v4
 * {@link Verifier} port: it calls `panel.run(output, ctx)` and maps the
 * {@link PanelVerdict} into a {@link VerificationVerdict} (the 3-rater shape +
 * the rollup). These tests inject a FAKE EvaluatorPanel — no real LLM call —
 * so the mapping is exercised deterministically:
 *   - `all-approved` → rollup `auto-promote`;
 *   - `rejected`     → rollup `reject` (assurance downgraded);
 *   - `partial`      → rollup `queue-review`.
 */

import { describe, it, expect } from 'vitest'

import type { EvaluatorPanel, PanelVerdict } from '../../src/v3/evaluator-panel.js'
import { makeEvaluatorPanelVerifier } from '../../src/v4/verify.js'
import type { VerifyCtx } from '../../src/v4/index.js'

// ============================================================================
// Fixtures — a FAKE EvaluatorPanel (records the target, returns a canned verdict)
// ============================================================================

interface FakePanel {
  panel: EvaluatorPanel
  /** The last `target` the panel was run against. */
  seen: { target: unknown; ctx: unknown } | undefined
}

/** Build a fake EvaluatorPanel that returns `verdict` and records its target. */
function fakePanel(verdict: PanelVerdict): FakePanel {
  const box: FakePanel = { panel: undefined as unknown as EvaluatorPanel, seen: undefined }
  box.panel = {
    $id: 'panel:fake',
    $type: 'EvaluatorPanel',
    personas: [
      { name: 'pedantic', persona: 'p', signOff: 'must-approve', config: {} },
      { name: 'skeptic', persona: 's', signOff: 'must-approve', config: {} },
      { name: 'accuracy', persona: 'a', signOff: 'advisory', config: {} },
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
    mode: 'parallel-multi-call',
    async run(target, ctx) {
      box.seen = { target, ctx }
      return verdict
    },
  }
  return box
}

function ctxFor(output: unknown): VerifyCtx<unknown> {
  return { output, metric: 'metric:test', assurance: 'instrumented' }
}

// ============================================================================
// 1. verdict mapping
// ============================================================================

describe('makeEvaluatorPanelVerifier — verdict mapping', () => {
  it("'all-approved' → rollup 'auto-promote', assurance carried through", async () => {
    const fp = fakePanel({
      verdict: 'all-approved',
      approvals: [
        { reviewer: 'pedantic', rationale: 'ok' },
        { reviewer: 'skeptic', rationale: 'ok' },
        { reviewer: 'accuracy', rationale: 'ok' },
      ],
      rejections: [],
      rounds: 1,
      costUsd: 0.01,
    })
    const verifier = makeEvaluatorPanelVerifier(fp.panel)
    const v = await verifier.verify(ctxFor({ report: 'good' }))

    expect(v.rollup).toBe('auto-promote')
    expect(v.metric).toBe('metric:test')
    expect(v.assuranceAchieved).toBe('instrumented')
    expect(v.raters).toHaveLength(3)
    expect(v.raters.every((r) => r.verdict === 'pass')).toBe(true)
  })

  it("'rejected' → rollup 'reject', assurance downgraded to 'unverifiable'", async () => {
    const fp = fakePanel({
      verdict: 'rejected',
      approvals: [],
      rejections: [
        { reviewer: 'pedantic', rationale: 'wrong' },
        { reviewer: 'skeptic', rationale: 'unsafe' },
        { reviewer: 'accuracy', rationale: 'unsourced' },
      ],
      rounds: 1,
      costUsd: 0.02,
    })
    const verifier = makeEvaluatorPanelVerifier(fp.panel)
    const v = await verifier.verify(ctxFor({ report: 'bad' }))

    expect(v.rollup).toBe('reject')
    expect(v.assuranceAchieved).toBe('unverifiable')
    expect(v.raters.every((r) => r.verdict === 'fail')).toBe(true)
  })

  it("'partial' → rollup 'queue-review', mixed pass/fail raters", async () => {
    const fp = fakePanel({
      verdict: 'partial',
      approvals: [{ reviewer: 'pedantic', rationale: 'ok' }],
      rejections: [{ reviewer: 'skeptic', rationale: 'risky' }],
      rounds: 1,
      costUsd: 0.03,
    })
    const verifier = makeEvaluatorPanelVerifier(fp.panel)
    const v = await verifier.verify(ctxFor({ report: 'meh' }))

    expect(v.rollup).toBe('queue-review')
    // assurance carried through on a non-reject verdict.
    expect(v.assuranceAchieved).toBe('instrumented')
    const verdicts = v.raters.map((r) => r.verdict)
    expect(verdicts).toContain('pass')
    expect(verdicts).toContain('fail')
  })
})

// ============================================================================
// 2. the cascade output is threaded into panel.run
// ============================================================================

describe('makeEvaluatorPanelVerifier — output threading', () => {
  it('passes ctx.output as the panel.run target', async () => {
    const fp = fakePanel({
      verdict: 'all-approved',
      approvals: [],
      rejections: [],
      rounds: 1,
      costUsd: 0,
    })
    const verifier = makeEvaluatorPanelVerifier(fp.panel)
    const output = { report: 'judge-me' }
    await verifier.verify(ctxFor(output))
    expect(fp.seen?.target).toBe(output)
  })
})

// ============================================================================
// 3. always exactly 3 raters, regardless of persona count
// ============================================================================

describe('makeEvaluatorPanelVerifier — synthesizes the 3-rater shape', () => {
  it('pads to 3 raters when the panel reports fewer signals', async () => {
    const fp = fakePanel({
      verdict: 'all-approved',
      approvals: [{ reviewer: 'solo', rationale: 'approved' }],
      rejections: [],
      rounds: 1,
      costUsd: 0,
    })
    const verifier = makeEvaluatorPanelVerifier(fp.panel)
    const v = await verifier.verify(ctxFor({ report: 'x' }))
    expect(v.raters).toHaveLength(3)
  })

  it('caps at 3 raters when the panel reports more signals', async () => {
    const fp = fakePanel({
      verdict: 'partial',
      approvals: [
        { reviewer: 'a', rationale: '1' },
        { reviewer: 'b', rationale: '2' },
        { reviewer: 'c', rationale: '3' },
      ],
      rejections: [{ reviewer: 'd', rationale: '4' }],
      rounds: 1,
      costUsd: 0,
    })
    const verifier = makeEvaluatorPanelVerifier(fp.panel)
    const v = await verifier.verify(ctxFor({ report: 'x' }))
    expect(v.raters).toHaveLength(3)
  })
})
