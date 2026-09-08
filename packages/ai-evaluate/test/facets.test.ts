/**
 * Facets on the Node pool: the facet host logic the `SandboxHost` Durable
 * Object delegates to (`createFacetHost`), the facet worker template, the
 * env snippet, validation, and `evaluate()` wired to a fake loader with the
 * `cloudflare:workers` loopback mocked so `ctx.exports.SandboxHost` answers
 * a fake namespace built on `createFacetHost`.
 *
 * What the fake loader witnesses: with `facet` set, `evaluate()` attaches
 * the facet worker to the sandbox's host before the script runs, the loaded
 * script worker's env carries the host stub under the reserved key, and the
 * first call into the facet starts it - `WorkerStub.getDurableObjectClass
 * ('State')` is called on the facet worker and `ctx.facets.get(name, ...)`'s
 * startup receives `{ class, id }`. The workers suite
 * (test/workers/facets.workers.test.ts) runs the same wiring against workerd.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  createFacetHost,
  facetBindingName,
  facetEnvSource,
  generateFacetWorkerCode,
  loopbackSandboxHost,
  facetNotAttachedError,
  SANDBOX_HOST_BINDING_KEY,
  SANDBOX_HOST_EXPORT,
  SANDBOX_JSON_MODULE,
  type FacetsApi,
  type FacetStartup,
  type FacetStub,
  type SandboxHostStub,
} from '../src/facets.js'
import { evaluate, buildWorkerCodeWithWarnings } from '../src/evaluate.js'
import { validateOptions, buildSandboxEnv, ValidationError } from '../src/validation.js'
import { workerCodeId } from '../src/shared.js'
import type { WorkerCode, WorkerLoader, WorkerStub } from '../src/types.js'

/** The namespace the mocked loopback hands out; replaced per test via `hosts.current` */
const hosts = vi.hoisted(() => ({
  current: null as { getByName(name: string): SandboxHostStub } | null,
}))

vi.mock('cloudflare:workers', () => ({
  get exports() {
    return { SandboxHost: hosts.current }
  },
  RpcTarget: class {},
  WorkerEntrypoint: class {},
  DurableObject: class {},
}))

/** A fake `ctx.facets`: records startups, aborts and deletes; each facet is a counter */
function createFakeFacets() {
  const startups = new Map<string, FacetStartup>()
  const aborted: [string, unknown][] = []
  const deleted: string[] = []
  const counters = new Map<string, number>()
  const stubFor = (name: string): FacetStub => ({
    fetch: async (request: Request) => new Response(`facet ${name} ${request.method}`),
    incr: () => {
      const n = (counters.get(name) ?? 0) + 1
      counters.set(name, n)
      return n
    },
  })
  const facets: FacetsApi = {
    get(name, startup) {
      if (!startups.has(name)) {
        const result = startup()
        if (result instanceof Promise) throw new Error('fake facets: sync startup expected')
        startups.set(name, result)
      }
      return stubFor(name)
    },
    abort(name, reason) {
      aborted.push([name, reason])
      startups.delete(name)
    },
    delete(name) {
      deleted.push(name)
      startups.delete(name)
      counters.delete(name)
    },
  }
  return { facets, startups, aborted, deleted }
}

/**
 * A fake loader for both workers of an evaluation. A stub's entrypoint plays
 * the sandbox: it reads the host stub out of the loaded env and calls the
 * facet through it, the way the generated proxy does. `getDurableObjectClass`
 * records the class name it was asked for and answers a marker object.
 */
function createFakeLoader() {
  const classes: { id: string; name: string | undefined }[] = []
  const loaded: { id: string | null; code: WorkerCode }[] = []
  const stubFor = (
    id: string | null,
    resolve: () => WorkerCode | Promise<WorkerCode>
  ): WorkerStub => ({
    getDurableObjectClass: (name) => {
      classes.push({ id: id ?? '', name })
      return { durableObjectClass: name }
    },
    getEntrypoint: () => ({
      fetch: async () => {
        const code = await resolve()
        loaded.push({ id, code })
        const host = code.env?.[SANDBOX_HOST_BINDING_KEY] as SandboxHostStub | undefined
        if (!host) return Response.json({ success: true, value: 'no host', logs: [], duration: 0 })
        const value = await host.invoke('State', 'incr', [])
        const text = await (
          await host.fetchFacet('State', new Request('http://f/', { method: 'PUT' }))
        ).text()
        return Response.json({ success: true, value: { value, text }, logs: [], duration: 0 })
      },
    }),
  })
  const loader: WorkerLoader = {
    get: (id, factory) => stubFor(id, factory),
    load: (code) => stubFor(null, () => code),
  }
  return { loader, classes, loaded }
}

