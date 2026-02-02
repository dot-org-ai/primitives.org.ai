/**
 * Quickstart Example - ai-database
 *
 * This example demonstrates the basic usage of ai-database:
 * - Schema definition with type-safe operations
 * - CRUD operations (create, read, update, delete)
 * - Simple relationships
 * - Promise pipelining
 *
 * Run with: npx tsx examples/01-quickstart.ts
 */

import { DB, setProvider, createMemoryProvider } from '../src/index.js'

async function main() {
  // Initialize the in-memory provider
  setProvider(createMemoryProvider())

  // Define your schema
  const { db } = DB({
    Post: {
      title: 'string',
      content: 'markdown',
      published: 'boolean',
      author: '->Author', // Forward reference to Author
    },
    Author: {
      name: 'string',
      email: 'string',
      posts: ['<-Post.author'], // Backward reference: all posts by this author
    },
  })

  console.log('=== ai-database Quickstart ===\n')

  // Create an author
  const author = await db.Author.create({
    name: 'Jane Smith',
    email: 'jane@example.com',
  })
  console.log('Created author:', author.name)

  // Create posts for the author
  const post1 = await db.Post.create({
    title: 'Introduction to AI Databases',
    content: '# Welcome\n\nThis is my first post about AI-powered databases.',
    published: true,
    author: author.$id,
  })

  const post2 = await db.Post.create({
    title: 'Advanced Schema Design',
    content: '# Schema Design\n\nLet me show you advanced patterns.',
    published: false,
    author: author.$id,
  })

  console.log('Created posts:', post1.title, 'and', post2.title)

  // Read operations
  console.log('\n--- Read Operations ---')

  // Get by ID
  const fetchedPost = await db.Post.get(post1.$id)
  console.log('Fetched post:', fetchedPost?.title)

  // List all posts
  const allPosts = await db.Post.list()
  console.log('Total posts:', allPosts.length)

  // Find with filter
  const publishedPosts = await db.Post.find({ published: true })
  console.log('Published posts:', publishedPosts.length)

  // Navigate relationships
  console.log('\n--- Relationships ---')

  // Get author from post
  const postAuthor = await post1.author
  console.log('Post author:', postAuthor.name)

  // Get all posts by author (backward reference)
  const authorPosts = await author.posts
  console.log('Author has', authorPosts.length, 'posts')

  // Update operation
  console.log('\n--- Update Operation ---')
  await db.Post.update(post2.$id, { published: true })
  const updatedPost = await db.Post.get(post2.$id)
  console.log('Updated post published status:', updatedPost?.published)

  // Promise pipelining (chain without await)
  console.log('\n--- Promise Pipelining ---')

  // Chain operations without intermediate awaits
  const titles = db.Post.list()
    .filter((p) => p.published)
    .map((p) => p.title)

  // Only await at the end
  const result = await titles
  console.log('Published post titles:', result)

  // Delete operation
  console.log('\n--- Delete Operation ---')
  await db.Post.delete(post2.$id)
  const remainingPosts = await db.Post.list()
  console.log('Remaining posts:', remainingPosts.length)

  console.log('\n=== Quickstart Complete ===')
}

main().catch(console.error)
