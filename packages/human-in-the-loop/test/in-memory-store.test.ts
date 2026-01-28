/**
 * Tests for InMemoryHumanStore - Enhanced store for digital-workers runtime
 *
 * This test suite covers the enhanced in-memory store implementation
 * that provides TTL/expiration support, proper ordering, and delete functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { InMemoryHumanStore, createInMemoryStore } from '../src/stores/in-memory.js'
import type { HumanRequest, HumanRequestStatus, Priority } from '../src/types.js'

describe('InMemoryHumanStore', () => {
  let store: InMemoryHumanStore

  beforeEach(() => {
    vi.useFakeTimers()
    store = new InMemoryHumanStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    store.dispose()
  })

  describe('Store request with ID and data', () => {
    it('should create a request with auto-generated ID', async () => {
      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Test Request',
        description: 'Test description',
        input: { data: 'test' },
        priority: 'normal',
      })

      expect(request.id).toBeDefined()
      expect(request.id).toMatch(/^req_/)
      expect(request.type).toBe('approval')
      expect(request.status).toBe('pending')
      expect(request.title).toBe('Test Request')
      expect(request.input).toEqual({ data: 'test' })
    })

    it('should generate unique IDs for each request', async () => {
      const requests = await Promise.all([
        store.create({
          type: 'approval',
          status: 'pending',
          title: 'Request 1',
          description: 'Test',
          input: {},
          priority: 'normal',
        }),
        store.create({
          type: 'approval',
          status: 'pending',
          title: 'Request 2',
          description: 'Test',
          input: {},
          priority: 'normal',
        }),
        store.create({
          type: 'approval',
          status: 'pending',
          title: 'Request 3',
          description: 'Test',
          input: {},
          priority: 'normal',
        }),
      ])

      const ids = requests.map((r) => r.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
    })

    it('should set createdAt and updatedAt timestamps', async () => {
      const now = new Date('2024-01-15T10:00:00Z')
      vi.setSystemTime(now)

      const request = await store.create({
        type: 'question',
        status: 'pending',
        title: 'Test Question',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      expect(request.createdAt).toEqual(now)
      expect(request.updatedAt).toEqual(now)
    })

    it('should preserve all input data fields', async () => {
      const request = await store.create({
        type: 'task',
        status: 'pending',
        title: 'Complex Task',
        description: 'Detailed description',
        input: {
          nested: { data: { deeply: 'nested' } },
          array: [1, 2, 3],
          boolean: true,
          number: 42,
        },
        priority: 'high',
        assignee: 'user@example.com',
        role: 'developer',
        team: 'engineering',
        metadata: { source: 'api' },
      })

      expect(request.input).toEqual({
        nested: { data: { deeply: 'nested' } },
        array: [1, 2, 3],
        boolean: true,
        number: 42,
      })
      expect(request.assignee).toBe('user@example.com')
      expect(request.role).toBe('developer')
      expect(request.team).toBe('engineering')
      expect(request.metadata).toEqual({ source: 'api' })
    })
  })

  describe('Retrieve pending requests', () => {
    beforeEach(async () => {
      // Create requests with different statuses
      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Pending 1',
        description: 'Test',
        input: {},
        priority: 'high',
      })
      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Pending 2',
        description: 'Test',
        input: {},
        priority: 'normal',
      })
      await store.create({
        type: 'approval',
        status: 'in_progress',
        title: 'In Progress',
        description: 'Test',
        input: {},
        priority: 'normal',
      })
      await store.create({
        type: 'approval',
        status: 'completed',
        title: 'Completed',
        description: 'Test',
        input: {},
        priority: 'low',
      })
    })

    it('should retrieve only pending requests', async () => {
      const pending = await store.list({ status: ['pending'] })

      expect(pending.length).toBe(2)
      expect(pending.every((r) => r.status === 'pending')).toBe(true)
    })

    it('should retrieve a single request by ID', async () => {
      const created = await store.create({
        type: 'review',
        status: 'pending',
        title: 'Find me',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      const found = await store.get(created.id)

      expect(found).not.toBeNull()
      expect(found?.id).toBe(created.id)
      expect(found?.title).toBe('Find me')
    })

    it('should return null for non-existent request', async () => {
      const found = await store.get('non-existent-id')
      expect(found).toBeNull()
    })
  })

  describe('Update request status (pending -> approved/rejected)', () => {
    it('should update status from pending to completed (approved)', async () => {
      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Approval Request',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      const completed = await store.complete(request.id, {
        approved: true,
        comments: 'Looks good',
      })

      expect(completed.status).toBe('completed')
      expect(completed.response).toEqual({
        approved: true,
        comments: 'Looks good',
      })
      expect(completed.completedAt).toBeDefined()
    })

    it('should update status from pending to rejected', async () => {
      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Approval Request',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      const rejected = await store.reject(request.id, 'Does not meet requirements')

      expect(rejected.status).toBe('rejected')
      expect(rejected.rejectionReason).toBe('Does not meet requirements')
      expect(rejected.completedAt).toBeDefined()
    })

    it('should update updatedAt when status changes', async () => {
      const now = new Date('2024-01-15T10:00:00Z')
      vi.setSystemTime(now)

      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      const later = new Date('2024-01-15T11:00:00Z')
      vi.setSystemTime(later)

      const updated = await store.update(request.id, {
        status: 'in_progress' as HumanRequestStatus,
      })

      expect(updated.updatedAt).toEqual(later)
      expect(updated.createdAt).toEqual(now)
    })

    it('should throw error when updating non-existent request', async () => {
      await expect(
        store.update('non-existent', { status: 'completed' as HumanRequestStatus })
      ).rejects.toThrow('Request not found')
    })
  })

  describe('Delete completed requests', () => {
    it('should delete a request by ID', async () => {
      const request = await store.create({
        type: 'approval',
        status: 'completed',
        title: 'Completed Request',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      const deleted = await store.delete(request.id)

      expect(deleted).toBe(true)
      expect(await store.get(request.id)).toBeNull()
    })

    it('should return false when deleting non-existent request', async () => {
      const deleted = await store.delete('non-existent-id')
      expect(deleted).toBe(false)
    })

    it('should update count after deletion', async () => {
      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      expect(store.count()).toBe(1)

      await store.delete(request.id)

      expect(store.count()).toBe(0)
    })

    it('should remove request from list after deletion', async () => {
      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Delete Me',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      await store.delete(request.id)

      const list = await store.list()
      expect(list.find((r) => r.id === request.id)).toBeUndefined()
    })
  })

  describe('List requests by status', () => {
    beforeEach(async () => {
      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Pending',
        description: 'Test',
        input: {},
        priority: 'high',
      })
      await store.create({
        type: 'approval',
        status: 'in_progress',
        title: 'In Progress',
        description: 'Test',
        input: {},
        priority: 'normal',
      })
      await store.create({
        type: 'approval',
        status: 'completed',
        title: 'Completed',
        description: 'Test',
        input: {},
        priority: 'normal',
      })
      await store.create({
        type: 'approval',
        status: 'rejected',
        title: 'Rejected',
        description: 'Test',
        input: {},
        priority: 'low',
      })
      await store.create({
        type: 'approval',
        status: 'escalated',
        title: 'Escalated',
        description: 'Test',
        input: {},
        priority: 'critical',
      })
    })

    it('should list requests by single status', async () => {
      const pending = await store.list({ status: ['pending'] })
      expect(pending.length).toBe(1)
      expect(pending[0]?.status).toBe('pending')
    })

    it('should list requests by multiple statuses', async () => {
      const active = await store.list({ status: ['pending', 'in_progress'] })
      expect(active.length).toBe(2)
      expect(active.every((r) => ['pending', 'in_progress'].includes(r.status))).toBe(true)
    })

    it('should list requests by priority', async () => {
      const highPriority = await store.list({ priority: ['high', 'critical'] })
      expect(highPriority.length).toBe(2)
    })

    it('should combine status and priority filters', async () => {
      const filtered = await store.list({
        status: ['pending', 'escalated'],
        priority: ['high', 'critical'],
      })
      expect(filtered.length).toBe(2)
    })

    it('should return empty array when no matches', async () => {
      const timeout = await store.list({ status: ['timeout'] })
      expect(timeout).toEqual([])
    })

    it('should respect limit parameter', async () => {
      const limited = await store.list(undefined, 2)
      expect(limited.length).toBe(2)
    })
  })

  describe('Request expiration/TTL', () => {
    it('should create request with TTL', async () => {
      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Expiring Request',
        description: 'Test',
        input: {},
        priority: 'normal',
        timeout: 60000, // 1 minute TTL
      })

      expect(request.timeout).toBe(60000)
    })

    it('should mark request as expired after TTL', async () => {
      const now = new Date('2024-01-15T10:00:00Z')
      vi.setSystemTime(now)

      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Expiring Request',
        description: 'Test',
        input: {},
        priority: 'normal',
        timeout: 60000, // 1 minute TTL
      })

      // Advance time past TTL
      vi.advanceTimersByTime(61000)

      const retrieved = await store.get(request.id)
      expect(retrieved?.status).toBe('timeout')
    })

    it('should not expire requests without TTL', async () => {
      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'No Expiration',
        description: 'Test',
        input: {},
        priority: 'normal',
        // No timeout specified
      })

      // Advance time significantly
      vi.advanceTimersByTime(24 * 60 * 60 * 1000) // 24 hours

      const retrieved = await store.get(request.id)
      expect(retrieved?.status).toBe('pending')
    })

    it('should filter out expired requests from pending list', async () => {
      const now = new Date('2024-01-15T10:00:00Z')
      vi.setSystemTime(now)

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Expiring',
        description: 'Test',
        input: {},
        priority: 'normal',
        timeout: 60000,
      })

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Not Expiring',
        description: 'Test',
        input: {},
        priority: 'normal',
        // No timeout
      })

      // Advance time past first request's TTL
      vi.advanceTimersByTime(61000)

      const pending = await store.list({ status: ['pending'] })
      expect(pending.length).toBe(1)
      expect(pending[0]?.title).toBe('Not Expiring')
    })

    it('should not expire already completed requests', async () => {
      const now = new Date('2024-01-15T10:00:00Z')
      vi.setSystemTime(now)

      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Will Complete',
        description: 'Test',
        input: {},
        priority: 'normal',
        timeout: 60000,
      })

      // Complete before TTL
      vi.advanceTimersByTime(30000)
      await store.complete(request.id, { approved: true })

      // Advance past original TTL
      vi.advanceTimersByTime(60000)

      const retrieved = await store.get(request.id)
      expect(retrieved?.status).toBe('completed')
    })

    it('should provide expiredAt timestamp when expired', async () => {
      const now = new Date('2024-01-15T10:00:00Z')
      vi.setSystemTime(now)

      const request = await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Expiring',
        description: 'Test',
        input: {},
        priority: 'normal',
        timeout: 60000,
      })

      // Advance time past TTL
      vi.advanceTimersByTime(61000)

      const retrieved = await store.get(request.id)
      expect(retrieved?.status).toBe('timeout')
      expect(retrieved?.completedAt).toBeDefined()
    })

    it('should list expired requests by timeout status', async () => {
      const now = new Date('2024-01-15T10:00:00Z')
      vi.setSystemTime(now)

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Expiring 1',
        description: 'Test',
        input: {},
        priority: 'normal',
        timeout: 60000,
      })

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Expiring 2',
        description: 'Test',
        input: {},
        priority: 'normal',
        timeout: 120000,
      })

      // Advance past first TTL but not second
      vi.advanceTimersByTime(61000)

      const timedOut = await store.list({ status: ['timeout'] })
      expect(timedOut.length).toBe(1)
      expect(timedOut[0]?.title).toBe('Expiring 1')
    })
  })

  describe('Request queue ordering', () => {
    it('should order requests by creation time (newest first by default)', async () => {
      const now = new Date('2024-01-15T10:00:00Z')
      vi.setSystemTime(now)

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'First',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      vi.advanceTimersByTime(1000)

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Second',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      vi.advanceTimersByTime(1000)

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Third',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      const requests = await store.list()

      expect(requests[0]?.title).toBe('Third')
      expect(requests[1]?.title).toBe('Second')
      expect(requests[2]?.title).toBe('First')
    })

    it('should support priority-based ordering', async () => {
      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Low',
        description: 'Test',
        input: {},
        priority: 'low',
      })

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Critical',
        description: 'Test',
        input: {},
        priority: 'critical',
      })

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Normal',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      const requests = await store.listByPriority()

      expect(requests[0]?.title).toBe('Critical')
      expect(requests[1]?.title).toBe('Normal')
      expect(requests[2]?.title).toBe('Low')
    })
  })

  describe('Factory function', () => {
    it('should create store with createInMemoryStore()', () => {
      const factoryStore = createInMemoryStore()
      expect(factoryStore).toBeInstanceOf(InMemoryHumanStore)
      factoryStore.dispose()
    })

    it('should create store with options', () => {
      const factoryStore = createInMemoryStore({
        checkExpirationInterval: 5000,
      })
      expect(factoryStore).toBeInstanceOf(InMemoryHumanStore)
      factoryStore.dispose()
    })
  })

  describe('Utility methods', () => {
    it('should clear all requests', async () => {
      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Test 1',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Test 2',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      expect(store.count()).toBe(2)

      store.clear()

      expect(store.count()).toBe(0)
      const list = await store.list()
      expect(list).toEqual([])
    })

    it('should return correct count', async () => {
      expect(store.count()).toBe(0)

      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      expect(store.count()).toBe(1)
    })

    it('should dispose cleanly', () => {
      const disposableStore = createInMemoryStore()
      disposableStore.dispose()
      // Should not throw
    })
  })

  describe('Edge cases', () => {
    it('should handle concurrent creates', async () => {
      const promises = Array(100)
        .fill(null)
        .map((_, i) =>
          store.create({
            type: 'approval',
            status: 'pending',
            title: `Request ${i}`,
            description: 'Test',
            input: { index: i },
            priority: 'normal',
          })
        )

      const requests = await Promise.all(promises)
      const ids = requests.map((r) => r.id)
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(100)
      expect(store.count()).toBe(100)
    })

    it('should handle empty filters', async () => {
      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      const all = await store.list({})
      expect(all.length).toBe(1)
    })

    it('should handle undefined filters', async () => {
      await store.create({
        type: 'approval',
        status: 'pending',
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal',
      })

      const all = await store.list(undefined)
      expect(all.length).toBe(1)
    })
  })
})
