/**
 * Tests for business.ts - Business entity definition and management
 */

import { describe, it, expect } from 'vitest'
import {
  Business,
  getTotalBudget,
  getTotalTeamSize,
  getDepartment,
  getTeam,
  validateBusiness,
} from './business.js'
import type { BusinessDefinition } from './types.js'

describe('Business', () => {
  describe('Business()', () => {
    it('should create a business entity with required fields', () => {
      const business = Business({
        name: 'Acme Corp',
      })

      expect(business.name).toBe('Acme Corp')
      expect(business.values).toEqual([])
      expect(business.teamSize).toBe(0)
      expect(business.metadata).toEqual({})
      expect(business.foundedAt).toBeInstanceOf(Date)
    })

    it('should create a business entity with all fields', () => {
      const foundedDate = new Date('2020-01-01')
      const business = Business({
        name: 'Test Corp',
        description: 'A test company',
        industry: 'Technology',
        mission: 'To innovate',
        values: ['Innovation', 'Integrity'],
        targetMarket: 'Enterprise',
        foundedAt: foundedDate,
        teamSize: 50,
        structure: {
          departments: [
            {
              name: 'Engineering',
              head: 'Jane Smith',
              members: ['Alice', 'Bob'],
              budget: 1000000,
            },
          ],
        },
        metadata: { customField: 'value' },
      })

      expect(business.name).toBe('Test Corp')
      expect(business.description).toBe('A test company')
      expect(business.industry).toBe('Technology')
      expect(business.mission).toBe('To innovate')
      expect(business.values).toEqual(['Innovation', 'Integrity'])
      expect(business.targetMarket).toBe('Enterprise')
      expect(business.foundedAt).toBe(foundedDate)
      expect(business.teamSize).toBe(50)
      expect(business.structure?.departments).toHaveLength(1)
      expect(business.metadata).toEqual({ customField: 'value' })
    })

    it('should throw error if name is empty', () => {
      expect(() => Business({ name: '' })).toThrow('Business name is required')
    })

    it('should preserve provided values and not override with defaults', () => {
      const business = Business({
        name: 'Test',
        values: ['Custom'],
        teamSize: 100,
      })

      expect(business.values).toEqual(['Custom'])
      expect(business.teamSize).toBe(100)
    })
  })

  describe('getTotalBudget()', () => {
    it('should return 0 if no departments', () => {
      const business = Business({ name: 'Test' })
      expect(getTotalBudget(business)).toBe(0)
    })

    it('should return 0 if structure has no departments', () => {
      const business = Business({
        name: 'Test',
        structure: {},
      })
      expect(getTotalBudget(business)).toBe(0)
    })

    it('should calculate total budget across departments', () => {
      const business = Business({
        name: 'Test',
        structure: {
          departments: [
            { name: 'Engineering', budget: 1000000 },
            { name: 'Sales', budget: 500000 },
            { name: 'HR' }, // No budget specified
          ],
        },
      })

      expect(getTotalBudget(business)).toBe(1500000)
    })

    it('should handle departments with zero budget', () => {
      const business = Business({
        name: 'Test',
        structure: {
          departments: [
            { name: 'Engineering', budget: 1000000 },
            { name: 'Sales', budget: 0 },
          ],
        },
      })

      expect(getTotalBudget(business)).toBe(1000000)
    })
  })

  describe('getTotalTeamSize()', () => {
    it('should return teamSize if no departments', () => {
      const business = Business({ name: 'Test', teamSize: 50 })
      expect(getTotalTeamSize(business)).toBe(50)
    })

    it('should return 0 if no teamSize and no departments', () => {
      const business = Business({ name: 'Test' })
      expect(getTotalTeamSize(business)).toBe(0)
    })

    it('should calculate total team size from department members', () => {
      const business = Business({
        name: 'Test',
        structure: {
          departments: [
            { name: 'Engineering', members: ['Alice', 'Bob', 'Charlie'] },
            { name: 'Sales', members: ['David', 'Eve'] },
            { name: 'HR' }, // No members
          ],
        },
      })

      expect(getTotalTeamSize(business)).toBe(5)
    })
  })

  describe('getDepartment()', () => {
    const business = Business({
      name: 'Test',
      structure: {
        departments: [
          { name: 'Engineering', head: 'Jane' },
          { name: 'Sales', head: 'John' },
        ],
      },
    })

    it('should find department by name', () => {
      const dept = getDepartment(business, 'Engineering')
      expect(dept?.name).toBe('Engineering')
      expect(dept?.head).toBe('Jane')
    })

    it('should return undefined for non-existent department', () => {
      const dept = getDepartment(business, 'Marketing')
      expect(dept).toBeUndefined()
    })

    it('should return undefined if no structure', () => {
      const simpleBusiness = Business({ name: 'Simple' })
      const dept = getDepartment(simpleBusiness, 'Engineering')
      expect(dept).toBeUndefined()
    })
  })

  describe('getTeam()', () => {
    const business = Business({
      name: 'Test',
      structure: {
        teams: [
          { name: 'Alpha', lead: 'Alice' },
          { name: 'Beta', lead: 'Bob' },
        ],
      },
    })

    it('should find team by name', () => {
      const team = getTeam(business, 'Alpha')
      expect(team?.name).toBe('Alpha')
      expect(team?.lead).toBe('Alice')
    })

    it('should return undefined for non-existent team', () => {
      const team = getTeam(business, 'Gamma')
      expect(team).toBeUndefined()
    })

    it('should return undefined if no structure', () => {
      const simpleBusiness = Business({ name: 'Simple' })
      const team = getTeam(simpleBusiness, 'Alpha')
      expect(team).toBeUndefined()
    })
  })

  describe('validateBusiness()', () => {
    it('should validate valid business', () => {
      const business = Business({
        name: 'Valid Corp',
        teamSize: 50,
      })

      const result = validateBusiness(business)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation if name is missing', () => {
      const business: BusinessDefinition = { name: '' }
      const result = validateBusiness(business)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Business name is required')
    })

    it('should fail validation if teamSize is negative', () => {
      const business: BusinessDefinition = { name: 'Test', teamSize: -5 }
      const result = validateBusiness(business)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Team size cannot be negative')
    })

    it('should fail validation if department has no name', () => {
      const business: BusinessDefinition = {
        name: 'Test',
        structure: {
          departments: [{ name: '', budget: 1000 }],
        },
      }
      const result = validateBusiness(business)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Department name is required')
    })

    it('should fail validation if department budget is negative', () => {
      const business: BusinessDefinition = {
        name: 'Test',
        structure: {
          departments: [{ name: 'Engineering', budget: -1000 }],
        },
      }
      const result = validateBusiness(business)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Department Engineering budget cannot be negative')
    })

    it('should return multiple errors for multiple issues', () => {
      const business: BusinessDefinition = {
        name: '',
        teamSize: -5,
        structure: {
          departments: [
            { name: '', budget: 1000 },
            { name: 'Sales', budget: -500 },
          ],
        },
      }
      const result = validateBusiness(business)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })
})
