/**
 * Experiment execution and management
 */

import { randomUUID } from 'crypto'
import type {
  ExperimentConfig,
  ExperimentContext,
  ExperimentResult,
  ExperimentSummary,
  RunExperimentOptions,
  ExperimentVariant,
} from './types.js'
import { track } from './tracking.js'

/**
 * Create and run an A/B experiment with multiple variants
 *
 * @example
 * ```ts
 * import { Experiment } from 'ai-experiments'
 *
 * const results = await Experiment({
 *   id: 'prompt-comparison',
 *   name: 'Prompt Engineering Test',
 *   variants: [
 *     {
 *       id: 'baseline',
 *       name: 'Baseline Prompt',
 *       config: { prompt: 'Summarize this text.' },
 *     },
 *     {
 *       id: 'detailed',
 *       name: 'Detailed Prompt',
 *       config: { prompt: 'Provide a comprehensive summary...' },
 *     },
 *   ],
 *   execute: async (config) => {
 *     return await ai.generate({ prompt: config.prompt })
 *   },
 *   metric: (result) => result.quality_score,
 * })
 *
 * console.log('Best variant:', results.bestVariant)
 * ```
 */
export async function Experiment<TConfig = unknown, TResult = unknown>(
  config: ExperimentConfig<TConfig, TResult>,
  options: RunExperimentOptions = {}
): Promise<ExperimentSummary<TResult>> {
  const {
    parallel = true,
    maxConcurrency,
    stopOnError = false,
    context: contextData,
    onVariantStart,
    onVariantComplete,
    onVariantError,
  } = options

  const experimentStartTime = new Date()

  // Track experiment start
  track({
    type: 'experiment.start',
    timestamp: experimentStartTime,
    data: {
      experimentId: config.id,
      experimentName: config.name,
      variantCount: config.variants.length,
      parallel,
      ...config.metadata,
    },
  })

  const results: ExperimentResult<TResult>[] = []

  // Execute variants
  if (parallel) {
    // Parallel execution with optional concurrency limit
    const executeVariant = async (
      variant: ExperimentVariant<TConfig>
    ): Promise<ExperimentResult<TResult>> => {
      return runVariant(config, variant, contextData, {
        onVariantStart,
        onVariantComplete,
        onVariantError,
      })
    }

    if (maxConcurrency && maxConcurrency > 0) {
      // Execute with concurrency limit
      const chunks = chunkArray(config.variants, maxConcurrency)
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(chunk.map(executeVariant))
        results.push(...chunkResults)

        // Stop on first error if configured
        if (stopOnError && chunkResults.some((r) => !r.success)) {
          break
        }
      }
    } else {
      // Execute all in parallel
      const allResults = await Promise.all(config.variants.map(executeVariant))
      results.push(...allResults)
    }
  } else {
    // Sequential execution
    for (const variant of config.variants) {
      const result = await runVariant(config, variant, contextData, {
        onVariantStart,
        onVariantComplete,
        onVariantError,
      })
      results.push(result)

      // Stop on first error if configured
      if (stopOnError && !result.success) {
        break
      }
    }
  }

  const experimentEndTime = new Date()
  const totalDuration = experimentEndTime.getTime() - experimentStartTime.getTime()

  // Find best variant by metric
  let bestVariant: ExperimentSummary<TResult>['bestVariant']
  const successfulResults = results.filter((r) => r.success && r.metricValue !== undefined)
  if (successfulResults.length > 0) {
    const best = successfulResults.reduce((prev, current) =>
      (current.metricValue ?? -Infinity) > (prev.metricValue ?? -Infinity) ? current : prev
    )
    bestVariant = {
      variantId: best.variantId,
      variantName: best.variantName,
      metricValue: best.metricValue!,
    }
  }

  const summary: ExperimentSummary<TResult> = {
    experimentId: config.id,
    experimentName: config.name,
    results,
    bestVariant,
    totalDuration,
    successCount: results.filter((r) => r.success).length,
    failureCount: results.filter((r) => !r.success).length,
    startedAt: experimentStartTime,
    completedAt: experimentEndTime,
  }

  // Track experiment completion
  track({
    type: 'experiment.complete',
    timestamp: experimentEndTime,
    data: {
      experimentId: config.id,
      experimentName: config.name,
      successCount: summary.successCount,
      failureCount: summary.failureCount,
      totalDuration,
      bestVariant: bestVariant?.variantId,
      ...config.metadata,
    },
  })

  return summary
}

