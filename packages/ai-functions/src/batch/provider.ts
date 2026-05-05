/**
 * BatchProvider Port
 *
 * Defines the explicit port (interface) that every batch provider adapter must
 * satisfy, plus helpers that concentrate logic genuinely shared across adapters
 * (polling, concurrent processing, in-memory job tracking, JSON-Schema conversion).
 *
 * Each provider file (`anthropic.ts`, `openai.ts`, `google.ts`, `bedrock.ts`,
 * `cloudflare.ts`, `memory.ts`) is now a small adapter that satisfies this port
 * and concentrates on provider-specific HTTP/SDK calls and request/response shapes.
 *
 * Port + 4 adapters = real seam. The port lives here so provider files don't
 * import shared logic from each other and can't accidentally diverge.
 *
 * @packageDocumentation
 */

import type {
  BatchAdapter,
  BatchItem,
  BatchJob,
  BatchQueueOptions,
  BatchResult,
  BatchStatus,
} from '../batch-queue.js'

// Re-export the port and its types so adapters can import everything from
// `./provider.js` rather than reaching into `../batch-queue.js`.
export type {
  BatchAdapter,
  BatchItem,
  BatchJob,
  BatchQueueOptions,
  BatchResult,
  BatchSubmitResult,
  BatchProvider,
  BatchStatus,
  FlexAdapter,
} from '../batch-queue.js'

export { registerBatchAdapter, registerFlexAdapter } from '../batch-queue.js'

// ============================================================================
// Polling helper (shared by all adapters that have async batch jobs)
// ============================================================================

/** Terminal states for a batch job — polling stops here. */
const TERMINAL_STATUSES: ReadonlySet<BatchStatus> = new Set([
  'completed',
  'failed',
  'cancelled',
  'expired',
])

/** Statuses that should trigger result fetch. */
const RESULT_STATUSES: ReadonlySet<BatchStatus> = new Set(['completed', 'cancelled', 'failed'])

/**
 * Default `waitForCompletion` implementation built on top of `getStatus` +
 * `getResults`. Adapters with non-standard completion semantics can still
 * override `waitForCompletion`, but most don't need to.
 *
 * @param adapter   The batch adapter to poll
 * @param batchId   The batch id to poll
 * @param options.pollInterval  Poll interval in ms (default: 5000)
 * @param options.fetchResultsOn  Statuses for which results should be fetched.
 *                                Defaults to `completed`, `cancelled`, `failed`.
 * @param options.throwOn  Statuses that should throw rather than fetch results.
 *                         Useful for OpenAI which throws on `cancelled`/`expired`.
 */
export async function pollUntilComplete(
  adapter: Pick<BatchAdapter, 'getStatus' | 'getResults'>,
  batchId: string,
  options: {
    pollInterval?: number
    fetchResultsOn?: ReadonlySet<BatchStatus>
    throwOn?: ReadonlySet<BatchStatus>
  } = {}
): Promise<BatchResult[]> {
  const pollInterval = options.pollInterval ?? 5000
  const fetchResultsOn = options.fetchResultsOn ?? RESULT_STATUSES
  const throwOn = options.throwOn

  while (true) {
    const status = await adapter.getStatus(batchId)

    if (throwOn?.has(status.status)) {
      throw new Error(`Batch ${status.status}`)
    }

    if (fetchResultsOn.has(status.status) || TERMINAL_STATUSES.has(status.status)) {
      return adapter.getResults(batchId)
    }

    await sleep(pollInterval)
  }
}

// ============================================================================
// Concurrent processing helper (shared by flex adapters and "local" providers)
// ============================================================================

/**
 * Run `processItem` over `items` with bounded concurrency, optionally
 * sleeping between waves to respect provider rate limits. Per-item failures
 * are caught and emitted as `{ status: 'failed', error }` results so a single
 * bad item never poisons the whole batch.
 *
 * Used by flex adapters (OpenAI, Google, Bedrock) and by the "local" providers
 * (Google, Bedrock, Cloudflare) that fake batch processing with concurrent
 * direct API calls.
 */
export async function processConcurrently(
  items: BatchItem[],
  processItem: (item: BatchItem) => Promise<BatchResult>,
  options: {
    concurrency?: number
    delayBetweenWaves?: number
    onWaveComplete?: (results: BatchResult[]) => void
  } = {}
): Promise<BatchResult[]> {
  const concurrency = options.concurrency ?? 10
  const delay = options.delayBetweenWaves ?? 0
  const results: BatchResult[] = []

  for (let i = 0; i < items.length; i += concurrency) {
    const wave = items.slice(i, i + concurrency)

    const waveResults = await Promise.all(
      wave.map(async (item) => {
        try {
          return await processItem(item)
        } catch (error) {
          return failedResult(item, error)
        }
      })
    )

    results.push(...waveResults)
    options.onWaveComplete?.(results)

    if (delay > 0 && i + concurrency < items.length) {
      await sleep(delay)
    }
  }

  return results
}

