import { describe, it, expect } from 'vitest'
import { matchesDomainPattern, isDomainAllowed, generateDomainCheckCode } from '../src/shared.js'

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
