/**
 * `dependencies` + real `import` syntax, resolved by @cloudflare/worker-bundler
 * inside workerd (the only runtime it loads in) and run against the real
 * `worker_loaders` binding. The registry is real too: these tests fetch
 * lodash@4.17.21 from npm once, then hit the bundler's caches.
 */
/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { describe, it, expect, beforeAll } from 'vitest'
import { evaluate, buildWorkerCode } from '../../src/evaluate.js'
import { resolveImports, clearBundlerCache, loadBundler } from '../../src/bundler.js'
import { PACKAGE_JSON_MODULE, workerCodeId } from '../../src/shared.js'

const LODASH = { lodash: '4.17.21' }

describe('dependencies (workerd, @cloudflare/worker-bundler)', () => {
  beforeAll(() => clearBundlerCache())

  it('the bundler loads in this runtime', async () => {
    await expect(loadBundler()).resolves.toBeTypeOf('function')
  })

  it('module imports a dependency with real import syntax', async () => {
    const result = await evaluate(
      {
        module: "import { chunk } from 'lodash'; export const c = chunk([1, 2, 3], 2)",
        script: 'return c',
        dependencies: LODASH,
      },
      env
    )
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(result.value).toEqual([[1, 2], [3]])
    // Resolved by the bundler: no fallback warning in the logs
    expect(result.logs.filter((l) => l.level === 'warn')).toEqual([])
  }, 60000)

  it('script imports are hoisted too', async () => {
    const result = await evaluate(
      { script: "import _ from 'lodash'; return _.sum([1, 2, 3])", dependencies: LODASH },
      env
    )
    expect(result.error).toBeUndefined()
    expect(result.value).toBe(6)
  }, 60000)

  it('the full template (tests) bundles with capnweb kept as a sibling module', async () => {
    const result = await evaluate(
      {
        module: "import { chunk } from 'lodash'; export const c = chunk([1, 2, 3, 4], 2)",
        tests: `
          describe('chunk', () => {
            it('splits', () => { expect(c).toEqual([[1, 2], [3, 4]]) })
          })
        `,
        dependencies: LODASH,
      },
      env
    )
    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(result.testResults?.passed).toBe(1)
    expect(result.testResults?.failed).toBe(0)
  }, 60000)

  it('legacy imports: bare specifiers become dependencies and globals', async () => {
    const result = await evaluate(
      { imports: ['lodash@4.17.21'], script: 'return _.chunk([1, 2], 1)' },
      env
    )
    expect(result.error).toBeUndefined()
    expect(result.value).toEqual([[1], [2]])
  }, 60000)

  it('an undeclared import resolves at latest with a warning', async () => {
    const result = await evaluate(
      {
        module: "import { chunk } from 'lodash'; export const c = chunk([1], 1)",
        script: 'return c',
      },
      env
    )
    expect(result.error).toBeUndefined()
    expect(result.value).toEqual([[1]])
    expect(result.logs.some((l) => l.level === 'warn' && /not declared/.test(l.message))).toBe(true)
  }, 60000)

  it('the bundled spec carries package.json and no bare specifier', async () => {
    const code = await buildWorkerCode({
      module: "import { chunk } from 'lodash'; export const c = chunk([1], 1)",
      script: 'return c',
      dependencies: LODASH,
    })
    expect(code.modules[PACKAGE_JSON_MODULE]).toEqual({ json: { dependencies: LODASH } })
    const main = code.modules[code.mainModule]
    expect(typeof main).toBe('string')
    expect(main as string).not.toMatch(/from\s*['"]lodash['"]/)
    expect(main as string).toContain('chunk')
  }, 60000)

  it('is content-addressed by dependency version', async () => {
    const spec = (version: string) =>
      buildWorkerCode({
        script: "import _ from 'lodash'; return 1",
        dependencies: { lodash: version },
      })
    const a = workerCodeId(await spec('4.17.21'))
    const b = workerCodeId(await spec('4.17.20'))
    expect(a).not.toBe(b)
    expect(workerCodeId(await spec('4.17.21'))).toBe(a)
  }, 120000)

  it('caches resolved modules and installed node_modules by dependencies', async () => {
    const entry =
      "import { chunk } from 'lodash'; export default { fetch() { return Response.json(chunk([1, 2], 1)) } }"
    const first = await resolveImports({ entry, dependencies: LODASH })
    const again = await resolveImports({ entry, dependencies: LODASH })
    expect(again.cached).toBe(true)
    expect(again.modules).toEqual(first.modules)
    // A new entry over the same dependencies bundles from the cached install
    const other = await resolveImports({
      entry: entry.replace('[1, 2]', '[3]'),
      dependencies: LODASH,
    })
    expect(other.cached).toBe(false)
    expect(Object.keys(other.modules)).toEqual(Object.keys(first.modules))
  }, 60000)

  it('bundler: false takes the esm.sh fallback (warning-free, same result)', async () => {
    const result = await evaluate(
      {
        module: "import { chunk } from 'lodash'; export const c = chunk([1, 2, 3], 2)",
        script: 'return c',
        dependencies: LODASH,
        bundler: false,
      },
      env
    )
    expect(result.error).toBeUndefined()
    expect(result.value).toEqual([[1, 2], [3]])
    expect(result.logs.filter((l) => l.level === 'warn')).toEqual([])
  }, 60000)

  it('reports an unresolvable dependency as an error result', async () => {
    const result = await evaluate(
      {
        script: "import x from 'this-package-does-not-exist-ai-evaluate'; return x",
        dependencies: { 'this-package-does-not-exist-ai-evaluate': '1.0.0' },
      },
      env
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/this-package-does-not-exist-ai-evaluate/)
  }, 60000)
})
