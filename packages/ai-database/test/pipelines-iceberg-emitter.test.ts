/**
 * Pipelines → Iceberg emitter tests — Phase 2 final, bead `aip-0ypt`.
 *
 * Covers:
 * - Workers binding mode: emit() routes Things + Actions through the
 *   structural `PipelinesStreamBindingLike` fake.
 * - Schema mapping: rows match the documented Iceberg shape.
 * - Fire-and-forget semantics: send() failures don't reach the caller.
 * - Exactly-once dedup: `_dedup_key` carries the configured field.
 * - Composition with `CascadeWriteStrategy` — emitter wired through
 *   `analyticalEmitter` option, swallowed errors don't fail cascade
 *   commits.
 * - HTTP fallback mode: `POST` body shape, auth header, bad-status
 *   error swallowing.
 * - Separate Things / Actions bindings.
 * - Empty-batch fast path.
 */

import { describe, it, expect, vi } from 'vitest'

import {
  createPipelinesIcebergEmitter,
  createHttpPipelinesIcebergEmitter,
  type PipelinesStreamBindingLike,
} from '../src/pipelines-iceberg-emitter.js'
import {
  CascadeShardingStrategies,
  createCascadeWriteStrategy,
  type ShardRef,
} from '../src/cascade-write-strategy.js'
import { createMemoryProvider } from '../src/memory-provider.js'

// =============================================================================
// Structural-fake binding
// =============================================================================

interface SentBatch {
  records: ReadonlyArray<Record<string, unknown>>
}

function makeFakeBinding(): {
  binding: PipelinesStreamBindingLike
  sent: SentBatch[]
} {
  const sent: SentBatch[] = []
  return {
    sent,
    binding: {
      async send(records) {
        sent.push({ records })
      },
    },
  }
}

function makeFailingBinding(error = new Error('pipeline boom')): PipelinesStreamBindingLike {
  return {
    async send() {
      throw error
    },
  }
}

function makeShard(overrides: Partial<ShardRef> = {}): ShardRef {
  return {
    key: 'cascade:abc',
    model: 'per-cascade',
    context: { cascadeId: 'abc' },
    ...overrides,
  }
}

const FIXED_NOW = '2026-05-05T00:00:00.000Z'
const fixedNow = (): string => FIXED_NOW

// =============================================================================
// Tests — binding-mode emitter
// =============================================================================

