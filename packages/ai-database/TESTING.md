# Testing Guide for ai-database

## Quick Start

```bash
# Run all tests
pnpm test

# Run once (non-watch mode)
pnpm test run

# Run specific test file
pnpm test src/schema.test.ts

# Build and test together
pnpm build && pnpm test run
```

## Test Structure

```
ai-database/
├── src/
│   ├── index.test.ts              # Integration tests (47 tests)
│   ├── memory-provider.test.ts    # Provider tests (81 tests)
│   ├── schema.test.ts             # Schema parsing (89 tests)
│   ├── actions.test.ts            # Action tests (37 tests)
│   ├── events.test.ts             # Event tests (18 tests)
│   └── __tests__/
│       ├── schema-validation.test.ts  # Schema validation (57 tests)
│       └── nl-queries.test.ts         # NL queries (24 tests)
├── test/
│   ├── security.test.ts           # Security tests (64 tests)
│   ├── edge-cases.test.ts         # Edge cases (43 tests)
│   ├── provider-resolution.test.ts # URL parsing (38 tests)
│   ├── generation-*.test.ts       # AI generation tests
│   ├── cascade-*.test.ts          # Cascade tests
│   └── ...                        # 40+ additional test files
├── vitest.config.ts               # Test configuration
├── TEST_SUMMARY.md                # Comprehensive summary
└── TESTING.md                     # This file
```

**Total**: 1,409 tests across 50 files

## Test Categories

### Core Unit Tests (353 tests)
- `src/schema.test.ts` - Schema parsing and validation (89 tests)
- `src/memory-provider.test.ts` - Provider implementation (81 tests)
- `src/__tests__/schema-validation.test.ts` - Schema validation (57 tests)
- `src/index.test.ts` - Full DB API with typed operations (47 tests)
- `src/actions.test.ts` - Action handling (37 tests)
- `src/__tests__/nl-queries.test.ts` - Natural language queries (24 tests)
- `src/events.test.ts` - Event system (18 tests)

### Schema & Type Tests (230 tests)
- `test/regex-bypass.test.ts` - Regex bypass handling (89 tests)
- `test/verb-derivation.test.ts` - Verb derivation (63 tests)
- `test/value-generator.test.ts` - Value generation (44 tests)
- `test/type-safety.test.ts` - Type safety (33 tests)
- `test/wrapEntityOperations-types.test.ts` - Entity operation types (34 tests)

### Security Tests (64 tests)
- `test/security.test.ts` - Security scenarios (64 tests)

### AI Generation Tests (154 tests)
- `test/generation-context.test.ts` - Generation context (40 tests)
- `test/instructions-resolution.test.ts` - Instructions resolution (29 tests)
- `test/two-phase.test.ts` - Two-phase generation (19 tests)
- `test/integration-e2e.test.ts` - End-to-end integration (19 tests)
- `test/generation-integration.test.ts` - Generation integration (9 tests)
- `test/forward-exact.test.ts` - Forward exact matching (14 tests)
- `test/forward-fuzzy.test.ts` - Forward fuzzy matching (15 tests)
- `test/backward-exact.test.ts` - Backward exact matching (14 tests)
- `test/backward-fuzzy.test.ts` - Backward fuzzy matching (16 tests)

### Cascade & Relationship Tests (103 tests)
- `test/cascade.test.ts` - Cascade operations (17 tests)
- `test/cascade-integration.test.ts` - Cascade integration (11 tests)
- `test/cascade-errors.test.ts` - Cascade error handling (11 tests)
- `test/schema/dependency-graph.test.ts` - Dependency graphs (34 tests)
- `test/edge-direction.test.ts` - Edge direction (16 tests)
- `test/relation-operators.test.ts` - Relation operators (9 tests)
- `test/blog-cascade-pattern.test.ts` - Blog cascade patterns (5 tests)

### Union Type Tests (85 tests)
- `test/union-fallback-integration.test.ts` - Union fallback integration (35 tests)
- `test/schema/union-fallback.test.ts` - Union fallback (32 tests)
- `test/union-types.test.ts` - Union types (18 tests)

