#!/usr/bin/env npx tsx
/**
 * Run AI Functions Eval Suite
 *
 * Usage:
 *   npx tsx evals/run-evals.ts [--fast] [--all]
 *
 * Options:
 *   --fast    Only run fast-tier models (default)
 *   --all     Run all models
 *   --math    Run only math eval
 *   --class   Run only classification eval
 */

import { runEval, generateObject, generateText, schema } from '../src/eval/runner.js'
import type { EvalModel, ModelTier } from '../src/eval/models.js'

// Parse CLI args
const args = process.argv.slice(2)
const runAll = args.includes('--all')
const runMath = args.includes('--math')
const runClass = args.includes('--class')
const runSingle = runMath || runClass

const tiers: ModelTier[] = runAll ? ['best', 'fast', 'cheap'] : ['fast']

console.log('╔════════════════════════════════════════════════════════════════╗')
console.log('║                   AI Functions Eval Suite                      ║')
console.log('╚════════════════════════════════════════════════════════════════╝')
console.log('')
console.log(`Tiers: ${tiers.join(', ')}`)

// Math eval
async function runMathEval() {
  const cases = [
    { name: 'Simple addition', input: { problem: 'What is 15 + 27?' }, expected: 42 },
    { name: 'Division', input: { problem: 'What is 144 / 12?' }, expected: 12 },
    { name: 'Multiplication', input: { problem: 'What is 7 * 8?' }, expected: 56 },
    { name: 'Word problem', input: { problem: 'A store sells 45 apples at $2 each. What is the total revenue?' }, expected: 90 },
    { name: 'Multi-step', input: { problem: 'A company has 120 employees. 40% work in engineering, and 25% of engineers are senior. How many senior engineers?' }, expected: 12 },
  ]

  return runEval({
    name: 'Math',
    cases,
    tiers,
    task: async (input, model) => {
      const { object } = await generateObject({
        model: model.id,
        schema: schema({
          answer: 'The numeric answer (number)',
          reasoning: 'Step by step reasoning',
        }),
        prompt: `Solve this math problem:\n\n${input.problem}`,
      })
      return object
    },
    scorers: [
      {
        name: 'Correct Answer',
        description: 'Whether the numeric answer is correct',
        scorer: ({ output, expected }) => {
          const answer = (output as { answer: number }).answer
          const exp = expected as number
          return Math.abs(answer - exp) < 0.01 ? 1 : 0
        },
      },
      {
        name: 'Shows Work',
        description: 'Whether model explains reasoning',
        scorer: ({ output }) => {
          const reasoning = (output as { reasoning: string }).reasoning
          if (!reasoning || reasoning.length < 20) return 0.2
          if (reasoning.length > 50) return 1
          return 0.6
        },
      },
    ],
  })
}

// Classification eval
async function runClassificationEval() {
  const cases = [
    { name: 'Positive sentiment', input: { text: 'This product exceeded my expectations!', options: ['positive', 'negative', 'neutral'] }, expected: 'positive' },
    { name: 'Negative sentiment', input: { text: 'The delivery was late and packaging damaged.', options: ['positive', 'negative', 'neutral'] }, expected: 'negative' },
    { name: 'Neutral sentiment', input: { text: 'The product arrived as described.', options: ['positive', 'negative', 'neutral'] }, expected: 'neutral' },
    { name: 'Account ticket', input: { text: 'I need to reset my password', options: ['account', 'billing', 'technical', 'shipping'] }, expected: 'account' },
    { name: 'Billing ticket', input: { text: 'When will my refund be processed?', options: ['account', 'billing', 'technical', 'shipping'] }, expected: 'billing' },
    { name: 'Technical ticket', input: { text: 'The app crashes when uploading images', options: ['account', 'billing', 'technical', 'shipping'] }, expected: 'technical' },
  ]

  return runEval({
    name: 'Classification',
    cases,
    tiers,
    task: async (input, model) => {
      const enumStr = input.options.join(' | ')
      const { object } = await generateObject({
        model: model.id,
        schema: schema({
          category: enumStr,
          confidence: 'Confidence 0-1 (number)',
        }),
        prompt: `Classify this text into one of: ${input.options.join(', ')}\n\nText: "${input.text}"`,
      })
      return object
    },
    scorers: [
      {
        name: 'Accuracy',
        description: 'Whether classification is correct',
        scorer: ({ output, expected }) => {
          const predicted = (output as { category: string }).category
          return predicted === expected ? 1 : 0
        },
      },
      {
        name: 'Valid Category',
        description: 'Whether output is a valid option',
        scorer: ({ input, output }) => {
          const predicted = (output as { category: string }).category
          const options = (input as { options: string[] }).options
          return options.includes(predicted) ? 1 : 0
        },
      },
    ],
  })
}

// Run evals
async function main() {
  const results = []

  if (!runSingle || runMath) {
    results.push(await runMathEval())
  }

  if (!runSingle || runClass) {
    results.push(await runClassificationEval())
  }

  // Overall summary
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                          Summary                               ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')

  let totalScore = 0
  let totalCost = 0
  let totalTime = 0

  for (const result of results) {
    console.log(`\n${result.name}: ${(result.avgScore * 100).toFixed(1)}%`)
    totalScore += result.avgScore
    totalCost += result.totalCost
    totalTime += result.totalTime
  }

  console.log('')
  console.log(`Overall: ${((totalScore / results.length) * 100).toFixed(1)}%`)
  console.log(`Total Cost: $${totalCost.toFixed(4)}`)
  console.log(`Total Time: ${(totalTime / 1000).toFixed(1)}s`)
}

main().catch(console.error)
