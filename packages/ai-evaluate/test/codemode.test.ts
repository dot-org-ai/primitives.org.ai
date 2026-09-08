/**
 * `ai-evaluate/codemode`: the `Executor` adapter for `@cloudflare/codemode`.
 *
 * Two loaders. The loader bridge (a real workerd isolate, no host gateway)
 * witnesses what the sandbox actually returns for code without tools. A fake
 * loader that plays the sandbox against the spec's `globalOutbound` gateway
 * witnesses tool dispatch: the Node pool has no `cloudflare:workers` loopback
 * bindings, so the module is mocked with a gateway factory built from
 * `gatewayFromProps` - the same function the real `OutboundGateway`
 * entrypoint delegates to.
 */
import { describe, it, expect, expectTypeOf, afterAll, vi } from 'vitest'
import type { Executor, ExecuteResult } from '@cloudflare/codemode'
import { runCode } from '@cloudflare/codemode'
import {
  createExecutor,
  sanitizeToolName,
  isFunctionSource,
  CODEMODE_DISPATCH_HOST,
  CODEMODE_CACHED_ERROR,
  DEFAULT_CODEMODE_TIMEOUT,
  type CodemodeEvaluateOptions,
} from '../src/codemode.js'
import {
  registeredInterceptorCount,
  OUTBOUND_JSON_MODULE,
  type OutboundGatewayProps,
} from '../src/outbound.js'
import { createLoaderBridge } from './helpers/loader-bridge.js'
import type {
  EvaluateResult,
  WorkerCode,
  WorkerEntrypointOptions,
  WorkerLoader,
  WorkerStub,
} from '../src/types.js'

vi.mock('cloudflare:workers', async () => {
  const { gatewayFromProps } = await import('../src/outbound.js')
  // Base classes codemode's own module extends at load time
  class Base {}
  return {
    exports: {
      OutboundGateway: ({ props }: { props: OutboundGatewayProps }) => gatewayFromProps(props),
    },
    RpcTarget: Base,
    WorkerEntrypoint: Base,
    DurableObject: Base,
  }
})

/** The gateway as the fake sandbox sees it: the spec's `globalOutbound` */
type Gateway = { fetch(input: string, init?: RequestInit): Promise<Response> }

/**
 * A fake loader whose worker is `play`: given the spec, it does what the
 * sandbox would (call tools through the gateway) and answers with the
 * `EvaluateResult` body.
 */
function createSandboxLoader(play: (code: WorkerCode) => Promise<Partial<EvaluateResult>>) {
  const loaded: WorkerCode[] = []
  const entrypoints: (WorkerEntrypointOptions | undefined)[] = []
  const calls = { get: 0, load: 0 }
  const stubFor = (pending: WorkerCode | Promise<WorkerCode>): WorkerStub => ({
    getEntrypoint: (_name, options) => {
      entrypoints.push(options)
      return {
        fetch: async () => {
          const code = await pending
          loaded.push(code)
          return Response.json({ success: true, logs: [], duration: 0, ...(await play(code)) })
        },
      }
    },
    getDurableObjectClass: () => undefined,
  })
  const loader: WorkerLoader = {
    get(_id, factory) {
      calls.get++
      return stubFor(factory())
    },
    load(code) {
      calls.load++
      return stubFor(code)
    },
  }
  return { loader, loaded, entrypoints, calls }
}

/** A sandbox that returns `value` without calling anything */
const returning = (value: unknown) => createSandboxLoader(async () => ({ value }))

/** A sandbox that calls one tool through the gateway and returns what it got */
function calling(namespace: string, tool: string, args: unknown[]) {
  return createSandboxLoader(async (code) => {
    const gateway = code.globalOutbound as Gateway
    const response = await gateway.fetch(`https://${CODEMODE_DISPATCH_HOST}/${namespace}/${tool}`, {
      method: 'POST',
      body: JSON.stringify(args),
    })
    const data = (await response.json()) as { result?: unknown; error?: string }
    return data.error !== undefined
      ? { success: false, error: data.error }
      : { success: true, value: data.result }
  })
}

const add = async (...args: unknown[]) => (args[0] as number) + (args[1] as number)

