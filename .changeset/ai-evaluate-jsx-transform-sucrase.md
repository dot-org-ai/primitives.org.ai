---
'ai-evaluate': minor
---

ai-evaluate: JSX/TypeScript transform runs inside the worker (bundled sucrase); no esbuild

`evaluate()` now transforms `module`, `tests` and `script` from JSX/TypeScript to
JavaScript itself, before generating worker code, using sucrase bundled into the
package (`src/transform-bundle.ts`). The transform therefore runs wherever
`evaluate()` runs - Cloudflare in production, the Miniflare host worker locally -
so JSX works identically on both paths and the content-addressed sandbox id
hashes the source that actually runs.

- New `jsx?: { factory?, fragment?, importSource? }` on `EvaluateOptions`
  (default `h` / `Fragment`, classic runtime; `importSource` selects the
  automatic runtime). Plain JavaScript passes through byte-identical.
- New exports: `transformSource`, `transformOptions`, `containsJSX`, `JSXOptions`.
- `esbuild` is gone from `optionalDependencies`. `ai-evaluate/node` no longer
  bundles the host worker at runtime: `loadHostWorker()` (replaces
  `bundleHostWorker()`) collects `host-worker` and its imports as plain ES
  modules for Miniflare - from `dist/` when installed, from `src/` (types
  stripped by the same sucrase) under vitest.
