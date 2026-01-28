# ai-database

**AI hallucinates. Your database shouldn't.**

When AI generates a "Software Developer" for your customer profile, does it match your existing O\*NET occupation data? Does "Enterprise SaaS" connect to your NAICS industry codes? Traditional approaches fragment context—AI juggles content creation and referential integrity simultaneously, producing plausible-sounding but disconnected data.

**ai-database grounds AI generation against your domain.**

```typescript
import { DB } from 'ai-database'

const { db } = DB({
  IdealCustomerProfile: {
    as: 'Who are they? <~Occupation',      // Ground against O*NET occupations
    at: 'Where do they work? <~Industry',  // Ground against NAICS industries
    are: 'What are they doing? <~Task',    // Ground against O*NET tasks
  },
  Occupation: { title: 'string', description: 'string' },
  Industry: { name: 'string', naicsCode: 'string' },
  Task: { name: 'string' },
})

// Seed reference data from O*NET, NAICS, etc.
await db.Occupation.create({ title: 'Software Developer', description: 'Develops applications' })
await db.Industry.create({ name: 'Technology', naicsCode: '5112' })

// AI generation is grounded against real reference data
const icp = await db.ICP.create({
  asHint: 'Engineers who build software',  // Matches "Software Developer"
  atHint: 'Tech companies',                 // Matches "Technology"
})

const occupation = await icp.as
// => { title: 'Software Developer', ... } — matched via semantic search, not hallucinated
```

---

## The Core Insight

Traditional databases require foreign keys at schema time. When generating with AI, this fragments context: the model must juggle content creation and referential integrity simultaneously.

ai-database inverts this paradigm. **Relationship operators become workflow instructions**, not schema constraints:

1. **Generate** the entity with full semantic context intact
2. **Link** as a post-processing step via insertion or vector search

This separation eliminates context fragmentation during generation and produces human-readable relationship labels ("Software Developers") instead of opaque IDs (`occ_1547`).

---

## The Four Operators

ai-database provides four relationship operators that control how entities connect. They combine two dimensions:

| | **Create New** | **Search Existing** |
|---|---|---|
| **Link TO target** | `->` Forward Exact | `~>` Forward Fuzzy |
| **Link FROM target** | `<-` Backward Exact | `<~` Backward Fuzzy |

### Quick Reference

| Operator | Direction | Match Mode | When to Use |
|----------|-----------|------------|-------------|
| `->` | forward | exact | Creating child entities (Blog → Posts) |
| `~>` | forward | fuzzy | Reusing existing entities (Campaign → Audience) |
| `<-` | backward | exact | Aggregation queries (Blog collects Posts) |
| `<~` | backward | fuzzy | Grounding against reference data (ICP → Occupation) |

### Understanding the Operators

**Direction** determines who owns the relationship:
- **Forward** (`->`, `~>`): Current entity links TO the target
- **Backward** (`<-`, `<~`): Target entity links FROM the current entity

**Match Mode** determines how the target is resolved:
- **Exact** (`->`, `<-`): Create a new entity, then link to it
- **Fuzzy** (`~>`, `<~`): Search existing entities via semantic similarity

---

## Example 1: Grounding Against Reference Data (`<~`)

The backward fuzzy operator grounds AI-generated content against authoritative reference data. This is the **semantic grounding** pattern.

```typescript
const { db } = DB({
  // Generative entity that grounds against reference data
  IdealCustomerProfile: {
    as: 'Who are they? (e.g. "Developers") <~Occupation',
    at: 'Where do they work? (e.g. "FinTech startups") <~Industry',
    are: 'What are they doing? (e.g. "building APIs") <~Task',
    using: 'What are they using? (e.g. "Node.js") <~Tool',
    to: 'What is their goal? (e.g. "ship faster") <~Outcome',
  },

  // Reference data seeded from O*NET, NAICS, etc.
  Occupation: {
    $seed: 'https://onet.data/occupations.tsv',
    $id: '$.oNETSOCCode',
    title: '$.title',
    description: '$.description',
  },
  Industry: {
    $seed: 'https://naics.data/industries.tsv',
    $id: '$.naicsCode',
    name: '$.title',
  },
  Task: { name: 'string' },
  Tool: { name: 'string' },
  Outcome: { description: 'string' },
})
```

