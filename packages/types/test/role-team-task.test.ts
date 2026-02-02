/**
 * Role, Team, Task Types - TDD Tests for schema.org.ai
 *
 * These tests define the expected interface for Role, Team, and Task types:
 * - Role: Job role definition with skills, permissions, and hierarchy
 * - Team: Team/group with members, channels, and goals
 * - Task: Work item with status, assignment, and dependencies
 *
 * Type hierarchy:
 *   Thing
 *     ├── Role
 *     ├── Team
 *     └── Task
 */

import { describe, it, expect } from 'vitest'

describe('Role Types (schema.org.ai)', () => {
  // ==========================================================================
  // Role Type
  // ==========================================================================
  describe('Role', () => {
    describe('exports', () => {
      it('should export ROLE_TYPE constant', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('ROLE_TYPE')
        expect(module.ROLE_TYPE).toBe('https://schema.org.ai/Role')
      })

      it('should export RoleMarker runtime symbol', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('RoleMarker')
        expect(typeof module.RoleMarker).toBe('symbol')
      })

      it('should export RoleStatus values', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('RoleStatus')
        expect(module.RoleStatus).toContain('active')
        expect(module.RoleStatus).toContain('inactive')
        expect(module.RoleStatus).toContain('deprecated')
      })

      it('should export RoleWorkerTypes values', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('RoleWorkerTypes')
        expect(module.RoleWorkerTypes).toContain('ai')
        expect(module.RoleWorkerTypes).toContain('human')
        expect(module.RoleWorkerTypes).toContain('hybrid')
      })

      it('should export RoleSchema', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('RoleSchema')
      })

      it('should export isRoleType type guard', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('isRoleType')
        expect(typeof module.isRoleType).toBe('function')
      })

      it('should export createRoleType factory', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('createRoleType')
        expect(typeof module.createRoleType).toBe('function')
      })
    })

    describe('RoleSchema validation', () => {
      it('should validate a valid Role object', async () => {
        const { RoleSchema } = await import('../src/index.js')
        const result = RoleSchema.safeParse({
          $id: 'https://example.com/roles/engineer',
          $type: 'https://schema.org.ai/Role',
          name: 'Software Engineer',
          description: 'Builds software systems',
          skills: ['typescript', 'react', 'node'],
        })
        expect(result.success).toBe(true)
      })

      it('should validate Role with all optional fields', async () => {
        const { RoleSchema } = await import('../src/index.js')
        const result = RoleSchema.safeParse({
          $id: 'https://example.com/roles/senior-engineer',
          $type: 'https://schema.org.ai/Role',
          name: 'Senior Engineer',
          description: 'Leads technical initiatives',
          skills: ['typescript', 'architecture'],
          status: 'active',
          permissions: ['deploy', 'review'],
          tools: ['github', 'jira'],
          outputs: ['code', 'documentation'],
          roleType: 'engineer',
          department: 'Engineering',
          responsibilities: ['code review', 'mentoring'],
          canHandle: ['feature-requests', 'bug-fixes'],
          canDelegate: ['testing'],
          canApprove: ['small-prs'],
          escalateTo: 'https://example.com/roles/staff-engineer',
          reportsTo: 'https://example.com/roles/eng-manager',
          level: 3,
          workerType: 'hybrid',
        })
        expect(result.success).toBe(true)
      })

      it('should reject Role without required fields', async () => {
        const { RoleSchema } = await import('../src/index.js')
        // Missing name
        expect(
          RoleSchema.safeParse({
            $id: 'https://example.com/roles/1',
            $type: 'https://schema.org.ai/Role',
            description: 'A role',
            skills: [],
          }).success
        ).toBe(false)
        // Missing skills
        expect(
          RoleSchema.safeParse({
            $id: 'https://example.com/roles/1',
            $type: 'https://schema.org.ai/Role',
            name: 'Engineer',
            description: 'A role',
          }).success
        ).toBe(false)
      })

      it('should reject Role with invalid status', async () => {
        const { RoleSchema } = await import('../src/index.js')
        const result = RoleSchema.safeParse({
          $id: 'https://example.com/roles/1',
          $type: 'https://schema.org.ai/Role',
          name: 'Engineer',
          description: 'A role',
          skills: ['ts'],
          status: 'invalid-status',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('isRoleType type guard', () => {
      it('should return true for valid Role', async () => {
        const { isRoleType } = await import('../src/index.js')
        const role = {
          $id: 'https://example.com/roles/1',
          $type: 'https://schema.org.ai/Role',
          name: 'Engineer',
          description: 'Builds things',
          skills: ['coding'],
        }
        expect(isRoleType(role)).toBe(true)
      })

      it('should return false for invalid data', async () => {
        const { isRoleType } = await import('../src/index.js')
        expect(isRoleType(null)).toBe(false)
        expect(isRoleType(undefined)).toBe(false)
        expect(isRoleType({ name: 'test' })).toBe(false)
        expect(
          isRoleType({
            $id: 'https://example.com/roles/1',
            $type: 'https://schema.org.ai/Wrong',
            name: 'Test',
            description: 'Test',
            skills: [],
          })
        ).toBe(false)
      })
    })

    describe('createRoleType factory', () => {
      it('should create a valid Role with required fields', async () => {
        const { createRoleType, isRoleType } = await import('../src/index.js')
        const role = createRoleType({
          name: 'Engineer',
          description: 'Builds software',
          skills: ['typescript'],
        })
        expect(isRoleType(role)).toBe(true)
        expect(role.name).toBe('Engineer')
        expect(role.$type).toBe('https://schema.org.ai/Role')
      })

      it('should auto-generate $id', async () => {
        const { createRoleType } = await import('../src/index.js')
        const role = createRoleType({
          name: 'Engineer',
          description: 'Builds software',
          skills: [],
        })
        expect(role.$id).toMatch(/^https:\/\/schema\.org\.ai\/roles\//)
      })

      it('should allow custom $id', async () => {
        const { createRoleType } = await import('../src/index.js')
        const role = createRoleType({
          name: 'Engineer',
          description: 'Builds software',
          skills: [],
          $id: 'https://custom.com/role/my-role',
        })
        expect(role.$id).toBe('https://custom.com/role/my-role')
      })
    })
  })
})

describe('Team Types (schema.org.ai)', () => {
  // ==========================================================================
  // Team Type
  // ==========================================================================
  describe('Team', () => {
    describe('exports', () => {
      it('should export TEAM_TYPE constant', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TEAM_TYPE')
        expect(module.TEAM_TYPE).toBe('https://schema.org.ai/Team')
      })

      it('should export TeamMarker runtime symbol', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TeamMarker')
        expect(typeof module.TeamMarker).toBe('symbol')
      })

      it('should export TeamMemberStatus values', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TeamMemberStatus')
        expect(module.TeamMemberStatus).toContain('active')
        expect(module.TeamMemberStatus).toContain('inactive')
        expect(module.TeamMemberStatus).toContain('pending')
      })

      it('should export TeamMemberAvailability values', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TeamMemberAvailability')
        expect(module.TeamMemberAvailability).toContain('available')
        expect(module.TeamMemberAvailability).toContain('busy')
        expect(module.TeamMemberAvailability).toContain('away')
        expect(module.TeamMemberAvailability).toContain('offline')
      })

      it('should export TeamMemberTypes values', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TeamMemberTypes')
        expect(module.TeamMemberTypes).toContain('human')
        expect(module.TeamMemberTypes).toContain('agent')
      })

      it('should export TeamSchema', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TeamSchema')
      })

      it('should export isTeamType type guard', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('isTeamType')
        expect(typeof module.isTeamType).toBe('function')
      })

      it('should export createTeamType factory', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('createTeamType')
        expect(typeof module.createTeamType).toBe('function')
      })
    })

    describe('TeamSchema validation', () => {
      it('should validate a valid Team object', async () => {
        const { TeamSchema } = await import('../src/index.js')
        const result = TeamSchema.safeParse({
          $id: 'https://example.com/teams/engineering',
          $type: 'https://schema.org.ai/Team',
          name: 'Engineering',
          members: [{ id: 'u1', name: 'Alice', type: 'human' }],
        })
        expect(result.success).toBe(true)
      })

      it('should validate Team with all optional fields', async () => {
        const { TeamSchema } = await import('../src/index.js')
        const result = TeamSchema.safeParse({
          $id: 'https://example.com/teams/engineering',
          $type: 'https://schema.org.ai/Team',
          name: 'Engineering',
          description: 'The engineering team',
          members: [
            {
              id: 'u1',
              name: 'Alice',
              type: 'human',
              role: 'Lead',
              status: 'active',
              availability: 'available',
            },
            { id: 'a1', name: 'Bot', type: 'agent', status: 'active' },
          ],
          lead: { id: 'u1', name: 'Alice', type: 'human' },
          goals: ['https://example.com/goals/1'],
          channels: [{ id: 'c1', type: 'slack', config: { channel: '#eng' } }],
          contacts: { email: 'eng@example.com', slack: '#engineering' },
          context: { focus: 'backend' },
        })
        expect(result.success).toBe(true)
      })

      it('should reject Team without required fields', async () => {
        const { TeamSchema } = await import('../src/index.js')
        // Missing members
        expect(
          TeamSchema.safeParse({
            $id: 'https://example.com/teams/1',
            $type: 'https://schema.org.ai/Team',
            name: 'Team',
          }).success
        ).toBe(false)
        // Missing name
        expect(
          TeamSchema.safeParse({
            $id: 'https://example.com/teams/1',
            $type: 'https://schema.org.ai/Team',
            members: [],
          }).success
        ).toBe(false)
      })

      it('should reject Team member with invalid type', async () => {
        const { TeamSchema } = await import('../src/index.js')
        const result = TeamSchema.safeParse({
          $id: 'https://example.com/teams/1',
          $type: 'https://schema.org.ai/Team',
          name: 'Team',
          members: [{ id: 'u1', name: 'User', type: 'robot' }],
        })
        expect(result.success).toBe(false)
      })
    })

    describe('isTeamType type guard', () => {
      it('should return true for valid Team', async () => {
        const { isTeamType } = await import('../src/index.js')
        const team = {
          $id: 'https://example.com/teams/1',
          $type: 'https://schema.org.ai/Team',
          name: 'Engineering',
          members: [],
        }
        expect(isTeamType(team)).toBe(true)
      })

      it('should return false for invalid data', async () => {
        const { isTeamType } = await import('../src/index.js')
        expect(isTeamType(null)).toBe(false)
        expect(isTeamType(undefined)).toBe(false)
        expect(isTeamType({ name: 'test' })).toBe(false)
        expect(
          isTeamType({
            $id: 'https://example.com/teams/1',
            $type: 'https://schema.org.ai/Wrong',
            name: 'Test',
            members: [],
          })
        ).toBe(false)
      })
    })

    describe('createTeamType factory', () => {
      it('should create a valid Team with required fields', async () => {
        const { createTeamType, isTeamType } = await import('../src/index.js')
        const team = createTeamType({
          name: 'Engineering',
          members: [{ id: 'u1', name: 'Alice', type: 'human' }],
        })
        expect(isTeamType(team)).toBe(true)
        expect(team.name).toBe('Engineering')
        expect(team.$type).toBe('https://schema.org.ai/Team')
      })

      it('should auto-generate $id', async () => {
        const { createTeamType } = await import('../src/index.js')
        const team = createTeamType({
          name: 'Engineering',
          members: [],
        })
        expect(team.$id).toMatch(/^https:\/\/schema\.org\.ai\/teams\//)
      })

      it('should allow custom $id', async () => {
        const { createTeamType } = await import('../src/index.js')
        const team = createTeamType({
          name: 'Engineering',
          members: [],
          $id: 'https://custom.com/team/my-team',
        })
        expect(team.$id).toBe('https://custom.com/team/my-team')
      })
    })
  })
})

