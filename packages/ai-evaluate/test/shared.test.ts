import { describe, it, expect } from 'vitest'
import {
  matchesDomainPattern,
  isDomainAllowed,
  workerCodeId,
  stableStringify,
  parseImportSpecifier,
  partitionImports,
  extractPackageName,
  packageJsonModule,
  PACKAGE_JSON_MODULE,
} from '../src/shared.js'
import {
  createOutboundGateway,
  outboundPolicy,
  gatewayFromProps,
  registerInterceptor,
  releaseInterceptor,
  registeredInterceptorCount,
  loopbackOutboundGateway,
  blockedHostError,
  INTERCEPTOR_UNAVAILABLE_ERROR,
} from '../src/outbound.js'
import type { WorkerCode } from '../src/types.js'

describe('domain matching utilities', () => {
  describe('matchesDomainPattern', () => {
    describe('exact matching', () => {
      it('matches exact domain', () => {
        expect(matchesDomainPattern('api.example.com', 'api.example.com')).toBe(true)
      })

      it('does not match different domains', () => {
        expect(matchesDomainPattern('api.example.com', 'other.example.com')).toBe(false)
      })

      it('is case-insensitive', () => {
        expect(matchesDomainPattern('API.EXAMPLE.COM', 'api.example.com')).toBe(true)
        expect(matchesDomainPattern('api.example.com', 'API.EXAMPLE.COM')).toBe(true)
      })
    })

    describe('wildcard matching', () => {
      it('matches subdomain with wildcard pattern', () => {
        expect(matchesDomainPattern('api.example.com', '*.example.com')).toBe(true)
        expect(matchesDomainPattern('data.example.com', '*.example.com')).toBe(true)
        expect(matchesDomainPattern('nested.api.example.com', '*.example.com')).toBe(true)
      })

      it('matches root domain with wildcard pattern', () => {
        // Wildcard also matches the root domain itself
        expect(matchesDomainPattern('example.com', '*.example.com')).toBe(true)
      })

      it('does not match unrelated domains with wildcard', () => {
        expect(matchesDomainPattern('api.other.com', '*.example.com')).toBe(false)
        expect(matchesDomainPattern('example.com.evil.com', '*.example.com')).toBe(false)
      })

      it('wildcard is case-insensitive', () => {
        expect(matchesDomainPattern('API.EXAMPLE.COM', '*.example.com')).toBe(true)
        expect(matchesDomainPattern('api.example.com', '*.EXAMPLE.COM')).toBe(true)
      })
    })
  })

  describe('isDomainAllowed', () => {
    it('returns true for allowed exact domain', () => {
      expect(isDomainAllowed('https://api.example.com/path', ['api.example.com'])).toBe(true)
    })

    it('returns false for non-allowed domain', () => {
      expect(isDomainAllowed('https://blocked.com/path', ['api.example.com'])).toBe(false)
    })

    it('returns true for domain matching wildcard', () => {
      expect(isDomainAllowed('https://api.example.com/path', ['*.example.com'])).toBe(true)
    })

    it('supports multiple allowed domains', () => {
      const allowed = ['api.example.com', '*.trusted.com', 'data.org']
      expect(isDomainAllowed('https://api.example.com/path', allowed)).toBe(true)
      expect(isDomainAllowed('https://any.trusted.com/path', allowed)).toBe(true)
      expect(isDomainAllowed('https://data.org/path', allowed)).toBe(true)
      expect(isDomainAllowed('https://blocked.com/path', allowed)).toBe(false)
    })

    it('returns false for invalid URLs', () => {
      expect(isDomainAllowed('not-a-url', ['api.example.com'])).toBe(false)
    })

    it('returns false for empty allowlist', () => {
      expect(isDomainAllowed('https://example.com', [])).toBe(false)
    })

    it('handles URLs with ports', () => {
      expect(isDomainAllowed('https://api.example.com:8080/path', ['api.example.com'])).toBe(true)
    })

    it('handles URLs with authentication', () => {
      expect(isDomainAllowed('https://user:pass@api.example.com/path', ['api.example.com'])).toBe(
        true
      )
    })
  })
})