**How it works:**

1. AI generates ICP with `as: "Engineers who build software"`
2. Runtime embeds the text and searches the `Occupation` collection
3. Best match found: "Software Developer" (via vector similarity)
4. Link created with human-readable label: `"Software Developer"`

**Key behaviors:**
- Uses embedding similarity to find the best match
- Returns `null` if no semantic match found (doesn't hallucinate)
- Grounds generated content against curated reference data
- Perfect for taxonomies, categories, and standardized values

### Union Types for Fallback Search

When multiple collections could contain the best match:

```typescript
IdealCustomerProfile: {
  as: '<~Occupation|Role|JobType',      // Search Occupation first, then Role, then JobType
  using: '<~Tool|Technology|Product',   // Search multiple collections in priority order
}
```

---

## Example 2: Content Generation with Cascade (`->`, `<-`)

The forward and backward exact operators create hierarchical content. This is the **cascading generation** pattern.

```typescript
const { db } = DB({
  Blog: {
    title: 'string',
    description: 'string',
    topics: ['List 5 topics covered ->Topic'],  // Creates Topic children
    posts: ['<-Post'],                           // Aggregates Post children
  },
  Topic: {
    name: 'string',
    titles: ['List 3 blog post titles ->Post'], // Creates Post children
  },
  Post: {
    title: 'string',
    synopsis: 'string',
    content: 'markdown',
    blog: '->Blog',     // Links back to parent Blog
    topic: '->Topic',   // Links to Topic
  },
})

// One call generates the entire blog structure
const blog = await db.Blog.create(
  { title: 'AI Engineering', description: 'Building with LLMs' },
  { cascade: true, maxDepth: 3 }
)

// Topics were auto-generated
const topics = await blog.topics
// => [{ name: 'Prompt Engineering' }, { name: 'RAG Systems' }, ...]

// Posts were auto-generated under each topic
const posts = await topics[0].titles
// => [{ title: 'Getting Started with Prompts' }, ...]

// Backward refs enable aggregation queries
const allPosts = await blog.posts
// => All posts that reference this blog
```

### Forward Exact (`->`)

Creates child entities that belong to the parent:

```typescript
Startup: {
  founders: ['Who are the founders? ->Founder'],   // Creates Founder entities
  businessModel: 'What is the business model? ->LeanCanvas',
}
```

**Key behaviors:**
- Text before `->` is the AI generation prompt
- If a value is provided, uses it instead of generating
- Optional fields (`->Type?`) skip generation when not provided
- Nested forward fields cascade automatically

### Backward Exact (`<-`)

Creates inverse relationships for aggregation:

```typescript
Blog: {
  posts: ['<-Post'],        // All posts that reference this blog
},
Post: {
  blog: '->Blog',           // Forward reference to parent
}
```

**Key behaviors:**
- Creates inverted edge direction (Post → Blog)
- Enables reverse lookups and aggregation queries
- Works with explicit backrefs: `['<-Post.blog']`
- Handles self-referential trees: `children: ['<-Node.parent']`

### Forward Fuzzy (`~>`)

Searches existing entities first, creates if not found:

```typescript
Campaign: {
  audience: 'Target audience ~>Audience',  // Find existing or create new
}

// If "Enterprise" audience exists, reuses it
const campaign = await db.Campaign.create({
  audienceHint: 'Big companies with 1000+ employees'
})
const audience = await campaign.audience
// => { name: 'Enterprise', ... } — reused existing!
```

**Key behaviors:**
- Searches via semantic similarity using `${fieldName}Hint`
- Reuses existing entity if match exceeds threshold
- Generates new entity if no match found
- Generated entities marked with `$generated: true`

---

## Example 3: Startup Generator (Mixed Operators)

A complete example showing all four operators working together:

```typescript
const { db } = DB({
  Startup: {
    $instructions: 'Generate a B2B SaaS startup',
    name: 'string',
    idea: 'What problem does this solve? <-Idea',           // Idea spawns Startup
    founders: ['Who are the founding team? ->Founder'],      // Create founders
    customer: 'Who is the target customer? ~>CustomerPersona', // Find existing
    industry: 'What industry? <~Industry',                   // Ground to NAICS
  },
  Idea: { problem: 'string', solution: 'string' },
  Founder: { name: 'string', role: 'string' },
  CustomerPersona: { title: 'string', painPoints: 'string' },
  Industry: { name: 'string', naicsCode: 'string' },
})

// Pre-populate reference data
await db.Industry.create({ name: 'Technology', naicsCode: '5112' })
await db.CustomerPersona.create({
  title: 'VP of Engineering',
  painPoints: 'Managing distributed teams',
})

// Generate complete startup with grounded relationships
const startup = await db.Startup.create(
  { name: 'DevFlow' },
  { cascade: true, maxDepth: 2 }
)

// Relationships resolved appropriately:
const idea = await startup.idea        // Created new (->)
const founders = await startup.founders // Created new ([->])
const customer = await startup.customer // Matched existing (~>)
const industry = await startup.industry // Grounded to reference (<~)
```

---

## Threshold Syntax

For fuzzy operators (`~>` and `<~`), configure the similarity threshold:

### Field-Level Thresholds

```typescript
Event: {
  venue: 'Where is the event? ~>Venue(0.9)',     // High threshold - strict match
  sponsor: 'Event sponsor ~>Company(0.5)',       // Low threshold - lenient match
}
```

### Entity-Level Thresholds

```typescript
Startup: {
  $fuzzyThreshold: 0.85,  // Apply to all ~> and <~ fields
  customer: '~>Customer',
  competitor: '~>Company',
}
```

**Threshold values:**
- `0.9` - Very strict: Only near-exact semantic matches
- `0.7` - Default: Balanced matching
- `0.5` - Lenient: Accept loosely related matches

---

## Cascade Generation

Build complex entity graphs from a single `create()` call:

```typescript
const company = await db.Company.create(
  { name: 'TechCorp' },
  {
    cascade: true,
    maxDepth: 4,
    onProgress: (p) => console.log(`${p.totalEntitiesCreated} created`),
  }
)

// Entire org chart generated: Company → Departments → Teams → Employees
```

### Cascade Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cascade` | `boolean` | `false` | Enable cascade generation |
| `maxDepth` | `number` | `0` | Maximum recursion depth |
| `cascadeTypes` | `string[]` | - | Only cascade to these types |
| `onProgress` | `function` | - | Progress callback |
| `onError` | `function` | - | Error handler |
| `stopOnError` | `boolean` | `false` | Stop on first error |

---

## Special Variables

### `$instructions`

Entity-level prompting that guides AI generation:

```typescript
Character: {
  $instructions: 'This character is from a medieval fantasy setting',
  name: 'string',
  backstory: 'What is their history?',  // Influenced by $instructions
}
```

Template variables resolve against entity data:

```typescript
Problem: {
  $instructions: `
    Identify problems for occupation: {task.occupation.title}
    in industry: {task.occupation.industry.name}
  `,
  task: '<-Task',
  description: 'string',
}
```

### `$context`

Explicit context dependencies pre-fetched before generation:

```typescript
Ad: {
  $context: ['Startup', 'ICP'],
  $instructions: 'Generate ad for {startup.name} targeting {icp.as}',
  headline: 'string (30 chars)',
}
```

---

## Schema Definition

Define once, get typed operations everywhere:

```typescript
const { db, events, actions } = DB({
  Post: {
    title: 'string',
    content: 'markdown',
    author: 'Author.posts',  // Creates bidirectional relationship
  },
  Author: {
    name: 'string',
    // posts: Post[] auto-created from backref
  }
})
```

### Field Types

| Type | Description |
|------|-------------|
| `string` | Text |
| `number` | Numeric |
| `boolean` | True/false |
| `date` | Date only |
| `datetime` | Date and time |
| `markdown` | Rich text |
| `json` | Structured data |
| `url` | URL string |

### Relationships

```typescript
// One-to-many: Post has one Author, Author has many Posts
Post: { author: 'Author.posts' }

// Many-to-many: Post has many Tags, Tag has many Posts
Post: { tags: ['Tag.posts'] }
```

---

## Promise Pipelining

Chain database operations without `await`:

```typescript
const leads = db.Lead.list()
const topLeads = leads.filter(l => l.score > 80)
const names = topLeads.map(l => l.name)

// Only await when you need the result
const result = await names
```

### Batch Relationship Loading

Eliminate N+1 queries automatically:

```typescript
// All companies loaded in ONE query
const enriched = await db.Lead.list().map(lead => ({
  lead,
  company: lead.company,
}))
```

---

## CRUD Operations

```typescript
// Read
const lead = await db.Lead.get('lead-123')
const leads = await db.Lead.list()
const found = await db.Lead.find({ status: 'active' })

// Search
const results = await db.Lead.search('enterprise SaaS')

// Natural language queries
const pending = await db.Order`what's stuck in processing?`

// Write
const lead = await db.Lead.create({ name: 'Acme Corp' })
await db.Lead.update(lead.$id, { score: 90 })
await db.Lead.delete(lead.$id)
```

### Chainable Methods

```typescript
db.Lead.list()
  .filter(l => l.score > 50)
  .sort((a, b) => b.score - a.score)
  .limit(10)
  .map(l => ({ name: l.name, score: l.score }))
```

---

## Events

React to changes in real-time:

```typescript
events.on('Lead.created', event => {
  notifySlack(`New lead: ${event.data.name}`)
})

events.on('*.updated', event => {
  logChange(event)
})
```

---

## forEach - Large-Scale Processing

Process thousands of items with concurrency and error handling:

```typescript
const result = await db.Lead.forEach(async lead => {
  const analysis = await ai`analyze ${lead}`
  await db.Lead.update(lead.$id, { analysis })
}, {
  concurrency: 10,
  maxRetries: 3,
  retryDelay: attempt => 1000 * Math.pow(2, attempt),
  onProgress: p => console.log(`${p.completed}/${p.total}`),
  onError: (err, lead) => err.code === 'RATE_LIMIT' ? 'retry' : 'continue',
})
```

### forEach Options

| Option | Type | Description |
|--------|------|-------------|
| `concurrency` | `number` | Max parallel operations (default: 1) |
| `maxRetries` | `number` | Retries per item (default: 0) |
| `retryDelay` | `number \| fn` | Delay between retries |
| `onProgress` | `fn` | Progress callback |
| `onError` | `fn` | Error handling |
| `timeout` | `number` | Timeout per item in ms |
| `persist` | `boolean \| string` | Enable durability |
| `resume` | `string` | Resume from action ID |

### Durable forEach

Persist progress to survive crashes:

```typescript
const result = await db.Lead.forEach(processLead, {
  concurrency: 10,
  persist: 'analyze-leads',
})

// Resume after crash
await db.Lead.forEach(processLead, {
  resume: result.actionId,
})
```

---

## Actions

Track long-running operations:

```typescript
const action = await actions.create({
  type: 'import-leads',
  data: { file: 'leads.csv' },
  total: 1000,
})

await actions.update(action.id, { progress: 500 })
await actions.update(action.id, { status: 'completed' })
```

---

## Installation

```bash
pnpm add ai-database
```

## Configuration

```bash
DATABASE_URL=./content         # filesystem (default)
DATABASE_URL=sqlite://./data   # SQLite
DATABASE_URL=:memory:          # in-memory
```

---

## Common Patterns

### Self-Referential Trees

```typescript
Node: {
  value: 'string',
  parent: '->Node?',
  children: ['<-Node.parent'],
}
```

### Union Types for Polymorphic References

```typescript
Comment: {
  content: 'string',
  target: '->Post|Article|Video',
}

const target = await comment.target
console.log(target.$matchedType)  // 'Post', 'Article', or 'Video'
```

### Symmetric Relationships

```typescript
Team: {
  name: 'string',
  members: ['->Member'],
},
Member: {
  name: 'string',
  team: '<-Team',
}
```

---

## Document Database Interface

In addition to the schema-first graph model, `ai-database` exports environment-agnostic types for document-based storage (MDX files with frontmatter):

```typescript
import type {
  DocumentDatabase,
  Document,
  DocListOptions,
  DocSearchOptions,
} from 'ai-database'

// Same interface regardless of backend
const doc = await db.get('posts/hello-world')
await db.set('posts/new', { data: { title: 'New Post' }, content: '# Hello' })
```

### Usage with @mdxdb adapters

```typescript
import { createFsDatabase } from '@mdxdb/fs'
import { createSqliteDatabase } from '@mdxdb/sqlite'
import { createApiDatabase } from '@mdxdb/api'

const db = createFsDatabase({ root: './content' })
const db = createSqliteDatabase({ path: './data.db' })
const db = createApiDatabase({ baseUrl: 'https://api.example.com' })
```

---

## Provider Capabilities

Different database providers support different features. Use `detectCapabilities()` to check what's available at runtime:

```typescript
import { detectCapabilities, requireCapability, CapabilityNotSupportedError } from 'ai-database'

const capabilities = await detectCapabilities(provider)

// Check capabilities
if (capabilities.hasSemanticSearch) {
  const results = await provider.semanticSearch('Post', 'machine learning')
} else {
  // Fallback to regular search
  const results = await provider.search('Post', 'machine learning')
}

// Require capabilities (throws if unavailable)
requireCapability(capabilities, 'hasEvents')
provider.on('Post.created', handleCreate)
```

### Capability Matrix

| Capability | MemoryProvider | RDB | DigitalObjects |
|------------|----------------|-----|----------------|
| **Semantic Search** | Yes | No | No |
| **Events API** | Yes | No | No |
| **Actions API** | Yes | No | No |
| **Artifacts** | Yes | No | No |
| **Batch Operations** | Yes | No | No |

### Capabilities

| Capability | Description | Methods Required |
|------------|-------------|------------------|
| `hasSemanticSearch` | Vector similarity search | `semanticSearch()`, `setEmbeddingsConfig()` |
| `hasEvents` | Event emission and subscription | `on()`, `emit()`, `listEvents()` |
| `hasActions` | Durable action tracking | `createAction()`, `getAction()`, `updateAction()` |
| `hasArtifacts` | Artifact/cache storage | `getArtifact()`, `setArtifact()` |
| `hasBatchOperations` | Concurrency-controlled batching | `withConcurrency()` or `mapWithConcurrency()` |

### Graceful Degradation

When a capability isn't available, use fallbacks:

```typescript
import { detectCapabilities, warnIfUnavailable } from 'ai-database'

const capabilities = await detectCapabilities(provider)

// Log a warning (once) if semantic search unavailable
warnIfUnavailable(capabilities, 'hasSemanticSearch', 'semanticSearch')

// Use capability with fallback
async function searchPosts(query: string) {
  if (capabilities.hasSemanticSearch) {
    return provider.semanticSearch('Post', query)
  }
  return provider.search('Post', query)
}
```

### Features Requiring Semantic Search

When using a provider without semantic search support (e.g., RDB), some features behave differently:

| Feature | With Semantic Search | Without Semantic Search |
|---------|---------------------|------------------------|
| `~>` Forward Fuzzy | Matches via vector similarity, falls back to generation | Uses text search fallback, then generates if no match |
| `<~` Backward Fuzzy | Matches via vector similarity | Uses text search fallback |
| `db.Entity.semanticSearch()` | Vector similarity search | Throws `CapabilityNotSupportedError` |
| `db.Entity.hybridSearch()` | Combined FTS + vector search | Throws `CapabilityNotSupportedError` |
| `db.semanticSearch()` | Global vector search | Throws `CapabilityNotSupportedError` |

**Fuzzy Operator Fallback**: When semantic search is unavailable, fuzzy operators (`~>` and `<~`) gracefully degrade to basic text search:

```typescript
// Without semantic search, these operators use text matching instead of embeddings
const { db } = DB({
  Article: {
    category: '~>Category',  // Will use text search fallback
  },
  Category: { name: 'string' }
})

// Forward fuzzy (~>) tries text search first, generates if no match found
await db.Article.create({ categoryHint: 'Tech' })  // Searches for 'Tech' in categories

// Backward fuzzy (<~) uses text search only - never generates
await db.Article.create({ categoryHint: 'Tech' })  // Returns null if no text match
```

**Explicit Search Methods**: When you need semantic search but it's unavailable, the methods throw with helpful alternatives:

```typescript
import { CapabilityNotSupportedError, isCapabilityNotSupportedError } from 'ai-database'

try {
  await db.Post.semanticSearch('machine learning')
} catch (error) {
  if (isCapabilityNotSupportedError(error)) {
    console.log(error.capability)   // 'hasSemanticSearch'
    console.log(error.alternative)  // 'Use the regular search() method instead...'
    // Fall back to text search
    const results = await db.Post.search('machine learning')
  }
}
```

---

## Integration with RDB

[RDB](https://github.com/ai-primitives/rdb) provides a simple relational database backend for ai-database. Use it when you want:

- Edge-native storage via Cloudflare Durable Objects or D1
- Simple two-table schema (`_data` and `_rels`)
- Graph traversal and relationship queries

### Creating an RDB Provider Adapter

```typescript
import { setProvider, DB } from 'ai-database'
import type { DBProvider, ListOptions, SearchOptions } from 'ai-database'
import { RDB } from '@dotdo/rdb'

// Adapter to bridge RDB and ai-database interfaces
class RDBProviderAdapter implements DBProvider {
  private rdb: RDB

  constructor(sqlStorage: SqlStorage) {
    this.rdb = new RDB(sqlStorage)
  }

  async get(type: string, id: string) {
    const entity = await this.rdb.get(type, id)
    if (!entity) return null
    return { $id: entity.id, $type: entity.type, ...entity }
  }

  async list(type: string, options?: ListOptions) {
    const entities = await this.rdb.list(type, options)
    return entities.map(e => ({ $id: e.id, $type: e.type, ...e }))
  }

  async search(type: string, query: string, options?: SearchOptions) {
    // RDB uses filter-based search; perform text matching
    const all = await this.rdb.list(type, options)
    return all
      .filter(e => JSON.stringify(e).toLowerCase().includes(query.toLowerCase()))
      .map(e => ({ $id: e.id, $type: e.type, ...e }))
  }

  async create(type: string, id: string | undefined, data: Record<string, unknown>) {
    const entity = await this.rdb.create(type, data, id)
    return { $id: entity.id, $type: entity.type, ...entity }
  }

  async update(type: string, id: string, data: Record<string, unknown>) {
    const entity = await this.rdb.update(type, id, data)
    return { $id: entity.id, $type: entity.type, ...entity }
  }

  async delete(type: string, id: string): Promise<boolean> {
    const exists = await this.rdb.get(type, id)
    if (!exists) return false
    await this.rdb.delete(type, id)
    return true
  }

  async related(type: string, id: string, relation: string) {
    const entities = await this.rdb.related(type, id, relation)
    return entities.map(e => ({ $id: e.id, $type: e.type, ...e }))
  }

  async relate(fromType: string, fromId: string, relation: string, toType: string, toId: string, metadata?: object) {
    await this.rdb.relate(fromType, fromId, relation, toType, toId, metadata)
  }

  async unrelate(fromType: string, fromId: string, relation: string, toType: string, toId: string) {
    await this.rdb.unrelate(fromType, fromId, relation, toType, toId)
  }
}

// Usage in a Durable Object
export class MyDO extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    setProvider(new RDBProviderAdapter(ctx.storage.sql))
  }
}

