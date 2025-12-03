/**
 * Hono RPC Server Handlers
 *
 * Provides RPC endpoints for:
 * - HTTP batch requests (POST /rpc)
 * - WebSocket persistent connections (GET /rpc/ws)
 * - postMessage bridge for iframe communication (GET /rpc/bridge)
 *
 * @packageDocumentation
 */

import type { Context, Hono, MiddlewareHandler } from 'hono'
import type { WSContext } from 'hono/ws'
import { applyChain, type Operation } from './deferred.js'
import type { RPCMessage, OperationDescriptor } from './transport.js'

// =============================================================================
// Types
// =============================================================================

/**
 * RPC method handler function
 */
export type RPCMethod<TContext = unknown> = (
  ctx: TContext,
  ...args: unknown[]
) => unknown | Promise<unknown>

/**
 * Collection of RPC methods
 */
export type RPCMethods<TContext = unknown> = Record<string, RPCMethod<TContext>>

/**
 * Options for creating an RPC handler
 */
export interface RPCHandlerOptions<TContext = unknown> {
  /** Available RPC methods */
  methods: RPCMethods<TContext>
  /** Create context from request (for auth, etc) */
  createContext?: (c: Context) => TContext | Promise<TContext>
  /** Called before each method invocation */
  onCall?: (method: string, params: unknown[], ctx: TContext) => void | Promise<void>
  /** Called after each method invocation */
  onResult?: (method: string, result: unknown, ctx: TContext) => void | Promise<void>
  /** Called on errors */
  onError?: (method: string, error: Error, ctx: TContext) => void | Promise<void>
  /** Allowed origins for CORS (default: '*') */
  allowedOrigins?: string[] | '*'
  /** Allowed origins for postMessage bridge */
  bridgeOrigins?: string[]
}

/**
 * Callback registry for server-side callback invocation
 */
interface ServerCallbackRegistry {
  callbacks: Map<string, (...args: unknown[]) => unknown>
  invoke: (id: string, args: unknown[]) => Promise<unknown>
}

// =============================================================================
// HTTP Batch Handler
// =============================================================================

/**
 * Process a single RPC call
 */
async function processCall<TContext>(
  call: RPCMessage,
  methods: RPCMethods<TContext>,
  ctx: TContext,
  options: RPCHandlerOptions<TContext>
): Promise<RPCMessage> {
  const { method, params = [], chain, id } = call

  if (!method) {
    return {
      id,
      type: 'error',
      error: { message: 'Method name required', code: 'INVALID_REQUEST' },
    }
  }

  const handler = methods[method]
  if (!handler) {
    return {
      id,
      type: 'error',
      error: { message: `Unknown method: ${method}`, code: 'METHOD_NOT_FOUND' },
    }
  }

  try {
    // Pre-call hook
    await options.onCall?.(method, params, ctx)

    // Execute the method
    let result = await handler(ctx, ...params)

    // Apply chain operations (promise pipelining)
    if (chain && chain.length > 0) {
      result = applyChain(result, chain as Operation[])
    }

    // Post-call hook
    await options.onResult?.(method, result, ctx)

    return { id, type: 'result', result }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    await options.onError?.(method, err, ctx)

    return {
      id,
      type: 'error',
      error: {
        message: err.message,
        code: 'INTERNAL_ERROR',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
    }
  }
}

/**
 * Create HTTP batch RPC handler
 */
export function createHTTPHandler<TContext>(
  options: RPCHandlerOptions<TContext>
): MiddlewareHandler {
  const { methods, createContext, allowedOrigins = '*' } = options

  return async (c: Context) => {
    // Handle CORS
    const origin = c.req.header('origin')
    if (allowedOrigins === '*') {
      c.header('Access-Control-Allow-Origin', '*')
    } else if (origin && allowedOrigins.includes(origin)) {
      c.header('Access-Control-Allow-Origin', origin)
    }
    c.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (c.req.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    // Parse request body
    let calls: RPCMessage[]
    try {
      const body = await c.req.json()
      calls = Array.isArray(body) ? body : [body]
    } catch {
      return c.json(
        { error: { message: 'Invalid JSON', code: 'PARSE_ERROR' } },
        400
      )
    }

    // Create context
    const ctx = createContext ? await createContext(c) : ({} as TContext)

    // Process all calls
    const results = await Promise.all(
      calls.map((call) => processCall(call, methods, ctx, options))
    )

    return c.json(results)
  }
}

// =============================================================================
// WebSocket Handler
// =============================================================================

/**
 * Create WebSocket RPC handler for Hono
 *
 * Usage with hono/ws:
 * ```ts
 * import { upgradeWebSocket } from 'hono/cloudflare-workers' // or hono/bun, etc
 *
 * app.get('/rpc/ws', upgradeWebSocket(createWSHandler({ methods })))
 * ```
 */
export function createWSHandler<TContext>(options: RPCHandlerOptions<TContext>) {
  const { methods, createContext } = options

  return (c: Context) => {
    let ctx: TContext

    // Server-side callback registry for this connection
    const callbackRegistry: ServerCallbackRegistry = {
      callbacks: new Map(),
      invoke: async (id, args) => {
        const fn = callbackRegistry.callbacks.get(id)
        if (!fn) throw new Error(`Callback not found: ${id}`)
        return fn(...args)
      },
    }

    return {
      async onOpen(_evt: Event, ws: WSContext) {
        ctx = createContext ? await createContext(c) : ({} as TContext)
      },

      async onMessage(evt: MessageEvent, ws: WSContext) {
        let message: RPCMessage
        try {
          message = JSON.parse(evt.data as string)
        } catch {
          ws.send(
            JSON.stringify({
              type: 'error',
              error: { message: 'Invalid JSON', code: 'PARSE_ERROR' },
            })
          )
          return
        }

        // Handle ping
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }))
          return
        }

        // Handle callback response
        if (message.type === 'result' && message.callbackId) {
          // Client is responding to a callback we invoked
          // This would be handled by pending callback promises
          return
        }

        // Handle RPC call
        if (message.type === 'call') {
          const result = await processCall(message, methods, ctx, options)
          ws.send(JSON.stringify(result))
          return
        }

        // Handle cancel (for streaming)
        if (message.type === 'cancel') {
          // Could implement stream cancellation here
          return
        }
      },

      onClose(_evt: CloseEvent, _ws: WSContext) {
        // Cleanup callback registry
        callbackRegistry.callbacks.clear()
      },

      onError(evt: Event, _ws: WSContext) {
        console.error('WebSocket error:', evt)
      },
    }
  }
}

