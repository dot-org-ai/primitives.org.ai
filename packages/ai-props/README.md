# ai-props

AI-powered props primitives for intelligent component properties.

## Overview

`ai-props` provides utilities for automatically generating component props using AI based on schema definitions. It's designed to work seamlessly with React components, Next.js, and other frameworks.

## Installation

```bash
npm install ai-props
```

## Quick Start

```typescript
import { AI, generateProps } from 'ai-props'

// Define an AI-powered component schema
const UserCard = AI({
  schema: {
    name: 'User name',
    bio: 'User biography',
    avatar: 'Avatar URL',
  },
  defaults: {
    avatar: '/default-avatar.png',
  },
})

// Generate props with AI
const props = await UserCard({ name: 'John' })
// { name: 'John', bio: 'AI-generated bio...', avatar: '/default-avatar.png' }
```

## Core Features

### AI() Wrapper

Create AI-powered component wrappers that automatically fill in missing props:

```typescript
import { AI } from 'ai-props'

const ProductCard = AI({
  schema: {
    title: 'Product title',
    description: 'Product description',
    price: 'Price (number)',
  },
  required: ['price'],  // Required props won't be generated
  exclude: ['internal'], // Exclude props from generation
})

// Use the component
const props = await ProductCard({ price: 99 })
```

### generateProps()

Low-level function for direct prop generation:

```typescript
import { generateProps } from 'ai-props'

const result = await generateProps({
  schema: {
    title: 'SEO-optimized page title',
    description: 'Meta description',
    keywords: ['Relevant keywords'],
  },
  context: { topic: 'AI-powered applications' },
})

console.log(result.props)    // Generated props
console.log(result.cached)   // Whether result came from cache
console.log(result.metadata) // Model info, duration, etc.
```

### createAIComponent()

Create typed AI components:

```typescript
import { createAIComponent } from 'ai-props'

interface ProductProps {
  title: string
  price: number
  description: string
}

const ProductCard = createAIComponent<ProductProps>({
  schema: {
    title: 'Product title',
    price: 'Price (number)',
    description: 'Product description',
  },
})

const props = await ProductCard({})
// props is typed as ProductProps
```

### createComponentFactory()

Create a factory for generating multiple instances:

```typescript
import { createComponentFactory } from 'ai-props'

const factory = createComponentFactory({
  schema: {
    name: 'Product name',
    price: 'Price (number)',
  },
})

// Generate a single instance
const product = await factory.generate({ category: 'electronics' })

// Generate multiple instances
const products = await factory.generateMany([
  { category: 'electronics' },
  { category: 'clothing' },
])

// Generate with overrides
const custom = await factory.generateWith(
  { category: 'tech' },
  { price: 99 }
)
```

### composeAIComponents()

Compose multiple schemas together:

```typescript
import { composeAIComponents } from 'ai-props'

const FullProfile = composeAIComponents({
  user: {
    schema: { name: 'User name', bio: 'Biography' },
  },
  settings: {
    schema: { theme: 'Theme preference', notifications: 'Notification pref' },
  },
})

const profile = await FullProfile({
  user: { name: 'John' },
  settings: {},
})
```

## HOC Utilities

### createPropsEnhancer()

Create a props enhancer for any component system:

```typescript
import { createPropsEnhancer } from 'ai-props'

const enhancer = createPropsEnhancer({
  schema: {
    title: 'Page title',
    description: 'Page description',
  },
  defaults: { title: 'Default Title' },
})

const props = await enhancer({ description: 'My page' })
```

### createAsyncPropsProvider()

Create an async props provider for SSR:

```typescript
import { createAsyncPropsProvider } from 'ai-props'

const getPageProps = createAsyncPropsProvider({
  schema: {
    title: 'SEO title',
    meta: { description: 'Meta description' },
  },
})

// In getStaticProps or getServerSideProps
export async function getStaticProps() {
  const props = await getPageProps.getProps({ slug: 'about' })
  return { props }
}
```

### createBatchGenerator()

Generate props for multiple items efficiently:

```typescript
import { createBatchGenerator } from 'ai-props'

const batch = createBatchGenerator({
  schema: { title: 'Item title', description: 'Description' },
  concurrency: 3,
})

const items = await batch.generate([
  { id: 1, category: 'tech' },
  { id: 2, category: 'science' },
])
```

