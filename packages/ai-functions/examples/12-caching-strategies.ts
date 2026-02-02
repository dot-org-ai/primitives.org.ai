/**
 * Caching Strategies Example
 *
 * This example demonstrates intelligent caching for AI operations using ai-functions.
 * It shows how to:
 * - Use MemoryCache for general caching
 * - Cache generation results with GenerationCache
 * - Cache embeddings with EmbeddingCache
 * - Wrap functions with automatic caching
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/12-caching-strategies.ts
 * ```
 */

import {
  write,
  ai,
  list,
  configure,
  MemoryCache,
  GenerationCache,
  EmbeddingCache,
  withCache,
  hashKey,
  createCacheKey,
  type CacheEntry,
  type CacheStats,
} from '../src/index.js'

// ============================================================================
// Basic MemoryCache
// ============================================================================

async function memoryCacheExample(): Promise<void> {
  console.log('\n=== MemoryCache - Basic Usage ===\n')

  const cache = new MemoryCache({
    maxSize: 100, // Max 100 entries
    defaultTTL: 60000, // 1 minute TTL
  })

  // Store and retrieve values
  await cache.set('greeting', 'Hello, World!')
  await cache.set('number', 42, { ttl: 5000 }) // 5 second TTL
  await cache.set('user', { name: 'Alice', email: 'alice@example.com' }, { ttl: 30000 })

  console.log('Stored values:')
  console.log(`  greeting: ${await cache.get('greeting')}`)
  console.log(`  number: ${await cache.get('number')}`)
  console.log(`  user: ${JSON.stringify(await cache.get('user'))}`)

  // Check if key exists
  console.log(`\n  Has 'greeting': ${await cache.has('greeting')}`)
  console.log(`  Has 'missing': ${await cache.has('missing')}`)

  // Get stats
  const stats = cache.getStats()
  console.log('\nCache Stats:')
  console.log(`  Size: ${stats.size}`)
  console.log(`  Hits: ${stats.hits}`)
  console.log(`  Misses: ${stats.misses}`)
  console.log(`  Hit Rate: ${((stats.hitRate || 0) * 100).toFixed(1)}%`)

  // Clear specific key
  await cache.delete('number')
  console.log(`\n  After delete, has 'number': ${await cache.has('number')}`)

  // Clear all
  await cache.clear()
  console.log(`  After clear, size: ${cache.getStats().size}`)
}

// ============================================================================
// GenerationCache
// ============================================================================

async function generationCacheExample(): Promise<void> {
  console.log('\n=== GenerationCache - AI Response Caching ===\n')

  const cache = new GenerationCache({
    defaultTTL: 3600000, // 1 hour
    maxSize: 1000,
  })

  // Cache key is based on prompt and model
  const cacheKey1 = { prompt: 'What is TypeScript?', model: 'sonnet' }
  const cacheKey2 = { prompt: 'What is TypeScript?', model: 'gpt-4o' }

  // Check cache before generating
  let result = await cache.get(cacheKey1)

  if (!result) {
    console.log('Cache miss - generating response...')
    result = await write`What is TypeScript? Answer in one sentence.`

    // Store in cache
    await cache.set(cacheKey1, result)
    console.log(`Cached response: "${result.substring(0, 50)}..."`)
  } else {
    console.log(`Cache hit: "${result.substring(0, 50)}..."`)
  }

  // Same prompt again - should hit cache
  console.log('\nSecond request with same prompt...')
  const cached = await cache.get(cacheKey1)
  console.log(cached ? 'Cache HIT' : 'Cache MISS')

  // Different model - different cache entry
  console.log('\nSame prompt, different model...')
  const differentModel = await cache.get(cacheKey2)
  console.log(differentModel ? 'Cache HIT' : 'Cache MISS (different model)')

  // Get usage metrics
  console.log('\nGeneration Cache Metrics:')
  const stats = cache.getStats()
  console.log(`  Entries: ${stats.size}`)
  console.log(`  Hits: ${stats.hits}`)
  console.log(`  Misses: ${stats.misses}`)
}

// ============================================================================
// EmbeddingCache with Batch Support
// ============================================================================

