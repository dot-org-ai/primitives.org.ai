/**
 * Import resolution (`src/bundler.ts`) in the Node pool.
 *
 * `@cloudflare/worker-bundler` bundles only inside workerd (its esbuild-wasm
 * import), so the bundling path proper is witnessed by
 * test/workers/imports.workers.test.ts. Here:
 * - `resolveImports` is driven against a stand-in `createWorker` that
 *   resolves the way the registry would, to pin the files / entry / externals
 *   contract, the merge, the warnings and both caches;
 * - the bundler's real installer is run against a mocked npm registry
 *   (metadata + a tarball built in-test) in transform-only mode, which needs
 *   no esbuild, to show our FileSystem layer satisfies it end to end;
 * - `evaluate()` falls back to esm.sh when the bundler is unavailable or
 *   throws, and with `bundler: false`, with a fetch spy on the URL.
 */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { gzipSync } from 'node:zlib'
import type {
  CreateWorkerOptions,
  CreateWorkerResult,
  FileSystem,
} from '@cloudflare/worker-bundler'
import {
  resolveImports,
  clearBundlerCache,
  overrideBundler,
  loadBundler,
  dependenciesHash,
  MemoryFiles,
  BundlerUnavailableError,
  BUNDLER_ENTRY,
} from '../src/bundler.js'
import {
  evaluate,
  buildWorkerCode,
  buildWorkerCodeWithWarnings,
  planImports,
} from '../src/evaluate.js'
import { PACKAGE_JSON_MODULE } from '../src/shared.js'
import { createLoaderBridge } from './helpers/loader-bridge.js'

const LODASH = { lodash: '4.17.21' }
const ENTRY =
  "import _ from 'lodash'; export default { fetch() { return Response.json(_.chunk([1, 2], 1)) } }"

/**
 * A `createWorker` that behaves like the registry-backed one for lodash:
 * installs `node_modules/lodash/*` into the filesystem it is given (unless
 * already there), then returns the entry with its bare specifier rewritten
 * to the installed file - the shape of the bundler's transform-only output.
 */
function fakeRegistryBundler() {
  const calls: { options: CreateWorkerOptions; hadNodeModules: boolean; files: string[] }[] = []
  const createWorker = async (options: CreateWorkerOptions): Promise<CreateWorkerResult> => {
    const fs = options.files as FileSystem
    const pkg = JSON.parse(fs.read('package.json') ?? '{}') as {
      dependencies?: Record<string, string>
    }
    const hadNodeModules = fs.read('node_modules/lodash/package.json') !== null
    calls.push({ options, hadNodeModules, files: fs.list() })
    const modules: Record<string, string> = {}
    for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
      if (fs.read(`node_modules/${name}/package.json`) === null) {
        fs.write(
          `node_modules/${name}/package.json`,
          JSON.stringify({ name, version, main: 'index.js' })
        )
        fs.write(`node_modules/${name}/index.js`, `export default { name: '${name}@${version}' }`)
      }
      modules[`node_modules/${name}/index.js`] = fs.read(`node_modules/${name}/index.js`)!
    }
    const entryPoint = options.entryPoint ?? 'index.js'
    modules[entryPoint] = (fs.read(entryPoint) ?? '').replace(
      /from\s*'([^'./][^']*)'/g,
      (_m, name: string) => `from './node_modules/${name}/index.js'`
    )
    return { mainModule: entryPoint, modules, warnings: ['fake: flat node_modules'] }
  }
  return { createWorker, calls }
}

