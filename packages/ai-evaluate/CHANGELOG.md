# ai-evaluate

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

## 2.3.0

### Patch Changes

- c858725: Fix worker_loaders API to use getEntrypoint().fetch() instead of worker.fetch()

## 2.1.3

### Patch Changes

- Documentation and testing improvements

  - Add deterministic AI testing suite with self-validating patterns
  - Apply StoryBrand narrative to all package READMEs
  - Update TESTING.md with four principles of deterministic AI testing
  - Fix duplicate examples package name conflict

- Updated dependencies
  - ai-functions@2.1.3
  - ai-tests@2.1.3

## 2.1.1

### Patch Changes

- Updated dependencies [6beb531]
  - ai-functions@2.1.1
  - ai-tests@2.1.1

## 2.0.3

### Patch Changes

- Updated dependencies
  - rpc.do@0.2.0
  - ai-functions@2.0.3
  - ai-tests@2.0.3

## 2.0.2

### Patch Changes

- Updated dependencies
  - ai-functions@2.0.2
  - ai-tests@2.0.2

## 2.0.1

### Patch Changes

- Updated dependencies
  - ai-functions@2.0.1
  - ai-tests@2.0.1
