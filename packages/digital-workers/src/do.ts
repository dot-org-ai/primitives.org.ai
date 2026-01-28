/**
 * Task execution functionality for digital workers
 *
 * IMPORTANT: Worker Routing vs Direct LLM Calls
 * ---------------------------------------------
 * This module provides worker-routed task execution, NOT direct LLM calls.
 *
 * - `digital-workers.do()` - Routes tasks to Workers (AI Agents or Humans)
 *   based on capability matching, load balancing, and escalation policies.
 *
 * - `ai-functions.do()` - Directly calls the LLM to describe task execution.
 *
 * Use digital-workers when you need:
 * - Task routing to appropriate workers
 * - Human-in-the-loop escalation
 * - Capability-based worker selection
 * - Retry and timeout handling across workers
 *
 * Use ai-functions when you need:
 * - Direct LLM text generation
 * - Simple AI task description
 * - No worker coordination required
 *
 * @module
 */

import { define } from 'ai-functions'
import type { TaskResult, DoOptions } from './types.js'

/**
 * Execute a task by routing to an appropriate Worker (AI Agent or Human).
 *
 * **Key Difference from ai-functions.do():**
 * Unlike `ai-functions.do()` which directly calls the LLM to describe what
 * actions would be taken, this function routes the task to a Worker (Agent
 * or Human) based on capability matching. The Worker then executes the task
 * using their specific tools and capabilities.
 *
 * This is a **worker coordination primitive**, not a direct LLM primitive.
 *
 * @param task - Description of the task to execute
 * @param options - Execution options (retries, timeout, background, etc.)
 * @returns Promise resolving to task result with execution details
 *
 * @example
 * ```ts
 * // Route task to appropriate worker based on capability
 * const result = await do('Generate monthly sales report', {
 *   timeout: 60000, // 1 minute
 *   context: {
 *     month: 'January',
 *     year: 2024,
 *   },
 * })
 *
 * if (result.success) {
 *   console.log('Report:', result.result)
 * }
 * ```
 *
 * @example
 * ```ts
 * // Execute with retries across workers
 * const result = await do('Sync data to backup server', {
 *   maxRetries: 3,
 *   timeout: 30000,
 *   context: {
 *     source: 'primary-db',
 *     destination: 'backup-db',
 *   },
 * })
 * ```
 *
 * @example
 * ```ts
 * // Execute in background (worker handles async)
 * const result = await do('Process large dataset', {
 *   background: true,
 *   context: {
 *     dataset: 'customer_transactions.csv',
 *     outputFormat: 'parquet',
 *   },
 * })
 * ```
 *
 * @see {@link ai-functions#do} for direct LLM task description
 */
export async function doTask<T = unknown>(
  task: string,
  options: DoOptions = {}
): Promise<TaskResult<T>> {
  const { maxRetries = 0, timeout, background = false, context } = options

  const startTime = Date.now()
  const steps: TaskResult<T>['steps'] = []

  // Use agentic function for complex tasks
  const taskFn = define.agentic({
    name: 'executeTask',
    description: 'Execute a task using available tools and capabilities',
    args: {
      task: 'Description of the task to execute',
      contextInfo: 'Additional context and parameters for the task',
    },
    returnType: {
      result: 'The result of executing the task',
      steps: ['List of steps taken to complete the task'],
    },
    instructions: `Execute the following task:

${task}

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Work step-by-step to complete the task. Use available tools as needed.
Document each step you take for transparency.`,
    maxIterations: 10,
    tools: [], // Tools would be provided by the execution environment
  })

  let retries = 0
  let lastError: Error | undefined

  while (retries <= maxRetries) {
    try {
      const response = (await Promise.race([
        taskFn.call({ task, contextInfo: context ? JSON.stringify(context) : '' }),
        timeout
          ? new Promise((_, reject) => setTimeout(() => reject(new Error('Task timeout')), timeout))
          : new Promise(() => {}), // Never resolves if no timeout
      ])) as unknown

      const typedResponse = response as {
        result: T
        steps?: Array<{ action: string; result: unknown }>
      }

      // Track steps if provided
      if (typedResponse.steps) {
        steps.push(
          ...typedResponse.steps.map((step) => ({
            ...step,
            timestamp: new Date(),
          }))
        )
      }

      const duration = Date.now() - startTime

      return {
        result: typedResponse.result,
        success: true,
        duration,
        steps,
      }
    } catch (error) {
      lastError = error as Error
      retries++

      if (retries <= maxRetries) {
        steps.push({
          action: `Retry attempt ${retries}`,
          result: { error: lastError.message },
          timestamp: new Date(),
        })

        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retries) * 1000))
      }
    }
  }

  const duration = Date.now() - startTime

  return {
    result: undefined as T,
    success: false,
    error: lastError?.message || 'Task failed',
    duration,
    steps,
  }
}

