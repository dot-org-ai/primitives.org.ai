---
'ai-evaluate': patch
---

ai-evaluate: `ai-evaluate/node` embeds the host worker at build time, so it survives being bundled

`loadHostWorker()` located `dist/host-worker.js` and its imports beside
`dist/node.js` via `import.meta.url`. A consumer that bundled `ai-evaluate/node`
into its own artifact (a single-file CLI, a Next server bundle) had no such
sibling and failed on the first `evaluate()`.

- `scripts/build-host-worker.ts` (part of `npm run build`, after `tsc`) walks
  the emitted `dist/host-worker.js` graph once and writes the module map into
  `dist/host-worker-modules.js`; `loadHostWorker()` uses that embedded map and
  only falls back to the disk walk (`walkHostWorker()`) where the embed is the
  `src/` placeholder (vitest, `tsc --watch`).
- New test builds a scratch `dist/`, bundles `dist/node.js` into a lone file
  with Vite the way a consumer would, and runs it from an unrelated cwd.
- Fix: `dispose()` on an idle host re-attaches the host's handles for the
  duration of teardown. Previously an `await dispose()` at the tail of a script
  exited with Node's "unsettled top-level await" (code 13) because the idle
  host's unref'd handles let the loop drain before Miniflare had finished.
