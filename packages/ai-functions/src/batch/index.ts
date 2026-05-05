/**
 * Batch Adapters Index
 *
 * The `BatchProvider` port lives in `./provider.js`. Each adapter file is a
 * small implementation of that port for one provider. Import a specific
 * adapter to register it:
 *
 * @example
 * ```ts
 * // Import to register the OpenAI batch adapter
 * import 'ai-functions/batch/openai'
 *
 * // Import to register the Anthropic batch adapter
 * import 'ai-functions/batch/anthropic'
 *
 * // Import to register the Cloudflare adapter
 * import 'ai-functions/batch/cloudflare'
 *
 * // Import to register the AWS Bedrock adapter
 * import 'ai-functions/batch/bedrock'
 *
 * // Or import the in-memory adapter for testing
 * import 'ai-functions/batch/memory'
 * ```
 *
 * @packageDocumentation
 */

export * from './provider.js'
export * from './openai.js'
export * from './anthropic.js'
export * from './cloudflare.js'
export * from './bedrock.js'
export * from './memory.js'
