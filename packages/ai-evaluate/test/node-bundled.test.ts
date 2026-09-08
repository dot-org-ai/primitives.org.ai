/**
 * Bundled-consumer contract for `ai-evaluate/node`.
 *
 * A consumer that bundles `ai-evaluate/node` into a single file (a tsx/esbuild/
 * rollup CLI, a Next server bundle) has no `dist/host-worker.js` next to that
 * file, and `import.meta.url` points at the consumer's artifact. The published
 * package therefore embeds the host worker modules at build time
 * (`scripts/build-host-worker.ts` -> `dist/host-worker-modules.js`).
 *
 * vitest runs against `src/`, where the embed is a placeholder, so this test
 * performs the real build into a scratch directory, bundles `dist/node.js`
 * into a lone file the way a consumer would, and runs that file from an
 * unrelated cwd.
 */

import { execFile } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { build } from 'vite'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const execFileAsync = promisify(execFile)

const here = dirname(fileURLToPath(import.meta.url))
const packageDir = join(here, '..')
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')

/** tsc emit + embed + Vite bundle: a few seconds; generous for CI */
const BUILD_BOUND_MS = 90_000
/** Host startup + two evaluations in the child */
const RUN_BOUND_MS = 30_000

let scratch: string
let distDir: string
let consumerDir: string

interface Report {
  plain: { success: boolean; value?: unknown; error?: string }
  jsx: { success: boolean; value?: unknown; error?: string }
}

beforeAll(async () => {
  scratch = mkdtempSync(join(tmpdir(), 'ai-evaluate-bundled-'))
  distDir = join(scratch, 'dist')
  consumerDir = join(scratch, 'consumer')
  // `miniflare` stays external to the consumer bundle; let the scratch tree
  // resolve it from this package's node_modules.
  symlinkSync(join(packageDir, 'node_modules'), join(scratch, 'node_modules'), 'dir')

  // 1. The package build, from the current source, into the scratch dist
  await execFileAsync(process.execPath, [tsc, '-p', 'tsconfig.json', '--outDir', distDir], {
    cwd: packageDir,
  })
  await execFileAsync(
    process.execPath,
    ['--import', 'tsx', join(packageDir, 'scripts', 'build-host-worker.ts'), distDir],
    { cwd: packageDir }
  )

  // 2. A consumer bundling `ai-evaluate/node` (dist/node.js) into one file
  await build({
    configFile: false,
    logLevel: 'warn',
    root: scratch,
    build: {
      ssr: join(distDir, 'node.js'),
      outDir: consumerDir,
      emptyOutDir: true,
      minify: false,
      target: 'esnext',
      rollupOptions: {
        external: ['miniflare', /^node:/],
        output: { entryFileNames: 'ai-evaluate-node.mjs', inlineDynamicImports: true },
      },
    },
    ssr: { target: 'node' },
  })

  writeFileSync(
    join(consumerDir, 'main.mjs'),
    `import { evaluate, dispose } from './ai-evaluate-node.mjs'
const plain = await evaluate({ script: 'return 1 + 1' })
const jsx = await evaluate({
  module: 'function h(tag, props, ...children) { return { tag, children } }\\nexports.render = () => <b>hi</b>',
  script: 'return render()',
})
console.log(JSON.stringify({ plain, jsx }))
await dispose()
`
  )
}, BUILD_BOUND_MS)

afterAll(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true })
})

describe('ai-evaluate/node as a bundled consumer', () => {
  it('the build embeds the dist host worker graph into dist/host-worker-modules.js', async () => {
    const file = join(distDir, 'host-worker-modules.js')
    expect(readFileSync(file, 'utf8')).toContain('export const EMBEDDED_HOST_WORKER = {')
    expect(readdirSync(distDir)).not.toContain('host-worker-modules.js.map')

    const { EMBEDDED_HOST_WORKER } = (await import(pathToFileURL(file).href)) as {
      EMBEDDED_HOST_WORKER: { mainModule: string; modules: Record<string, string> }
    }
    expect(EMBEDDED_HOST_WORKER.mainModule).toBe('host-worker.js')
    const names = Object.keys(EMBEDDED_HOST_WORKER.modules)
    expect(names).toEqual(
      expect.arrayContaining(['host-worker.js', 'evaluate.js', 'transform-bundle.js'])
    )
    expect(names).not.toContain('node.js')
    expect(names).not.toContain('host-modules.js')
    // Byte-for-byte the dist/ modules a wrangler deploy of host-worker.js ships
    for (const name of names) {
      expect(EMBEDDED_HOST_WORKER.modules[name]).toBe(
        readFileSync(join(distDir, ...name.split('/')), 'utf8')
      )
    }
  })

  it(
    'a lone bundle of dist/node.js evaluates (incl. JSX) from an unrelated cwd',
    async () => {
      // Nothing to find beside the bundle: a disk walk would fail here
      expect(readdirSync(consumerDir).sort()).toEqual(['ai-evaluate-node.mjs', 'main.mjs'])

      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        [join(consumerDir, 'main.mjs')],
        { cwd: tmpdir(), timeout: RUN_BOUND_MS, killSignal: 'SIGTERM' }
      )
      expect(stderr).not.toMatch(/ERR_MODULE_NOT_FOUND|ENOENT/)
      const report = JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as Report

      expect(report.plain.error).toBeUndefined()
      expect(report.plain.success).toBe(true)
      expect(report.plain.value).toBe(2)

      expect(report.jsx.error).toBeUndefined()
      expect(report.jsx.value).toEqual({ tag: 'b', children: ['hi'] })
    },
    RUN_BOUND_MS + 5_000
  )
})
