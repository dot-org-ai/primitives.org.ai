/**
 * Tests for generateObject and generateText
 *
 * These tests use real AI calls via the Cloudflare AI Gateway.
 * The gateway caches responses, so repeated test runs are fast and free.
 *
 * Required env vars:
 * - AI_GATEWAY_URL: Cloudflare AI Gateway URL
 * - AI_GATEWAY_TOKEN: Gateway auth token (or individual provider keys)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { generateObject, generateText } from '../src/index.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

describe.skipIf(!hasGateway)('generateObject', () => {
  it('generates a simple object with string fields', async () => {
    const { object } = await generateObject({
      model: 'sonnet',
      schema: {
        greeting: 'A friendly greeting',
        language: 'The language of the greeting',
      },
      prompt: 'Generate a greeting in French',
    })

    expect(object).toBeDefined()
    expect(typeof object.greeting).toBe('string')
    expect(typeof object.language).toBe('string')
    expect(object.greeting.length).toBeGreaterThan(0)
  })

  it('generates object with number fields', async () => {
    const { object } = await generateObject({
      model: 'sonnet',
      schema: {
        name: 'City name',
        population: 'Population in millions (number)',
        area: 'Area in square kilometers (number)',
      },
      prompt: 'Generate info about Tokyo',
    })

    expect(object).toBeDefined()
    expect(typeof object.name).toBe('string')
    expect(typeof object.population).toBe('number')
    expect(typeof object.area).toBe('number')
  })

  it('generates object with array fields', async () => {
    const { object } = await generateObject({
      model: 'sonnet',
      schema: {
        title: 'Recipe title',
        ingredients: ['List of ingredients'],
        steps: ['Cooking steps'],
      },
      prompt: 'Generate a simple pasta recipe',
    })

    expect(object).toBeDefined()
    expect(typeof object.title).toBe('string')
    expect(Array.isArray(object.ingredients)).toBe(true)
    expect(Array.isArray(object.steps)).toBe(true)
    expect(object.ingredients.length).toBeGreaterThan(0)
    expect(object.steps.length).toBeGreaterThan(0)
  })

  it('generates object with enum fields', async () => {
    const { object } = await generateObject({
      model: 'sonnet',
      schema: {
        sentiment: 'positive | negative | neutral',
        confidence: 'Confidence score (number)',
      },
      prompt: 'Analyze sentiment: "I love this product!"',
    })

    expect(object).toBeDefined()
    expect(['positive', 'negative', 'neutral']).toContain(object.sentiment)
    expect(typeof object.confidence).toBe('number')
  })

  it('generates nested objects', async () => {
    const { object } = await generateObject({
      model: 'sonnet',
      schema: {
        person: {
          name: 'Full name',
          age: 'Age (number)',
        },
        address: {
          city: 'City name',
          country: 'Country name',
        },
      },
      prompt: 'Generate a fictional person living in Japan',
    })

    expect(object).toBeDefined()
    expect(typeof object.person.name).toBe('string')
    expect(typeof object.person.age).toBe('number')
    expect(typeof object.address.city).toBe('string')
    expect(typeof object.address.country).toBe('string')
  })

  it('respects system prompt', async () => {
    const { object } = await generateObject({
      model: 'sonnet',
      schema: {
        response: 'Your response',
        style: 'formal | casual | pirate',
      },
      system: 'You are a pirate. Respond in pirate speak.',
      prompt: 'Say hello',
    })

    expect(object).toBeDefined()
    expect(object.style).toBe('pirate')
  })
})

describe.skipIf(!hasGateway)('generateText', () => {
  it('generates simple text response', async () => {
    const { text } = await generateText({
      model: 'sonnet',
      prompt: 'Say "Hello, World!" and nothing else.',
    })

    expect(text).toBeDefined()
    expect(typeof text).toBe('string')
    expect(text.toLowerCase()).toContain('hello')
  })

  it('respects system prompt', async () => {
    const { text } = await generateText({
      model: 'sonnet',
      system: 'You only respond with exactly 3 words.',
      prompt: 'How are you?',
    })

    expect(text).toBeDefined()
    // Should be approximately 3 words
    const wordCount = text.trim().split(/\s+/).length
    expect(wordCount).toBeLessThanOrEqual(5) // Allow some flexibility
  })

  it('handles multi-turn messages', async () => {
    const { text } = await generateText({
      model: 'sonnet',
      messages: [
        { role: 'user', content: 'My name is Alice.' },
        { role: 'assistant', content: 'Nice to meet you, Alice!' },
        { role: 'user', content: 'What is my name?' },
      ],
    })

    expect(text).toBeDefined()
    expect(text.toLowerCase()).toContain('alice')
  })
})
