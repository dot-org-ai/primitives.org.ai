/**
 * Extended Tests for Data Tools
 *
 * Comprehensive edge case testing for parseJson, stringifyJson,
 * parseCsv, transformData, and filterData tools.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  parseJson,
  stringifyJson,
  parseCsv,
  transformData,
  filterData,
  dataTools,
  registry,
  registerBuiltinTools,
} from '../src/index.js'

describe('Data Tools - parseJson Extended', () => {
  describe('valid JSON parsing', () => {
    it('parses empty object', async () => {
      const result = await parseJson.handler({ text: '{}' })
      expect(result.valid).toBe(true)
      expect(result.data).toEqual({})
    })

    it('parses empty array', async () => {
      const result = await parseJson.handler({ text: '[]' })
      expect(result.valid).toBe(true)
      expect(result.data).toEqual([])
    })

    it('parses null', async () => {
      const result = await parseJson.handler({ text: 'null' })
      expect(result.valid).toBe(true)
      expect(result.data).toBeNull()
    })

    it('parses boolean true', async () => {
      const result = await parseJson.handler({ text: 'true' })
      expect(result.valid).toBe(true)
      expect(result.data).toBe(true)
    })

    it('parses boolean false', async () => {
      const result = await parseJson.handler({ text: 'false' })
      expect(result.valid).toBe(true)
      expect(result.data).toBe(false)
    })

    it('parses integer number', async () => {
      const result = await parseJson.handler({ text: '42' })
      expect(result.valid).toBe(true)
      expect(result.data).toBe(42)
    })

    it('parses float number', async () => {
      const result = await parseJson.handler({ text: '3.14159' })
      expect(result.valid).toBe(true)
      expect(result.data).toBe(3.14159)
    })

    it('parses negative number', async () => {
      const result = await parseJson.handler({ text: '-100' })
      expect(result.valid).toBe(true)
      expect(result.data).toBe(-100)
    })

    it('parses scientific notation', async () => {
      const result = await parseJson.handler({ text: '1.5e10' })
      expect(result.valid).toBe(true)
      expect(result.data).toBe(1.5e10)
    })

    it('parses string', async () => {
      const result = await parseJson.handler({ text: '"hello"' })
      expect(result.valid).toBe(true)
      expect(result.data).toBe('hello')
    })

    it('parses string with unicode', async () => {
      const result = await parseJson.handler({
        text: '"hello \\u0048\\u0065\\u006c\\u006c\\u006f"',
      })
      expect(result.valid).toBe(true)
      expect(result.data).toBe('hello Hello')
    })

    it('parses nested objects', async () => {
      const result = await parseJson.handler({
        text: '{"a":{"b":{"c":{"d":"deep"}}}}',
      })
      expect(result.valid).toBe(true)
      expect(result.data.a.b.c.d).toBe('deep')
    })

    it('parses array with mixed types', async () => {
      const result = await parseJson.handler({
        text: '[1, "two", true, null, {"five": 5}]',
      })
      expect(result.valid).toBe(true)
      expect(result.data).toHaveLength(5)
      expect(result.data[0]).toBe(1)
      expect(result.data[1]).toBe('two')
      expect(result.data[2]).toBe(true)
      expect(result.data[3]).toBeNull()
      expect(result.data[4]).toEqual({ five: 5 })
    })

    it('parses object with special characters in keys', async () => {
      const result = await parseJson.handler({
        text: '{"key-with-dash": 1, "key.with.dot": 2}',
      })
      expect(result.valid).toBe(true)
      expect(result.data['key-with-dash']).toBe(1)
      expect(result.data['key.with.dot']).toBe(2)
    })
  })

  describe('invalid JSON handling', () => {
    it('handles empty string', async () => {
      const result = await parseJson.handler({ text: '' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('handles plain text', async () => {
      const result = await parseJson.handler({ text: 'not json' })
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('handles malformed object', async () => {
      const result = await parseJson.handler({ text: '{key: "value"}' })
      expect(result.valid).toBe(false)
    })

    it('handles trailing comma', async () => {
      const result = await parseJson.handler({ text: '{"a": 1,}' })
      expect(result.valid).toBe(false)
    })

    it('handles single quotes', async () => {
      const result = await parseJson.handler({ text: "{'key': 'value'}" })
      expect(result.valid).toBe(false)
    })

    it('handles unclosed brace', async () => {
      const result = await parseJson.handler({ text: '{"a": 1' })
      expect(result.valid).toBe(false)
    })

    it('handles unclosed bracket', async () => {
      const result = await parseJson.handler({ text: '[1, 2, 3' })
      expect(result.valid).toBe(false)
    })

    it('handles undefined value', async () => {
      const result = await parseJson.handler({ text: 'undefined' })
      expect(result.valid).toBe(false)
    })

    it('sets data to null on error', async () => {
      const result = await parseJson.handler({ text: 'invalid' })
      expect(result.data).toBeNull()
    })

    it('provides error message', async () => {
      const result = await parseJson.handler({ text: '{invalid}' })
      expect(typeof result.error).toBe('string')
      expect(result.error!.length).toBeGreaterThan(0)
    })
  })

  describe('metadata', () => {
    it('is idempotent', () => {
      expect(parseJson.idempotent).toBe(true)
    })

    it('has json tag', () => {
      expect(parseJson.tags).toContain('json')
    })

    it('has transform tag', () => {
      expect(parseJson.tags).toContain('transform')
    })
  })
})

describe('Data Tools - stringifyJson Extended', () => {
  describe('basic stringification', () => {
    it('stringifies object', async () => {
      const result = await stringifyJson.handler({ data: { a: 1 } })
      expect(result.text).toBe('{"a":1}')
    })

    it('stringifies array', async () => {
      const result = await stringifyJson.handler({ data: [1, 2, 3] })
      expect(result.text).toBe('[1,2,3]')
    })

    it('stringifies null', async () => {
      const result = await stringifyJson.handler({ data: null })
      expect(result.text).toBe('null')
    })

    it('stringifies boolean', async () => {
      const result = await stringifyJson.handler({ data: true })
      expect(result.text).toBe('true')
    })

    it('stringifies number', async () => {
      const result = await stringifyJson.handler({ data: 42 })
      expect(result.text).toBe('42')
    })

    it('stringifies string', async () => {
      const result = await stringifyJson.handler({ data: 'hello' })
      expect(result.text).toBe('"hello"')
    })

    it('stringifies nested structure', async () => {
      const result = await stringifyJson.handler({
        data: { a: { b: [1, 2, { c: 3 }] } },
      })
      expect(JSON.parse(result.text)).toEqual({ a: { b: [1, 2, { c: 3 }] } })
    })
  })

  describe('pretty printing', () => {
    it('formats with 2-space indentation', async () => {
      const result = await stringifyJson.handler({
        data: { a: 1 },
        pretty: true,
      })
      expect(result.text).toBe('{\n  "a": 1\n}')
    })

    it('formats nested objects', async () => {
      const result = await stringifyJson.handler({
        data: { a: { b: 1 } },
        pretty: true,
      })
      expect(result.text).toContain('  "a"')
      expect(result.text).toContain('    "b"')
    })

    it('formats arrays', async () => {
      const result = await stringifyJson.handler({
        data: [1, 2, 3],
        pretty: true,
      })
      expect(result.text).toContain('\n')
    })

    it('default is not pretty', async () => {
      const result = await stringifyJson.handler({
        data: { a: 1, b: 2 },
      })
      expect(result.text).not.toContain('\n')
    })
  })

  describe('metadata', () => {
    it('is idempotent', () => {
      expect(stringifyJson.idempotent).toBe(true)
    })

    it('has stringify tag', () => {
      expect(stringifyJson.tags).toContain('stringify')
    })
  })
})

describe('Data Tools - parseCsv Extended', () => {
  describe('basic parsing', () => {
    it('parses single row', async () => {
      const result = await parseCsv.handler({ text: 'a,b,c\n1,2,3' })
      expect(result.rows).toHaveLength(1)
      expect(result.headers).toEqual(['a', 'b', 'c'])
    })

    it('parses multiple rows', async () => {
      const result = await parseCsv.handler({
        text: 'a,b\n1,2\n3,4\n5,6',
      })
      expect(result.rows).toHaveLength(3)
      expect(result.rowCount).toBe(3)
    })

    it('handles empty file', async () => {
      const result = await parseCsv.handler({ text: '' })
      expect(result.rows).toHaveLength(0)
      expect(result.headers).toHaveLength(0)
      expect(result.rowCount).toBe(0)
    })

    it('handles header-only file', async () => {
      const result = await parseCsv.handler({ text: 'a,b,c' })
      expect(result.headers).toEqual(['a', 'b', 'c'])
      expect(result.rows).toHaveLength(0)
    })

    it('trims whitespace from values', async () => {
      const result = await parseCsv.handler({
        text: 'a , b , c\n 1 , 2 , 3 ',
      })
      expect(result.headers).toEqual(['a', 'b', 'c'])
      expect(result.rows[0]).toEqual({ a: '1', b: '2', c: '3' })
    })
  })

  describe('delimiter options', () => {
    it('parses semicolon-delimited', async () => {
      const result = await parseCsv.handler({
        text: 'a;b;c\n1;2;3',
        delimiter: ';',
      })
      expect(result.headers).toEqual(['a', 'b', 'c'])
      expect(result.rows[0]).toEqual({ a: '1', b: '2', c: '3' })
    })

    it('parses tab-delimited', async () => {
      const result = await parseCsv.handler({
        text: 'a\tb\tc\n1\t2\t3',
        delimiter: '\t',
      })
      expect(result.headers).toEqual(['a', 'b', 'c'])
    })

    it('parses pipe-delimited', async () => {
      const result = await parseCsv.handler({
        text: 'a|b|c\n1|2|3',
        delimiter: '|',
      })
      expect(result.headers).toEqual(['a', 'b', 'c'])
    })

    it('defaults to comma', async () => {
      const result = await parseCsv.handler({
        text: 'a,b,c\n1,2,3',
      })
      expect(result.headers).toEqual(['a', 'b', 'c'])
    })
  })

  describe('header options', () => {
    it('generates column names when no headers', async () => {
      const result = await parseCsv.handler({
        text: '1,2,3\n4,5,6',
        hasHeaders: false,
      })
      expect(result.headers).toEqual(['column1', 'column2', 'column3'])
      expect(result.rows).toHaveLength(2)
    })

    it('defaults to hasHeaders: true', async () => {
      const result = await parseCsv.handler({
        text: 'a,b\n1,2',
      })
      expect(result.headers).toEqual(['a', 'b'])
      expect(result.rows).toHaveLength(1)
    })

    it('includes first row as data when no headers', async () => {
      const result = await parseCsv.handler({
        text: '1,2,3',
        hasHeaders: false,
      })
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]).toEqual({ column1: '1', column2: '2', column3: '3' })
    })
  })

  describe('edge cases', () => {
    it('handles missing values', async () => {
      const result = await parseCsv.handler({
        text: 'a,b,c\n1,,3',
      })
      expect(result.rows[0]).toEqual({ a: '1', b: '', c: '3' })
    })

    it('handles extra values', async () => {
      const result = await parseCsv.handler({
        text: 'a,b\n1,2,3',
      })
      // Extra values are ignored based on header count
      expect(result.rows[0]).toHaveProperty('a', '1')
      expect(result.rows[0]).toHaveProperty('b', '2')
    })

    it('handles fewer values than headers', async () => {
      const result = await parseCsv.handler({
        text: 'a,b,c\n1,2',
      })
      expect(result.rows[0]).toEqual({ a: '1', b: '2', c: '' })
    })

    it('filters empty lines', async () => {
      const result = await parseCsv.handler({
        text: 'a,b\n1,2\n\n3,4\n',
      })
      expect(result.rows).toHaveLength(2)
    })

    it('handles whitespace-only lines', async () => {
      const result = await parseCsv.handler({
        text: 'a,b\n1,2\n   \n3,4',
      })
      expect(result.rows).toHaveLength(2)
    })
  })

  describe('metadata', () => {
    it('is idempotent', () => {
      expect(parseCsv.idempotent).toBe(true)
    })

    it('has csv tag', () => {
      expect(parseCsv.tags).toContain('csv')
    })
  })
})

describe('Data Tools - transformData Extended', () => {
  describe('basic transformation', () => {
    it('maps single field', async () => {
      const result = await transformData.handler({
        data: { name: 'John' },
        transform: { fullName: 'name' },
      })
      expect(result.result).toEqual({ fullName: 'John' })
    })

    it('maps multiple fields', async () => {
      const result = await transformData.handler({
        data: { a: 1, b: 2, c: 3 },
        transform: { x: 'a', y: 'b', z: 'c' },
      })
      expect(result.result).toEqual({ x: 1, y: 2, z: 3 })
    })

    it('selects subset of fields', async () => {
      const result = await transformData.handler({
        data: { a: 1, b: 2, c: 3, d: 4, e: 5 },
        transform: { first: 'a', last: 'e' },
      })
      expect(result.result).toEqual({ first: 1, last: 5 })
    })
  })

  describe('nested path access', () => {
    it('accesses single level nesting', async () => {
      const result = await transformData.handler({
        data: { user: { name: 'John' } },
        transform: { name: 'user.name' },
      })
      expect(result.result.name).toBe('John')
    })

    it('accesses deeply nested paths', async () => {
      const result = await transformData.handler({
        data: { a: { b: { c: { d: { e: 'deep' } } } } },
        transform: { value: 'a.b.c.d.e' },
      })
      expect(result.result.value).toBe('deep')
    })

    it('accesses multiple nested paths', async () => {
      const result = await transformData.handler({
        data: {
          user: { profile: { name: 'John', age: 30 } },
          metadata: { created: '2024-01-01' },
        },
        transform: {
          userName: 'user.profile.name',
          userAge: 'user.profile.age',
          createdAt: 'metadata.created',
        },
      })
      expect(result.result).toEqual({
        userName: 'John',
        userAge: 30,
        createdAt: '2024-01-01',
      })
    })

    it('accesses array by index', async () => {
      const result = await transformData.handler({
        data: { items: ['a', 'b', 'c'] },
        transform: { first: 'items.0', second: 'items.1' },
      })
      expect(result.result.first).toBe('a')
      expect(result.result.second).toBe('b')
    })
  })

  describe('missing path handling', () => {
    it('returns undefined for missing top-level path', async () => {
      const result = await transformData.handler({
        data: { a: 1 },
        transform: { value: 'b' },
      })
      expect(result.result.value).toBeUndefined()
    })

    it('returns undefined for missing nested path', async () => {
      const result = await transformData.handler({
        data: { a: { b: 1 } },
        transform: { value: 'a.c.d' },
      })
      expect(result.result.value).toBeUndefined()
    })

    it('returns undefined for path on non-object', async () => {
      const result = await transformData.handler({
        data: { a: 'string' },
        transform: { value: 'a.b' },
      })
      expect(result.result.value).toBeUndefined()
    })

    it('returns undefined for path on null', async () => {
      const result = await transformData.handler({
        data: { a: null },
        transform: { value: 'a.b' },
      })
      expect(result.result.value).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('handles empty transform', async () => {
      const result = await transformData.handler({
        data: { a: 1, b: 2 },
        transform: {},
      })
      expect(result.result).toEqual({})
    })

    it('handles empty data', async () => {
      const result = await transformData.handler({
        data: {},
        transform: { value: 'a' },
      })
      expect(result.result.value).toBeUndefined()
    })

    it('preserves value types', async () => {
      const result = await transformData.handler({
        data: {
          str: 'hello',
          num: 42,
          bool: true,
          arr: [1, 2],
          obj: { nested: true },
          nil: null,
        },
        transform: {
          s: 'str',
          n: 'num',
          b: 'bool',
          a: 'arr',
          o: 'obj',
          x: 'nil',
        },
      })
      expect(result.result.s).toBe('hello')
      expect(result.result.n).toBe(42)
      expect(result.result.b).toBe(true)
      expect(result.result.a).toEqual([1, 2])
      expect(result.result.o).toEqual({ nested: true })
      expect(result.result.x).toBeNull()
    })
  })
})

describe('Data Tools - filterData Extended', () => {
  describe('basic filtering', () => {
    it('filters by single criterion', async () => {
      const result = await filterData.handler({
        data: [{ status: 'active' }, { status: 'inactive' }, { status: 'active' }],
        filter: { status: 'active' },
      })
      expect(result.count).toBe(2)
    })

    it('filters by multiple criteria', async () => {
      const result = await filterData.handler({
        data: [
          { status: 'active', role: 'admin' },
          { status: 'active', role: 'user' },
          { status: 'inactive', role: 'admin' },
        ],
        filter: { status: 'active', role: 'admin' },
      })
      expect(result.count).toBe(1)
    })

    it('returns empty for no matches', async () => {
      const result = await filterData.handler({
        data: [{ a: 1 }, { a: 2 }],
        filter: { a: 3 },
      })
      expect(result.results).toHaveLength(0)
      expect(result.count).toBe(0)
    })

    it('returns all for empty filter', async () => {
      const result = await filterData.handler({
        data: [{ a: 1 }, { a: 2 }, { a: 3 }],
        filter: {},
      })
      expect(result.count).toBe(3)
    })
  })

  describe('type matching', () => {
    it('matches string values', async () => {
      const result = await filterData.handler({
        data: [{ name: 'john' }, { name: 'jane' }],
        filter: { name: 'john' },
      })
      expect(result.count).toBe(1)
    })

    it('matches number values', async () => {
      const result = await filterData.handler({
        data: [{ age: 25 }, { age: 30 }, { age: 25 }],
        filter: { age: 25 },
      })
      expect(result.count).toBe(2)
    })

    it('matches boolean values', async () => {
      const result = await filterData.handler({
        data: [{ active: true }, { active: false }, { active: true }],
        filter: { active: true },
      })
      expect(result.count).toBe(2)
    })

    it('matches null values', async () => {
      const result = await filterData.handler({
        data: [{ value: null }, { value: 1 }, { value: null }],
        filter: { value: null },
      })
      expect(result.count).toBe(2)
    })

    it('uses strict equality', async () => {
      const result = await filterData.handler({
        data: [{ value: '1' }, { value: 1 }],
        filter: { value: 1 },
      })
      expect(result.count).toBe(1)
    })
  })

  describe('edge cases', () => {
    it('handles empty data array', async () => {
      const result = await filterData.handler({
        data: [],
        filter: { a: 1 },
      })
      expect(result.results).toHaveLength(0)
    })

    it('handles non-object items in array', async () => {
      const result = await filterData.handler({
        data: [1, 'string', null, { a: 1 }] as unknown[],
        filter: { a: 1 },
      })
      expect(result.count).toBe(1)
    })

    it('skips items missing the filter key', async () => {
      const result = await filterData.handler({
        data: [{ a: 1 }, { b: 2 }, { a: 1 }],
        filter: { a: 1 },
      })
      expect(result.count).toBe(2)
    })

    it('preserves original item structure', async () => {
      const result = await filterData.handler({
        data: [{ a: 1, b: 2, c: 3 }],
        filter: { a: 1 },
      })
      expect(result.results[0]).toEqual({ a: 1, b: 2, c: 3 })
    })
  })
})

describe('Data Tools Array', () => {
  it('has 5 tools', () => {
    expect(dataTools).toHaveLength(5)
  })

  it('all tools are in data category', () => {
    expect(dataTools.every((t) => t.category === 'data')).toBe(true)
  })

  it('all tools have transform subcategory', () => {
    expect(dataTools.every((t) => t.subcategory === 'transform')).toBe(true)
  })

  it('all tools are idempotent', () => {
    expect(dataTools.every((t) => t.idempotent === true)).toBe(true)
  })
})

describe('Data Tools Registry Integration', () => {
  beforeEach(() => {
    registry.clear()
  })

  it('registers all data tools', () => {
    registerBuiltinTools()

    expect(registry.has('data.json.parse')).toBe(true)
    expect(registry.has('data.json.stringify')).toBe(true)
    expect(registry.has('data.csv.parse')).toBe(true)
    expect(registry.has('data.transform')).toBe(true)
    expect(registry.has('data.filter')).toBe(true)
  })

  it('can query by data category', () => {
    registerBuiltinTools()

    const tools = registry.byCategory('data')
    expect(tools.length).toBeGreaterThanOrEqual(5)
  })

  it('can search by json tag', () => {
    registerBuiltinTools()

    const tools = registry.query({ tags: ['json'] })
    expect(tools.some((t) => t.id === 'data.json.parse')).toBe(true)
    expect(tools.some((t) => t.id === 'data.json.stringify')).toBe(true)
  })
})