const STATE_MODULE = `export class State {
  constructor(ctx) { this.sql = ctx.storage.sql }
  incr() { return 1 }
}`

describe('createFacetHost', () => {
  it(`the export name is ${SANDBOX_HOST_EXPORT}`, () => {
    expect(SANDBOX_HOST_EXPORT).toBe('SandboxHost')
  })

  it('starts a facet from the attached worker: getDurableObjectClass(className), { class, id } to facets.get', async () => {
    const fake = createFakeFacets()
    const { loader, classes } = createFakeLoader()
    const host = createFacetHost({ facets: fake.facets }, loader)
    const code: WorkerCode = { mainModule: 'w.js', modules: { 'w.js': STATE_MODULE } }
    await host.attach('State', {
      code,
      codeId: 'facet-1',
      className: 'State',
      id: 'sandbox-a/State',
    })
    // Attaching starts nothing; the first call does
    expect(fake.startups.size).toBe(0)
    expect(await host.invoke('State', 'incr', [])).toBe(1)
    expect(classes).toEqual([{ id: 'facet-1', name: 'State' }])
    expect(fake.startups.get('State')).toEqual({
      class: { durableObjectClass: 'State' },
      id: 'sandbox-a/State',
    })
    expect(await host.invoke('State', 'incr', [])).toBe(2)
    // One startup: the facet stays up across calls
    expect(classes).toHaveLength(1)
    expect(host.attached()).toEqual(['State'])
  })

  it('forwards fetch to the facet', async () => {
    const fake = createFakeFacets()
    const host = createFacetHost({ facets: fake.facets }, createFakeLoader().loader)
    await host.attach('State', {
      code: { mainModule: 'w.js', modules: {} },
      codeId: 'x',
      className: 'State',
    })
    const response = await host.fetchFacet('State', new Request('http://facet/', { method: 'PUT' }))
    expect(await response.text()).toBe('facet State PUT')
  })

  it('re-attaching under another worker id aborts the facet, so it restarts on the new class', async () => {
    const fake = createFakeFacets()
    const { loader, classes } = createFakeLoader()
    const host = createFacetHost({ facets: fake.facets }, loader)
    const code: WorkerCode = { mainModule: 'w.js', modules: {} }
    await host.attach('State', { code, codeId: 'facet-1', className: 'State' })
    await host.invoke('State', 'incr', [])
    // Same id: nothing happens
    await host.attach('State', { code, codeId: 'facet-1', className: 'State' })
    expect(fake.aborted).toEqual([])
    // New id: aborted, and the next call starts it from the new worker
    await host.attach('State', { code, codeId: 'facet-2', className: 'State' })
    expect(fake.aborted).toHaveLength(1)
    expect(fake.aborted[0]?.[0]).toBe('State')
    await host.invoke('State', 'incr', [])
    expect(classes.map((c) => c.id)).toEqual(['facet-1', 'facet-2'])
  })

  it('detach deletes the facet (and its storage) and forgets the spec', async () => {
    const fake = createFakeFacets()
    const host = createFacetHost({ facets: fake.facets }, createFakeLoader().loader)
    await host.attach('State', {
      code: { mainModule: 'w.js', modules: {} },
      codeId: 'x',
      className: 'State',
    })
    await host.detach('State')
    expect(fake.deleted).toEqual(['State'])
    expect(host.attached()).toEqual([])
    await expect(host.invoke('State', 'incr', [])).rejects.toThrow(
      facetNotAttachedError('State').message
    )
  })

  it('a call into a facet that was never attached fails with a message naming it', async () => {
    const fake = createFakeFacets()
    const host = createFacetHost({ facets: fake.facets }, createFakeLoader().loader)
    await expect(host.invoke('Other', 'incr', [])).rejects.toThrow('facet Other is not attached')
  })

  it('a missing method is an error, not an RPC into nothing', async () => {
    const fake = createFakeFacets()
    const host = createFacetHost({ facets: fake.facets }, createFakeLoader().loader)
    await host.attach('State', {
      code: { mainModule: 'w.js', modules: {} },
      codeId: 'x',
      className: 'State',
    })
    await expect(host.invoke('State', 'nope', [])).rejects.toThrow('facet State has no method nope')
  })

  it('a host without a loader binding reports it at the first start', async () => {
    const fake = createFakeFacets()
    const host = createFacetHost({ facets: fake.facets }, undefined)
    await host.attach('State', {
      code: { mainModule: 'w.js', modules: {} },
      codeId: 'x',
      className: 'State',
    })
    await expect(host.invoke('State', 'incr', [])).rejects.toThrow('no `loader` binding')
  })
})

