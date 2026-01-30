/**
 * Cascade Test: Startup Builder Schema
 *
 * Tests cascade generation using a simplified version of the startup-builder schema.
 * This validates the cascade flow: Task -> Problem -> Solution -> HeadlessSaaS -> ICP
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'

describe('Startup Cascade', () => {
  beforeEach(() => {
    // Use in-memory provider for tests
    setProvider(createMemoryProvider())
    // Configure AI generation (will use mock in tests)
    configureAIGeneration({ enabled: true, model: 'sonnet' })
  })

  describe('Schema Definition', () => {
    it('should define a startup cascade schema', () => {
      const { db } = DB({
        Task: {
          title: 'string',
          digital: 'Digital | Physical | Hybrid',
          problems: ['->Problem'],
        },
        Problem: {
          task: '<-Task',
          description: 'string',
          painLevel: 'Low | Medium | High | Critical',
          solutions: ['->Solution'],
        },
        Solution: {
          problem: '<-Problem',
          description: 'string',
          approach: 'Automation | Augmentation | Optimization | Elimination',
          headlessSaaS: '->HeadlessSaaS',
        },
        HeadlessSaaS: {
          solution: '<-Solution',
          existingSaaS: 'string',
          agentNeeds: ['string'],
          icps: ['->ICP'],
        },
        ICP: {
          product: '<-HeadlessSaaS',
          as: 'string',
          at: 'string',
          to: 'string',
        },
      })

      expect(db).toBeTruthy()
      expect(db.Task).toBeTruthy()
      expect(db.Problem).toBeTruthy()
      expect(db.Solution).toBeTruthy()
      expect(db.HeadlessSaaS).toBeTruthy()
      expect(db.ICP).toBeTruthy()
    })
  })

  describe('Single Entity Creation', () => {
    it('should create a Task without cascade', async () => {
      const { db } = DB({
        Task: {
          title: 'string',
          digital: 'Digital | Physical | Hybrid',
        },
      })

      const task = await db.Task.create({
        title: 'Customer Relationship Management',
        digital: 'Digital',
      })

      expect(task).toBeTruthy()
      expect(task.title).toBe('Customer Relationship Management')
      expect(task.digital).toBe('Digital')
    })

    it('should create a Problem with backward reference', async () => {
      const { db } = DB({
        Task: {
          title: 'string',
          problems: ['<-Problem'],
        },
        Problem: {
          task: '->Task',
          description: 'string',
          painLevel: 'Low | Medium | High | Critical',
        },
      })

      const task = await db.Task.create({ title: 'CRM Tasks' })
      const problem = await db.Problem.create({
        task: task.$id,
        description: 'Manual data entry is time consuming',
        painLevel: 'High',
      })

      expect(problem).toBeTruthy()
      expect(problem.task).toBe(task.$id)
    })
  })

  describe('Cascade Generation', () => {
    it('should cascade from Task to Problems', async () => {
      const { db } = DB({
        Task: {
          $instructions: 'This is a task in a business context',
          title: 'string',
          problems: ['Identify 2 problems with this task ->Problem'],
        },
        Problem: {
          task: '<-Task',
          description: 'What is the problem?',
          painLevel: 'Low | Medium | High | Critical',
        },
      })

      const task = await db.Task.create(
        { title: 'Invoice Processing' },
        { cascade: true, maxDepth: 1 }
      )

      expect(task).toBeTruthy()
      expect(task.title).toBe('Invoice Processing')

      // Check that problems were generated
      const problems = await db.Problem.list()
      expect(problems.length).toBeGreaterThan(0)
    }, 30000)

    it('should cascade through multiple levels', async () => {
      const { db } = DB({
        Task: {
          title: 'string',
          problems: ['->Problem'],
        },
        Problem: {
          task: '<-Task',
          description: 'string',
          solutions: ['->Solution'],
        },
        Solution: {
          problem: '<-Problem',
          name: 'string',
          approach: 'Automation | Augmentation',
        },
      })

      const task = await db.Task.create(
        { title: 'Data Entry' },
        {
          cascade: true,
          maxDepth: 2,
          onProgress: (p) => {
            console.log(
              `Cascade: depth=${p.currentDepth}, type=${p.currentType}, total=${p.totalEntitiesCreated}`
            )
          },
        }
      )

      expect(task).toBeTruthy()

      // Check cascade created entities
      const problems = await db.Problem.list()
      const solutions = await db.Solution.list()

      console.log(`Created: ${problems.length} problems, ${solutions.length} solutions`)

      expect(problems.length).toBeGreaterThan(0)
      expect(solutions.length).toBeGreaterThan(0)
    }, 60000)
  })

  describe('Full Startup Cascade', () => {
    it('should run full cascade from Task to ICP', async () => {
      const { db } = DB({
        Task: {
          $instructions: 'A business task that could be improved with software',
          title: 'string',
          digital: 'Digital | Physical | Hybrid',
          problems: ['What problems exist? ->Problem'],
        },
        Problem: {
          $instructions: 'A specific pain point that costs time or money',
          task: '<-Task',
          description: 'What is the problem?',
          painLevel: 'Low | Medium | High | Critical',
          frequency: 'Rare | Occasional | Frequent | Constant',
          solutions: ['How could this be solved? ->Solution'],
        },
        Solution: {
          $instructions: 'A potential solution approach',
          problem: '<-Problem',
          name: 'string',
          description: 'How does this solution work?',
          approach: 'Automation | Augmentation | Optimization | Elimination',
          headlessSaaS: '->HeadlessSaaS',
        },
        HeadlessSaaS: {
          $instructions: 'An agent-first SaaS product (APIs not UIs)',
          solution: '<-Solution',
          existingSaaS: 'What human SaaS does this replace?',
          differentiator: 'Why is agent-first better?',
          agentNeeds: ['What do AI agents need that humans dont?'],
          icps: ['Who would buy this? ->ICP'],
        },
        ICP: {
          $instructions: 'An Ideal Customer Profile',
          product: '<-HeadlessSaaS',
          as: 'Who are they? (role)',
          at: 'Where do they work? (company type)',
          to: 'What goal are they trying to achieve?',
          sentence: 'As {as} at {at}, I want to {to}',
        },
      })

      console.log('\n=== Starting Full Cascade ===')
      console.log('Task -> Problem -> Solution -> HeadlessSaaS -> ICP\n')

      const task = await db.Task.create(
        {
          title: 'Customer Support Ticket Routing',
          digital: 'Digital',
        },
        {
          cascade: true,
          maxDepth: 4,
          onProgress: (p) => {
            console.log(
              `[Depth ${p.currentDepth}] Creating ${p.currentType}... (${p.totalEntitiesCreated} total)`
            )
          },
          onError: (err) => {
            console.error('Cascade error:', err.message)
          },
        }
      )

      console.log('\n=== Cascade Complete ===')

      // Verify entities were created
      const tasks = await db.Task.list()
      const problems = await db.Problem.list()
      const solutions = await db.Solution.list()
      const products = await db.HeadlessSaaS.list()
      const icps = await db.ICP.list()

      console.log('\nCreated entities:')
      console.log(`  Tasks: ${tasks.length}`)
      console.log(`  Problems: ${problems.length}`)
      console.log(`  Solutions: ${solutions.length}`)
      console.log(`  HeadlessSaaS: ${products.length}`)
      console.log(`  ICPs: ${icps.length}`)

      expect(task).toBeTruthy()
      expect(problems.length).toBeGreaterThan(0)
      expect(solutions.length).toBeGreaterThan(0)
      expect(products.length).toBeGreaterThan(0)
      expect(icps.length).toBeGreaterThan(0)

      // Log sample output
      if (icps.length > 0) {
        console.log('\nSample ICP:')
        console.log(`  As: ${icps[0].as}`)
        console.log(`  At: ${icps[0].at}`)
        console.log(`  To: ${icps[0].to}`)
      }
    }, 120000)
  })
})