describe('Task Types (schema.org.ai)', () => {
  // ==========================================================================
  // Task Type
  // ==========================================================================
  describe('Task', () => {
    describe('exports', () => {
      it('should export TASK_TYPE constant', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TASK_TYPE')
        expect(module.TASK_TYPE).toBe('https://schema.org.ai/Task')
      })

      it('should export TaskMarker runtime symbol', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TaskMarker')
        expect(typeof module.TaskMarker).toBe('symbol')
      })

      it('should export TaskStatus values', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TaskStatus')
        expect(module.TaskStatus).toContain('pending')
        expect(module.TaskStatus).toContain('assigned')
        expect(module.TaskStatus).toContain('in_progress')
        expect(module.TaskStatus).toContain('blocked')
        expect(module.TaskStatus).toContain('completed')
        expect(module.TaskStatus).toContain('cancelled')
        expect(module.TaskStatus).toContain('failed')
      })

      it('should export TaskPriority values', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TaskPriority')
        expect(module.TaskPriority).toContain('low')
        expect(module.TaskPriority).toContain('normal')
        expect(module.TaskPriority).toContain('high')
        expect(module.TaskPriority).toContain('urgent')
        expect(module.TaskPriority).toContain('critical')
      })

      it('should export TaskSchema', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('TaskSchema')
      })

      it('should export isTaskType type guard', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('isTaskType')
        expect(typeof module.isTaskType).toBe('function')
      })

      it('should export createTaskType factory', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('createTaskType')
        expect(typeof module.createTaskType).toBe('function')
      })
    })

    describe('TaskSchema validation', () => {
      it('should validate a valid Task object', async () => {
        const { TaskSchema } = await import('../src/index.js')
        const result = TaskSchema.safeParse({
          $id: 'https://example.com/tasks/1',
          $type: 'https://schema.org.ai/Task',
          name: 'Implement feature X',
          status: 'pending',
        })
        expect(result.success).toBe(true)
      })

      it('should validate Task with all optional fields', async () => {
        const { TaskSchema } = await import('../src/index.js')
        const result = TaskSchema.safeParse({
          $id: 'https://example.com/tasks/1',
          $type: 'https://schema.org.ai/Task',
          name: 'Implement feature X',
          description: 'Build the new dashboard',
          status: 'in_progress',
          priority: 'high',
          assignee: 'https://example.com/workers/alice',
          createdBy: 'https://example.com/workers/bob',
          parentTask: 'https://example.com/tasks/epic-1',
          subtasks: ['https://example.com/tasks/2', 'https://example.com/tasks/3'],
          blockedBy: ['https://example.com/tasks/4'],
          blocks: ['https://example.com/tasks/5'],
          team: 'https://example.com/teams/eng',
          requiredSkills: ['typescript', 'react'],
          requiredTools: ['github', 'figma'],
          estimatedDuration: 480,
          dueDate: new Date('2024-03-01'),
          startedAt: new Date('2024-02-15'),
          input: { requirements: 'spec-v1' },
          tags: ['frontend', 'feature'],
        })
        expect(result.success).toBe(true)
      })

      it('should reject Task without required fields', async () => {
        const { TaskSchema } = await import('../src/index.js')
        // Missing status
        expect(
          TaskSchema.safeParse({
            $id: 'https://example.com/tasks/1',
            $type: 'https://schema.org.ai/Task',
            name: 'Task',
          }).success
        ).toBe(false)
        // Missing name
        expect(
          TaskSchema.safeParse({
            $id: 'https://example.com/tasks/1',
            $type: 'https://schema.org.ai/Task',
            status: 'pending',
          }).success
        ).toBe(false)
      })

      it('should reject Task with invalid status', async () => {
        const { TaskSchema } = await import('../src/index.js')
        const result = TaskSchema.safeParse({
          $id: 'https://example.com/tasks/1',
          $type: 'https://schema.org.ai/Task',
          name: 'Task',
          status: 'invalid-status',
        })
        expect(result.success).toBe(false)
      })

      it('should reject Task with invalid priority', async () => {
        const { TaskSchema } = await import('../src/index.js')
        const result = TaskSchema.safeParse({
          $id: 'https://example.com/tasks/1',
          $type: 'https://schema.org.ai/Task',
          name: 'Task',
          status: 'pending',
          priority: 'invalid-priority',
        })
        expect(result.success).toBe(false)
      })
    })

    describe('isTaskType type guard', () => {
      it('should return true for valid Task', async () => {
        const { isTaskType } = await import('../src/index.js')
        const task = {
          $id: 'https://example.com/tasks/1',
          $type: 'https://schema.org.ai/Task',
          name: 'Do something',
          status: 'pending',
        }
        expect(isTaskType(task)).toBe(true)
      })

      it('should return true for all valid statuses', async () => {
        const { isTaskType, TaskStatus } = await import('../src/index.js')
        for (const status of TaskStatus) {
          const task = {
            $id: 'https://example.com/tasks/1',
            $type: 'https://schema.org.ai/Task',
            name: 'Task',
            status,
          }
          expect(isTaskType(task)).toBe(true)
        }
      })

      it('should return false for invalid data', async () => {
        const { isTaskType } = await import('../src/index.js')
        expect(isTaskType(null)).toBe(false)
        expect(isTaskType(undefined)).toBe(false)
        expect(isTaskType({ name: 'test' })).toBe(false)
        expect(
          isTaskType({
            $id: 'https://example.com/tasks/1',
            $type: 'https://schema.org.ai/Wrong',
            name: 'Test',
            status: 'pending',
          })
        ).toBe(false)
        expect(
          isTaskType({
            $id: 'https://example.com/tasks/1',
            $type: 'https://schema.org.ai/Task',
            name: 'Test',
            status: 'invalid',
          })
        ).toBe(false)
      })
    })

    describe('createTaskType factory', () => {
      it('should create a valid Task with required fields', async () => {
        const { createTaskType, isTaskType } = await import('../src/index.js')
        const task = createTaskType({
          name: 'Build feature',
          status: 'pending',
        })
        expect(isTaskType(task)).toBe(true)
        expect(task.name).toBe('Build feature')
        expect(task.status).toBe('pending')
        expect(task.$type).toBe('https://schema.org.ai/Task')
      })

      it('should auto-generate $id', async () => {
        const { createTaskType } = await import('../src/index.js')
        const task = createTaskType({
          name: 'Task',
          status: 'pending',
        })
        expect(task.$id).toMatch(/^https:\/\/schema\.org\.ai\/tasks\//)
      })

      it('should allow custom $id', async () => {
        const { createTaskType } = await import('../src/index.js')
        const task = createTaskType({
          name: 'Task',
          status: 'pending',
          $id: 'https://custom.com/task/my-task',
        })
        expect(task.$id).toBe('https://custom.com/task/my-task')
      })

      it('should set optional fields', async () => {
        const { createTaskType } = await import('../src/index.js')
        const task = createTaskType({
          name: 'Task',
          status: 'assigned',
          priority: 'high',
          assignee: 'https://example.com/workers/1',
          tags: ['important'],
        })
        expect(task.priority).toBe('high')
        expect(task.assignee).toBe('https://example.com/workers/1')
        expect(task.tags).toEqual(['important'])
      })
    })
  })
})

