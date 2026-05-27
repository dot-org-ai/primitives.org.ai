/**
 * `mermaid()` — LLM-backed authoring primitive for state machine workflows.
 *
 * Returns a mermaid `stateDiagram-v2` source string that is VALIDATED to parse
 * into a runnable xstate `MachineConfig` via {@link fromMermaid} (the parser is
 * the validator, per ADR-0011). When a generation fails to parse, the parse
 * error is fed back into the prompt and the generation is retried, up to a
 * bounded number of attempts.
 *
 * This is the LLM-authorable wire format from ADR-0011: an LLM emits mermaid,
 * `fromMermaid` validates it by turning it into a runnable config, and
 * generations that fail to parse are retried so the model corrects them.
 *
 * @example
 * ```ts
 * import { mermaid } from 'ai-functions'
 * import { fromMermaid, createStateMachine } from 'ai-workflows'
 *
 * const source = await mermaid('a traffic light: red, green, yellow')
 * const config = fromMermaid(source) // guaranteed to parse + build a machine
 * const machine = createStateMachine(config)
 * ```
 *
 * Note: the returned source is guaranteed to parse AND to build a machine via
 * `createStateMachine` (this primitive validates both). It is NOT guaranteed to
 * *run* on its own — any guards/actions the diagram references by name (e.g. a
 * `[guard]` on a transition, or a `<<choice>>` branch) must be supplied at
 * creation time via `setup({ guards, actions }).createMachine(config)` or
 * `createStateMachine(config).provide({ guards, actions })`. xstate throws at
 * evaluation/entry time if it reaches a referenced guard/action that was never
 * provided.
 *
 * @packageDocumentation
 */

import { fromMermaid, createStateMachine } from 'ai-workflows'
import { generateObject } from './generate.js'
import { traced } from './telemetry.js'

// =============================================================================
// Types
// =============================================================================

/**
 * The generation seam. `mermaid()` calls a function with this shape to produce
 * a candidate mermaid string; the default implementation is model-backed via
 * {@link generateObject}. Tests inject a deterministic fake to exercise the
 * retry path without a live model.
 */
export type MermaidGenerateFn = (params: {
  /** The fully-assembled prompt (including any fed-back parse error). */
  prompt: string
  /** The system prompt steering the model toward valid stateDiagram-v2. */
  system: string
  /** The model alias / id to generate with. */
  model: string
  /** Sampling temperature, when set. */
  temperature?: number
  /** Max output tokens, when set. */
  maxTokens?: number
  /** The 0-based attempt index (0 = first try, >0 = a retry). */
  attempt: number
}) => Promise<string>

/**
 * Options for {@link mermaid}. Mirrors the neighbouring primitives' option shape
 * (model / system / temperature / maxTokens) and adds the retry config plus the
 * injectable generation seam used by the offline retry test.
 */
export interface MermaidOptions {
  /** Model to use (alias or full id). Defaults to `'sonnet'`. */
  model?: string
  /** Override the system prompt steering the model toward valid output. */
  system?: string
  /** Temperature (0-2). */
  temperature?: number
  /** Max tokens. */
  maxTokens?: number
  /**
   * Maximum number of *retries* after the first attempt. The total number of
   * generation attempts is `maxRetries + 1`. Defaults to `2` (3 attempts).
   */
  maxRetries?: number
  /**
   * Injectable generation function (the LLM seam). Defaults to a model-backed
   * generator using {@link generateObject}. Tests pass a fake here to drive the
   * retry path deterministically without a network call.
   */
  generate?: MermaidGenerateFn
}

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_MAX_RETRIES = 2

const DEFAULT_SYSTEM = [
  'You author state machine workflows as mermaid `stateDiagram-v2` source.',
  'Output ONLY the mermaid diagram source — no prose, no markdown code fences.',
  'Begin with the `stateDiagram-v2` directive.',
  'Use `[*] --> first` to mark the initial state, `state --> [*]` for final states,',
  'and `from --> to : EVENT` (optionally `: EVENT [guard]`) for event-driven transitions.',
  'The diagram must parse into a runnable state machine.',
].join(' ')

