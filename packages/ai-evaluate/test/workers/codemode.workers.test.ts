/**
 * `ai-evaluate/codemode` against the real `worker_loaders` binding inside
 * workerd: the code an agent writes runs in a loaded isolate, its tool calls
 * come back to the host through the `OutboundGateway` entrypoint
 * (ping-worker.ts exports it), and the result has codemode's `ExecuteResult`
 * shape. `runCode` from `@cloudflare/codemode` itself drives the executor in
 * the last tests.
 */
/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { runCode, type ExecuteResult } from '@cloudflare/codemode'
import { createExecutor } from '../../src/codemode.js'
import { registeredInterceptorCount } from '../../src/outbound.js'

const add = async (...args: unknown[]) => (args[0] as number) + (args[1] as number)

describe('codemode executor (workerd)', () => {
  const loader = env.loader!

  it('return 1 + 1 -> { result: 2 }', async () => {
    const executor = createExecutor({ loader, timeout: 10000, globalOutbound: null })
    expect(await executor.execute('return 1 + 1', {})).toEqual({ result: 2, logs: [] })
  })

  it('tools of a plain fns record are codemode.*: codemode.add(1, 2) -> 3', async () => {
    const executor = createExecutor({ loader, timeout: 10000 })
    const result = await executor.execute('return await codemode.add(1, 2)', { add })
    expect(result).toEqual({ result: 3, logs: [] })
    expect(registeredInterceptorCount()).toBe(0)
  })

  it('providers are namespaces, tools called by sanitized name, results structured', async () => {
    const executor = createExecutor({ loader, timeout: 10000 })
    const result = await executor.execute(
      'async () => {\nconst issues = await github.list_issues({ repo: "x" })\nreturn { n: issues.length, first: issues[0] }\n}',
      [
        {
          name: 'github',
          fns: {
            'list-issues': async (...args: unknown[]) => [{ id: 1, args: args[0] }],
          },
        },
      ]
    )
    expect(result).toEqual({ result: { n: 1, first: { id: 1, args: { repo: 'x' } } }, logs: [] })
  })

  it('console output is returned as logs', async () => {
    const executor = createExecutor({ loader, timeout: 10000 })
    const result = await executor.execute(
      `console.log('sum', await codemode.add(2, 3)); console.warn('w'); return 'ok'`,
      { add }
    )
    expect(result).toEqual({ result: 'ok', logs: ['sum 5', '[warn] w'] })
  })

  it('a sandbox error is ExecuteResult.error with the sandbox string', async () => {
    const executor = createExecutor({ loader, timeout: 10000 })
    const result = await executor.execute(`throw new TypeError('boom')`, {})
    expect(result).toEqual({ result: undefined, error: 'boom', logs: [] })
    expect(Object.keys(result)).not.toContain('success')
  })

  it('a tool error reaches the code as a thrown Error; an unknown tool too', async () => {
    const executor = createExecutor({ loader, timeout: 10000 })
    const result = await executor.execute(
      `const seen = []
       try { await codemode.fail() } catch (e) { seen.push(e.message) }
       try { await codemode.nope() } catch (e) { seen.push(e.message) }
       return seen`,
      {
        fail: async () => {
          throw new Error('tool failed')
        },
      }
    )
    expect(result).toEqual({ result: ['tool failed', 'Tool "nope" not found'], logs: [] })
  })

  it('globalOutbound: null - fetch() is blocked, tool calls still work', async () => {
    const executor = createExecutor({ loader, timeout: 10000, globalOutbound: null })
    const result = await executor.execute(
      `const sum = await codemode.add(1, 1)
       try { await fetch('https://example.com/'); return 'reached' } catch (e) { return [sum, e.message] }`,
      { add }
    )
    expect(result.error).toBeUndefined()
    expect(result.result).toEqual([2, expect.stringMatching(/^Network access blocked/)])
  })

  it('globalOutbound: a Fetcher - every other request routes through it, on the host', async () => {
    const seen: string[] = []
    const fetcher = {
      fetch: async (input: Request | string | URL) => {
        const url = input instanceof Request ? input.url : String(input)
        seen.push(url)
        return new Response(`routed ${new URL(url).hostname}`)
      },
    }
    const executor = createExecutor({ loader, timeout: 10000, globalOutbound: fetcher })
    const result = await executor.execute(
      `const response = await fetch('https://api.example.com/data'); return response.text()`,
      {}
    )
    expect(result).toEqual({ result: 'routed api.example.com', logs: [] })
    expect(seen).toEqual(['https://api.example.com/data'])
  })

  it('connectors: name.method(arg) is callTool(method, arg) on the host binding', async () => {
    const calls: [string, unknown][] = []
    const binding = {
      callTool: async (method: string, args: unknown) => {
        calls.push([method, args])
        return method === 'pause' ? { __codemode_control__: 'pause' } : { echoed: args }
      },
    }
    const executor = createExecutor({ loader, timeout: 10000 })
    const result = await executor.execute(
      `const first = await crm.lookup({ id: 7 })
       try { await crm.pause() } catch (e) { return [first, e.message] }`,
      [],
      { connectors: [{ name: 'crm', binding }] }
    )
    expect(result).toEqual({ result: [{ echoed: { id: 7 } }, '__CODEMODE_PAUSE__'], logs: [] })
    expect(calls).toEqual([
      ['lookup', { id: 7 }],
      ['pause', undefined],
    ])
  })

  it('modules are importable from the sandbox', async () => {
    const executor = createExecutor({
      loader,
      timeout: 10000,
      modules: { 'helper.js': 'export const answer = 42' },
    })
    const result = await executor.execute(
      `const { answer } = await import('./helper.js'); return answer`,
      {}
    )
    expect(result).toEqual({ result: 42, logs: [] })
  })

  it('bindings are the sandbox env: a real RPC stub is callable', async () => {
    const executor = createExecutor({ loader, timeout: 10000, bindings: { PING: env.PING } })
    const result = await executor.execute('return await env.PING.ping()', {})
    expect(result).toEqual({ result: 'pong', logs: [] })
  })

  it('timeout ends a call that outlives it', async () => {
    const executor = createExecutor({ loader, timeout: 300 })
    const result = await executor.execute(
      'await new Promise((resolve) => setTimeout(resolve, 5000)); return 1',
      {}
    )
    expect(result.result).toBeUndefined()
    expect(result.error).toMatch(/^Timeout: Script execution exceeded 300ms/)
  })

  describe("driven by codemode's runCode", () => {
    it('resolves with the result and logs', async () => {
      const executor = createExecutor({ loader, timeout: 10000 })
      const output = await runCode({
        code: 'async () => { console.log("adding"); return codemode.add(20, 22) }',
        executor,
        providers: [{ name: 'codemode', fns: { add } }],
      })
      expect(output).toEqual({ result: 42, logs: ['adding'] })
    })

    it('throws an Error carrying the sandbox error string', async () => {
      const executor = createExecutor({ loader, timeout: 10000 })
      await expect(
        runCode({ code: 'async () => { throw new Error("boom") }', executor, providers: [] })
      ).rejects.toThrow('Code execution failed: boom')
    })

    it('the result type is ExecuteResult', async () => {
      const executor = createExecutor({ loader, timeout: 10000 })
      const result: ExecuteResult = await executor.execute('return 1', {})
      expect(result.result).toBe(1)
    })
  })
})
