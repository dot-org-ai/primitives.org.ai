/**
 * Semantic Search Tests for ai-database (RED phase)
 *
 * Tests AI-powered semantic search using AI Gateway embeddings in the DO layer.
 * This covers:
 * - Embedding generation via AI Gateway
 * - Storage of embeddings in _embeddings table
 * - Vector similarity search (cosine similarity)
 * - Semantic search on entity data
 * - Search with filters (type, time range)
 * - Batch embedding generation
 * - Embedding caching for efficiency
 *
 * Uses @cloudflare/vitest-pool-workers for real Cloudflare Workers execution.
 * NO MOCKS - tests use real AI Gateway bindings and Durable Objects with SQLite storage.
 *
 * These tests should FAIL initially because the semantic search features don't exist yet.
 * This is the RED phase of TDD.
 *
 * Bead: aip-xy46
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get a DurableObject stub for DatabaseDO.
 * Each test gets a unique DO instance for isolation.
 */
function getStub(name?: string): DurableObjectStub {
  const id = env.DATABASE.idFromName(name ?? crypto.randomUUID())
  return env.DATABASE.get(id)
}

/**
 * Send a fetch request to a DO stub and return the Response.
 */
async function doRequest(
  stub: DurableObjectStub,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return stub.fetch(`https://do.test${path}`, options)
}

/**
 * Send a JSON body request to a DO stub.
 */
async function doJSON(
  stub: DurableObjectStub,
  path: string,
  body: unknown,
  method = 'POST'
): Promise<Response> {
  return stub.fetch(`https://do.test${path}`, {
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

// =============================================================================
// Embedding Generation via AI Gateway
// =============================================================================

// TODO: Advanced feature tests - needs investigation
describe('Semantic Search - AI Gateway embeddings', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should generate embedding on entity create', async () => {
    // Create an entity with text content
    await insertData(stub, {
      id: 'article-1',
      type: 'Article',
      data: {
        title: 'Introduction to Machine Learning',
        content: 'Machine learning is a subset of AI.',
      },
    })

    // Query the embedding for this entity
    const res = await doRequest(stub, '/embeddings/Article/article-1')
    expect(res.status).toBe(200)
    const embedding = (await res.json()) as Record<string, unknown>

    expect(embedding.entity_id).toBe('article-1')
    expect(embedding.entity_type).toBe('Article')
    expect(embedding.vector).toBeDefined()
    expect(Array.isArray(embedding.vector)).toBe(true)
    expect((embedding.vector as number[]).length).toBeGreaterThan(0)
  })

  it('should update embedding on entity update', async () => {
    await insertData(stub, {
      id: 'article-1',
      type: 'Article',
      data: { title: 'Original Title', content: 'Original content about databases.' },
    })

    // Get original embedding
    const res1 = await doRequest(stub, '/embeddings/Article/article-1')
    const originalEmbedding = (await res1.json()) as Record<string, unknown>
    const originalVector = originalEmbedding.vector as number[]

    // Update the entity content
    await doJSON(
      stub,
      '/data/article-1',
      { data: { title: 'Updated Title', content: 'Completely different content about AI.' } },
      'PATCH'
    )

    // Get updated embedding
    const res2 = await doRequest(stub, '/embeddings/Article/article-1')
    const updatedEmbedding = (await res2.json()) as Record<string, unknown>
    const updatedVector = updatedEmbedding.vector as number[]

    // Embedding should be different after content change
    expect(updatedVector).not.toEqual(originalVector)
    expect(updatedEmbedding.updated_at).not.toBe(originalEmbedding.updated_at)
  })

  it('should delete embedding on entity delete', async () => {
    await insertData(stub, {
      id: 'article-1',
      type: 'Article',
      data: { title: 'To Delete', content: 'This will be deleted.' },
    })

    // Verify embedding exists
    const res1 = await doRequest(stub, '/embeddings/Article/article-1')
    expect(res1.status).toBe(200)

    // Delete the entity
    await doRequest(stub, '/data/article-1', { method: 'DELETE' })

    // Embedding should be gone
    const res2 = await doRequest(stub, '/embeddings/Article/article-1')
    expect(res2.status).toBe(404)
  })

  it('should use AI Gateway for embedding generation', async () => {
    await insertData(stub, {
      id: 'article-1',
      type: 'Article',
      data: { title: 'Test', content: 'Content for embedding.' },
    })

    // Check embedding metadata includes AI Gateway info
    const res = await doRequest(stub, '/embeddings/Article/article-1')
    const embedding = (await res.json()) as Record<string, unknown>

    expect(embedding.model).toBeDefined()
    // Should use a known embedding model
    expect(['bge-base-en-v1.5', '@cf/baai/bge-base-en-v1.5', 'text-embedding-ada-002']).toContain(
      embedding.model
    )
  })

  it('should cache embeddings for repeated queries', async () => {
    await insertData(stub, {
      id: 'article-1',
      type: 'Article',
      data: { title: 'Cached Content', content: 'This embedding should be cached.' },
    })

    // Query the same embedding multiple times
    const res1 = await doRequest(stub, '/embeddings/Article/article-1')
    const embedding1 = (await res1.json()) as Record<string, unknown>

    const res2 = await doRequest(stub, '/embeddings/Article/article-1')
    const embedding2 = (await res2.json()) as Record<string, unknown>

    // Same embedding should be returned (cached)
    expect(embedding1.vector).toEqual(embedding2.vector)
    expect(embedding1.created_at).toBe(embedding2.created_at)
  })

  it('should support configurable embedding model', async () => {
    // Configure embedding model
    await doJSON(stub, '/config/embeddings', { model: '@cf/baai/bge-base-en-v1.5' })

    await insertData(stub, {
      id: 'article-1',
      type: 'Article',
      data: { title: 'Test', content: 'Content with specific model.' },
    })

    const res = await doRequest(stub, '/embeddings/Article/article-1')
    const embedding = (await res.json()) as Record<string, unknown>

    expect(embedding.model).toBe('@cf/baai/bge-base-en-v1.5')
  })
})

