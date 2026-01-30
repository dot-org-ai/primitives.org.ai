/**
 * Tests for edge direction tracking in relationships
 *
 * Tests that edge metadata correctly stores direction information:
 * - `->` Forward direction: source points to target
 * - `<-` Backward direction: target points to source (inverted edge)
 *
 * Edge direction enables:
 * - Graph traversal in both directions
 * - Reverse lookups (e.g., get all comments for a post)
 * - Proper cardinality inference
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

// TODO: Advanced feature tests - needs investigation
describe('Edge Direction Tracking', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('Forward edge storage', () => {
    it('should store forward edges correctly', async () => {
      const { db } = DB({
        Post: { author: '->Author' },
        Author: { name: 'string' },
      })

      const author = await db.Author.create({ name: 'John' })
      const post = await db.Post.create({ title: 'Hello', author: author.$id })

      // Edge should be: Post -> Author (forward)
      const edges = await db.Edge.find({ from: 'Post', name: 'author' })
      expect(edges[0]?.direction).toBe('forward')
    })

    it('should store forward edge with correct from/to types', async () => {
      const { db } = DB({
        Post: { author: '->Author' },
        Author: { name: 'string' },
      })

      const edges = await db.Edge.find({ from: 'Post', name: 'author' })
      expect(edges).toHaveLength(1)
      expect(edges[0]?.from).toBe('Post')
      expect(edges[0]?.to).toBe('Author')
      expect(edges[0]?.direction).toBe('forward')
    })

    it('should store forward exact edge with correct matchMode', async () => {
      const { db } = DB({
        Order: { customer: '->Customer' },
        Customer: { name: 'string' },
      })

      const edges = await db.Edge.find({ from: 'Order' })
      expect(edges[0]?.matchMode).toBe('exact')
    })

    it('should store forward fuzzy edge with correct matchMode', async () => {
      const { db } = DB({
        Document: { topic: '~>Topic' },
        Topic: { name: 'string' },
      })

      const edges = await db.Edge.find({ from: 'Document' })
      expect(edges[0]?.direction).toBe('forward')
      expect(edges[0]?.matchMode).toBe('fuzzy')
    })
  })

  describe('Backward edge with inverted direction', () => {
    it('should store backward edges with inverted direction', async () => {
      const { db } = DB({
        Investment: { startup: '<-Startup' },
        Startup: { name: 'string' },
      })

      const edges = await db.Edge.find({ to: 'Investment' })
      expect(edges[0]?.direction).toBe('backward')
      expect(edges[0]?.from).toBe('Startup')
    })

    it('should invert from/to for backward edges', async () => {
      const { db } = DB({
        Fund: { investments: ['<-Investment'] },
        Investment: { amount: 'number' },
      })

      // The edge should be stored as Investment -> Fund (inverted)
      const edges = await db.Edge.find({ name: 'investments' })
      expect(edges[0]?.direction).toBe('backward')
      expect(edges[0]?.from).toBe('Investment')
      expect(edges[0]?.to).toBe('Fund')
    })

    it('should store backward fuzzy edge correctly', async () => {
      const { db } = DB({
        Author: { writings: ['<~Publication'] },
        Publication: { title: 'string' },
      })

      const edges = await db.Edge.find({ name: 'writings' })
      expect(edges[0]?.direction).toBe('backward')
      expect(edges[0]?.matchMode).toBe('fuzzy')
    })

    it('should preserve backref in backward edges', async () => {
      const { db } = DB({
        Category: { products: ['<-Product.category'] },
        Product: { name: 'string' },
      })

      const edges = await db.Edge.find({ name: 'products' })
      expect(edges[0]?.backref).toBe('category')
    })
  })

  describe('Reverse lookups via backward edges', () => {
    it('should enable reverse lookups via backward edges', async () => {
      const { db } = DB({
        Post: { comments: ['<-Comment'] },
        Comment: { text: 'string' },
      })

      const post = await db.Post.create({ title: 'Test' })
      const comment = await db.Comment.create({ text: 'Nice!', post: post.$id })

      const postWithComments = await db.Post.get(post.$id)
      const comments = await postWithComments.comments
      expect(comments).toHaveLength(1)
    })

    it('should return empty array when no related entities exist', async () => {
      const { db } = DB({
        Post: { comments: ['<-Comment'] },
        Comment: { text: 'string' },
      })

      const post = await db.Post.create({ title: 'Empty Post' })
      const postWithComments = await db.Post.get(post.$id)
      const comments = await postWithComments.comments
      expect(comments).toHaveLength(0)
    })

    it('should support multiple backward edges on same entity', async () => {
      const { db } = DB({
        User: {
          posts: ['<-Post'],
          comments: ['<-Comment'],
        },
        Post: { title: 'string' },
        Comment: { text: 'string' },
      })

      const user = await db.User.create({ name: 'John' })
      // Use 'user' as field name to match backward edge lookup (entity name in lowercase)
      await db.Post.create({ title: 'My Post', user: user.$id })
      await db.Comment.create({ text: 'A comment', user: user.$id })

      const userWithRelations = await db.User.get(user.$id)
      const posts = await userWithRelations.posts
      const comments = await userWithRelations.comments

      expect(posts).toHaveLength(1)
      expect(comments).toHaveLength(1)
    })
  })

  describe('Edge direction inference', () => {
    it('should infer cardinality from direction and array syntax', async () => {
      const { db } = DB({
        Author: { posts: ['<-Post'] },
        Post: { author: '->Author' },
      })

      // Forward single: many-to-one (many posts point to one author)
      const forwardEdges = await db.Edge.find({ from: 'Post', name: 'author' })
      expect(forwardEdges[0]?.cardinality).toBe('many-to-one')

      // Backward array: one-to-many (one author has many posts)
      const backwardEdges = await db.Edge.find({ name: 'posts' })
      expect(backwardEdges[0]?.cardinality).toBe('one-to-many')
    })

    it('should handle self-referential edges with direction', async () => {
      const { db } = DB({
        Employee: {
          manager: '->Employee',
          reports: ['<-Employee'],
        },
      })

      const managerEdges = await db.Edge.find({ name: 'manager' })
      expect(managerEdges[0]?.direction).toBe('forward')
      expect(managerEdges[0]?.from).toBe('Employee')
      expect(managerEdges[0]?.to).toBe('Employee')

      const reportsEdges = await db.Edge.find({ name: 'reports' })
      expect(reportsEdges[0]?.direction).toBe('backward')
    })
  })

  describe('Edge metadata queries', () => {
    it('should query edges by direction', async () => {
      const { db } = DB({
        Post: { author: '->Author', category: '->Category' },
        Author: { posts: ['<-Post'] },
        Category: { posts: ['<-Post'] },
      })

      const forwardEdges = await db.Edge.find({ direction: 'forward' })
      const backwardEdges = await db.Edge.find({ direction: 'backward' })

      expect(forwardEdges.every((e) => e.direction === 'forward')).toBe(true)
      expect(backwardEdges.every((e) => e.direction === 'backward')).toBe(true)
    })

    it('should query edges by matchMode', async () => {
      const { db } = DB({
        Document: {
          author: '->Author',
          relatedTopic: '~>Topic',
        },
        Author: { name: 'string' },
        Topic: { name: 'string' },
      })

      const exactEdges = await db.Edge.find({ matchMode: 'exact' })
      const fuzzyEdges = await db.Edge.find({ matchMode: 'fuzzy' })

      expect(exactEdges.length).toBeGreaterThan(0)
      expect(fuzzyEdges.length).toBeGreaterThan(0)
      expect(exactEdges.every((e) => e.matchMode === 'exact')).toBe(true)
      expect(fuzzyEdges.every((e) => e.matchMode === 'fuzzy')).toBe(true)
    })

    it('should list all edges for a type', async () => {
      const { db } = DB({
        Order: {
          customer: '->Customer',
          products: ['->Product'],
          shipping: '->Address',
        },
        Customer: { name: 'string' },
        Product: { name: 'string' },
        Address: { street: 'string' },
      })

      const orderEdges = await db.Edge.find({ from: 'Order' })
      expect(orderEdges).toHaveLength(3)
    })
  })
})