describe('outbound gateway (src/outbound.ts)', () => {
  /** An upstream that never touches the network: records the request, answers 200 */
  function upstreamMock() {
    const forwarded: string[] = []
    const upstream = async (request: Request) => {
      forwarded.push(`${request.method} ${request.url}`)
      return new Response(`upstream ${new URL(request.url).hostname}`, { status: 200 })
    }
    return { upstream, forwarded }
  }

  describe('createOutboundGateway', () => {
    it('is Fetcher-shaped: rejects a host outside the allowlist and forwards one inside', async () => {
      const { upstream, forwarded } = upstreamMock()
      const gateway = createOutboundGateway(['a.com'], undefined, upstream)
      expect(typeof gateway.fetch).toBe('function')

      await expect(gateway.fetch(new Request('https://evil.com/x'))).rejects.toThrow(
        'Network access blocked: domain not in allowlist. Attempted: evil.com'
      )
      expect(forwarded).toEqual([])

      const response = await gateway.fetch(new Request('https://a.com/x'))
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('upstream a.com')
      expect(forwarded).toEqual(['GET https://a.com/x'])
    })

    it('accepts a URL string with init, like fetch', async () => {
      const { upstream, forwarded } = upstreamMock()
      const gateway = createOutboundGateway(['a.com'], undefined, upstream)
      await gateway.fetch('https://a.com/post', { method: 'POST', body: 'x' })
      expect(forwarded).toEqual(['POST https://a.com/post'])
      await expect(gateway.fetch('https://b.com/')).rejects.toThrow(/not in allowlist/)
    })

    it('uses isDomainAllowed: wildcards admit subdomains and the apex, nothing else', async () => {
      const { upstream, forwarded } = upstreamMock()
      const gateway = createOutboundGateway(['*.example.com'], undefined, upstream)
      await gateway.fetch('https://api.example.com/')
      await gateway.fetch('https://example.com/')
      await expect(gateway.fetch('https://notexample.com/')).rejects.toThrow(/not in allowlist/)
      await expect(gateway.fetch('https://example.com.evil.test/')).rejects.toThrow(
        /Attempted: example.com.evil.test/
      )
      expect(forwarded).toEqual(['GET https://api.example.com/', 'GET https://example.com/'])
    })

    it('an empty allowlist blocks every host; null restricts none', async () => {
      const { upstream, forwarded } = upstreamMock()
      await expect(
        createOutboundGateway([], undefined, upstream).fetch('https://a.com/')
      ).rejects.toThrow(/not in allowlist/)
      await createOutboundGateway(null, undefined, upstream).fetch('https://anything.test/')
      expect(forwarded).toEqual(['GET https://anything.test/'])
    })

    it('does not mutate or share the allowlist it was given', async () => {
      const { upstream } = upstreamMock()
      const hosts = ['a.com']
      const gateway = createOutboundGateway(hosts, undefined, upstream)
      hosts.push('evil.com')
      await expect(gateway.fetch('https://evil.com/')).rejects.toThrow(/not in allowlist/)
    })

    it('uses the default upstream (global fetch) when none is given', () => {
      expect(() => createOutboundGateway(['a.com'])).not.toThrow()
    })
  })

  describe('outboundRpc through the gateway', () => {
    it('is asked first: a Response answers the request, null declines it to the allowlist', async () => {
      const { upstream, forwarded } = upstreamMock()
      const asked: string[] = []
      const outboundRpc = (url: string) => {
        asked.push(url)
        return url.startsWith('https://rpc.test') ? new Response('rpc', { status: 201 }) : null
      }
      const gateway = createOutboundGateway(['a.com'], outboundRpc, upstream)

      const served = await gateway.fetch('https://rpc.test/call')
      expect(served.status).toBe(201)
      await gateway.fetch('https://a.com/')
      await expect(gateway.fetch('https://evil.com/')).rejects.toThrow(/not in allowlist/)

      expect(asked).toEqual(['https://rpc.test/call', 'https://a.com/', 'https://evil.com/'])
      expect(forwarded).toEqual(['GET https://a.com/'])
    })

    it('hands the interceptor a clone, so a declined request still has its body', async () => {
      const bodies: string[] = []
      const upstream = async (request: Request) => new Response(await request.text())
      const outboundRpc = async (_url: string, request: Request) => {
        bodies.push(await request.text())
        return null
      }
      const gateway = createOutboundGateway(null, outboundRpc, upstream)
      const response = await gateway.fetch('https://a.com/', { method: 'POST', body: 'payload' })
      expect(await response.text()).toBe('payload')
      expect(bodies).toEqual(['payload'])
    })
  })

  describe('outboundPolicy', () => {
    it('an allowlist always needs the gateway', () => {
      expect(outboundPolicy({ fetch: ['a.com'] })).toEqual({ allowlist: ['a.com'] })
      expect(outboundPolicy({ fetch: ['a.com'], outboundRpc: () => null })).toEqual({
        allowlist: ['a.com'],
      })
    })

    it('without outboundRpc, true / false / null / absent need no gateway', () => {
      expect(outboundPolicy({})).toBeNull()
      expect(outboundPolicy({ fetch: true })).toBeNull()
      expect(outboundPolicy({ fetch: false })).toBeNull()
      expect(outboundPolicy({ fetch: null })).toBeNull()
    })

    it('outboundRpc needs the gateway: blocking all else under false, restricting none under true', () => {
      const outboundRpc = () => null
      expect(outboundPolicy({ fetch: false, outboundRpc })).toEqual({ allowlist: [] })
      expect(outboundPolicy({ fetch: null, outboundRpc })).toEqual({ allowlist: [] })
      expect(outboundPolicy({ fetch: true, outboundRpc })).toEqual({ allowlist: null })
      expect(outboundPolicy({ outboundRpc })).toEqual({ allowlist: null })
    })
  })

  describe('interceptor registry (what the OutboundGateway entrypoint resolves from props)', () => {
    it('registers for the duration of an evaluation and resolves by id', async () => {
      const before = registeredInterceptorCount()
      const id = registerInterceptor(() => new Response('hit'))
      expect(registeredInterceptorCount()).toBe(before + 1)
      const gateway = gatewayFromProps({ allowlist: [], interceptor: id })
      expect(await (await gateway.fetch('https://anything.test/')).text()).toBe('hit')
      releaseInterceptor(id)
      expect(registeredInterceptorCount()).toBe(before)
      releaseInterceptor(id) // idempotent
      expect(registeredInterceptorCount()).toBe(before)
    })

    it('fails closed when props name an interceptor this isolate does not hold', () => {
      expect(() => gatewayFromProps({ allowlist: null, interceptor: 'not-registered' })).toThrow(
        INTERCEPTOR_UNAVAILABLE_ERROR
      )
    })

    it('props without an interceptor build a plain allowlist gateway', async () => {
      const gateway = gatewayFromProps({ allowlist: ['a.com'] })
      await expect(gateway.fetch('https://b.com/')).rejects.toThrow(/not in allowlist/)
    })
  })

  describe('loopbackOutboundGateway', () => {
    it('resolves to null outside workerd (no cloudflare:workers loopback bindings)', async () => {
      expect(await loopbackOutboundGateway()).toBeNull()
    })
  })

  describe('blockedHostError', () => {
    it('names the attempted host, or the raw input when it is not a URL', () => {
      expect(blockedHostError('https://user:pw@evil.com:8443/p?q').message).toBe(
        'Network access blocked: domain not in allowlist. Attempted: evil.com'
      )
      expect(blockedHostError('not a url').message).toContain('Attempted: not a url')
    })
  })
})

