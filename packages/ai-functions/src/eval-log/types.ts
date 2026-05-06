/**
 * EvalLogStore — pluggable persistence primitive for trace/eval entries.
 *
 * Forward-looking primitive matching Evalite v1's EvalLogStore pattern:
 * the in-memory default ships today; the disk/SQLite/durable backends can
 * land later without breaking the trace middleware contract.
 *
 * Used downstream by `traceMiddleware` (in `../middleware/trace.ts`) as the
 * sink for per-call prompt+response+usage records. The cascade-walker in
 * services-as-software will consume `list()` / `get()` to populate the
 * InvocationEvent stream once round 16+ adds the `'persona-trace'` variant.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A single entry in the eval log — one LLM call with its full payload.
 *
 * Shape mirrors what `traceMiddleware` emits, with optional `tags` for
 * caller-supplied dimensions (persona name, evaluator role, cascade depth).
 */
export interface EvalLogEntry {
  /** MDXLD identity — typically a UUID generated at insert time. */
  $id: string
  /**
   * Optional caller-supplied trace correlation ID. When the cascade walker
   * spans multiple LLM calls under one user request, all entries share the
   * same `traceId` so `list({ traceId })` rolls them up.
   */
  traceId?: string
  /** Model identifier (e.g. `'anthropic/claude-sonnet-4.5'` or `'sonnet'`). */
  model: string
  /**
   * Stringified prompt as submitted to the model. We don't store the
   * structured `LanguageModelV3Prompt` shape because (a) it's bulky and (b)
   * downstream consumers (replay, fixture diff) only need the text payload.
   */
  prompt: string
  /** The model's text response. Tool calls/files are not stored here. */
  response: string
  /** Token usage as reported by the AI SDK. */
  usage: {
    inputTokens: number
    outputTokens: number
  }
  /** Computed USD cost (caller-supplied via the `pricing` overlay). */
  costUsd: number
  /** Wall-clock duration of the underlying `doGenerate` / `doStream` call. */
  durationMs: number
  /** Caller-supplied dimensions (persona, evaluator role, cascade step). */
  tags?: Record<string, string>
  /** Insert timestamp (epoch ms). */
  createdAt: number
}

/**
 * Options accepted by `EvalLogStore.list`. All fields are AND-combined.
 */
export interface EvalLogListOptions {
  /** Filter to entries with this trace correlation ID. */
  traceId?: string
  /** Filter to entries for a specific model. */
  model?: string
  /**
   * Filter to entries whose `tags` are a *superset* of the supplied object.
   * (E.g. `{ persona: 'cfo' }` matches entries tagged
   * `{ persona: 'cfo', step: '3' }` but not entries tagged
   * `{ persona: 'cto' }`.)
   */
  tags?: Record<string, string>
  /** Maximum number of entries to return (most recent first). */
  limit?: number
}

/**
 * Pluggable persistence interface for eval log entries.
 *
 * Modeled after the Evalite v1 EvalLogStore contract: in-memory default,
 * disk JSON / SQLite / durable backends supplied via
 * `configureEvalLogStore`.
 *
 * All methods are async to keep the contract uniform across backends — the
 * in-memory implementation resolves synchronously under the hood.
 */
export interface EvalLogStore {
  /**
   * Persist a new entry. Returns the stored entry (with `$id` and
   * `createdAt` filled in if the caller omitted them).
   */
  record(
    entry: Omit<EvalLogEntry, '$id' | 'createdAt'> &
      Partial<Pick<EvalLogEntry, '$id' | 'createdAt'>>
  ): Promise<EvalLogEntry>
  /**
   * Read an entry by `$id`. Returns `undefined` when not found.
   */
  get(id: string): Promise<EvalLogEntry | undefined>
  /**
   * List entries matching the supplied filter. Returns most recent first.
   */
  list(options?: EvalLogListOptions): Promise<EvalLogEntry[]>
  /**
   * Delete an entry. Returns `true` if an entry was actually removed.
   */
  delete(id: string): Promise<boolean>
}
