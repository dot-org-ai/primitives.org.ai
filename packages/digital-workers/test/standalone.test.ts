/**
 * Tests for standalone worker functions
 */

import { describe, it, expect } from 'vitest'
import { Team } from '../src/team.js'
import { Role } from '../src/role.js'
import { Goals } from '../src/goals.js'
import { WorkerVerbs } from '../src/types.js'
import type { Worker, WorkerRef } from '../src/types.js'

// Test fixtures
const alice: WorkerRef = {
  id: 'alice',
  name: 'Alice',
  type: 'human',
  role: 'Senior Engineer',
}

const bob: WorkerRef = {
  id: 'bob',
  name: 'Bob',
  type: 'human',
  role: 'Engineer',
}

const codeBot: WorkerRef = {
  id: 'code_bot',
  name: 'Code Reviewer',
  type: 'agent',
  role: 'Code Reviewer',
}

describe('Team', () => {
  it('should create a team', () => {
    const team = Team({
      id: 'eng',
      name: 'Engineering',
      members: [alice, bob],
      contacts: { slack: '#engineering' },
    })

    expect(team.id).toBe('eng')
    expect(team.name).toBe('Engineering')
    expect(team.members).toHaveLength(2)
  })

  it('should support lead', () => {
    const team = Team({
      id: 'eng',
      name: 'Engineering',
      members: [alice, bob],
      contacts: {},
      lead: alice,
    })

    expect(team.lead?.id).toBe('alice')
  })

  it('should support goals', () => {
    const team = Team({
      id: 'eng',
      name: 'Engineering',
      members: [alice],
      contacts: {},
      goals: ['Ship v2.0', 'Reduce tech debt'],
    })

    expect(team.goals).toHaveLength(2)
  })

  describe('Team.addMember', () => {
    it('should add a member', () => {
      const team = Team({
        id: 'eng',
        name: 'Engineering',
        members: [alice],
        contacts: {},
      })

      const updated = Team.addMember(team, bob)

      expect(updated.members).toHaveLength(2)
      expect(updated.members[1]).toBe(bob)
    })
  })

  describe('Team.removeMember', () => {
    it('should remove a member', () => {
      const team = Team({
        id: 'eng',
        name: 'Engineering',
        members: [alice, bob],
        contacts: {},
      })

      const updated = Team.removeMember(team, 'bob')

      expect(updated.members).toHaveLength(1)
      expect(updated.members[0].id).toBe('alice')
    })
  })

  describe('Team.aiMembers', () => {
    it('should filter AI members', () => {
      const team = Team({
        id: 'mixed',
        name: 'Mixed Team',
        members: [alice, bob, codeBot],
        contacts: {},
      })

      const aiMembers = Team.aiMembers(team)

      expect(aiMembers).toHaveLength(1)
      expect(aiMembers[0].id).toBe('code_bot')
    })
  })

  describe('Team.humanMembers', () => {
    it('should filter human members', () => {
      const team = Team({
        id: 'mixed',
        name: 'Mixed Team',
        members: [alice, bob, codeBot],
        contacts: {},
      })

      const humans = Team.humanMembers(team)

      expect(humans).toHaveLength(2)
    })
  })

  describe('Team.byRole', () => {
    it('should filter by role', () => {
      const team = Team({
        id: 'eng',
        name: 'Engineering',
        members: [alice, bob],
        contacts: {},
      })

      const engineers = Team.byRole(team, 'Engineer')

      expect(engineers).toHaveLength(1)
      expect(engineers[0].id).toBe('bob')
    })
  })
})