describe('createExecutor', () => {
  it('is an @cloudflare/codemode Executor', () => {
    const { loader } = returning(1)
    const executor = createExecutor({ loader, timeout: 1000, globalOutbound: null })
    expectTypeOf(executor).toMatchTypeOf<Executor>()
    expectTypeOf(executor.execute).returns.resolves.toEqualTypeOf<ExecuteResult>()
    expect(typeof executor.execute).toBe('function')
  })

  describe('in a real isolate (loader bridge, no tools)', () => {
    const bridge = createLoaderBridge()
    afterAll(() => bridge.dispose())

    it('runs a bare body: return 1 + 1 -> { result: 2 }', async () => {
      const executor = createExecutor({ loader: bridge.loader, timeout: 10000 })
      expect(await executor.execute('return 1 + 1', {})).toEqual({ result: 2, logs: [] })
    })

    it('runs the async arrow function normalizeCode produces', async () => {
      const executor = createExecutor({ loader: bridge.loader, timeout: 10000 })
      const result = await executor.execute('async () => {\nconst x = 40\nreturn x + 2\n}', [])
      expect(result).toEqual({ result: 42, logs: [] })
    })

    it('returns console output as logs, levels other than log prefixed', async () => {
      const executor = createExecutor({ loader: bridge.loader, timeout: 10000 })
      const result = await executor.execute(
        `console.log('hello', { n: 1 }); console.warn('careful'); console.error('bad'); return 'done'`,
        {}
      )
      expect(result.result).toBe('done')
      expect(result.logs).toEqual(['hello {"n":1}', '[warn] careful', '[error] bad'])
    })

    it('reports a sandbox error as ExecuteResult.error, never as a success:false object', async () => {
      const executor = createExecutor({ loader: bridge.loader, timeout: 10000 })
      const result = await executor.execute(`console.log('before'); throw new Error('boom')`, {})
      expect(result).toEqual({ result: undefined, error: 'boom', logs: ['before'] })
      expect('success' in result).toBe(false)
    })

    it("codemode's runCode raises that error as a thrown Error with the sandbox string", async () => {
      const executor = createExecutor({ loader: bridge.loader, timeout: 10000 })
      await expect(
        runCode({ code: `console.log('before'); throw new Error('boom')`, executor, providers: [] })
      ).rejects.toThrow('Code execution failed: boom\n\nConsole output:\nbefore')
      await expect(runCode({ code: 'return 1 + 1', executor, providers: [] })).resolves.toEqual({
        result: 2,
      })
    })

    it('a tool the provider does not have fails in the sandbox, without a gateway', async () => {
      const executor = createExecutor({ loader: bridge.loader, timeout: 10000 })
      const result = await executor.execute(
        'try { await codemode.nope() } catch (e) { return e.message }',
        {}
      )
      expect(result).toEqual({ result: 'Tool "nope" not found', logs: [] })
      expect(bridge.loaded.at(-1)?.globalOutbound).toBeNull()
    })

    it('a timeout ends the call with the timeout error', async () => {
      const executor = createExecutor({ loader: bridge.loader, timeout: 300 })
      const result = await executor.execute(
        'await new Promise((resolve) => setTimeout(resolve, 5000)); return 1',
        {}
      )
      expect(result.result).toBeUndefined()
      expect(result.error).toMatch(/^Timeout: Script execution exceeded 300ms/)
    })
  })

  describe('option mapping (fake loader)', () => {
    it('timeout is the wall clock and the entrypoint CPU budget; default 60000', async () => {
      const fake = returning(1)
      await createExecutor({ loader: fake.loader, timeout: 1000 }).execute('return 1', {})
      expect(fake.entrypoints[0]?.limits).toEqual({ cpuMs: 1000 })
      await createExecutor({ loader: fake.loader }).execute('return 1', {})
      expect(fake.entrypoints[1]?.limits).toEqual({ cpuMs: DEFAULT_CODEMODE_TIMEOUT })
    })

    it('globalOutbound: null with nothing to dispatch is a null globalOutbound on the spec', async () => {
      const fake = returning(1)
      await createExecutor({ loader: fake.loader, globalOutbound: null }).execute('return 1', {})
      expect(fake.loaded[0]?.globalOutbound).toBeNull()
      expect(fake.loaded[0]?.modules[OUTBOUND_JSON_MODULE]).toBeUndefined()
    })

    it('modules become sibling modules of the worker; bindings its env', async () => {
      const fake = returning(1)
      await createExecutor({
        loader: fake.loader,
        modules: { 'helper.js': 'export const answer = 42' },
        bindings: { FLAG: 'on' },
      }).execute('return 1', {})
      const code = fake.loaded[0]!
      expect(code.modules['helper.js']).toBe('export const answer = 42')
      expect(code.env).toEqual({ FLAG: 'on' })
    })

    it('evaluate options pass through: limits, compatibility flags', async () => {
      const fake = returning(1)
      await createExecutor({
        loader: fake.loader,
        evaluate: {
          limits: { subrequests: 5 },
          compatibilityFlags: ['nodejs_compat'],
        },
      }).execute('return 1', {})
      expect(fake.calls).toEqual({ get: 0, load: 1 })
      expect(fake.loaded[0]?.limits).toEqual({ subrequests: 5 })
      expect(fake.loaded[0]?.compatibilityFlags).toEqual(['nodejs_compat'])
    })

    it('every call loads a fresh isolate: two identical tool-bearing calls are two workers', async () => {
      // A tool call goes through `outboundRpc`, whose interceptor is
      // registered per evaluation: there is no spec two calls could share,
      // so the executor never takes the cached path (`get`)
      const fake = calling('codemode', 'add', [1, 2])
      const executor = createExecutor({ loader: fake.loader })
      expect((await executor.execute('return 1', { add })).result).toBe(3)
      expect((await executor.execute('return 1', { add })).result).toBe(3)
      expect(fake.calls).toEqual({ get: 0, load: 2 })
      const [first, second] = fake.loaded as [WorkerCode, WorkerCode]
      const interceptorOf = (code: WorkerCode) =>
        (code.modules[OUTBOUND_JSON_MODULE] as { json: OutboundGatewayProps }).json.interceptor
      expect(interceptorOf(first)).toBeDefined()
      expect(interceptorOf(second)).not.toBe(interceptorOf(first))
    })

    it("evaluate.isolation: 'cached' is rejected at construction, not silently made fresh", () => {
      const fake = returning(1)
      expect(() =>
        createExecutor({
          loader: fake.loader,
          // Not in `CodemodeEvaluateOptions`: what a JavaScript caller passes
          evaluate: { isolation: 'cached' } as CodemodeEvaluateOptions,
        })
      ).toThrow(CODEMODE_CACHED_ERROR)
      expect(fake.calls).toEqual({ get: 0, load: 0 })
      // An explicit 'fresh' is the executor's own policy, and accepted
      expect(() =>
        createExecutor({
          loader: fake.loader,
          evaluate: { isolation: 'fresh' } as CodemodeEvaluateOptions,
        })
      ).not.toThrow()
    })

    it('the sandbox script defines one proxy per namespace with its tool names', async () => {
      const fake = returning(1)
      await createExecutor({ loader: fake.loader }).execute('return 1', [
        { name: 'math', fns: { add, 'list-all': add } },
      ])
      const worker = fake.loaded[0]?.modules['worker.js'] as string
      expect(worker).toContain('const math = new Proxy({}')
      expect(worker).toContain('const __codemodeTools = {"math":["add","list_all"]};')
    })

    it('a provider prelude runs in the sandbox after its proxy', async () => {
      const fake = returning(1)
      await createExecutor({ loader: fake.loader }).execute('return 1', [
        { name: 'codemode', fns: {}, prelude: 'codemode.step = async (fn) => fn();' },
      ])
      const worker = fake.loaded[0]?.modules['worker.js'] as string
      expect(worker.indexOf('codemode.step = ')).toBeGreaterThan(
        worker.indexOf('const codemode = new Proxy')
      )
    })
  })

  describe('tool dispatch (fake sandbox through the gateway)', () => {
    it('a plain fns record is the codemode namespace: codemode.add(1, 2) -> 3', async () => {
      const fake = calling('codemode', 'add', [1, 2])
      const result = await createExecutor({ loader: fake.loader }).execute('return 1', { add })
      expect(result).toEqual({ result: 3, logs: [] })
      expect(fake.loaded[0]?.globalOutbound).not.toBeNull()
    })

    it('providers are namespaces: math.add(1, 2) -> 3', async () => {
      const fake = calling('math', 'add', [1, 2])
      const result = await createExecutor({ loader: fake.loader }).execute('return 1', [
        { name: 'math', fns: { add } },
      ])
      expect(result).toEqual({ result: 3, logs: [] })
    })

    it('tools are called by their sanitized name', async () => {
      const fake = calling('codemode', 'list_issues', [{ repo: 'x' }])
      const seen: unknown[] = []
      const result = await createExecutor({ loader: fake.loader }).execute('return 1', {
        'list-issues': async (...args: unknown[]) => {
          seen.push(...args)
          return ['#1']
        },
      })
      expect(result.result).toEqual(['#1'])
      expect(seen).toEqual([{ repo: 'x' }])
    })

    it('a tool that throws answers with its message as the error', async () => {
      const fake = calling('codemode', 'fail', [])
      const result = await createExecutor({ loader: fake.loader }).execute('return 1', {
        fail: async () => {
          throw new Error('tool failed')
        },
      })
      expect(result).toEqual({ result: undefined, error: 'tool failed', logs: [] })
    })

    it('an unknown tool or namespace answers Tool "x" not found', async () => {
      const unknownTool = calling('codemode', 'nope', [])
      expect(
        (await createExecutor({ loader: unknownTool.loader }).execute('return 1', { add })).error
      ).toBe('Tool "nope" not found')
      const unknownNamespace = calling('other', 'add', [1, 2])
      expect(
        (await createExecutor({ loader: unknownNamespace.loader }).execute('return 1', { add }))
          .error
      ).toBe('Tool "add" not found')
    })

    it('the interceptor is released once the call is over', async () => {
      const fake = calling('codemode', 'add', [1, 2])
      await createExecutor({ loader: fake.loader }).execute('return 1', { add })
      expect(registeredInterceptorCount()).toBe(0)
    })

    it('a connector receives callTool(method, firstArg); control markers become errors', async () => {
      const calls: [string, unknown][] = []
      const binding = {
        callTool: async (method: string, args: unknown) => {
          calls.push([method, args])
          if (method === 'pause') return { __codemode_control__: 'pause' }
          if (method === 'fail') return { __codemode_control__: 'error', message: 'denied' }
          return { ok: method }
        },
      }
      const connectors = [{ name: 'github', binding }]
      const executor = createExecutor({ loader: calling('github', 'list', [{ repo: 'x' }]).loader })
      expect(await executor.execute('return 1', [], { connectors })).toEqual({
        result: { ok: 'list' },
        logs: [],
      })
      expect(calls).toEqual([['list', { repo: 'x' }]])

      const paused = createExecutor({ loader: calling('github', 'pause', []).loader })
      expect((await paused.execute('return 1', [], { connectors })).error).toBe(
        '__CODEMODE_PAUSE__'
      )
      const failed = createExecutor({ loader: calling('github', 'fail', []).loader })
      expect((await failed.execute('return 1', [], { connectors })).error).toBe('denied')
    })

    it('globalOutbound: null blocks every other host; a Fetcher receives them', async () => {
      const outbound = createSandboxLoader(async (code) => {
        const gateway = code.globalOutbound as Gateway
        try {
          const response = await gateway.fetch('https://api.example.com/data')
          return { value: await response.text() }
        } catch (error) {
          return { success: false, error: (error as Error).message }
        }
      })
      const blocked = await createExecutor({ loader: outbound.loader }).execute('return 1', { add })
      expect(blocked.error).toMatch(/^Network access blocked: domain not in allowlist/)

      const fetcher = {
        fetch: async (input: Request | string | URL) =>
          new Response(`routed ${new URL(input instanceof Request ? input.url : input).hostname}`),
      }
      const routed = await createExecutor({
        loader: outbound.loader,
        globalOutbound: fetcher,
      }).execute('return 1', {})
      expect(routed).toEqual({ result: 'routed api.example.com', logs: [] })
    })
  })

  describe('rejected calls (never thrown)', () => {
    const unreachable: WorkerLoader = {
      get: () => {
        throw new Error('loader must not be reached')
      },
      load: () => {
        throw new Error('loader must not be reached')
      },
    }
    const executor = createExecutor({ loader: unreachable })

    it('a reserved, invalid or duplicate namespace', async () => {
      expect((await executor.execute('return 1', [{ name: 'env', fns: {} }])).error).toBe(
        'Provider name "env" is reserved'
      )
      expect((await executor.execute('return 1', [{ name: 'my-tools', fns: {} }])).error).toBe(
        'Provider name "my-tools" is not a valid JavaScript identifier'
      )
      expect(
        (
          await executor.execute('return 1', [
            { name: 'a', fns: {} },
            { name: 'a', fns: {} },
          ])
        ).error
      ).toBe('Duplicate provider name "a"')
      expect(
        (
          await executor.execute('return 1', [{ name: 'a', fns: {} }], {
            connectors: [{ name: 'a', binding: { callTool: async () => null } }],
          })
        ).error
      ).toBe('Duplicate name "a" (connector clashes with provider)')
    })

    it('two tool names that sanitize to one', async () => {
      const result = await executor.execute('return 1', { 'list-issues': add, list_issues: add })
      expect(result.error).toBe(
        'Tool names "list-issues" and "list_issues" both sanitize to "list_issues" in provider "codemode"'
      )
    })
  })

  describe('helpers', () => {
    it('sanitizeToolName mirrors codemode', () => {
      expect(sanitizeToolName('list-issues')).toBe('list_issues')
      expect(sanitizeToolName('a.b c')).toBe('a_b_c')
      expect(sanitizeToolName('1st')).toBe('_1st')
      expect(sanitizeToolName('delete')).toBe('delete_')
      expect(sanitizeToolName('')).toBe('_')
      expect(sanitizeToolName('***')).toBe('_')
    })

    it('isFunctionSource tells a function to call from a body to run', () => {
      expect(isFunctionSource('async () => { return 1 }')).toBe(true)
      expect(isFunctionSource('() => 1')).toBe(true)
      expect(isFunctionSource('async x => x')).toBe(true)
      expect(isFunctionSource('function () { return 1 }')).toBe(true)
      expect(isFunctionSource('return 1 + 1')).toBe(false)
      expect(isFunctionSource('const x = await codemode.add(1, 2); return x')).toBe(false)
    })
  })
})