describe('resolveImports', () => {
  beforeEach(() => clearBundlerCache())

  it('hands the bundler package.json, the entry and the externals; returns the module map', async () => {
    const { createWorker, calls } = fakeRegistryBundler()
    const result = await resolveImports({
      entry: ENTRY,
      dependencies: LODASH,
      externals: ['capnweb.js'],
      createWorker,
    })

    expect(calls).toHaveLength(1)
    const [{ options, files }] = calls
    expect(options.entryPoint).toBe(BUNDLER_ENTRY)
    expect(options.externals).toEqual(['cloudflare:workers', 'capnweb.js'])
    expect(options.bundle).toBe(true)
    expect(files).toEqual(expect.arrayContaining(['package.json', BUNDLER_ENTRY]))
    expect(JSON.parse((options.files as FileSystem).read('package.json')!)).toEqual({
      dependencies: LODASH,
    })

    expect(result.cached).toBe(false)
    expect(result.mainModule).toBe(BUNDLER_ENTRY)
    expect(Object.keys(result.modules)).toEqual(
      expect.arrayContaining(['node_modules/lodash/index.js', BUNDLER_ENTRY])
    )
    // The entry no longer imports by bare name
    expect(result.modules[BUNDLER_ENTRY]).not.toMatch(/from\s*'lodash'/)
    expect(result.modules[BUNDLER_ENTRY]).toContain("from './node_modules/lodash/index.js'")
    expect(result.warnings).toEqual(['fake: flat node_modules'])
  })

  it('serves an identical request from the resolved cache without calling the bundler', async () => {
    const { createWorker, calls } = fakeRegistryBundler()
    const first = await resolveImports({ entry: ENTRY, dependencies: LODASH, createWorker })
    const again = await resolveImports({ entry: ENTRY, dependencies: LODASH, createWorker })
    expect(calls).toHaveLength(1)
    expect(again.cached).toBe(true)
    expect(again.modules).toEqual(first.modules)
  })

  it('reuses the installed node_modules for a new entry over the same dependencies', async () => {
    const { createWorker, calls } = fakeRegistryBundler()
    await resolveImports({ entry: ENTRY, dependencies: LODASH, createWorker })
    await resolveImports({
      entry: ENTRY.replace('[1, 2]', '[3]'),
      dependencies: LODASH,
      createWorker,
    })
    expect(calls.map((c) => c.hadNodeModules)).toEqual([false, true])
    // The second build's entry replaced the first's; the install was shared
    expect((calls[1]!.options.files as FileSystem).read(BUNDLER_ENTRY)).toContain('[3]')
  })

  it("the shared install carries node_modules only: one build cannot read another build's files", async () => {
    const { createWorker, calls } = fakeRegistryBundler()
    await resolveImports({
      entry: ENTRY,
      dependencies: LODASH,
      files: { 'helper.js': 'export const secret = "tenant-a"' },
      createWorker,
    })
    await resolveImports({
      entry: ENTRY.replace('[1, 2]', '[3]'),
      dependencies: LODASH,
      createWorker,
    })
    const second = calls[1]!.options.files as FileSystem
    expect(calls[1]!.hadNodeModules).toBe(true)
    expect(second.read('helper.js')).toBeNull()
    expect(second.list()).not.toContain('helper.js')
    // ... and the first build's package.json / entry did not leak either
    expect(second.read(BUNDLER_ENTRY)).toContain('[3]')
  })

  it('different dependency versions install separately', async () => {
    const { createWorker, calls } = fakeRegistryBundler()
    await resolveImports({ entry: ENTRY, dependencies: { lodash: '4.17.21' }, createWorker })
    await resolveImports({ entry: ENTRY, dependencies: { lodash: '4.17.20' }, createWorker })
    expect(calls.map((c) => c.hadNodeModules)).toEqual([false, false])
    expect(dependenciesHash({ lodash: '4.17.21' })).not.toBe(
      dependenciesHash({ lodash: '4.17.20' })
    )
    // Key order does not matter
    expect(dependenciesHash({ a: '1', b: '2' })).toBe(dependenciesHash({ b: '2', a: '1' }))
  })

  it('extra files are visible to the bundler beside the entry', async () => {
    const { createWorker, calls } = fakeRegistryBundler()
    await resolveImports({
      entry: "import x from './__external_0__.js'; export default x",
      dependencies: LODASH,
      files: { '__external_0__.js': 'export default 1' },
      createWorker,
    })
    expect((calls[0]!.options.files as FileSystem).read('__external_0__.js')).toBe(
      'export default 1'
    )
  })

  it('propagates a bundler failure', async () => {
    const createWorker = async () => {
      throw new Error('Could not resolve "nope"')
    }
    await expect(
      resolveImports({ entry: ENTRY, dependencies: { nope: '1.0.0' }, createWorker })
    ).rejects.toThrow('Could not resolve "nope"')
  })

  it('is unavailable outside the Workers runtime, without touching the network', async () => {
    overrideBundler(null)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    await expect(loadBundler()).rejects.toBeInstanceOf(BundlerUnavailableError)
    await expect(resolveImports({ entry: ENTRY, dependencies: LODASH })).rejects.toThrow(
      /not the Cloudflare Workers runtime/
    )
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('MemoryFiles (the bundler FileSystem layer)', () => {
  it('reads through to the base, writes and deletes stay in the layer', () => {
    const base = new MemoryFiles(null, { 'node_modules/a/index.js': 'a', 'index.js': 'base' })
    const layer = new MemoryFiles(base, { 'index.js': 'layer' })
    expect(layer.read('index.js')).toBe('layer')
    expect(layer.read('node_modules/a/index.js')).toBe('a')
    expect(layer.list('node_modules/')).toEqual(['node_modules/a/index.js'])
    expect(layer.list().sort()).toEqual(['index.js', 'node_modules/a/index.js'])

    layer.delete('node_modules/a/index.js')
    expect(layer.read('node_modules/a/index.js')).toBeNull()
    expect(layer.list('node_modules/')).toEqual([])
    expect(base.read('node_modules/a/index.js')).toBe('a')

    layer.write('node_modules/a/index.js', 'a2')
    expect(layer.read('node_modules/a/index.js')).toBe('a2')
    expect(base.read('node_modules/a/index.js')).toBe('a')
    expect(layer.hasOwn('node_modules/')).toBe(true)
    expect(base.hasOwn('nope/')).toBe(false)
  })
})

/**
 * A minimal USTAR writer: enough of a tarball for the bundler's installer.
 */
function tarball(files: Record<string, string>): Uint8Array {
  const blocks: Uint8Array[] = []
  const encoder = new TextEncoder()
  for (const [name, content] of Object.entries(files)) {
    const data = encoder.encode(content)
    const header = new Uint8Array(512)
    const put = (offset: number, text: string) => header.set(encoder.encode(text), offset)
    put(0, `package/${name}`)
    put(100, '0000644\0')
    put(108, '0000000\0')
    put(116, '0000000\0')
    put(124, data.length.toString(8).padStart(11, '0') + '\0')
    put(136, '00000000000\0')
    put(148, '        ')
    put(156, '0')
    put(257, 'ustar\0')
    put(263, '00')
    const checksum = header.reduce((sum, byte) => sum + byte, 0)
    put(148, checksum.toString(8).padStart(6, '0') + '\0 ')
    blocks.push(header, data, new Uint8Array((512 - (data.length % 512)) % 512))
  }
  blocks.push(new Uint8Array(1024))
  const out = new Uint8Array(blocks.reduce((n, b) => n + b.length, 0))
  let offset = 0
  for (const block of blocks) {
    out.set(block, offset)
    offset += block.length
  }
  return gzipSync(out)
}

describe('the real installer against a mocked registry (transform-only, no esbuild)', () => {
  const REGISTRY = 'https://registry.example.test'
  const requested: string[] = []

  beforeEach(() => {
    clearBundlerCache()
    requested.length = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input instanceof Request ? input.url : input)
      requested.push(url)
      if (url === `${REGISTRY}/lodash`) {
        return Response.json({
          name: 'lodash',
          'dist-tags': { latest: '4.17.21' },
          versions: {
            '4.17.21': {
              name: 'lodash',
              version: '4.17.21',
              main: 'lodash.js',
              dist: { tarball: `${REGISTRY}/lodash/-/lodash-4.17.21.tgz` },
            },
          },
        })
      }
      if (url === `${REGISTRY}/lodash/-/lodash-4.17.21.tgz`) {
        return new Response(
          tarball({
            'package.json': JSON.stringify({
              name: 'lodash',
              version: '4.17.21',
              main: 'lodash.js',
            }),
            'lodash.js':
              'export const chunk = (a, n) => [a.slice(0, n), a.slice(n)]; export default { chunk }',
          })
        )
      }
      return new Response('not found', { status: 404 })
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('resolves import _ from "lodash" into node_modules/lodash/* modules', async () => {
    const { createWorker } = await import('@cloudflare/worker-bundler')
    const result = await resolveImports({
      entry: ENTRY,
      dependencies: LODASH,
      bundle: false,
      createWorker: (options) => createWorker({ ...options, registry: REGISTRY }),
    })

    expect(requested).toEqual([`${REGISTRY}/lodash`, `${REGISTRY}/lodash/-/lodash-4.17.21.tgz`])
    expect(result.mainModule).toBe(BUNDLER_ENTRY)
    expect(Object.keys(result.modules)).toEqual(
      expect.arrayContaining([BUNDLER_ENTRY, 'node_modules/lodash/lodash.js'])
    )
    expect(result.modules[BUNDLER_ENTRY]).not.toMatch(/from\s*['"]lodash['"]/)
    expect(result.modules[BUNDLER_ENTRY]).toMatch(
      /from\s*['"]\.?\/?node_modules\/lodash\/lodash\.js['"]/
    )
    expect(result.warnings).toEqual([])

    // Second entry over the same dependencies: no registry traffic
    requested.length = 0
    const again = await resolveImports({
      entry: ENTRY.replace('[1, 2]', '[3]'),
      dependencies: LODASH,
      bundle: false,
      createWorker: (options) => createWorker({ ...options, registry: REGISTRY }),
    })
    expect(requested).toEqual([])
    expect(again.modules['node_modules/lodash/lodash.js']).toBe(
      result.modules['node_modules/lodash/lodash.js']
    )
  })
})

describe('evaluate(): esm.sh fallback', () => {
  const bridge = createLoaderBridge()
  const FAKE_LODASH =
    'export const chunk = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out }; export default { chunk }'

  beforeEach(() => {
    clearBundlerCache()
    overrideBundler(null)
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url.startsWith('https://esm.sh/lodash')) return new Response(FAKE_LODASH)
      return new Response('not found', { status: 404 })
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    overrideBundler(null)
  })
  afterAll(() => bridge.dispose())

  const esmShUrls = () =>
    vi
      .mocked(fetch)
      .mock.calls.map(([input]) => String(input instanceof Request ? input.url : input))
      .filter((url) => url.startsWith('https://esm.sh/'))

  it('legacy imports: fetched from esm.sh and exposed as globals when the bundler is unavailable', async () => {
    const result = await evaluate(
      { imports: ['lodash'], script: 'return _.chunk([1, 2], 1)' },
      { loader: bridge.loader }
    )
    expect(result.error).toBeUndefined()
    expect(result.value).toEqual([[1], [2]])
    expect(esmShUrls()).toEqual(['https://esm.sh/lodash?bundle'])
    // The fallback is reported
    expect(result.logs[0]).toMatchObject({ level: 'warn' })
    expect(result.logs[0]?.message).toMatch(/not the Cloudflare Workers runtime.*esm\.sh/)
  })

  it('dependencies + import syntax: each package registered under its bare name', async () => {
    const result = await evaluate(
      {
        module: "import { chunk } from 'lodash'; export const c = chunk([1, 2, 3], 2)",
        script: 'return c',
        dependencies: LODASH,
        bundler: false,
      },
      { loader: bridge.loader }
    )
    expect(result.error).toBeUndefined()
    expect(result.value).toEqual([[1, 2], [3]])
    expect(esmShUrls()).toEqual(['https://esm.sh/lodash@4.17.21?bundle'])
    // bundler: false is a choice, not a fallback: no warning
    expect(result.logs).toEqual([])
    const code = bridge.loaded.at(-1)!
    expect(code.modules['lodash']).toEqual({ js: FAKE_LODASH })
    expect(code.modules[PACKAGE_JSON_MODULE]).toEqual({ json: { dependencies: LODASH } })
    expect(code.modules['worker.js']).toMatch(/^import \{ chunk \} from 'lodash';/m)
  })

  it('a throwing bundler falls back to esm.sh and says so', async () => {
    overrideBundler(async () => {
      throw new Error('esbuild exploded')
    })
    const result = await evaluate(
      { imports: ['lodash@4.17.21'], script: 'return _.chunk([1, 2], 1)' },
      { loader: bridge.loader }
    )
    expect(result.error).toBeUndefined()
    expect(result.value).toEqual([[1], [2]])
    expect(esmShUrls()).toEqual(['https://esm.sh/lodash@4.17.21?bundle'])
    expect(result.logs[0]?.message).toMatch(/bundler failed \(esbuild exploded\).*esm\.sh/)
  })

  it('a bundler result is used as-is, with its warnings surfaced', async () => {
    const { createWorker } = fakeRegistryBundler()
    overrideBundler(createWorker)
    const { code, warnings } = await buildWorkerCodeWithWarnings({
      script: "import _ from 'lodash'; return 1",
      dependencies: LODASH,
    })
    expect(code.mainModule).toBe(BUNDLER_ENTRY)
    expect(code.modules['node_modules/lodash/index.js']).toBeDefined()
    expect(code.modules[PACKAGE_JSON_MODULE]).toEqual({ json: { dependencies: LODASH } })
    expect(warnings).toEqual(['bundler: fake: flat node_modules'])
    expect(esmShUrls()).toEqual([])
  })

  it('bundler warnings reach the caller as warn-level logs', async () => {
    const { createWorker } = fakeRegistryBundler()
    overrideBundler(createWorker)
    const result = await evaluate(
      { script: "import _ from 'lodash'; return _.name", dependencies: LODASH },
      { loader: bridge.loader }
    )
    expect(result.error).toBeUndefined()
    expect(result.value).toBe('lodash@4.17.21')
    expect(result.logs).toEqual([
      expect.objectContaining({
        level: 'warn',
        message: '[ai-evaluate] bundler: fake: flat node_modules',
      }),
    ])
  })

  it('URL imports are fetched as-is on both paths', async () => {
    const { createWorker, calls } = fakeRegistryBundler()
    overrideBundler(createWorker)
    vi.mocked(fetch).mockImplementation(async () => new Response('export default 7'))
    const code = await buildWorkerCode({
      imports: ['https://cdn.example.test/seven.js'],
      dependencies: LODASH,
      script: 'return pkg',
    })
    expect((calls[0]!.options.files as FileSystem).read('__external_0__.js')).toBe(
      'export default 7'
    )
    expect(code.modules[PACKAGE_JSON_MODULE]).toEqual({ json: { dependencies: LODASH } })
  })
})

describe('planImports', () => {
  it('hoists module and script imports and derives dependencies', () => {
    const plan = planImports({
      module:
        "import { chunk } from 'lodash'\nimport { cors } from 'hono/cors'\nexport const x = 1",
      script: "import dayjs from 'dayjs'; return 1",
      dependencies: { hono: '^4' },
      imports: ['uuid@9.0.0', 'https://esm.sh/zod@3'],
    })
    expect(plan.module).not.toContain('import ')
    expect(plan.script).not.toContain('import ')
    expect(plan.statements).toEqual([
      "import { chunk } from 'lodash';",
      "import { cors } from 'hono/cors';",
      "import dayjs from 'dayjs';",
      "import * as __import0__ from 'uuid';",
      "import * as __import1__ from './__external_1__.js';",
    ])
    expect(plan.dependencies).toEqual({
      hono: '^4',
      uuid: '9.0.0',
      lodash: 'latest',
      dayjs: 'latest',
    })
    expect(plan.urls).toEqual([{ index: 1, url: 'https://esm.sh/zod@3' }])
    expect(plan.warnings).toHaveLength(2)
    expect(plan.warnings[0]).toMatch(/'lodash' is not declared/)
    expect(plan.preamble).toContain('globalThis.uuid = __import0__.default || __import0__;')
    expect(plan.preamble).toContain('globalThis.zod = __import1__.default || __import1__;')
  })

  it('is empty for code without imports', () => {
    const plan = planImports({ script: 'return 1' })
    expect(plan.statements).toEqual([])
    expect(plan.dependencies).toEqual({})
    expect(plan.preamble).toBe('')
    expect(plan.warnings).toEqual([])
  })
})
