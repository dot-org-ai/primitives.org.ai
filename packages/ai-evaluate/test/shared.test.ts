import { describe, it, expect } from 'vitest'
import {
  matchesDomainPattern,
  isDomainAllowed,
  generateDomainCheckCode,
  workerCodeId,
  stableStringify,
} from '../src/shared.js'
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

  describe('generateDomainCheckCode', () => {
    it('generates valid JavaScript code', () => {
      const code = generateDomainCheckCode(['api.example.com', '*.trusted.com'])
      expect(code).toContain('__allowedDomains__')
      expect(code).toContain('__matchesDomainPattern__')
      expect(code).toContain('__isDomainAllowed__')
      expect(code).toContain('globalThis.fetch')
    })

    it('includes the allowed domains in the generated code', () => {
      const code = generateDomainCheckCode(['api.example.com', '*.trusted.com'])
      expect(code).toContain('api.example.com')
      expect(code).toContain('*.trusted.com')
    })

    it('generates code that throws for blocked domains', () => {
      const code = generateDomainCheckCode(['api.example.com'])
      expect(code).toContain('not in allowlist')
    })
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
