/**
 * traceMiddleware — emit per-call trace events for `wrapLanguageModel`
 *
 * Wraps `doGenerate` / `doStream` and emits a {@link TraceEvent} on every
 * completion. The sink is opaque (caller supplies `emit`) so this primitive
 * works equally well piping into:
 *
 *   - the v3 cascade-walker InvocationEvent stream (round 16+ work to add
 *     `'persona-trace'` / `'cascade-trace'` to the union),
 *   - an {@link import('../eval-log/index.js').EvalLogStore} for fixture
 *     replay,
 *   - OpenTelemetry / Datadog / Honeycomb adapters that map the event into
 *     a span.
 *
 * **Emit-error tolerance:** if the supplied `emit` throws, we *swallow* the
 * error (with a one-time `console.warn`) so a flaky trace sink can never
 * break the wrapped LLM call. This matches the Evalite v0.19 trace
 * middleware behaviour.
 *
 * Composition note: install **last** so the event sees the final outcome
 * (post-cache, post-budget). The event's `costUsd` field is best-effort —
 * the trace middleware doesn't have direct access to the budget tracker, so
 * the caller can pass a `getCostUsd` resolver if they want costs in the
 * event payload.
 *
 * @packageDocumentation
 */

import type {
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
  LanguageModelV3Usage,
} from '@ai-sdk/provider'

// ============================================================================
// Types
// ============================================================================

/**
 * Discriminator for the originating call site. Callers inject this via the
 * `kind` option so a single sink can fan events into different downstream
 * streams (persona panel vs. cascade walker vs. ad-hoc test).
 */
export type TraceEventKind = 'persona-trace' | 'cascade-trace' | 'eval-trace' | string

/**
 * Trace event payload emitted on every wrapped call completion.
 *
 * Field design notes:
 *   - `prompt` / `response` are stringified for cheap downstream storage
 *     (the structured `LanguageModelV3Prompt` / `LanguageModelV3Content[]`
 *     shapes are intentionally flattened).
 *   - `usage` is the raw V3 shape (with the cache breakdown) — the
 *     EvalLogStore consumer flattens it into total counts.
 *   - `costUsd` is optional because the trace middleware doesn't compute
 *     cost itself; callers either pass a resolver or compute downstream
 *     from `usage`.
 */
export interface TraceEvent {
  kind: TraceEventKind
  model: string
  prompt: string
  response: string
  usage: LanguageModelV3Usage | undefined
  costUsd?: number
  durationMs: number
  /** Optional caller-supplied tags for downstream filtering. */
  tags?: Record<string, string>
}

