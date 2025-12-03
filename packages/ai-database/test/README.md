# ai-database Test Suite

This directory contains comprehensive tests for the ai-database package.

## Test Coverage

### Schema Tests (`src/schema.test.ts`)
- **Primitive fields**: All basic types (string, number, boolean, date, datetime, json, markdown, url)
- **Optional fields**: Fields with `?` modifier
- **Array fields**: Both `[]` syntax and `[type]` literal syntax
- **Relations**: Simple and bi-directional relationships
- **Backref generation**: Automatic creation of inverse relationships
- **Complex schemas**: Multi-entity schemas with various field combinations
- **Type inference**: TypeScript type safety verification

### Memory Provider Tests (`src/memory-provider.test.ts`)
- **CRUD operations**: Create, read, update, delete
- **List and query**: Filtering, sorting, pagination
- **Search**: Full-text search with scoring
- **Relationships**: Creating and querying related entities
- **Concurrency**: Multiple simultaneous operations
- **Utility methods**: `clear()` and `stats()`

### Integration Tests (`src/index.test.ts`)
- **DB factory**: Creating typed database instances
- **Entity operations**: All CRUD methods on typed entities
- **List and pagination**: Query options and result limiting
- **Search**: Entity and global search
- **Relationships**: Managing relations between entities
- **Global methods**: `db.get()` and `db.search()`
- **Type safety**: Verifying TypeScript inference
- **Complex scenarios**: Multi-entity operations and self-referential relations

### Provider Resolution Tests (`test/provider-resolution.test.ts`)
- **URL parsing**: All DATABASE_URL formats
  - In-memory: `:memory:`
  - Filesystem: `./content`
  - SQLite: `sqlite://./content`
  - Turso: `libsql://db.turso.io`
  - ClickHouse (local): `chdb://./content`
  - ClickHouse (remote): `clickhouse://host:8123`
- **Provider initialization**: Memory provider setup
- **Interface compliance**: Ensuring providers implement all required methods
- **Error handling**: Invalid URLs and missing dependencies

### Edge Cases Tests (`test/edge-cases.test.ts`)
- **Empty schemas**: Handling minimal configurations
- **Special characters**: IDs and data with unicode, symbols, paths
- **Large data**: Big strings, many entities, large result sets
- **Concurrent operations**: Parallel creates, updates, and queries
- **Optional fields**: Missing and undefined values
- **Array fields**: Empty arrays and array updates
- **URL parsing**: Various URL formats and edge cases
- **Search edge cases**: Empty queries, special characters, extreme scores
- **Pagination edge cases**: Out-of-bounds offsets, zero/negative limits

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests once (no watch)
pnpm test run

# Run specific test file
pnpm test src/schema.test.ts

# Run with coverage
pnpm test --coverage
```

## Test Statistics

- **Total test files**: 5
- **Total tests**: 174
- **Coverage areas**:
  - Schema parsing and validation
  - In-memory database operations
  - Provider interface compliance
  - Database URL parsing
  - Edge cases and error handling

## Test Patterns

### Using the Memory Provider

```typescript
import { setProvider, createMemoryProvider } from './index.js'

beforeEach(() => {
  setProvider(createMemoryProvider())
})
```

### Testing Schemas

```typescript
const schema = {
  User: {
    name: 'string',
    email: 'string',
  },
} as const

const db = DB(schema)
```

### Testing CRUD Operations

```typescript
// Create
const user = await db.User.create('john', { name: 'John' })

// Read
const retrieved = await db.User.get('john')

// Update
const updated = await db.User.update('john', { name: 'Jane' })

// Delete
const deleted = await db.User.delete('john')
```

### Testing Relationships

```typescript
const provider = createMemoryProvider()
setProvider(provider)

await provider.relate('User', 'john', 'posts', 'Post', 'post1')
const posts = await provider.related('User', 'john', 'posts')
```

## Future Test Additions

Potential areas for additional testing:

1. **Provider Adapters**: Tests for filesystem, SQLite, ClickHouse, etc. (once implemented)
2. **Transactions**: If/when transaction support is added
3. **Performance**: Benchmarks for large datasets
4. **Migrations**: Schema evolution and data migration
5. **Validation**: Runtime validation of data against schema
6. **Indexes**: Index creation and usage
7. **Full-text search**: Advanced search features with real embeddings
8. **Replication**: Multi-provider synchronization

## Notes

- All tests use the in-memory provider for speed and isolation
- Tests are designed to run in parallel safely
- Each test suite is independent and resets state in `beforeEach`
- TypeScript type inference is tested at compile time and runtime
