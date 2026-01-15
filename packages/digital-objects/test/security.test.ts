/**
 * Security Tests for JSON Path Traversal Prevention
 *
 * These tests expose the vulnerability in ns.ts where field names in the `where` clause
 * are not properly validated, allowing JSON path traversal attacks.
 *
 * Issue: aip-gduw
 * Phase: RED (tests should FAIL initially to prove vulnerability exists)
 *
 * Current vulnerable code (ns.ts ~line 598):
 *   sql += ` AND json_extract(data, '$.${key}') = ?`
 *
 * The validation function `validateOrderByField` allows:
 * - __proto__ (matches /^[a-zA-Z_][a-zA-Z0-9_]*$/)
 * - constructor (matches /^[a-zA-Z_][a-zA-Z0-9_]*$/)
 *
 * These should be rejected as they could enable prototype pollution or
 * other security issues when the data is processed.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { NS, type Env } from '../src/ns.js'
import { MemoryProvider } from '../src/memory-provider.js'

// Mock data storage for SQLite testing
type Row = Record<string, unknown>

interface MockSqlStorage {
  exec: Mock<(...args: unknown[]) => { rowsWritten: number } & Iterable<Row>>
  _tables: Map<string, Row[]>
}

const createMockSqlStorage = (): MockSqlStorage => {
  const tables = new Map<string, Row[]>()
  tables.set('nouns', [])
  tables.set('verbs', [])
  tables.set('things', [])
  tables.set('actions', [])

  const exec = vi.fn((...args: unknown[]) => {
    const sql = args[0] as string

    if (sql.includes('CREATE TABLE') || sql.includes('CREATE INDEX')) {
      return { rowsWritten: 0, [Symbol.iterator]: () => [][Symbol.iterator]() }
    }

    if (sql.includes('INSERT INTO things')) {
      const row: Row = {
        id: args[1],
        noun: args[2],
        data: args[3],
        created_at: args[4],
        updated_at: args[5],
      }
      tables.get('things')!.push(row)
      return { rowsWritten: 1, [Symbol.iterator]: () => [][Symbol.iterator]() }
    }

    if (sql.includes('SELECT * FROM things WHERE noun = ?')) {
      const noun = args[1]
      let results = tables.get('things')!.filter((t) => t.noun === noun)
      return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
    }

    return { rowsWritten: 0, [Symbol.iterator]: () => [][Symbol.iterator]() }
  })

  return { exec, _tables: tables }
}

const createMockState = (mockSql: MockSqlStorage) => ({
  storage: { sql: mockSql },
})

const createMockEnv = (): Env => ({
  NS: {
    idFromName: vi.fn(),
    get: vi.fn(),
  } as unknown as DurableObjectNamespace,
})

describe('Security: JSON Path Traversal Prevention', () => {
  describe('NS (SQLite Provider)', () => {
    let ns: NS
    let mockSql: MockSqlStorage

    beforeEach(() => {
      mockSql = createMockSqlStorage()
      const mockState = createMockState(mockSql)
      const mockEnv = createMockEnv()
      ns = new NS(mockState as unknown as DurableObjectState, mockEnv)
    })

    describe('where clause field validation', () => {
      /**
       * TEST 1: Dots in field names should be rejected
       *
       * A field name like "a.b" would traverse JSON paths:
       * json_extract(data, '$.a.b') accesses data.a.b instead of data['a.b']
       *
       * This test should FAIL because dots ARE already blocked by the regex.
       * (The regex /^[a-zA-Z_][a-zA-Z0-9_]*$/ does not allow dots)
       */
      it('should reject field names containing dots (JSON path traversal)', async () => {
        await ns.create('User', { name: 'Alice', 'a.b': 'secret' })

        await expect(ns.list('User', { where: { 'a.b': 'secret' } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed/i
        )
      })

      /**
       * TEST 2: __proto__ should be rejected
       *
       * __proto__ is a dangerous property name that can lead to prototype pollution.
       * Even though we're working with JSON paths, allowing __proto__ as a field name
       * could have security implications when the data is later processed.
       *
       * This test should FAIL because __proto__ matches the current regex.
       * Note: We use JSON.parse to create the where object because object literal syntax
       * { __proto__: value } doesn't create an actual property - it sets the prototype.
       * In real attacks, __proto__ would come from parsed JSON (API requests).
       */
      it('should reject __proto__ field name (prototype pollution prevention)', async () => {
        await ns.create('Config', { setting: 'value' })

        // Simulate attack vector: __proto__ coming from JSON body (e.g., from HTTP request)
        const maliciousWhere = JSON.parse('{"__proto__": "malicious"}')
        await expect(ns.list('Config', { where: maliciousWhere })).rejects.toThrow(
          /invalid.*field|rejected|not allowed|__proto__|prototype/i
        )
      })

      /**
       * TEST 3: constructor should be rejected
       *
       * constructor is another dangerous property name often used in prototype pollution.
       *
       * This test should FAIL because constructor matches the current regex.
       */
      it('should reject constructor field name (prototype pollution prevention)', async () => {
        await ns.create('Config', { setting: 'value', constructor: 'malicious' })

        await expect(ns.list('Config', { where: { constructor: 'malicious' } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed|constructor|prototype/i
        )
      })

      /**
       * TEST 4: Special JSON path characters should be rejected
       *
       * Characters like [ ] $ @ have special meaning in JSON path expressions
       * and could potentially be used to construct malicious queries.
       *
       * These tests should PASS (chars ARE blocked by the current regex).
       */
      it('should reject field names with square brackets', async () => {
        await ns.create('Data', { items: ['a', 'b'] })

        await expect(ns.list('Data', { where: { 'items[0]': 'a' } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed/i
        )
      })

      it('should reject field names with $ character', async () => {
        await ns.create('Data', { value: 42 })

        await expect(ns.list('Data', { where: { $value: 42 } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed/i
        )
      })

      it('should reject field names with @ character', async () => {
        await ns.create('Data', { value: 42 })

        await expect(ns.list('Data', { where: { '@value': 42 } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed/i
        )
      })

      /**
       * TEST 5: prototype should be rejected
       *
       * Another dangerous prototype-related property name.
       *
       * This test should FAIL because prototype matches the current regex.
       */
      it('should reject prototype field name', async () => {
        await ns.create('Config', { setting: 'value', prototype: 'malicious' })

        await expect(ns.list('Config', { where: { prototype: 'malicious' } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed|prototype/i
        )
      })

      /**
       * TEST 6: Valid field names should work
       *
       * Normal field names should continue to work correctly.
       */
      it('should allow valid alphanumeric field names', async () => {
        await ns.create('User', { status: 'active', userName: 'alice', count_1: 5 })

        // These should NOT throw
        await expect(ns.list('User', { where: { status: 'active' } })).resolves.toBeDefined()
        await expect(ns.list('User', { where: { userName: 'alice' } })).resolves.toBeDefined()
        await expect(ns.list('User', { where: { count_1: 5 } })).resolves.toBeDefined()
      })
    })
  })

  describe('MemoryProvider', () => {
    let provider: MemoryProvider

    beforeEach(() => {
      provider = new MemoryProvider()
    })

    describe('where clause field validation', () => {
      /**
       * MemoryProvider should also validate where clause fields.
       * Currently it has NO validation at all.
       */

      it('should reject field names containing dots', async () => {
        await provider.create('User', { name: 'Alice', 'a.b': 'secret' })

        await expect(provider.list('User', { where: { 'a.b': 'secret' } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed/i
        )
      })

      it('should reject __proto__ field name', async () => {
        await provider.create('Config', { setting: 'value' })

        // Simulate attack vector: __proto__ coming from JSON body (e.g., from HTTP request)
        const maliciousWhere = JSON.parse('{"__proto__": "malicious"}')
        await expect(provider.list('Config', { where: maliciousWhere })).rejects.toThrow(
          /invalid.*field|rejected|not allowed|__proto__|prototype/i
        )
      })

      it('should reject constructor field name', async () => {
        await provider.create('Config', { setting: 'value' })

        await expect(
          provider.list('Config', { where: { constructor: 'malicious' } })
        ).rejects.toThrow(/invalid.*field|rejected|not allowed|constructor|prototype/i)
      })

      it('should reject prototype field name', async () => {
        await provider.create('Config', { setting: 'value' })

        await expect(
          provider.list('Config', { where: { prototype: 'malicious' } })
        ).rejects.toThrow(/invalid.*field|rejected|not allowed|prototype/i)
      })

      it('should reject field names with special JSON path characters', async () => {
        await provider.create('Data', { value: 42 })

        await expect(provider.list('Data', { where: { 'items[0]': 'a' } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed/i
        )
        await expect(provider.list('Data', { where: { $value: 42 } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed/i
        )
        await expect(provider.list('Data', { where: { '@value': 42 } })).rejects.toThrow(
          /invalid.*field|rejected|not allowed/i
        )
      })

      it('should allow valid alphanumeric field names', async () => {
        await provider.create('User', { status: 'active', userName: 'alice' })

        // These should NOT throw
        await expect(provider.list('User', { where: { status: 'active' } })).resolves.toBeDefined()
        await expect(provider.list('User', { where: { userName: 'alice' } })).resolves.toBeDefined()
      })
    })
  })

  describe('HTTP API', () => {
    let ns: NS
    let mockSql: MockSqlStorage

    beforeEach(() => {
      mockSql = createMockSqlStorage()
      const mockState = createMockState(mockSql)
      const mockEnv = createMockEnv()
      ns = new NS(mockState as unknown as DurableObjectState, mockEnv)
    })

    /**
     * HTTP API should also reject dangerous field names in query parameters.
     */
    it('should reject __proto__ in HTTP where filter', async () => {
      await ns.create('Config', { setting: 'value' })

      const request = new Request(
        'https://example.com/things?noun=Config&where=' + encodeURIComponent('__proto__=malicious')
      )
      const response = await ns.fetch(request)

      // Should return 400 Bad Request, not 200
      expect(response.status).toBe(400)
    })

    it('should reject constructor in HTTP where filter', async () => {
      await ns.create('Config', { setting: 'value' })

      const request = new Request(
        'https://example.com/things?noun=Config&where=' +
          encodeURIComponent('constructor=malicious')
      )
      const response = await ns.fetch(request)

      // Should return 400 Bad Request, not 200
      expect(response.status).toBe(400)
    })
  })
})
