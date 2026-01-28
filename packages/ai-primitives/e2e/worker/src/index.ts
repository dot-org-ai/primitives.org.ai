/**
 * Minimal worker entry point for E2E tests
 *
 * This worker exists solely to provide a runtime context for the
 * vitest-pool-workers tests. It declares the service bindings that
 * the tests use to connect to the deployed workers.
 */

export interface Env {
  AI_DATABASE: Service
  DIGITAL_OBJECTS: Service
  AI_PROVIDERS: Service
  AI_WORKFLOWS: Service
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return new Response('E2E test worker', { status: 200 })
  },
}
