/**
 * Test server factory for RPC transport testing
 *
 * Creates a Hono app with RPC middleware that can be used
 * with any Hono adapter (Node.js, Bun, Workers).
 */

import { Hono } from 'hono'
import { createRPCMiddleware } from '../../../src/rpc/server.js'
import { testMethods, resetTestState, type TestContext } from './test-methods.js'

export interface TestAppOptions {
  /** Base path for RPC endpoints (default: '/rpc') */
  basePath?: string
  /** Allowed origins for CORS */
  allowedOrigins?: string[] | '*'
  /** Allowed origins for postMessage bridge */
  bridgeOrigins?: string[]
}

/**
 * Create a test Hono app with RPC middleware
 */
export function createTestApp(options: TestAppOptions = {}) {
  const { basePath = '/rpc', allowedOrigins = '*', bridgeOrigins = [] } = options

  const app = new Hono()

  // Reset test state endpoint
  app.post('/reset', (c) => {
    resetTestState()
    return c.json({ ok: true })
  })

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // Create RPC middleware
  const rpc = createRPCMiddleware<TestContext>({
    methods: testMethods,
    createContext: (c) => ({
      requestId: c.req.header('x-request-id'),
    }),
    allowedOrigins,
    bridgeOrigins,
    onCall: (method, params, ctx) => {
      // Optional: log calls for debugging
      if (process.env.DEBUG_RPC) {
        console.log(`[RPC] ${method}(${JSON.stringify(params)})`)
      }
    },
    onError: (method, error, ctx) => {
      if (process.env.DEBUG_RPC) {
        console.error(`[RPC Error] ${method}:`, error.message)
      }
    },
  })

  // Mount RPC handlers
  app.post(basePath, rpc.http)
  app.get(`${basePath}.html`, rpc.bridge)

  return { app, rpc, basePath }
}

/**
 * Create test app with WebSocket support
 *
 * The upgradeWebSocket function must be provided by the runtime adapter:
 * - Node.js: import { upgradeWebSocket } from '@hono/node-ws'
 * - Bun: use Bun.serve with websocket config
 * - Workers: import { upgradeWebSocket } from 'hono/cloudflare-workers'
 */
export function createTestAppWithWS<T>(
  options: TestAppOptions & {
    upgradeWebSocket: (handler: ReturnType<typeof createRPCMiddleware>['ws']) => T
  }
) {
  const { upgradeWebSocket, ...appOptions } = options
  const { app, rpc, basePath } = createTestApp(appOptions)

  // Add WebSocket handler
  app.get(basePath, upgradeWebSocket(rpc.ws) as any)

  return { app, rpc, basePath }
}

export { testMethods, resetTestState }
