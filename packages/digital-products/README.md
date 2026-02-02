# digital-products

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

Primitives for defining and building digital products.

## Overview

This package provides a declarative API for defining digital products - apps, APIs, content, data structures, datasets, websites, MCP servers, and SDKs. Each product type has a specialized constructor with a clean, chainable API.

## Installation

```bash
npm install digital-products ai-functions
```

## API

### Core Functions

- **`Product()`** - Define a generic digital product
- **`App()`** - Define an application
- **`API()`** - Define an API
- **`Content()`** - Define content
- **`Data()`** - Define data structures
- **`Dataset()`** - Define datasets
- **`Site()`** - Define a website
- **`MCP()`** - Define Model Context Protocol servers
- **`SDK()`** - Define software development kits

### Registry

- **`registry`** - Global product registry for storing and retrieving products

## Usage Examples

### Define an App

```typescript
import { App, Route, State, Auth } from 'digital-products'

const myApp = App({
  id: 'my-app',
  name: 'My App',
  description: 'A web application',
  version: '1.0.0',
  framework: 'react',
  routes: [
    Route('/', 'Home'),
    Route('/about', 'About'),
    Route('/users/:id', 'UserDetail', {
      meta: { title: 'User Profile' },
    }),
  ],
  state: State({
    library: 'zustand',
    schema: {
      user: 'Current user object',
      settings: 'App settings object',
    },
    persistence: {
      type: 'local',
      key: 'app-state',
    },
  }),
  auth: Auth({
    provider: 'clerk',
    protectedRoutes: ['/dashboard', '/profile'],
  }),
})
```

### Define an API

```typescript
import { API, Endpoint, APIAuth, RateLimit } from 'digital-products'

const myAPI = API({
  id: 'my-api',
  name: 'My API',
  description: 'A RESTful API',
  version: '1.0.0',
  style: 'rest',
  baseUrl: 'https://api.example.com',
  endpoints: [
    Endpoint('GET', '/users', 'List all users', {
      response: {
        users: ['Array of user objects'],
        total: 'Total count (number)',
      },
    }),
    Endpoint('POST', '/users', 'Create a user', {
      request: {
        name: 'User name',
        email: 'User email',
      },
      response: {
        id: 'User ID',
        name: 'User name',
        email: 'User email',
      },
      auth: true,
    }),
  ],
  auth: APIAuth({
    type: 'bearer',
    header: 'Authorization',
  }),
  rateLimit: RateLimit({
    requests: 100,
    window: 60, // 60 seconds
    onExceeded: 'reject',
  }),
})
```

### Define Content

```typescript
import { Content, Workflow } from 'digital-products'

const blogContent = Content({
  id: 'blog',
  name: 'Blog Posts',
  description: 'Blog content for the website',
  version: '1.0.0',
  format: 'mdx',
  source: './content/blog',
  frontmatter: {
    title: 'Post title',
    author: 'Author name',
    date: 'Publication date (date)',
    tags: ['Array of tags'],
  },
  categories: ['Technology', 'Business', 'Design'],
  workflow: Workflow({
    states: ['draft', 'review', 'published'],
    initialState: 'draft',
    transitions: [
      { from: 'draft', to: 'review', action: 'submit' },
      { from: 'review', to: 'published', action: 'approve' },
      { from: 'review', to: 'draft', action: 'reject' },
    ],
    approvals: [
      { state: 'review', roles: ['editor', 'admin'] },
    ],
  }),
})
```

### Define Data

```typescript
import { Data, Index, Relationship, Validate } from 'digital-products'

const userData = Data({
  id: 'users',
  name: 'Users',
  description: 'User data store',
  version: '1.0.0',
  schema: {
    id: 'User ID',
    name: 'User name',
    email: 'User email',
    createdAt: 'Creation timestamp (date)',
    role: 'admin | user | guest',
  },
  provider: 'postgres',
  indexes: [
    Index('email_idx', ['email'], { unique: true }),
    Index('role_idx', ['role']),
  ],
  relationships: [
    Relationship('one-to-many', 'userId', 'posts', 'author'),
  ],
  validation: [
    Validate('email', 'email', 'Must be a valid email'),
    Validate('name', 'required', 'Name is required'),
  ],
})
```

### Define a Dataset

