/**
 * Tests for helper functions
 *
 * Comprehensive tests for the convenience helper functions
 * that provide simple interfaces for common human-in-the-loop patterns.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Role, Team, Goals, kpis, okrs, registerHuman, getDefaultHuman } from '../src/helpers.js'
import type { Role as RoleType, Team as TeamType } from '../src/types.js'

describe('Helper Functions', () => {
  describe('Role', () => {
    it('should define and return a role', () => {
      const role: RoleType = Role({
        id: 'tech-lead',
        name: 'Tech Lead',
        description: 'Technical leadership responsibilities',
        capabilities: ['approve-prs', 'deploy-prod'],
      })

      expect(role.id).toBe('tech-lead')
      expect(role.name).toBe('Tech Lead')
      expect(role.capabilities).toContain('approve-prs')
      expect(role.capabilities).toContain('deploy-prod')
    })

    it('should handle role with escalation path', () => {
      const role = Role({
        id: 'junior-dev',
        name: 'Junior Developer',
        capabilities: ['code-review'],
        escalatesTo: 'tech-lead',
      })

      expect(role.escalatesTo).toBe('tech-lead')
    })

    it('should handle role without optional fields', () => {
      const role = Role({
        id: 'developer',
        name: 'Developer',
        capabilities: [],
      })

      expect(role.id).toBe('developer')
      expect(role.description).toBeUndefined()
      expect(role.escalatesTo).toBeUndefined()
    })
  })

  describe('Team', () => {
    it('should define and return a team', () => {
      const team: TeamType = Team({
        id: 'engineering',
        name: 'Engineering Team',
        members: ['alice', 'bob', 'charlie'],
        lead: 'alice',
      })

      expect(team.id).toBe('engineering')
      expect(team.name).toBe('Engineering Team')
      expect(team.members).toHaveLength(3)
      expect(team.lead).toBe('alice')
    })

    it('should handle team with description', () => {
      const team = Team({
        id: 'frontend',
        name: 'Frontend Team',
        description: 'Responsible for UI/UX development',
        members: ['dev1', 'dev2'],
        lead: 'dev1',
      })

      expect(team.description).toBe('Responsible for UI/UX development')
    })

    it('should handle team without optional fields', () => {
      const team = Team({
        id: 'small-team',
        name: 'Small Team',
        members: ['solo'],
      })

      expect(team.lead).toBeUndefined()
      expect(team.description).toBeUndefined()
    })
  })

  describe('Goals', () => {
    it('should define and return goals', () => {
      const goals = Goals({
        id: 'q1-2026',
        objectives: ['Launch v2.0', 'Improve performance by 50%'],
        targetDate: new Date('2026-03-31'),
      })

      expect(goals.id).toBe('q1-2026')
      expect(goals.objectives).toHaveLength(2)
      expect(goals.targetDate).toEqual(new Date('2026-03-31'))
    })

    it('should handle goals with owner', () => {
      const goals = Goals({
        id: 'team-goals',
        objectives: ['Ship feature X'],
        owner: 'alice@example.com',
      })

      expect(goals.owner).toBe('alice@example.com')
    })
  })

  describe('kpis', () => {
    it('should track KPI metrics', () => {
      const kpi = kpis({
        id: 'response-time',
        name: 'API Response Time',
        value: 120,
        target: 100,
        unit: 'ms',
        trend: 'down',
      })

      expect(kpi.id).toBe('response-time')
      expect(kpi.name).toBe('API Response Time')
      expect(kpi.value).toBe(120)
      expect(kpi.target).toBe(100)
      expect(kpi.unit).toBe('ms')
      expect(kpi.trend).toBe('down')
    })

    it('should handle KPI without target', () => {
      const kpi = kpis({
        id: 'active-users',
        name: 'Active Users',
        value: 50000,
        trend: 'up',
      })

      expect(kpi.value).toBe(50000)
      expect(kpi.target).toBeUndefined()
    })
  })

  describe('okrs', () => {
    it('should define OKRs with key results', () => {
      const okr = okrs({
        id: 'q1-okr',
        objective: 'Improve system reliability',
        keyResults: [
          {
            description: 'Achieve 99.9% uptime',
            progress: 0.85,
            current: 99.7,
            target: 99.9,
          },
          {
            description: 'Reduce P1 incidents to <5 per month',
            progress: 0.6,
            current: 8,
            target: 5,
          },
        ],
        period: 'Q1 2026',
      })

      expect(okr.id).toBe('q1-okr')
      expect(okr.objective).toBe('Improve system reliability')
      expect(okr.keyResults).toHaveLength(2)
      expect(okr.period).toBe('Q1 2026')
    })

    it('should handle OKR with owner', () => {
      const okr = okrs({
        id: 'personal-okr',
        objective: 'Develop leadership skills',
        keyResults: [],
        period: '2026',
        owner: 'alice@example.com',
      })

      expect(okr.owner).toBe('alice@example.com')
    })
  })

  describe('registerHuman', () => {
    it('should register a human worker', () => {
      const human = registerHuman({
        id: 'alice',
        name: 'Alice Smith',
        email: 'alice@example.com',
        roles: ['tech-lead', 'developer'],
        teams: ['engineering'],
      })

      expect(human.id).toBe('alice')
      expect(human.name).toBe('Alice Smith')
      expect(human.email).toBe('alice@example.com')
      expect(human.roles).toContain('tech-lead')
      expect(human.teams).toContain('engineering')
    })

    it('should handle human with channels', () => {
      const human = registerHuman({
        id: 'bob',
        name: 'Bob Jones',
        email: 'bob@example.com',
        channels: {
          slack: '@bob',
          email: 'bob@example.com',
        },
      })

      expect(human.channels?.slack).toBe('@bob')
      expect(human.channels?.email).toBe('bob@example.com')
    })

    it('should handle human with minimal fields', () => {
      const human = registerHuman({
        id: 'minimal',
        name: 'Minimal User',
        email: 'minimal@example.com',
      })

      expect(human.id).toBe('minimal')
      expect(human.roles).toBeUndefined()
      expect(human.teams).toBeUndefined()
    })
  })

  describe('getDefaultHuman', () => {
    it('should return the default Human manager instance', () => {
      const human = getDefaultHuman()

      expect(human).toBeDefined()
      expect(typeof human.approve).toBe('function')
      expect(typeof human.ask).toBe('function')
      expect(typeof human.decide).toBe('function')
      expect(typeof human.review).toBe('function')
      expect(typeof human.do).toBe('function')
      expect(typeof human.notify).toBe('function')
    })

    it('should return the same instance on multiple calls', () => {
      const human1 = getDefaultHuman()
      const human2 = getDefaultHuman()

      expect(human1).toBe(human2)
    })

    it('should share state across helper function calls', () => {
      const human = getDefaultHuman()

      // Define a role via helper
      const role = Role({
        id: 'shared-role',
        name: 'Shared Role',
        capabilities: ['test'],
      })

      // Should be retrievable via the manager
      const retrieved = human.getRole('shared-role')
      expect(retrieved).toEqual(role)
    })
  })

  describe('Integration: Role and Human Registration', () => {
    it('should allow registering humans with defined roles', () => {
      // Define roles first
      Role({
        id: 'admin',
        name: 'Administrator',
        capabilities: ['manage-users', 'deploy-prod'],
      })

      Role({
        id: 'viewer',
        name: 'Viewer',
        capabilities: ['read-only'],
      })

      // Register human with those roles
      const human = registerHuman({
        id: 'admin-user',
        name: 'Admin User',
        email: 'admin@example.com',
        roles: ['admin', 'viewer'],
      })

      expect(human.roles).toContain('admin')
      expect(human.roles).toContain('viewer')

      // Roles should be retrievable
      const manager = getDefaultHuman()
      expect(manager.getRole('admin')?.name).toBe('Administrator')
    })
  })

  describe('Integration: Team and Human Registration', () => {
    it('should allow registering humans in defined teams', () => {
      // Define team first
      Team({
        id: 'product',
        name: 'Product Team',
        members: ['pm1', 'pm2'],
        lead: 'pm1',
      })

      // Register human in that team
      const human = registerHuman({
        id: 'pm3',
        name: 'Product Manager 3',
        email: 'pm3@example.com',
        teams: ['product'],
      })

      expect(human.teams).toContain('product')

      // Team should be retrievable
      const manager = getDefaultHuman()
      expect(manager.getTeam('product')?.name).toBe('Product Team')
    })
  })
})
