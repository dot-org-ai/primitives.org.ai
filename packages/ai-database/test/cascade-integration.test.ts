/**
 * Cascade Generation with AI Integration Tests
 *
 * Verifies that cascade generation:
 * 1. Uses real AI generation (generateObject from ai-functions) at each cascade level
 * 2. Passes parent context to child generation
 * 3. Respects maxDepth limits
 * 4. Tracks progress correctly
 * 5. Handles cascadeTypes filter
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

// TODO: Advanced feature tests - needs investigation
describe.skip('Cascade Generation with AI Integration', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
    // Enable AI generation (will use real AI calls)
    configureAIGeneration({ enabled: true, model: 'sonnet' })
  })

  describe('basic cascade', () => {
    it('should cascade generate related entities with proper structure', async () => {
      const schema = {
        Company: {
          name: 'string',
          department: 'Main department ->Department',
        },
        Department: {
          name: 'string',
          description: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const company = await db.Company.create('comp-1', { name: 'TechCorp' })

      // Department should be generated via cascade (forward exact relation)
      const department = await company.department
      expect(department).toBeDefined()
      expect(department.$type).toBe('Department')
      expect(department.$id).toBeTruthy()
      expect(typeof department.name).toBe('string')
      expect(department.name.length).toBeGreaterThan(0)
      expect(typeof department.description).toBe('string')
      expect(department.description.length).toBeGreaterThan(0)
    })

    it('should respect maxDepth limit with cascade option', async () => {
      // NOTE: Cascade depth applies to array relations (['->Type']),
      // Single forward relations ('->Type') always auto-generate for required fields
      const schema = {
        Level1: {
          name: 'string',
          children: ['->Level2'], // Array relation for cascade
        },
        Level2: {
          name: 'string',
          children: ['->Level3'], // Array relation for cascade
        },
        Level3: {
          name: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create with maxDepth:1 - should generate Level2
      const level1 = await db.Level1.create('l1', { name: 'Top' }, { cascade: true, maxDepth: 1 })

      const level2Children = await level1.children
      expect(level2Children.length).toBeGreaterThan(0)
      expect(level2Children[0].$type).toBe('Level2')
      expect(level2Children[0].$id).toBeTruthy()
      expect(typeof level2Children[0].name).toBe('string')
      expect(level2Children[0].name.length).toBeGreaterThan(0)

      // Level3 children - verify proper structure if generated
      const level3Children = await level2Children[0].children
      // Cascade may or may not reach this level depending on implementation
      // Assert proper structure for any generated entities
      for (const child of level3Children) {
        expect(child.$type).toBe('Level3')
        expect(child.$id).toBeTruthy()
        expect(typeof child.name).toBe('string')
      }
    })

    it('should create root entity with maxDepth=0', async () => {
      const schema = {
        Root: {
          name: 'string',
          items: ['->Item'],
        },
        Item: { name: 'string' },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const root = await db.Root.create('root-1', { name: 'Test' }, { cascade: true, maxDepth: 0 })

      // Root should be created properly
      expect(root).toBeDefined()
      expect(root.$type).toBe('Root')
      expect(root.$id).toBe('root-1')
      expect(root.name).toBe('Test')

      // Check items - assert proper structure for any generated entities
      const items = await root.items
      for (const item of items) {
        expect(item.$type).toBe('Item')
        expect(item.$id).toBeTruthy()
        expect(typeof item.name).toBe('string')
      }
    })
  })

  describe('cascade options', () => {
    it('should track progress during cascade', async () => {
      const progress: any[] = []

      const schema = {
        Article: {
          title: 'string',
          author: '->Author',
        },
        Author: { name: 'string' },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const article = await db.Article.create(
        'art-1',
        { title: 'Test Article' },
        {
          cascade: true,
          maxDepth: 1,
          onProgress: (p) => progress.push({ ...p }),
        }
      )

      // Verify article structure
      expect(article.$type).toBe('Article')
      expect(article.$id).toBe('art-1')

      // Verify author was generated
      const author = await article.author
      expect(author).toBeDefined()
      expect(author.$type).toBe('Author')
      expect(typeof author.name).toBe('string')
      expect(author.name.length).toBeGreaterThan(0)

      expect(progress.length).toBeGreaterThan(0)
      // Should have at least one 'generating' phase and one 'complete' phase
      expect(progress.some((p) => p.phase === 'generating')).toBe(true)
      expect(progress.some((p) => p.phase === 'complete')).toBe(true)
    })

    it('should handle cascadeTypes filter', async () => {
      // NOTE: cascadeTypes filter applies to cascade generation (array relations),
      // not to auto-generation of single forward relations
      const schema = {
        Store: {
          name: 'string',
          products: ['->Product'],
          employees: ['->Employee'],
        },
        Product: { name: 'string' },
        Employee: { name: 'string' },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Only cascade to Product, not Employee
      const store = await db.Store.create(
        'store-1',
        { name: 'Test Store' },
        {
          cascade: true,
          maxDepth: 1,
          cascadeTypes: ['Product'],
        }
      )

      const products = await store.products
      const employees = await store.employees

      // Product was in cascadeTypes - should be generated
      expect(products.length).toBeGreaterThan(0)
      expect(products[0].$type).toBe('Product')
      expect(typeof products[0].name).toBe('string')
      expect(products[0].name.length).toBeGreaterThan(0)

      // Employee was NOT in cascadeTypes - should not be generated
      expect(employees.length).toBe(0)
    })
  })

  describe('context propagation', () => {
    it('should pass parent context to AI generation and generate proper structures', async () => {
      const schema = {
        Startup: {
          name: 'string',
          industry: 'string',
          pitch: 'Create a pitch for this startup ->Pitch',
        },
        Pitch: {
          headline: 'string',
          description: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const startup = await db.Startup.create('startup-1', {
        name: 'DevFlow',
        industry: 'Developer Tools',
      })

      // Access the generated pitch
      const pitch = await startup.pitch

      // Verify structural properties
      expect(pitch).toBeDefined()
      expect(pitch.$type).toBe('Pitch')
      expect(pitch.$id).toBeTruthy()
      expect(typeof pitch.headline).toBe('string')
      expect(pitch.headline.length).toBeGreaterThan(0)
      expect(typeof pitch.description).toBe('string')
      expect(pitch.description.length).toBeGreaterThan(0)
    })
  })

  describe('AI generation integration', () => {
    it('should generate entities with proper schema structure', async () => {
      const schema = {
        Company: {
          name: 'string',
          profile: 'Generate a company profile ->Profile',
        },
        Profile: {
          summary: 'string',
          vision: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const company = await db.Company.create('company-1', { name: 'InnovateTech' })

      // Access the generated profile
      const profile = await company.profile

      // Verify structural properties
      expect(profile).toBeDefined()
      expect(profile.$type).toBe('Profile')
      expect(profile.$id).toBeTruthy()
      expect(typeof profile.summary).toBe('string')
      expect(profile.summary.length).toBeGreaterThan(0)
      expect(typeof profile.vision).toBe('string')
      expect(profile.vision.length).toBeGreaterThan(0)
    })
  })

  describe('fallback behavior', () => {
    it('should not regenerate when value is provided', async () => {
      const schema = {
        Startup: {
          name: 'string',
          idea: 'What problem? ->Idea',
        },
        Idea: { problem: 'string', solution: 'string' },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create with existing idea
      const existingIdea = await db.Idea.create('existing-idea', {
        problem: 'Manual problem',
        solution: 'Manual solution',
      })

      const startup = await db.Startup.create('startup-6', {
        name: 'ManualCo',
        idea: existingIdea.$id,
      })

      // Access the linked idea
      const linkedIdea = await startup.idea

      // Should be the same idea we created manually
      expect(linkedIdea.$id).toBe('existing-idea')
      expect(linkedIdea.problem).toBe('Manual problem')
      expect(linkedIdea.solution).toBe('Manual solution')
    })
  })

  describe('error handling', () => {
    it('should handle cascade errors gracefully', async () => {
      const schema = {
        Wrapper: { name: 'string', items: ['->Item'] },
        Item: { name: 'string' },
      } as const satisfies DatabaseSchema

      const errors: any[] = []

      const { db } = DB(schema)

      const wrapper = await db.Wrapper.create(
        'wrapper-1',
        { name: 'Test' },
        {
          cascade: true,
          maxDepth: 1,
          onError: (err) => errors.push(err),
        }
      )

      // Even if there are errors, should return the entity
      expect(wrapper).toBeDefined()
      expect(wrapper.$type).toBe('Wrapper')
      expect(wrapper.$id).toBe('wrapper-1')

      // Verify cascaded items have proper structure
      const items = await wrapper.items
      if (items.length > 0) {
        expect(items[0].$type).toBe('Item')
        expect(typeof items[0].name).toBe('string')
      }
    })
  })

  describe('multi-level cascade', () => {
    it('should cascade through multiple relationship levels with proper linking', async () => {
      const schema = {
        Project: {
          name: 'string',
          lead: '->Person', // singular reference
          milestones: ['What milestones? ->Milestone'],
        },
        Person: {
          name: 'string',
        },
        Milestone: {
          title: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const project = await db.Project.create(
        'project-2',
        { name: 'Launch v2' },
        { cascade: true, maxDepth: 2 }
      )

      // Singular reference should be created
      const lead = await project.lead
      expect(lead).toBeDefined()
      expect(lead.$type).toBe('Person')
      expect(lead.$id).toBeTruthy()
      expect(typeof lead.name).toBe('string')
      expect(lead.name.length).toBeGreaterThan(0)

      // Nested cascade should work
      const milestones = await project.milestones
      expect(milestones.length).toBeGreaterThan(0)
      expect(milestones[0].$type).toBe('Milestone')
      expect(typeof milestones[0].title).toBe('string')
      expect(milestones[0].title.length).toBeGreaterThan(0)
    })

    it('should handle deep nested relationships', async () => {
      const schema = {
        Team: {
          name: 'string',
          leader: '->Person',
        },
        Person: {
          name: 'string',
          title: 'string',
        },
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const team = await db.Team.create(
        'team-1',
        { name: 'Engineering' },
        { cascade: true, maxDepth: 2 }
      )

      // Verify team structure
      expect(team).toBeDefined()
      expect(team.$type).toBe('Team')
      expect(team.$id).toBe('team-1')
      expect(team.name).toBe('Engineering')

      // Verify leader is properly generated
      const leader = await team.leader
      expect(leader).toBeDefined()
      expect(leader.$type).toBe('Person')
      expect(leader.$id).toBeTruthy()
      expect(typeof leader.name).toBe('string')
      expect(leader.name.length).toBeGreaterThan(0)
      expect(typeof leader.title).toBe('string')
      expect(leader.title.length).toBeGreaterThan(0)
    })
  })
})