// Now use ai-database schema with RDB backend
const { db } = DB({
  Post: { title: 'string', author: '->Author.posts' },
  Author: { name: 'string' },
})

const author = await db.Author.create({ name: 'Alice' })
const post = await db.Post.create({ title: 'Hello', author: author.$id })
```

### Limitations with RDB

When using RDB as a provider:

- **No semantic search**: Fuzzy operators (`~>`, `<~`) require vector embeddings. Use exact operators (`->`, `<-`) instead, or use MemoryProvider for semantic matching.
- **No events/actions API**: RDB focuses on core CRUD and relationships.
- **Text search only**: The `search()` method performs text matching, not semantic similarity.

---

## Related

- [ai-functions](https://github.com/ai-primitives/ai-primitives/tree/main/packages/ai-functions) - AI-powered functions
- [ai-workflows](https://github.com/ai-primitives/ai-primitives/tree/main/packages/ai-workflows) - Event-driven workflows
- [@mdxdb/fs](https://github.com/ai-primitives/mdx.org.ai/tree/main/packages/@mdxdb/fs) - Filesystem adapter
- [@mdxdb/sqlite](https://github.com/ai-primitives/mdx.org.ai/tree/main/packages/@mdxdb/sqlite) - SQLite adapter
- [@mdxdb/api](https://github.com/ai-primitives/mdx.org.ai/tree/main/packages/@mdxdb/api) - HTTP API client
