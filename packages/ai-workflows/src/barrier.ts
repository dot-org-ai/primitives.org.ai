/**
 * Barrier/Join semantics for parallel step coordination
 *
 * Provides synchronization primitives for coordinating parallel workflow steps:
 * - waitForAll() - wait for all steps to complete
 * - waitForAny(n) - wait for N of M steps to complete
 * - Barrier class - manual synchronization point
 * - withConcurrencyLimit() - limit concurrent executions
 */

/**
 * Progress information for a barrier
 */
export interface BarrierProgress<T = unknown> {
  /** Number of participants that have arrived */
  arrived: number
  /** Expected number of participants */
  expected: number
  /** Percentage complete (0-100) */
  percentage: number
  /** Most recently arrived value */
  latest?: T
}

/**
 * Options for barrier creation
 */
export interface BarrierOptions<T = unknown> {
  /** Timeout in milliseconds */
  timeout?: number
  /** AbortSignal for cancellation */
  signal?: AbortSignal
  /** Progress callback */
  onProgress?: (progress: BarrierProgress<T>) => void
}

/**
 * Options for waitForAll
 */
export interface WaitForAllOptions {
  /** Timeout in milliseconds */
  timeout?: number
  /** AbortSignal for cancellation */
  signal?: AbortSignal
}

/**
 * Options for waitForAny
 */
export interface WaitForAnyOptions {
  /** Timeout in milliseconds */
  timeout?: number
  /** AbortSignal for cancellation */
  signal?: AbortSignal
  /** Return partial results on timeout instead of throwing */
  returnPartialOnTimeout?: boolean
}

/**
 * Result from waitForAny
 */
export interface WaitForAnyResult<T> {
  /** Completed values */
  completed: T[]
  /** Number of still pending promises */
  pending: number[]
  /** Whether the operation timed out */
  timedOut?: boolean
}

/**
 * Options for concurrency limiting
 */
export interface ConcurrencyOptions {
  /** Collect errors instead of failing fast */
  collectErrors?: boolean
}

/**
 * Result type for barrier operations
 */
export interface BarrierResult<T> {
  values: T[]
  timedOut: boolean
}

/**
 * Error thrown when a barrier times out
 */
export class BarrierTimeoutError extends Error {
  public readonly timeout: number
  public readonly arrived: number
  public readonly expected: number

  constructor(timeout: number, arrived: number, expected: number) {
    super(`Barrier timeout after ${timeout}ms: ${arrived}/${expected} participants arrived`)
    this.name = 'BarrierTimeoutError'
    this.timeout = timeout
    this.arrived = arrived
    this.expected = expected
  }
}

/**
 * Barrier class for manual synchronization
 */
export class Barrier<T = unknown> {
  private readonly _expected: number
  private readonly _options: BarrierOptions<T>
  private _arrived: T[] = []
  private _waitResolve: ((values: T[]) => void) | null = null
  private _waitReject: ((error: Error) => void) | null = null
  private _timeoutId: ReturnType<typeof setTimeout> | null = null
  private _cancelled = false
  private _cancelError: Error | null = null
  private _abortHandler: (() => void) | null = null

  constructor(expectedCount: number, options: BarrierOptions<T> = {}) {
    this._expected = expectedCount
    this._options = options

    // Set up abort signal listener with proper cleanup tracking
    if (options.signal) {
      this._abortHandler = () => {
        this.cancel(new Error('Operation aborted'))
      }
      options.signal.addEventListener('abort', this._abortHandler, { once: true })
    }
  }

  /**
   * Number of expected participants
   */
  get expectedCount(): number {
    return this._expected
  }

  /**
   * Number of participants that have arrived
   */
  get arrivedCount(): number {
    return this._arrived.length
  }

  /**
   * Whether all expected participants have arrived
   */
  get isComplete(): boolean {
    return this._arrived.length >= this._expected
  }

  /**
   * Record a participant's arrival at the barrier
   */
  arrive(value: T): void {
    if (this._cancelled) {
      return
    }

    this._arrived.push(value)

    // Emit progress
    if (this._options.onProgress) {
      this._options.onProgress(this.getProgress())
    }

    // Check if barrier is complete
    if (this.isComplete && this._waitResolve) {
      this._clearTimeout()
      this._waitResolve([...this._arrived])
      this._waitResolve = null
      this._waitReject = null
    }
  }

  /**
   * Wait for all participants to arrive
   */
  wait(): Promise<T[]> {
    if (this._cancelled && this._cancelError) {
      return Promise.reject(this._cancelError)
    }

    if (this.isComplete) {
      return Promise.resolve([...this._arrived])
    }

    return new Promise<T[]>((resolve, reject) => {
      this._waitResolve = resolve
      this._waitReject = reject

      // Set up timeout if specified
      if (this._options.timeout) {
        this._timeoutId = setTimeout(() => {
          if (this._waitReject) {
            const error = new BarrierTimeoutError(
              this._options.timeout!,
              this._arrived.length,
              this._expected
            )
            this._waitReject(error)
            this._waitResolve = null
            this._waitReject = null
          }
        }, this._options.timeout)
      }
    })
  }

  /**
   * Reset the barrier for reuse
   */
  reset(): void {
    this._clearTimeout()
    this._clearAbortHandler()
    this._arrived = []
    this._waitResolve = null
    this._waitReject = null
    this._cancelled = false
    this._cancelError = null
  }

  /**
   * Cancel the barrier operation
   */
  cancel(error: Error): void {
    this._cancelled = true
    this._cancelError = error
    this._clearTimeout()
    this._clearAbortHandler()

    if (this._waitReject) {
      this._waitReject(error)
      this._waitResolve = null
      this._waitReject = null
    }
  }

