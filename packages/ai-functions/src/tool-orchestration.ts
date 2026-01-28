/**
 * Agentic Tool Orchestration
 *
 * Provides multi-turn model→tools→model loop orchestration for complex AI workflows.
 *
 * Key components:
 * - AgenticLoop: Orchestrates multi-turn conversations with tool execution
 * - ToolRouter: Routes tool calls to registered handlers
 * - ToolValidator: Validates tool arguments before execution
 *
 * @packageDocumentation
 */

import { z, type ZodTypeAny } from 'zod'

// ============================================================================
// Types
// ============================================================================

/**
 * A tool that can be executed by the agentic loop
 */
export interface Tool<TParams extends ZodTypeAny = ZodTypeAny, TResult = unknown> {
  /** Unique name for the tool */
  name: string
  /** Human-readable description */
  description: string
  /** Zod schema for parameters */
  parameters: TParams
  /** Execute the tool with validated parameters */
  execute: (params: z.infer<TParams>) => Promise<TResult>
}

/**
 * A tool call from the model
 */
export interface ToolCall {
  /** Name of the tool to call */
  name: string
  /** Arguments for the tool */
  arguments: Record<string, unknown>
  /** Optional ID for tracking */
  id?: string
}

/**
 * Result of a tool execution
 */
export interface ToolResult<T = unknown> {
  /** Whether execution succeeded */
  success: boolean
  /** The result value if successful */
  result?: T
  /** Error message if failed */
  error?: string
  /** The original tool call */
  toolCall?: ToolCall
  /** Number of retries attempted */
  retryCount?: number
}

/**
 * Formatted tool result for model consumption
 */
export interface FormattedToolResult {
  /** Role is always 'tool' */
  role: 'tool'
  /** String content of the result */
  content: string
  /** Tool call ID for correlation */
  tool_call_id?: string
  /** Whether this is an error result */
  isError?: boolean
}

/**
 * Validation result for tool arguments
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean
  /** Validation errors if any */
  errors?: string[]
  /** Validated and parsed arguments */
  parsedArgs?: unknown
}

/**
 * Model response from a generation
 */
export interface ModelResponse {
  /** Generated text (if no tool calls) */
  text?: string
  /** Tool calls requested by the model */
  toolCalls?: ToolCall[]
  /** Why generation stopped */
  finishReason: 'stop' | 'tool_call' | 'length' | 'content_filter' | 'error'
  /** Token usage */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Message in the conversation
 */
export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  isError?: boolean
}

/**
 * Step information for callbacks
 */
export interface StepInfo {
  /** Step number (1-indexed) */
  stepNumber: number
  /** Tool calls in this step */
  toolCalls: Array<ToolCall & { result?: unknown; error?: string }>
  /** Model response */
  response: ModelResponse
  /** Current messages */
  messages: Message[]
}

/**
 * Options for creating an AgenticLoop
 */
export interface LoopOptions {
  /** Available tools */
  tools: Tool[]
  /** Maximum number of steps before stopping */
  maxSteps: number
  /** Whether to throw error when maxSteps is exceeded */
  strictMaxSteps?: boolean
  /** Whether to execute tool calls in parallel */
  parallelExecution?: boolean
  /** Maximum concurrent tool calls when parallel execution is enabled */
  maxParallelCalls?: number
  /** Whether to retry failed tool calls */
  retryFailedTools?: boolean
  /** Maximum retries per tool call */
  maxToolRetries?: number
  /** Whether to continue when a tool fails */
  continueOnError?: boolean
  /** Timeout for individual tool execution (ms) */
  toolTimeout?: number
  /** Track token usage across steps */
  trackUsage?: boolean
  /** Callback for each step */
  onStep?: (step: StepInfo) => void
}

/**
 * Options for running the loop
 */
export interface RunOptions {
  /** Model to use for generation */
  model: {
    generate: (options: any) => Promise<ModelResponse>
  }
  /** Initial prompt */
  prompt: string
  /** System message */
  system?: string
  /** Abort signal */
  abortSignal?: AbortSignal
}

/**
 * Extended tool call result with metadata
 */
export interface ToolCallResult {
  /** Tool name */
  name: string
  /** Arguments passed */
  arguments: Record<string, unknown>
  /** Result if successful */
  result?: unknown
  /** Error if failed */
  error?: string
  /** Number of retries */
  retryCount?: number
}

/**
 * Tool result for SDK compatibility
 */
