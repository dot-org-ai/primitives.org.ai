/**
 * `ai-evaluate/static` and the package version.
 *
 * `VERSION` (src/version.ts, re-exported by `ai-evaluate` and
 * `ai-evaluate/static`) must equal `package.json`'s `version`: 2.x shipped
 * `2.1.8` from a 2.4.0 package. `changeset version` does not touch source,
 * so the root `version-packages` script runs `scripts/sync-static-version.ts`
 * after it; this suite is what fails when the two drift.
 */
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { VERSION as ROOT_VERSION } from '../src/index.js'
import {
  VERSION,
  SCAFFOLD_TEMPLATE,
  WORKER_TEMPLATE,
  buildWorkerTemplate,
} from '../src/static/index.js'
import { syncVersionSource, declaredVersion } from '../scripts/sync-static-version.js'

const packageDir = resolve(import.meta.dirname, '..')

async function packageVersion(): Promise<string> {
  const pkg = JSON.parse(await readFile(resolve(packageDir, 'package.json'), 'utf8')) as {
    version: string
  }
  return pkg.version
}

describe('VERSION', () => {
  it('equals package.json version', async () => {
    expect(VERSION).toBe(await packageVersion())
  })

  it('is the same constant on the main entry', () => {
    expect(ROOT_VERSION).toBe(VERSION)
  })

  it('is a release version, not a stale hardcoded one', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/)
    expect(VERSION).not.toBe('2.1.8')
  })

  it('is stamped into the static templates', () => {
    expect(SCAFFOLD_TEMPLATE).toContain(`// Version: ${VERSION}`)
    expect(WORKER_TEMPLATE).toContain(`// Version: ${VERSION}`)
  })

  it('src/version.ts declares it (what the sync script rewrites)', async () => {
    const source = await readFile(resolve(packageDir, 'src', 'version.ts'), 'utf8')
    expect(declaredVersion(source)).toBe(VERSION)
  })
})

describe('scripts/sync-static-version', () => {
  it('rewrites the VERSION line and nothing else', () => {
    const source = "/** doc */\nexport const VERSION = '2.4.0'\n"
    expect(syncVersionSource(source, '3.0.0')).toBe("/** doc */\nexport const VERSION = '3.0.0'\n")
  })

  it('is a no-op when already in sync', async () => {
    const source = await readFile(resolve(packageDir, 'src', 'version.ts'), 'utf8')
    expect(syncVersionSource(source, await packageVersion())).toBe(source)
  })

  it('refuses a source without the constant', () => {
    expect(() => syncVersionSource('export const OTHER = 1\n', '3.0.0')).toThrow(/VERSION/)
  })
})

describe('buildWorkerTemplate', () => {
  it('dev: true is the embedded test runner (no separate dev template in 3.0)', () => {
    const rpc = buildWorkerTemplate({ tests: 'it("t", () => {})' })
    const embedded = buildWorkerTemplate({ tests: 'it("t", () => {})', dev: true })
    expect(rpc).toContain('__env__.TEST')
    expect(embedded).not.toContain('__env__.TEST')
  })
})
