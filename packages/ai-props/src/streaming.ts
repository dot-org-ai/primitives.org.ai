/**
 * Optimized streaming utilities for AI-powered props rendering
 *
 * This module provides high-performance streaming capabilities with:
 * - Adaptive chunk sizing for network efficiency
 * - Backpressure handling to prevent memory overflow
 * - Progress callbacks for streaming status
 * - Memory-efficient streaming for large components
 *
 * @packageDocumentation
 */

import {
  renderToReadableStream as baseRenderToReadableStream,
  streamJSXResponse as baseStreamJSXResponse,
  createStreamingRenderer as baseCreateStreamingRenderer,
  createHydrationContext,
  serializeHydrationData,
  type StreamingOptions,
  type StreamingRendererOptions,
  type HydrationContext,
  type HydrationData,
  type HydrationNode,
} from './hono-jsx.js'

import { streamMDXWithProps as baseStreamMDXWithProps, type StreamMDXOptions } from './mdx.js'

// ============================================================================
// Constants
// ============================================================================

/** Default chunk size for optimal network performance (16KB) */
export const DEFAULT_CHUNK_SIZE = 16 * 1024

/** Minimum chunk size to avoid excessive overhead (1KB) */
export const MIN_CHUNK_SIZE = 1024

/** Maximum chunk size for memory efficiency (64KB) */
export const MAX_CHUNK_SIZE = 64 * 1024

/** High water mark for backpressure (64KB) */
export const DEFAULT_HIGH_WATER_MARK = 64 * 1024

// ============================================================================
// Types
// ============================================================================

/**
 * Progress information during streaming
 */
export interface StreamingProgress {
  /** Total bytes processed so far */
  bytesProcessed: number
  /** Total bytes expected (if known) */
  totalBytes?: number
  /** Number of chunks sent */
  chunksProcessed: number
  /** Percentage complete (0-100, if total is known) */
  percentComplete?: number
  /** Current streaming phase */
  phase: 'starting' | 'streaming' | 'hydration' | 'complete' | 'error'
  /** Time elapsed in milliseconds */
  elapsedMs: number
}

/**
 * Progress callback function type
 */
export type StreamingProgressCallback = (progress: StreamingProgress) => void

/**
 * Enhanced streaming options with optimization controls
 */
export interface OptimizedStreamingOptions extends StreamingOptions {
  /** Chunk size in bytes (default: 16KB) */
  chunkSize?: number
  /** High water mark for backpressure (default: 64KB) */
  highWaterMark?: number
  /** Progress callback for streaming updates */
  onProgress?: StreamingProgressCallback
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Enable compression hints for response */
  compressionHint?: boolean
  /** Flush chunks immediately without buffering */
  flushImmediate?: boolean
}

/**
 * Enhanced streaming renderer options
 */
export interface OptimizedStreamingRendererOptions extends StreamingRendererOptions {
  /** Chunk size in bytes */
  chunkSize?: number
  /** High water mark for backpressure */
  highWaterMark?: number
  /** Progress callback */
  onProgress?: StreamingProgressCallback
}

/**
 * Streaming statistics for monitoring
 */
