/**
 * Runs `evaluate()` from src/evaluate.ts - the bytes that ship to Cloudflare -
 * inside workerd, against the real `worker_loaders` binding declared in
 * wrangler.test.jsonc. No Miniflare-per-call, no Node shim: `env.LOADER` is
 * Dynamic Workers.
 */
/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { evaluate, createEvaluator } from '../../src/evaluate.js'
import type { SandboxEnv } from '../../src/types.js'
import { SCRIPT_RESULT_KEYS, TESTS_RESULT_KEYS, resultKeys } from '../fixtures/result-shape.js'

/**
 * Error text a blocked fetch produces: the in-isolate override says
 * "Network access blocked"; workerd's own `globalOutbound: null` says
 * "This worker is not permitted to access the internet via global functions
 * like fetch()".
 */
const BLOCKED_FETCH = /Network|blocked|outbound|not permitted/i

describe('evaluate (workerd, real worker_loaders binding)', () => {
  describe('binding', () => {
    it('env.loader is a worker_loaders binding', () => {
      const sandbox: SandboxEnv = env
      expect(sandbox.loader).toBeDefined()
      expect(typeof sandbox.loader?.get).toBe('function')
    })

    it('env.loader exposes load() (fresh, uncached isolates)', () => {
      const sandbox: SandboxEnv = env
      expect(typeof sandbox.loader?.load).toBe('function')
    })

    it('has no test binding (embedded runner must be used)', () => {
      expect(env.test).toBeUndefined()
    })

    it('the uppercase LOADER alias is gone: a host env with only LOADER has no loader', async () => {
      const legacy = { LOADER: env.loader } as unknown as SandboxEnv
      const result = await evaluate({ script: 'return 1' }, legacy)
      expect(result.success).toBe(false)
      expect(result.error).toContain('worker_loaders')
    })

    it('reports a missing loader instead of throwing', async () => {
      const result = await evaluate({ script: 'return 1' }, {})
      expect(result.success).toBe(false)
      expect(result.error).toContain('worker_loaders')
    })
  })

  describe('script evaluation', () => {
    it('evaluates a script and returns its value', async () => {
      const result = await evaluate({ script: 'return 1 + 1' }, env)
      expect(result.success).toBe(true)
      expect(result.value).toBe(2)
      expect(result.error).toBeUndefined()
      expect(result.duration).toBeGreaterThanOrEqual(0)
      // Same contract the Node pool holds ai-evaluate/node to (test/index.test.ts)
      expect(resultKeys(result)).toEqual([...SCRIPT_RESULT_KEYS])
    })

    it('captures console output', async () => {
      const result = await evaluate(
        {
          script: `
            console.log('hello', { a: 1 });
            console.warn('careful');
            console.debug('dbg');
            return 'done';
          `,
        },
        env
      )
      expect(result.success).toBe(true)
      expect(result.value).toBe('done')
      expect(result.logs.map((l) => l.level)).toEqual(['log', 'warn', 'debug'])
      expect(result.logs[0]?.message).toBe('hello {"a":1}')
    })

    it('reports thrown errors', async () => {
      const result = await evaluate({ script: 'throw new Error("boom")' }, env)
      expect(result.success).toBe(false)
      expect(result.error).toContain('boom')
    })

    it('exposes module exports to the script', async () => {
      const result = await evaluate(
        {
          module: `
            export const add = (a, b) => a + b;
            exports.twice = (n) => n * 2;
          `,
          script: 'return add(2, 3) + twice(4)',
        },
        env
      )
      expect(result.success).toBe(true)
      expect(result.value).toBe(13)
    })

    it('supports async scripts', async () => {
      const result = await evaluate(
        { script: 'await new Promise((r) => setTimeout(r, 10)); return "after"' },
        env
      )
      expect(result.success).toBe(true)
      expect(result.value).toBe('after')
    })

    it('does not leak logs across requests on a reused isolate', async () => {
      // Same code -> same content-addressed id -> same isolate
      const options = { script: 'console.log("once"); return 1', isolation: 'cached' as const }
      const first = await evaluate(options, env)
      const second = await evaluate(options, env)
      expect(first.logs).toHaveLength(1)
      expect(second.logs).toHaveLength(1)
    })

    it("isolation: 'cached' reuses one isolate per spec; 'fresh' (default) loads a new one", async () => {
      const script = 'globalThis.__n = (globalThis.__n ?? 0) + 1; return globalThis.__n'
      expect((await evaluate({ script }, env)).value).toBe(1)
      expect((await evaluate({ script }, env)).value).toBe(1)
      expect((await evaluate({ script, isolation: 'cached' }, env)).value).toBe(1)
      expect((await evaluate({ script, isolation: 'cached' }, env)).value).toBe(2)
      expect((await evaluate({ script, isolation: 'fresh' }, env)).value).toBe(1)
      expect((await evaluate({ script }, env)).value).toBe(1)
    })

    // aip-263g.30: module-scope state (not just globalThis) is what a reused
    // isolate carries; the default must not carry it.
    it('default: module-scope let/const state is per-evaluation; cached carries it', async () => {
      const options = {
        module: 'let n = 0; export const inc = () => ++n; export const seen = []',
        script: 'seen.push("x"); return { n: inc(), seen: seen.length }',
      }
      expect((await evaluate(options, env)).value).toEqual({ n: 1, seen: 1 })
      expect((await evaluate(options, env)).value).toEqual({ n: 1, seen: 1 })
      const cached = { ...options, isolation: 'cached' as const }
      expect((await evaluate(cached, env)).value).toEqual({ n: 1, seen: 1 })
      expect((await evaluate(cached, env)).value).toEqual({ n: 2, seen: 2 })
      expect((await evaluate(options, env)).value).toEqual({ n: 1, seen: 1 })
    })

    it('enforces the timeout', async () => {
      const result = await evaluate(
        { script: 'await new Promise((r) => setTimeout(r, 5000)); return "late"', timeout: 200 },
        env
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Timeout/)
    })

    it('createEvaluator binds env', async () => {
      const run = createEvaluator(env)
      const result = await run({ script: 'return "bound"' })
      expect(result.success).toBe(true)
      expect(result.value).toBe('bound')
    })
  })

  // aip-263g.6: the sandbox env is an allowlist - strings via `env`, RPC
  // stubs and structured-cloneable values via `bindings` - so a host binding
  // can only reach the isolate wrapped in a WorkerEntrypoint service.
  describe('env and bindings (allowlisted sandbox env)', () => {
    it('env.FOO reaches the script as a frozen env', async () => {
      const result = await evaluate(
        {
          script: `
            let frozen = Object.isFrozen(env);
            try { env.FOO = 'changed'; } catch {}
            return { foo: env.FOO, frozen, keys: Object.keys(env) };
          `,
          env: { FOO: 'bar' },
        },
        env
      )
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({ foo: 'bar', frozen: true, keys: ['FOO'] })
    })

    it('a WorkerEntrypoint service stub passed via bindings answers RPC from inside the sandbox', async () => {
      expect(await env.PING.ping()).toBe('pong')
      const result = await evaluate(
        { script: 'return await env.svc.ping()', bindings: { svc: env.PING } },
        env
      )
      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.value).toBe('pong')
    })

    it('the stub is reachable from tests on the embedded runner too', async () => {
      const result = await evaluate(
        {
          tests: 'it("pings", async () => expect(await env.svc.ping()).toBe("pong"))',
          bindings: { svc: env.PING },
          env: { FOO: 'bar' },
        },
        env
      )
      expect(result.success).toBe(true)
      expect(result.testResults?.passed).toBe(1)
    })

    it('a raw KV namespace is refused before the loader ever sees it', async () => {
      expect(env.KV).toBeDefined()
      const result = await evaluate(
        { script: 'return typeof env.KV', bindings: { KV: env.KV } },
        env
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/not structured-cloneable|not an RPC stub/)
      // Our validator, not workerd's "A KV namespace binding cannot be serialized"
      expect(result.error).toContain('bindings.KV')
    })

    it('a structured-cloneable binding arrives as a copy', async () => {
      const result = await evaluate(
        {
          script: 'return { n: env.config.n, list: env.config.list }',
          bindings: { config: { n: 1, list: [1, 2, 3] } },
        },
        env
      )
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({ n: 1, list: [1, 2, 3] })
    })
  })

  describe('embedded test runner (no test binding)', () => {
    it('runs tests with the embedded runner', async () => {
      const result = await evaluate({ tests: 'it("x", () => expect(1).toBe(1))' }, env)
      expect(result.success).toBe(true)
      expect(resultKeys(result)).toEqual([...TESTS_RESULT_KEYS])
      expect(result.error).toBeUndefined()
      expect(result.testResults?.total).toBe(1)
      expect(result.testResults?.passed).toBe(1)
      expect(result.testResults?.failed).toBe(0)
    })

    it('reports failing tests', async () => {
      const result = await evaluate(
        {
          tests: `
            describe('math', () => {
              it('passes', () => expect(2).toBe(2))
              it('fails', () => expect(2).toBe(3))
            })
          `,
        },
        env
      )
      expect(result.testResults?.total).toBe(2)
      expect(result.testResults?.passed).toBe(1)
      expect(result.testResults?.failed).toBe(1)
      const failed = result.testResults?.tests.find((t) => !t.passed)
      expect(failed?.name).toContain('fails')
      expect(failed?.error).toBeDefined()
    })

    it('tests see module exports', async () => {
      const result = await evaluate(
        {
          module: 'exports.double = (n) => n * 2',
          tests: `
            describe('double', () => {
              it('doubles', () => expect(double(21)).toBe(42))
            })
          `,
        },
        env
      )
      expect(result.success).toBe(true)
      expect(result.testResults?.passed).toBe(1)
    })
  })

  describe('JSX / TypeScript (transformed inside workerd by the bundled sucrase)', () => {
    it('transforms JSX with the given factory and evaluates it', async () => {
      const result = await evaluate(
        {
          module: `
            const h = (tag, props, ...children) => ({ tag, props, children })
            export const el = <p class="x">hi</p>
          `,
          script: 'return el',
          jsx: { factory: 'h', fragment: 'Fragment' },
        },
        env
      )
      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.value).toEqual({ tag: 'p', props: { class: 'x' }, children: ['hi'] })
    })

    it('defaults to h / Fragment and handles fragments', async () => {
      const result = await evaluate(
        {
          module: `
            const Fragment = 'fragment'
            const h = (tag, props, ...children) => ({ tag, props, children })
            export const el = <><b/><i/></>
          `,
          script: 'return [el.tag, el.children.map((c) => c.tag)]',
        },
        env
      )
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(['fragment', ['b', 'i']])
    })

    it('strips TypeScript in module, script and tests', async () => {
      const result = await evaluate(
        {
          module: `
            interface Point { x: number; y: number }
            export const len = (p: Point): number => p.x + p.y
          `,
          tests: `
            it('adds', () => { const p: Point = { x: 1, y: 2 }; expect(len(p) as number).toBe(3) })
          `,
          script: 'const p: Point = { x: 40, y: 2 }; return len(p)',
        },
        env
      )
      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
      expect(result.testResults?.passed).toBe(1)
    })

    it('content-addresses the transformed source (same JSX -> same isolate)', async () => {
      const options = {
        module: `
          const h = (tag, props, ...children) => ({ tag, props, children })
          globalThis.__hits__ = (globalThis.__hits__ ?? 0) + 1
          export const el = <p/>
        `,
        script: 'return globalThis.__hits__',
      }
      const first = await evaluate(options, env)
      const second = await evaluate(options, env)
      expect(first.value).toBe(1)
      // The module body ran once: the second call reused the isolate keyed on the
      // post-transform worker code, so it saw the same global.
      expect(second.value).toBe(1)
    })
  })

  describe('network: fetch: false (real globalOutbound: null)', () => {
    it('blocks fetch and fails the evaluation', async () => {
      const result = await evaluate(
        { script: 'return fetch("https://example.com")', fetch: false },
        env
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(BLOCKED_FETCH)
    })

    it('fetch: null blocks the same way (backwards compat)', async () => {
      const result = await evaluate(
        { script: 'return fetch("https://example.com")', fetch: null },
        env
      )
      expect(result.success).toBe(false)
      expect(result.error).toMatch(BLOCKED_FETCH)
    })

    it('is enforced by workerd, not only by the in-isolate fetch override', async () => {
      // The sandbox template rebinds globalThis.fetch to throw when fetch is
      // disabled, keeping the original in module scope as __originalFetch__.
      // The script is embedded in that same module, so it can reach past the
      // override. Doing so must still fail: the loader was given
      // globalOutbound: null, so workerd itself has no outbound path.
      const result = await evaluate(
        {
          script: `
            // Fail loudly (success: true) if the witness ever loses its handle
            // on the real fetch, instead of degrading to the patched one.
            if (typeof __originalFetch__ !== 'function') return { witness: 'no __originalFetch__' };
            const response = await __originalFetch__('https://example.com');
            return { status: response.status };
          `,
          fetch: false,
          timeout: 10000,
        },
        env
      )
      expect(result.success, JSON.stringify(result.value)).toBe(false)
      expect(result.value).toBeUndefined()
      expect(result.error).toMatch(BLOCKED_FETCH)
      // workerd's message, not the template's "fetch is disabled in this sandbox"
      expect(result.error).not.toContain('fetch is disabled')
    })

    it('a script that catches the blocked fetch still completes', async () => {
      const result = await evaluate(
        {
          script: `
            try {
              await fetch('https://example.com');
              return { blocked: false };
            } catch (e) {
              return { blocked: true, error: e.message };
            }
          `,
          fetch: false,
        },
        env
      )
      expect(result.success).toBe(true)
      expect(result.value).toMatchObject({ blocked: true })
      expect((result.value as { error: string }).error).toMatch(BLOCKED_FETCH)
    })
  })
})
