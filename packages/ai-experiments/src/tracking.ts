/**
 * Event tracking for experiments
 */

import type { TrackingEvent, TrackingBackend, TrackingOptions } from './types.js'

/**
 * Default tracking configuration
 */
let trackingConfig: Required<TrackingOptions> = {
  backend: createConsoleBackend(),
  enabled: true,
  metadata: {},
}

/**
 * Configure tracking
 *
 * @example
 * ```ts
 * import { configureTracking } from 'ai-experiments'
 *
 * // Use console backend (default)
 * configureTracking({
 *   enabled: true,
 *   metadata: { projectId: 'my-project' },
 * })
 *
 * // Use custom backend
 * configureTracking({
 *   backend: {
 *     track: async (event) => {
 *       await fetch('/api/analytics', {
 *         method: 'POST',
 *         body: JSON.stringify(event),
 *       })
 *     },
 *   },
 * })
 *
 * // Disable tracking
 * configureTracking({ enabled: false })
 * ```
 */
export function configureTracking(options: TrackingOptions): void {
  trackingConfig = {
    backend: options.backend ?? trackingConfig.backend,
    enabled: options.enabled ?? trackingConfig.enabled,
    metadata: options.metadata ?? trackingConfig.metadata,
  }
}

/**
 * Track an event
 *
 * @example
 * ```ts
 * import { track } from 'ai-experiments'
 *
 * track({
 *   type: 'experiment.start',
 *   timestamp: new Date(),
 *   data: {
 *     experimentId: 'my-experiment',
 *     variantCount: 3,
 *   },
 * })
 * ```
 */
export function track(event: TrackingEvent): void {
  if (!trackingConfig.enabled) {
    return
  }

  // Merge global metadata
  const enrichedEvent: TrackingEvent = {
    ...event,
    data: {
      ...event.data,
      ...trackingConfig.metadata,
    },
  }

  // Track via backend (handle both sync and async)
  const result = trackingConfig.backend.track(enrichedEvent)
  if (result instanceof Promise) {
    // Don't await - fire and forget
    result.catch((error) => {
      console.error('Error tracking event:', error)
    })
  }
}

/**
 * Flush pending events
 *
 * Call this before the process exits to ensure all events are sent.
 *
 * @example
 * ```ts
 * import { flush } from 'ai-experiments'
 *
 * process.on('SIGINT', async () => {
 *   await flush()
 *   process.exit(0)
 * })
 * ```
 */
export async function flush(): Promise<void> {
  if (trackingConfig.backend.flush) {
    await trackingConfig.backend.flush()
  }
}

/**
 * Create a console-based tracking backend
 *
 * Logs events to console.log in a human-readable format.
 */
export function createConsoleBackend(options?: {
  /** Whether to include full event data (default: false) */
  verbose?: boolean
}): TrackingBackend {
  const { verbose = false } = options ?? {}

  return {
    track: (event: TrackingEvent) => {
      const timestamp = event.timestamp.toISOString()

      if (verbose) {
        console.log(`[${timestamp}] ${event.type}`, event.data)
      } else {
        // Condensed format
        const key = extractKey(event)
        console.log(`[${timestamp}] ${event.type} ${key}`)
      }
    },
  }
}

/**
 * Create an in-memory tracking backend that stores events
 *
 * Useful for testing or collecting events for batch processing.
 *
 * @example
 * ```ts
 * import { createMemoryBackend } from 'ai-experiments'
 *
 * const backend = createMemoryBackend()
 * configureTracking({ backend })
 *
 * // Run experiments...
 *
 * // Get all events
 * const events = backend.getEvents()
 * console.log(`Tracked ${events.length} events`)
 *
 * // Clear events
 * backend.clear()
 * ```
 */
export function createMemoryBackend(): TrackingBackend & {
  getEvents: () => TrackingEvent[]
  clear: () => void
} {
  const events: TrackingEvent[] = []

  return {
    track: (event: TrackingEvent) => {
      events.push(event)
    },
    getEvents: () => [...events],
    clear: () => {
      events.length = 0
    },
  }
}

