/**
 * WorkflowBuilder DSL - Fluent API for building durable workflows
 *
 * Provides a declarative DSL for workflow definition with:
 * - Sequential steps with .step()
 * - Parallel execution with .parallel()
 * - Conditional branching with .when().then().else()
 * - Loops with .loop() and .forEach()
 * - Error handling with .onError()
 * - Timeouts with .timeout()
 * - Retries with .retry()
 *
 * @example
 * ```typescript
 * import { workflow } from 'ai-workflows'
 *
 * const orderWorkflow = workflow('order-process')
 *   .step('validate', async (input) => ({ valid: true, ...input }))
 *   .when(ctx => ctx.result.valid)
 *   .then(
 *     workflow('charge-flow')
 *       .step('charge', async () => ({ charged: true }))
 *   )
 *   .step('fulfill', fulfillOrder)
 *   .timeout(5000)
 *   .retry({ attempts: 3, backoff: 'exponential' })
 *   .build()
 *
 * const result = await orderWorkflow.execute({ orderId: '123' })
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Retry configuration for steps
 */
export interface RetryConfig {
  /** Maximum number of attempts */
  attempts: number
  /** Backoff strategy */
  backoff?: 'constant' | 'linear' | 'exponential'
  /** Base delay in milliseconds */
  delay?: number
  /** Maximum delay cap in milliseconds */
  maxDelay?: number
  /** Add randomness to delays */
  jitter?: boolean
  /** Condition to determine if retry should happen */
  retryIf?: (error: Error, attempt: number) => boolean
}

/**
 * Loop options
 */
export interface LoopOptions {
  /** Maximum number of iterations (safety limit) */
  maxIterations?: number
  /** Throw error when max iterations exceeded */
  throwOnMaxIterations?: boolean
}

/**
 * ForEach options
 */
export interface ForEachOptions {
  /** Concurrency level for parallel iteration */
  concurrency?: number
}

/**
 * Step context passed to handlers and conditions
 */
export interface StepContext {
  /** Original workflow input */
  input: unknown
  /** Current accumulated result */
  result: Record<string, unknown>
  /** Current step name (available in error handlers) */
  currentStep?: string
  /** Retry the current step */
  retry: () => Promise<unknown>
  /** Skip to the next step with a result */
  skip: (result: unknown) => { __skip: true; result: unknown }
  /** Abort the workflow */
  abort: (reason?: string) => never
}

/**
 * Step definition stored in the builder
 */
export interface StepDefinition {
  /** Step type */
  type: 'step' | 'parallel' | 'conditional' | 'loop' | 'forEach'
  /** Step name (for regular steps) */
  name?: string
  /** Step function (for regular steps) */
  fn?: StepFunction<unknown, unknown>
  /** Parallel steps */
  parallelSteps?: Array<{ name: string; fn: StepFunction<unknown, unknown> }>
  /** Conditional configuration */
  conditional?: {
    condition: ConditionFunction
    thenBranch: WorkflowBuilder<unknown, unknown>
    elseBranch?: WorkflowBuilder<unknown, unknown> | StepFunction<unknown, unknown>
  }
  /** Loop configuration */
  loop?: {
    condition: ConditionFunction
    body: WorkflowBuilder<unknown, unknown>
    options?: LoopOptions
  }
  /** ForEach configuration */
  forEach?: {
    itemsSelector: (ctx: StepContext) => unknown[]
    body: WorkflowBuilder<unknown, unknown>
    options?: ForEachOptions
  }
  /** Timeout in milliseconds */
  timeout?: number
  /** Retry configuration */
  retry?: RetryConfig
  /** Error handler */
  errorHandler?: ErrorHandler
}

/**
 * Step function type
 */
export type StepFunction<TInput, TOutput> = (input: TInput, ctx?: StepContext) => Promise<TOutput>

/**
 * Condition function type
 */
export type ConditionFunction = (ctx: StepContext) => boolean | Promise<boolean>

/**
 * Error handler type
 */
export type ErrorHandler = (error: Error, ctx: StepContext) => unknown | Promise<unknown>

/**
 * Built workflow definition
 */
export interface BuiltWorkflow<TInput = unknown, TOutput = unknown> {
  /** Workflow name */
  readonly name: string
  /** All registered steps */
  readonly steps: ReadonlyArray<StepDefinition>
  /** Default retry configuration */
  readonly defaultRetryConfig?: RetryConfig
  /** Execute the workflow */
  execute: (input?: TInput) => Promise<TOutput>
}

