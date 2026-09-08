import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validateOptions,
  ValidationError,
  MAX_SCRIPT_SIZE,
  MAX_IMPORTS,
  MAX_TIMEOUT,
  DEFAULT_TIMEOUT,
} from '../src/validation.js'
import { evaluate } from '../src/evaluate.js'
import type * as ValidationModule from '../src/validation.js'
import type { WorkerLoader, WorkerStub } from '../src/types.js'

// Wrap `validateOptions` so the test below can witness `evaluate()` calling
// it; every other export (and the wrapped implementation) is the original.
vi.mock('../src/validation.js', async (importOriginal) => {
  const original = await importOriginal<typeof ValidationModule>()
  return { ...original, validateOptions: vi.fn(original.validateOptions) }
})

describe('validation', () => {
  describe('constants', () => {
    it('exports expected constant values', () => {
      expect(MAX_SCRIPT_SIZE).toBe(1024 * 1024) // 1MB
      expect(MAX_IMPORTS).toBe(100)
      expect(MAX_TIMEOUT).toBe(60000) // 60s
      expect(DEFAULT_TIMEOUT).toBe(5000) // 5s
    })
  })

  describe('validateOptions', () => {
    describe('valid options', () => {
      it('accepts empty options', () => {
        expect(() => validateOptions({})).not.toThrow()
      })

      it('accepts valid script', () => {
        expect(() => validateOptions({ script: 'return 1 + 1' })).not.toThrow()
      })

      it('accepts valid module', () => {
        expect(() => validateOptions({ module: 'export const x = 1' })).not.toThrow()
      })

      it('accepts valid tests', () => {
        expect(() => validateOptions({ tests: 'it("works", () => {})' })).not.toThrow()
      })

      it('accepts valid timeout', () => {
        expect(() => validateOptions({ timeout: 5000 })).not.toThrow()
        expect(() => validateOptions({ timeout: 1 })).not.toThrow()
        expect(() => validateOptions({ timeout: MAX_TIMEOUT })).not.toThrow()
      })

      it('accepts valid imports array', () => {
        expect(() => validateOptions({ imports: ['https://esm.sh/lodash'] })).not.toThrow()
        expect(() =>
          validateOptions({ imports: ['http://localhost:3000/module.js'] })
        ).not.toThrow()
      })

      it('accepts undefined values', () => {
        expect(() =>
          validateOptions({
            script: undefined,
            module: undefined,
            tests: undefined,
            timeout: undefined,
            imports: undefined,
          })
        ).not.toThrow()
      })
    })

    describe('timeout validation', () => {
      it('rejects non-number timeout', () => {
        expect(() => validateOptions({ timeout: '5000' as unknown as number })).toThrow(
          ValidationError
        )
        expect(() => validateOptions({ timeout: '5000' as unknown as number })).toThrow(
          'timeout must be a number'
        )
      })

      it('rejects non-finite timeout', () => {
        expect(() => validateOptions({ timeout: Infinity })).toThrow(ValidationError)
        expect(() => validateOptions({ timeout: Infinity })).toThrow(
          'timeout must be a finite number'
        )
        expect(() => validateOptions({ timeout: NaN })).toThrow('timeout must be a finite number')
      })

      it('rejects zero timeout', () => {
        expect(() => validateOptions({ timeout: 0 })).toThrow(ValidationError)
        expect(() => validateOptions({ timeout: 0 })).toThrow('timeout must be a positive number')
      })

      it('rejects negative timeout', () => {
        expect(() => validateOptions({ timeout: -1000 })).toThrow(ValidationError)
        expect(() => validateOptions({ timeout: -1000 })).toThrow(
          'timeout must be a positive number'
        )
      })

      it('rejects timeout exceeding maximum', () => {
        expect(() => validateOptions({ timeout: MAX_TIMEOUT + 1 })).toThrow(ValidationError)
        expect(() => validateOptions({ timeout: MAX_TIMEOUT + 1 })).toThrow(
          `timeout exceeds maximum allowed value of ${MAX_TIMEOUT}ms`
        )
      })
    })

    describe('script validation', () => {
      it('rejects non-string script', () => {
        expect(() => validateOptions({ script: 123 as unknown as string })).toThrow(ValidationError)
        expect(() => validateOptions({ script: 123 as unknown as string })).toThrow(
          'script must be a string'
        )
      })

      it('rejects script exceeding size limit', () => {
        const largeScript = 'a'.repeat(MAX_SCRIPT_SIZE + 1)
        expect(() => validateOptions({ script: largeScript })).toThrow(ValidationError)
        expect(() => validateOptions({ script: largeScript })).toThrow(
          /script size.*exceeds maximum allowed size/
        )
      })

      it('accepts script at exact size limit', () => {
        const maxScript = 'a'.repeat(MAX_SCRIPT_SIZE)
        expect(() => validateOptions({ script: maxScript })).not.toThrow()
      })
    })

    describe('module validation', () => {
      it('rejects non-string module', () => {
        expect(() => validateOptions({ module: {} as unknown as string })).toThrow(ValidationError)
        expect(() => validateOptions({ module: {} as unknown as string })).toThrow(
          'module must be a string'
        )
      })

      it('rejects module exceeding size limit', () => {
        const largeModule = 'a'.repeat(MAX_SCRIPT_SIZE + 1)
        expect(() => validateOptions({ module: largeModule })).toThrow(ValidationError)
        expect(() => validateOptions({ module: largeModule })).toThrow(
          /module size.*exceeds maximum allowed size/
        )
      })
    })

    describe('tests validation', () => {
      it('rejects non-string tests', () => {
        expect(() => validateOptions({ tests: [] as unknown as string })).toThrow(ValidationError)
        expect(() => validateOptions({ tests: [] as unknown as string })).toThrow(
          'tests must be a string'
        )
      })

      it('rejects tests exceeding size limit', () => {
        const largeTests = 'a'.repeat(MAX_SCRIPT_SIZE + 1)
        expect(() => validateOptions({ tests: largeTests })).toThrow(ValidationError)
        expect(() => validateOptions({ tests: largeTests })).toThrow(
          /tests size.*exceeds maximum allowed size/
        )
      })
    })

    describe('imports validation', () => {
      it('rejects non-array imports', () => {
        expect(() =>
          validateOptions({ imports: 'https://esm.sh/lodash' as unknown as string[] })
        ).toThrow(ValidationError)
        expect(() =>
          validateOptions({ imports: 'https://esm.sh/lodash' as unknown as string[] })
        ).toThrow('imports must be an array')
      })

      it('rejects imports exceeding count limit', () => {
        const tooManyImports = Array(MAX_IMPORTS + 1).fill('https://esm.sh/lodash')
        expect(() => validateOptions({ imports: tooManyImports })).toThrow(ValidationError)
        expect(() => validateOptions({ imports: tooManyImports })).toThrow(
          `imports count (${MAX_IMPORTS + 1}) exceeds maximum allowed count of ${MAX_IMPORTS}`
        )
      })

      it('accepts imports at exact count limit', () => {
        const maxImports = Array(MAX_IMPORTS).fill('https://esm.sh/lodash')
        expect(() => validateOptions({ imports: maxImports })).not.toThrow()
      })

      it('rejects non-string import entries', () => {
        expect(() => validateOptions({ imports: [123 as unknown as string] })).toThrow(
          ValidationError
        )
        expect(() => validateOptions({ imports: [123 as unknown as string] })).toThrow(
          'imports[0] must be a string'
        )
      })

      it('accepts bare package specifiers (normalized to esm.sh, as evaluate() does)', () => {
        expect(() =>
          validateOptions({ imports: ['lodash', 'dayjs@1.11.10', '@faker-js/faker'] })
        ).not.toThrow()
      })

      it('rejects invalid URLs', () => {
        expect(() => validateOptions({ imports: ['://not-a-url'] })).toThrow(ValidationError)
        expect(() => validateOptions({ imports: ['://not-a-url'] })).toThrow(
          'imports[0] is not a valid URL: ://not-a-url'
        )
        expect(() => validateOptions({ imports: [''] })).toThrow('imports[0] is not a valid URL')
      })

      it('rejects non-http/https URLs', () => {
        expect(() => validateOptions({ imports: ['file:///etc/passwd'] })).toThrow(ValidationError)
        expect(() => validateOptions({ imports: ['file:///etc/passwd'] })).toThrow(
          'imports[0] is not a valid URL: file:///etc/passwd'
        )
      })

      it('accepts both http and https URLs', () => {
        expect(() =>
          validateOptions({
            imports: ['https://esm.sh/lodash', 'http://localhost:3000/module.js'],
          })
        ).not.toThrow()
      })

      it('reports correct index for invalid import', () => {
        expect(() =>
          validateOptions({
            imports: ['https://esm.sh/lodash', 'ftp://invalid-url', 'https://esm.sh/react'],
          })
        ).toThrow('imports[1] is not a valid URL: ftp://invalid-url')
      })
    })

    // aip-263g.5: Dynamic Workers limits, compatibility settings and tails
    describe('limits validation', () => {
      it('accepts positive limits', () => {
        expect(() => validateOptions({ limits: { cpuMs: 50, subrequests: 2 } })).not.toThrow()
        expect(() => validateOptions({ limits: {} })).not.toThrow()
        expect(() => validateOptions({ limits: undefined })).not.toThrow()
      })

      it('rejects a negative cpuMs', () => {
        expect(() => validateOptions({ limits: { cpuMs: -1 } })).toThrow(ValidationError)
        expect(() => validateOptions({ limits: { cpuMs: -1 } })).toThrow(
          'limits.cpuMs must be a positive number'
        )
      })

      it('rejects zero, non-finite and non-numeric cpuMs', () => {
        expect(() => validateOptions({ limits: { cpuMs: 0 } })).toThrow(ValidationError)
        expect(() => validateOptions({ limits: { cpuMs: Infinity } })).toThrow(
          'limits.cpuMs must be a finite number'
        )
        expect(() => validateOptions({ limits: { cpuMs: '50' as unknown as number } })).toThrow(
          'limits.cpuMs must be a number'
        )
      })

      it('rejects a non-positive or fractional subrequests', () => {
        expect(() => validateOptions({ limits: { subrequests: 0 } })).toThrow(ValidationError)
        expect(() => validateOptions({ limits: { subrequests: 1.5 } })).toThrow(
          'limits.subrequests must be an integer'
        )
      })

      it('rejects non-object limits', () => {
        expect(() => validateOptions({ limits: 50 as unknown as { cpuMs: number } })).toThrow(
          'limits must be an object'
        )
        expect(() => validateOptions({ limits: [] as unknown as { cpuMs: number } })).toThrow(
          'limits must be an object'
        )
      })
    })

    describe('compatibility validation', () => {
      it('accepts flags and a YYYY-MM-DD date', () => {
        expect(() =>
          validateOptions({
            compatibilityFlags: ['nodejs_compat'],
            compatibilityDate: '2026-06-01',
          })
        ).not.toThrow()
        expect(() => validateOptions({ compatibilityFlags: [] })).not.toThrow()
      })

      it('rejects non-array or non-string flags', () => {
        expect(() =>
          validateOptions({ compatibilityFlags: 'nodejs_compat' as unknown as string[] })
        ).toThrow('compatibilityFlags must be an array of strings')
        expect(() => validateOptions({ compatibilityFlags: [1 as unknown as string] })).toThrow(
          'compatibilityFlags[0] must be a non-empty string'
        )
        expect(() => validateOptions({ compatibilityFlags: [''] })).toThrow(ValidationError)
      })

      it('rejects a malformed compatibility date', () => {
        expect(() => validateOptions({ compatibilityDate: '2026-6-1' })).toThrow(
          'compatibilityDate must be a YYYY-MM-DD string'
        )
        expect(() => validateOptions({ compatibilityDate: 20260601 as unknown as string })).toThrow(
          ValidationError
        )
      })
    })

    describe('tails validation', () => {
      it('accepts stubs (anything with a fetch method)', () => {
        expect(() =>
          validateOptions({ tails: [{ fetch: async () => new Response('') }] })
        ).not.toThrow()
        expect(() => validateOptions({ tails: [] })).not.toThrow()
      })

      it('rejects a non-array', () => {
        expect(() => validateOptions({ tails: {} as unknown as unknown[] })).toThrow(
          'tails must be an array of tail worker stubs'
        )
      })

      it('rejects an entry that is not a stub', () => {
        expect(() => validateOptions({ tails: ['https://tail.example'] })).toThrow(ValidationError)
        expect(() => validateOptions({ tails: [{}] })).toThrow(
          /tails\[0\] is not a tail worker stub/
        )
      })
    })

    describe('options object', () => {
      it('rejects a non-object', () => {
        expect(() => validateOptions(null as unknown as Record<string, never>)).toThrow(
          'options must be an object'
        )
        expect(() => validateOptions([] as unknown as Record<string, never>)).toThrow(
          ValidationError
        )
      })
    })
  })

  // aip-263g.5: validateOptions is wired into evaluate()
  describe('evaluate() calls validateOptions', () => {
    const stub: WorkerStub = {
      getEntrypoint: () => ({
        fetch: async () => Response.json({ success: true, value: 1, logs: [], duration: 0 }),
      }),
      getDurableObjectClass: () => undefined,
    }
    const loader: WorkerLoader = { get: () => stub, load: () => stub }

    beforeEach(() => {
      vi.mocked(validateOptions).mockClear()
    })

    it('is called once, with the raw options, before the loader is used', async () => {
      const options = { script: 'return 1', limits: { cpuMs: 50 } }
      const result = await evaluate(options, { loader })
      expect(result.success).toBe(true)
      expect(validateOptions).toHaveBeenCalledTimes(1)
      expect(validateOptions).toHaveBeenCalledWith(options)
    })

    it('is called even when there is no loader (validation comes first)', async () => {
      await evaluate({ script: 'return 1' })
      expect(validateOptions).toHaveBeenCalledTimes(1)
    })

    it('reports the ValidationError as an error result', async () => {
      const result = await evaluate({ script: 'return 1', limits: { cpuMs: -1 } }, { loader })
      expect(validateOptions).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(false)
      expect(result.error).toBe('limits.cpuMs must be a positive number')
      const tooLong = await evaluate({ script: 'return 1', timeout: MAX_TIMEOUT + 1 }, { loader })
      expect(tooLong.success).toBe(false)
      expect(tooLong.error).toMatch(/timeout exceeds maximum/)
    })
  })

  describe('ValidationError', () => {
    it('is an instance of Error', () => {
      const error = new ValidationError('test message')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(ValidationError)
    })

    it('has correct name', () => {
      const error = new ValidationError('test message')
      expect(error.name).toBe('ValidationError')
    })

    it('has correct message', () => {
      const error = new ValidationError('test message')
      expect(error.message).toBe('test message')
    })
  })
})
