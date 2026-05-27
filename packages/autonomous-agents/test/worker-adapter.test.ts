/**
 * Tests for the `agentAsWorker` adapter.
 *
 * The adapter is the **adapter port** of `autonomous-agents`: it wraps an
 * `Agent` so it satisfies the `Worker` interface from `digital-workers`,
 * letting kind-agnostic callers consume an agent without knowing it's an
 * agent. SVO co-design step 8 (aip-949e).
 *
 * These tests run in node (not the workers pool) so they don't need
 * Cloudflare bindings — `agentAsWorker` is pure object construction.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Worker } from 'digital-workers'
import { Agent, Role } from '../src/index.js'
import { agentAsWorker } from '../src/worker.js'

vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { result: 'mocked result', reasoning: 'r', needsApproval: false },
  }),
}))

function makeAgent(name = 'TestAgent') {
  const role = Role({
    name: 'Reviewer',
    description: 'reviews things',
    skills: ['review', 'analysis'],
  })
  return Agent({ name, role, mode: 'autonomous' })
}

describe('agentAsWorker', () => {
  it('produces an object that satisfies the Worker interface from digital-workers', () => {
    const agent = makeAgent()
    const worker: Worker = agentAsWorker(agent)

    // Required Worker fields
    expect(worker.id).toBeTypeOf('string')
    expect(worker.id.length).toBeGreaterThan(0)
    expect(worker.name).toBe('TestAgent')
    expect(worker.type).toBe('agent')
    expect(worker.status).toBe('available')
    expect(worker.contacts).toEqual({})
  })

  it('derives a stable id from the agent name when no id is provided', () => {
    const agent = makeAgent('Code Reviewer Pro!')
    const worker = agentAsWorker(agent)
    expect(worker.id).toBe('agent_code-reviewer-pro')
  })

  it('uses the provided id when supplied', () => {
    const worker = agentAsWorker(makeAgent(), { id: 'custom_id_42' })
    expect(worker.id).toBe('custom_id_42')
  })

  it('inherits skills from the agent role by default', () => {
    const worker = agentAsWorker(makeAgent())
    expect(worker.skills).toEqual(['review', 'analysis'])
  })

  it('lets callers override skills', () => {
    const worker = agentAsWorker(makeAgent(), { skills: ['custom'] })
    expect(worker.skills).toEqual(['custom'])
  })

  it('carries identity, contacts, preferences, and metadata when supplied', () => {
    const worker = agentAsWorker(makeAgent(), {
      identity: 'did:web:example.com:agents:reviewer',
      contacts: { email: 'agent@example.com' },
      preferences: { primary: 'email' },
      metadata: { team: 'platform' },
      status: 'busy',
    })

    expect(worker.identity).toBe('did:web:example.com:agents:reviewer')
    expect(worker.contacts).toEqual({ email: 'agent@example.com' })
    expect(worker.preferences).toEqual({ primary: 'email' })
    expect(worker.metadata).toEqual({ team: 'platform' })
    expect(worker.status).toBe('busy')
  })

  it('omits optional fields when not supplied (no undefined leakage)', () => {
    const worker = agentAsWorker(makeAgent())
    expect('identity' in worker).toBe(false)
    expect('preferences' in worker).toBe(false)
    expect('metadata' in worker).toBe(false)
  })

  it('falls back to a non-empty id when the agent name is unslugifiable', () => {
    const agent = makeAgent('!!!')
    const worker = agentAsWorker(agent)
    expect(worker.id.startsWith('agent_')).toBe(true)
    expect(worker.id.length).toBeGreaterThan('agent_'.length)
  })

  // ==========================================================================
  // PRD aip-9l4r — Agent dispatcher approve / notify
  // ==========================================================================

  describe('dispatch.approve (Agent filler)', () => {
    it('is omitted when no approvePolicy is provided (governance default)', () => {
      const worker = agentAsWorker(makeAgent())
      expect(worker.dispatch?.approve).toBeUndefined()
    })

    it('attaches approve when an explicit approvePolicy is supplied', async () => {
      const { generateObject } = await import('ai-functions')
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: { approved: true, notes: 'within $50 refund threshold' },
      } as any)

      const worker = agentAsWorker(makeAgent(), {
        approvePolicy: {
          instructions: 'Approve refunds under $50 only.',
          defaultApproved: false,
        },
      })
      expect(typeof worker.dispatch?.approve).toBe('function')

      const result = await worker.dispatch!.approve!({ request: 'Approve $25 refund' })
      expect(result.approved).toBe(true)
      expect(result.notes).toContain('$50')
      expect(result.approvedBy?.type).toBe('agent')
    })

    it('passes the policy text verbatim as the system prompt', async () => {
      const { generateObject } = await import('ai-functions')
      const spy = vi.mocked(generateObject)
      spy.mockResolvedValueOnce({
        object: { approved: false, notes: 'over threshold' },
      } as any)

      const worker = agentAsWorker(makeAgent(), {
        approvePolicy: {
          instructions: 'POLICY: deny all requests over $100.',
        },
      })

      await worker.dispatch!.approve!({ request: 'Approve $500 expense?' })

      const call = spy.mock.calls[spy.mock.calls.length - 1]?.[0] as {
        system: string
        temperature: number
      }
      expect(call.system).toContain('POLICY: deny all requests over $100.')
      // Deterministic by default.
      expect(call.temperature).toBe(0)
    })

    it('returns defaultApproved=false on LLM failure (fail-closed)', async () => {
      const { generateObject } = await import('ai-functions')
      vi.mocked(generateObject).mockRejectedValueOnce(new Error('rate limit'))

      const worker = agentAsWorker(makeAgent(), {
        approvePolicy: { instructions: 'p', defaultApproved: false },
      })

      const result = await worker.dispatch!.approve!({ request: 'r' })
      expect(result.approved).toBe(false)
      expect(result.notes).toContain('rate limit')
    })

    it('honours defaultApproved=true on LLM failure when configured', async () => {
      const { generateObject } = await import('ai-functions')
      vi.mocked(generateObject).mockRejectedValueOnce(new Error('rate limit'))

      const worker = agentAsWorker(makeAgent(), {
        approvePolicy: { instructions: 'p', defaultApproved: true },
      })

      const result = await worker.dispatch!.approve!({ request: 'r' })
      expect(result.approved).toBe(true)
    })
  })

  describe('dispatch.notify (Agent filler)', () => {
    it('is always attached', () => {
      const worker = agentAsWorker(makeAgent())
      expect(typeof worker.dispatch?.notify).toBe('function')
    })

    it('defaults to a structured console.log and returns sent=true', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const worker = agentAsWorker(makeAgent())

      const result = await worker.dispatch!.notify!({ message: 'deploy done' })
      expect(result.sent).toBe(true)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[autonomous-agents] notify(TestAgent)'),
        'deploy done',
        ''
      )
      logSpy.mockRestore()
    })

    it('invokes a custom notifyHandler with message + agent + options', async () => {
      const handler = vi.fn().mockResolvedValue(undefined)
      const agent = makeAgent('Custom')
      const worker = agentAsWorker(agent, { notifyHandler: handler })

      await worker.dispatch!.notify!({
        message: 'm',
        priority: 'urgent',
        metadata: { foo: 'bar' },
      })
      expect(handler).toHaveBeenCalledOnce()
      const args = handler.mock.calls[0]
      expect(args?.[0]).toBe('m')
      expect(args?.[1].config.name).toBe('Custom')
      expect(args?.[2]).toEqual({ priority: 'urgent', metadata: { foo: 'bar' } })
    })

    it('reports sent=false with notes when notifyHandler throws', async () => {
      const worker = agentAsWorker(makeAgent(), {
        notifyHandler: () => {
          throw new Error('subscriber down')
        },
      })

      const result = await worker.dispatch!.notify!({ message: 'm' })
      expect(result.sent).toBe(false)
      expect(result.notes).toContain('subscriber down')
    })
  })
})
