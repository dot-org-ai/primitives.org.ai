/**
 * Tests for Team functionality
 *
 * Covers team creation, member management, and helper functions.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  Team,
  Role,
  Agent,
  createTeamMember,
  teamMemberFromAgent,
  calculateTeamCapacity,
  getTeamSkills,
  teamHasSkill,
  findBestMemberForTask,
} from '../src/index.js'
import type { TeamMember } from '../src/index.js'

// Mock the ai-functions module for Agent tests
vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { result: 'mocked result' },
  }),
}))

describe('Team', () => {
  describe('Team creation', () => {
    it('creates a team with basic config', () => {
      const team = Team({
        name: 'Engineering',
        description: 'Engineering team',
      })

      expect(team.name).toBe('Engineering')
      expect(team.description).toBe('Engineering team')
      expect(team.getMembers()).toEqual([])
    })

    it('generates id from name', () => {
      const team = Team({
        name: 'Product Development',
      })

      expect(team.id).toBe('team-product-development')
    })

    it('creates a team with initial members', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const member: TeamMember = {
        id: 'member1',
        name: 'Alice',
        type: 'human',
        role,
        status: 'active',
        availability: 'available',
      }

      const team = Team({
        name: 'Engineering',
        description: 'Engineering team',
        members: [member],
      })

      expect(team.getMembers()).toHaveLength(1)
      expect(team.getMember('member1')?.name).toBe('Alice')
    })

    it('creates a team with goals', () => {
      const team = Team({
        name: 'Engineering',
        goals: [
          { id: 'g1', description: 'Launch feature', target: '100%', status: 'active', priority: 'high' },
        ],
      })

      expect(team.getGoals()).toHaveLength(1)
    })

    it('creates a team with channels', () => {
      const team = Team({
        name: 'Engineering',
        channels: [
          { id: 'slack', type: 'slack', config: { channel: '#eng' } },
        ],
      })

      expect(team.channels).toHaveLength(1)
    })
  })

  describe('Team member management', () => {
    it('adds a member to team', () => {
      const team = Team({
        name: 'Engineering',
      })

      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const member: TeamMember = {
        id: 'member1',
        name: 'Alice',
        type: 'human',
        role,
        status: 'active',
        availability: 'available',
      }

      team.addMember(member)

      expect(team.getMembers()).toHaveLength(1)
      expect(team.getMember('member1')?.name).toBe('Alice')
    })

    it('throws when adding duplicate member', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const member: TeamMember = {
        id: 'member1',
        name: 'Alice',
        type: 'human',
        role,
        status: 'active',
        availability: 'available',
      }

      const team = Team({
        name: 'Engineering',
        members: [member],
      })

      expect(() => team.addMember(member)).toThrow()
    })

    it('removes a member from team', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const member: TeamMember = {
        id: 'member1',
        name: 'Alice',
        type: 'human',
        role,
        status: 'active',
        availability: 'available',
      }

      const team = Team({
        name: 'Engineering',
        members: [member],
      })

      const result = team.removeMember('member1')

      expect(result).toBe(true)
      expect(team.getMembers()).toHaveLength(0)
    })

    it('returns false when removing non-existent member', () => {
      const team = Team({
        name: 'Engineering',
      })

      const result = team.removeMember('nonexistent')

      expect(result).toBe(false)
    })

    it('finds a member by id', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const member: TeamMember = {
        id: 'member1',
        name: 'Alice',
        type: 'human',
        role,
        status: 'active',
        availability: 'available',
      }

      const team = Team({
        name: 'Engineering',
        members: [member],
      })

      const found = team.getMember('member1')

      expect(found?.name).toBe('Alice')
    })

    it('returns undefined for non-existent member', () => {
      const team = Team({
        name: 'Engineering',
      })

      const found = team.getMember('nonexistent')

      expect(found).toBeUndefined()
    })

    it('gets available members', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Alice', type: 'human', role, status: 'active', availability: 'available' },
          { id: '2', name: 'Bob', type: 'human', role, status: 'active', availability: 'busy' },
          { id: '3', name: 'Charlie', type: 'human', role, status: 'inactive', availability: 'available' },
        ],
      })

      const available = team.getAvailableMembers()

      expect(available).toHaveLength(1)
      expect(available[0]?.name).toBe('Alice')
    })

    it('gets members by type', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Alice', type: 'human', role, status: 'active', availability: 'available' },
          { id: '2', name: 'Bot', type: 'agent', role, status: 'active', availability: 'available' },
        ],
      })

      const humans = team.getMembersByType('human')
      const agents = team.getMembersByType('agent')

      expect(humans).toHaveLength(1)
      expect(agents).toHaveLength(1)
    })

    it('gets members by role', () => {
      const devRole = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const designerRole = Role({
        name: 'Designer',
        description: 'Designer',
        skills: ['design'],
      })

      const team = Team({
        name: 'Product',
        members: [
          { id: '1', name: 'Alice', type: 'human', role: devRole, status: 'active', availability: 'available' },
          { id: '2', name: 'Bob', type: 'human', role: designerRole, status: 'active', availability: 'available' },
        ],
      })

      const developers = team.getMembersByRole('developer')

      expect(developers).toHaveLength(1)
      expect(developers[0]?.name).toBe('Alice')
    })

    it('updates a member', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Alice', type: 'human', role, status: 'active', availability: 'available' },
        ],
      })

      team.updateMember('1', { availability: 'busy' })

      expect(team.getMember('1')?.availability).toBe('busy')
    })
  })

  describe('Team goals', () => {
    it('adds a goal', () => {
      const team = Team({ name: 'Engineering' })

      team.addGoal({
        id: 'g1',
        description: 'Launch feature',
        target: '100%',
        status: 'active',
        priority: 'high',
      })

      expect(team.getGoals()).toHaveLength(1)
    })

    it('updates a goal', () => {
      const team = Team({
        name: 'Engineering',
        goals: [
          { id: 'g1', description: 'Launch feature', target: '100%', status: 'active', priority: 'high' },
        ],
      })

      team.updateGoal('g1', { status: 'completed' })

      expect(team.getGoals()[0]?.status).toBe('completed')
    })

    it('removes a goal', () => {
      const team = Team({
        name: 'Engineering',
        goals: [
          { id: 'g1', description: 'Launch feature', target: '100%', status: 'active', priority: 'high' },
        ],
      })

      const result = team.removeGoal('g1')

      expect(result).toBe(true)
      expect(team.getGoals()).toHaveLength(0)
    })
  })

  describe('Team context', () => {
    it('updates context', () => {
      const team = Team({ name: 'Engineering' })

      team.updateContext('sprint', 'Sprint 1')

      expect(team.getContext('sprint')).toBe('Sprint 1')
    })

    it('gets all context', () => {
      const team = Team({
        name: 'Engineering',
        context: { existing: 'value' },
      })

      team.updateContext('new', 'data')

      const context = team.getContext()

      expect(context).toHaveProperty('existing')
      expect(context).toHaveProperty('new')
    })
  })

  describe('createTeamMember', () => {
    it('creates a team member with basic config', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const member = createTeamMember({
        id: 'member1',
        name: 'Alice',
        type: 'human',
        role,
      })

      expect(member.id).toBe('member1')
      expect(member.name).toBe('Alice')
      expect(member.type).toBe('human')
      expect(member.role.name).toBe('Developer')
      expect(member.status).toBe('active')
      expect(member.availability).toBe('available')
    })

    it('creates a team member with custom status', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const member = createTeamMember({
        id: 'member1',
        name: 'Alice',
        type: 'human',
        role,
        status: 'away',
        availability: 'busy',
      })

      expect(member.status).toBe('away')
      expect(member.availability).toBe('busy')
    })
  })

  describe('teamMemberFromAgent', () => {
    it('creates team member from agent', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const agent = Agent({
        name: 'CodeBot',
        role,
      })

      const member = teamMemberFromAgent(agent)

      expect(member.id).toBe('CodeBot')
      expect(member.name).toBe('CodeBot')
      expect(member.type).toBe('agent')
      expect(member.role.name).toBe('Developer')
    })

    it('sets availability based on agent status', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const agent = Agent({
        name: 'CodeBot',
        role,
      })

      const member = teamMemberFromAgent(agent)

      // Idle agent should be available
      expect(member.availability).toBe('available')
    })
  })

  describe('calculateTeamCapacity', () => {
    it('calculates team capacity', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Alice', type: 'human', role, status: 'active', availability: 'available' },
          { id: '2', name: 'Bob', type: 'human', role, status: 'active', availability: 'busy' },
          { id: '3', name: 'Charlie', type: 'human', role, status: 'active', availability: 'offline' },
        ],
      })

      const capacity = calculateTeamCapacity(team)

      expect(capacity.total).toBe(3)
      expect(capacity.available).toBe(1)
      expect(capacity.busy).toBe(1)
      expect(capacity.offline).toBe(1)
    })

    it('returns 0 for empty team', () => {
      const team = Team({
        name: 'Empty',
      })

      const capacity = calculateTeamCapacity(team)

      expect(capacity.total).toBe(0)
      expect(capacity.available).toBe(0)
    })
  })

  describe('getTeamSkills', () => {
    it('returns all unique skills from team', () => {
      const role1 = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript', 'javascript'],
      })

      const role2 = Role({
        name: 'Designer',
        description: 'Designer',
        skills: ['figma', 'css'],
      })

      const team = Team({
        name: 'Product',
        members: [
          { id: '1', name: 'Alice', type: 'human', role: role1, status: 'active', availability: 'available' },
          { id: '2', name: 'Bob', type: 'human', role: role2, status: 'active', availability: 'available' },
        ],
      })

      const skills = getTeamSkills(team)

      expect(skills).toContain('typescript')
      expect(skills).toContain('javascript')
      expect(skills).toContain('figma')
      expect(skills).toContain('css')
    })

    it('deduplicates skills', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript', 'javascript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Alice', type: 'human', role, status: 'active', availability: 'available' },
          { id: '2', name: 'Bob', type: 'human', role, status: 'active', availability: 'available' },
        ],
      })

      const skills = getTeamSkills(team)

      expect(skills).toHaveLength(2)
    })

    it('returns empty array for empty team', () => {
      const team = Team({
        name: 'Empty',
      })

      const skills = getTeamSkills(team)

      expect(skills).toEqual([])
    })
  })

  describe('teamHasSkill', () => {
    it('returns true when team has skill', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript', 'javascript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Alice', type: 'human', role, status: 'active', availability: 'available' },
        ],
      })

      expect(teamHasSkill(team, 'typescript')).toBe(true)
    })

    it('returns false when team does not have skill', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Alice', type: 'human', role, status: 'active', availability: 'available' },
        ],
      })

      expect(teamHasSkill(team, 'rust')).toBe(false)
    })

    it('returns false for empty team', () => {
      const team = Team({
        name: 'Empty',
      })

      expect(teamHasSkill(team, 'typescript')).toBe(false)
    })
  })

  describe('findBestMemberForTask', () => {
    it('finds member with required skill', () => {
      const devRole = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript', 'javascript'],
      })

      const designerRole = Role({
        name: 'Designer',
        description: 'Designer',
        skills: ['figma', 'css'],
      })

      const team = Team({
        name: 'Product',
        members: [
          { id: '1', name: 'Alice', type: 'human', role: devRole, status: 'active', availability: 'available' },
          { id: '2', name: 'Bob', type: 'human', role: designerRole, status: 'active', availability: 'available' },
        ],
      })

      const best = findBestMemberForTask(team, ['typescript'])

      expect(best?.name).toBe('Alice')
    })

    it('returns null when no member has skill', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Alice', type: 'human', role, status: 'active', availability: 'available' },
        ],
      })

      const best = findBestMemberForTask(team, ['rust'])

      expect(best).toBeNull()
    })

    it('returns null for empty team', () => {
      const team = Team({
        name: 'Empty',
      })

      const best = findBestMemberForTask(team, ['typescript'])

      expect(best).toBeNull()
    })

    it('considers only available members', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Alice', type: 'human', role, status: 'active', availability: 'busy' },
          { id: '2', name: 'Bob', type: 'human', role, status: 'active', availability: 'available' },
        ],
      })

      const best = findBestMemberForTask(team, ['typescript'])

      expect(best?.name).toBe('Bob')
    })

    it('picks member with most matching skills', () => {
      const seniorRole = Role({
        name: 'Senior Dev',
        description: 'Senior developer',
        skills: ['typescript', 'javascript', 'react', 'node'],
      })

      const juniorRole = Role({
        name: 'Junior Dev',
        description: 'Junior developer',
        skills: ['javascript'],
      })

      const team = Team({
        name: 'Engineering',
        members: [
          { id: '1', name: 'Junior', type: 'human', role: juniorRole, status: 'active', availability: 'available' },
          { id: '2', name: 'Senior', type: 'human', role: seniorRole, status: 'active', availability: 'available' },
        ],
      })

      const best = findBestMemberForTask(team, ['typescript', 'react'])

      expect(best?.name).toBe('Senior')
    })
  })
})
