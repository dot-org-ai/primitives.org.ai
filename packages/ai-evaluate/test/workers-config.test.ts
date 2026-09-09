/**
 * The workers-pool harness config loads and points at a wrangler config that
 * declares the `loader` worker_loaders binding.
 *
 * Runs on the Node pool; the suite it describes runs on the workers pool.
 */
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { COMPATIBILITY_DATE } from '../src/shared.js'
import workersConfig, {
  WRANGLER_TEST_CONFIG_PATH,
  WORKERS_TEST_INCLUDE,
} from '../vitest.workers.config.js'

const packageDir = resolve(import.meta.dirname, '..')

describe('vitest.workers.config', () => {
  it('registers the cloudflare workers-pool plugin', () => {
    const plugins = (workersConfig.plugins ?? []).flat()
    const names = plugins.map((plugin) => (plugin as { name?: string })?.name)
    expect(names.some((name) => name && /cloudflare|workers/i.test(name))).toBe(true)
  })

  it('only includes test/workers/**', () => {
    expect(workersConfig.test?.include).toEqual(WORKERS_TEST_INCLUDE)
    expect(WORKERS_TEST_INCLUDE.every((pattern) => pattern.startsWith('test/workers/'))).toBe(true)
  })

  it('keeps single-worker execution (resource exhaustion guard)', () => {
    expect(workersConfig.test?.maxWorkers).toBe(1)
    expect(workersConfig.test?.fileParallelism).toBe(false)
  })

  it('wrangler.test.jsonc declares the worker_loaders `loader` binding at the sandbox compatibility date', async () => {
    const path = resolve(packageDir, WRANGLER_TEST_CONFIG_PATH)
    const { unstable_readConfig } = await import('wrangler')
    const config = unstable_readConfig({ config: path })
    expect(config.compatibility_date).toBe(COMPATIBILITY_DATE)
    expect(config.compatibility_date).toBe('2026-01-01')
    expect(config.worker_loaders).toEqual([{ binding: 'loader' }])
  })

  it('wrangler.test.jsonc declares the SandboxHost Durable Object with SQLite storage', async () => {
    const path = resolve(packageDir, WRANGLER_TEST_CONFIG_PATH)
    const { unstable_readConfig } = await import('wrangler')
    const config = unstable_readConfig({ config: path })
    expect(config.durable_objects.bindings).toEqual([
      { name: 'SANDBOX_HOST', class_name: 'SandboxHost' },
    ])
    expect(config.migrations.some((m) => m.new_sqlite_classes?.includes('SandboxHost'))).toBe(true)
  })

  it('wrangler.test.jsonc is the file the plugin was given', async () => {
    const raw = await readFile(resolve(packageDir, WRANGLER_TEST_CONFIG_PATH), 'utf8')
    expect(raw).toContain('"worker_loaders"')
    expect(raw).toContain('"binding": "loader"')
  })
})
