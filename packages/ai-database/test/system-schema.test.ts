/**
 * TDD: System Schema Exposure (Noun, Verb, Edge)
 *
 * Exposes system schema entities through the DB API.
 *
 * - DB() returns { db, nouns, verbs, edges }
 * - Nouns have singular/plural forms
 * - Verbs include all CRUD operations
 * - Edges capture relationship metadata
 * - System entities optionally stored in database
 *
 * Bead: aip-yqio
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, Verbs } from '../src/index.js'
import type { DatabaseSchema, Noun, Verb } from '../src/index.js'

// =============================================================================
// RED Phase Tests - These should FAIL until implementation is complete
// =============================================================================

describe('System Schema Exposure', () => {
  // Reset provider between tests to ensure isolation
  beforeEach(() => {
    setProvider(null as any)
  })

  // ---------------------------------------------------------------------------
  // Nouns API - Expose noun definitions for all entity types
  // ---------------------------------------------------------------------------

  describe('Nouns API', () => {
    it('should expose nouns for all entity types', async () => {
      const { db, nouns } = DB({
        Lead: { name: 'string' },
        Company: { name: 'string' },
      })

      expect(nouns).toBeDefined()

      // Get noun definitions
      const leadNoun = await nouns.get('Lead')
      const companyNoun = await nouns.get('Company')

      expect(leadNoun).toBeDefined()
      expect(leadNoun?.singular).toBe('lead')
      expect(leadNoun?.plural).toBe('leads')

      expect(companyNoun).toBeDefined()
      expect(companyNoun?.singular).toBe('company')
      expect(companyNoun?.plural).toBe('companies')
    })

    it('should list all noun definitions', async () => {
      const { nouns } = DB({
        Lead: { name: 'string' },
        Company: { name: 'string' },
        Contact: { email: 'string' },
      })

      const allNouns = await nouns.list()

      // Should include user-defined types (Lead, Company, Contact) + Edge system type
      expect(allNouns.length).toBeGreaterThanOrEqual(3)
      const names = allNouns.map((n) => n.singular)
      expect(names).toContain('lead')
      expect(names).toContain('company')
      expect(names).toContain('contact')
    })

    it('should infer singular/plural forms from PascalCase type names', async () => {
      const { nouns } = DB({
        BlogPost: { title: 'string' },
        UserProfile: { bio: 'string' },
      })

      const blogPostNoun = await nouns.get('BlogPost')
      const userProfileNoun = await nouns.get('UserProfile')

      expect(blogPostNoun?.singular).toBe('blog post')
      expect(blogPostNoun?.plural).toBe('blog posts')

      expect(userProfileNoun?.singular).toBe('user profile')
      expect(userProfileNoun?.plural).toBe('user profiles')
    })

    it('should handle irregular plurals', async () => {
      const { nouns } = DB({
        Person: { name: 'string' },
        Child: { name: 'string' },
      })

      const personNoun = await nouns.get('Person')
      const childNoun = await nouns.get('Child')

      expect(personNoun?.plural).toBe('people')
      expect(childNoun?.plural).toBe('children')
    })

    it('should include default CRUD actions on nouns', async () => {
      const { nouns } = DB({
        Post: { title: 'string' },
      })

      const postNoun = await nouns.get('Post')

      expect(postNoun?.actions).toContain('create')
      expect(postNoun?.actions).toContain('update')
      expect(postNoun?.actions).toContain('delete')
    })

    it('should include default events on nouns', async () => {
      const { nouns } = DB({
        Post: { title: 'string' },
      })

      const postNoun = await nouns.get('Post')

      expect(postNoun?.events).toContain('created')
      expect(postNoun?.events).toContain('updated')
      expect(postNoun?.events).toContain('deleted')
    })

    it('should allow defining custom nouns', async () => {
      const { nouns } = DB({
        Article: { title: 'string' },
      })

      // Define a custom noun with additional metadata
      await nouns.define({
        singular: 'article',
        plural: 'articles',
        description: 'A news article or blog post',
        actions: ['create', 'update', 'delete', 'publish', 'archive'],
        events: ['created', 'updated', 'deleted', 'published', 'archived'],
      })

      const articleNoun = await nouns.get('article')
      expect(articleNoun?.description).toBe('A news article or blog post')
      expect(articleNoun?.actions).toContain('publish')
      expect(articleNoun?.events).toContain('published')
    })

    it('should return null for non-existent noun', async () => {
      const { nouns } = DB({
        Post: { title: 'string' },
      })

      const nonExistent = await nouns.get('NonExistent')
      expect(nonExistent).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Verbs API - Expose verb definitions for CRUD operations
  // ---------------------------------------------------------------------------

  describe('Verbs API', () => {
    it('should expose verbs for CRUD operations', () => {
      const { verbs } = DB({
        Lead: { name: 'string' },
      })

      expect(verbs).toBeDefined()

      // Get verb definitions
      const createVerb = verbs.get('create')
      const updateVerb = verbs.get('update')
      const deleteVerb = verbs.get('delete')

      expect(createVerb).toBeDefined()
      expect(createVerb?.action).toBe('create')
      expect(createVerb?.actor).toBe('creator')
      expect(createVerb?.act).toBe('creates')
      expect(createVerb?.activity).toBe('creating')

      expect(updateVerb?.action).toBe('update')
      expect(deleteVerb?.action).toBe('delete')
    })

    it('should list all verb definitions', () => {
      const { verbs } = DB({
        Lead: { name: 'string' },
      })

      const allVerbs = verbs.list()

      // Should include at least the standard CRUD verbs
      const actions = allVerbs.map((v) => v.action)
      expect(actions).toContain('create')
      expect(actions).toContain('update')
      expect(actions).toContain('delete')
      expect(actions).toContain('publish')
      expect(actions).toContain('archive')
    })

    it('should expose verb conjugations (act, activity, result)', () => {
      const { verbs } = DB({
        Post: { title: 'string' },
      })

      const publishVerb = verbs.get('publish')

      expect(publishVerb?.action).toBe('publish')
      expect(publishVerb?.actor).toBe('publisher')
      expect(publishVerb?.act).toBe('publishes')
      expect(publishVerb?.activity).toBe('publishing')
      expect(publishVerb?.result).toBe('publication')
    })

    it('should expose verb reverse forms (at, by, in, for)', () => {
      const { verbs } = DB({
        Post: { title: 'string' },
      })

      const createVerb = verbs.get('create')

      expect(createVerb?.reverse?.at).toBe('createdAt')
      expect(createVerb?.reverse?.by).toBe('createdBy')
      expect(createVerb?.reverse?.in).toBe('createdIn')
      expect(createVerb?.reverse?.for).toBe('createdFor')
    })

    it('should expose verb inverse relationships', () => {
      const { verbs } = DB({
        Post: { title: 'string' },
      })

      const createVerb = verbs.get('create')
      const deleteVerb = verbs.get('delete')

      expect(createVerb?.inverse).toBe('delete')
      expect(deleteVerb?.inverse).toBe('create')
    })

    it('should allow defining custom verbs', () => {
      const { verbs } = DB({
        Post: { title: 'string' },
      })

      // Define a custom verb
      verbs.define({
        action: 'approve',
        actor: 'approver',
        act: 'approves',
        activity: 'approving',
        result: 'approval',
        reverse: { at: 'approvedAt', by: 'approvedBy' },
        inverse: 'reject',
      })

      const approveVerb = verbs.get('approve')
      expect(approveVerb).toBeDefined()
      expect(approveVerb?.actor).toBe('approver')
      expect(approveVerb?.inverse).toBe('reject')
    })

    it('should provide conjugate helper to auto-generate verb forms', () => {
      const { verbs } = DB({
        Post: { title: 'string' },
      })

      // Conjugate an unknown verb
      const submitVerb = verbs.conjugate('submit')

      expect(submitVerb.action).toBe('submit')
      expect(submitVerb.actor).toBe('submitter')
      expect(submitVerb.act).toBe('submits')
      expect(submitVerb.activity).toBe('submitting')
      expect(submitVerb.reverse?.at).toBe('submittedAt')
      expect(submitVerb.reverse?.by).toBe('submittedBy')
    })

    it('should return null for non-existent verb', () => {
      const { verbs } = DB({
        Post: { title: 'string' },
      })

      const nonExistent = verbs.get('nonexistent')
      expect(nonExistent).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Edges API - Expose edge definitions for relationships
  // ---------------------------------------------------------------------------

  describe('Edges (via db.Edge)', () => {
    it('should expose edges for relationships', async () => {
      const { db } = DB({
        Post: { author: 'Author.posts' },
        Author: { name: 'string' },
      })

      // Edge entity should be queryable
      const edges = await db.Edge.list()

      expect(edges.length).toBeGreaterThan(0)

      // Find the Post.author edge
      const authorEdge = edges.find((e: any) => e.from === 'Post' && e.name === 'author')

      expect(authorEdge).toBeDefined()
      expect(authorEdge?.to).toBe('Author')
      expect(authorEdge?.backref).toBe('posts')
      expect(authorEdge?.cardinality).toBe('many-to-one')
      expect(authorEdge?.direction).toBe('forward')
    })

    it('should expose many-to-many edges', async () => {
      const { db } = DB({
        Post: { tags: ['Tag.posts'] },
        Tag: { name: 'string' },
      })

      const edges = await db.Edge.list()

      const tagsEdge = edges.find((e: any) => e.from === 'Post' && e.name === 'tags')

      expect(tagsEdge).toBeDefined()
      expect(tagsEdge?.cardinality).toBe('many-to-many')
    })

    it('should expose edges without backrefs', async () => {
      const { db } = DB({
        Post: { category: 'Category' },
        Category: { name: 'string' },
      })

      const edges = await db.Edge.list()

      const categoryEdge = edges.find((e: any) => e.from === 'Post' && e.name === 'category')

      expect(categoryEdge).toBeDefined()
      expect(categoryEdge?.backref).toBeUndefined()
    })

    it('should include match mode for fuzzy edges', async () => {
      const { db } = DB({
        Post: { relatedPosts: ['~>Post'] },
      })

      const edges = await db.Edge.list()

      const relatedEdge = edges.find((e: any) => e.from === 'Post' && e.name === 'relatedPosts')

      expect(relatedEdge).toBeDefined()
      expect(relatedEdge?.matchMode).toBe('fuzzy')
    })

    it('should get a specific edge by searching', async () => {
      const { db } = DB({
        Post: { author: 'Author.posts', tags: ['Tag.posts'] },
        Author: { name: 'string' },
        Tag: { name: 'string' },
      })

      // Find edges from Post
      const postEdges = await db.Edge.find({ from: 'Post' })

      expect(postEdges.length).toBe(2)
      const edgeNames = postEdges.map((e: any) => e.name)
      expect(edgeNames).toContain('author')
      expect(edgeNames).toContain('tags')
    })
  })

  // ---------------------------------------------------------------------------
  // System entities queryable via db.Noun, db.Verb, db.Edge
  // ---------------------------------------------------------------------------

  describe('System Entities in Database', () => {
    it('should include Noun and Verb in db object keys', async () => {
      const { db } = DB({
        Post: { title: 'string' },
      })

      const dbKeys = Object.keys(db)
      expect(dbKeys).toContain('Noun')
      expect(dbKeys).toContain('Verb')
      expect(dbKeys).toContain('Edge')
      expect(dbKeys).toContain('Post')
    })

    it('should auto-populate Noun entities for all schema types', async () => {
      const { db } = DB({
        Lead: { name: 'string', company: 'Company.leads' },
        Company: { name: 'string' },
      })

      // Check that db.Noun is defined
      expect(db.Noun).toBeDefined()
      expect(typeof db.Noun.list).toBe('function')

      // System entities should be queryable via db.Noun
      const nouns = await db.Noun.list()

      // Should have nouns for Lead and Company
      const nounNames = nouns.map((n: any) => n.name)
      expect(nounNames).toContain('Lead')
      expect(nounNames).toContain('Company')
    })

    it('should include noun metadata in database records', async () => {
      const { db } = DB({
        BlogPost: { title: 'string' },
      })

      const nouns = await db.Noun.list()
      const blogPostNoun = nouns.find((n: any) => n.name === 'BlogPost')

      expect(blogPostNoun).toBeDefined()
      expect(blogPostNoun?.singular).toBe('blog post')
      expect(blogPostNoun?.plural).toBe('blog posts')
      expect(blogPostNoun?.slug).toBe('blog-post')
      expect(blogPostNoun?.slugPlural).toBe('blog-posts')
    })

    it('should include Verb entities for standard actions', async () => {
      const { db } = DB({
        Post: { title: 'string' },
      })

      // If Verb entities are persisted
      if (db.Verb) {
        const verbs = await db.Verb.list()

        // Should have standard CRUD verbs
        const verbActions = verbs.map((v: any) => v.action)
        expect(verbActions).toContain('create')
        expect(verbActions).toContain('update')
        expect(verbActions).toContain('delete')
      }
    })

    it('should auto-populate Edge entities from relationships', async () => {
      const { db } = DB({
        Lead: { name: 'string', company: 'Company.leads' },
        Company: { name: 'string' },
      })

      const edges = await db.Edge.list()

      // Should have edge for Lead.company relationship
      const companyEdge = edges.find((e: any) => e.name === 'company')
      expect(companyEdge).toBeDefined()
      expect(companyEdge?.from).toBe('Lead')
      expect(companyEdge?.to).toBe('Company')
    })

    it('should get a Noun entity by type name', async () => {
      const { db } = DB({
        Post: { title: 'string' },
      })

      // Search for Post noun
      const postNouns = await db.Noun.find({ name: 'Post' })

      expect(postNouns.length).toBe(1)
      expect(postNouns[0]?.singular).toBe('post')
    })

    it('should include noun properties from schema', async () => {
      const { db } = DB({
        Post: {
          title: 'string',
          content: 'markdown',
          published: 'boolean?',
        },
      })

      const nouns = await db.Noun.list()
      const postNoun = nouns.find((n: any) => n.name === 'Post')

      expect(postNoun?.properties).toBeDefined()
      expect(postNoun?.properties?.title?.type).toBe('string')
      expect(postNoun?.properties?.content?.type).toBe('markdown')
      expect(postNoun?.properties?.published?.optional).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Integration: Using nouns, verbs, edges together
  // ---------------------------------------------------------------------------

  describe('Integration', () => {
    it('should provide consistent noun data between nouns API and db.Noun', async () => {
      const { db, nouns } = DB({
        Post: { title: 'string' },
      })

      const nounFromAPI = await nouns.get('Post')
      const nounsFromDB = await db.Noun.list()
      const nounFromDB = nounsFromDB.find((n: any) => n.name === 'Post')

      expect(nounFromAPI?.singular).toBe(nounFromDB?.singular)
      expect(nounFromAPI?.plural).toBe(nounFromDB?.plural)
    })

    it('should provide consistent edge data between schema and db.Edge', async () => {
      const { db } = DB({
        Post: { author: 'Author.posts' },
        Author: { name: 'string' },
      })

      const edges = await db.Edge.list()
      const authorEdge = edges.find((e: any) => e.name === 'author' && e.from === 'Post')

      // Edge should match the schema definition
      expect(authorEdge?.to).toBe('Author')
      expect(authorEdge?.backref).toBe('posts')
    })

    it('should support querying edges by multiple criteria', async () => {
      const { db } = DB({
        Post: {
          author: 'Author.posts',
          tags: ['Tag.posts'],
          comments: ['Comment.post'],
        },
        Author: { name: 'string' },
        Tag: { name: 'string' },
        Comment: { text: 'string' },
      })

      // Find all edges going to Author type
      const toAuthorEdges = await db.Edge.find({ to: 'Author' })
      expect(toAuthorEdges.length).toBeGreaterThan(0)
      expect(toAuthorEdges[0]?.from).toBe('Post')

      // Find all many-to-many edges (including backrefs)
      const manyToManyEdges = await db.Edge.find({ cardinality: 'many-to-many' })
      // tags + comments from Post, plus backrefs on Tag and Comment
      expect(manyToManyEdges.length).toBeGreaterThanOrEqual(2)
    })
  })
})