/**
 * Conditional chain for .when().then().else()
 */
export interface ConditionalChain<TInput, TOutput> {
  /** Execute branch when condition is true */
  then(
    branch: WorkflowBuilder<unknown, unknown> | StepFunction<unknown, unknown>
  ): ConditionalChainWithThen<TInput, TOutput>
}

/**
 * Conditional chain after .then()
 */
export interface ConditionalChainWithThen<TInput, TOutput> {
  /** Execute branch when condition is false */
  else(
    branch: WorkflowBuilder<unknown, unknown> | StepFunction<unknown, unknown>
  ): WorkflowBuilder<TInput, TOutput>
  /** Add another step */
  step<TO = unknown>(name: string, fn: StepFunction<unknown, TO>): WorkflowBuilder<TInput, TOutput>
  /** Add parallel steps */
  parallel(
    steps: Array<{ name: string; fn: StepFunction<unknown, unknown> }>
  ): WorkflowBuilder<TInput, TOutput>
  /** Add conditional */
  when(condition: ConditionFunction): ConditionalChain<TInput, TOutput>
  /** Add loop */
  loop(
    condition: ConditionFunction,
    body: WorkflowBuilder<unknown, unknown>,
    options?: LoopOptions
  ): WorkflowBuilder<TInput, TOutput>
  /** Add forEach */
  forEach(
    itemsSelector: (ctx: StepContext) => unknown[],
    body: WorkflowBuilder<unknown, unknown>,
    options?: ForEachOptions
  ): WorkflowBuilder<TInput, TOutput>
  /** Set error handler */
  onError(handler: ErrorHandler): WorkflowBuilder<TInput, TOutput>
  /** Set timeout */
  timeout(ms: number | string): WorkflowBuilder<TInput, TOutput>
  /** Set retry config */
  retry(config: RetryConfig): WorkflowBuilder<TInput, TOutput>
  /** Build the workflow */
  build(): BuiltWorkflow<TInput, TOutput>
}

/**
 * Loop chain type
 */
export type LoopChain = WorkflowBuilder<unknown, unknown>

/**
 * Step chain type (same as WorkflowBuilder)
 */
export type StepChain = WorkflowBuilder<unknown, unknown>

/**
 * Workflow definition type alias
 */
export type WorkflowDefinition = BuiltWorkflow<unknown, unknown>

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string | number): number {
  if (typeof duration === 'number') return duration
  const match = duration.match(/^(\d+)(ms|s|m|h)?$/)
  if (!match || match[1] === undefined) return parseInt(duration, 10)
  const value = parseInt(match[1], 10)
  const unit = match[2] || 'ms'
  switch (unit) {
    case 's':
      return value * 1000
    case 'm':
      return value * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    default:
      return value
  }
}

/**
 * Calculate backoff delay
 */
function calculateBackoff(attempt: number, config: RetryConfig): number {
  const baseDelay = config.delay || 100
  let delay: number

  switch (config.backoff) {
    case 'linear':
      delay = baseDelay * attempt
      break
    case 'exponential':
      delay = baseDelay * Math.pow(2, attempt - 1)
      break
    case 'constant':
    default:
      delay = baseDelay
  }

  // Apply max delay cap
  if (config.maxDelay) {
    delay = Math.min(delay, config.maxDelay)
  }

  // Apply jitter
  if (config.jitter) {
    delay = delay * (0.5 + Math.random())
  }

  return delay
}

/**
 * Execute with timeout
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, stepName?: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: step "${stepName || 'unknown'}" exceeded ${ms}ms`))
    }, ms)

    promise
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

/**
 * Execute with retry
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  stepName?: string
): Promise<T> {
  let lastError: Error | undefined
  for (let attempt = 1; attempt <= config.attempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Check if we should retry
      if (config.retryIf && !config.retryIf(lastError, attempt)) {
        throw lastError
      }

      // Don't wait after last attempt
      if (attempt < config.attempts) {
        const delay = calculateBackoff(attempt, config)
        await new Promise((r) => setTimeout(r, delay))
      }
    }
  }
  throw lastError
}

// ============================================================================
// WorkflowBuilder Implementation
// ============================================================================

/**
 * WorkflowBuilder - Fluent DSL for building durable workflows
 */
