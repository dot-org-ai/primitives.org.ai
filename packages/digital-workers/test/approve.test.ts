/**
 * Tests for approve() - Approval workflow primitive
 *
 * The approve() function routes approval requests to Workers (Humans or AI Agents)
 * via real communication channels and waits for actual approval. Unlike
 * ai-functions.approve() which generates approval content, this function
 * implements real approval workflows.
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 * Tests are skipped if AI_GATEWAY_URL is not configured.
 */

import { describe, it, expect } from 'vitest'
import { approve } from '../src/index.js'
import type { Worker, WorkerRef, WorkerTeam } from '../src/types.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

// Test fixtures
const manager: Worker = {
  id: 'manager',
  name: 'Manager',
  type: 'human',
  status: 'available',
  contacts: {
    email: 'manager@example.com',
    slack: '@manager',
  },
}

const cto: WorkerRef = {
  id: 'cto',
  name: 'CTO',
  type: 'human',
}

const finance: Worker = {
  id: 'finance',
  name: 'Finance',
  type: 'human',
  status: 'available',
  contacts: {
    email: 'finance@example.com',
    slack: '#finance',
  },
}

const approvalTeam: WorkerTeam = {
  id: 'approval-team',
  name: 'Approval Team',
  members: [manager, finance],
  contacts: {
    slack: '#approvals',
    email: 'approvals@example.com',
  },
  lead: manager,
}

