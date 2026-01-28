/**
 * WorkflowBuilder DSL - Declarative workflow definition with fluent API
 *
 * Provides a builder pattern for creating durable workflows with:
 * - Step definitions with dependencies
 * - Event triggers
 * - Scheduled execution
 * - Type-safe execution context
 *
 * ## Features
 *
 * - **Fluent API**: Chain methods for intuitive workflow definition
 * - **Step Dependencies**: Declare execution order with `.dependsOn()`
 * - **Event Triggers**: React to domain events with `.on('Noun.event')`
 * - **Schedule Triggers**: Run on intervals with `.every()`
 * - **Error Handling**: Per-step error handlers with `.onError()`
 * - **Parallel Execution**: Steps without dependencies run concurrently
 * - **Cycle Detection**: Automatically detects circular dependencies
 *
 * ## Basic Usage
 *
 * @example
 * ```typescript
 * import { WorkflowBuilder } from 'ai-workflows/worker'
 *
 * const workflow = WorkflowBuilder.create('order-process')
 *   .step('validate', async (input) => {
 *     return { valid: true }
 *   })
 *   .step('charge', async (input, ctx) => {
 *     const validation = ctx.getStepResult<{ valid: boolean }>('validate')
 *     if (!validation.valid) throw new Error('Invalid order')
 *     return { charged: true }
 *   }).dependsOn('validate')
 *   .step('fulfill', fulfillOrder).dependsOn('charge')
 *   .on('Order.placed').do('validate')
 *   .build()
 *
 * // Execute the workflow
 * const results = await workflow.execute({ orderId: 'order-123' })
 * ```
 *
 * ## With DurableStep
 *
 * @example
 * ```typescript
 * import { WorkflowBuilder, DurableStep } from 'ai-workflows/worker'
 *
 * const fetchData = new DurableStep('fetch-data', async ({ url }) => {
 *   return fetch(url).then(r => r.json())
 * })
 *
 * const workflow = WorkflowBuilder.create('data-pipeline')
 *   .step(fetchData)
 *   .step('process', processData).dependsOn('fetch-data')
 *   .build()
 * ```
 *
 * ## Scheduled Workflows
 *
 * @example
 * ```typescript
 * const workflow = WorkflowBuilder.create('daily-report')
 *   .step('generate', generateReport)
 *   .step('send', sendReport).dependsOn('generate')
 *   .every('day').at('9am').do('generate')
 *   .build()
 * ```
 *
 * @packageDocumentation
 */

import { DurableStep, type StepConfig, type RetryConfig, StepContext } from './durable-step.js'

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Configuration for WorkflowBuilder
 */
export interface WorkflowBuilderConfig {
  /** Human-readable description of the workflow */
  description?: string
  /** Version string (semver recommended) */
  version?: string
  /** Default timeout for all steps */
  timeout?: string | number
  /** Default retry configuration for all steps */
  retries?: RetryConfig
}

/**
 * Step definition stored in the builder
 */
export interface StepDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique step name */
  name: string
  /** The step function */
  fn: (input: TInput, ctx: ExecutionContext) => Promise<TOutput>
  /** Step configuration (retries, timeout) */
  config?: StepConfig
  /** Dependencies (step names this step depends on) */
  dependencies: Array<{ name: string; options?: DependencyOptions }>
  /** Error handler */
  errorHandler?: (error: Error, ctx: ExecutionContext) => unknown | Promise<unknown>
  /** DurableStep wrapper */
  durableStep?: DurableStep<TInput, TOutput>
}

/**
 * Options for dependency declarations
 */
export interface DependencyOptions {
  /** Dependency type: 'hard' (default) or 'soft' (can proceed on failure) */
  type?: 'hard' | 'soft'
  /** Timeout for waiting on dependency */
  timeout?: string | number
}

/**
 * Event trigger configuration
 */
export interface TriggerConfig {
  /** Event name (Noun.event format) */
  event: string
  /** Step name to trigger (or inline function was converted to implicit step) */
  stepName: string
  /** Filter function */
  filter?: (event: unknown) => boolean
}

/**
 * Schedule trigger configuration
 */
