/**
 * AI Providers E2E Test Suite
 *
 * Tests provider listing, model resolution, and capabilities
 * against deployed workers. This suite is environment-agnostic --
 * the same tests run in browser, node, and vitest-pool-workers.
 *
 * @packageDocumentation
 */

import type {
  TestSuite,
  ClientFactory,
  ProvidersClient,
  ProviderInfo,
  ModelInfo,
} from '../types.js'
import {
  testId,
  assertDefined,
  assertEqual,
  assertTrue,
  assertNotEmpty,
  assertGreaterThan,
  assertType,
  assertIncludes,
} from '../helpers.js'

/**
 * Create the AI Providers test suite
 */
export function createProvidersTests(getClient: ClientFactory): TestSuite {
  let providers: ProvidersClient

  return {
    name: 'AI Providers',

    beforeEach: async () => {
      providers = getClient().providers
    },

    tests: [
      // =====================================================================
      // Provider Listing
      // =====================================================================
      {
        name: 'should list available providers',
        fn: async () => {
          const result = await providers.list()

          assertDefined(result, 'Provider list should be defined')
          assertTrue(Array.isArray(result), 'Should return an array')
          assertNotEmpty(result, 'Should have at least one provider')
        },
      },

      {
        name: 'should return providers with required fields',
        fn: async () => {
          const result = await providers.list()
          const provider = result[0]

          assertDefined(provider)
          assertDefined(provider.id, 'Provider should have an ID')
          assertDefined(provider.name, 'Provider should have a name')
          assertType(provider.id, 'string', 'Provider ID should be a string')
          assertType(provider.name, 'string', 'Provider name should be a string')
        },
      },

      {
        name: 'should include major providers',
        fn: async () => {
          const result = await providers.list()
          const ids = result.map((p) => p.id.toLowerCase())

          // At least some well-known providers should be present
          const knownProviders = ['openai', 'anthropic', 'google']
          const hasKnown = knownProviders.some((p) => ids.some((id) => id.includes(p)))
          assertTrue(hasKnown, 'Should include at least one major provider')
        },
      },

      // =====================================================================
      // Provider Details
      // =====================================================================
      {
        name: 'should get a specific provider by ID',
        fn: async () => {
          const allProviders = await providers.list()
          assertNotEmpty(allProviders, 'Need at least one provider')

          const firstId = allProviders[0].id
          const provider = await providers.get(firstId)

          assertDefined(provider, 'Should find provider by ID')
          assertEqual(provider.id, firstId)
        },
      },

      {
        name: 'should return null for non-existent provider',
        fn: async () => {
          const result = await providers.get('non-existent-provider-xyz-123')
          assertEqual(result, null)
        },
      },

      // =====================================================================
      // Model Listing
      // =====================================================================
      {
        name: 'should list all available models',
        fn: async () => {
          const models = await providers.models()

          assertDefined(models, 'Models list should be defined')
          assertTrue(Array.isArray(models), 'Should return an array')
          assertNotEmpty(models, 'Should have at least one model')
        },
      },

      {
        name: 'should return models with required fields',
        fn: async () => {
          const models = await providers.models()
          const model = models[0]

          assertDefined(model)
          assertDefined(model.id, 'Model should have an ID')
          assertDefined(model.name, 'Model should have a name')
          assertDefined(model.provider, 'Model should have a provider')
          assertType(model.id, 'string', 'Model ID should be a string')
          assertType(model.provider, 'string', 'Model provider should be a string')
        },
      },

      {
        name: 'should list models for a specific provider',
        fn: async () => {
          const allProviders = await providers.list()
          assertNotEmpty(allProviders, 'Need at least one provider')

          const providerId = allProviders[0].id
          const models = await providers.models(providerId)

          assertDefined(models, 'Should return models for provider')
          assertTrue(Array.isArray(models), 'Should return an array')

          // All returned models should belong to the requested provider
          for (const model of models) {
            assertEqual(
              model.provider,
              providerId,
              `Model ${model.id} should belong to provider ${providerId}`
            )
          }
        },
      },

      // =====================================================================
      // Model Resolution
      // =====================================================================
      {
        name: 'should resolve a model alias',
        fn: async () => {
          const model = await providers.resolve('sonnet')

          assertDefined(model, 'Should resolve "sonnet" alias')
          assertDefined(model.id, 'Resolved model should have an ID')
          assertDefined(model.provider, 'Resolved model should have a provider')
        },
      },

      {
        name: 'should resolve common model aliases',
        fn: async () => {
          const aliases = ['gpt-4o', 'sonnet', 'haiku']

          for (const alias of aliases) {
            const model = await providers.resolve(alias)
            // Some aliases may not resolve depending on the deployment,
            // but the call should not throw
            if (model) {
              assertDefined(model.id, `Resolved ${alias} should have an ID`)
            }
          }
        },
      },

      {
        name: 'should return null for unknown model alias',
        fn: async () => {
          const result = await providers.resolve('non-existent-model-alias-xyz')
          assertEqual(result, null)
        },
      },

      // =====================================================================
      // Provider Capabilities
      // =====================================================================
      {
        name: 'should include capabilities in provider info',
        fn: async () => {
          const allProviders = await providers.list()
          const providerWithCaps = allProviders.find(
            (p) => p.capabilities && p.capabilities.length > 0
          )

          if (providerWithCaps) {
            assertDefined(providerWithCaps.capabilities)
            assertTrue(
              Array.isArray(providerWithCaps.capabilities),
              'Capabilities should be an array'
            )
            assertNotEmpty(providerWithCaps.capabilities, 'Should have at least one capability')
          }
          // If no providers have capabilities listed, that is OK for this test
        },
      },

      {
        name: 'should include model list in provider info',
        fn: async () => {
          const allProviders = await providers.list()
          const providerWithModels = allProviders.find((p) => p.models && p.models.length > 0)

          if (providerWithModels) {
            assertDefined(providerWithModels.models)
            assertTrue(Array.isArray(providerWithModels.models), 'Models list should be an array')
            assertNotEmpty(providerWithModels.models, 'Should have at least one model')
          }
        },
      },
    ],
  }
}