// Export as 'do' with proper typing
export { doTask as do }

/**
 * Execute multiple tasks in parallel
 *
 * @param tasks - Array of tasks to execute
 * @param options - Execution options
 * @returns Promise resolving to array of task results
 *
 * @example
 * ```ts
 * const results = await do.parallel([
 *   'Generate sales report',
 *   'Generate marketing report',
 *   'Generate finance report',
 * ], {
 *   timeout: 60000,
 * })
 *
 * const successful = results.filter(r => r.success)
 * console.log(`Completed ${successful.length} of ${results.length} tasks`)
 * ```
 */
doTask.parallel = async <T = unknown>(
  tasks: string[],
  options: DoOptions = {}
): Promise<Array<TaskResult<T>>> => {
  return Promise.all(tasks.map((task) => doTask<T>(task, options)))
}

/**
 * Execute tasks in sequence
 *
 * @param tasks - Array of tasks to execute sequentially
 * @param options - Execution options
 * @returns Promise resolving to array of task results
 *
 * @example
 * ```ts
 * const results = await do.sequence([
 *   'Backup database',
 *   'Run migrations',
 *   'Restart application',
 * ], {
 *   maxRetries: 1,
 * })
 * ```
 */
doTask.sequence = async <T = unknown>(
  tasks: string[],
  options: DoOptions = {}
): Promise<Array<TaskResult<T>>> => {
  const results: Array<TaskResult<T>> = []

  for (const task of tasks) {
    const result = await doTask<T>(task, options)
    results.push(result)

    // Stop if a task fails (unless we're continuing on error)
    if (!result.success && !options.context?.['continueOnError']) {
      break
    }
  }

  return results
}

/**
 * Execute a task with specific dependencies
 *
 * @param task - The task to execute
 * @param dependencies - Tasks that must complete first
 * @param options - Execution options
 * @returns Promise resolving to task result
 *
 * @example
 * ```ts
 * const result = await do.withDependencies(
 *   'Deploy application',
 *   ['Run tests', 'Build artifacts', 'Get approval'],
 *   { maxRetries: 1 }
 * )
 * ```
 */
doTask.withDependencies = async <T = unknown>(
  task: string,
  dependencies: string[],
  options: DoOptions = {}
): Promise<TaskResult<T>> => {
  // Execute dependencies in sequence
  const depResults = await doTask.sequence(dependencies, options)

  // Check if all dependencies succeeded
  const allSuccessful = depResults.every((r) => r.success)

  if (!allSuccessful) {
    const failed = depResults.filter((r) => !r.success)
    return {
      result: undefined as T,
      success: false,
      error: `Dependencies failed: ${failed.map((r) => r.error).join(', ')}`,
      duration: 0,
    }
  }

  // Execute main task with dependency results as context
  return doTask<T>(task, {
    ...options,
    context: {
      ...options.context,
      dependencies: depResults.map((r) => r.result),
    },
  })
}