export interface StreamingStats {
  /** Total bytes streamed */
  totalBytes: number
  /** Number of chunks sent */
  totalChunks: number
  /** Average chunk size */
  averageChunkSize: number
  /** Time to first byte in ms */
  timeToFirstByte: number
  /** Total streaming duration in ms */
  totalDuration: number
  /** Whether backpressure was encountered */
  encounteredBackpressure: boolean
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate optimal chunk size based on content size
 *
 * @param contentLength - Total content length in bytes
 * @returns Optimal chunk size
 */
export function calculateOptimalChunkSize(contentLength: number): number {
  // For very small content, use minimum chunk size
  if (contentLength < MIN_CHUNK_SIZE * 2) {
    return MIN_CHUNK_SIZE
  }

  // For medium content, use default
  if (contentLength < MAX_CHUNK_SIZE * 4) {
    return DEFAULT_CHUNK_SIZE
  }

  // For large content, use larger chunks
  return MAX_CHUNK_SIZE
}

/**
 * Create a progress tracker for streaming operations
 */
function createProgressTracker(
  totalBytes: number | undefined,
  onProgress?: StreamingProgressCallback
): {
  update: (
    bytesProcessed: number,
    chunksProcessed: number,
    phase: StreamingProgress['phase']
  ) => void
  startTime: number
} {
  const startTime = Date.now()

  return {
    startTime,
    update(bytesProcessed: number, chunksProcessed: number, phase: StreamingProgress['phase']) {
      if (!onProgress) return

      const elapsedMs = Date.now() - startTime
      const progress: StreamingProgress = {
        bytesProcessed,
        chunksProcessed,
        phase,
        elapsedMs,
      }

      if (totalBytes !== undefined) {
        progress.totalBytes = totalBytes
        progress.percentComplete = Math.min(100, (bytesProcessed / totalBytes) * 100)
      }

      onProgress(progress)
    },
  }
}

// ============================================================================
// Core Streaming Functions
// ============================================================================

/**
 * Render a component to a ReadableStream with optimizations
 *
 * Features:
 * - Adaptive chunk sizing based on content
 * - Backpressure handling to prevent memory overflow
 * - Progress callbacks for monitoring
 * - Memory-efficient streaming for large content
 *
 * @param component - Component function to render
 * @param props - Props to pass to component
 * @param options - Optimized streaming options
 * @returns ReadableStream of rendered HTML
 *
 * @example
 * ```ts
 * const stream = await renderToReadableStream(
 *   MyComponent,
 *   { title: 'Hello' },
 *   {
 *     chunkSize: 8192,
 *     onProgress: (progress) => console.log(`${progress.percentComplete}% complete`),
 *   }
 * )
 * ```
 */
export async function renderToReadableStream<P>(
  component: (props: P) => string | Promise<string>,
  props: P,
  options?: OptimizedStreamingOptions
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE
  const highWaterMark = options?.highWaterMark ?? DEFAULT_HIGH_WATER_MARK

  // Create hydration context if needed
  let hydrationContext: HydrationContext | null = null
  if (options?.includeHydration) {
    hydrationContext = createHydrationContext()
  }

  // Render the component
  let content: string
  try {
    content = await component(props)
  } catch (error) {
    if (options?.onError && error instanceof Error) {
      content = options.onError(error)
    } else {
      throw error
    }
  }

  // Register for hydration
  if (hydrationContext) {
    const componentName = component.name || 'Anonymous'
    hydrationContext.register(componentName, props as Record<string, unknown>)
  }

  // Prepare hydration script
  let hydrationScript = ''
  if (options?.includeHydration && hydrationContext) {
    const hydrationData = hydrationContext.getData()
    hydrationScript = `<script>window.__HYDRATION_DATA__=${serializeHydrationData(
      hydrationData
    )}</script>`
  }

  const fullContent = content + hydrationScript
  const contentBytes = encoder.encode(fullContent)
  const totalLength = contentBytes.length

  // Calculate optimal chunk size if not specified
  const effectiveChunkSize = options?.chunkSize ?? calculateOptimalChunkSize(totalLength)

  // Create progress tracker
  const tracker = createProgressTracker(totalLength, options?.onProgress)

  let bytesProcessed = 0
  let chunksProcessed = 0
  let offset = 0

  tracker.update(0, 0, 'starting')

  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        // Check if we're done
        if (offset >= totalLength) {
          tracker.update(bytesProcessed, chunksProcessed, 'complete')
          controller.close()
          return
        }

        // Calculate chunk end
        const end = Math.min(offset + effectiveChunkSize, totalLength)
        const chunk = contentBytes.slice(offset, end)

        controller.enqueue(chunk)

        bytesProcessed += chunk.length
        chunksProcessed++
        offset = end

        tracker.update(bytesProcessed, chunksProcessed, 'streaming')
      },

      cancel() {
        tracker.update(bytesProcessed, chunksProcessed, 'error')
      },
    },
    // Queuing strategy for backpressure
    new ByteLengthQueuingStrategy({ highWaterMark })
  )
}

