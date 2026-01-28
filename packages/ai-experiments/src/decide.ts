/**
 * Decision making utilities
 */

import type { DecideOptions, DecisionResult } from './types.js'
import { track } from './tracking.js'

/**
 * Make a decision by evaluating and scoring multiple options
 *
 * Scores each option and returns the best one (highest score).
 *
 * @example
 * ```ts
 * import { decide } from 'ai-experiments'
 *
 * // Simple decision with sync scoring
 * const result = await decide({
 *   options: ['apple', 'banana', 'orange'],
 *   score: (fruit) => {
 *     const prices = { apple: 1.5, banana: 0.5, orange: 2.0 }
 *     return 1 / prices[fruit] // Lower price = higher score
 *   },
 * })
 * console.log(result.selected) // 'banana'
 *
 * // Decision with async scoring (AI-based)
 * const result = await decide({
 *   options: [
 *     { prompt: 'Summarize in one sentence' },
 *     { prompt: 'Provide a detailed summary' },
 *     { prompt: 'Extract key points only' },
 *   ],
 *   score: async (option) => {
 *     const result = await ai.generate(option)
 *     return evaluateQuality(result)
 *   },
 *   context: 'Choosing best summarization approach',
 * })
 *
 * // Get all options sorted by score
 * const result = await decide({
 *   options: ['fast', 'accurate', 'balanced'],
 *   score: (approach) => evaluateApproach(approach),
 *   returnAll: true,
 * })
 * console.log(result.allOptions)
 * // [
 * //   { option: 'balanced', score: 0.9 },
 * //   { option: 'accurate', score: 0.85 },
 * //   { option: 'fast', score: 0.7 },
 * // ]
 * ```
 */
export async function decide<T>(options: DecideOptions<T>): Promise<DecisionResult<T>> {
  const { options: choices, score, context, returnAll = false } = options

  if (choices.length === 0) {
    throw new Error('Cannot decide with empty options')
  }

  // Score all options
  const scoredOptions = await Promise.all(
    choices.map(async (option) => {
      const optionScore = await score(option)
      return { option, score: optionScore }
    })
  )

  // Sort by score (highest first)
  const sorted = scoredOptions.sort((a, b) => b.score - a.score)

  // Select best option
  const best = sorted[0]!

  // Track decision
  track({
    type: 'decision.made',
    timestamp: new Date(),
    data: {
      context,
      optionCount: choices.length,
      selectedScore: best.score,
      allScores: sorted.map((s) => s.score),
    },
  })

  const result: DecisionResult<T> = {
    selected: best.option,
    score: best.score,
  }

  if (returnAll) {
    result.allOptions = sorted
  }

  return result
}

/**
 * Weighted random selection from options
 *
 * Each option has a weight, and selection probability is proportional to weight.
 *
 * @example
 * ```ts
 * import { decideWeighted } from 'ai-experiments'
 *
 * const result = decideWeighted([
 *   { value: 'A', weight: 0.7 },  // 70% chance
 *   { value: 'B', weight: 0.2 },  // 20% chance
 *   { value: 'C', weight: 0.1 },  // 10% chance
 * ])
 *
 * console.log(result) // Most likely 'A', but could be B or C
 * ```
 */
export function decideWeighted<T>(options: Array<{ value: T; weight: number }>): T {
  if (options.length === 0) {
    throw new Error('Cannot decide with empty options')
  }

  // Calculate total weight
  const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0)

  if (totalWeight <= 0) {
    throw new Error('Total weight must be positive')
  }

  // Generate random value between 0 and totalWeight
  const random = Math.random() * totalWeight

  // Find the option that corresponds to this random value
  let cumulative = 0
  for (const option of options) {
    cumulative += option.weight
    if (random <= cumulative) {
      return option.value
    }
  }

  // Fallback (should not reach here due to floating point precision)
  return options[options.length - 1]!.value
}

/**
 * Epsilon-greedy decision strategy
 *
 * With probability epsilon, select a random option (exploration).
 * Otherwise, select the best option by score (exploitation).
 *
 * @example
 * ```ts
 * import { decideEpsilonGreedy } from 'ai-experiments'
 *
 * const result = await decideEpsilonGreedy({
 *   options: ['model-a', 'model-b', 'model-c'],
 *   score: async (model) => await evaluateModel(model),
 *   epsilon: 0.1, // 10% exploration, 90% exploitation
 * })
 * ```
 */
export async function decideEpsilonGreedy<T>(
  options: DecideOptions<T> & { epsilon: number }
): Promise<DecisionResult<T>> {
  const { epsilon, options: choices, score, context } = options

  if (epsilon < 0 || epsilon > 1) {
    throw new Error('Epsilon must be between 0 and 1')
  }

  // Exploration: random selection
  if (Math.random() < epsilon) {
    const randomIndex = Math.floor(Math.random() * choices.length)
    const selected = choices[randomIndex]!
    const selectedScore = await score(selected)

    track({
      type: 'decision.made',
      timestamp: new Date(),
      data: {
        context,
        strategy: 'epsilon-greedy-explore',
        epsilon,
        selectedScore,
      },
    })

    return {
      selected,
      score: selectedScore,
    }
  }

  // Exploitation: best option
  const result = await decide({
    options: choices,
    score,
    ...(context !== undefined && { context }),
  })

  track({
    type: 'decision.made',
    timestamp: new Date(),
    data: {
      context,
      strategy: 'epsilon-greedy-exploit',
      epsilon,
      selectedScore: result.score,
    },
  })

  return result
}

