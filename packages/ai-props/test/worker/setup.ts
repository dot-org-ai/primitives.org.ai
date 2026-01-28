/**
 * Test setup for worker tests
 *
 * Configures the AI providers registry with gateway credentials
 * from environment bindings before tests run.
 */

import { env } from 'cloudflare:test'
import { beforeAll } from 'vitest'

// Populate process.env from worker bindings
// This is needed because ai-providers uses process.env which isn't
// automatically populated from worker bindings in miniflare
const typedEnv = env as Record<string, string>
const envKeys = ['AI_GATEWAY_URL', 'AI_GATEWAY_TOKEN', 'AWS_BEARER_TOKEN_BEDROCK']

// Try multiple methods to set process.env
for (const key of envKeys) {
  if (typedEnv[key]) {
    try {
      // Method 1: Direct assignment (may be blocked by readonly)
      // @ts-expect-error - process.env may be readonly
      process.env[key] = typedEnv[key]
    } catch {
      // Method 2: Use Object.defineProperty
      try {
        Object.defineProperty(process.env, key, {
          value: typedEnv[key],
          writable: true,
          configurable: true,
          enumerable: true,
        })
      } catch {
        // If both methods fail, log a warning
        console.warn(`Could not set process.env.${key}`)
      }
    }
  }
}

// Configure the AI providers registry with gateway credentials
// This must be done AFTER setting process.env but BEFORE any AI calls
beforeAll(async () => {
  if (typedEnv.AI_GATEWAY_URL && typedEnv.AI_GATEWAY_TOKEN) {
    try {
      // Dynamically import ai-providers and configure it
      const aiProviders = await import('ai-providers')
      await aiProviders.configureRegistry({
        gatewayUrl: typedEnv.AI_GATEWAY_URL,
        gatewayToken: typedEnv.AI_GATEWAY_TOKEN,
      })
    } catch (error) {
      console.error('[setup] Failed to configure AI providers registry:', error)
    }
  }
})
