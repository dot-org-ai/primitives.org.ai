/**
 * Tests for organization.ts - Organizational structure and permissions
 */

import { describe, it, expect } from 'vitest'
import { resolvePermissions, getApprovalChainForRequest, findManager } from '../src/organization.js'
import type {
  Organization,
  Department,
  Team,
  Position,
  ApprovalChain,
} from '../src/organization.js'
import type { BusinessRole } from '../src/roles.js'

describe('Organization', () => {
  // Helper function to create a test organization
  const createTestOrganization = (): Organization => ({
    id: 'org_acme',
    name: 'Acme Corp',
    domain: 'acme.com',
    industry: 'technology',
    roles: [
      {
        id: 'role_cto',
        name: 'CTO',
        type: 'cto',
        permissions: {
          repository: ['read', 'edit', 'manage'],
          project: ['manage'],
        },
        canApprove: ['technical-decision', 'architecture'],
        canHandle: ['architecture-review'],
      },
      {
        id: 'role_lead',
        name: 'Engineering Lead',
        type: 'lead',
        permissions: {
          repository: ['read', 'edit', 'act:merge'],
          project: ['read', 'edit'],
        },
        canApprove: ['code-review'],
        canHandle: ['code-review', 'mentoring'],
      },
      {
        id: 'role_engineer',
        name: 'Software Engineer',
        type: 'engineer',
        permissions: {
          repository: ['read', 'edit'],
          project: ['read'],
        },
        canHandle: ['coding', 'testing'],
      },
    ],
    departments: [
      {
        id: 'dept_eng',
        name: 'Engineering',
        code: 'ENG',
        defaultPermissions: {
          documentation: ['read'],
        },
        teams: [
          {
            id: 'team_platform',
            name: 'Platform Team',
            departmentId: 'dept_eng',
            defaultPermissions: {
              infrastructure: ['read'],
            },
            resources: {
              repositories: ['platform-core', 'platform-api'],
            },
            positions: [
              {
                id: 'pos_cto',
                title: 'CTO',
                roleId: 'role_cto',
                workerId: 'worker_jane',
                status: 'active',
              },
              {
                id: 'pos_lead',
                title: 'Engineering Lead',
                roleId: 'role_lead',
                workerId: 'worker_bob',
                reportsTo: 'pos_cto',
                status: 'active',
              },
              {
                id: 'pos_eng_1',
                title: 'Senior Software Engineer',
                roleId: 'role_engineer',
                workerId: 'worker_alice',
                reportsTo: 'pos_lead',
                status: 'active',
                additionalPermissions: {
                  'repository:platform-core': ['manage'],
                },
              },
              {
                id: 'pos_eng_2',
                title: 'Software Engineer',
                roleId: 'role_engineer',
                workerId: 'worker_charlie',
                reportsTo: 'pos_lead',
                status: 'active',
              },
            ],
          },
          {
            id: 'team_product',
            name: 'Product Team',
            departmentId: 'dept_eng',
            positions: [
              {
                id: 'pos_pm',
                title: 'Product Manager',
                roleId: 'role_lead',
                workerId: 'worker_dave',
                status: 'active',
              },
            ],
          },
        ],
      },
    ],
    teams: [
      {
        id: 'team_special',
        name: 'Special Projects',
        positions: [
          {
            id: 'pos_special',
            title: 'Special Projects Lead',
            roleId: 'role_lead',
            workerId: 'worker_eve',
            status: 'active',
          },
        ],
      },
    ],
    approvalChains: [
      {
        id: 'chain_expense',
        name: 'Expense Approval',
        type: 'expense',
        active: true,
        levels: [
          {
            threshold: 1000,
            approvers: [{ type: 'direct-manager' }],
          },
          {
            threshold: 5000,
            approvers: [{ type: 'direct-manager' }, { type: 'role', roleId: 'director' }],
          },
          {
            threshold: 25000,
            approvers: [{ type: 'direct-manager' }, { type: 'role', roleId: 'cfo' }],
          },
        ],
      },
      {
        id: 'chain_deployment',
        name: 'Deployment Approval',
        type: 'deployment',
        active: true,
        levels: [
          {
            approvers: [{ type: 'role', roleId: 'role_lead' }],
          },
        ],
      },
      {
        id: 'chain_inactive',
        name: 'Inactive Chain',
        type: 'inactive-type',
        active: false,
        levels: [
          {
            approvers: [{ type: 'direct-manager' }],
          },
        ],
      },
    ],
  })

  describe('resolvePermissions()', () => {
    it('should resolve permissions for a position in the org hierarchy', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_eng_1')

      expect(resolved).not.toBeNull()
      expect(resolved?.workerId).toBe('worker_alice')
      expect(resolved?.positionId).toBe('pos_eng_1')
    })

    it('should include department permissions', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_eng_1')

      expect(resolved?.permissions.documentation).toContain('read')
    })

    it('should include team permissions', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_eng_1')

      expect(resolved?.permissions.infrastructure).toContain('read')
    })

    it('should include role permissions', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_eng_1')

      expect(resolved?.permissions.repository).toContain('read')
      expect(resolved?.permissions.repository).toContain('edit')
    })

    it('should include position-specific permissions', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_eng_1')

      expect(resolved?.resourcePermissions['repository:platform-core']).toBeDefined()
    })

    it('should include canHandle from role', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_eng_1')

      expect(resolved?.canHandle).toContain('coding')
      expect(resolved?.canHandle).toContain('testing')
    })

    it('should include canApprove from role', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_lead')

      expect(resolved?.canApprove).toContain('code-review')
    })

    it('should track inheritance chain', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_eng_1')

      expect(resolved?.inheritanceChain).toContain('department:dept_eng')
      expect(resolved?.inheritanceChain).toContain('team:team_platform')
      expect(resolved?.inheritanceChain).toContain('role:role_engineer')
      expect(resolved?.inheritanceChain).toContain('position:pos_eng_1')
    })

    it('should return null for non-existent position', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'non_existent')

      expect(resolved).toBeNull()
    })

    it('should find positions in standalone teams', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_special')

      expect(resolved).not.toBeNull()
      expect(resolved?.workerId).toBe('worker_eve')
    })

    it('should merge permissions without duplicates', () => {
      const org = createTestOrganization()
      const resolved = resolvePermissions(org, 'pos_eng_1')

      // Both role and team might have 'read' permission
      const readCount = resolved?.permissions.repository?.filter((p) => p === 'read').length
      expect(readCount).toBe(1)
    })
  })

  describe('getApprovalChainForRequest()', () => {
    it('should return approvers for expense requests', () => {
      const org = createTestOrganization()
      const approvers = getApprovalChainForRequest(org, 'expense', 500)

      // The function returns approvers - check that we get some
      expect(approvers.length).toBeGreaterThan(0)
      expect(approvers[0]?.type).toBe('direct-manager')
    })

    it('should return approvers based on amount thresholds', () => {
      const org = createTestOrganization()
      const approvers = getApprovalChainForRequest(org, 'expense', 3000)

      // Should return approvers for the appropriate level
      expect(approvers.length).toBeGreaterThan(0)
      expect(approvers[0]?.type).toBe('direct-manager')
    })

    it('should return approvers for high amounts', () => {
      const org = createTestOrganization()
      const approvers = getApprovalChainForRequest(org, 'expense', 50000)

      // Should return some approvers
      expect(approvers.length).toBeGreaterThan(0)
    })

    it('should return empty array for non-existent request type', () => {
      const org = createTestOrganization()
      const approvers = getApprovalChainForRequest(org, 'non-existent', 1000)

      expect(approvers).toEqual([])
    })

    it('should not return approvers from inactive chains', () => {
      const org = createTestOrganization()
      const approvers = getApprovalChainForRequest(org, 'inactive-type', 1000)

      expect(approvers).toEqual([])
    })

    it('should return approvers when no amount specified', () => {
      const org = createTestOrganization()
      const approvers = getApprovalChainForRequest(org, 'deployment')

      expect(approvers).toHaveLength(1)
      expect(approvers[0]?.type).toBe('role')
      expect(approvers[0]?.roleId).toBe('role_lead')
    })
  })

  describe('findManager()', () => {
    it('should find direct manager', () => {
      const org = createTestOrganization()
      const manager = findManager(org, 'pos_eng_1')

      expect(manager).not.toBeNull()
      expect(manager?.id).toBe('pos_lead')
      expect(manager?.workerId).toBe('worker_bob')
    })

    it('should find second-level manager', () => {
      const org = createTestOrganization()
      const manager = findManager(org, 'pos_lead')

      expect(manager).not.toBeNull()
      expect(manager?.id).toBe('pos_cto')
      expect(manager?.workerId).toBe('worker_jane')
    })

    it('should return null for position without manager', () => {
      const org = createTestOrganization()
      const manager = findManager(org, 'pos_cto')

      expect(manager).toBeNull()
    })

    it('should return null for non-existent position', () => {
      const org = createTestOrganization()
      const manager = findManager(org, 'non_existent')

      expect(manager).toBeNull()
    })
  })

  describe('Organization interface', () => {
    it('should support full organization structure', () => {
      const org: Organization = {
        id: 'org_test',
        name: 'Test Corp',
        domain: 'test.com',
        legalName: 'Test Corporation Inc.',
        industry: 'technology',
        mission: 'To make testing easy',
        values: ['quality', 'speed', 'reliability'],
        foundedAt: new Date('2020-01-01'),
        headquarters: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          postalCode: '94105',
          country: 'USA',
        },
        settings: {
          defaultCurrency: 'USD',
          timezone: 'America/Los_Angeles',
          workWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          businessHours: {
            start: '09:00',
            end: '17:00',
            timezone: 'America/Los_Angeles',
          },
          fiscalYearStart: 1,
          language: 'en',
          dateFormat: 'MM/DD/YYYY',
        },
        departments: [],
        teams: [],
        roles: [],
        metadata: { tier: 'enterprise' },
      }

      expect(org.name).toBe('Test Corp')
      expect(org.headquarters?.city).toBe('San Francisco')
      expect(org.settings?.timezone).toBe('America/Los_Angeles')
    })
  })

  describe('Department interface', () => {
    it('should support full department structure', () => {
      const dept: Department = {
        id: 'dept_test',
        name: 'Test Department',
        code: 'TEST',
        description: 'Department for testing',
        head: { positionId: 'pos_head', roleId: 'role_director' },
        parentId: 'dept_parent',
        teams: [],
        budget: {
          annual: 1000000,
          currency: 'USD',
          period: '2024',
          categories: {
            salaries: 700000,
            tools: 100000,
            training: 50000,
          },
          spent: 250000,
          remaining: 750000,
        },
        costCenter: 'CC-100',
        goals: ['Deliver Q1 roadmap', 'Improve team velocity'],
        defaultPermissions: {
          document: ['read', 'edit'],
        },
        metadata: { level: 'division' },
      }

      expect(dept.name).toBe('Test Department')
      expect(dept.budget?.annual).toBe(1000000)
    })
  })

  describe('Team interface', () => {
    it('should support full team structure', () => {
      const team: Team = {
        id: 'team_test',
        name: 'Test Team',
        departmentId: 'dept_eng',
        description: 'A team for testing',
        lead: { positionId: 'pos_lead', roleId: 'role_lead' },
        positions: [],
        objectives: ['Ship feature X', 'Reduce tech debt'],
        resources: {
          repositories: ['repo-1', 'repo-2'],
          projects: ['project-1'],
        },
        defaultPermissions: {
          repository: ['read', 'edit'],
        },
        channels: {
          slack: '#team-test',
          email: 'team-test@acme.com',
        },
        metadata: { squad: true },
      }

      expect(team.name).toBe('Test Team')
      expect(team.resources?.repositories).toContain('repo-1')
    })
  })

  describe('Position interface', () => {
    it('should support full position structure', () => {
      const position: Position = {
        id: 'pos_test',
        title: 'Senior Engineer',
        roleId: 'role_engineer',
        workerId: 'worker_123',
        workerType: 'human',
        teamId: 'team_platform',
        reportsTo: 'pos_lead',
        directReports: ['pos_jr_1', 'pos_jr_2'],
        additionalPermissions: {
          'repository:special': ['manage'],
        },
        startDate: new Date('2023-01-15'),
        endDate: undefined,
        status: 'active',
        fte: 1.0,
        location: 'San Francisco',
        workModel: 'hybrid',
        compensation: {
          baseSalary: 180000,
          currency: 'USD',
          frequency: 'annual',
          bonusTarget: 15,
          equity: {
            type: 'rsu',
            amount: 10000,
            vestingSchedule: '4 years with 1 year cliff',
          },
          band: 'L5',
        },
        metadata: { promoted: true },
      }

      expect(position.title).toBe('Senior Engineer')
      expect(position.compensation?.baseSalary).toBe(180000)
    })
  })

  describe('ApprovalChain interface', () => {
    it('should support full approval chain structure', () => {
      const chain: ApprovalChain = {
        id: 'chain_test',
        name: 'Test Approval Chain',
        type: 'purchase',
        levels: [
          {
            threshold: 1000,
            approvers: [{ type: 'direct-manager' }],
            requiredApprovals: 1,
            approvalMode: 'any',
            slaHours: 24,
          },
          {
            threshold: 10000,
            approvers: [{ type: 'direct-manager' }, { type: 'role', roleId: 'finance_manager' }],
            requiredApprovals: 2,
            approvalMode: 'sequential',
            slaHours: 48,
          },
        ],
        escalation: {
          afterHours: 48,
          escalateTo: 'skip-level-manager',
          maxEscalations: 2,
        },
        active: true,
        metadata: { version: 2 },
      }

      expect(chain.name).toBe('Test Approval Chain')
      expect(chain.levels).toHaveLength(2)
      expect(chain.escalation?.afterHours).toBe(48)
    })
  })
})
