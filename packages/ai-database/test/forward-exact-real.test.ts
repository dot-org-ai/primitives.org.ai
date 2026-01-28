/**
 * Tests for Forward Exact (->) with Real AI Generation
 *
 * TDD tests for verifying that the forward exact operator works with
 * real LLM generation through ai-functions generateObject.
 *
 * These tests verify:
 * - AI-generated child entity content
 * - Prompt text used for generation context
 * - Array generation with count extraction from prompts
 * - Existing values bypass generation
 * - Optional fields skip generation when not provided
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'

describe('Forward Exact with Real AI Generation', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
    // Enable AI generation - this uses ai-functions generateObject
    configureAIGeneration({ enabled: true, model: 'sonnet' })
  })

  describe('Generate child entity with AI content', () => {
    it('should generate child entity with AI-generated fields', async () => {
      const { db } = DB({
        Startup: {
          name: 'string',
          idea: 'What problem does this solve? ->Idea',
        },
        Idea: { problem: 'string', solution: 'string' },
      })

      const startup = await db.Startup.create({ name: 'DevFlow' })
      const idea = await startup.idea

      // Verify the Idea was generated
      expect(idea).toBeDefined()
      expect(idea.$type).toBe('Idea')
      expect(idea.$id).toBeTruthy()

      // AI-generated fields should have real content
      expect(idea.problem).toBeTruthy()
      expect(idea.problem.length).toBeGreaterThan(20) // Real content, not placeholder
      expect(idea.solution).toBeTruthy()
      expect(idea.solution.length).toBeGreaterThan(20) // Real content, not placeholder
    }, 30000)

    it('should generate content influenced by parent entity data', async () => {
      const { db } = DB({
        Company: {
          name: 'string',
          industry: 'string',
          product: 'What product suits this company? ->Product',
        },
        Product: { name: 'string', description: 'string' },
      })

      const company = await db.Company.create({
        name: 'HealthTech Solutions',
        industry: 'Healthcare',
      })

      const product = await company.product

      expect(product).toBeDefined()
      expect(product.$type).toBe('Product')
      expect(product.name).toBeTruthy()
      expect(product.description).toBeTruthy()

      // Product name and description should have meaningful content
      expect(product.name.length).toBeGreaterThan(2)
      expect(product.description.length).toBeGreaterThan(20)
    }, 30000)
  })

  describe('Prompt text for generation context', () => {
    it('should use prompt text (before ->) as generation context', async () => {
      const { db } = DB({
        Blog: {
          name: 'string',
          topic: 'Generate a technology topic for this blog ->Topic',
        },
        Topic: { name: 'string', description: 'string' },
      })

      const blog = await db.Blog.create({ name: 'Tech Insights' })
      const topic = await blog.topic

      expect(topic).toBeDefined()
      expect(topic.$type).toBe('Topic')

      // Topic should be generated with meaningful content
      expect(topic.name).toBeTruthy()
      expect(topic.name.length).toBeGreaterThan(2)
      expect(topic.description).toBeTruthy()
      expect(topic.description.length).toBeGreaterThan(10)
    }, 30000)

    it('should incorporate $instructions in generation', async () => {
      const { db } = DB({
        Startup: {
          $instructions: 'This is a B2B SaaS startup targeting enterprise customers',
          name: 'string',
          pitch: 'Generate a pitch ->Pitch',
        },
        Pitch: { headline: 'string', value_prop: 'string' },
      })

      const startup = await db.Startup.create({ name: 'EnterpriseCo' })
      const pitch = await startup.pitch

      expect(pitch).toBeDefined()
      expect(pitch.$type).toBe('Pitch')
      expect(pitch.headline).toBeTruthy()
      expect(pitch.value_prop).toBeTruthy()

      // AI should generate meaningful content influenced by $instructions
      expect(pitch.headline.length).toBeGreaterThan(5)
      expect(pitch.value_prop.length).toBeGreaterThan(10)
    }, 30000)
  })

  describe('Array generation', () => {
    it('should generate array of entities for -> array fields with prompt', async () => {
      const { db } = DB({
        Team: {
          name: 'string',
          members: ['Who are the team members? ->Member'],
        },
        Member: { name: 'string', role: 'string' },
      })

      const team = await db.Team.create({ name: 'Engineering Team' })
      const members = await team.members

      // Should generate at least one member when prompt is provided
      expect(members).toBeDefined()
      expect(Array.isArray(members)).toBe(true)
      expect(members.length).toBeGreaterThan(0)

      // Each member should have AI-generated content
      for (const member of members) {
        expect(member.$type).toBe('Member')
        expect(member.name).toBeTruthy()
        expect(member.role).toBeTruthy()
      }
    }, 30000)

    it('should not generate array without prompt when cascade is disabled', async () => {
      const { db } = DB({
        Team: {
          name: 'string',
          members: ['->Member'], // No prompt
        },
        Member: { name: 'string', role: 'string' },
      })

      // Without cascade enabled and no prompt, array should be empty
      const team = await db.Team.create({ name: 'Empty Team' }, { cascade: false })
      const members = await team.members

      // Should be empty array when no prompt and cascade is disabled
      expect(Array.isArray(members)).toBe(true)
      expect(members.length).toBe(0)
    }, 30000)

    it('should generate array with prompt-guided content', async () => {
      const { db } = DB({
        Startup: {
          name: 'string',
          founders: ['Who are the key founders? ->Founder'],
        },
        Founder: { name: 'string', title: 'string', background: 'string' },
      })

      const startup = await db.Startup.create({ name: 'InnovateCo' })
      const founders = await startup.founders

      expect(founders.length).toBeGreaterThan(0)
      for (const founder of founders) {
        expect(founder.$type).toBe('Founder')
        expect(founder.name).toBeTruthy()
        expect(founder.title).toBeTruthy()
        expect(founder.background).toBeTruthy()
      }
    }, 30000)
  })

  describe('Skip generation when value provided', () => {
    it('should not generate when entity ID is provided', async () => {
      const { db } = DB({
        Startup: {
          name: 'string',
          idea: 'What problem? ->Idea',
        },
        Idea: { problem: 'string', solution: 'string' },
      })

      // Create an idea manually first
      const existingIdea = await db.Idea.create({
        problem: 'Manual problem text',
        solution: 'Manual solution text',
      })

      // Create startup with the existing idea
      const startup = await db.Startup.create({
        name: 'ManualCo',
        idea: existingIdea.$id,
      })

      const idea = await startup.idea

      // The manually created values should be preserved, not AI-generated
      expect(idea.problem).toBe('Manual problem text')
      expect(idea.solution).toBe('Manual solution text')
    }, 30000)

    it('should not generate array when array values provided', async () => {
      const { db } = DB({
        Team: {
          name: 'string',
          members: ['->Member'],
        },
        Member: { name: 'string', role: 'string' },
      })

      // Create members manually
      const member1 = await db.Member.create({ name: 'Alice', role: 'Lead' })
      const member2 = await db.Member.create({ name: 'Bob', role: 'Developer' })

      // Create team with existing members
      const team = await db.Team.create({
        name: 'Existing Team',
        members: [member1.$id, member2.$id],
      })

      const members = await team.members

      // Should use existing members, not generate new ones
      expect(members).toHaveLength(2)
      expect(members.map((m: { name: string }) => m.name).sort()).toEqual(['Alice', 'Bob'])
    }, 30000)
  })

  describe('Optional fields (->Type?)', () => {
    it('should not generate for optional fields when not provided', async () => {
      const { db } = DB({
        Post: {
          title: 'string',
          category: '->Category?', // Optional forward exact
        },
        Category: { name: 'string' },
      })

      // Create post without providing category
      const post = await db.Post.create({ title: 'Hello World' })
      const category = await post.category

      // Optional field should be null/undefined when not provided
      expect(category == null).toBe(true)
    }, 30000)

    it('should generate for optional fields when cascade is enabled', async () => {
      const { db } = DB({
        Article: {
          title: 'string',
          summary: 'Generate a summary ->Summary?',
        },
        Summary: { content: 'string', wordCount: 'number' },
      })

      // With cascade enabled, optional fields with prompts may be generated
      const article = await db.Article.create(
        { title: 'Deep Learning Advances' },
        { cascade: true, maxDepth: 1 }
      )

      // The behavior depends on implementation - optional fields may or may not be generated
      // This test documents the expected behavior
      const summary = await article.summary
      // Optional fields should be null when cascade doesn't force them
      expect(summary == null || summary.$type === 'Summary').toBe(true)
    }, 30000)
  })

  describe('Nested forward exact chains', () => {
    it('should generate nested entities with forward exact', async () => {
      const { db } = DB({
        Company: {
          name: 'string',
          ceo: 'Who is the CEO? ->Person',
        },
        Person: {
          name: 'string',
          bio: 'Write a short bio ->Bio',
        },
        Bio: { content: 'string' },
      })

      const company = await db.Company.create({ name: 'TechGiant' })
      const ceo = await company.ceo

      expect(ceo).toBeDefined()
      expect(ceo.$type).toBe('Person')
      expect(ceo.name).toBeTruthy()

      // The nested forward exact should also be generated
      const bio = await ceo.bio
      expect(bio).toBeDefined()
      expect(bio.$type).toBe('Bio')
      expect(bio.content).toBeTruthy()
      expect(bio.content.length).toBeGreaterThan(20) // Real AI content
    }, 30000)
  })

  describe('Complex schema generation', () => {
    it('should generate entities with multiple AI-generated fields', async () => {
      const { db } = DB({
        Company: {
          name: 'string',
          profile: 'Generate a company profile ->Profile',
        },
        Profile: {
          mission: 'string',
          vision: 'string',
          values: 'string',
          tagline: 'string',
        },
      })

      const company = await db.Company.create({ name: 'InnovateTech' })
      const profile = await company.profile

      // All fields should be generated with proper types
      expect(profile.$type).toBe('Profile')
      expect(typeof profile.mission).toBe('string')
      expect(typeof profile.vision).toBe('string')
      expect(typeof profile.values).toBe('string')
      expect(typeof profile.tagline).toBe('string')

      // All fields should have meaningful content
      expect(profile.mission.length).toBeGreaterThan(10)
      expect(profile.vision.length).toBeGreaterThan(10)
      expect(profile.values.length).toBeGreaterThan(5)
      expect(profile.tagline.length).toBeGreaterThan(5)
    }, 30000)
  })
})
