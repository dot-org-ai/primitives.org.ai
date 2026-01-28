/**
 * Tests for roles.ts - Business roles and task assignment
 */

import { describe, it, expect } from 'vitest'
import {
  StandardBusinessRoles,
  createBusinessRole,
  hasPermission,
  canHandleTask,
  canApproveRequest,
  canDelegateTask,
  findRoleForTask,
  createTaskAssignment,
  transitionTaskStatus,
} from '../src/roles.js'
import type {
  BusinessRole,
  TaskRoutingRule,
  TaskAssignment,
  AssigneeRef,
  WorkflowRole,
} from '../src/roles.js'

describe('Roles', () => {
  describe('StandardBusinessRoles', () => {
    it('should have executive roles', () => {
      expect(StandardBusinessRoles.ceo).toBeDefined()
      expect(StandardBusinessRoles.cto).toBeDefined()
      expect(StandardBusinessRoles.cfo).toBeDefined()
    })

    it('should have management roles', () => {
      expect(StandardBusinessRoles.director).toBeDefined()
      expect(StandardBusinessRoles.manager).toBeDefined()
      expect(StandardBusinessRoles.lead).toBeDefined()
    })

    it('should have individual contributor roles', () => {
      expect(StandardBusinessRoles.engineer).toBeDefined()
      expect(StandardBusinessRoles.analyst).toBeDefined()
    })

    it('should have operations roles', () => {
      expect(StandardBusinessRoles.agent).toBeDefined()
      expect(StandardBusinessRoles.assistant).toBeDefined()
    })

    it('CEO should have manage all permissions', () => {
      const ceo = StandardBusinessRoles.ceo
      expect(ceo?.permissions?.['*']).toContain('manage')
    })

    it('CTO should have technology permissions', () => {
      const cto = StandardBusinessRoles.cto
      expect(cto?.permissions?.technology).toContain('manage')
      expect(cto?.permissions?.repository).toContain('manage')
    })

    it('engineer should have repository permissions', () => {
      const engineer = StandardBusinessRoles.engineer
      expect(engineer?.permissions?.repository).toContain('read')
      expect(engineer?.permissions?.repository).toContain('edit')
    })

    it('agent should be AI-first', () => {
      const agent = StandardBusinessRoles.agent
      expect(agent?.workerType).toBe('ai')
    })

    it('assistant should be AI-first', () => {
      const assistant = StandardBusinessRoles.assistant
      expect(assistant?.workerType).toBe('ai')
    })
  })

  describe('createBusinessRole()', () => {
    it('should create role from standard template', () => {
      const role = createBusinessRole('role_cto_jane', 'cto')

      expect(role.id).toBe('role_cto_jane')
      expect(role.name).toBe('Chief Technology Officer')
      expect(role.type).toBe('cto')
      expect(role.level).toBe(10)
    })

    it('should allow overrides', () => {
      const role = createBusinessRole('role_engineer_custom', 'engineer', {
        name: 'Full Stack Engineer',
        level: 4,
        skills: ['TypeScript', 'React', 'Node.js'],
      })

      expect(role.name).toBe('Full Stack Engineer')
      expect(role.level).toBe(4)
      expect(role.skills).toContain('TypeScript')
    })

    it('should throw error for unknown template', () => {
      expect(() =>
        createBusinessRole('role_test', 'unknown_role' as keyof typeof StandardBusinessRoles)
      ).toThrow('Unknown role template: unknown_role')
    })
  })

  describe('hasPermission()', () => {
    const role: BusinessRole = {
      id: 'role_test',
      name: 'Test Role',
      type: 'engineer',
      permissions: {
        repository: ['read', 'edit', 'act:merge'],
        project: ['read'],
        document: ['manage'],
      },
    }

    it('should return true for exact permission match', () => {
      expect(hasPermission(role, 'repository', 'read')).toBe(true)
      expect(hasPermission(role, 'repository', 'edit')).toBe(true)
    })

    it('should return true for action verb permissions', () => {
      expect(hasPermission(role, 'repository', 'act:merge')).toBe(true)
    })

    it('should return true for manage permission (covers all)', () => {
      expect(hasPermission(role, 'document', 'read')).toBe(true)
      expect(hasPermission(role, 'document', 'edit')).toBe(true)
      expect(hasPermission(role, 'document', 'delete')).toBe(true)
    })

    it('should return false for permission not granted', () => {
      expect(hasPermission(role, 'repository', 'delete')).toBe(false)
      expect(hasPermission(role, 'project', 'edit')).toBe(false)
    })

    it('should return false for non-existent resource type', () => {
      expect(hasPermission(role, 'invoice', 'read')).toBe(false)
    })

    it('should return false for role without permissions', () => {
      const emptyRole: BusinessRole = { id: 'empty', name: 'Empty', type: 'engineer' }
      expect(hasPermission(emptyRole, 'repository', 'read')).toBe(false)
    })

    it('should handle wildcard permissions', () => {
      const adminRole: BusinessRole = {
        id: 'admin',
        name: 'Admin',
        type: 'ceo',
        permissions: { '*': ['manage'] },
      }

      expect(hasPermission(adminRole, 'repository', 'read')).toBe(true)
      expect(hasPermission(adminRole, 'anyResource', 'anyAction')).toBe(true)
    })

    it('should handle act:* wildcard', () => {
      const roleWithActWildcard: BusinessRole = {
        id: 'test',
        name: 'Test',
        type: 'lead',
        permissions: {
          repository: ['read', 'act:*'],
        },
      }

      expect(hasPermission(roleWithActWildcard, 'repository', 'act:merge')).toBe(true)
      expect(hasPermission(roleWithActWildcard, 'repository', 'act:deploy')).toBe(true)
    })
  })

  describe('canHandleTask()', () => {
    const role: BusinessRole = {
      id: 'role_test',
      name: 'Test Role',
      type: 'engineer',
      canHandle: ['coding', 'code-review', 'testing'],
    }

    it('should return true for task in canHandle list', () => {
      expect(canHandleTask(role, 'coding')).toBe(true)
      expect(canHandleTask(role, 'code-review')).toBe(true)
    })

    it('should return false for task not in canHandle list', () => {
      expect(canHandleTask(role, 'architecture-review')).toBe(false)
    })

    it('should return false for role without canHandle', () => {
      const emptyRole: BusinessRole = { id: 'empty', name: 'Empty', type: 'engineer' }
      expect(canHandleTask(emptyRole, 'coding')).toBe(false)
    })

    it('should handle wildcard in canHandle', () => {
      const wildcardRole: BusinessRole = {
        id: 'admin',
        name: 'Admin',
        type: 'ceo',
        canHandle: ['*'],
      }

      expect(canHandleTask(wildcardRole, 'anything')).toBe(true)
    })
  })

  describe('canApproveRequest()', () => {
    const role: BusinessRole = {
      id: 'role_test',
      name: 'Test Role',
      type: 'manager',
      canApprove: ['expense-under-5k', 'time-off', 'code-review'],
    }

    it('should return true for request in canApprove list', () => {
      expect(canApproveRequest(role, 'expense-under-5k')).toBe(true)
      expect(canApproveRequest(role, 'time-off')).toBe(true)
    })

    it('should return false for request not in canApprove list', () => {
      expect(canApproveRequest(role, 'hiring')).toBe(false)
    })

    it('should return false for role without canApprove', () => {
      const emptyRole: BusinessRole = { id: 'empty', name: 'Empty', type: 'engineer' }
      expect(canApproveRequest(emptyRole, 'time-off')).toBe(false)
    })

    it('should handle wildcard in canApprove', () => {
      const wildcardRole: BusinessRole = {
        id: 'admin',
        name: 'Admin',
        type: 'ceo',
        canApprove: ['*'],
      }

      expect(canApproveRequest(wildcardRole, 'anything')).toBe(true)
    })
  })

  describe('canDelegateTask()', () => {
    const role: BusinessRole = {
      id: 'role_test',
      name: 'Test Role',
      type: 'lead',
      canDelegate: ['code-review', 'testing'],
    }

    it('should return true for task in canDelegate list', () => {
      expect(canDelegateTask(role, 'code-review')).toBe(true)
      expect(canDelegateTask(role, 'testing')).toBe(true)
    })

    it('should return false for task not in canDelegate list', () => {
      expect(canDelegateTask(role, 'architecture-review')).toBe(false)
    })

    it('should return false for role without canDelegate', () => {
      const emptyRole: BusinessRole = { id: 'empty', name: 'Empty', type: 'engineer' }
      expect(canDelegateTask(emptyRole, 'code-review')).toBe(false)
    })

    it('should handle wildcard in canDelegate', () => {
      const wildcardRole: BusinessRole = {
        id: 'admin',
        name: 'Admin',
        type: 'ceo',
        canDelegate: ['*'],
      }

      expect(canDelegateTask(wildcardRole, 'anything')).toBe(true)
    })
  })

  describe('findRoleForTask()', () => {
    const rules: TaskRoutingRule[] = [
      {
        taskType: 'code-review',
        requiredRole: 'engineer',
        requiredLevel: 2,
        preferWorkerType: 'human',
      },
      {
        taskType: 'expense-approval',
        requiredRole: 'manager',
        amountThreshold: 1000,
      },
      {
        taskType: 'expense-approval',
        requiredRole: 'director',
        escalateAbove: 5000,
        escalateTo: 'director',
      },
      {
        taskType: 'customer-inquiry',
        requiredRole: 'agent',
        preferWorkerType: 'ai',
        fallbackTo: 'human',
      },
    ]

    it('should find matching rule for task type', () => {
      const rule = findRoleForTask('code-review', rules)

      expect(rule).toBeDefined()
      expect(rule?.requiredRole).toBe('engineer')
      expect(rule?.requiredLevel).toBe(2)
    })

    it('should return undefined for non-existent task type', () => {
      const rule = findRoleForTask('non-existent', rules)
      expect(rule).toBeUndefined()
    })

    it('should return first matching rule when multiple exist', () => {
      const rule = findRoleForTask('expense-approval', rules)

      expect(rule).toBeDefined()
      expect(rule?.requiredRole).toBe('manager')
    })

    it('should consider amount for escalation', () => {
      const rule = findRoleForTask('expense-approval', rules, { amount: 10000 })

      // Should escalate to director for amount > 5000
      expect(rule).toBeDefined()
      expect(rule?.requiredRole).toBe('director')
    })
  })

  describe('createTaskAssignment()', () => {
    const assignee: AssigneeRef = {
      type: 'worker',
      id: 'worker_alice',
      name: 'Alice',
    }

    it('should create task assignment with defaults', () => {
      const assignment = createTaskAssignment('task_123', 'code-review', assignee)

      expect(assignment.id).toMatch(/^assign_/)
      expect(assignment.taskId).toBe('task_123')
      expect(assignment.taskType).toBe('code-review')
      expect(assignment.assignee.id).toBe('worker_alice')
      expect(assignment.status).toBe('assigned')
      expect(assignment.priority).toBe('normal')
      expect(assignment.assignedAt).toBeInstanceOf(Date)
    })

    it('should accept options', () => {
      const assignment = createTaskAssignment('task_123', 'code-review', assignee, {
        priority: 'high',
        role: 'role_engineer',
        description: 'Review PR #456',
        context: { pullRequestId: 'pr_456' },
      })

      expect(assignment.priority).toBe('high')
      expect(assignment.role).toBe('role_engineer')
      expect(assignment.description).toBe('Review PR #456')
      expect(assignment.context?.pullRequestId).toBe('pr_456')
    })

    it('should support team assignee', () => {
      const teamAssignee: AssigneeRef = {
        type: 'team',
        id: 'team_platform',
        name: 'Platform Team',
      }

      const assignment = createTaskAssignment('task_123', 'support', teamAssignee)

      expect(assignment.assignee.type).toBe('team')
      expect(assignment.assignee.id).toBe('team_platform')
    })

    it('should support role assignee', () => {
      const roleAssignee: AssigneeRef = {
        type: 'role',
        id: 'role_engineer',
        name: 'Engineer',
      }

      const assignment = createTaskAssignment('task_123', 'support', roleAssignee)

      expect(assignment.assignee.type).toBe('role')
      expect(assignment.assignee.id).toBe('role_engineer')
    })
  })

  describe('transitionTaskStatus()', () => {
    const baseAssignment: TaskAssignment = {
      id: 'assign_123',
      taskId: 'task_123',
      taskType: 'code-review',
      assignee: { type: 'worker', id: 'worker_alice' },
      status: 'assigned',
      assignedAt: new Date('2024-01-01'),
    }

    it('should transition to in_progress', () => {
      const updated = transitionTaskStatus(baseAssignment, 'in_progress')

      expect(updated.status).toBe('in_progress')
      expect(updated.startedAt).toBeInstanceOf(Date)
    })

    it('should transition to completed', () => {
      const inProgress: TaskAssignment = {
        ...baseAssignment,
        status: 'in_progress',
        startedAt: new Date('2024-01-01'),
      }

      const updated = transitionTaskStatus(inProgress, 'completed', {
        result: { approved: true },
        notes: 'LGTM',
      })

      expect(updated.status).toBe('completed')
      expect(updated.completedAt).toBeInstanceOf(Date)
      expect(updated.result).toEqual({ approved: true })
      expect(updated.notes).toBe('LGTM')
    })

    it('should transition to failed', () => {
      const updated = transitionTaskStatus(baseAssignment, 'failed', {
        notes: 'Task failed due to error',
      })

      expect(updated.status).toBe('failed')
      expect(updated.completedAt).toBeInstanceOf(Date)
      expect(updated.notes).toBe('Task failed due to error')
    })

    it('should preserve existing startedAt when completing', () => {
      const inProgress: TaskAssignment = {
        ...baseAssignment,
        status: 'in_progress',
        startedAt: new Date('2024-01-01T10:00:00'),
      }

      const updated = transitionTaskStatus(inProgress, 'completed')

      expect(updated.startedAt?.getTime()).toBe(new Date('2024-01-01T10:00:00').getTime())
    })

    it('should handle blocked status', () => {
      const updated = transitionTaskStatus(baseAssignment, 'blocked', {
        notes: 'Waiting for dependencies',
      })

      expect(updated.status).toBe('blocked')
      expect(updated.notes).toBe('Waiting for dependencies')
    })

    it('should handle cancelled status', () => {
      const updated = transitionTaskStatus(baseAssignment, 'cancelled', {
        notes: 'No longer needed',
      })

      expect(updated.status).toBe('cancelled')
      expect(updated.notes).toBe('No longer needed')
    })
  })

  describe('BusinessRole interface', () => {
    it('should support full business role structure', () => {
      const role: BusinessRole = {
        id: 'role_senior_engineer',
        name: 'Senior Software Engineer',
        type: 'engineer',
        department: 'Engineering',
        description: 'Builds and maintains software systems',
        responsibilities: [
          'Design and implement features',
          'Code review',
          'Mentor junior engineers',
        ],
        skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
        permissions: {
          repository: ['read', 'edit', 'act:merge'],
          project: ['read', 'edit'],
          document: ['read'],
        },
        canHandle: ['coding', 'code-review', 'mentoring'],
        canDelegate: ['testing'],
        canApprove: ['code-review'],
        escalateTo: 'role_lead',
        reportsTo: 'role_lead',
        workerType: 'hybrid',
        level: 4,
        compensationBand: 'L4',
        metadata: { track: 'IC' },
      }

      expect(role.name).toBe('Senior Software Engineer')
      expect(role.skills).toContain('TypeScript')
      expect(role.canHandle).toContain('coding')
    })
  })

  describe('TaskRoutingRule interface', () => {
    it('should support full routing rule structure', () => {
      const rule: TaskRoutingRule = {
        taskType: 'complex-support-ticket',
        requiredRole: 'agent',
        requiredLevel: 2,
        requiredSkills: ['technical-support', 'troubleshooting'],
        requiredPermissions: ['ticket:read', 'ticket:respond'],
        preferWorkerType: 'ai',
        amountThreshold: 1000,
        escalateAbove: 5000,
        escalateTo: 'manager',
        fallbackTo: 'human',
        defaultPriority: 'high',
        slaMinutes: 120,
        conditions: { severity: 'critical' },
      }

      expect(rule.taskType).toBe('complex-support-ticket')
      expect(rule.requiredSkills).toContain('technical-support')
      expect(rule.slaMinutes).toBe(120)
    })
  })

  describe('WorkflowRole interface', () => {
    it('should support full workflow role structure', () => {
      const workflowRole: WorkflowRole = {
        name: 'Approver',
        description: 'Reviews and approves requests',
        canInitiate: false,
        tasks: ['review', 'approve', 'reject'],
        canView: ['details', 'history', 'comments'],
        requiredBusinessRole: 'manager',
        requiredPermissions: ['request:read', 'request:approve'],
        minLevel: 3,
      }

      expect(workflowRole.name).toBe('Approver')
      expect(workflowRole.tasks).toContain('approve')
      expect(workflowRole.minLevel).toBe(3)
    })
  })
})