export class WorkflowBuilder<TInput = unknown, TOutput = unknown> {
  /** Workflow name */
  readonly name: string

  private _steps: StepDefinition[] = []
  private _stepNames: Set<string> = new Set()
  private _defaultRetryConfig?: RetryConfig
  private _workflowErrorHandler?: ErrorHandler
  private _workflowTimeout?: number
  // Track if the last operation was a configuration (timeout/retry) without step
  private _lastOpWasConfig: boolean = false
  // Track which step index the last config applied to (-1 for workflow level)
  private _lastConfigStepIndex: number = -1
  // Track the step index that was most recently directly configured (for step-level config)
  private _lastDirectlyConfiguredStep: number = -1

  constructor(name: string) {
    if (!name || name.trim() === '') {
      throw new Error('Workflow name is required')
    }
    this.name = name
  }

  /**
   * Add a sequential step
   */
  step<TI = unknown, TO = unknown>(
    name: string,
    fn: StepFunction<TI, TO>
  ): WorkflowBuilder<TInput, TOutput> {
    // Defer duplicate check to build() for immutability
    this._steps.push({
      type: 'step',
      name,
      fn: fn as StepFunction<unknown, unknown>,
    })
    this._lastOpWasConfig = false
    this._lastConfigStepIndex = -1
    return this
  }

  /**
   * Add parallel steps
   */
  parallel(
    steps: Array<{ name: string; fn: StepFunction<unknown, unknown> }>
  ): WorkflowBuilder<TInput, TOutput> {
    this._steps.push({
      type: 'parallel',
      parallelSteps: steps,
    })
    this._lastOpWasConfig = false
    this._lastConfigStepIndex = -1
    return this
  }

  /**
   * Add conditional branching
   */
  when(condition: ConditionFunction): ConditionalChain<TInput, TOutput> {
    const self = this
    return {
      then(
        branch: WorkflowBuilder<unknown, unknown> | StepFunction<unknown, unknown>
      ): ConditionalChainWithThen<TInput, TOutput> {
        const thenBranch =
          branch instanceof WorkflowBuilder
            ? branch
            : workflow('inline-then').step('inline', branch as StepFunction<unknown, unknown>)

        // Create step definition but don't add it yet
        const stepDef: StepDefinition = {
          type: 'conditional',
          conditional: {
            condition,
            thenBranch: thenBranch as WorkflowBuilder<unknown, unknown>,
          },
        }

        return {
          else(
            elseBranch: WorkflowBuilder<unknown, unknown> | StepFunction<unknown, unknown>
          ): WorkflowBuilder<TInput, TOutput> {
            const resolvedElseBranch =
              elseBranch instanceof WorkflowBuilder
                ? elseBranch
                : workflow('inline-else').step(
                    'inline',
                    elseBranch as StepFunction<unknown, unknown>
                  )
            stepDef.conditional!.elseBranch = resolvedElseBranch as WorkflowBuilder<
              unknown,
              unknown
            >
            self._steps.push(stepDef)
            return self
          },
          step<TO = unknown>(
            name: string,
            fn: StepFunction<unknown, TO>
          ): WorkflowBuilder<TInput, TOutput> {
            self._steps.push(stepDef)
            return self.step(name, fn)
          },
          parallel(
            steps: Array<{ name: string; fn: StepFunction<unknown, unknown> }>
          ): WorkflowBuilder<TInput, TOutput> {
            self._steps.push(stepDef)
            return self.parallel(steps)
          },
          when(cond: ConditionFunction): ConditionalChain<TInput, TOutput> {
            self._steps.push(stepDef)
            return self.when(cond)
          },
          loop(
            cond: ConditionFunction,
            body: WorkflowBuilder<unknown, unknown>,
            options?: LoopOptions
          ): WorkflowBuilder<TInput, TOutput> {
            self._steps.push(stepDef)
            return self.loop(cond, body, options)
          },
          forEach(
            itemsSelector: (ctx: StepContext) => unknown[],
            body: WorkflowBuilder<unknown, unknown>,
            options?: ForEachOptions
          ): WorkflowBuilder<TInput, TOutput> {
            self._steps.push(stepDef)
            return self.forEach(itemsSelector, body, options)
          },
          onError(handler: ErrorHandler): WorkflowBuilder<TInput, TOutput> {
            self._steps.push(stepDef)
            return self.onError(handler)
          },
          timeout(ms: number | string): WorkflowBuilder<TInput, TOutput> {
            self._steps.push(stepDef)
            return self.timeout(ms)
          },
          retry(config: RetryConfig): WorkflowBuilder<TInput, TOutput> {
            self._steps.push(stepDef)
            return self.retry(config)
          },
          build(): BuiltWorkflow<TInput, TOutput> {
            self._steps.push(stepDef)
            return self.build()
          },
        }
      },
    }
  }

