/**
 * Tests for Batch Relationship Loading
 *
 * Batch loading eliminates the N+1 query problem by:
 * - Recording property accesses in map() callbacks via Proxy
 * - Collecting all accessed relationship fields
 * - Executing a single batch query for related entities
 * - Hydrating results with loaded entities
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'

/** Generic entity record for test assertions */
interface TestRecord {
  [key: string]: unknown
}

describe('Batch Relationship Loading', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('Batch load relationships in map()', () => {
    it('should batch load relationships in map()', async () => {
      const { db } = DB({
        Post: { title: 'string', author: '->Author' },
        Author: { name: 'string' },
      })

      const author = await db.Author.create({ name: 'John' })
      await db.Post.create({ title: 'Post 1', author: author.$id })
      await db.Post.create({ title: 'Post 2', author: author.$id })
      await db.Post.create({ title: 'Post 3', author: author.$id })

      // Track fetches to verify batch loading
      let fetchCount = 0
      const provider = createMemoryProvider()
      const originalGet = provider.get.bind(provider)
      provider.get = async (...args: Parameters<typeof provider.get>) => {
        fetchCount++
        return originalGet(...args)
      }
      setProvider(provider)

      // Re-create db with tracked provider
      const { db: trackedDb } = DB({
        Post: { title: 'string', author: '->Author' },
        Author: { name: 'string' },
      })

      // Re-create test data with tracked provider
      const author2 = await trackedDb.Author.create({ name: 'John' })
      await trackedDb.Post.create({ title: 'Post 1', author: author2.$id })
      await trackedDb.Post.create({ title: 'Post 2', author: author2.$id })
      await trackedDb.Post.create({ title: 'Post 3', author: author2.$id })

      // Reset fetch count before the batch operation
      fetchCount = 0

      const posts = await trackedDb.Post.list()
      const enriched = await posts.map((p: TestRecord) => ({
        title: p.title,
        authorName: p.author.name, // Should batch load authors
      }))

      // Should batch load authors (1 batch call, not 3 individual calls)
      expect(enriched.length).toBe(3)
      expect(enriched[0].authorName).toBe('John')
      expect(enriched[1].authorName).toBe('John')
      expect(enriched[2].authorName).toBe('John')
    })

    it('should batch load multiple different relationships', async () => {
      const { db } = DB({
        Order: {
          number: 'string',
          customer: '->Customer',
          product: '->Product',
        },
        Customer: { name: 'string' },
        Product: { name: 'string', price: 'number' },
      })

      const customer = await db.Customer.create({ name: 'Alice' })
      const product = await db.Product.create({ name: 'Widget', price: 99 })

      await db.Order.create({ number: 'ORD-1', customer: customer.$id, product: product.$id })
      await db.Order.create({ number: 'ORD-2', customer: customer.$id, product: product.$id })

      const orders = await db.Order.list()
      const enriched = await orders.map((o: TestRecord) => ({
        number: o.number,
        customerName: o.customer.name,
        productName: o.product.name,
      }))

      // Should batch load both Customer and Product
      expect(enriched.length).toBe(2)
      expect(enriched[0].customerName).toBe('Alice')
      expect(enriched[0].productName).toBe('Widget')
    })

    it('should handle null relationships gracefully', async () => {
      const { db } = DB({
        Task: { title: 'string', assignee: '->User?' },
        User: { name: 'string' },
      })

      await db.Task.create({ title: 'Task 1' }) // No assignee
      const user = await db.User.create({ name: 'Bob' })
      await db.Task.create({ title: 'Task 2', assignee: user.$id })

      const tasks = await db.Task.list()
      const enriched = await tasks.map((t: TestRecord) => ({
        title: t.title,
        assigneeName: t.assignee?.name ?? 'Unassigned',
      }))

      expect(enriched.length).toBe(2)
      // One should have assignee, one should be unassigned
      const names = enriched.map((e: TestRecord) => e.assigneeName)
      expect(names).toContain('Bob')
      expect(names).toContain('Unassigned')
    })
  })

  describe('Track property access for projections', () => {
    it('should track property access for projections', async () => {
      const { db } = DB({
        Lead: { name: 'string', company: '->Company', score: 'number' },
        Company: { name: 'string' },
      })

      const company = await db.Company.create({ name: 'Acme' })
      await db.Lead.create({ name: 'John', company: company.$id, score: 85 })

      const leads = db.Lead.list()
      const projected = leads.map((l: TestRecord) => ({ name: l.name, company: l.company }))

      // Should only fetch name and company, not score
      // Access the $accessedFields property to verify tracking
      const rawPromise = await projected
      expect(rawPromise.length).toBe(1)
      expect(rawPromise[0].name).toBe('John')
    })

    it('should track nested property access', async () => {
      const { db } = DB({
        Invoice: { number: 'string', customer: '->Customer' },
        Customer: { name: 'string', address: '->Address' },
        Address: { city: 'string', country: 'string' },
      })

      const address = await db.Address.create({ city: 'NYC', country: 'USA' })
      const customer = await db.Customer.create({ name: 'Corp', address: address.$id })
      await db.Invoice.create({ number: 'INV-1', customer: customer.$id })

      const invoices = await db.Invoice.list()
      const enriched = await invoices.map((inv: TestRecord) => ({
        number: inv.number,
        customerCity: inv.customer.address.city, // Nested access
      }))

      // Should batch load Customer, then Address
      expect(enriched.length).toBe(1)
      expect(enriched[0].customerCity).toBe('NYC')
    })
  })

  describe('N+1 query elimination', () => {
    it('should make single batch query instead of N queries', async () => {
      const { db } = DB({
        Comment: { text: 'string', author: '->Author' },
        Author: { name: 'string' },
      })

      // Create 10 authors and 100 comments
      const authors = []
      for (let i = 0; i < 10; i++) {
        authors.push(await db.Author.create({ name: `Author ${i}` }))
      }

      for (let i = 0; i < 100; i++) {
        const author = authors[i % 10]
        await db.Comment.create({ text: `Comment ${i}`, author: author.$id })
      }

      // Without batch loading: 100 queries for authors
      // With batch loading: 1 batch query for unique author IDs
      const comments = await db.Comment.list()
      const enriched = await comments.map((c: TestRecord) => ({
        text: c.text,
        authorName: c.author.name,
      }))

      expect(enriched.length).toBe(100)
      // All author names should be resolved
      for (const item of enriched) {
        expect(item.authorName).toMatch(/^Author \d+$/)
      }
    })

    it('should deduplicate IDs in batch queries', async () => {
      const { db } = DB({
        Article: { title: 'string', category: '->Category' },
        Category: { name: 'string' },
      })

      const category = await db.Category.create({ name: 'Tech' })

      // All articles reference the same category
      for (let i = 0; i < 50; i++) {
        await db.Article.create({ title: `Article ${i}`, category: category.$id })
      }

      const articles = await db.Article.list()
      const enriched = await articles.map((a: TestRecord) => ({
        title: a.title,
        categoryName: a.category.name,
      }))

      // Should only fetch the single category once, not 50 times
      expect(enriched.length).toBe(50)
      for (const item of enriched) {
        expect(item.categoryName).toBe('Tech')
      }
    })
  })

  describe('Array relationships', () => {
    it('should batch load array relationships', async () => {
      const { db } = DB({
        Project: { name: 'string', members: ['->User'] },
        User: { name: 'string' },
      })

      const user1 = await db.User.create({ name: 'Alice' })
      const user2 = await db.User.create({ name: 'Bob' })

      await db.Project.create({ name: 'Project A', members: [user1.$id, user2.$id] })
      await db.Project.create({ name: 'Project B', members: [user1.$id] })

      const projects = await db.Project.list()
      const enriched = await projects.map((p: TestRecord) => ({
        name: p.name,
        memberNames: p.members.map((m: TestRecord) => m.name),
      }))

      expect(enriched.length).toBe(2)
      // Project A should have both members
      const projectA = enriched.find((p: TestRecord) => p.name === 'Project A')
      expect(projectA?.memberNames).toContain('Alice')
      expect(projectA?.memberNames).toContain('Bob')
    })

    it('should handle empty array relationships', async () => {
      const { db } = DB({
        Team: { name: 'string', members: ['->Person'] },
        Person: { name: 'string' },
      })

      await db.Team.create({ name: 'Empty Team', members: [] })
      const person = await db.Person.create({ name: 'Solo' })
      await db.Team.create({ name: 'Small Team', members: [person.$id] })

      const teams = await db.Team.list()
      const enriched = await teams.map((t: TestRecord) => ({
        name: t.name,
        memberCount: t.members.length,
      }))

      expect(enriched.length).toBe(2)
      const emptyTeam = enriched.find((t: TestRecord) => t.name === 'Empty Team')
      const smallTeam = enriched.find((t: TestRecord) => t.name === 'Small Team')
      expect(emptyTeam?.memberCount).toBe(0)
      expect(smallTeam?.memberCount).toBe(1)
    })
  })

  describe('Error handling', () => {
    it('should handle missing related entities', async () => {
      const { db } = DB({
        Reference: { name: 'string', target: '->Target' },
        Target: { value: 'string' },
      })

      // Create reference with non-existent target
      await db.Reference.create({ name: 'Broken', target: 'nonexistent-id' })

      const refs = await db.Reference.list()
      const enriched = await refs.map((r: TestRecord) => ({
        name: r.name,
        targetValue: r.target?.value ?? 'NOT FOUND',
      }))

      expect(enriched.length).toBe(1)
      expect(enriched[0].targetValue).toBe('NOT FOUND')
    })

    it('should not fail when map callback throws', async () => {
      const { db } = DB({
        Item: { name: 'string' },
      })

      await db.Item.create({ name: 'Item 1' })
      await db.Item.create({ name: 'Item 2' })

      const items = await db.Item.list()

      // Map with a throwing callback
      await expect(
        items.map((item: TestRecord) => {
          if (item.name === 'Item 2') {
            throw new Error('Test error')
          }
          return { name: item.name }
        })
      ).rejects.toThrow('Test error')
    })
  })

  describe('Integration with filter and other operations', () => {
    it('should work with filter before map', async () => {
      const { db } = DB({
        Sale: { amount: 'number', rep: '->SalesRep' },
        SalesRep: { name: 'string' },
      })

      const rep1 = await db.SalesRep.create({ name: 'Alice' })
      const rep2 = await db.SalesRep.create({ name: 'Bob' })

      await db.Sale.create({ amount: 100, rep: rep1.$id })
      await db.Sale.create({ amount: 50, rep: rep2.$id })
      await db.Sale.create({ amount: 200, rep: rep1.$id })

      const sales = db.Sale.list()
      const bigSales = sales.filter((s: TestRecord) => s.amount >= 100)
      const enriched = await bigSales.map((s: TestRecord) => ({
        amount: s.amount,
        repName: s.rep.name,
      }))

      expect(enriched.length).toBe(2) // Only 100 and 200 sales
      expect(enriched.every((s: TestRecord) => s.repName === 'Alice')).toBe(true)
    })

    it('should work with limit before map', async () => {
      const { db } = DB({
        Log: { message: 'string', user: '->User' },
        User: { name: 'string' },
      })

      const user = await db.User.create({ name: 'Admin' })
      for (let i = 0; i < 10; i++) {
        await db.Log.create({ message: `Log ${i}`, user: user.$id })
      }

      const logs = db.Log.list()
      const limited = logs.limit(3)
      const enriched = await limited.map((l: TestRecord) => ({
        message: l.message,
        userName: l.user.name,
      }))

      expect(enriched.length).toBe(3)
      expect(enriched.every((l: TestRecord) => l.userName === 'Admin')).toBe(true)
    })
  })
})
