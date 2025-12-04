# ai-database

Schema-first database with AI-native primitives. Create, generate, and search by meaning.

```typescript
import { DB } from 'ai-database'

const db = DB({
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
const db = DB({
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

## Core Primitives

| Primitive | Description |
|-----------|-------------|
| **Things** | Entities with typed schemas |
| **Events** | Immutable log of mutations |
| **Actions** | Durable execution with progress |
| **Artifacts** | Cached embeddings and computed content |

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

- [Query Styles](https://primitives.org.ai/database/queries) - SQL, Document, Graph
- [Natural Language](https://primitives.org.ai/database/natural-language) - AI-powered queries
- [Events & Actions](https://primitives.org.ai/database/events) - Durable execution
- [Schema Types](https://primitives.org.ai/database/schema) - Noun & Verb definitions
- [Providers](https://primitives.org.ai/database/providers) - SQLite, ClickHouse, Memory

## Related Packages

- [`ai-functions`](../ai-functions) - AI-powered function primitives
- [`ai-workflows`](../ai-workflows) - Event-driven orchestration
- [`ai-providers`](../ai-providers) - Model provider abstraction