describe('Role', () => {
  it('should create a role', () => {
    const role = Role({
      name: 'Software Engineer',
      description: 'Builds software',
      responsibilities: ['Write code', 'Review PRs'],
    })

    expect(role.name).toBe('Software Engineer')
    expect(role.responsibilities).toHaveLength(2)
  })

  it('should support skills and permissions', () => {
    const role = Role({
      name: 'Tech Lead',
      description: 'Leads technical decisions',
      responsibilities: ['Architecture', 'Code review'],
      skills: ['System design', 'Mentoring'],
      permissions: ['approve-deploys', 'manage-team'],
    })

    expect(role.skills).toHaveLength(2)
    expect(role.permissions).toHaveLength(2)
  })

  it('should support role type', () => {
    const aiRole = Role({
      name: 'AI Reviewer',
      description: 'Automated code review',
      responsibilities: ['Review PRs'],
      type: 'ai',
    })

    expect(aiRole.type).toBe('ai')
  })
})

describe('Goals', () => {
  it('should create goals', () => {
    const goals = Goals({
      shortTerm: ['Ship feature X', 'Fix critical bugs'],
      longTerm: ['Achieve 100% test coverage'],
    })

    expect(goals.shortTerm).toHaveLength(2)
    expect(goals.longTerm).toHaveLength(1)
  })

  it('should support strategic goals', () => {
    const goals = Goals({
      shortTerm: ['Sprint goals'],
      longTerm: ['Quarterly goals'],
      strategic: ['Annual goals'],
    })

    expect(goals.strategic).toHaveLength(1)
  })

  it('should support metrics', () => {
    const goals = Goals({
      shortTerm: ['Improve velocity'],
      longTerm: ['Scale team'],
      metrics: [
        {
          name: 'Velocity',
          description: 'Story points per sprint',
          current: 42,
          target: 50,
          unit: 'points',
          trend: 'up',
        },
      ],
    })

    expect(goals.metrics).toHaveLength(1)
    expect(goals.metrics?.[0].current).toBe(42)
  })
})

describe('WorkerVerbs', () => {
  it('should have all verb definitions', () => {
    expect(WorkerVerbs.notify).toBeDefined()
    expect(WorkerVerbs.ask).toBeDefined()
    expect(WorkerVerbs.approve).toBeDefined()
    expect(WorkerVerbs.decide).toBeDefined()
    expect(WorkerVerbs.do).toBeDefined()
  })

  describe('notify verb', () => {
    it('should have correct conjugation', () => {
      const verb = WorkerVerbs.notify

      expect(verb.action).toBe('notify')
      expect(verb.actor).toBe('notifier')
      expect(verb.act).toBe('notifies')
      expect(verb.activity).toBe('notifying')
      expect(verb.result).toBe('notification')
      expect(verb.reverse.at).toBe('notifiedAt')
      expect(verb.reverse.by).toBe('notifiedBy')
    })
  })

  describe('ask verb', () => {
    it('should have correct conjugation', () => {
      const verb = WorkerVerbs.ask

      expect(verb.action).toBe('ask')
      expect(verb.actor).toBe('asker')
      expect(verb.activity).toBe('asking')
      expect(verb.result).toBe('question')
    })
  })

  describe('approve verb', () => {
    it('should have correct conjugation', () => {
      const verb = WorkerVerbs.approve

      expect(verb.action).toBe('approve')
      expect(verb.actor).toBe('approver')
      expect(verb.activity).toBe('approving')
      expect(verb.result).toBe('approval')
      expect(verb.inverse).toBe('reject')
    })
  })

  describe('decide verb', () => {
    it('should have correct conjugation', () => {
      const verb = WorkerVerbs.decide

      expect(verb.action).toBe('decide')
      expect(verb.actor).toBe('decider')
      expect(verb.activity).toBe('deciding')
      expect(verb.result).toBe('decision')
    })
  })

  describe('do verb', () => {
    it('should have correct conjugation', () => {
      const verb = WorkerVerbs.do

      expect(verb.action).toBe('do')
      expect(verb.actor).toBe('doer')
      expect(verb.activity).toBe('doing')
      expect(verb.result).toBe('task')
      expect(verb.reverse.at).toBe('doneAt')
    })
  })
})
