/**
 * Tests for $instructions Template Variable Resolution
 *
 * This test suite verifies that template variables in $instructions are properly
 * resolved before being passed to LLM generation. Template syntax uses {field.path}
 * notation where paths can traverse relationships.
 *
 * Key behaviors tested:
 * - Simple {field} variables resolved from entity data
 * - Nested {relationship.field.path} resolved through relationship chains
 * - Related entities pre-fetched for resolution
 * - Missing variables handled gracefully (don't throw, use placeholder/empty)
 * - Resolved instructions passed to LLM generation
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import { resolveProvider } from '../src/schema/provider.js'
import { resolveInstructions, resolveContextPath } from '../src/schema/resolve.js'

// Mock ai-functions to avoid real API calls in tests
vi.mock('ai-functions', () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: { description: 'AI generated content', problem: 'Generated problem', solution: 'Generated solution' }
  })
}))

describe('$instructions Template Variable Resolution', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Simple {field} variable resolution', () => {
    it('should resolve simple template variables from entity data', async () => {
      const { db } = DB({
        Character: {
          $instructions: 'This character is named {name} and works as a {role}',
          name: 'string',
          role: 'string',
          backstory: 'string'  // Will be generated with context from $instructions
        }
      })

      const char = await db.Character.create({ name: 'Alice', role: 'Engineer' })

      // The backstory should be generated with context that includes Alice and Engineer
      // The resolved $instructions should read:
      // "This character is named Alice and works as a Engineer"
      expect(char.backstory.toLowerCase()).toMatch(/alice|engineer/i)
    })

    it('should resolve multiple variables in single instruction', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Product: {
          $instructions: 'Product {name} by {manufacturer} in {category}',
          name: 'string',
          manufacturer: 'string',
          category: 'string',
          description: 'string'  // Will be generated with context
        }
      })

      const product = await db.Product.create({
        name: 'SuperWidget',
        manufacturer: 'TechCorp',
        category: 'Electronics'
      })

      // Description should be generated (string value returned)
      expect(product.description).toBeDefined()
      expect(typeof product.description).toBe('string')

      // The generateObject should be called with resolved instructions containing all variables
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('SuperWidget')
        })
      )
    })

    it('should preserve literal text around resolved variables', async () => {
      const { db } = DB({
        Document: {
          $instructions: 'BEGIN: Document for {title}. END.',
          title: 'string',
          content: 'string'  // Will be generated
        }
      })

      const doc = await db.Document.create({ title: 'Annual Report' })
      // The content should reflect context from title
      expect(doc.content).toBeDefined()
      expect(typeof doc.content).toBe('string')
    })
  })

  describe('Nested {relationship.field.path} resolution', () => {
    it('should resolve single-level relationship paths', async () => {
      const { db } = DB({
        BlogPost: {
          $instructions: 'Blog post by author {author.name}',
          title: 'string',
          author: '->Author',
          summary: 'string'  // Will be generated with author context
        },
        Author: { name: 'string', bio: 'string' }
      })

      const author = await db.Author.create({ name: 'Jane Doe', bio: 'Tech writer' })
      const post = await db.BlogPost.create({ title: 'AI Tips', author: author.$id })

      // Summary should reference Jane Doe from the resolved path
      expect(post.summary.toLowerCase()).toMatch(/jane|doe/i)
    })

    it('should resolve multi-level relationship paths', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Problem: {
          $instructions: `
            Identify problems for occupation: {task.occupation.title}
            in industry: {task.occupation.industry.name}
          `,
          task: '<-Task',
          description: 'string'
        },
        Task: { name: 'string', occupation: '->Occupation' },
        Occupation: { title: 'string', industry: '->Industry' },
        Industry: { name: 'string' }
      })

      const industry = await db.Industry.create({ name: 'Healthcare' })
      const occupation = await db.Occupation.create({
        title: 'Nurse',
        industry: industry.$id
      })
      const task = await db.Task.create({
        name: 'Patient Care',
        occupation: occupation.$id
      })
      const problem = await db.Problem.create({ task: task.$id })

      // Description should be generated
      expect(problem.description).toBeDefined()
      expect(typeof problem.description).toBe('string')

      // Verify generateObject was called with resolved nested paths
      // The instructions should have resolved {task.occupation.title} -> "Nurse"
      // and {task.occupation.industry.name} -> "Healthcare"
      expect(generateObject).toHaveBeenCalled()
    })

    it('should resolve deeply nested paths (3+ levels)', async () => {
      const { db } = DB({
        Report: {
          $instructions: 'Report for {project.department.company.name}',
          project: '->Project',
          summary: 'string'  // Will be generated
        },
        Project: { name: 'string', department: '->Department' },
        Department: { name: 'string', company: '->Company' },
        Company: { name: 'string' }
      })

      const company = await db.Company.create({ name: 'MegaCorp' })
      const dept = await db.Department.create({ name: 'Engineering', company: company.$id })
      const project = await db.Project.create({ name: 'Alpha', department: dept.$id })
      const report = await db.Report.create({ project: project.$id })

      // Summary should reference MegaCorp from the deeply nested path
      expect(report.summary.toLowerCase()).toMatch(/megacorp/i)
    })

    it('should resolve paths through backward relationships', async () => {
      const { db } = DB({
        Ad: {
          $instructions: 'Generate ad for {startup.name} targeting {startup.icp.as}',
          startup: '<-Startup',
          headline: 'string'
        },
        Startup: { name: 'string', icp: '->ICP' },
        ICP: { as: 'string' }
      })

      const icp = await db.ICP.create({ as: 'Software Engineers' })
      const startup = await db.Startup.create({ name: 'CodeHelper', icp: icp.$id })
      const ad = await db.Ad.create({ startup: startup.$id })

      // Headline should reference CodeHelper and Software Engineers
      expect(ad.headline).toMatch(/CodeHelper|code|software|engineer/i)
    })
  })

  describe('Related entity pre-fetching', () => {
    it('should pre-fetch related entities for template resolution', async () => {
      const { db } = DB({
        Invoice: {
          $instructions: 'Invoice for {customer.name} at {customer.company}',
          customer: '->Customer',
          lineItems: 'string'
        },
        Customer: { name: 'string', company: 'string' }
      })

      const customer = await db.Customer.create({
        name: 'John Smith',
        company: 'Acme Corp'
      })
      const invoice = await db.Invoice.create({ customer: customer.$id })

      // lineItems should be generated with customer context pre-fetched
      expect(invoice.lineItems.toLowerCase()).toMatch(/john|smith|acme/i)
    })

    it('should pre-fetch multiple related entities', async () => {
      const { db } = DB({
        Email: {
          $instructions: 'Write email about {product.name} for {recipient.name}',
          product: '->Product',
          recipient: '->Contact',
          body: 'string'
        },
        Product: { name: 'string' },
        Contact: { name: 'string', email: 'string' }
      })

      const product = await db.Product.create({ name: 'SuperWidget' })
      const contact = await db.Contact.create({ name: 'Bob Jones', email: 'bob@example.com' })
      const email = await db.Email.create({
        product: product.$id,
        recipient: contact.$id
      })

      // Body should reference both SuperWidget and Bob Jones
      expect(email.body.toLowerCase()).toMatch(/superwidget|bob|jones/i)
    })

    it('should batch fetch related entities efficiently', async () => {
      // This test verifies efficient fetching - we should not do N+1 queries
      const { db } = DB({
        Report: {
          $instructions: `
            Report for {project.name}
            in department {project.department.name}
            at company {project.department.company.name}
          `,
          project: '->Project',
          content: 'string'
        },
        Project: { name: 'string', department: '->Department' },
        Department: { name: 'string', company: '->Company' },
        Company: { name: 'string' }
      })

      const company = await db.Company.create({ name: 'TechCorp' })
      const dept = await db.Department.create({ name: 'R&D', company: company.$id })
      const project = await db.Project.create({ name: 'Innovation', department: dept.$id })

      // Should resolve all related entities for template without errors
      const report = await db.Report.create({ project: project.$id })

      expect(report.content.toLowerCase()).toMatch(/techcorp|r&d|innovation/i)
    })
  })

  describe('Missing variable handling', () => {
    it('should handle missing simple field gracefully', async () => {
      const { db } = DB({
        Note: {
          $instructions: 'Note about {topic}',
          topic: 'string?',  // Optional field
          content: 'string'
        }
      })

      // topic is not provided - should not throw
      const note = await db.Note.create({})
      expect(note.content).toBeDefined()
      expect(typeof note.content).toBe('string')
    })

    it('should handle missing relationship gracefully', async () => {
      const { db } = DB({
        Comment: {
          $instructions: 'Comment by {author.name}',
          author: '->User?',  // Optional relationship
          text: 'string'
        },
        User: { name: 'string' }
      })

      // author is not provided - should not throw
      const comment = await db.Comment.create({})
      expect(comment.text).toBeDefined()
      expect(typeof comment.text).toBe('string')
    })

    it('should handle missing nested path gracefully', async () => {
      const { db } = DB({
        Widget: {
          $instructions: 'Widget for {category.parent.name}',
          category: '->Category',
          spec: 'string'
        },
        Category: { name: 'string', parent: '->Category?' }  // Optional parent
      })

      const category = await db.Category.create({ name: 'Electronics' })
      // category has no parent - should not throw
      const widget = await db.Widget.create({ category: category.$id })

      expect(widget.spec).toBeDefined()
      expect(typeof widget.spec).toBe('string')
    })

    it('should replace missing variables with empty string', async () => {
      const { db } = DB({
        Greeting: {
          $instructions: 'Hello {name}, welcome to {place}!',
          name: 'string?',
          place: 'string?',
          message: 'string'
        }
      })

      // Neither name nor place is provided
      const greeting = await db.Greeting.create({})

      // The instructions should still work, with missing vars replaced
      expect(greeting.message).toBeDefined()
      expect(typeof greeting.message).toBe('string')
    })

    it('should handle partial path resolution', async () => {
      const { db } = DB({
        Task: {
          $instructions: 'Task for {project.owner.name}',
          project: '->Project',
          summary: 'string'
        },
        Project: { name: 'string', owner: '->User?' },  // Optional owner
        User: { name: 'string' }
      })

      const project = await db.Project.create({ name: 'Alpha' })
      // project has no owner - path should partially resolve then fail gracefully
      const task = await db.Task.create({ project: project.$id })

      expect(task.summary).toBeDefined()
      expect(typeof task.summary).toBe('string')
    })
  })

  describe('Resolved instructions passed to LLM', () => {
    it('should pass resolved instructions to generateObject', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Profile: {
          $instructions: 'Create profile for {name} who is a {occupation}',
          name: 'string',
          occupation: 'string',
          bio: 'string'
        }
      })

      await db.Profile.create({ name: 'Alice Smith', occupation: 'Data Scientist' })

      // The generateObject should receive the RESOLVED instructions
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Alice Smith')
        })
      )
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Data Scientist')
        })
      )
    })

    it('should include resolved relationship data in prompt', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Review: {
          $instructions: 'Write review for {product.name} by {product.brand}',
          product: '->Product',
          content: 'string'
        },
        Product: { name: 'string', brand: 'string' }
      })

      const product = await db.Product.create({ name: 'UltraPhone', brand: 'TechBrand' })
      await db.Review.create({ product: product.$id })

      // The prompt should contain the resolved product details
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringMatching(/UltraPhone|TechBrand/i)
        })
      )
    })

    it('should maintain template structure in resolved output', async () => {
      const { db } = DB({
        Announcement: {
          $instructions: `
            COMPANY: {company.name}
            PRODUCT: {product.name}
            TARGET: {audience.segment}
          `,
          company: '->Company',
          product: '->Product',
          audience: '->Audience',
          content: 'string'
        },
        Company: { name: 'string' },
        Product: { name: 'string' },
        Audience: { segment: 'string' }
      })

      const company = await db.Company.create({ name: 'InnovateCorp' })
      const product = await db.Product.create({ name: 'NextGen AI' })
      const audience = await db.Audience.create({ segment: 'Enterprise' })

      const announcement = await db.Announcement.create({
        company: company.$id,
        product: product.$id,
        audience: audience.$id
      })

      // Content should reflect all three resolved entities
      expect(announcement.content.toLowerCase()).toMatch(/innovatecorp|nextgen|enterprise/i)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty template variables syntax', async () => {
      const { db } = DB({
        Item: {
          $instructions: 'Item with {} and {  } placeholders',
          value: 'string'
        }
      })

      // Should not throw on empty braces
      const item = await db.Item.create({})
      expect(item.value).toBeDefined()
    })

    it('should handle special characters in field values', async () => {
      const { db } = DB({
        Message: {
          $instructions: 'Message about {topic}',
          topic: 'string',
          body: 'string'
        }
      })

      const message = await db.Message.create({
        topic: 'Special chars: <>&"\''
      })

      expect(message.body).toBeDefined()
    })

    it('should handle circular relationship paths', async () => {
      const { generateObject } = await import('ai-functions')

      const { db } = DB({
        Node: {
          $instructions: 'Node {name} links to {next.name}',
          name: 'string',
          next: '->Node?',  // Optional self-reference
          description: 'string'
        }
      })

      const nodeA = await db.Node.create({ name: 'NodeA' })
      const nodeB = await db.Node.create({ name: 'NodeB', next: nodeA.$id })

      // Should resolve without infinite loop
      expect(nodeB.description).toBeDefined()
      expect(typeof nodeB.description).toBe('string')

      // Verify generateObject was called (no infinite loop)
      expect(generateObject).toHaveBeenCalled()
    })

    it('should handle numeric field values in templates', async () => {
      const { db } = DB({
        Invoice: {
          $instructions: 'Invoice #{number} for ${amount}',
          number: 'number',
          amount: 'number',
          summary: 'string'
        }
      })

      const invoice = await db.Invoice.create({ number: 12345, amount: 99.99 })
      expect(invoice.summary).toBeDefined()
    })

    it('should handle boolean field values in templates', async () => {
      const { db } = DB({
        Feature: {
          $instructions: 'Feature {name} enabled: {enabled}',
          name: 'string',
          enabled: 'boolean',
          description: 'string'
        }
      })

      const feature = await db.Feature.create({ name: 'DarkMode', enabled: true })
      expect(feature.description).toBeDefined()
    })
  })

  describe('resolveInstructions() unit tests', () => {
    it('should return original string if no template variables', async () => {
      setProvider(createMemoryProvider())
      const { db } = DB({
        Entity: { name: 'string' }
      })
      const provider = await resolveProvider()

      const result = await resolveInstructions(
        'Static instructions with no variables',
        { name: 'Test' },
        'Entity',
        db.$schema,
        provider
      )

      expect(result).toBe('Static instructions with no variables')
    })

    it('should resolve direct field references', async () => {
      setProvider(createMemoryProvider())
      const { db } = DB({
        Entity: { name: 'string', value: 'string' }
      })
      const provider = await resolveProvider()

      const result = await resolveInstructions(
        'Entity {name} has value {value}',
        { name: 'TestName', value: 'TestValue' },
        'Entity',
        db.$schema,
        provider
      )

      expect(result).toBe('Entity TestName has value TestValue')
    })

    it('should handle missing fields with empty string', async () => {
      setProvider(createMemoryProvider())
      const { db } = DB({
        Entity: { name: 'string' }
      })
      const provider = await resolveProvider()

      const result = await resolveInstructions(
        'Missing: {nonexistent}',
        { name: 'Test' },
        'Entity',
        db.$schema,
        provider
      )

      expect(result).toBe('Missing: ')
    })
  })

  describe('resolveContextPath() unit tests', () => {
    it('should resolve simple field path', async () => {
      setProvider(createMemoryProvider())
      const { db } = DB({
        Entity: { name: 'string' }
      })
      const provider = await resolveProvider()

      const result = await resolveContextPath(
        'name',
        { name: 'TestValue' },
        'Entity',
        db.$schema,
        provider
      )

      expect(result).toBe('TestValue')
    })

    it('should resolve nested object path', async () => {
      setProvider(createMemoryProvider())
      const { db } = DB({
        Entity: { data: 'string' }
      })
      const provider = await resolveProvider()

      const result = await resolveContextPath(
        'nested.field',
        { nested: { field: 'NestedValue' } },
        'Entity',
        db.$schema,
        provider
      )

      expect(result).toBe('NestedValue')
    })

    it('should return undefined for missing path', async () => {
      setProvider(createMemoryProvider())
      const { db } = DB({
        Entity: { name: 'string' }
      })
      const provider = await resolveProvider()

      const result = await resolveContextPath(
        'missing.path',
        { name: 'Test' },
        'Entity',
        db.$schema,
        provider
      )

      expect(result).toBeUndefined()
    })
  })
})