describe('facet worker template', () => {
  it('exports the class under its name, wrapped as a DurableObject subclass', () => {
    const code = generateFacetWorkerCode({ module: STATE_MODULE, className: 'State' })
    expect(code).toContain(
      "import { DurableObject as __DurableObject__ } from 'cloudflare:workers'"
    )
    expect(code).toContain('export { __Facet__ as State }')
    expect(code).toContain('exports["State"]')
    expect(code).toContain('__wrapFacetClass__')
    // The module's export is rewritten onto the exports record, as in the sandbox worker
    expect(code).toContain('class State')
    expect(code).toContain('exports.State = State')
    expect(code).not.toContain('export class State')
  })

  it('places hoisted imports and the preamble at the top level', () => {
    const code = generateFacetWorkerCode({
      module: 'export class S {}',
      className: 'S',
      imports: ["import { DurableObject } from 'cloudflare:workers';"],
      preamble: 'globalThis.marker = 1;',
    })
    expect(code.indexOf("import { DurableObject } from 'cloudflare:workers';")).toBeLessThan(
      code.indexOf('const exports = {}')
    )
    expect(code.indexOf('globalThis.marker = 1;')).toBeLessThan(code.indexOf('const exports = {}'))
  })

  it('facetBindingName: CONSTANT_CASE of the class unless binding is set', () => {
    expect(facetBindingName({ class: 'State' })).toBe('STATE')
    expect(facetBindingName({ class: 'ReplState' })).toBe('REPL_STATE')
    expect(facetBindingName({ class: 'Counter2Store' })).toBe('COUNTER2_STORE')
    expect(facetBindingName({ class: 'State', binding: 'COUNTER' })).toBe('COUNTER')
  })

  it('facetEnvSource strips the reserved key and adds the proxy only with a facet', () => {
    const without = facetEnvSource()
    // A module-scope const function: the stub and the loader env are named
    // only inside it, never in the scope the script is inlined into
    expect(without.startsWith('const __sandboxEnv__ = (__env__) => {')).toBe(true)
    expect(without).toContain(`[${JSON.stringify(SANDBOX_HOST_BINDING_KEY)}]: __sandboxHost__`)
    expect(without).not.toContain('new Proxy')
    const withFacet = facetEnvSource({ binding: 'STATE', name: 'State' })
    expect(withFacet.startsWith('const __sandboxEnv__ = (__env__) => {')).toBe(true)
    expect(withFacet).toContain('new Proxy')
    expect(withFacet).toContain('__sandboxHost__.invoke("State", method, args)')
    expect(withFacet).toContain('__sandboxHost__.fetchFacet("State", new Request(input, init))')
    expect(withFacet).toContain('["STATE"]: __facet__')
  })
})

