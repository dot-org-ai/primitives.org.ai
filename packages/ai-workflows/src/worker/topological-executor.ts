/**
 * TopologicalExecutor - Parallel step execution based on dependency graph
 *
 * Executes workflow steps in parallel while respecting dependency ordering.
 * Uses topological sort to determine execution levels and runs steps
 * within each level concurrently.
 *
 * Features:
 * - Parallel execution of independent steps
 * - Durable execution via Cloudflare Workflows step.do()
 * - Progress callbacks for monitoring
 * - Error handling with rollback support
 * - Visualization helpers for debugging
 *
 * @example
 * ```typescript
 * import { TopologicalExecutor, DurableGraph } from 'ai-workflows/worker'
 *
 * // Create executor with steps
 * const executor = new TopologicalExecutor()
 *   .addStep('fetch-user', [], async (input) => {
 *     return { userId: input.id }
 *   })
 *   .addStep('fetch-orders', ['fetch-user'], async (input, results) => {
 *     return { orders: [] }
 *   })
 *   .addStep('fetch-prefs', ['fetch-user'], async (input, results) => {
 *     return { prefs: {} }
 *   })
 *   .addStep('aggregate', ['fetch-orders', 'fetch-prefs'], async (input, results) => {
 *     return { ...results['fetch-orders'], ...results['fetch-prefs'] }
 *   })
 *
 * // Execute with durable workflow
 * const result = await executor.run(step, { id: 'user-123' })
 * ```
 *
 * @packageDocumentation
 */

import {
  DependencyGraph,
  CircularDependencyError,
  MissingDependencyError,
  type GraphNode,
  type ParallelGroup,
  type DependencyType,
} from '../dependency-graph.js'

import {
  topologicalSort,
  getExecutionLevels,
  CycleDetectedError,
  type SortableNode,
  type ExecutionLevel,
} from '../graph/topological-sort.js'

import type { WorkflowStep, StepConfig } from './durable-step.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Function signature for step execution
 */
export type StepExecutor<TInput = unknown, TOutput = unknown> = (
  input: TInput,
  previousResults: Record<string, unknown>,
  context: ExecutionContext
) => Promise<TOutput>

/**
 * Definition of a step in the execution graph
 */
export interface StepDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique step identifier */
  id: string
  /** IDs of steps this step depends on */
  dependencies: string[]
  /** The step function to execute */
  executor: StepExecutor<TInput, TOutput>
  /** Optional step configuration (retries, timeout) */
  config: StepConfig | undefined
  /** Dependency types (hard/soft) */
  dependencyTypes: Record<string, DependencyType> | undefined
}

/**
 * Context provided during step execution
 */
export interface ExecutionContext {
  /** Current step ID */
  stepId: string
  /** Current execution level */
  level: number
  /** Total number of levels */
  totalLevels: number
  /** Steps completed so far */
  completedSteps: string[]
  /** Attempt number for this step */
  attempt: number
}

/**
 * Progress callback for monitoring execution
 */
export interface ProgressCallback {
  /** Called when a level starts */
  onLevelStart?: (level: number, steps: string[]) => void
  /** Called when a step starts */
  onStepStart?: (stepId: string, level: number) => void
  /** Called when a step completes */
  onStepComplete?: (stepId: string, level: number, result: unknown, duration: number) => void
  /** Called when a step fails */
  onStepError?: (stepId: string, level: number, error: Error) => void
  /** Called when a level completes */
  onLevelComplete?: (level: number, results: Record<string, unknown>) => void
}

/**
 * Result of executing the graph
 */
export interface ExecutionResult<T = Record<string, unknown>> {
  /** All step results keyed by step ID */
  results: T
  /** Execution metrics */
  metrics: {
    totalDuration: number
    levelDurations: number[]
    stepDurations: Record<string, number>
    parallelEfficiency: number
  }
  /** Steps that were skipped due to soft dependency failures */
  skippedSteps: string[]
  /** Execution order (actual order steps ran in) */
  executionOrder: string[]
}

/**
 * Configuration for TopologicalExecutor
 */
export interface ExecutorConfig {
  /** Continue execution on step failure (for soft dependencies) */
  continueOnError?: boolean
  /** Maximum concurrency per level (default: unlimited) */
  maxConcurrency?: number
  /** Progress callbacks */
  progress?: ProgressCallback
  /** Default step config */
  defaultStepConfig?: StepConfig
}