export interface ScheduleConfig {
  /** Schedule expression (interval, cron, or natural language) */
  schedule: string
  /** Numeric value for interval (e.g., 5 for every(5).minutes()) */
  value?: number
  /** Time of day (e.g., '9am') */
  time?: string
  /** Timezone (e.g., 'America/New_York') */
  timezone?: string
  /** Step name to execute */
  stepName: string
}

/**
 * Built workflow definition (immutable)
 */
export interface BuiltWorkflow<TInput = unknown, TResults = Record<string, unknown>> {
  /** Workflow name */
  readonly name: string
  /** All registered steps */
  readonly steps: ReadonlyArray<StepDefinition>
  /** Workflow triggers */
  readonly triggers: {
    readonly events: ReadonlyArray<TriggerConfig>
    readonly schedules: ReadonlyArray<ScheduleConfig>
  }
  /** Dependency graph (step -> dependencies) */
  readonly dependencyGraph: Map<string, string[]>
  /** Topologically sorted execution order */
  readonly executionOrder: string[]
  /** Workflow metadata */
  readonly metadata?: WorkflowBuilderConfig
  /** Whether compatible with Cloudflare Workflows */
  readonly isCloudflareCompatible: boolean
  /** Execute the workflow */
  execute: (input?: TInput) => Promise<TResults>
}

/**
 * Execution context passed to step functions
 */
export interface ExecutionContext {
  /** Get result of a previously executed step */
  getStepResult: <T = unknown>(stepName: string) => T
  /** Current workflow input */
  readonly input: unknown
  /** All step results so far */
  readonly results: Record<string, unknown>
}

/**
 * Step chain for configuring a step after adding it
 */
export interface StepChain {
  /** Declare dependencies for this step */
  dependsOn(step: string, options?: DependencyOptions): StepChain
  dependsOn(steps: string[]): StepChain
  dependsOn(...steps: string[]): StepChain
  /** Set timeout for this step */
  timeout(duration: string | number): StepChain
  /** Set retry configuration */
  retries(config: RetryConfig): StepChain
  /** Set error handler */
  onError(handler: (error: Error, ctx: ExecutionContext) => unknown | Promise<unknown>): StepChain
  /** Add another step (returns to builder) */
  step<TI = unknown, TO = unknown>(
    name: string,
    fn: (input: TI, ctx: ExecutionContext) => Promise<TO>
  ): StepChain
  step<TI = unknown, TO = unknown>(
    name: string,
    config: StepConfig,
    fn: (input: TI, ctx: ExecutionContext) => Promise<TO>
  ): StepChain
  step<TI = unknown, TO = unknown>(durableStep: DurableStep<TI, TO>): StepChain
  /** Register event trigger */
  on<T = unknown>(event: string): EventTriggerChain<T>
  /** Register schedule trigger */
  every(schedule: string): ScheduleTriggerChain
  every(value: number): NumericScheduleChain
  /** Build the workflow */
  build(): BuiltWorkflow
}

/**
 * Event trigger chain for configuring event-triggered steps
 */
export interface EventTriggerChain<T = unknown> {
  /** Add a filter function */
  filter(predicate: (event: T) => boolean): EventTriggerChain<T>
  /** Execute a step when event fires */
  do(stepName: string): StepChain
  do(fn: (event: T) => Promise<unknown>): StepChain
}

/**
 * Schedule trigger chain for configuring scheduled steps
 */
export interface ScheduleTriggerChain {
  /** Set time of day */
  at(time: string): ScheduleTriggerChain
  /** Set timezone */
  timezone(tz: string): ScheduleTriggerChain
  /** Execute a step on schedule */
  do(stepName: string): StepChain
  do(fn: () => Promise<unknown>): StepChain
}

/**
 * Numeric schedule chain (for every(5).minutes() pattern)
 */