describe('Integration between Role, Team, Task', () => {
  it('should allow Task to reference Team', async () => {
    const { createTaskType, createTeamType } = await import('../src/index.js')
    const team = createTeamType({
      name: 'Engineering',
      members: [{ id: 'u1', name: 'Alice', type: 'human' }],
    })
    const task = createTaskType({
      name: 'Build feature',
      status: 'pending',
      team: team.$id,
    })
    expect(task.team).toBe(team.$id)
  })

  it('should allow Team member to have a role', async () => {
    const { createTeamType, createRoleType } = await import('../src/index.js')
    const role = createRoleType({
      name: 'Lead Engineer',
      description: 'Leads engineering',
      skills: ['leadership'],
    })
    const team = createTeamType({
      name: 'Engineering',
      members: [{ id: 'u1', name: 'Alice', type: 'human', role: role.name }],
    })
    expect(team.members[0].role).toBe('Lead Engineer')
  })

  it('should allow Task to specify required skills from Role', async () => {
    const { createTaskType, createRoleType } = await import('../src/index.js')
    const role = createRoleType({
      name: 'Frontend Engineer',
      description: 'Builds UI',
      skills: ['react', 'typescript', 'css'],
    })
    const task = createTaskType({
      name: 'Build dashboard',
      status: 'pending',
      requiredSkills: role.skills,
    })
    expect(task.requiredSkills).toEqual(['react', 'typescript', 'css'])
  })
})