export interface SDKToolResult {
  /** Tool name */
  toolName: string
  /** Tool call ID */
  toolCallId?: string
  /** Result value */
  result: unknown
}

/**
 * Result of running the agentic loop
 */
export interface LoopResult {
  /** Final text output */
  text: string
  /** Number of steps executed */
  steps: number
  /** All tool calls made */
  toolCalls: ToolCallResult[]
  /** Tool results in SDK format */
  toolResults: SDKToolResult[]
  /** Why the loop stopped */
  stopReason: 'stop' | 'max_steps' | 'error' | 'aborted'
  /** Token usage if tracked */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  /** Conversation messages */
  messages: Message[]
}

// ============================================================================
// ToolValidator
// ============================================================================

/**
 * Validates tool arguments before execution
 */
export class ToolValidator {
  private tools = new Map<string, Tool>()

  /**
   * Register a tool for validation
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  /**
   * Validate arguments for a tool
   */
  validate(toolName: string, args: unknown): ValidationResult {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return {
        valid: false,
        errors: [`Tool '${toolName}' not registered`],
      }
    }

    try {
      const parsed = tool.parameters.parse(args)
      return {
        valid: true,
        parsedArgs: parsed,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        }
      }
      return {
        valid: false,
        errors: [(error as Error).message],
      }
    }
  }

  /**
   * Validate multiple tool calls at once
   */
  validateAll(calls: ToolCall[]): ValidationResult[] {
    return calls.map((call) => this.validate(call.name, call.arguments))
  }
}

// ============================================================================
// ToolRouter
// ============================================================================

/**
 * Routes tool calls to registered handlers
 */
