# ai-database

Your data, flowing like conversation.

```typescript
import { DB } from 'ai-database'

const { db } = DB({
  Lead: { name: 'string', company: 'Company.leads' },
  Company: { name: 'string' }
})

// Chain without await
const leads = db.Lead.list()
const qualified = await leads.filter(l => l.score > 80)

// Batch relationship loading
const enriched = await leads.map(lead => ({
  name: lead.name,
  company: lead.company,  // Batch loaded!
}))
```

## Promise Pipelining

Chain database operations without `await`:

```typescript
const leads = db.Lead.list()
const topLeads = leads.filter(l => l.score > 80)
const names = topLeads.map(l => l.name)

// Only await when you need the result
const result = await names
```

## Batch Relationship Loading

Eliminate N+1 queries automatically:

```typescript
// Old way - N+1 queries
const leads = await db.Lead.list()
for (const lead of leads) {
  const company = await db.Company.get(lead.companyId)  // N queries!
}

// New way - batch loaded
const enriched = await db.Lead.list().map(lead => ({
  lead,
  company: lead.company,  // All companies loaded in ONE query
}))
```

## Natural Language Queries

Ask your database questions:

```typescript
const results = await db.Lead`who closed deals this month?`
const pending = await db.Order`what's stuck in processing?`
```

---

## Real-World Examples

### Sales Pipeline

```typescript
const { db } = DB({
  Lead: {
    name: 'string',
    email: 'string',
    score: 'number',
    company: 'Company.leads',
  },
  Company: {
    name: 'string',
    industry: 'string',
  }
})

// Find high-value leads with their companies
const qualified = await db.Lead.list()
  .filter(lead => lead.score > 80)
  .map(lead => ({
    lead,
    company: lead.company,
  }))

// Ask questions naturally
const results = await db.Lead`who hasn't responded in 2 weeks?`
```

### Customer Success

```typescript
const { db } = DB({
  Customer: {
    name: 'string',
    healthScore: 'number',
    mrr: 'number',
    csm: 'User.customers',
  },
  User: { name: 'string' }
})

// At-risk customers with their CSMs
const atRisk = await db.Customer.list()
  .filter(c => c.healthScore < 50)
  .map(c => ({
    customer: c,
    csm: c.csm,
    mrr: c.mrr,
  }))
```

### Order Management

```typescript
const { db } = DB({
  Order: {
    status: 'string',
    total: 'number',
    customer: 'Customer.orders',
    items: ['OrderItem.order'],
  },
  OrderItem: { product: 'string', quantity: 'number' },
  Customer: { name: 'string' }
})

// Pending orders with all details
const pending = await db.Order
  .find({ status: 'pending' })
  .map(order => ({
    order,
    customer: order.customer,
    items: order.items,
  }))
