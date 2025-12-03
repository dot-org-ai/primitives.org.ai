/**
 * Node.js test server with HTTP and WebSocket support
 */

import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import type { Server } from 'node:http'
import { createTestApp } from './test-server.js'

export interface TestServer {
  /** Base HTTP URL */
  url: string
  /** WebSocket URL */
  wsUrl: string
  /** HTTP port */
  port: number
  /** Close the server */
  close: () => Promise<void>
}

/**
 * Start a test server on Node.js
 *
 * @param port - Port to listen on (0 for auto-assign)
 */
export async function startTestServer(port = 0): Promise<TestServer> {
  const { app, rpc, basePath } = createTestApp()

  // Set up WebSocket support
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

  // Add WebSocket handler
  app.get(basePath, upgradeWebSocket(rpc.ws))

  // Start server
  const server = serve({
    fetch: app.fetch,
    port,
  }) as Server

  // Inject WebSocket handler
  injectWebSocket(server)

  // Wait for server to be ready
  await new Promise<void>((resolve) => {
    server.once('listening', resolve)
  })

  // Get actual port
  const address = server.address()
  const actualPort = typeof address === 'object' ? address?.port ?? port : port

  const url = `http://localhost:${actualPort}`
  const wsUrl = `ws://localhost:${actualPort}`

  return {
    url,
    wsUrl,
    port: actualPort,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      }),
  }
}

/**
 * Create a test server and return context for tests
 */
export async function createNodeTestContext() {
  const server = await startTestServer()
  return {
    server,
    httpUrl: `${server.url}/rpc`,
    wsUrl: `${server.wsUrl}/rpc`,
    bridgeUrl: `${server.url}/rpc.html`,
    cleanup: () => server.close(),
  }
}
