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

import { describe, it, expect, vi } from 'vitest'
import { ask } from '../src/index.js'
import type { Worker, WorkerRef, WorkerTeam, WorkerDispatcher, RoleTarget } from '../src/types.js'

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

  // ==========================================================================
  // PRD aip-qozi — Worker Dispatcher Port (Agent / Person / Role / Team)
  // ==========================================================================
  //
  // These tests exercise the unified seam: a Worker target carries a
  // `dispatch` port, and `ask` routes through it instead of channel delivery.
  // The Agent-as-Worker and Person-as-Worker adapters live in Layer 5
  // packages; here we exercise the SEAM contract using minimal in-test
  // dispatchers so the tests do not pull Cloudflare bindings.
  describe('Worker dispatch port (PRD aip-qozi)', () => {
    it('routes through a Worker dispatcher when present (Agent filler)', async () => {
      const dispatcherAsk = vi.fn().mockResolvedValue({ answer: 'agent says yes' })
      const dispatcher: WorkerDispatcher = { ask: dispatcherAsk }
      const agentWorker: Worker = {
        id: 'agent_reviewer',
        name: 'Reviewer Agent',
        type: 'agent',
        status: 'available',
        contacts: {},
        dispatch: dispatcher,
      }

      const result = await ask<string>(agentWorker, 'Is this safe to merge?')

      expect(dispatcherAsk).toHaveBeenCalledOnce()
      expect(dispatcherAsk).toHaveBeenCalledWith(
        expect.objectContaining({ question: 'Is this safe to merge?' })
      )
      expect(result.answer).toBe('agent says yes')
      // No `via` is set when the dispatcher is used — there's no channel.
      expect(result.via).toBeUndefined()
      // answeredBy falls back to the worker ref when the dispatcher omits it.
      expect(result.answeredBy?.id).toBe('agent_reviewer')
      expect(result.answeredBy?.type).toBe('agent')
    })

    it('honours dispatcher-supplied answeredBy (Person filler attributes the resolver)', async () => {
      const dispatcher: WorkerDispatcher = {
        ask: async () => ({
          answer: 'priya says approve',
          answeredBy: { id: 'person_priya', type: 'human', name: 'Priya' },
        }),
      }
      const personWorker: Worker = {
        id: 'person_priya_worker',
        name: 'Priya (Person Worker)',
        type: 'human',
        status: 'available',
        contacts: {},
        dispatch: dispatcher,
      }

      const result = await ask<string>(personWorker, 'Approve the refund?')

      expect(result.answer).toBe('priya says approve')
      expect(result.answeredBy?.id).toBe('person_priya')
      expect(result.answeredBy?.name).toBe('Priya')
    })

    it('forwards schema / context / timeout to the dispatcher input', async () => {
      const dispatcherAsk = vi.fn().mockResolvedValue({ answer: 'ok' })
      const dispatcher: WorkerDispatcher = { ask: dispatcherAsk }
      const worker: Worker = {
        id: 'w',
        name: 'W',
        type: 'agent',
        status: 'available',
        contacts: {},
        dispatch: dispatcher,
      }

      const schema = { answer: 'string', confidence: 'number' }
      const context = { project: 'web' }

      await ask(worker, 'q', { schema, context, timeout: 5000 })

      expect(dispatcherAsk).toHaveBeenCalledWith({
        question: 'q',
        schema,
        context,
        timeout: 5000,
      })
    })

    it('resolves a Role target to its current filler at dispatch time', async () => {
      const dispatcher: WorkerDispatcher = {
        ask: async () => ({ answer: 'CEO says go' }),
      }
      const ceoFiller: Worker = {
        id: 'person_priya',
        name: 'Priya',
        type: 'human',
        status: 'available',
        contacts: {},
        dispatch: dispatcher,
      }

      const resolveWorker = vi.fn().mockResolvedValue(ceoFiller)
      const ceoRole: RoleTarget = {
        $type: 'Role',
        name: 'CEO',
        resolveWorker,
      }

      const result = await ask(ceoRole, 'Should we ship Q1 launch this week?')

      // Role resolver was invoked exactly once at dispatch time.
      expect(resolveWorker).toHaveBeenCalledOnce()
      expect(result.answer).toBe('CEO says go')
      // The resolved filler is the attribution target.
      expect(result.answeredBy?.id).toBe('person_priya')
    })

    it('routes a Team target to its lead through channels (no dispatcher needed)', async () => {
      const lead: Worker = {
        id: 'alice_lead',
        name: 'Alice',
        type: 'human',
        status: 'available',
        contacts: { slack: '@alice' },
      }
      const team: WorkerTeam = {
        id: 'eng',
        name: 'Engineering',
        members: [lead],
        contacts: { slack: '#engineering' },
        lead,
      }

      const result = await ask(team, 'What is the sprint status?', { via: 'slack' })

      // Team without a Worker `dispatch` falls back to channel routing; the
      // lead's WorkerRef becomes the attribution target. This preserves the
      // existing load-balancing/Team semantics from `digital-workers`.
      expect(result.via).toBe('slack')
      expect(result.answeredBy?.id).toBe('alice_lead')
    })

    it('falls back to channel routing when a Worker has no dispatcher', async () => {
      const w: Worker = {
        id: 'no_dispatch',
        name: 'No Dispatch',
        type: 'human',
        status: 'available',
        contacts: { email: 'test@example.com' },
      }
      const result = await ask(w, 'Hello?', { via: 'email' })
      expect(result.via).toBe('email')
      expect(result.answeredBy?.id).toBe('no_dispatch')
    })
  })
})
