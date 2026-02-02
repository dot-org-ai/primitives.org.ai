# ai-database Examples

This directory contains runnable examples demonstrating the features of ai-database.

## Prerequisites

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Build the package (if running from source):
   ```bash
   pnpm build
   ```

3. Set up environment variables (optional, for AI features):
   ```bash
   export ANTHROPIC_API_KEY=your-key-here
   # or
   export OPENAI_API_KEY=your-key-here
   ```

## Running Examples

Run any example with `tsx` from the ai-database package directory:

```bash
cd packages/ai-database
npx tsx examples/01-quickstart.ts
```

Or run all examples:

```bash
for f in examples/*.ts; do echo "=== $f ==="; npx tsx "$f"; done
```

**Note**: The examples use relative imports (`../src/index.js`) for local development. When using ai-database as an installed package, change the imports to:

```typescript
import { DB } from 'ai-database'
```

## Examples Overview

### 01-quickstart.ts
**Basic Usage**

Demonstrates fundamental ai-database concepts:
- Schema definition with type-safe operations
- CRUD operations (create, read, update, delete)
- Simple relationships (`->` and `<-`)
- Promise pipelining (chaining without await)

### 02-rag-chatbot.ts
**RAG (Retrieval-Augmented Generation) Chatbot**

Shows how to build a knowledge-based chatbot:
- Vector embeddings for documents
- Semantic search to find relevant context
- Hybrid search combining keyword and semantic matching
- Conversation history tracking

### 03-blog-generator.ts
**Cascade Generation for Blog Content**

Demonstrates automatic content generation:
- Forward exact (`->`) for hierarchical content
- Backward references (`<-`) for aggregation
- AI-powered content generation
- Progress tracking during generation
- Multi-level cascading (Blog -> Topics -> PostIdeas)

### 04-icp-builder.ts
**Ideal Customer Profile with Semantic Grounding**

Shows semantic grounding against reference data:
- Backward fuzzy (`<~`) for grounding to reference data
- Union types for polymorphic references
- Threshold configuration for fuzzy matching
- Seeding reference data (O*NET, NAICS patterns)

### 05-product-catalog.ts
**Complex Relationships and Batch Operations**

Demonstrates a full e-commerce product catalog:
- Self-referential trees (category hierarchy)
- Many-to-many relationships (products <-> tags)
- Promise pipelining for complex queries
- Batch operations with `forEach`
- Order processing workflow

### 06-document-extraction.ts
**Entity Extraction from Documents**

Shows how to extract structured data from unstructured text:
- AI-powered entity extraction
- Semantic grounding for extracted entities
- Relationship inference
- Extraction job tracking

### 07-ai-providers.ts
**AI Provider Configuration**

Comprehensive guide to AI configuration:
- OpenAI and Anthropic setup
- Model selection (GPT-4, Claude Sonnet/Opus)
- Cloudflare AI Gateway for caching
- Embedding configuration
- Error handling best practices

### 08-events-actions.ts
**Events and Actions APIs**

Demonstrates workflow and tracking features:
- Event subscription and emission
- Long-running action tracking
- Durable `forEach` with persistence
- Progress tracking and error handling

### 09-startup-generator.ts
**Complete Startup Ecosystem**

Full example showing all four operators:
- Forward exact (`->`) for creating child entities
- Forward fuzzy (`~>`) for reusing existing entities
- Backward exact (`<-`) for aggregation
- Backward fuzzy (`<~`) for semantic grounding
- Reference data seeding
- Multi-entity generation

### 10-two-phase-draft.ts
**Two-Phase Draft/Resolve Workflow**

Shows the draft workflow for human-in-the-loop:
- Phase 1 (Draft): Generate with placeholders
- Phase 2 (Resolve): Convert to real entities
- Draft editing before resolution
- Streaming support for long content
- Context-aware generation

## Relationship Operators Quick Reference

| Operator | Direction | Match Mode | When to Use |
|----------|-----------|------------|-------------|
| `->` | forward | exact | Creating child entities (Blog -> Posts) |
| `~>` | forward | fuzzy | Reusing existing entities (Campaign -> Audience) |
| `<-` | backward | exact | Aggregation queries (Blog collects Posts) |
| `<~` | backward | fuzzy | Grounding against reference data (ICP -> Occupation) |

## Common Patterns

### Schema Definition
```typescript
const { db } = DB({
  Post: {
    title: 'string',
    content: 'markdown',
    author: '->Author',        // Forward exact
    tags: ['->Tag'],           // Array of forward exact
  },
  Author: {
    name: 'string',
    posts: ['<-Post.author'],  // Backward reference
  },
  Tag: {
    name: 'string',
  },
})
```

### Cascade Generation
```typescript
const blog = await db.Blog.create(
  { title: 'My Blog' },
  {
    cascade: true,
    maxDepth: 3,
    onProgress: (p) => console.log(`${p.totalEntitiesCreated} created`),
  }
)
```

### Semantic Search
```typescript
const results = await db.Document.semanticSearch('machine learning', {
  limit: 10,
  minScore: 0.7,
})
```

### Event Subscription
```typescript
events.on('Post.created', (event) => {
  console.log('New post:', event.data.title)
})
```

### Batch Processing
```typescript
await db.Product.forEach(
  async (product) => {
    await processProduct(product)
  },
  {
    concurrency: 5,
    persist: 'process-products',
  }
)
```

## Need Help?

- Check the main [README.md](../README.md) for full documentation
- See the [test files](../test/) for more usage examples
- File issues on GitHub for bugs or feature requests
