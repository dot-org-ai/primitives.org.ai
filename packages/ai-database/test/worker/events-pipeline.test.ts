/**
 * Events and Pipeline Tests for ai-database
 *
 * Tests event sourcing capabilities via the _events table and Pipeline integration
 * for streaming events to R2 storage. This enables:
 * - Event emission on all data and relationship changes
 * - Event querying by entity, time range, and operation type
 * - Pipeline integration for R2 storage
 * - Event replay for rebuilding state
 *
 * Uses @cloudflare/vitest-pool-workers for real Cloudflare Workers execution.
 *
 * Bead: aip-1tcx
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getStub, doRequest, doJSON, insertData, insertRel } from './test-helpers.js'

// =============================================================================
// Events - _events Table Initialization
// =============================================================================

describe('Events - _events Table', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should create _events table on first access', async () => {
    // Trigger initialization by creating an entity
    await insertData(stub, { id: 'test-1', type: 'Test', data: { name: 'Test' } })

    // Query events endpoint should return array (table exists)
    const res = await doRequest(stub, '/events')
    expect(res.status).toBe(200)
    const events = await res.json()
    expect(Array.isArray(events)).toBe(true)
  })

  it('should have correct _events schema: id, event, actor, object, data, timestamp', async () => {
    await insertData(stub, { id: 'schema-test', type: 'Post', data: { title: 'Hello' } })

    const res = await doRequest(stub, '/events')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThan(0)
    const event = events[0]
    expect(event.id).toBeDefined()
    expect(event.event).toBeDefined()
    expect(event.object).toBeDefined()
    expect(event.timestamp).toBeDefined()
    expect(typeof event.timestamp).toBe('string')
  })

  it('should create index on _events(event) for event type queries', async () => {
    await doRequest(stub, '/events') // Trigger table creation

    const res = await doRequest(stub, '/meta/indexes')
    expect(res.status).toBe(200)
    const indexes = (await res.json()) as Array<Record<string, unknown>>
    const indexNames = indexes.map((i) => i.name as string)
    expect(indexNames.some((n) => n.includes('event') || n.includes('_events'))).toBe(true)
  })

  it('should create index on _events(timestamp) for time range queries', async () => {
    await doRequest(stub, '/events') // Trigger table creation

    const res = await doRequest(stub, '/meta/indexes')
    expect(res.status).toBe(200)
    const indexes = (await res.json()) as Array<Record<string, unknown>>
    const indexNames = indexes.map((i) => i.name as string)
    expect(indexNames.some((n) => n.includes('timestamp') || n.includes('_events_ts'))).toBe(true)
  })

  it('should create index on _events(object) for entity-specific queries', async () => {
    await doRequest(stub, '/events') // Trigger table creation

    const res = await doRequest(stub, '/meta/indexes')
    expect(res.status).toBe(200)
    const indexes = (await res.json()) as Array<Record<string, unknown>>
    const indexNames = indexes.map((i) => i.name as string)
    expect(indexNames.some((n) => n.includes('object') || n.includes('_events_obj'))).toBe(true)
  })
})

// =============================================================================
// Events - Emission on Data Changes
// =============================================================================

describe('Events - emission on data changes', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should emit Type.created event on create', async () => {
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Hello World' } })

    const res = await doRequest(stub, '/events?event=Post.created')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(1)
    const event = events.find((e) => e.object === 'Post/post-1')
    expect(event).toBeDefined()
    expect(event?.event).toBe('Post.created')
  })

  it('should emit Type.updated event on update', async () => {
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Original' } })
    await doJSON(stub, '/data/post-1', { data: { title: 'Updated' } }, 'PATCH')

    const res = await doRequest(stub, '/events?event=Post.updated')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(1)
    const event = events.find((e) => e.object === 'Post/post-1')
    expect(event).toBeDefined()
    expect(event?.event).toBe('Post.updated')
  })

  it('should emit Type.deleted event on delete', async () => {
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'To Delete' } })
    await doRequest(stub, '/data/post-1', { method: 'DELETE' })

    const res = await doRequest(stub, '/events?event=Post.deleted')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(1)
    const event = events.find((e) => e.object === 'Post/post-1')
    expect(event).toBeDefined()
    expect(event?.event).toBe('Post.deleted')
  })

  it('should include entity data in event payload', async () => {
    await insertData(stub, {
      id: 'post-1',
      type: 'Post',
      data: { title: 'Hello', body: 'Content' },
    })

    const res = await doRequest(stub, '/events?object=Post/post-1')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const createEvent = events.find((e) => e.event === 'Post.created')
    expect(createEvent).toBeDefined()
    expect(createEvent?.data).toBeDefined()
    const eventData = createEvent?.data as Record<string, unknown>
    expect(eventData.title).toBe('Hello')
    expect(eventData.body).toBe('Content')
  })

  it('should include timestamp in event (ISO 8601)', async () => {
    const before = new Date().toISOString()
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Test' } })
    const after = new Date().toISOString()

    const res = await doRequest(stub, '/events?object=Post/post-1')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const event = events[0]
    expect(event.timestamp).toBeDefined()
    const eventTime = event.timestamp as string
    expect(eventTime >= before).toBe(true)
    expect(eventTime <= after || eventTime.slice(0, 19) === after.slice(0, 19)).toBe(true)
  })

  it('should generate unique event IDs', async () => {
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'First' } })
    await insertData(stub, { id: 'post-2', type: 'Post', data: { title: 'Second' } })

    const res = await doRequest(stub, '/events')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const ids = events.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should capture old and new values on update', async () => {
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Original', count: 1 } })
    await doJSON(stub, '/data/post-1', { data: { title: 'Updated', count: 2 } }, 'PATCH')

    const res = await doRequest(stub, '/events?event=Post.updated&object=Post/post-1')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const updateEvent = events[0]
    expect(updateEvent).toBeDefined()
    // Event should contain the changes
    const data = updateEvent.data as Record<string, unknown>
    expect(data.title).toBe('Updated')
    // Optionally check for old values if implementation supports it
    if (updateEvent.previousData) {
      const prev = updateEvent.previousData as Record<string, unknown>
      expect(prev.title).toBe('Original')
    }
  })
})

// =============================================================================
// Events - Emission on Relationship Changes
// =============================================================================

describe('Events - emission on relationship changes', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Seed entities for relationship tests
    await insertData(stub, { id: 'user-1', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'user-2', type: 'User', data: { name: 'Bob' } })
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Hello' } })
  })

  it('should emit relationship.created event on relate', async () => {
    await insertRel(stub, { from_id: 'user-1', relation: 'authored', to_id: 'post-1' })

    const res = await doRequest(stub, '/events?event=relationship.created')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(1)
    const event = events.find(
      (e) =>
        (e.data as Record<string, unknown>)?.from_id === 'user-1' &&
        (e.data as Record<string, unknown>)?.to_id === 'post-1'
    )
    expect(event).toBeDefined()
    expect(event?.event).toBe('relationship.created')
  })

  it('should emit relationship.deleted event on unrelate', async () => {
    await insertRel(stub, { from_id: 'user-1', relation: 'follows', to_id: 'user-2' })
    await doJSON(
      stub,
      '/rels/delete',
      { from_id: 'user-1', relation: 'follows', to_id: 'user-2' },
      'DELETE'
    )

    const res = await doRequest(stub, '/events?event=relationship.deleted')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(1)
    const event = events.find(
      (e) =>
        (e.data as Record<string, unknown>)?.from_id === 'user-1' &&
        (e.data as Record<string, unknown>)?.to_id === 'user-2'
    )
    expect(event).toBeDefined()
    expect(event?.event).toBe('relationship.deleted')
  })

  it('should include relationship metadata in event', async () => {
    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'authored',
      to_id: 'post-1',
      metadata: { role: 'primary', score: 10 },
    })

    const res = await doRequest(stub, '/events?event=relationship.created')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const event = events[0]
    const data = event.data as Record<string, unknown>
    expect(data.from_id).toBe('user-1')
    expect(data.relation).toBe('authored')
    expect(data.to_id).toBe('post-1')
    expect(data.metadata).toEqual({ role: 'primary', score: 10 })
  })

  it('should emit relationship.updated event on metadata update', async () => {
    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'authored',
      to_id: 'post-1',
      metadata: { role: 'contributor' },
    })

    // Update relationship metadata
    await doJSON(
      stub,
      '/rels',
      {
        from_id: 'user-1',
        relation: 'authored',
        to_id: 'post-1',
        metadata: { role: 'primary' },
      },
      'PATCH'
    )

    const res = await doRequest(stub, '/events?event=relationship.updated')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(1)
    const event = events.find(
      (e) =>
        (e.data as Record<string, unknown>)?.from_id === 'user-1' &&
        (e.data as Record<string, unknown>)?.to_id === 'post-1'
    )
    expect(event).toBeDefined()
  })
})

// =============================================================================
// Events - Event Metadata
// =============================================================================

describe('Events - metadata', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should include actor when provided in request header', async () => {
    const res = await stub.fetch('https://do.test/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Actor': 'user:admin-1',
      },
      body: JSON.stringify({ id: 'post-1', type: 'Post', data: { title: 'Hello' } }),
    })
    expect(res.status).toBe(200)

    const eventsRes = await doRequest(stub, '/events?object=Post/post-1')
    expect(eventsRes.status).toBe(200)
    const events = (await eventsRes.json()) as Array<Record<string, unknown>>

    const event = events[0]
    expect(event.actor).toBe('user:admin-1')
  })

  it('should default actor to system when not provided', async () => {
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Hello' } })

    const res = await doRequest(stub, '/events?object=Post/post-1')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const event = events[0]
    // Default actor should be 'system' or similar
    expect(event.actor).toBeDefined()
    expect(
      ['system', 'anonymous', undefined].includes(event.actor as string) || event.actor === 'system'
    ).toBe(true)
  })

  it('should include operation type in event name', async () => {
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Test' } })
    await doJSON(stub, '/data/post-1', { data: { title: 'Updated' } }, 'PATCH')
    await doRequest(stub, '/data/post-1', { method: 'DELETE' })

    const res = await doRequest(stub, '/events')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const eventTypes = events.map((e) => e.event as string)
    expect(eventTypes).toContain('Post.created')
    expect(eventTypes).toContain('Post.updated')
    expect(eventTypes).toContain('Post.deleted')
  })

  it('should preserve event ordering by timestamp', async () => {
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'First' } })
    await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay
    await insertData(stub, { id: 'post-2', type: 'Post', data: { title: 'Second' } })
    await new Promise((resolve) => setTimeout(resolve, 10))
    await insertData(stub, { id: 'post-3', type: 'Post', data: { title: 'Third' } })

    const res = await doRequest(stub, '/events?event=Post.created&order=asc')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(3)
    const timestamps = events.map((e) => e.timestamp as string)
    const sorted = [...timestamps].sort()
    expect(timestamps).toEqual(sorted)
  })
})

// =============================================================================
// Events - Querying
// =============================================================================

describe('Events - querying', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Create a variety of events
    await insertData(stub, { id: 'user-1', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'user-2', type: 'User', data: { name: 'Bob' } })
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Hello' } })
    await insertData(stub, { id: 'post-2', type: 'Post', data: { title: 'World' } })
    await doJSON(stub, '/data/post-1', { data: { title: 'Updated Hello' } }, 'PATCH')
    await doRequest(stub, '/data/post-2', { method: 'DELETE' })
  })

  it('should list all events', async () => {
    const res = await doRequest(stub, '/events')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>
    expect(events.length).toBeGreaterThanOrEqual(6) // 4 creates + 1 update + 1 delete
  })

  it('should filter events by entity (object)', async () => {
    const res = await doRequest(stub, '/events?object=Post/post-1')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(2) // create + update
    events.forEach((e) => {
      expect(e.object).toBe('Post/post-1')
    })
  })

  it('should filter events by type', async () => {
    const res = await doRequest(stub, '/events?event=User.created')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events).toHaveLength(2)
    events.forEach((e) => {
      expect(e.event).toBe('User.created')
    })
  })

  it('should filter events by wildcard pattern (*.created)', async () => {
    const res = await doRequest(stub, '/events?event=*.created')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(4)
    events.forEach((e) => {
      expect((e.event as string).endsWith('.created')).toBe(true)
    })
  })

  it('should filter events by type pattern (Post.*)', async () => {
    const res = await doRequest(stub, '/events?event=Post.*')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(3) // 2 creates + 1 update + 1 delete
    events.forEach((e) => {
      expect((e.event as string).startsWith('Post.')).toBe(true)
    })
  })

  it('should filter events by time range (since)', async () => {
    const midpoint = new Date().toISOString()
    await new Promise((resolve) => setTimeout(resolve, 50))
    await insertData(stub, { id: 'post-3', type: 'Post', data: { title: 'After midpoint' } })

    const res = await doRequest(stub, `/events?since=${encodeURIComponent(midpoint)}`)
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(1)
    events.forEach((e) => {
      expect((e.timestamp as string) >= midpoint).toBe(true)
    })
  })

  it('should filter events by time range (until)', async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
    const midpoint = new Date().toISOString()
    await insertData(stub, { id: 'post-4', type: 'Post', data: { title: 'After midpoint' } })

    const res = await doRequest(stub, `/events?until=${encodeURIComponent(midpoint)}`)
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    // All events should be before or at midpoint
    events.forEach((e) => {
      expect((e.timestamp as string) <= midpoint).toBe(true)
    })
  })

  it('should support cursor-based pagination', async () => {
    const res1 = await doRequest(stub, '/events?limit=2')
    expect(res1.status).toBe(200)
    const page1 = (await res1.json()) as Array<Record<string, unknown>>
    expect(page1).toHaveLength(2)

    // Use last event ID as cursor
    const cursor = page1[page1.length - 1].id as string
    const res2 = await doRequest(stub, `/events?limit=2&cursor=${cursor}`)
    expect(res2.status).toBe(200)
    const page2 = (await res2.json()) as Array<Record<string, unknown>>

    // Pages should have different events
    const page1Ids = page1.map((e) => e.id)
    const page2Ids = page2.map((e) => e.id)
    expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false)
  })

  it('should support limit parameter', async () => {
    const res = await doRequest(stub, '/events?limit=3')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>
    expect(events).toHaveLength(3)
  })

  it('should support offset parameter', async () => {
    const res1 = await doRequest(stub, '/events?limit=2&offset=0')
    const res2 = await doRequest(stub, '/events?limit=2&offset=2')

    const page1 = (await res1.json()) as Array<Record<string, unknown>>
    const page2 = (await res2.json()) as Array<Record<string, unknown>>

    const page1Ids = page1.map((e) => e.id)
    const page2Ids = page2.map((e) => e.id)
    expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false)
  })

  it('should support ordering by timestamp desc', async () => {
    const res = await doRequest(stub, '/events?order=desc')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const timestamps = events.map((e) => e.timestamp as string)
    const sortedDesc = [...timestamps].sort().reverse()
    expect(timestamps).toEqual(sortedDesc)
  })
})

// =============================================================================
// Events - Custom Events
// =============================================================================

describe('Events - custom events', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should support emitting custom events', async () => {
    const res = await doJSON(stub, '/events', {
      event: 'custom:publish',
      actor: 'user:admin',
      object: 'Post/post-1',
      data: { channel: 'blog', visibility: 'public' },
    })
    expect(res.status).toBe(200)
    const event = (await res.json()) as Record<string, unknown>

    expect(event.id).toBeDefined()
    expect(event.event).toBe('custom:publish')
    expect(event.actor).toBe('user:admin')
    expect(event.object).toBe('Post/post-1')
  })

  it('should query custom events by type', async () => {
    await doJSON(stub, '/events', {
      event: 'workflow:started',
      actor: 'system',
      data: { workflow: 'approval' },
    })
    await doJSON(stub, '/events', {
      event: 'workflow:completed',
      actor: 'system',
      data: { workflow: 'approval' },
    })

    const res = await doRequest(stub, '/events?event=workflow:started')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    expect(events.length).toBeGreaterThanOrEqual(1)
    expect(events[0].event).toBe('workflow:started')
  })

  it('should support result field for action outcomes', async () => {
    const res = await doJSON(stub, '/events', {
      event: 'post:publish',
      actor: 'user:editor',
      object: 'Post/draft-1',
      result: 'Post/published-1',
      data: { publishedAt: new Date().toISOString() },
    })
    expect(res.status).toBe(200)
    const event = (await res.json()) as Record<string, unknown>

    expect(event.result).toBe('Post/published-1')
  })
})

// =============================================================================
// Pipeline - R2 Integration
// =============================================================================

describe('Pipeline - R2 integration', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should send events to Pipeline binding', async () => {
    // Create some events
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Hello' } })

    // Check pipeline status
    const res = await doRequest(stub, '/pipeline/status')
    expect(res.status).toBe(200)
    const status = (await res.json()) as Record<string, unknown>

    // Pipeline should have processed events
    expect(status.eventsProcessed).toBeDefined()
    expect(status.eventsProcessed as number).toBeGreaterThanOrEqual(1)
  })

  it('should batch events for efficiency', async () => {
    // Create multiple events rapidly
    for (let i = 0; i < 10; i++) {
      await insertData(stub, { id: `batch-${i}`, type: 'Item', data: { index: i } })
    }

    const res = await doRequest(stub, '/pipeline/status')
    expect(res.status).toBe(200)
    const status = (await res.json()) as Record<string, unknown>

    // Should have batched events (fewer batches than individual events)
    expect(status.batchesSent).toBeDefined()
    expect(status.batchesSent as number).toBeLessThan(10)
    expect(status.eventsProcessed as number).toBeGreaterThanOrEqual(10)
  })

  it('should store events in R2 with partition key', async () => {
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Hello' } })

    // Force pipeline flush
    await doRequest(stub, '/pipeline/flush', { method: 'POST' })

    // Check R2 storage
    const res = await doRequest(stub, '/pipeline/r2/list')
    expect(res.status).toBe(200)
    const objects = (await res.json()) as Array<Record<string, unknown>>

    expect(objects.length).toBeGreaterThan(0)
    // Keys should follow partition pattern (e.g., events/2025/01/28/...)
    const key = objects[0].key as string
    expect(key).toMatch(/^events\/\d{4}\/\d{2}\/\d{2}\//)
  })

  it('should handle Pipeline errors gracefully', async () => {
    // Simulate pipeline failure by triggering error condition
    const res = await doJSON(stub, '/pipeline/test-error', { simulateError: true })
    // Should not crash, just log/handle the error
    expect([200, 500, 503]).toContain(res.status)

    // Subsequent operations should still work
    const dataRes = await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'Test' } })
    expect(dataRes.id).toBe('post-1')
  })

  it('should retry failed pipeline sends', async () => {
    // Create events with simulated transient failure
    await doJSON(stub, '/pipeline/config', { retryEnabled: true })
    await insertData(stub, { id: 'retry-1', type: 'Item', data: { test: true } })

    // Force flush and check retry behavior
    await doRequest(stub, '/pipeline/flush', { method: 'POST' })

    const res = await doRequest(stub, '/pipeline/status')
    expect(res.status).toBe(200)
    const status = (await res.json()) as Record<string, unknown>

    // Should have retry capability
    expect(status.retriesEnabled).toBe(true)
  })
})

// =============================================================================
// Events - Replay for State Rebuilding
// =============================================================================

describe('Events - replay for rebuilding state', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Create a sequence of events
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'v1', count: 1 } })
    await doJSON(stub, '/data/post-1', { data: { title: 'v2', count: 2 } }, 'PATCH')
    await doJSON(stub, '/data/post-1', { data: { title: 'v3', count: 3 } }, 'PATCH')
  })

  it('should support event replay from R2', async () => {
    // Force events to R2
    await doRequest(stub, '/pipeline/flush', { method: 'POST' })

    // Start replay
    const res = await doJSON(stub, '/events/replay', {
      source: 'r2',
      since: new Date(Date.now() - 3600000).toISOString(), // Last hour
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>

    expect(result.eventsReplayed).toBeDefined()
    expect(result.eventsReplayed as number).toBeGreaterThanOrEqual(3)
  })

  it('should support event replay from local _events table', async () => {
    const res = await doJSON(stub, '/events/replay', {
      source: 'local',
      object: 'Post/post-1',
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>

    expect(result.eventsReplayed).toBeGreaterThanOrEqual(3)
  })

  it('should rebuild entity state from events', async () => {
    // Delete the current entity
    await doRequest(stub, '/data/post-1', { method: 'DELETE' })

    // Verify it is gone
    const beforeRes = await doRequest(stub, '/data/post-1')
    expect(beforeRes.status).toBe(404)

    // Rebuild from events
    const rebuildRes = await doJSON(stub, '/events/rebuild', {
      object: 'Post/post-1',
    })
    expect(rebuildRes.status).toBe(200)

    // Entity should be restored to its final state
    const afterRes = await doRequest(stub, '/data/post-1')
    expect(afterRes.status).toBe(200)
    const restored = (await afterRes.json()) as Record<string, unknown>
    const data = restored.data as Record<string, unknown>
    expect(data.title).toBe('v3')
    expect(data.count).toBe(3)
  })

  it('should replay events in chronological order', async () => {
    const res = await doRequest(stub, '/events?object=Post/post-1&order=asc')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    // Events should be in chronological order
    const timestamps = events.map((e) => e.timestamp as string)
    const sorted = [...timestamps].sort()
    expect(timestamps).toEqual(sorted)

    // Changes should reflect the progression
    const createEvent = events.find((e) => e.event === 'Post.created')
    expect(createEvent).toBeDefined()
    expect((createEvent?.data as Record<string, unknown>).title).toBe('v1')
  })

  it('should support replaying specific time range', async () => {
    const midpoint = new Date().toISOString()
    await new Promise((resolve) => setTimeout(resolve, 50))
    await doJSON(stub, '/data/post-1', { data: { title: 'v4', count: 4 } }, 'PATCH')

    // Replay only events since midpoint
    const res = await doJSON(stub, '/events/replay', {
      source: 'local',
      object: 'Post/post-1',
      since: midpoint,
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>

    // Should only replay the most recent update
    expect(result.eventsReplayed).toBe(1)
  })

  it('should support replaying by event type', async () => {
    const res = await doJSON(stub, '/events/replay', {
      source: 'local',
      event: 'Post.updated',
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>

    // Should only replay update events
    expect(result.eventsReplayed).toBeGreaterThanOrEqual(2)
  })
})

// =============================================================================
// Events - Subscription
// =============================================================================

describe('Events - subscription', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should subscribe to specific event type', async () => {
    // Register subscription
    const subRes = await doJSON(stub, '/events/subscribe', {
      pattern: 'Post.created',
      webhook: 'https://example.com/webhook',
    })
    expect(subRes.status).toBe(200)
    const subscription = (await subRes.json()) as Record<string, unknown>
    expect(subscription.id).toBeDefined()

    // List subscriptions
    const listRes = await doRequest(stub, '/events/subscriptions')
    expect(listRes.status).toBe(200)
    const subs = (await listRes.json()) as Array<Record<string, unknown>>
    expect(subs.some((s) => s.pattern === 'Post.created')).toBe(true)
  })

  it('should subscribe with wildcard pattern (*.created)', async () => {
    const res = await doJSON(stub, '/events/subscribe', {
      pattern: '*.created',
      webhook: 'https://example.com/created-webhook',
    })
    expect(res.status).toBe(200)
    const subscription = (await res.json()) as Record<string, unknown>

    expect(subscription.pattern).toBe('*.created')
  })

  it('should unsubscribe from events', async () => {
    // Create subscription
    const subRes = await doJSON(stub, '/events/subscribe', {
      pattern: 'Post.*',
      webhook: 'https://example.com/webhook',
    })
    const subscription = (await subRes.json()) as Record<string, unknown>
    const subId = subscription.id as string

    // Unsubscribe
    const unsubRes = await doRequest(stub, `/events/subscriptions/${subId}`, { method: 'DELETE' })
    expect(unsubRes.status).toBe(200)

    // Verify unsubscribed
    const listRes = await doRequest(stub, '/events/subscriptions')
    const subs = (await listRes.json()) as Array<Record<string, unknown>>
    expect(subs.some((s) => s.id === subId)).toBe(false)
  })

  it('should not receive events after unsubscribe', async () => {
    // Create and immediately remove subscription
    const subRes = await doJSON(stub, '/events/subscribe', {
      pattern: 'Item.created',
      webhook: 'https://example.com/webhook',
    })
    const subscription = (await subRes.json()) as Record<string, unknown>
    const subId = subscription.id as string

    await doRequest(stub, `/events/subscriptions/${subId}`, { method: 'DELETE' })

    // Create an event
    await insertData(stub, { id: 'item-1', type: 'Item', data: { name: 'Test' } })

    // Check delivery log - should not have any deliveries for removed subscription
    const logRes = await doRequest(stub, `/events/subscriptions/${subId}/deliveries`)
    expect(logRes.status).toBe(404) // Subscription doesn't exist
  })
})

// =============================================================================
// Events - Edge Cases
// =============================================================================

describe('Events - Edge Cases', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should handle rapid event creation without data loss', async () => {
    // Create many events rapidly
    const promises = []
    for (let i = 0; i < 50; i++) {
      promises.push(insertData(stub, { id: `rapid-${i}`, type: 'Rapid', data: { index: i } }))
    }
    await Promise.all(promises)

    // All events should be recorded
    const res = await doRequest(stub, '/events?event=Rapid.created')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>
    expect(events).toHaveLength(50)
  })

  it('should handle large event payloads', async () => {
    const largeData = {
      content: 'x'.repeat(10000),
      array: Array.from({ length: 100 }, (_, i) => ({ index: i, value: `value-${i}` })),
    }
    await insertData(stub, { id: 'large-1', type: 'Large', data: largeData })

    const res = await doRequest(stub, '/events?object=Large/large-1')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const event = events[0]
    const eventData = event.data as Record<string, unknown>
    expect(eventData.content).toBe(largeData.content)
    expect(eventData.array as Array<unknown>).toHaveLength(100)
  })

  it('should handle unicode in event data', async () => {
    await insertData(stub, {
      id: 'unicode-1',
      type: 'Unicode',
      data: { title: '\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8', emoji: '\u{1F680}\u{1F4BB}\u{1F389}' },
    })

    const res = await doRequest(stub, '/events?object=Unicode/unicode-1')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>

    const data = events[0].data as Record<string, unknown>
    expect(data.title).toBe('\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8')
    expect(data.emoji).toBe('\u{1F680}\u{1F4BB}\u{1F389}')
  })

  it('should handle concurrent operations on same entity', async () => {
    await insertData(stub, { id: 'concurrent-1', type: 'Counter', data: { count: 0 } })

    // Concurrent updates
    const updates = []
    for (let i = 1; i <= 10; i++) {
      updates.push(doJSON(stub, '/data/concurrent-1', { data: { count: i } }, 'PATCH'))
    }
    await Promise.all(updates)

    // All update events should be recorded
    const res = await doRequest(stub, '/events?object=Counter/concurrent-1&event=Counter.updated')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<Record<string, unknown>>
    expect(events).toHaveLength(10)
  })

  it('should handle empty event queries gracefully', async () => {
    const res = await doRequest(stub, '/events?event=NonExistent.type')
    expect(res.status).toBe(200)
    const events = (await res.json()) as Array<unknown>
    expect(events).toHaveLength(0)
  })

  it('should validate required fields in custom events', async () => {
    // Missing event field
    const res = await doJSON(stub, '/events', {
      actor: 'user:test',
      data: { test: true },
    })
    expect(res.status).toBe(400)
  })
})
