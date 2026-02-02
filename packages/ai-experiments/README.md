# ai-experiments

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

AI-powered experimentation primitives for testing and evaluating models.

## Overview

`ai-experiments` provides a comprehensive toolkit for A/B testing, parameter exploration, decision making, and tracking in AI applications. It follows the same patterns and conventions as `ai-functions` from the primitives monorepo.

## Installation

```bash
pnpm add ai-experiments
```

## Core APIs

### `Experiment()` - A/B Testing and Variant Evaluation

Run experiments with multiple variants to find the best configuration.

```typescript
import { Experiment } from 'ai-experiments'

const results = await Experiment({
  id: 'prompt-comparison',
  name: 'Prompt Engineering Test',
  variants: [
    {
      id: 'baseline',
      name: 'Baseline Prompt',
      config: { prompt: 'Summarize this text.' },
    },
    {
      id: 'detailed',
      name: 'Detailed Prompt',
      config: { prompt: 'Provide a comprehensive summary...' },
    },
  ],
  execute: async (config) => {
    return await ai.generate({ prompt: config.prompt })
  },
  metric: (result) => result.quality_score,
})

console.log('Best variant:', results.bestVariant)
```

**Options:**
- `parallel: true` - Run variants in parallel (default)
- `maxConcurrency: 5` - Limit concurrent executions
- `stopOnError: false` - Stop on first error
- Event callbacks: `onVariantStart`, `onVariantComplete`, `onVariantError`

### `cartesian()` - Parameter Grid Exploration

Generate all combinations of parameters for exhaustive testing.

```typescript
import { cartesian } from 'ai-experiments'

const combinations = cartesian({
  model: ['sonnet', 'opus', 'gpt-4o'],
  temperature: [0.3, 0.7, 1.0],
  maxTokens: [100, 500, 1000],
})
// Returns 27 combinations (3 × 3 × 3)

// Use with experiments:
const variants = combinations.map((config, i) => ({
  id: `variant-${i}`,
  name: `${config.model} T=${config.temperature}`,
  config,
}))
```

**Related functions:**
- `cartesianFilter()` - Filter invalid combinations
- `cartesianSample()` - Random sample when full product is too large
- `cartesianCount()` - Count combinations without generating them
- `cartesianWithLabels()` - Include dimension indices

### `decide()` - Intelligent Decision Making

Make decisions by scoring and comparing options.

```typescript
import { decide } from 'ai-experiments'

// Simple decision
const result = await decide({
  options: ['fast', 'accurate', 'balanced'],
  score: (approach) => evaluateApproach(approach),
  context: 'Choosing summarization approach',
})

console.log(result.selected) // 'balanced'
console.log(result.score)    // 0.9

// Return all options sorted by score
const result = await decide({
  options: ['option-a', 'option-b', 'option-c'],
  score: async (opt) => await scoreOption(opt),
  returnAll: true,
})

console.log(result.allOptions)
// [
//   { option: 'option-b', score: 0.95 },
//   { option: 'option-a', score: 0.82 },
//   { option: 'option-c', score: 0.71 },
// ]
```

**Advanced decision strategies:**
- `decideWeighted()` - Weighted random selection
- `decideEpsilonGreedy()` - Exploration vs exploitation
- `decideThompsonSampling()` - Bayesian bandit algorithm
- `decideUCB()` - Upper Confidence Bound

### `track()` - Event Tracking

Track experiment events and metrics.

```typescript
import { track, configureTracking, createFileBackend } from 'ai-experiments'

// Configure tracking backend
configureTracking({
  backend: createFileBackend({ path: './experiments.jsonl' }),
  metadata: { projectId: 'my-project' },
})

// Events are automatically tracked by Experiment()
// You can also track custom events:
track({
  type: 'experiment.start',
  timestamp: new Date(),
  data: {
    experimentId: 'my-experiment',
    variantCount: 3,
  },
})
```

**Built-in backends:**
- `createConsoleBackend()` - Log to console (default)
- `createMemoryBackend()` - Store events in memory
- `createBatchBackend()` - Batch events before sending
- `createFileBackend()` - Write to JSONL file

## Usage Patterns

### Pattern 1: Parameter Sweep

Test all combinations of hyperparameters:

```typescript
import { cartesian, Experiment } from 'ai-experiments'

const paramGrid = cartesian({
  temperature: [0.3, 0.5, 0.7, 0.9],
  topP: [0.9, 0.95, 1.0],
  maxTokens: [100, 500, 1000],
})

const variants = paramGrid.map((params, i) => ({
  id: `config-${i}`,
  name: `T=${params.temperature} P=${params.topP} max=${params.maxTokens}`,
  config: params,
}))

const results = await Experiment({
  id: 'param-sweep',
  name: 'Hyperparameter Optimization',
  variants,
  execute: async (config) => {
    return await ai.generate({ ...config, prompt: 'Test prompt' })
  },
  metric: (result) => evaluateQuality(result),
})

console.log('Best config:', results.bestVariant)
```

### Pattern 2: Progressive Testing

Start with a sample, then test more if needed:

```typescript
import { cartesianSample, Experiment } from 'ai-experiments'

// Sample 20 random combinations from a large space
const sample = cartesianSample(
  {
    param1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    param2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    param3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  20
)

const results = await Experiment({
  id: 'initial-sample',
  name: 'Initial Random Sample',
  variants: sample.map((config, i) => ({
    id: `sample-${i}`,
    name: `Sample ${i}`,
    config,
  })),
  execute: async (config) => runTest(config),
  metric: (result) => result.score,
})

// If results are promising, expand the search
if (results.bestVariant && results.bestVariant.metricValue > 0.8) {
  console.log('Found promising region, expanding search...')
  // Test more combinations near the best one
}
```

### Pattern 3: Multi-Armed Bandit

Adaptively choose variants based on performance:

```typescript
import { decideThompsonSampling, track } from 'ai-experiments'

// Track success/failure for each variant
const stats = {
  'variant-a': { alpha: 10, beta: 5 },  // 10 successes, 5 failures
  'variant-b': { alpha: 8, beta: 3 },   // 8 successes, 3 failures
  'variant-c': { alpha: 2, beta: 2 },   // 2 successes, 2 failures (uncertain)
}

// Thompson sampling balances exploration and exploitation
const selected = decideThompsonSampling(
  ['variant-a', 'variant-b', 'variant-c'],
  stats
)

// Update stats based on result
const result = await runVariant(selected)
if (result.success) {
  stats[selected].alpha += 1
} else {
  stats[selected].beta += 1
}
```

### Pattern 4: Sequential Testing with Early Stopping

Stop testing once a clear winner emerges:

```typescript
import { Experiment } from 'ai-experiments'

let bestScore = 0
let testCount = 0
const maxTests = 100

const results = await Experiment(
  {
    id: 'sequential-test',
    name: 'Sequential Testing',
    variants: [...],
    execute: async (config) => runTest(config),
    metric: (result) => result.score,
  },
  {
    parallel: false, // Sequential execution
    onVariantComplete: (result) => {
      testCount++
      if (result.metricValue && result.metricValue > bestScore) {
        bestScore = result.metricValue
      }

      // Stop if we found a really good result
      if (bestScore > 0.95) {
        console.log('Found excellent result, stopping early')
        // In a real implementation, you'd need to handle early stopping
      }
    },
  }
)
```

## TypeScript Types

The package is fully typed with comprehensive TypeScript definitions:

```typescript
import type {
  ExperimentConfig,
  ExperimentResult,
  ExperimentSummary,
  ExperimentVariant,
  DecisionResult,
  TrackingEvent,
  TrackingBackend,
} from 'ai-experiments'
```

## Integration with ai-functions

Works seamlessly with `ai-functions` for AI-powered experiments:

```typescript
import { generateObject } from 'ai-functions'
import { Experiment, cartesian } from 'ai-experiments'

const prompts = [
  'Summarize briefly',
  'Provide a detailed summary',
  'Extract key points',
]

const models = ['sonnet', 'opus', 'gpt-4o']

// Test all combinations of prompts and models
const combinations = cartesian({ prompt: prompts, model: models })

const results = await Experiment({
  id: 'prompt-model-test',
  name: 'Prompt and Model Comparison',
  variants: combinations.map((config, i) => ({
    id: `combo-${i}`,
    name: `${config.model}: "${config.prompt.slice(0, 20)}..."`,
    config,
  })),
  execute: async (config) => {
    return await generateObject({
      model: config.model,
      schema: { summary: 'The summary text' },
      prompt: config.prompt,
    })
  },
  metric: (result) => evaluateSummary(result.object.summary),
})

console.log('Best combination:', results.bestVariant)
```

## Examples

See [examples.ts](./examples.ts) for complete working examples demonstrating:
- Simple A/B experiments
- Parameter grid exploration
- Decision making strategies
- Event tracking
- Sequential vs parallel execution

Run the examples:

```bash
pnpm build
node --import tsx examples.ts
```

## License

MIT