  /**
   * Add a loop
   */
  loop(
    condition: ConditionFunction,
    body: WorkflowBuilder<unknown, unknown>,
    options?: LoopOptions
  ): WorkflowBuilder<TInput, TOutput> {
    this._steps.push({
      type: 'loop',
      loop: {
        condition,
        body,
        ...(options !== undefined && { options }),
      },
    })
    this._lastOpWasConfig = false
    this._lastConfigStepIndex = -1
    return this
  }

  /**
   * Add forEach iteration
   */
  forEach(
    itemsSelector: (ctx: StepContext) => unknown[],
    body: WorkflowBuilder<unknown, unknown>,
    options?: ForEachOptions
  ): WorkflowBuilder<TInput, TOutput> {
    this._steps.push({
      type: 'forEach',
      forEach: {
        itemsSelector,
        body,
        ...(options !== undefined && { options }),
      },
    })
    this._lastOpWasConfig = false
    this._lastConfigStepIndex = -1
    return this
  }

  /**
   * Set error handler for the most recent step or workflow
   *
   * Rules:
   * - If no steps exist, applies to workflow
   * - If last config (timeout/retry) was workflow-level, this is workflow-level too
   * - If last config was step-level, this applies to that same step
   * - If multiple steps since last config, this is workflow-level
   */
  onError(handler: ErrorHandler): WorkflowBuilder<TInput, TOutput> {
    const lastStepIndex = this._steps.length - 1

    // Determine if this should be workflow-level or step-level
    let isWorkflowLevel = false

    if (this._steps.length === 0) {
      isWorkflowLevel = true
    } else if (this._lastOpWasConfig && this._lastConfigStepIndex === -1) {
      // Last config was workflow-level (e.g., workflow timeout)
      isWorkflowLevel = true
    } else if (this._lastConfigStepIndex === lastStepIndex) {
      // Last config was for the most recent step - stay step-level
      isWorkflowLevel = false
    } else {
      // Check if multiple steps since last config
      const unconfiguredStepsCount = lastStepIndex - this._lastDirectlyConfiguredStep
      if (unconfiguredStepsCount > 1) {
        isWorkflowLevel = true
      } else if (unconfiguredStepsCount === 1) {
        // One unconfigured step - apply to that step
        isWorkflowLevel = false
        this._lastDirectlyConfiguredStep = lastStepIndex
      } else {
        isWorkflowLevel = false
      }
    }

    if (isWorkflowLevel) {
      // Workflow-level error handler
      if (this._workflowErrorHandler) {
        // Chain error handlers
        const previousHandler = this._workflowErrorHandler
        this._workflowErrorHandler = async (error, ctx) => {
          try {
            return await previousHandler(error, ctx)
          } catch (e) {
            return await handler(e as Error, ctx)
          }
        }
      } else {
        this._workflowErrorHandler = handler
      }
    } else {
      // Step-level error handler - apply to the step that was just configured
      const targetStepIndex =
        this._lastConfigStepIndex >= 0 ? this._lastConfigStepIndex : lastStepIndex
      const targetStep = this._steps[targetStepIndex]
      if (targetStep) {
        if (targetStep.errorHandler) {
          // Chain error handlers
          const previousHandler = targetStep.errorHandler
          targetStep.errorHandler = async (error, ctx) => {
            try {
              return await previousHandler(error, ctx)
            } catch (e) {
              return await handler(e as Error, ctx)
            }
          }
        } else {
          targetStep.errorHandler = handler
        }
      }
    }
    return this
  }

