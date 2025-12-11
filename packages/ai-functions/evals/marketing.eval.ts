#!/usr/bin/env npx tsx
/**
 * Marketing Copy Eval with LLM-as-Judge ELO Ranking
 *
 * Generates marketing copy (title, description, hero headline/subhead, CTAs)
 * and uses pairwise comparison with an LLM judge to create ELO rankings.
 *
 * Usage:
 *   npx tsx evals/marketing.eval.ts
 *   npx tsx evals/marketing.eval.ts --judge=opus        # Use specific judge model
 *   npx tsx evals/marketing.eval.ts --judge=haiku       # Test cheap judge
 *   npx tsx evals/marketing.eval.ts --judge=flash       # Test fast judge
 *   npx tsx evals/marketing.eval.ts --all               # Run all tiers
 *   npx tsx evals/marketing.eval.ts --all --judge=haiku # All tiers + cheap judge
 */

// Load .env from project root
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(import.meta.dirname, '../../../.env') })

import { generateObject } from '../src/generate.js'
import { schema } from '../src/schema.js'
import { EVAL_MODELS, type EvalModel, type ModelTier } from '../src/eval/models.js'

// Parse CLI args
const args = process.argv.slice(2)
const judgeArg = args.find(a => a.startsWith('--judge='))
const JUDGE_MODEL = judgeArg ? judgeArg.split('=')[1] : 'sonnet'
const runAll = args.includes('--all')

const tiers: ModelTier[] = runAll ? ['best', 'fast', 'cheap'] : ['fast']

// Marketing copy schema
const marketingCopySchema = schema({
  title: 'Product/page title (5-10 words)',
  description: 'Meta description for SEO (150-160 characters)',
  hero: {
    headline: 'Hero headline (5-8 words, compelling)',
    subhead: 'Supporting subheadline (10-20 words)',
    primaryCTA: 'Primary call-to-action button text (2-4 words)',
    secondaryCTA: 'Secondary call-to-action link text (3-6 words)',
  },
})

// Test cases - different product/service scenarios
const TEST_CASES = [
  {
    name: 'SaaS Analytics Platform',
    prompt: `Create marketing copy for a B2B SaaS analytics platform called "InsightFlow" that helps companies understand their customer behavior with AI-powered insights. Target audience: Product managers and growth teams at mid-size tech companies.`,
  },
  {
    name: 'E-commerce Fashion Brand',
    prompt: `Create marketing copy for a sustainable fashion e-commerce brand called "EcoThread" that sells organic, ethically-made clothing. Target audience: Environmentally conscious millennials aged 25-35.`,
  },
  {
    name: 'Developer Tool',
    prompt: `Create marketing copy for a CLI tool called "DeployFast" that simplifies Kubernetes deployments with one-command deploys. Target audience: DevOps engineers and backend developers.`,
  },
  {
    name: 'Mobile Fitness App',
    prompt: `Create marketing copy for a fitness app called "FitPulse" that uses AI to create personalized workout plans and tracks progress with smart watch integration. Target audience: Busy professionals aged 30-45.`,
  },
]

interface MarketingCopy {
  title: string
  description: string
  hero: {
    headline: string
    subhead: string
    primaryCTA: string
    secondaryCTA: string
  }
}

interface GeneratedCopy {
  model: EvalModel
  testCase: typeof TEST_CASES[0]
  copy: MarketingCopy
  latencyMs: number
}

interface ELORating {
  modelId: string
  modelName: string
  rating: number
  wins: number
  losses: number
  draws: number
}

// ELO calculation
const K_FACTOR = 32
const INITIAL_ELO = 1500

function calculateEloChange(ratingA: number, ratingB: number, scoreA: number): { deltaA: number; deltaB: number } {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
  const expectedB = 1 - expectedA

  const deltaA = K_FACTOR * (scoreA - expectedA)
  const deltaB = K_FACTOR * ((1 - scoreA) - expectedB)

  return { deltaA, deltaB }
}

