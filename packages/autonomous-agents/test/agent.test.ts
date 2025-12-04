/**
 * Tests for Agent functionality
 *
 * Covers agent creation, state management, and configuration.
 * Note: AI-dependent functions are tested with mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Agent, Role } from '../src/index.js'

// Mock the ai-functions module
vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { result: 'mocked result' },
  }),
}))

describe('Agent', () => {
  describe('Agent creation', () => {
    it('creates an agent with basic config', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(agent.config.name).toBe('TestAgent')
      expect(agent.config.role.name).toBe('Assistant')
    })

    it('creates an agent with goals', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
        goals: [
          { id: 'g1', description: 'Help users', target: '100%' },
          { id: 'g2', description: 'Be accurate', target: '100%' },
        ],
      })

      expect(agent.config.goals).toHaveLength(2)
    })

    it('creates an agent with context', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
        context: { project: 'technical' },
      })

      expect(agent.config.context).toEqual({ project: 'technical' })
    })

    it('creates an agent with default mode (not autonomous)', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(agent.config.mode).toBeUndefined()
    })

    it('creates an agent with autonomous mode', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
        mode: 'autonomous',
      })

      expect(agent.config.mode).toBe('autonomous')
    })

    it('creates an agent with model config', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
        model: 'opus',
      })

      expect(agent.config.model).toBe('opus')
    })
  })

  describe('Agent state management', () => {
    it('sets and gets state', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      agent.setState('task', 'processing')

      expect(agent.getState('task')).toBe('processing')
    })

    it('handles multiple state keys', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      agent.setState('count', 1)
      agent.setState('name', 'test')

      expect(agent.getState('count')).toBe(1)
      expect(agent.getState('name')).toBe('test')
    })

    it('resets agent state', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      agent.setState('data', 'value')
      agent.reset()

      expect(agent.getState('data')).toBeUndefined()
    })

    it('tracks history', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      const history = agent.getHistory()

      expect(Array.isArray(history)).toBe(true)
    })

    it('clears history on reset', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      agent.reset()

      expect(agent.getHistory()).toHaveLength(0)
    })
  })

  describe('Agent methods exist', () => {
    it('has do method', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(typeof agent.do).toBe('function')
    })

    it('has ask method', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(typeof agent.ask).toBe('function')
    })

    it('has decide method', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(typeof agent.decide).toBe('function')
    })

    it('has approve method', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(typeof agent.approve).toBe('function')
    })

    it('has generate method', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(typeof agent.generate).toBe('function')
    })

    it('has is method', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(typeof agent.is).toBe('function')
    })

    it('has notify method', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(typeof agent.notify).toBe('function')
    })
  })

  describe('Agent configuration', () => {
    it('uses role permissions', () => {
      const role = Role({
        name: 'Admin',
        description: 'Administrator',
        skills: ['admin'],
        permissions: ['read', 'write', 'admin'],
      })

      const agent = Agent({
        name: 'AdminAgent',
        role,
      })

      expect(agent.config.role.permissions).toContain('admin')
    })

    it('uses role skills', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript', 'javascript'],
      })

      const agent = Agent({
        name: 'DevAgent',
        role,
      })

      expect(agent.config.role.skills).toContain('typescript')
    })

    it('accepts temperature setting', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
        temperature: 0.5,
      })

      expect(agent.config.temperature).toBe(0.5)
    })

    it('accepts requiresApproval setting', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
        requiresApproval: true,
      })

      expect(agent.config.requiresApproval).toBe(true)
    })
  })

  describe('Agent with initial context', () => {
    it('accepts initial context', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
        context: {
          counter: 0,
          messages: [],
        },
      })

      // Context is used as initial state
      expect(agent.getState('counter')).toBe(0)
      expect(agent.getState('messages')).toEqual([])
    })
  })

  describe('Agent status', () => {
    it('has default idle status', () => {
      const role = Role({
        name: 'Assistant',
        description: 'General assistant',
        skills: ['helping'],
      })

      const agent = Agent({
        name: 'TestAgent',
        role,
      })

      expect(agent.status).toBe('idle')
    })
  })
})

describe('Agent integration scenarios', () => {
  it('creates a product manager agent', () => {
    const role = Role({
      name: 'Product Manager',
      description: 'Manages product development',
      permissions: ['product.strategy', 'requirements.write'],
      skills: ['product-roadmap', 'market-analysis', 'stakeholder-management'],
    })

    const agent = Agent({
      name: 'ProductBot',
      role,
      goals: [
        { id: 'g1', description: 'Understand customer needs', target: '100%' },
        { id: 'g2', description: 'Prioritize features', target: '100%' },
        { id: 'g3', description: 'Communicate with stakeholders', target: '100%' },
      ],
      description: 'Working on a B2B SaaS product',
    })

    expect(agent.config.name).toBe('ProductBot')
    expect(agent.config.role.skills).toContain('market-analysis')
    expect(agent.config.goals).toHaveLength(3)
  })

  it('creates a support agent', () => {
    const role = Role({
      name: 'Support Agent',
      description: 'Handles customer inquiries',
      permissions: ['tickets.read', 'tickets.respond', 'knowledge.search'],
      skills: ['customer-service', 'troubleshooting', 'empathy'],
    })

    const agent = Agent({
      name: 'SupportBot',
      role,
      mode: 'supervised',
      goals: [
        { id: 'g1', description: 'Resolve customer issues quickly', target: '100%' },
      ],
    })

    expect(agent.config.mode).toBe('supervised')
    expect(agent.config.role.permissions).toContain('tickets.respond')
  })

  it('creates an autonomous data processor', () => {
    const role = Role({
      name: 'Data Processor',
      description: 'Processes and analyzes data',
      permissions: ['data.read', 'data.write', 'reports.generate'],
      skills: ['data-analysis', 'etl', 'visualization'],
    })

    const agent = Agent({
      name: 'DataBot',
      role,
      mode: 'autonomous',
      goals: [
        { id: 'g1', description: 'Process incoming data streams', target: '100%' },
      ],
      model: 'sonnet',
      temperature: 0.3,
    })

    expect(agent.config.mode).toBe('autonomous')
    expect(agent.config.temperature).toBe(0.3)
  })
})