describe('validation', () => {
  const valid = { module: STATE_MODULE, script: '1', facet: { class: 'State' }, sandboxId: 's' }

  it('accepts a facet with a module and a sandboxId', () => {
    expect(() => validateOptions(valid)).not.toThrow()
    expect(() =>
      validateOptions({ ...valid, facet: { class: 'State', id: 'x', binding: 'S' } })
    ).not.toThrow()
  })

  it('requires sandboxId with facet', () => {
    expect(() => validateOptions({ ...valid, sandboxId: undefined })).toThrow(ValidationError)
    expect(() => validateOptions({ ...valid, sandboxId: undefined })).toThrow(/sandboxId/)
  })

  it('requires a module exporting the class', () => {
    expect(() => validateOptions({ ...valid, module: undefined })).toThrow(/needs a module/)
  })

  it('checks the shapes of class, id, binding and sandboxId', () => {
    expect(() => validateOptions({ ...valid, facet: { class: 'not a class' } })).toThrow(
      /facet\.class/
    )
    expect(() => validateOptions({ ...valid, facet: { class: 'State', id: '' } })).toThrow(
      /facet\.id/
    )
    expect(() => validateOptions({ ...valid, facet: { class: 'State', binding: '1x' } })).toThrow(
      /facet\.binding/
    )
    expect(() => validateOptions({ ...valid, facet: [] as unknown as { class: string } })).toThrow(
      /facet must be/
    )
    expect(() => validateOptions({ ...valid, sandboxId: '' })).toThrow(/sandboxId/)
    expect(() => validateOptions({ ...valid, sandboxId: 'x'.repeat(257) })).toThrow(
      /sandboxId length/
    )
  })

  it('rejects a facet binding that collides with env, bindings or a reserved key', () => {
    expect(() => validateOptions({ ...valid, env: { STATE: 'x' } })).toThrow(/env\.STATE collides/)
    expect(() => validateOptions({ ...valid, bindings: { STATE: 1 } })).toThrow(
      /bindings\.STATE collides/
    )
    expect(() => validateOptions({ ...valid, facet: { class: 'Test', binding: 'TEST' } })).toThrow(
      /reserved/
    )
  })

  it('reserves the SandboxHost stub key in env and bindings', () => {
    expect(() => buildSandboxEnv({ env: { [SANDBOX_HOST_BINDING_KEY]: 'x' } })).toThrow(/reserved/)
    expect(() => buildSandboxEnv({ bindings: { [SANDBOX_HOST_BINDING_KEY]: 1 } })).toThrow(
      /reserved/
    )
  })
})

