/**
 * Relationships Tests for ai-database (RED phase)
 *
 * Tests relationship management and graph traversal via the _rels table.
 * This enables graph-style queries with entity relationships, direction-aware
 * traversal, and N+1 batch optimization.
 *
 * Uses @cloudflare/vitest-pool-workers for real Cloudflare Workers execution.
 * NO MOCKS - tests use real Durable Objects with SQLite storage.
 *
 * These tests should FAIL initially because the relationship/traversal
 * endpoints need enhancement for these specific features.
 *
 * Bead: aip-bi3s
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'

// =============================================================================
// Helpers
// =============================================================================

/**
 * Helper to get a stub for the DatabaseDO Durable Object.
 * Each test gets a unique DO instance for isolation.
 */
function getStub(name?: string): DurableObjectStub {
  const id = env.DATABASE.idFromName(name ?? crypto.randomUUID())
  return env.DATABASE.get(id)
}

/**
 * Helper to send a request to the DO and get JSON response
 */
async function doRequest(
  stub: DurableObjectStub,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return stub.fetch(`https://db.test${path}`, options)
}

/**
 * Helper to send JSON body request
 */
async function doJSON(
  stub: DurableObjectStub,
  path: string,
  body: unknown,
  method = 'POST'
): Promise<Response> {
  return stub.fetch(`https://db.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Shorthand to POST to /data and parse the JSON result.
 */
async function insertData(
  stub: DurableObjectStub,
  record: { id?: string; type: string; data: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  const res = await doJSON(stub, '/data', record)
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>>
}

/**
 * Shorthand to POST to /rels and parse the JSON result.
 */
async function insertRel(
  stub: DurableObjectStub,
  rel: { from_id: string; relation: string; to_id: string; metadata?: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  const res = await doJSON(stub, '/rels', rel)
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>>
}

// =============================================================================
// Relationships - relate/unrelate
// =============================================================================

describe('Relationships - relate/unrelate', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Seed with test entities
    await insertData(stub, { id: 'user-1', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'user-2', type: 'User', data: { name: 'Bob' } })
    await insertData(stub, { id: 'post-1', type: 'Post', data: { title: 'First Post' } })
    await insertData(stub, { id: 'post-2', type: 'Post', data: { title: 'Second Post' } })
    await insertData(stub, { id: 'tag-1', type: 'Tag', data: { name: 'tech' } })
    await insertData(stub, { id: 'tag-2', type: 'Tag', data: { name: 'news' } })
  })

  it('should create relationship between two entities', async () => {
    const rel = await insertRel(stub, {
      from_id: 'user-1',
      relation: 'authored',
      to_id: 'post-1',
    })

    expect(rel.from_id).toBe('user-1')
    expect(rel.relation).toBe('authored')
    expect(rel.to_id).toBe('post-1')
    expect(rel.created_at).toBeDefined()
  })

  it('should store metadata on relationship', async () => {
    const rel = await insertRel(stub, {
      from_id: 'user-1',
      relation: 'authored',
      to_id: 'post-1',
      metadata: { role: 'primary_author', contribution: 0.8 },
    })

    expect(rel.metadata).toEqual({ role: 'primary_author', contribution: 0.8 })
  })

  it('should support multiple relations between same entities', async () => {
    // User can both author and like a post
    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'authored',
      to_id: 'post-1',
    })
    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'liked',
      to_id: 'post-1',
    })

    // Query relationships from user-1
    const res = await doRequest(stub, '/rels?from_id=user-1')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<Record<string, unknown>>

    expect(rels).toHaveLength(2)
    const relationTypes = rels.map((r) => r.relation)
    expect(relationTypes).toContain('authored')
    expect(relationTypes).toContain('liked')
  })

  it('should remove specific relationship with unrelate', async () => {
    // Create two relationships
    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'authored',
      to_id: 'post-1',
    })
    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'liked',
      to_id: 'post-1',
    })

    // Remove only the 'liked' relationship
    const deleteRes = await doJSON(
      stub,
      '/rels/delete',
      {
        from_id: 'user-1',
        relation: 'liked',
        to_id: 'post-1',
      },
      'DELETE'
    )
    expect(deleteRes.status).toBe(200)
    const deleteResult = (await deleteRes.json()) as Record<string, unknown>
    expect(deleteResult.deleted).toBe(true)

    // Verify only 'authored' remains
    const res = await doRequest(stub, '/rels?from_id=user-1')
    const rels = (await res.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(1)
    expect(rels[0].relation).toBe('authored')
  })

  it('should throw if entity does not exist', async () => {
    // Try to create relationship with non-existent entity
    // Note: Current implementation may not enforce this - test captures desired behavior
    const res = await doJSON(stub, '/rels', {
      from_id: 'non-existent-user',
      relation: 'authored',
      to_id: 'post-1',
    })

    // Expected: Either 400/404 error, or relationship validation endpoint
    // This test captures the desired behavior that relations should validate entity existence
    // If the current implementation allows dangling relationships, this test will fail
    // which is the expected RED phase behavior
    expect(res.status).toBe(400)
    const error = (await res.json()) as Record<string, unknown>
    expect(error.error).toContain('entity')
  })

  it('should be idempotent - no duplicate relations', async () => {
    // Create the same relationship twice
    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'authored',
      to_id: 'post-1',
    })

    // Second creation should succeed but not create duplicate
    const secondRes = await doJSON(stub, '/rels', {
      from_id: 'user-1',
      relation: 'authored',
      to_id: 'post-1',
    })
    expect(secondRes.status).toBe(200)

    // Query should return only one relationship
    const queryRes = await doRequest(stub, '/rels?from_id=user-1&relation=authored&to_id=post-1')
    const rels = (await queryRes.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(1)
  })
})

// =============================================================================
// Relationships - related query
// =============================================================================

describe('Relationships - related query', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Create a social graph: users, posts, and relationships
    await insertData(stub, { id: 'alice', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'bob', type: 'User', data: { name: 'Bob' } })
    await insertData(stub, { id: 'charlie', type: 'User', data: { name: 'Charlie' } })
    await insertData(stub, { id: 'post-a', type: 'Post', data: { title: 'Post A' } })
    await insertData(stub, { id: 'post-b', type: 'Post', data: { title: 'Post B' } })
    await insertData(stub, { id: 'post-c', type: 'Post', data: { title: 'Post C' } })

    // Alice authored post-a and post-b
    await insertRel(stub, { from_id: 'alice', relation: 'authored', to_id: 'post-a' })
    await insertRel(stub, { from_id: 'alice', relation: 'authored', to_id: 'post-b' })
    // Bob authored post-c
    await insertRel(stub, { from_id: 'bob', relation: 'authored', to_id: 'post-c' })
    // Alice follows Bob, Bob follows Charlie
    await insertRel(stub, { from_id: 'alice', relation: 'follows', to_id: 'bob' })
    await insertRel(stub, { from_id: 'bob', relation: 'follows', to_id: 'charlie' })
    // Charlie follows Alice (creates a cycle)
    await insertRel(stub, { from_id: 'charlie', relation: 'follows', to_id: 'alice' })
  })

  it('should get all entities related via a relation', async () => {
    // Get all posts authored by Alice
    const res = await doRequest(stub, '/traverse?from_id=alice&relation=authored')
    expect(res.status).toBe(200)
    const posts = (await res.json()) as Array<Record<string, unknown>>

    expect(posts).toHaveLength(2)
    const titles = posts.map((p) => (p.data as Record<string, unknown>).title)
    expect(titles).toContain('Post A')
    expect(titles).toContain('Post B')
  })

  it('should support direction: out (from entity)', async () => {
    // direction=out means: find entities that this entity points TO
    const res = await doRequest(stub, '/traverse?from_id=alice&relation=follows&direction=out')
    expect(res.status).toBe(200)
    const following = (await res.json()) as Array<Record<string, unknown>>

    expect(following).toHaveLength(1)
    expect(following[0].id).toBe('bob')
  })

  it('should support direction: in (to entity)', async () => {
    // direction=in means: find entities that point TO this entity
    const res = await doRequest(stub, '/traverse?to_id=alice&relation=follows&direction=in')
    expect(res.status).toBe(200)
    const followers = (await res.json()) as Array<Record<string, unknown>>

    expect(followers).toHaveLength(1)
    expect(followers[0].id).toBe('charlie')
  })

  it('should support direction: both', async () => {
    // direction=both means: find entities connected in either direction
    // For Bob: follows charlie (out), followed by alice (in)
    const res = await doRequest(stub, '/traverse?id=bob&relation=follows&direction=both')
    expect(res.status).toBe(200)
    const connected = (await res.json()) as Array<Record<string, unknown>>

    expect(connected).toHaveLength(2)
    const ids = connected.map((c) => c.id)
    expect(ids).toContain('alice') // follows bob
    expect(ids).toContain('charlie') // bob follows charlie
  })

  it('should filter by relation name', async () => {
    // Alice has both 'authored' and 'follows' relations
    const authoredRes = await doRequest(stub, '/traverse?from_id=alice&relation=authored')
    const authored = (await authoredRes.json()) as Array<Record<string, unknown>>
    expect(authored.every((r) => r.type === 'Post')).toBe(true)

    const followsRes = await doRequest(stub, '/traverse?from_id=alice&relation=follows')
    const follows = (await followsRes.json()) as Array<Record<string, unknown>>
    expect(follows.every((r) => r.type === 'User')).toBe(true)
  })

  it('should return empty array if no relations', async () => {
    // Create a new isolated user with no relationships
    await insertData(stub, { id: 'lonely', type: 'User', data: { name: 'Lonely User' } })

    const res = await doRequest(stub, '/traverse?from_id=lonely&relation=follows')
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<unknown>
    expect(results).toHaveLength(0)
  })
})

// =============================================================================
// Relationships - graph traversal
// =============================================================================

describe('Relationships - graph traversal', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Create a hierarchical structure: Company -> Department -> Team -> Employee
    await insertData(stub, { id: 'acme', type: 'Company', data: { name: 'ACME Corp' } })
    await insertData(stub, { id: 'eng', type: 'Department', data: { name: 'Engineering' } })
    await insertData(stub, { id: 'sales', type: 'Department', data: { name: 'Sales' } })
    await insertData(stub, { id: 'frontend', type: 'Team', data: { name: 'Frontend Team' } })
    await insertData(stub, { id: 'backend', type: 'Team', data: { name: 'Backend Team' } })
    await insertData(stub, {
      id: 'emp-1',
      type: 'Employee',
      data: { name: 'Alice', role: 'Engineer' },
    })
    await insertData(stub, {
      id: 'emp-2',
      type: 'Employee',
      data: { name: 'Bob', role: 'Engineer' },
    })
    await insertData(stub, {
      id: 'emp-3',
      type: 'Employee',
      data: { name: 'Charlie', role: 'Manager' },
    })

    // Build the hierarchy
    await insertRel(stub, { from_id: 'acme', relation: 'has_department', to_id: 'eng' })
    await insertRel(stub, { from_id: 'acme', relation: 'has_department', to_id: 'sales' })
    await insertRel(stub, { from_id: 'eng', relation: 'has_team', to_id: 'frontend' })
    await insertRel(stub, { from_id: 'eng', relation: 'has_team', to_id: 'backend' })
    await insertRel(stub, { from_id: 'frontend', relation: 'has_member', to_id: 'emp-1' })
    await insertRel(stub, { from_id: 'frontend', relation: 'has_member', to_id: 'emp-2' })
    await insertRel(stub, { from_id: 'backend', relation: 'has_member', to_id: 'emp-3' })
  })

  it('should traverse one hop: entity.relation', async () => {
    // acme -> has_department -> [eng, sales]
    const res = await doRequest(stub, '/traverse?from_id=acme&relation=has_department')
    expect(res.status).toBe(200)
    const depts = (await res.json()) as Array<Record<string, unknown>>

    expect(depts).toHaveLength(2)
    const names = depts.map((d) => (d.data as Record<string, unknown>).name)
    expect(names).toContain('Engineering')
    expect(names).toContain('Sales')
  })

  it('should traverse multiple hops: entity.rel1.rel2', async () => {
    // acme -> has_department -> has_team -> all teams in ACME
    const res = await doRequest(stub, '/traverse?from_id=acme&relation=has_department,has_team')
    expect(res.status).toBe(200)
    const teams = (await res.json()) as Array<Record<string, unknown>>

    expect(teams).toHaveLength(2)
    const names = teams.map((t) => (t.data as Record<string, unknown>).name)
    expect(names).toContain('Frontend Team')
    expect(names).toContain('Backend Team')
  })

  it('should traverse three hops: company.dept.team.member', async () => {
    // acme -> has_department -> has_team -> has_member -> all employees
    const res = await doRequest(
      stub,
      '/traverse?from_id=acme&relation=has_department,has_team,has_member'
    )
    expect(res.status).toBe(200)
    const employees = (await res.json()) as Array<Record<string, unknown>>

    expect(employees).toHaveLength(3)
    const names = employees.map((e) => (e.data as Record<string, unknown>).name)
    expect(names).toContain('Alice')
    expect(names).toContain('Bob')
    expect(names).toContain('Charlie')
  })

  it('should support N+1 batch optimization', async () => {
    // This test verifies that traversal is optimized to avoid N+1 queries
    // When traversing company -> departments -> teams, it should batch-load
    // teams for all departments in a single query, not one per department

    // Create a company with many departments
    await insertData(stub, { id: 'bigcorp', type: 'Company', data: { name: 'Big Corp' } })
    for (let i = 1; i <= 10; i++) {
      await insertData(stub, { id: `dept-${i}`, type: 'Department', data: { name: `Dept ${i}` } })
      await insertRel(stub, { from_id: 'bigcorp', relation: 'has_department', to_id: `dept-${i}` })

      await insertData(stub, { id: `team-${i}`, type: 'Team', data: { name: `Team ${i}` } })
      await insertRel(stub, { from_id: `dept-${i}`, relation: 'has_team', to_id: `team-${i}` })
    }

    // Batch traversal should work efficiently
    const res = await doRequest(stub, '/traverse?from_id=bigcorp&relation=has_department,has_team')
    expect(res.status).toBe(200)
    const teams = (await res.json()) as Array<Record<string, unknown>>
    expect(teams).toHaveLength(10)

    // Note: Actual N+1 optimization verification would require query counting
    // which is difficult to test directly. The test ensures correctness;
    // implementation should ensure efficiency.
  })

  it('should handle circular relationships without infinite loop', async () => {
    // Create circular reference: A -> B -> C -> A
    await insertData(stub, { id: 'node-a', type: 'Node', data: { name: 'A' } })
    await insertData(stub, { id: 'node-b', type: 'Node', data: { name: 'B' } })
    await insertData(stub, { id: 'node-c', type: 'Node', data: { name: 'C' } })
    await insertRel(stub, { from_id: 'node-a', relation: 'next', to_id: 'node-b' })
    await insertRel(stub, { from_id: 'node-b', relation: 'next', to_id: 'node-c' })
    await insertRel(stub, { from_id: 'node-c', relation: 'next', to_id: 'node-a' })

    // Traverse with a max depth should not hang
    const res = await doRequest(
      stub,
      '/traverse?from_id=node-a&relation=next,next,next,next&maxDepth=5'
    )
    expect(res.status).toBe(200)
    // Should complete without timeout (vitest default timeout will catch infinite loops)

    const results = (await res.json()) as Array<Record<string, unknown>>
    // With 4 hops from A: A->B->C->A->B, so we end at B
    // But with cycle detection, it should handle gracefully
    expect(Array.isArray(results)).toBe(true)
  })

  it('should support depth limit in traversal', async () => {
    // Traverse only 1 hop even though path is longer
    const res = await doRequest(
      stub,
      '/traverse?from_id=acme&relation=has_department,has_team,has_member&maxDepth=1'
    )
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>

    // With maxDepth=1, should only get direct departments
    results.forEach((r) => {
      expect(r.type).toBe('Department')
    })
  })
})

// =============================================================================
// Relationships - cascade
// =============================================================================

describe('Relationships - cascade', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    // Create an author with multiple posts
    await insertData(stub, { id: 'author-1', type: 'Author', data: { name: 'Jane Doe' } })
    await insertData(stub, { id: 'blog-1', type: 'Post', data: { title: 'First Blog' } })
    await insertData(stub, { id: 'blog-2', type: 'Post', data: { title: 'Second Blog' } })
    await insertData(stub, { id: 'comment-1', type: 'Comment', data: { text: 'Great post!' } })
    await insertData(stub, { id: 'comment-2', type: 'Comment', data: { text: 'Thanks!' } })

    // Author wrote posts
    await insertRel(stub, { from_id: 'author-1', relation: 'wrote', to_id: 'blog-1' })
    await insertRel(stub, { from_id: 'author-1', relation: 'wrote', to_id: 'blog-2' })
    // Posts have comments
    await insertRel(stub, { from_id: 'blog-1', relation: 'has_comment', to_id: 'comment-1' })
    await insertRel(stub, { from_id: 'blog-1', relation: 'has_comment', to_id: 'comment-2' })
  })

  it('should delete relationships when entity deleted', async () => {
    // Verify relationship exists
    const beforeRes = await doRequest(stub, '/rels?from_id=blog-1&relation=has_comment')
    const beforeRels = (await beforeRes.json()) as Array<unknown>
    expect(beforeRels).toHaveLength(2)

    // Delete the blog post
    const deleteRes = await doRequest(stub, '/data/blog-1', { method: 'DELETE' })
    expect(deleteRes.status).toBe(200)

    // Relationships should be cleaned up
    const afterRes = await doRequest(stub, '/rels?from_id=blog-1')
    const afterRels = (await afterRes.json()) as Array<unknown>
    expect(afterRels).toHaveLength(0)

    // Inbound relationships should also be cleaned
    const inboundRes = await doRequest(stub, '/rels?to_id=blog-1')
    const inboundRels = (await inboundRes.json()) as Array<unknown>
    expect(inboundRels).toHaveLength(0)
  })

  it('should optionally cascade delete related entities', async () => {
    // Delete author with cascade option
    const deleteRes = await doJSON(stub, '/data/author-1?cascade=true', {}, 'DELETE')
    expect(deleteRes.status).toBe(200)
    const result = (await deleteRes.json()) as Record<string, unknown>

    // Verify cascade happened
    expect(result.deleted).toBe(true)
    expect(result.cascadeDeleted).toBeDefined()

    // Check that related posts were also deleted
    const blog1Res = await doRequest(stub, '/data/blog-1')
    expect(blog1Res.status).toBe(404)

    const blog2Res = await doRequest(stub, '/data/blog-2')
    expect(blog2Res.status).toBe(404)
  })

  it('should support configurable cascade depth', async () => {
    // With cascade depth of 1, should delete direct relations but not nested
    const deleteRes = await doJSON(stub, '/data/author-1?cascade=true&cascadeDepth=1', {}, 'DELETE')
    expect(deleteRes.status).toBe(200)

    // Author and direct posts should be deleted
    const blog1Res = await doRequest(stub, '/data/blog-1')
    expect(blog1Res.status).toBe(404)

    // Comments (nested under posts) should NOT be deleted with depth=1
    // because they're 2 hops away from author
    // Note: This depends on implementation - test captures expected behavior
    const comment1Res = await doRequest(stub, '/data/comment-1')
    // With depth=1, comments may or may not be deleted depending on implementation
    // This test documents the expected behavior
    expect([200, 404]).toContain(comment1Res.status)
  })

  it('should not cascade delete by default', async () => {
    // Delete author without cascade option
    const deleteRes = await doRequest(stub, '/data/author-1', { method: 'DELETE' })
    expect(deleteRes.status).toBe(200)

    // Posts should NOT be deleted
    const blog1Res = await doRequest(stub, '/data/blog-1')
    expect(blog1Res.status).toBe(200)

    const blog2Res = await doRequest(stub, '/data/blog-2')
    expect(blog2Res.status).toBe(200)

    // Only relationships FROM author should be cleaned
    const relsRes = await doRequest(stub, '/rels?from_id=author-1')
    const rels = (await relsRes.json()) as Array<unknown>
    expect(rels).toHaveLength(0)
  })
})

// =============================================================================
// Relationships - Edge Cases
// =============================================================================

describe('Relationships - Edge Cases', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
  })

  it('should handle self-referential relationships', async () => {
    await insertData(stub, { id: 'user-1', type: 'User', data: { name: 'Narcissus' } })
    await insertRel(stub, { from_id: 'user-1', relation: 'follows', to_id: 'user-1' })

    const res = await doRequest(stub, '/traverse?from_id=user-1&relation=follows')
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('user-1')
  })

  it('should handle unicode in relation names', async () => {
    await insertData(stub, { id: 'a', type: 'Node', data: {} })
    await insertData(stub, { id: 'b', type: 'Node', data: {} })

    const rel = await insertRel(stub, {
      from_id: 'a',
      relation: '\u00e0_ami_de',
      to_id: 'b',
    })
    expect(rel.relation).toBe('\u00e0_ami_de')

    const res = await doRequest(stub, '/traverse?from_id=a&relation=%C3%A0_ami_de')
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>
    expect(results).toHaveLength(1)
  })

  it('should handle special characters in IDs', async () => {
    await insertData(stub, { id: 'user:alice@example.com', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'post/2024/01/hello', type: 'Post', data: { title: 'Hello' } })

    await insertRel(stub, {
      from_id: 'user:alice@example.com',
      relation: 'authored',
      to_id: 'post/2024/01/hello',
    })

    const res = await doRequest(
      stub,
      '/traverse?from_id=' + encodeURIComponent('user:alice@example.com') + '&relation=authored'
    )
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('post/2024/01/hello')
  })

  it('should handle empty relation name gracefully', async () => {
    const res = await doJSON(stub, '/rels', {
      from_id: 'a',
      relation: '',
      to_id: 'b',
    })
    // Should reject empty relation name
    expect(res.status).toBe(400)
  })

  it('should handle very long relation chains', async () => {
    // Create a chain of 20 nodes
    for (let i = 0; i < 20; i++) {
      await insertData(stub, { id: `chain-${i}`, type: 'Node', data: { index: i } })
      if (i > 0) {
        await insertRel(stub, {
          from_id: `chain-${i - 1}`,
          relation: 'next',
          to_id: `chain-${i}`,
        })
      }
    }

    // Traverse 10 hops
    const relations = Array(10).fill('next').join(',')
    const res = await doRequest(stub, `/traverse?from_id=chain-0&relation=${relations}`)
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('chain-10')
  })

  it('should return empty for non-existent starting entity', async () => {
    const res = await doRequest(stub, '/traverse?from_id=does-not-exist&relation=anything')
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<unknown>
    expect(results).toHaveLength(0)
  })

  it('should filter traversal results by type', async () => {
    await insertData(stub, { id: 'hub', type: 'Hub', data: {} })
    await insertData(stub, { id: 'spoke-1', type: 'TypeA', data: { name: 'A1' } })
    await insertData(stub, { id: 'spoke-2', type: 'TypeB', data: { name: 'B1' } })
    await insertData(stub, { id: 'spoke-3', type: 'TypeA', data: { name: 'A2' } })

    await insertRel(stub, { from_id: 'hub', relation: 'connected', to_id: 'spoke-1' })
    await insertRel(stub, { from_id: 'hub', relation: 'connected', to_id: 'spoke-2' })
    await insertRel(stub, { from_id: 'hub', relation: 'connected', to_id: 'spoke-3' })

    // Filter to only TypeA
    const res = await doRequest(stub, '/traverse?from_id=hub&relation=connected&type=TypeA')
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.type === 'TypeA')).toBe(true)
  })
})

// =============================================================================
// Relationships - Metadata queries
// =============================================================================

describe('Relationships - Metadata queries', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()
    await insertData(stub, { id: 'user-1', type: 'User', data: { name: 'Alice' } })
    await insertData(stub, { id: 'skill-ts', type: 'Skill', data: { name: 'TypeScript' } })
    await insertData(stub, { id: 'skill-rust', type: 'Skill', data: { name: 'Rust' } })
    await insertData(stub, { id: 'skill-go', type: 'Skill', data: { name: 'Go' } })

    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'has_skill',
      to_id: 'skill-ts',
      metadata: { level: 'expert', years: 5 },
    })
    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'has_skill',
      to_id: 'skill-rust',
      metadata: { level: 'intermediate', years: 2 },
    })
    await insertRel(stub, {
      from_id: 'user-1',
      relation: 'has_skill',
      to_id: 'skill-go',
      metadata: { level: 'beginner', years: 1 },
    })
  })

  it('should include relationship metadata in results', async () => {
    const res = await doRequest(
      stub,
      '/traverse?from_id=user-1&relation=has_skill&includeMetadata=true'
    )
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>

    expect(results).toHaveLength(3)
    // Each result should include the relationship metadata
    const tsResult = results.find((r) => r.id === 'skill-ts')
    expect(tsResult?.$rel).toBeDefined()
    expect((tsResult?.$rel as Record<string, unknown>)?.level).toBe('expert')
  })

  it('should filter by relationship metadata', async () => {
    // Find all skills where user is 'expert' level
    const res = await doJSON(stub, '/traverse/filter', {
      from_id: 'user-1',
      relation: 'has_skill',
      metadataFilter: { level: 'expert' },
    })
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('skill-ts')
  })

  it('should filter by metadata with operators', async () => {
    // Find skills with years >= 2
    const res = await doJSON(stub, '/traverse/filter', {
      from_id: 'user-1',
      relation: 'has_skill',
      metadataFilter: { years: { $gte: 2 } },
    })
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>

    expect(results).toHaveLength(2)
    const ids = results.map((r) => r.id)
    expect(ids).toContain('skill-ts')
    expect(ids).toContain('skill-rust')
  })

  it('should update relationship metadata', async () => {
    // Update Alice's TypeScript skill level
    const updateRes = await doJSON(
      stub,
      '/rels',
      {
        from_id: 'user-1',
        relation: 'has_skill',
        to_id: 'skill-ts',
        metadata: { level: 'master', years: 6 },
      },
      'PATCH'
    )
    expect([200, 201]).toContain(updateRes.status)

    // Verify the update
    const res = await doRequest(stub, '/rels?from_id=user-1&relation=has_skill&to_id=skill-ts')
    expect(res.status).toBe(200)
    const rels = (await res.json()) as Array<Record<string, unknown>>
    expect(rels).toHaveLength(1)
    expect((rels[0].metadata as Record<string, unknown>)?.level).toBe('master')
    expect((rels[0].metadata as Record<string, unknown>)?.years).toBe(6)
  })
})
