/**
 * Usage examples for ai-experiments
 *
 * These examples demonstrate the core APIs and patterns.
 */

import {
  Experiment,
  cartesian,
  decide,
  track,
  configureTracking,
  createMemoryBackend,
  type ExperimentConfig,
} from './src/index.js'

// ============================================================================
// Example 1: Simple A/B Experiment
// ============================================================================

async function example1_simpleExperiment() {
  console.log('\n=== Example 1: Simple A/B Experiment ===\n')

  const results = await Experiment({
    id: 'greeting-test',
    name: 'Greeting Message Test',
    description: 'Test different greeting messages',
    variants: [
      {
        id: 'formal',
        name: 'Formal Greeting',
        config: { message: 'Good day, sir.' },
      },
      {
        id: 'casual',
        name: 'Casual Greeting',
        config: { message: 'Hey there!' },
      },
      {
        id: 'friendly',
        name: 'Friendly Greeting',
        config: { message: 'Hello friend!' },
      },
    ],
    execute: async (config) => {
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 100))
      return {
        message: config.message,
        wordCount: config.message.split(' ').length,
        charCount: config.message.length,
      }
    },
    metric: (result) => {
      // Score based on message length (prefer shorter)
      return 1 / result.charCount
    },
  })

  console.log('Experiment Results:')
  console.log('- Best Variant:', results.bestVariant)
  console.log('- Success Rate:', `${results.successCount}/${results.results.length}`)
  console.log('- Total Duration:', `${results.totalDuration}ms`)
  console.log('\nAll Results:')
  results.results.forEach((r) => {
    console.log(
      `  ${r.variantName}: metric=${r.metricValue?.toFixed(4)}, duration=${r.duration}ms`
    )
  })
}

// ============================================================================
// Example 2: Parameter Grid with Cartesian Product
// ============================================================================

async function example2_parameterGrid() {
  console.log('\n=== Example 2: Parameter Grid Experiment ===\n')

  // Generate all combinations of parameters
  const parameterGrid = cartesian({
    temperature: [0.3, 0.7, 1.0],
    maxTokens: [50, 100],
    topP: [0.9, 1.0],
  })

  console.log(`Generated ${parameterGrid.length} parameter combinations:`)
  parameterGrid.slice(0, 5).forEach((params, i) => {
    console.log(`  ${i + 1}.`, params)
  })
  console.log('  ...')

  // Create variants from parameter combinations
  const variants = parameterGrid.map((params, i) => ({
    id: `variant-${i}`,
    name: `T=${params.temperature} max=${params.maxTokens} topP=${params.topP}`,
    config: params,
  }))

  const results = await Experiment({
    id: 'parameter-sweep',
    name: 'Parameter Sweep Experiment',
    variants,
    execute: async (config) => {
      // Simulate AI generation with different parameters
      await new Promise((resolve) => setTimeout(resolve, 50))
      const score = Math.random() * config.temperature + config.maxTokens / 1000
      return { score, config }
    },
    metric: (result) => result.score,
  })

  console.log(`\nBest parameters: ${results.bestVariant?.variantName}`)
  console.log(`Best score: ${results.bestVariant?.metricValue.toFixed(4)}`)
}

// ============================================================================
// Example 3: Decision Making
// ============================================================================

async function example3_decisionMaking() {
  console.log('\n=== Example 3: Decision Making ===\n')

  // Simple decision with sync scoring
  const result1 = await decide({
    options: ['apple', 'banana', 'orange'],
    score: (fruit) => {
      const prices: Record<string, number> = { apple: 1.5, banana: 0.5, orange: 2.0 }
      return 1 / prices[fruit] // Lower price = higher score
    },
    context: 'Choosing fruit based on value',
  })

  console.log('Decision 1 (best value):')
  console.log(`  Selected: ${result1.selected}`)
  console.log(`  Score: ${result1.score.toFixed(4)}`)

  // Decision with all options returned
  const result2 = await decide({
    options: ['fast', 'accurate', 'balanced'],
    score: async (approach) => {
      const scores: Record<string, number> = { fast: 0.7, accurate: 0.85, balanced: 0.9 }
      return scores[approach]
    },
    returnAll: true,
  })

  console.log('\nDecision 2 (with all options):')
  console.log(`  Selected: ${result2.selected}`)
  result2.allOptions?.forEach((opt) => {
    console.log(`  - ${opt.option}: ${opt.score}`)
  })
}

// ============================================================================
// Example 4: Event Tracking
// ============================================================================

async function example4_eventTracking() {
  console.log('\n=== Example 4: Event Tracking ===\n')

  // Create a memory backend to collect events
  const backend = createMemoryBackend()
  configureTracking({ backend })

  // Run a small experiment
  await Experiment({
    id: 'tracked-experiment',
    name: 'Tracked Experiment',
    variants: [
      { id: 'v1', name: 'Variant 1', config: { value: 1 } },
      { id: 'v2', name: 'Variant 2', config: { value: 2 } },
    ],
    execute: async (config) => ({ result: config.value * 2 }),
    metric: (result) => result.result,
  })

  // Get all tracked events
  const events = backend.getEvents()
  console.log(`Tracked ${events.length} events:`)
  events.forEach((event) => {
    console.log(`  [${event.type}]`, JSON.stringify(event.data).slice(0, 80))
  })

  // Reset tracking to default
  configureTracking({ enabled: true })
}

// ============================================================================
// Example 5: Advanced - Sequential vs Parallel Execution
// ============================================================================

async function example5_executionModes() {
  console.log('\n=== Example 5: Sequential vs Parallel Execution ===\n')

  const variants = [
    { id: 'v1', name: 'Variant 1', config: { delay: 100 } },
    { id: 'v2', name: 'Variant 2', config: { delay: 150 } },
    { id: 'v3', name: 'Variant 3', config: { delay: 200 } },
  ]

  const execute = async (config: { delay: number }) => {
    await new Promise((resolve) => setTimeout(resolve, config.delay))
    return { completed: true }
  }

  // Parallel execution (default)
  const start1 = Date.now()
  await Experiment({
    id: 'parallel-test',
    name: 'Parallel Execution',
    variants,
    execute,
  })
  const parallel_duration = Date.now() - start1

  // Sequential execution
  const start2 = Date.now()
  await Experiment(
    {
      id: 'sequential-test',
      name: 'Sequential Execution',
      variants,
      execute,
    },
    { parallel: false }
  )
  const sequential_duration = Date.now() - start2

  console.log(`Parallel execution: ${parallel_duration}ms`)
  console.log(`Sequential execution: ${sequential_duration}ms`)
  console.log(
    `Speedup: ${(sequential_duration / parallel_duration).toFixed(2)}x`
  )
}

// ============================================================================
// Run all examples
// ============================================================================

async function main() {
  // Disable verbose tracking for examples
  configureTracking({ enabled: false })

  try {
    await example1_simpleExperiment()
    await example2_parameterGrid()
    await example3_decisionMaking()
    await example4_eventTracking()
    await example5_executionModes()

    console.log('\n✅ All examples completed successfully!\n')
  } catch (error) {
    console.error('\n❌ Error running examples:', error)
    process.exit(1)
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