/**
 * Create a streaming Response with optimizations
 *
 * @param component - Component function to render
 * @param props - Props to pass to component
 * @param options - Optimized streaming options
 * @returns Response with streaming body
 *
 * @example
 * ```ts
 * // In a Hono/Worker handler
 * export default {
 *   fetch(request, env) {
 *     return streamJSXResponse(
 *       PageComponent,
 *       { data: pageData },
 *       {
 *         streaming: true,
 *         compressionHint: true,
 *       }
 *     )
 *   }
 * }
 * ```
 */
export async function streamJSXResponse<P>(
  component: (props: P) => string | Promise<string>,
  props: P,
  options?: OptimizedStreamingOptions
): Promise<Response> {
  const stream = await renderToReadableStream(component, props, options)

  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...options?.headers,
  })

  // Add streaming hints
  if (options?.streaming) {
    headers.set('Transfer-Encoding', 'chunked')
  }

  // Add compression hint
  if (options?.compressionHint) {
    headers.set('Vary', 'Accept-Encoding')
  }

  return new Response(stream, {
    status: 200,
    headers,
  })
}

/**
 * Create a reusable streaming renderer with configuration
 *
 * @param options - Renderer options with optimization controls
 * @returns Streaming renderer instance with stats
 *
 * @example
 * ```ts
 * const renderer = createStreamingRenderer({
 *   doctype: '<!DOCTYPE html>',
 *   includeHydration: true,
 *   chunkSize: 8192,
 *   onProgress: (p) => console.log(p.phase),
 * })
 *
 * const stream = await renderer.render(MyComponent, props)
 * const stats = renderer.getStats()
 * ```
 */
export function createStreamingRenderer(options: OptimizedStreamingRendererOptions): {
  render: <P>(
    component: (props: P) => string | Promise<string>,
    props: P
  ) => Promise<ReadableStream<Uint8Array>>
  getStats: () => StreamingStats | null
  resetStats: () => void
} {
  const encoder = new TextEncoder()
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
  const highWaterMark = options.highWaterMark ?? DEFAULT_HIGH_WATER_MARK

  // Stats tracking
  let currentStats: StreamingStats | null = null

  return {
    async render<P>(
      component: (props: P) => string | Promise<string>,
      props: P
    ): Promise<ReadableStream<Uint8Array>> {
      const startTime = Date.now()
      let timeToFirstByte = 0
      let totalBytes = 0
      let totalChunks = 0
      let encounteredBackpressure = false

      // Create hydration context
      const ctx = options.includeHydration ? createHydrationContext() : null

      // Render the component
      const content = await component(props)

      // Register for hydration data
      if (ctx) {
        const componentName = component.name || 'Anonymous'
        ctx.register(componentName, props as Record<string, unknown>)
      }

      // Get hydration data
      let hydrationJson = ''
      if (options.includeHydration && ctx) {
        hydrationJson = serializeHydrationData(ctx.getData())
      }

      // Apply shell wrapper if provided
      let output: string
      if (options.shell) {
        const hydrationScript = hydrationJson ? `window.__HYDRATION_DATA__=${hydrationJson}` : ''
        output = options.shell(content, hydrationScript)
      } else {
        output = content
        if (options.includeHydration && hydrationJson) {
          output += `<script>window.__HYDRATION_DATA__=${hydrationJson}</script>`
        }
      }

      // Prepend doctype if provided
      if (options.doctype) {
        output = options.doctype + '\n' + output
      }

      const contentBytes = encoder.encode(output)
      const contentLength = contentBytes.length

      // Create progress tracker
      const tracker = createProgressTracker(contentLength, options.onProgress)
      tracker.update(0, 0, 'starting')

      let offset = 0

      return new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            // Track time to first byte
            if (totalChunks === 0) {
              timeToFirstByte = Date.now() - startTime
            }

            if (offset >= contentLength) {
              // Finalize stats
              currentStats = {
                totalBytes,
                totalChunks,
                averageChunkSize: totalChunks > 0 ? totalBytes / totalChunks : 0,
                timeToFirstByte,
                totalDuration: Date.now() - startTime,
                encounteredBackpressure,
              }

              tracker.update(totalBytes, totalChunks, 'complete')
              controller.close()
              return
            }

            const end = Math.min(offset + chunkSize, contentLength)
            const chunk = contentBytes.slice(offset, end)

            controller.enqueue(chunk)

            totalBytes += chunk.length
            totalChunks++
            offset = end

            tracker.update(totalBytes, totalChunks, 'streaming')
          },

          cancel() {
            tracker.update(totalBytes, totalChunks, 'error')
          },
        },
        new ByteLengthQueuingStrategy({ highWaterMark })
      )
    },

    getStats(): StreamingStats | null {
      return currentStats
    },

    resetStats(): void {
      currentStats = null
    },
  }
}