/**
 * Create a batching tracking backend
 *
 * Batches events and sends them in groups to reduce network overhead.
 *
 * @example
 * ```ts
 * import { createBatchBackend } from 'ai-experiments'
 *
 * const backend = createBatchBackend({
 *   batchSize: 10,
 *   flushInterval: 5000, // 5 seconds
 *   send: async (events) => {
 *     await fetch('/api/analytics/batch', {
 *       method: 'POST',
 *       body: JSON.stringify({ events }),
 *     })
 *   },
 * })
 *
 * configureTracking({ backend })
 * ```
 */
export function createBatchBackend(options: {
  /** Maximum batch size before auto-flush */
  batchSize: number
  /** Interval in ms to auto-flush (default: no auto-flush) */
  flushInterval?: number
  /** Function to send batched events */
  send: (events: TrackingEvent[]) => Promise<void>
}): TrackingBackend {
  const { batchSize, flushInterval, send } = options
  const batch: TrackingEvent[] = []
  let flushTimer: NodeJS.Timeout | null = null

  const flush = async () => {
    if (batch.length === 0) return

    const eventsToSend = [...batch]
    batch.length = 0

    try {
      await send(eventsToSend)
    } catch (error) {
      console.error('Error sending batch:', error)
      // Re-add failed events to batch (simple retry strategy)
      batch.unshift(...eventsToSend)
    }
  }

  const scheduleFlush = () => {
    if (flushTimer) {
      clearTimeout(flushTimer)
    }
    if (flushInterval) {
      flushTimer = setTimeout(() => {
        flush().catch(console.error)
      }, flushInterval)
    }
  }

  return {
    track: (event: TrackingEvent) => {
      batch.push(event)

      // Auto-flush if batch is full
      if (batch.length >= batchSize) {
        flush().catch(console.error)
      } else {
        scheduleFlush()
      }
    },
    flush: async () => {
      if (flushTimer) {
        clearTimeout(flushTimer)
        flushTimer = null
      }
      await flush()
    },
  }
}

/**
 * Create a file-based tracking backend
 *
 * Writes events to a file (JSONL format).
 *
 * @example
 * ```ts
 * import { createFileBackend } from 'ai-experiments'
 *
 * const backend = createFileBackend({
 *   path: './experiments.jsonl',
 * })
 *
 * configureTracking({ backend })
 * ```
 */
export function createFileBackend(options: {
  /** Path to the file */
  path: string
}): TrackingBackend {
  // Note: This requires Node.js fs module
  // Import dynamically to avoid breaking in non-Node environments
  let fs: typeof import('fs') | null = null
  let writeStream: ReturnType<typeof import('fs').createWriteStream> | null = null

  const ensureStream = async () => {
    if (!writeStream) {
      try {
        fs = await import('fs')
        writeStream = fs.createWriteStream(options.path, { flags: 'a' })
      } catch (error) {
        console.error('Failed to create file stream:', error)
        throw error
      }
    }
    return writeStream
  }

  return {
    track: async (event: TrackingEvent) => {
      try {
        const stream = await ensureStream()
        const line = JSON.stringify(event) + '\n'
        stream.write(line)
      } catch (error) {
        console.error('Failed to write event to file:', error)
      }
    },
    flush: async () => {
      if (writeStream) {
        return new Promise<void>((resolve, reject) => {
          writeStream!.end((error?: Error) => {
            if (error) reject(error)
            else resolve()
          })
        })
      }
    },
  }
}

/**
 * Extract a key identifier from event data for logging
 */
function extractKey(event: TrackingEvent): string {
  const data = event.data
  if ('experimentId' in data) return `exp=${data.experimentId}`
  if ('variantId' in data) return `variant=${data.variantId}`
  if ('runId' in data) return `run=${data.runId}`
  return ''
}

/**
 * Get current tracking configuration
 */
export function getTrackingConfig(): Readonly<Required<TrackingOptions>> {
  return { ...trackingConfig }
}
