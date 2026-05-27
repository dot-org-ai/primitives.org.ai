/**
 * EvaluatorPanel — `digital-workers.ask` dispatch routing (PRD aip-qozi, slice
 * aip-hhzf).
 *
 * This is the headline test for the slice. It proves that in
 * `parallel-multi-call` mode, EvaluatorPanel.run dispatches each persona via
 * `digital-workers.ask(personaWorker, …)` rather than calling
 * `ai-functions.generateObject` directly — and that a single panel can mix
 * Agent personas (default; synthesized worker → `generateObject`) and Person
 * personas (caller-supplied worker via `personAsWorker` → Human lifecycle)
 * without panel-code changes.
 *
 * Test groups:
 *
 *   1. Regression — the synthesized-worker (default) path still produces one
 *      LLM call per persona, the verdicts aggregate under `signOffPolicy`
 *      identically to the pre-aip-hhzf behaviour, and a `LanguageModelV3`
 *      stub injected via `spec.model` still routes all calls.
 *   2. Mixed-personas — a panel with one Agent persona and one Person
 *      persona dispatches each through its own path. The Agent's
 *      synthesized worker calls the injected LanguageModelV3 stub; the
 *      Person's `personAsWorker` Worker walks the Human lifecycle and
 *      obtains the answer via the injected `resolve` callback. We assert
 *      both paths were taken in the same run, and that the aggregation
 *      yields the expected verdict.
 *   3. signOffPolicy + iterationPolicy — round count flows through to
 *      `PanelVerdict.rounds`, a `must-approve` rejection from EITHER path
 *      hard-blocks (no aggregate-override regardless of policy), and
 *      `iterationPolicy.maxRounds` clamps the reported round.
 */

import { describe, it, expect } from 'vitest'
import type { LanguageModelV3 } from 'ai-functions'

import { personAsWorker } from 'human-in-the-loop'
import type { Human } from 'human-in-the-loop'
import { LifecycleStoreMemory } from 'human-in-the-loop/lifecycle-store-memory'

import { EvaluatorPanel, type AgenticPersona } from '../../src/v3/evaluator-panel.js'

// ============================================================================
// Stub LanguageModelV3 — mirrors the model-injection test stub so this file
// can run without a real LLM, AND records every doGenerate so we can prove
// the Agent-persona path actually flowed through `generateObject` (the
// dispatch routing assertion).
// ============================================================================

interface RecordingV3Stub extends LanguageModelV3 {
  /** Recorded `doGenerate` invocations (one entry per call). */
  calls: Array<{ promptText: string }>
}

