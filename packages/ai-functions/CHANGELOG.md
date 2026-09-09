# ai-functions

## 2.5.0

### Minor Changes

- d574ed8: ai-functions: `runInSandbox` follows ai-evaluate 3.0 - `env.loader` only, Node >= 22 for the Node fallback (aip-263g.12)

  Release decision (aip-263g.12, integrator): only `ai-evaluate` takes the 3.0.0
  major; it leaves the fixed changeset group so the other 17 packages are not
  cascaded to a new major. `ai-functions` therefore ships this under a minor,
  but the first two items below change behaviour for callers that used the
  `LOADER` / `TEST` aliases or ran the Node fallback on Node < 22 - read them
  as breaking for those callers.

  - **Breaking:** `runInSandbox(options, env)` - and so `DefinedFunction.call`
    and `generateAndRunCode` with an `env` - switches on `env.loader` only; the
    uppercase `LOADER` / `TEST` aliases ai-evaluate 2.x accepted are gone, and
    an env carrying only `LOADER` takes the Node fallback instead of the
    Dynamic Workers loader. Rename the wrangler binding to `loader`.
  - **Breaking:** the Node fallback runs on `ai-evaluate/node`'s Miniflare 5
    host, which requires **Node >= 22** (Miniflare 5 is skipped at install time
    on older Node; the first sandboxed call then fails with
    `MINIFLARE_UNAVAILABLE_ERROR`). Every package that depends on
    `ai-functions` inherits that floor on Node.
  - The Node fallback now holds its own `createLocalRuntime()` handle rather
    than the process-wide host: `disposeSandbox()` tears down only the host
    ai-functions created, and the next sandboxed call starts a fresh one. A
    process still exits on its own without calling it (an idle host is unref'd).

- b2c1c83: ai-functions: `disposeSandbox()` releases the Miniflare host behind the Node sandbox fallback

  The Node fallback in `runInSandbox` uses the process-wide host from
  `ai-evaluate/node`, which is unref'd while idle so a process exits on its own
  without any teardown. `disposeSandbox()` shuts it down early (test teardown)
  and is a no-op if the Node entry was never used.

### Patch Changes

- Updated dependencies [d574ed8]
- Updated dependencies [3111c86]
- Updated dependencies [b97d038]
- Updated dependencies [9ba30c2]
- Updated dependencies [eb9ec75]
- Updated dependencies [2d48c58]
- Updated dependencies [b907460]
- Updated dependencies [0f7dd9e]
- Updated dependencies [21a77e7]
- Updated dependencies [bd4697a]
- Updated dependencies [5c4c588]
- Updated dependencies [815a9ce]
- Updated dependencies [aef9570]
- Updated dependencies [fbad990]
- Updated dependencies [db0ede1]
- Updated dependencies [f9a8899]
- Updated dependencies [93803c4]
  - ai-evaluate@3.0.0
  - @org.ai/types@2.5.0
  - ai-workflows@2.5.0
  - ai-providers@2.5.0
  - language-models@2.5.0

## 2.4.0

### Minor Changes

- 4d58f5f: Route ALL dynamic code execution in `ai-functions` through `ai-evaluate`'s
  V8-isolate sandbox (Cloudflare Dynamic Workers, Miniflare fallback in Node), and
  ban `new Function`/`eval`.

  - **ai-evaluate fix:** the loaded-worker binding now passes under the Dynamic
    Workers loader-factory `env:` field (was `bindings:`), so the loaded worker's
    `env.TEST` resolves and the tests/SDK eval path works. Both `loader.get`
    callbacks are annotated `Promise<WorkerCode>` so a `bindings:` typo fails
    typecheck.
  - **Path A — `type: 'code'` stays deterministic, no model:** `handler` is a
    direct call (unchanged); inline `code` now runs via `evaluate({ script })`
    instead of `new Function` (JSON-serializable args only).
  - **Path B — new `generateAndRunCode`:** the non-deterministic generate → run →
    test → return capability. A model authors code, the sandbox runs and tests it,
    and the executed result is returned. Separate from `type: 'code'` so
    determinism is never blurred; string-only `generateCode()` is retained.
  - An optional `env` (host Workers env carrying `LOADER` + `TEST`) threads through
    `DefinedFunction.call(args, env?)` and `generateAndRunCode(def, args, env?)`;
    when absent, execution falls back to the Miniflare-backed Node runtime.

  `ai-functions` now depends on `ai-evaluate` (`workspace:^`). Both packages are in
  the fixed-version group, so this minor bump cascades across the group.

### Patch Changes

- Updated dependencies [4d58f5f]
  - ai-evaluate@2.4.0
  - @org.ai/types@2.4.0
  - ai-providers@2.4.0
  - language-models@2.4.0

## 2.3.0

### Minor Changes

- 9e2779a: Make `kind: 'code'` deterministic.

  Previously `defineFunction({ type: 'code' })` LLM-**generated** code at call time. A `CodeFunctionDefinition` now carries a deterministic `handler: (input) => output` (or an inline `code` string body), and `executeCodeFunction` runs it with **no model in the call path**. This aligns `Code` with the documented "Code = deterministic" contract (a fetch/transform/rule handler), keeping `Generative` / `Agentic` / `Human` semantics intact.

  The code-**authoring** behavior (have a model write code) is preserved but moved to an explicit, opt-in path so the change is not silent:

  - New `generateCode(definition, args)` export — returns generated source as a string.
  - New `CodeGenerationDefinition` type for that path.
  - `define.code(...)` now defines a deterministic handler function.
  - Auto-define (`define(name, args)`) authors a self-contained body once at define time and carries it as an inline `code` body, so the resulting function is deterministic on every call.
  - The `generate('code', prompt)` primitive is unchanged (a string-prompt code-authoring helper, distinct from the `FunctionDefinition` union).

  `CodeFunctionDefinition` drops `includeTests` / `includeExamples` (relocated to `CodeGenerationDefinition`). The four `*FunctionDefinition` shapes and the `FunctionDefinition` union remain source-compatible for consumers binding to the type surface.

### Patch Changes

- Updated dependencies [2787830]
  - language-models@2.3.0
  - ai-providers@2.3.0
  - @org.ai/types@2.3.0

## 2.2.0

### Minor Changes

- Make `kind: 'code'` deterministic. A `CodeFunctionDefinition` now carries a
  deterministic `handler: (input) => output` (or an inline `code` string body)
  and `executeCodeFunction` runs it with **no model in the call path** — the
  documented "Code = deterministic" contract. The previous call-time code
  _generation_ behavior is preserved but moved to an explicit opt-in path: the
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