async function embeddingCacheExample(): Promise<void> {
  console.log('\n=== EmbeddingCache - Embedding Storage ===\n')

  const cache = new EmbeddingCache({
    defaultTTL: 86400000, // 24 hours - embeddings change less frequently
    maxSize: 10000, // Store up to 10k embeddings
  })

  // Simulate embedding generation
  const generateEmbedding = (text: string): number[] => {
    // Simplified embedding simulation
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return Array(128)
      .fill(0)
      .map((_, i) => Math.sin(hash + i) / 2)
  }

  // Batch embedding with cache
  const texts = [
    'The quick brown fox',
    'Jumps over the lazy dog',
    'Hello world',
    'The quick brown fox', // Duplicate
  ]

  console.log('Batch embedding with cache...\n')

  // First, check which are already cached
  const cacheResults = await cache.getMany(texts, { model: 'text-embedding-3-small' })
  console.log(`  Hits: ${cacheResults.hits.length}`)
  console.log(`  Misses: ${cacheResults.misses.length}`)

  // Generate embeddings for misses
  const newEmbeddings: Record<string, number[]> = {}
  for (const text of cacheResults.misses) {
    console.log(`  Generating embedding for: "${text.substring(0, 30)}..."`)
    newEmbeddings[text] = generateEmbedding(text)
  }

  // Store new embeddings
  await cache.setMany(newEmbeddings, { model: 'text-embedding-3-small' })
  console.log(`\n  Cached ${Object.keys(newEmbeddings).length} new embeddings`)

  // Second batch request - should hit more
  console.log('\nSecond batch request...')
  const secondResults = await cache.getMany(texts, { model: 'text-embedding-3-small' })
  console.log(`  Hits: ${secondResults.hits.length}`)
  console.log(`  Misses: ${secondResults.misses.length}`)

  // Calculate savings
  const savingsPercent = (secondResults.hits.length / texts.length) * 100
  console.log(
    `\n  Cache efficiency: ${savingsPercent.toFixed(0)}% (${secondResults.hits.length}/${
      texts.length
    } from cache)`
  )
}

// ============================================================================
// withCache Function Wrapper
// ============================================================================

async function withCacheExample(): Promise<void> {
  console.log('\n=== withCache - Automatic Function Caching ===\n')

  const cache = new MemoryCache({ maxSize: 100 })

  // Create a cached version of any function
  const generateSummary = async (text: string): Promise<string> => {
    console.log('  [Generating summary...]')
    // Simulate AI call
    return `Summary of: ${text.substring(0, 30)}...`
  }

  // Wrap with caching
  const cachedSummary = withCache(cache, generateSummary, {
    keyFn: (text: string) => `summary:${hashKey(text)}`,
    ttl: 60000,
  })

  // First call - generates
  console.log('First call:')
  const result1 = await cachedSummary('This is a long article about AI and machine learning...')
  console.log(`  Result: ${result1}`)

  // Second call with same input - from cache
  console.log('\nSecond call (same input):')
  const result2 = await cachedSummary('This is a long article about AI and machine learning...')
  console.log(`  Result: ${result2}`)

  // Different input - generates
  console.log('\nThird call (different input):')
  const result3 = await cachedSummary('A completely different article about web development...')
  console.log(`  Result: ${result3}`)

  console.log('\nCache stats:', cache.getStats())
}

// ============================================================================
// Cache Key Strategies
// ============================================================================

async function cacheKeyStrategiesExample(): Promise<void> {
  console.log('\n=== Cache Key Strategies ===\n')

  // Strategy 1: Simple string hash
  const prompt1 = 'What is TypeScript?'
  const key1 = hashKey(prompt1)
  console.log(`Simple hash:`)
  console.log(`  Input: "${prompt1}"`)
  console.log(`  Key: ${key1}`)

  // Strategy 2: Composite key with model
  const key2 = createCacheKey({
    prompt: prompt1,
    model: 'sonnet',
    temperature: 0.7,
  })
  console.log(`\nComposite key:`)
  console.log(`  Input: { prompt, model, temperature }`)
  console.log(`  Key: ${key2}`)

  // Strategy 3: Normalized prompt (ignore whitespace differences)
  const normalizePrompt = (p: string): string => p.trim().replace(/\s+/g, ' ').toLowerCase()
  const prompt2 = '  What   is  TypeScript?  '
  console.log(`\nNormalized prompt:`)
  console.log(`  Original: "${prompt2}"`)
  console.log(`  Normalized: "${normalizePrompt(prompt2)}"`)
  console.log(
    `  Same key as prompt1: ${
      hashKey(normalizePrompt(prompt2)) === hashKey(normalizePrompt(prompt1))
    }`
  )

  // Strategy 4: Semantic caching key (for similar prompts)
  // This would use embeddings to find similar cached entries
  console.log(`\nSemantic caching (conceptual):`)
  console.log(`  "What is TS?" would match "What is TypeScript?"`)
  console.log(`  Requires embedding-based similarity lookup`)
}

// ============================================================================
// Cache Invalidation Patterns
// ============================================================================

