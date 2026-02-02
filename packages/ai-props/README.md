# ai-props

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

**Stop manually writing placeholder props. Let AI fill in the blanks.**

You've built a beautiful component library. But every time you use a component, you're stuck inventing placeholder text, mock data, and dummy content. Your `<UserCard />` needs a bio. Your `<ProductCard />` needs a description. Your `<SEOHead />` needs meta tags.

What if your components could intelligently complete themselves?

## Before & After

```typescript
// BEFORE: Manual placeholder props (tedious, repetitive, inconsistent)
<UserCard
  name="John Doe"
  bio="Lorem ipsum dolor sit amet..."  // You've typed this a thousand times
  avatar="/placeholder.png"
/>

// AFTER: AI-powered props (intelligent, contextual, automatic)
const UserCard = AI({
  schema: {
    name: 'User name',
    bio: 'User biography',
    avatar: 'Avatar URL',
  },
})

const props = await UserCard({ name: 'John Doe' })
// { name: 'John Doe', bio: 'Software engineer passionate about...', avatar: 'https://...' }
```

## Quick Start

### 1. Install

```bash
npm install ai-props
```

### 2. Define Your Schema

```typescript
import { AI } from 'ai-props'

const ProductCard = AI({
  schema: {
    title: 'Product title',
    description: 'Product description',
    price: 'Price (number)',
  },
  required: ['price'],  // AI won't generate required props
})
```

### 3. Generate Props

```typescript
const props = await ProductCard({ price: 99 })
// { title: 'Premium Widget Pro', description: 'A high-quality...', price: 99 }
```

That's it. Your components now complete themselves intelligently.

---

## Core API

### `AI()` - The Smart Component Wrapper

Wrap any component schema to enable intelligent prop generation:

```typescript
import { AI } from 'ai-props'

const UserCard = AI({
  schema: {
    name: 'Full name of the user',
    bio: 'A short biography',
    avatar: 'URL to avatar image',
  },
  defaults: {
    avatar: '/default-avatar.png',
  },
  exclude: ['internal'],  // Never generate these props
})

const props = await UserCard({ name: 'Jane' })
```

### `generateProps()` - Low-Level Generation

Direct access to prop generation with full metadata:

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

console.log(result.props)     // Generated props
console.log(result.cached)    // Cache hit?
console.log(result.metadata)  // Model info, duration
```

### `createAIComponent()` - Full TypeScript Support

Get complete type inference for your generated props:

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
    price: 'Price in USD (number)',
    description: 'Product description',
  },
})

const props = await ProductCard({})  // Typed as ProductProps
```

---

## Batch & Factory Patterns

### Generate Multiple Items

```typescript
import { createComponentFactory } from 'ai-props'

const factory = createComponentFactory({
  schema: {
    name: 'Product name',
    price: 'Price (number)',
  },
})

// Single item
const product = await factory.generate({ category: 'electronics' })

// Multiple items in parallel
const products = await factory.generateMany([
  { category: 'electronics' },
  { category: 'clothing' },
  { category: 'home' },
])
```

### Compose Multiple Schemas

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

---

## SSR & Framework Integration

### Props Enhancer

```typescript
import { createPropsEnhancer } from 'ai-props'

const enhancer = createPropsEnhancer({
  schema: {
    title: 'Page title',
    description: 'Page description',
  },
  defaults: { title: 'My App' },
})

const props = await enhancer({ description: 'Welcome page' })
```

### Async Props Provider (Next.js)

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

### Batch Generation

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

---

## Validation

Ensure your props match expectations:

```typescript
import { validateProps, assertValidProps } from 'ai-props'

// Validate and get errors
const result = validateProps(
  { name: 'John', age: '25' },
  { name: 'Name', age: 'Age (number)' }
)

if (!result.valid) {
  console.log(result.errors)
  // [{ path: 'age', message: 'Expected number, got string' }]
}

// Or throw on invalid
assertValidProps(props, schema)
```

### Validation Utilities

```typescript
import {
  hasRequiredProps,
  getMissingProps,
  isComplete,
  sanitizeProps,
  mergeWithDefaults,
  createValidator,
} from 'ai-props'

hasRequiredProps({ name: 'John' }, ['name', 'email'])  // false
getMissingProps({ name: 'John' }, ['name', 'email'])   // ['email']
isComplete({ name: 'John' }, { name: 'Name', age: 'Age' })  // false
sanitizeProps({ name: 'John', extra: 'x' }, { name: 'Name' })  // { name: 'John' }

const validate = createValidator({ name: 'Name', age: 'Age (number)' })
validate({ name: 'John', age: 25 })  // { valid: true, errors: [] }
```

---

## Caching

Avoid redundant AI calls with built-in caching:

```typescript
import { configureAIProps, configureCache, clearCache } from 'ai-props'

// Global configuration
configureAIProps({
  model: 'gpt-4',
  cache: true,
  cacheTTL: 5 * 60 * 1000,  // 5 minutes
})

// Or configure cache directly
configureCache(10 * 60 * 1000)

// Clear when needed
clearCache()
```

### Cache Implementations

```typescript
import { MemoryPropsCache, LRUPropsCache } from 'ai-props'

// Simple memory cache
const memCache = new MemoryPropsCache(5 * 60 * 1000)

// LRU cache with max entries
const lruCache = new LRUPropsCache(100, 5 * 60 * 1000)

lruCache.set('key', { name: 'John' })
const entry = lruCache.get<{ name: string }>('key')
```

---

## Schema Type Hints

Use type hints in your schema strings for precise generation:

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

---

## Configuration

```typescript
import { configureAIProps, getConfig, resetConfig } from 'ai-props'

configureAIProps({
  model: 'sonnet',
  cache: true,
  cacheTTL: 300000,
  system: 'Generate realistic, contextual content',
  generate: async (schema, context) => {
    // Custom generation logic
    return { /* props */ }
  },
})

const config = getConfig()
resetConfig()
```

---

## TypeScript Reference

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

---

## What You Achieve

With `ai-props`, you:

- **Ship faster** - No more inventing placeholder content
- **Stay consistent** - AI generates contextually appropriate props
- **Type safely** - Full TypeScript inference throughout
- **Cache intelligently** - Avoid redundant AI calls
- **Scale effortlessly** - Batch generation for multiple items

Your components become smarter. Your development becomes faster. Your content becomes consistent.

---

## License

MIT
