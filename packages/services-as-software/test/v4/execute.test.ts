/**
 * v4 cascade-executor tests (aip-cnks.10 pass 1).
 *
 * The DELIVERING-phase executor (`makeCascadeExecutor`) is a step-walker over
 * the Deliverable's `binding.cascade` ({@link CascadeStep}[]). It dispatches
 * each step by `fnKind` through an INJECTED {@link FunctionRunner} — so these
 * tests inject a FAKE runner and make NO real LLM / sandbox calls.
 *
 * Coverage:
 *   - a 3-step cascade runs sequentially;
 *   - `$ref` resolves values from prior step outputs (the accumulating bag);
 *   - `outputAs` binds each step's result into the bag;
 *   - Code / Generative / Agentic / Human each dispatch to the right runner;
 *   - `cascade-progress` + `cost-incurred` events emit and `ctx.cost` accumulates;
 *   - the final output is the last step's value;
 *   - a Human step on the DEFAULT (unwired) runner rejects with a clear stub.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock the `ai-functions` substrate so the DEFAULT `aiFunctionsRunner` can be
// exercised with NO real LLM / sandbox call. `generateObject` returns the
// `{ result }` envelope the runner is expected to UNWRAP to `.result` (fix 3);
// `generateText`/`defineFunction` are stubbed for completeness (unused below).
vi.mock('ai-functions', () => ({
  generateObject: vi.fn(async () => ({ object: { result: { draft: 'unwrapped-value' } } })),
  generateText: vi.fn(async () => ({ text: 'agentic-text' })),
  defineFunction: vi.fn(() => ({ call: async () => ({}) })),
}))

import type { InvocationEvent, Money } from '../../src/v4/index.js'
import {
  makeCascadeExecutor,
  aiFunctionsRunner,
  resolveRefs,
  type CascadeStep,
  type FunctionRunner,
  type RunnerCtx,
} from '../../src/v4/index.js'

// ============================================================================
// Fixtures — a fake FunctionRunner that records dispatch and never calls an LLM
// ============================================================================

type Out = { report: string }

const ONE_CENT: Money = { amount: 1_000_000n, currency: 'USD' } // 1 cent in micro-cents

interface DispatchRecord {
  kind: 'code' | 'generative' | 'agentic' | 'human'
  fnId: string
  args: Record<string, unknown>
}

/**
 * Build a fake runner that records each dispatch and returns a deterministic
 * value per kind. Every kind reports a fixed {@link Money} cost so the test can
 * assert accumulation. Human is wired here (the DEFAULT runner rejects Human —
 * see the last test).
 */
function fakeRunner(records: DispatchRecord[]): FunctionRunner {
  return {
    async runCode(step, ctx: RunnerCtx) {
      records.push({ kind: 'code', fnId: step.fnId, args: ctx.args })
      return { value: { upper: String(ctx.args['text']).toUpperCase() }, cost: ONE_CENT }
    },
    async runGenerative(step, ctx: RunnerCtx) {
      records.push({ kind: 'generative', fnId: step.fnId, args: ctx.args })
      return { value: { draft: `draft-of:${String(ctx.args['upper'])}` }, cost: ONE_CENT }
    },
    async runAgentic(step, ctx: RunnerCtx) {
      records.push({ kind: 'agentic', fnId: step.fnId, args: ctx.args })
      return { value: { report: `report:${String(ctx.args['draft'])}` }, cost: ONE_CENT }
    },
    async runHuman(step, ctx: RunnerCtx) {
      records.push({ kind: 'human', fnId: step.fnId, args: ctx.args })
      return { value: { approved: true }, cost: ONE_CENT }
    },
  }
}

/** A minimal ExecCtx capturing emitted events + the running cost accumulator. */
function makeExecCtx<TIn>(input: TIn) {
  const events: InvocationEvent<Out>[] = []
  let cost: Money = { amount: 0n, currency: 'USD' }
  return {
    ctx: {
      input,
      cost,
      emit(ev: InvocationEvent<Out>) {
        events.push(ev)
        if (ev.kind === 'cost-incurred') cost = ev.cumulative
      },
    },
    events,
    cost: () => cost,
  }
}

// ============================================================================
// resolveRefs — the $ref resolver over the accumulating bag
// ============================================================================

describe('v4 resolveRefs — $ref resolution over the state bag', () => {
  it('resolves a top-level $ref from the bag', () => {
    const bag = { input: { url: 'x' }, step1: { upper: 'ABC' } }
    const resolved = resolveRefs({ text: { $ref: 'step1.upper' } }, bag)
    expect(resolved).toEqual({ text: 'ABC' })
  })

  it('passes literals through untouched', () => {
    const bag = { input: {} }
    const resolved = resolveRefs({ a: 1, b: 'lit', c: true }, bag)
    expect(resolved).toEqual({ a: 1, b: 'lit', c: true })
  })

  it('resolves a dotted path into nested input', () => {
    const bag = { input: { user: { name: 'Ada' } } }
    const resolved = resolveRefs({ who: { $ref: 'input.user.name' } }, bag)
    expect(resolved).toEqual({ who: 'Ada' })
  })

  it('throws on an unresolvable $ref', () => {
    const bag = { input: {} }
    expect(() => resolveRefs({ x: { $ref: 'nope.missing' } }, bag)).toThrow(/\$ref/)
  })
})