async function cacheInvalidationExample(): Promise<void> {
  console.log('\n=== Cache Invalidation Patterns ===\n')

  const cache = new MemoryCache({ maxSize: 100 })

  // Pattern 1: TTL-based expiration
  console.log('1. TTL-based expiration:')
  await cache.set('short-lived', 'data', { ttl: 1000 }) // 1 second
  console.log(`  Set with 1s TTL: ${await cache.get('short-lived')}`)

  await new Promise((r) => setTimeout(r, 1100))
  console.log(`  After 1.1s: ${await cache.get('short-lived')} (expired)`)

  // Pattern 2: Manual invalidation
  console.log('\n2. Manual invalidation:')
  await cache.set('user:123', { name: 'Alice' })
  console.log(`  Before invalidation: ${JSON.stringify(await cache.get('user:123'))}`)

  await cache.delete('user:123')
  console.log(`  After invalidation: ${await cache.get('user:123')}`)

  // Pattern 3: Pattern-based invalidation
  console.log('\n3. Pattern-based invalidation (conceptual):')
  console.log(`  cache.deletePattern('user:*') // Delete all user entries`)
  console.log(`  Useful when a user's data changes globally`)

  // Pattern 4: Version-based keys
  console.log('\n4. Version-based keys:')
  const version = 'v2'
  const versionedKey = `${version}:prompt:${hashKey('What is TypeScript?')}`
  console.log(`  Key includes version: ${versionedKey}`)
  console.log(`  Incrementing version invalidates all old entries`)
}

// ============================================================================
// Cost Savings Calculation
// ============================================================================

async function costSavingsExample(): Promise<void> {
  console.log('\n=== Cost Savings from Caching ===\n')

  // Simulate request patterns
  const totalRequests = 1000
  const uniquePrompts = 100
  const hitRate = 0.7 // 70% of requests are repeats

  // Pricing assumptions (per 1M tokens)
  const inputCost = 3.0 // $3 per 1M input tokens
  const outputCost = 15.0 // $15 per 1M output tokens
  const avgInputTokens = 100
  const avgOutputTokens = 200

  // Calculate without caching
  const costPerRequest = (avgInputTokens * inputCost + avgOutputTokens * outputCost) / 1000000
  const totalCostNoCache = totalRequests * costPerRequest

  // Calculate with caching (only pay for unique prompts)
  const cachedRequests = totalRequests * hitRate
  const uncachedRequests = totalRequests - cachedRequests
  const totalCostWithCache = uncachedRequests * costPerRequest

  const savings = totalCostNoCache - totalCostWithCache
  const savingsPercent = (savings / totalCostNoCache) * 100

  console.log('Scenario:')
  console.log(`  Total requests: ${totalRequests}`)
  console.log(`  Unique prompts: ${uniquePrompts}`)
  console.log(`  Cache hit rate: ${(hitRate * 100).toFixed(0)}%`)
  console.log(`\nCost Analysis:`)
  console.log(`  Without caching: $${totalCostNoCache.toFixed(4)}`)
  console.log(`  With caching: $${totalCostWithCache.toFixed(4)}`)
  console.log(`  Savings: $${savings.toFixed(4)} (${savingsPercent.toFixed(0)}%)`)

  console.log(`\nRecommendation:`)
  console.log(`  For ${totalRequests} requests/day at ${(hitRate * 100).toFixed(0)}% hit rate:`)
  console.log(`  Monthly savings: ~$${(savings * 30).toFixed(2)}`)
}

// ============================================================================
// Production Recommendations
// ============================================================================

function showProductionRecommendations(): void {
  console.log('\n=== Production Caching Recommendations ===\n')

  console.log(`
1. CACHE STORAGE SELECTION
   - Development: MemoryCache (simple, no setup)
   - Production: Redis/Memcached (persistent, distributed)
   - Edge: Cloudflare KV, Durable Objects

2. TTL STRATEGIES
   - Embeddings: 24-48 hours (stable, expensive)
   - Generations: 1-4 hours (may need freshness)
   - Lists/Classifications: 15-60 minutes (volatile)
   - User-specific: 5-15 minutes (personalized)

3. KEY DESIGN
   - Include: prompt hash, model, temperature
   - Normalize: whitespace, case (for similar queries)
   - Version: include cache version for easy invalidation

4. SIZE MANAGEMENT
   - Set maxSize based on memory budget
   - Monitor hit rates to optimize size
   - Use LRU eviction for unpredictable access patterns

5. INVALIDATION
   - TTL for automatic expiration
   - Manual invalidation for data changes
   - Version bumps for schema changes

6. MONITORING
   - Track hit/miss rates
   - Monitor cache size over time
   - Alert on low hit rates
   - Log cache key patterns for optimization
`)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('\n=== Caching Strategies Example ===')

  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  await memoryCacheExample()
  await generationCacheExample()
  await embeddingCacheExample()
  await withCacheExample()
  await cacheKeyStrategiesExample()
  await cacheInvalidationExample()
  await costSavingsExample()
  showProductionRecommendations()
}

main()
  .then(() => {
    console.log('\n=== Example Complete ===\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nError:', error.message)
    process.exit(1)
  })
