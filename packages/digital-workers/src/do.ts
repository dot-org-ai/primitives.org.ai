/**
 * Task execution functionality for digital workers
 */

import { define } from 'ai-functions'
import type { TaskResult, DoOptions } from './types.js'

/**
 * Execute a task
 *
 * Routes tasks to appropriate workers (AI or human) based on complexity
 * and requirements. Handles retries, timeouts, and background execution.
 *
 * @param task - Description of the task to execute
 * @param options - Execution options (retries, timeout, background, etc.)
 * @returns Promise resolving to task result
 *
 * @example
 * ```ts
 * // Execute a simple task
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
 * // Execute with retries
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
 * // Execute in background
 * const result = await do('Process large dataset', {
 *   background: true,
 *   context: {
 *     dataset: 'customer_transactions.csv',
 *     outputFormat: 'parquet',
 *   },
 * })
 * ```
 */
export async function doTask<T = unknown>(
  task: string,
  options: DoOptions = {}
): Promise<TaskResult<T>> {
  const {
    maxRetries = 0,
    timeout,
    background = false,
    context,
  } = options

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
      const response = await Promise.race([
        taskFn.call({ task, contextInfo: context ? JSON.stringify(context) : '' }),
        timeout
          ? new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Task timeout')), timeout)
            )
          : new Promise(() => {}), // Never resolves if no timeout
      ]) as unknown

      const typedResponse = response as { result: T; steps?: Array<{ action: string; result: unknown }> }

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
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, retries) * 1000)
        )
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
    if (!result.success && !options.context?.continueOnError) {
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