describe('import specifiers', () => {
  it('parseImportSpecifier splits name and version', () => {
    expect(parseImportSpecifier('lodash')).toEqual({ name: 'lodash', version: 'latest' })
    expect(parseImportSpecifier('lodash@4.17.21')).toEqual({ name: 'lodash', version: '4.17.21' })
    expect(parseImportSpecifier('@scope/pkg')).toEqual({ name: '@scope/pkg', version: 'latest' })
    expect(parseImportSpecifier('@scope/pkg@1.0.0')).toEqual({
      name: '@scope/pkg',
      version: '1.0.0',
    })
    expect(parseImportSpecifier('pkg@^4')).toEqual({ name: 'pkg', version: '^4' })
  })

  it('parseImportSpecifier rejects URLs, paths, subpaths and malformed names', () => {
    for (const bad of [
      'https://esm.sh/lodash',
      './local.js',
      'lodash/fp',
      'Lodash',
      '',
      '@scope',
      'lodash@',
      'a b',
    ]) {
      expect(parseImportSpecifier(bad)).toBeNull()
    }
  })

  it('partitionImports splits bare specifiers (as dependencies) from URLs', () => {
    expect(
      partitionImports(['lodash@4.17.21', 'https://esm.sh/zod@3', '@scope/pkg'], { hono: '^4' })
    ).toEqual({
      dependencies: { hono: '^4', lodash: '4.17.21', '@scope/pkg': 'latest' },
      urls: ['https://esm.sh/zod@3'],
    })
  })

  it('partitionImports lets an explicit dependency win over an imports version', () => {
    expect(partitionImports(['lodash@4.17.20'], { lodash: '4.17.21' }).dependencies).toEqual({
      lodash: '4.17.21',
    })
  })

  it('extractPackageName yields an identifier for scoped and hyphenated names', () => {
    expect(extractPackageName('lodash@4.17.21', 0)).toBe('lodash')
    expect(extractPackageName('@faker-js/faker', 0)).toBe('faker_js_faker')
    expect(extractPackageName('https://esm.sh/@scope/pkg@1.0.0', 0)).toBe('scope_pkg')
    expect(extractPackageName('https://esm.sh/lodash@4.17.21', 0)).toBe('lodash')
    expect(extractPackageName('https://cdn.example.test/x.js', 3)).toBe('pkg3')
  })

  it('packageJsonModule is a json module with sorted dependencies', () => {
    expect(packageJsonModule({ zod: '3', lodash: '4' })).toEqual({
      json: { dependencies: { lodash: '4', zod: '3' } },
    })
    expect(Object.keys(packageJsonModule({ zod: '3', lodash: '4' }).json.dependencies)).toEqual([
      'lodash',
      'zod',
    ])
  })
})

