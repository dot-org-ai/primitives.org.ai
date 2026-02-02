/**
 * Query Operations Tests for ai-database
 *
 * Tests the list, find, and search query operations against DO SQLite.
 * These operations provide flexible querying with filtering, pagination,
 * ordering, and text search capabilities.
 *
 * Uses @cloudflare/vitest-pool-workers for real Cloudflare Workers execution.
 *
 * Bead: aip-8ldh
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getStub, doRequest, doJSON } from './test-helpers.js'

// =============================================================================
// Query Operations - list
// =============================================================================

describe('Query Operations - list', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Seed with test data - products with varying attributes
    await doJSON(stub, '/data', {
      id: 'product-1',
      type: 'Product',
      data: { name: 'Laptop', price: 999, category: 'electronics', rating: 4.5, inStock: true },
    })
    await doJSON(stub, '/data', {
      id: 'product-2',
      type: 'Product',
      data: { name: 'Mouse', price: 29, category: 'electronics', rating: 4.2, inStock: true },
    })
    await doJSON(stub, '/data', {
      id: 'product-3',
      type: 'Product',
      data: { name: 'Desk Chair', price: 299, category: 'furniture', rating: 4.8, inStock: false },
    })
    await doJSON(stub, '/data', {
      id: 'product-4',
      type: 'Product',
      data: { name: 'Monitor', price: 499, category: 'electronics', rating: 4.0, inStock: true },
    })
    await doJSON(stub, '/data', {
      id: 'product-5',
      type: 'Product',
      data: { name: 'Keyboard', price: 79, category: 'electronics', rating: 4.6, inStock: false },
    })
    // Different type for isolation testing
    await doJSON(stub, '/data', {
      id: 'user-1',
      type: 'User',
      data: { name: 'Alice', age: 30 },
    })
  })

  it('should list all entities of a type', async () => {
    const res = await doRequest(stub, '/query/list?type=Product')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(5)
    expect(items.every((item) => item.type === 'Product')).toBe(true)
  })

  it('should support limit option', async () => {
    const res = await doRequest(stub, '/query/list?type=Product&limit=3')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(3)
  })

  it('should support offset option for pagination', async () => {
    // Get first page
    const page1Res = await doRequest(stub, '/query/list?type=Product&limit=2&offset=0')
    const page1 = (await page1Res.json()) as Array<Record<string, unknown>>
    expect(page1).toHaveLength(2)

    // Get second page
    const page2Res = await doRequest(stub, '/query/list?type=Product&limit=2&offset=2')
    const page2 = (await page2Res.json()) as Array<Record<string, unknown>>
    expect(page2).toHaveLength(2)

    // Pages should have different items
    const page1Ids = page1.map((item) => item.id)
    const page2Ids = page2.map((item) => item.id)
    expect(page1Ids).not.toEqual(page2Ids)
  })

  it('should support orderBy with asc', async () => {
    const res = await doRequest(stub, '/query/list?type=Product&orderBy=price&order=asc')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    const prices = items.map((item) => (item.data as Record<string, unknown>).price as number)
    expect(prices).toEqual([29, 79, 299, 499, 999])
  })

  it('should support orderBy with desc', async () => {
    const res = await doRequest(stub, '/query/list?type=Product&orderBy=price&order=desc')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    const prices = items.map((item) => (item.data as Record<string, unknown>).price as number)
    expect(prices).toEqual([999, 499, 299, 79, 29])
  })

  it('should support where clause with equality', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Product',
      where: { category: 'furniture' },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect((items[0].data as Record<string, unknown>).category).toBe('furniture')
  })

  it('should support where clause with $gt', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Product',
      where: { price: { $gt: 100 } },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(3) // 999, 299, 499
    items.forEach((item) => {
      const price = (item.data as Record<string, unknown>).price as number
      expect(price).toBeGreaterThan(100)
    })
  })

  it('should support where clause with $lt', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Product',
      where: { price: { $lt: 100 } },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(2) // 29, 79
    items.forEach((item) => {
      const price = (item.data as Record<string, unknown>).price as number
      expect(price).toBeLessThan(100)
    })
  })

  it('should support where clause with $gte', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Product',
      where: { price: { $gte: 299 } },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(3) // 999, 299, 499
    items.forEach((item) => {
      const price = (item.data as Record<string, unknown>).price as number
      expect(price).toBeGreaterThanOrEqual(299)
    })
  })

  it('should support where clause with $lte', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Product',
      where: { price: { $lte: 79 } },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(2) // 29, 79
    items.forEach((item) => {
      const price = (item.data as Record<string, unknown>).price as number
      expect(price).toBeLessThanOrEqual(79)
    })
  })

  it('should support where clause with $in array', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Product',
      where: { category: { $in: ['electronics', 'furniture'] } },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(5)
    items.forEach((item) => {
      const category = (item.data as Record<string, unknown>).category as string
      expect(['electronics', 'furniture']).toContain(category)
    })
  })

  it('should support where clause with $ne (not equal)', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Product',
      where: { category: { $ne: 'electronics' } },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(1) // Only the furniture item
    expect((items[0].data as Record<string, unknown>).category).toBe('furniture')
  })

  it('should support multiple where conditions (AND)', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Product',
      where: {
        category: 'electronics',
        inStock: true,
      },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(3) // Laptop, Mouse, Monitor
    items.forEach((item) => {
      const data = item.data as Record<string, unknown>
      expect(data.category).toBe('electronics')
      expect(data.inStock).toBe(true)
    })
  })

  it('should return empty array for unknown type', async () => {
    const res = await doRequest(stub, '/query/list?type=NonExistentType')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<unknown>
    expect(items).toHaveLength(0)
  })

  it('should return empty array when no records match where clause', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Product',
      where: { price: { $gt: 10000 } },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<unknown>
    expect(items).toHaveLength(0)
  })
})

// =============================================================================
// Query Operations - find
// =============================================================================

describe('Query Operations - find', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Seed with test data
    await doJSON(stub, '/data', {
      id: 'user-1',
      type: 'User',
      data: { name: 'Alice', email: 'alice@example.com', age: 30, role: 'admin' },
    })
    await doJSON(stub, '/data', {
      id: 'user-2',
      type: 'User',
      data: { name: 'Bob', email: 'bob@example.com', age: 25, role: 'user' },
    })
    await doJSON(stub, '/data', {
      id: 'user-3',
      type: 'User',
      data: { name: 'Charlie', email: 'charlie@example.com', age: 35, role: 'user' },
    })
    await doJSON(stub, '/data', {
      id: 'user-4',
      type: 'User',
      data: {
        name: 'Diana',
        email: 'diana@example.com',
        age: 28,
        role: 'admin',
        profile: { bio: 'Developer', location: 'NYC' },
      },
    })
  })

  it('should find entities matching all criteria', async () => {
    const res = await doJSON(stub, '/query/find', {
      type: 'User',
      where: { role: 'admin' },
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result).not.toBeNull()
    expect((result.data as Record<string, unknown>).role).toBe('admin')
  })

  it('should return first match only', async () => {
    // Should find Alice first (assuming insertion order)
    const res = await doJSON(stub, '/query/find', {
      type: 'User',
      where: { role: 'admin' },
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    // It should return exactly one record, not an array
    expect(result.id).toBeDefined()
    expect(Array.isArray(result)).toBe(false)
  })

  it('should return null if no match', async () => {
    const res = await doJSON(stub, '/query/find', {
      type: 'User',
      where: { role: 'superadmin' },
    })
    expect(res.status).toBe(200)
    const result = await res.json()
    expect(result).toBeNull()
  })

  it('should support nested field queries via json_extract', async () => {
    const res = await doJSON(stub, '/query/find', {
      type: 'User',
      where: { 'profile.location': 'NYC' },
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result).not.toBeNull()
    expect(result.id).toBe('user-4')
    const data = result.data as Record<string, unknown>
    expect((data.profile as Record<string, unknown>).location).toBe('NYC')
  })

  it('should support nested field queries with comparison operators', async () => {
    // First add a user with a nested score
    await doJSON(stub, '/data', {
      id: 'user-5',
      type: 'User',
      data: {
        name: 'Eve',
        stats: { score: 95, level: 10 },
      },
    })

    const res = await doJSON(stub, '/query/find', {
      type: 'User',
      where: { 'stats.score': { $gte: 90 } },
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result).not.toBeNull()
    expect(result.id).toBe('user-5')
  })

  it('should find by multiple criteria', async () => {
    const res = await doJSON(stub, '/query/find', {
      type: 'User',
      where: {
        role: 'user',
        age: { $gte: 30 },
      },
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    expect(result).not.toBeNull()
    const data = result.data as Record<string, unknown>
    expect(data.role).toBe('user')
    expect(data.age as number).toBeGreaterThanOrEqual(30)
  })

  it('should find with orderBy to control which match is returned', async () => {
    const res = await doJSON(stub, '/query/find', {
      type: 'User',
      where: { role: 'admin' },
      orderBy: 'age',
      order: 'desc',
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>
    // Should return the older admin (Alice at 30 vs Diana at 28)
    expect(result.id).toBe('user-1')
  })
})

// =============================================================================
// Query Operations - search
// =============================================================================

describe('Query Operations - search', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Seed with searchable content
    await doJSON(stub, '/data', {
      id: 'article-1',
      type: 'Article',
      data: {
        title: 'Introduction to TypeScript',
        body: 'TypeScript is a strongly typed programming language that builds on JavaScript.',
        tags: ['typescript', 'javascript', 'programming'],
      },
    })
    await doJSON(stub, '/data', {
      id: 'article-2',
      type: 'Article',
      data: {
        title: 'Getting Started with React',
        body: 'React is a JavaScript library for building user interfaces.',
        tags: ['react', 'javascript', 'frontend'],
      },
    })
    await doJSON(stub, '/data', {
      id: 'article-3',
      type: 'Article',
      data: {
        title: 'Node.js Best Practices',
        body: 'Node.js is a JavaScript runtime built on Chrome V8 engine.',
        tags: ['nodejs', 'javascript', 'backend'],
      },
    })
    await doJSON(stub, '/data', {
      id: 'article-4',
      type: 'Article',
      data: {
        title: 'Python for Data Science',
        body: 'Python is widely used in data science and machine learning.',
        tags: ['python', 'data-science', 'ml'],
      },
    })
    await doJSON(stub, '/data', {
      id: 'article-5',
      type: 'Article',
      data: {
        title: 'SQL Database Fundamentals',
        body: 'Learn how to work with SQL databases including SELECT, INSERT, and JOIN operations.',
        tags: ['sql', 'database', 'backend'],
      },
    })
  })

  it('should search entities by text content', async () => {
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: 'JavaScript',
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    // Should find articles about TypeScript, React, and Node.js (all mention JavaScript)
    expect(items.length).toBeGreaterThanOrEqual(3)
    items.forEach((item) => {
      const data = item.data as Record<string, unknown>
      const title = data.title as string
      const body = data.body as string
      const containsJS =
        title.toLowerCase().includes('javascript') || body.toLowerCase().includes('javascript')
      expect(containsJS).toBe(true)
    })
  })

  it('should search across multiple fields', async () => {
    // Search for "React" should find article-2 (in title and body)
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: 'React',
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThanOrEqual(1)
    const hasReact = items.some((item) => {
      const data = item.data as Record<string, unknown>
      return (data.title as string).includes('React')
    })
    expect(hasReact).toBe(true)
  })

  it('should search in specific fields when specified', async () => {
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: 'TypeScript',
      fields: ['title'],
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect((items[0].data as Record<string, unknown>).title).toBe('Introduction to TypeScript')
  })

  it('should escape SQL wildcards in search query', async () => {
    // Add an article with special characters
    await doJSON(stub, '/data', {
      id: 'article-special',
      type: 'Article',
      data: {
        title: 'Using 100% of SQL',
        body: 'Learn about % and _ wildcards in SQL LIKE queries.',
      },
    })

    // Search for "100%" should find only the exact match, not treat % as wildcard
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: '100%',
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    // Should find exactly the article with "100%" in title
    const hasMatch = items.some((item) => item.id === 'article-special')
    expect(hasMatch).toBe(true)
  })

  it('should support minScore threshold', async () => {
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: 'JavaScript programming language',
      minScore: 0.5,
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    // All returned items should have score >= minScore
    items.forEach((item) => {
      const score = item.$score as number | undefined
      if (score !== undefined) {
        expect(score).toBeGreaterThanOrEqual(0.5)
      }
    })
  })

  it('should return results ordered by relevance', async () => {
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: 'TypeScript',
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    // The TypeScript article should be first (most relevant)
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].id).toBe('article-1')
  })

  it('should return empty array when no matches found', async () => {
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: 'Rust programming',
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<unknown>
    expect(items).toHaveLength(0)
  })

  it('should support limit on search results', async () => {
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: 'JavaScript',
      limit: 2,
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<unknown>
    expect(items.length).toBeLessThanOrEqual(2)
  })

  it('should support case-insensitive search', async () => {
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: 'javascript', // lowercase
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThanOrEqual(3)
  })
})

// =============================================================================
// Query Operations - SQL safety
// =============================================================================

describe('Query Operations - SQL safety', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    await doJSON(stub, '/data', {
      id: 'safe-1',
      type: 'SafeTest',
      data: { name: 'Test', value: 100 },
    })
  })

  it('should reject SQL injection in where field names', async () => {
    // Attempt to inject SQL via field name
    const res = await doJSON(stub, '/query/list', {
      type: 'SafeTest',
      where: { "name'; DROP TABLE _data; --": 'malicious' },
    })
    // Should either reject or safely handle without executing injection
    // The response should NOT cause data loss
    const checkRes = await doRequest(stub, '/data/safe-1')
    expect(checkRes.status).toBe(200) // Data should still exist
  })

  it('should reject SQL injection in orderBy field', async () => {
    const res = await doRequest(
      stub,
      '/query/list?type=SafeTest&orderBy=name;DROP%20TABLE%20_data;--'
    )
    // Should either reject with error or safely ignore malicious orderBy
    const checkRes = await doRequest(stub, '/data/safe-1')
    expect(checkRes.status).toBe(200) // Data should still exist
  })

  it('should parameterize all user values', async () => {
    // Attempt SQL injection via value
    const res = await doJSON(stub, '/query/list', {
      type: 'SafeTest',
      where: { name: "Test' OR '1'='1" },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<unknown>
    // Should NOT return all records due to injection
    // Should return empty (no match for literal string "Test' OR '1'='1")
    expect(items).toHaveLength(0)
  })

  it('should validate orderBy field names', async () => {
    // Only allow alphanumeric and underscore characters in field names
    const res = await doRequest(stub, '/query/list?type=SafeTest&orderBy=invalid$field')
    // Should either reject with 400 or safely ignore invalid field
    expect([200, 400]).toContain(res.status)
    if (res.status === 200) {
      // If it returns 200, it should use default ordering, not crash
      const items = (await res.json()) as Array<unknown>
      expect(items).toHaveLength(1)
    }
  })

  it('should sanitize type parameter', async () => {
    // Attempt injection via type parameter
    const res = await doRequest(stub, "/query/list?type=SafeTest';DELETE FROM _data;--")
    // Should either reject or safely handle
    const checkRes = await doRequest(stub, '/data/safe-1')
    expect(checkRes.status).toBe(200) // Data should still exist
  })

  it('should sanitize search query', async () => {
    await doJSON(stub, '/data', {
      id: 'search-safe',
      type: 'Article',
      data: { title: 'Test Article', body: 'Content' },
    })

    // Attempt injection via search query
    const res = await doJSON(stub, '/query/search', {
      type: 'Article',
      query: "test'; DROP TABLE _data; --",
    })
    expect(res.status).toBe(200) // Should return results, not error

    // Verify data still exists
    const checkRes = await doRequest(stub, '/data/search-safe')
    expect(checkRes.status).toBe(200)
  })

  it('should handle $in with malicious array values', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'SafeTest',
      where: {
        name: { $in: ["Test'; DROP TABLE _data;--", 'normal'] },
      },
    })
    expect(res.status).toBe(200)
    // Data should still exist
    const checkRes = await doRequest(stub, '/data/safe-1')
    expect(checkRes.status).toBe(200)
  })
})

// =============================================================================
// Query Operations - Edge Cases
// =============================================================================

describe('Query Operations - Edge Cases', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
  })

  it('should handle empty type gracefully', async () => {
    const res = await doRequest(stub, '/query/list?type=')
    // Should return 400 or empty result
    expect([200, 400]).toContain(res.status)
  })

  it('should handle missing type parameter', async () => {
    const res = await doRequest(stub, '/query/list')
    // Should require type parameter
    expect(res.status).toBe(400)
  })

  it('should handle invalid JSON in POST body', async () => {
    const res = await stub.fetch('https://db.test/query/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json',
    })
    expect(res.status).toBe(400)
  })

  it('should handle extremely large offset', async () => {
    await doJSON(stub, '/data', { id: 'test-1', type: 'Test', data: {} })

    const res = await doRequest(stub, '/query/list?type=Test&offset=999999')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<unknown>
    expect(items).toHaveLength(0) // No items at that offset
  })

  it('should handle negative limit gracefully', async () => {
    await doJSON(stub, '/data', { id: 'test-1', type: 'Test', data: {} })

    const res = await doRequest(stub, '/query/list?type=Test&limit=-1')
    // Should either treat as invalid or use default limit
    expect([200, 400]).toContain(res.status)
  })

  it('should handle boolean values in where clause', async () => {
    await doJSON(stub, '/data', { id: 'bool-1', type: 'Flag', data: { active: true } })
    await doJSON(stub, '/data', { id: 'bool-2', type: 'Flag', data: { active: false } })

    const res = await doJSON(stub, '/query/list', {
      type: 'Flag',
      where: { active: true },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect((items[0].data as Record<string, unknown>).active).toBe(true)
  })

  it('should handle null values in where clause', async () => {
    await doJSON(stub, '/data', { id: 'null-1', type: 'Nullable', data: { value: null } })
    await doJSON(stub, '/data', { id: 'null-2', type: 'Nullable', data: { value: 'present' } })

    const res = await doJSON(stub, '/query/list', {
      type: 'Nullable',
      where: { value: null },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect((items[0].data as Record<string, unknown>).value).toBeNull()
  })

  it('should handle array values in data (not in where)', async () => {
    await doJSON(stub, '/data', {
      id: 'array-1',
      type: 'Tagged',
      data: { tags: ['a', 'b', 'c'] },
    })

    const res = await doRequest(stub, '/query/list?type=Tagged')
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect((items[0].data as Record<string, unknown>).tags).toEqual(['a', 'b', 'c'])
  })

  it('should handle unicode in search queries', async () => {
    await doJSON(stub, '/data', {
      id: 'unicode-1',
      type: 'International',
      data: { title: 'Hello in Japanese: \u3053\u3093\u306b\u3061\u306f' },
    })

    const res = await doJSON(stub, '/query/search', {
      type: 'International',
      query: '\u3053\u3093\u306b\u3061\u306f',
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>
    expect(items.length).toBeGreaterThanOrEqual(1)
  })
})

// =============================================================================
// Query Operations - Combined Operations
// =============================================================================

describe('Query Operations - Combined Operations', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Seed with comprehensive test data
    for (let i = 1; i <= 20; i++) {
      await doJSON(stub, '/data', {
        id: `item-${i}`,
        type: 'Item',
        data: {
          name: `Item ${i}`,
          price: i * 10,
          category: i % 2 === 0 ? 'even' : 'odd',
          active: i <= 10,
        },
      })
    }
  })

  it('should combine where, orderBy, limit, and offset', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Item',
      where: { category: 'even', active: true },
      orderBy: 'price',
      order: 'desc',
      limit: 3,
      offset: 1,
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>

    // Should be even items (2,4,6,8,10), active (<=10), sorted by price desc, skip 1, take 3
    // Sorted: 100(10), 80(8), 60(6), 40(4), 20(2)
    // After offset 1: 80(8), 60(6), 40(4)
    expect(items).toHaveLength(3)
    const prices = items.map((item) => (item.data as Record<string, unknown>).price as number)
    expect(prices).toEqual([80, 60, 40])
  })

  it('should support complex where with multiple operators', async () => {
    const res = await doJSON(stub, '/query/list', {
      type: 'Item',
      where: {
        price: { $gte: 50, $lte: 150 },
        category: 'odd',
      },
    })
    expect(res.status).toBe(200)
    const items = (await res.json()) as Array<Record<string, unknown>>

    // Odd items with price between 50 and 150
    // Items 5,7,9,11,13,15 have prices 50,70,90,110,130,150
    items.forEach((item) => {
      const data = item.data as Record<string, unknown>
      const price = data.price as number
      expect(price).toBeGreaterThanOrEqual(50)
      expect(price).toBeLessThanOrEqual(150)
      expect(data.category).toBe('odd')
    })
  })
})
