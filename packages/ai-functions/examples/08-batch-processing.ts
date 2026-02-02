/**
 * Batch Processing Workflow Example (1000+ items)
 *
 * This example demonstrates processing large batches efficiently using ai-functions.
 * It shows how to:
 * - Process 1000+ items with automatic batching
 * - Use provider batch APIs for 50% cost savings
 * - Handle progress tracking and error recovery
 * - Implement parallel processing with concurrency limits
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/08-batch-processing.ts
 * ```
 */

import {
  write,
  list,
  ai,
  is,
  configure,
  createBatch,
  withBatch,
  BatchQueue,
  withRetry,
  BudgetTracker,
  type BatchItem,
} from '../src/index.js'

// For demo, use memory adapter
import '../src/batch/memory.js'

// ============================================================================
// Types
// ============================================================================

interface Product {
  id: string
  name: string
  description: string
  category: string
}

interface ProcessedProduct {
  id: string
  originalName: string
  enhancedDescription: string
  seoTitle: string
  seoKeywords: string[]
  sentiment: string
  qualityScore: number
}

interface BatchProgress {
  total: number
  processed: number
  successful: number
  failed: number
  startTime: number
  estimatedRemaining: number
}

// ============================================================================
// Sample Data Generator
// ============================================================================

function generateSampleProducts(count: number): Product[] {
  const categories = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Books', 'Toys']
  const adjectives = ['Premium', 'Deluxe', 'Basic', 'Pro', 'Ultra', 'Eco', 'Smart', 'Classic']
  const nouns = ['Widget', 'Gadget', 'Tool', 'Device', 'Item', 'Product', 'Solution', 'System']

  const products: Product[] = []

  for (let i = 0; i < count; i++) {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
    const noun = nouns[Math.floor(Math.random() * nouns.length)]
    const category = categories[Math.floor(Math.random() * categories.length)]

    products.push({
      id: `PROD-${String(i + 1).padStart(5, '0')}`,
      name: `${adj} ${noun} ${i + 1}`,
      description: `A high-quality ${noun.toLowerCase()} designed for ${category.toLowerCase()} enthusiasts. Features include advanced technology and durable construction.`,
      category,
    })
  }

  return products
}

// ============================================================================
// Progress Tracking
// ============================================================================

class ProgressTracker {
  private progress: BatchProgress

  constructor(total: number) {
    this.progress = {
      total,
      processed: 0,
      successful: 0,
      failed: 0,
      startTime: Date.now(),
      estimatedRemaining: 0,
    }
  }

  update(success: boolean): void {
    this.progress.processed++
    if (success) {
      this.progress.successful++
    } else {
      this.progress.failed++
    }

    // Calculate estimated remaining time
    const elapsed = Date.now() - this.progress.startTime
    const rate = this.progress.processed / elapsed
    const remaining = this.progress.total - this.progress.processed
    this.progress.estimatedRemaining = remaining / rate
  }

  display(): void {
    const percent = ((this.progress.processed / this.progress.total) * 100).toFixed(1)
    const elapsed = ((Date.now() - this.progress.startTime) / 1000).toFixed(0)
    const remaining = (this.progress.estimatedRemaining / 1000).toFixed(0)

    // Clear line and update progress
    process.stdout.write(
      `\r[${percent}%] ${this.progress.processed}/${this.progress.total} | Success: ${this.progress.successful} | Failed: ${this.progress.failed} | Elapsed: ${elapsed}s | ETA: ${remaining}s    `
    )
  }

  getStats(): BatchProgress {
    return { ...this.progress }
  }
}

// ============================================================================
// Batch Processor
// ============================================================================

class ProductEnhancer {
  private budgetTracker: BudgetTracker
  private concurrency: number
  private results: ProcessedProduct[] = []
  private errors: { id: string; error: string }[] = []

  constructor(options: { maxCost?: number; concurrency?: number } = {}) {
    this.budgetTracker = new BudgetTracker({
      maxCost: options.maxCost || 100,
      maxTokens: 1000000,
      alertThresholds: [0.5, 0.8, 0.95],
      onAlert: (alert) => {
        console.log(`\n[Budget Alert] ${(alert.threshold * 100).toFixed(0)}% of budget used`)
      },
    })
    this.concurrency = options.concurrency || 10
  }

