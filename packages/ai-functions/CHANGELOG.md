# ai-functions

## 2.2.0

### Minor Changes

- Make `kind: 'code'` deterministic. A `CodeFunctionDefinition` now carries a
  deterministic `handler: (input) => output` (or an inline `code` string body)
  and `executeCodeFunction` runs it with **no model in the call path** — the
  documented "Code = deterministic" contract. The previous call-time code
  *generation* behavior is preserved but moved to an explicit opt-in path: the
  new `generateCode()` export (+ `CodeGenerationDefinition` type). `define.code`
  now defines a handler; auto-define authors a body once at define time and
  carries it as inline `code`. `Generative` / `Agentic` / `Human` semantics are
  unchanged; the `generate('code', prompt)` primitive is unchanged.
  `CodeFunctionDefinition` drops `includeTests` / `includeExamples` (relocated
  to `CodeGenerationDefinition`).
- Deepen `language-models` with per-model resilience and tier policy data
  (aip-70mk). The `ModelPolicy` MDXLD type (`$type: 'ModelPolicy'`) and
  `policyFor()` derivation layer now live in `language-models`. The runtime
  machinery in `ai-functions` (`RetryPolicy`, `CircuitBreaker`,
  `FallbackChain`) gains `forModel(alias)` factories that read policy from
  the catalog. Default behaviour is preserved when no alias is provided.
- New helpers: `tiersForModel(alias)`, `modelSupportsTier(alias, tier)`,
  re-exported `modelPolicyFor` (alias for `policyFor`).
- New types re-exported: `ModelPolicy`, `BatchTier`, `RetryPolicyData`,
  `CircuitBreakerPolicyData`, `ErrorCategoryName`, `FlexAdapter`.

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