describe('workerCodeId', () => {
  const spec = (): WorkerCode => ({
    mainModule: 'worker.js',
    modules: { 'worker.js': 'export default { fetch() { return new Response("a") } }' },
    compatibilityDate: '2026-01-01',
    compatibilityFlags: ['nodejs_compat'],
    limits: { cpuMs: 100 },
    env: { TEST: { connect: () => {} } },
  })

  it('is deterministic: the same spec yields the same id', () => {
    expect(workerCodeId(spec())).toBe(workerCodeId(spec()))
  })

  it('is prefixed and content-shaped', () => {
    expect(workerCodeId(spec())).toMatch(/^sandbox-[0-9a-z]+$/)
  })

  it('ignores property order', () => {
    const a = spec()
    const b: WorkerCode = {
      env: a.env,
      limits: { cpuMs: 100 },
      compatibilityFlags: ['nodejs_compat'],
      compatibilityDate: '2026-01-01',
      modules: a.modules,
      mainModule: a.mainModule,
    }
    expect(workerCodeId(b)).toBe(workerCodeId(a))
  })

  it('changes when the main module content changes', () => {
    const changed = spec()
    changed.modules = { 'worker.js': 'export default { fetch() { return new Response("b") } }' }
    expect(workerCodeId(changed)).not.toBe(workerCodeId(spec()))
  })

  it('changes when compatibilityFlags change', () => {
    const changed = spec()
    changed.compatibilityFlags = ['nodejs_compat', 'experimental']
    expect(workerCodeId(changed)).not.toBe(workerCodeId(spec()))

    const removed = spec()
    delete removed.compatibilityFlags
    expect(workerCodeId(removed)).not.toBe(workerCodeId(spec()))
  })

  it('changes when compatibilityDate changes', () => {
    const changed = spec()
    changed.compatibilityDate = '2025-01-01'
    expect(workerCodeId(changed)).not.toBe(workerCodeId(spec()))
  })

  it('changes when limits.cpuMs changes', () => {
    const changed = spec()
    changed.limits = { cpuMs: 200 }
    expect(workerCodeId(changed)).not.toBe(workerCodeId(spec()))
  })

  it('changes when a module is added', () => {
    const changed = spec()
    changed.modules = { ...changed.modules, 'extra.js': 'export const x = 1' }
    expect(workerCodeId(changed)).not.toBe(workerCodeId(spec()))
  })

  it('changes when an object-form module changes content', () => {
    const a = spec()
    a.modules = { ...a.modules, 'text.txt': { text: 'one' } }
    const b = spec()
    b.modules = { ...b.modules, 'text.txt': { text: 'two' } }
    expect(workerCodeId(a)).not.toBe(workerCodeId(b))
  })

  it('changes when a binary (wasm/data) module changes bytes', () => {
    const a = spec()
    a.modules = { ...a.modules, 'mod.wasm': { wasm: new Uint8Array([0, 97, 115, 109, 1]).buffer } }
    const b = spec()
    b.modules = { ...b.modules, 'mod.wasm': { wasm: new Uint8Array([0, 97, 115, 109, 2]).buffer } }
    const a2 = spec()
    a2.modules = {
      ...a2.modules,
      'mod.wasm': { wasm: new Uint8Array([0, 97, 115, 109, 1]).buffer },
    }
    expect(workerCodeId(a)).not.toBe(workerCodeId(b))
    expect(workerCodeId(a)).toBe(workerCodeId(a2))
  })

  it('changes when allowExperimental changes', () => {
    const changed = spec()
    changed.allowExperimental = true
    expect(workerCodeId(changed)).not.toBe(workerCodeId(spec()))
  })

  it('changes when outbound fetch is blocked (globalOutbound: null)', () => {
    const blocked = spec()
    blocked.globalOutbound = null
    expect(workerCodeId(blocked)).not.toBe(workerCodeId(spec()))
  })

  it('does not change when env values change', () => {
    const a = spec()
    a.env = { TEST: { connect: () => {} }, SECRET: 'one' }
    const b = spec()
    b.env = { SECRET: 'two' }
    const c = spec()
    delete c.env
    expect(workerCodeId(a)).toBe(workerCodeId(spec()))
    expect(workerCodeId(b)).toBe(workerCodeId(spec()))
    expect(workerCodeId(c)).toBe(workerCodeId(spec()))
  })

  it('does not change when tails or a globalOutbound service change', () => {
    const withTails = spec()
    withTails.tails = [{ fetch: () => {} }]
    const withOutbound = spec()
    withOutbound.globalOutbound = { fetch: () => {} }
    expect(workerCodeId(withTails)).toBe(workerCodeId(spec()))
    expect(workerCodeId(withOutbound)).toBe(workerCodeId(spec()))
  })

  it('differs by dependency version (the package.json module)', () => {
    const withDeps = (dependencies: Record<string, string>): WorkerCode => {
      const withModule = spec()
      withModule.modules = {
        ...withModule.modules,
        [PACKAGE_JSON_MODULE]: packageJsonModule(dependencies),
      }
      return withModule
    }
    expect(workerCodeId(withDeps({ lodash: '4.17.21' }))).not.toBe(
      workerCodeId(withDeps({ lodash: '4.17.20' }))
    )
    expect(workerCodeId(withDeps({ lodash: '4.17.21' }))).not.toBe(workerCodeId(spec()))
    expect(workerCodeId(withDeps({ lodash: '4.17.21', zod: '3' }))).toBe(
      workerCodeId(withDeps({ zod: '3', lodash: '4.17.21' }))
    )
  })

  it('does not throw on non-serializable bindings', () => {
    const a = spec()
    const cyclic: Record<string, unknown> = {}
    cyclic['self'] = cyclic
    a.env = { cyclic, stub: new Proxy({}, { get: () => () => {} }) }
    expect(() => workerCodeId(a)).not.toThrow()
  })
})

describe('stableStringify', () => {
  it('sorts keys at every depth', () => {
    expect(stableStringify({ b: { z: 1, a: 2 }, a: [{ y: 1, x: 2 }] })).toBe(
      '{"a":[{"x":2,"y":1}],"b":{"a":2,"z":1}}'
    )
  })

  it('treats undefined and absent properties alike', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }))
  })

  it('preserves array order', () => {
    expect(stableStringify([2, 1])).not.toBe(stableStringify([1, 2]))
  })
})