describe('createPipelinesIcebergEmitter — binding mode', () => {
  it('throws when no binding is configured', () => {
    expect(() => createPipelinesIcebergEmitter({})).toThrow(/binding/)
  })

  it('emits Things rows with the documented Iceberg shape', async () => {
    const { binding, sent } = makeFakeBinding()
    const emitter = createPipelinesIcebergEmitter({
      binding,
      thingsTable: 'aidb.things',
      actionsTable: 'aidb.actions',
      tenantId: 'acme',
      now: fixedNow,
      awaitSend: true,
    })
    await emitter({
      shard: makeShard(),
      batch: {
        things: [
          { id: 'c1', type: 'Customer', data: { name: 'Acme', industry: 'B2B' } },
          { id: 'o1', type: 'Order', data: { total: 100 } },
        ],
      },
      result: { thingsInserted: 2, actionsInserted: 0 },
    })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.records).toHaveLength(2)
    const first = sent[0]!.records[0]!
    expect(first).toMatchObject({
      id: 'c1',
      type: 'Customer',
      cascade_id: 'abc',
      tenant_id: 'acme',
      shard_key: 'cascade:abc',
      created_at: FIXED_NOW,
      updated_at: FIXED_NOW,
      _table: 'aidb.things',
      _dedup_key: 'c1',
    })
    // Data should be JSON-stringified with sorted keys (stable hash).
    expect(first['data']).toBe(JSON.stringify({ industry: 'B2B', name: 'Acme' }))
  })

  it('emits Actions rows with the documented SVO shape', async () => {
    const { binding, sent } = makeFakeBinding()
    const emitter = createPipelinesIcebergEmitter({
      binding,
      now: fixedNow,
      awaitSend: true,
    })
    await emitter({
      shard: makeShard(),
      batch: {
        actions: [
          {
            id: 'a1',
            verb: 'placedBy',
            subject: 'o1',
            object: 'c1',
            roles: { recipient: 'sales' },
            data: { confidence: 0.9 },
            status: 'completed',
          },
        ],
      },
      result: { thingsInserted: 0, actionsInserted: 1 },
    })
    expect(sent).toHaveLength(1)
    const row = sent[0]!.records[0]!
    expect(row).toMatchObject({
      id: 'a1',
      verb: 'placedBy',
      subject: 'o1',
      object: 'c1',
      status: 'completed',
      cascade_id: 'abc',
      shard_key: 'cascade:abc',
      timestamp: FIXED_NOW,
      _dedup_key: 'a1',
    })
    expect(row['roles']).toBe(JSON.stringify({ recipient: 'sales' }))
    expect(row['data']).toBe(JSON.stringify({ confidence: 0.9 }))
  })

  it('routes Things and Actions to separate bindings when configured', async () => {
    const things = makeFakeBinding()
    const actions = makeFakeBinding()
    const emitter = createPipelinesIcebergEmitter({
      thingsBinding: things.binding,
      actionsBinding: actions.binding,
      now: fixedNow,
      awaitSend: true,
    })
    await emitter({
      shard: makeShard(),
      batch: {
        things: [{ id: 't1', type: 'A', data: {} }],
        actions: [{ verb: 'rel', subject: 't1', object: 't1' }],
      },
      result: { thingsInserted: 1, actionsInserted: 1 },
    })
    expect(things.sent).toHaveLength(1)
    expect(actions.sent).toHaveLength(1)
    expect(things.sent[0]!.records[0]!['type']).toBe('A')
    expect(actions.sent[0]!.records[0]!['verb']).toBe('rel')
  })

  it('skips send when the relevant batch half is empty', async () => {
    const { binding, sent } = makeFakeBinding()
    const emitter = createPipelinesIcebergEmitter({
      binding,
      now: fixedNow,
      awaitSend: true,
    })
    // Only Things; should produce one send (not two).
    await emitter({
      shard: makeShard(),
      batch: { things: [{ id: 't1', type: 'A', data: {} }] },
      result: { thingsInserted: 1, actionsInserted: 0 },
    })
    expect(sent).toHaveLength(1)
  })

  it('returns immediately for empty batch', async () => {
    const { binding, sent } = makeFakeBinding()
    const emitter = createPipelinesIcebergEmitter({
      binding,
      now: fixedNow,
      awaitSend: true,
    })
    await emitter({
      shard: makeShard(),
      batch: {},
      result: { thingsInserted: 0, actionsInserted: 0 },
    })
    expect(sent).toHaveLength(0)
  })

  it('swallows binding failures (does not throw to caller)', async () => {
    const logger = { warn: vi.fn() }
    const emitter = createPipelinesIcebergEmitter({
      binding: makeFailingBinding(),
      logger,
      now: fixedNow,
      awaitSend: true,
    })
    await expect(
      emitter({
        shard: makeShard(),
        batch: { things: [{ id: 't1', type: 'A', data: {} }] },
        result: { thingsInserted: 1, actionsInserted: 0 },
      })
    ).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      'pipelines-iceberg-emitter:things:send-failed',
      expect.objectContaining({ error: 'pipeline boom', rows: 1 })
    )
  })

  it('falls back to shard.key for cascade_id when context lacks cascadeId', async () => {
    const { binding, sent } = makeFakeBinding()
    const emitter = createPipelinesIcebergEmitter({
      binding,
      now: fixedNow,
      awaitSend: true,
    })
    await emitter({
      shard: { key: '__shared__', model: 'unsharded', context: {} },
      batch: { things: [{ id: 't1', type: 'A', data: {} }] },
      result: { thingsInserted: 1, actionsInserted: 0 },
    })
    expect(sent[0]!.records[0]!['cascade_id']).toBe('__shared__')
    expect(sent[0]!.records[0]!['tenant_id']).toBeNull()
  })

  it('honours dedupKey: null (omits _dedup_key column)', async () => {
    const { binding, sent } = makeFakeBinding()
    const emitter = createPipelinesIcebergEmitter({
      binding,
      dedupKey: null,
      now: fixedNow,
      awaitSend: true,
    })
    await emitter({
      shard: makeShard(),
      batch: { things: [{ id: 't1', type: 'A', data: {} }] },
      result: { thingsInserted: 1, actionsInserted: 0 },
    })
    expect(sent[0]!.records[0]).not.toHaveProperty('_dedup_key')
  })

  it('produces stable rows for re-emission (exactly-once at compaction)', async () => {
    const { binding, sent } = makeFakeBinding()
    const emitter = createPipelinesIcebergEmitter({
      binding,
      now: fixedNow,
      awaitSend: true,
    })
    const batch = {
      things: [{ id: 't1', type: 'A', data: { x: 1, y: 2 } }],
    }
    await emitter({
      shard: makeShard(),
      batch,
      result: { thingsInserted: 1, actionsInserted: 0 },
    })
    await emitter({
      shard: makeShard(),
      batch,
      result: { thingsInserted: 1, actionsInserted: 0 },
    })
    expect(sent).toHaveLength(2)
    // Identical bytes → Iceberg compaction (or Pipelines dedup) collapses
    // duplicates downstream. We assert byte-equivalence here so callers
    // relying on dedup can trust this contract.
    expect(JSON.stringify(sent[0]!.records[0])).toBe(JSON.stringify(sent[1]!.records[0]))
  })
})