export interface NumericScheduleChain {
  minutes(): ScheduleTriggerChain
  hours(): ScheduleTriggerChain
  days(): ScheduleTriggerChain
  seconds(): ScheduleTriggerChain
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Internal class implementing StepChain, EventTriggerChain, ScheduleTriggerChain
 */
class WorkflowBuilderImpl
  implements StepChain, EventTriggerChain, ScheduleTriggerChain, NumericScheduleChain
{
  private _name: string
  private _config?: WorkflowBuilderConfig
  private _steps: Map<string, StepDefinition> = new Map()
  private _eventTriggers: TriggerConfig[] = []
  private _scheduleTriggers: ScheduleConfig[] = []
  private _currentStep: string | null = null
  private _implicitStepCounter = 0

  // For event trigger chain
  private _currentEvent: string | null = null
  private _currentFilter: ((event: unknown) => boolean) | null = null

  // For schedule trigger chain
  private _currentSchedule: string | null = null
  private _currentScheduleValue: number | null = null
  private _currentTime: string | null = null
  private _currentTimezone: string | null = null

  constructor(name: string, config?: WorkflowBuilderConfig) {
    if (!name || name.trim() === '') {
      throw new Error('Workflow name is required')
    }
    this._name = name
    this._config = config
  }

  get name(): string {
    return this._name
  }

  get config(): WorkflowBuilderConfig | undefined {
    return this._config
  }

  // ==================== Step Methods ====================

  step<TI = unknown, TO = unknown>(
    nameOrStep: string | DurableStep<TI, TO>,
    configOrFn?: StepConfig | ((input: TI, ctx: ExecutionContext) => Promise<TO>),
    maybeFn?: (input: TI, ctx: ExecutionContext) => Promise<TO>
  ): StepChain {
    let name: string
    let fn: (input: TI, ctx: ExecutionContext) => Promise<TO>
    let stepConfig: StepConfig | undefined
    let durableStep: DurableStep<TI, TO> | undefined

    if (nameOrStep instanceof DurableStep) {
      name = nameOrStep.name
      fn = nameOrStep.fn as (input: TI, ctx: ExecutionContext) => Promise<TO>
      stepConfig = nameOrStep.config
      durableStep = nameOrStep
    } else {
      name = nameOrStep
      if (typeof configOrFn === 'function') {
        fn = configOrFn
      } else {
        stepConfig = configOrFn
        fn = maybeFn!
      }
    }

    // Check for duplicate step names
    if (this._steps.has(name)) {
      throw new Error(`Step "${name}" already exists`)
    }

    const stepDef: StepDefinition<TI, TO> = {
      name,
      fn,
      config: stepConfig,
      dependencies: [],
      durableStep:
        durableStep ??
        new DurableStep(
          name,
          stepConfig ?? {},
          fn as (input: TI, ctx?: StepContext) => Promise<TO>
        ),
    }

    this._steps.set(name, stepDef as StepDefinition)
    this._currentStep = name

    return this
  }

  dependsOn(stepOrSteps: string | string[], options?: DependencyOptions): StepChain
  dependsOn(...steps: (string | string[] | DependencyOptions | undefined)[]): StepChain {
    if (!this._currentStep) {
      throw new Error('No current step to add dependencies to')
    }

    const currentStepDef = this._steps.get(this._currentStep)
    if (!currentStepDef) {
      throw new Error(`Step "${this._currentStep}" not found`)
    }

    // Parse arguments
    let dependencyNames: string[] = []
    let dependencyOptions: DependencyOptions | undefined

    for (const arg of steps) {
      if (arg === undefined) continue
      if (typeof arg === 'string') {
        dependencyNames.push(arg)
      } else if (Array.isArray(arg)) {
        dependencyNames.push(...arg)
      } else if (typeof arg === 'object' && ('type' in arg || 'timeout' in arg)) {
        dependencyOptions = arg as DependencyOptions
      }
    }

    // Add dependencies
    for (const depName of dependencyNames) {
      currentStepDef.dependencies.push({ name: depName, options: dependencyOptions })
    }

    return this
  }

  timeout(duration: string | number): StepChain {
    if (!this._currentStep) {
      throw new Error('No current step to set timeout for')
    }

    const stepDef = this._steps.get(this._currentStep)
    if (stepDef) {
      stepDef.config = { ...stepDef.config, timeout: duration }
    }

    return this
  }

  retries(config: RetryConfig): StepChain {
    if (!this._currentStep) {
      throw new Error('No current step to set retries for')
    }

    const stepDef = this._steps.get(this._currentStep)
    if (stepDef) {
      stepDef.config = { ...stepDef.config, retries: config }
    }

    return this
  }

  onError(handler: (error: Error, ctx: ExecutionContext) => unknown | Promise<unknown>): StepChain {
    if (!this._currentStep) {
      throw new Error('No current step to set error handler for')
    }

    const stepDef = this._steps.get(this._currentStep)
    if (stepDef) {
      stepDef.errorHandler = handler
    }

    return this
  }

  // ==================== Event Trigger Methods ====================

  on<T = unknown>(event: string): EventTriggerChain<T> {
    // Validate event format (Noun.event)
    const eventRegex = /^[A-Z][a-zA-Z]*\.[a-z][a-zA-Z]*$/
    if (!eventRegex.test(event)) {
      // Store invalid event - will throw when .do() is called
      this._currentEvent = event
      this._currentFilter = null
      return this as unknown as EventTriggerChain<T>
    }

    this._currentEvent = event
    this._currentFilter = null
    return this as unknown as EventTriggerChain<T>
  }

  filter<T = unknown>(predicate: (event: T) => boolean): EventTriggerChain<T> {
    this._currentFilter = predicate as (event: unknown) => boolean
    return this as unknown as EventTriggerChain<T>
  }

  // ==================== Schedule Trigger Methods ====================

  every(scheduleOrValue: string | number): ScheduleTriggerChain & NumericScheduleChain {
    if (typeof scheduleOrValue === 'number') {
      this._currentScheduleValue = scheduleOrValue
      this._currentSchedule = null
    } else {
      this._currentSchedule = scheduleOrValue
      this._currentScheduleValue = null
    }
    this._currentTime = null
    this._currentTimezone = null
    return this as unknown as ScheduleTriggerChain & NumericScheduleChain
  }

  minutes(): ScheduleTriggerChain {
    if (this._currentScheduleValue !== null) {
      this._currentSchedule = `${this._currentScheduleValue} minutes`
    }
    return this
  }

  hours(): ScheduleTriggerChain {
    if (this._currentScheduleValue !== null) {
      this._currentSchedule = `${this._currentScheduleValue} hours`
    }
    return this
  }

  days(): ScheduleTriggerChain {
    if (this._currentScheduleValue !== null) {
      this._currentSchedule = `${this._currentScheduleValue} days`
    }
    return this
  }

  seconds(): ScheduleTriggerChain {
    if (this._currentScheduleValue !== null) {
      this._currentSchedule = `${this._currentScheduleValue} seconds`
    }
    return this
  }

  at(time: string): ScheduleTriggerChain {
    this._currentTime = time
    return this
  }

  timezone(tz: string): ScheduleTriggerChain {
    this._currentTimezone = tz
    return this
  }

  /**
   * Execute a step when event fires or on schedule
   */
  do(stepNameOrFn: string | ((event?: unknown) => Promise<unknown>)): StepChain {
    // Handle event trigger
    if (this._currentEvent !== null) {
      const eventRegex = /^[A-Z][a-zA-Z]*\.[a-z][a-zA-Z]*$/
      if (!eventRegex.test(this._currentEvent)) {
        throw new Error(
          `Invalid event name format: "${this._currentEvent}". Expected Noun.event format`
        )
      }

      let stepName: string
      if (typeof stepNameOrFn === 'function') {
        // Create implicit step
        stepName = `__implicit_${this._currentEvent.replace('.', '_')}_${++this
          ._implicitStepCounter}`
        this._steps.set(stepName, {
          name: stepName,
          fn: stepNameOrFn as (input: unknown, ctx: ExecutionContext) => Promise<unknown>,
          dependencies: [],
        })
      } else {
        stepName = stepNameOrFn
      }

      this._eventTriggers.push({
        event: this._currentEvent,
        stepName,
        filter: this._currentFilter ?? undefined,
      })

      this._currentEvent = null
      this._currentFilter = null
      return this
    }

    // Handle schedule trigger
    if (this._currentSchedule !== null) {
      let stepName: string
      if (typeof stepNameOrFn === 'function') {
        // Create implicit step
        stepName = `__implicit_schedule_${++this._implicitStepCounter}`
        this._steps.set(stepName, {
          name: stepName,
          fn: stepNameOrFn as (input: unknown, ctx: ExecutionContext) => Promise<unknown>,
          dependencies: [],
        })
      } else {
        stepName = stepNameOrFn
      }

      this._scheduleTriggers.push({
        schedule: this._currentSchedule,
        value: this._currentScheduleValue ?? undefined,
        time: this._currentTime ?? undefined,
        timezone: this._currentTimezone ?? undefined,
        stepName,
      })

      this._currentSchedule = null
      this._currentScheduleValue = null
      this._currentTime = null
      this._currentTimezone = null
      return this
    }

    throw new Error('No event or schedule to trigger')
  }

  // ==================== Build Method ====================

  build(): BuiltWorkflow {
    // Validate event triggers reference existing steps
    for (const trigger of this._eventTriggers) {
      if (!this._steps.has(trigger.stepName)) {
        throw new Error(`Step "${trigger.stepName}" not found for event trigger`)
      }
    }

    // Validate schedule triggers reference existing steps
    for (const trigger of this._scheduleTriggers) {
      if (!this._steps.has(trigger.stepName)) {
        throw new Error(`Step "${trigger.stepName}" not found for schedule trigger`)
      }
    }

    // Build dependency graph
    const dependencyGraph = new Map<string, string[]>()
    for (const [name, stepDef] of this._steps) {
      const deps = stepDef.dependencies.map((d) => d.name)
      dependencyGraph.set(name, deps)

      // Validate dependencies exist
      for (const dep of deps) {
        if (!this._steps.has(dep)) {
          throw new Error(`Dependency "${dep}" not found for step "${name}"`)
        }
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies(dependencyGraph)

    // Compute topological sort
    const executionOrder = this.topologicalSort(dependencyGraph)

    // Create immutable copies
    const steps = Array.from(this._steps.values()).map((s) => ({ ...s }))
    const eventTriggers = [...this._eventTriggers]
    const scheduleTriggers = [...this._scheduleTriggers]

    const workflow: BuiltWorkflow = {
      name: this._name,
      steps: Object.freeze(steps),
      triggers: Object.freeze({
        events: Object.freeze(eventTriggers),
        schedules: Object.freeze(scheduleTriggers),
      }),
      dependencyGraph: new Map(dependencyGraph),
      executionOrder,
      metadata: this._config,
      isCloudflareCompatible: true,
      execute: async (input?: unknown) => {
        return this.executeWorkflow(steps, dependencyGraph, executionOrder, input)
      },
    }

    return workflow
  }

  // ==================== Private Helpers ====================

  private detectCircularDependencies(graph: Map<string, string[]>): void {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (node: string, path: string[]): void => {
      visited.add(node)
      recursionStack.add(node)

      const deps = graph.get(node) || []
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep, [...path, node])
        } else if (recursionStack.has(dep)) {
          // Check if it's self-referential
          if (dep === node) {
            throw new Error(
              `Circular dependency detected: step "${node}" depends on itself (self-referential)`
            )
          }
          throw new Error(`Circular dependency detected: ${[...path, node, dep].join(' -> ')}`)
        }
      }

      recursionStack.delete(node)
    }

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        dfs(node, [])
      }
    }
  }

  private topologicalSort(graph: Map<string, string[]>): string[] {
    const result: string[] = []
    const visited = new Set<string>()
    const temp = new Set<string>()

    const visit = (node: string): void => {
      if (temp.has(node)) {
        throw new Error('Circular dependency detected')
      }
      if (visited.has(node)) return

      temp.add(node)

      const deps = graph.get(node) || []
      for (const dep of deps) {
        visit(dep)
      }

      temp.delete(node)
      visited.add(node)
      result.push(node)
    }

    for (const node of graph.keys()) {
      visit(node)
    }

    return result
  }

  private async executeWorkflow(
    steps: StepDefinition[],
    dependencyGraph: Map<string, string[]>,
    executionOrder: string[],
    input?: unknown
  ): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {}
    const stepMap = new Map(steps.map((s) => [s.name, s]))

    const ctx: ExecutionContext = {
      input,
      results,
      getStepResult: <T = unknown>(stepName: string): T => {
        if (!(stepName in results)) {
          throw new Error(`Step "${stepName}" has not been executed yet`)
        }
        return results[stepName] as T
      },
    }

    // Track which steps are completed
    const completed = new Set<string>()
    const inProgress = new Set<string>()
    const pending = new Set(executionOrder)

    // Execute steps respecting dependencies
    while (pending.size > 0) {
      // Find steps that can be executed (all dependencies satisfied)
      const ready: string[] = []
      for (const stepName of pending) {
        const deps = dependencyGraph.get(stepName) || []
        if (deps.every((d) => completed.has(d)) && !inProgress.has(stepName)) {
          ready.push(stepName)
        }
      }

      if (ready.length === 0 && pending.size > 0) {
        throw new Error('Deadlock detected: no steps can be executed')
      }

      // Execute ready steps in parallel
      const execPromises = ready.map(async (stepName) => {
        inProgress.add(stepName)
        const step = stepMap.get(stepName)!

        try {
          const result = await step.fn(input, ctx)
          results[stepName] = result
        } catch (error) {
          if (step.errorHandler) {
            results[stepName] = await step.errorHandler(error as Error, ctx)
          } else {
            throw error
          }
        } finally {
          inProgress.delete(stepName)
          completed.add(stepName)
          pending.delete(stepName)
        }
      })

      await Promise.all(execPromises)
    }

    return results
  }

  /**
   * Register workflow with a service
   */
  registerWorkflow(workflow: BuiltWorkflow): { id: string } {
    // This is handled by WorkflowServiceCore
    return { id: workflow.name }
  }
}

