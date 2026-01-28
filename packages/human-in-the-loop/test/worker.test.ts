/**
 * Worker Export Tests (RED phase)
 *
 * Tests for the /worker export that provides HumanReviewService as a WorkerEntrypoint
 * with a connect() method that returns HumanReviewServiceCore (RpcTarget).
 *
 * IMPORTANT: NO MOCKS - These tests run against real Durable Objects with SQLite persistence
 * using @cloudflare/vitest-pool-workers and miniflare.
 *
 * The HumanReviewService WorkerEntrypoint provides:
 * - Human review request creation
 * - Approval/rejection workflows
 * - Review queue management
 * - Escalation handling
 * - Human feedback collection
 *
 * These tests should FAIL initially because src/worker.ts doesn't exist yet.
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import { env } from 'cloudflare:test'

// Types for the expected service interface
interface ReviewRequest {
  id: string
  type: 'approval' | 'question' | 'task' | 'decision' | 'review'
  status:
    | 'pending'
    | 'in_progress'
    | 'completed'
    | 'rejected'
    | 'escalated'
    | 'timeout'
    | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'critical'
  title: string
  description: string
  content: unknown
  assignee?: string | string[]
  role?: string
  team?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  respondedBy?: string
  response?: unknown
  rejectionReason?: string
  escalatedTo?: string
  escalatedAt?: Date
  metadata?: Record<string, unknown>
}

interface ReviewDecision {
  requestId: string
  decision: 'approved' | 'rejected'
  decidedBy: string
  decidedAt: Date
  comments?: string
  conditions?: string[]
  feedback?: string
}

interface ReviewFeedback {
  id: string
  requestId: string
  feedbackBy: string
  feedbackAt: Date
  rating?: number
  comments: string
  suggestions?: string[]
  tags?: string[]
}

interface QueueFilters {
  status?: Array<'pending' | 'in_progress' | 'completed' | 'rejected' | 'escalated'>
  priority?: Array<'low' | 'normal' | 'high' | 'critical'>
  assignee?: string[]
  role?: string[]
  team?: string[]
  type?: Array<'approval' | 'question' | 'task' | 'decision' | 'review'>
}

interface QueueOptions {
  filters?: QueueFilters
  limit?: number
  offset?: number
  sortBy?: 'createdAt' | 'priority' | 'updatedAt'
  sortDirection?: 'asc' | 'desc'
}

interface EscalationOptions {
  to: string
  reason?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  notifyVia?: ('slack' | 'email' | 'sms' | 'web')[]
}

// Expected service interface
interface HumanReviewServiceInterface {
  // Review request creation
  requestReview(params: {
    type: 'approval' | 'question' | 'task' | 'decision' | 'review'
    title: string
    description: string
    content: unknown
    assignee?: string | string[]
    role?: string
    team?: string
    priority?: 'low' | 'normal' | 'high' | 'critical'
    timeout?: number
    metadata?: Record<string, unknown>
  }): Promise<ReviewRequest>

  // Approval workflow
  approve(
    requestId: string,
    params: {
      decidedBy: string
      comments?: string
      conditions?: string[]
    }
  ): Promise<ReviewDecision>

  // Rejection workflow
  reject(
    requestId: string,
    params: {
      decidedBy: string
      reason: string
      feedback?: string
    }
  ): Promise<ReviewDecision>

  // Escalation handling
  escalate(requestId: string, options: EscalationOptions): Promise<ReviewRequest>

  // Queue management
  getQueue(options?: QueueOptions): Promise<ReviewRequest[]>

  // Feedback collection
  addFeedback(params: {
    requestId: string
    feedbackBy: string
    rating?: number
    comments: string
    suggestions?: string[]
    tags?: string[]
  }): Promise<ReviewFeedback>

  // Retrieve decisions
  getDecision(requestId: string): Promise<ReviewDecision | null>

  // Get request by ID
  getRequest(requestId: string): Promise<ReviewRequest | null>

  // List feedback for a request
  listFeedback(requestId: string): Promise<ReviewFeedback[]>

  // Update request status
  updateStatus(
    requestId: string,
    status: ReviewRequest['status'],
    respondedBy?: string
  ): Promise<ReviewRequest>

  // Assign request to a human
  assign(requestId: string, assignee: string | string[]): Promise<ReviewRequest>

  // Get queue statistics
  getQueueStats(): Promise<{
    total: number
    pending: number
    inProgress: number
    completed: number
    rejected: number
    escalated: number
    byPriority: Record<string, number>
    avgResponseTime?: number
  }>
}

describe('HumanReviewWorker', () => {
  describe('class structure', () => {
    it('should extend WorkerEntrypoint', async () => {
      // This import should fail initially - worker.ts doesn't exist
      const { HumanReviewWorker } = await import('../src/worker.js')

      // Verify the class exists and extends WorkerEntrypoint
      expect(HumanReviewWorker).toBeDefined()
      expect(typeof HumanReviewWorker).toBe('function')
      // WorkerEntrypoint check - should have prototype chain
      expect(HumanReviewWorker.prototype).toBeDefined()
    })

    it('should have a connect method', async () => {
      const { HumanReviewWorker } = await import('../src/worker.js')
      expect(typeof HumanReviewWorker.prototype.connect).toBe('function')
    })

    it('should be the default export', async () => {
      const { default: DefaultExport, HumanReviewWorker } = await import('../src/worker.js')
      expect(DefaultExport).toBe(HumanReviewWorker)
    })
  })
})

describe('HumanReviewServiceCore', () => {
  describe('class structure', () => {
    it('should extend RpcTarget', async () => {
      const { HumanReviewServiceCore } = await import('../src/worker.js')
      expect(HumanReviewServiceCore).toBeDefined()
      expect(typeof HumanReviewServiceCore).toBe('function')
    })

    it('should have all required methods', async () => {
      const { HumanReviewServiceCore } = await import('../src/worker.js')
      const proto = HumanReviewServiceCore.prototype

      // Review request creation
      expect(typeof proto.requestReview).toBe('function')

      // Approval/rejection workflows
      expect(typeof proto.approve).toBe('function')
      expect(typeof proto.reject).toBe('function')

      // Queue management
      expect(typeof proto.getQueue).toBe('function')

      // Escalation handling
      expect(typeof proto.escalate).toBe('function')

      // Feedback collection
      expect(typeof proto.addFeedback).toBe('function')

      // Decision retrieval
      expect(typeof proto.getDecision).toBe('function')
    })
  })
})

describe('HumanReviewServiceCore via connect()', () => {
  let service: HumanReviewServiceInterface
  let getService: () => Promise<HumanReviewServiceInterface>

  beforeEach(async () => {
    // Import the worker module
    const { HumanReviewWorker } = await import('../src/worker.js')

    // Create a helper function to get a service
    getService = async () => {
      // In real tests this would use env from cloudflare:test
      const worker = new HumanReviewWorker({ env } as any, {} as any)
      return worker.connect() as HumanReviewServiceInterface
    }

    // Get service for tests
    service = await getService()
  })

  describe('requestReview()', () => {
    it('should create an approval request', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Deploy to production',
        description: 'Approve deployment of v2.0.0',
        content: { version: '2.0.0', changes: ['Feature A', 'Bug fix B'] },
        assignee: 'tech-lead@example.com',
        priority: 'high',
      })

      expect(request).toBeDefined()
      expect(request.id).toBeDefined()
      expect(request.id.length).toBeGreaterThan(0)
      expect(request.type).toBe('approval')
      expect(request.title).toBe('Deploy to production')
      expect(request.description).toBe('Approve deployment of v2.0.0')
      expect(request.status).toBe('pending')
      expect(request.priority).toBe('high')
      expect(request.assignee).toBe('tech-lead@example.com')
      expect(request.createdAt).toBeInstanceOf(Date)
      expect(request.updatedAt).toBeInstanceOf(Date)
    })

    it('should create a question request', async () => {
      const request = await service.requestReview({
        type: 'question',
        title: 'Product naming',
        description: 'What should we name the new feature?',
        content: { context: 'AI Assistant feature' },
        role: 'product-manager',
      })

      expect(request.type).toBe('question')
      expect(request.role).toBe('product-manager')
      expect(request.status).toBe('pending')
    })

    it('should create a task request', async () => {
      const request = await service.requestReview({
        type: 'task',
        title: 'Review code',
        description: 'Review the PR and provide feedback',
        content: { prUrl: 'https://github.com/org/repo/pull/123' },
        team: 'engineering',
        priority: 'normal',
      })

      expect(request.type).toBe('task')
      expect(request.team).toBe('engineering')
    })

    it('should create a decision request', async () => {
      const request = await service.requestReview({
        type: 'decision',
        title: 'Pick deployment strategy',
        description: 'Choose from: blue-green, canary, rolling',
        content: { options: ['blue-green', 'canary', 'rolling'], context: { risk: 'high' } },
        assignee: ['devops-lead@example.com', 'cto@example.com'],
        priority: 'critical',
      })

      expect(request.type).toBe('decision')
      expect(request.priority).toBe('critical')
      expect(request.assignee).toEqual(['devops-lead@example.com', 'cto@example.com'])
    })

    it('should create a review request with metadata', async () => {
      const request = await service.requestReview({
        type: 'review',
        title: 'Review blog post',
        description: 'Review for grammar and accuracy',
        content: { title: 'My Post', body: 'Lorem ipsum...' },
        metadata: { source: 'ai-generated', model: 'claude-3' },
      })

      expect(request.type).toBe('review')
      expect(request.metadata).toEqual({ source: 'ai-generated', model: 'claude-3' })
    })

    it('should use default priority if not specified', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test request',
        description: 'Test description',
        content: {},
      })

      expect(request.priority).toBe('normal')
    })

    it('should generate unique IDs for each request', async () => {
      const request1 = await service.requestReview({
        type: 'approval',
        title: 'Request 1',
        description: 'First request',
        content: {},
      })

      const request2 = await service.requestReview({
        type: 'approval',
        title: 'Request 2',
        description: 'Second request',
        content: {},
      })

      expect(request1.id).not.toBe(request2.id)
    })
  })

  describe('approve()', () => {
    it('should approve a pending request', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Deploy v3.0.0',
        description: 'Production deployment',
        content: { version: '3.0.0' },
        assignee: 'manager@example.com',
      })

      const decision = await service.approve(request.id, {
        decidedBy: 'manager@example.com',
        comments: 'Looks good to me',
      })

      expect(decision).toBeDefined()
      expect(decision.requestId).toBe(request.id)
      expect(decision.decision).toBe('approved')
      expect(decision.decidedBy).toBe('manager@example.com')
      expect(decision.comments).toBe('Looks good to me')
      expect(decision.decidedAt).toBeInstanceOf(Date)
    })

    it('should approve with conditions', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'API change',
        description: 'Breaking API change',
        content: { endpoint: '/api/v2/users' },
      })

      const decision = await service.approve(request.id, {
        decidedBy: 'tech-lead@example.com',
        comments: 'Approved with conditions',
        conditions: ['Update documentation', 'Add migration guide', 'Notify API consumers'],
      })

      expect(decision.conditions).toEqual([
        'Update documentation',
        'Add migration guide',
        'Notify API consumers',
      ])
    })

    it('should update request status to completed after approval', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test approval',
        description: 'Test',
        content: {},
      })

      await service.approve(request.id, {
        decidedBy: 'approver@example.com',
      })

      const updatedRequest = await service.getRequest(request.id)
      expect(updatedRequest?.status).toBe('completed')
      expect(updatedRequest?.respondedBy).toBe('approver@example.com')
      expect(updatedRequest?.completedAt).toBeInstanceOf(Date)
    })

    it('should throw error for non-existent request', async () => {
      await expect(
        service.approve('nonexistent-id', {
          decidedBy: 'user@example.com',
        })
      ).rejects.toThrow()
    })

    it('should throw error for already completed request', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test',
        description: 'Test',
        content: {},
      })

      await service.approve(request.id, { decidedBy: 'user1@example.com' })

      await expect(
        service.approve(request.id, { decidedBy: 'user2@example.com' })
      ).rejects.toThrow()
    })
  })

  describe('reject()', () => {
    it('should reject a pending request', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'High-risk deployment',
        description: 'Risky change',
        content: { changes: 'major refactor' },
      })

      const decision = await service.reject(request.id, {
        decidedBy: 'reviewer@example.com',
        reason: 'Too risky without more testing',
        feedback: 'Please add more unit tests',
      })

      expect(decision).toBeDefined()
      expect(decision.requestId).toBe(request.id)
      expect(decision.decision).toBe('rejected')
      expect(decision.decidedBy).toBe('reviewer@example.com')
      expect(decision.comments).toBe('Too risky without more testing')
      expect(decision.feedback).toBe('Please add more unit tests')
    })

    it('should update request status to rejected', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test rejection',
        description: 'Test',
        content: {},
      })

      await service.reject(request.id, {
        decidedBy: 'rejector@example.com',
        reason: 'Not ready',
      })

      const updatedRequest = await service.getRequest(request.id)
      expect(updatedRequest?.status).toBe('rejected')
      expect(updatedRequest?.rejectionReason).toBe('Not ready')
    })

    it('should require a reason for rejection', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test',
        description: 'Test',
        content: {},
      })

      await expect(
        service.reject(request.id, {
          decidedBy: 'user@example.com',
          reason: '', // Empty reason should fail
        })
      ).rejects.toThrow()
    })
  })

  describe('escalate()', () => {
    it('should escalate a request to higher authority', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Critical decision',
        description: 'Needs executive approval',
        content: { budget: 1000000 },
        assignee: 'manager@example.com',
      })

      const escalated = await service.escalate(request.id, {
        to: 'cto@example.com',
        reason: 'Budget exceeds manager approval limit',
        priority: 'critical',
      })

      expect(escalated).toBeDefined()
      expect(escalated.id).toBe(request.id)
      expect(escalated.status).toBe('escalated')
      expect(escalated.escalatedTo).toBe('cto@example.com')
      expect(escalated.escalatedAt).toBeInstanceOf(Date)
      expect(escalated.priority).toBe('critical')
    })

    it('should escalate with notification channels', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Urgent matter',
        description: 'Time-sensitive',
        content: {},
        priority: 'high',
      })

      const escalated = await service.escalate(request.id, {
        to: 'vp@example.com',
        notifyVia: ['slack', 'email'],
      })

      expect(escalated.status).toBe('escalated')
    })

    it('should preserve original request data after escalation', async () => {
      const originalContent = { important: 'data' }
      const request = await service.requestReview({
        type: 'approval',
        title: 'Original title',
        description: 'Original description',
        content: originalContent,
      })

      const escalated = await service.escalate(request.id, {
        to: 'escalatee@example.com',
      })

      expect(escalated.title).toBe('Original title')
      expect(escalated.description).toBe('Original description')
      expect(escalated.content).toEqual(originalContent)
    })
  })

  describe('getQueue()', () => {
    beforeEach(async () => {
      // Create some test requests
      await service.requestReview({
        type: 'approval',
        title: 'Pending 1',
        description: 'Test',
        content: {},
        priority: 'high',
        assignee: 'user1@example.com',
      })

      await service.requestReview({
        type: 'approval',
        title: 'Pending 2',
        description: 'Test',
        content: {},
        priority: 'normal',
        assignee: 'user2@example.com',
      })

      await service.requestReview({
        type: 'review',
        title: 'Review 1',
        description: 'Test',
        content: {},
        priority: 'low',
        team: 'engineering',
      })
    })

    it('should list all pending requests', async () => {
      const queue = await service.getQueue()

      expect(Array.isArray(queue)).toBe(true)
      expect(queue.length).toBeGreaterThanOrEqual(3)
    })

    it('should filter by status', async () => {
      const queue = await service.getQueue({
        filters: { status: ['pending'] },
      })

      expect(queue.every((r) => r.status === 'pending')).toBe(true)
    })

    it('should filter by priority', async () => {
      const queue = await service.getQueue({
        filters: { priority: ['high', 'critical'] },
      })

      expect(queue.every((r) => ['high', 'critical'].includes(r.priority))).toBe(true)
    })

    it('should filter by assignee', async () => {
      const queue = await service.getQueue({
        filters: { assignee: ['user1@example.com'] },
      })

      expect(
        queue.every((r) => {
          const assignees = Array.isArray(r.assignee) ? r.assignee : [r.assignee]
          return assignees.includes('user1@example.com')
        })
      ).toBe(true)
    })

    it('should filter by team', async () => {
      const queue = await service.getQueue({
        filters: { team: ['engineering'] },
      })

      expect(queue.every((r) => r.team === 'engineering')).toBe(true)
    })

    it('should filter by type', async () => {
      const queue = await service.getQueue({
        filters: { type: ['review'] },
      })

      expect(queue.every((r) => r.type === 'review')).toBe(true)
    })

    it('should support limit option', async () => {
      const queue = await service.getQueue({ limit: 2 })

      expect(queue).toHaveLength(2)
    })

    it('should support offset option', async () => {
      const allItems = await service.getQueue()
      const offsetItems = await service.getQueue({ offset: 1, limit: 2 })

      expect(offsetItems).toHaveLength(2)
      expect(offsetItems[0].id).toBe(allItems[1].id)
    })

    it('should support sorting by createdAt', async () => {
      const queue = await service.getQueue({
        sortBy: 'createdAt',
        sortDirection: 'desc',
      })

      for (let i = 1; i < queue.length; i++) {
        expect(queue[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
          queue[i].createdAt.getTime()
        )
      }
    })

    it('should support sorting by priority', async () => {
      const queue = await service.getQueue({
        sortBy: 'priority',
        sortDirection: 'desc',
      })

      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }
      for (let i = 1; i < queue.length; i++) {
        expect(priorityOrder[queue[i - 1].priority]).toBeGreaterThanOrEqual(
          priorityOrder[queue[i].priority]
        )
      }
    })

    it('should combine multiple filters', async () => {
      const queue = await service.getQueue({
        filters: {
          status: ['pending'],
          type: ['approval'],
          priority: ['high', 'critical'],
        },
      })

      expect(
        queue.every(
          (r) =>
            r.status === 'pending' &&
            r.type === 'approval' &&
            ['high', 'critical'].includes(r.priority)
        )
      ).toBe(true)
    })
  })

  describe('addFeedback()', () => {
    it('should add feedback to a request', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test request',
        description: 'Test',
        content: {},
      })

      await service.approve(request.id, { decidedBy: 'approver@example.com' })

      const feedback = await service.addFeedback({
        requestId: request.id,
        feedbackBy: 'observer@example.com',
        rating: 5,
        comments: 'Process was smooth',
        suggestions: ['Maybe add automatic reminders'],
        tags: ['positive', 'process-improvement'],
      })

      expect(feedback).toBeDefined()
      expect(feedback.id).toBeDefined()
      expect(feedback.requestId).toBe(request.id)
      expect(feedback.feedbackBy).toBe('observer@example.com')
      expect(feedback.rating).toBe(5)
      expect(feedback.comments).toBe('Process was smooth')
      expect(feedback.suggestions).toEqual(['Maybe add automatic reminders'])
      expect(feedback.tags).toEqual(['positive', 'process-improvement'])
      expect(feedback.feedbackAt).toBeInstanceOf(Date)
    })

    it('should allow multiple feedbacks on same request', async () => {
      const request = await service.requestReview({
        type: 'review',
        title: 'Content review',
        description: 'Review content',
        content: { text: 'Hello world' },
      })

      await service.addFeedback({
        requestId: request.id,
        feedbackBy: 'user1@example.com',
        comments: 'First feedback',
      })

      await service.addFeedback({
        requestId: request.id,
        feedbackBy: 'user2@example.com',
        comments: 'Second feedback',
      })

      const feedbacks = await service.listFeedback(request.id)
      expect(feedbacks).toHaveLength(2)
    })

    it('should require comments in feedback', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test',
        description: 'Test',
        content: {},
      })

      await expect(
        service.addFeedback({
          requestId: request.id,
          feedbackBy: 'user@example.com',
          comments: '', // Empty comments should fail
        })
      ).rejects.toThrow()
    })

    it('should validate rating is within range', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test',
        description: 'Test',
        content: {},
      })

      await expect(
        service.addFeedback({
          requestId: request.id,
          feedbackBy: 'user@example.com',
          rating: 10, // Out of range
          comments: 'Test',
        })
      ).rejects.toThrow()
    })
  })

  describe('getDecision()', () => {
    it('should retrieve decision for approved request', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test approval',
        description: 'Test',
        content: {},
      })

      await service.approve(request.id, {
        decidedBy: 'approver@example.com',
        comments: 'Approved!',
      })

      const decision = await service.getDecision(request.id)

      expect(decision).not.toBeNull()
      expect(decision!.requestId).toBe(request.id)
      expect(decision!.decision).toBe('approved')
      expect(decision!.decidedBy).toBe('approver@example.com')
    })

    it('should retrieve decision for rejected request', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test rejection',
        description: 'Test',
        content: {},
      })

      await service.reject(request.id, {
        decidedBy: 'rejector@example.com',
        reason: 'Not ready',
      })

      const decision = await service.getDecision(request.id)

      expect(decision).not.toBeNull()
      expect(decision!.decision).toBe('rejected')
    })

    it('should return null for pending request', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Pending request',
        description: 'Test',
        content: {},
      })

      const decision = await service.getDecision(request.id)
      expect(decision).toBeNull()
    })

    it('should return null for non-existent request', async () => {
      const decision = await service.getDecision('nonexistent-id')
      expect(decision).toBeNull()
    })
  })

  describe('getRequest()', () => {
    it('should retrieve request by ID', async () => {
      const created = await service.requestReview({
        type: 'approval',
        title: 'Test request',
        description: 'Test description',
        content: { key: 'value' },
        priority: 'high',
      })

      const retrieved = await service.getRequest(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved!.id).toBe(created.id)
      expect(retrieved!.title).toBe('Test request')
      expect(retrieved!.content).toEqual({ key: 'value' })
    })

    it('should return null for non-existent request', async () => {
      const result = await service.getRequest('nonexistent-id')
      expect(result).toBeNull()
    })
  })

  describe('listFeedback()', () => {
    it('should list all feedback for a request', async () => {
      const request = await service.requestReview({
        type: 'review',
        title: 'Test',
        description: 'Test',
        content: {},
      })

      await service.addFeedback({
        requestId: request.id,
        feedbackBy: 'user1@example.com',
        comments: 'First',
      })

      await service.addFeedback({
        requestId: request.id,
        feedbackBy: 'user2@example.com',
        comments: 'Second',
      })

      const feedbacks = await service.listFeedback(request.id)

      expect(feedbacks).toHaveLength(2)
      expect(feedbacks.map((f) => f.feedbackBy)).toContain('user1@example.com')
      expect(feedbacks.map((f) => f.feedbackBy)).toContain('user2@example.com')
    })

    it('should return empty array for request with no feedback', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Test',
        description: 'Test',
        content: {},
      })

      const feedbacks = await service.listFeedback(request.id)
      expect(feedbacks).toEqual([])
    })
  })

  describe('updateStatus()', () => {
    it('should update request status', async () => {
      const request = await service.requestReview({
        type: 'task',
        title: 'Test task',
        description: 'Test',
        content: {},
      })

      const updated = await service.updateStatus(request.id, 'in_progress', 'worker@example.com')

      expect(updated.status).toBe('in_progress')
      expect(updated.respondedBy).toBe('worker@example.com')
    })

    it('should track status transitions', async () => {
      const request = await service.requestReview({
        type: 'task',
        title: 'Test',
        description: 'Test',
        content: {},
      })

      expect(request.status).toBe('pending')

      const inProgress = await service.updateStatus(request.id, 'in_progress')
      expect(inProgress.status).toBe('in_progress')

      const completed = await service.updateStatus(request.id, 'completed')
      expect(completed.status).toBe('completed')
      expect(completed.completedAt).toBeInstanceOf(Date)
    })
  })

  describe('assign()', () => {
    it('should assign request to a single user', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Unassigned request',
        description: 'Test',
        content: {},
      })

      const assigned = await service.assign(request.id, 'assignee@example.com')

      expect(assigned.assignee).toBe('assignee@example.com')
    })

    it('should assign request to multiple users', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Group assignment',
        description: 'Test',
        content: {},
      })

      const assigned = await service.assign(request.id, ['user1@example.com', 'user2@example.com'])

      expect(assigned.assignee).toEqual(['user1@example.com', 'user2@example.com'])
    })

    it('should replace existing assignee', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Reassignment test',
        description: 'Test',
        content: {},
        assignee: 'original@example.com',
      })

      const reassigned = await service.assign(request.id, 'new@example.com')

      expect(reassigned.assignee).toBe('new@example.com')
    })
  })

  describe('getQueueStats()', () => {
    beforeEach(async () => {
      // Create various test requests
      await service.requestReview({
        type: 'approval',
        title: 'High priority pending',
        description: 'Test',
        content: {},
        priority: 'high',
      })

      await service.requestReview({
        type: 'approval',
        title: 'Normal priority pending',
        description: 'Test',
        content: {},
        priority: 'normal',
      })

      const toApprove = await service.requestReview({
        type: 'approval',
        title: 'To be approved',
        description: 'Test',
        content: {},
      })
      await service.approve(toApprove.id, { decidedBy: 'user@example.com' })

      const toReject = await service.requestReview({
        type: 'approval',
        title: 'To be rejected',
        description: 'Test',
        content: {},
      })
      await service.reject(toReject.id, { decidedBy: 'user@example.com', reason: 'Rejected' })
    })

    it('should return queue statistics', async () => {
      const stats = await service.getQueueStats()

      expect(stats).toBeDefined()
      expect(typeof stats.total).toBe('number')
      expect(typeof stats.pending).toBe('number')
      expect(typeof stats.completed).toBe('number')
      expect(typeof stats.rejected).toBe('number')
      expect(stats.total).toBeGreaterThanOrEqual(4)
    })

    it('should count by priority', async () => {
      const stats = await service.getQueueStats()

      expect(stats.byPriority).toBeDefined()
      expect(typeof stats.byPriority.high).toBe('number')
      expect(typeof stats.byPriority.normal).toBe('number')
    })

    it('should track in-progress requests', async () => {
      const request = await service.requestReview({
        type: 'task',
        title: 'In progress task',
        description: 'Test',
        content: {},
      })
      await service.updateStatus(request.id, 'in_progress')

      const stats = await service.getQueueStats()
      expect(stats.inProgress).toBeGreaterThanOrEqual(1)
    })

    it('should track escalated requests', async () => {
      const request = await service.requestReview({
        type: 'approval',
        title: 'Escalated request',
        description: 'Test',
        content: {},
      })
      await service.escalate(request.id, { to: 'manager@example.com' })

      const stats = await service.getQueueStats()
      expect(stats.escalated).toBeGreaterThanOrEqual(1)
    })
  })
})

describe('Data Persistence', () => {
  it('should persist requests across service calls', async () => {
    const { HumanReviewWorker } = await import('../src/worker.js')

    // First connection - create data
    const worker1 = new HumanReviewWorker({ env } as any, {} as any)
    const service1 = worker1.connect() as HumanReviewServiceInterface
    const created = await service1.requestReview({
      type: 'approval',
      title: 'Persistent request',
      description: 'Should persist',
      content: { value: 42 },
    })
    const createdId = created.id

    // Second connection - verify data persists
    const worker2 = new HumanReviewWorker({ env } as any, {} as any)
    const service2 = worker2.connect() as HumanReviewServiceInterface
    const retrieved = await service2.getRequest(createdId)

    expect(retrieved).not.toBeNull()
    expect((retrieved!.content as { value: number }).value).toBe(42)
  })

  it('should persist decisions', async () => {
    const { HumanReviewWorker } = await import('../src/worker.js')

    const worker1 = new HumanReviewWorker({ env } as any, {} as any)
    const service1 = worker1.connect() as HumanReviewServiceInterface
    const request = await service1.requestReview({
      type: 'approval',
      title: 'Decision persistence test',
      description: 'Test',
      content: {},
    })
    await service1.approve(request.id, {
      decidedBy: 'approver@example.com',
      comments: 'Approved!',
    })

    // New connection
    const worker2 = new HumanReviewWorker({ env } as any, {} as any)
    const service2 = worker2.connect() as HumanReviewServiceInterface
    const decision = await service2.getDecision(request.id)

    expect(decision).not.toBeNull()
    expect(decision!.decision).toBe('approved')
  })

  it('should persist feedback', async () => {
    const { HumanReviewWorker } = await import('../src/worker.js')

    const worker1 = new HumanReviewWorker({ env } as any, {} as any)
    const service1 = worker1.connect() as HumanReviewServiceInterface
    const request = await service1.requestReview({
      type: 'review',
      title: 'Feedback persistence test',
      description: 'Test',
      content: {},
    })
    await service1.addFeedback({
      requestId: request.id,
      feedbackBy: 'user@example.com',
      comments: 'Great process!',
    })

    // New connection
    const worker2 = new HumanReviewWorker({ env } as any, {} as any)
    const service2 = worker2.connect() as HumanReviewServiceInterface
    const feedbacks = await service2.listFeedback(request.id)

    expect(feedbacks).toHaveLength(1)
    expect(feedbacks[0].comments).toBe('Great process!')
  })
})

describe('Real AI Gateway integration', () => {
  let service: HumanReviewServiceInterface

  beforeAll(async () => {
    const { HumanReviewWorker } = await import('../src/worker.js')
    const worker = new HumanReviewWorker({ env } as any, {} as any)
    service = worker.connect() as HumanReviewServiceInterface
  })

  it('can access AI Gateway through env binding', () => {
    // env.AI should be available in workers environment
    expect(env).toBeDefined()
  })

  it('should support AI-assisted content classification in reviews', async () => {
    // This test verifies the AI binding can be used for
    // classifying review content priority/urgency
    const request = await service.requestReview({
      type: 'review',
      title: 'AI-assisted review',
      description: 'Content that might need AI classification',
      content: {
        text: 'This is an urgent security issue',
        needsClassification: true,
      },
    })

    expect(request).toBeDefined()
    // The worker implementation could use AI to suggest priority
  })
})

describe('Error handling', () => {
  let service: HumanReviewServiceInterface

  beforeEach(async () => {
    const { HumanReviewWorker } = await import('../src/worker.js')
    const worker = new HumanReviewWorker({ env } as any, {} as any)
    service = worker.connect() as HumanReviewServiceInterface
  })

  it('should handle invalid request type gracefully', async () => {
    await expect(
      service.requestReview({
        type: 'invalid' as any,
        title: 'Test',
        description: 'Test',
        content: {},
      })
    ).rejects.toThrow()
  })

  it('should handle missing required fields', async () => {
    await expect(
      service.requestReview({
        type: 'approval',
        title: '', // Empty title
        description: 'Test',
        content: {},
      })
    ).rejects.toThrow()
  })

  it('should handle invalid priority', async () => {
    await expect(
      service.requestReview({
        type: 'approval',
        title: 'Test',
        description: 'Test',
        content: {},
        priority: 'ultra-high' as any,
      })
    ).rejects.toThrow()
  })
})