### Search & Query Tests (132 tests)
- `test/modules/nl-query.test.ts` - NL query module (32 tests)
- `test/modules/entity-operations.test.ts` - Entity operations (26 tests)
- `test/semantic-search.test.ts` - Semantic search (19 tests)
- `test/nl-queries-integration.test.ts` - NL queries integration (18 tests)
- `test/search-utils.test.ts` - Search utilities (18 tests)
- `test/embedding-config.test.ts` - Embedding config (9 tests)
- `test/embeddings-integration.test.ts` - Embeddings integration (12 tests)

### System & Edge Case Tests (131 tests)
- `test/edge-cases.test.ts` - Edge cases (43 tests)
- `test/digital-objects-integration.test.ts` - Digital objects integration (42 tests)
- `test/provider-resolution.test.ts` - DATABASE_URL parsing (38 tests)
- `test/seed-loading.test.ts` - Seed loading (20 tests)
- `test/validation-error.test.ts` - Validation errors (15 tests)
- `test/error-handling.test.ts` - Error handling (8 tests)
- `test/context.test.ts` - Context propagation (11 tests)

### Other Tests (157 tests)
- `test/schema-operators.test.ts` - Schema operators (17 tests)
- `test/batch-loading.test.ts` - Batch loading (13 tests)
- `test/forward-fuzzy-integration.test.ts` - Forward fuzzy integration (12 tests)
- `test/backward-fuzzy-integration.test.ts` - Backward fuzzy integration (13 tests)

## Writing New Tests

### Basic Test Pattern

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'

describe('feature name', () => {
  beforeEach(() => {
    // Reset state for each test
    setProvider(createMemoryProvider())
  })

  it('does something', async () => {
    const schema = {
      User: { name: 'string' },
    } as const

    const db = DB(schema)

    const user = await db.User.create('id', { name: 'Test' })

    expect(user.name).toBe('Test')
  })
})
```

### Testing Schemas

```typescript
import { parseSchema } from '../src/schema.js'
import type { DatabaseSchema } from '../src/schema.js'

it('parses schema correctly', () => {
  const schema: DatabaseSchema = {
    Post: {
      title: 'string',
      author: 'Author.posts',
    },
    Author: {
      name: 'string',
    },
  }

  const parsed = parseSchema(schema)

  expect(parsed.entities.size).toBe(2)

  const author = parsed.entities.get('Author')
  expect(author!.fields.has('posts')).toBe(true) // Auto-created backref
})
```

### Testing CRUD Operations

```typescript
it('creates and retrieves entity', async () => {
  const db = DB(schema)

  // Create
  const created = await db.User.create('john', {
    name: 'John',
    email: 'john@example.com',
  })

  expect(created.$id).toBe('john')

  // Get
  const retrieved = await db.User.get('john')

  expect(retrieved?.name).toBe('John')

  // Update
  const updated = await db.User.update('john', {
    name: 'Jane',
  })

  expect(updated.name).toBe('Jane')
  expect(updated.email).toBe('john@example.com') // Preserved

  // Delete
  const deleted = await db.User.delete('john')

  expect(deleted).toBe(true)
  expect(await db.User.get('john')).toBeNull()
})
```

### Testing Relationships

```typescript
it('manages relationships', async () => {
  const db = DB(schema)
  const provider = createMemoryProvider()
  setProvider(provider)

  await db.User.create('user1', { name: 'User 1' })
  await db.Post.create('post1', { title: 'Post 1' })

  // Create relation
  await provider.relate('User', 'user1', 'posts', 'Post', 'post1')

  // Query related
  const posts = await provider.related('User', 'user1', 'posts')

  expect(posts).toHaveLength(1)
  expect(posts[0]?.$id).toBe('post1')

  // Remove relation
  await provider.unrelate('User', 'user1', 'posts', 'Post', 'post1')

  const afterUnrelate = await provider.related('User', 'user1', 'posts')
  expect(afterUnrelate).toHaveLength(0)
})
```

### Testing Search

```typescript
it('searches entities', async () => {
  const db = DB(schema)

  await db.Post.create('post1', {
    title: 'TypeScript Guide',
    content: 'Learn TypeScript',
  })

  await db.Post.create('post2', {
    title: 'JavaScript Patterns',
    content: 'Learn JavaScript',
  })

  // Search by keyword
  const results = await db.Post.search('TypeScript')

  expect(results).toHaveLength(1)
  expect(results[0]?.title).toContain('TypeScript')

  // Search with options
  const filtered = await db.Post.search('TypeScript', {
    fields: ['title'],
    minScore: 0.5,
  })

  expect(filtered.length).toBeGreaterThan(0)
})
```

## Best Practices

### ✅ DO

- **Use `beforeEach`** to reset state between tests
- **Test one thing** per test case
- **Use descriptive names** like "creates entity with auto-generated ID"
- **Test both success and failure** cases
- **Use type assertions** with `as const` for schemas
- **Clean up** after tests that modify global state

### ❌ DON'T

- **Share state** between tests
- **Use hard-coded delays** (use await instead)
- **Test implementation details** (test behavior)
- **Skip cleanup** in `beforeEach`/`afterEach`
- **Use real databases** in unit tests
- **Write flaky tests** that randomly fail

## Common Patterns

### Testing Optional Fields

```typescript
it('handles optional fields', async () => {
  const schema = {
    User: {
      name: 'string',
      bio: 'string?',
    },
  } as const

  const db = DB(schema)

  // Create without optional field
  const user1 = await db.User.create('user1', {
    name: 'John',
  })

  expect(user1.bio).toBeUndefined()

  // Create with optional field
  const user2 = await db.User.create('user2', {
    name: 'Jane',
    bio: 'Developer',
  })

  expect(user2.bio).toBe('Developer')
})
```

### Testing Error Cases

```typescript
it('throws error when entity exists', async () => {
  const db = DB(schema)
  const provider = createMemoryProvider()
  setProvider(provider)

  await provider.create('User', 'john', { name: 'John' })

  await expect(
    provider.create('User', 'john', { name: 'Jane' })
  ).rejects.toThrow('Entity already exists')
})
```

### Testing Edge Cases

```typescript
it('handles empty results', async () => {
  const db = DB(schema)

  const results = await db.User.list({ where: { age: 999 } })

  expect(results).toEqual([])
})