```

---

## Schema Definition

Define once, get typed operations everywhere:

```typescript
const { db, events, actions, nouns, verbs } = DB({
  Post: {
    title: 'string',
    content: 'markdown',
    author: 'Author.posts',  // Creates both directions
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

## CRUD Operations

All operations return `DBPromise` for chaining:

```typescript
// Read
const lead = await db.Lead.get('lead-123')
const leads = await db.Lead.list()
const first = await db.Lead.first()
const found = await db.Lead.find({ status: 'active' })

// Search
const results = await db.Lead.search('enterprise SaaS')

// Write (returns regular Promise)
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

## forEach - Large-Scale Processing

Process thousands of items with concurrency, progress tracking, and error handling:

```typescript
// Simple iteration
await db.Lead.forEach(lead => {
  console.log(lead.name)
})

// With AI and concurrency
const result = await db.Lead.forEach(async lead => {
  const analysis = await ai`analyze ${lead}`
  await db.Lead.update(lead.$id, { analysis })
}, {
  concurrency: 10,
  onProgress: p => console.log(`${p.completed}/${p.total} (${p.rate.toFixed(1)}/s)`),
})

// With error handling and retries
await db.Order.forEach(async order => {
  await sendInvoice(order)
}, {
  concurrency: 5,
  maxRetries: 3,
  retryDelay: attempt => 1000 * Math.pow(2, attempt),  // Exponential backoff
  onError: (err, order) => err.code === 'RATE_LIMIT' ? 'retry' : 'continue',
})

console.log(`Completed: ${result.completed}, Failed: ${result.failed}`)
```

### forEach Options

| Option | Type | Description |
|--------|------|-------------|
| `concurrency` | `number` | Max parallel operations (default: 1) |
| `maxRetries` | `number` | Retries per item (default: 0) |
| `retryDelay` | `number \| fn` | Delay between retries |
| `onProgress` | `fn` | Progress callback |
| `onError` | `'continue' \| 'retry' \| 'skip' \| 'stop' \| fn` | Error handling |
| `timeout` | `number` | Timeout per item in ms |
| `persist` | `boolean \| string` | Enable durability (string = custom action name) |
| `resume` | `string` | Resume from action ID |

### Durable forEach

Persist progress to survive crashes:

```typescript
// Enable persistence - auto-names action as "Lead.forEach"
const result = await db.Lead.forEach(processLead, {
  concurrency: 10,
  persist: true,
})

console.log(`Action ID: ${result.actionId}`)
```

Custom action name:

```typescript
await db.Lead.forEach(processLead, {
  persist: 'analyze-leads',  // Custom action name
})
```

Resume after a crash:

```typescript
await db.Lead.forEach(processLead, {
  resume: 'action-123',  // Skips already-processed items
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

## Documentation

- [Full Documentation](https://primitives.org.ai/database)
- [CRUD Operations](https://primitives.org.ai/database/create)
- [Schema Types](https://primitives.org.ai/database/schema)
- [Events](https://primitives.org.ai/database/events)

## Document Database Interface

In addition to the schema-first graph model, `ai-database` also exports environment-agnostic types for document-based storage (MDX files with frontmatter). These types are used by `@mdxdb/*` adapters and work in any JavaScript runtime (Node.js, Bun, Deno, Workers, Browser).

```typescript
import type {
  DocumentDatabase,
  DocListOptions,
  DocSearchOptions,
  Document,
} from 'ai-database'

// The DocumentDatabase interface
interface DocumentDatabase<TData> {
  list(options?: DocListOptions): Promise<DocListResult<TData>>
  search(options: DocSearchOptions): Promise<DocSearchResult<TData>>
  get(id: string, options?: DocGetOptions): Promise<Document<TData> | null>
  set(id: string, doc: Document<TData>, options?: DocSetOptions): Promise<DocSetResult>
  delete(id: string, options?: DocDeleteOptions): Promise<DocDeleteResult>
  close?(): Promise<void>
}
```

### Document Types

| Type | Description |
|------|-------------|
| `Document<TData>` | MDX document with id, type, context, data, and content |
| `DocumentDatabase<TData>` | Interface for document storage adapters |
| `DocListOptions` | Options for listing documents (limit, offset, sortBy, type, prefix) |
| `DocListResult<TData>` | List result with documents, total, hasMore |
| `DocSearchOptions` | Search options (query, fields, semantic) |
| `DocSearchResult<TData>` | Search result with scores |
| `DocGetOptions` | Get options (includeAst, includeCode) |
| `DocSetOptions` | Set options (createOnly, updateOnly, version) |
| `DocSetResult` | Set result (id, version, created) |
| `DocDeleteOptions` | Delete options (soft, version) |
| `DocDeleteResult` | Delete result (id, deleted) |

### View Types

For bi-directional relationship rendering:

| Type | Description |
|------|-------------|
| `ViewManager` | Interface for managing views |
| `ViewDocument` | View template definition |
| `ViewContext` | Context for rendering a view |
| `ViewRenderResult` | Rendered markdown and entities |
| `ViewSyncResult` | Mutations from extracting edited markdown |
| `DocumentDatabaseWithViews` | Database with view support |

### Usage with @mdxdb adapters

```typescript
// Filesystem adapter
import { createFsDatabase } from '@mdxdb/fs'
const db = createFsDatabase({ root: './content' })

// API adapter
import { createApiDatabase } from '@mdxdb/api'
const db = createApiDatabase({ baseUrl: 'https://api.example.com' })

// SQLite adapter
import { createSqliteDatabase } from '@mdxdb/sqlite'
const db = createSqliteDatabase({ path: './data.db' })

// Same DocumentDatabase interface regardless of backend
const doc = await db.get('posts/hello-world')
await db.set('posts/new', { data: { title: 'New Post' }, content: '# Hello' })
```

---

## Relationship Operators

ai-database provides four relationship operators that control how entities are linked and how AI generation flows through your schema. These operators combine two dimensions:

- **Direction**: Forward (`->`, `~>`) vs Backward (`<-`, `<~`)
- **Match Mode**: Exact (strict foreign key) vs Fuzzy (semantic/AI-driven matching)

### Operator Reference

| Operator | Direction | Match Mode | Description |
|----------|-----------|------------|-------------|
| `->` | forward | exact | Creates and links to a new entity (strict FK) |
| `~>` | forward | fuzzy | Searches existing entities first, generates if no match |
| `<-` | backward | exact | References an existing entity by ID |
| `<~` | backward | fuzzy | Finds existing entities via semantic search |

### 1. Forward Exact (`->`)

The forward exact operator creates one-to-one or one-to-many relationships where the target entity is auto-generated if not provided.

```typescript
const { db } = DB({
  Startup: {
    name: 'string',
    idea: 'What is the core idea? ->Idea',           // One-to-one, auto-generated
    founders: ['Who are the founders? ->Founder'],   // One-to-many, auto-generated
  },
  Idea: { description: 'string', solution: 'string' },
  Founder: { name: 'string', role: 'string' },
})

// Creating a Startup auto-generates the Idea and Founders
const startup = await db.Startup.create({ name: 'Acme' })

const idea = await startup.idea
// => { $id: '...', $type: 'Idea', description: '...', solution: '...' }

const founders = await startup.founders
// => [{ $id: '...', $type: 'Founder', name: '...', role: '...' }, ...]
```

**Key behaviors:**
- Text before `->` is used as the AI generation prompt
- If a value is provided, it's used instead of generating new
- Optional fields (`->Type?`) skip generation when not provided
- Nested forward exact fields cascade automatically

```typescript
// Skip generation by providing an ID
const existingIdea = await db.Idea.create({ description: 'My idea' })
const startup = await db.Startup.create({
  name: 'Acme',
  idea: existingIdea.$id  // Uses existing, doesn't generate
})
```

### 2. Forward Fuzzy (`~>`)

The forward fuzzy operator first searches for semantically similar existing entities. If a match is found above the similarity threshold, it reuses that entity. Otherwise, it generates a new one.

```typescript
const { db } = DB({
  Campaign: {
    name: 'string',
    audience: 'Target audience for campaign ~>Audience',
  },
  Audience: { name: 'string', description: 'string' },
})

// Create some audiences first
await db.Audience.create({
  name: 'Enterprise',
  description: 'Large corporations with 1000+ employees'
})
await db.Audience.create({
  name: 'SMB',
  description: 'Small businesses with less than 50 employees'
})

// This will find the Enterprise audience via semantic match
const campaign = await db.Campaign.create({
  name: 'Enterprise Sales Push',
  audienceHint: 'Big companies with thousands of employees'
})

const audience = await campaign.audience
// => { $id: '...', name: 'Enterprise', ... } (reused existing!)
```

**Key behaviors:**
- Searches existing entities of the target type via semantic similarity
- `${fieldName}Hint` provides context for matching (e.g., `audienceHint`)
- If no match exceeds threshold, generates a new entity
- Generated entities are marked with `$generated: true`

### 3. Backward Exact (`<-`)

The backward exact operator creates inverse relationships, enabling aggregation queries. The edge direction is inverted - child entities point TO the parent.

```typescript
const { db } = DB({
  Blog: {
    name: 'string',
    posts: ['<-Post'],  // All posts that reference this blog
  },
  Post: {
    title: 'string',
    blog: '->Blog',     // Forward reference to parent
  },
})

// Create the blog, then posts that reference it
const blog = await db.Blog.create({ name: 'Tech Blog' })
await db.Post.create({ title: 'Hello World', blog: blog.$id })
await db.Post.create({ title: 'AI Guide', blog: blog.$id })

// Backward ref enables aggregation queries
const blogPosts = await blog.posts
// => [{ title: 'Hello World', ... }, { title: 'AI Guide', ... }]
```

**Key behaviors:**
- Creates inverted edge direction (Post -> Blog, not Blog -> Post)
- Enables reverse lookups and aggregation queries
- Works with explicit backrefs: `['<-Post.blog']`
- Handles self-referential relationships: `children: ['<-Node.parent']`

### 4. Backward Fuzzy (`<~`)

The backward fuzzy operator combines semantic matching with inverted edge direction. Perfect for grounding generated content against reference data.

```typescript
const { db } = DB({
  ICP: {
    as: 'Who are they? <~Occupation',      // Ground against occupations
    at: 'Where do they work? <~Industry',  // Ground against industries
  },
  Occupation: { title: 'string', description: 'string' },
  Industry: { name: 'string', naicsCode: 'string' },
})

// Create reference data
await db.Occupation.create({ title: 'Software Developer', description: 'Writes code' })
await db.Industry.create({ name: 'Technology', naicsCode: '5112' })

// ICP grounds against existing reference data
const icp = await db.ICP.create({
  asHint: 'Engineers who build software',
  atHint: 'Tech companies'
})

const occupation = await icp.as
// => { title: 'Software Developer', ... } (matched via semantic search)
```

**Key behaviors:**
- Uses AI/embedding similarity to find best match
- Grounds generated content against curated reference data
- Returns null if no semantic match found (doesn't generate)
- Useful for taxonomies, categories, and standardized values

---

## Threshold Syntax

For fuzzy operators (`~>` and `<~`), you can configure the similarity threshold that determines when a match is accepted vs when new generation occurs.

### Field-Level Thresholds

Append threshold in parentheses after the type name:

```typescript
const { db } = DB({
  Event: {
    venue: 'Where is the event? ~>Venue(0.9)',     // High threshold - strict match
    sponsor: 'Event sponsor ~>Company(0.5)',       // Low threshold - lenient match
  },
  Venue: { name: 'string', address: 'string' },
  Company: { name: 'string' },
})
```

**Threshold values:**
- `0.9` - Very strict: Only near-exact semantic matches
- `0.7` - Default: Balanced matching
- `0.5` - Lenient: Accept loosely related matches

### Entity-Level Thresholds

Set a default threshold for all fuzzy fields in an entity:

```typescript
const { db } = DB({
  Startup: {
    $fuzzyThreshold: 0.85,  // Apply to all ~> and <~ fields
    customer: 'Who is the customer? ~>Customer',
    competitor: 'Main competitor ~>Company',
  },
  Customer: { name: 'string' },
  Company: { name: 'string' },
})
```

**Matching behavior:**
1. If similarity score >= threshold: Reuse existing entity
2. If similarity score < threshold: Generate new entity (for `~>`) or return null (for `<~`)

---

## Cascade Generation

Cascade generation automatically creates related entities recursively, building complex entity graphs from a single `create()` call.

### Basic Cascade

Enable cascade with the `cascade` option:

```typescript
const { db } = DB({
  Company: {
    name: 'string',
    departments: ['What departments exist? ->Department'],
  },
  Department: {
    name: 'string',
    teams: ['What teams work here? ->Team'],
  },
  Team: {
    name: 'string',
    members: ['Who are the team members? ->Employee'],
  },
  Employee: { name: 'string', role: 'string' },
})

const company = await db.Company.create(
  { name: 'TechCorp' },
  { cascade: true, maxDepth: 4 }
)

// Entire org chart generated automatically!
const departments = await company.departments
const teams = await departments[0].teams
const members = await teams[0].members
```

### Cascade Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cascade` | `boolean` | `false` | Enable cascade generation |
| `maxDepth` | `number` | `0` | Maximum depth of recursive generation |
| `onProgress` | `function` | - | Callback for progress tracking |
| `onError` | `function` | - | Error handler callback |
| `stopOnError` | `boolean` | `false` | Stop cascade on first error |
| `cascadeTypes` | `string[]` | - | Only cascade to these types |

### Depth Control

Control how deep the cascade goes:

```typescript
// maxDepth: 0 - No cascade (default)
const root = await db.Root.create({ name: 'Test' }, { cascade: true, maxDepth: 0 })
// root.items is empty - not generated

// maxDepth: 1 - Only immediate children
const parent = await db.Parent.create({ name: 'P' }, { cascade: true, maxDepth: 1 })
// parent.children generated, but grandchildren are not

// maxDepth: 3 - Three levels deep
const company = await db.Company.create({ name: 'X' }, { cascade: true, maxDepth: 3 })
// company -> departments -> teams -> employees (stops at employees)
```

### Progress Tracking

Monitor cascade generation progress:

```typescript
const company = await db.Company.create(
  { name: 'TechCorp' },
  {
    cascade: true,
    maxDepth: 4,
    onProgress: (progress) => {
      console.log(`Phase: ${progress.phase}`)          // 'generating' or 'complete'
      console.log(`Depth: ${progress.depth}`)          // Current depth level
      console.log(`Type: ${progress.currentType}`)     // Type being generated
      console.log(`Total: ${progress.totalEntitiesCreated}`)
    },
  }
)
```

### Selective Cascade

Only cascade to specific types:

```typescript
const company = await db.Company.create(
  { name: 'TechCorp' },
  {
    cascade: true,
    maxDepth: 3,
    cascadeTypes: ['Department', 'Team'],  // Skip Employee generation
  }
)
```

---

## Special Variables

### `$instructions`

Entity-level prompting that guides AI generation for all fields:

```typescript
const { db } = DB({
  Character: {
    $instructions: 'This character is from a medieval fantasy setting',
    name: 'string',
    backstory: 'What is their history?',  // Influenced by $instructions
  },
})

const character = await db.Character.create({ name: 'Sir Aldric' })
// backstory will reference medieval elements (castles, knights, quests)
```

**Template variables** resolve against entity data:

```typescript
const { db } = DB({
  Problem: {
    $instructions: `
      Identify problems for occupation: {task.occupation.title}
      in industry: {task.occupation.industry.name}
    `,
    task: '<-Task',
    description: 'string',
  },
  Task: { name: 'string', occupation: '->Occupation' },
  Occupation: { title: 'string', industry: '->Industry' },
  Industry: { name: 'string' },
})
```

### `$context`

Explicit context dependencies that are pre-fetched before generation:

```typescript
const { db } = DB({
  Ad: {
    $context: ['Startup', 'ICP'],  // Pre-fetch these for template resolution
    $instructions: 'Generate ad for {startup.name} targeting {icp.as}',
    startup: '<-Startup',
    headline: 'string (30 chars)',
  },
  Startup: { name: 'string', icp: '->ICP' },
  ICP: { as: 'string' },
})

const icp = await db.ICP.create({ as: 'Software Engineers' })
const startup = await db.Startup.create({ name: 'CodeHelper', icp: icp.$id })
const ad = await db.Ad.create({ startup: startup.$id })

// headline will mention CodeHelper and Software Engineers
```

**Why use `$context`?**
- Explicitly declares what entities are needed for generation
- Enables efficient pre-fetching of related data
- Makes template variable resolution predictable
- Supports multiple levels of relationship traversal

---

## Complete Examples

### Example 1: Startup Generator

A complete startup pitch generator with cascading entity creation:

```typescript
const { db } = DB({
  Startup: {
    $instructions: 'Generate a B2B SaaS startup',
    name: 'string',
    idea: 'What problem does this solve? ->Idea',
    founders: ['Who are the founding team? ->Founder'],
    customer: 'Who is the target customer? ~>CustomerPersona',
  },
  Idea: {
    problem: 'string',
    solution: 'string',
    differentiator: 'What makes this unique?',
  },
  Founder: {
    name: 'string',
    role: 'string',
    background: 'Previous experience',
  },
  CustomerPersona: {
    title: 'string',
    painPoints: 'string',
    budget: 'string',
  },
})

// Pre-populate customer personas
await db.CustomerPersona.create({
  title: 'VP of Engineering',
  painPoints: 'Managing distributed teams, code quality',
  budget: '$50k-100k annually',
})

// Generate complete startup with one call
const startup = await db.Startup.create(
  { name: 'DevFlow' },
  { cascade: true, maxDepth: 2 }
)

// Access generated entities
const idea = await startup.idea
const founders = await startup.founders
const customer = await startup.customer  // May match existing or generate new
```

### Example 2: Content Management with Grounding

Grounding generated content against reference taxonomies:

```typescript
const { db } = DB({
  Article: {
    $instructions: 'Write a technical blog post',
    title: 'string',
    content: 'markdown',
    category: 'What category? <~Category',     // Ground against existing
    tags: ['Relevant tags <~Tag'],             // Multiple semantic matches
    author: '->Author',                        // Auto-generate author
  },
  Category: { name: 'string', description: 'string' },
  Tag: { name: 'string' },
  Author: { name: 'string', bio: 'string' },
})

// Set up taxonomy
await db.Category.create({ name: 'Artificial Intelligence', description: 'ML and AI topics' })
await db.Category.create({ name: 'Web Development', description: 'Frontend and backend' })
await db.Tag.create({ name: 'Machine Learning' })
await db.Tag.create({ name: 'Deep Learning' })
await db.Tag.create({ name: 'React' })

// Create article - content grounded against existing categories
const article = await db.Article.create({
  title: 'Introduction to Neural Networks',
  categoryHint: 'AI and machine learning topics',
  tagsHint: ['neural network concepts', 'ML fundamentals'],
})

const category = await article.category
// => { name: 'Artificial Intelligence', ... } - matched existing!

const tags = await article.tags
// => [{ name: 'Machine Learning' }, { name: 'Deep Learning' }] - matched existing!
```

### Example 3: Hierarchical Organization Chart

Building a complete org structure with bidirectional navigation:

```typescript
const { db } = DB({
  Company: {
    name: 'string',
    ceo: '->Person',
    departments: ['<-Department'],  // Backward ref for aggregation
  },
  Department: {
    name: 'string',
    company: '->Company',           // Forward ref to parent
    head: '->Person',
    employees: ['<-Person'],        // All people in this department
  },
  Person: {
    name: 'string',
    role: 'string',
    department: '->Department?',    // Optional department
    reportsTo: '->Person?',         // Self-referential hierarchy
    directReports: ['<-Person.reportsTo'],
  },
})

// Create company structure
const company = await db.Company.create({ name: 'TechCorp' })
const engineering = await db.Department.create({
  name: 'Engineering',
  company: company.$id,
})

const cto = await db.Person.create({
  name: 'Alice',
  role: 'CTO',
  department: engineering.$id,
})

const engineer = await db.Person.create({
  name: 'Bob',
  role: 'Senior Engineer',
  department: engineering.$id,
  reportsTo: cto.$id,
})

// Navigate bidirectionally
const aliceReports = await cto.directReports
// => [{ name: 'Bob', ... }]

const engineeringTeam = await engineering.employees
// => [{ name: 'Alice', ... }, { name: 'Bob', ... }]
```

---

## Common Patterns

### Union Types for Polymorphic References

```typescript
const { db } = DB({
  Comment: {
    content: 'string',
    target: '->Post|Article|Video',  // Can reference any of these types
  },
  Post: { title: 'string' },
  Article: { title: 'string' },
  Video: { title: 'string', url: 'url' },
})

const target = await comment.target
console.log(target.$matchedType)  // 'Post', 'Article', or 'Video'
```

### Self-Referential Trees

```typescript
const { db } = DB({
  Node: {
    value: 'string',
    parent: '->Node?',
    children: ['<-Node.parent'],
  },
})

const root = await db.Node.create({ value: 'Root' })
const child = await db.Node.create({ value: 'Child', parent: root.$id })

const rootChildren = await root.children
// => [{ value: 'Child', ... }]
```

### Symmetric Relationships

```typescript
const { db } = DB({
  Team: {
    name: 'string',
    members: ['->Member'],
  },
  Member: {
    name: 'string',
    team: '<-Team',  // Points back to team
  },
})

// Creating team generates members
const team = await db.Team.create({ name: 'Engineering' }, { cascade: true })

// Each member can navigate back to team
const member = (await team.members)[0]
const memberTeam = await member.team
// memberTeam.$id === team.$id
```

---

## Related

- [ai-functions](https://github.com/ai-primitives/ai-primitives/tree/main/packages/ai-functions) - AI-powered functions
- [ai-workflows](https://github.com/ai-primitives/ai-primitives/tree/main/packages/ai-workflows) - Event-driven workflows
- [@mdxdb/fs](https://github.com/ai-primitives/mdx.org.ai/tree/main/packages/@mdxdb/fs) - Filesystem adapter
- [@mdxdb/sqlite](https://github.com/ai-primitives/mdx.org.ai/tree/main/packages/@mdxdb/sqlite) - SQLite adapter
- [@mdxdb/api](https://github.com/ai-primitives/mdx.org.ai/tree/main/packages/@mdxdb/api) - HTTP API client
