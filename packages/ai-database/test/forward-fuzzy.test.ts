/**
 * Tests for forward fuzzy (~>) searches then generates
 *
 * Forward fuzzy (~>) differs from forward exact (->) in that it first attempts
 * to find an existing entity via semantic search before generating a new one.
 *
 * Tests verify:
 * - Search existing entities via semantic similarity first
 * - If a match is found above threshold, reuse the existing entity
 * - If no match is found, generate a new entity
 * - Respect configurable similarity threshold
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'

describe('Forward Fuzzy (~>) Resolution', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('Find existing via semantic search', () => {
    it('should find existing entity via semantic search', async () => {
      const { db } = DB({
        Startup: { customer: 'Who is the customer? ~>Customer' },
        Customer: { name: 'string', description: 'string' },
      })

      const existingCustomer = await db.Customer.create({
        name: 'Enterprise Buyer',
        description: 'VP of Engineering at Fortune 500',
      })

      const startup = await db.Startup.create({
        name: 'Acme',
        customerHint: 'Senior tech leaders at big companies',
      })

      const customer = await startup.customer
      expect(customer.$id).toBe(existingCustomer.$id) // Reused existing!
    })

    it('should match based on semantic similarity not exact text', async () => {
      const { db } = DB({
        Product: { targetUser: 'Who uses this product? ~>UserPersona' },
        UserPersona: { name: 'string', description: 'string' },
      })

      const existingPersona = await db.UserPersona.create({
        name: 'Software Developer',
        description: 'Professional who writes code and builds applications',
      })

      const product = await db.Product.create({
        name: 'Code Editor Pro',
        targetUserHint: 'Engineers who build software', // Semantically similar
      })

      const persona = await product.targetUser
      expect(persona.$id).toBe(existingPersona.$id) // Matched via semantic similarity
    })

    it('should select the most similar entity when multiple exist', async () => {
      const { db } = DB({
        Campaign: { audience: 'Target audience for campaign ~>Audience' },
        Audience: { name: 'string', description: 'string' },
      })

      await db.Audience.create({
        name: 'Small Business',
        description: 'Small business owners with less than 10 employees',
      })

      const enterpriseAudience = await db.Audience.create({
        name: 'Enterprise',
        description: 'Large corporations with 1000+ employees',
      })

      await db.Audience.create({
        name: 'Consumer',
        description: 'Individual consumers for B2C products',
      })

      const campaign = await db.Campaign.create({
        name: 'Enterprise Sales Push',
        audienceHint: 'Big companies with thousands of employees',
      })

      const audience = await campaign.audience
      expect(audience.$id).toBe(enterpriseAudience.$id) // Most semantically similar
    })
  })

  describe('Generate if no semantic match', () => {
    it('should generate new entity if no semantic match', async () => {
      const { db } = DB({
        Startup: { customer: 'Who is the customer? ~>Customer' },
        Customer: { name: 'string', description: 'string' },
      })

      const startup = await db.Startup.create({
        name: 'Acme',
        customerHint: 'Small business owners in retail',
      })

      const customer = await startup.customer
      expect(customer).toBeDefined()
      expect(customer.$type).toBe('Customer')
      expect(customer.$generated).toBe(true)
    })

    it('should generate when no entities of target type exist', async () => {
      const { db } = DB({
        Article: { author: 'Who wrote this article? ~>Author' },
        Author: { name: 'string', bio: 'string' },
      })

      // No authors exist yet
      const article = await db.Article.create({
        title: 'Introduction to AI',
        authorHint: 'An expert in machine learning',
      })

      const author = await article.author
      expect(author).toBeDefined()
      expect(author.$type).toBe('Author')
      expect(author.$generated).toBe(true)
      expect(author.name).toBeDefined()
    })

    it('should generate when threshold is very strict', async () => {
      const { db } = DB({
        Project: { lead: 'Project lead ~>Person', $fuzzyThreshold: 0.99 },
        Person: { name: 'string', role: 'string' },
      })

      // Create a person - with 0.99 threshold, no match should be found
      await db.Person.create({
        name: 'Chef Antonio',
        role: 'Head chef at Italian restaurant',
      })

      const project = await db.Project.create({
        name: 'AI Research Project',
        leadHint: 'Machine learning researcher with PhD',
      })

      const lead = await project.lead
      // With very strict threshold, should generate new person
      expect(lead.$generated).toBe(true)
      expect(lead.role).toBeDefined()
    })
  })

  describe('Similarity threshold configuration', () => {
    it('should respect similarity threshold', async () => {
      const { db } = DB({
        Startup: {
          customer: 'Who is the customer? ~>Customer',
          $fuzzyThreshold: 0.85,
        },
        Customer: { name: 'string' },
      })

      await db.Customer.create({ name: 'Developer', description: 'Writes code' })

      const startup = await db.Startup.create({
        name: 'Acme',
        customerHint: 'Healthcare administrators',
      })

      const customer = await startup.customer
      expect(customer.$generated).toBe(true)
    })

    it('should use default threshold when not specified', async () => {
      const { db } = DB({
        Post: { category: 'Post category ~>Category' },
        Category: { name: 'string', description: 'string' },
      })

      const techCategory = await db.Category.create({
        name: 'Technology',
        description: 'Posts about software, hardware, and tech trends',
      })

      const post = await db.Post.create({
        title: 'New JavaScript Framework',
        categoryHint: 'Software and programming topics',
      })

      const category = await post.category
      // With default threshold, should match tech category
      expect(category.$id).toBe(techCategory.$id)
    })

    it('should support entity-level threshold override', async () => {
      // Test strict threshold causes generation instead of matching
      const { db } = DB({
        Event: {
          venue: 'Where is the event? ~>Venue',
          $fuzzyThreshold: 0.99,
        },
        Venue: { name: 'string', address: 'string' },
      })

      await db.Venue.create({ name: 'Tech Hub', address: '123 Main St' })

      const event = await db.Event.create({
        name: 'AI Conference',
        venueHint: 'A conference center downtown',
      })

      const venue = await event.venue
      // Very strict threshold should cause generation
      expect(venue.$generated).toBe(true)
    })
  })

  describe('Array fields with fuzzy resolution', () => {
    it('should resolve array of fuzzy references', async () => {
      const { db } = DB({
        Team: { members: ['Team members ~>Person'] },
        Person: { name: 'string', skills: 'string' },
      })

      const alice = await db.Person.create({
        name: 'Alice',
        skills: 'Frontend development, React, TypeScript',
      })

      const bob = await db.Person.create({
        name: 'Bob',
        skills: 'Backend development, Node.js, databases',
      })

      const team = await db.Team.create({
        name: 'Full Stack Team',
        membersHint: ['React frontend developer', 'Node.js backend engineer'],
      })

      const members = await team.members
      expect(members).toHaveLength(2)
      expect(members.map((m) => m.$id)).toContain(alice.$id)
      expect(members.map((m) => m.$id)).toContain(bob.$id)
    })

    it('should resolve array hints to entities of correct type', async () => {
      const { db } = DB({
        Project: { contributors: ['Project contributors ~>Developer'] },
        Developer: { name: 'string', expertise: 'string' },
      })

      await db.Developer.create({
        name: 'Jane',
        expertise: 'Machine learning and data science',
      })

      await db.Developer.create({
        name: 'Bob',
        expertise: 'DevOps and cloud infrastructure',
      })

      const project = await db.Project.create({
        name: 'AI Platform',
        contributorsHint: [
          'Data scientist with ML background',
          'DevOps engineer with cloud expertise',
        ],
      })

      const contributors = await project.contributors
      // Should have resolved both hints to entities
      expect(contributors.length).toBeGreaterThanOrEqual(2)
      for (const c of contributors) {
        expect(c.$id).toBeDefined()
        expect(c.$type).toBe('Developer')
      }
    })
  })

  describe('Edge metadata and tracking', () => {
    it('should store fuzzy match metadata on relationship', async () => {
      const { db } = DB({
        Order: { product: 'Ordered product ~>Product' },
        Product: { name: 'string', category: 'string' },
      })

      await db.Product.create({
        name: 'MacBook Pro',
        category: 'Computers',
      })

      const order = await db.Order.create({
        orderId: 'ORD-123',
        productHint: 'Apple laptop for development',
      })

      // Check edge metadata
      const edges = await db.Edge.find({ from: 'Order', name: 'product' })
      expect(edges).toHaveLength(1)
      expect(edges[0].to).toBe('Product')
    })

    it('should mark generated entities with $generated flag', async () => {
      const { db } = DB({
        Request: { assignee: 'Who handles this request? ~>Agent', $fuzzyThreshold: 0.99 },
        Agent: { name: 'string', department: 'string' },
      })

      const request = await db.Request.create({
        title: 'Technical Support',
        assigneeHint: 'Support specialist in technical issues',
      })

      const assignee = await request.assignee
      // With very high threshold and no existing agents, should generate
      expect(assignee.$generated).toBe(true)
      expect(assignee.$type).toBe('Agent')
      expect(assignee.name).toBeDefined()
    })
  })

  describe('Context inheritance for generation', () => {
    it('should generate related entity with correct type', async () => {
      const { db } = DB({
        Company: {
          $instructions: 'This is a B2B enterprise software company',
          industry: 'string',
          competitor: 'Main competitor ~>Company',
        },
      })

      const company = await db.Company.create({
        name: 'Salesforce',
        industry: 'CRM',
        competitorHint: 'Another enterprise CRM provider',
      })

      const competitor = await company.competitor
      expect(competitor).toBeDefined()
      // Generated competitor should be a Company entity with industry field
      expect(competitor.$type).toBe('Company')
      expect(competitor.industry).toBeDefined()
    })

    it('should generate entity with all expected fields', async () => {
      const { db } = DB({
        Task: {
          owner: 'Technical owner responsible for implementation ~>Engineer',
        },
        Engineer: { name: 'string', specialty: 'string', level: 'string' },
      })

      const task = await db.Task.create({
        title: 'Implement OAuth2',
        ownerHint: 'Security-focused engineer',
      })

      const owner = await task.owner
      expect(owner.$type).toBe('Engineer')
      // Generated engineer should have all expected fields
      expect(owner.name).toBeDefined()
      expect(owner.specialty).toBeDefined()
      expect(owner.level).toBeDefined()
    })
  })
})
