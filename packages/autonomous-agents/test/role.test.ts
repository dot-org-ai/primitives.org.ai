/**
 * Tests for Role functionality
 *
 * Covers role creation, predefined roles, and helper functions.
 */

import { describe, it, expect } from 'vitest'
import {
  Role,
  Roles,
  hasPermission,
  hasSkill,
  getPermissions,
  getSkills,
  mergeRoles,
} from '../src/index.js'

describe('Role', () => {
  describe('Role creation', () => {
    it('creates a role with basic config', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['typescript', 'javascript'],
        permissions: ['code.write', 'code.read'],
      })

      expect(role.name).toBe('Developer')
      expect(role.description).toBe('Software developer')
      expect(role.permissions).toEqual(['code.write', 'code.read'])
      expect(role.skills).toEqual(['typescript', 'javascript'])
    })

    it('generates id from name', () => {
      const role = Role({
        name: 'Product Manager',
        description: 'Manages products',
        skills: ['strategy'],
      })

      expect(role.id).toBe('product-manager')
    })

    it('creates a role with minimal config (skills required)', () => {
      const role = Role({
        name: 'Simple',
        description: 'A simple role',
        skills: ['general'],
      })

      expect(role.name).toBe('Simple')
      expect(role.description).toBe('A simple role')
      expect(role.permissions).toBeUndefined()
    })

    it('creates a role with outputs', () => {
      const role = Role({
        name: 'Writer',
        description: 'Content writer',
        skills: ['writing'],
        outputs: ['blog posts', 'documentation'],
      })

      expect(role.outputs).toEqual(['blog posts', 'documentation'])
    })

    it('creates a role with tools', () => {
      const role = Role({
        name: 'Developer',
        description: 'Software developer',
        skills: ['coding'],
        tools: [
          { name: 'runTests', description: 'Run tests', parameters: {}, handler: async () => {} },
        ],
      })

      expect(role.tools).toHaveLength(1)
      expect(role.tools?.[0]?.name).toBe('runTests')
    })
  })

  describe('Predefined Roles', () => {
    it('has ProductManager role', () => {
      const pm = Roles.ProductManager

      expect(pm.name).toBe('Product Manager')
      expect(pm.permissions).toContain('create:feature')
      expect(pm.skills).toContain('product strategy')
    })

    it('has SoftwareEngineer role', () => {
      const engineer = Roles.SoftwareEngineer

      expect(engineer.name).toBe('Software Engineer')
      expect(engineer.permissions).toContain('write:code')
      expect(engineer.skills).toContain('programming')
    })

    it('has Designer role', () => {
      const designer = Roles.Designer

      expect(designer.name).toBe('Designer')
      expect(designer.permissions).toContain('create:design')
      expect(designer.skills).toContain('UI design')
    })

    it('has DataAnalyst role', () => {
      const analyst = Roles.DataAnalyst

      expect(analyst.name).toBe('Data Analyst')
      expect(analyst.permissions).toContain('read:analytics')
      expect(analyst.skills).toContain('data analysis')
    })

    it('has ContentWriter role', () => {
      const writer = Roles.ContentWriter

      expect(writer.name).toBe('Content Writer')
      expect(writer.permissions).toContain('create:content')
      expect(writer.skills).toContain('writing')
    })

    it('has CustomerSupport role', () => {
      const support = Roles.CustomerSupport

      expect(support.name).toBe('Customer Support')
      expect(support.permissions).toContain('read:tickets')
      expect(support.skills).toContain('customer service')
    })

    it('has ProjectManager role', () => {
      const manager = Roles.ProjectManager

      expect(manager.name).toBe('Project Manager')
      expect(manager.permissions).toContain('create:project')
      expect(manager.skills).toContain('project planning')
    })

    it('has QAEngineer role', () => {
      const qa = Roles.QAEngineer

      expect(qa.name).toBe('QA Engineer')
      expect(qa.permissions).toContain('run:tests')
      expect(qa.skills).toContain('manual testing')
    })

    it('has MarketingManager role', () => {
      const marketing = Roles.MarketingManager

      expect(marketing.name).toBe('Marketing Manager')
      expect(marketing.permissions).toContain('create:campaign')
      expect(marketing.skills).toContain('marketing strategy')
    })

    it('has DevOpsEngineer role', () => {
      const devops = Roles.DevOpsEngineer

      expect(devops.name).toBe('DevOps Engineer')
      expect(devops.permissions).toContain('deploy:production')
      expect(devops.skills).toContain('infrastructure management')
    })
  })

  describe('hasPermission', () => {
    it('returns true when role has permission', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['testing'],
        permissions: ['read', 'write', 'admin'],
      })

      expect(hasPermission(role, 'read')).toBe(true)
      expect(hasPermission(role, 'write')).toBe(true)
      expect(hasPermission(role, 'admin')).toBe(true)
    })

    it('returns false when role does not have permission', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['testing'],
        permissions: ['read'],
      })

      expect(hasPermission(role, 'write')).toBe(false)
      expect(hasPermission(role, 'admin')).toBe(false)
    })

    it('returns false when role has no permissions', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['testing'],
      })

      expect(hasPermission(role, 'read')).toBe(false)
    })

    it('handles empty permissions array', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['testing'],
        permissions: [],
      })

      expect(hasPermission(role, 'read')).toBe(false)
    })
  })

  describe('hasSkill', () => {
    it('returns true when role has skill', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['typescript', 'javascript', 'python'],
      })

      expect(hasSkill(role, 'typescript')).toBe(true)
      expect(hasSkill(role, 'javascript')).toBe(true)
      expect(hasSkill(role, 'python')).toBe(true)
    })

    it('returns false when role does not have skill', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['typescript'],
      })

      expect(hasSkill(role, 'rust')).toBe(false)
      expect(hasSkill(role, 'go')).toBe(false)
    })

    it('performs case-insensitive skill matching', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['TypeScript', 'JavaScript'],
      })

      expect(hasSkill(role, 'typescript')).toBe(true)
      expect(hasSkill(role, 'JAVASCRIPT')).toBe(true)
    })

    it('performs partial skill matching', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['software design', 'system architecture'],
      })

      expect(hasSkill(role, 'design')).toBe(true)
      expect(hasSkill(role, 'architecture')).toBe(true)
    })
  })

  describe('getPermissions', () => {
    it('returns all permissions from a role', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['testing'],
        permissions: ['read', 'write', 'admin'],
      })

      expect(getPermissions(role)).toEqual(['read', 'write', 'admin'])
    })

    it('returns empty array when no permissions', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['testing'],
      })

      expect(getPermissions(role)).toEqual([])
    })
  })

  describe('getSkills', () => {
    it('returns all skills from a role', () => {
      const role = Role({
        name: 'Test',
        description: 'Test role',
        skills: ['typescript', 'javascript'],
      })

      expect(getSkills(role)).toEqual(['typescript', 'javascript'])
    })
  })

  describe('mergeRoles', () => {
    it('merges two roles with no overlap', () => {
      const role1 = Role({
        name: 'Role1',
        description: 'First role',
        skills: ['typescript'],
        permissions: ['read'],
      })

      const role2 = Role({
        name: 'Role2',
        description: 'Second role',
        skills: ['javascript'],
        permissions: ['write'],
      })

      const merged = mergeRoles('Combined Role', role1, role2)

      expect(merged.name).toBe('Combined Role')
      expect(merged.permissions).toContain('read')
      expect(merged.permissions).toContain('write')
      expect(merged.skills).toContain('typescript')
      expect(merged.skills).toContain('javascript')
    })

    it('deduplicates permissions and skills', () => {
      const role1 = Role({
        name: 'Role1',
        description: 'First role',
        skills: ['typescript', 'javascript'],
        permissions: ['read', 'write'],
      })

      const role2 = Role({
        name: 'Role2',
        description: 'Second role',
        skills: ['javascript', 'python'],
        permissions: ['write', 'admin'],
      })

      const merged = mergeRoles('Combined', role1, role2)

      expect(merged.permissions).toHaveLength(3)
      expect(merged.skills).toHaveLength(3)
    })

    it('merges roles with empty arrays', () => {
      const role1 = Role({
        name: 'Role1',
        description: 'First role',
        skills: [],
        permissions: [],
      })

      const role2 = Role({
        name: 'Role2',
        description: 'Second role',
        skills: ['typescript'],
        permissions: ['read'],
      })

      const merged = mergeRoles('Combined', role1, role2)

      expect(merged.permissions).toEqual(['read'])
      expect(merged.skills).toEqual(['typescript'])
    })

    it('merges roles with undefined permissions', () => {
      const role1 = Role({
        name: 'Role1',
        description: 'First role',
        skills: ['skill1'],
      })

      const role2 = Role({
        name: 'Role2',
        description: 'Second role',
        skills: ['skill2'],
        permissions: ['read'],
      })

      const merged = mergeRoles('Combined', role1, role2)

      expect(merged.permissions).toEqual(['read'])
      expect(merged.skills).toHaveLength(2)
    })

    it('merges outputs', () => {
      const role1 = Role({
        name: 'Role1',
        description: 'First role',
        skills: ['skill1'],
        outputs: ['output1'],
      })

      const role2 = Role({
        name: 'Role2',
        description: 'Second role',
        skills: ['skill2'],
        outputs: ['output1', 'output2'],
      })

      const merged = mergeRoles('Combined', role1, role2)

      expect(merged.outputs).toContain('output1')
      expect(merged.outputs).toContain('output2')
      // Deduplicated
      expect(merged.outputs).toHaveLength(2)
    })

    it('combines descriptions', () => {
      const role1 = Role({
        name: 'Role1',
        description: 'First description',
        skills: ['skill1'],
      })

      const role2 = Role({
        name: 'Role2',
        description: 'Second description',
        skills: ['skill2'],
      })

      const merged = mergeRoles('Combined', role1, role2)

      expect(merged.description).toContain('First description')
      expect(merged.description).toContain('Second description')
    })
  })
})
