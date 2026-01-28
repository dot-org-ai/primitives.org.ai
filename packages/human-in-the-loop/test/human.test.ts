/**
 * Tests for human-in-the-loop primitives
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Human } from '../src/human.js'
import { InMemoryHumanStore } from '../src/store.js'
import type { ApprovalResponse, ReviewResponse } from '../src/types.js'

describe('Human-in-the-loop', () => {
  let human: ReturnType<typeof Human>
  let store: InMemoryHumanStore

  beforeEach(() => {
    store = new InMemoryHumanStore()
    human = Human({ store })
  })

  describe('Role Management', () => {
    it('should define and retrieve a role', () => {
      const role = human.defineRole({
        id: 'tech-lead',
        name: 'Tech Lead',
        description: 'Technical leadership',
        capabilities: ['approve-prs', 'deploy-prod'],
      })

      expect(role.id).toBe('tech-lead')
      expect(role.name).toBe('Tech Lead')

      const retrieved = human.getRole('tech-lead')
      expect(retrieved).toEqual(role)
    })
  })

  describe('Team Management', () => {
    it('should define and retrieve a team', () => {
      const team = human.defineTeam({
        id: 'engineering',
        name: 'Engineering Team',
        members: ['alice', 'bob'],
        lead: 'alice',
      })

      expect(team.id).toBe('engineering')
      expect(team.members).toHaveLength(2)

      const retrieved = human.getTeam('engineering')
      expect(retrieved).toEqual(team)
    })
  })

  describe('Human Worker Management', () => {
    it('should register and retrieve a human', () => {
      const worker = human.registerHuman({
        id: 'alice',
        name: 'Alice Smith',
        email: 'alice@example.com',
        roles: ['tech-lead'],
        teams: ['engineering'],
      })

      expect(worker.id).toBe('alice')
      expect(worker.name).toBe('Alice Smith')

      const retrieved = human.getHuman('alice')
      expect(retrieved).toEqual(worker)
    })
  })

  describe('Approval Requests', () => {
    it('should create an approval request', async () => {
      const requestPromise = human.approve({
        title: 'Test Approval',
        description: 'Test approval request',
        subject: 'Test',
        input: { data: 'test' },
        assignee: 'alice@example.com',
        priority: 'normal',
      })

      // The request should be pending in the store
      const requests = await store.list({ status: ['pending'] })
      expect(requests).toHaveLength(1)
      expect(requests[0]?.type).toBe('approval')
      expect(requests[0]?.title).toBe('Test Approval')
    })

    it('should complete an approval request', async () => {
      // Create request
      const request = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test Approval',
        description: 'Test',
        subject: 'Test',
        input: { data: 'test' },
        priority: 'normal' as const,
      })

      // Complete it
      const response: ApprovalResponse = {
        approved: true,
        comments: 'Looks good!',
      }

      const completed = await human.completeRequest(request.id, response)
      expect(completed.status).toBe('completed')
      expect(completed.response).toEqual(response)
    })

    it('should reject an approval request', async () => {
      const request = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test Approval',
        description: 'Test',
        subject: 'Test',
        input: { data: 'test' },
        priority: 'normal' as const,
      })

      const rejected = await human.rejectRequest(request.id, 'Not ready yet')
      expect(rejected.status).toBe('rejected')
      expect(rejected.rejectionReason).toBe('Not ready yet')
    })
  })

  describe('Question Requests', () => {
    it('should create a question request', async () => {
      const requestPromise = human.ask({
        title: 'Test Question',
        question: 'What is the answer?',
        context: { topic: 'testing' },
        assignee: 'alice@example.com',
      })

      const requests = await store.list({ status: ['pending'] })
      expect(requests).toHaveLength(1)
      expect(requests[0]?.type).toBe('question')
    })
  })

  describe('Decision Requests', () => {
    it('should create a decision request', async () => {
      const requestPromise = human.decide({
        title: 'Test Decision',
        options: ['option1', 'option2', 'option3'],
        context: { info: 'test' },
        assignee: 'alice@example.com',
      })

      const requests = await store.list({ status: ['pending'] })
      expect(requests).toHaveLength(1)
      expect(requests[0]?.type).toBe('decision')
    })
  })

  describe('Review Requests', () => {
    it('should create a review request', async () => {
      const requestPromise = human.review({
        title: 'Test Review',
        content: { code: 'console.log("test")' },
        reviewType: 'code',
        criteria: ['syntax', 'style', 'logic'],
        assignee: 'alice@example.com',
      })

      const requests = await store.list({ status: ['pending'] })
      expect(requests).toHaveLength(1)
      expect(requests[0]?.type).toBe('review')
    })

    it('should complete a review request', async () => {
      const request = await store.create({
        type: 'review' as const,
        status: 'pending' as const,
        title: 'Code Review',
        description: 'Review PR',
        input: { code: 'test' },
        content: { code: 'test' },
        priority: 'normal' as const,
      })

      const response: ReviewResponse = {
        approved: true,
        comments: 'Code looks good',
        rating: 5,
      }

      const completed = await human.completeRequest(request.id, response)
      expect(completed.status).toBe('completed')
      expect(completed.response).toEqual(response)
    })
  })

  describe('Notifications', () => {
    it('should send a notification', async () => {
      const notification = await human.notify({
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test',
        recipient: 'alice@example.com',
        channels: ['email'],
        priority: 'normal',
      })

      expect(notification.id).toBeDefined()
      expect(notification.type).toBe('info')
      expect(notification.title).toBe('Test Notification')
    })
  })

  describe('Review Queue', () => {
    it('should create and filter a review queue', async () => {
      // Create multiple requests
      await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'High Priority',
        description: 'Test',
        subject: 'Test',
        input: {},
        priority: 'high' as const,
      })

      await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Normal Priority',
        description: 'Test',
        subject: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      await store.create({
        type: 'approval' as const,
        status: 'completed' as const,
        title: 'Completed',
        description: 'Test',
        subject: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      // Get queue with filters
      const queue = await human.getQueue({
        name: 'High Priority Queue',
        filters: {
          status: ['pending'],
          priority: ['high'],
        },
      })

      expect(queue.items).toHaveLength(1)
      expect(queue.items[0]?.priority).toBe('high')
    })
  })

  describe('Goals and OKRs', () => {
    it('should define goals', () => {
      const goals = human.defineGoals({
        id: 'q1-2024',
        objectives: ['Launch v2.0', 'Improve performance'],
        targetDate: new Date('2024-03-31'),
      })

      expect(goals.id).toBe('q1-2024')
      expect(goals.objectives).toHaveLength(2)
    })

    it('should track KPIs', () => {
      const kpi = human.trackKPIs({
        id: 'response-time',
        name: 'API Response Time',
        value: 120,
        target: 100,
        unit: 'ms',
        trend: 'down',
      })

      expect(kpi.id).toBe('response-time')
      expect(kpi.value).toBe(120)
    })

    it('should define OKRs', () => {
      const okr = human.defineOKRs({
        id: 'q1-okr',
        objective: 'Improve performance',
        keyResults: [
          {
            description: 'Reduce response time to <100ms',
            progress: 0.75,
            current: 120,
            target: 100,
          },
        ],
        period: 'Q1 2024',
      })

      expect(okr.id).toBe('q1-okr')
      expect(okr.keyResults).toHaveLength(1)
    })
  })

  describe('Workflow Management', () => {
    it('should create and retrieve a workflow', () => {
      const workflow = human.createWorkflow({
        id: 'approval-workflow',
        name: 'Approval Workflow',
        steps: [
          {
            name: 'Step 1',
            approvers: ['alice'],
            requireAll: true,
          },
          {
            name: 'Step 2',
            approvers: ['bob'],
            requireAll: true,
          },
        ],
        currentStep: 0,
        status: 'pending',
      })

      expect(workflow.id).toBe('approval-workflow')
      expect(workflow.steps).toHaveLength(2)

      const retrieved = human.getWorkflow('approval-workflow')
      expect(retrieved).toEqual(workflow)
    })
  })

  describe('Request Operations', () => {
    it('should get a request by ID', async () => {
      const request = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        subject: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      const retrieved = await human.getRequest(request.id)
      expect(retrieved?.id).toBe(request.id)
    })

    it('should escalate a request', async () => {
      const request = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        subject: 'Test',
        input: {},
        priority: 'normal' as const,
        assignee: 'alice',
      })

      const escalated = await human.escalateRequest(request.id, 'bob')
      expect(escalated.status).toBe('escalated')
      expect(escalated.assignee).toBe('bob')
    })

    it('should cancel a request', async () => {
      const request = await store.create({
        type: 'approval' as const,
        status: 'pending' as const,
        title: 'Test',
        description: 'Test',
        subject: 'Test',
        input: {},
        priority: 'normal' as const,
      })

      const cancelled = await human.cancelRequest(request.id)
      expect(cancelled.status).toBe('cancelled')
    })
  })
})