// =============================================================================
// postMessage Bridge
// =============================================================================

/**
 * Generate the postMessage bridge HTML/JS
 *
 * This creates a lightweight page that:
 * 1. Listens for postMessage from parent window
 * 2. Makes authenticated fetch/WS calls to the RPC endpoint
 * 3. Posts results back to parent
 */
export function createBridgeHandler<TContext>(
  options: RPCHandlerOptions<TContext> & {
    /** RPC endpoint URL (default: '/rpc') */
    rpcUrl?: string
    /** WebSocket URL (default: derived from rpcUrl) */
    wsUrl?: string
  }
): MiddlewareHandler {
  const { bridgeOrigins = [], rpcUrl = '/rpc', wsUrl } = options

  // Generate allowed origins check
  const originsCheck =
    bridgeOrigins.length === 0
      ? 'true' // Allow all in dev
      : `[${bridgeOrigins.map((o) => `'${o}'`).join(',')}].includes(event.origin)`

  const bridgeScript = `
<!DOCTYPE html>
<html>
<head>
  <title>RPC Bridge</title>
  <script>
    (function() {
      const RPC_URL = '${rpcUrl}';
      const WS_URL = ${wsUrl ? `'${wsUrl}'` : 'null'};
      const pendingRequests = new Map();
      let ws = null;
      let wsReady = false;
      let wsQueue = [];

      // Connect WebSocket if available
      function connectWS() {
        if (!WS_URL) return;

        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          wsReady = true;
          // Flush queued messages
          wsQueue.forEach(msg => ws.send(JSON.stringify(msg)));
          wsQueue = [];
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          const pending = pendingRequests.get(msg.id);
          if (pending) {
            pendingRequests.delete(msg.id);
            pending.source.postMessage({
              type: 'rpc-response',
              id: msg.id,
              result: msg.result,
              error: msg.error
            }, pending.origin);
          }
        };

        ws.onclose = () => {
          wsReady = false;
          // Reconnect after delay
          setTimeout(connectWS, 1000);
        };
      }

      // Make HTTP request
      async function httpRequest(calls, source, origin) {
        try {
          const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Include cookies!
            body: JSON.stringify(calls)
          });

          const results = await response.json();

          results.forEach(result => {
            source.postMessage({
              type: 'rpc-response',
              id: result.id,
              result: result.result,
              error: result.error
            }, origin);
          });
        } catch (error) {
          calls.forEach(call => {
            source.postMessage({
              type: 'rpc-response',
              id: call.id,
              error: { message: error.message }
            }, origin);
          });
        }
      }

      // Handle incoming messages
      window.addEventListener('message', (event) => {
        // Validate origin
        if (!(${originsCheck})) {
          console.warn('RPC Bridge: Rejected message from', event.origin);
          return;
        }

        const { type, calls, useWebSocket } = event.data;

        if (type !== 'rpc-request') return;

        // Store pending requests for response routing
        calls.forEach(call => {
          pendingRequests.set(call.id, {
            source: event.source,
            origin: event.origin
          });
        });

        // Route to WebSocket or HTTP
        if (useWebSocket && ws && wsReady) {
          calls.forEach(call => ws.send(JSON.stringify(call)));
        } else if (useWebSocket && ws) {
          // Queue for when WS is ready
          calls.forEach(call => wsQueue.push(call));
        } else {
          httpRequest(calls, event.source, event.origin);
        }
      });

      // Initialize
      connectWS();

      // Signal ready
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'rpc-bridge-ready' }, '*');
      }
    })();
  </script>
</head>
<body></body>
</html>
`

  return async (c: Context) => {
    c.header('Content-Type', 'text/html')
    // Security headers for iframe
    c.header('X-Frame-Options', 'ALLOWALL') // Allow embedding
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'unsafe-inline'; connect-src 'self' wss://*.apis.do https://*.apis.do"
    )
    return c.html(bridgeScript)
  }
}