// ============================================================================
// makeCascadeExecutor — the sequential step-walker
// ============================================================================

describe('v4 makeCascadeExecutor — sequential cascade with a fake runner', () => {
  const cascade: CascadeStep[] = [
    {
      fnKind: 'Code',
      fnId: 'fn:upper',
      name: 'upper',
      args: { text: { $ref: 'input.text' } },
      outputAs: 'step1',
    },
    {
      fnKind: 'Generative',
      fnId: 'fn:draft',
      name: 'draft',
      args: { upper: { $ref: 'step1.upper' } },
      outputAs: 'step2',
    },
    {
      fnKind: 'Agentic',
      fnId: 'fn:report',
      name: 'report',
      args: { draft: { $ref: 'step2.draft' } },
      outputAs: 'step3',
    },
  ]

  it('walks the steps sequentially, $ref resolves, outputAs binds, final output returns', async () => {
    const records: DispatchRecord[] = []
    const executor = makeCascadeExecutor<{ text: string }, Out>({
      cascade,
      runner: fakeRunner(records),
    })
    const { ctx, events } = makeExecCtx<{ text: string }>({ text: 'hello' })

    const out = await executor.execute(ctx)

    // ── dispatch order + kind routing ──
    expect(records.map((r) => r.kind)).toEqual(['code', 'generative', 'agentic'])
    expect(records.map((r) => r.fnId)).toEqual(['fn:upper', 'fn:draft', 'fn:report'])

    // ── $ref resolution threaded the bag forward step→step ──
    expect(records[0]!.args).toEqual({ text: 'hello' })
    expect(records[1]!.args).toEqual({ upper: 'HELLO' })
    expect(records[2]!.args).toEqual({ draft: 'draft-of:HELLO' })

    // ── final output is the last step's value ──
    expect(out).toEqual({ report: 'report:draft-of:HELLO' })

    // ── one cascade-progress per step, monotonically increasing pct ──
    const progress = events.filter((e) => e.kind === 'cascade-progress')
    expect(progress).toHaveLength(3)
    expect((progress[0] as { functionRef: string }).functionRef).toBe('upper')
    const pcts = progress.map((e) => (e as { pct: number }).pct)
    expect(pcts).toEqual([...pcts].sort((a, b) => a - b))
    expect(pcts[pcts.length - 1]).toBe(100)
  })

  it('emits cost-incurred per step and accumulates ctx.cost cumulatively', async () => {
    const executor = makeCascadeExecutor<{ text: string }, Out>({
      cascade,
      runner: fakeRunner([]),
    })
    const { ctx, events, cost } = makeExecCtx<{ text: string }>({ text: 'hi' })

    await executor.execute(ctx)

    const costEvents = events.filter(
      (e): e is Extract<InvocationEvent<Out>, { kind: 'cost-incurred' }> =>
        e.kind === 'cost-incurred'
    )
    expect(costEvents).toHaveLength(3)
    // each per-step cost is ONE_CENT; cumulative climbs 1 → 2 → 3 cents.
    expect(costEvents.map((e) => e.cost.amount)).toEqual([1_000_000n, 1_000_000n, 1_000_000n])
    expect(costEvents.map((e) => e.cumulative.amount)).toEqual([1_000_000n, 2_000_000n, 3_000_000n])
    // the ExecCtx's running cost ends at the cumulative total.
    expect(cost().amount).toBe(3_000_000n)
  })

  it('dispatches a Human step to runHuman', async () => {
    const humanCascade: CascadeStep[] = [
      {
        fnKind: 'Human',
        fnId: 'fn:approve',
        name: 'approve',
        args: { ask: 'ok?' },
        outputAs: 'approval',
      },
    ]
    const records: DispatchRecord[] = []
    const executor = makeCascadeExecutor<unknown, { approved: boolean }>({
      cascade: humanCascade,
      runner: fakeRunner(records),
    })
    const { ctx } = makeExecCtx<unknown>({})
    const out = await executor.execute(ctx as never)
    expect(records.map((r) => r.kind)).toEqual(['human'])
    expect(out).toEqual({ approved: true })
  })

  it('a literal (non-$ref) arg passes through to the runner', async () => {
    const litCascade: CascadeStep[] = [
      { fnKind: 'Code', fnId: 'fn:c', name: 'c', args: { text: 'fixed' }, outputAs: 's' },
    ]
    const records: DispatchRecord[] = []
    const executor = makeCascadeExecutor<unknown, { upper: string }>({
      cascade: litCascade,
      runner: fakeRunner(records),
    })
    const { ctx } = makeExecCtx<unknown>({})
    await executor.execute(ctx as never)
    expect(records[0]!.args).toEqual({ text: 'fixed' })
  })

  it('an empty cascade returns the input as the output', async () => {
    const executor = makeCascadeExecutor<{ seed: number }, { seed: number }>({
      cascade: [],
      runner: fakeRunner([]),
    })
    const { ctx, events } = makeExecCtx<{ seed: number }>({ seed: 7 })
    const out = await executor.execute(ctx as never)
    expect(out).toEqual({ seed: 7 })
    expect(events).toHaveLength(0)
  })
})

