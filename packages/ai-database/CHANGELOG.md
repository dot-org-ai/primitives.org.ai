# ai-database

## 2.1.3

### Patch Changes

- Documentation and testing improvements
  - Add deterministic AI testing suite with self-validating patterns
  - Apply StoryBrand narrative to all package READMEs
  - Update TESTING.md with four principles of deterministic AI testing
  - Fix duplicate examples package name conflict

- Updated dependencies
  - ai-functions@2.1.3

## 2.1.1

### Patch Changes

- 6beb531: Add TDD RED phase tests for type system unification
  - ai-functions: Add tests for AIFunction<Output, Input> generic order flip
  - ai-workflows: Add tests for EventHandler<TOutput, TInput> order and OnProxy/EveryProxy autocomplete
  - ai-database: Existing package - no changes in this release
  - @org.ai/types: New shared types package with failing tests for RED phase

  These tests document the expected behavior for the GREEN phase implementation where generic type parameters will be reordered to put Output first (matching Promise<T> convention).

- Updated dependencies [6beb531]
  - ai-functions@2.1.1

## 2.1.0

### Minor Changes

- **Natural Language Query Execution**: Wire up tagged template literal handler (`db.Lead\`query\``) and `db.ask()`method for natural language database queries. Supports AI-powered query generation via`setNLQueryGenerator()` with fallback to keyword search.

- **Schema Input Validation**: Comprehensive validation for entity names, field names, field types, and operator syntax. Prevents SQL injection, XSS, and provides helpful error messages. Throws `SchemaValidationError` with error codes and paths for programmatic handling.

### Patch Changes

- Fixed TypeScript build error in parse.ts operator validation

## 2.0.3

### Patch Changes

- Updated dependencies
  - rpc.do@0.2.0
  - ai-functions@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies
  - ai-functions@2.0.2

## 2.0.1

### Patch Changes

- fixed dependencies
- Updated dependencies
  - ai-functions@2.0.1