  /**
   * Set timeout for the most recent step or workflow
   *
   * Rules:
   * - If no steps exist, applies to workflow
   * - If called immediately after a step that was just configured (same step), applies to that step
   * - If called after a step that hasn't been configured yet (first config after that step), applies to that step
   * - If multiple steps were added since last config, this becomes workflow-level
   */
  timeout(ms: number | string): WorkflowBuilder<TInput, TOutput> {
    const timeout = parseDuration(ms)
    const lastStepIndex = this._steps.length - 1

    if (this._steps.length === 0) {
      // No steps - workflow level
      this._workflowTimeout = timeout
      this._lastConfigStepIndex = -1
    } else if (this._lastDirectlyConfiguredStep === lastStepIndex) {
      // Same step was already configured - still step level for this step
      const lastStep = this._steps[lastStepIndex]
      if (lastStep) {
        lastStep.timeout = timeout
      }
      this._lastConfigStepIndex = lastStepIndex
    } else if (
      this._lastDirectlyConfiguredStep === lastStepIndex - 1 ||
      this._lastDirectlyConfiguredStep === -1
    ) {
      // Previous step was configured, or no step configured yet
      // Check if there's only one unconfigured step (step-level) or multiple (workflow-level)
      const unconfiguredStepsCount = lastStepIndex - this._lastDirectlyConfiguredStep
      if (unconfiguredStepsCount === 1) {
        // Only one step since last config - apply to that step
        const lastStep = this._steps[lastStepIndex]
        if (lastStep) {
          lastStep.timeout = timeout
        }
        this._lastConfigStepIndex = lastStepIndex
        this._lastDirectlyConfiguredStep = lastStepIndex
      } else {
        // Multiple steps since last config - apply to workflow
        this._workflowTimeout = timeout
        this._lastConfigStepIndex = -1
      }
    } else {
      // More than one step was added since last config - workflow level
      this._workflowTimeout = timeout
      this._lastConfigStepIndex = -1
    }
    this._lastOpWasConfig = true
    return this
  }

  /**
   * Set retry configuration for the most recent step or workflow
   *
   * When called immediately after a step, applies to that step.
   * When no steps exist, applies as default for all steps.
   */
  retry(config: RetryConfig): WorkflowBuilder<TInput, TOutput> {
    if (this._steps.length > 0 && !this._lastOpWasConfig) {
      // Apply to last step
      const lastStep = this._steps[this._steps.length - 1]
      if (lastStep) {
        lastStep.retry = config
      }
      this._lastConfigStepIndex = this._steps.length - 1
    } else {
      // Apply as workflow default
      this._defaultRetryConfig = config
      this._lastConfigStepIndex = -1
    }
    this._lastOpWasConfig = true
    return this
  }

  /**
   * Build the workflow definition
   */
  build(): BuiltWorkflow<TInput, TOutput> {
    // Check for duplicate step names
    const names = new Set<string>()
    for (const step of this._steps) {
      if (step.type === 'step' && step.name) {
        if (names.has(step.name)) {
          throw new Error(`Duplicate step name: "${step.name}"`)
        }
        names.add(step.name)
      }
      if (step.type === 'parallel' && step.parallelSteps) {
        for (const ps of step.parallelSteps) {
          if (names.has(ps.name)) {
            throw new Error(`Duplicate step name: "${ps.name}"`)
          }
          names.add(ps.name)
        }
      }
    }

    // Create immutable copies
    const steps = this._steps.map((s) => ({ ...s }))
    const defaultRetryConfig = this._defaultRetryConfig
    const workflowErrorHandler = this._workflowErrorHandler
    const workflowTimeout = this._workflowTimeout
    const workflowName = this.name

    return {
      name: workflowName,
      steps: Object.freeze(steps),
      ...(defaultRetryConfig !== undefined && { defaultRetryConfig }),
      execute: async (input?: TInput): Promise<TOutput> => {
        return executeWorkflow(
          steps,
          input,
          defaultRetryConfig,
          workflowErrorHandler,
          workflowTimeout
        ) as Promise<TOutput>
      },
    }
  }
}

// ============================================================================
// Workflow Execution
// ============================================================================

/**
 * Execute a workflow
 */
