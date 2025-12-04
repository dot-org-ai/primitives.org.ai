# ai-database

Schema-first database with AI-native primitives. Create, generate, and search by meaning.

```typescript
import { DB } from 'ai-database'

const { db, events, actions } = DB({
  Post: { title: 'string', author: 'Author.posts' },
  Author: { name: 'string' }
})

await db.Post.create({ title: 'Hello World', author: 'john' })
await db.search('beginner tutorials')  // semantic search
```

## Features

- **Schema-first** - Define once, get typed operations everywhere
- **Bi-directional relationships** - `author: 'Author.posts'` creates both directions
- **Semantic search** - Hybrid vector + full-text search
- **Natural language queries** - `db\`what orders are pending?\``
- **Self-describing** - Every type stored as a Noun for introspection
- **AI generation** - Auto-generate content from schema prompts

## Installation

```bash
pnpm add ai-database
```

## Quick Start

```typescript
import { DB } from 'ai-database'

// Schema defines types AND generation prompts
const { db, events, actions, artifacts, nouns, verbs } = DB({
  Post: {
    title: 'Engaging post title',
    content: 'markdown',
    author: 'Author.posts',  // bi-directional relation
  },
  Author: {
    name: 'string',
    // posts: Post[] auto-created
  }
})

// CRUD
const post = await db.Post.create({ title: 'Hello', content: '...' })
const posts = await db.Post.list()
await db.Post.update(post.$id, { title: 'Updated' })

// Search
const results = await db.search('AI tutorials')

// Natural language
const pending = await db`what posts are drafts?`
```

## Destructured Exports

The `DB()` function returns all database primitives as destructured exports:

```typescript
const { db, events, actions, artifacts, nouns, verbs } = DB(schema)
```

| Export | Description |
|--------|-------------|
| `db` | CRUD operations for each entity type |
| `events` | Event subscription and emission |
| `actions` | Durable execution with progress tracking |
| `artifacts` | Cached embeddings and computed content |
| `nouns` | Type introspection |
| `verbs` | Action introspection |

## CRUD Operations

```typescript
// Create
const post = await db.Post.create({ title: 'Hello' })
const post = await db.Post.create('custom-id', { title: 'Hello' })

// Read
const post = await db.Post.get('post-id')
const posts = await db.Post.list()
const posts = await db.Post.list({ where: { published: true }, limit: 10 })
const posts = await db.Post.find({ author: 'john' })

// Update
await db.Post.update('post-id', { title: 'Updated' })

// Upsert
await db.Post.upsert('post-id', { title: 'Create or Update' })

// Delete
await db.Post.delete('post-id')

// Count
const total = await db.Post.count()
const published = await db.Post.count({ published: true })

// Iterate
await db.Post.forEach(async (post) => {
  console.log(post.title)
})
```

## Events

```typescript
// Subscribe to events
events.on('Post.created', (event) => {
  console.log(`New post: ${event.data.title}`)
})

events.on('*.updated', (event) => {
  console.log(`Updated: ${event.type}`)
})

// Emit custom events
await events.emit('custom.event', { data: 'value' })

// List events
const recent = await events.list({ limit: 100 })

// Replay events
await events.replay({
  since: yesterday,
  handler: async (event) => {
    await processEvent(event)
  }
})
```

## Actions

```typescript
// Create a durable action
const action = await actions.create({
  type: 'generate-posts',
  data: { count: 100 },
  total: 100,
})

// Update progress
await actions.update(action.id, { progress: 50 })

// Complete or fail
await actions.update(action.id, { status: 'completed', result: { created: 100 } })
await actions.update(action.id, { status: 'failed', error: 'Rate limited' })

// List and retry
const failed = await actions.list({ status: 'failed' })
await actions.retry(failed[0].id)
```

## Artifacts

```typescript
// Cache embeddings
await artifacts.set('Post/hello', 'embedding', {
  content: [0.1, 0.2, ...],
  sourceHash: 'abc123',
})

// Get cached artifact
const embedding = await artifacts.get('Post/hello', 'embedding')

// List all artifacts for a URL
const all = await artifacts.list('Post/hello')
```

## Semantic Types

Auto-generate linguistic forms for any noun or verb:

```typescript
import { pluralize, conjugate, Type } from 'ai-database'

pluralize('category')  // 'categories'
conjugate('publish')   // { actor: 'publisher', activity: 'publishing', ... }
Type('BlogPost').slug  // 'blog-post'
```

## Configuration

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Connection URL |

```bash
DATABASE_URL=./content         # filesystem (default)
DATABASE_URL=sqlite://./data   # SQLite
DATABASE_URL=:memory:          # in-memory
```

## Documentation

Full documentation at [primitives.org.ai/database](https://primitives.org.ai/database):

- [CRUD Operations](https://primitives.org.ai/database/create) - create, get, list, update, delete
- [Query Styles](https://primitives.org.ai/database/queries) - SQL, Document, Graph
- [Events](https://primitives.org.ai/database/events) - Event subscription
- [Actions](https://primitives.org.ai/database/actions) - Durable execution
- [Schema Types](https://primitives.org.ai/database/schema) - Noun & Verb definitions

## Related Packages

- [`ai-functions`](../ai-functions) - AI-powered function primitives
- [`ai-workflows`](../ai-workflows) - Event-driven orchestration
- [`ai-providers`](../ai-providers) - Model provider abstraction
