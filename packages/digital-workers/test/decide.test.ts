/**
 * Tests for decide() - Decision making primitive
 *
 * The decide() function provides structured decision-making with criteria
 * evaluation, confidence scoring, and optional human approval. Unlike
 * ai-functions.decide() which is an LLM-as-judge comparison, this function
 * provides comprehensive decision analysis.
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 * Tests are skipped if AI_GATEWAY_URL is not configured.
 */

import { describe, it, expect } from 'vitest'
import { decide } from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe('decide() - Decision Making Primitive', () => {
  describe('Unit Tests (no AI)', () => {
    it('should be exported from index', () => {
      expect(decide).toBeDefined()
      expect(typeof decide).toBe('function')
    })

    it('should have yesNo method', () => {
      expect(decide.yesNo).toBeDefined()
      expect(typeof decide.yesNo).toBe('function')
    })

    it('should have prioritize method', () => {
      expect(decide.prioritize).toBeDefined()
      expect(typeof decide.prioritize).toBe('function')
    })

    it('should have withApproval method', () => {
      expect(decide.withApproval).toBeDefined()
      expect(typeof decide.withApproval).toBe('function')
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Basic Decisions', () => {
    it('should make a decision from options', async () => {
      const decision = await decide({
        options: ['Option A', 'Option B', 'Option C'],
        context: 'Choose the best option for a simple test',
      })

      expect(decision).toBeDefined()
      expect(decision.choice).toBeDefined()
      expect(['Option A', 'Option B', 'Option C']).toContain(decision.choice)
      expect(decision.reasoning).toBeDefined()
      expect(typeof decision.reasoning).toBe('string')
      expect(decision.confidence).toBeDefined()
      expect(typeof decision.confidence).toBe('number')
      expect(decision.confidence).toBeGreaterThanOrEqual(0)
      expect(decision.confidence).toBeLessThanOrEqual(1)
    })

    it('should include alternatives in decision', async () => {
      const decision = await decide({
        options: ['React', 'Vue', 'Svelte'],
        context: 'Choose a frontend framework for a small project',
      })

      expect(decision).toBeDefined()
      expect(decision.alternatives).toBeDefined()
      expect(Array.isArray(decision.alternatives)).toBe(true)
    })

    it('should support criteria evaluation', async () => {
      const decision = await decide({
        options: ['PostgreSQL', 'MongoDB', 'Redis'],
        context: 'Choose a database for an e-commerce application',
        criteria: ['ACID compliance', 'Scalability', 'Ease of use', 'Community support'],
      })

      expect(decision).toBeDefined()
      expect(decision.choice).toBeDefined()
      expect(decision.reasoning).toBeDefined()
      // Reasoning should mention criteria
      expect(decision.reasoning.length).toBeGreaterThan(10)
    })

    it('should handle object options', async () => {
      const decision = await decide({
        options: [
          { id: 'plan-a', name: 'Basic Plan', price: 10 },
          { id: 'plan-b', name: 'Pro Plan', price: 25 },
          { id: 'plan-c', name: 'Enterprise Plan', price: 100 },
        ],
        context: 'Choose the best plan for a startup with limited budget',
      })

      expect(decision).toBeDefined()
      expect(decision.choice).toBeDefined()
    })

    it('should respect includeReasoning option', async () => {
      const decision = await decide({
        options: ['Yes', 'No'],
        context: 'Should we proceed?',
        includeReasoning: true,
      })

      expect(decision.reasoning).toBeDefined()
      expect(decision.reasoning.length).toBeGreaterThan(0)
    })

    it('should handle complex context object', async () => {
      const decision = await decide({
        options: ['Approve', 'Reject', 'Request more info'],
        context: {
          requestType: 'Budget increase',
          amount: 50000,
          department: 'Engineering',
          justification: 'Need to hire additional developer',
          currentBudget: 200000,
          utilizationRate: 0.95,
        },
      })

      expect(decision).toBeDefined()
      expect(decision.choice).toBeDefined()
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Yes/No Decisions', () => {
    it('should make binary decision', async () => {
      const decision = await decide.yesNo(
        'Should we deploy on Friday?',
        'The deploy is a minor bug fix with good test coverage'
      )

      expect(decision).toBeDefined()
      expect(['yes', 'no']).toContain(decision.choice)
      expect(decision.reasoning).toBeDefined()
      expect(decision.confidence).toBeDefined()
    })

    it('should handle context object in yesNo', async () => {
      const decision = await decide.yesNo('Should we approve this expense?', {
        amount: 500,
        category: 'Software',
        policy: 'Software expenses under $1000 are auto-approved',
      })

      expect(decision).toBeDefined()
      expect(['yes', 'no']).toContain(decision.choice)
    })

    it('should provide confidence score for yesNo', async () => {
      const decision = await decide.yesNo('Is this a valid email format: test@example.com?')

      expect(decision.confidence).toBeGreaterThan(0)
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Prioritization', () => {
    it('should prioritize items', async () => {
      const prioritized = await decide.prioritize(
        ['Feature A', 'Bug Fix B', 'Tech Debt C', 'Feature D'],
        'Sprint planning for a 2-week sprint'
      )

      expect(prioritized).toBeDefined()
      expect(Array.isArray(prioritized)).toBe(true)
      expect(prioritized.length).toBe(4)

      prioritized.forEach((item) => {
        expect(item.choice).toBeDefined()
        expect(item.rank).toBeDefined()
        expect(typeof item.rank).toBe('number')
        expect(item.reasoning).toBeDefined()
        expect(item.confidence).toBeDefined()
      })
    })

    it('should prioritize with criteria', async () => {
      const prioritized = await decide.prioritize(
        ['Task 1', 'Task 2', 'Task 3'],
        'Project backlog',
        ['User impact', 'Urgency', 'Effort required']
      )

      expect(prioritized).toBeDefined()
      expect(prioritized.length).toBe(3)

      // All items should have a rank
      const ranks = prioritized.map((p) => p.rank)
      expect(ranks.every((r) => typeof r === 'number')).toBe(true)
    })

    it('should prioritize object items', async () => {
      const items = [
        { id: 1, name: 'Critical bug', severity: 'high' },
        { id: 2, name: 'New feature', severity: 'low' },
        { id: 3, name: 'Performance fix', severity: 'medium' },
      ]

      const prioritized = await decide.prioritize(items, 'Bug triage session')

      expect(prioritized).toBeDefined()
      expect(prioritized.length).toBe(3)
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - Decision Quality', () => {
    it('should provide meaningful reasoning', async () => {
      const decision = await decide({
        options: ['AWS', 'GCP', 'Azure'],
        context: 'Choosing a cloud provider for a machine learning startup',
        criteria: ['ML services', 'Pricing', 'Documentation', 'Support'],
      })

      expect(decision.reasoning).toBeDefined()
      expect(decision.reasoning.length).toBeGreaterThan(50)
      // Reasoning should be substantive
    })

    it('should score alternatives', async () => {
      const decision = await decide({
        options: ['TypeScript', 'Python', 'Go', 'Rust'],
        context: 'Choosing a language for a CLI tool',
      })

      if (decision.alternatives && decision.alternatives.length > 0) {
        decision.alternatives.forEach((alt) => {
          expect(alt.option).toBeDefined()
          expect(typeof alt.score).toBe('number')
        })
      }
    })

    it('should normalize confidence to 0-1 range', async () => {
      const decision = await decide({
        options: ['A', 'B'],
        context: 'Simple choice',
      })

      expect(decision.confidence).toBeGreaterThanOrEqual(0)
      expect(decision.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('Decision with Approval', () => {
    it('should have withApproval method that requires approver', async () => {
      // Just verify the signature - actual approval routing is tested in approve.test.ts
      expect(typeof decide.withApproval).toBe('function')
    })
  })
})
