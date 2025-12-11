/**
 * Classification Eval
 *
 * Tests model ability to classify inputs correctly.
 * Includes sentiment analysis, category classification, and boolean questions.
 */

import { evalite } from 'evalite'
import { generateObject } from '../src/generate.js'
import { schema } from '../src/schema.js'
import { createModelVariants, type EvalModel } from '../src/eval/models.js'

// Classification test cases
const TEST_CASES = [
  // Sentiment
  { text: 'This product exceeded my expectations!', expected: 'positive', options: ['positive', 'negative', 'neutral'] },
  { text: 'The delivery was late and packaging damaged.', expected: 'negative', options: ['positive', 'negative', 'neutral'] },
  { text: 'The product arrived as described.', expected: 'neutral', options: ['positive', 'negative', 'neutral'] },

  // Support ticket classification
  { text: 'I need to reset my password', expected: 'account', options: ['account', 'billing', 'technical', 'shipping'] },
  { text: 'When will my refund be processed?', expected: 'billing', options: ['account', 'billing', 'technical', 'shipping'] },
  { text: 'The app crashes when uploading images', expected: 'technical', options: ['account', 'billing', 'technical', 'shipping'] },
  { text: 'My package shows delivered but I never received it', expected: 'shipping', options: ['account', 'billing', 'technical', 'shipping'] },
]

const modelVariants = createModelVariants({ tiers: ['fast', 'cheap'] })

evalite.each(modelVariants)('Classification', {
  data: TEST_CASES.map(tc => ({ input: tc, expected: tc.expected })),

  task: async (input, variant) => {
    const model = variant as EvalModel
    const startTime = Date.now()

    const enumStr = input.options.join(' | ')

    const { object, usage } = await generateObject({
      model: model.id,
      schema: schema({
        category: enumStr,
        confidence: 'Confidence 0-1 (number)',
      }),
      prompt: `Classify this text into one of: ${input.options.join(', ')}

Text: "${input.text}"`,
    })

    const latencyMs = Date.now() - startTime

    return {
      predicted: object.category,
      confidence: object.confidence,
      expected: input.expected,
      text: input.text,
      options: input.options,
      modelId: model.id,
      modelName: model.name,
      latencyMs,
      usage,
    }
  },

  scorers: [
    // Accuracy
    {
      name: 'Accuracy',
      description: 'Whether classification is correct',
      scorer: ({ output, expected }) => ({
        score: output.predicted === expected ? 1 : 0,
      }),
    },

    // Valid category
    {
      name: 'Valid Category',
      description: 'Whether output is a valid option',
      scorer: ({ output }) => ({
        score: (output.options as string[]).includes(output.predicted as string) ? 1 : 0,
      }),
    },

    // Calibration
    {
      name: 'Calibration',
      description: 'Confidence matches accuracy',
      scorer: ({ output, expected }) => {
        const correct = output.predicted === expected
        const conf = output.confidence as number

        // High confidence when correct, low when wrong = well calibrated
        if (correct && conf >= 0.7) return { score: 1 }
        if (!correct && conf <= 0.5) return { score: 0.8 }
        if (correct && conf < 0.5) return { score: 0.6 } // Underconfident
        if (!correct && conf > 0.7) return { score: 0.2 } // Overconfident
        return { score: 0.5 }
      },
    },
  ],

  columns: ({ output, expected }) => [
    { label: 'Model', value: output.modelName },
    { label: 'Expected', value: expected },
    { label: 'Got', value: output.predicted },
    { label: 'Correct', value: output.predicted === expected ? 'Yes' : 'No' },
    { label: 'Confidence', value: `${((output.confidence as number) * 100).toFixed(0)}%` },
  ],
})