function makeRecordingStub(opts: {
  provider: string
  modelId: string
  verdict?: 'approve' | 'reject'
  rationale?: string
}): RecordingV3Stub {
  const calls: Array<{ promptText: string }> = []
  const verdict = opts.verdict ?? 'approve'
  const rationale = opts.rationale ?? `${opts.modelId} stub response`
  const stub: LanguageModelV3 = {
    specificationVersion: 'v3',
    provider: opts.provider,
    modelId: opts.modelId,
    supportedUrls: {},
    async doGenerate(options) {
      const promptText = JSON.stringify(options.prompt)
      calls.push({ promptText })
      const json = JSON.stringify({ verdict, rationale })
      return {
        content: [{ type: 'text', text: json }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
        warnings: [],
      }
    },
    async doStream() {
      throw new Error('doStream not used in EvaluatorPanel tests')
    },
  }
  return Object.assign(stub, { calls })
}

// ============================================================================
// Persona helpers
// ============================================================================

function agentPersona(
  name: string,
  signOff: 'must-approve' | 'advisory' = 'advisory'
): AgenticPersona {
  return {
    name,
    persona: `You are agent reviewer ${name}.`,
    signOff,
    config: { archetype: 'pedantic', domain: 'test' },
  }
}

function personPersona(
  name: string,
  human: Human,
  resolveAnswer: string,
  signOff: 'must-approve' | 'advisory' = 'advisory'
): AgenticPersona {
  // The whole point of the slice: a persona that routes through
  // `personAsWorker` instead of the synthesized agent. The panel sees only
  // the persona shape; `worker` is opaque to the panel.
  const worker = personAsWorker(human, {
    store: new LifecycleStoreMemory(),
    // The channel-delivery seam: in tests we resolve synchronously with the
    // pre-arranged answer rather than wiring a real Chat SDK adapter.
    resolve: async () => resolveAnswer,
  })
  return {
    name,
    persona: `You are human reviewer ${name}.`,
    signOff,
    config: { archetype: 'human', domain: 'test' },
    worker,
  }
}

function makeHuman(id: string, name: string): Human {
  return { id, name, email: `${id}@example.com`, roles: ['reviewer'] }
}

// ============================================================================
// Group 1 — Regression: synthesized-worker path is unchanged
// ============================================================================

describe('EvaluatorPanel — regression after aip-hhzf (synthesized worker path)', () => {
  it('still makes one LLM call per persona in parallel-multi-call mode', async () => {
    const stub = makeRecordingStub({ provider: 'test', modelId: 'panel-default' })
    const panel = EvaluatorPanel.define({
      $id: 'panel:regression-call-count',
      personas: [agentPersona('p1'), agentPersona('p2'), agentPersona('p3')],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: stub,
    })

    const verdict = await panel.run({ artifact: 'hello' })

    expect(stub.calls.length).toBe(3)
    expect(verdict.verdict).toBe('all-approved')
    expect(verdict.approvals).toHaveLength(3)
    expect(verdict.rejections).toHaveLength(0)
  })

  it('aggregates verdicts under signOffPolicy: all-approve (any reject → rejected)', async () => {
    const approveStub = makeRecordingStub({ provider: 'test', modelId: 'approver' })
    // Per-call-override path: we want one persona to reject. Easiest is to
    // wire ONE rejecting stub for the whole run; both personas hit the same
    // model so both reject — sufficient to prove all-approve hard-blocks.
    const rejectStub = makeRecordingStub({
      provider: 'test',
      modelId: 'rejector',
      verdict: 'reject',
      rationale: 'nope',
    })

    const approvingPanel = EvaluatorPanel.define({
      $id: 'panel:regression-aggregation-pass',
      personas: [agentPersona('p1', 'must-approve'), agentPersona('p2', 'must-approve')],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: approveStub,
    })
    const passVerdict = await approvingPanel.run({ artifact: 'hello' })
    expect(passVerdict.verdict).toBe('all-approved')

    const rejectingPanel = EvaluatorPanel.define({
      $id: 'panel:regression-aggregation-fail',
      personas: [agentPersona('p1', 'must-approve'), agentPersona('p2', 'must-approve')],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: rejectStub,
    })
    const failVerdict = await rejectingPanel.run({ artifact: 'hello' })
    expect(failVerdict.verdict).toBe('rejected')
    expect(failVerdict.rejections).toHaveLength(2)
  })

  it('tracks costUsd > 0 for the synthesized-worker path', async () => {
    const stub = makeRecordingStub({ provider: 'test', modelId: 'panel-default' })
    const panel = EvaluatorPanel.define({
      $id: 'panel:regression-cost',
      personas: [agentPersona('p1'), agentPersona('p2')],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: stub,
    })
    const verdict = await panel.run({ artifact: 'hello' })
    // Each synthesized worker reports usage; two personas → cost > 0.
    expect(verdict.costUsd).toBeGreaterThan(0)
  })
})

// ============================================================================
// Group 2 — Mixed Agent + Person personas (the headline)
// ============================================================================

describe('EvaluatorPanel — mixed Agent + Person dispatch (aip-hhzf headline)', () => {
  it('dispatches an Agent persona via generateObject AND a Person persona via the Human lifecycle in the same run', async () => {
    // The Agent persona has NO `worker` — the panel synthesizes one that
    // routes through the injected LanguageModelV3 stub. If the panel
    // reverted to a direct `generateObject` call (the pre-slice behaviour),
    // this stub would still record the call — that's fine. The discriminant
    // for "routed via digital-workers.ask" is on the Person side: a Person
    // persona's `personAsWorker(human, { resolve })` callback only fires if
    // `digital-workers.ask` dispatched through the Worker's `dispatch.ask`
    // port. If the panel skipped that seam, the resolver would never run
    // and we'd never see the Person's verdict in the output.
    const agentStub = makeRecordingStub({
      provider: 'test',
      modelId: 'agent-model',
      verdict: 'approve',
      rationale: 'agent says yes',
    })

    const priya = makeHuman('person_priya', 'Priya')
    let personResolveCalls = 0
    const priyaPersona: AgenticPersona = {
      name: 'priya-reviewer',
      persona: 'You are Priya, a human reviewer.',
      signOff: 'advisory',
      config: { archetype: 'human', domain: 'test' },
      worker: personAsWorker(priya, {
        store: new LifecycleStoreMemory(),
        resolve: async () => {
          personResolveCalls++
          // Person returns prose; coerceVerdict normalizes 'approve' prefix.
          return 'approve — Priya signs off after lifecycle walk'
        },
      }),
    }

    const panel = EvaluatorPanel.define({
      $id: 'panel:mixed-agent-person',
      personas: [agentPersona('codex-agent'), priyaPersona],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: agentStub,
    })

    const verdict = await panel.run({ artifact: 'PR #42: fix retry classifier' })

    // 1. Agent persona DID route through the injected LanguageModelV3 stub.
    //    Only the Agent persona hits this stub — the Person persona's
    //    worker bypasses `generateObject` entirely.
    expect(agentStub.calls.length).toBe(1)
    expect(agentStub.calls[0]?.promptText).toContain('codex-agent')

    // 2. Person persona DID route through the Human lifecycle (the
    //    `personAsWorker` resolver fired exactly once). This is the
    //    load-bearing assertion: if the panel called `generateObject`
    //    directly instead of dispatching via `digital-workers.ask`, this
    //    counter would be 0.
    expect(personResolveCalls).toBe(1)

    // 3. Aggregation works across mixed-kind verdicts.
    expect(verdict.verdict).toBe('all-approved')
    expect(verdict.approvals).toHaveLength(2)
    const reviewers = verdict.approvals.map((a) => a.reviewer).sort()
    expect(reviewers).toEqual(['codex-agent', 'priya-reviewer'])
  })

  it('a Person persona rejection (via the resolver) flows through to PanelVerdict', async () => {
    const agentStub = makeRecordingStub({
      provider: 'test',
      modelId: 'agent-model',
      verdict: 'approve',
      rationale: 'looks fine',
    })

    const human = makeHuman('person_carol', 'Carol')
    const rejectingPanel = EvaluatorPanel.define({
      $id: 'panel:mixed-person-rejects',
      personas: [
        agentPersona('p-agent', 'must-approve'),
        // Person persona is `must-approve`; its rejection MUST hard-block
        // regardless of how many other personas approve.
        personPersona('p-human', human, 'reject — missing tests', 'must-approve'),
      ],
      signOffPolicy: 'majority',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: agentStub,
    })

    const verdict = await rejectingPanel.run({ artifact: 'PR #99' })

    // Must-approve persona rejected → panel-level rejection regardless of
    // the agent's approval. This is the cross-cell invariant: mixed-kind
    // personas obey the same signOff semantics.
    expect(verdict.verdict).toBe('rejected')
    const rejecters = verdict.rejections.map((r) => r.reviewer)
    expect(rejecters).toContain('p-human')
  })

  it('Person persona contributes costUsd = 0 (panel cannot see inside external worker)', async () => {
    const agentStub = makeRecordingStub({ provider: 'test', modelId: 'agent-model' })
    const human = makeHuman('person_dee', 'Dee')

    const personOnlyPanel = EvaluatorPanel.define({
      $id: 'panel:mixed-cost-attribution',
      personas: [personPersona('p-human', human, 'approve')],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: agentStub,
    })
    const verdict = await personOnlyPanel.run({ artifact: 'x' })
    expect(verdict.verdict).toBe('all-approved')
    // The agent stub was NOT called — Person persona bypassed generateObject.
    expect(agentStub.calls.length).toBe(0)
    // No LLM cost is attributed to the external-worker path.
    expect(verdict.costUsd).toBe(0)
  })
})

// ============================================================================
// Group 3 — signOffPolicy + iterationPolicy preservation
// ============================================================================

describe('EvaluatorPanel — signOffPolicy + iterationPolicy preserved after aip-hhzf', () => {
  it('reports the requested round in PanelVerdict.rounds, clamped to maxRounds', async () => {
    const stub = makeRecordingStub({ provider: 'test', modelId: 'panel-default' })
    const panel = EvaluatorPanel.define({
      $id: 'panel:iteration-round-clamp',
      personas: [agentPersona('p1')],
      signOffPolicy: 'all-approve',
      // maxRounds clamps requested ctx.rounds.
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: stub,
    })

    const round1 = await panel.run({ artifact: 'x' })
    expect(round1.rounds).toBe(1)

    const round2 = await panel.run({ artifact: 'x' }, { rounds: 2 })
    expect(round2.rounds).toBe(2)

    // Requested round 5 clamps to maxRounds=2.
    const overflowed = await panel.run({ artifact: 'x' }, { rounds: 5 })
    expect(overflowed.rounds).toBe(2)
  })

  it('majority policy: a single must-approve rejection (from either kind) hard-blocks', async () => {
    const agentStub = makeRecordingStub({ provider: 'test', modelId: 'approving-agent' })
    const human = makeHuman('person_eli', 'Eli')

    const panel = EvaluatorPanel.define({
      $id: 'panel:majority-must-approve-block',
      personas: [
        // Three advisory approvers (one Agent + one Person + one Agent)
        // would otherwise satisfy majority, but the must-approve human
        // rejector hard-blocks per spec.
        agentPersona('a1'),
        agentPersona('a2'),
        personPersona('p-must', human, 'reject — risk too high', 'must-approve'),
      ],
      signOffPolicy: 'majority',
      iterationPolicy: { maxRounds: 1, onMaxRoundsExceeded: 'auto-fail' },
      mode: 'parallel-multi-call',
      model: agentStub,
    })

    const verdict = await panel.run({ artifact: 'x' })
    expect(verdict.verdict).toBe('rejected')
    expect(verdict.rejections.map((r) => r.reviewer)).toEqual(['p-must'])
  })
})