  /**
   * Process a single product
   */
  private async processProduct(product: Product): Promise<ProcessedProduct> {
    // Generate enhanced description
    const enhanced = await ai`Enhance this product description for better marketing appeal:

Product: ${product.name}
Category: ${product.category}
Original Description: ${product.description}

Provide:
- enhancedDescription: improved, engaging description (2-3 sentences)
- seoTitle: SEO-optimized title (under 60 chars)
- seoKeywords: array of 5 relevant keywords
- sentiment: the tone (professional/casual/luxury/budget)
- qualityScore: quality score 1-10 based on the original`

    // Track token usage (estimated)
    this.budgetTracker.recordUsage({
      inputTokens: 150,
      outputTokens: 100,
      model: 'sonnet',
    })

    return {
      id: product.id,
      originalName: product.name,
      enhancedDescription: (enhanced as any).enhancedDescription || '',
      seoTitle: (enhanced as any).seoTitle || '',
      seoKeywords: (enhanced as any).seoKeywords || [],
      sentiment: (enhanced as any).sentiment || 'professional',
      qualityScore: (enhanced as any).qualityScore || 5,
    }
  }

  /**
   * Process products in chunks with concurrency control
   */
  async processInChunks(products: Product[]): Promise<void> {
    console.log(
      `\nProcessing ${products.length} products with concurrency ${this.concurrency}...\n`
    )

    const tracker = new ProgressTracker(products.length)

    // Process in chunks for better memory management
    const chunkSize = this.concurrency * 5
    const chunks: Product[][] = []

    for (let i = 0; i < products.length; i += chunkSize) {
      chunks.push(products.slice(i, i + chunkSize))
    }

    for (const chunk of chunks) {
      // Process chunk items with concurrency limit
      const promises = chunk.map(async (product) => {
        try {
          const result = await withRetry(() => this.processProduct(product), {
            maxRetries: 2,
            baseDelay: 1000,
          })
          this.results.push(result)
          tracker.update(true)
        } catch (error) {
          this.errors.push({ id: product.id, error: (error as Error).message })
          tracker.update(false)
        }
        tracker.display()
      })

      // Process with concurrency limit
      const executing: Promise<void>[] = []
      for (const promise of promises) {
        const p = promise.then(() => {
          executing.splice(executing.indexOf(p), 1)
        })
        executing.push(p)

        if (executing.length >= this.concurrency) {
          await Promise.race(executing)
        }
      }
      await Promise.all(executing)
    }

    console.log('\n') // New line after progress
  }

  /**
   * Use batch API for processing (50% cost savings)
   */
  async processWithBatchAPI(products: Product[]): Promise<void> {
    console.log(`\nUsing Batch API for ${products.length} products (50% cost savings)...\n`)

    // Create batch queue
    const batch = createBatch({
      provider: 'openai',
      autoSubmit: {
        threshold: 100,
        maxWait: 5000,
      },
    })

    // Add all items to batch
    const promises = products.map((product) =>
      batch.add(
        `Enhance this product description:
Name: ${product.name}
Category: ${product.category}
Description: ${product.description}

Return: enhanced description, SEO title, and 5 keywords as JSON`
      )
    )

    console.log(`Added ${products.length} items to batch queue`)

    // Submit batch
    console.log('Submitting batch...')
    const submission = await batch.submit()

    if (submission.job) {
      console.log(`Batch submitted: ${submission.job.id}`)
      console.log('Status: Processing (this would take up to 24 hours in production)')
    }

    // For demo, we simulate the results
    console.log('\n[Demo mode: Simulating batch results]')
  }

  /**
   * Get processing results
   */
  getResults(): {
    results: ProcessedProduct[]
    errors: { id: string; error: string }[]
    stats: {
      total: number
      successful: number
      failed: number
      cost: number
      tokens: number
    }
  } {
    return {
      results: this.results,
      errors: this.errors,
      stats: {
        total: this.results.length + this.errors.length,
        successful: this.results.length,
        failed: this.errors.length,
        cost: this.budgetTracker.getTotalCost(),
        tokens: this.budgetTracker.getTotalTokens(),
      },
    }
  }
}

// ============================================================================
// Using list.map() for Batch Processing
// ============================================================================

