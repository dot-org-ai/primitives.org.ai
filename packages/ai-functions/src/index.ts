/**
 * ai-functions - Core AI primitives for building intelligent applications
 *
 * This is the foundational package that all other primitives depend on.
 * It provides:
 * - RPC primitives with capnweb promise pipelining
 * - AI function types and interfaces
 * - Core AI() and ai() constructors
 * - Embedding utilities from AI SDK
 * - Cloudflare Workers AI provider (default for embeddings)
 *
 * @packageDocumentation
 */

// Re-export RPC primitives
export * from './rpc/index.js'

// Export AI function types and interfaces
export * from './types.js'
export * from './ai.js'

// Export embedding utilities
export * from './embeddings.js'

// Export providers
export * from './providers/index.js'