// ============================================================================
// TopologicalExecutor
// ============================================================================

/**
 * TopologicalExecutor - Execute steps in parallel based on dependency graph
 *
 * Provides parallel execution of workflow steps while respecting dependencies.
 * Steps at the same execution level run concurrently, while levels execute
 * sequentially.
 */
export class TopologicalExecutor<TInput = unknown> {
  private steps: Map<string, StepDefinition> = new Map()
  private config: ExecutorConfig

  constructor(config: ExecutorConfig = {}) {
    this.config = config
  }

  /**
   * Add a step to the executor
   *
   * @param id - Unique step identifier
   * @param dependencies - IDs of steps this step depends on
   * @param executor - Function to execute
   * @param config - Optional step configuration
   * @returns this (for chaining)
   */
  addStep<TOutput>(
    id: string,
    dependencies: string[],
    executor: StepExecutor<TInput, TOutput>,
    config?: StepConfig
  ): this {
    this.steps.set(id, {
      id,
      dependencies,
      executor: executor as StepExecutor,
      config: config ?? this.config.defaultStepConfig,
      dependencyTypes: undefined,
    })
    return this
  }

  /**
   * Add a step with dependency type specification
   */
  addStepWithTypes<TOutput>(
    id: string,
    dependencies: Array<{ id: string; type?: DependencyType }>,
    executor: StepExecutor<TInput, TOutput>,
    config?: StepConfig
  ): this {
    const depIds = dependencies.map((d) => d.id)
    const depTypes: Record<string, DependencyType> = {}
    for (const dep of dependencies) {
      depTypes[dep.id] = dep.type ?? 'hard'
    }

    this.steps.set(id, {
      id,
      dependencies: depIds,
      executor: executor as StepExecutor,
      config: config ?? this.config.defaultStepConfig,
      dependencyTypes: depTypes,
    })
    return this
  }

  /**
   * Get the dependency graph
   */
  getGraph(): DependencyGraph {
    const graph = new DependencyGraph()

    // Add nodes in topological order to ensure dependencies exist
    const nodes: SortableNode[] = Array.from(this.steps.values()).map((s) => ({
      id: s.id,
      dependencies: s.dependencies,
    }))

    const sorted = topologicalSort(nodes)
    if (sorted.hasCycle) {
      throw new CycleDetectedError(sorted.cyclePath ?? ['unknown'])
    }

    // Add nodes without dependencies first
    for (const id of sorted.order) {
      const step = this.steps.get(id)!
      if (step.dependencies.length === 0) {
        graph.addNode(id)
      }
    }

    // Add nodes with dependencies
    for (const id of sorted.order) {
      const step = this.steps.get(id)!
      if (step.dependencies.length > 0) {
        const firstDep = step.dependencies[0]
        const depType = firstDep !== undefined ? step.dependencyTypes?.[firstDep] ?? 'hard' : 'hard'
        graph.addNode(id, {
          dependsOn: step.dependencies,
          type: depType,
        })
      }
    }

    return graph
  }

  /**
   * Get execution levels for parallel execution
   */
  getExecutionLevels(): ExecutionLevel[] {
    const nodes: SortableNode[] = Array.from(this.steps.values()).map((s) => ({
      id: s.id,
      dependencies: s.dependencies,
    }))
    return getExecutionLevels(nodes)
  }