// =============================================================================
// Unified Middleware
// =============================================================================

/**
 * Create a complete RPC middleware that handles all transports
 *
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { upgradeWebSocket } from 'hono/cloudflare-workers'
 * import { createRPCMiddleware } from 'ai-functions/rpc'
 *
 * const app = new Hono()
 *
 * const rpc = createRPCMiddleware({
 *   methods: {
 *     greet: (ctx, name) => `Hello, ${name}!`,
 *     getUser: async (ctx, id) => db.users.get(id),
 *   },
 *   createContext: (c) => ({
 *     user: c.get('user'),
 *     db: c.get('db'),
 *   }),
 *   bridgeOrigins: ['https://myapp.com', 'https://app.myapp.com'],
 * })
 *
 * // Single /rpc endpoint for both HTTP POST and WebSocket GET
 * app.post('/rpc', rpc.http)
 * app.get('/rpc', upgradeWebSocket(rpc.ws))
 *
 * // postMessage bridge HTML (embed in iframe for cross-origin auth)
 * app.get('/rpc.html', rpc.bridge)
 * ```
 */
export function createRPCMiddleware<TContext>(
  options: RPCHandlerOptions<TContext> & {
    rpcUrl?: string
    wsUrl?: string
  }
) {
  return {
    /** HTTP batch handler */
    http: createHTTPHandler(options),
    /** WebSocket handler (use with upgradeWebSocket) */
    ws: createWSHandler(options),
    /** postMessage bridge handler */
    bridge: createBridgeHandler(options),
    /** The methods for direct access */
    methods: options.methods,
  }
}

/**
 * Mount all RPC routes on a Hono app
 *
 * Single endpoint handles both HTTP POST and WebSocket upgrade:
 * - POST /rpc → HTTP batch requests
 * - GET /rpc (with Upgrade header) → WebSocket connection
 * - GET /rpc.html → postMessage bridge for iframe embedding
 *
 * @example
 * ```ts
 * import { Hono } from 'hono'
 * import { upgradeWebSocket } from 'hono/cloudflare-workers'
 * import { mountRPC } from 'ai-functions/rpc'
 *
 * const app = new Hono()
 *
 * mountRPC(app, '/rpc', {
 *   methods: { ... },
 *   upgradeWebSocket,
 * })
 * ```
 */
export function mountRPC<TContext>(
  app: Hono,
  basePath: string,
  options: RPCHandlerOptions<TContext> & {
    rpcUrl?: string
    wsUrl?: string
    /** WebSocket upgrade function from hono adapter */
    upgradeWebSocket?: (handler: ReturnType<typeof createWSHandler>) => MiddlewareHandler
  }
) {
  const rpc = createRPCMiddleware({
    ...options,
    rpcUrl: options.rpcUrl ?? basePath,
    wsUrl: options.wsUrl ?? basePath.replace(/^http/, 'ws'),
  })

  // HTTP batch (POST)
  app.post(basePath, rpc.http)

  // WebSocket upgrade (GET with Upgrade header)
  if (options.upgradeWebSocket) {
    app.get(basePath, options.upgradeWebSocket(rpc.ws))
  }

  // Bridge HTML page (for iframe embedding)
  app.get(`${basePath}.html`, rpc.bridge)

  return rpc
}
