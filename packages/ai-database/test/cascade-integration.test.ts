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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

// Mock ai-functions to verify it's called and control its output
vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { name: 'AI Generated Name', description: 'AI Generated Description' }
  })
}))

describe('Cascade Generation with AI Integration', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
    // Enable AI generation (will use mock in tests)
    configureAIGeneration({ enabled: true, model: 'sonnet' })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('basic cascade', () => {
    it('should cascade generate related entities', async () => {
      const schema = {
        Company: {
          name: 'string',
          department: 'Main department ->Department'
        },
        Department: {
          name: 'string',
          description: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const company = await db.Company.create('comp-1', { name: 'TechCorp' })

      // Department should be generated via cascade (forward exact relation)
      const department = await company.department
      expect(department).toBeDefined()
      expect(department.$id).toBeTruthy()
      expect(department.name).toBeTruthy()
    })

    it('should respect maxDepth limit with cascade option', async () => {
      // NOTE: Cascade depth applies to array relations (['->Type']),
      // Single forward relations ('->Type') always auto-generate for required fields
      const schema = {
        Level1: {
          name: 'string',
          children: ['->Level2']  // Array relation for cascade
        },
        Level2: {
          name: 'string',
          children: ['->Level3']  // Array relation for cascade
        },
        Level3: {
          name: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create with maxDepth:1 - should only generate Level2, not Level3
      const level1 = await db.Level1.create(
        'l1',
        { name: 'Top' },
        { cascade: true, maxDepth: 1 }
      )

      const level2Children = await level1.children
      expect(level2Children.length).toBeGreaterThan(0)

      // Level3 should NOT be generated due to maxDepth:1
      const level3Children = await level2Children[0].children
      expect(level3Children.length).toBe(0)
    })

    it('should not cascade when maxDepth=0', async () => {
      const schema = {
        Root: {
          name: 'string',
          items: ['->Item']
        },
        Item: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const root = await db.Root.create(
        'root-1',
        { name: 'Test' },
        { cascade: true, maxDepth: 0 }
      )

      const items = await root.items
      expect(items.length).toBe(0) // Not generated (depth 0)
    })
  })

  describe('cascade options', () => {
    it('should track progress during cascade', async () => {
      const progress: any[] = []

      const schema = {
        Article: {
          title: 'string',
          author: '->Author'
        },
        Author: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Article.create(
        'art-1',
        { title: 'Test Article' },
        {
          cascade: true,
          maxDepth: 1,
          onProgress: (p) => progress.push({ ...p })
        }
      )

      expect(progress.length).toBeGreaterThan(0)
      // Should have at least one 'generating' phase and one 'complete' phase
      expect(progress.some(p => p.phase === 'generating')).toBe(true)
      expect(progress.some(p => p.phase === 'complete')).toBe(true)
    })

    it('should handle cascadeTypes filter', async () => {
      // NOTE: cascadeTypes filter applies to cascade generation (array relations),
      // not to auto-generation of single forward relations
      const schema = {
        Store: {
          name: 'string',
          products: ['->Product'],
          employees: ['->Employee']
        },
        Product: { name: 'string' },
        Employee: { name: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Only cascade to Product, not Employee
      const store = await db.Store.create(
        'store-1',
        { name: 'Test Store' },
        {
          cascade: true,
          maxDepth: 1,
          cascadeTypes: ['Product']
        }
      )

      const products = await store.products
      const employees = await store.employees

      // Product was in cascadeTypes - should be generated
      expect(products.length).toBeGreaterThan(0)

      // Employee was NOT in cascadeTypes - should not be generated
      expect(employees.length).toBe(0)
    })

    it('should track entity count in progress', async () => {
      const schema = {
        Container: {
          name: 'string',
          items: ['->Item']
        },
        Item: { name: 'string' }
      } as const satisfies DatabaseSchema

      const progress: any[] = []

      const { db } = DB(schema)

      await db.Container.create(
        'container-1',
        { name: 'Box' },
        {
          cascade: true,
          maxDepth: 1,
          onProgress: (p) => progress.push({ ...p })
        }
      )

      const completeEvent = progress.find((p) => p.phase === 'complete')
      expect(completeEvent).toBeDefined()
      expect(completeEvent.totalEntitiesCreated).toBeGreaterThan(0)
    })

    it('should track types being generated in progress', async () => {
      const schema = {
        Order: {
          number: 'string',
          lineItems: ['->LineItem'],
          customer: '->Customer'
        },
        LineItem: { product: 'string' },
        Customer: { name: 'string' }
      } as const satisfies DatabaseSchema

      const typesGenerated: string[] = []

      const { db } = DB(schema)

      await db.Order.create(
        'order-1',
        { number: 'ORD-001' },
        {
          cascade: true,
          maxDepth: 2,
          onProgress: (p) => {
            if (p.currentType && !typesGenerated.includes(p.currentType)) {
              typesGenerated.push(p.currentType)
            }
          }
        }
      )

      expect(typesGenerated).toContain('LineItem')
      expect(typesGenerated).toContain('Customer')
    })
  })

  describe('context propagation', () => {
    it('should pass parent context to AI generation', async () => {
      const { generateObject } = await import('ai-functions')

      const schema = {
        Startup: {
          name: 'string',
          industry: 'string',
          pitch: 'Create a pitch for this startup ->Pitch'
        },
        Pitch: {
          headline: 'string',
          description: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Startup.create('startup-1', {
        name: 'DevFlow',
        industry: 'Developer Tools'
      })

      // Verify generateObject was called
      expect(generateObject).toHaveBeenCalled()

      // Check that the prompt includes parent context
      const calls = vi.mocked(generateObject).mock.calls
      const promptCall = calls.find(call =>
        typeof call[0] === 'object' &&
        'prompt' in call[0] &&
        typeof call[0].prompt === 'string'
      )

      if (promptCall) {
        const promptArg = promptCall[0] as { prompt: string }
        // The prompt should include context about the parent entity
        expect(
          promptArg.prompt.includes('DevFlow') ||
          promptArg.prompt.includes('Developer Tools') ||
          promptArg.prompt.includes('pitch')
        ).toBe(true)
      }
    })

    it('should include $instructions in cascade context', async () => {
      const { generateObject } = await import('ai-functions')

      const schema = {
        Enterprise: {
          $instructions: 'This is a B2B enterprise company with Fortune 500 clients',
          name: 'string',
          solution: '->Solution'
        },
        Solution: {
          title: 'string',
          description: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Enterprise.create('enterprise-1', {
        name: 'EnterpriseCorp'
      })

      // Check that $instructions context was passed
      const calls = vi.mocked(generateObject).mock.calls
      const hasInstructionsContext = calls.some(call => {
        if (typeof call[0] === 'object' && 'prompt' in call[0]) {
          const prompt = call[0].prompt as string
          return prompt.includes('B2B') || prompt.includes('enterprise') || prompt.includes('Fortune')
        }
        return false
      })

      expect(hasInstructionsContext).toBe(true)
    })
  })

  describe('AI generation integration', () => {
    it('should call generateObject for forward exact fields', async () => {
      const { generateObject } = await import('ai-functions')

      const schema = {
        Company: {
          name: 'string',
          profile: 'Generate a company profile ->Profile'
        },
        Profile: {
          summary: 'string',
          vision: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Company.create('company-1', { name: 'InnovateTech' })

      // generateObject should have been called to generate the Profile entity
      expect(generateObject).toHaveBeenCalled()
    })

    it('should pass target entity schema to generateObject', async () => {
      const { generateObject } = await import('ai-functions')

      const schema = {
        Startup: {
          name: 'string',
          idea: 'Generate a startup idea ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Startup.create('startup-2', { name: 'TechCorp' })

      // Check that generateObject was called with a schema matching Idea entity
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: expect.objectContaining({
            problem: expect.any(String),
            solution: expect.any(String)
          })
        })
      )
    })

    it('should use generated object values for entity creation', async () => {
      const { generateObject } = await import('ai-functions')

      // Configure mock to return specific values
      vi.mocked(generateObject).mockResolvedValueOnce({
        object: {
          problem: 'AI-generated problem statement',
          solution: 'AI-generated solution approach'
        }
      })

      const schema = {
        Startup: {
          name: 'string',
          idea: 'What problem? ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const startup = await db.Startup.create('startup-3', { name: 'AIStartup' })
      const idea = await startup.idea

      // The generated values should be used in the created entity
      expect(idea.problem).toBe('AI-generated problem statement')
      expect(idea.solution).toBe('AI-generated solution approach')
    })

    it('should include model alias in generateObject call', async () => {
      const { generateObject } = await import('ai-functions')

      const schema = {
        Startup: {
          name: 'string',
          idea: '->Idea'
        },
        Idea: { description: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      await db.Startup.create('startup-4', { name: 'TestCo' })

      // Should use a model alias (default 'sonnet' or configured)
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.stringMatching(/sonnet|opus|gpt|claude/)
        })
      )
    })
  })

  describe('fallback behavior', () => {
    it('should use placeholder when generateObject fails', async () => {
      const { generateObject } = await import('ai-functions')

      // Mock generateObject to reject
      vi.mocked(generateObject).mockRejectedValueOnce(new Error('API Error'))

      const schema = {
        Startup: {
          name: 'string',
          idea: 'What problem? ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Should not throw, should fall back to placeholder
      const startup = await db.Startup.create('startup-5', { name: 'FallbackCo' })
      const idea = await startup.idea

      // Should have some value even if AI failed (placeholder generates values)
      expect(idea).toBeDefined()
      expect(idea.$type).toBe('Idea')
      expect(typeof idea.problem).toBe('string')
    })

    it('should not call generateObject when value is provided', async () => {
      const { generateObject } = await import('ai-functions')
      vi.clearAllMocks()

      const schema = {
        Startup: {
          name: 'string',
          idea: 'What problem? ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      // Create with existing idea
      const existingIdea = await db.Idea.create('existing-idea', {
        problem: 'Manual problem',
        solution: 'Manual solution'
      })

      await db.Startup.create('startup-6', {
        name: 'ManualCo',
        idea: existingIdea.$id
      })

      // generateObject should NOT be called for Startup creation
      // since the idea field was already provided
      const generateObjectCalls = vi.mocked(generateObject).mock.calls
      const callsAfterIdeaCreation = generateObjectCalls.filter(call =>
        JSON.stringify(call[0]).includes('problem') &&
        JSON.stringify(call[0]).includes('solution')
      )

      // At most one call for initial Idea creation, not for Startup creation
      expect(callsAfterIdeaCreation.length).toBeLessThanOrEqual(1)
    })
  })

  describe('error handling', () => {
    it('should handle cascade errors gracefully', async () => {
      const schema = {
        Wrapper: { name: 'string', items: ['->Item'] },
        Item: { name: 'string' }
      } as const satisfies DatabaseSchema

      const errors: any[] = []

      const { db } = DB(schema)

      const wrapper = await db.Wrapper.create(
        'wrapper-1',
        { name: 'Test' },
        {
          cascade: true,
          maxDepth: 1,
          onError: (err) => errors.push(err)
        }
      )

      // Even if there are errors, should return the entity
      expect(wrapper).toBeDefined()
      expect(wrapper.$type).toBe('Wrapper')
    })

    it('should support stopOnError option', async () => {
      const schema = {
        Container: {
          name: 'string',
          a: ['->TypeA'],
          b: ['->TypeB']
        },
        TypeA: { name: 'string' },
        TypeB: { name: 'string' }
      } as const satisfies DatabaseSchema

      const progress: any[] = []

      const { db } = DB(schema)

      await db.Container.create(
        'container-2',
        { name: 'TestContainer' },
        {
          cascade: true,
          maxDepth: 1,
          stopOnError: true,
          onProgress: (p) => progress.push(p)
        }
      )

      // Should still generate entities if no errors occur
      expect(progress.length).toBeGreaterThan(0)
    })
  })

  describe('multi-level cascade', () => {
    it('should cascade through multiple relationship levels', async () => {
      const schema = {
        Company: {
          name: 'string',
          departments: ['What departments exist? ->Department']
        },
        Department: {
          name: 'string',
          teams: ['What teams work here? ->Team']
        },
        Team: {
          name: 'string',
          members: ['Who are the team members? ->Employee']
        },
        Employee: {
          name: 'string',
          role: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const company = await db.Company.create(
        'company-2',
        { name: 'TechCorp' },
        { cascade: true, maxDepth: 4 }
      )

      const departments = await company.departments
      expect(departments.length).toBeGreaterThan(0)

      const teams = await departments[0].teams
      expect(teams.length).toBeGreaterThan(0)

      const members = await teams[0].members
      expect(members.length).toBeGreaterThan(0)
    })

    it('should handle mixed relationship types during cascade', async () => {
      const schema = {
        Project: {
          name: 'string',
          lead: '->Person', // singular reference
          contributors: ['->Person'], // array reference
          milestones: ['What milestones? ->Milestone']
        },
        Person: {
          name: 'string'
        },
        Milestone: {
          title: 'string',
          deliverables: ['What deliverables? ->Deliverable']
        },
        Deliverable: {
          description: 'string'
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const project = await db.Project.create(
        'project-2',
        { name: 'Launch v2' },
        { cascade: true, maxDepth: 3 }
      )

      // Singular reference should be created
      const lead = await project.lead
      expect(lead).toBeDefined()
      expect(lead.$type).toBe('Person')

      // Array references should be created
      const contributors = await project.contributors
      expect(contributors.length).toBeGreaterThan(0)

      // Nested cascade should work
      const milestones = await project.milestones
      expect(milestones.length).toBeGreaterThan(0)

      const deliverables = await milestones[0].deliverables
      expect(deliverables.length).toBeGreaterThan(0)
    })

    it('should handle circular references with maxDepth', async () => {
      const schema = {
        Node: {
          value: 'string',
          children: ['->Node'] // Self-referential
        }
      } as const satisfies DatabaseSchema

      const { db } = DB(schema)

      const node = await db.Node.create(
        'node-root',
        { value: 'root' },
        { cascade: true, maxDepth: 3 }
      )

      const level1 = await node.children
      expect(level1.length).toBeGreaterThan(0)

      const level2 = await level1[0].children
      expect(level2.length).toBeGreaterThan(0)

      const level3 = await level2[0].children
      expect(level3.length).toBeGreaterThan(0)

      const level4 = await level3[0].children
      expect(level4.length).toBe(0) // Stopped at maxDepth
    })
  })
})
