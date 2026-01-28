/**
 * Tests for factory functions in org.ai
 *
 * Tests createRole, createTeam from org.ai organizational types
 * and createAgent, createHuman from @org.ai/types foundation types.
 */

import { describe, it, expect } from 'vitest'

import {
  // Organizational factory functions
  createRole,
  createTeam,
  // Foundation factory functions from @org.ai/types
  createAgent,
  createHuman,
  // Type guards for validation
  isRole,
  isTeam,
  isAgent,
  isHuman,
  // Types for type checking
  type Role,
  type Team,
  type TeamMember,
  type TeamLead,
  type Channel,
  type Goal,
  type AgentType,
  type HumanType,
  // Constants
  AGENT_TYPE,
  HUMAN_TYPE,
} from '../src/index.js'

describe('Factory Functions', () => {
  // ==========================================================================
  // createRole Tests
  // ==========================================================================
  describe('createRole', () => {
    it('creates a role with required fields only', () => {
      const role = createRole({
        id: 'role_engineer',
        name: 'Software Engineer',
        description: 'Develops software systems',
        skills: ['TypeScript', 'React'],
      })

      expect(role.id).toBe('role_engineer')
      expect(role.name).toBe('Software Engineer')
      expect(role.description).toBe('Develops software systems')
      expect(role.skills).toEqual(['TypeScript', 'React'])
      expect(isRole(role)).toBe(true)
    })

    it('creates a role with empty skills array', () => {
      const role = createRole({
        id: 'role_minimal',
        name: 'Minimal Role',
        description: 'A role with no skills',
        skills: [],
      })

      expect(role.skills).toEqual([])
      expect(isRole(role)).toBe(true)
    })

    it('creates a role with permissions', () => {
      const role = createRole({
        id: 'role_admin',
        name: 'Admin',
        description: 'Administrator',
        skills: ['management'],
        permissions: ['read', 'write', 'delete', 'admin'],
      })

      expect(role.permissions).toEqual(['read', 'write', 'delete', 'admin'])
    })

    it('creates a role with tools', () => {
      const role = createRole({
        id: 'role_dev',
        name: 'Developer',
        description: 'Developer role',
        skills: ['coding'],
        tools: ['github', 'vscode', 'terminal'],
      })

      expect(role.tools).toEqual(['github', 'vscode', 'terminal'])
    })

    it('creates a role with outputs', () => {
      const role = createRole({
        id: 'role_writer',
        name: 'Writer',
        description: 'Content writer',
        skills: ['writing'],
        outputs: ['blog-posts', 'documentation', 'tutorials'],
      })

      expect(role.outputs).toEqual(['blog-posts', 'documentation', 'tutorials'])
    })

    it('creates a role with business context', () => {
      const role = createRole({
        id: 'role_manager',
        name: 'Engineering Manager',
        description: 'Manages engineering team',
        skills: ['leadership', 'communication'],
        type: 'manager',
        department: 'Engineering',
        responsibilities: ['Team management', 'Project delivery', 'Hiring'],
      })

      expect(role.type).toBe('manager')
      expect(role.department).toBe('Engineering')
      expect(role.responsibilities).toEqual(['Team management', 'Project delivery', 'Hiring'])
    })

    it('creates a role with task capabilities', () => {
      const role = createRole({
        id: 'role_lead',
        name: 'Tech Lead',
        description: 'Technical leadership',
        skills: ['architecture', 'mentoring'],
        canHandle: ['code-review', 'architecture-decisions', 'mentoring'],
        canDelegate: ['bug-fixes', 'documentation'],
        canApprove: ['pull-requests', 'deployments'],
      })

      expect(role.canHandle).toEqual(['code-review', 'architecture-decisions', 'mentoring'])
      expect(role.canDelegate).toEqual(['bug-fixes', 'documentation'])
      expect(role.canApprove).toEqual(['pull-requests', 'deployments'])
    })

    it('creates a role with hierarchy', () => {
      const role = createRole({
        id: 'role_senior',
        name: 'Senior Engineer',
        description: 'Senior software engineer',
        skills: ['TypeScript'],
        escalateTo: 'role_lead',
        reportsTo: 'role_manager',
        level: 4,
      })

      expect(role.escalateTo).toBe('role_lead')
      expect(role.reportsTo).toBe('role_manager')
      expect(role.level).toBe(4)
    })

    it('creates a role with worker type preference', () => {
      const aiRole = createRole({
        id: 'role_bot',
        name: 'Bot',
        description: 'Automated bot',
        skills: ['automation'],
        workerType: 'ai',
      })

      const humanRole = createRole({
        id: 'role_human',
        name: 'Human Operator',
        description: 'Human operator',
        skills: ['judgment'],
        workerType: 'human',
      })

      const hybridRole = createRole({
        id: 'role_hybrid',
        name: 'Hybrid Role',
        description: 'Can be AI or human',
        skills: ['flexibility'],
        workerType: 'hybrid',
      })

      expect(aiRole.workerType).toBe('ai')
      expect(humanRole.workerType).toBe('human')
      expect(hybridRole.workerType).toBe('hybrid')
    })

    it('creates a role with metadata', () => {
      const role = createRole({
        id: 'role_custom',
        name: 'Custom Role',
        description: 'Role with metadata',
        skills: [],
        metadata: {
          team: 'platform',
          costCenter: 'CC-001',
          createdBy: 'admin',
        },
      })

      expect(role.metadata).toEqual({
        team: 'platform',
        costCenter: 'CC-001',
        createdBy: 'admin',
      })
    })

    it('creates a role with all optional fields', () => {
      const role = createRole({
        id: 'role_complete',
        name: 'Complete Role',
        description: 'A role with all fields',
        skills: ['skill1', 'skill2'],
        permissions: ['perm1'],
        tools: ['tool1'],
        outputs: ['output1'],
        type: 'engineer',
        department: 'Engineering',
        responsibilities: ['resp1'],
        canHandle: ['task1'],
        canDelegate: ['task2'],
        canApprove: ['approval1'],
        escalateTo: 'role_manager',
        reportsTo: 'role_cto',
        level: 3,
        workerType: 'hybrid',
        metadata: { key: 'value' },
      })

      expect(isRole(role)).toBe(true)
      expect(role.permissions).toBeDefined()
      expect(role.tools).toBeDefined()
      expect(role.metadata).toBeDefined()
    })

    it('does not add undefined optional fields', () => {
      const role = createRole({
        id: 'role_minimal',
        name: 'Minimal',
        description: 'Minimal role',
        skills: [],
      })

      expect(role.permissions).toBeUndefined()
      expect(role.type).toBeUndefined()
      expect(role.department).toBeUndefined()
      expect(role.level).toBeUndefined()
      expect(role.metadata).toBeUndefined()
    })
  })

  // ==========================================================================
  // createTeam Tests
  // ==========================================================================
  describe('createTeam', () => {
    it('creates a team with required fields only', () => {
      const team = createTeam({
        id: 'team_eng',
        name: 'Engineering',
        members: [],
      })

      expect(team.id).toBe('team_eng')
      expect(team.name).toBe('Engineering')
      expect(team.members).toEqual([])
      expect(isTeam(team)).toBe(true)
    })

    it('creates a team with description', () => {
      const team = createTeam({
        id: 'team_product',
        name: 'Product',
        description: 'Product development team',
        members: [],
      })

      expect(team.description).toBe('Product development team')
    })

    it('creates a team with members', () => {
      const members: TeamMember[] = [
        { id: 'member_1', name: 'Alice', type: 'human', role: 'Engineer' },
        { id: 'member_2', name: 'Bob', type: 'human', role: 'Designer' },
        { id: 'member_3', name: 'Cody', type: 'agent', role: 'Assistant' },
      ]

      const team = createTeam({
        id: 'team_mixed',
        name: 'Mixed Team',
        members,
      })

      expect(team.members).toHaveLength(3)
      expect(team.members[0].name).toBe('Alice')
      expect(team.members[2].type).toBe('agent')
    })

    it('creates a team with lead', () => {
      const lead: TeamLead = {
        id: 'lead_1',
        name: 'Alice',
        type: 'human',
      }

      const team = createTeam({
        id: 'team_with_lead',
        name: 'Team with Lead',
        members: [],
        lead,
      })

      expect(team.lead).toEqual(lead)
    })

    it('creates a team with goals', () => {
      const goals: Goal[] = [
        {
          id: 'goal_1',
          name: 'Ship MVP',
          description: 'Launch MVP',
          target: 100,
          progress: 75,
          status: 'in-progress',
        },
      ]

      const team = createTeam({
        id: 'team_with_goals',
        name: 'Team with Goals',
        members: [],
        goals,
      })

      expect(team.goals).toHaveLength(1)
      expect(team.goals![0].name).toBe('Ship MVP')
    })

    it('creates a team with channels', () => {
      const channels: Channel[] = [
        { id: 'channel_1', type: 'slack', config: { channel: '#engineering' } },
        { id: 'channel_2', type: 'email', config: { address: 'eng@company.com' } },
      ]

      const team = createTeam({
        id: 'team_with_channels',
        name: 'Team with Channels',
        members: [],
        channels,
      })

      expect(team.channels).toHaveLength(2)
      expect(team.channels![0].type).toBe('slack')
    })

    it('creates a team with contacts', () => {
      const team = createTeam({
        id: 'team_with_contacts',
        name: 'Team with Contacts',
        members: [],
        contacts: {
          slack: '#team-channel',
          email: 'team@company.com',
          phone: '+1-555-0123',
        },
      })

      expect(team.contacts?.slack).toBe('#team-channel')
      expect(team.contacts?.email).toBe('team@company.com')
    })

    it('creates a team with context', () => {
      const team = createTeam({
        id: 'team_with_context',
        name: 'Team with Context',
        members: [],
        context: {
          repository: 'acme/platform',
          sprint: 'Q1-2024-W5',
          project: 'main-platform',
        },
      })

      expect(team.context?.repository).toBe('acme/platform')
      expect(team.context?.sprint).toBe('Q1-2024-W5')
    })

    it('creates a team with metadata', () => {
      const team = createTeam({
        id: 'team_with_metadata',
        name: 'Team with Metadata',
        members: [],
        metadata: {
          costCenter: 'CC-001',
          budget: 100000,
          startDate: '2024-01-01',
        },
      })

      expect(team.metadata?.costCenter).toBe('CC-001')
      expect(team.metadata?.budget).toBe(100000)
    })

    it('creates a complete team with all fields', () => {
      const team = createTeam({
        id: 'team_complete',
        name: 'Complete Team',
        description: 'A team with all fields',
        members: [{ id: 'm1', name: 'Member', type: 'human' }],
        lead: { id: 'l1', name: 'Lead', type: 'human' },
        goals: [
          {
            id: 'g1',
            name: 'Goal',
            description: 'Desc',
            target: 100,
            progress: 50,
            status: 'in-progress',
          },
        ],
        channels: [{ id: 'c1', type: 'slack' }],
        contacts: { slack: '#team' },
        context: { key: 'value' },
        metadata: { custom: 'data' },
      })

      expect(isTeam(team)).toBe(true)
      expect(team.description).toBeDefined()
      expect(team.lead).toBeDefined()
      expect(team.goals).toBeDefined()
      expect(team.channels).toBeDefined()
      expect(team.contacts).toBeDefined()
      expect(team.context).toBeDefined()
      expect(team.metadata).toBeDefined()
    })
  })

  // ==========================================================================
  // createAgent Tests
  // ==========================================================================
  describe('createAgent', () => {
    it('creates an agent with required fields', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
      })

      expect(agent.$type).toBe(AGENT_TYPE)
      expect(agent.model).toBe('claude-3-opus')
      expect(agent.autonomous).toBe(true)
      expect(agent.status).toBe('idle')
      expect(agent.$id).toMatch(/^https:\/\/schema\.org\.ai\/agents\//)
      expect(isAgent(agent)).toBe(true)
    })

    it('creates a non-autonomous agent', () => {
      const agent = createAgent({
        model: 'gpt-4',
        autonomous: false,
      })

      expect(agent.autonomous).toBe(false)
    })

    it('creates an agent with name', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
        name: 'ResearchBot',
      })

      expect(agent.name).toBe('ResearchBot')
    })

    it('creates an agent with provider', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
        provider: 'anthropic',
      })

      expect(agent.provider).toBe('anthropic')
    })

    it('creates an agent with system prompt', () => {
      const systemPrompt = 'You are a helpful assistant that specializes in coding.'
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: false,
        systemPrompt,
      })

      expect(agent.systemPrompt).toBe(systemPrompt)
    })

    it('creates an agent with temperature', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
        temperature: 0.7,
      })

      expect(agent.temperature).toBe(0.7)
    })

    it('creates an agent with maxTokens', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
        maxTokens: 4096,
      })

      expect(agent.maxTokens).toBe(4096)
    })

    it('creates an agent with tools', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
        tools: ['web-search', 'code-execution', 'file-read'],
      })

      expect(agent.tools).toEqual(['web-search', 'code-execution', 'file-read'])
    })

    it('creates an agent with capabilities', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
        capabilities: ['text-generation', 'code-analysis', 'reasoning'],
      })

      expect(agent.capabilities).toEqual(['text-generation', 'code-analysis', 'reasoning'])
    })

    it('creates an agent with all optional fields', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
        name: 'FullAgent',
        provider: 'anthropic',
        systemPrompt: 'You are helpful.',
        temperature: 0.5,
        maxTokens: 2000,
        tools: ['tool1'],
        capabilities: ['cap1'],
      })

      expect(agent.name).toBeDefined()
      expect(agent.provider).toBeDefined()
      expect(agent.systemPrompt).toBeDefined()
      expect(agent.temperature).toBeDefined()
      expect(agent.maxTokens).toBeDefined()
      expect(agent.tools).toBeDefined()
      expect(agent.capabilities).toBeDefined()
    })
  })

  // ==========================================================================
  // createHuman Tests
  // ==========================================================================
  describe('createHuman', () => {
    it('creates a human with no options', () => {
      const human = createHuman()

      expect(human.$type).toBe(HUMAN_TYPE)
      expect(human.status).toBe('idle')
      expect(human.$id).toMatch(/^https:\/\/schema\.org\.ai\/humans\//)
      expect(isHuman(human)).toBe(true)
    })

    it('creates a human with name', () => {
      const human = createHuman({ name: 'Alice Smith' })

      expect(human.name).toBe('Alice Smith')
    })

    it('creates a human with email', () => {
      const human = createHuman({ email: 'alice@example.com' })

      expect(human.email).toBe('alice@example.com')
    })

    it('creates a human with role', () => {
      const human = createHuman({ role: 'Senior Engineer' })

      expect(human.role).toBe('Senior Engineer')
    })

    it('creates a human with department', () => {
      const human = createHuman({ department: 'Engineering' })

      expect(human.department).toBe('Engineering')
    })

    it('creates a human with manager reference', () => {
      const human = createHuman({
        name: 'Bob',
        manager: 'https://schema.org.ai/humans/alice',
      })

      expect(human.manager).toBe('https://schema.org.ai/humans/alice')
    })

    it('creates a human with timezone', () => {
      const human = createHuman({ timezone: 'America/New_York' })

      expect(human.timezone).toBe('America/New_York')
    })

    it('creates a human with capabilities', () => {
      const human = createHuman({
        capabilities: ['coding', 'design', 'writing'],
      })

      expect(human.capabilities).toEqual(['coding', 'design', 'writing'])
    })

    it('creates a human with availability', () => {
      const human = createHuman({
        availability: {
          schedule: 'weekdays',
          workingHours: { start: '09:00', end: '17:00' },
        },
      })

      expect(human.availability?.schedule).toBe('weekdays')
      expect(human.availability?.workingHours).toEqual({ start: '09:00', end: '17:00' })
    })

    it('creates a human with all optional fields', () => {
      const human = createHuman({
        name: 'Complete Human',
        email: 'complete@example.com',
        role: 'Manager',
        department: 'Product',
        manager: 'https://schema.org.ai/humans/ceo',
        timezone: 'Europe/London',
        capabilities: ['leadership'],
        availability: {
          schedule: 'flexible',
          workingHours: { start: '10:00', end: '18:00' },
        },
      })

      expect(human.name).toBeDefined()
      expect(human.email).toBeDefined()
      expect(human.role).toBeDefined()
      expect(human.department).toBeDefined()
      expect(human.manager).toBeDefined()
      expect(human.timezone).toBeDefined()
      expect(human.capabilities).toBeDefined()
      expect(human.availability).toBeDefined()
    })
  })
})
