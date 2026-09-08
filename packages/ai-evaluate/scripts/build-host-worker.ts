#!/usr/bin/env npx tsx
/**
 * Embed the host worker modules into `dist/host-worker-modules.js`.
 *
 * `tsc` emits `src/host-worker-modules.ts` as a placeholder
 * (`EMBEDDED_HOST_WORKER = null`), which makes `loadHostWorker()` read
 * `host-worker.js` and its imports from disk beside `dist/host-modules.js`.
 * That sibling lookup breaks as soon as a consumer bundles `ai-evaluate/node`
 * into its own artifact (a single-file CLI, a Next server bundle):
 * `import.meta.url` then points at the consumer bundle and nothing sits next
 * to it. So this script walks the emitted `dist/host-worker.js` graph once, at
 * build time, and overwrites the placeholder with the real module map. The
 * published package thereby carries the host worker inside its own
 * JavaScript, and a bundler that inlines `ai-evaluate/node` inlines the host
 * worker with it.
 *
 * Runs as part of `npm run build` (after `tsc`). Standalone:
 *
 *   npx tsx scripts/build-host-worker.ts [dist-dir]
 */

import { rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type * as HostModules from '../src/host-modules.js'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(process.argv[2] ?? join(here, '..', 'dist'))

// Use the emitted walker so the module names and contents are exactly what
// `dist/host-modules.js` would collect at runtime from a plain install.
const { HOST_MODULE, walkHostWorker } = (await import(
  pathToFileURL(join(distDir, 'host-modules.js')).href
)) as typeof HostModules

const hostWorker = walkHostWorker()
const names = Object.keys(hostWorker.modules)

// The host is `host-worker -> evaluate` and nothing Node-side
if (hostWorker.mainModule !== HOST_MODULE || !names.includes('evaluate.js')) {
  throw new Error(`host worker walk is missing its entry or evaluate.js: ${names.join(', ')}`)
}
for (const nodeOnly of ['node.js', 'host-modules.js', 'host-worker-modules.js']) {
  if (names.includes(nodeOnly)) {
    throw new Error(`host worker walk pulled in the Node-side module ${nodeOnly}`)
  }
}

const header = `/**
 * Host worker modules for ai-evaluate/node
 *
 * GENERATED FILE - do not edit. Written by scripts/build-host-worker.ts after
 * tsc; the source placeholder is src/host-worker-modules.ts.
 *
 * The \`${hostWorker.mainModule}\` module graph (the same evaluate() that ships
 * to Cloudflare) as \`name -> ESM source\`, so the Miniflare host can be created
 * without reading anything from disk - including from inside a consumer bundle.
 */
`
const outFile = join(distDir, 'host-worker-modules.js')
writeFileSync(
  outFile,
  `${header}export const EMBEDDED_HOST_WORKER = ${JSON.stringify(hostWorker, null, 2)};\n`
)
// tsc's map for the placeholder no longer describes this file
rmSync(`${outFile}.map`, { force: true })

const bytes = Object.values(hostWorker.modules).reduce((sum, code) => sum + code.length, 0)
console.log(`  -> ${outFile} (${names.length} modules, ${bytes} bytes)`)