/**
 * Run a single variant
 */
async function runVariant<TConfig, TResult>(
  config: ExperimentConfig<TConfig, TResult>,
  variant: ExperimentVariant<TConfig>,
  contextData: Record<string, unknown> | undefined,
  callbacks: {
    onVariantStart?: (variantId: string, variantName: string) => void
    onVariantComplete?: (result: ExperimentResult<TResult>) => void
    onVariantError?: (variantId: string, error: Error) => void
  }
): Promise<ExperimentResult<TResult>> {
  const runId = randomUUID()
  const startTime = new Date()

  const context: ExperimentContext = {
    experimentId: config.id,
    variantId: variant.id,
    runId,
    startedAt: startTime,
    data: contextData,
  }

  // Track variant start
  track({
    type: 'variant.start',
    timestamp: startTime,
    data: {
      experimentId: config.id,
      variantId: variant.id,
      variantName: variant.name,
      runId,
    },
  })

  callbacks.onVariantStart?.(variant.id, variant.name)

  try {
    // Execute the variant
    const result = await config.execute(variant.config, context)
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    // Compute metric if provided
    let metricValue: number | undefined
    if (config.metric) {
      metricValue = await config.metric(result)

      track({
        type: 'metric.computed',
        timestamp: new Date(),
        data: {
          experimentId: config.id,
          variantId: variant.id,
          runId,
          metricValue,
        },
      })
    }

    const experimentResult: ExperimentResult<TResult> = {
      experimentId: config.id,
      variantId: variant.id,
      variantName: variant.name,
      runId,
      result,
      metricValue,
      duration,
      startedAt: startTime,
      completedAt: endTime,
      success: true,
    }

    // Track variant completion
    track({
      type: 'variant.complete',
      timestamp: endTime,
      data: {
        experimentId: config.id,
        variantId: variant.id,
        variantName: variant.name,
        runId,
        duration,
        metricValue,
        success: true,
      },
    })

    callbacks.onVariantComplete?.(experimentResult)

    return experimentResult
  } catch (error) {
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()
    const err = error instanceof Error ? error : new Error(String(error))

    // Track variant error
    track({
      type: 'variant.error',
      timestamp: endTime,
      data: {
        experimentId: config.id,
        variantId: variant.id,
        variantName: variant.name,
        runId,
        duration,
        error: err.message,
        stack: err.stack,
      },
    })

    callbacks.onVariantError?.(variant.id, err)

    return {
      experimentId: config.id,
      variantId: variant.id,
      variantName: variant.name,
      runId,
      result: undefined as unknown as TResult,
      duration,
      startedAt: startTime,
      completedAt: endTime,
      error: err,
      success: false,
    }
  }
}

/**
 * Split array into chunks
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

/**
 * Helper to create experiment variants from a parameter grid
 *
 * @example
 * ```ts
 * const variants = createVariantsFromGrid({
 *   temperature: [0.3, 0.7, 1.0],
 *   model: ['sonnet', 'opus'],
 *   maxTokens: [100, 500],
 * })
 * // Returns 12 variants (3 * 2 * 2 combinations)
 * ```
 */
export function createVariantsFromGrid<T extends Record<string, unknown[]>>(
  grid: T
): ExperimentVariant<{ [K in keyof T]: T[K][number] }>[] {
  const keys = Object.keys(grid) as (keyof T)[]
  const values = keys.map((k) => grid[k])

  // Generate all combinations
  const combinations = cartesianProduct(values)

  return combinations.map((combo, index) => {
    const config = Object.fromEntries(
      keys.map((key, i) => [key, combo[i]])
    ) as { [K in keyof T]: T[K][number] }

    return {
      id: `variant-${index}`,
      name: keys.map((k, i) => `${String(k)}=${combo[i]}`).join(', '),
      config,
    }
  })
}

/**
 * Cartesian product helper
 */
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]
  if (arrays.length === 1) return arrays[0]!.map((x) => [x])

  const [first, ...rest] = arrays
  const restProduct = cartesianProduct(rest)

  return first!.flatMap((x) => restProduct.map((arr) => [x, ...arr]))
}