async function executeWorkflow(
  steps: StepDefinition[],
  input: unknown,
  defaultRetryConfig?: RetryConfig,
  workflowErrorHandler?: ErrorHandler,
  workflowTimeout?: number
): Promise<unknown> {
  let result: Record<string, unknown> = {}
  const startTime = Date.now()

  const createContext = (currentStep?: string): StepContext => ({
    input,
    result: { ...result },
    ...(currentStep !== undefined && { currentStep }),
    retry: async () => {
      throw new Error('retry() can only be called from an error handler')
    },
    skip: (skipResult: unknown) => ({ __skip: true as const, result: skipResult }),
    abort: (reason?: string) => {
      throw new Error(reason || 'Workflow aborted')
    },
  })

  // Helper to check workflow timeout
  const checkWorkflowTimeout = () => {
    if (workflowTimeout && Date.now() - startTime > workflowTimeout) {
      throw new Error('Timeout: workflow exceeded timeout')
    }
  }

  const executeWithWorkflowTimeout = async (): Promise<unknown> => {
    for (const step of steps) {
      // Check workflow timeout before each step
      checkWorkflowTimeout()

      try {
        result = await executeStep(
          step,
          input,
          result,
          createContext,
          defaultRetryConfig,
          workflowTimeout ? workflowTimeout - (Date.now() - startTime) : undefined
        )
      } catch (error) {
        // Try step-level error handler first
        if (step.errorHandler) {
          let currentError = error as Error
          let retryRequested = false
          let retrySucceeded = false
          let retryResult: Record<string, unknown> | null = null
          const maxRetryAttempts = 100 // Safety limit

          for (let retryAttempt = 0; retryAttempt < maxRetryAttempts; retryAttempt++) {
            retryRequested = false

            // Create context with retry support
            const errorCtx: StepContext = {
              input,
              result: { ...result },
              ...(step.name !== undefined && { currentStep: step.name }),
              retry: async () => {
                retryRequested = true
                // Re-execute just the step function directly
                const stepInput = Object.keys(result).length > 0 ? result : input
                const stepResult = await step.fn!(stepInput, createContext(step.name))
                retryResult = { ...result, ...(stepResult as Record<string, unknown>) }
                retrySucceeded = true
                return retryResult
              },
              skip: (skipResult: unknown) => ({ __skip: true as const, result: skipResult }),
              abort: (reason?: string) => {
                throw new Error(reason || 'Workflow aborted')
              },
            }

            try {
              const handlerResult = await step.errorHandler(currentError, errorCtx)

              // If retry succeeded, use that result and exit loop
              if (retrySucceeded && retryResult) {
                result = retryResult
                break
              }

              // If no retry was requested, process the handler result and exit
              if (!retryRequested) {
                if (
                  handlerResult &&
                  typeof handlerResult === 'object' &&
                  '__skip' in handlerResult
                ) {
                  result = {
                    ...result,
                    ...((handlerResult as { __skip: boolean; result: unknown }).result as Record<
                      string,
                      unknown
                    >),
                  }
                } else if (handlerResult !== undefined) {
                  result = { ...result, ...(handlerResult as Record<string, unknown>) }
                }
                break
              }

              // Retry was requested but succeeded, so we're done
              if (retrySucceeded) {
                result = retryResult!
                break
              }
            } catch (retryError) {
              // Retry was attempted but failed
              // Continue the loop to call the error handler again with the new error
              currentError = retryError as Error
              retrySucceeded = false
              retryResult = null
            }
          }
        } else if (workflowErrorHandler) {
          // Try workflow-level error handler
          const ctx = createContext(step.name)
          const handlerResult = await workflowErrorHandler(error as Error, ctx)
          result = { ...result, ...(handlerResult as Record<string, unknown>) }
          // Stop execution after workflow error handler (don't continue to next step)
          return result
        } else {
          throw error
        }
      }
    }

    return result
  }

  try {
    // If there's a workflow timeout, wrap the entire execution
    if (workflowTimeout) {
      return await withTimeout(executeWithWorkflowTimeout(), workflowTimeout, 'workflow')
    }
    return await executeWithWorkflowTimeout()
  } catch (error) {
    if (workflowErrorHandler) {
      const ctx = createContext()
      return await workflowErrorHandler(error as Error, ctx)
    }
    throw error
  }
}

/**
 * Execute a single step
 */