/**
 * WorkflowBuilder - Static factory for creating workflow definitions
 *
 * @example
 * ```ts
 * const workflow = WorkflowBuilder.create('order-process')
 *   .step('validate', validateOrder)
 *   .step('charge', chargePayment).dependsOn('validate')
 *   .on('Order.placed').do('validate')
 *   .build()
 * ```
 */
export class WorkflowBuilder {
  /** Workflow name */
  readonly name: string
  /** Workflow configuration */
  readonly config?: WorkflowBuilderConfig

  private impl: WorkflowBuilderImpl

  private constructor(name: string, config?: WorkflowBuilderConfig) {
    this.name = name
    this.config = config
    this.impl = new WorkflowBuilderImpl(name, config)
  }

  /**
   * Create a new workflow builder
   *
   * @param name - Unique workflow name
   * @param config - Optional workflow configuration
   * @returns WorkflowBuilder instance
   */
  static create(name: string, config?: WorkflowBuilderConfig): WorkflowBuilder {
    return new WorkflowBuilder(name, config)
  }

  /**
   * Add a step to the workflow
   */
  step<TI = unknown, TO = unknown>(
    name: string,
    fn: (input: TI, ctx: ExecutionContext) => Promise<TO>
  ): StepChain
  step<TI = unknown, TO = unknown>(
    name: string,
    config: StepConfig,
    fn: (input: TI, ctx: ExecutionContext) => Promise<TO>
  ): StepChain
  step<TI = unknown, TO = unknown>(durableStep: DurableStep<TI, TO>): StepChain
  step<TI = unknown, TO = unknown>(
    nameOrStep: string | DurableStep<TI, TO>,
    configOrFn?: StepConfig | ((input: TI, ctx: ExecutionContext) => Promise<TO>),
    maybeFn?: (input: TI, ctx: ExecutionContext) => Promise<TO>
  ): StepChain {
    return this.impl.step(nameOrStep, configOrFn, maybeFn)
  }

  /**
   * Register an event trigger
   */
  on<T = unknown>(event: string): EventTriggerChain<T> {
    return this.impl.on<T>(event)
  }

  /**
   * Register a schedule trigger
   */
  every(schedule: string): ScheduleTriggerChain
  every(value: number): NumericScheduleChain
  every(scheduleOrValue: string | number): ScheduleTriggerChain & NumericScheduleChain {
    return this.impl.every(scheduleOrValue)
  }

  /**
   * Declare dependencies for the most recently added step
   * This allows for: builder.step('a', fn).step('b', fn).dependsOn('a')
   */
  dependsOn(step: string, options?: DependencyOptions): WorkflowBuilder
  dependsOn(steps: string[]): WorkflowBuilder
  dependsOn(...steps: string[]): WorkflowBuilder
  dependsOn(stepOrSteps: string | string[], options?: DependencyOptions): WorkflowBuilder {
    this.impl.dependsOn(stepOrSteps, options)
    return this
  }

  /**
   * Build the workflow definition
   */
  build(): BuiltWorkflow {
    return this.impl.build()
  }
}

// Re-export for convenience
export { DurableStep, type StepConfig, type RetryConfig }
