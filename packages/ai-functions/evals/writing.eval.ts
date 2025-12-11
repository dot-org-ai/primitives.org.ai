/**
 * Writing Quality Eval (LLM-as-Judge)
 *
 * Tests model writing capabilities using LLM-as-judge scoring.
 * Uses a strong model (sonnet) to judge output quality.
 */

import { evalite } from 'evalite'
import { generateText, generateObject } from '../src/generate.js'
import { schema } from '../src/schema.js'
import { createModelVariants, type EvalModel } from '../src/eval/models.js'

// Use sonnet as the judge model
const JUDGE_MODEL = 'sonnet'

// Writing test cases
const TEST_CASES = [
  {
    name: 'Professional email',
    prompt: 'Write a professional email declining a meeting invitation politely.',
    criteria: ['Polite tone', 'Clear explanation', 'Proper email format'],
  },
  {
    name: 'Product description',
    prompt: 'Write a product description for wireless earbuds targeting tech-savvy consumers.',
    criteria: ['Highlights features', 'Compelling language', 'Clear value proposition'],
  },
  {
    name: 'Explanation',
    prompt: 'Explain how photosynthesis works in simple terms for a high school student.',
    criteria: ['Accurate content', 'Clear language', 'Logical flow'],
  },
]

const modelVariants = createModelVariants({ tiers: ['fast'] })

evalite.each(modelVariants)('Writing Quality', {
  data: TEST_CASES.map(tc => ({ input: tc })),

  task: async (input, variant) => {
    const model = variant as EvalModel
    const startTime = Date.now()

    // Generate the writing
    const { text, usage } = await generateText({
      model: model.id,
      prompt: input.prompt,
    })

    const latencyMs = Date.now() - startTime

    return {
      text,
      testName: input.name,
      criteria: input.criteria,
      modelId: model.id,
      modelName: model.name,
      provider: model.provider,
      latencyMs,
      usage,
    }
  },

  scorers: [
    // LLM-as-judge for quality
    {
      name: 'Writing Quality',
      description: 'LLM judge evaluation of writing quality',
      scorer: async ({ input, output }) => {
        const { object } = await generateObject({
          model: JUDGE_MODEL,
          schema: schema({
            clarity: 'How clear is the writing? (number 0-1)',
            engagement: 'How engaging is the content? (number 0-1)',
            accuracy: 'How well does it meet the criteria? (number 0-1)',
            reasoning: 'Brief explanation',
          }),
          prompt: `Evaluate this writing on a scale of 0-1.

Criteria: ${(input.criteria as string[]).join(', ')}

Writing:
"""
${output.text}
"""`,
        })

        const avg = ((object.clarity as number) + (object.engagement as number) + (object.accuracy as number)) / 3
        return {
          score: avg,
          metadata: object,
        }
      },
    },

    // Word count check
    {
      name: 'Appropriate Length',
      description: 'Whether output has reasonable length',
      scorer: ({ output }) => {
        const words = (output.text as string).split(/\s+/).length
        if (words < 20) return { score: 0.3, metadata: { words } }
        if (words > 500) return { score: 0.7, metadata: { words } }
        return { score: 1, metadata: { words } }
      },
    },
  ],

  columns: ({ output }) => [
    { label: 'Model', value: output.modelName },
    { label: 'Test', value: output.testName },
    { label: 'Words', value: (output.text as string).split(/\s+/).length },
    { label: 'Latency', value: `${output.latencyMs}ms` },
  ],

  trialCount: 2, // Run twice for variance
})