async function executeStep(
  step: StepDefinition,
  input: unknown,
  currentResult: Record<string, unknown>,
  createContext: (stepName?: string) => StepContext,
  defaultRetryConfig?: RetryConfig,
  _remainingTimeout?: number
): Promise<Record<string, unknown>> {
  let result = { ...currentResult }
  const retryConfig = step.retry || defaultRetryConfig

  switch (step.type) {
    case 'step': {
      const execute = async () => {
        const ctx = createContext(step.name)
        const stepInput = Object.keys(result).length > 0 ? result : input
        const stepResult = await step.fn!(stepInput, ctx)
        return { ...result, ...(stepResult as Record<string, unknown>) }
      }

      let executeWithTimeout = execute
      if (step.timeout) {
        executeWithTimeout = () => withTimeout(execute(), step.timeout!, step.name)
      }

      if (retryConfig) {
        result = await withRetry(executeWithTimeout, retryConfig, step.name)
      } else {
        result = await executeWithTimeout()
      }
      break
    }

    case 'parallel': {
      const execute = async () => {
        const promises = step.parallelSteps!.map(async (ps) => {
          const ctx = createContext(ps.name)
          const stepInput = Object.keys(result).length > 0 ? result : input
          const stepResult = await ps.fn(stepInput, ctx)
          return { name: ps.name, result: stepResult }
        })

        const results = await Promise.all(promises)
        const merged: Record<string, unknown> = { ...result }
        for (const { name, result: r } of results) {
          merged[name] = r
        }
        return merged
      }

      if (step.timeout) {
        result = await withTimeout(execute(), step.timeout)
      } else {
        result = await execute()
      }
      break
    }

    case 'conditional': {
      const ctx = createContext()
      const conditionResult = await step.conditional!.condition(ctx)

      if (conditionResult) {
        const thenResult = await step.conditional!.thenBranch.build().execute(result)
        result = { ...result, ...(thenResult as Record<string, unknown>) }
      } else if (step.conditional!.elseBranch) {
        const elseBranch = step.conditional!.elseBranch
        if (elseBranch instanceof WorkflowBuilder) {
          const elseResult = await elseBranch.build().execute(result)
          result = { ...result, ...(elseResult as Record<string, unknown>) }
        } else {
          const elseResult = await (elseBranch as StepFunction<unknown, unknown>)(result, ctx)
          result = { ...result, ...(elseResult as Record<string, unknown>) }
        }
      }
      break
    }

    case 'loop': {
      const { condition, body, options } = step.loop!
      const maxIterations = options?.maxIterations ?? Infinity
      let iterations = 0

      while (true) {
        const ctx = createContext()
        ctx.result = result
        const shouldContinue = await condition(ctx)

        if (!shouldContinue) break

        iterations++
        if (iterations > maxIterations) {
          if (options?.throwOnMaxIterations) {
            throw new Error(`Max iterations exceeded: loop exceeded ${maxIterations} iterations`)
          }
          break
        }

        const loopResult = await body.build().execute(result)
        result = { ...result, ...(loopResult as Record<string, unknown>) }
      }
      break
    }

    case 'forEach': {
      const { itemsSelector, body, options } = step.forEach!
      const ctx = createContext()
      ctx.result = result
      const items = itemsSelector(ctx)

      if (items.length === 0) {
        break
      }

      const concurrency = options?.concurrency ?? 1
      const forEachResults: unknown[] = []

      if (concurrency === 1) {
        // Sequential execution
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          const itemInput = { item, index: i }
          const itemResult = await body.build().execute(itemInput)
          forEachResults.push(itemResult)
        }
      } else {
        // Parallel execution with concurrency limit
        const chunks: unknown[][] = []
        for (let i = 0; i < items.length; i += concurrency) {
          chunks.push(items.slice(i, i + concurrency))
        }

        let index = 0
        for (const chunk of chunks) {
          const chunkPromises = chunk.map(async (item) => {
            const currentIndex = index++
            const itemInput = { item, index: currentIndex }
            return body.build().execute(itemInput)
          })
          const chunkResults = await Promise.all(chunkPromises)
          forEachResults.push(...chunkResults)
        }
      }

      result = { ...result, forEachResults }
      break
    }
  }

  return result
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new workflow builder
 *
 * @param name - Workflow name (required)
 * @returns WorkflowBuilder instance
 *
 * @example
 * ```typescript
 * const orderWorkflow = workflow('order-process')
 *   .step('validate', async (input) => ({ valid: true }))
 *   .step('charge', async (input) => ({ charged: true }))
 *   .build()
 *
 * const result = await orderWorkflow.execute({ orderId: '123' })
 * ```
 */
export function workflow<TInput = unknown, TOutput = unknown>(
  name: string
): WorkflowBuilder<TInput, TOutput> {
  return new WorkflowBuilder<TInput, TOutput>(name)
}

// Re-export for convenience
export { workflow as default }
