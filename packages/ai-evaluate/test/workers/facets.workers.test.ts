/**
 * Durable Object facets against the real runtime: `evaluate()` from
 * src/evaluate.ts inside workerd, with the `worker_loaders` binding and the
 * `SandboxHost` Durable Object (ping-worker.ts, wrangler.test.jsonc). The
 * sandbox module's class runs as a SQLite-backed facet of the sandbox's
 * `SandboxHost`, and the script calls it as `env.STATE`.
 */
/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/evaluate.js'
import { createReplSession } from '../../src/repl.js'
import { SANDBOX_HOST_BINDING_KEY } from '../../src/facets.js'
import type { EvaluateOptions } from '../../src/types.js'

/** A plain class (no `extends DurableObject`): the facet worker wraps it */
const STATE_MODULE = `
export class State {
  constructor(ctx) {
    this.sql = ctx.storage.sql
    this.sql.exec('CREATE TABLE IF NOT EXISTS counter (n INTEGER NOT NULL)')
  }
  incr() {
    const row = this.sql.exec('SELECT n FROM counter').toArray()[0]
    const n = (row?.n ?? 0) + 1
    this.sql.exec('DELETE FROM counter')
    this.sql.exec('INSERT INTO counter (n) VALUES (?)', n)
    return n
  }
  fetch(request) { return new Response('facet ' + request.method + ' ' + new URL(request.url).pathname) }
}
`

/** The same counter as a `DurableObject` subclass, with in-memory state next to SQLite */
const DO_STATE_MODULE = `
import { DurableObject } from 'cloudflare:workers'
export class State extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.sql.exec('CREATE TABLE IF NOT EXISTS counter (n INTEGER NOT NULL)')
    this.calls = 0
  }
  incr() {
    this.calls++
    const row = this.sql.exec('SELECT n FROM counter').toArray()[0]
    const n = (row?.n ?? 0) + 1
    this.sql.exec('DELETE FROM counter')
    this.sql.exec('INSERT INTO counter (n) VALUES (?)', n)
    return { n, calls: this.calls, envKeys: Object.keys(this.env) }
  }
}
`

const sandbox = (): string => `sandbox-${crypto.randomUUID()}`

const counter = (sandboxId: string, extra: Partial<EvaluateOptions> = {}): EvaluateOptions => ({
  module: STATE_MODULE,
  script: 'return await env.STATE.incr()',
  facet: { class: 'State' },
  sandboxId,
  ...extra,
})