/** Options for {@link traceMiddleware}. */
export interface TraceMiddlewareOptions {
  /**
   * Opaque sink. Errors thrown from `emit` are swallowed (with a one-time
   * `console.warn`) so a flaky sink never breaks the wrapped LLM call.
   */
  emit: (event: TraceEvent) => void | Promise<void>
  /**
   * Discriminator threaded into the event's `kind` field. Defaults to
   * `'eval-trace'`.
   */
  kind?: TraceEventKind
  /**
   * Optional cost resolver. When supplied, called with the V3 usage shape
   * and the modelId; result is set on `event.costUsd`. Useful when the
   * caller has a side-channel pricing table (the budgetMiddleware's
   * tracker) and wants costs in the trace event itself.
   */
  getCostUsd?: (modelId: string, usage: LanguageModelV3Usage | undefined) => number
  /** Optional caller-supplied tags merged into every emitted event. */
  tags?: Record<string, string>
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Flatten the structured V3 prompt into a single string for cheap storage.
 * Walks system / user / assistant / tool messages and concatenates their
 * text parts. Non-text parts (files, tool results) are summarised with a
 * short marker so the trace doesn't grow unboundedly.
 */
function stringifyPrompt(params: LanguageModelV3CallOptions): string {
  const out: string[] = []
  for (const msg of params.prompt) {
    if (msg.role === 'system') {
      out.push(`[system] ${msg.content}`)
      continue
    }
    if (typeof msg.content === 'string') {
      out.push(`[${msg.role}] ${msg.content}`)
      continue
    }
    if (Array.isArray(msg.content)) {
      const parts: string[] = []
      for (const part of msg.content) {
        if (part.type === 'text') parts.push(part.text)
        else parts.push(`[${part.type}]`)
      }
      out.push(`[${msg.role}] ${parts.join(' ')}`)
    }
  }
  return out.join('\n')
}

/**
 * Flatten the V3 generate result content into a single string. Walks the
 * `content` array (text, reasoning, tool-call, etc.) and concatenates text
 * parts; non-text parts get short summaries.
 */
function stringifyContent(content: LanguageModelV3GenerateResult['content']): string {
  const parts: string[] = []
  for (const part of content) {
    if (part.type === 'text') parts.push(part.text)
    else if (part.type === 'reasoning') parts.push(`[reasoning] ${part.text}`)
    else parts.push(`[${part.type}]`)
  }
  return parts.join('')
}

let _hasWarnedEmit = false

async function safeEmit(emit: TraceMiddlewareOptions['emit'], event: TraceEvent): Promise<void> {
  try {
    await emit(event)
  } catch (err) {
    if (!_hasWarnedEmit) {
      _hasWarnedEmit = true
      // eslint-disable-next-line no-console
      console.warn(
        `[ai-functions/traceMiddleware] emit() threw — subsequent emit errors will be silenced. ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Build a trace middleware for `wrapLanguageModel`. Emits a
 * {@link TraceEvent} on every successful `doGenerate` / `doStream`
 * completion. Errors from `emit` are swallowed (one-time warn) so a flaky
 * trace sink can never break the wrapped LLM call.
 *
 * @example
 * ```ts
 * import { wrapLanguageModel } from 'ai'
 * import { traceMiddleware, getEvalLogStore } from 'ai-functions'
 *
 * const store = getEvalLogStore()
 * const model = wrapLanguageModel({
 *   model: openai('gpt-4o'),
 *   middleware: traceMiddleware({
 *     kind: 'cascade-trace',
 *     emit: (event) => store.record({ ...event, costUsd: event.costUsd ?? 0 }),
 *   }),
 * })
 * ```
 */
export function traceMiddleware(options: TraceMiddlewareOptions): LanguageModelV3Middleware {
  const { emit, kind = 'eval-trace', getCostUsd, tags } = options
  return {
    specificationVersion: 'v3',
    async wrapGenerate({ doGenerate, params, model }) {
      const start = Date.now()
      const result = await doGenerate()
      const durationMs = Date.now() - start
      const modelId = model.modelId
      const event: TraceEvent = {
        kind,
        model: modelId,
        prompt: stringifyPrompt(params),
        response: stringifyContent(result.content),
        usage: result.usage,
        durationMs,
        ...(getCostUsd !== undefined ? { costUsd: getCostUsd(modelId, result.usage) } : {}),
        ...(tags !== undefined ? { tags } : {}),
      }
      await safeEmit(emit, event)
      return result
    },
    async wrapStream({ doStream, params, model }) {
      const start = Date.now()
      const result = await doStream()
      const modelId = model.modelId
      let finalUsage: LanguageModelV3Usage | undefined
      const collected: string[] = []
      const transformedStream = result.stream.pipeThrough(
        new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
          transform(chunk, controller) {
            if (chunk.type === 'text-delta') collected.push(chunk.delta)
            else if (chunk.type === 'finish') finalUsage = chunk.usage
            controller.enqueue(chunk)
          },
          flush() {
            const durationMs = Date.now() - start
            const event: TraceEvent = {
              kind,
              model: modelId,
              prompt: stringifyPrompt(params),
              response: collected.join(''),
              usage: finalUsage,
              durationMs,
              ...(getCostUsd !== undefined ? { costUsd: getCostUsd(modelId, finalUsage) } : {}),
              ...(tags !== undefined ? { tags } : {}),
            }
            // Fire-and-forget — TransformStream.flush is sync; we don't
            // await safeEmit so a slow sink doesn't block stream close.
            void safeEmit(emit, event)
          },
        })
      )
      const wrapped: LanguageModelV3StreamResult = {
        ...result,
        stream: transformedStream,
      }
      return wrapped
    },
  }
}
