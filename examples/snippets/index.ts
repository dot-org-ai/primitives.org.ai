/**
 * Examples - Reference examples for ai-functions
 *
 * This package contains runnable examples demonstrating:
 * - Basic generation (text, objects, lists)
 * - Promise pipelining and batch processing
 * - Error handling patterns (retry, fallback, circuit breaker)
 *
 * @packageDocumentation
 */

// Basic generation examples
export {
  generateTextExample,
  generateObjectExample,
  generateListExample,
  type TextGenerationOptions,
  type ObjectGenerationOptions,
  type ListGenerationOptions,
} from './basic-generation.js'

// Promise pipelining examples
export {
  promisePipeliningExample,
  batchProcessingExample,
  streamingExample,
  type PipelineResult,
  type EvaluatedIdea,
} from './promise-pipelining.js'

// Error handling examples
export {
  retryExample,
  fallbackExample,
  circuitBreakerExample,
  resetCircuitBreakers,
  type RetryExampleOptions,
  type CircuitBreakerExampleOptions,
  type CircuitBreakerResult,
} from './error-handling.js'