// =============================================================================
// _embeddings Table Storage
// =============================================================================

describe('Semantic Search - _embeddings table', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should create _embeddings table on first access', async () => {
    // Trigger initialization by creating an entity
    await insertData(stub, { id: 'test-1', type: 'Test', data: { name: 'Test' } })

    // Query embeddings table should return array (table exists)
    const res = await doRequest(stub, '/embeddings')
    expect(res.status).toBe(200)
    const embeddings = await res.json()
    expect(Array.isArray(embeddings)).toBe(true)
  })

  it('should store embeddings in _embeddings table', async () => {
    await insertData(stub, {
      id: 'doc-1',
      type: 'Document',
      data: { title: 'Test Doc', content: 'Document content.' },
    })

    const res = await doRequest(stub, '/embeddings?entity_type=Document')
    expect(res.status).toBe(200)
    const embeddings = (await res.json()) as Array<Record<string, unknown>>

    expect(embeddings.length).toBeGreaterThanOrEqual(1)
    const embedding = embeddings.find((e) => e.entity_id === 'doc-1')
    expect(embedding).toBeDefined()
  })

  it('should associate embedding with entity type and id', async () => {
    await insertData(stub, {
      id: 'article-1',
      type: 'Article',
      data: { title: 'Hello', content: 'World' },
    })

    const res = await doRequest(stub, '/embeddings/Article/article-1')
    expect(res.status).toBe(200)
    const embedding = (await res.json()) as Record<string, unknown>

    expect(embedding.entity_type).toBe('Article')
    expect(embedding.entity_id).toBe('article-1')
  })

  it('should store embedding vector as JSON array', async () => {
    await insertData(stub, {
      id: 'vec-1',
      type: 'Vector',
      data: { content: 'Vector storage test.' },
    })

    const res = await doRequest(stub, '/embeddings/Vector/vec-1')
    const embedding = (await res.json()) as Record<string, unknown>

    expect(Array.isArray(embedding.vector)).toBe(true)
    // Embedding vectors are typically float arrays
    const vector = embedding.vector as number[]
    expect(vector.every((v) => typeof v === 'number')).toBe(true)
    // bge-base-en-v1.5 produces 768-dimensional embeddings
    expect([384, 768, 1024, 1536]).toContain(vector.length)
  })

  it('should store embedding model name', async () => {
    await insertData(stub, {
      id: 'model-1',
      type: 'Model',
      data: { content: 'Model metadata test.' },
    })

    const res = await doRequest(stub, '/embeddings/Model/model-1')
    const embedding = (await res.json()) as Record<string, unknown>

    expect(embedding.model).toBeDefined()
    expect(typeof embedding.model).toBe('string')
  })

  it('should have correct _embeddings schema: entity_type, entity_id, vector, model, created_at, updated_at', async () => {
    await insertData(stub, {
      id: 'schema-1',
      type: 'Schema',
      data: { content: 'Schema test.' },
    })

    const res = await doRequest(stub, '/embeddings/Schema/schema-1')
    const embedding = (await res.json()) as Record<string, unknown>

    expect(embedding).toHaveProperty('entity_type')
    expect(embedding).toHaveProperty('entity_id')
    expect(embedding).toHaveProperty('vector')
    expect(embedding).toHaveProperty('model')
    expect(embedding).toHaveProperty('created_at')
    expect(embedding).toHaveProperty('updated_at')
  })

  it('should create index on _embeddings(entity_type, entity_id)', async () => {
    await insertData(stub, { id: 'idx-1', type: 'Index', data: { name: 'test' } })

    const res = await doRequest(stub, '/meta/indexes')
    expect(res.status).toBe(200)
    const indexes = (await res.json()) as Array<Record<string, unknown>>
    const indexNames = indexes.map((i) => i.name as string)

    expect(indexNames.some((n) => n.includes('embedding') || n.includes('_embeddings'))).toBe(true)
  })
})