// ============================================================================
// aiFunctionsRunner — the real default; Human rejects until a channel is wired
// ============================================================================

describe('v4 aiFunctionsRunner — default runner Human seam', () => {
  it('rejects a Human step with a clear stub (no HumanChannel injected)', async () => {
    const runner = aiFunctionsRunner()
    const step: CascadeStep = {
      fnKind: 'Human',
      fnId: 'fn:h',
      name: 'h',
      args: {},
      outputAs: 'x',
    }
    await expect(
      runner.runHuman(step, { args: {}, input: {}, bag: { input: {} } })
    ).rejects.toThrow(/Human/)
  })

  it('routes a Human step to the injected HumanChannel when provided', async () => {
    const runner = aiFunctionsRunner({
      humanChannel: {
        async ask() {
          return { value: { ok: true }, cost: { amount: 0n, currency: 'USD' } }
        },
      },
    })
    const step: CascadeStep = {
      fnKind: 'Human',
      fnId: 'fn:h',
      name: 'h',
      args: { q: 'go?' },
      outputAs: 'x',
    }
    const res = await runner.runHuman(step, { args: { q: 'go?' }, input: {}, bag: { input: {} } })
    expect(res.value).toEqual({ ok: true })
  })
})

// ============================================================================
// makeCascadeExecutor + the default aiFunctionsRunner — Human path rejects
// ============================================================================

describe('v4 makeCascadeExecutor — default runner Human path rejects', () => {
  it('a Human step on the unwired default runner rejects through execute()', async () => {
    const executor = makeCascadeExecutor<unknown, unknown>({
      cascade: [{ fnKind: 'Human', fnId: 'fn:h', name: 'h', args: {}, outputAs: 'x' }],
      runner: aiFunctionsRunner(),
    })
    const { ctx } = makeExecCtx<unknown>({})
    await expect(executor.execute(ctx as never)).rejects.toThrow(/Human/)
  })
})

// ============================================================================
// aiFunctionsRunner — the Generative runner UNWRAPS `result.object.result`
// (aip-cnks.10 fix 3). With `generateObject` mocked to return the
// `{ object: { result: <value> } }` envelope, a Generative step's `outputAs`
// must bind the UNWRAPPED `<value>` — so a later `$ref` reaches the value, not
// the `{ result: ... }` wrapper.
// ============================================================================

describe('v4 aiFunctionsRunner — Generative unwraps result.object.result', () => {
  it('runGenerative returns the unwrapped value (not the { result } wrapper)', async () => {
    const runner = aiFunctionsRunner()
    const step: CascadeStep = {
      fnKind: 'Generative',
      fnId: 'fn:g',
      name: 'g',
      args: { topic: 'x' },
      outputAs: 'gen',
    }
    const res = await runner.runGenerative(step, { args: { topic: 'x' }, input: {}, bag: {} })
    // the runner peeled the `{ result }` envelope: the value is the inner object.
    expect(res.value).toEqual({ draft: 'unwrapped-value' })
  })

  it("a Generative step's outputAs binds the unwrapped value in the cascade bag", async () => {
    const cascade: CascadeStep[] = [
      {
        fnKind: 'Generative',
        fnId: 'fn:g',
        name: 'g',
        args: { topic: 'x' },
        outputAs: 'gen',
      },
      // a second Code step $refs INTO the unwrapped value — only reachable if the
      // bag holds `{ draft: ... }` (the unwrapped value), not `{ result: {...} }`.
      {
        fnKind: 'Code',
        fnId: 'fn:c',
        name: 'c',
        args: { draft: { $ref: 'gen.draft' } },
        outputAs: 'echo',
      },
    ]
    const records: DispatchRecord[] = []
    const executor = makeCascadeExecutor<unknown, unknown>({
      cascade,
      // Generative goes through the mocked default; Code through the fake so we
      // can read the resolved $ref arg without a sandbox call.
      runner: {
        ...fakeRunner(records),
        runGenerative: aiFunctionsRunner().runGenerative,
      },
    })
    const { ctx } = makeExecCtx<unknown>({})
    await executor.execute(ctx as never)
    // the Code step saw the UNWRAPPED `draft` — the $ref reached the value.
    expect(records.find((r) => r.kind === 'code')!.args).toEqual({ draft: 'unwrapped-value' })
  })
})