// LLM Judge for pairwise comparison
async function judgePair(
  copyA: MarketingCopy,
  copyB: MarketingCopy,
  testCase: typeof TEST_CASES[0],
  judgeModel: string
): Promise<'A' | 'B' | 'TIE'> {
  const prompt = `You are an expert marketing copywriter and brand strategist. Compare these two marketing copy options for: ${testCase.name}

Context: ${testCase.prompt}

=== OPTION A ===
Title: ${copyA.title}
Description: ${copyA.description}
Hero Headline: ${copyA.hero.headline}
Hero Subhead: ${copyA.hero.subhead}
Primary CTA: ${copyA.hero.primaryCTA}
Secondary CTA: ${copyA.hero.secondaryCTA}

=== OPTION B ===
Title: ${copyB.title}
Description: ${copyB.description}
Hero Headline: ${copyB.hero.headline}
Hero Subhead: ${copyB.hero.subhead}
Primary CTA: ${copyB.hero.primaryCTA}
Secondary CTA: ${copyB.hero.secondaryCTA}

Evaluate based on:
1. Clarity and impact of messaging
2. Target audience alignment
3. Emotional appeal and persuasiveness
4. CTA effectiveness
5. Overall brand voice consistency

Which option is better? Answer A, B, or TIE if they're roughly equal.`

  try {
    const { object } = await generateObject({
      model: judgeModel,
      schema: schema({
        reasoning: 'Brief explanation of your judgment (2-3 sentences)',
        winner: 'A | B | TIE',
      }),
      prompt,
      temperature: 0.3,
    })

    const result = object as { reasoning: string; winner: string }
    const winner = result.winner.toUpperCase().trim()

    if (winner === 'A' || winner === 'B' || winner === 'TIE') {
      return winner
    }
    return 'TIE'
  } catch (err) {
    console.error(`   Judge error: ${err}`)
    return 'TIE'
  }
}

// Generate marketing copy for a model
async function generateCopy(model: EvalModel, testCase: typeof TEST_CASES[0]): Promise<GeneratedCopy> {
  const start = Date.now()

  const { object } = await generateObject({
    model: model.id,
    schema: marketingCopySchema,
    prompt: testCase.prompt,
    temperature: 0.7,
  })

  return {
    model,
    testCase,
    copy: object as MarketingCopy,
    latencyMs: Date.now() - start,
  }
}

// Run pairwise comparisons and calculate ELO
async function runEloTournament(
  copies: GeneratedCopy[],
  judgeModel: string
): Promise<ELORating[]> {
  // Initialize ELO ratings
  const ratings: Map<string, ELORating> = new Map()

  for (const copy of copies) {
    if (!ratings.has(copy.model.id)) {
      ratings.set(copy.model.id, {
        modelId: copy.model.id,
        modelName: copy.model.name,
        rating: INITIAL_ELO,
        wins: 0,
        losses: 0,
        draws: 0,
      })
    }
  }

  // Group copies by test case
  const byTestCase = new Map<string, GeneratedCopy[]>()
  for (const copy of copies) {
    const key = copy.testCase.name
    if (!byTestCase.has(key)) {
      byTestCase.set(key, [])
    }
    byTestCase.get(key)!.push(copy)
  }

  console.log(`\n⚖️  Running pairwise comparisons with ${JUDGE_MODEL} as judge...\n`)

  let comparisonCount = 0
  const totalComparisons = Array.from(byTestCase.values()).reduce(
    (sum, copies) => sum + (copies.length * (copies.length - 1)) / 2,
    0
  )

  // Run pairwise comparisons within each test case
  for (const [testCaseName, testCaseCopies] of byTestCase) {
    console.log(`   📝 ${testCaseName}:`)

    for (let i = 0; i < testCaseCopies.length; i++) {
      for (let j = i + 1; j < testCaseCopies.length; j++) {
        const copyA = testCaseCopies[i]
        const copyB = testCaseCopies[j]

        comparisonCount++
        process.stdout.write(`      ${comparisonCount}/${totalComparisons} ${copyA.model.name} vs ${copyB.model.name}... `)

        const winner = await judgePair(copyA.copy, copyB.copy, copyA.testCase, judgeModel)

        const ratingA = ratings.get(copyA.model.id)!
        const ratingB = ratings.get(copyB.model.id)!

        let scoreA: number
        if (winner === 'A') {
          scoreA = 1
          ratingA.wins++
          ratingB.losses++
          console.log(`${copyA.model.name} wins`)
        } else if (winner === 'B') {
          scoreA = 0
          ratingA.losses++
          ratingB.wins++
          console.log(`${copyB.model.name} wins`)
        } else {
          scoreA = 0.5
          ratingA.draws++
          ratingB.draws++
          console.log(`TIE`)
        }

        const { deltaA, deltaB } = calculateEloChange(ratingA.rating, ratingB.rating, scoreA)
        ratingA.rating += deltaA
        ratingB.rating += deltaB
      }
    }
  }

  // Sort by ELO rating
  return Array.from(ratings.values()).sort((a, b) => b.rating - a.rating)
}

