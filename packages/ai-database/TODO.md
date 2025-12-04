# ai-database TODO

## Core Features

### Natural Language Queries
- [x] Define `NLQueryResult`, `NLQueryFn`, `NLQueryContext`, `NLQueryPlan` types
- [x] Implement `setNLQueryGenerator()` for custom AI integration
- [x] Implement `buildNLQueryContext()` to extract schema metadata
- [x] Implement `executeNLQuery()` with fallback to search
- [x] Add tagged template support for `db\`query\`` syntax
- [ ] Wire up `db.ask` and type-specific NL queries in DB factory
- [ ] Add streaming support for NL query results
- [ ] Add query caching/memoization
- [ ] Add query history/suggestions

### Self-Describing Schema
- [x] Define `ThingSchema`, `NounSchema`, `VerbSchema`, `EdgeSchema`
- [x] Define `SystemSchema` combining all system types
- [ ] Auto-populate Noun records when DB() is called
- [ ] Auto-populate Edge records when relationships are defined
- [ ] Auto-populate Verb records for standard actions
- [ ] Add `db.Noun`, `db.Verb`, `db.Edge` accessors
- [ ] Implement `Thing.type` -> `Noun` relationship
- [ ] Implement `Noun.things` -> all instances backref

### Noun & Verb Types
- [x] Define `Noun`, `NounProperty`, `NounRelationship` interfaces
- [x] Define `Verb` interface with all conjugation forms
- [x] Implement `defineNoun()` and `defineVerb()` helpers
- [x] Implement `nounToSchema()` converter
- [x] Define standard `Verbs` constant (create, update, delete, publish, archive)

### AI-Powered Linguistic Inference
- [x] Basic `conjugate()`, `pluralize()`, `singularize()` with common rules
- [x] Basic `inferNoun()` from type name
- [ ] **Use AI for unknown nouns/verbs** - if not in Things table, ask AI once and cache
- [ ] Remove brittle rule-based code in favor of AI inference
- [ ] Store AI-generated forms in Noun/Verb records for future lookups
- [ ] Add confidence scores to AI-generated linguistic forms

### TypeMeta
- [x] Define `TypeMeta` interface
- [x] Implement `Type()` accessor function
- [x] Include slug/slugPlural for URL generation
- [x] Include event type names (created, updated, deleted)
- [x] Include verb-derived fields (createdAt, createdBy, etc.)

## Provider Implementation

### MemoryProvider
- [x] Implement `Semaphore` for concurrency control
- [x] Implement Event storage and emission
- [x] Implement Action lifecycle management
- [x] Implement Artifact storage with invalidation
- [x] Add pattern matching for event subscriptions
- [ ] Add persistence option (save/load to JSON)
- [ ] Add TTL support for artifacts

> **Note**: Production providers (SQLite, ClickHouse, Postgres, etc.) are implemented in `@mdxdb/*` packages.

## Query Capabilities

### Filtering
- [x] Document SQL-style operators ($gt, $lt, $in, etc.)
- [x] Document Document-style nested queries
- [x] Document Graph-style relationship traversal
- [ ] Implement all documented operators in MemoryProvider
- [ ] Add query validation
- [ ] Add query optimization hints

### Search
- [x] Define SearchOptions interface
- [ ] Implement hybrid search (vector + BM25)
- [ ] Add embedding generation
- [ ] Add chunking for long content
- [ ] Add re-ranking

## Testing

### Unit Tests
- [x] Schema parsing tests
- [x] Noun/Verb type tests
- [x] Basic conjugate/pluralize/singularize tests
- [x] TypeMeta tests
- [x] Semaphore tests
- [x] Event emission tests
- [x] Action lifecycle tests
- [x] Artifact storage tests
- [x] System schema tests
- [x] Edge creation tests
- [ ] NL query execution tests
- [ ] AI linguistic inference tests

### Integration Tests
- [ ] Full CRUD workflow
- [ ] Relationship traversal
- [ ] Event-driven workflows
- [ ] Search accuracy benchmarks

## Documentation

- [x] README: Core primitives
- [x] README: Actions for durable execution
- [x] README: Events for reactivity
- [x] README: Artifacts for caching
- [x] README: Query styles (SQL, Document, Graph)
- [x] README: Natural language queries
- [x] README: Self-describing schema
- [x] README: Noun & Verb types
- [x] README: AI auto-generation
- [ ] API reference with examples
- [ ] Migration guide
- [ ] Performance tuning guide

## Future Ideas

- [ ] Schema migrations
- [ ] Real-time subscriptions (WebSocket)
- [ ] Offline-first with sync
- [ ] Multi-tenancy support
- [ ] Row-level security
- [ ] Audit logging
- [ ] Data lineage tracking
- [ ] Schema versioning
- [ ] Import/export (JSON, CSV, Parquet)
- [ ] GraphQL API generation
- [ ] REST API generation
- [ ] Admin UI