describe('facets (workerd, SandboxHost Durable Object)', () => {
  it('the test worker has the SandboxHost namespace', () => {
    expect(env.SANDBOX_HOST).toBeDefined()
    expect(typeof env.SANDBOX_HOST.getByName).toBe('function')
  })

  it('facet SQLite state survives across evaluations of the same sandboxId: 1 then 2', async () => {
    const sandboxId = sandbox()
    const first = await evaluate(counter(sandboxId), env)
    expect(first.success, first.error).toBe(true)
    expect(first.value).toBe(1)
    const second = await evaluate(counter(sandboxId), env)
    expect(second.success, second.error).toBe(true)
    expect(second.value).toBe(2)
  })

  it('a different sandboxId has its own facet: 1', async () => {
    const a = sandbox()
    const b = sandbox()
    await evaluate(counter(a), env)
    await evaluate(counter(a), env)
    const other = await evaluate(counter(b), env)
    expect(other.success, other.error).toBe(true)
    expect(other.value).toBe(1)
    expect((await evaluate(counter(a), env)).value).toBe(3)
  })

  it('a class that extends DurableObject runs as it is, hot across evaluations, with the sandbox env', async () => {
    const sandboxId = sandbox()
    const options = counter(sandboxId, { module: DO_STATE_MODULE, env: { WHO: 'sandbox' } })
    const first = await evaluate(options, env)
    expect(first.success, first.error).toBe(true)
    expect(first.value).toEqual({ n: 1, calls: 1, envKeys: ['WHO'] })
    // Same module: the facet stays up (in-memory `calls` continues), storage continues
    const second = await evaluate(options, env)
    expect(second.value).toEqual({ n: 2, calls: 2, envKeys: ['WHO'] })
  })

  it('a changed module restarts the facet on the new class and keeps its storage', async () => {
    const sandboxId = sandbox()
    await evaluate(counter(sandboxId, { module: DO_STATE_MODULE }), env)
    await evaluate(counter(sandboxId, { module: DO_STATE_MODULE }), env)
    const changed = await evaluate(
      counter(sandboxId, { module: DO_STATE_MODULE.replace('this.calls = 0', 'this.calls = 100') }),
      env
    )
    expect(changed.success, changed.error).toBe(true)
    // New class (calls restarts from the new initial value), same SQLite rows
    expect(changed.value).toEqual({ n: 3, calls: 101, envKeys: [] })
  })

  it('fetch() on the facet reaches its fetch handler', async () => {
    const result = await evaluate(
      counter(sandbox(), {
        script: `
          const response = await env.STATE.fetch('http://facet/hello', { method: 'PUT' })
          return await response.text()
        `,
      }),
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toBe('facet PUT /hello')
  })

  it('the script sees only the facet binding: no host stub, a non-thenable proxy', async () => {
    const result = await evaluate(
      counter(sandbox(), {
        env: { WHO: 'x' },
        script: `
          return {
            keys: Object.keys(env).sort(),
            hidden: ${JSON.stringify(SANDBOX_HOST_BINDING_KEY)} in env,
            proxy: (await env.STATE) === env.STATE,
            method: typeof env.STATE.incr,
          }
        `,
      }),
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toEqual({
      keys: ['STATE', 'WHO'],
      hidden: false,
      proxy: true,
      method: 'function',
    })
  })

  it('__sandboxHost__ and __env__ are ReferenceErrors from the script: the host stub is out of scope', async () => {
    for (const name of ['__sandboxHost__', '__env__', '__bindings__']) {
      const result = await evaluate(
        counter(sandbox(), {
          script: `return typeof ${name} === 'undefined' ? 'unbound' : ${name}`,
        }),
        env
      )
      expect(result.success, `${name}: ${result.error}`).toBe(true)
      expect(result.value, name).toBe('unbound')
    }
  })

  it('__env__ is unbound in the script without a facet, and in the test-runner worker', async () => {
    const simple = await evaluate({ script: 'return __env__' }, env)
    expect(simple.success).toBe(false)
    expect(simple.error).toMatch(/__env__ is not defined/)
    const full = await evaluate(
      {
        script: 'return typeof __env__',
        tests: 'it("cannot see the loader env", () => expect(typeof __env__).toBe("undefined"))',
      },
      env
    )
    expect(full.success, full.error).toBe(true)
    expect(full.value).toBe('undefined')
  })

  it('attach-escape witness: the script cannot load its own worker through the host (fetch: false holds)', async () => {
    // A DurableObject class whose method fetches: loaded through SandboxHost.attach
    // without a globalOutbound it would inherit the host's network.
    const evil = `
      import { DurableObject } from 'cloudflare:workers'
      export class Evil extends DurableObject {
        async go() {
          try { const r = await fetch('https://example.com/'); return 'leaked:' + r.status } catch (e) { return 'blocked:' + e.message }
        }
      }`
    const spec = JSON.stringify({
      code: {
        mainModule: 'w.js',
        modules: { 'w.js': evil },
        compatibilityDate: '2026-01-01',
        compatibilityFlags: [],
      },
      codeId: 'evil-witness-1',
      className: 'Evil',
    })
    const viaLocal = await evaluate(
      counter(sandbox(), {
        fetch: false,
        script: `
          await __sandboxHost__.attach('Evil', ${spec})
          return await __sandboxHost__.invoke('Evil', 'go', [])
        `,
      }),
      env
    )
    expect(viaLocal.success).toBe(false)
    expect(viaLocal.error).toMatch(/__sandboxHost__ is not defined/)

    const viaEnv = await evaluate(
      counter(sandbox(), {
        fetch: false,
        script: `
          const host = __env__[${JSON.stringify(SANDBOX_HOST_BINDING_KEY)}]
          await host.attach('Evil', ${spec})
          return await host.invoke('Evil', 'go', [])
        `,
      }),
      env
    )
    expect(viaEnv.success).toBe(false)
    expect(viaEnv.error).toMatch(/__env__ is not defined/)

    // The facet proxy itself gives no route to attach: it is an invoke() of that name
    const viaProxy = await evaluate(
      counter(sandbox(), {
        fetch: false,
        script: `
          try { await env.STATE.attach('Evil', ${spec}) } catch (e) { return 'refused: ' + e.message }
          return 'attached'
        `,
      }),
      env
    )
    expect(viaProxy.success, viaProxy.error).toBe(true)
    expect(viaProxy.value).toMatch(/^refused: /)
  })

  it('facet.binding names the env key', async () => {
    const result = await evaluate(
      counter(sandbox(), {
        facet: { class: 'State', binding: 'COUNTER' },
        script: 'return [typeof env.STATE, await env.COUNTER.incr()]',
      }),
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toEqual(['undefined', 1])
  })

  it('works under isolation: cached for the script worker', async () => {
    const sandboxId = sandbox()
    const options = counter(sandboxId, { isolation: 'cached' })
    expect((await evaluate(options, env)).value).toBe(1)
    expect((await evaluate(options, env)).value).toBe(2)
  })

  it('fetch: false applies to facet code too', async () => {
    const result = await evaluate(
      {
        module: `export class State {
          constructor(ctx) {}
          async probe() { try { await fetch('https://example.com/'); return 'reached' } catch (e) { return 'blocked: ' + e.message } }
        }`,
        script: 'return await env.STATE.probe()',
        facet: { class: 'State' },
        sandboxId: sandbox(),
        fetch: false,
      },
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toMatch(/^blocked: /)
  })

  it('a module that does not export the class fails at the first call, naming it', async () => {
    const result = await evaluate(counter(sandbox(), { module: 'export const notAClass = 1' }), env)
    expect(result.success).toBe(false)
    expect(result.error).toContain('facet class State is not exported by module')
  })

  it('an unknown method is an error from the facet, not a hang', async () => {
    const result = await evaluate(
      counter(sandbox(), { script: 'return await env.STATE.nope()' }),
      env
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/nope/)
  })

  it('facet without sandboxId is rejected before anything loads', async () => {
    const result = await evaluate({ ...counter('x'), sandboxId: undefined }, env)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/sandboxId/)
  })

  it('REPL sessions run over this env: state across evals, one ReplState facet per session', async () => {
    const session = await createReplSession({}, env)
    try {
      await session.eval('const counter = { n: 1 }')
      const result = await session.eval('counter.n += 1; counter.n')
      expect(result.success, result.error).toBe(true)
      expect(result.value).toBe(2)
      await session.eval('const sum = (a, b) => a + b')
      expect((await session.eval('sum(counter.n, 40)')).value).toBe(42)
    } finally {
      await session.close()
    }
  })
})
