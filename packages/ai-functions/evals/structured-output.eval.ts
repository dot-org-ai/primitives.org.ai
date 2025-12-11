/**
 * Structured Output Eval
 *
 * Tests model ability to generate valid structured JSON output
 * matching specified schemas across all providers.
 */

import { evalite } from 'evalite'
import { generateObject } from '../src/generate.js'
import { schema } from '../src/schema.js'
import { createModelVariants, getModelPricing, type EvalModel } from '../src/eval/models.js'

// Test cases for structured output
const TEST_CASES = [
  {
    name: 'Simple object',
    prompt: 'Generate a greeting in French',
    schema: {
      greeting: 'A friendly greeting',
      language: 'The language of the greeting',
    },
    expectedTypes: { greeting: 'string', language: 'string' },
  },
  {
    name: 'With numbers',
    prompt: 'Generate info about Tokyo',
    schema: {
      name: 'City name',
      population: 'Population in millions (number)',
      area: 'Area in square kilometers (number)',
    },
    expectedTypes: { name: 'string', population: 'number', area: 'number' },
  },
  {
    name: 'With arrays',
    prompt: 'Generate a simple pasta recipe',
    schema: {
      title: 'Recipe title',
      ingredients: ['List of ingredients'],
      steps: ['Cooking steps'],
    },
    expectedTypes: { title: 'string', ingredients: 'array', steps: 'array' },
  },
  {
    name: 'With enum',
    prompt: 'Analyze sentiment: "I love this product!"',
    schema: {
      sentiment: 'positive | negative | neutral',
      confidence: 'Confidence score 0-1 (number)',
    },
    expectedTypes: { sentiment: 'string', confidence: 'number' },
  },
  {
    name: 'Nested object',
    prompt: 'Generate a fictional person living in Japan',
    schema: {
      person: { name: 'Full name', age: 'Age (number)' },
      address: { city: 'City name', country: 'Country name' },
    },
    expectedTypes: { person: 'object', address: 'object' },
  },
]

// Test across models - start with fast tier for quick iteration
const modelVariants = createModelVariants({ tiers: ['fast'] })

evalite.each(modelVariants)('Structured Output', {
  data: TEST_CASES.map(tc => ({ input: tc })),

  task: async (input, variant) => {
    const model = variant as EvalModel
    const startTime = Date.now()

    const { object, usage } = await generateObject({
      model: model.id,
      schema: schema(input.schema),
      prompt: input.prompt,
    })

    const latencyMs = Date.now() - startTime

    // Calculate cost from language-models pricing
    const pricing = getModelPricing(model.id)
    const cost = pricing
      ? ((usage?.promptTokens ?? 0) * pricing.prompt + (usage?.completionTokens ?? 0) * pricing.completion) / 1_000_000
      : 0

    return {
      object,
      expectedTypes: input.expectedTypes,
      testName: input.name,
      modelId: model.id,
      modelName: model.name,
      provider: model.provider,
      latencyMs,
      cost,
      usage,
    }
  },

  scorers: [
    // Type accuracy
    {
      name: 'Type Accuracy',
      description: 'Whether output fields have correct types',
      scorer: ({ output }) => {
        const obj = output.object as Record<string, unknown>
        const expected = output.expectedTypes as Record<string, string>
        const fields = Object.keys(expected)

        let correct = 0
        for (const field of fields) {
          const val = obj[field]
          const expectedType = expected[field]
          const actualType = Array.isArray(val) ? 'array' : typeof val

          if (actualType === expectedType) correct++
        }

        return { score: correct / fields.length }
      },
    },

    // Latency
    {
      name: 'Latency',
      description: 'Response time (target < 3s)',
      scorer: ({ output }) => {
        const ms = output.latencyMs as number
        if (ms < 2000) return { score: 1 }
        if (ms > 10000) return { score: 0 }
        return { score: 1 - (ms - 2000) / 8000 }
      },
    },
  ],

  columns: ({ output, scores }) => [
    { label: 'Model', value: output.modelName },
    { label: 'Test', value: output.testName },
    { label: 'Latency', value: `${output.latencyMs}ms` },
    { label: 'Cost', value: `$${(output.cost as number).toFixed(6)}` },
  ],
})
