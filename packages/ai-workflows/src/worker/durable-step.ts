/**
 * DurableStep - Wrapper for Cloudflare Workflows step semantics
 *
 * Provides durable execution, retries, sleep, and step metadata
 * by wrapping Cloudflare Workflows' step.do() primitive. This is the
 * foundation for building reliable, resumable workflow steps.
 *
 * ## Features
 *
 * - **Durable Execution**: Steps are persisted and can resume after failures
 * - **Automatic Retries**: Configure retry behavior with backoff strategies
 * - **Timeout Support**: Set per-step timeouts for long-running operations
 * - **Step Context**: Access to nested durable operations and sleep
 * - **Type Safety**: Full TypeScript generics for input/output types
 *
 * ## Basic Usage
 *
 * @example
 * ```typescript
 * import { DurableStep } from 'ai-workflows/worker'
 *
 * // Simple step with type inference
 * const fetchData = new DurableStep('fetch-data', async (input: { url: string }) => {
 *   const response = await fetch(input.url)
 *   return response.json()
 * })
 *
 * // With retry configuration
 * const processPayment = new DurableStep(
 *   'process-payment',
 *   { retries: { limit: 3, delay: '1 second', backoff: 'exponential' } },
 *   async (input: { amount: number }) => {
 *     return { success: true }
 *   }
 * )
 *
 * // Run with workflow step
 * const result = await fetchData.run(step, { url: 'https://api.example.com' })
 * ```
 *
 * ## Using StepContext
 *
 * @example
 * ```typescript
 * const complexStep = new DurableStep('complex', async (input, ctx) => {
 *   // Access step metadata
 *   console.log(`Attempt ${ctx.metadata.attempt} of step ${ctx.metadata.id}`)
 *
 *   // Nested durable operation
 *   const result = await ctx.do('fetch-api', async () => {
 *     return fetch('https://api.example.com').then(r => r.json())
 *   })
 *
 *   return result
 * })
 * ```
 *
 * @packageDocumentation
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  limit: number
  /** Delay between retries (string like '1 second' or number in ms) */
  delay?: string | number
  /** Backoff strategy */
  backoff?: 'constant' | 'linear' | 'exponential'
}

/**
 * Configuration for a step, matching Cloudflare WorkflowStepConfig
 */
export interface StepConfig {
  /** Retry configuration */
  retries?: RetryConfig
  /** Timeout for the step (string like '30 seconds' or number in ms) */
  timeout?: string | number
}

/**
 * Metadata about the current step execution
 */
export interface StepMetadata {
  /** Step identifier */
  id: string
  /** Current attempt number (1-based) */
  attempt: number
  /** Configured retry limit (0 if no retries configured) */
  retries: number
}

/**
 * Interface for Cloudflare Workflows step object
 */
export interface WorkflowStep {
  do<T>(name: string, callback: () => Promise<T>): Promise<T>
  do<T>(name: string, config: StepConfig, callback: () => Promise<T>): Promise<T>
  sleep(name: string, duration: string | number): Promise<void>
  sleepUntil(name: string, timestamp: Date | number): Promise<void>
}

/**
 * Context provided to step functions for additional operations
 */
export class StepContext {
  private workflowStep: WorkflowStep
  private stepName: string
  private stepConfig: StepConfig | undefined
  private currentAttempt: number

  /**
   * Create a new StepContext
   *
   * @param workflowStep - The underlying Cloudflare workflow step
   * @param stepName - The name of the parent step
   * @param stepConfig - Optional step configuration
   * @param attempt - Current attempt number
   */
  constructor(
    workflowStep: WorkflowStep,
    stepName: string,
    stepConfig?: StepConfig,
    attempt: number = 1
  ) {
    this.workflowStep = workflowStep
    this.stepName = stepName
    this.stepConfig = stepConfig
    this.currentAttempt = attempt
  }

  /**
   * Metadata about the current step execution
   */
  get metadata(): StepMetadata {
    return {
      id: this.stepName,
      attempt: this.currentAttempt,
      retries: this.stepConfig?.retries?.limit ?? 0,
    }
  }

