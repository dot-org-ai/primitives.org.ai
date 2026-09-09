---
'ai-evaluate': minor
---

ai-evaluate: `dependencies` resolved by `@cloudflare/worker-bundler`; real `import` syntax; esm.sh as fallback only (aip-263g.9)

- `EvaluateOptions.dependencies` (package.json style, `{ lodash: '4.17.21' }`)
  lets `module` and `script` import npm packages with ordinary ES module
  syntax (`import { chunk } from 'lodash'`). Static imports are hoisted out of
  the user code to the worker's top level (`hoistImports`).
- Inside workerd, `@cloudflare/worker-bundler` (0.2.3, experimental) installs
  the packages from the npm registry and bundles them with the generated
  entry (new `src/bundler.ts`, `resolveImports`). Bundler warnings are
  surfaced in `result.logs` at `warn` level. Resolved module maps are cached
  by input and installed `node_modules` by dependencies hash, per isolate.
  A package the code imports but does not declare resolves at `latest` with
  a warning.
- `package.json` (a json module carrying the dependencies) joins the
  loaded worker's modules, so `workerCodeId` differs by dependency version.
- esm.sh is now the fallback only: where the bundler cannot load (the
  Miniflare host of `ai-evaluate/node`), when it fails, or with
  `bundler: false`, each dependency is fetched from esm.sh as one bundled
  module and registered under its bare name; the fallback is reported as a
  `warn` log (not under an explicit `bundler: false`).
- `imports` is deprecated: bare specifiers become `dependencies` (and are
  still aliased onto `globalThis` - `lodash` -> `_` - with a one-time
  deprecation warning); URLs are fetched as-is on both paths. `validateOptions`
  accepts bare names (`lodash`, `@scope/pkg@1.0.0`) and http(s) URLs, rejects
  `file:` and malformed names, and validates `dependencies` / `bundler`.
- `ai-evaluate/node` no longer rewrites bare `imports` to esm.sh URLs on the
  Node side; the host worker decides how to resolve them.
- Tests: workers suite imports real lodash through the bundler inside workerd;
  Node suite drives `resolveImports` against a stand-in bundler and the real
  installer against a mocked registry, and witnesses the esm.sh fallback with
  a fetch spy.
