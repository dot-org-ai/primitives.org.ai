/**
 * RPC primitives with unified auth
 *
 * Features:
 * - Promise pipelining (Cap'n Proto style)
 * - Multiple transports: HTTP, WebSocket, postMessage
 * - Bidirectional RPC callbacks
 * - Async iterators for streaming
 * - Unified authentication via oauth.do
 *
 * @packageDocumentation
 */

// Re-export core capnweb types - consumers import from here, not capnweb directly
export {
  newWebSocketRpcSession,
  newHttpBatchRpcSession,
  RpcTarget,
  type RpcStub,
  type RpcPromise
} from 'capnweb'

// For Cloudflare Workers server-side
export { newWorkersRpcResponse } from 'capnweb'

// Export deferred/promise pipelining
export {
  createDeferred,
  isDeferred,
  applyChain,
  createLocalContext,
  DEFERRED,
  DEFERRED_CHAIN,
  type Deferred,
  type Operation,
  type DeferredContext,
} from './deferred.js'

// Export RPC client
export {
  createRPCClient,
  type RPCClient,
  type RPCTransport,
  type RPCCall,
  type RPCResult,
  type RPCClientOptions,
} from './client.js'

// Export transports
export {
  // Types
  type Transport,
  type StreamingTransport,
  type RPCMessage,
  type OperationDescriptor,
  type ConnectionState,
  type TransportEvents,
  // HTTP
  HTTPTransport,
  createHTTPTransport,
  type HTTPTransportOptions,
  // WebSocket
  WebSocketTransport,
  createWebSocketTransport,
  type WebSocketTransportOptions,
  // postMessage
  PostMessageTransport,
  createPostMessageTransport,
  type PostMessageTransportOptions,
  // Utilities
  CallbackRegistry,
  generateMessageId,
} from './transport.js'

// Export our session utilities
export { createRPCSession, type RPCSessionOptions } from './session.js'
export { createLocalTarget, LocalTarget } from './local.js'

// Export authenticated client
export {
  createAuthenticatedClient,
  getDefaultRPCClient,
  configureRPC,
  type AuthenticatedClientOptions,
  type RPCConfig
} from './auth.js'

// Export server handlers (Hono)
export {
  createHTTPHandler,
  createWSHandler,
  createBridgeHandler,
  createRPCMiddleware,
  mountRPC,
  type RPCMethod,
  type RPCMethods,
  type RPCHandlerOptions,
} from './server.js'
