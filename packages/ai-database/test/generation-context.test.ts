/**
 * Tests for GenerationContext - Context Accumulation Across Cascading Generations
 *
 * GenerationContext manages state and context during cascade generation:
 * - Parent stack tracking for nested entity context
 * - Generated entities accumulation across a session
 * - Token counting for monitoring context size
 * - Auto-compaction when exceeding limits
 * - Context for array generation (previousInArray)
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  GenerationContext,
  createGenerationContext,
  type GenerationContextOptions,
  type Entity,
} from '../src/schema/generation-context.js'

describe('GenerationContext', () => {
  // Sample entities for testing
  const sampleCompany: Entity = {
    $id: 'company-1',
    $type: 'Company',
    name: 'Acme Corp',
    industry: 'Technology',
  }

  const sampleDepartment: Entity = {
    $id: 'dept-1',
    $type: 'Department',
    name: 'Engineering',
    budget: 1000000,
  }

  const sampleEmployee: Entity = {
    $id: 'emp-1',
    $type: 'Employee',
    name: 'John Doe',
    role: 'Developer',
  }

  describe('createGenerationContext factory', () => {
    it('should create a new GenerationContext with default options', () => {
      const ctx = createGenerationContext()
      expect(ctx).toBeInstanceOf(GenerationContext)
      expect(ctx.getParentStack()).toEqual([])
      expect(ctx.getAllGenerated()).toEqual([])
    })

    it('should create a GenerationContext with custom options', () => {
      const ctx = createGenerationContext({
        maxContextTokens: 1000,
        autoCompact: true,
      })
      expect(ctx).toBeInstanceOf(GenerationContext)
      expect(ctx.getRemainingTokenBudget()).toBeLessThanOrEqual(1000)
    })
  })

  describe('Parent Stack Tracking', () => {
    let ctx: GenerationContext

    beforeEach(() => {
      ctx = createGenerationContext()
    })

    it('should push parent entities onto the stack', () => {
      ctx.pushParent(sampleCompany)
      expect(ctx.getParentStack()).toHaveLength(1)
      expect(ctx.getParent()).toEqual(sampleCompany)
    })

    it('should pop parent entities from the stack', () => {
      ctx.pushParent(sampleCompany)
      ctx.pushParent(sampleDepartment)

      const popped = ctx.popParent()
      expect(popped).toEqual(sampleDepartment)
      expect(ctx.getParentStack()).toHaveLength(1)
    })

    it('should return undefined when popping from empty stack', () => {
      const popped = ctx.popParent()
      expect(popped).toBeUndefined()
    })

    it('should get parent at specific depth (0 = immediate parent)', () => {
      ctx.pushParent(sampleCompany)
      ctx.pushParent(sampleDepartment)
      ctx.pushParent(sampleEmployee)

      expect(ctx.getParent(0)).toEqual(sampleEmployee) // immediate
      expect(ctx.getParent(1)).toEqual(sampleDepartment) // one level up
      expect(ctx.getParent(2)).toEqual(sampleCompany) // two levels up
      expect(ctx.getParent(3)).toBeUndefined() // beyond stack
    })

    it('should get the entire parent chain (nearest first)', () => {
      ctx.pushParent(sampleCompany)
      ctx.pushParent(sampleDepartment)
      ctx.pushParent(sampleEmployee)

      const chain = ctx.getParentChain()
      expect(chain).toEqual([sampleEmployee, sampleDepartment, sampleCompany])
    })

    it('should handle deeply nested cascades (>10 levels)', () => {
      const entities: Entity[] = []
      for (let i = 0; i < 15; i++) {
        const entity: Entity = {
          $id: `entity-${i}`,
          $type: `Level${i}`,
          name: `Entity ${i}`,
        }
        entities.push(entity)
        ctx.pushParent(entity)
      }

      expect(ctx.getParentStack()).toHaveLength(15)
      expect(ctx.getParent(0)).toEqual(entities[14])
      expect(ctx.getParent(14)).toEqual(entities[0])
    })
  })

  describe('Generated Entities Accumulation', () => {
    let ctx: GenerationContext

    beforeEach(() => {
      ctx = createGenerationContext()
    })

    it('should add generated entities to the context', () => {
      ctx.addGenerated(sampleCompany)
      expect(ctx.getAllGenerated()).toHaveLength(1)
      expect(ctx.getById('company-1')).toEqual(sampleCompany)
    })

    it('should track generation order', () => {
      ctx.addGenerated(sampleCompany)
      ctx.addGenerated(sampleDepartment)
      ctx.addGenerated(sampleEmployee)

      const order = ctx.getGenerationOrder()
      expect(order).toEqual([sampleCompany, sampleDepartment, sampleEmployee])
    })

    it('should get entity by ID', () => {
      ctx.addGenerated(sampleCompany)
      ctx.addGenerated(sampleDepartment)

      expect(ctx.getById('company-1')).toEqual(sampleCompany)
      expect(ctx.getById('dept-1')).toEqual(sampleDepartment)
      expect(ctx.getById('nonexistent')).toBeUndefined()
    })
  })

  describe('generatedByType Index', () => {
    let ctx: GenerationContext

    beforeEach(() => {
      ctx = createGenerationContext()
    })

    it('should index entities by type for efficient lookup', () => {
      const emp1: Entity = { $id: 'emp-1', $type: 'Employee', name: 'Alice' }
      const emp2: Entity = { $id: 'emp-2', $type: 'Employee', name: 'Bob' }
      const dept: Entity = { $id: 'dept-1', $type: 'Department', name: 'Engineering' }

      ctx.addGenerated(emp1)
      ctx.addGenerated(emp2)
      ctx.addGenerated(dept)

      const employees = ctx.getByType('Employee')
      expect(employees).toHaveLength(2)
      expect(employees).toContainEqual(emp1)
      expect(employees).toContainEqual(emp2)

      const departments = ctx.getByType('Department')
      expect(departments).toHaveLength(1)
      expect(departments).toContainEqual(dept)
    })

    it('should return empty array for type with no entities', () => {
      ctx.addGenerated(sampleCompany)
      expect(ctx.getByType('NonexistentType')).toEqual([])
    })
  })

  describe('Token Counting', () => {
    let ctx: GenerationContext

    beforeEach(() => {
      ctx = createGenerationContext()
    })

    it('should estimate tokens for context', () => {
      ctx.addGenerated(sampleCompany)
      const tokens = ctx.estimateTokens()
      expect(tokens).toBeGreaterThan(0)
    })

    it('should track cumulative tokens across generations', () => {
      const initialTokens = ctx.estimateTokens()
      ctx.addGenerated(sampleCompany)
      const afterFirst = ctx.estimateTokens()
      ctx.addGenerated(sampleDepartment)
      const afterSecond = ctx.estimateTokens()

      expect(afterFirst).toBeGreaterThan(initialTokens)
      expect(afterSecond).toBeGreaterThan(afterFirst)
    })

    it('should include parent stack in token estimation', () => {
      ctx.addGenerated(sampleCompany)
      const tokensWithoutParent = ctx.estimateTokens()

      ctx.pushParent(sampleDepartment)
      const tokensWithParent = ctx.estimateTokens()

      expect(tokensWithParent).toBeGreaterThan(tokensWithoutParent)
    })

    it('should estimate tokens for single entity', () => {
      const entityTokens = ctx.estimateEntityTokens(sampleCompany)
      expect(entityTokens).toBeGreaterThan(0)
      // Simple sanity check: ~4 chars per token
      const expectedMinTokens = Math.ceil(JSON.stringify(sampleCompany).length / 4) * 0.5
      expect(entityTokens).toBeGreaterThanOrEqual(expectedMinTokens)
    })

    it('should get remaining token budget', () => {
      const ctx = createGenerationContext({ maxContextTokens: 1000 })
      expect(ctx.getRemainingTokenBudget()).toBe(1000)

      ctx.addGenerated(sampleCompany)
      expect(ctx.getRemainingTokenBudget()).toBeLessThan(1000)
    })
  })

  describe('Auto-Compaction', () => {
    it('should throw ContextOverflowError when exceeding limit without autoCompact', () => {
      const ctx = createGenerationContext({
        maxContextTokens: 50, // Very small limit
        autoCompact: false,
      })

      ctx.addGenerated(sampleCompany)

      // Adding more should exceed limit
      expect(() => {
        for (let i = 0; i < 10; i++) {
          ctx.addGenerated({
            $id: `entity-${i}`,
            $type: 'LargeEntity',
            data: 'x'.repeat(100),
          })
        }
      }).toThrow(/exceed.*token.*limit/i)
    })

    it('should auto-compact when exceeding limit with autoCompact enabled', () => {
      const ctx = createGenerationContext({
        maxContextTokens: 100,
        autoCompact: true,
      })

      // Add many entities
      for (let i = 0; i < 20; i++) {
        ctx.addGenerated({
          $id: `entity-${i}`,
          $type: 'TestEntity',
          data: `value-${i}`,
        })
      }

      // Should not throw, and should have compacted
      const allGenerated = ctx.getAllGenerated()
      expect(allGenerated.length).toBeLessThan(20)
    })

    it('should remove oldest entities first during compaction', () => {
      const ctx = createGenerationContext({
        maxContextTokens: 150,
        autoCompact: true,
      })

      // Add entities in order
      ctx.addGenerated({ $id: 'first', $type: 'Test', name: 'First' })
      ctx.addGenerated({ $id: 'second', $type: 'Test', name: 'Second' })

      // Add more to trigger compaction
      for (let i = 0; i < 20; i++) {
        ctx.addGenerated({
          $id: `entity-${i}`,
          $type: 'TestEntity',
          data: `value-${i}`,
        })
      }

      // Oldest should be removed first
      expect(ctx.getById('first')).toBeUndefined()
    })

    it('should compact to target threshold (50% of max)', () => {
      const maxTokens = 200
      const ctx = createGenerationContext({
        maxContextTokens: maxTokens,
        autoCompact: true,
      })

      // Add entities until compaction occurs
      for (let i = 0; i < 50; i++) {
        ctx.addGenerated({
          $id: `entity-${i}`,
          $type: 'TestEntity',
          data: `value-${i}`,
        })
      }

      // After compaction, tokens should be around 50% of max
      const currentTokens = ctx.estimateTokens()
      expect(currentTokens).toBeLessThanOrEqual(maxTokens)
    })

    it('should update generatedByType index after compaction', () => {
      const ctx = createGenerationContext({
        maxContextTokens: 100,
        autoCompact: true,
      })

      // Add entities of same type
      for (let i = 0; i < 20; i++) {
        ctx.addGenerated({
          $id: `test-${i}`,
          $type: 'TestType',
          data: `value-${i}`,
        })
      }

      // All entities in byType should also be in generated
      const byType = ctx.getByType('TestType')
      const allGenerated = ctx.getAllGenerated()

      for (const entity of byType) {
        expect(ctx.getById(entity.$id)).toBeDefined()
      }

      expect(byType.length).toBeLessThanOrEqual(allGenerated.length)
    })
  })

  describe('previousInArray Context (Array Generation)', () => {
    let ctx: GenerationContext

    beforeEach(() => {
      ctx = createGenerationContext()
    })

    it('should track previous entities in array generation', () => {
      const items = [
        { $id: 'item-0', $type: 'ListItem', value: 0 },
        { $id: 'item-1', $type: 'ListItem', value: 1 },
        { $id: 'item-2', $type: 'ListItem', value: 2 },
      ]

      ctx.startArrayGeneration('items')

      for (const item of items) {
        ctx.addArrayItem('items', item)
      }

      const previous = ctx.getPreviousInArray('items')
      expect(previous).toHaveLength(3)
      expect(previous).toEqual(items)
    })

    it('should get context for field including previousInArray', () => {
      const items = [
        { $id: 'item-0', $type: 'ListItem', value: 'first' },
        { $id: 'item-1', $type: 'ListItem', value: 'second' },
      ]

      ctx.startArrayGeneration('items')
      items.forEach((item) => ctx.addArrayItem('items', item))

      const fieldContext = ctx.getContextForField('items')
      expect(fieldContext.previousInArray).toEqual(items)
    })

    it('should clear array context when generation completes', () => {
      ctx.startArrayGeneration('items')
      ctx.addArrayItem('items', { $id: 'item-0', $type: 'ListItem', value: 0 })

      ctx.endArrayGeneration('items')

      expect(ctx.getPreviousInArray('items')).toEqual([])
    })

    it('should support multiple concurrent array generations', () => {
      ctx.startArrayGeneration('tags')
      ctx.startArrayGeneration('authors')

      ctx.addArrayItem('tags', { $id: 'tag-1', $type: 'Tag', name: 'js' })
      ctx.addArrayItem('authors', { $id: 'auth-1', $type: 'Author', name: 'Alice' })
      ctx.addArrayItem('tags', { $id: 'tag-2', $type: 'Tag', name: 'ts' })

      expect(ctx.getPreviousInArray('tags')).toHaveLength(2)
      expect(ctx.getPreviousInArray('authors')).toHaveLength(1)
    })
  })

  describe('Relationship Tracking', () => {
    let ctx: GenerationContext

    beforeEach(() => {
      ctx = createGenerationContext()
    })

    it('should add relationships between entities', () => {
      ctx.addGenerated(sampleCompany)
      ctx.addGenerated(sampleDepartment)

      ctx.addRelationship('company-1', 'dept-1', 'hasDepartment')

      const relationships = ctx.getRelationships('company-1')
      expect(relationships).toHaveLength(1)
      expect(relationships[0]).toEqual({ to: 'dept-1', verb: 'hasDepartment' })
    })

    it('should get all relationships for an entity', () => {
      ctx.addGenerated(sampleCompany)
      ctx.addGenerated(sampleDepartment)
      ctx.addGenerated(sampleEmployee)

      ctx.addRelationship('company-1', 'dept-1', 'hasDepartment')
      ctx.addRelationship('company-1', 'emp-1', 'employs')

      const relationships = ctx.getRelationships('company-1')
      expect(relationships).toHaveLength(2)
    })
  })

  describe('Context Serialization', () => {
    let ctx: GenerationContext

    beforeEach(() => {
      ctx = createGenerationContext()
    })

    it('should serialize context to JSON', () => {
      ctx.addGenerated(sampleCompany)
      ctx.pushParent(sampleDepartment)

      const json = ctx.toJSON()
      expect(typeof json).toBe('string')

      const parsed = JSON.parse(json)
      expect(parsed.generated).toHaveLength(1)
      expect(parsed.parents).toHaveLength(1)
    })

    it('should deserialize context from JSON', () => {
      ctx.addGenerated(sampleCompany)
      ctx.addGenerated(sampleDepartment)
      ctx.pushParent(sampleEmployee)
      ctx.addRelationship('company-1', 'dept-1', 'owns')

      const json = ctx.toJSON()
      const restored = GenerationContext.fromJSON(json)

      expect(restored.getAllGenerated()).toHaveLength(2)
      expect(restored.getParentStack()).toHaveLength(1)
      expect(restored.getRelationships('company-1')).toHaveLength(1)
    })

    it('should preserve entity data through serialization', () => {
      ctx.addGenerated(sampleCompany)
      const json = ctx.toJSON()
      const restored = GenerationContext.fromJSON(json)

      const entity = restored.getById('company-1')
      expect(entity).toEqual(sampleCompany)
    })
  })

  describe('Snapshot and Branching', () => {
    let ctx: GenerationContext

    beforeEach(() => {
      ctx = createGenerationContext()
    })

    it('should create a snapshot of current state', () => {
      ctx.addGenerated(sampleCompany)
      ctx.pushParent(sampleDepartment)

      const snapshot = ctx.createSnapshot()
      expect(snapshot.generatedCount).toBe(1)
      expect(snapshot.parentDepth).toBe(1)
      expect(snapshot.timestamp).toBeInstanceOf(Date)
    })

    it('should restore from a snapshot', () => {
      ctx.addGenerated(sampleCompany)
      ctx.pushParent(sampleDepartment)
      const snapshot = ctx.createSnapshot()

      // Add more after snapshot
      ctx.addGenerated(sampleEmployee)
      ctx.pushParent(sampleEmployee)

      expect(ctx.getAllGenerated()).toHaveLength(2)
      expect(ctx.getParentStack()).toHaveLength(2)

      // Restore
      ctx.restoreSnapshot(snapshot)

      expect(ctx.getAllGenerated()).toHaveLength(1)
      expect(ctx.getParentStack()).toHaveLength(1)
    })

    it('should branch to create an independent copy', () => {
      ctx.addGenerated(sampleCompany)
      ctx.pushParent(sampleDepartment)

      const branch = ctx.branch()

      // Modify original
      ctx.addGenerated(sampleEmployee)

      // Branch should be unaffected
      expect(branch.getAllGenerated()).toHaveLength(1)
      expect(ctx.getAllGenerated()).toHaveLength(2)
    })

    it('should merge a branch back', () => {
      ctx.addGenerated(sampleCompany)

      const branch = ctx.branch()
      branch.addGenerated(sampleDepartment)
      branch.addRelationship('company-1', 'dept-1', 'owns')

      ctx.merge(branch)

      expect(ctx.getAllGenerated()).toHaveLength(2)
      expect(ctx.getRelationships('company-1')).toHaveLength(1)
    })
  })

  describe('Context Building for AI Generation', () => {
    let ctx: GenerationContext

    beforeEach(() => {
      ctx = createGenerationContext()
    })

    it('should build context string including parent entities', () => {
      ctx.pushParent(sampleCompany)
      ctx.pushParent(sampleDepartment)

      const contextString = ctx.buildContextString()

      expect(contextString).toContain('parent')
      expect(contextString).toContain('Company')
      expect(contextString).toContain('Acme Corp')
    })

    it('should include previously generated entities in context', () => {
      ctx.addGenerated(sampleCompany)
      ctx.addGenerated(sampleDepartment)

      const contextString = ctx.buildContextString()

      expect(contextString).toContain('company-1')
      expect(contextString).toContain('dept-1')
    })

    it('should prioritize relevant types in context', () => {
      ctx.addGenerated(sampleCompany)
      ctx.addGenerated(sampleDepartment)
      ctx.addGenerated(sampleEmployee)

      const contextString = ctx.buildContextString({
        relevantTypes: ['Employee'],
      })

      // Employee should appear before Company/Department
      const employeeIndex = contextString.indexOf('Employee')
      const companyIndex = contextString.indexOf('Company')
      expect(employeeIndex).toBeLessThan(companyIndex)
    })

    it('should truncate context when maxTokens exceeded', () => {
      // Add many entities
      for (let i = 0; i < 100; i++) {
        ctx.addGenerated({
          $id: `entity-${i}`,
          $type: 'TestEntity',
          data: 'x'.repeat(100),
        })
      }

      const contextString = ctx.buildContextString({ maxTokens: 100 })

      // Should be truncated
      expect(contextString.length).toBeLessThan(500) // ~4 chars per token
      expect(contextString).toContain('...')
    })
  })
})