  /**
   * Execute a named side effect durably
   *
   * @param name - Unique name for this side effect
   * @param callback - Function to execute
   * @returns Result of the callback
   */
  do<T>(name: string, callback: () => Promise<T>): Promise<T>

  /**
   * Execute a named side effect durably with configuration
   *
   * @param name - Unique name for this side effect
   * @param config - Step configuration (retries, timeout)
   * @param callback - Function to execute
   * @returns Result of the callback
   */
  do<T>(name: string, config: StepConfig, callback: () => Promise<T>): Promise<T>

  /**
   * Implementation of do() overloads
   */
  do<T>(
    name: string,
    configOrCallback: StepConfig | (() => Promise<T>),
    maybeCallback?: () => Promise<T>
  ): Promise<T> {
    if (typeof configOrCallback === 'function') {
      return this.workflowStep.do(name, configOrCallback)
    } else {
      return this.workflowStep.do(name, configOrCallback, maybeCallback!)
    }
  }

  /**
   * Sleep for a specified duration
   *
   * @param name - Unique name for this sleep operation
   * @param duration - Duration to sleep (string like '5 seconds' or number in ms)
   */
  sleep(name: string, duration: string | number): Promise<void> {
    return this.workflowStep.sleep(name, duration)
  }

  /**
   * Sleep until a specified timestamp
   *
   * @param name - Unique name for this sleep operation
   * @param timestamp - Date or unix timestamp to sleep until
   */
  sleepUntil(name: string, timestamp: Date | number): Promise<void> {
    return this.workflowStep.sleepUntil(name, timestamp)
  }
}

/**
 * Type for the step function
 */
export type StepFunction<TInput, TOutput> = (input: TInput, ctx: StepContext) => Promise<TOutput>

/**
 * DurableStep - Wrapper for durable function execution
 *
 * Wraps a function for durable execution using Cloudflare Workflows'
 * step.do() primitive. Provides retry configuration, timeout, and
 * access to step context.
 *
 * @typeParam TInput - Input type for the step function
 * @typeParam TOutput - Output type for the step function
 */
export class DurableStep<TInput = void, TOutput = void> {
  /** Step name */
  readonly name: string

  /** Step configuration (retries, timeout) */
  readonly config?: StepConfig

  /** The wrapped function */
  readonly fn: (input: TInput, ctx: StepContext) => Promise<TOutput>

  /**
   * Create a DurableStep with just a name and function
   *
   * @param name - Unique name for this step
   * @param fn - Function to execute
   */
  constructor(name: string, fn: (input: TInput, ctx?: StepContext) => Promise<TOutput>)

  /**
   * Create a DurableStep with name, config, and function
   *
   * @param name - Unique name for this step
   * @param config - Step configuration (retries, timeout)
   * @param fn - Function to execute
   */
  constructor(
    name: string,
    config: StepConfig,
    fn: (input: TInput, ctx?: StepContext) => Promise<TOutput>
  )

  /**
   * Implementation of constructor overloads
   */
  constructor(
    name: string,
    configOrFn: StepConfig | ((input: TInput, ctx?: StepContext) => Promise<TOutput>),
    maybeFn?: (input: TInput, ctx?: StepContext) => Promise<TOutput>
  ) {
    this.name = name

    if (typeof configOrFn === 'function') {
      this.fn = configOrFn as (input: TInput, ctx: StepContext) => Promise<TOutput>
    } else {
      this.config = configOrFn
      this.fn = maybeFn as (input: TInput, ctx: StepContext) => Promise<TOutput>
    }
  }

  /**
   * Run the step with durable execution
   *
   * @param workflowStep - The Cloudflare workflow step object
   * @param input - Input for the step function
   * @returns Result of the step function
   */
  async run(workflowStep: WorkflowStep, input: TInput): Promise<TOutput> {
    const ctx = new StepContext(workflowStep, this.name, this.config)

    if (this.config) {
      return workflowStep.do(this.name, this.config, async () => {
        return this.fn(input, ctx)
      })
    } else {
      return workflowStep.do(this.name, async () => {
        return this.fn(input, ctx)
      })
    }
  }
}
