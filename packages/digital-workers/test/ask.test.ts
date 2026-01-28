/**
 * Tests for ask() - Question routing primitive
 *
 * The ask() function routes questions to Workers (AI Agents or Humans) via
 * communication channels (Slack, email, SMS). Unlike ai-functions.ask() which
 * generates content for human interaction, this function routes to actual
 * workers and waits for their responses.
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 * Tests are skipped if AI_GATEWAY_URL is not configured.
 */

import { describe, it, expect } from 'vitest'
import { ask } from '../src/index.js'
import type { Worker, WorkerRef, WorkerTeam } from '../src/types.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

// Test fixtures
const alice: Worker = {
  id: 'alice',
  name: 'Alice',
  type: 'human',
  status: 'available',
  contacts: {
    email: 'alice@example.com',
    slack: '@alice',
  },
}

const bob: WorkerRef = {
  id: 'bob',
  name: 'Bob',
  type: 'human',
}

const aiAssistant: Worker = {
  id: 'ai-assistant',
  name: 'AI Assistant',
  type: 'agent',
  status: 'available',
  contacts: {
    api: 'https://api.example.com/assistant',
  },
}

const engineering: WorkerTeam = {
  id: 'eng',
  name: 'Engineering',
  members: [alice, bob],
  contacts: {
    slack: '#engineering',
    email: 'eng@example.com',
  },
  lead: alice,
}

describe('ask() - Question Routing Primitive', () => {
  describe('Unit Tests (no AI)', () => {
    it('should be exported from index', () => {
      expect(ask).toBeDefined()
      expect(typeof ask).toBe('function')
    })

    it('should have ai method', () => {
      expect(ask.ai).toBeDefined()
      expect(typeof ask.ai).toBe('function')
    })

    it('should have batch method', () => {
      expect(ask.batch).toBeDefined()
      expect(typeof ask.batch).toBe('function')
    })

    it('should have clarify method', () => {
      expect(ask.clarify).toBeDefined()
      expect(typeof ask.clarify).toBe('function')
    })

    it('should have yesNo method', () => {
      expect(ask.yesNo).toBeDefined()
      expect(typeof ask.yesNo).toBe('function')
    })

    it('should have choose method', () => {
      expect(ask.choose).toBeDefined()
      expect(typeof ask.choose).toBe('function')
    })

    // Basic routing tests (no AI needed, tests channel resolution)
    it('should resolve worker target', async () => {
      const result = await ask(alice, 'What is the status?', {
        via: 'slack',
      })

      expect(result).toBeDefined()
      expect(result.answeredBy).toBeDefined()
      expect(result.answeredBy?.id).toBe('alice')
      expect(result.via).toBe('slack')
    })

    it('should resolve team target to lead', async () => {
      const result = await ask(engineering, 'What is the sprint status?', {
        via: 'slack',
      })

      expect(result).toBeDefined()
      expect(result.answeredBy).toBeDefined()
      // Team should route to lead (alice)
      expect(result.answeredBy?.id).toBe('alice')
    })

    it('should throw for string target without contacts', async () => {
      // String targets don't have contacts configured, so this should throw
      await expect(ask('charlie', 'Hello?')).rejects.toThrow('No valid channel available')
    })

    it('should include timestamp in result', async () => {
      const result = await ask(alice, 'What time is it?', {
        via: 'email',
      })

      expect(result.answeredAt).toBeDefined()
      expect(result.answeredAt).toBeInstanceOf(Date)
    })

    it('should throw error if no channel available', async () => {
      const noChannelWorker: Worker = {
        id: 'no-channel',
        name: 'No Channel',
        type: 'human',
        status: 'available',
        contacts: {},
      }

      await expect(ask(noChannelWorker, 'Hello?')).rejects.toThrow('No valid channel available')
    })
  })

  describe.skipIf(!hasGateway)('Integration Tests (with AI) - ask.ai()', () => {
    it('should answer a simple question', async () => {
      const answer = await ask.ai<string>('What is 2 + 2?')

      expect(answer).toBeDefined()
      expect(typeof answer).toBe('string')
      expect(answer).toContain('4')
    })

    it('should answer with context', async () => {
      const answer = await ask.ai<string>('What is the capital of the country?', {
        country: 'France',
      })

      expect(answer).toBeDefined()
      expect(answer.toLowerCase()).toContain('paris')
    })

    it('should answer with structured schema', async () => {
      const answer = await ask.ai<{ city: string; population: number }>(
        'Give me information about Tokyo',
        undefined,
        {
          city: 'City name',
          population: 'Approximate population in millions (number)',
        }
      )

      expect(answer).toBeDefined()
      expect(typeof answer.city).toBe('string')
      expect(typeof answer.population).toBe('number')
    })

    it('should answer factual questions', async () => {
      const answer = await ask.ai<string>('Who wrote Romeo and Juliet?')

      expect(answer).toBeDefined()
      expect(answer.toLowerCase()).toContain('shakespeare')
    })

    it('should handle complex context', async () => {
      const answer = await ask.ai<{ recommendation: string; reason: string }>(
        'Should I use this database?',
        {
          useCase: 'High-traffic e-commerce',
          requirements: ['ACID compliance', 'Horizontal scaling'],
          options: ['PostgreSQL', 'MongoDB', 'CockroachDB'],
        },
        {
          recommendation: 'The recommended database',
          reason: 'Why this is recommended',
        }
      )

      expect(answer).toBeDefined()
      expect(answer.recommendation).toBeDefined()
      expect(answer.reason).toBeDefined()
    })
  })

  describe('Integration Tests - Channel Selection', () => {
    it('should prefer specified channel', async () => {
      const result = await ask(alice, 'Question?', { via: 'email' })
      expect(result.via).toBe('email')
    })

    it('should fallback to available channel', async () => {
      const slackOnlyWorker: Worker = {
        id: 'slack-only',
        name: 'Slack Only',
        type: 'human',
        status: 'available',
        contacts: {
          slack: '@slackuser',
        },
      }

      const result = await ask(slackOnlyWorker, 'Question?')
      expect(result.via).toBe('slack')
    })

    it('should handle channel array', async () => {
      const result = await ask(alice, 'Question?', {
        via: ['slack', 'email'],
      })

      // Should use first available channel in the array
      expect(result.via).toBe('slack')
    })
  })

  describe('Integration Tests - Batch and Variants', () => {
    it('should ask multiple questions via batch', async () => {
      const results = await ask.batch(alice, ['Question 1?', 'Question 2?', 'Question 3?'], {
        via: 'slack',
      })

      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(results.length).toBe(3)
      results.forEach((result) => {
        expect(result.answeredBy).toBeDefined()
        expect(result.via).toBe('slack')
      })
    })

    it('should ask for clarification', async () => {
      const result = await ask.clarify(alice, 'the deployment process', {
        via: 'slack',
      })

      expect(result).toBeDefined()
      expect(result.answeredBy?.id).toBe('alice')
    })

    it('should ask yes/no question', async () => {
      const result = await ask.yesNo(alice, 'Should we proceed?', {
        via: 'email',
      })

      expect(result).toBeDefined()
      expect(result.via).toBe('email')
    })

    it('should ask choice question', async () => {
      const result = await ask.choose(alice, 'Which color?', ['Red', 'Green', 'Blue'], {
        via: 'slack',
      })

      expect(result).toBeDefined()
      expect(result.answeredBy?.id).toBe('alice')
    })
  })
})
