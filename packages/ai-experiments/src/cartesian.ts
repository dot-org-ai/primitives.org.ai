/**
 * Cartesian product utilities for parameter exploration
 */

import type { CartesianParams, CartesianResult } from './types.js'

/**
 * Generate cartesian product of parameter sets
 *
 * Takes an object where each key maps to an array of possible values,
 * and returns all possible combinations as an array of objects.
 *
 * @example
 * ```ts
 * import { cartesian } from 'ai-experiments'
 *
 * const combinations = cartesian({
 *   model: ['sonnet', 'opus', 'gpt-4o'],
 *   temperature: [0.3, 0.7, 1.0],
 *   maxTokens: [100, 500, 1000],
 * })
 *
 * // Returns 27 combinations (3 * 3 * 3):
 * // [
 * //   { model: 'sonnet', temperature: 0.3, maxTokens: 100 },
 * //   { model: 'sonnet', temperature: 0.3, maxTokens: 500 },
 * //   { model: 'sonnet', temperature: 0.3, maxTokens: 1000 },
 * //   { model: 'sonnet', temperature: 0.7, maxTokens: 100 },
 * //   ...
 * // ]
 *
 * // Use with experiments:
 * const variants = combinations.map((config, i) => ({
 *   id: `variant-${i}`,
 *   name: `${config.model} T=${config.temperature} max=${config.maxTokens}`,
 *   config,
 * }))
 * ```
 */
export function cartesian<T extends CartesianParams>(params: T): CartesianResult<T> {
  const keys = Object.keys(params) as (keyof T)[]
  const values = keys.map((k) => params[k])

  // Handle empty input
  if (keys.length === 0) {
    return [] as CartesianResult<T>
  }

  // Handle single parameter
  if (keys.length === 1) {
    const key = keys[0]!
    return values[0]!.map((val) => ({ [key]: val } as { [K in keyof T]: T[K][number] }))
  }

  // Generate all combinations using recursive helper
  const combinations = cartesianProduct(values)

  // Map back to objects
  return combinations.map((combo) => {
    const obj = {} as { [K in keyof T]: T[K][number] }
    keys.forEach((key, i) => {
      obj[key] = combo[i] as T[typeof key][number]
    })
    return obj
  })
}

/**
 * Recursive cartesian product implementation
 */
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]]

  const [first, ...rest] = arrays

  // Base case: single array
  if (rest.length === 0) {
    return first!.map((x) => [x])
  }

  // Recursive case
  const restProduct = cartesianProduct(rest)
  const result: T[][] = []

  for (const x of first!) {
    for (const restCombo of restProduct) {
      result.push([x, ...restCombo])
    }
  }

  return result
}

/**
 * Generate a grid of parameter combinations with filtering
 *
 * Similar to cartesian(), but allows filtering out invalid combinations.
 *
 * @example
 * ```ts
 * import { cartesianFilter } from 'ai-experiments'
 *
 * const combinations = cartesianFilter(
 *   {
 *     model: ['sonnet', 'opus'],
 *     temperature: [0.3, 0.7, 1.0],
 *     maxTokens: [100, 500],
 *   },
 *   // Filter out combinations where opus uses high temperature
 *   (combo) => !(combo.model === 'opus' && combo.temperature > 0.7)
 * )
 * ```
 */
export function cartesianFilter<T extends CartesianParams>(
  params: T,
  filter: (combo: { [K in keyof T]: T[K][number] }) => boolean
): CartesianResult<T> {
  const allCombinations = cartesian(params)
  return allCombinations.filter(filter)
}

/**
 * Generate a random sample from the cartesian product
 *
 * Useful when the full cartesian product is too large to test all combinations.
 *
 * @example
 * ```ts
 * import { cartesianSample } from 'ai-experiments'
 *
 * // Full product would be 1000 combinations (10 * 10 * 10)
 * // Sample just 20 random combinations
 * const sample = cartesianSample(
 *   {
 *     param1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
 *     param2: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
 *     param3: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
 *   },
 *   20
 * )
 * ```
 */
export function cartesianSample<T extends CartesianParams>(
  params: T,
  sampleSize: number,
  options: {
    /** Random seed for reproducibility */
    seed?: number
    /** Whether to sample without replacement (default: true) */
    unique?: boolean
  } = {}
): CartesianResult<T> {
  const { unique = true } = options

  // Generate all combinations first
  const allCombinations = cartesian(params)

  // If sample size is larger than available combinations, return all
  if (sampleSize >= allCombinations.length) {
    return allCombinations
  }

  // Shuffle and take first n items
  const shuffled = [...allCombinations]

  // Simple Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }

  return shuffled.slice(0, sampleSize)
}

/**
 * Count the total number of combinations without generating them
 *
 * Useful for checking if cartesian product is feasible before generating.
 *
 * @example
 * ```ts
 * import { cartesianCount } from 'ai-experiments'
 *
 * const count = cartesianCount({
 *   model: ['sonnet', 'opus', 'gpt-4o'],
 *   temperature: [0.3, 0.5, 0.7, 0.9],
 *   maxTokens: [100, 500, 1000, 2000],
 * })
 * // Returns 48 (3 * 4 * 4)
 *
 * if (count > 100) {
 *   console.log('Too many combinations, use cartesianSample instead')
 * }
 * ```
 */
export function cartesianCount<T extends CartesianParams>(params: T): number {
  const keys = Object.keys(params) as (keyof T)[]

  if (keys.length === 0) return 0

  return keys.reduce((total, key) => {
    const arr = params[key]
    return total * (arr?.length ?? 0)
  }, 1)
}

/**
 * Generate cartesian product with labels for each dimension
 *
 * Returns combinations with additional metadata about which dimension each value came from.
 *
 * @example
 * ```ts
 * import { cartesianWithLabels } from 'ai-experiments'
 *
 * const labeled = cartesianWithLabels({
 *   model: ['sonnet', 'opus'],
 *   temperature: [0.3, 0.7],
 * })
 * // [
 * //   { values: { model: 'sonnet', temperature: 0.3 }, labels: { model: 0, temperature: 0 } },
 * //   { values: { model: 'sonnet', temperature: 0.7 }, labels: { model: 0, temperature: 1 } },
 * //   { values: { model: 'opus', temperature: 0.3 }, labels: { model: 1, temperature: 0 } },
 * //   { values: { model: 'opus', temperature: 0.7 }, labels: { model: 1, temperature: 1 } },
 * // ]
 * ```
 */
export function cartesianWithLabels<T extends CartesianParams>(
  params: T
): Array<{
  values: { [K in keyof T]: T[K][number] }
  labels: { [K in keyof T]: number }
}> {
  const keys = Object.keys(params) as (keyof T)[]
  const values = keys.map((k) => params[k])

  if (keys.length === 0) {
    return []
  }

  const combinations = cartesianProduct(values)

  return combinations.map((combo) => {
    const valuesObj = {} as { [K in keyof T]: T[K][number] }
    const labelsObj = {} as { [K in keyof T]: number }

    keys.forEach((key, i) => {
      const value = combo[i] as T[typeof key][number]
      valuesObj[key] = value
      const arr = params[key]
      labelsObj[key] = arr ? arr.indexOf(value) : -1
    })

    return {
      values: valuesObj,
      labels: labelsObj,
    }
  })
}
