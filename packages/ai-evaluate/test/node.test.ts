import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, it, expect, vi, afterAll } from 'vitest'
import type { EvaluateResult } from '../src/types.js'

const execFileAsync = promisify(execFile)

/** Names of the modules in a host worker map that mention the dev-template alias, sorted */
function devTemplateReferences(modules: Record<string, string>): string[] {
  return Object.entries(modules)
    .filter(([, source]) => /\bgenerateDevWorkerCode\b/.test(source))
    .map(([name]) => name)
    .sort()
}

afterAll(async () => {
  const { dispose } = await import('../src/node.js')
  await dispose()
})

describe('ai-evaluate/node', () => {
  describe('import side effects', () => {
    it('importing src/node.js registers no process signal or exit listeners', async () => {
      // Callers own shutdown: the module must not install process.on('exit' |
      // 'SIGINT' | 'SIGTERM') handlers the way the removed miniflare-pool did.
      // Re-evaluate the module so its top level actually runs here.
      const events = ['SIGINT', 'SIGTERM', 'exit'] as const
      const before = Object.fromEntries(events.map((e) => [e, process.listenerCount(e)]))
      vi.resetModules()
      await import('../src/node.js')
      const after = Object.fromEntries(events.map((e) => [e, process.listenerCount(e)]))
      expect(after).toEqual(before)
    })
  })

  describe('JSX / TypeScript transformation (in the host worker, via bundled sucrase)', () => {
    it('transforms simple JSX', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          function h(tag, props, ...children) {
            return { tag, props, children }
          }
          exports.render = () => <div>Hello</div>
        `,
        script: 'return render()',
      })

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.value).toEqual({ tag: 'div', props: null, children: ['Hello'] })
    })

    it('transforms JSX with props', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          function h(tag, props, ...children) {
            return { tag, props, children }
          }
          const handler = () => 'clicked'
          exports.render = () => <Button onClick={handler}>Click</Button>
          function Button() {}
        `,
        script: 'const el = render(); return [typeof el.tag, el.props.onClick(), el.children]',
      })

      expect(result.error).toBeUndefined()
      expect(result.value).toEqual(['function', 'clicked', ['Click']])
    })

    it('transforms JSX fragments', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          function h(tag, props, ...children) {
            return { tag: tag === Fragment ? 'fragment' : tag, props, children }
          }
          function Fragment(props) {
            return props.children
          }
          exports.render = () => <><span/><span/></>
        `,
        script: 'return render()',
      })

      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({
        tag: 'fragment',
        props: null,
        children: [
          { tag: 'span', props: null, children: [] },
          { tag: 'span', props: null, children: [] },
        ],
      })
    })

    it('honours options.jsx (factory / fragment)', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          const React = {
            createElement: (tag, props, ...children) => ({ tag, props, children }),
            Fragment: 'Fragment',
          }
          exports.el = <><b>x</b></>
        `,
        script: 'return el',
        jsx: { factory: 'React.createElement', fragment: 'React.Fragment' },
      })

      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({
        tag: 'Fragment',
        props: null,
        children: [{ tag: 'b', props: null, children: ['x'] }],
      })
    })

    it('strips TypeScript from module and script', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          interface Point { x: number; y: number }
          export function len(p: Point): number { return p.x + p.y }
        `,
        script: 'const p: Point = { x: 40, y: 2 }; return len(p) as number',
      })

      expect(result.error).toBeUndefined()
      expect(result.value).toBe(42)
    })

    it('reports a JSX syntax error from the runtime instead of throwing', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: 'exports.element = <div>',
        script: 'return element',
      })

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('logs')
      expect(result).toHaveProperty('duration')
      expect(result.success).toBe(false)
    })

    it('passes through non-JSX code unchanged', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          exports.add = (a, b) => a + b
        `,
        script: 'return add(2, 3)',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(5)
    })

    it('handles code that looks like JSX but is a string', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          exports.html = "<b>Not JSX</b>"
        `,
        script: 'return html',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe('<b>Not JSX</b>')
    })

    it('handles empty module gracefully', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'return 123',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(123)
    })
  })

  describe('local runtime (Miniflare 5 host worker with LOADER binding)', () => {
    it('createLocalRuntime returns { evaluate, dispose } and evaluates a script', async () => {
      const { createLocalRuntime } = await import('../src/node.js')

      const runtime = createLocalRuntime()
      expect(typeof runtime.evaluate).toBe('function')
      expect(typeof runtime.dispose).toBe('function')

      const result = await runtime.evaluate({ script: 'return 1+1' })
      expect(result.success).toBe(true)
      expect(result.value).toBe(2)

      await expect(runtime.dispose()).resolves.toBeUndefined()
      // dispose is idempotent
      await expect(runtime.dispose()).resolves.toBeUndefined()
    })

    it('reuses one host across calls (second call is not a cold start)', async () => {
      const { createLocalRuntime } = await import('../src/node.js')
      const runtime = createLocalRuntime()
      try {
        const first = await runtime.evaluate({ script: 'return 1' })
        const second = await runtime.evaluate({ script: 'return 2' })
        expect(first.value).toBe(1)
        expect(second.value).toBe(2)
        // The first call pays for bundling + workerd startup; the second must not.
        expect(second.duration).toBeLessThan(first.duration)
      } finally {
        await runtime.dispose()
      }
    })

    it('maintains isolation between evaluations', async () => {
      const { evaluate } = await import('../src/node.js')

      // First evaluation sets a global
      const result1 = await evaluate({
        script: 'globalThis.testValue = 42; return globalThis.testValue;',
      })
      expect(result1.success).toBe(true)
      expect(result1.value).toBe(42)

      // Second evaluation loads a fresh isolate by default (and is a different spec anyway)
      const result2 = await evaluate({
        script: 'return globalThis.testValue;',
      })
      expect(result2.success).toBe(true)
      expect(result2.value).toBeUndefined()
    })

    it('times out a CPU-bound script and recovers for the next call', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'while(true){}',
        timeout: 100,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Timeout/)

      // The wedged host is replaced; subsequent evaluations work again
      const after = await evaluate({ script: 'return "alive"' })
      expect(after.success).toBe(true)
      expect(after.value).toBe('alive')
    }, 20000)

    describe('host recovery from a CPU-bound loop (Node backstop)', () => {
      // Local workerd is single-threaded and enforces no CPU limit, so a
      // `while(true){}` stalls the host worker's own AbortSignal.timeout. The
      // Node side aborts the request at timeout + grace, SIGKILLs the host and
      // starts a fresh one on the next call. These tests witness that contract
      // for everything else that was on the host at the time (aip-263g.14).
      const LOOP = 'while(true){}'
      const SLOW = 'await new Promise((r) => setTimeout(r, 5000)); return "late"'

      it('returns the timeout promptly: teardown of the wedged host is bounded', async () => {
        const { createLocalRuntime } = await import('../src/node.js')
        const runtime = createLocalRuntime()
        try {
          await runtime.evaluate({ script: 'return 0' })
          const result = await runtime.evaluate({ script: LOOP, timeout: 100 })
          expect(result.success).toBe(false)
          expect(result.error).toBe('Timeout: Script execution exceeded 100ms')
          // timeout + 250ms grace + SIGKILL/close of the host - not a 5s hang
          expect(result.duration).toBeLessThan(5000)
        } finally {
          await runtime.dispose()
        }
      }, 20000)

      it('reports WEDGED_HOST_ERROR to an evaluation caught in flight, then recovers', async () => {
        const { createLocalRuntime, WEDGED_HOST_ERROR } = await import('../src/node.js')
        const runtime = createLocalRuntime()
        try {
          await runtime.evaluate({ script: 'return 0' })
          // A well-behaved async script is on the host when the loop lands.
          // Its timer lives in the same wedged workerd, so it can only end
          // when the host is killed out from under it.
          const bystander = runtime.evaluate({ script: SLOW, timeout: 10000 })
          await new Promise((r) => setTimeout(r, 100))
          const loop = await runtime.evaluate({ script: LOOP, timeout: 100 })
          expect(loop.success).toBe(false)
          expect(loop.error).toMatch(/^Timeout/)

          const caught = await bystander
          expect(caught.success).toBe(false)
          expect(caught.error).toBe(WEDGED_HOST_ERROR)
          // Not the transport error the kill produces
          expect(caught.error).not.toMatch(/fetch failed|ECONNRESET|socket/i)

          const after = await runtime.evaluate({ script: 'return "alive"' })
          expect(after.success).toBe(true)
          expect(after.value).toBe('alive')
        } finally {
          await runtime.dispose()
        }
      }, 30000)

      it('retires the wedged host once when several CPU-bound loops hit the backstop together', async () => {
        const { createLocalRuntime, WEDGED_HOST_ERROR } = await import('../src/node.js')
        const runtime = createLocalRuntime()
        try {
          await runtime.evaluate({ script: 'return 0' })
          const results = await Promise.all([
            runtime.evaluate({ script: LOOP, timeout: 100 }),
            runtime.evaluate({ script: 'for(;;){}', timeout: 100 }),
            runtime.evaluate({ script: 'let i = 0; while(true) { i++ }', timeout: 100 }),
          ])
          for (const result of results) {
            expect(result.success).toBe(false)
            // Whichever backstop fires first retires the host; the others
            // either hit their own backstop (Timeout) or are caught by the
            // kill (WEDGED_HOST_ERROR). Never a bare transport error.
            expect([`Timeout: Script execution exceeded 100ms`, WEDGED_HOST_ERROR]).toContain(
              result.error
            )
          }
          // Only the host that wedged was torn down: the replacement serves
          // the next call, and it is not torn down by the late retire()s.
          const after = await runtime.evaluate({ script: 'return "alive"' })
          expect(after.success).toBe(true)
          expect(after.value).toBe('alive')
          const again = await runtime.evaluate({ script: 'return "still alive"' })
          expect(again.value).toBe('still alive')
          expect(again.duration).toBeLessThan(after.duration)
        } finally {
          await runtime.dispose()
        }
      }, 30000)

      it('reports DISPOSED_HOST_ERROR to an evaluation in flight when the runtime is disposed', async () => {
        const { createLocalRuntime, DISPOSED_HOST_ERROR } = await import('../src/node.js')
        const runtime = createLocalRuntime()
        try {
          await runtime.evaluate({ script: 'return 0' })
          const slow = runtime.evaluate({ script: SLOW, timeout: 10000 })
          await new Promise((r) => setTimeout(r, 100))
          await runtime.dispose()
          const result = await slow
          expect(result.success).toBe(false)
          expect(result.error).toBe(DISPOSED_HOST_ERROR)
          // dispose() does not wait for the in-flight script's own 5s
          expect(result.duration).toBeLessThan(4000)
          // The runtime is reusable: the next call starts a fresh host
          const after = await runtime.evaluate({ script: 'return "fresh"' })
          expect(after.value).toBe('fresh')
        } finally {
          await runtime.dispose()
        }
      }, 20000)

      it('does not count host startup against the timeout (cold start is not a timeout)', async () => {
        const { createLocalRuntime } = await import('../src/node.js')
        const runtime = createLocalRuntime()
        try {
          // Host startup (workerd spawn + loader) is well over 100ms; the
          // backstop and the in-worker AbortSignal.timeout both start after
          // the host is ready, so a trivial script with a small timeout passes.
          const result = await runtime.evaluate({ script: 'return "cold"', timeout: 1000 })
          expect(result.error).toBeUndefined()
          expect(result.success).toBe(true)
          expect(result.value).toBe('cold')
        } finally {
          await runtime.dispose()
        }
      }, 20000)
    })

    it('times out a slow async script via the host worker AbortSignal.timeout', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'await new Promise((r) => setTimeout(r, 10000)); return "never"',
        timeout: 100,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Timeout: Script execution exceeded 100ms/)
      // Well under the script's own 10s: the host aborted it, not the Node backstop
      expect(result.duration).toBeLessThan(5000)
    }, 10000)

    it('fails fast on a promise that can never settle (workerd hang detection)', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'await new Promise(() => {}); return "never"',
        timeout: 1000,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/hung|Timeout/)
    }, 10000)

    it('evaluates without env binding (uses the shared local runtime)', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'return 42',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
    })

    it('blocks network via globalOutbound when fetch: null', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: `
          try {
            await fetch('https://example.com')
            return 'fetch succeeded'
          } catch (e) {
            return 'fetch blocked: ' + e.message
          }
        `,
        fetch: null,
      })
      expect(result.success).toBe(true)
      expect(result.value).toContain('fetch blocked')
    })

    it('enforces a fetch allowlist through the host worker\'s OutboundGateway', async () => {
      // The Miniflare host is src/host-worker.ts, which exports the gateway,
      // so the allowlist is enforced locally exactly as on Cloudflare: by the
      // loader's globalOutbound, not by anything in the isolate.
      const { evaluate } = await import('../src/node.js')

      const blocked = await evaluate({
        script: 'return fetch("https://blocked.test")',
        fetch: ['api.example.com'],
      })
      expect(blocked.success).toBe(false)
      expect(blocked.error).toMatch(/not in allowlist/)
      expect(blocked.error).toContain('blocked.test')

      const noPatch = await evaluate({
        script: 'return typeof __originalFetch__',
        fetch: ['api.example.com'],
      })
      expect(noPatch.success, noPatch.error).toBe(true)
      expect(noPatch.value).toBe('undefined')

      // An allowed host is forwarded to the host's real fetch: a port nothing
      // listens on fails at the transport, not with the allowlist's message
      const allowed = await evaluate({
        script: `
          try {
            return { status: (await fetch('http://127.0.0.1:1/')).status }
          } catch (e) {
            return { error: e.message }
          }
        `,
        fetch: ['127.0.0.1'],
      })
      expect(allowed.success, allowed.error).toBe(true)
      expect((allowed.value as { error?: string }).error).not.toMatch(/not in allowlist/)
    })

    it('rejects outboundRpc without a host env (a function cannot cross the JSON boundary)', async () => {
      const { evaluate } = await import('../src/node.js')
      const result = await evaluate({ script: 'return 1', outboundRpc: () => null })
      expect(result.success).toBe(false)
      expect(result.error).toContain('outboundRpc needs a live worker_loaders binding')
    })

    it('allows network when fetch is not null', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: `
          // Verify fetch exists and is callable
          return typeof globalThis.fetch === 'function'
        `,
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(true)
    })

    it('runs repeated evaluations on one host', async () => {
      const { evaluate } = await import('../src/node.js')

      for (let i = 0; i < 3; i++) {
        const result = await evaluate({
          script: `return ${i}`,
        })
        expect(result.success).toBe(true)
        expect(result.value).toBe(i)
      }
    })

    it('runs 20 sequential evaluations in under 2s once the host is warm', async () => {
      const { evaluate } = await import('../src/node.js')

      // Warm-up: pays for host startup (and a fresh host after any dispose())
      const warm = await evaluate({ script: 'return 1' })
      expect(warm.value).toBe(1)

      const start = Date.now()
      for (let i = 0; i < 20; i++) {
        const result = await evaluate({ script: 'return 1' })
        expect(result.value).toBe(1)
      }
      // Per-call Miniflare instantiation cost ~100ms+ each; one reused host is ~2ms.
      expect(Date.now() - start).toBeLessThan(2000)
    })

    it('returns duration in result', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'return true',
      })
      expect(result.success).toBe(true)
      expect(typeof result.duration).toBe('number')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('captures console output', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: `
          console.log('log message');
          console.warn('warn message');
          console.error('error message');
          return 'done'
        `,
      })
      expect(result.success).toBe(true)
      expect(result.logs.length).toBeGreaterThanOrEqual(3)
      expect(result.logs.some((l) => l.level === 'log' && l.message === 'log message')).toBe(true)
      expect(result.logs.some((l) => l.level === 'warn' && l.message === 'warn message')).toBe(true)
      expect(result.logs.some((l) => l.level === 'error' && l.message === 'error message')).toBe(
        true
      )
    })

    it('exports dispose() for the shared runtime', async () => {
      const { evaluate, dispose } = await import('../src/node.js')
      expect(typeof dispose).toBe('function')
      await expect(dispose()).resolves.toBeUndefined()
      // A fresh runtime is created on the next call
      const result = await evaluate({ script: 'return "fresh"' })
      expect(result.value).toBe('fresh')
    })
  })

  describe('single code path with src/evaluate.ts', () => {
    it('the host worker builds sandbox code with generateWorkerCode, not the dev alias', async () => {
      // A Node-side spy cannot see code running inside workerd, so this is
      // asserted on the module text the Miniflare host actually loads: the
      // only modules that mention `generateDevWorkerCode` are the one that
      // defines the deprecated alias and the barrel that re-exports it.
      // `evaluate.js` - which builds every WorkerCode - calls the production
      // generator and picks the test runner from the TEST binding.
      const { loadHostWorker } = await import('../src/host-modules.js')
      const { modules } = loadHostWorker()

      expect(devTemplateReferences(modules)).toEqual([
        'worker-template/core.js',
        'worker-template/index.js',
      ])
      expect(modules['evaluate.js']).toMatch(/\bgenerateWorkerCode\(/)
      expect(modules['evaluate.js']).toMatch(
        /testRunner:\s*testService\s*\?\s*['"]rpc['"]\s*:\s*['"]embedded['"]/
      )
    })

    it('that witness fails when evaluate.js is rewired to the dev alias', async () => {
      // Guard against the check itself being vacuous: a tampered module map
      // in which evaluate.js calls the alias must be reported.
      const { loadHostWorker } = await import('../src/host-modules.js')
      const { modules } = loadHostWorker()
      const tampered = {
        ...modules,
        'evaluate.js': modules['evaluate.js']!.replace(
          /\bgenerateWorkerCode\(/,
          'generateDevWorkerCode('
        ),
      }
      expect(devTemplateReferences(tampered)).toContain('evaluate.js')
    })

    it('walks host-worker -> evaluate as the host worker modules (same bytes as prod)', async () => {
      const { walkHostWorker, HOST_MODULE } = await import('../src/host-modules.js')
      const { mainModule, modules } = walkHostWorker()
      expect(mainModule).toBe(HOST_MODULE)
      // The host is the evaluate() implementation, not a separate local template
      expect(Object.keys(modules)).toEqual(
        expect.arrayContaining([
          'host-worker.js',
          'evaluate.js',
          'shared.js',
          'transform.js',
          'transform-bundle.js',
          'capnweb-bundle.js',
          'worker-template/index.js',
          'worker-template/core.js',
        ])
      )
      expect(Object.keys(modules)).not.toContain('node.js')
      expect(modules['evaluate.js']).toContain('Sandbox requires worker_loaders binding')
      expect(modules['evaluate.js']).toContain('Simple Sandbox Worker')
      expect(modules['host-worker.js']).toContain('/evaluate')
      const all = Object.values(modules).join('\n')
      // Plain ES modules: no TypeScript left; no static import of esbuild or
      // the worker bundler (the bundler is loaded on demand, see src/bundler.ts,
      // and this host cannot resolve it - the esm.sh fallback runs here)
      expect(all).not.toMatch(/^import type\b/m)
      expect(all).not.toMatch(/^import[^\n]*from\s*['"](?:esbuild|@cloudflare\/worker-bundler)/m)
    })

    it('delegates to evaluate() from src/evaluate.ts when env has a loader', async () => {
      const evaluateModule = await import('../src/evaluate.js')
      const { evaluate } = await import('../src/node.js')

      const canned = { success: true, value: 'from-loader', logs: [], duration: 0 }
      const stub = () => ({
        getEntrypoint: () => ({
          fetch: async () => Response.json(canned),
        }),
      })
      const env = { loader: { get: stub, load: stub } }

      const direct = await evaluateModule.evaluate({ script: 'return 1' }, env)
      const viaNode = await evaluate({ script: 'return 1' }, env)
      expect(viaNode.value).toBe('from-loader')
      expect(Object.keys(viaNode).sort()).toEqual(Object.keys(direct).sort())
    })
  })

  describe('no esbuild dependency', () => {
    it('package.json declares no esbuild in any dependency field', async () => {
      const { readFileSync } = await import('node:fs')
      const pkg = JSON.parse(
        readFileSync(new URL('../package.json', import.meta.url), 'utf8')
      ) as Record<string, Record<string, string> | undefined>
      for (const field of [
        'dependencies',
        'devDependencies',
        'optionalDependencies',
        'peerDependencies',
      ]) {
        expect(pkg[field] ?? {}, field).not.toHaveProperty('esbuild')
      }
    })

    it('src/node.ts does not import esbuild', async () => {
      const { readFileSync } = await import('node:fs')
      const source = readFileSync(new URL('../src/node.ts', import.meta.url), 'utf8')
      expect(source).not.toMatch(/import\(['"]esbuild['"]\)/)
      expect(source).not.toMatch(/from ['"]esbuild['"]/)
    })

    it('code without JSX evaluates unchanged', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          exports.multiply = (a, b) => a * b
        `,
        script: 'return multiply(6, 7)',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
    })
  })

  describe('import from ai-evaluate/node', () => {
    it('exports evaluate function', async () => {
      const nodeModule = await import('../src/node.js')
      expect(typeof nodeModule.evaluate).toBe('function')
    })

    it('exports createEvaluator function', async () => {
      const nodeModule = await import('../src/node.js')
      expect(typeof nodeModule.createEvaluator).toBe('function')
    })

    it('createEvaluator returns working evaluator', async () => {
      const { createEvaluator } = await import('../src/node.js')

      const evaluator = createEvaluator()
      expect(typeof evaluator).toBe('function')

      const result = await evaluator({
        script: 'return "hello from evaluator"',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe('hello from evaluator')
    })

    it('evaluate function works standalone', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          exports.greet = (name) => 'Hello, ' + name
        `,
        script: 'return greet("World")',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe('Hello, World')
    })

    it('re-exports types from types.js', async () => {
      // Types are compile-time only, just verify module loads
      const nodeModule = await import('../src/node.js')
      expect(nodeModule).toBeDefined()
      // Verify the module exports the expected functions
      expect(Object.keys(nodeModule)).toContain('evaluate')
      expect(Object.keys(nodeModule)).toContain('createEvaluator')
    })
  })

  describe('miniflare availability (aip-263g.13)', () => {
    // Miniflare 5 declares engines.node >= 22, so on older Node the package
    // manager skips the optional dependency and `import('miniflare')` fails
    // with ERR_MODULE_NOT_FOUND. vitest cannot make a dynamic import reject
    // with a specific error (a throwing vi.mock factory is re-wrapped), so the
    // fixture runs in a child `node` with resolver hooks that hide the package.
    const fixture = join(
      dirname(fileURLToPath(import.meta.url)),
      'fixtures',
      'missing-miniflare.ts'
    )

    async function runFixture(failure: 'missing' | 'broken') {
      const { stdout } = await execFileAsync(process.execPath, ['--import', 'tsx', fixture], {
        cwd: join(dirname(fixture), '..', '..'),
        env: { ...process.env, MINIFLARE_FAILURE: failure },
        timeout: 20_000,
      })
      return JSON.parse(stdout.trim().split('\n').at(-1) ?? '') as {
        shared: EvaluateResult
        explicit: EvaluateResult
        message: string
      }
    }

    it('reports MINIFLARE_UNAVAILABLE_ERROR when the optional miniflare dependency is not installed', async () => {
      const { MINIFLARE_UNAVAILABLE_ERROR } = await import('../src/node.js')
      const { shared, explicit, message } = await runFixture('missing')
      expect(message).toBe(MINIFLARE_UNAVAILABLE_ERROR)
      expect(MINIFLARE_UNAVAILABLE_ERROR).toMatch(/Node >= 22/)
      for (const result of [shared, explicit]) {
        expect(result.success).toBe(false)
        // What is missing and why, then the resolver's own message
        expect(result.error).toContain(MINIFLARE_UNAVAILABLE_ERROR)
        expect(result.error).toContain("Cannot find package 'miniflare'")
      }
    })

    it('passes through import failures that are not a missing package', async () => {
      const { MINIFLARE_UNAVAILABLE_ERROR } = await import('../src/node.js')
      const { shared, explicit } = await runFixture('broken')
      for (const result of [shared, explicit]) {
        expect(result.success).toBe(false)
        expect(result.error).toBe('workerd binary failed to initialise')
        expect(result.error).not.toContain(MINIFLARE_UNAVAILABLE_ERROR)
      }
    })
  })

  describe('error handling', () => {
    it('handles evaluation errors gracefully', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'throw new Error("intentional error")',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('intentional error')
    })

    it('handles syntax errors in module', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: 'exports.foo = {;', // Invalid syntax
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns error for undefined function calls', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'return undefinedFunction()',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('handles async errors in script', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: `
          return Promise.reject(new Error('async failure'))
        `,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('async failure')
    })

    it('catches module initialization errors', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: 'throw new Error("init error")',
        script: 'return true',
      })
      // Module errors are logged, and execution may continue or fail
      expect(result).toHaveProperty('logs')
    })

    it('returns proper error shape on failure', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'throw new Error("test")',
      })
      expect(result).toHaveProperty('success', false)
      expect(result).toHaveProperty('error')
      expect(result).toHaveProperty('logs')
      expect(result).toHaveProperty('duration')
      expect(typeof result.error).toBe('string')
      expect(typeof result.duration).toBe('number')
    })
  })

  describe('test execution', () => {
    it('runs tests with passing results', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        tests: `
          describe('math', () => {
            it('adds numbers', () => {
              expect(1 + 1).toBe(2);
            });
          });
        `,
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(1)
      expect(result.testResults?.passed).toBe(1)
    })

    it('runs tests with failing results', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        tests: `
          it('fails', () => {
            expect(1).toBe(2);
          });
        `,
      })
      expect(result.success).toBe(false)
      expect(result.testResults?.failed).toBe(1)
    })

    it('combines module and tests', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          exports.double = (n) => n * 2
        `,
        tests: `
          describe('double', () => {
            it('doubles 5', () => {
              expect(double(5)).toBe(10);
            });
            it('doubles 0', () => {
              expect(double(0)).toBe(0);
            });
          });
        `,
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(2)
      expect(result.testResults?.passed).toBe(2)
    })
  })
})
