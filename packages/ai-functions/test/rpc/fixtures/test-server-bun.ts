/**
 * Bun test server with HTTP and WebSocket support
 *
 * Uses Bun.serve() with native WebSocket support.
 */

import { createTestApp } from './test-server.js'
import type { Server } from 'bun'

export interface BunTestServer {
  /** Base HTTP URL */
  url: string
  /** WebSocket URL */
  wsUrl: string
  /** HTTP port */
  port: number
  /** Close the server */
  close: () => void
  /** Bun server instance */
  server: Server
}

/**
 * Start a test server on Bun
 *
 * @param port - Port to listen on (0 for auto-assign)
 */
export function startBunTestServer(port = 0): BunTestServer {
  const { app, rpc, basePath } = createTestApp()

  const server = Bun.serve({
    port,
    fetch: app.fetch,
    websocket: {
      open(ws) {
        // WebSocket opened
        const handler = rpc.ws({} as any)
        ;(ws as any).__rpcHandler = handler
        handler.onOpen?.({} as Event, ws as any)
      },
      message(ws, message) {
        const handler = (ws as any).__rpcHandler
        if (handler) {
          handler.onMessage?.(
            { data: typeof message === 'string' ? message : new TextDecoder().decode(message) } as MessageEvent,
            ws as any
          )
        }
      },
      close(ws) {
        const handler = (ws as any).__rpcHandler
        if (handler) {
          handler.onClose?.({} as CloseEvent, ws as any)
        }
      },
      error(ws, error) {
        const handler = (ws as any).__rpcHandler
        if (handler) {
          handler.onError?.({ error } as Event, ws as any)
        }
      },
    },
  })

  const actualPort = server.port

  return {
    url: `http://localhost:${actualPort}`,
    wsUrl: `ws://localhost:${actualPort}`,
    port: actualPort,
    server,
    close: () => server.stop(),
  }
}

/**
 * Create a test server and return context for tests
 */
export function createBunTestContext() {
  const server = startBunTestServer()
  return {
    server,
    httpUrl: `${server.url}/rpc`,
    wsUrl: `${server.wsUrl}/rpc`,
    bridgeUrl: `${server.url}/rpc.html`,
    cleanup: () => server.close(),
  }
}
