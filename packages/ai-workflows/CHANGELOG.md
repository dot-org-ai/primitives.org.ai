# ai-workflows

## 2.1.3

### Patch Changes

- Documentation and testing improvements
  - Add deterministic AI testing suite with self-validating patterns
  - Apply StoryBrand narrative to all package READMEs
  - Update TESTING.md with four principles of deterministic AI testing
  - Fix duplicate examples package name conflict

## 2.1.1

### Patch Changes

- 6beb531: Add TDD RED phase tests for type system unification
  - ai-functions: Add tests for AIFunction<Output, Input> generic order flip
  - ai-workflows: Add tests for EventHandler<TOutput, TInput> order and OnProxy/EveryProxy autocomplete
  - ai-database: Existing package - no changes in this release
  - @org.ai/types: New shared types package with failing tests for RED phase

  These tests document the expected behavior for the GREEN phase implementation where generic type parameters will be reordered to put Output first (matching Promise<T> convention).

## 2.0.3

### Patch Changes

- Updated dependencies
  - rpc.do@0.2.0

## 2.0.2

## 2.0.1
