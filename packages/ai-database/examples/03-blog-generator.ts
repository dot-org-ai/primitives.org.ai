/**
 * Blog Generator Example - ai-database
 *
 * This example demonstrates cascade generation to automatically generate
 * a complete blog structure from a single create() call:
 * - Forward exact (->) relationships for hierarchical content
 * - Backward references (<-) for aggregation
 * - AI-powered content generation
 * - Progress tracking during generation
 *
 * Run with: npx tsx examples/03-blog-generator.ts
 */

import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'
import type { DatabaseSchema, CascadeProgress } from '../src/index.js'

async function main() {
  // Initialize provider
  setProvider(createMemoryProvider())

  // Enable AI generation
  configureAIGeneration({
    enabled: true,
    model: 'sonnet',
  })

  // Define a blog schema with cascading relationships
  const schema = {
    Blog: {
      $instructions: 'A professional tech blog focused on AI and software development',
      title: 'string',
      description: 'A compelling description of the blog',
      // Forward exact: Generate 3-5 topics for this blog
      topics: ['Generate 3-5 main topics for this blog ->Topic'],
      // Backward exact: All posts that belong to this blog
      posts: ['<-Post.blog'],
    },

    Topic: {
      $instructions: 'A topic category for blog posts about {blog.title}',
      name: 'string',
      description: 'Brief description of this topic area',
      // Reference back to parent blog
      blog: '<-Blog.topics',
      // Forward exact: Generate 2-3 post ideas for this topic
      postIdeas: ['Generate 2-3 blog post ideas for this topic ->PostIdea'],
    },

    PostIdea: {
      $instructions: 'A blog post idea for the topic: {topic.name}',
      title: 'string',
      hook: 'An engaging opening hook for this post',
      targetAudience: 'Who would read this?',
      // Reference to parent topic
      topic: '<-Topic.postIdeas',
    },

    Post: {
      $instructions: 'A full blog post in markdown format',
      title: 'string',
      slug: 'URL-friendly slug',
      synopsis: 'A 2-3 sentence summary',
      content: 'Full markdown content with headers, code examples, and explanations',
      // Reference to the blog
      blog: '->Blog',
      // Reference to a topic
      topic: '->Topic?',
      // Author relationship
      author: '->Author?',
      // Tags for categorization
      tags: ['->Tag'],
    },

    Author: {
      name: 'string',
      bio: 'A brief author biography',
      expertise: 'Areas of expertise',
    },

    Tag: {
      name: 'string',
      slug: 'string',
    },
  } as const satisfies DatabaseSchema

  const { db } = DB(schema)

  console.log('=== Blog Generator Example ===\n')

  // Track progress during cascade generation
  const progressLog: string[] = []

  function onProgress(p: CascadeProgress) {
    const msg = `[${p.phase}] Depth ${p.depth}: ${p.currentType} (${p.totalEntitiesCreated} created)`
    progressLog.push(msg)
    console.log(msg)
  }

  // Step 1: Create a blog with full cascade generation
  console.log('--- Generating Blog Structure ---\n')

  const blog = await db.Blog.create(
    {
      title: 'AI Engineering Weekly',
    },
    {
      cascade: true,
      maxDepth: 3, // Blog -> Topics -> PostIdeas
      onProgress,
      onError: (err) => console.error('Cascade error:', err.message),
    }
  )

  console.log('\n--- Generated Blog ---\n')
  console.log('Title:', blog.title)
  console.log('Description:', blog.description)

  // Step 2: Explore the generated topics
  console.log('\n--- Generated Topics ---\n')

  const topics = await blog.topics
  for (const topic of topics) {
    console.log(`Topic: ${topic.name}`)
    console.log(`  Description: ${topic.description}`)

    // Get post ideas for each topic
    const ideas = await topic.postIdeas
    console.log(`  Post Ideas (${ideas.length}):`)
    for (const idea of ideas) {
      console.log(`    - ${idea.title}`)
      console.log(`      Hook: ${idea.hook?.substring(0, 60)}...`)
    }
    console.log()
  }

  // Step 3: Create an author
  console.log('--- Creating Author ---\n')

  const author = await db.Author.create({
    name: 'Alex Chen',
    bio: 'Senior AI Engineer with 10+ years of experience building intelligent systems.',
    expertise: 'Machine Learning, NLP, and AI Infrastructure',
  })
  console.log('Created author:', author.name)

  // Step 4: Create some tags
  console.log('\n--- Creating Tags ---\n')

  const tags = await Promise.all([
    db.Tag.create({ name: 'AI', slug: 'ai' }),
    db.Tag.create({ name: 'Machine Learning', slug: 'machine-learning' }),
    db.Tag.create({ name: 'Tutorial', slug: 'tutorial' }),
    db.Tag.create({ name: 'Best Practices', slug: 'best-practices' }),
  ])
  console.log('Created tags:', tags.map((t) => t.name).join(', '))

  // Step 5: Generate a full blog post from a post idea
  console.log('\n--- Generating Full Blog Post ---\n')

  // Get the first post idea
  const firstTopic = topics[0]
  const postIdeas = await firstTopic.postIdeas
  const firstIdea = postIdeas[0]

  console.log(`Converting idea to full post: "${firstIdea.title}"`)

  // Create a full post based on the idea
  const post = await db.Post.create(
    {
      title: firstIdea.title,
      blog: blog.$id,
      topic: firstTopic.$id,
      author: author.$id,
      tags: [tags[0].$id, tags[2].$id], // AI, Tutorial
    },
    {
      cascade: true,
      maxDepth: 1,
    }
  )

  console.log('\n--- Generated Post ---\n')
  console.log('Title:', post.title)
  console.log('Slug:', post.slug)
  console.log('Synopsis:', post.synopsis)
  console.log('\nContent Preview:')
  console.log(post.content?.substring(0, 500) + '...')

  // Step 6: Show blog statistics
  console.log('\n--- Blog Statistics ---\n')

  // Get all posts for this blog (backward reference)
  const blogPosts = await blog.posts
  console.log(`Total Posts: ${blogPosts.length}`)
  console.log(`Total Topics: ${topics.length}`)
  console.log(`Total Post Ideas: ${postIdeas.length}`)

  // Step 7: Show progress summary
  console.log('\n--- Generation Progress Summary ---\n')
  console.log(`Total progress events: ${progressLog.length}`)
  console.log('Phases covered:', [...new Set(progressLog.map((l) => l.match(/\[(\w+)\]/)?.[1]))])

  console.log('\n=== Blog Generator Example Complete ===')
}

main().catch(console.error)
