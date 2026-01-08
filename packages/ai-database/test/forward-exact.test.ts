/**
 * Tests for forward exact (->) generation and linking
 *
 * Tests that the forward exact operator generates and links entities:
 * - Auto-generate target entity when creating with -> field
 * - Generate array of entities for -> array fields
 * - Use prompt context for generation
 * - Skip generation if value already provided
 *
 * Forward exact (->) is a strict reference that creates real foreign key
 * relationships and can trigger AI generation when the target doesn't exist.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'

describe('Forward Exact (->) Generation', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('Auto-generate target entity', () => {
    it('should generate target entity when creating with -> field', async () => {
      const { db } = DB({
        Startup: { idea: 'What is the core idea? ->Idea' },
        Idea: { description: 'string' }
      })

      const startup = await db.Startup.create({ name: 'Acme' })

      // The idea field should be populated with a generated Idea
      const idea = await startup.idea
      expect(idea).toBeDefined()
      expect(idea.$type).toBe('Idea')
      expect(idea.description).toBeDefined()
    })

    it('should set the generated entity ID on the parent', async () => {
      const { db } = DB({
        Startup: { idea: 'What is the core idea? ->Idea' },
        Idea: { description: 'string' }
      })

      const startup = await db.Startup.create({ name: 'Acme' })
      const idea = await startup.idea

      // The startup should have a reference to the generated idea
      expect(idea.$id).toBeDefined()

      // The idea should be retrievable from the database
      const retrievedIdea = await db.Idea.get(idea.$id)
      expect(retrievedIdea).toBeDefined()
      expect(retrievedIdea.description).toBe(idea.description)
    })
  })

  describe('Generate array of entities', () => {
    it('should generate array of entities for -> array fields', async () => {
      const { db } = DB({
        Startup: { founders: ['Who are the founders? ->Founder'] },
        Founder: { name: 'string', role: 'string' }
      })

      const startup = await db.Startup.create({ name: 'Acme' })
      const founders = await startup.founders
      expect(founders.length).toBeGreaterThan(0)
      expect(founders[0].$type).toBe('Founder')
    })

    it('should generate multiple entities with populated fields', async () => {
      const { db } = DB({
        Team: { members: ['Who are the team members? ->Member'] },
        Member: { name: 'string', title: 'string' }
      })

      const team = await db.Team.create({ name: 'Engineering' })
      const members = await team.members

      expect(members.length).toBeGreaterThan(0)
      for (const member of members) {
        expect(member.$type).toBe('Member')
        expect(member.name).toBeDefined()
        expect(member.title).toBeDefined()
      }
    })

    it('should store generated array entities in the database', async () => {
      const { db } = DB({
        Startup: { founders: ['Who are the founders? ->Founder'] },
        Founder: { name: 'string', role: 'string' }
      })

      const startup = await db.Startup.create({ name: 'Acme' })
      const founders = await startup.founders

      // Each generated founder should be retrievable
      for (const founder of founders) {
        const retrieved = await db.Founder.get(founder.$id)
        expect(retrieved).toBeDefined()
        expect(retrieved.$id).toBe(founder.$id)
      }
    })
  })

  describe('Use prompt context for generation', () => {
    it('should use prompt context for generation', async () => {
      const { db } = DB({
        Startup: {
          $instructions: 'This is a B2B SaaS startup',
          idea: 'What problem does this solve? ->Idea'
        },
        Idea: { problem: 'string', solution: 'string' }
      })

      const startup = await db.Startup.create({ name: 'Acme' })
      const idea = await startup.idea
      expect(idea.problem).toBeDefined()
      expect(idea.solution).toBeDefined()
    })

    it('should incorporate entity context into generation', async () => {
      const { db } = DB({
        Company: {
          name: 'string',
          industry: 'string',
          product: 'What product does this company make based on their industry? ->Product'
        },
        Product: { name: 'string', description: 'string' }
      })

      const company = await db.Company.create({
        name: 'TechCorp',
        industry: 'Healthcare'
      })

      const product = await company.product
      expect(product).toBeDefined()
      expect(product.$type).toBe('Product')
      expect(product.name).toBeDefined()
      expect(product.description).toBeDefined()
    })

    it('should use field prompt to guide generation', async () => {
      const { db } = DB({
        Project: {
          summary: 'Generate a technical summary ->Summary'
        },
        Summary: { title: 'string', overview: 'string', keyPoints: ['string'] }
      })

      const project = await db.Project.create({ name: 'AI Assistant' })
      const summary = await project.summary

      expect(summary).toBeDefined()
      expect(summary.title).toBeDefined()
      expect(summary.overview).toBeDefined()
      expect(summary.keyPoints).toBeDefined()
    })
  })

  describe('Skip generation if value provided', () => {
    it('should not generate if value already provided', async () => {
      const { db } = DB({
        Post: { author: '->Author' },
        Author: { name: 'string' }
      })

      const author = await db.Author.create({ name: 'John' })
      const post = await db.Post.create({ title: 'Hello', author: author.$id })

      const postAuthor = await post.author
      expect(postAuthor.$id).toBe(author.$id)  // Reused existing, not generated
    })

    it('should not generate if entity reference provided', async () => {
      const { db } = DB({
        Startup: { idea: 'What is the core idea? ->Idea' },
        Idea: { description: 'string' }
      })

      const existingIdea = await db.Idea.create({ description: 'Existing idea' })
      const startup = await db.Startup.create({
        name: 'Acme',
        idea: existingIdea.$id
      })

      const idea = await startup.idea
      expect(idea.$id).toBe(existingIdea.$id)
      expect(idea.description).toBe('Existing idea')
    })

    it('should not generate array if array values provided', async () => {
      const { db } = DB({
        Startup: { founders: ['Who are the founders? ->Founder'] },
        Founder: { name: 'string', role: 'string' }
      })

      const founder1 = await db.Founder.create({ name: 'Alice', role: 'CEO' })
      const founder2 = await db.Founder.create({ name: 'Bob', role: 'CTO' })

      const startup = await db.Startup.create({
        name: 'Acme',
        founders: [founder1.$id, founder2.$id]
      })

      const founders = await startup.founders
      expect(founders).toHaveLength(2)
      expect(founders.map(f => f.$id)).toContain(founder1.$id)
      expect(founders.map(f => f.$id)).toContain(founder2.$id)
    })
  })

  describe('Edge cases and validation', () => {
    it('should handle optional forward exact fields', async () => {
      const { db } = DB({
        Post: { category: '->Category?' },
        Category: { name: 'string' }
      })

      // Creating without optional field should not generate
      const post = await db.Post.create({ title: 'Hello' })
      const category = await post.category
      // Optional field should be null/undefined when not provided - no generation
      expect(category == null).toBe(true)
    })

    it('should handle generation with nested forward exact', async () => {
      const { db } = DB({
        Company: { ceo: 'Who is the CEO? ->Person' },
        Person: { name: 'string', bio: 'Write a short bio ->Bio' },
        Bio: { content: 'string' }
      })

      const company = await db.Company.create({ name: 'TechCorp' })
      const ceo = await company.ceo

      expect(ceo).toBeDefined()
      expect(ceo.$type).toBe('Person')
      expect(ceo.name).toBeDefined()

      // The nested forward exact should also be generated
      const bio = await ceo.bio
      expect(bio).toBeDefined()
      expect(bio.$type).toBe('Bio')
      expect(bio.content).toBeDefined()
    })

    it('should create proper edge metadata for generated relationships', async () => {
      const { db } = DB({
        Startup: { idea: 'What is the core idea? ->Idea' },
        Idea: { description: 'string' }
      })

      await db.Startup.create({ name: 'Acme' })

      // Verify edge metadata is created
      const edges = await db.Edge.find({ from: 'Startup', name: 'idea' })
      expect(edges).toHaveLength(1)
      expect(edges[0].direction).toBe('forward')
      expect(edges[0].matchMode).toBe('exact')
      expect(edges[0].to).toBe('Idea')
    })
  })
})
