# ai-functions

## 2.1.3

### Patch Changes

- Documentation and testing improvements
  - Add deterministic AI testing suite with self-validating patterns
  - Apply StoryBrand narrative to all package READMEs
  - Update TESTING.md with four principles of deterministic AI testing
  - Fix duplicate examples package name conflict

- Updated dependencies
  - ai-core@2.1.3
  - ai-providers@2.1.3
  - language-models@2.1.3

## 2.1.1

### Patch Changes

- 6beb531: Add TDD RED phase tests for type system unification
  - ai-functions: Add tests for AIFunction<Output, Input> generic order flip
  - ai-workflows: Add tests for EventHandler<TOutput, TInput> order and OnProxy/EveryProxy autocomplete
  - ai-database: Existing package - no changes in this release
  - @org.ai/types: New shared types package with failing tests for RED phase

  These tests document the expected behavior for the GREEN phase implementation where generic type parameters will be reordered to put Output first (matching Promise<T> convention).
  - ai-providers@2.1.1
  - language-models@2.1.1

## 2.0.3

### Patch Changes

- Updated dependencies
  - rpc.do@0.2.0
  - ai-providers@2.0.3
  - language-models@2.0.3

## 2.0.2

### Patch Changes

- workspace fix
  - ai-providers@2.0.2
  - language-models@2.0.2

## 2.0.1

### Patch Changes

- fixed dependencies
  - ai-providers@2.0.1
  - language-models@2.0.1
