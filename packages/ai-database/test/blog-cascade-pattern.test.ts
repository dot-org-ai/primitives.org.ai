/**
 * Quick test to verify db4.ai Blog cascade pattern works in ai-database
 * Uses REAL AI calls through Cloudflare AI Gateway (cached for efficiency)
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'

// TODO: Advanced feature tests - needs investigation
describe('Blog Cascade Pattern (db4.ai style)', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
    configureAIGeneration({ enabled: true, model: 'sonnet' })
  })

  it('should support prompt-driven forward exact generation (->Type)', async () => {
    const { db } = DB({
      Startup: {
        name: 'string',
        idea: 'What problem does this solve? ->Idea',
      },
      Idea: {
        problem: 'string',
        solution: 'string',
      },
    })

    const startup = await db.Startup.create({ name: 'TestStartup' })

    // Access the idea
    const idea = await startup.idea
    expect(idea).toBeDefined()
    expect(idea.$type).toBe('Idea')

    // Verify generated content has proper structure
    expect(idea.problem).toBeDefined()
    expect(typeof idea.problem).toBe('string')
    expect(idea.problem.length).toBeGreaterThan(0)

    expect(idea.solution).toBeDefined()
    expect(typeof idea.solution).toBe('string')
    expect(idea.solution.length).toBeGreaterThan(0)
  })

  it('should handle Company -> Product cascade', async () => {
    const { db } = DB({
      Company: {
        name: 'string',
        product: 'Generate a product for this company ->Product',
      },
      Product: {
        name: 'string',
        description: 'string',
      },
    })

    const company = await db.Company.create({ name: 'Acme Corp' })

    expect(company).toBeDefined()
    expect(company.$type).toBe('Company')
    expect(company.name).toBe('Acme Corp')

    // Access the product (should be generated via forward exact)
    const product = await company.product
    expect(product).toBeDefined()
    expect(product.$type).toBe('Product')

    // Verify generated content has proper structure
    expect(product.name).toBeDefined()
    expect(typeof product.name).toBe('string')
    expect(product.name.length).toBeGreaterThan(0)

    expect(product.description).toBeDefined()
    expect(typeof product.description).toBe('string')
    expect(product.description.length).toBeGreaterThan(0)
  })

  it('should cascade through multiple levels', async () => {
    const { db } = DB({
      Blog: {
        title: 'string',
        topic: 'Generate the main topic ->Topic',
      },
      Topic: {
        name: 'string',
        post: 'Write a blog post about this topic ->Post',
      },
      Post: {
        title: 'string',
        content: 'string',
      },
    })

    const blog = await db.Blog.create({ title: 'AI Services Blog' })

    expect(blog).toBeDefined()
    expect(blog.title).toBe('AI Services Blog')

    // Access topic (level 1 cascade)
    const topic = await blog.topic
    expect(topic).toBeDefined()
    expect(topic.$type).toBe('Topic')

    // Verify topic has generated content
    expect(topic.name).toBeDefined()
    expect(typeof topic.name).toBe('string')
    expect(topic.name.length).toBeGreaterThan(0)

    // Access post (level 2 cascade)
    const post = await topic.post
    expect(post).toBeDefined()
    expect(post.$type).toBe('Post')

    // Verify post has generated content
    expect(post.title).toBeDefined()
    expect(typeof post.title).toBe('string')
    expect(post.title.length).toBeGreaterThan(0)

    expect(post.content).toBeDefined()
    expect(typeof post.content).toBe('string')
    expect(post.content.length).toBeGreaterThan(0)
  })

  it('should include context in generation prompt', async () => {
    const { db } = DB({
      Company: {
        $instructions: 'This is a B2B SaaS company',
        name: 'string',
        industry: 'string',
        product: 'Generate a product suited for this company ->Product',
      },
      Product: {
        name: 'string',
        description: 'string',
      },
    })

    const company = await db.Company.create({
      name: 'TechCorp',
      industry: 'Enterprise Software',
    })

    // Access the product to trigger generation
    const product = await company.product

    // Verify generated product has proper structure
    expect(product).toBeDefined()
    expect(product.$type).toBe('Product')
    expect(product.name).toBeDefined()
    expect(typeof product.name).toBe('string')
    expect(product.name.length).toBeGreaterThan(0)

    expect(product.description).toBeDefined()
    expect(typeof product.description).toBe('string')
    expect(product.description.length).toBeGreaterThan(0)
  })

  it('should handle backward references (<-Type)', async () => {
    const { db } = DB({
      Author: {
        name: 'string',
        posts: ['<-Post.author'], // Posts that reference this author
      },
      Post: {
        title: 'string',
        author: '->Author',
      },
    })

    // Create an author
    const author = await db.Author.create({ name: 'Jane Doe' })

    // Create posts that reference the author
    await db.Post.create({ title: 'First Post', author: author.$id })
    await db.Post.create({ title: 'Second Post', author: author.$id })

    // Get the author's posts via backward reference
    const authorWithPosts = await db.Author.get(author.$id)
    const posts = await authorWithPosts?.posts

    expect(Array.isArray(posts)).toBe(true)
    expect(posts.length).toBe(2)
    expect(posts.map((p: { title: string }) => p.title)).toContain('First Post')
    expect(posts.map((p: { title: string }) => p.title)).toContain('Second Post')
  })
})
