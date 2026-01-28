/**
 * REPL session support for ai-evaluate
 *
 * Provides persistent evaluation sessions with context preservation.
 */

import type { EvaluateOptions, EvaluateResult, SandboxEnv, SDKConfig } from './types.js'

/**
 * REPL session configuration
 */
export interface ReplSessionConfig {
  /** Use local Miniflare instead of remote workers */
  local?: boolean
  /** Authentication token for remote execution */
  auth?: string
  /** SDK configuration for platform primitives */
  sdk?: SDKConfig | boolean
  /** Code to run when session starts (defines globals, imports) */
  prelude?: string
  /** Timeout for each evaluation in milliseconds */
  timeout?: number
  /** Allow network access */
  allowNetwork?: boolean
}

/**
 * Result from a REPL evaluation
 */
export interface ReplEvalResult extends EvaluateResult {
  /** Variables exported during evaluation */
  exports?: Record<string, unknown>
}

/**
 * REPL session with persistent context
 */
export interface ReplSession {
  /** Evaluate code in the session context */
  eval(code: string): Promise<ReplEvalResult>

  /** Get current session context (accumulated exports) */
  getContext(): Record<string, unknown>

  /** Set a value in the session context */
  setContext(key: string, value: unknown): void

  /** Clear the session context */
  clearContext(): void

  /** Run prelude code (called automatically on first eval) */
  runPrelude(): Promise<void>

  /** Close the session and release resources */
  close(): Promise<void>
}

/**
 * Create a REPL session for interactive code evaluation
 *
 * @example
 * ```ts
 * import { createReplSession } from 'ai-evaluate/repl'
 *
 * const session = await createReplSession({ local: true })
 *
 * await session.eval('const sum = (a, b) => a + b')
 * const result = await session.eval('sum(1, 2)')
 * console.log(result.value) // 3
 *
 * await session.close()
 * ```
 */
export async function createReplSession(
  config?: ReplSessionConfig,
  env?: SandboxEnv
): Promise<ReplSession> {
  // Context accumulates across evaluations
  let context: Record<string, unknown> = {}
  let preludeRun = false
  let miniflare: unknown = null

  // Build module code from accumulated context
  function buildContextModule(): string {
    const entries = Object.entries(context)
    if (entries.length === 0) return ''

    return entries
      .map(([key, value]) => {
        if (typeof value === 'function') {
          return `export const ${key} = ${value.toString()}`
        }
        return `export const ${key} = ${JSON.stringify(value)}`
      })
      .join('\n')
  }

  // Get the evaluate function (local or remote)
  async function getEvaluate(): Promise<
    (options: EvaluateOptions, env?: SandboxEnv) => Promise<EvaluateResult>
  > {
    if (config?.local) {
      // Use local Miniflare via node.ts
      const { evaluate } = await import('./node.js')
      return evaluate
    } else if (env) {
      // Use remote worker loaders
      const { evaluate } = await import('./evaluate.js')
      return (options) => evaluate(options, env)
    } else {
      // Default to local if no env
      const { evaluate } = await import('./node.js')
      return evaluate
    }
  }

  const evaluate = await getEvaluate()

  async function runPrelude(): Promise<void> {
    if (preludeRun || !config?.prelude) return
    preludeRun = true

    const result = await evaluate(
      {
        module: config.prelude,
        script: 'return Object.keys(module)',
        ...(config.sdk !== undefined && { sdk: config.sdk }),
        ...(config.timeout !== undefined && { timeout: config.timeout }),
        ...(config.allowNetwork === false && { fetch: null }),
      },
      env
    )

    if (result.success && Array.isArray(result.value)) {
      // Store exported names in context
      for (const key of result.value) {
        context[key] = `__prelude_${key}__`
      }
    }
  }

  return {
    async eval(code: string): Promise<ReplEvalResult> {
      await runPrelude()

      // Wrap code to capture any declared variables
      const contextModule = buildContextModule()
      const preludeModule = config?.prelude || ''

      // Try to parse as expression first, then as statement
      const isExpression =
        !code.includes('const ') &&
        !code.includes('let ') &&
        !code.includes('function ') &&
        !code.includes('class ') &&
        !code.includes('export ')

      const script = isExpression
        ? `return (${code})`
        : code.includes('return ')
        ? code
        : `${code}\nreturn undefined`

      const result = await evaluate(
        {
          module: preludeModule + '\n' + contextModule,
          script,
          ...(config?.sdk !== undefined && { sdk: config.sdk }),
          ...(config?.timeout !== undefined && { timeout: config.timeout }),
          ...(config?.allowNetwork === false && { fetch: null }),
        },
        env
      )

      return result
    },

    getContext(): Record<string, unknown> {
      return { ...context }
    },

    setContext(key: string, value: unknown): void {
      context[key] = value
    },

    clearContext(): void {
      context = {}
    },

    runPrelude,

    async close(): Promise<void> {
      context = {}
      preludeRun = false
      if (
        miniflare &&
        typeof (miniflare as { dispose?: () => Promise<void> }).dispose === 'function'
      ) {
        await (miniflare as { dispose: () => Promise<void> }).dispose()
        miniflare = null
      }
    },
  }
}

/**
 * Quick evaluation helper for one-off evaluations
 *
 * @example
 * ```ts
 * import { quickEval } from 'ai-evaluate/repl'
 *
 * const result = await quickEval('1 + 2 * 3')
 * console.log(result.value) // 7
 * ```
 */
export async function quickEval(
  code: string,
  config?: ReplSessionConfig,
  env?: SandboxEnv
): Promise<ReplEvalResult> {
  const session = await createReplSession(config, env)
  try {
    return await session.eval(code)
  } finally {
    await session.close()
  }
}
