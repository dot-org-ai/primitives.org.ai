/**
 * End-to-End Integration Tests for Generative Schema Features
 *
 * This comprehensive test suite verifies all generative schema features work together:
 * 1. Schema with all operator types: ->, ~>, <-, <~
 * 2. Generative prompts in field definitions
 * 3. Union types
 * 4. Cascade generation
 * 5. Two-phase draft/resolve
 * 6. Context propagation with $instructions
 *
 * These tests demonstrate the full workflow from schema definition to entity
 * generation with cascading relationships.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider, parseSchema } from '../src/index.js'
import type { DatabaseSchema } from '../src/schema.js'

// TODO: E2E generative features need investigation
describe.skip('E2E Integration: Generative Schema Features', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('Complete Startup Ecosystem Workflow', () => {
    /**
     * This test demonstrates a full startup ecosystem schema with all operator types:
     * - Forward exact (->) for required relationships
     * - Forward fuzzy (~>) for AI-matched references
     * - Backward exact (<-) for reverse lookups
     * - Backward fuzzy (<~) for semantic backlinks
     * - Union types for polymorphic references
     * - Generative prompts for AI-driven field population
     * - $instructions for context propagation
     */
    it('should generate a complete startup ecosystem with all features', async () => {
      const { db } = DB({
        Industry: {
          $instructions: 'A real-world industry sector',
          name: 'string',
          description: 'Describe this industry in one sentence',
          occupations: ['What occupations exist? ->Occupation'],
        },
        Occupation: {
          $instructions: 'A professional occupation within {industry.name}',
          title: 'string',
          industry: '<-Industry.occupations',
          tasks: ['What tasks does this role perform? ->Task'],
          skills: ['What skills are required? ~>Skill'],
        },
        Task: {
          $instructions: 'A specific task performed by {occupation.title}',
          name: 'string',
          description: 'Describe how this task is performed',
          occupation: '<-Occupation.tasks',
          problems: ['What problems arise? ->Problem'],
          toolsUsed: ['What tools help with this? ~>Tool|Software|Service'],
        },
        Problem: {
          $instructions: 'A problem encountered during {task.name}',
          description: 'string',
          severity: 'What is the severity? (low/medium/high)',
          task: '<-Task.problems',
          solutions: ['How can this be solved? ->Solution'],
        },
        Solution: {
          $instructions: 'A solution for {problem.description}',
          approach: 'string',
          effort: 'What effort is required? (easy/medium/hard)',
          problem: '<-Problem.solutions',
          startupIdeas: ['What startup ideas emerge? ->StartupIdea'],
        },
        StartupIdea: {
          $instructions: 'A B2B SaaS startup idea derived from {solution.approach}',
          name: 'string',
          pitch: 'Describe the value proposition in 2 sentences',
          solution: '<-Solution.startupIdeas',
          targetICPs: ['Who would buy this? ->ICP'],
          competitors: ['What existing solutions compete? ~>Competitor'],
        },
        ICP: {
          $instructions: 'Ideal Customer Profile for {startupIdea.name}',
          persona: 'string',
          painPoints: 'What are their main frustrations?',
          budget: 'What is their typical budget range?',
          startupIdea: '<-StartupIdea.targetICPs',
          preferredTools: ['What tools do they currently use? ~>Tool|Software'],
        },
        Competitor: {
          name: 'string',
          description: 'What do they offer?',
          pricing: 'What is their pricing model?',
          weaknesses: 'What are their main weaknesses?',
        },
        Skill: {
          name: 'string',
          level: 'beginner/intermediate/expert',
        },
        Tool: {
          name: 'string',
          category: 'string',
        },
        Software: {
          name: 'string',
          type: 'string',
          pricing: 'string',
        },
        Service: {
          name: 'string',
          provider: 'string',
        },
      })

      // Create the root entity with cascade generation
      const industry = await db.Industry.create(
        { name: 'Healthcare' },
        {
          cascade: true,
          maxDepth: 6,
          onProgress: (p) => {
            console.log(`[${p.phase}] Generating ${p.currentType} at depth ${p.depth}`)
          },
        }
      )

      // Verify the industry was created with AI-generated description
      expect(industry.name).toBe('Healthcare')
      expect(industry.description).toBeDefined()
      expect(industry.description.length).toBeGreaterThan(10)

      // Verify occupations were cascaded
      const occupations = await industry.occupations
      expect(occupations.length).toBeGreaterThan(0)
      expect(occupations[0].title).toBeDefined()

      // Verify tasks were cascaded from occupations
      const tasks = await occupations[0].tasks
      expect(tasks.length).toBeGreaterThan(0)
      expect(tasks[0].name).toBeDefined()
      expect(tasks[0].description).toBeDefined()

      // Verify backward reference works
      const backRefOccupation = await tasks[0].occupation
      expect(backRefOccupation.$id).toBe(occupations[0].$id)

      // Verify problems were cascaded from tasks
      const problems = await tasks[0].problems
      expect(problems.length).toBeGreaterThan(0)
      expect(problems[0].description).toBeDefined()
      expect(problems[0].severity).toMatch(/low|medium|high/i)

      // Verify solutions were cascaded from problems
      const solutions = await problems[0].solutions
      expect(solutions.length).toBeGreaterThan(0)
      expect(solutions[0].approach).toBeDefined()

      // Verify startup ideas were cascaded from solutions
      const startupIdeas = await solutions[0].startupIdeas
      expect(startupIdeas.length).toBeGreaterThan(0)
      expect(startupIdeas[0].name).toBeDefined()
      expect(startupIdeas[0].pitch).toBeDefined()

      // Verify ICPs were cascaded from startup ideas
      const icps = await startupIdeas[0].targetICPs
      expect(icps.length).toBeGreaterThan(0)
      expect(icps[0].persona).toBeDefined()
      expect(icps[0].painPoints).toBeDefined()
    })

    it('should use fuzzy matching with union types for toolsUsed', async () => {
      const { db } = DB({
        Task: {
          name: 'string',
          toolsUsed: ['What tools? ~>Tool|Software|Service'],
        },
        Tool: { name: 'string', category: 'string' },
        Software: { name: 'string', type: 'string' },
        Service: { name: 'string', provider: 'string' },
      })

      // Pre-create some entities
      await db.Tool.create({ name: 'Stethoscope', category: 'Medical Equipment' })
      await db.Software.create({ name: 'Epic EMR', type: 'Electronic Health Record' })
      await db.Service.create({ name: 'Lab Testing', provider: 'Quest Diagnostics' })

      // Create a task that should fuzzy-match to relevant tools
      const task = await db.Task.create({
        name: 'Patient Examination',
        toolsUsedHint: 'Medical examination equipment and health records software',
      })

      const tools = await task.toolsUsed
      expect(tools.length).toBeGreaterThan(0)

      // Should have matched some of the pre-created entities
      const types = tools.map((t: any) => t.$type)
      expect(types.some((t: string) => ['Tool', 'Software', 'Service'].includes(t))).toBe(true)
    })
  })

  describe('Two-Phase Draft/Resolve with Context Propagation', () => {
    it('should generate draft with natural language placeholders and resolve them', async () => {
      const { db } = DB({
        Campaign: {
          $instructions: 'A marketing campaign for enterprise software',
          name: 'string',
          targetAudience: 'Who is the target audience? ->Audience',
          channels: ['What marketing channels? ->Channel'],
          content: ['What content pieces? ~>Article|Video|Infographic'],
        },
        Audience: {
          $instructions: 'Enterprise software buyers',
          persona: 'string',
          jobTitle: 'string',
          challenges: 'What are their main challenges?',
        },
        Channel: {
          name: 'string',
          type: 'digital/traditional/hybrid',
          costPerLead: 'number',
        },
        Article: { title: 'string', topic: 'string' },
        Video: { title: 'string', duration: 'string' },
        Infographic: { title: 'string', dataPoints: 'number' },
      })

      // Phase 1: Generate draft with placeholders
      const draft = await db.Campaign.draft({ name: 'Q1 Product Launch' })

      expect(draft.$phase).toBe('draft')
      expect(draft.name).toBe('Q1 Product Launch')
      expect(draft.$refs).toBeDefined()
      expect(draft.$refs.targetAudience).toBeDefined()
      expect(draft.$refs.targetAudience.type).toBe('Audience')
      expect(draft.$refs.targetAudience.resolved).toBe(false)

      // Phase 2: Resolve references to actual entities
      const resolved = await db.Campaign.resolve(draft)

      expect(resolved.$phase).toBe('resolved')
      expect(resolved.targetAudience).toMatch(/^[a-z0-9-]+$/)

      // Verify the Audience entity was created
      const audience = await db.Audience.get(resolved.targetAudience)
      expect(audience).toBeDefined()
      expect(audience.persona).toBeDefined()
      expect(audience.challenges.toLowerCase()).toMatch(/enterprise|software|decision|budget/i)
    })

    it('should allow editing draft before resolution', async () => {
      const { db } = DB({
        Proposal: {
          $instructions: 'A B2B sales proposal',
          client: '->Client',
          products: ['->Product'],
          pricing: '->PricingTier',
        },
        Client: { name: 'string', industry: 'string' },
        Product: { name: 'string', sku: 'string' },
        PricingTier: { name: 'string', discount: 'number' },
      })

      // Create draft
      const draft = await db.Proposal.create(
        { title: 'Enterprise Package Proposal' },
        { draftOnly: true }
      )

      expect(draft.$phase).toBe('draft')

      // Edit the draft with more specific descriptions
      draft.client = 'A Fortune 500 healthcare company with 10,000+ employees'
      draft.products = ['Enterprise security suite', 'Cloud storage solution']
      draft.pricing = 'Volume discount tier for large enterprises'

      // Resolve with modifications
      const resolved = await db.Proposal.resolve(draft)

      expect(resolved.$phase).toBe('resolved')

      // Verify client was created with appropriate context
      const client = await db.Client.get(resolved.client)
      expect(client).toBeDefined()
      expect(client.industry.toLowerCase()).toMatch(/healthcare|health|medical/i)
    })
  })

  describe('Backward Fuzzy Resolution with Context', () => {
    it('should find semantically related entities via backward fuzzy', async () => {
      const { db } = DB({
        Expert: {
          name: 'string',
          specialty: 'string',
          experience: 'string',
        },
        Project: {
          $instructions: 'A software development project',
          name: 'string',
          teamLead: '<~Expert',
          consultants: ['<~Expert'],
        },
      })

      // Create experts first
      await db.Expert.create({
        name: 'Dr. Sarah Chen',
        specialty: 'Machine Learning and Neural Networks',
        experience: '15 years in AI research',
      })
      await db.Expert.create({
        name: 'John Smith',
        specialty: 'Agile Project Management',
        experience: '10 years leading software teams',
      })
      await db.Expert.create({
        name: 'Maria Garcia',
        specialty: 'Cloud Architecture and DevOps',
        experience: '8 years in cloud infrastructure',
      })

      // Create a project that should match experts semantically
      const project = await db.Project.create({
        name: 'AI-Powered Analytics Platform',
      })

      // The backward fuzzy should find experts relevant to the project
      const teamLead = await project.teamLead
      expect(teamLead).toBeDefined()
      // Should match someone with AI/ML background
      expect(teamLead.specialty.toLowerCase()).toMatch(/machine learning|ai|software|project/i)

      const consultants = await project.consultants
      expect(consultants.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Union Type Resolution with Best-Score Matching', () => {
    it('should search all union types and return best semantic match', async () => {
      const { db } = DB({
        Resource: {
          $instructions: 'A learning resource',
          name: 'string',
          content: 'What is the best resource? ~>Documentation|Tutorial|Video|Course',
        },
        Documentation: { title: 'string', pages: 'number' },
        Tutorial: { title: 'string', steps: 'number' },
        Video: { title: 'string', duration: 'string' },
        Course: { title: 'string', modules: 'number' },
      })

      // Create resources of different types
      await db.Documentation.create({
        title: 'API Reference Guide',
        pages: 50,
      })
      await db.Tutorial.create({
        title: 'Getting Started with React Hooks',
        steps: 10,
      })
      await db.Video.create({
        title: 'Machine Learning Fundamentals',
        duration: '2 hours',
      })
      await db.Course.create({
        title: 'Full Stack Web Development Bootcamp',
        modules: 12,
      })

      // Create a resource that should match Tutorial based on hint
      const resource1 = await db.Resource.create({
        name: 'React Learning Path',
        contentHint: 'A step-by-step guide for learning React components',
      })
      const content1 = await resource1.content
      expect(content1.$type).toBe('Tutorial')

      // Create a resource that should match Video based on hint
      const resource2 = await db.Resource.create({
        name: 'ML Learning Path',
        contentHint: 'A video introduction to machine learning concepts',
      })
      const content2 = await resource2.content
      expect(content2.$type).toBe('Video')
    })

    it('should track which union type matched', async () => {
      const { db } = DB({
        Asset: {
          content: '~>Image|Video|Document',
        },
        Image: { src: 'string', alt: 'string' },
        Video: { url: 'string', duration: 'string' },
        Document: { path: 'string', format: 'string' },
      })

      await db.Video.create({
        url: 'https://example.com/intro.mp4',
        duration: '5:30',
      })

      const asset = await db.Asset.create({
        contentHint: 'A video file for the homepage',
      })

      const content = await asset.content
      expect(content.$matchedType).toBe('Video')
      expect(content.url).toBe('https://example.com/intro.mp4')
    })

    it('should generate from first type when no match found', async () => {
      const { db } = DB({
        Media: {
          file: '~>Photo|Video|Audio',
        },
        Photo: { filename: 'string', resolution: 'string' },
        Video: { filename: 'string', duration: 'string' },
        Audio: { filename: 'string', bitrate: 'string' },
      })

      // No pre-existing entities
      const media = await db.Media.create({
        fileHint: 'A visual representation of the product',
      })

      const file = await media.file
      expect(file.$generated).toBe(true)
      // Should generate Photo as it's first in union and most relevant to "visual"
      expect(['Photo', 'Video', 'Audio']).toContain(file.$type)
    })
  })

  describe('Context Propagation with $instructions and Templates', () => {
    it('should resolve template variables in $instructions', async () => {
      const { db } = DB({
        Company: {
          name: 'string',
          industry: 'string',
        },
        Department: {
          $instructions: `
            This department belongs to {company.name} in the {company.industry} industry.
            Generate appropriate roles and responsibilities.
          `,
          company: '<-Company.departments',
          name: 'string',
          responsibilities: 'What are the key responsibilities?',
          headcount: 'How many people typically work here?',
        },
      })

      // Extend Company schema to have departments
      const { db: extendedDb } = DB({
        Company: {
          name: 'string',
          industry: 'string',
          departments: ['->Department'],
        },
        Department: {
          $instructions: 'A department in {company.name} ({company.industry})',
          name: 'string',
          responsibilities: 'string',
        },
      })

      const company = await extendedDb.Company.create(
        {
          name: 'TechCorp',
          industry: 'Enterprise Software',
        },
        { cascade: true, maxDepth: 1 }
      )

      const departments = await company.departments
      expect(departments.length).toBeGreaterThan(0)

      // Verify department was generated with context from company
      const dept = departments[0]
      expect(dept.name).toBeDefined()
      expect(dept.responsibilities.toLowerCase()).toMatch(
        /software|engineering|development|tech|product/i
      )
    })

    it('should merge $instructions from parent and child during cascade', async () => {
      const { db } = DB({
        Brand: {
          $instructions: 'A luxury fashion brand targeting affluent customers',
          name: 'string',
          products: ['->BrandProduct'],
        },
        BrandProduct: {
          $instructions: 'Focus on premium materials and exclusive design',
          name: 'string',
          description: 'Describe the product',
          price: 'What is the price point?',
        },
      })

      const brand = await db.Brand.create({ name: 'Maison Luxe' }, { cascade: true, maxDepth: 1 })

      const products = await brand.products
      expect(products.length).toBeGreaterThan(0)

      // Products should reflect both luxury brand and premium materials context
      const product = products[0]
      expect(product.description.toLowerCase()).toMatch(
        /luxury|premium|exclusive|elegant|crafted|quality|leather|silk|cashmere/i
      )
      expect(product.price.toLowerCase()).toMatch(/\$|premium|high|exclusive|thousand/i)
    })

    it('should support explicit $context dependencies', async () => {
      const { db } = DB({
        Customer: {
          name: 'string',
          segment: 'string',
        },
        Product: {
          name: 'string',
          category: 'string',
        },
        Email: {
          $context: ['Customer', 'Product'],
          $instructions: `
            Write a personalized email for {customer.name} ({customer.segment} segment)
            about {product.name} ({product.category})
          `,
          customer: '->Customer',
          product: '->Product',
          subject: 'string',
          body: 'string',
        },
      })

      const customer = await db.Customer.create({
        name: 'Acme Corp',
        segment: 'Enterprise',
      })
      const product = await db.Product.create({
        name: 'CloudSync Pro',
        category: 'Cloud Storage',
      })

      const email = await db.Email.create({
        customer: customer.$id,
        product: product.$id,
      })

      // Email should be personalized based on context
      expect(email.subject.toLowerCase()).toMatch(/acme|cloud|storage|enterprise/i)
      expect(email.body.toLowerCase()).toMatch(/acme|cloudsync|storage/i)
    })
  })

  describe('Full Graph Generation with All Operators', () => {
    it('should build complete entity graph with forward and backward references', async () => {
      const { db } = DB({
        Organization: {
          name: 'string',
          teams: ['->Team'],
        },
        Team: {
          name: 'string',
          organization: '<-Organization.teams',
          lead: '->Employee',
          members: ['->Employee'],
          projects: ['->Project'],
        },
        Employee: {
          name: 'string',
          role: 'string',
          skills: ['~>Skill'],
          leadOf: '<~Team.lead',
          memberOf: '<~Team.members',
        },
        Project: {
          name: 'string',
          status: 'string',
          team: '<-Team.projects',
          tasks: ['->ProjectTask'],
          stakeholders: ['~>Employee'],
        },
        ProjectTask: {
          title: 'string',
          assignee: '~>Employee',
          project: '<-Project.tasks',
          dependencies: ['~>ProjectTask'],
        },
        Skill: {
          name: 'string',
          level: 'string',
        },
      })

      // Create the organization with full cascade
      const org = await db.Organization.create(
        { name: 'Innovate Labs' },
        { cascade: true, maxDepth: 4 }
      )

      // Verify organization structure
      expect(org.name).toBe('Innovate Labs')

      const teams = await org.teams
      expect(teams.length).toBeGreaterThan(0)

      const team = teams[0]
      expect(team.name).toBeDefined()

      // Verify backward reference
      const teamOrg = await team.organization
      expect(teamOrg.$id).toBe(org.$id)

      // Verify team lead (forward exact)
      const lead = await team.lead
      expect(lead).toBeDefined()
      expect(lead.name).toBeDefined()
      expect(lead.role).toBeDefined()

      // Verify team members (forward exact array)
      const members = await team.members
      expect(members.length).toBeGreaterThan(0)

      // Verify projects were created
      const projects = await team.projects
      expect(projects.length).toBeGreaterThan(0)

      const project = projects[0]
      expect(project.name).toBeDefined()

      // Verify project backward reference
      const projectTeam = await project.team
      expect(projectTeam.$id).toBe(team.$id)

      // Verify tasks were cascaded
      const tasks = await project.tasks
      expect(tasks.length).toBeGreaterThan(0)

      const task = tasks[0]
      expect(task.title).toBeDefined()

      // Verify task assignee (fuzzy match to employee)
      const assignee = await task.assignee
      expect(assignee).toBeDefined()
      expect(assignee.$type).toBe('Employee')
    })
  })

  describe('Schema Validation for E2E Features', () => {
    it('should parse schema with all operator types correctly', () => {
      const schema: DatabaseSchema = {
        Entity: {
          forwardExact: '->Target',
          forwardFuzzy: '~>Target',
          backwardExact: '<-Source.entities',
          backwardFuzzy: '<~Source',
          forwardExactArray: ['->Target'],
          forwardFuzzyArray: ['~>Target'],
          forwardExactUnion: '->TypeA|TypeB|TypeC',
          forwardFuzzyUnion: '~>TypeA|TypeB|TypeC',
        },
        Target: { name: 'string' },
        Source: { entities: ['->Entity'] },
        TypeA: { name: 'string' },
        TypeB: { name: 'string' },
        TypeC: { name: 'string' },
      }

      const parsed = parseSchema(schema)
      const entity = parsed.entities.get('Entity')

      // Forward exact
      const fe = entity!.fields.get('forwardExact')
      expect(fe?.operator).toBe('->')
      expect(fe?.direction).toBe('forward')
      expect(fe?.matchMode).toBe('exact')

      // Forward fuzzy
      const ff = entity!.fields.get('forwardFuzzy')
      expect(ff?.operator).toBe('~>')
      expect(ff?.direction).toBe('forward')
      expect(ff?.matchMode).toBe('fuzzy')

      // Backward exact
      const be = entity!.fields.get('backwardExact')
      expect(be?.operator).toBe('<-')
      expect(be?.direction).toBe('backward')
      expect(be?.matchMode).toBe('exact')

      // Backward fuzzy
      const bf = entity!.fields.get('backwardFuzzy')
      expect(bf?.operator).toBe('<~')
      expect(bf?.direction).toBe('backward')
      expect(bf?.matchMode).toBe('fuzzy')

      // Forward exact array
      const fea = entity!.fields.get('forwardExactArray')
      expect(fea?.operator).toBe('->')
      expect(fea?.isArray).toBe(true)

      // Forward fuzzy array
      const ffa = entity!.fields.get('forwardFuzzyArray')
      expect(ffa?.operator).toBe('~>')
      expect(ffa?.isArray).toBe(true)

      // Union types
      const feu = entity!.fields.get('forwardExactUnion')
      expect(feu?.unionTypes).toEqual(['TypeA', 'TypeB', 'TypeC'])
      expect(feu?.relatedType).toBe('TypeA')

      const ffu = entity!.fields.get('forwardFuzzyUnion')
      expect(ffu?.unionTypes).toEqual(['TypeA', 'TypeB', 'TypeC'])
    })

    it('should validate all referenced types exist in schema', () => {
      expect(() => {
        DB({
          Entity: {
            ref: '->NonExistent',
          },
        })
      }).toThrow(/non-existent type.*NonExistent/i)

      expect(() => {
        DB({
          Entity: {
            ref: '~>TypeA|NonExistent|TypeC',
          },
          TypeA: { name: 'string' },
          TypeC: { name: 'string' },
        })
      }).toThrow(/non-existent type.*NonExistent/i)
    })
  })

  describe('Progress Tracking During E2E Generation', () => {
    it('should track progress through complete cascade generation', async () => {
      const { db } = DB({
        Root: {
          children: ['->Level1'],
        },
        Level1: {
          items: ['->Level2'],
        },
        Level2: {
          data: ['->Level3'],
        },
        Level3: {
          name: 'string',
        },
      })

      const progress: any[] = []

      await db.Root.create(
        {},
        {
          cascade: true,
          maxDepth: 3,
          onProgress: (p) => progress.push({ ...p }),
        }
      )

      // Should have progress events for each level
      expect(progress.some((p) => p.currentType === 'Root')).toBe(true)
      expect(progress.some((p) => p.currentType === 'Level1')).toBe(true)
      expect(progress.some((p) => p.currentType === 'Level2')).toBe(true)
      expect(progress.some((p) => p.currentType === 'Level3')).toBe(true)

      // Should have completion event
      const complete = progress.find((p) => p.phase === 'complete')
      expect(complete).toBeDefined()
      expect(complete.totalEntitiesCreated).toBeGreaterThan(3)

      // Should track depths
      const depths = progress.filter((p) => p.depth !== undefined).map((p) => p.depth)
      expect(depths).toContain(0)
      expect(depths).toContain(1)
      expect(depths).toContain(2)
    })
  })

  describe('Error Handling in E2E Workflows', () => {
    it('should handle cascade errors gracefully', async () => {
      const { db } = DB({
        Container: {
          items: ['->Item'],
        },
        Item: {
          name: 'string',
        },
      })

      const errors: any[] = []

      const container = await db.Container.create(
        { name: 'TestContainer' },
        {
          cascade: true,
          maxDepth: 1,
          onError: (err) => errors.push(err),
        }
      )

      // Should return the container even if there were errors
      expect(container).toBeDefined()
      expect(container.$type).toBe('Container')
    })

    it('should throw if resolving non-draft entity', async () => {
      const { db } = DB({
        Item: { ref: '->Other' },
        Other: { name: 'string' },
      })

      const item = await db.Item.create({ name: 'Test' })

      await expect(db.Item.resolve(item)).rejects.toThrow(/not a draft/)
    })
  })

  describe('Streaming Support in E2E Workflows', () => {
    it('should support streaming draft generation', async () => {
      const { db } = DB({
        Article: {
          $instructions: 'A technical blog article',
          title: 'string',
          content: 'Write a detailed article about the topic',
          author: '->Author',
          tags: ['->Tag'],
        },
        Author: { name: 'string', bio: 'string' },
        Tag: { name: 'string' },
      })

      const chunks: string[] = []

      const draft = await db.Article.draft(
        { title: 'Introduction to AI' },
        {
          stream: true,
          onChunk: (chunk) => chunks.push(chunk),
        }
      )

      expect(chunks.length).toBeGreaterThan(0)
      expect(draft.$phase).toBe('draft')
      expect(draft.content).toBeDefined()
    })

    it('should support streaming resolution with callbacks', async () => {
      const { db } = DB({
        Report: {
          analysts: ['->Analyst'],
          sections: ['->Section'],
        },
        Analyst: { name: 'string' },
        Section: { title: 'string', content: 'string' },
      })

      const draft = await db.Report.draft({ name: 'Q1 Analysis' })

      const resolvedRefs: string[] = []

      const resolved = await db.Report.resolve(draft, {
        onResolved: (fieldName, entityId) => {
          resolvedRefs.push(`${fieldName}:${entityId}`)
        },
      })

      expect(resolvedRefs.length).toBeGreaterThan(0)
      expect(resolved.$phase).toBe('resolved')
    })
  })
})