// =============================================================================
// Tests — fire-and-forget semantics (awaitSend: false default)
// =============================================================================

describe('createPipelinesIcebergEmitter — fire-and-forget semantics', () => {
  it('returns synchronously without awaiting send by default', async () => {
    let resolveSend: () => void = () => {}
    const blocking: PipelinesStreamBindingLike = {
      send: () => new Promise<void>((resolve) => (resolveSend = resolve)),
    }
    const emitter = createPipelinesIcebergEmitter({ binding: blocking, now: fixedNow })
    let returned = false
    const promise = Promise.resolve()
      .then(() =>
        emitter({
          shard: makeShard(),
          batch: { things: [{ id: 't1', type: 'A', data: {} }] },
          result: { thingsInserted: 1, actionsInserted: 0 },
        })
      )
      .then(() => {
        returned = true
      })
    // Microtasks drain — emit() should resolve without waiting on the
    // blocking send().
    await Promise.resolve()
    await Promise.resolve()
    await promise
    expect(returned).toBe(true)
    // Don't leak the dangling send — release the lock.
    resolveSend()
  })
})

// =============================================================================
// Tests — composition with CascadeWriteStrategy
// =============================================================================

describe('CascadeWriteStrategy + Pipelines emitter integration', () => {
  it('cascade local commit succeeds even when the emitter binding fails', async () => {
    const adapter = createMemoryProvider()
    const logger = { warn: vi.fn() }
    const emitter = createPipelinesIcebergEmitter({
      binding: makeFailingBinding(),
      logger,
      now: fixedNow,
      awaitSend: true,
    })
    const strategy = createCascadeWriteStrategy({
      adapter,
      sharding: 'unsharded',
      analyticalEmitter: emitter,
    })
    const shard = strategy.pickShard({})
    const result = await strategy.writeBatch(shard, {
      things: [{ id: 'c1', type: 'Customer', data: { name: 'Acme' } }],
    })
    // Cascade commit landed regardless.
    expect(result.thingsInserted).toBe(1)
    const got = await adapter.get('Customer', 'c1')
    expect(got).not.toBeNull()
    // Emitter logged the failure.
    expect(logger.warn).toHaveBeenCalled()
  })

  it('emitter is called once per chunk with the chunked batch shape', async () => {
    const adapter = createMemoryProvider()
    const { binding, sent } = makeFakeBinding()
    const emitter = createPipelinesIcebergEmitter({
      binding,
      now: fixedNow,
      awaitSend: true,
    })
    const strategy = createCascadeWriteStrategy({
      adapter,
      sharding: CascadeShardingStrategies.perCascade('cascade-1'),
      maxBatchSize: 2,
      analyticalEmitter: emitter,
    })
    const shard = strategy.pickShard({ cascadeId: 'cascade-1' })
    await strategy.writeBatch(shard, {
      things: [
        { id: 't1', type: 'A', data: {} },
        { id: 't2', type: 'A', data: {} },
        { id: 't3', type: 'A', data: {} },
      ],
    })
    // Two chunks (size 2 + 1) → two emitter sends.
    expect(sent).toHaveLength(2)
    expect(sent[0]!.records).toHaveLength(2)
    expect(sent[1]!.records).toHaveLength(1)
    // Cascade routing columns present and stable.
    for (const batch of sent) {
      for (const row of batch.records) {
        expect(row['cascade_id']).toBe('cascade-1')
        expect(row['shard_key']).toBe('cascade:cascade-1')
      }
    }
  })
})

