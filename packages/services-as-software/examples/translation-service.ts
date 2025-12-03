/**
 * Example: Translation Service
 *
 * This example demonstrates how to create a translation service with:
 * - Multiple endpoints (translate, detect language)
 * - Per-use pricing
 * - Rate limiting
 * - Usage tracking
 */

import { Service, Endpoint, POST, GET } from '../src/index.js'

// Define the translation service
const translationService = Service({
  name: 'translation-service',
  version: '1.0.0',
  description: 'AI-powered translation service',
  status: 'active',

  // Default pricing for all endpoints
  pricing: {
    model: 'per-use',
    pricePerUnit: 0.01, // $0.01 per character
    currency: 'USD',
    freeTier: {
      units: 10000, // 10,000 free characters per month
      resetInterval: 'monthly',
    },
  },

  // Service endpoints
  endpoints: [
    POST({
      name: 'translate',
      description: 'Translate text between languages',
      path: '/translate',
      input: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to translate' },
          from: { type: 'string', description: 'Source language code (optional)' },
          to: { type: 'string', description: 'Target language code' },
        },
        required: ['text', 'to'],
        additionalProperties: false,
      },
      output: {
        type: 'object',
        properties: {
          translatedText: { type: 'string', description: 'Translated text' },
          sourceLanguage: { type: 'string', description: 'Detected or specified source language' },
          confidence: { type: 'number', description: 'Translation confidence (0-1)' },
        },
        required: ['translatedText', 'sourceLanguage', 'confidence'],
        additionalProperties: false,
      },
      handler: async (input, context) => {
        // Track usage for billing
        if (context?.usage && context.customerId) {
          await context.usage.track({
            customerId: context.customerId,
            resource: 'translate',
            quantity: input.text.length, // Charge per character
            timestamp: new Date(),
          })
        }

        // In a real implementation, this would call an AI translation API
        return {
          translatedText: `[Translated to ${input.to}] ${input.text}`,
          sourceLanguage: input.from || 'auto-detected',
          confidence: 0.95,
        }
      },
      rateLimit: {
        requests: 100,
        window: 60000, // 100 requests per minute
      },
    }),

    GET({
      name: 'detect',
      description: 'Detect the language of text',
      path: '/detect',
      input: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to analyze' },
        },
        required: ['text'],
        additionalProperties: false,
      },
      output: {
        type: 'object',
        properties: {
          language: { type: 'string', description: 'Detected language code' },
          confidence: { type: 'number', description: 'Detection confidence (0-1)' },
        },
        required: ['language', 'confidence'],
        additionalProperties: false,
      },
      handler: async (input) => {
        // Language detection logic
        return {
          language: 'en',
          confidence: 0.98,
        }
      },
      pricing: {
        model: 'per-use',
        pricePerUnit: 0.001, // $0.001 per detection (cheaper than translation)
        currency: 'USD',
      },
    }),

    Endpoint({
      name: 'languages',
      description: 'Get supported languages',
      method: 'GET',
      path: '/languages',
      handler: async () => {
        return {
          languages: [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Spanish' },
            { code: 'fr', name: 'French' },
            { code: 'de', name: 'German' },
            { code: 'ja', name: 'Japanese' },
            { code: 'zh', name: 'Chinese' },
          ],
        }
      },
      requiresAuth: false, // Public endpoint
    }),
  ],

  // Subscription plans
  plans: [
    {
      id: 'starter',
      name: 'Starter Plan',
      description: 'For individual developers',
      pricing: {
        model: 'subscription',
        basePrice: 9.99,
        currency: 'USD',
        interval: 'monthly',
      },
      entitlements: ['api-access', 'basic-support'],
      features: [
        '100,000 characters/month',
        'Email support',
        'Basic languages',
      ],
      limits: {
        characters: 100000,
      },
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      description: 'For growing businesses',
      pricing: {
        model: 'subscription',
        basePrice: 49.99,
        currency: 'USD',
        interval: 'monthly',
      },
      entitlements: ['api-access', 'priority-support', 'advanced-features'],
      features: [
        '1,000,000 characters/month',
        'Priority support',
        'All languages',
        'Custom models',
      ],
      limits: {
        characters: 1000000,
      },
    },
  ],

  // KPIs
  kpis: [
    {
      id: 'translations-per-day',
      name: 'Translations per Day',
      description: 'Number of translation requests processed daily',
      calculate: async () => {
        // In a real implementation, query the database
        return 1247
      },
      target: 1000,
      unit: 'requests',
    },
    {
      id: 'average-confidence',
      name: 'Average Translation Confidence',
      description: 'Average confidence score across all translations',
      calculate: async () => {
        return 0.94
      },
      target: 0.95,
      unit: 'score',
    },
  ],
})

// Example usage
async function example() {
  // Call the translate endpoint
  const result = await translationService.call('translate', {
    text: 'Hello, world!',
    to: 'es',
  })
  console.log('Translation result:', result)

  // Get KPIs
  const kpis = await translationService.kpis()
  console.log('KPIs:', kpis)

  // Subscribe to a plan
  const subscription = await translationService.subscribe('pro')
  console.log('Subscription:', subscription)
}

// Export the service
export { translationService }
