#!/usr/bin/env npx tsx
/**
 * Bundle sucrase into `src/transform-bundle.ts`.
 *
 * `src/transform.ts` runs the JSX/TypeScript transform inside the same worker
 * that runs `evaluate()` (workerd in production, the Miniflare host worker
 * locally), so the transformer must be plain ESM with no Node or package
 * imports. This script bundles `sucrase` (pure JS) with Vite/Rollup into one
 * self-contained module and checks it in, the same way `capnweb-bundle.ts`
 * embeds capnweb. Re-run it after bumping the sucrase devDependency:
 *
 *   npx tsx scripts/build-transform-bundle.ts
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const rootDir = join(here, '..')
const entry = join(here, 'transform-bundle-entry.ts')
const outFile = join(rootDir, 'src', 'transform-bundle.ts')

const sucraseVersion = (
  JSON.parse(readFileSync(join(rootDir, 'node_modules', 'sucrase', 'package.json'), 'utf-8')) as {
    version: string
  }
).version

const output = await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    write: false,
    minify: true,
    target: 'es2022',
    lib: { entry, formats: ['es'], fileName: () => 'transform-bundle.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})

const outputs = Array.isArray(output) ? output : [output]
const chunk = outputs
  .flatMap((o) => ('output' in o ? o.output : []))
  .find((item) => item.type === 'chunk' && item.isEntry)
if (!chunk || chunk.type !== 'chunk') throw new Error('Vite produced no entry chunk for sucrase')

const code = chunk.code.trim()
// The bundle must be self-contained: anything left as an import would resolve
// against the worker's module graph, where no packages exist.
if (chunk.imports.length > 0) {
  throw new Error(`sucrase bundle still imports: ${chunk.imports.join(', ')}`)
}
// sucrase's own output templates mention `require(`; only a live reference to
// the Node process object would break inside workerd.
if (/\bprocess\.(env|version|platform)\b/.test(code)) {
  throw new Error('sucrase bundle references the Node process object')
}

const header = `/**
 * Bundled sucrase transformer for src/transform.ts
 *
 * GENERATED FILE - do not edit. Regenerate with:
 *   npx tsx scripts/build-transform-bundle.ts
 *
 * Embeds sucrase@${sucraseVersion} (MIT, https://github.com/alangpierce/sucrase) as a
 * self-contained ES module so the JSX/TypeScript transform runs inside the
 * worker that runs evaluate(), with no Node-side compiler.
 */
/* eslint-disable */
// @ts-nocheck
`

writeFileSync(outFile, `${header}${code}\n`)
console.log(`  -> src/transform-bundle.ts (sucrase@${sucraseVersion}, ${code.length} bytes)`)
