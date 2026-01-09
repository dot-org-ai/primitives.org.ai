---
"ai-functions": patch
"ai-workflows": patch
"ai-database": patch
"@primitives/types": patch
---

Add TDD RED phase tests for type system unification

- ai-functions: Add tests for AIFunction<Output, Input> generic order flip
- ai-workflows: Add tests for EventHandler<TOutput, TInput> order and OnProxy/EveryProxy autocomplete
- ai-database: Existing package - no changes in this release
- @primitives/types: New shared types package with failing tests for RED phase

These tests document the expected behavior for the GREEN phase implementation where generic type parameters will be reordered to put Output first (matching Promise<T> convention).
