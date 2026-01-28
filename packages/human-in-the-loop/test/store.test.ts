/**
 * Tests for InMemoryHumanStore
 *
 * Comprehensive tests for the in-memory store implementation
 * that provides persistence for human requests.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryHumanStore } from '../src/store.js'
import type { HumanRequest, HumanRequestStatus } from '../src/types.js'

describe('InMemoryHumanStore', () => {
  let store: InMemoryHumanStore

  beforeEach(() => {
    store = new InMemoryHumanStore()
  })

  describe('ID Generation', () => {
    it('should generate unique IDs for each request', async () => {
      const req1 = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Request 1',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      const req2 = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Request 2',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      expect(req1.id).not.toBe(req2.id)
      expect(req1.id).toMatch(/^req_/)
      expect(req2.id).toMatch(/^req_/)
    })

    it('should include timestamp in generated ID', async () => {
      const req = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      // ID format: req_{timestamp}_{counter}
      const parts = req.id.split('_')
      expect(parts.length).toBe(3)
      expect(parts[0]).toBe('req')
      expect(Number(parts[1])).toBeGreaterThan(0)
    })
  })

  describe('Create', () => {
    it('should create a request with all required fields', async () => {
      const request = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test Approval',
        description: 'A test approval request',
        subject: 'Test Subject',
        input: { data: 'test' },
        priority: 'high' as const,
      })

      expect(request.id).toBeDefined()
      expect(request.type).toBe('approval')
      expect(request.status).toBe('pending')
      expect(request.title).toBe('Test Approval')
      expect(request.description).toBe('A test approval request')
      expect(request.priority).toBe('high')
      expect(request.createdAt).toBeInstanceOf(Date)
      expect(request.updatedAt).toBeInstanceOf(Date)
    })

    it('should set createdAt and updatedAt to the same time initially', async () => {
      const request = await store.create({
        type: 'question' as const,
        status: 'pending' as const,
        title: 'Test Question',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      expect(request.createdAt.getTime()).toBe(request.updatedAt.getTime())
    })

    it('should preserve optional fields', async () => {
      const request = await store.create({
        type: 'review' as const,
        status: 'pending' as const,
        title: 'Code Review',
        description: 'Review PR #123',
        input: { prId: 123 },
        priority: 'high' as const,
        assignee: 'alice@example.com',
        role: 'senior-developer',
        team: 'engineering',
        metadata: { branch: 'feature/new-feature' },
      })

      expect(request.assignee).toBe('alice@example.com')
      expect(request.role).toBe('senior-developer')
      expect(request.team).toBe('engineering')
      expect(request.metadata).toEqual({ branch: 'feature/new-feature' })
    })
  })

  describe('Get', () => {
    it('should retrieve a request by ID', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      const retrieved = await store.get(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.title).toBe('Test')
    })

    it('should return null for non-existent ID', async () => {
      const retrieved = await store.get('non-existent-id')
      expect(retrieved).toBeNull()
    })

    it('should preserve type information when retrieving', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Typed Request',
        description: 'Test',
        input: { customField: 'value' },
        priority: 'normal' as const,
        subject: 'Test Subject',
      })

      const retrieved = await store.get(created.id)

      expect(retrieved?.type).toBe('approval')
      expect((retrieved as any).subject).toBe('Test Subject')
    })
  })

  describe('Update', () => {
    it('should update a request', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Original Title',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      const updated = await store.update(created.id, {
        title: 'Updated Title',
        priority: 'high' as const,
      })

      expect(updated.title).toBe('Updated Title')
      expect(updated.priority).toBe('high')
    })

    it('should update the updatedAt timestamp', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      // Wait a tiny bit to ensure timestamp difference
      await new Promise((r) => setTimeout(r, 10))

      const updated = await store.update(created.id, {
        title: 'Updated',
      })

      expect(updated.updatedAt.getTime()).toBeGreaterThan(created.createdAt.getTime())
    })

    it('should throw error when updating non-existent request', async () => {
      await expect(store.update('non-existent-id', { title: 'Test' })).rejects.toThrow(
        'Request not found: non-existent-id'
      )
    })

    it('should persist updates for subsequent gets', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      await store.update(created.id, {
        status: 'in_progress' as HumanRequestStatus,
      })

      const retrieved = await store.get(created.id)
      expect(retrieved?.status).toBe('in_progress')
    })
  })

  describe('List', () => {
    beforeEach(async () => {
      // Create test data
      await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Pending 1',
        description: 'Test',
        input: {},
        priority: 'high' as const,
        assignee: 'alice@example.com',
      })

      await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Pending 2',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
        assignee: 'bob@example.com',
        role: 'developer',
        team: 'engineering',
      })

      await store.create({
        type: 'review' as const,
        status: 'completed' as const,
        title: 'Completed',
        description: 'Test',
        input: {},
        priority: 'low' as const,
      })
    })

    it('should list all requests without filters', async () => {
      const requests = await store.list()
      expect(requests.length).toBe(3)
    })

    it('should filter by status', async () => {
      const pending = await store.list({ status: ['pending'] })
      expect(pending.length).toBe(2)

      const completed = await store.list({ status: ['completed'] })
      expect(completed.length).toBe(1)
    })

    it('should filter by priority', async () => {
      const high = await store.list({ priority: ['high'] })
      expect(high.length).toBe(1)
      expect(high[0]?.priority).toBe('high')

      const normalAndLow = await store.list({ priority: ['normal', 'low'] })
      expect(normalAndLow.length).toBe(2)
    })

    it('should filter by assignee', async () => {
      const alice = await store.list({ assignee: ['alice@example.com'] })
      expect(alice.length).toBe(1)
      expect(alice[0]?.assignee).toBe('alice@example.com')
    })

    it('should filter by role', async () => {
      const devs = await store.list({ role: ['developer'] })
      expect(devs.length).toBe(1)
    })

    it('should filter by team', async () => {
      const engineering = await store.list({ team: ['engineering'] })
      expect(engineering.length).toBe(1)
    })

    it('should combine multiple filters', async () => {
      const filtered = await store.list({
        status: ['pending'],
        priority: ['normal'],
      })
      expect(filtered.length).toBe(1)
      expect(filtered[0]?.title).toBe('Pending 2')
    })

    it('should sort by creation date (newest first)', async () => {
      const requests = await store.list()

      // Verify descending order
      for (let i = 1; i < requests.length; i++) {
        expect(requests[i - 1]!.createdAt.getTime()).toBeGreaterThanOrEqual(
          requests[i]!.createdAt.getTime()
        )
      }
    })

    it('should respect limit parameter', async () => {
      const limited = await store.list(undefined, 2)
      expect(limited.length).toBe(2)
    })

    it('should return empty array when no matches', async () => {
      const noMatches = await store.list({ status: ['cancelled'] })
      expect(noMatches).toEqual([])
    })

    it('should handle array assignees', async () => {
      await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Multi-assignee',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
        assignee: ['alice@example.com', 'bob@example.com'],
      })

      const results = await store.list({ assignee: ['alice@example.com'] })
      expect(results.some((r) => r.title === 'Multi-assignee')).toBe(true)
    })
  })

  describe('Complete', () => {
    it('should complete a request with response', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      const response = { approved: true, comments: 'LGTM' }
      const completed = await store.complete(created.id, response)

      expect(completed.status).toBe('completed')
      expect(completed.response).toEqual(response)
      expect(completed.completedAt).toBeInstanceOf(Date)
    })

    it('should throw error when completing non-existent request', async () => {
      await expect(store.complete('non-existent-id', { approved: true })).rejects.toThrow(
        'Request not found: non-existent-id'
      )
    })
  })

  describe('Reject', () => {
    it('should reject a request with reason', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      const rejected = await store.reject(created.id, 'Not approved')

      expect(rejected.status).toBe('rejected')
      expect(rejected.rejectionReason).toBe('Not approved')
      expect(rejected.completedAt).toBeInstanceOf(Date)
    })

    it('should throw error when rejecting non-existent request', async () => {
      await expect(store.reject('non-existent-id', 'reason')).rejects.toThrow(
        'Request not found: non-existent-id'
      )
    })
  })

  describe('Escalate', () => {
    it('should escalate a request to new assignee', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
        assignee: 'alice@example.com',
      })

      const escalated = await store.escalate(created.id, 'manager@example.com')

      expect(escalated.status).toBe('escalated')
      expect(escalated.assignee).toBe('manager@example.com')
    })

    it('should throw error when escalating non-existent request', async () => {
      await expect(store.escalate('non-existent-id', 'someone')).rejects.toThrow(
        'Request not found: non-existent-id'
      )
    })
  })

  describe('Cancel', () => {
    it('should cancel a request', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      const cancelled = await store.cancel(created.id)

      expect(cancelled.status).toBe('cancelled')
      expect(cancelled.completedAt).toBeInstanceOf(Date)
    })

    it('should throw error when cancelling non-existent request', async () => {
      await expect(store.cancel('non-existent-id')).rejects.toThrow(
        'Request not found: non-existent-id'
      )
    })
  })

  describe('Clear', () => {
    it('should remove all requests', async () => {
      await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test 1',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test 2',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      expect(store.count()).toBe(2)

      store.clear()

      expect(store.count()).toBe(0)
      const requests = await store.list()
      expect(requests).toEqual([])
    })

    it('should reset ID counter after clear', async () => {
      const req1 = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Before clear',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      store.clear()

      const req2 = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'After clear',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      // Counter should have reset
      const counter1 = parseInt(req1.id.split('_')[2]!)
      const counter2 = parseInt(req2.id.split('_')[2]!)
      expect(counter2).toBe(1)
    })
  })

  describe('Count', () => {
    it('should return 0 for empty store', () => {
      expect(store.count()).toBe(0)
    })

    it('should return correct count after creates', async () => {
      await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test 1',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      expect(store.count()).toBe(1)

      await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test 2',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      expect(store.count()).toBe(2)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent creates', async () => {
      const promises = Array(10)
        .fill(null)
        .map((_, i) =>
          store.create({
            type: 'approval' as const,
            status: 'pending' as const,
            title: `Request ${i}`,
            description: 'Test',
            input: {},
            priority: 'normal' as const,
          })
        )

      const requests = await Promise.all(promises)

      // All IDs should be unique
      const ids = requests.map((r) => r.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(10)

      expect(store.count()).toBe(10)
    })

    it('should handle concurrent updates', async () => {
      const created = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      // Multiple concurrent updates
      const promises = [
        store.update(created.id, { title: 'Update 1' }),
        store.update(created.id, { description: 'Update 2' }),
        store.update(created.id, { priority: 'high' as const }),
      ]

      await Promise.all(promises)

      const final = await store.get(created.id)
      // One of the updates should have "won" for each field
      expect(final).toBeDefined()
    })
  })
})