it('handles large data', async () => {
  const db = DB(schema)

  const largeString = 'x'.repeat(100000)
  const doc = await db.Document.create('doc1', {
    content: largeString,
  })

  expect(doc.content.length).toBe(100000)
})
```

## Debugging Tests

### Run Single Test

```bash
# By file
pnpm test src/schema.test.ts

# By pattern
pnpm test -t "creates entity"
```

### Watch Mode

```bash
pnpm test
# Tests will re-run on file changes
```

### Verbose Output

```bash
pnpm test --reporter=verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["test", "--run", "--no-coverage"],
  "console": "integratedTerminal"
}
```

## Test Coverage

Currently not configured, but can be added:

```bash
# Add to package.json scripts
"test:coverage": "vitest run --coverage"
```

## Continuous Integration

Tests should be run in CI on:
- Pull requests
- Commits to main
- Before releases

Example GitHub Actions:

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test run
```

## Troubleshooting

### Tests Hang

- Check for missing `await` keywords
- Ensure async operations complete
- Add `timeout` to slow tests

### Flaky Tests

- Add `beforeEach` to reset state
- Don't rely on execution order
- Use deterministic test data

### Import Errors

- Check file paths are correct
- Use `.js` extensions for imports
- Verify `vitest.config.ts` is correct

### Type Errors

- Use `as const` for schema definitions
- Add proper type assertions
- Check TypeScript version compatibility

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Test Coverage Guide](https://istanbul.js.org/)

## Summary

The ai-database test suite provides:

- **1,409 comprehensive tests** across **50 test files**
- **100% passing rate**
- **Execution time**: ~50s for tests (5 min with transform/collect)
- **Categories covered**:
  - Core unit tests (353 tests)
  - Schema & type tests (230 tests)
  - Security tests (64 tests)
  - AI generation tests (154 tests)
  - Cascade & relationship tests (103 tests)
  - Union type tests (85 tests)
  - Search & query tests (132 tests)
  - System & edge case tests (131 tests)
  - Other tests (157 tests)

All tests follow consistent patterns and best practices, making it easy to add new tests as features are developed.

*Last updated: 2026-01-15*
