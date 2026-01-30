/**
 * Tests for backward fuzzy (<~) semantic search with inverted edges
 *
 * The `<~` operator combines semantic/fuzzy matching with inverted edge direction:
 * - Uses AI/embedding-based similarity to find the best match
 * - Edge direction is inverted (target points to source)
 * - Enables grounding generated content against reference data
 *
 * These tests validate:
 * 1. Semantic match with inverted edges
 * 2. Ground content against reference data
 * 3. Edge direction is inverted
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'

// TODO: Advanced feature tests - needs investigation
describe('Backward Fuzzy (<~) Resolution', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('Semantic match with inverted edges', () => {
    it('should find semantically related entities with inverted edges', async () => {
      const { db } = DB({
        ICP: {
          as: 'Who are they? <~Occupation',
          at: 'Where do they work? <~Industry',
        },
        Occupation: { title: 'string', description: 'string' },
        Industry: { name: 'string' },
      })

      await db.Occupation.create({ title: 'Software Developer', description: 'Writes code' })
      await db.Occupation.create({ title: 'Data Scientist', description: 'Analyzes data' })
      await db.Industry.create({ name: 'Technology' })

      const icp = await db.ICP.create({
        asHint: 'Engineers who build software',
        atHint: 'Tech companies',
      })

      const occupation = await icp.as
      expect(occupation.title).toBe('Software Developer')
    })

    it('should use hint field to guide semantic matching', async () => {
      const { db } = DB({
        Lead: {
          role: '<~JobRole',
        },
        JobRole: { title: 'string', department: 'string' },
      })

      await db.JobRole.create({ title: 'Marketing Manager', department: 'Marketing' })
      await db.JobRole.create({ title: 'VP of Sales', department: 'Sales' })
      await db.JobRole.create({ title: 'Software Engineer', department: 'Engineering' })

      const lead = await db.Lead.create({
        roleHint: 'Someone in charge of marketing strategy',
      })

      const role = await lead.role
      expect(role.department).toBe('Marketing')
    })

    it('should match by semantic similarity not exact string match', async () => {
      const { db } = DB({
        Query: {
          category: '<~Category',
        },
        Category: { name: 'string', description: 'string' },
      })

      await db.Category.create({
        name: 'Artificial Intelligence',
        description: 'Machine learning and neural networks',
      })
      await db.Category.create({
        name: 'Web Development',
        description: 'Frontend and backend programming',
      })

      const query = await db.Query.create({
        categoryHint: 'Deep learning models',
      })

      // Even though 'Deep learning models' doesn't match 'Artificial Intelligence' exactly,
      // semantic search should find it
      const category = await query.category
      expect(category.name).toBe('Artificial Intelligence')
    })
  })

  describe('Ground content against reference data', () => {
    it('should ground generated content against reference data', async () => {
      const { db } = DB({
        Startup: {
          industry: 'What industry? <~Industry',
          $instructions: 'Generate a B2B startup',
        },
        Industry: { name: 'string', naicsCode: 'string' },
      })

      await db.Industry.create({ name: 'Software Publishers', naicsCode: '5112' })
      await db.Industry.create({ name: 'Financial Services', naicsCode: '5231' })

      const startup = await db.Startup.create({ name: 'Acme' })
      const industry = await startup.industry

      expect(['Software Publishers', 'Financial Services']).toContain(industry.name)
      expect(industry.naicsCode).toBeDefined()
    })

    it('should use existing reference data instead of generating new', async () => {
      const { db } = DB({
        Company: {
          sector: 'Business sector <~Sector',
        },
        Sector: { name: 'string', code: 'string' },
      })

      const tech = await db.Sector.create({ name: 'Technology', code: 'TECH' })
      const healthcare = await db.Sector.create({ name: 'Healthcare', code: 'HLTH' })

      const company = await db.Company.create({
        name: 'MedTech Inc',
        sectorHint: 'Medical technology and healthcare',
      })

      const sector = await company.sector

      // Should match an existing sector, not create a new one
      const allSectors = await db.Sector.list()
      expect(allSectors).toHaveLength(2) // No new sectors created

      expect([tech.$id, healthcare.$id]).toContain(sector.$id)
    })

    it('should ground against reference data with prompt context', async () => {
      const { db } = DB({
        Product: {
          $instructions: 'Generate a product description',
          category: 'What category? <~ProductCategory',
        },
        ProductCategory: { name: 'string', department: 'string' },
      })

      await db.ProductCategory.create({ name: 'Electronics', department: 'Consumer Goods' })
      await db.ProductCategory.create({ name: 'Furniture', department: 'Home & Living' })
      await db.ProductCategory.create({ name: 'Apparel', department: 'Fashion' })

      const product = await db.Product.create({
        name: 'Wireless Bluetooth Headphones',
        categoryHint: 'Electronic audio devices',
      })

      const category = await product.category
      expect(category.name).toBe('Electronics')
      expect(category.department).toBe('Consumer Goods')
    })
  })

  describe('Edge direction is inverted', () => {
    it('should create backward edges for <~ references', async () => {
      const { db } = DB({
        ICP: { occupation: '<~Occupation' },
        Occupation: { title: 'string' },
      })

      await db.Occupation.create({ title: 'Engineer' })
      const icp = await db.ICP.create({ occupationHint: 'technical role' })

      // Edge should be: Occupation -> ICP (not ICP -> Occupation)
      const edges = await db.Edge.find({ to: 'ICP', name: 'occupation' })
      expect(edges[0]?.from).toBe('Occupation')
      expect(edges[0]?.direction).toBe('backward')
    })

    it('should store correct edge metadata for <~ operator', async () => {
      const { db } = DB({
        Lead: { persona: '<~Persona' },
        Persona: { name: 'string', traits: 'string' },
      })

      await db.Persona.create({ name: 'Enterprise Buyer', traits: 'Risk-averse, detail-oriented' })
      await db.Lead.create({ personaHint: 'Corporate decision maker' })

      const edges = await db.Edge.find({ name: 'persona' })
      expect(edges).toHaveLength(1)
      expect(edges[0]?.direction).toBe('backward')
      expect(edges[0]?.matchMode).toBe('fuzzy')
      expect(edges[0]?.from).toBe('Persona')
      expect(edges[0]?.to).toBe('Lead')
    })

    it('should distinguish <~ from <- in edge storage', async () => {
      const { db } = DB({
        Document: {
          category: '<~Category', // backward fuzzy
          author: '<-Author', // backward exact
        },
        Category: { name: 'string' },
        Author: { name: 'string' },
      })

      await db.Category.create({ name: 'Technical' })
      await db.Author.create({ name: 'John' })

      await db.Document.create({
        title: 'Guide',
        categoryHint: 'Technical documentation',
        author: 'author-id',
      })

      const fuzzyEdges = await db.Edge.find({ name: 'category' })
      const exactEdges = await db.Edge.find({ name: 'author' })

      expect(fuzzyEdges[0]?.matchMode).toBe('fuzzy')
      expect(exactEdges[0]?.matchMode).toBe('exact')

      // Both should have backward direction
      expect(fuzzyEdges[0]?.direction).toBe('backward')
      expect(exactEdges[0]?.direction).toBe('backward')
    })
  })

  describe('Array backward fuzzy references', () => {
    it('should handle backward fuzzy array references', async () => {
      const { db } = DB({
        Profile: {
          skills: ['<~Skill'],
        },
        Skill: { name: 'string', level: 'string' },
      })

      await db.Skill.create({ name: 'JavaScript', level: 'Expert' })
      await db.Skill.create({ name: 'Python', level: 'Intermediate' })
      await db.Skill.create({ name: 'SQL', level: 'Advanced' })

      const profile = await db.Profile.create({
        name: 'Developer Profile',
        skillsHint: 'Frontend programming languages',
      })

      const skills = await profile.skills
      expect(skills.length).toBeGreaterThan(0)
      // JavaScript should be in the results for frontend programming
      expect(skills.some((s: any) => s.name === 'JavaScript')).toBe(true)
    })

    it('should find multiple semantic matches for array fields', async () => {
      const { db } = DB({
        JobPosting: {
          requirements: ['<~Requirement'],
        },
        Requirement: { skill: 'string', category: 'string' },
      })

      await db.Requirement.create({ skill: 'React', category: 'Frontend' })
      await db.Requirement.create({ skill: 'Node.js', category: 'Backend' })
      await db.Requirement.create({ skill: 'Project Management', category: 'Soft Skills' })

      const job = await db.JobPosting.create({
        title: 'Full Stack Developer',
        requirementsHint: 'Web development technologies',
      })

      const requirements = await job.requirements
      // Should match both React and Node.js as web development technologies
      const categories = requirements.map((r: any) => r.category)
      expect(categories).toContain('Frontend')
      expect(categories).toContain('Backend')
    })
  })

  describe('Prompt with backward fuzzy operator', () => {
    it('should extract prompt from <~ field definition', async () => {
      const { db } = DB({
        Customer: {
          segment: 'What market segment? <~Segment',
        },
        Segment: { name: 'string', size: 'string' },
      })

      await db.Segment.create({ name: 'Enterprise', size: 'Large' })
      await db.Segment.create({ name: 'SMB', size: 'Small' })

      const customer = await db.Customer.create({
        name: 'Big Corp',
        segmentHint: 'Large corporations with 1000+ employees',
      })

      const segment = await customer.segment
      expect(segment.name).toBe('Enterprise')
    })

    it('should use prompt context for semantic matching', async () => {
      const { db } = DB({
        Survey: {
          targetAudience: 'Who should take this survey? <~AudienceType',
        },
        AudienceType: { name: 'string', demographics: 'string' },
      })

      await db.AudienceType.create({
        name: 'Young Professionals',
        demographics: 'Ages 25-35, college educated, urban',
      })
      await db.AudienceType.create({
        name: 'Senior Citizens',
        demographics: 'Ages 65+, retired',
      })

      const survey = await db.Survey.create({
        title: 'Career Development Survey',
        targetAudienceHint: 'Working adults early in their careers',
      })

      const audience = await survey.targetAudience
      expect(audience.name).toBe('Young Professionals')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty reference data gracefully', async () => {
      const { db } = DB({
        Query: {
          match: '<~Reference',
        },
        Reference: { value: 'string' },
      })

      // No reference data created

      const query = await db.Query.create({
        matchHint: 'something to match',
      })

      const match = await query.match
      // Should return null/undefined when no matches exist
      expect(match == null).toBe(true)
    })

    it('should handle optional backward fuzzy fields', async () => {
      const { db } = DB({
        Item: {
          tag: '<~Tag?',
        },
        Tag: { label: 'string' },
      })

      await db.Tag.create({ label: 'Important' })

      // Create without providing hint - should be null
      const item = await db.Item.create({ name: 'Test' })
      const tag = await item.tag
      expect(tag == null).toBe(true)
    })

    it('should return best match when multiple candidates exist', async () => {
      const { db } = DB({
        Search: {
          result: '<~Item',
        },
        Item: { name: 'string', keywords: 'string' },
      })

      await db.Item.create({ name: 'Apple iPhone', keywords: 'smartphone, mobile, iOS' })
      await db.Item.create({ name: 'Apple MacBook', keywords: 'laptop, computer, macOS' })
      await db.Item.create({ name: 'Samsung Galaxy', keywords: 'smartphone, mobile, Android' })

      const search = await db.Search.create({
        query: 'mobile phone',
        resultHint: 'iOS smartphone device',
      })

      const result = await search.result
      // Should match Apple iPhone as it's most semantically similar to iOS smartphone
      expect(result.name).toBe('Apple iPhone')
    })
  })
})