describe('approve() - Approval Workflow Primitive', () => {
  describe('Unit Tests (no AI)', () => {
    it('should be exported from index', () => {
      expect(approve).toBeDefined()
      expect(typeof approve).toBe('function')
    })

    it('should have withContext method', () => {
      expect(approve.withContext).toBeDefined()
      expect(typeof approve.withContext).toBe('function')
    })

    it('should have batch method', () => {
      expect(approve.batch).toBeDefined()
      expect(typeof approve.batch).toBe('function')
    })

    it('should have withDeadline method', () => {
      expect(approve.withDeadline).toBeDefined()
      expect(typeof approve.withDeadline).toBe('function')
    })

    it('should have any method', () => {
      expect(approve.any).toBeDefined()
      expect(typeof approve.any).toBe('function')
    })

    it('should have all method', () => {
      expect(approve.all).toBeDefined()
      expect(typeof approve.all).toBe('function')
    })
  })

  describe('Basic Approval Flow', () => {
    it('should create approval request', async () => {
      const result = await approve('Expense: $500 for AWS services', manager, { via: 'slack' })

      expect(result).toBeDefined()
      expect(typeof result.approved).toBe('boolean')
      expect(result.approvedBy).toBeDefined()
      expect(result.approvedBy?.id).toBe('manager')
      expect(result.via).toBe('slack')
    })

    it('should include approval timestamp', async () => {
      const result = await approve('Deploy to production', manager, { via: 'email' })

      expect(result.approvedAt).toBeDefined()
      expect(result.approvedAt).toBeInstanceOf(Date)
    })

    it('should resolve team to lead for approval', async () => {
      const result = await approve('Budget increase', approvalTeam, { via: 'slack' })

      expect(result).toBeDefined()
      expect(result.approvedBy?.id).toBe('manager') // Should be team lead
    })

    it('should throw for string target without contacts', async () => {
      // String targets don't have contacts configured, so this should throw
      await expect(approve('Request', 'approver-id')).rejects.toThrow('No valid channel available')
    })

    it('should include notes in result', async () => {
      const result = await approve('Request approval', manager, { via: 'slack' })

      expect(result.notes).toBeDefined()
      expect(typeof result.notes).toBe('string')
    })

    it('should throw error if no channel available', async () => {
      const noChannelWorker: Worker = {
        id: 'no-channel',
        name: 'No Channel',
        type: 'human',
        status: 'available',
        contacts: {},
      }

      await expect(approve('Request', noChannelWorker)).rejects.toThrow(
        'No valid channel available'
      )
    })
  })

  describe('Approval with Context', () => {
    it('should include context in approval request', async () => {
      const result = await approve('Expense approval', manager, {
        via: 'slack',
        context: {
          amount: 500,
          category: 'Infrastructure',
          vendor: 'AWS',
        },
      })

      expect(result).toBeDefined()
      expect(result.approvedBy).toBeDefined()
    })

    it('should use withContext for structured decisions', async () => {
      const result = await approve.withContext(
        'Migrate to new database',
        manager,
        {
          pros: ['Better performance', 'Lower cost'],
          cons: ['Migration effort', 'Learning curve'],
          risks: ['Data loss', 'Downtime'],
          mitigations: ['Backup plan', 'Staged rollout'],
        },
        { via: 'email' }
      )

      expect(result).toBeDefined()
      expect(result.approvedBy?.id).toBe('manager')
    })

    it('should include alternatives in withContext', async () => {
      const result = await approve.withContext('Choose technology stack', manager, {
        pros: ['Fast development'],
        cons: ['Limited ecosystem'],
        alternatives: ['React', 'Vue', 'Svelte'],
      })

      expect(result).toBeDefined()
    })
  })

  describe('Batch Approvals', () => {
    it('should handle batch approval requests', async () => {
      const results = await approve.batch(
        ['Expense: $100 for supplies', 'Expense: $200 for software', 'Expense: $50 for books'],
        manager,
        { via: 'slack' }
      )

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(3)
      results.forEach((result) => {
        expect(result.approved).toBeDefined()
        expect(result.approvedBy?.id).toBe('manager')
      })
    })
  })

  describe('Deadline-based Approvals', () => {
    it('should support deadline option', async () => {
      const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      const result = await approve.withDeadline('Time-sensitive approval', manager, deadline, {
        via: 'slack',
      })

      expect(result).toBeDefined()
      expect(result.approvedBy).toBeDefined()
    })

    it('should handle past deadline gracefully', async () => {
      const pastDeadline = new Date(Date.now() - 1000) // 1 second ago
      const result = await approve.withDeadline('Expired deadline', manager, pastDeadline, {
        via: 'email',
      })

      expect(result).toBeDefined()
      // Should still process even with past deadline
    })
  })

  describe('Multi-Approver Workflows', () => {
    it('should support any-of approval', async () => {
      const approvers: Worker[] = [manager, finance]

      const result = await approve.any('Urgent: Production fix', approvers, { via: 'slack' })

      expect(result).toBeDefined()
      expect(result.approved).toBeDefined()
      // First approver to respond wins
    })

    it('should support all-of approval', async () => {
      const approvers: Worker[] = [manager, finance]

      const result = await approve.all('Major infrastructure change', approvers, { via: 'email' })

      expect(result).toBeDefined()
      expect(result.approved).toBeDefined()
      expect(result.approvals).toBeDefined()
      expect(Array.isArray(result.approvals)).toBe(true)
      expect(result.approvals.length).toBe(2)
    })

    it('should track individual approvals in all-of', async () => {
      const result = await approve.all('Multi-approval request', [manager, finance], {
        via: 'slack',
      })

      expect(result.approvals).toBeDefined()
      result.approvals.forEach((approval) => {
        expect(approval.approved).toBeDefined()
        expect(approval.approvedBy).toBeDefined()
      })
    })
  })

  describe('Channel Selection', () => {
    it('should use specified channel', async () => {
      const result = await approve('Request', manager, { via: 'email' })

      expect(result.via).toBe('email')
    })

    it('should fall back to available channel', async () => {
      const slackOnlyApprover: Worker = {
        id: 'slack-only',
        name: 'Slack Only',
        type: 'human',
        status: 'available',
        contacts: {
          slack: '@approver',
        },
      }

      const result = await approve('Request', slackOnlyApprover)
      expect(result.via).toBe('slack')
    })

    it('should handle channel array', async () => {
      const result = await approve('Request', manager, { via: ['slack', 'email'] })

      // Should use first available
      expect(result.via).toBe('slack')
    })
  })

  describe('Escalation', () => {
    it('should support escalate option', async () => {
      const result = await approve('Escalated approval', manager, {
        via: 'slack',
        escalate: true,
      })

      expect(result).toBeDefined()
      // Escalation is a hint to the approval system
    })
  })
})