  /**
   * Dispose of the barrier and cleanup all resources
   */
  dispose(): void {
    this._clearTimeout()
    this._clearAbortHandler()
    this._waitResolve = null
    this._waitReject = null
  }

  /**
   * Get current progress information
   */
  getProgress(): BarrierProgress<T> {
    const latestValue = this._arrived[this._arrived.length - 1]
    return {
      arrived: this._arrived.length,
      expected: this._expected,
      percentage: Math.round((this._arrived.length / this._expected) * 100),
      ...(latestValue !== undefined && { latest: latestValue }),
    }
  }

  private _clearTimeout(): void {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId)
      this._timeoutId = null
    }
  }

  private _clearAbortHandler(): void {
    if (this._abortHandler && this._options.signal) {
      this._options.signal.removeEventListener('abort', this._abortHandler)
      this._abortHandler = null
    }
  }
}

/**
 * Create a new barrier
 */
export function createBarrier<T = unknown>(
  expectedCount: number,
  options: BarrierOptions<T> = {}
): Barrier<T> {
  return new Barrier<T>(expectedCount, options)
}

/**
 * Wait for all promises to complete
 *
 * Similar to Promise.all but with timeout and cancellation support
 */
export async function waitForAll<T>(
  promises: Promise<T>[],
  options: WaitForAllOptions = {}
): Promise<T[]> {
  if (promises.length === 0) {
    return []
  }

  const { timeout, signal } = options

  // Track cleanup handlers
  let abortHandler: (() => void) | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const cleanup = () => {
    if (abortHandler && signal) {
      signal.removeEventListener('abort', abortHandler)
      abortHandler = null
    }
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  // Build array of promises to race against
  const racers: Promise<T[]>[] = [Promise.all(promises)]

  // Add abort signal handling
  if (signal) {
    const abortPromise = new Promise<never>((_, reject) => {
      abortHandler = () => {
        reject(new Error('Operation aborted'))
      }
      if (signal.aborted) {
        abortHandler()
      } else {
        signal.addEventListener('abort', abortHandler, { once: true })
      }
    })
    racers.push(abortPromise)
  }

  // Add timeout if specified
  if (timeout) {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new BarrierTimeoutError(timeout, 0, promises.length))
      }, timeout)
    })
    racers.push(timeoutPromise)
  }

  try {
    return await Promise.race(racers)
  } finally {
    cleanup()
  }
}

/**
 * Wait for N of M promises to complete
 */
export async function waitForAny<T>(
  n: number,
  promises: Promise<T>[],
  options: WaitForAnyOptions = {}
): Promise<WaitForAnyResult<T>> {
  const { timeout, returnPartialOnTimeout = false } = options

  if (n === 0) {
    return {
      completed: [],
      pending: promises.map((_, i) => i),
    }
  }

  if (n > promises.length) {
    throw new Error(`Cannot wait for ${n} of ${promises.length} promises`)
  }

  const completed: T[] = []
  const errors: Error[] = []
  const pendingIndices = new Set(promises.map((_, i) => i))
  let resolved = false
  let timedOut = false

  return new Promise<WaitForAnyResult<T>>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const checkComplete = () => {
      if (resolved) return

      // Check if we have enough completions
      if (completed.length >= n) {
        resolved = true
        if (timeoutId) clearTimeout(timeoutId)
        resolve({
          completed: [...completed],
          pending: [...pendingIndices],
        })
        return
      }

      // Check if it's impossible to complete (too many failures)
      const remaining = pendingIndices.size
      const canComplete = completed.length + remaining
      if (canComplete < n) {
        resolved = true
        if (timeoutId) clearTimeout(timeoutId)
        reject(new Error(`Cannot complete: need ${n} but only ${canComplete} can succeed`))
      }
    }

    // Track each promise
    promises.forEach((promise, index) => {
      promise
        .then((value) => {
          if (resolved) return
          completed.push(value)
          pendingIndices.delete(index)
          checkComplete()
        })
        .catch((error) => {
          if (resolved) return
          errors.push(error)
          pendingIndices.delete(index)
          checkComplete()
        })
    })

    // Set up timeout
    if (timeout) {
      timeoutId = setTimeout(() => {
        if (resolved) return
        timedOut = true

        if (returnPartialOnTimeout) {
          resolved = true
          resolve({
            completed: [...completed],
            pending: [...pendingIndices],
            timedOut: true,
          })
        } else {
          resolved = true
          reject(new BarrierTimeoutError(timeout, completed.length, n))
        }
      }, timeout)
    }
  })
}

/**
 * Execute tasks with a concurrency limit
 */
export async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  options: ConcurrencyOptions = {}
): Promise<(T | Error)[]> {
  const { collectErrors = false } = options

  if (tasks.length === 0) {
    return []
  }

  const results: (T | Error)[] = new Array(tasks.length)
  let currentIndex = 0
  let hasError = false
  let firstError: Error | null = null

  const runTask = async (): Promise<void> => {
    while (currentIndex < tasks.length) {
      const index = currentIndex++
      const task = tasks[index]

      if (!task) continue

      try {
        results[index] = await task()
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        if (collectErrors) {
          results[index] = err
        } else {
          hasError = true
          if (!firstError) firstError = err
          throw err
        }
      }

      if (hasError && !collectErrors) {
        break
      }
    }
  }

  // Start workers up to the limit
  const workers = Array(Math.min(limit, tasks.length))
    .fill(null)
    .map(() => runTask())

  if (collectErrors) {
    await Promise.allSettled(workers)
  } else {
    try {
      await Promise.all(workers)
    } catch {
      // Re-throw the first error
      if (firstError) throw firstError
    }
  }

  return results
}
