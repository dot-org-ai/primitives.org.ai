/**
 * Search Escaping Tests for LIKE Wildcard Prevention
 *
 * These tests expose the vulnerability in ns.ts where LIKE wildcards (%, _)
 * in search queries are not escaped, leading to unexpected matching behavior.
 *
 * Issues: aip-cxgw (RED), aip-4v14 (GREEN)
 * Phase: RED (tests should FAIL initially to prove vulnerability exists)
 *
 * Current vulnerable code (ns.ts ~line 766):
 *   const q = `%${query.toLowerCase()}%`
 *   let sql = `SELECT * FROM things WHERE LOWER(data) LIKE ?`
 *
 * The problem:
 * - "100%" becomes "%100%%" which matches "100" followed by anything
 * - "test_name" becomes "%test_name%" where _ matches any single character
 * - Backslashes are not handled as escape characters
 *
 * Expected fix:
 *   function escapeLikePattern(query: string): string {
 *     return query.replace(/[%_\\]/g, '\\$&')
 *   }
 *   const q = `%${escapeLikePattern(query.toLowerCase())}%`
 *   // SQL must include: LIKE ? ESCAPE '\'
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

    // Handle search queries with LIKE
    if (sql.includes('SELECT * FROM things WHERE LOWER(data) LIKE')) {
      const pattern = args[1] as string
      // Simulate SQLite LIKE behavior
      // Convert SQL LIKE pattern to regex for simulation
      // Check for ESCAPE '\' clause (note: in JS, ESCAPE '\\' in template literal = ESCAPE '\' in string)
      const hasEscape = sql.includes("ESCAPE '\\'")
      let regexPattern = pattern

      if (hasEscape) {
        // Process escaped characters: \% -> literal %, \_ -> literal _, \\ -> literal \
        // We need to escape regex special chars in the result literals
        regexPattern = regexPattern
          .replace(/\\\\/g, '\x00') // Temporarily replace \\ (escaped backslash)
          .replace(/\\%/g, '\x01') // Temporarily replace \% (escaped percent)
          .replace(/\\_/g, '\x02') // Temporarily replace \_ (escaped underscore)
          .replace(/%/g, '.*') // LIKE % -> regex .*
          .replace(/_/g, '.') // LIKE _ -> regex .
          .replace(/\x00/g, '\\\\') // Restore literal backslash (escaped for regex)
          .replace(/\x01/g, '%') // Restore literal %
          .replace(/\x02/g, '_') // Restore literal _
      } else {
        // No escape handling - current vulnerable behavior
        regexPattern = regexPattern
          .replace(/%/g, '.*') // LIKE % -> regex .*
          .replace(/_/g, '.') // LIKE _ -> regex .
      }

      try {
        const regex = new RegExp(`^${regexPattern}$`, 'i')
        const results = tables.get('things')!.filter((t) => {
          const dataStr = (t.data as string).toLowerCase()
          return regex.test(dataStr)
        })
        return { rowsWritten: 0, [Symbol.iterator]: () => results[Symbol.iterator]() }
      } catch {
        return { rowsWritten: 0, [Symbol.iterator]: () => [][Symbol.iterator]() }
      }
    }

    if (sql.includes('SELECT * FROM things WHERE noun = ?')) {
      const noun = args[1]
      const results = tables.get('things')!.filter((t) => t.noun === noun)
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

describe('Security: LIKE Wildcard Escaping in Search', () => {
  describe('NS (SQLite Provider)', () => {
    let ns: NS
    let mockSql: MockSqlStorage

    beforeEach(() => {
      mockSql = createMockSqlStorage()
      const mockState = createMockState(mockSql)
      const mockEnv = createMockEnv()
      ns = new NS(mockState as unknown as DurableObjectState, mockEnv)
    })

    describe('percent (%) wildcard escaping', () => {
      /**
       * TEST 1: Search for literal "100%" should match exactly
       *
       * Without escaping: "100%" becomes "%100%%" in SQL LIKE
       * This matches "100" followed by anything, not just literal "100%"
       *
       * This test should FAIL because % is not escaped.
       */
      it('should match literal percent sign, not treat it as wildcard', async () => {
        // Create test data
        await ns.create('Product', { name: '100% Complete', price: 50 })
        await ns.create('Product', { name: '100 Items', price: 100 })
        await ns.create('Product', { name: '100 Dollars', price: 100 })

        // Search for literal "100%"
        const results = await ns.search('100%')

        // Should ONLY match "100% Complete", not "100 Items" or "100 Dollars"
        expect(results.length).toBe(1)
        expect((results[0].data as { name: string }).name).toBe('100% Complete')
      })

      /**
       * TEST 2: Search with % at end should not match everything
       *
       * Searching for "sale%" should match literal "sale%" in data,
       * not every record starting with "sale"
       */
      it('should not match all records starting with prefix when % is in query', async () => {
        await ns.create('Promo', { code: 'SALE50' })
        await ns.create('Promo', { code: 'SALE%OFF' })
        await ns.create('Promo', { code: 'SALESDAY' })

        const results = await ns.search('SALE%')

        // Should only match "SALE%OFF" which contains literal "SALE%"
        expect(results.length).toBe(1)
        expect((results[0].data as { code: string }).code).toBe('SALE%OFF')
      })
    })

    describe('underscore (_) wildcard escaping', () => {
      /**
       * TEST 3: Search for literal underscore should match exactly
       *
       * Without escaping: "test_name" matches "testXname", "test1name", etc.
       * because _ matches any single character in SQL LIKE
       *
       * This test should FAIL because _ is not escaped.
       */
      it('should match literal underscore, not treat it as single-char wildcard', async () => {
        await ns.create('User', { username: 'test_user' })
        await ns.create('User', { username: 'testXuser' })
        await ns.create('User', { username: 'test1user' })

        const results = await ns.search('test_user')

        // Should ONLY match "test_user", not "testXuser" or "test1user"
        expect(results.length).toBe(1)
        expect((results[0].data as { username: string }).username).toBe('test_user')
      })

      /**
       * TEST 4: Multiple underscores should all be treated as literals
       */
      it('should match multiple literal underscores correctly', async () => {
        await ns.create('Config', { key: 'app__config__key' })
        await ns.create('Config', { key: 'appXXconfigXXkey' })
        await ns.create('Config', { key: 'app12config34key' })

        const results = await ns.search('app__config')

        // Should only match the one with literal underscores
        expect(results.length).toBe(1)
        expect((results[0].data as { key: string }).key).toBe('app__config__key')
      })
    })

    describe('backslash (\\) handling', () => {
      /**
       * TEST 5: Backslash in search query should work correctly
       *
       * Note: The search method searches the JSON-stringified data, not raw values.
       * This means backslashes in data appear doubled in JSON (escaped).
       * To search for "C:\Users" in data, we search for "C:\\Users" (JSON-encoded form).
       *
       * This test verifies backslash doesn't break the LIKE escape mechanism.
       */
      it('should handle backslash in search query correctly', async () => {
        await ns.create('Path', { location: 'C:\\Users\\test' })
        await ns.create('Path', { location: 'C:Userstest' })
        await ns.create('Path', { location: '/home/test' })

        // Search for the JSON-encoded form (backslashes are doubled in JSON)
        // In JS: 'C:\\\\Users' is the string 'C:\\Users'
        const results = await ns.search('C:\\\\Users')

        // Should match the path with actual backslashes
        expect(results.length).toBe(1)
        expect((results[0].data as { location: string }).location).toBe('C:\\Users\\test')
      })
    })

    describe('combined special characters', () => {
      /**
       * TEST 6: Query with both % and _ should match literally
       */
      it('should handle query with both % and _ as literals', async () => {
        await ns.create('Template', { pattern: '100%_complete' })
        await ns.create('Template', { pattern: '100XYcomplete' })
        await ns.create('Template', { pattern: '100%Xcomplete' })

        const results = await ns.search('100%_')

        // Should only match the one with literal "100%_"
        expect(results.length).toBe(1)
        expect((results[0].data as { pattern: string }).pattern).toBe('100%_complete')
      })

      /**
       * TEST 7: Complex pattern with all special chars
       *
       * Note: Backslash in data is JSON-encoded, so to find "path\100%_" we
       * search for "path\\100%_" (the JSON-encoded representation).
       */
      it('should handle complex query with %, _, and backslash', async () => {
        await ns.create('Data', { value: 'path\\100%_done' })
        await ns.create('Data', { value: 'pathX100XXdone' })

        // Search for the JSON-encoded form
        // In JS: 'path\\\\100%_' is the string 'path\\100%_'
        const results = await ns.search('path\\\\100%_')

        // Should match the exact literal pattern
        expect(results.length).toBe(1)
        expect((results[0].data as { value: string }).value).toBe('path\\100%_done')
      })
    })

    describe('search accuracy with special characters', () => {
      /**
       * TEST 8: Ensure search results are accurate, not overly broad
       */
      it('should return accurate results count with special characters', async () => {
        // Create 10 items, only 1 should match
        await ns.create('Item', { name: 'item_1' })
        await ns.create('Item', { name: 'itemX1' })
        await ns.create('Item', { name: 'itemA1' })
        await ns.create('Item', { name: 'itemB1' })
        await ns.create('Item', { name: 'item21' })
        await ns.create('Item', { name: 'item31' })
        await ns.create('Item', { name: 'item41' })
        await ns.create('Item', { name: 'item51' })
        await ns.create('Item', { name: 'item61' })
        await ns.create('Item', { name: 'item71' })

        const results = await ns.search('item_1')

        // Should ONLY match "item_1", not all the others where _ would match any char
        expect(results.length).toBe(1)
      })
    })
  })

  describe('MemoryProvider', () => {
    let provider: MemoryProvider

    beforeEach(() => {
      provider = new MemoryProvider()
    })

    describe('search with special characters', () => {
      /**
       * MemoryProvider uses String.includes() which already treats
       * special characters literally. These tests verify that behavior.
       *
       * Note: MemoryProvider doesn't use SQL LIKE, so it shouldn't have
       * the wildcard problem. These tests document the expected behavior.
       */

      it('should match literal percent sign correctly', async () => {
        await provider.create('Product', { name: '100% Complete' })
        await provider.create('Product', { name: '100 Items' })
        await provider.create('Product', { name: '100 Dollars' })

        const results = await provider.search('100%')

        // MemoryProvider uses includes(), so this should work
        expect(results.length).toBe(1)
        expect((results[0].data as { name: string }).name).toBe('100% Complete')
      })

      it('should match literal underscore correctly', async () => {
        await provider.create('User', { username: 'test_user' })
        await provider.create('User', { username: 'testXuser' })
        await provider.create('User', { username: 'test1user' })

        const results = await provider.search('test_user')

        // MemoryProvider uses includes(), so this should work
        expect(results.length).toBe(1)
        expect((results[0].data as { username: string }).username).toBe('test_user')
      })

      it('should handle backslash correctly', async () => {
        await provider.create('Path', { location: 'C:\\Users\\test' })
        await provider.create('Path', { location: 'C:Userstest' })

        // MemoryProvider searches JSON.stringify(data).toLowerCase().includes(query)
        // Backslashes in data are doubled in JSON, so search for JSON-encoded form
        // In JS: 'C:\\\\Users' is the string 'C:\\Users'
        const results = await provider.search('C:\\\\Users')

        expect(results.length).toBe(1)
        expect((results[0].data as { location: string }).location).toBe('C:\\Users\\test')
      })
    })
  })
})
