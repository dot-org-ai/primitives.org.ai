import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createCronJob,
  stopCronJob,
  startCronJob,
  getActiveCronJobs,
  stopAllCronJobs,
  getActiveCronJobCount,
  schedule,
} from '../src/cron-scheduler.js'

describe('cron-scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stopAllCronJobs() // Clean up any existing jobs
  })

  afterEach(() => {
    stopAllCronJobs()
    vi.useRealTimers()
  })

  describe('createCronJob', () => {
    it('should create a cron job with valid expression', () => {
      const handler = vi.fn()
      const job = createCronJob('0 * * * *', handler)

      expect(job).toBeDefined()
      expect(job.expression).toBe('0 * * * *')
      expect(job.stopped).toBe(false)
      expect(job.running).toBe(false)
    })

    it('should allow custom job ID', () => {
      const job = createCronJob('* * * * *', () => {}, { id: 'my-custom-job' })
      expect(job.id).toBe('my-custom-job')
    })

    it('should add job to active jobs', () => {
      const job = createCronJob('* * * * *', () => {})
      const active = getActiveCronJobs()
      expect(active).toContain(job)
    })

    it('should calculate next run time', () => {
      const job = createCronJob('0 * * * *', () => {})
      expect(job.nextRun).not.toBeNull()
      expect(job.nextRun!.getMinutes()).toBe(0)
    })

    it('should execute handler on cron schedule', async () => {
      const handler = vi.fn()
      // Every minute
      createCronJob('* * * * *', handler)

      // Advance time to next minute
      await vi.advanceTimersByTimeAsync(60 * 1000)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should execute multiple times on recurring schedule', async () => {
      const handler = vi.fn()
      // Every minute
      createCronJob('* * * * *', handler)

      // Advance time by 3 minutes
      await vi.advanceTimersByTimeAsync(60 * 1000)
      await vi.advanceTimersByTimeAsync(60 * 1000)
      await vi.advanceTimersByTimeAsync(60 * 1000)

      expect(handler).toHaveBeenCalledTimes(3)
    })

    it('should handle async handlers', async () => {
      const results: number[] = []
      const handler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        results.push(Date.now())
      }

      createCronJob('* * * * *', handler)

      await vi.advanceTimersByTimeAsync(60 * 1000)
      expect(results.length).toBeGreaterThanOrEqual(1)
    })

    it('should call error handler on error', async () => {
      const error = new Error('Test error')
      const handler = vi.fn(() => {
        throw error
      })
      const errorHandler = vi.fn()

      createCronJob('* * * * *', handler, { onError: errorHandler })

      await vi.advanceTimersByTimeAsync(60 * 1000)

      expect(handler).toHaveBeenCalled()
      expect(errorHandler).toHaveBeenCalledWith(error)
    })

    it('should continue scheduling after error', async () => {
      const handler = vi.fn(() => {
        throw new Error('Test error')
      })
      const errorHandler = vi.fn()

      createCronJob('* * * * *', handler, { onError: errorHandler })

      // Advance 3 minutes
      await vi.advanceTimersByTimeAsync(60 * 1000)
      await vi.advanceTimersByTimeAsync(60 * 1000)
      await vi.advanceTimersByTimeAsync(60 * 1000)

      // Handler should have been called 3 times despite errors
      expect(handler).toHaveBeenCalledTimes(3)
      expect(errorHandler).toHaveBeenCalledTimes(3)
    })

    it('should not start if startImmediately is false', () => {
      const handler = vi.fn()
      const job = createCronJob('* * * * *', handler, { startImmediately: false })

      expect(job.timer).toBeNull()
      expect(job.nextRun).toBeNull()
    })
  })

  describe('stopCronJob', () => {
    it('should stop a cron job', () => {
      const handler = vi.fn()
      const job = createCronJob('* * * * *', handler)

      stopCronJob(job)

      expect(job.stopped).toBe(true)
      expect(job.timer).toBeNull()
      expect(job.nextRun).toBeNull()
    })

    it('should remove job from active jobs', () => {
      const job = createCronJob('* * * * *', () => {})
      expect(getActiveCronJobCount()).toBe(1)

      stopCronJob(job)
      expect(getActiveCronJobCount()).toBe(0)
    })

    it('should prevent future executions', async () => {
      const handler = vi.fn()
      const job = createCronJob('* * * * *', handler)

      // Stop before first execution
      stopCronJob(job)

      await vi.advanceTimersByTimeAsync(60 * 1000)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('startCronJob', () => {
    it('should start a stopped job', () => {
      const handler = vi.fn()
      const job = createCronJob('* * * * *', handler, { startImmediately: false })

      expect(job.nextRun).toBeNull()

      startCronJob(job)

      expect(job.stopped).toBe(false)
      expect(job.nextRun).not.toBeNull()
    })

    it('should resume execution after restart', async () => {
      const handler = vi.fn()
      const job = createCronJob('* * * * *', handler)

      stopCronJob(job)
      await vi.advanceTimersByTimeAsync(60 * 1000)
      expect(handler).not.toHaveBeenCalled()

      startCronJob(job)
      await vi.advanceTimersByTimeAsync(60 * 1000)
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('getActiveCronJobs', () => {
    it('should return all active jobs', () => {
      const job1 = createCronJob('* * * * *', () => {})
      const job2 = createCronJob('0 * * * *', () => {})

      const active = getActiveCronJobs()
      expect(active).toHaveLength(2)
      expect(active).toContain(job1)
      expect(active).toContain(job2)
    })

    it('should not include stopped jobs', () => {
      const job1 = createCronJob('* * * * *', () => {})
      const job2 = createCronJob('0 * * * *', () => {})

      stopCronJob(job1)

      const active = getActiveCronJobs()
      expect(active).toHaveLength(1)
      expect(active).not.toContain(job1)
      expect(active).toContain(job2)
    })
  })

  describe('stopAllCronJobs', () => {
    it('should stop all active jobs', () => {
      createCronJob('* * * * *', () => {})
      createCronJob('0 * * * *', () => {})
      createCronJob('0 0 * * *', () => {})

      expect(getActiveCronJobCount()).toBe(3)

      stopAllCronJobs()

      expect(getActiveCronJobCount()).toBe(0)
    })
  })

  describe('getActiveCronJobCount', () => {
    it('should return count of active jobs', () => {
      expect(getActiveCronJobCount()).toBe(0)

      createCronJob('* * * * *', () => {})
      expect(getActiveCronJobCount()).toBe(1)

      createCronJob('0 * * * *', () => {})
      expect(getActiveCronJobCount()).toBe(2)
    })
  })

  describe('schedule', () => {
    it('should be an alias for createCronJob', () => {
      const handler = vi.fn()
      const job = schedule('0 9 * * 1', handler)

      expect(job).toBeDefined()
      expect(job.expression).toBe('0 9 * * 1')
    })

    it('should support options', () => {
      const errorHandler = vi.fn()
      const job = schedule('* * * * *', () => {}, {
        id: 'my-schedule',
        onError: errorHandler,
      })

      expect(job.id).toBe('my-schedule')
      expect(job.onError).toBe(errorHandler)
    })
  })

  describe('complex cron expressions', () => {
    it('should handle */5 * * * * (every 5 minutes)', async () => {
      const handler = vi.fn()
      // Set a specific time: 10:02
      vi.setSystemTime(new Date('2024-01-15T10:02:00'))

      createCronJob('*/5 * * * *', handler)

      // Advance to 10:05 (next 5-minute mark)
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000)

      expect(handler).toHaveBeenCalledTimes(1)

      // Advance another 5 minutes to 10:10
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should handle 0 9 * * 1-5 (weekdays at 9am)', async () => {
      const handler = vi.fn()
      // Set to Monday 8am
      vi.setSystemTime(new Date('2024-01-15T08:00:00'))

      createCronJob('0 9 * * 1-5', handler)

      // Advance 1 hour to 9am Monday
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})
