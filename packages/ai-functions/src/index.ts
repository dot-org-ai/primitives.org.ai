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
 * - Tagged template literal support for all functions
 * - Async iterator support for list/extract
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

// Export generation functions with smart model routing
export { generateObject, generateText, streamObject, streamText } from './generate.js'

// Export simplified schema helper
export { schema, type SimpleSchema } from './schema.js'

// Export providers
export * from './providers/index.js'

// Export template utilities
export {
  parseTemplate,
  createTemplateFunction,
  createChainablePromise,
  createStreamableList,
  withBatch,
  type FunctionOptions,
  type TemplateFunction,
  type BatchableFunction,
  type StreamableList,
  type ChainablePromise,
} from './template.js'

// Export AI primitives
export {
  // Core generate primitive
  generate,
  type GenerateType,
  type GenerateOptions,

  // Generative functions
  ai,
  write,
  code,
  list,
  lists,
  extract,
  summarize,
  is,
  diagram,
  slides,
  image,
  video,

  // Agentic functions
  do,
  research,

  // Web functions
  read,
  browse,

  // Decision functions
  decide,

  // Human-in-the-loop functions
  ask,
  approve,
  review,
  type HumanOptions,
  type HumanResult,
} from './primitives.js'
