/**
 * Tests for Context Propagation via $instructions and $context
 *
 * Context propagation enables:
 * - Entity-level prompting with $instructions
 * - Template variable resolution for dynamic context
 * - Explicit context dependencies via $context
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import { DB } from '../src/schema.js'

describe('Context Propagation via $instructions and $context', () => {
  describe('$instructions for entity-level prompting', () => {
    it('should use $instructions for entity-level prompting', async () => {
      const { db } = DB({
        Startup: {
          $instructions: 'This is a B2B SaaS startup targeting enterprise customers',
          idea: 'What problem does this solve? ->Idea',
        },
        Idea: { problem: 'string', solution: 'string' },
      })

      const startup = await db.Startup.create({ name: 'Acme' })
      const idea = await startup.idea
      expect(idea.problem.toLowerCase()).toMatch(/enterprise|business|company/i)
    })

    it('should apply $instructions to AI-generated fields', async () => {
      const { db } = DB({
        Product: {
          $instructions: 'This is a luxury product for high-end customers',
          name: 'string',
          description: 'Describe this product',
        },
      })

      const product = await db.Product.create({ name: 'Elite Watch' })
      expect(product.description.toLowerCase()).toMatch(
        /luxury|premium|exclusive|high-end|elegant/i
      )
    })

    it('should allow $instructions to influence generation context', async () => {
      const { db } = DB({
        Character: {
          $instructions: 'This character is from a medieval fantasy setting',
          name: 'string',
          backstory: 'What is their history?',
        },
      })

      const character = await db.Character.create({ name: 'Sir Aldric' })
      expect(character.backstory.toLowerCase()).toMatch(
        /king|knight|castle|sword|dragon|quest|kingdom/i
      )
    })
  })

  describe('Template variable resolution', () => {
    it('should resolve template variables in $instructions', async () => {
      const { db } = DB({
        Problem: {
          $instructions: `
            Identify problems for occupation: {task.occupation.title}
            in industry: {task.occupation.industry.name}
          `,
          task: '<-Task',
          description: 'string',
        },
        Task: { name: 'string', occupation: '->Occupation' },
        Occupation: { title: 'string', industry: '->Industry' },
        Industry: { name: 'string' },
      })

      const industry = await db.Industry.create({ name: 'Healthcare' })
      const occupation = await db.Occupation.create({ title: 'Nurse', industry: industry.$id })
      const task = await db.Task.create({ name: 'Documentation', occupation: occupation.$id })
      const problem = await db.Problem.create({ task: task.$id })

      expect(problem.description.toLowerCase()).toMatch(/nurse|healthcare|patient/i)
    })

    it('should resolve nested template variables', async () => {
      const { db } = DB({
        Report: {
          $instructions: `
            Generate report for:
            Company: {project.company.name}
            Industry: {project.company.industry}
          `,
          project: '<-Project',
          summary: 'string',
        },
        Project: { name: 'string', company: '->Company' },
        Company: { name: 'string', industry: 'string' },
      })

      const company = await db.Company.create({ name: 'TechCorp', industry: 'Technology' })
      const project = await db.Project.create({ name: 'AI Initiative', company: company.$id })
      const report = await db.Report.create({ project: project.$id })

      expect(report.summary.toLowerCase()).toMatch(/techcorp|technology|tech/i)
    })

    it('should handle missing template variables gracefully', async () => {
      const { db } = DB({
        Note: {
          $instructions: 'Context: {optional.field}',
          content: 'string',
        },
      })

      // Should not throw when template variable cannot be resolved
      const note = await db.Note.create({ name: 'Test Note' })
      expect(note.content).toBeDefined()
    })
  })

  describe('Explicit $context dependencies', () => {
    it('should declare explicit context dependencies', async () => {
      const { db } = DB({
        Ad: {
          $context: ['Startup', 'ICP'],
          $instructions: 'Generate ad for {startup.name} targeting {icp.as}',
          startup: '<-Startup',
          headline: 'string (30 chars)',
        },
        Startup: { name: 'string', icp: '->ICP' },
        ICP: { as: 'string' },
      })

      const icp = await db.ICP.create({ as: 'Software Engineers' })
      const startup = await db.Startup.create({ name: 'CodeHelper', icp: icp.$id })
      const ad = await db.Ad.create({ startup: startup.$id })

      expect(ad.headline).toContain('CodeHelper')
      expect(ad.headline.length).toBeLessThanOrEqual(30)
    })

    it('should auto-resolve $context dependencies', async () => {
      const { db } = DB({
        Email: {
          $context: ['Customer', 'Product'],
          $instructions: 'Write email about {product.name} for {customer.name}',
          customer: '<-Customer',
          product: '->Product',
          subject: 'string',
          body: 'string',
        },
        Customer: { name: 'string' },
        Product: { name: 'string' },
      })

      const customer = await db.Customer.create({ name: 'John' })
      const product = await db.Product.create({ name: 'SuperWidget' })
      const email = await db.Email.create({
        customer: customer.$id,
        product: product.$id,
      })

      expect(email.subject.toLowerCase()).toMatch(/superwidget|john/i)
    })

    it('should support multiple context entities of the same type', async () => {
      const { db } = DB({
        Comparison: {
          $context: ['ProductA', 'ProductB'],
          $instructions: 'Compare {productA.name} with {productB.name}',
          productA: '->Product',
          productB: '->Product',
          analysis: 'string',
        },
        Product: { name: 'string', features: 'string' },
      })

      const productA = await db.Product.create({
        name: 'Widget Pro',
        features: 'Advanced features',
      })
      const productB = await db.Product.create({ name: 'Widget Lite', features: 'Basic features' })
      const comparison = await db.Comparison.create({
        productA: productA.$id,
        productB: productB.$id,
      })

      expect(comparison.analysis.toLowerCase()).toMatch(/widget pro|widget lite|compare|versus|vs/i)
    })
  })

  describe('Context propagation through relationships', () => {
    it('should propagate context through parent-child relationships', async () => {
      const { db } = DB({
        Campaign: {
          $instructions: 'Marketing campaign for tech startups',
          name: 'string',
          ads: ['->Ad'],
        },
        Ad: {
          $instructions: 'Inherit context from parent campaign',
          headline: 'string',
          copy: 'string',
        },
      })

      const campaign = await db.Campaign.create(
        { name: 'Tech Launch' },
        { cascade: true, maxDepth: 1 }
      )

      const ads = await campaign.ads
      expect(ads.length).toBeGreaterThan(0)
      expect(ads[0].copy.toLowerCase()).toMatch(/tech|startup|launch/i)
    })

    it('should merge $instructions from parent and child entities', async () => {
      const { db } = DB({
        Store: {
          $instructions: 'Luxury retail brand',
          name: 'string',
          products: ['->StoreProduct'],
        },
        StoreProduct: {
          $instructions: 'Focus on quality and craftsmanship',
          name: 'string',
          tagline: 'string',
        },
      })

      const store = await db.Store.create({ name: 'Luxe Boutique' }, { cascade: true, maxDepth: 1 })

      const products = await store.products
      expect(products.length).toBeGreaterThan(0)
      // Should reflect both luxury and quality instructions (broad pattern for AI-generated content)
      expect(products[0].tagline.toLowerCase()).toMatch(
        /luxury|quality|premium|craftsmanship|elegant|elegance|timeless|softness|exquisite|refined|opulen|indulg|discern|exclusiv|sophistic|finest|artisan|heritage|bespoke/i
      )
    })
  })
})