// Main
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║              Marketing Copy Eval (LLM-as-Judge)                ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`Judge Model: ${JUDGE_MODEL}`)
  console.log(`Tiers: ${tiers.join(', ')}`)

  // Get models to test
  const models = EVAL_MODELS.filter(m => tiers.includes(m.tier))
  console.log(`Models: ${models.map(m => m.name).join(', ')}`)
  console.log(`Test Cases: ${TEST_CASES.length}`)
  console.log('')

  // Generate copy from each model for each test case
  console.log('🎨 Generating marketing copy...\n')

  const allCopies: GeneratedCopy[] = []
  const startTime = Date.now()

  for (const testCase of TEST_CASES) {
    console.log(`   📦 ${testCase.name}:`)

    const jobs = models.map(async model => {
      try {
        const copy = await generateCopy(model, testCase)
        console.log(`      ✓ ${model.name} (${copy.latencyMs}ms)`)
        return copy
      } catch (err) {
        console.log(`      ✗ ${model.name}: ${err}`)
        return null
      }
    })

    const results = await Promise.all(jobs)
    allCopies.push(...results.filter((r): r is GeneratedCopy => r !== null))
  }

  const generateTime = Date.now() - startTime
  console.log(`\n   Generated ${allCopies.length} copies in ${(generateTime / 1000).toFixed(1)}s`)

  // Run ELO tournament
  const tournamentStart = Date.now()
  const eloRatings = await runEloTournament(allCopies, JUDGE_MODEL)
  const tournamentTime = Date.now() - tournamentStart

  // Display results
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                     ELO Rankings                               ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log('   Rank | Model                  | ELO    | W   | L   | D   |')
  console.log('   -----|------------------------|--------|-----|-----|-----|')

  eloRatings.forEach((rating, idx) => {
    const rank = `${idx + 1}`.padStart(4)
    const name = rating.modelName.padEnd(22)
    const elo = Math.round(rating.rating).toString().padStart(6)
    const wins = rating.wins.toString().padStart(3)
    const losses = rating.losses.toString().padStart(3)
    const draws = rating.draws.toString().padStart(3)
    console.log(`   ${rank} | ${name} | ${elo} | ${wins} | ${losses} | ${draws} |`)
  })

  console.log('')
  console.log(`   Judge: ${JUDGE_MODEL}`)
  console.log(`   Generation Time: ${(generateTime / 1000).toFixed(1)}s`)
  console.log(`   Tournament Time: ${(tournamentTime / 1000).toFixed(1)}s`)
  console.log(`   Total Time: ${((generateTime + tournamentTime) / 1000).toFixed(1)}s`)

  // Show sample outputs from top 3
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════════╗')
  console.log('║                  Sample Outputs (Top 3)                        ║')
  console.log('╚════════════════════════════════════════════════════════════════╝')

  const top3Models = eloRatings.slice(0, 3).map(r => r.modelId)
  const sampleTestCase = TEST_CASES[0]

  for (const modelId of top3Models) {
    const copy = allCopies.find(c => c.model.id === modelId && c.testCase.name === sampleTestCase.name)
    if (copy) {
      const rank = eloRatings.findIndex(r => r.modelId === modelId) + 1
      console.log(`\n   #${rank} ${copy.model.name} (${sampleTestCase.name}):`)
      console.log(`   ─────────────────────────────────────────`)
      console.log(`   Title: ${copy.copy.title}`)
      console.log(`   Description: ${copy.copy.description}`)
      console.log(`   Headline: ${copy.copy.hero.headline}`)
      console.log(`   Subhead: ${copy.copy.hero.subhead}`)
      console.log(`   Primary CTA: [${copy.copy.hero.primaryCTA}]`)
      console.log(`   Secondary CTA: ${copy.copy.hero.secondaryCTA}`)
    }
  }

  console.log('')
}

main().catch(console.error)