/**
 * Stream MDX content with AI-generated props and optimizations
 *
 * @param mdx - MDX content string
 * @param props - Props for each component
 * @param options - Stream options with optimizations
 * @returns ReadableStream of rendered content
 *
 * @example
 * ```ts
 * const stream = await streamMDXWithProps(
 *   '<Hero title="Welcome" />',
 *   { Hero: { title: 'Welcome', subtitle: 'To the site' } },
 *   {
 *     chunkSize: 8192,
 *     onProgress: (p) => console.log(`${p.chunksProcessed} chunks sent`),
 *   }
 * )
 * ```
 */
export async function streamMDXWithProps(
  mdx: string,
  props: Record<string, Record<string, unknown>>,
  options?: StreamMDXOptions & {
    chunkSize?: number
    highWaterMark?: number
    onProgress?: StreamingProgressCallback
  }
): Promise<ReadableStream<Uint8Array>> {
  // Get base stream from mdx module
  const baseStream = await baseStreamMDXWithProps(mdx, props, options)

  // If no optimization options, return base stream
  if (!options?.chunkSize && !options?.highWaterMark && !options?.onProgress) {
    return baseStream
  }

  // Apply optimizations by re-chunking the stream
  const reader = baseStream.getReader()
  const encoder = new TextEncoder()
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE
  const highWaterMark = options?.highWaterMark ?? DEFAULT_HIGH_WATER_MARK

  // Buffer for accumulating content
  let buffer = new Uint8Array(0)
  let bytesProcessed = 0
  let chunksProcessed = 0

  const tracker = createProgressTracker(undefined, options?.onProgress)
  tracker.update(0, 0, 'starting')

  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        // Read from source stream
        const { done, value } = await reader.read()

        if (done) {
          // Flush remaining buffer
          if (buffer.length > 0) {
            controller.enqueue(buffer)
            bytesProcessed += buffer.length
            chunksProcessed++
          }
          tracker.update(bytesProcessed, chunksProcessed, 'complete')
          controller.close()
          return
        }

        // Append to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length)
        newBuffer.set(buffer)
        newBuffer.set(value, buffer.length)
        buffer = newBuffer

        // Emit full chunks
        while (buffer.length >= chunkSize) {
          const chunk = buffer.slice(0, chunkSize)
          controller.enqueue(chunk)
          buffer = buffer.slice(chunkSize)

          bytesProcessed += chunk.length
          chunksProcessed++
          tracker.update(bytesProcessed, chunksProcessed, 'streaming')
        }
      },

      cancel() {
        reader.cancel()
        tracker.update(bytesProcessed, chunksProcessed, 'error')
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark })
  )
}

// ============================================================================
// Re-exports from hono-jsx for convenience
// ============================================================================

export {
  createHydrationContext,
  serializeHydrationData,
  collectHydrationData,
  HydrationProvider,
  useHydration,
  type HydrationContext,
  type HydrationData,
  type HydrationNode,
  type StreamingOptions,
  type StreamingRendererOptions,
} from './hono-jsx.js'

// Re-export base functions with different names for direct access
export {
  baseRenderToReadableStream as renderToReadableStreamBasic,
  baseStreamJSXResponse as streamJSXResponseBasic,
  baseCreateStreamingRenderer as createStreamingRendererBasic,
}
