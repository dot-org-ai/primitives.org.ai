/**
 * Test worker for RPC transport tests in Cloudflare Workers
 *
 * This worker handles RPC requests for testing.
 */

import { Hono } from 'hono'
import { createRPCMiddleware } from '../../../src/rpc/server.js'
import { testMethods, resetTestState, type TestContext } from '../fixtures/test-methods.js'

const app = new Hono()

// Reset endpoint
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
  allowedOrigins: '*',
})

// Mount HTTP handler
app.post('/rpc', rpc.http)

// Mount bridge handler
app.get('/rpc.html', rpc.bridge)

// Note: WebSocket in Workers requires using upgradeWebSocket from hono/cloudflare-workers
// which needs to be added when running in the actual Workers environment

export default app
