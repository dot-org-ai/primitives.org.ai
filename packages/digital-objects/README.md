# digital-objects

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

Unified storage primitive for AI primitives - a linguistically-aware entity and graph system.

> **Documentation:** For comprehensive guides and examples, see the [Digital Objects documentation](https://primitives.org.ai/digital-objects).

## Overview

`digital-objects` provides a coherent model for defining and managing entities (nouns/things) and relationships (verbs/actions). It automatically derives linguistic forms (pluralization, verb conjugation) and unifies events, graph edges, and audit trails into a single "action" concept.

## Core Concepts

### Nouns and Things

**Nouns** define entity types. **Things** are instances of nouns.

```typescript
import { createMemoryProvider } from 'digital-objects'

const provider = createMemoryProvider()

// Define a noun (entity type)
const postNoun = await provider.defineNoun({
  name: 'Post',
  description: 'A blog post',
  schema: {
    title: 'string',
    body: 'markdown',
    publishedAt: 'datetime?',
  },
})

// Linguistic forms are auto-derived:
// postNoun.singular = 'post'
// postNoun.plural = 'posts'
// postNoun.slug = 'post'

// Create a thing (entity instance)
const post = await provider.create('Post', {
  title: 'Hello World',
  body: '# Welcome\n\nThis is my first post.',
})
```

### Verbs and Actions

**Verbs** define action types. **Actions** represent events, graph edges, and audit records - unified.

```typescript
// Define a verb
const publishVerb = await provider.defineVerb({
  name: 'publish',
  inverse: 'unpublish',
})

// Conjugations are auto-derived:
// publishVerb.action = 'publish'     (imperative)
// publishVerb.act = 'publishes'      (3rd person)
// publishVerb.activity = 'publishing' (gerund)
// publishVerb.event = 'published'     (past participle)
// publishVerb.reverseBy = 'publishedBy'
// publishVerb.reverseAt = 'publishedAt'

// Perform an action (creates an event + edge)
const action = await provider.perform(
  'publish',      // verb
  author.id,      // subject (who/from)
  post.id,        // object (what/to)
  { featured: true } // metadata
)
```

### Actions as Graph Edges

Actions form a directed graph. Use `related()` and `edges()` for traversal:

```typescript
// Get all things this author has published
const publishedPosts = await provider.related(author.id, 'publish', 'out')

// Get who published this post
const publishers = await provider.related(post.id, 'publish', 'in')

// Get all relationships (both directions)
const allRelated = await provider.related(post.id, undefined, 'both')

// Get edge details (the actions themselves)
const publishActions = await provider.edges(author.id, 'publish', 'out')
```

## Linguistic Derivation

The package automatically derives linguistic forms from base words.

### Noun Derivation

```typescript
import { deriveNoun, pluralize, singularize } from 'digital-objects'

deriveNoun('Post')      // { singular: 'post', plural: 'posts', slug: 'post' }
deriveNoun('BlogPost')  // { singular: 'blog post', plural: 'blog posts', slug: 'blog-post' }
deriveNoun('Person')    // { singular: 'person', plural: 'people', slug: 'person' }

pluralize('category')   // 'categories'
pluralize('child')      // 'children'
singularize('posts')    // 'post'
```

### Verb Derivation

```typescript
import { deriveVerb } from 'digital-objects'

deriveVerb('create')
// {
//   action: 'create',
//   act: 'creates',
//   activity: 'creating',
//   event: 'created',
//   reverseBy: 'createdBy',
//   reverseAt: 'createdAt'
// }

deriveVerb('write')
// {
//   action: 'write',
//   act: 'writes',
//   activity: 'writing',
//   event: 'written',        (irregular)
//   reverseBy: 'writtenBy',
//   reverseAt: 'writtenAt'
// }
```

## Providers

### MemoryProvider

In-memory implementation for testing and development:

```typescript
import { createMemoryProvider, MemoryProvider } from 'digital-objects'

// Factory function
const provider = createMemoryProvider()

// Or instantiate directly
const provider = new MemoryProvider()

// Clean up
await provider.close()
```

### NS (Namespace Durable Object)

SQLite-backed implementation for Cloudflare Workers with multi-tenant support:

```typescript
// In wrangler.toml:
// [[durable_objects.bindings]]
// name = "NS"
// class_name = "NS"

// Import for Workers
import { NS } from 'digital-objects/ns'

// Access via HTTP
export default {
  async fetch(request: Request, env: Env) {
    const namespace = 'tenant-123'
    const id = env.NS.idFromName(namespace)
    const stub = env.NS.get(id)
    return stub.fetch(request)
  }
}

// HTTP API endpoints:
// POST /nouns        - Define a noun
// GET  /nouns/:name  - Get a noun
// GET  /nouns        - List nouns
// POST /verbs        - Define a verb
// POST /things       - Create a thing
// GET  /things/:id   - Get a thing
// PATCH /things/:id  - Update a thing
// DELETE /things/:id - Delete a thing
// POST /actions      - Perform an action
// GET  /related/:id  - Get related things
```

### NS Client

HTTP client for accessing NS from other services:

```typescript
import { createNSClient } from 'digital-objects'

const client = createNSClient({
  baseUrl: 'https://ns.example.com',
  namespace: 'my-namespace',
})

const post = await client.create('Post', { title: 'Hello' })
```

## R2 Persistence

Backup, restore, and export functionality using Cloudflare R2.

### Snapshots

```typescript
import { createSnapshot, restoreSnapshot } from 'digital-objects'

// Create a full snapshot
const result = await createSnapshot(provider, r2, 'my-namespace', {
  timestamp: true, // Include timestamp in filename
})
// result.key = 'snapshots/my-namespace/1234567890.json'

// Restore from snapshot
await restoreSnapshot(provider, r2, 'my-namespace')
// or specify a snapshot key:
await restoreSnapshot(provider, r2, 'my-namespace', 'snapshots/my-namespace/1234567890.json')
```

### Write-Ahead Log (WAL)

```typescript
import { appendWAL, replayWAL, compactWAL } from 'digital-objects'

// Append operation to WAL
await appendWAL(r2, 'my-namespace', {
  type: 'create',
  noun: 'Post',
  id: post.id,
  data: post.data,
  timestamp: Date.now(),
})

// Replay WAL entries
const replayed = await replayWAL(provider, r2, 'my-namespace', lastSnapshotTimestamp)

// Clean up old WAL entries
const deleted = await compactWAL(r2, 'my-namespace', snapshotTimestamp)
```

### JSONL Export/Import

```typescript
import { exportJSONL, importJSONL, exportToR2, importFromR2 } from 'digital-objects'

// Export to string
const jsonl = await exportJSONL(provider)

// Import from string
const stats = await importJSONL(provider, jsonl)
// stats = { nouns: 5, verbs: 3, things: 100, actions: 250 }

// Export directly to R2
await exportToR2(provider, r2, 'exports/backup.jsonl')

// Import directly from R2
await importFromR2(provider, r2, 'exports/backup.jsonl')
```

## ai-database Adapter

Use digital-objects as a storage backend for ai-database:

```typescript
import { createMemoryProvider, createDBProviderAdapter } from 'digital-objects'

const doProvider = createMemoryProvider()
const dbProvider = createDBProviderAdapter(doProvider)

// Now use ai-database's interface
const user = await dbProvider.create('User', undefined, {
  name: 'Alice',
  email: 'alice@example.com',
})
// Returns: { $id: 'uuid', $type: 'User', name: 'Alice', email: '...' }

// Get by ID
const found = await dbProvider.get('User', user.$id)

// List with filters
const admins = await dbProvider.list('User', {
  where: { role: 'admin' },
  orderBy: 'name',
  limit: 10,
})

// Create relationships
await dbProvider.relate('User', user.$id, 'author', 'Post', post.$id)

// Query relationships
const userPosts = await dbProvider.related('Post', user.$id, 'author')
```

## Type Definitions

### Noun

```typescript
interface Noun {
  name: string        // 'Post'
  singular: string    // 'post'
  plural: string      // 'posts'
  slug: string        // 'post' (URL-safe)
  description?: string
  schema?: Record<string, FieldDefinition>
  createdAt: Date
}
```

### Verb

```typescript
interface Verb {
  name: string        // 'create'
  action: string      // 'create' (imperative)
  act: string         // 'creates' (3rd person)
  activity: string    // 'creating' (gerund)
  event: string       // 'created' (past participle)
  reverseBy?: string  // 'createdBy'
  reverseAt?: string  // 'createdAt'
  inverse?: string    // 'delete'
  description?: string
  createdAt: Date
}
```

### Thing

```typescript
interface Thing<T = Record<string, unknown>> {
  id: string
  noun: string        // References noun.name
  data: T
  createdAt: Date
  updatedAt: Date
}
```

### Action

```typescript
interface Action<T = Record<string, unknown>> {
  id: string
  verb: string        // References verb.name
  subject?: string    // Thing ID (actor/from)
  object?: string     // Thing ID (target/to)
  data?: T            // Payload/metadata
  status: ActionStatus
  createdAt: Date
  completedAt?: Date
}

type ActionStatus = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
```

### Field Types

```typescript
type FieldDefinition =
  | 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json' | 'markdown' | 'url'
  | `${string}.${string}`      // Relation: 'Author.posts'
  | `[${string}.${string}]`    // Array relation: '[Tag.posts]'
  | `${PrimitiveType}?`        // Optional field
```

## Schema Validation

Digital Objects provides runtime schema validation with clear, actionable error messages.

### Enable Validation

Validation is opt-in. Pass `{ validate: true }` to `create()` or `update()`:

```typescript
// Define a noun with schema
await provider.defineNoun({
  name: 'User',
  schema: {
    email: { type: 'string', required: true },
    age: 'number',
    bio: 'string?', // Optional
  },
})

// Validation enabled - will throw on errors
await provider.create('User', { name: 'Alice' }, undefined, { validate: true })
// Error: Validation failed (1 error):
//   - Missing required field 'email'
```

### Pre-flight Validation

Use `validateOnly()` to check data before attempting operations:

```typescript
import { validateOnly } from 'digital-objects'

const schema = {
  email: { type: 'string', required: true },
  age: 'number',
}

const result = validateOnly({ age: '25' }, schema)

if (!result.valid) {
  console.log('Errors:', result.errors)
  // [
  //   {
  //     field: 'email',
  //     message: "Missing required field 'email'",
  //     code: 'REQUIRED_FIELD',
  //     expected: 'string',
  //     received: 'undefined'
  //   },
  //   {
  //     field: 'age',
  //     message: "Field 'age' has wrong type: expected number, got string",
  //     code: 'TYPE_MISMATCH',
  //     expected: 'number',
  //     received: 'string',
  //     suggestion: 'Convert to number: 25'
  //   }
  // ]
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `REQUIRED_FIELD` | A required field is missing or null |
| `TYPE_MISMATCH` | Value has wrong type for the field |
| `INVALID_FORMAT` | Value format doesn't match expected pattern |
| `UNKNOWN_FIELD` | Field not defined in schema (future feature) |

### Suggestions

Validation errors include helpful suggestions when possible:

```typescript
// String that looks like a number
{ age: '25' }
// suggestion: "Convert to number: 25"

// Number when string expected
{ name: 42 }
// suggestion: 'Convert to string: "42"'

// String boolean
{ active: 'true' }
// suggestion: "Convert to boolean: true"

// Wrong type for array
{ tags: 'single-tag' }
// suggestion: "Wrap value in an array: [value]"

// Wrong type for date
{ createdAt: 1705312800000 }
// suggestion: "Provide a valid ISO 8601 date string"
```

## Installation

```bash
npm install digital-objects
```

## License

MIT
