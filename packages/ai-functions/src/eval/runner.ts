/**
 * Simple eval runner for AI Functions
 *
 * Runs evals across multiple models and collects results.
 * Does not depend on evalite - uses our own infrastructure.
 */

import { generateObject, generateText } from '../generate.js'
import { schema } from '../schema.js'
import { createModelVariants, getModelPricing, type EvalModel, type ModelTier } from './models.js'

export interface EvalCase<TInput = unknown, TExpected = unknown> {
  name: string
  input: TInput
  expected?: TExpected
}

export interface EvalScore {
  name: string
  score: number
  description?: string
  metadata?: unknown
}

export interface EvalResult<TOutput = unknown> {
  model: EvalModel
  case: EvalCase
  output: TOutput
  scores: EvalScore[]
  latencyMs: number
  cost: number
  error?: string
}

export interface EvalSummary {
  name: string
  results: EvalResult[]
  avgScore: number
  byModel: Record<string, { avgScore: number; count: number }>
  totalCost: number
  totalTime: number
}

export interface RunEvalOptions<TInput, TOutput, TExpected> {
  name: string
  cases: EvalCase<TInput, TExpected>[]
  task: (input: TInput, model: EvalModel) => Promise<TOutput>
  scorers: Array<{
    name: string
    description?: string
    scorer: (args: { input: TInput; output: TOutput; expected?: TExpected }) => number | Promise<number>
  }>
  models?: EvalModel[]
  tiers?: ModelTier[]
  providers?: string[]
  concurrency?: number
}

/**
 * Run an eval suite across models
 */
export async function runEval<TInput, TOutput, TExpected>(
  options: RunEvalOptions<TInput, TOutput, TExpected>
): Promise<EvalSummary> {
  const { name, cases, task, scorers, concurrency = 3 } = options

  // Get models to test
  const models = options.models ?? createModelVariants({
    tiers: options.tiers,
    providers: options.providers,
  }).map(v => v.input)

  const results: EvalResult<TOutput>[] = []
  const startTime = Date.now()

  console.log(`\n🧪 Running eval: ${name}`)
  console.log(`   Models: ${models.map(m => m.name).join(', ')}`)
  console.log(`   Cases: ${cases.length}`)
  console.log('')

  // Run all model/case combinations
  const jobs: Array<{ model: EvalModel; case: EvalCase<TInput, TExpected> }> = []
  for (const model of models) {
    for (const evalCase of cases) {
      jobs.push({ model, case: evalCase })
    }
  }

  // Process in batches with concurrency limit
  for (let i = 0; i < jobs.length; i += concurrency) {
    const batch = jobs.slice(i, i + concurrency)

    const batchResults = await Promise.all(
      batch.map(async (job) => {
        const caseStart = Date.now()

        try {
          // Run the task
          const output = await task(job.case.input, job.model)
          const latencyMs = Date.now() - caseStart

          // Run scorers
          const scores: EvalScore[] = []
          for (const s of scorers) {
            try {
              const score = await s.scorer({
                input: job.case.input,
                output,
                expected: job.case.expected,
              })
              scores.push({
                name: s.name,
                score: Math.max(0, Math.min(1, score)),
                description: s.description,
              })
            } catch (err) {
              scores.push({
                name: s.name,
                score: 0,
                description: s.description,
                metadata: { error: String(err) },
              })
            }
          }

          // Calculate cost
          const pricing = getModelPricing(job.model.id)
          // Estimate tokens - rough approximation
          const estimatedPromptTokens = 100
          const estimatedCompletionTokens = 200
          const cost = pricing
            ? (estimatedPromptTokens * pricing.prompt + estimatedCompletionTokens * pricing.completion) / 1_000_000
            : 0

          const avgScore = scores.length > 0
            ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
            : 0

          const symbol = avgScore >= 0.8 ? '✓' : avgScore >= 0.5 ? '~' : '✗'
          console.log(`   ${symbol} ${job.model.name} | ${job.case.name} | ${(avgScore * 100).toFixed(0)}% | ${latencyMs}ms`)

          return {
            model: job.model,
            case: job.case,
            output,
            scores,
            latencyMs,
            cost,
          }
        } catch (err) {
          console.log(`   ✗ ${job.model.name} | ${job.case.name} | ERROR: ${err}`)

          return {
            model: job.model,
            case: job.case,
            output: null as unknown as TOutput,
            scores: scorers.map(s => ({ name: s.name, score: 0 })),
            latencyMs: Date.now() - caseStart,
            cost: 0,
            error: String(err),
          }
        }
      })
    )

    results.push(...batchResults)
  }

  // Calculate summary
  const totalTime = Date.now() - startTime
  const totalCost = results.reduce((sum, r) => sum + r.cost, 0)
  const allScores = results.flatMap(r => r.scores.map(s => s.score))
  const avgScore = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0

  // Group by model
  const byModel: Record<string, { avgScore: number; count: number }> = {}
  for (const result of results) {
    const modelKey = result.model.id
    if (!byModel[modelKey]) {
      byModel[modelKey] = { avgScore: 0, count: 0 }
    }
    const resultAvg = result.scores.reduce((sum, s) => sum + s.score, 0) / result.scores.length
    byModel[modelKey].avgScore += resultAvg
    byModel[modelKey].count++
  }
  for (const key of Object.keys(byModel)) {
    const entry = byModel[key]
    if (entry) {
      entry.avgScore /= entry.count
    }
  }

  console.log('')
  console.log(`📊 Results:`)
  console.log(`   Overall: ${(avgScore * 100).toFixed(1)}%`)
  console.log(`   Time: ${(totalTime / 1000).toFixed(1)}s`)
  console.log(`   Cost: $${totalCost.toFixed(4)}`)
  console.log('')
  console.log('   By Model:')
  for (const [modelId, stats] of Object.entries(byModel)) {
    console.log(`   - ${modelId}: ${(stats.avgScore * 100).toFixed(1)}%`)
  }

  return {
    name,
    results,
    avgScore,
    byModel,
    totalCost,
    totalTime,
  }
}

// Re-export helpers
export { generateObject, generateText, schema }
