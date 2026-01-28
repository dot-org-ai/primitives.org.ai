/**
 * Events API tests
 *
 * Tests the public events API for subscribing to database events.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import { StandardEventTypes, entityEvent, typePattern, actionPattern } from '../src/events.js'
import type { DBEvent, EventsAPI } from '../src/events.js'

// TODO: Advanced feature tests - needs investigation
describe.skip('Events API', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  afterEach(() => {
    setProvider(createMemoryProvider())
  })

  const schema = {
    Post: {
      title: 'string',
      content: 'string',
    },
    Comment: {
      text: 'string',
      post: 'Post.comments',
    },
  } as const

  describe('Standard event types', () => {
    it('exports standard event type constants', () => {
      expect(StandardEventTypes.ENTITY_CREATED).toBe('entity:created')
      expect(StandardEventTypes.ENTITY_UPDATED).toBe('entity:updated')
      expect(StandardEventTypes.ENTITY_DELETED).toBe('entity:deleted')
      expect(StandardEventTypes.CASCADE_PROGRESS).toBe('cascade:progress')
      expect(StandardEventTypes.RESOLVE_COMPLETE).toBe('resolve:complete')
    })
  })

  describe('Event pattern helpers', () => {
    it('creates type-specific event patterns', () => {
      expect(entityEvent('Post', 'created')).toBe('Post.created')
      expect(entityEvent('User', 'updated')).toBe('User.updated')
      expect(entityEvent('Comment', 'deleted')).toBe('Comment.deleted')
    })

    it('creates wildcard type patterns', () => {
      expect(typePattern('Post')).toBe('Post.*')
      expect(typePattern('User')).toBe('User.*')
    })

    it('creates wildcard action patterns', () => {
      expect(actionPattern('created')).toBe('*.created')
      expect(actionPattern('updated')).toBe('*.updated')
      expect(actionPattern('deleted')).toBe('*.deleted')
    })
  })

  describe('events.on() - Type-specific events', () => {
    it('receives Post.created event when a Post is created', async () => {
      const { db, events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      // Small delay to allow provider resolution
      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on('Post.created', (event) => {
        receivedEvents.push(event)
      })

      // Small delay to allow subscription setup
      await new Promise((resolve) => setTimeout(resolve, 10))

      await db.Post.create({
        title: 'Hello World',
        content: 'This is my first post',
      })

      // Small delay for event propagation
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(receivedEvents.length).toBeGreaterThanOrEqual(1)
      const event = receivedEvents[0]
      expect(event.event).toBe('Post.created')
      expect(event.objectData).toMatchObject({
        title: 'Hello World',
        content: 'This is my first post',
      })
    })

    it('receives Post.updated event when a Post is updated', async () => {
      const { db, events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on('Post.updated', (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const post = await db.Post.create('post-1', {
        title: 'Original Title',
        content: 'Original content',
      })

      await db.Post.update('post-1', {
        title: 'Updated Title',
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(receivedEvents.length).toBeGreaterThanOrEqual(1)
      const event = receivedEvents[0]
      expect(event.event).toBe('Post.updated')
      expect(event.objectData?.title).toBe('Updated Title')
    })

    it('receives Post.deleted event when a Post is deleted', async () => {
      const { db, events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on('Post.deleted', (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await db.Post.create('post-to-delete', {
        title: 'To be deleted',
        content: 'This will be deleted',
      })

      await db.Post.delete('post-to-delete')

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(receivedEvents.length).toBeGreaterThanOrEqual(1)
      const event = receivedEvents[0]
      expect(event.event).toBe('Post.deleted')
      expect(event.objectData?.$id).toBe('post-to-delete')
    })
  })

  describe('events.on() - Global entity events', () => {
    it('receives entity:created event for any entity type', async () => {
      const { db, events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on(StandardEventTypes.ENTITY_CREATED, (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await db.Post.create({
        title: 'A Post',
        content: 'Post content',
      })

      await db.Comment.create({
        text: 'A Comment',
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      // Should have received events for both Post and Comment
      const types = receivedEvents.map((e) => e.objectData?.$type)
      expect(types).toContain('Post')
      expect(types).toContain('Comment')
    })

    it('receives entity:updated event for any entity type', async () => {
      const { db, events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on(StandardEventTypes.ENTITY_UPDATED, (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await db.Post.create('post-1', { title: 'Post', content: 'Content' })
      await db.Comment.create('comment-1', { text: 'Comment' })

      await db.Post.update('post-1', { title: 'Updated Post' })
      await db.Comment.update('comment-1', { text: 'Updated Comment' })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const types = receivedEvents.map((e) => e.objectData?.$type)
      expect(types).toContain('Post')
      expect(types).toContain('Comment')
    })

    it('receives entity:deleted event for any entity type', async () => {
      const { db, events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on(StandardEventTypes.ENTITY_DELETED, (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await db.Post.create('post-1', { title: 'Post', content: 'Content' })
      await db.Comment.create('comment-1', { text: 'Comment' })

      await db.Post.delete('post-1')
      await db.Comment.delete('comment-1')

      await new Promise((resolve) => setTimeout(resolve, 10))

      const types = receivedEvents.map((e) => e.objectData?.$type)
      expect(types).toContain('Post')
      expect(types).toContain('Comment')
    })
  })

  describe('events.on() - Pattern matching', () => {
    it('receives all events for a type with wildcard pattern', async () => {
      const { db, events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on(typePattern('Post'), (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await db.Post.create('post-1', { title: 'Post', content: 'Content' })
      await db.Post.update('post-1', { title: 'Updated' })
      await db.Post.delete('post-1')

      await new Promise((resolve) => setTimeout(resolve, 10))

      const eventTypes = receivedEvents.map((e) => e.event)
      expect(eventTypes).toContain('Post.created')
      expect(eventTypes).toContain('Post.updated')
      expect(eventTypes).toContain('Post.deleted')
    })

    it('receives all created events with action wildcard pattern', async () => {
      const { db, events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on(actionPattern('created'), (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await db.Post.create({ title: 'Post', content: 'Content' })
      await db.Comment.create({ text: 'Comment' })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(receivedEvents.length).toBeGreaterThanOrEqual(2)
      receivedEvents.forEach((event) => {
        expect(event.event).toMatch(/\.created$/)
      })
    })
  })

  describe('events.emit() - Custom events', () => {
    it('emits custom events with full options', async () => {
      const { events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on('custom:publish', (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const emitted = await events.emit({
        actor: 'user:john',
        event: 'custom:publish',
        object: 'Post/hello-world',
        objectData: { title: 'Hello World' },
        result: 'Publication/pub-123',
        meta: { channel: 'blog' },
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(emitted.id).toBeDefined()
      expect(emitted.actor).toBe('user:john')
      expect(emitted.event).toBe('custom:publish')
      expect(emitted.object).toBe('Post/hello-world')
      expect(receivedEvents.length).toBe(1)
    })

    it('emits simple events with legacy pattern', async () => {
      const { events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      events.on('simple:event', (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const emitted = await events.emit('simple:event', { key: 'value' })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(emitted.event).toBe('simple:event')
      expect(emitted.objectData).toEqual({ key: 'value' })
      expect(receivedEvents.length).toBe(1)
    })
  })

  describe('events.list() - Event history', () => {
    it('lists events with filters', async () => {
      const { db, events } = DB(schema)

      await db.Post.create('post-1', { title: 'Post 1', content: 'Content 1' })
      await db.Post.create('post-2', { title: 'Post 2', content: 'Content 2' })
      await db.Comment.create('comment-1', { text: 'Comment 1' })

      const allEvents = await events.list({ limit: 100 })
      expect(allEvents.length).toBeGreaterThanOrEqual(3)

      const postEvents = await events.list({ event: 'Post.created' })
      expect(postEvents.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('Unsubscribe', () => {
    it('stops receiving events after unsubscribe', async () => {
      const { db, events } = DB(schema)
      const receivedEvents: DBEvent[] = []

      await new Promise((resolve) => setTimeout(resolve, 10))

      const unsubscribe = events.on('Post.created', (event) => {
        receivedEvents.push(event)
      })

      await new Promise((resolve) => setTimeout(resolve, 10))

      await db.Post.create({ title: 'First Post', content: 'Content' })

      await new Promise((resolve) => setTimeout(resolve, 10))

      const countBefore = receivedEvents.length

      // Unsubscribe
      unsubscribe()

      await new Promise((resolve) => setTimeout(resolve, 10))

      await db.Post.create({ title: 'Second Post', content: 'Content' })

      await new Promise((resolve) => setTimeout(resolve, 10))

      // Should not receive the second event
      expect(receivedEvents.length).toBe(countBefore)
    })
  })
})

describe('Events API - Usage examples', () => {
  /**
   * Example: Real-time audit logging
   *
   * Subscribe to all entity changes to build an audit log.
   */
  it('example: audit logging', async () => {
    const auditLog: Array<{ action: string; entity: string; timestamp: Date }> = []

    setProvider(createMemoryProvider())

    const { db, events } = DB({
      User: { name: 'string', email: 'string' },
      Order: { total: 'number', status: 'string' },
    } as const)

    await new Promise((resolve) => setTimeout(resolve, 10))

    // Subscribe to all entity events
    events.on(StandardEventTypes.ENTITY_CREATED, (event) => {
      auditLog.push({
        action: 'created',
        entity: `${event.objectData?.$type}/${event.objectData?.$id}`,
        timestamp: event.timestamp,
      })
    })

    events.on(StandardEventTypes.ENTITY_UPDATED, (event) => {
      auditLog.push({
        action: 'updated',
        entity: `${event.objectData?.$type}/${event.objectData?.$id}`,
        timestamp: event.timestamp,
      })
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    // Perform operations
    await db.User.create('user-1', { name: 'John', email: 'john@example.com' })
    await db.Order.create('order-1', { total: 100, status: 'pending' })
    await db.Order.update('order-1', { status: 'completed' })

    await new Promise((resolve) => setTimeout(resolve, 10))

    // Verify audit log
    expect(auditLog.length).toBe(3)
    expect(auditLog[0].action).toBe('created')
    expect(auditLog[0].entity).toBe('User/user-1')
    expect(auditLog[1].action).toBe('created')
    expect(auditLog[1].entity).toBe('Order/order-1')
    expect(auditLog[2].action).toBe('updated')
    expect(auditLog[2].entity).toBe('Order/order-1')
  })

  /**
   * Example: Type-specific notifications
   *
   * Subscribe to specific entity types for targeted notifications.
   */
  it('example: order notifications', async () => {
    const notifications: string[] = []

    setProvider(createMemoryProvider())

    const { db, events } = DB({
      Order: { customerId: 'string', total: 'number', status: 'string' },
    } as const)

    await new Promise((resolve) => setTimeout(resolve, 10))

    // Only listen for Order events
    events.on('Order.created', (event) => {
      const data = event.objectData as Record<string, unknown>
      notifications.push(`New order #${data.$id} for customer ${data.customerId}`)
    })

    events.on('Order.updated', (event) => {
      const data = event.objectData as Record<string, unknown>
      if (data.status === 'shipped') {
        notifications.push(`Order #${data.$id} has shipped!`)
      }
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    await db.Order.create('order-123', {
      customerId: 'cust-456',
      total: 99.99,
      status: 'pending',
    })

    await db.Order.update('order-123', { status: 'shipped' })

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(notifications).toContain('New order #order-123 for customer cust-456')
    expect(notifications).toContain('Order #order-123 has shipped!')
  })
})