/** Build a `failed` BatchResult from an unknown thrown value. */
export function failedResult(item: BatchItem, error: unknown): BatchResult {
  return {
    id: item.id,
    customId: item.id,
    status: 'failed',
    error: error instanceof Error ? error.message : 'Unknown error',
  }
}

// ============================================================================
// LocalJobStore — in-memory job tracking shared by google/bedrock/cloudflare
// ============================================================================

/**
 * Internal job state for adapters that don't have a real provider-side batch
 * API and need to track jobs locally (Google, Bedrock, Cloudflare).
 */
export interface LocalJobState {
  items: BatchItem[]
  options: BatchQueueOptions
  results: BatchResult[]
  status: BatchStatus
  createdAt: Date
  completedAt?: Date
  /** Optional adapter-specific metadata (e.g. Bedrock's jobArn) */
  meta?: Record<string, unknown>
}

/**
 * Per-provider in-memory job registry. Encapsulates the
 * `Map<jobId, state>` + counter + status/result lookup pattern that
 * google/bedrock/cloudflare were each duplicating.
 */
export class LocalJobStore {
  private readonly jobs = new Map<string, LocalJobState>()
  private counter = 0

  constructor(private readonly idPrefix: string) {}

  create(items: BatchItem[], options: BatchQueueOptions): { id: string; state: LocalJobState } {
    const id = `${this.idPrefix}_${++this.counter}_${Date.now()}`
    const state: LocalJobState = {
      items,
      options,
      results: [],
      status: 'pending',
      createdAt: new Date(),
    }
    this.jobs.set(id, state)
    return { id, state }
  }

  get(id: string): LocalJobState {
    const state = this.jobs.get(id)
    if (!state) {
      throw new Error(`Batch not found: ${id}`)
    }
    return state
  }

  has(id: string): boolean {
    return this.jobs.has(id)
  }

  /** Build a `BatchJob` snapshot for a tracked job. */
  snapshot(id: string, provider: BatchJob['provider']): BatchJob {
    const state = this.get(id)
    const completedItems = state.results.filter((r) => r.status === 'completed').length
    const failedItems = state.results.filter((r) => r.status === 'failed').length

    return {
      id,
      provider,
      status: state.status,
      totalItems: state.items.length,
      completedItems,
      failedItems,
      createdAt: state.createdAt,
      ...(state.completedAt && { completedAt: state.completedAt }),
    }
  }

  /**
   * Wait for a tracked job to reach a terminal status by polling its in-memory
   * state. Adapters that drive the state machine in a background promise can
   * call this from `waitForCompletion`.
   */
  async waitForCompletion(id: string, pollInterval = 1000): Promise<BatchResult[]> {
    const state = this.get(id)
    while (
      state.status !== 'completed' &&
      state.status !== 'failed' &&
      state.status !== 'cancelled'
    ) {
      await sleep(pollInterval)
    }
    return state.results
  }

  /** For tests: drop everything. */
  clear(): void {
    this.jobs.clear()
    this.counter = 0
  }
}

// ============================================================================
// JSON-Schema conversion (used by Anthropic + OpenAI adapters)
// ============================================================================

/** Zod schema definition structure for type introspection. */
interface ZodDef {
  typeName?: string
  type?: unknown
  shape?: () => Record<string, unknown>
}

/** Zod schema with `_def` property for introspection. */
interface ZodSchemaLike {
  _def?: ZodDef
}

/**
 * Minimal Zod -> JSON Schema converter.
 *
 * This is the same simplified converter that previously lived (duplicated)
 * inside `anthropic.ts` and `openai.ts`. Extracted here so both adapters call
 * the same implementation. For richer conversion use `zod-to-json-schema`.
 */
export function zodToJsonSchema(zodSchema: unknown): Record<string, unknown> {
  const schema = zodSchema as ZodSchemaLike

  if (!schema._def) {
    return { type: 'object' }
  }

  switch (schema._def.typeName) {
    case 'ZodString':
      return { type: 'string' }
    case 'ZodNumber':
      return { type: 'number' }
    case 'ZodBoolean':
      return { type: 'boolean' }
    case 'ZodArray':
      return { type: 'array', items: zodToJsonSchema(schema._def.type) }
    case 'ZodObject': {
      const shape = schema._def.shape?.() ?? {}
      const properties: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value)
      }
      return { type: 'object', properties, required: Object.keys(properties) }
    }
    default:
      return { type: 'object' }
  }
}

// ============================================================================
// JSON parsing (used by every adapter that returns raw text)
// ============================================================================

/**
 * Try to parse `text` as JSON when it looks like JSON or a schema is expected,
 * otherwise return the text unchanged. Never throws.
 */
export function tryParseJson(text: string | undefined, expectJson = false): unknown {
  if (!text) return text
  const trimmed = text.trim()
  const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[')
  if (!expectJson && !looksLikeJson) return text
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ============================================================================
// Misc
// ============================================================================

/** Promise-based setTimeout. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
