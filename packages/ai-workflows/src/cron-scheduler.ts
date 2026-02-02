/**
 * Cron Scheduler
 *
 * Provides scheduling functionality for cron expressions using accurate
 * time-based scheduling rather than polling.
 *
 * Uses a self-adjusting timer approach:
 * 1. Calculate time until next cron occurrence
 * 2. Set a timeout for that duration
 * 3. Execute handler and schedule next occurrence
 *
 * This is more accurate and efficient than setInterval polling.
 */

import { parseCron, getNextCronDate, type ParsedCron } from './cron-parser.js'
import { getLogger } from './logger.js'

/**
 * Scheduled job handle
 */
export interface CronJob {
  /** Unique job ID */
  id: string
  /** Original cron expression */
  expression: string
  /** Parsed cron data */
  cron: ParsedCron
  /** Handler function */
  handler: () => void | Promise<void>
  /** Current timer reference */
  timer: NodeJS.Timeout | null
  /** Next scheduled run time */
  nextRun: Date | null
  /** Whether the job is running */
  running: boolean
  /** Whether the job is stopped */
  stopped: boolean
  /** Error handler */
  onError?: (error: Error) => void
}

/**
 * Job counter for unique IDs
 */
let jobCounter = 0

/**
 * Active cron jobs
 */
const activeJobs: Map<string, CronJob> = new Map()

/**
 * Create a cron job
 *
 * @param expression - Cron expression (5 or 6 fields)
 * @param handler - Function to execute on each occurrence
 * @param options - Optional configuration
 * @returns CronJob handle for managing the job
 *
 * @example
 * ```ts
 * // Run every hour at minute 0
 * const job = createCronJob('0 * * * *', () => {
 *   console.log('Hourly task')
 * })
 *
 * // Run Monday at 9am
 * const monday9am = createCronJob('0 9 * * 1', async () => {
 *   await sendReport()
 * })
 *
 * // Stop the job
 * job.stop()
 * ```
 */
export function createCronJob(
  expression: string,
  handler: () => void | Promise<void>,
  options: {
    id?: string
    onError?: (error: Error) => void
    startImmediately?: boolean
  } = {}
): CronJob {
  const cron = parseCron(expression)
  const id = options.id ?? `cron-job-${++jobCounter}`

  const job: CronJob = {
    id,
    expression,
    cron,
    handler,
    timer: null,
    nextRun: null,
    running: false,
    stopped: false,
    ...(options.onError !== undefined && { onError: options.onError }),
  }

  activeJobs.set(id, job)

  // Start immediately by default
  if (options.startImmediately !== false) {
    scheduleNext(job)
  }

  return job
}

/**
 * Schedule the next execution of a cron job
 */
function scheduleNext(job: CronJob): void {
  if (job.stopped) return

  const now = new Date()
  const nextRun = getNextCronDate(job.cron, now)

  if (!nextRun) {
    getLogger().warn(`[cron] Could not calculate next run for job ${job.id}`)
    return
  }

  job.nextRun = nextRun
  const delay = nextRun.getTime() - now.getTime()

  // Clear any existing timer
  if (job.timer) {
    clearTimeout(job.timer)
  }

  // Schedule next execution
  job.timer = setTimeout(async () => {
    if (job.stopped) return

    job.running = true
    try {
      await job.handler()
    } catch (error) {
      if (job.onError) {
        job.onError(error instanceof Error ? error : new Error(String(error)))
      } else {
        getLogger().error(`[cron] Error in job ${job.id}:`, error)
      }
    } finally {
      job.running = false
      // Schedule next occurrence
      scheduleNext(job)
    }
  }, delay)
}

/**
 * Stop a cron job
 */
export function stopCronJob(job: CronJob): void {
  job.stopped = true
  if (job.timer) {
    clearTimeout(job.timer)
    job.timer = null
  }
  job.nextRun = null
  activeJobs.delete(job.id)
}

/**
 * Start a stopped cron job
 */
export function startCronJob(job: CronJob): void {
  job.stopped = false
  scheduleNext(job)
  activeJobs.set(job.id, job)
}

/**
 * Get all active cron jobs
 */
export function getActiveCronJobs(): CronJob[] {
  return Array.from(activeJobs.values())
}

/**
 * Stop all active cron jobs
 */
export function stopAllCronJobs(): void {
  for (const job of activeJobs.values()) {
    stopCronJob(job)
  }
}

/**
 * Get the count of active cron jobs
 */
export function getActiveCronJobCount(): number {
  return activeJobs.size
}

/**
 * Cron job registry object for external access
 */
export const cronJobRegistry = {
  create: createCronJob,
  stop: stopCronJob,
  start: startCronJob,
  getActive: getActiveCronJobs,
  getActiveCount: getActiveCronJobCount,
  stopAll: stopAllCronJobs,
}

/**
 * Schedule type for cron-based intervals
 * Used to convert schedule intervals to cron jobs
 */
export interface CronScheduleOptions {
  /** Unique identifier for the schedule */
  id?: string
  /** Error handler */
  onError?: (error: Error) => void
}

/**
 * Create a schedule from a cron expression or well-known pattern
 *
 * @param expression - Cron expression or known pattern name
 * @param handler - Function to execute
 * @param options - Optional configuration
 * @returns CronJob handle
 */
export function schedule(
  expression: string,
  handler: () => void | Promise<void>,
  options: CronScheduleOptions = {}
): CronJob {
  return createCronJob(expression, handler, {
    ...(options.id !== undefined && { id: options.id }),
    ...(options.onError !== undefined && { onError: options.onError }),
    startImmediately: true,
  })
}