describe('evaluate() with a facet (fake loader, mocked loopback)', () => {
  const options = {
    module: STATE_MODULE,
    script: 'return await env.STATE.incr()',
    facet: { class: 'State' as const, id: 'facet-id' },
    sandboxId: 'sandbox-a',
  }

  it('attaches the facet worker to the sandbox host and hands the script worker the host stub', async () => {
    const { loader, classes, loaded } = createFakeLoader()
    // One SandboxHost (with its own facets) per sandboxId, as getByName does
    const byName = new Map<string, ReturnType<typeof createFacetHost>>()
    const fakes = new Map<string, ReturnType<typeof createFakeFacets>>()
    const getByName = (name: string) => {
      let host = byName.get(name)
      if (!host) {
        const facets = createFakeFacets()
        fakes.set(name, facets)
        host = createFacetHost({ facets: facets.facets }, loader)
        byName.set(name, host)
      }
      return host
    }
    const fake = {
      get startups() {
        return fakes.get('sandbox-a')!.startups
      },
    }
    hosts.current = { getByName }
    try {
      expect(await loopbackSandboxHost()).not.toBeNull()

      const built = await buildWorkerCodeWithWarnings(options)
      expect(built.facet?.name).toBe('State')
      expect(built.facet?.spec.className).toBe('State')
      expect(built.facet?.spec.id).toBe('facet-id')
      expect(built.facet?.spec.codeId).toBe(workerCodeId(built.facet!.spec.code))
      // The facet worker is the module without the script, exporting the class
      const facetMain = built.facet!.spec.code.modules[built.facet!.spec.code.mainModule] as string
      expect(facetMain).toContain('export { __Facet__ as State }')
      expect(facetMain).not.toContain('env.STATE.incr()')
      // ... content-addressed apart from the script worker
      expect(built.facet!.spec.codeId).not.toBe(workerCodeId(built.code))
      // The script worker carries the host stub under the reserved key; the facet worker does not
      expect(built.code.env?.[SANDBOX_HOST_BINDING_KEY]).toBe(getByName('sandbox-a'))
      expect(built.facet!.spec.code.env).not.toHaveProperty(SANDBOX_HOST_BINDING_KEY)
      // ... and exposes the proxy under the binding
      const scriptMain = built.code.modules[built.code.mainModule] as string
      expect(scriptMain).toContain('["STATE"]: __facet__')

      const result = await evaluate(options, { loader })
      expect(result.success, result.error).toBe(true)
      expect(result.value).toEqual({ value: 1, text: 'facet State PUT' })
      // The facet started from the facet worker: getDurableObjectClass('State') on it
      expect(classes).toEqual([{ id: built.facet!.spec.codeId, name: 'State' }])
      expect(fake.startups.get('State')).toEqual({
        class: { durableObjectClass: 'State' },
        id: 'facet-id',
      })
      // Same sandbox: the facet counts on; another sandbox: its own facet
      expect((await evaluate(options, { loader })).value).toEqual({
        value: 2,
        text: 'facet State PUT',
      })
      expect(
        (await evaluate({ ...options, sandboxId: 'sandbox-b' }, { loader })).value
      ).toMatchObject({
        value: 1,
      })
      expect(byName.size).toBe(2)
      // The script worker was loaded fresh each time, the facet worker once per host
      expect(loaded.filter((entry) => entry.id === null)).toHaveLength(3)
    } finally {
      hosts.current = null
    }
  })

  it('the script worker is content-addressed per sandboxId (sandbox.json); the facet worker is not (aip-263g.39)', async () => {
    const { loader, loaded } = createFakeLoader()
    const byName = new Map<string, ReturnType<typeof createFacetHost>>()
    hosts.current = {
      getByName: (name: string) => {
        let host = byName.get(name)
        if (!host) {
          host = createFacetHost({ facets: createFakeFacets().facets }, loader)
          byName.set(name, host)
        }
        return host
      },
    }
    try {
      const a = await buildWorkerCodeWithWarnings(options)
      const again = await buildWorkerCodeWithWarnings(options)
      const b = await buildWorkerCodeWithWarnings({ ...options, sandboxId: 'sandbox-b' })
      expect(a.code.modules[SANDBOX_JSON_MODULE]).toEqual({
        json: { sandboxId: 'sandbox-a', facet: 'State' },
      })
      expect(workerCodeId(a.code)).toBe(workerCodeId(again.code))
      expect(workerCodeId(a.code)).not.toBe(workerCodeId(b.code))
      expect(a.facet!.spec.code.modules).not.toHaveProperty(SANDBOX_JSON_MODULE)
      expect(a.facet!.spec.codeId).toBe(b.facet!.spec.codeId)
      // Without a facet there is no sandbox.json: sandboxId alone does not change the id
      const plain = await buildWorkerCodeWithWarnings({
        script: 'return 1',
        sandboxId: 'sandbox-a',
      })
      expect(plain.code.modules).not.toHaveProperty(SANDBOX_JSON_MODULE)

      // Under 'cached' the loader is asked for one id per sandbox: b never gets a's isolate
      expect((await evaluate({ ...options, isolation: 'cached' }, { loader })).value).toMatchObject(
        { value: 1 }
      )
      expect((await evaluate({ ...options, isolation: 'cached' }, { loader })).value).toMatchObject(
        { value: 2 }
      )
      expect(
        (await evaluate({ ...options, sandboxId: 'sandbox-b', isolation: 'cached' }, { loader }))
          .value
      ).toMatchObject({ value: 1 })
      expect(loaded.filter((entry) => entry.id !== null).map((entry) => entry.id)).toEqual([
        workerCodeId(a.code),
        workerCodeId(a.code),
        workerCodeId(b.code),
      ])
    } finally {
      hosts.current = null
    }
  })

  it('a changed module restarts the facet on the new class', async () => {
    const fake = createFakeFacets()
    const { loader, classes } = createFakeLoader()
    const host = createFacetHost({ facets: fake.facets }, loader)
    hosts.current = { getByName: () => host }
    try {
      await evaluate(options, { loader })
      await evaluate({ ...options, module: `${STATE_MODULE}\nexport const v = 2` }, { loader })
      expect(fake.aborted).toHaveLength(1)
      expect(classes).toHaveLength(2)
      expect(classes[0]!.id).not.toBe(classes[1]!.id)
    } finally {
      hosts.current = null
    }
  })

  it('without a SandboxHost export the evaluation fails closed before any load', async () => {
    hosts.current = null
    const { loader, loaded } = createFakeLoader()
    const result = await evaluate(options, { loader })
    expect(result.success).toBe(false)
    expect(result.error).toContain('SandboxHost')
    expect(loaded).toEqual([])
  })

  it('facet without sandboxId is a validation error result', async () => {
    const { loader } = createFakeLoader()
    const result = await evaluate({ ...options, sandboxId: undefined }, { loader })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/sandboxId/)
  })
})
