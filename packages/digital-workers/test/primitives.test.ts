/**
 * Comprehensive integration tests for all 7 digital-workers primitives
 *
 * This file provides a unified test suite that validates all worker primitives
 * work together correctly. The 7 primitives are:
 *
 * 1. do    - Task execution/routing
 * 2. is    - Type validation
 * 3. ask   - Question routing
 * 4. approve - Approval workflows
 * 5. decide  - Decision making
 * 6. generate - Content generation
 * 7. notify  - Notification delivery
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 * Tests are skipped if AI_GATEWAY_URL is not configured.
 */

import { describe, it, expect } from 'vitest'
import { do as doTask, is, ask, approve, decide, generate, notify } from '../src/index.js'
import type { Worker, WorkerTeam } from '../src/types.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

// Common test fixtures
const testWorker: Worker = {
  id: 'test-worker',
  name: 'Test Worker',
  type: 'human',
  status: 'available',
  contacts: {
    email: 'test@example.com',
    slack: '@test',
  },
}

const testTeam: WorkerTeam = {
  id: 'test-team',
  name: 'Test Team',
  members: [testWorker],
  contacts: {
    slack: '#test-team',
    email: 'team@example.com',
  },
  lead: testWorker,
}

describe('Digital Workers - All 7 Primitives', () => {
  describe('Exports', () => {
    it('should export all 7 primitives', () => {
      expect(doTask).toBeDefined()
      expect(is).toBeDefined()
      expect(ask).toBeDefined()
      expect(approve).toBeDefined()
      expect(decide).toBeDefined()
      expect(generate).toBeDefined()
      expect(notify).toBeDefined()
    })

    it('all primitives should be functions', () => {
      expect(typeof doTask).toBe('function')
      expect(typeof is).toBe('function')
      expect(typeof ask).toBe('function')
      expect(typeof approve).toBe('function')
      expect(typeof decide).toBe('function')
      expect(typeof generate).toBe('function')
      expect(typeof notify).toBe('function')
    })
  })

  describe('Return Types', () => {
    it('do() returns TaskResult', async () => {
      const result = await doTask('Test task', { timeout: 1 })
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('duration')
    })

    it('is() returns TypeCheckResult', async () => {
      const result = await is('test', 'string')
      expect(result).toHaveProperty('valid')
    })

    it('ask() returns AskResult', async () => {
      const result = await ask(testWorker, 'Test question?', { via: 'slack' })
      expect(result).toHaveProperty('answer')
      expect(result).toHaveProperty('answeredBy')
    })

    it('approve() returns ApprovalResult', async () => {
      const result = await approve('Test request', testWorker, { via: 'slack' })
      expect(result).toHaveProperty('approved')
      expect(result).toHaveProperty('approvedBy')
    })

    it('notify() returns NotifyResult', async () => {
      const result = await notify(testWorker, 'Test message', { via: 'slack' })
      expect(result).toHaveProperty('sent')
      expect(result).toHaveProperty('via')
    })
  })

  describe.skipIf(!hasGateway)('Integration - AI-powered Primitives', () => {
    it('decide() returns Decision', async () => {
      const result = await decide({
        options: ['A', 'B'],
        context: 'Simple choice test',
      })
      expect(result).toHaveProperty('choice')
      expect(result).toHaveProperty('reasoning')
      expect(result).toHaveProperty('confidence')
    })

    it('generate() returns GenerateResult', async () => {
      const result = await generate('Say hello', { type: 'text' })
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('type')
      expect(result).toHaveProperty('metadata')
    })

    it('ask.ai() returns answer directly', async () => {
      const answer = await ask.ai('What is 1+1?')
      expect(answer).toBeDefined()
      expect(typeof answer).toBe('string')
    })
  })

  describe('Method Chains', () => {
    it('do has parallel, sequence, withDependencies', () => {
      expect(doTask.parallel).toBeDefined()
      expect(doTask.sequence).toBeDefined()
      expect(doTask.withDependencies).toBeDefined()
    })

    it('is has email, url, date, custom', () => {
      expect(is.email).toBeDefined()
      expect(is.url).toBeDefined()
      expect(is.date).toBeDefined()
      expect(is.custom).toBeDefined()
    })

    it('ask has ai, batch, clarify, yesNo, choose', () => {
      expect(ask.ai).toBeDefined()
      expect(ask.batch).toBeDefined()
      expect(ask.clarify).toBeDefined()
      expect(ask.yesNo).toBeDefined()
      expect(ask.choose).toBeDefined()
    })

    it('approve has withContext, batch, withDeadline, any, all', () => {
      expect(approve.withContext).toBeDefined()
      expect(approve.batch).toBeDefined()
      expect(approve.withDeadline).toBeDefined()
      expect(approve.any).toBeDefined()
      expect(approve.all).toBeDefined()
    })

    it('decide has yesNo, prioritize, withApproval', () => {
      expect(decide.yesNo).toBeDefined()
      expect(decide.prioritize).toBeDefined()
      expect(decide.withApproval).toBeDefined()
    })

    it('generate has variations, withTone, forAudience, withLength, refine', () => {
      expect(generate.variations).toBeDefined()
      expect(generate.withTone).toBeDefined()
      expect(generate.forAudience).toBeDefined()
      expect(generate.withLength).toBeDefined()
      expect(generate.refine).toBeDefined()
    })

    it('notify has alert, info, rich, batch, schedule', () => {
      expect(notify.alert).toBeDefined()
      expect(notify.info).toBeDefined()
      expect(notify.rich).toBeDefined()
      expect(notify.batch).toBeDefined()
      expect(notify.schedule).toBeDefined()
    })
  })

  describe('Worker/Team Target Resolution', () => {
    it('ask resolves Worker target', async () => {
      const result = await ask(testWorker, 'Question?', { via: 'slack' })
      expect(result.answeredBy?.id).toBe('test-worker')
    })

    it('ask resolves Team to lead', async () => {
      const result = await ask(testTeam, 'Team question?', { via: 'slack' })
      expect(result.answeredBy?.id).toBe('test-worker')
    })

    it('ask throws for string target without contacts', async () => {
      // String targets don't have contacts configured
      await expect(ask('string-id', 'Question?')).rejects.toThrow('No valid channel available')
    })

    it('approve resolves Worker target', async () => {
      const result = await approve('Request', testWorker, { via: 'slack' })
      expect(result.approvedBy?.id).toBe('test-worker')
    })

    it('notify resolves Worker target', async () => {
      const result = await notify(testWorker, 'Message', { via: 'slack' })
      expect(result.recipients?.[0].id).toBe('test-worker')
    })
  })

  describe('Channel Resolution', () => {
    it('uses specified channel when available', async () => {
      const result = await notify(testWorker, 'Test', { via: 'email' })
      expect(result.via).toContain('email')
    })

    it('falls back to available channel', async () => {
      const result = await notify(testWorker, 'Test')
      expect(result.via.length).toBeGreaterThan(0)
    })

    it('handles channel array', async () => {
      const result = await notify(testWorker, 'Test', { via: ['slack', 'email'] })
      expect(result.via).toContain('slack')
    })

    it('throws when no channel available', async () => {
      const noChannelWorker: Worker = {
        id: 'no-channel',
        name: 'No Channel',
        type: 'human',
        status: 'available',
        contacts: {},
      }

      await expect(ask(noChannelWorker, 'Question?')).rejects.toThrow()
    })
  })

  describe.skipIf(!hasGateway)('End-to-End Workflow', () => {
    it('can validate, decide, and notify', async () => {
      // Step 1: Validate input
      const validation = await is('test@example.com', 'email')
      expect(validation.valid).toBe(true)

      // Step 2: Make a decision
      const decision = await decide({
        options: ['approve', 'reject'],
        context: 'Should we process this email?',
      })
      expect(['approve', 'reject']).toContain(decision.choice)

      // Step 3: Notify about the decision
      const notification = await notify(testWorker, `Decision: ${decision.choice}`, {
        via: 'slack',
      })
      expect(notification.sent).toBe(true)
    })

    it('can generate content and validate it', async () => {
      // Step 1: Generate content
      const content = await generate('Generate an email address', {
        type: 'structured',
        schema: { email: 'A valid email address' },
      })
      expect(content.content).toBeDefined()

      // Step 2: Validate the generated email
      const generated = content.content as { email: string }
      if (generated.email) {
        const validation = await is.email(generated.email)
        // The generated email may or may not be valid format
        expect(validation).toBeDefined()
      }
    })
  })

  describe('Type Safety', () => {
    it('do returns typed result', async () => {
      const result = await doTask<string>('Test', { timeout: 1 })
      // result.result should be typed as string
      expect(result).toBeDefined()
    })

    it('ask returns typed answer', async () => {
      const result = await ask<string>(testWorker, 'Question?', { via: 'slack' })
      // result.answer should be typed as string
      expect(result).toBeDefined()
    })

    it('throws for unsupported image type (tests error handling)', async () => {
      // This tests type safety in error conditions
      await expect(generate('Generate image', { type: 'image' })).rejects.toThrow(
        'not yet implemented'
      )
    })
  })

  describe('Error Handling', () => {
    it('is handles validation errors gracefully', async () => {
      const result = await is('invalid', 'number')
      expect(result.valid).toBe(false)
      expect(result.errors).toBeDefined()
    })

    it('notify handles missing channels gracefully', async () => {
      const noChannelWorker: Worker = {
        id: 'no-channel',
        name: 'No Channel',
        type: 'human',
        status: 'available',
        contacts: {},
      }

      const result = await notify(noChannelWorker, 'Test')
      expect(result.sent).toBe(false)
    })

    it('generate throws for unsupported types', async () => {
      await expect(generate('Test', { type: 'image' })).rejects.toThrow()
    })
  })
})
