/**
 * Local development helpers for ai-tests
 *
 * Run the test worker via Miniflare for local development and Node.js usage.
 */

import { TestServiceCore } from './worker.js'

let miniflareInstance: InstanceType<typeof import('miniflare').Miniflare> | null = null
let localService: TestServiceCore | null = null

/**
 * Get a local TestServiceCore instance
 *
 * For local development, this creates a direct instance.
 * The RPC serialization happens when called via worker bindings.
 */
export function getLocalTestService(): TestServiceCore {
  if (!localService) {
    localService = new TestServiceCore()
  }
  return localService
}

/**
 * Start a Miniflare instance running the test worker
 *
 * This is useful for testing the RPC interface locally.
 */
export async function startTestWorker(options?: {
  port?: number
}): Promise<{
  url: string
  stop: () => Promise<void>
}> {
  const { Miniflare } = await import('miniflare')

  // Build worker script inline
  const workerScript = `
    import { TestService } from './index.js';
    export { TestService };
    export default {
      async fetch(request) {
        return new Response('ai-tests worker running');
      }
    };
  `

  miniflareInstance = new Miniflare({
    modules: true,
    script: workerScript,
    port: options?.port,
    compatibilityDate: '2024-12-01',
  })

  const url = await miniflareInstance.ready

  return {
    url: url.toString(),
    stop: async () => {
      if (miniflareInstance) {
        await miniflareInstance.dispose()
        miniflareInstance = null
      }
    }
  }
}

/**
 * Create a test service that can be used as a service binding
 *
 * For use in Miniflare configurations when testing sandbox workers.
 */
export function createTestServiceBinding(): TestServiceCore {
  return new TestServiceCore()
}