/**
 * Thompson sampling decision strategy
 *
 * Bayesian approach to balancing exploration and exploitation.
 * Each option has a Beta distribution representing our belief about its true score.
 *
 * @example
 * ```ts
 * import { decideThompsonSampling } from 'ai-experiments'
 *
 * // Track successes and failures for each option
 * const priors = {
 *   'variant-a': { alpha: 10, beta: 5 },  // 10 successes, 5 failures
 *   'variant-b': { alpha: 8, beta: 3 },   // 8 successes, 3 failures
 *   'variant-c': { alpha: 2, beta: 2 },   // 2 successes, 2 failures (uncertain)
 * }
 *
 * const result = decideThompsonSampling(['variant-a', 'variant-b', 'variant-c'], priors)
 * // More likely to select 'variant-b' (higher rate) but will sometimes explore 'variant-c'
 * ```
 */
export function decideThompsonSampling<T extends string>(
  options: T[],
  priors: Record<T, { alpha: number; beta: number }>
): T {
  if (options.length === 0) {
    throw new Error('Cannot decide with empty options')
  }

  // Sample from Beta distribution for each option
  const samples = options.map((option) => {
    const { alpha, beta } = priors[option]
    return {
      option,
      sample: sampleBeta(alpha, beta),
    }
  })

  // Select option with highest sample
  const best = samples.reduce((prev, current) => (current.sample > prev.sample ? current : prev))

  track({
    type: 'decision.made',
    timestamp: new Date(),
    data: {
      strategy: 'thompson-sampling',
      selected: best.option,
      sample: best.sample,
      priors: priors[best.option],
    },
  })

  return best.option
}

/**
 * Sample from Beta distribution using the ratio of two Gamma distributions
 */
function sampleBeta(alpha: number, beta: number): number {
  const x = sampleGamma(alpha, 1)
  const y = sampleGamma(beta, 1)
  return x / (x + y)
}

/**
 * Sample from Gamma distribution using Marsaglia and Tsang method
 */
function sampleGamma(shape: number, scale: number): number {
  // Simple implementation for shape >= 1
  if (shape < 1) {
    // Use the property: Gamma(a) = Gamma(a+1) * U^(1/a)
    return sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape)
  }

  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)

  while (true) {
    let x: number
    let v: number

    do {
      x = randomNormal()
      v = 1 + c * x
    } while (v <= 0)

    v = v * v * v
    const u = Math.random()

    if (u < 1 - 0.0331 * x * x * x * x) {
      return d * v * scale
    }

    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      return d * v * scale
    }
  }
}

/**
 * Sample from standard normal distribution using Box-Muller transform
 */
function randomNormal(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Upper Confidence Bound (UCB) decision strategy
 *
 * Select the option with the highest upper confidence bound.
 * Balances exploration and exploitation using confidence intervals.
 *
 * @example
 * ```ts
 * import { decideUCB } from 'ai-experiments'
 *
 * const stats = {
 *   'variant-a': { mean: 0.85, count: 100 },
 *   'variant-b': { mean: 0.82, count: 50 },  // Less data, higher uncertainty
 *   'variant-c': { mean: 0.78, count: 10 },  // Very uncertain
 * }
 *
 * const result = decideUCB(['variant-a', 'variant-b', 'variant-c'], stats, {
 *   explorationFactor: 2.0,
 *   totalCount: 160,
 * })
 * // Might select variant-c to explore more, despite lower mean
 * ```
 */
export function decideUCB<T extends string>(
  options: T[],
  stats: Record<T, { mean: number; count: number }>,
  config: {
    /** Exploration factor (typically 1-2) */
    explorationFactor: number
    /** Total number of trials across all options */
    totalCount: number
  }
): T {
  const { explorationFactor, totalCount } = config

  if (options.length === 0) {
    throw new Error('Cannot decide with empty options')
  }

  // Calculate UCB for each option
  const ucbScores = options.map((option) => {
    const { mean, count } = stats[option]

    // UCB = mean + c * sqrt(ln(N) / n)
    const explorationBonus =
      explorationFactor * Math.sqrt(Math.log(totalCount) / Math.max(count, 1))

    return {
      option,
      ucb: mean + explorationBonus,
      mean,
      count,
    }
  })

  // Select option with highest UCB
  const best = ucbScores.reduce((prev, current) => (current.ucb > prev.ucb ? current : prev))

  track({
    type: 'decision.made',
    timestamp: new Date(),
    data: {
      strategy: 'ucb',
      selected: best.option,
      ucb: best.ucb,
      mean: best.mean,
      count: best.count,
      explorationFactor,
    },
  })

  return best.option
}