  /**
   * Validate the graph (check for cycles, missing deps)
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    const nodes: SortableNode[] = Array.from(this.steps.values()).map((s) => ({
      id: s.id,
      dependencies: s.dependencies,
    }))

    // Check for cycles
    const result = topologicalSort(nodes)
    if (result.hasCycle) {
      errors.push(`Circular dependency detected: ${result.cyclePath?.join(' -> ')}`)
    }

    // Check for missing dependencies
    const stepIds = new Set(this.steps.keys())
    for (const step of this.steps.values()) {
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          errors.push(`Step '${step.id}' depends on missing step '${dep}'`)
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Execute the graph with durable semantics
   *
   * @param workflowStep - Cloudflare Workflows step object
   * @param input - Input to pass to all steps
   * @returns Execution result with all step outputs
   */
  async run(
    workflowStep: WorkflowStep,
    input: TInput
  ): Promise<ExecutionResult<Record<string, unknown>>> {
    const validation = this.validate()
    if (!validation.valid) {
      throw new Error(`Invalid execution graph: ${validation.errors.join(', ')}`)
    }

    const levels = this.getExecutionLevels()
    const results: Record<string, unknown> = {}
    const stepDurations: Record<string, number> = {}
    const levelDurations: number[] = []
    const skippedSteps: string[] = []
    const executionOrder: string[] = []
    const completedSteps: string[] = []
    const failedSteps = new Set<string>()

    const startTime = Date.now()

    for (let levelIndex = 0; levelIndex < levels.length; levelIndex++) {
      const level = levels[levelIndex]!
      const levelStartTime = Date.now()

      this.config.progress?.onLevelStart?.(level.level, level.nodes)

      // Filter steps that can run (all hard deps satisfied)
      const runnableSteps = level.nodes.filter((stepId) => {
        const step = this.steps.get(stepId)!
        const hardDeps = step.dependencies.filter(
          (dep) => (step.dependencyTypes?.[dep] ?? 'hard') === 'hard'
        )
        return hardDeps.every((dep) => completedSteps.includes(dep))
      })

      // Skip steps whose hard dependencies failed
      const stepsToSkip = level.nodes.filter((stepId) => !runnableSteps.includes(stepId))
      for (const stepId of stepsToSkip) {
        skippedSteps.push(stepId)
        failedSteps.add(stepId)
      }

      // Execute runnable steps in parallel
      const stepPromises = runnableSteps.map(async (stepId) => {
        const step = this.steps.get(stepId)!
        const stepStartTime = Date.now()

        this.config.progress?.onStepStart?.(stepId, level.level)

        const context: ExecutionContext = {
          stepId,
          level: level.level,
          totalLevels: levels.length,
          completedSteps: [...completedSteps],
          attempt: 1,
        }

        try {
          const result = await this.executeStep(workflowStep, step, input, results, context)
          const duration = Date.now() - stepStartTime

          results[stepId] = result
          stepDurations[stepId] = duration
          executionOrder.push(stepId)
          completedSteps.push(stepId)

          this.config.progress?.onStepComplete?.(stepId, level.level, result, duration)

          return { stepId, success: true, result }
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error))
          const duration = Date.now() - stepStartTime

          stepDurations[stepId] = duration
          failedSteps.add(stepId)

          this.config.progress?.onStepError?.(stepId, level.level, err)

          if (!this.config.continueOnError) {
            throw err
          }

          return { stepId, success: false, error: err }
        }
      })

      // Wait for all steps in this level
      const levelResults = await Promise.all(stepPromises)
      const levelDuration = Date.now() - levelStartTime
      levelDurations.push(levelDuration)

      this.config.progress?.onLevelComplete?.(level.level, results)
    }

    const totalDuration = Date.now() - startTime

    // Calculate parallel efficiency
    const sequentialTime = Object.values(stepDurations).reduce((a, b) => a + b, 0)
    const parallelEfficiency = sequentialTime > 0 ? sequentialTime / totalDuration : 1

    return {
      results,
      metrics: {
        totalDuration,
        levelDurations,
        stepDurations,
        parallelEfficiency,
      },
      skippedSteps,
      executionOrder,
    }
  }

  /**
   * Execute a single step with durability
   */
  private async executeStep(
    workflowStep: WorkflowStep,
    step: StepDefinition,
    input: TInput,
    previousResults: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<unknown> {
    if (step.config) {
      return workflowStep.do(step.id, step.config, async () => {
        return step.executor(input, previousResults, context)
      })
    } else {
      return workflowStep.do(step.id, async () => {
        return step.executor(input, previousResults, context)
      })
    }
  }

  /**
   * Visualize the execution graph as DOT format
   */
  toDot(): string {
    const graph = this.getGraph()
    return graph.toDot()
  }

  /**
   * Get graph as JSON for debugging
   */
  toJSON(): { steps: StepDefinition[]; levels: ExecutionLevel[] } {
    return {
      steps: Array.from(this.steps.values()),
      levels: this.getExecutionLevels(),
    }
  }
}

// ============================================================================
// DurableGraph
// ============================================================================

