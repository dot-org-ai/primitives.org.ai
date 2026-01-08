/**
 * Tests for Cascade Generation via ->Type[] Triggers
 *
 * Cascade generation allows automatic recursive creation of related entities
 * through relationship fields (->Type[] arrays). This enables:
 * - Deep entity graph generation with a single create() call
 * - Controlled depth limits to prevent infinite recursion
 * - Progress tracking for long-running cascade operations
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import { DB } from '../src/schema.js'

describe('Cascade Generation via ->Type[] Triggers', () => {
  describe('Cascade through relationships', () => {
    it('should cascade generation through ->[] relationships', async () => {
      const { db } = DB({
        Task: {
          name: 'string',
          problems: ['What problems exist? ->Problem'],
        },
        Problem: {
          description: 'string',
          solutions: ['How to solve? ->Solution'],
        },
        Solution: {
          approach: 'string',
        },
      })

      const task = await db.Task.create(
        { name: 'Data Entry' },
        { cascade: true, maxDepth: 3 }
      )

      const problems = await task.problems
      expect(problems.length).toBeGreaterThan(0)

      const solutions = await problems[0].solutions
      expect(solutions.length).toBeGreaterThan(0)
    })

    it('should cascade through multiple relationship levels', async () => {
      const { db } = DB({
        Company: {
          name: 'string',
          departments: ['What departments exist? ->Department'],
        },
        Department: {
          name: 'string',
          teams: ['What teams work here? ->Team'],
        },
        Team: {
          name: 'string',
          members: ['Who are the team members? ->Employee'],
        },
        Employee: {
          name: 'string',
          role: 'string',
        },
      })

      const company = await db.Company.create(
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
      const { db } = DB({
        Project: {
          name: 'string',
          lead: '->Person', // singular reference
          contributors: ['->Person'], // array reference
          milestones: ['What milestones? ->Milestone'],
        },
        Person: {
          name: 'string',
        },
        Milestone: {
          title: 'string',
          deliverables: ['What deliverables? ->Deliverable'],
        },
        Deliverable: {
          description: 'string',
        },
      })

      const project = await db.Project.create(
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
  })

  describe('Respect maxDepth', () => {
    it('should respect maxDepth limit', async () => {
      const { db } = DB({
        A: { bs: ['->B'] },
        B: { cs: ['->C'] },
        C: { ds: ['->D'] },
        D: { name: 'string' },
      })

      const a = await db.A.create({}, { cascade: true, maxDepth: 2 })

      const bs = await a.bs
      expect(bs.length).toBeGreaterThan(0)

      const cs = await bs[0].cs
      expect(cs.length).toBeGreaterThan(0)

      const ds = await cs[0].ds
      expect(ds.length).toBe(0) // D not generated (depth 3)
    })

    it('should stop at maxDepth=1 (only immediate children)', async () => {
      const { db } = DB({
        Parent: { children: ['->Child'] },
        Child: { grandchildren: ['->Grandchild'] },
        Grandchild: { name: 'string' },
      })

      const parent = await db.Parent.create(
        { name: 'Root' },
        { cascade: true, maxDepth: 1 }
      )

      const children = await parent.children
      expect(children.length).toBeGreaterThan(0)

      const grandchildren = await children[0].grandchildren
      expect(grandchildren.length).toBe(0) // Not generated (depth 2)
    })

    it('should not cascade when maxDepth=0', async () => {
      const { db } = DB({
        Root: { items: ['->Item'] },
        Item: { name: 'string' },
      })

      const root = await db.Root.create(
        { name: 'Test' },
        { cascade: true, maxDepth: 0 }
      )

      const items = await root.items
      expect(items.length).toBe(0) // Not generated (depth 0)
    })

    it('should handle circular references with maxDepth', async () => {
      const { db } = DB({
        Node: {
          value: 'string',
          children: ['->Node'], // Self-referential
        },
      })

      const node = await db.Node.create(
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

  describe('Progress tracking', () => {
    it('should provide cascade progress tracking', async () => {
      const { db } = DB({
        Industry: { occupations: ['->Occupation'] },
        Occupation: { tasks: ['->Task'] },
        Task: { name: 'string' },
      })

      const progress: any[] = []

      await db.Industry.create(
        { name: 'Software' },
        {
          cascade: true,
          maxDepth: 2,
          onProgress: (p) => progress.push(p),
        }
      )

      expect(progress.some((p) => p.phase === 'generating')).toBe(true)
      expect(progress.some((p) => p.currentType === 'Occupation')).toBe(true)
      expect(progress.find((p) => p.phase === 'complete')).toBeDefined()
    })

    it('should track depth in progress events', async () => {
      const { db } = DB({
        Level1: { level2s: ['->Level2'] },
        Level2: { level3s: ['->Level3'] },
        Level3: { name: 'string' },
      })

      const progress: any[] = []

      await db.Level1.create(
        {},
        {
          cascade: true,
          maxDepth: 3,
          onProgress: (p) => progress.push(p),
        }
      )

      const depths = progress.filter((p) => p.depth !== undefined).map((p) => p.depth)
      expect(depths).toContain(0)
      expect(depths).toContain(1)
      expect(depths).toContain(2)
    })

    it('should report entity count in progress', async () => {
      const { db } = DB({
        Container: { items: ['->Item'] },
        Item: { name: 'string' },
      })

      const progress: any[] = []

      await db.Container.create(
        { name: 'Box' },
        {
          cascade: true,
          maxDepth: 1,
          onProgress: (p) => progress.push(p),
        }
      )

      const completeEvent = progress.find((p) => p.phase === 'complete')
      expect(completeEvent).toBeDefined()
      expect(completeEvent.totalEntitiesCreated).toBeGreaterThan(1)
    })

    it('should track types being generated in progress', async () => {
      const { db } = DB({
        Order: {
          lineItems: ['->LineItem'],
          customer: '->Customer',
        },
        LineItem: { product: '->Product' },
        Product: { name: 'string' },
        Customer: { name: 'string' },
      })

      const typesGenerated: string[] = []

      await db.Order.create(
        {},
        {
          cascade: true,
          maxDepth: 2,
          onProgress: (p) => {
            if (p.currentType && !typesGenerated.includes(p.currentType)) {
              typesGenerated.push(p.currentType)
            }
          },
        }
      )

      expect(typesGenerated).toContain('LineItem')
      expect(typesGenerated).toContain('Customer')
      expect(typesGenerated).toContain('Product')
    })
  })

  describe('Cascade options', () => {
    it('should not cascade by default', async () => {
      const { db } = DB({
        Article: { comments: ['->Comment'] },
        Comment: { text: 'string' },
      })

      const article = await db.Article.create({ title: 'Test' })

      const comments = await article.comments
      expect(comments.length).toBe(0) // No cascade by default
    })

    it('should support cascade: false to explicitly disable', async () => {
      const { db } = DB({
        Post: { tags: ['->Tag'] },
        Tag: { name: 'string' },
      })

      const post = await db.Post.create(
        { title: 'Test' },
        { cascade: false }
      )

      const tags = await post.tags
      expect(tags.length).toBe(0)
    })

    it('should use default maxDepth when not specified', async () => {
      const { db } = DB({
        Root: { children: ['->Child'] },
        Child: { name: 'string' },
      })

      // cascade: true without maxDepth should use sensible default
      const root = await db.Root.create(
        { name: 'Test' },
        { cascade: true }
      )

      const children = await root.children
      expect(children.length).toBeGreaterThan(0)
    })

    it('should allow filtering which types to cascade', async () => {
      const { db } = DB({
        Store: {
          products: ['->Product'],
          employees: ['->Employee'],
        },
        Product: { name: 'string' },
        Employee: { name: 'string' },
      })

      const store = await db.Store.create(
        { name: 'MyStore' },
        {
          cascade: true,
          maxDepth: 1,
          cascadeTypes: ['Product'], // Only cascade Product
        }
      )

      const products = await store.products
      expect(products.length).toBeGreaterThan(0)

      const employees = await store.employees
      expect(employees.length).toBe(0) // Not cascaded
    })
  })

  describe('Error handling', () => {
    it('should handle cascade errors gracefully', async () => {
      const { db } = DB({
        Wrapper: { items: ['->Item'] },
        Item: { name: 'string' },
      })

      const errors: any[] = []

      const wrapper = await db.Wrapper.create(
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
    })

    it('should support stopOnError option', async () => {
      const { db } = DB({
        Container: {
          a: ['->TypeA'],
          b: ['->TypeB'],
        },
        TypeA: { name: 'string' },
        TypeB: { name: 'string' },
      })

      const progress: any[] = []

      await db.Container.create(
        {},
        {
          cascade: true,
          maxDepth: 1,
          stopOnError: true,
          onProgress: (p) => progress.push(p),
        }
      )

      // Should still generate entities if no errors occur
      expect(progress.length).toBeGreaterThan(0)
    })
  })
})
