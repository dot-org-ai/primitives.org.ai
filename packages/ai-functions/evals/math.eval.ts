/**
 * Math Eval
 *
 * Tests model mathematical reasoning from simple arithmetic
 * to word problems.
 */

import { evalite } from 'evalite'
import { generateObject } from '../src/generate.js'
import { schema } from '../src/schema.js'
import { createModelVariants, type EvalModel } from '../src/eval/models.js'

// Math test cases
const TEST_CASES = [
  // Arithmetic
  { problem: 'What is 15 + 27?', expected: 42, difficulty: 'easy' },
  { problem: 'What is 144 / 12?', expected: 12, difficulty: 'easy' },
  { problem: 'What is 7 * 8?', expected: 56, difficulty: 'easy' },

  // Word problems
  { problem: 'A store sells 45 apples at $2 each. What is the total revenue?', expected: 90, difficulty: 'medium' },
  { problem: 'A train travels 240 miles in 4 hours. What is the average speed in mph?', expected: 60, difficulty: 'medium' },

  // Multi-step
  { problem: 'A company has 120 employees. 40% work in engineering, and 25% of engineers are senior. How many senior engineers?', expected: 12, difficulty: 'hard' },
]

const modelVariants = createModelVariants({ tiers: ['fast'] })

evalite.each(modelVariants)('Math', {
  data: TEST_CASES.map(tc => ({ input: tc, expected: tc.expected })),

  task: async (input, variant) => {
    const model = variant as EvalModel
    const startTime = Date.now()

    const { object, usage } = await generateObject({
      model: model.id,
      schema: schema({
        answer: 'The numeric answer (number)',
        reasoning: 'Step by step reasoning',
      }),
      prompt: `Solve this math problem:\n\n${input.problem}`,
    })

    const latencyMs = Date.now() - startTime

    return {
      answer: object.answer,
      reasoning: object.reasoning,
      expected: input.expected,
      problem: input.problem,
      difficulty: input.difficulty,
      modelId: model.id,
      modelName: model.name,
      latencyMs,
      usage,
    }
  },

  scorers: [
    // Exact answer
    {
      name: 'Correct Answer',
      description: 'Whether the numeric answer is correct',
      scorer: ({ output, expected }) => {
        const answer = output.answer as number
        const exp = expected as number
        // Allow small floating point tolerance
        return { score: Math.abs(answer - exp) < 0.01 ? 1 : 0 }
      },
    },

    // Shows reasoning
    {
      name: 'Shows Work',
      description: 'Whether model explains reasoning',
      scorer: ({ output }) => {
        const reasoning = output.reasoning as string
        if (!reasoning || reasoning.length < 20) return { score: 0.2 }
        if (reasoning.length > 50) return { score: 1 }
        return { score: 0.6 }
      },
    },
  ],

  columns: ({ output, expected }) => [
    { label: 'Model', value: output.modelName },
    { label: 'Difficulty', value: output.difficulty },
    { label: 'Expected', value: expected },
    { label: 'Got', value: output.answer },
    { label: 'Correct', value: Math.abs((output.answer as number) - (expected as number)) < 0.01 ? 'Yes' : 'No' },
  ],
})