```typescript
import { Dataset } from 'digital-products'

const movieDataset = Dataset({
  id: 'movies',
  name: 'Movie Database',
  description: 'Comprehensive movie information dataset',
  version: '2024.1',
  format: 'parquet',
  schema: {
    id: 'Movie ID',
    title: 'Movie title',
    year: 'Release year (number)',
    genres: ['Array of genre names'],
    rating: 'Average rating (number)',
    votes: 'Number of votes (number)',
  },
  source: 's3://datasets/movies.parquet',
  size: 1000000,
  license: 'CC-BY-4.0',
  updateFrequency: 'daily',
})
```

### Define a Site

```typescript
import { Site, Nav, SEO, Analytics } from 'digital-products'

const docsSite = Site({
  id: 'docs',
  name: 'Documentation Site',
  description: 'Product documentation',
  version: '1.0.0',
  generator: 'fumadocs',
  structure: {
    home: '/docs/index.mdx',
    docs: [
      '/docs/getting-started.mdx',
      '/docs/api-reference.mdx',
    ],
  },
  navigation: [
    Nav('Home', '/'),
    Nav('Docs', '/docs', {
      children: [
        Nav('Getting Started', '/docs/getting-started'),
        Nav('API Reference', '/docs/api-reference'),
      ],
    }),
  ],
  seo: SEO({
    titleTemplate: '%s | My Product',
    description: 'Official documentation for My Product',
    keywords: ['docs', 'api', 'reference'],
    ogImage: '/og-image.png',
    twitterCard: 'summary_large_image',
  }),
  analytics: Analytics('plausible', 'docs.example.com'),
})
```

### Define an MCP Server

```typescript
import { MCP, Tool, Resource, Prompt } from 'digital-products'

const mcpServer = MCP({
  id: 'my-mcp',
  name: 'My MCP Server',
  description: 'Custom MCP server for AI tools',
  version: '1.0.0',
  transport: 'stdio',
  tools: [
    Tool('searchFiles', 'Search for files in the project', {
      query: 'Search query',
      path: 'Directory to search in',
    }),
    Tool('readFile', 'Read file contents', {
      path: 'File path to read',
    }),
  ],
  resources: [
    Resource('file://project', 'Project Files', 'Access to all project files'),
  ],
  prompts: [
    Prompt(
      'codeReview',
      'Review code for best practices',
      'Review the following code:\n\n{{code}}',
      { code: 'Code to review' }
    ),
  ],
})
```

### Define an SDK

```typescript
import { SDK, Export, Example } from 'digital-products'

const mySDK = SDK({
  id: 'my-sdk',
  name: 'My SDK',
  description: 'JavaScript SDK for My API',
  version: '1.0.0',
  language: 'typescript',
  api: 'my-api',
  exports: [
    Export('function', 'createClient', 'Create an API client', {
      parameters: {
        apiKey: 'API key for authentication',
        baseUrl: 'Optional base URL',
      },
      returns: 'API client instance',
    }),
    Export('class', 'APIClient', 'Main API client', {
      methods: [
        Export('function', 'get', 'GET request', {
          parameters: { path: 'Request path' },
          returns: 'Response data',
        }),
        Export('function', 'post', 'POST request', {
          parameters: { path: 'Request path', data: 'Request body' },
          returns: 'Response data',
        }),
      ],
    }),
  ],
  install: 'npm install my-sdk',
  examples: [
    Example(
      'Basic Usage',
      'Create a client and make a request',
      `import { createClient } from 'my-sdk'

const client = createClient({ apiKey: 'YOUR_API_KEY' })
const users = await client.get('/users')
console.log(users)`,
      '{ users: [...] }'
    ),
  ],
})
```

### Using the Registry

```typescript
import { registry } from 'digital-products'

// List all registered products
const allProducts = registry.list()
console.log('All products:', allProducts.map(p => p.name))

// Get a specific product
const myApp = registry.get('my-app')

// List products by type
const apps = registry.listByType('app')
const apis = registry.listByType('api')
const sites = registry.listByType('site')

// Remove a product
registry.remove('my-app')

// Clear all products
registry.clear()
```

## Product Types

### App

Interactive user-facing applications with:
- Routes and navigation
- State management
- Authentication
- Deployment configuration

### API

Programmatic interfaces with:
- Endpoints (REST, GraphQL, RPC, gRPC, WebSocket)
- Request/response schemas
- Authentication
- Rate limiting
- OpenAPI/Swagger specs

### Content