/**
 * DurableGraph - Dependency graph with durable execution support
 *
 * Extends DependencyGraph with execution capabilities using Cloudflare
 * Workflows durability. Provides a higher-level API for building and
 * executing workflow step graphs.
 *
 * @example
 * ```typescript
 * const graph = new DurableGraph<{ userId: string }>()
 *   .node('fetch-user', async (input) => {
 *     return await fetchUser(input.userId)
 *   })
 *   .node('fetch-orders', ['fetch-user'], async (input, results) => {
 *     return await fetchOrders(results['fetch-user'].id)
 *   })
 *
 * const result = await graph.execute(step, { userId: '123' })
 * ```
 */
export class DurableGraph<TInput = unknown> {
  private executor: TopologicalExecutor<TInput>
  private nodeMetadata: Map<string, { description?: string; tags?: string[] }> = new Map()

  constructor(config: ExecutorConfig = {}) {
    this.executor = new TopologicalExecutor<TInput>(config)
  }

  /**
   * Add a node (step) to the graph
   *
   * @param id - Unique node identifier
   * @param executor - Function to execute (if no dependencies)
   */
  node<TOutput>(id: string, executor: StepExecutor<TInput, TOutput>): this

  /**
   * Add a node with dependencies
   *
   * @param id - Unique node identifier
   * @param dependencies - IDs of nodes this node depends on
   * @param executor - Function to execute
   */
  node<TOutput>(id: string, dependencies: string[], executor: StepExecutor<TInput, TOutput>): this

  /**
   * Add a node with dependencies and config
   *
   * @param id - Unique node identifier
   * @param dependencies - IDs of nodes this node depends on
   * @param executor - Function to execute
   * @param config - Step configuration
   */
  node<TOutput>(
    id: string,
    dependencies: string[],
    executor: StepExecutor<TInput, TOutput>,
    config: StepConfig
  ): this

  /**
   * Implementation of node() overloads
   */
  node<TOutput>(
    id: string,
    depsOrExecutor: string[] | StepExecutor<TInput, TOutput>,
    executorOrConfig?: StepExecutor<TInput, TOutput> | StepConfig,
    maybeConfig?: StepConfig
  ): this {
    if (typeof depsOrExecutor === 'function') {
      // node(id, executor)
      this.executor.addStep(id, [], depsOrExecutor)
    } else if (typeof executorOrConfig === 'function') {
      // node(id, deps, executor) or node(id, deps, executor, config)
      this.executor.addStep(id, depsOrExecutor, executorOrConfig, maybeConfig)
    }
    return this
  }

  /**
   * Add metadata to a node
   */
  describe(id: string, metadata: { description?: string; tags?: string[] }): this {
    this.nodeMetadata.set(id, metadata)
    return this
  }

  /**
   * Get execution levels
   */
  levels(): ExecutionLevel[] {
    return this.executor.getExecutionLevels()
  }

  /**
   * Validate the graph
   */
  validate(): { valid: boolean; errors: string[] } {
    return this.executor.validate()
  }

  /**
   * Execute the graph with durable semantics
   */
  async execute(
    workflowStep: WorkflowStep,
    input: TInput
  ): Promise<ExecutionResult<Record<string, unknown>>> {
    return this.executor.run(workflowStep, input)
  }

  /**
   * Get DOT visualization
   */
  toDot(): string {
    return this.executor.toDot()
  }

  /**
   * Get as JSON
   */
  toJSON(): ReturnType<TopologicalExecutor<TInput>['toJSON']> & {
    metadata: Record<string, { description?: string; tags?: string[] }>
  } {
    const metadata: Record<string, { description?: string; tags?: string[] }> = {}
    for (const [id, meta] of this.nodeMetadata) {
      metadata[id] = meta
    }
    return {
      ...this.executor.toJSON(),
      metadata,
    }
  }
}

// ============================================================================
// Convenience functions
// ============================================================================

/**
 * Create a new TopologicalExecutor
 */
export function createExecutor<TInput = unknown>(
  config?: ExecutorConfig
): TopologicalExecutor<TInput> {
  return new TopologicalExecutor<TInput>(config)
}

/**
 * Create a new DurableGraph
 */
export function createGraph<TInput = unknown>(config?: ExecutorConfig): DurableGraph<TInput> {
  return new DurableGraph<TInput>(config)
}
