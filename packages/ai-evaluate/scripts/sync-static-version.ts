#!/usr/bin/env npx tsx
/**
 * Keep `src/version.ts` (`VERSION`, re-exported by `ai-evaluate` and
 * `ai-evaluate/static`) equal to `package.json`'s `version`.
 *
 * `changeset version` bumps `package.json` but knows nothing about the source
 * constant, so the root `version-packages` script runs this right after it.
 * `test/static.test.ts` fails when the two drift.
 *
 *   npx tsx scripts/sync-static-version.ts        # rewrite src/version.ts
 *   npx tsx scripts/sync-static-version.ts --check  # exit 1 if it would change
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The line that carries the constant */
const VERSION_LINE = /^export const VERSION = '([^']*)'$/m

/** Rewrite the `VERSION` constant in `source` to `version`; throws if there is none */
export function syncVersionSource(source: string, version: string): string {
  if (!VERSION_LINE.test(source)) {
    throw new Error("src/version.ts has no `export const VERSION = '...'` line")
  }
  return source.replace(VERSION_LINE, `export const VERSION = '${version}'`)
}

/** The `VERSION` a version.ts source declares, or null */
export function declaredVersion(source: string): string | null {
  return source.match(VERSION_LINE)?.[1] ?? null
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
  const versionPath = join(rootDir, 'src', 'version.ts')
  const { version } = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8')) as {
    version: string
  }
  const source = readFileSync(versionPath, 'utf-8')
  const synced = syncVersionSource(source, version)
  if (synced === source) {
    console.log(`src/version.ts already at ${version}`)
  } else if (process.argv.includes('--check')) {
    console.error(`src/version.ts declares ${declaredVersion(source)}, package.json is ${version}`)
    process.exit(1)
  } else {
    writeFileSync(versionPath, synced)
    console.log(`src/version.ts: ${declaredVersion(source)} -> ${version}`)
  }
}