export class ToolRouter {
  private tools = new Map<string, Tool>()
  private validator = new ToolValidator()

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
    this.validator.register(tool)
  }

  /**
   * Route a single tool call
   */
  async route(call: ToolCall): Promise<ToolResult> {
    const tool = this.tools.get(call.name)
    if (!tool) {
      return {
        success: false,
        error: `Tool '${call.name}' not found`,
        toolCall: call,
      }
    }

    const validation = this.validator.validate(call.name, call.arguments)
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors?.join(', ')}`,
        toolCall: call,
      }
    }

    try {
      const result = await tool.execute(validation.parsedArgs)
      return {
        success: true,
        result,
        toolCall: call,
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        toolCall: call,
      }
    }
  }

  /**
   * Route multiple tool calls sequentially
   */
  async routeAll(calls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    for (const call of calls) {
      results.push(await this.route(call))
    }
    return results
  }

  /**
   * Route multiple tool calls in parallel
   */
  async routeAllParallel(calls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(calls.map((call) => this.route(call)))
  }

  /**
   * Format a tool result for model consumption
   */
  formatResult(result: ToolResult): FormattedToolResult {
    if (result.success) {
      return {
        role: 'tool',
        content: JSON.stringify(result.result),
        ...(result.toolCall?.id !== undefined && { tool_call_id: result.toolCall.id }),
      }
    }
    return {
      role: 'tool',
      content: JSON.stringify({ error: result.error }),
      ...(result.toolCall?.id !== undefined && { tool_call_id: result.toolCall.id }),
      isError: true,
    }
  }
}

// ============================================================================
// AgenticLoop
// ============================================================================

/**
 * Orchestrates multi-turn model→tools→model loops
 */
export class AgenticLoop {
  private options: LoopOptions
  private router: ToolRouter
  private validator: ToolValidator

  constructor(options: LoopOptions) {
    this.options = {
      strictMaxSteps: false,
      parallelExecution: false,
      maxParallelCalls: 10,
      retryFailedTools: false,
      maxToolRetries: 3,
      continueOnError: false,
      trackUsage: false,
      ...options,
    }
    this.router = new ToolRouter()
    this.validator = new ToolValidator()

    // Register all tools
    for (const tool of options.tools) {
      this.router.register(tool)
      this.validator.register(tool)
    }
  }

  /**
   * Get tools in AI SDK format
   */
  getToolsForSDK(): Record<
    string,
    { description: string; parameters: unknown; execute: (args: unknown) => Promise<unknown> }
  > {
    const tools: Record<string, any> = {}
    for (const tool of this.options.tools) {
      tools[tool.name] = {
        description: tool.description,
        parameters: tool.parameters,
        execute: tool.execute,
      }
    }
    return tools
  }

  /**
   * Execute a tool call with timeout and retry support
   */
  private async executeToolCall(
    call: ToolCall,
    abortSignal?: AbortSignal
  ): Promise<ToolCallResult> {
    const { toolTimeout, retryFailedTools, maxToolRetries = 3 } = this.options
    let lastError: string | undefined
    let retryCount = 0

    const maxAttempts = retryFailedTools ? maxToolRetries : 1

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check abort signal
      if (abortSignal?.aborted) {
        throw new Error('Aborted')
      }

      try {
        // Create a promise for the tool execution
        const executePromise = this.router.route(call)

        // Apply timeout if configured
        let result: ToolResult
        if (toolTimeout) {
          let timeoutId: NodeJS.Timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Tool execution timeout')), toolTimeout)
          })
          try {
            result = await Promise.race([executePromise, timeoutPromise])
          } finally {
            clearTimeout(timeoutId!)
          }
        } else {
          result = await executePromise
        }

        if (result.success) {
          return {
            name: call.name,
            arguments: call.arguments,
            result: result.result,
            retryCount,
          }
        }

        lastError = result.error
        retryCount = attempt + 1
      } catch (error) {
        lastError = (error as Error).message
        if (lastError === 'Aborted') throw error
        retryCount = attempt + 1
      }
    }

    return {
      name: call.name,
      arguments: call.arguments,
      ...(lastError !== undefined && { error: lastError }),
      retryCount: retryCount > 0 ? retryCount - 1 : 0,
    }
  }

  /**
   * Execute multiple tool calls
   */
  private async executeToolCalls(
    calls: ToolCall[],
    abortSignal?: AbortSignal
  ): Promise<ToolCallResult[]> {
    const { parallelExecution, maxParallelCalls = 10 } = this.options

    if (!parallelExecution) {
      // Sequential execution
      const results: ToolCallResult[] = []
      for (const call of calls) {
        results.push(await this.executeToolCall(call, abortSignal))
      }
      return results
    }

    // Parallel execution with concurrency limit
    const results: ToolCallResult[] = []
    const chunks: ToolCall[][] = []

    for (let i = 0; i < calls.length; i += maxParallelCalls) {
      chunks.push(calls.slice(i, i + maxParallelCalls))
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((call) => this.executeToolCall(call, abortSignal))
      )
      results.push(...chunkResults)
    }

    return results
  }

  /**
   * Build messages for the next model call
   */
  private buildMessages(
    prompt: string,
    system: string | undefined,
    conversationMessages: Message[],
    toolResults: ToolCallResult[]
  ): Message[] {
    const messages: Message[] = []

    // Add system message if provided
    if (system) {
      messages.push({ role: 'system', content: system })
    }

    // Add conversation history
    messages.push(...conversationMessages)

    // Add tool results as tool messages
    for (const result of toolResults) {
      if (result.error) {
        messages.push({
          role: 'tool',
          content: JSON.stringify({ error: result.error }),
          isError: true,
        })
      } else {
        messages.push({
          role: 'tool',
          content: JSON.stringify(result.result),
        })
      }
    }

    return messages
  }

  /**
   * Run the agentic loop
   */
  async run(runOptions: RunOptions): Promise<LoopResult> {
    const { model, prompt, system, abortSignal } = runOptions
    const { maxSteps, strictMaxSteps, continueOnError, trackUsage, onStep } = this.options

    const allToolCalls: ToolCallResult[] = []
    const allToolResults: SDKToolResult[] = []
    const messages: Message[] = [{ role: 'user', content: prompt }]
    let steps = 0
    let stopReason: LoopResult['stopReason'] = 'stop'
    let finalText = ''
    let totalUsage = trackUsage
      ? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      : undefined

    try {
      while (steps < maxSteps) {
        // Check abort signal
        if (abortSignal?.aborted) {
          stopReason = 'aborted'
          throw new Error('Aborted')
        }

        steps++

        // Call the model
        const response = await model.generate({
          messages: this.buildMessages(prompt, system, messages.slice(1), []),
          tools: this.getToolsForSDK(),
        })

        // Track usage
        if (trackUsage && response.usage) {
          totalUsage!.promptTokens += response.usage.promptTokens
          totalUsage!.completionTokens += response.usage.completionTokens
          totalUsage!.totalTokens += response.usage.totalTokens
        }

        // If no tool calls, we're done
        if (!response.toolCalls || response.toolCalls.length === 0) {
          finalText = response.text || ''
          messages.push({ role: 'assistant', content: finalText })
          stopReason = 'stop'

          if (onStep) {
            onStep({
              stepNumber: steps,
              toolCalls: [],
              response,
              messages: [...messages],
            })
          }
          break
        }

        // Execute tool calls
        const toolResults = await this.executeToolCalls(response.toolCalls, abortSignal)

        // Check for errors
        const hasErrors = toolResults.some((r) => r.error)
        if (hasErrors && !continueOnError) {
          // Still record the results but note the errors
        }

        // Record tool calls and results
        for (const result of toolResults) {
          allToolCalls.push(result)
          allToolResults.push({
            toolName: result.name,
            result: result.result,
          })

          // Add tool result to messages
          if (result.error) {
            messages.push({
              role: 'tool',
              content: JSON.stringify({ error: result.error }),
              isError: true,
            })
          } else {
            messages.push({
              role: 'tool',
              content: JSON.stringify(result.result),
            })
          }
        }

        // Call onStep callback
        if (onStep) {
          onStep({
            stepNumber: steps,
            toolCalls: response.toolCalls.map((tc, i) => ({
              ...tc,
              ...(toolResults[i]?.result !== undefined && { result: toolResults[i]?.result }),
              ...(toolResults[i]?.error !== undefined && { error: toolResults[i]?.error }),
            })),
            response,
            messages: [...messages],
          })
        }

        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: response.toolCalls,
        })
      }

      // Check if we hit max steps
      if (steps >= maxSteps && stopReason === 'stop') {
        stopReason = 'max_steps'
        if (strictMaxSteps) {
          throw new Error('Max steps exceeded')
        }
      }
    } catch (error) {
      if ((error as Error).message === 'Aborted') {
        stopReason = 'aborted'
        throw error
      }
      if ((error as Error).message === 'Max steps exceeded') {
        throw error
      }
      stopReason = 'error'
      throw error
    }

    return {
      text: finalText,
      steps,
      toolCalls: allToolCalls,
      toolResults: allToolResults,
      stopReason,
      ...(totalUsage !== undefined && { usage: totalUsage }),
      messages,
    }
  }

  /**
   * Run the agentic loop with streaming support
   *
   * Returns an async generator that yields step events as they occur.
   */
  async *stream(runOptions: RunOptions): AsyncGenerator<LoopStreamEvent, LoopResult> {
    const { model, prompt, system, abortSignal } = runOptions
    const { maxSteps, strictMaxSteps, continueOnError, trackUsage } = this.options

    const allToolCalls: ToolCallResult[] = []
    const allToolResults: SDKToolResult[] = []
    const messages: Message[] = [{ role: 'user', content: prompt }]
    let steps = 0
    let stopReason: LoopResult['stopReason'] = 'stop'
    let finalText = ''
    let totalUsage = trackUsage
      ? { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      : undefined

    yield { type: 'start', prompt, timestamp: Date.now() }

    try {
      while (steps < maxSteps) {
        if (abortSignal?.aborted) {
          yield { type: 'aborted', steps, timestamp: Date.now() }
          throw new Error('Aborted')
        }

        steps++
        yield { type: 'step_start', stepNumber: steps, timestamp: Date.now() }

        const response = await model.generate({
          messages: this.buildMessages(prompt, system, messages.slice(1), []),
          tools: this.getToolsForSDK(),
        })

        if (trackUsage && response.usage) {
          totalUsage!.promptTokens += response.usage.promptTokens
          totalUsage!.completionTokens += response.usage.completionTokens
          totalUsage!.totalTokens += response.usage.totalTokens
        }

        if (!response.toolCalls || response.toolCalls.length === 0) {
          finalText = response.text || ''
          messages.push({ role: 'assistant', content: finalText })
          yield { type: 'text', text: finalText, stepNumber: steps, timestamp: Date.now() }
          yield { type: 'step_end', stepNumber: steps, hasToolCalls: false, timestamp: Date.now() }
          break
        }

        yield {
          type: 'tool_calls',
          toolCalls: response.toolCalls,
          stepNumber: steps,
          timestamp: Date.now(),
        }

        const toolResults = await this.executeToolCalls(response.toolCalls, abortSignal)

        for (const result of toolResults) {
          allToolCalls.push(result)
          allToolResults.push({ toolName: result.name, result: result.result })

          yield {
            type: 'tool_result',
            toolName: result.name,
            ...(result.result !== undefined && { result: result.result }),
            ...(result.error !== undefined && { error: result.error }),
            stepNumber: steps,
            timestamp: Date.now(),
          }

          if (result.error) {
            messages.push({
              role: 'tool',
              content: JSON.stringify({ error: result.error }),
              isError: true,
            })
          } else {
            messages.push({
              role: 'tool',
              content: JSON.stringify(result.result),
            })
          }
        }

        yield { type: 'step_end', stepNumber: steps, hasToolCalls: true, timestamp: Date.now() }

        messages.push({
          role: 'assistant',
          content: '',
          tool_calls: response.toolCalls,
        })
      }

      if (steps >= maxSteps && stopReason === 'stop') {
        stopReason = 'max_steps'
        yield { type: 'max_steps', steps, timestamp: Date.now() }
        if (strictMaxSteps) throw new Error('Max steps exceeded')
      }
    } catch (error) {
      if ((error as Error).message === 'Aborted') {
        stopReason = 'aborted'
        throw error
      }
      if ((error as Error).message === 'Max steps exceeded') {
        throw error
      }
      yield { type: 'error', error: (error as Error).message, timestamp: Date.now() }
      stopReason = 'error'
      throw error
    }

    yield { type: 'end', steps, stopReason, timestamp: Date.now() }

    return {
      text: finalText,
      steps,
      toolCalls: allToolCalls,
      toolResults: allToolResults,
      stopReason,
      ...(totalUsage !== undefined && { usage: totalUsage }),
      messages,
    }
  }
}

// ============================================================================
// Streaming Types
// ============================================================================

/**
 * Events emitted during streaming loop execution
 */
export type LoopStreamEvent =
  | { type: 'start'; prompt: string; timestamp: number }
  | { type: 'step_start'; stepNumber: number; timestamp: number }
  | { type: 'step_end'; stepNumber: number; hasToolCalls: boolean; timestamp: number }
  | { type: 'text'; text: string; stepNumber: number; timestamp: number }
  | { type: 'tool_calls'; toolCalls: ToolCall[]; stepNumber: number; timestamp: number }
  | {
      type: 'tool_result'
      toolName: string
      result?: unknown
      error?: string
      stepNumber: number
      timestamp: number
    }
  | { type: 'max_steps'; steps: number; timestamp: number }
  | { type: 'aborted'; steps: number; timestamp: number }
  | { type: 'error'; error: string; timestamp: number }
  | { type: 'end'; steps: number; stopReason: LoopResult['stopReason']; timestamp: number }

// ============================================================================
// Tool Composition Patterns
// ============================================================================

/**
 * Create a tool from a simple function
 */
export function createTool<TParams extends z.ZodRawShape, TResult>(config: {
  name: string
  description: string
  parameters: TParams
  execute: (params: z.infer<z.ZodObject<TParams>>) => Promise<TResult>
}): Tool<z.ZodObject<TParams>, TResult> {
  return {
    name: config.name,
    description: config.description,
    parameters: z.object(config.parameters),
    execute: config.execute,
  }
}

/**
 * Compose multiple tools into a single toolset
 */
export function createToolset(...tools: Tool[]): Tool[] {
  return tools
}

/**
 * Create a tool that wraps another tool with middleware
 */
export function wrapTool<T extends Tool>(
  tool: T,
  middleware: {
    before?: (params: unknown) => Promise<unknown> | unknown
    after?: (result: unknown) => Promise<unknown> | unknown
    onError?: (error: Error) => Promise<unknown> | unknown
  }
): Tool {
  return {
    ...tool,
    execute: async (params: unknown) => {
      try {
        const modifiedParams = middleware.before ? await middleware.before(params) : params
        const result = await tool.execute(modifiedParams)
        return middleware.after ? await middleware.after(result) : result
      } catch (error) {
        if (middleware.onError) {
          return middleware.onError(error as Error)
        }
        throw error
      }
    },
  }
}

/**
 * Options for cachedTool
 */
export interface CachedToolOptions {
  /** Time-to-live in milliseconds (default: 60000) */
  ttl?: number
  /** Function to generate cache key from params (default: JSON.stringify) */
  keyFn?: (params: unknown) => string
  /** Interval in ms for automatic cleanup of expired entries (default: 0 = disabled) */
  cleanupIntervalMs?: number
  /** Maximum cache size before LRU eviction kicks in (default: 0 = unlimited) */
  maxSize?: number
}

/**
 * Extended tool interface with cache management methods
 */
export interface CachedTool extends Tool {
  /** Get the current number of entries in the cache */
  cacheSize(): number
  /** Clear all cache entries */
  clearCache(): void
  /** Stop cleanup timer and clear cache */
  destroy(): void
}

/**
 * Create a tool with caching support
 *
 * Features:
 * - TTL-based expiration
 * - Optional periodic cleanup of expired entries (prevents memory leaks)
 * - Optional max size with LRU eviction
 * - Manual cache control (clear, destroy)
 */
export function cachedTool<T extends Tool>(tool: T, options: CachedToolOptions = {}): CachedTool {
  const { ttl = 60000, keyFn = JSON.stringify, cleanupIntervalMs = 0, maxSize = 0 } = options

  interface CacheEntry {
    value: unknown
    expires: number
    lastAccessed: number
  }

  const cache = new Map<string, CacheEntry>()
  let cleanupTimer: ReturnType<typeof setInterval> | null = null
  let destroyed = false

  // Cleanup function to remove expired entries
  const cleanupExpired = () => {
    const now = Date.now()
    for (const [key, entry] of cache) {
      if (entry.expires <= now) {
        cache.delete(key)
      }
    }
  }

  // Start periodic cleanup if configured
  if (cleanupIntervalMs > 0) {
    cleanupTimer = setInterval(cleanupExpired, cleanupIntervalMs)
    // Unref the timer so it doesn't keep the process alive (Node.js)
    if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
      cleanupTimer.unref()
    }
  }

  // Evict oldest entries based on lastAccessed (LRU)
  const evictOldest = () => {
    if (maxSize <= 0 || cache.size < maxSize) return

    // Find the entry with oldest lastAccessed
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      cache.delete(oldestKey)
    }
  }

  const cachedToolInstance: CachedTool = {
    ...tool,
    execute: async (params: unknown) => {
      if (destroyed) {
        // If destroyed, just execute without caching
        return tool.execute(params)
      }

      const key = keyFn(params)
      const cached = cache.get(key)
      const now = Date.now()

      if (cached && cached.expires > now) {
        // Cache hit - update last accessed time for LRU
        cached.lastAccessed = now
        return cached.value
      }

      // Cache miss or expired - remove expired entry if present
      if (cached) {
        cache.delete(key)
      }

      const result = await tool.execute(params)

      // Evict oldest if we're at max size
      if (maxSize > 0 && cache.size >= maxSize) {
        evictOldest()
      }

      cache.set(key, {
        value: result,
        expires: now + ttl,
        lastAccessed: now,
      })

      return result
    },

    cacheSize(): number {
      return cache.size
    },

    clearCache(): void {
      cache.clear()
    },

    destroy(): void {
      destroyed = true
      if (cleanupTimer !== null) {
        clearInterval(cleanupTimer)
        cleanupTimer = null
      }
      cache.clear()
    },
  }

  return cachedToolInstance
}

/**
 * Create a tool with rate limiting
 */
export function rateLimitedTool<T extends Tool>(
  tool: T,
  options: {
    maxCalls: number
    windowMs: number
  }
): Tool {
  const calls: number[] = []
  const { maxCalls, windowMs } = options

  return {
    ...tool,
    execute: async (params: unknown) => {
      const now = Date.now()
      // Remove expired calls
      while (calls.length > 0 && calls[0]! < now - windowMs) {
        calls.shift()
      }

      if (calls.length >= maxCalls) {
        throw new Error(`Rate limit exceeded: max ${maxCalls} calls per ${windowMs}ms`)
      }

      calls.push(now)
      return tool.execute(params)
    },
  }
}

/**
 * Create a tool that times out after a specified duration
 */
export function timeoutTool<T extends Tool>(tool: T, timeoutMs: number): Tool {
  return {
    ...tool,
    execute: async (params: unknown) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error(`Tool '${tool.name}' timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      })
      try {
        return await Promise.race([tool.execute(params), timeoutPromise])
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId)
        }
      }
    },
  }
}

/**
 * Create an agentic loop with sensible defaults
 */
export function createAgenticLoop(options: Partial<LoopOptions> & { tools: Tool[] }): AgenticLoop {
  return new AgenticLoop({
    maxSteps: 10,
    parallelExecution: true,
    maxParallelCalls: 5,
    continueOnError: true,
    trackUsage: true,
    ...options,
  })
}