// =============================================================================
// Tests — HTTP-fallback emitter
// =============================================================================

describe('createHttpPipelinesIcebergEmitter — HTTP fallback', () => {
  it('throws when no URL is configured', () => {
    expect(() => createHttpPipelinesIcebergEmitter({})).toThrow(/url/)
  })

  it('issues a POST with JSON body and auth header', async () => {
    const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) => {
      return new Response('', { status: 200 })
    })
    const emitter = createHttpPipelinesIcebergEmitter({
      url: 'https://pipelines.example/cascade',
      authToken: 'secret-token',
      fetch: fetchSpy as never,
      now: fixedNow,
      awaitSend: true,
    })
    await emitter({
      shard: makeShard(),
      batch: { things: [{ id: 't1', type: 'A', data: { x: 1 } }] },
      result: { thingsInserted: 1, actionsInserted: 0 },
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('https://pipelines.example/cascade')
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['Authorization']).toBe('Bearer secret-token')
    const body = JSON.parse(String(init?.body))
    expect(Array.isArray(body)).toBe(true)
    expect(body[0]).toMatchObject({ id: 't1', type: 'A' })
  })

  it('swallows non-2xx responses (logs warn)', async () => {
    const logger = { warn: vi.fn() }
    const fetchImpl = async () => new Response('nope', { status: 500, statusText: 'Server Error' })
    const emitter = createHttpPipelinesIcebergEmitter({
      url: 'https://pipelines.example/cascade',
      fetch: fetchImpl as never,
      logger,
      now: fixedNow,
      awaitSend: true,
    })
    await expect(
      emitter({
        shard: makeShard(),
        batch: { things: [{ id: 't1', type: 'A', data: {} }] },
        result: { thingsInserted: 1, actionsInserted: 0 },
      })
    ).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(
      'pipelines-iceberg-emitter:things:send-failed',
      expect.objectContaining({ error: expect.stringContaining('500') })
    )
  })

  it('routes Things and Actions to separate URLs when configured', async () => {
    const calls: Array<{ url: string; bodyCount: number }> = []
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      calls.push({ url, bodyCount: body.length })
      return new Response('', { status: 200 })
    }
    const emitter = createHttpPipelinesIcebergEmitter({
      thingsUrl: 'https://pipelines.example/things',
      actionsUrl: 'https://pipelines.example/actions',
      fetch: fetchImpl as never,
      now: fixedNow,
      awaitSend: true,
    })
    await emitter({
      shard: makeShard(),
      batch: {
        things: [{ id: 't1', type: 'A', data: {} }],
        actions: [{ verb: 'rel', subject: 't1', object: 't1' }],
      },
      result: { thingsInserted: 1, actionsInserted: 1 },
    })
    expect(calls).toHaveLength(2)
    expect(calls.find((c) => c.url.endsWith('/things'))?.bodyCount).toBe(1)
    expect(calls.find((c) => c.url.endsWith('/actions'))?.bodyCount).toBe(1)
  })
})