Text and media content with:
- Multiple formats (Markdown, MDX, HTML, JSON, YAML)
- Structured schemas and frontmatter
- Categories and taxonomy
- Publishing workflows with approvals

### Data

Structured data definitions with:
- Schema definitions
- Database provider configuration
- Indexes and relationships
- Validation rules

### Dataset

Curated data collections with:
- Multiple formats (JSON, CSV, Parquet, Arrow, Avro)
- Schema definitions
- License information
- Update frequency

### Site

Websites and documentation with:
- Site structure and navigation
- SEO configuration
- Analytics integration
- Deployment configuration

### MCP

Model Context Protocol servers with:
- Transport configuration (stdio, HTTP, WebSocket)
- Tools for AI agents
- Resources and prompts
- Authentication

### SDK

Software development kits with:
- Target language/platform
- Exported functions, classes, and types
- Installation instructions
- Documentation and examples

## Entity Definitions (Nouns)

This package also provides comprehensive entity definitions following the Noun pattern from `ai-database`. Each entity includes properties, relationships, actions, and events.

### Entity Categories

| Category | Entities |
|----------|----------|
| **Products** | DigitalProduct, SaaSProduct, App, Platform, Marketplace |
| **Interfaces** | API, Endpoint, SDK, MCP, Plugin, Integration, Webhook |
| **Content** | ContentProduct, DataProduct, Dataset, Documentation, Template |
| **Web** | Site, Component, Widget, Theme |
| **AI** | AIProduct, Model, Agent, Prompt, Tool |
| **Lifecycle** | Version, Release, Deployment, Environment, Feature |

### Using Entity Definitions

```typescript
import { Nouns, ProductEntities, AIEntities } from 'digital-products'

// Access entities through the Nouns namespace
const appEntity = Nouns.App
console.log(appEntity.singular)  // 'app'
console.log(appEntity.actions)   // ['create', 'update', 'deploy', ...]
console.log(appEntity.events)    // ['created', 'updated', 'deployed', ...]

// Or access category collections directly
const allProducts = ProductEntities
const allAI = AIEntities
```

### Entity Structure

Each entity follows the Noun pattern:

```typescript
const App: Noun = {
  singular: 'app',
  plural: 'apps',
  description: 'An interactive user-facing application',

  properties: {
    name: { type: 'string', description: 'App name' },
    type: { type: 'string', examples: ['web', 'mobile', 'desktop', 'cli', 'pwa'] },
    framework: { type: 'string', examples: ['react', 'vue', 'svelte', 'solid'] },
    status: { type: 'string', examples: ['draft', 'development', 'beta', 'production'] },
    // ... more properties
  },

  relationships: {
    product: { type: 'DigitalProduct', description: 'Parent product' },
    features: { type: 'Feature[]', description: 'App features' },
    deployments: { type: 'Deployment[]', description: 'Active deployments' },
  },

  actions: ['create', 'update', 'build', 'test', 'deploy', 'release', 'rollback', 'pause', 'deprecate'],
  events: ['created', 'updated', 'built', 'tested', 'deployed', 'released', 'rolledBack', 'paused', 'deprecated'],
}
```

## TypeScript Support

All product definitions are fully typed with TypeScript. The package exports comprehensive type definitions for all product types and their configurations.

```typescript
import type {
  AppDefinition,
  APIDefinition,
  ContentDefinition,
  DataDefinition,
  DatasetDefinition,
  SiteDefinition,
  MCPDefinition,
  SDKDefinition,
  ProductDefinition,
} from 'digital-products'
```

## Design Principles

1. **Declarative**: Define products using simple configuration objects
2. **Type-safe**: Full TypeScript support with comprehensive types
3. **Composable**: Helper functions for building complex configurations
4. **Extensible**: Easy to add custom metadata and configurations
5. **Registry-based**: Central registry for managing products

## Integration with ai-functions

This package uses `SimpleSchema` from `ai-functions` for defining schemas in a human-readable format:

```typescript
// Simple string description
schema: {
  name: 'User name',
  age: 'User age (number)',
  active: 'Is user active (boolean)',
  role: 'admin | user | guest',
}

// Arrays
schema: {
  tags: ['List of tags'],
  scores: ['List of scores (number)'],
}

// Nested objects
schema: {
  user: {
    name: 'Name',
    email: 'Email address',
  },
}
```

## License

MIT