## Validation

### validateProps()

Validate props against a schema:

```typescript
import { validateProps } from 'ai-props'

const result = validateProps(
  { name: 'John', age: '25' },
  { name: 'Name', age: 'Age (number)' }
)

if (!result.valid) {
  console.log(result.errors)
  // [{ path: 'age', message: 'Expected number, got string' }]
}
```

### assertValidProps()

Assert props are valid (throws on error):

```typescript
import { assertValidProps } from 'ai-props'

assertValidProps(
  { name: 'John', age: 25 },
  { name: 'Name', age: 'Age (number)' }
)
```

### Other Validation Utilities

```typescript
import {
  hasRequiredProps,
  getMissingProps,
  isComplete,
  getMissingFromSchema,
  sanitizeProps,
  mergeWithDefaults,
  createValidator,
} from 'ai-props'

// Check required props
hasRequiredProps({ name: 'John' }, ['name', 'email']) // false

// Get missing props
getMissingProps({ name: 'John' }, ['name', 'email']) // ['email']

// Check schema completion
isComplete({ name: 'John' }, { name: 'Name', age: 'Age' }) // false

// Sanitize extra props
sanitizeProps({ name: 'John', extra: 'value' }, { name: 'Name' })
// { name: 'John' }

// Merge with defaults
mergeWithDefaults({ name: 'John' }, { age: 0 }, { name: 'Name', age: 'Age' })
// { name: 'John', age: 0 }

// Create reusable validator
const validate = createValidator({ name: 'Name', age: 'Age (number)' })
validate({ name: 'John', age: 25 }) // { valid: true, errors: [] }
```

## Caching

### Cache Configuration

```typescript
import { configureAIProps, configureCache, clearCache } from 'ai-props'

// Configure global settings
configureAIProps({
  model: 'gpt-4',
  cache: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
})

// Configure cache with custom TTL
configureCache(10 * 60 * 1000) // 10 minutes

// Clear all cached props
clearCache()
```

### Cache Classes

```typescript
import { MemoryPropsCache, LRUPropsCache } from 'ai-props'

// Simple memory cache
const memCache = new MemoryPropsCache(5 * 60 * 1000)

// LRU cache with max entries
const lruCache = new LRUPropsCache(100, 5 * 60 * 1000)

// Cache operations
lruCache.set('key', { name: 'John' })
const entry = lruCache.get<{ name: string }>('key')
lruCache.delete('key')
lruCache.clear()
console.log(lruCache.size)
```

## Schema Type Hints

Use type hints in schema strings:

```typescript
const schema = {
  name: 'User name',                    // string
  age: 'User age (number)',             // number
  count: 'Item count (integer)',        // integer
  active: 'Is active (boolean)',        // boolean
  tags: ['Tag names'],                  // array
  status: 'pending | active | done',    // enum
  profile: {                            // nested object
    bio: 'User bio',
    avatar: 'Avatar URL',
  },
}
```

## Configuration

```typescript
import { configureAIProps, getConfig, resetConfig } from 'ai-props'

// Configure globally
configureAIProps({
  model: 'sonnet',           // Default model
  cache: true,               // Enable caching
  cacheTTL: 300000,          // Cache TTL in ms
  system: 'Custom prompt',   // System prompt
  generate: async (schema, context) => {
    // Custom generator
    return { /* generated props */ }
  },
})

// Get current config
const config = getConfig()

// Reset to defaults
resetConfig()
```

## API Reference

### Types

```typescript
interface PropSchema {
  [key: string]: string | string[] | PropSchema
}

interface GeneratePropsOptions {
  schema: PropSchema
  context?: Record<string, unknown>
  prompt?: string
  model?: string
  system?: string
}

interface GeneratePropsResult<T> {
  props: T
  cached: boolean
  metadata: {
    model: string
    duration?: number
  }
}

interface AIComponentOptions<P> {
  schema: PropSchema
  defaults?: Partial<P>
  required?: (keyof P)[]
  exclude?: (keyof P)[]
  config?: AIPropsConfig
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

interface ValidationError {
  path: string
  message: string
  expected?: string
  received?: unknown
}
```

## License

MIT