// =============================================================================
// Vector Similarity Search
// =============================================================================

describe('Semantic Search - vector search', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()

    // Create documents with varying semantic content
    await insertData(stub, {
      id: 'doc-ml',
      type: 'Document',
      data: {
        title: 'Machine Learning Guide',
        content: 'A comprehensive guide to machine learning algorithms.',
      },
    })

    await insertData(stub, {
      id: 'doc-ai',
      type: 'Document',
      data: {
        title: 'Artificial Intelligence Overview',
        content: 'An introduction to AI systems and applications.',
      },
    })

    await insertData(stub, {
      id: 'doc-cooking',
      type: 'Document',
      data: {
        title: 'Italian Cooking Recipes',
        content: 'Traditional recipes from Italy including pasta and pizza.',
      },
    })

    await insertData(stub, {
      id: 'doc-db',
      type: 'Document',
      data: {
        title: 'Database Optimization',
        content: 'Tips for optimizing SQL databases and query performance.',
      },
    })
  })

  it('should find semantically similar entities', async () => {
    // Search for documents about "deep learning neural networks"
    const res = await doJSON(stub, '/search/semantic', {
      type: 'Document',
      query: 'deep learning neural networks',
    })
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>

    // AI/ML documents should be in results
    expect(results.length).toBeGreaterThan(0)
    const ids = results.map((r) => r.id)
    // ML or AI doc should be in top results (semantically similar)
    expect(ids.slice(0, 2).some((id) => id === 'doc-ml' || id === 'doc-ai')).toBe(true)
  })

  it('should return results ordered by cosine similarity', async () => {
    const res = await doJSON(stub, '/search/semantic', {
      type: 'Document',
      query: 'machine learning algorithms',
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    // Results should have score field
    results.forEach((r) => {
      expect(r.$score).toBeDefined()
      expect(typeof r.$score).toBe('number')
    })

    // Scores should be in descending order
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.$score as number).toBeGreaterThanOrEqual(results[i]!.$score as number)
    }
  })

  it('should support minScore threshold', async () => {
    const res = await doJSON(stub, '/search/semantic', {
      type: 'Document',
      query: 'artificial intelligence',
      minScore: 0.7,
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    // All results should have score >= 0.7
    results.forEach((r) => {
      expect(r.$score as number).toBeGreaterThanOrEqual(0.7)
    })
  })

  it('should support limit option', async () => {
    const res = await doJSON(stub, '/search/semantic', {
      type: 'Document',
      query: 'technology',
      limit: 2,
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    expect(results.length).toBeLessThanOrEqual(2)
  })

  it('should filter by entity type', async () => {
    // Create another type
    await insertData(stub, {
      id: 'post-1',
      type: 'Post',
      data: { title: 'AI Blog Post', content: 'A blog post about artificial intelligence.' },
    })

    // Search only in Document type
    const res = await doJSON(stub, '/search/semantic', {
      type: 'Document',
      query: 'artificial intelligence',
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    // Should only include Document entities
    results.forEach((r) => {
      expect(r.type).toBe('Document')
    })
    expect(results.some((r) => r.id === 'post-1')).toBe(false)
  })

  it('should return entity data along with score', async () => {
    const res = await doJSON(stub, '/search/semantic', {
      type: 'Document',
      query: 'cooking recipes',
      limit: 1,
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    expect(results.length).toBe(1)
    const result = results[0]
    expect(result.id).toBe('doc-cooking')
    expect(result.data).toBeDefined()
    expect((result.data as Record<string, unknown>).title).toBe('Italian Cooking Recipes')
    expect(result.$score).toBeDefined()
  })
})

// =============================================================================
// Semantic Search with Filters
// =============================================================================

describe('Semantic Search - filters', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()

    // Create documents with categories
    await insertData(stub, {
      id: 'tech-1',
      type: 'Article',
      data: { title: 'Python Programming', content: 'Learn Python basics.', category: 'tech' },
    })

    await insertData(stub, {
      id: 'tech-2',
      type: 'Article',
      data: { title: 'JavaScript Guide', content: 'Master JavaScript.', category: 'tech' },
    })

    await insertData(stub, {
      id: 'food-1',
      type: 'Article',
      data: { title: 'Healthy Eating', content: 'Tips for healthy eating.', category: 'food' },
    })
  })

  it('should filter by type during semantic search', async () => {
    // Create different types
    await insertData(stub, {
      id: 'post-1',
      type: 'BlogPost',
      data: { title: 'Python for Beginners', content: 'Start with Python.' },
    })

    const res = await doJSON(stub, '/search/semantic', {
      type: 'Article',
      query: 'python programming',
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    // Only Article type should be returned
    results.forEach((r) => {
      expect(r.type).toBe('Article')
    })
  })

  it('should combine semantic search with data filters', async () => {
    const res = await doJSON(stub, '/search/semantic', {
      type: 'Article',
      query: 'programming',
      where: { category: 'tech' },
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    // Only tech articles should be returned
    results.forEach((r) => {
      expect((r.data as Record<string, unknown>).category).toBe('tech')
    })
    expect(results.some((r) => r.id === 'food-1')).toBe(false)
  })

  it('should filter by time range (since)', async () => {
    const midpoint = new Date().toISOString()
    await new Promise((resolve) => setTimeout(resolve, 50))

    await insertData(stub, {
      id: 'new-1',
      type: 'Article',
      data: { title: 'New Article', content: 'Recent programming content.', category: 'tech' },
    })

    const res = await doJSON(stub, '/search/semantic', {
      type: 'Article',
      query: 'programming',
      since: midpoint,
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    // Only the new article should be returned
    expect(results.length).toBeGreaterThanOrEqual(1)
    results.forEach((r) => {
      expect((r.created_at as string) >= midpoint).toBe(true)
    })
  })

  it('should filter by time range (until)', async () => {
    const midpoint = new Date().toISOString()
    await new Promise((resolve) => setTimeout(resolve, 50))

    await insertData(stub, {
      id: 'late-1',
      type: 'Article',
      data: { title: 'Late Article', content: 'Programming after cutoff.', category: 'tech' },
    })

    const res = await doJSON(stub, '/search/semantic', {
      type: 'Article',
      query: 'programming',
      until: midpoint,
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    // Late article should not be in results
    results.forEach((r) => {
      expect((r.created_at as string) <= midpoint).toBe(true)
    })
    expect(results.some((r) => r.id === 'late-1')).toBe(false)
  })
})

// =============================================================================
// Batch Embedding Generation
// =============================================================================

describe('Semantic Search - batch embeddings', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should batch embed multiple entities efficiently', async () => {
    // Create multiple entities
    const entities = Array.from({ length: 10 }, (_, i) => ({
      id: `batch-${i}`,
      type: 'Article',
      data: { title: `Article ${i}`, content: `Content for article number ${i}.` },
    }))

    // Insert all entities
    for (const entity of entities) {
      await insertData(stub, entity)
    }

    // Request batch embedding generation
    const res = await doJSON(stub, '/embeddings/batch', {
      type: 'Article',
      ids: entities.map((e) => e.id),
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>

    expect(result.processed).toBe(10)
    expect(result.success).toBe(true)
  })

  it('should generate embeddings for all entities of a type', async () => {
    // Create multiple entities
    for (let i = 0; i < 5; i++) {
      await insertData(stub, {
        id: `doc-${i}`,
        type: 'Document',
        data: { content: `Document content ${i}` },
      })
    }

    // Generate embeddings for all Document entities
    const res = await doJSON(stub, '/embeddings/generate', { type: 'Document' })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>

    expect(result.generated).toBe(5)
  })

  it('should skip entities with existing embeddings in batch', async () => {
    // Create entity and wait for embedding
    await insertData(stub, {
      id: 'existing-1',
      type: 'Article',
      data: { title: 'Existing', content: 'Already has embedding.' },
    })

    // Create another entity
    await insertData(stub, {
      id: 'new-1',
      type: 'Article',
      data: { title: 'New', content: 'Needs embedding.' },
    })

    // Batch generate - should skip existing
    const res = await doJSON(stub, '/embeddings/batch', {
      type: 'Article',
      ids: ['existing-1', 'new-1'],
      skipExisting: true,
    })
    const result = (await res.json()) as Record<string, unknown>

    expect(result.skipped).toBe(1)
    expect(result.processed).toBe(1)
  })

  it('should handle batch embedding errors gracefully', async () => {
    // Create valid and invalid entities
    await insertData(stub, {
      id: 'valid-1',
      type: 'Article',
      data: { title: 'Valid', content: 'Valid content.' },
    })

    // Request batch with mix of valid and invalid IDs
    const res = await doJSON(stub, '/embeddings/batch', {
      type: 'Article',
      ids: ['valid-1', 'nonexistent-1', 'nonexistent-2'],
    })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>

    expect(result.processed).toBe(1)
    expect(result.errors).toBe(2)
  })

  it('should report batch embedding progress', async () => {
    // Create entities
    for (let i = 0; i < 20; i++) {
      await insertData(stub, {
        id: `batch-${i}`,
        type: 'LargeSet',
        data: { content: `Batch content ${i}` },
      })
    }

    // Start batch job
    const res = await doJSON(stub, '/embeddings/batch/start', {
      type: 'LargeSet',
      batchSize: 5,
    })
    expect(res.status).toBe(200)
    const job = (await res.json()) as Record<string, unknown>

    expect(job.jobId).toBeDefined()
    expect(job.total).toBe(20)

    // Check progress
    const progressRes = await doRequest(stub, `/embeddings/batch/${job.jobId}/status`)
    expect(progressRes.status).toBe(200)
    const progress = (await progressRes.json()) as Record<string, unknown>

    expect(progress.status).toBeDefined()
    expect(['pending', 'processing', 'completed']).toContain(progress.status)
  })
})

// =============================================================================
// Hybrid Search (FTS + Semantic)
// =============================================================================

describe('Semantic Search - hybrid search', () => {
  let stub: DurableObjectStub

  beforeEach(async () => {
    stub = getStub()

    await insertData(stub, {
      id: 'post-react',
      type: 'Post',
      data: {
        title: 'React Hooks Tutorial',
        body: 'Learn React hooks like useState and useEffect.',
      },
    })

    await insertData(stub, {
      id: 'post-vue',
      type: 'Post',
      data: { title: 'Vue Composition API', body: 'Understanding Vue 3 Composition API.' },
    })

    await insertData(stub, {
      id: 'post-state',
      type: 'Post',
      data: {
        title: 'State Management',
        body: 'Different patterns for managing application state.',
      },
    })
  })

  it('should combine vector similarity with text search', async () => {
    const res = await doJSON(stub, '/search/hybrid', {
      type: 'Post',
      query: 'React useState',
    })
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>

    // React post should be top (exact keyword match + semantic)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.id).toBe('post-react')
  })

  it('should use RRF scoring for result fusion', async () => {
    const res = await doJSON(stub, '/search/hybrid', {
      type: 'Post',
      query: 'frontend state management hooks',
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    // Results should have RRF score
    results.forEach((r) => {
      expect(r.$rrfScore).toBeDefined()
      expect(typeof r.$rrfScore).toBe('number')
      expect(r.$rrfScore as number).toBeGreaterThan(0)
    })
  })

  it('should support weight configuration', async () => {
    // Weight towards FTS
    const ftsRes = await doJSON(stub, '/search/hybrid', {
      type: 'Post',
      query: 'React hooks',
      ftsWeight: 0.9,
      semanticWeight: 0.1,
    })
    const ftsResults = (await ftsRes.json()) as Array<Record<string, unknown>>

    // Weight towards semantic
    const semanticRes = await doJSON(stub, '/search/hybrid', {
      type: 'Post',
      query: 'React hooks',
      ftsWeight: 0.1,
      semanticWeight: 0.9,
    })
    const semanticResults = (await semanticRes.json()) as Array<Record<string, unknown>>

    // Different weights should potentially affect ranking
    expect(ftsResults[0]?.$rrfScore).not.toBe(semanticResults[0]?.$rrfScore)
  })

  it('should return combined score', async () => {
    const res = await doJSON(stub, '/search/hybrid', {
      type: 'Post',
      query: 'state management',
    })
    const results = (await res.json()) as Array<Record<string, unknown>>

    // Results should have both scores
    results.forEach((r) => {
      expect(r).toHaveProperty('$rrfScore')
      expect(r).toHaveProperty('$ftsRank')
      expect(r).toHaveProperty('$semanticRank')
    })
  })

  it('should support RRF k parameter', async () => {
    const defaultK = await doJSON(stub, '/search/hybrid', {
      type: 'Post',
      query: 'hooks',
    })
    const defaultResults = (await defaultK.json()) as Array<Record<string, unknown>>

    const highK = await doJSON(stub, '/search/hybrid', {
      type: 'Post',
      query: 'hooks',
      rrfK: 100,
    })
    const highKResults = (await highK.json()) as Array<Record<string, unknown>>

    // Different k values affect RRF scores
    expect(defaultResults[0]?.$rrfScore).not.toBe(highKResults[0]?.$rrfScore)
  })
})

// =============================================================================
// AI Gateway Integration
// =============================================================================

describe('AI Gateway', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should call AI Gateway for embeddings', async () => {
    await insertData(stub, {
      id: 'gateway-1',
      type: 'Article',
      data: { title: 'Gateway Test', content: 'Testing AI Gateway integration.' },
    })

    const res = await doRequest(stub, '/embeddings/Article/gateway-1')
    const embedding = (await res.json()) as Record<string, unknown>

    // Should have valid embedding from AI Gateway
    expect(embedding.vector).toBeDefined()
    expect((embedding.vector as number[]).length).toBeGreaterThan(0)
  })

  it('should use cached responses for deterministic tests', async () => {
    // Create same content twice
    await insertData(stub, {
      id: 'cache-1',
      type: 'Article',
      data: { title: 'Cache Test', content: 'Identical content for caching.' },
    })

    await insertData(stub, {
      id: 'cache-2',
      type: 'Article',
      data: { title: 'Cache Test', content: 'Identical content for caching.' },
    })

    const res1 = await doRequest(stub, '/embeddings/Article/cache-1')
    const embedding1 = (await res1.json()) as Record<string, unknown>

    const res2 = await doRequest(stub, '/embeddings/Article/cache-2')
    const embedding2 = (await res2.json()) as Record<string, unknown>

    // Same content should produce same embedding
    expect(embedding1.vector).toEqual(embedding2.vector)
  })

  it('should handle rate limiting gracefully', async () => {
    // Create many entities to potentially trigger rate limiting
    const promises = []
    for (let i = 0; i < 20; i++) {
      promises.push(
        insertData(stub, {
          id: `rate-${i}`,
          type: 'Article',
          data: { title: `Rate ${i}`, content: `Content ${i}` },
        })
      )
    }
    await Promise.all(promises)

    // All embeddings should eventually be generated
    const res = await doRequest(stub, '/embeddings?entity_type=Article')
    expect(res.status).toBe(200)
    const embeddings = (await res.json()) as Array<Record<string, unknown>>

    // Should have embeddings for all entities (or retry mechanism should handle)
    expect(embeddings.length).toBeGreaterThanOrEqual(15) // Allow some tolerance
  })

  it('should support bge-base-en-v1.5 model', async () => {
    // Configure to use bge model
    await doJSON(stub, '/config/embeddings', { model: '@cf/baai/bge-base-en-v1.5' })

    await insertData(stub, {
      id: 'bge-1',
      type: 'Article',
      data: { title: 'BGE Test', content: 'Testing BGE model.' },
    })

    const res = await doRequest(stub, '/embeddings/Article/bge-1')
    const embedding = (await res.json()) as Record<string, unknown>

    expect(embedding.model).toBe('@cf/baai/bge-base-en-v1.5')
    // BGE base produces 768-dimensional embeddings
    expect((embedding.vector as number[]).length).toBe(768)
  })
})

// =============================================================================
// Embedding Caching
// =============================================================================

describe('Semantic Search - embedding cache', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should cache embeddings for efficiency', async () => {
    await insertData(stub, {
      id: 'cached-1',
      type: 'Article',
      data: { title: 'Cached', content: 'Content to cache.' },
    })

    // First query - generates embedding
    const start1 = Date.now()
    await doRequest(stub, '/embeddings/Article/cached-1')
    const time1 = Date.now() - start1

    // Second query - should use cache
    const start2 = Date.now()
    await doRequest(stub, '/embeddings/Article/cached-1')
    const time2 = Date.now() - start2

    // Cached query should be faster (this is a soft check)
    // In real tests, we verify cache hit via metadata
    expect(time2).toBeLessThanOrEqual(time1 + 100) // Allow some tolerance
  })

  it('should invalidate cache on entity update', async () => {
    await insertData(stub, {
      id: 'invalidate-1',
      type: 'Article',
      data: { title: 'Original', content: 'Original content.' },
    })

    const res1 = await doRequest(stub, '/embeddings/Article/invalidate-1')
    const embedding1 = (await res1.json()) as Record<string, unknown>
    const hash1 = embedding1.content_hash

    // Update entity
    await doJSON(stub, '/data/invalidate-1', { data: { content: 'Updated content.' } }, 'PATCH')

    // Get new embedding
    const res2 = await doRequest(stub, '/embeddings/Article/invalidate-1')
    const embedding2 = (await res2.json()) as Record<string, unknown>
    const hash2 = embedding2.content_hash

    // Content hash should change after update
    expect(hash2).not.toBe(hash1)
  })

  it('should track cache hits and misses', async () => {
    await insertData(stub, {
      id: 'track-1',
      type: 'Article',
      data: { title: 'Track', content: 'Cache tracking test.' },
    })

    // Query multiple times
    await doRequest(stub, '/embeddings/Article/track-1')
    await doRequest(stub, '/embeddings/Article/track-1')
    await doRequest(stub, '/embeddings/Article/track-1')

    // Check cache stats
    const res = await doRequest(stub, '/embeddings/stats')
    expect(res.status).toBe(200)
    const stats = (await res.json()) as Record<string, unknown>

    expect(stats.cacheHits).toBeDefined()
    expect(stats.cacheMisses).toBeDefined()
    expect(stats.cacheHits as number).toBeGreaterThanOrEqual(2)
  })

  it('should support cache warmup', async () => {
    // Create entities without embeddings
    for (let i = 0; i < 5; i++) {
      await doJSON(stub, '/data', {
        id: `warmup-${i}`,
        type: 'Article',
        data: { title: `Warmup ${i}`, content: `Content ${i}` },
      })
    }

    // Warmup cache
    const res = await doJSON(stub, '/embeddings/warmup', { type: 'Article' })
    expect(res.status).toBe(200)
    const result = (await res.json()) as Record<string, unknown>

    expect(result.warmed).toBe(5)
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('Semantic Search - edge cases', () => {
  let stub: DurableObjectStub

  beforeEach(() => {
    stub = getStub()
  })

  it('should handle empty search query', async () => {
    await insertData(stub, {
      id: 'empty-1',
      type: 'Article',
      data: { title: 'Test', content: 'Content.' },
    })

    const res = await doJSON(stub, '/search/semantic', {
      type: 'Article',
      query: '',
    })
    expect(res.status).toBe(400)
  })

  it('should handle entities with no text content', async () => {
    await insertData(stub, {
      id: 'numeric-1',
      type: 'Metric',
      data: { value: 42, count: 100 },
    })

    // Should still generate some embedding or handle gracefully
    const res = await doRequest(stub, '/embeddings/Metric/numeric-1')
    // Either 200 with empty/default embedding or 400/404
    expect([200, 400, 404]).toContain(res.status)
  })

  it('should handle very long text content', async () => {
    const longContent = 'Machine learning and artificial intelligence. '.repeat(1000)

    await insertData(stub, {
      id: 'long-1',
      type: 'Article',
      data: { title: 'Long Article', content: longContent },
    })

    const res = await doRequest(stub, '/embeddings/Article/long-1')
    expect(res.status).toBe(200)
    const embedding = (await res.json()) as Record<string, unknown>

    // Should truncate or chunk long content
    expect(embedding.vector).toBeDefined()
    expect((embedding.vector as number[]).length).toBeGreaterThan(0)
  })

  it('should handle unicode content', async () => {
    await insertData(stub, {
      id: 'unicode-1',
      type: 'Article',
      data: {
        title: '\u65e5\u672c\u8a9e\u30c6\u30b9\u30c8',
        content: '\u4e2d\u6587\u5185\u5bb9\u548c\u8868\u60c5\u7b26\u53f7\ud83d\ude80',
      },
    })

    const res = await doRequest(stub, '/embeddings/Article/unicode-1')
    expect(res.status).toBe(200)
    const embedding = (await res.json()) as Record<string, unknown>

    expect(embedding.vector).toBeDefined()
  })

  it('should handle concurrent embedding requests', async () => {
    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        insertData(stub, {
          id: `concurrent-${i}`,
          type: 'Article',
          data: { title: `Concurrent ${i}`, content: `Content ${i}` },
        })
      )
    }
    await Promise.all(promises)

    // All embeddings should be generated correctly
    for (let i = 0; i < 10; i++) {
      const res = await doRequest(stub, `/embeddings/Article/concurrent-${i}`)
      expect(res.status).toBe(200)
    }
  })

  it('should return 404 for embedding of non-existent entity', async () => {
    const res = await doRequest(stub, '/embeddings/Article/nonexistent')
    expect(res.status).toBe(404)
  })

  it('should handle search with no matching results', async () => {
    await insertData(stub, {
      id: 'cooking-1',
      type: 'Recipe',
      data: { title: 'Pasta Recipe', content: 'How to make pasta.' },
    })

    const res = await doJSON(stub, '/search/semantic', {
      type: 'Recipe',
      query: 'quantum physics simulation',
      minScore: 0.9,
    })
    expect(res.status).toBe(200)
    const results = (await res.json()) as Array<Record<string, unknown>>

    // Should return empty array, not error
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(0)
  })
})
