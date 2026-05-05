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
})
