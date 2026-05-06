/**
 * Tests for the v3 middleware stack — cacheMiddleware, budgetMiddleware,
 * traceMiddleware, wrapForV3, and the EvalLogStore primitive.
 *
 * Uses the AI SDK 6 `MockLanguageModelV3` from `'ai/test'` to simulate
 * doGenerate / doStream without hitting a real provider.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { wrapLanguageModel } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import type {
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider'
import {
  BudgetTracker,
  cacheMiddleware,
  budgetMiddleware,
  traceMiddleware,
  wrapForV3,
  InMemoryEvalLogStore,
  configureEvalLogStore,
  getEvalLogStore,
  type TraceEvent,
} from '../src/index.js'

// ============================================================================
// Helpers
// ============================================================================

function makeGenerateResult(
  text: string,
  inputTokens = 100,
  outputTokens = 50
): LanguageModelV3GenerateResult {
  return {
    content: [{ type: 'text', text }],
    finishReason: 'stop',
    usage: {
      inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
    },
    warnings: [],
  }
}

function makeStreamResult(
  text: string,
  inputTokens = 100,
  outputTokens = 50
): LanguageModelV3StreamResult {
  const chunks: LanguageModelV3StreamPart[] = [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: '1' },
    { type: 'text-delta', id: '1', delta: text },
    { type: 'text-end', id: '1' },
    {
      type: 'finish',
      finishReason: 'stop',
      usage: {
        inputTokens: { total: inputTokens, noCache: inputTokens, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: outputTokens, text: outputTokens, reasoning: 0 },
      },
    },
  ]
  return {
    stream: new ReadableStream<LanguageModelV3StreamPart>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk)
        controller.close()
      },
    }),
  }
}

function makeCallOptions(promptText: string): LanguageModelV3CallOptions {
  return {
    prompt: [{ role: 'user', content: [{ type: 'text', text: promptText }] }],
  }
}

async function consumeStream(
  stream: ReadableStream<LanguageModelV3StreamPart>
): Promise<LanguageModelV3StreamPart[]> {
  const reader = stream.getReader()
  const out: LanguageModelV3StreamPart[] = []
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    out.push(value)
  }
  return out
}

// ============================================================================
// cacheMiddleware
// ============================================================================

describe('cacheMiddleware', () => {
  beforeEach(() => {
    process.env['V3_EVAL_CACHE'] = '1'
  })

  it('hit: returns cached result; miss: invokes wrapped model', async () => {
    let calls = 0
    const base = new MockLanguageModelV3({
      doGenerate: async () => {
        calls++
        return makeGenerateResult(`response-${calls}`)
      },
    })
    const wrapped = wrapLanguageModel({ model: base, middleware: cacheMiddleware() })
    const params = makeCallOptions('hello')
    const r1 = await wrapped.doGenerate(params)
    const r2 = await wrapped.doGenerate(params)
    expect(calls).toBe(1)
    expect(r1.content).toEqual(r2.content)
    expect((r1.content[0] as { text: string }).text).toBe('response-1')
  })

  it('key derivation invalidates on prompt change', async () => {
    let calls = 0
    const base = new MockLanguageModelV3({
      doGenerate: async () => {
        calls++
        return makeGenerateResult(`r${calls}`)
      },
    })
    const wrapped = wrapLanguageModel({ model: base, middleware: cacheMiddleware() })
    await wrapped.doGenerate(makeCallOptions('first'))
    await wrapped.doGenerate(makeCallOptions('second'))
    expect(calls).toBe(2)
  })

  it('key derivation invalidates on schema change', async () => {
    let calls = 0
    const base = new MockLanguageModelV3({
      doGenerate: async () => {
        calls++
        return makeGenerateResult(`r${calls}`)
      },
    })
    const wrapped = wrapLanguageModel({ model: base, middleware: cacheMiddleware() })
    const baseParams = makeCallOptions('hello')
    await wrapped.doGenerate({
      ...baseParams,
      responseFormat: {
        type: 'json',
        schema: { type: 'object', properties: { a: { type: 'string' } } },
      },
    })
    await wrapped.doGenerate({
      ...baseParams,
      responseFormat: {
        type: 'json',
        schema: { type: 'object', properties: { b: { type: 'string' } } },
      },
    })
    expect(calls).toBe(2)
  })

  it('TTL: expired entries are evicted on access', async () => {
    let calls = 0
    const base = new MockLanguageModelV3({
      doGenerate: async () => {
        calls++
        return makeGenerateResult(`r${calls}`)
      },
    })
    // 1ms TTL — second call after a short await is past expiry.
    const wrapped = wrapLanguageModel({
      model: base,
      middleware: cacheMiddleware({ ttlMs: 1 }),
    })
    const params = makeCallOptions('hello')
    await wrapped.doGenerate(params)
    await new Promise((r) => setTimeout(r, 10))
    await wrapped.doGenerate(params)
    expect(calls).toBe(2)
  })

  it('respects 24h TTL by default (no eviction in-test)', async () => {
    let calls = 0
    const base = new MockLanguageModelV3({
      doGenerate: async () => {
        calls++
        return makeGenerateResult('cached')
      },
    })
    const wrapped = wrapLanguageModel({ model: base, middleware: cacheMiddleware() })
    const params = makeCallOptions('hello')
    await wrapped.doGenerate(params)
    await wrapped.doGenerate(params)
    await wrapped.doGenerate(params)
    expect(calls).toBe(1)
  })

  it('passthrough when env gate is disabled', async () => {
    let calls = 0
    const base = new MockLanguageModelV3({
      doGenerate: async () => {
        calls++
        return makeGenerateResult(`r${calls}`)
      },
    })
    const wrapped = wrapLanguageModel({
      model: base,
      middleware: cacheMiddleware({ enabled: false }),
    })
    const params = makeCallOptions('hello')
    await wrapped.doGenerate(params)
    await wrapped.doGenerate(params)
    expect(calls).toBe(2)
  })

  it('streams: caches and replays chunks via simulateReadableStream', async () => {
    let calls = 0
    const base = new MockLanguageModelV3({
      doStream: async () => {
        calls++
        return makeStreamResult(`stream-${calls}`)
      },
    })
    const wrapped = wrapLanguageModel({ model: base, middleware: cacheMiddleware() })
    const params = makeCallOptions('streaming hello')
    const r1 = await wrapped.doStream(params)
    const chunks1 = await consumeStream(r1.stream)
    const r2 = await wrapped.doStream(params)
    const chunks2 = await consumeStream(r2.stream)
    expect(calls).toBe(1)
    // Same shape, same content
    const text1 = chunks1.find((c) => c.type === 'text-delta') as { delta: string } | undefined
    const text2 = chunks2.find((c) => c.type === 'text-delta') as { delta: string } | undefined
    expect(text1?.delta).toBe('stream-1')
    expect(text2?.delta).toBe('stream-1')
  })
})

// ============================================================================
// budgetMiddleware
// ============================================================================

describe('budgetMiddleware', () => {
  beforeEach(() => {
    process.env['V3_EVAL_CACHE'] = '1'
  })

  it('records usage to tracker on completion', async () => {
    const tracker = new BudgetTracker()
    const base = new MockLanguageModelV3({
      modelId: 'gpt-4o',
      doGenerate: async () => makeGenerateResult('hi', 1000, 500),
    })
    const wrapped = wrapLanguageModel({ model: base, middleware: budgetMiddleware({ tracker }) })
    await wrapped.doGenerate(makeCallOptions('hello'))
    expect(tracker.getTotalInputTokens()).toBe(1000)
    expect(tracker.getTotalOutputTokens()).toBe(500)
    // gpt-4o pricing: $2.5/M input, $10/M output → 0.0025 + 0.005 = 0.0075
    expect(tracker.getTotalCost()).toBeCloseTo(0.0075, 6)
  })

  it('works on cached path AND fresh path', async () => {
    const tracker = new BudgetTracker()
    let underlyingCalls = 0
    const base = new MockLanguageModelV3({
      modelId: 'gpt-4o',
      doGenerate: async () => {
        underlyingCalls++
        return makeGenerateResult('cached', 100, 50)
      },
    })
    // Order matters here: cache → budget. With this order, cache is FIRST
    // in the array → outermost on the way in. On a cache hit, cache short-
    // circuits and budget never sees the call. We flip the order so budget
    // wraps cache: budget always sees the (cached or fresh) result.
    const wrapped = wrapLanguageModel({
      model: base,
      middleware: [budgetMiddleware({ tracker }), cacheMiddleware()],
    })
    const params = makeCallOptions('budget+cache')
    await wrapped.doGenerate(params)
    await wrapped.doGenerate(params)
    expect(underlyingCalls).toBe(1)
    // Budget recorded twice (once on miss, once on hit).
    expect(tracker.getTotalInputTokens()).toBe(200)
    expect(tracker.getTotalOutputTokens()).toBe(100)
  })

  it('pricing overlay applied via modelIdOverride', async () => {
    const tracker = new BudgetTracker({
      customPricing: {
        sonnet: { inputPricePerMillion: 3, outputPricePerMillion: 15 },
      },
    })
    const base = new MockLanguageModelV3({
      modelId: 'unknown-id',
      doGenerate: async () => makeGenerateResult('hi', 1_000_000, 1_000_000),
    })
    const wrapped = wrapLanguageModel({
      model: base,
      middleware: budgetMiddleware({ tracker, modelIdOverride: 'sonnet' }),
    })
    await wrapped.doGenerate(makeCallOptions('hello'))
    // 1M in @ $3 + 1M out @ $15 = $18
    expect(tracker.getTotalCost()).toBeCloseTo(18, 4)
  })

  it('streams: records usage from finish part', async () => {
    const tracker = new BudgetTracker()
    const base = new MockLanguageModelV3({
      modelId: 'gpt-4o',
      doStream: async () => makeStreamResult('streamed', 200, 100),
    })
    const wrapped = wrapLanguageModel({ model: base, middleware: budgetMiddleware({ tracker }) })
    const r = await wrapped.doStream(makeCallOptions('hello'))
    await consumeStream(r.stream)
    expect(tracker.getTotalInputTokens()).toBe(200)
    expect(tracker.getTotalOutputTokens()).toBe(100)
  })
})

// ============================================================================
// traceMiddleware
// ============================================================================

describe('traceMiddleware', () => {
  it('emits expected event shape', async () => {
    const events: TraceEvent[] = []
    const base = new MockLanguageModelV3({
      modelId: 'gpt-4o',
      doGenerate: async () => makeGenerateResult('the response', 10, 5),
    })
    const wrapped = wrapLanguageModel({
      model: base,
      middleware: traceMiddleware({ kind: 'eval-trace', emit: (e) => events.push(e) }),
    })
    await wrapped.doGenerate(makeCallOptions('the prompt'))
    expect(events.length).toBe(1)
    const ev = events[0]!
    expect(ev.kind).toBe('eval-trace')
    expect(ev.model).toBe('gpt-4o')
    expect(ev.prompt).toContain('the prompt')
    expect(ev.response).toBe('the response')
    expect(ev.usage?.inputTokens.total).toBe(10)
    expect(ev.usage?.outputTokens.total).toBe(5)
    expect(typeof ev.durationMs).toBe('number')
    expect(ev.durationMs).toBeGreaterThanOrEqual(0)
  })

  it("doesn't break the wrapped chain on emit error", async () => {
    const base = new MockLanguageModelV3({
      modelId: 'gpt-4o',
      doGenerate: async () => makeGenerateResult('ok', 1, 1),
    })
    const wrapped = wrapLanguageModel({
      model: base,
      middleware: traceMiddleware({
        emit: () => {
          throw new Error('sink is broken')
        },
      }),
    })
    // Should NOT throw — emit error is swallowed.
    const result = await wrapped.doGenerate(makeCallOptions('hi'))
    expect((result.content[0] as { text: string }).text).toBe('ok')
  })

  it('supports getCostUsd resolver for costUsd field', async () => {
    const events: TraceEvent[] = []
    const base = new MockLanguageModelV3({
      modelId: 'gpt-4o',
      doGenerate: async () => makeGenerateResult('hi', 1000, 500),
    })
    const wrapped = wrapLanguageModel({
      model: base,
      middleware: traceMiddleware({
        emit: (e) => events.push(e),
        getCostUsd: (_modelId, usage) => {
          const inT = usage?.inputTokens.total ?? 0
          const outT = usage?.outputTokens.total ?? 0
          return (inT / 1_000_000) * 2.5 + (outT / 1_000_000) * 10
        },
      }),
    })
    await wrapped.doGenerate(makeCallOptions('hi'))
    expect(events[0]?.costUsd).toBeCloseTo(0.0075, 6)
  })

  it('streams: emits on stream end with collected text', async () => {
    const events: TraceEvent[] = []
    const base = new MockLanguageModelV3({
      modelId: 'gpt-4o',
      doStream: async () => makeStreamResult('streamed-text', 50, 25),
    })
    const wrapped = wrapLanguageModel({
      model: base,
      middleware: traceMiddleware({ emit: (e) => events.push(e) }),
    })
    const r = await wrapped.doStream(makeCallOptions('hi'))
    await consumeStream(r.stream)
    // Wait a tick for flush handler
    await new Promise((r) => setTimeout(r, 10))
    expect(events.length).toBe(1)
    expect(events[0]?.response).toBe('streamed-text')
  })
})

// ============================================================================
// wrapForV3
// ============================================================================

describe('wrapForV3', () => {
  beforeEach(() => {
    process.env['V3_EVAL_CACHE'] = '1'
  })

  it('composes in correct order (cache → budget → trace)', async () => {
    const tracker = new BudgetTracker()
    const events: TraceEvent[] = []
    let underlyingCalls = 0
    const base = new MockLanguageModelV3({
      modelId: 'gpt-4o',
      doGenerate: async () => {
        underlyingCalls++
        return makeGenerateResult('combined', 100, 50)
      },
    })
    const wrapped = wrapForV3(base, {
      cache: {},
      budget: { tracker },
      trace: { emit: (e) => events.push(e) },
    })
    const params = makeCallOptions('hello combined')
    // First call: miss → underlying invoked, budget records, trace emits
    await (
      wrapped as unknown as {
        doGenerate: (o: LanguageModelV3CallOptions) => Promise<LanguageModelV3GenerateResult>
      }
    ).doGenerate(params)
    // Second call: cache hit → cache short-circuits; budget+trace do NOT
    // run because they're installed AFTER cache. (See JSDoc on wrapForV3
    // composition order — cache-first is the eval-fixture default.)
    await (
      wrapped as unknown as {
        doGenerate: (o: LanguageModelV3CallOptions) => Promise<LanguageModelV3GenerateResult>
      }
    ).doGenerate(params)
    expect(underlyingCalls).toBe(1)
    expect(tracker.getTotalInputTokens()).toBe(100)
    expect(events.length).toBe(1)
  })

  it('options can be omitted partially', async () => {
    const tracker = new BudgetTracker()
    const base = new MockLanguageModelV3({
      modelId: 'gpt-4o',
      doGenerate: async () => makeGenerateResult('partial', 10, 5),
    })
    // Only budget — no cache, no trace
    const wrapped = wrapForV3(base, { budget: { tracker } })
    await (
      wrapped as unknown as {
        doGenerate: (o: LanguageModelV3CallOptions) => Promise<LanguageModelV3GenerateResult>
      }
    ).doGenerate(makeCallOptions('hi'))
    expect(tracker.getTotalInputTokens()).toBe(10)
  })

  it('returns the underlying model when all options are absent', async () => {
    const base = new MockLanguageModelV3({
      doGenerate: async () => makeGenerateResult('untouched', 1, 1),
    })
    const wrapped = wrapForV3(base, {})
    expect(wrapped).toBe(base)
  })
})

// ============================================================================
// EvalLogStore (in-memory)
// ============================================================================

describe('InMemoryEvalLogStore', () => {
  let store: InMemoryEvalLogStore

  beforeEach(() => {
    store = new InMemoryEvalLogStore()
  })

  it('record + get round-trips', async () => {
    const stored = await store.record({
      model: 'gpt-4o',
      prompt: 'hello',
      response: 'hi',
      usage: { inputTokens: 10, outputTokens: 5 },
      costUsd: 0.001,
      durationMs: 42,
    })
    expect(stored.$id).toBeTruthy()
    expect(stored.createdAt).toBeGreaterThan(0)
    const fetched = await store.get(stored.$id)
    expect(fetched).toEqual(stored)
  })

  it('list returns most recent first', async () => {
    await store.record({
      model: 'a',
      prompt: 'p1',
      response: 'r1',
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0,
      durationMs: 1,
    })
    await store.record({
      model: 'b',
      prompt: 'p2',
      response: 'r2',
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0,
      durationMs: 1,
    })
    const list = await store.list()
    expect(list.length).toBe(2)
    expect(list[0]?.model).toBe('b')
    expect(list[1]?.model).toBe('a')
  })

  it('list filters by model and traceId', async () => {
    await store.record({
      model: 'gpt-4o',
      traceId: 't1',
      prompt: 'p',
      response: 'r',
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0,
      durationMs: 1,
    })
    await store.record({
      model: 'sonnet',
      traceId: 't1',
      prompt: 'p',
      response: 'r',
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0,
      durationMs: 1,
    })
    await store.record({
      model: 'gpt-4o',
      traceId: 't2',
      prompt: 'p',
      response: 'r',
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0,
      durationMs: 1,
    })
    expect((await store.list({ model: 'gpt-4o' })).length).toBe(2)
    expect((await store.list({ traceId: 't1' })).length).toBe(2)
    expect((await store.list({ model: 'gpt-4o', traceId: 't1' })).length).toBe(1)
  })

  it('list filters by tags (superset match)', async () => {
    await store.record({
      model: 'a',
      tags: { persona: 'cfo', step: '3' },
      prompt: 'p',
      response: 'r',
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0,
      durationMs: 1,
    })
    await store.record({
      model: 'b',
      tags: { persona: 'cto' },
      prompt: 'p',
      response: 'r',
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0,
      durationMs: 1,
    })
    expect((await store.list({ tags: { persona: 'cfo' } })).length).toBe(1)
    expect((await store.list({ tags: { persona: 'cto' } })).length).toBe(1)
    expect((await store.list({ tags: { persona: 'unknown' } })).length).toBe(0)
  })

  it('delete removes the entry', async () => {
    const e = await store.record({
      model: 'a',
      prompt: 'p',
      response: 'r',
      usage: { inputTokens: 1, outputTokens: 1 },
      costUsd: 0,
      durationMs: 1,
    })
    expect(await store.delete(e.$id)).toBe(true)
    expect(await store.get(e.$id)).toBeUndefined()
    expect(await store.delete(e.$id)).toBe(false)
  })

  it('global accessor + override', async () => {
    const custom = new InMemoryEvalLogStore()
    configureEvalLogStore(custom)
    expect(getEvalLogStore()).toBe(custom)
    configureEvalLogStore(null)
    const lazy = getEvalLogStore()
    expect(lazy).toBeInstanceOf(InMemoryEvalLogStore)
    expect(lazy).not.toBe(custom)
    // Reset so subsequent test-runs see a clean default
    configureEvalLogStore(null)
  })
})
