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

## Related

- [ai-functions](../ai-functions) - AI-powered functions
- [ai-workflows](../ai-workflows) - Event-driven workflows
