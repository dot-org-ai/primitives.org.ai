# @graphdl/core

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

**Define entity graphs with the expressiveness of natural language**

A pure TypeScript DSL for defining entity graphs with noun/verb semantics, relationship operators, and MDXLD conventions. Zero runtime dependencies, fully typesafe, and designed for AI-powered applications.

[![npm version](https://img.shields.io/npm/v/@graphdl/core.svg)](https://www.npmjs.com/package/@graphdl/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

## Features

- **Intuitive DSL** - Define schemas with a clean, declarative syntax
- **Relationship Operators** - Express exact (`->`) and fuzzy (`~>`) relationships
- **Noun/Verb Semantics** - Auto-generate linguistic forms from type names
- **Dependency Analysis** - Topological sorting, cycle detection, parallel groups
- **MDXLD Conventions** - `$type` and `$id` fields for semantic identity
- **Zero Dependencies** - Layer 0 foundation package with no internal deps
- **Full TypeScript** - Complete type safety with rich inference

## Installation

```bash
npm install @graphdl/core
# or
pnpm add @graphdl/core
# or
yarn add @graphdl/core
```

## Quick Start

```typescript
import { Graph, inferNoun, conjugate } from '@graphdl/core'

// Define your schema with the Graph DSL
const schema = Graph({
  User: 'https://schema.org.ai/Person',

  Post: {
    $type: 'https://schema.org.ai/BlogPosting',
    title: 'string',
    content: 'markdown',
    status: 'string',
    author: '->User.posts',           // Exact reference with backref
    categories: ['~>Category.posts'], // Fuzzy array with backref
    publishedAt: 'datetime?',
  },

  Category: {
    $type: 'https://schema.org.ai/Category',
    name: 'string',
    description: 'string?',
  },
})

// Access parsed entities
const post = schema.entities.get('Post')
console.log(post?.fields.get('author'))
// => { name: 'author', type: 'User', isRelation: true, operator: '->', ... }

// Auto-infer noun forms
const postNoun = inferNoun('BlogPost')
console.log(postNoun)
// => { singular: 'blog post', plural: 'blog posts', actions: ['create', ...] }

// Auto-conjugate verbs
const publish = conjugate('publish')
console.log(publish)
// => { action: 'publish', actor: 'publisher', act: 'publishes', ... }
```

## API Reference

### Graph DSL

The `Graph()` function is the primary way to define entity schemas.

```typescript
import { Graph, getEntityNames, getEntity, getRelationshipFields } from '@graphdl/core'

const schema = Graph({
  // Simple type URI mapping
  User: 'https://schema.org.ai/Person',

  // Full entity definition
  Post: {
    $type: 'https://schema.org.ai/BlogPosting',
    title: 'string',
    content: 'markdown',
    views: 'number',
    published: 'boolean',
    author: '->User.posts',
  },
})

// Utility functions
getEntityNames(schema)              // ['User', 'Post']
getEntity(schema, 'Post')           // ParsedEntity
getRelationshipFields(schema, 'Post') // [{ name: 'author', ... }]
```

#### Supported Field Types

| Type | Description |
|------|-------------|
| `string` | Text field |
| `number` | Numeric field |
| `boolean` | True/false field |
| `date` | Date only |
| `datetime` | Date and time |
| `json` | Arbitrary JSON |
| `markdown` | Markdown text |
| `url` | URL string |
| `email` | Email address |

#### Field Modifiers

```typescript
{
  name: 'string',       // Required field
  bio: 'string?',       // Optional field (?)
  tags: 'string[]',     // Array field ([])
  notes: 'string[]?',   // Optional array
}
```

### Relationship Operators

Four operators express different relationship semantics:

| Operator | Direction | Match Mode | Use Case |
|----------|-----------|------------|----------|
| `->` | forward | exact | Foreign key reference |
| `~>` | forward | fuzzy | AI-matched semantic reference |
| `<-` | backward | exact | Backlink/parent reference |
| `<~` | backward | fuzzy | AI-matched backlink |

```typescript
import { parseOperator, hasOperator, isForwardOperator, isFuzzyOperator } from '@graphdl/core'

// Basic relationship
parseOperator('->Author')
// => { operator: '->', direction: 'forward', matchMode: 'exact', targetType: 'Author' }

// With backref
parseOperator('->User.posts')
// => { ..., targetType: 'User', backref: 'posts' }

// Fuzzy with threshold
parseOperator('~>Category(0.8)')
// => { operator: '~>', matchMode: 'fuzzy', targetType: 'Category', threshold: 0.8 }

// Union types (polymorphic)
parseOperator('->Person|Company|Organization')
// => { ..., targetType: 'Person', unionTypes: ['Person', 'Company', 'Organization'] }

// With AI generation prompt
parseOperator('What is the main category? ~>Category')
// => { prompt: 'What is the main category?', operator: '~>', ... }

// Utility predicates
hasOperator('->User')           // true
isForwardOperator('->')         // true
isFuzzyOperator('~>')           // true
```

### Verbs and Conjugation

Define actions with full linguistic conjugation.

```typescript
import { Verbs, conjugate, getVerbFields, isStandardVerb } from '@graphdl/core'

// Pre-defined CRUD verbs
Verbs.create
// => {
//   action: 'create',
//   actor: 'creator',
//   act: 'creates',
//   activity: 'creating',
//   result: 'creation',
//   reverse: { at: 'createdAt', by: 'createdBy', in: 'createdIn', for: 'createdFor' },
//   inverse: 'delete',
// }

// Available standard verbs
Object.keys(Verbs)
// => ['create', 'update', 'delete', 'publish', 'archive', 'approve', 'reject', 'assign', 'complete', 'submit', 'review']

// Auto-conjugate any verb
conjugate('validate')
// => { action: 'validate', actor: 'validator', act: 'validates', activity: 'validating', ... }

conjugate('approve')
// => Uses pre-defined Verbs.approve

// Get reverse field names
getVerbFields('create')
// => { at: 'createdAt', by: 'createdBy', in: 'createdIn', for: 'createdFor' }

// Check if standard
isStandardVerb('publish')  // true
isStandardVerb('explode')  // false
```

### Noun Inference and Definition

Auto-infer or explicitly define noun metadata.

```typescript
import { inferNoun, defineNoun, Type, createTypeMeta } from '@graphdl/core'

// Auto-infer from type name
inferNoun('BlogPost')
// => {
//   singular: 'blog post',
//   plural: 'blog posts',
//   actions: ['create', 'update', 'delete'],
//   events: ['created', 'updated', 'deleted'],
// }

inferNoun('Category')
// => { singular: 'category', plural: 'categories', ... }

// Explicit definition
const Person = defineNoun({
  singular: 'person',
  plural: 'people',
  description: 'A human individual',
  properties: {
    name: { type: 'string', description: 'Full name' },
    email: { type: 'email', description: 'Email address', optional: true },
  },
  relationships: {
    manager: { type: 'Person', operator: '->', description: 'Direct manager' },
  },
  actions: ['create', 'update', 'delete', 'archive'],
  events: ['created', 'updated', 'deleted', 'archived'],
})

// Type metadata proxy
const Post = Type('Post')
Post.singular   // 'post'
Post.plural     // 'posts'
Post.slug       // 'post'
Post.created    // 'Post.created'
Post.createdAt  // 'createdAt'

// Full type metadata
createTypeMeta('BlogPost')
// => {
//   name: 'BlogPost',
//   singular: 'blog post',
//   plural: 'blog posts',
//   slug: 'blog-post',
//   slugPlural: 'blog-posts',
//   creator: 'creator',
//   createdAt: 'createdAt',
//   createdBy: 'createdBy',
//   updatedAt: 'updatedAt',
//   updatedBy: 'updatedBy',
//   created: 'BlogPost.created',
//   updated: 'BlogPost.updated',
//   deleted: 'BlogPost.deleted',
// }
```

### Dependency Graph Utilities

Analyze schema dependencies for generation order, cycle detection, and parallelization.

```typescript
import {
  buildDependencyGraph,
  topologicalSort,
  detectCycles,
  getParallelGroups,
  getAllDependencies,
  hasCycles,
  visualizeGraph,
  CircularDependencyError,
} from '@graphdl/core'

const schema = Graph({
  User: { name: 'string' },
  Post: { title: 'string', author: '->User' },
  Comment: { text: 'string', post: '->Post', author: '->User' },
})

// Build dependency graph
const graph = buildDependencyGraph(schema)

// Topological sort (dependencies first)
topologicalSort(graph, 'Comment')
// => ['User', 'Post', 'Comment']

// Parallel generation groups
getParallelGroups(graph, 'Comment')
// => [['User'], ['Post'], ['Comment']]

// Cycle detection
detectCycles(graph)
// => [] (no cycles)

// Check for cycles
hasCycles(graph)  // false

// Get all dependencies for a type
getAllDependencies(graph, 'Comment')
// => Set { 'Post', 'User' }

// Visualize the graph
console.log(visualizeGraph(graph))
// Dependency Graph:
//
// User:
//   (no dependencies)
//
// Post:
//   -> User (hard deps)
//   <- Comment (depended on by)
//
// Comment:
//   -> Post, User (hard deps)
```

#### Handling Circular Dependencies

```typescript
const cyclicSchema = Graph({
  A: { b: '->B' },
  B: { a: '->A' },
})

const graph = buildDependencyGraph(cyclicSchema)
const cycles = detectCycles(graph)
// => [['A', 'B', 'A']]

try {
  topologicalSort(graph, 'A')
} catch (error) {
  if (error instanceof CircularDependencyError) {
    console.log('Cycle:', error.cyclePath)
    // => ['A', 'B', 'A']
  }
}

// Optional dependencies don't create cycles
const optionalSchema = Graph({
  A: { b: '->B?' },  // Optional, doesn't block generation
  B: { a: '->A' },
})
topologicalSort(buildDependencyGraph(optionalSchema), 'A', true)
// Works! Optional deps are ignored
```

### Linguistic Utilities

Low-level functions for text transformation.

```typescript
import {
  pluralize,
  singularize,
  capitalize,
  splitCamelCase,
  toKebabCase,
  toPastParticiple,
  toActor,
  toPresent,
  toGerund,
  toResult,
} from '@graphdl/core'

// Pluralization (handles irregulars)
pluralize('post')      // 'posts'
pluralize('category')  // 'categories'
pluralize('person')    // 'people'
pluralize('child')     // 'children'

// Singularization
singularize('posts')      // 'post'
singularize('categories') // 'category'
singularize('people')     // 'person'

// Case manipulation
capitalize('hello')           // 'Hello'
splitCamelCase('BlogPost')    // ['Blog', 'Post']
toKebabCase('BlogPost')       // 'blog-post'

// Verb conjugation
toPastParticiple('create')  // 'created'
toPastParticiple('submit')  // 'submitted'
toActor('create')           // 'creator'
toActor('publish')          // 'publisher'
toPresent('create')         // 'creates'
toPresent('publish')        // 'publishes'
toGerund('create')          // 'creating'
toGerund('run')             // 'running'
toResult('create')          // 'creation'
toResult('publish')         // 'publication'
```

## Type Reference

### Core Types

| Type | Description |
|------|-------------|
| `ParsedGraph` | Fully parsed graph with entities and type URIs |
| `ParsedEntity` | Entity with name, `$type`, and fields Map |
| `ParsedField` | Field with type, modifiers, and relationship info |
| `ParsedRelationship` | Result of parsing a relationship operator |
| `GraphInput` | Input format for `Graph()` function |
| `EntityDefinition` | Single entity definition (string or object) |
| `FieldDefinition` | Single field definition |

### Relationship Types

| Type | Description |
|------|-------------|
| `RelationshipOperator` | `'->'` \| `'~>'` \| `'<-'` \| `'<~'` |
| `RelationshipDirection` | `'forward'` \| `'backward'` |
| `RelationshipMatchMode` | `'exact'` \| `'fuzzy'` |

### Noun/Verb Types

| Type | Description |
|------|-------------|
| `Noun` | Complete noun definition with properties and relationships |
| `NounProperty` | Property definition within a Noun |
| `NounRelationship` | Relationship definition within a Noun |
| `Verb` | Verb with all conjugation forms |
| `VerbReverse` | Reverse/passive forms of a verb |
| `TypeMeta` | Auto-inferred metadata for a type name |
| `PrimitiveType` | Supported primitive field types |

### Dependency Graph Types

| Type | Description |
|------|-------------|
| `DependencyGraph` | Complete graph with nodes and edges |
| `DependencyNode` | Node with hard/soft dependencies |
| `DependencyEdge` | Edge with operator and field info |

## Layer 0 Foundation

`@graphdl/core` is a **Layer 0 (Foundation)** package in the primitives.org.ai ecosystem. This means:

- **Zero internal dependencies** - Only depends on TypeScript itself
- **Pure logic** - No I/O, no network, no side effects
- **Safe to import anywhere** - No circular dependency risk
- **Minimal footprint** - Tree-shakeable ESM exports

This makes it ideal as a foundation for higher-level packages that need schema definition without runtime overhead.

## MDXLD Conventions

This package follows MDXLD conventions for semantic identity:

- **`$type`** - Type URI (e.g., `https://schema.org.ai/BlogPosting`)
- **`$id`** - Instance identifier

These are the `$`-prefixed superset of JSON-LD's `@id`/`@type`, used throughout the primitives.org.ai ecosystem for semantic web compatibility.

```typescript
const schema = Graph({
  Post: {
    $type: 'https://schema.org.ai/BlogPosting',
    title: 'string',
    content: 'markdown',
  },
})

schema.typeUris.get('Post')
// => 'https://schema.org.ai/BlogPosting'
```

## License

MIT