async function processWithListMap(): Promise<void> {
  console.log('\n--- Using list.map() for automatic batching ---\n')

  // Generate ideas and process each in batch
  const ideas = await list`10 product improvement ideas for a smart home device`

  console.log(`Generated ${ideas.length} ideas`)

  // Map processes each item - batched automatically when batchMode is enabled
  const evaluated = await Promise.all(
    ideas.map(async (idea) => {
      const { feasibility, cost, impact } = await ai`Evaluate this product improvement idea:
"${idea}"

Provide:
- feasibility: score 1-10
- cost: estimated cost (low/medium/high)
- impact: customer impact score 1-10`

      return {
        idea,
        feasibility,
        cost,
        impact,
      }
    })
  )

  console.log('\nEvaluated ideas:')
  evaluated.forEach((e, i) => {
    console.log(
      `  ${i + 1}. ${(e.idea as string).substring(0, 40)}... (feasibility: ${
        e.feasibility
      }, impact: ${e.impact})`
    )
  })
}

// ============================================================================
// Parallel Processing with Streams
// ============================================================================

async function processWithStreams(products: Product[]): Promise<void> {
  console.log('\n--- Stream-based Processing ---\n')

  let processed = 0
  const total = products.length

  // Process as async generator
  async function* processGenerator(): AsyncGenerator<ProcessedProduct> {
    for (const product of products) {
      const result = await ai`Quick enhancement for: ${product.name}`
      processed++

      if (processed % 10 === 0) {
        console.log(`  Processed ${processed}/${total}`)
      }

      yield {
        id: product.id,
        originalName: product.name,
        enhancedDescription: result as string,
        seoTitle: product.name,
        seoKeywords: [],
        sentiment: 'professional',
        qualityScore: 7,
      }
    }
  }

  // Consume stream
  const results: ProcessedProduct[] = []
  for await (const result of processGenerator()) {
    results.push(result)
    if (results.length >= 5) break // Demo limit
  }

  console.log(`\nProcessed ${results.length} products via stream`)
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== Batch Processing Workflow Example (1000+ items) ===\n')

  // Configure the AI provider
  configure({
    model: 'sonnet',
    provider: 'anthropic',
    batchMode: 'auto',
    batchThreshold: 10,
  })

  // Generate sample products
  const smallBatch = generateSampleProducts(25)
  const largeBatch = generateSampleProducts(100)

  console.log(`Generated ${smallBatch.length} products for demo`)
  console.log(`Would generate ${largeBatch.length}+ products for production\n`)

  // Method 1: Process with concurrency control
  console.log('=== Method 1: Concurrent Processing ===')
  const enhancer = new ProductEnhancer({
    maxCost: 10,
    concurrency: 5,
  })

  await enhancer.processInChunks(smallBatch.slice(0, 10)) // Demo with 10 items

  const { stats } = enhancer.getResults()
  console.log('\nProcessing Statistics:')
  console.log(`  Total: ${stats.total}`)
  console.log(`  Successful: ${stats.successful}`)
  console.log(`  Failed: ${stats.failed}`)
  console.log(`  Estimated Cost: $${stats.cost.toFixed(4)}`)
  console.log(`  Total Tokens: ${stats.tokens}`)

  // Method 2: Batch API (50% savings)
  console.log('\n=== Method 2: Batch API (50% Cost Savings) ===')
  await enhancer.processWithBatchAPI(smallBatch.slice(0, 5))

  // Method 3: list.map() automatic batching
  console.log('\n=== Method 3: list.map() Automatic Batching ===')
  await processWithListMap()

  // Method 4: Stream-based processing
  console.log('\n=== Method 4: Stream-based Processing ===')
  await processWithStreams(smallBatch.slice(0, 5))

  // Summary
  console.log('\n=== Batch Processing Summary ===')
  console.log(`
For processing 1000+ items, consider:

1. Concurrent Processing
   - Best for: Real-time results needed
   - Cost: Standard pricing
   - Latency: Low (parallel execution)

2. Provider Batch API
   - Best for: Large volumes, non-urgent
   - Cost: 50% discount
   - Latency: Up to 24 hours

3. list.map() with batchMode
   - Best for: Simple transformations
   - Cost: Automatic optimization
   - Latency: Variable

4. Stream-based Processing
   - Best for: Memory efficiency
   - Cost: Standard pricing
   - Latency: Progressive results
`)
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