/**
 * The default model-backed generator. Asks for a single `diagram` field so the
 * output is the bare mermaid source (no surrounding prose / fences).
 */
const defaultGenerate: MermaidGenerateFn = async ({
  prompt,
  system,
  model,
  temperature,
  maxTokens,
}) => {
  const result = await generateObject({
    model,
    schema: { diagram: 'The mermaid stateDiagram-v2 source (no markdown fences)' },
    prompt,
    system,
    ...(temperature !== undefined && { temperature }),
    ...(maxTokens !== undefined && { maxTokens }),
  })
  return (result.object as { diagram: string }).diagram
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Strip a surrounding markdown code fence (```mermaid ... ``` or ``` ... ```)
 * if the model wrapped its output in one, so the parser sees bare source.
 */
function stripFence(source: string): string {
  const trimmed = source.trim()
  const fence = trimmed.match(/^```(?:mermaid)?\s*\n?([\s\S]*?)\n?```$/i)
  return (fence ? fence[1] ?? '' : trimmed).trim()
}

// =============================================================================
// Primitive
// =============================================================================

/**
 * Generate a mermaid `stateDiagram-v2` string validated to parse into a runnable
 * xstate `MachineConfig`.
 *
 * The parser ({@link fromMermaid}) is the validator. On a parse failure the
 * error message is appended to the prompt and the generation is retried, up to
 * `options.maxRetries` retries (default 2 → 3 total attempts). The returned
 * string is guaranteed to parse; if every attempt fails, the last
 * `MermaidParseError` is thrown.
 *
 * @param prompt natural-language description of the workflow to author.
 * @param options model / system / temperature / maxTokens / retry config and the
 *   injectable generation seam.
 * @returns validated mermaid `stateDiagram-v2` source.
 * @throws the final `MermaidParseError` when all attempts fail to parse.
 */
async function mermaidImpl(prompt: string, options: MermaidOptions = {}): Promise<string> {
  const {
    model = 'sonnet',
    system = DEFAULT_SYSTEM,
    temperature,
    maxTokens,
    maxRetries = DEFAULT_MAX_RETRIES,
    generate = defaultGenerate,
  } = options

  const totalAttempts = Math.max(1, maxRetries + 1)
  let lastError: unknown

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    // On a retry, feed the previous parse error back into the prompt so the
    // model corrects the specific construct that failed.
    const attemptPrompt =
      attempt === 0 || lastError === undefined
        ? prompt
        : [
            prompt,
            '',
            'Your previous mermaid output failed to parse with this error:',
            lastError instanceof Error ? lastError.message : String(lastError),
            '',
            'Fix that issue and return corrected mermaid stateDiagram-v2 source.',
          ].join('\n')

    const raw = await generate({
      prompt: attemptPrompt,
      system,
      model,
      ...(temperature !== undefined && { temperature }),
      ...(maxTokens !== undefined && { maxTokens }),
      attempt,
    })

    const source = stripFence(raw)

    try {
      // The parser is the first validator: a clean parse yields a MachineConfig.
      // But a config can parse and still be rejected by xstate when it is
      // assembled into a runnable machine (e.g. a cross-boundary `Composite[H]`
      // history target whose composite never declares `[H]` → createMachine
      // throws "Child state 'hist' does not exist"). So we ALSO run
      // createStateMachine(config) — only a config that both parses AND builds a
      // runnable machine is genuinely valid. Either failure feeds the retry loop
      // identically, so the model corrects parse errors and build errors alike.
      const config = fromMermaid(source)
      createStateMachine(config)
      return source
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`mermaid() failed to produce valid stateDiagram-v2 source: ${String(lastError)}`)
}

/**
 * Telemetry-instrumented {@link mermaidImpl}. Emits an `ai.mermaid` span with the
 * configured model, matching the tracing pattern used by the other primitives.
 */
export const mermaid = traced('ai.mermaid', mermaidImpl, {
  kind: 'client',
  getAttributes: (_prompt: string, options?: MermaidOptions) => ({
    'ai.model': options?.model ?? 'sonnet',
  }),
})
