import { describe, it, expect } from 'vitest'
import {
  containsJSX,
  transformSource,
  transformOptions,
  stripTypes,
  DEFAULT_JSX_FACTORY,
  DEFAULT_JSX_FRAGMENT,
} from '../src/transform.js'

/** `h('div'` or `h("div"` - the call is what matters, not the quote style */
const call = (factory: string, tag: string) =>
  new RegExp(`${factory.replace('.', '\\.')}\\(["']${tag}["']`)

describe('transform', () => {
  describe('containsJSX', () => {
    it('detects JSX patterns', () => {
      const patterns = [
        '<div>content</div>', // lowercase tag
        '<Button />', // uppercase tag
        '<>fragment</>', // fragment
        'return <Component />', // return JSX
        'return (\n<div>\n</div>\n)', // multiline return JSX
        'export const x = <div className="a">hi</div>',
      ]
      for (const pattern of patterns) expect(containsJSX(pattern), pattern).toBe(true)
    })

    it('does not detect non-JSX patterns', () => {
      const patterns = [
        'const x = a < b ? c : d', // comparison (no space after <)
        '5 > 3', // comparison
        'arr.map(x => x * 2)', // arrow function
        'const a: number = 1', // TypeScript, no JSX
        '', // empty
      ]
      for (const pattern of patterns) expect(containsJSX(pattern), pattern).toBe(false)
    })
  })

  describe('transformSource', () => {
    it('transforms JSX to factory calls with the given factory', () => {
      const code = transformSource('export const x = <div className="a">hi</div>', {
        jsx: { factory: 'h' },
      })
      expect(code).toMatch(call('h', 'div'))
      expect(code).toContain('className: "a"')
      expect(code).toContain('"hi"')
      expect(code).not.toContain('<div')
      expect(code).not.toContain('</div>')
    })

    it('defaults to h / Fragment (classic runtime)', () => {
      expect(DEFAULT_JSX_FACTORY).toBe('h')
      expect(DEFAULT_JSX_FRAGMENT).toBe('Fragment')
      const code = transformSource('const el = <><span/><span/></>')
      expect(code).toMatch(/h\(Fragment, null/)
      expect(code).toMatch(call('h', 'span'))
      expect(code).not.toContain('<>')
    })

    it('honours a dotted factory and a custom fragment', () => {
      const code = transformSource('const el = <><p/></>', {
        jsx: { factory: 'React.createElement', fragment: 'React.Fragment' },
      })
      expect(code).toMatch(/React\.createElement\(React\.Fragment, null/)
      expect(code).toMatch(call('React.createElement', 'p'))
    })

    it('uses the automatic runtime when importSource is set', () => {
      const code = transformSource('export const x = <p>a</p>', { jsx: { importSource: 'preact' } })
      expect(code).toContain('from "preact/jsx-runtime"')
      expect(code).toMatch(/_jsx\(["']p["']/)
      expect(code).not.toContain('h(')
    })

    it('rejects a factory that is not an identifier', () => {
      expect(() => transformSource('<p/>', { jsx: { factory: 'h(); evil()' } })).toThrow(
        /jsx\.factory/
      )
      expect(() => transformSource('<p/>', { jsx: { fragment: '1x' } })).toThrow(/jsx\.fragment/)
    })

    it('emits no __source / __self debug props', () => {
      const code = transformSource('const el = <p>a</p>')
      expect(code).not.toContain('__source')
      expect(code).not.toContain('__self')
      expect(code).not.toContain('_jsxFileName')
    })

    it('strips TypeScript types', () => {
      expect(transformSource('const a: number = 1')).toBe('const a = 1')
      const code = transformSource(`
        interface Point { x: number; y: number }
        type Id = string
        import type { Foo } from './foo.js'
        export function len(p: Point): number { return p.x as number }
        export const id = <T,>(v: T): T => v
      `)
      expect(code).not.toContain('interface')
      expect(code).not.toContain('type Id')
      expect(code).not.toContain('import type')
      expect(code).not.toContain(': number')
      expect(code).not.toContain(' as number')
      expect(code).toMatch(/export function len\(p\) \{ return p\.x\s*\}/)
      expect(code).toContain('export const id = (v) => v')
    })

    it('transforms JSX and TypeScript together', () => {
      const code = transformSource('const el: unknown = <p>{(1 as number) + 1}</p>')
      expect(code).toMatch(call('h', 'p'))
      expect(code).not.toContain(': unknown')
      expect(code).not.toContain('as number')
    })

    it('returns plain JavaScript byte-identical', () => {
      const sources = [
        'exports.add = (a, b) => a + b',
        "import x from './y.js'\nclass A { x = 1; static #p = 2; get y() { return this.x } }",
        "const s = 'a < b > c'; const t = `<div>${'x'}</div>`; const u = a < b && c > d",
        'for (const x of xs) { if (x <= 3) continue }\nlabel: while (true) break label',
        'const re = /<div>/g; const o = { ...a, b }; const [p, ...q] = r; x ??= 1',
        'export default { async fetch(r) { return r?.url ?? "x" } }',
        '  return 1 + 1  ', // whitespace preserved
        '',
      ]
      for (const source of sources) expect(transformSource(source), source).toBe(source)
    })

    it('keeps an import that is only used by the sandbox loader', () => {
      const source = "import lodash from 'lodash'\nexport const x = 1"
      expect(transformSource(source)).toBe(source)
    })

    it('allows a top-level return (script bodies)', () => {
      expect(transformSource('return <p>hi</p>')).toMatch(/^return h\(["']p["'], null, "hi"\)$/)
    })

    it('returns code that does not parse unchanged (runtime reports the syntax error)', () => {
      const broken = 'const = <div>'
      expect(transformSource(broken)).toBe(broken)
    })
  })

  describe('stripTypes', () => {
    it('removes types without parsing JSX', () => {
      const code = stripTypes('const a: Array<string> = []; const lt = a.length < b.length')
      expect(code).toBe('const a = []; const lt = a.length < b.length')
    })
  })

  describe('transformOptions', () => {
    it('transforms module, tests and script with the jsx settings', () => {
      const out = transformOptions({
        module: 'export const el = <p/>',
        tests: 'it("x", () => expect(<p/>).toBeTruthy())',
        script: 'return <p/>',
        jsx: { factory: 'create' },
        timeout: 10,
      })
      expect(out.module).toMatch(call('create', 'p'))
      expect(out.tests).toMatch(call('create', 'p'))
      expect(out.script).toMatch(call('create', 'p'))
      expect(out.timeout).toBe(10)
      expect(out.jsx).toEqual({ factory: 'create' })
    })

    it('leaves unset fields unset and does not mutate its input', () => {
      const input = { script: 'return 1' }
      const out = transformOptions(input)
      expect(out).toEqual({ script: 'return 1' })
      expect('module' in out).toBe(false)
      expect(out).not.toBe(input)
    })
  })
})
