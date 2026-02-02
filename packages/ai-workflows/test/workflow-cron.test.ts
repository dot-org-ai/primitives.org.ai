import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Workflow } from '../src/workflow.js'
import { clearEventHandlers } from '../src/on.js'
import { clearScheduleHandlers, setCronConverter } from '../src/every.js'
import { stopAllCronJobs } from '../src/cron-scheduler.js'

describe('Workflow cron scheduling', () => {
  beforeEach(() => {
    clearEventHandlers()
    clearScheduleHandlers()
    stopAllCronJobs()
    vi.useFakeTimers()
  })

  afterEach(() => {
    stopAllCronJobs()
    vi.useRealTimers()
  })

  describe('$.every with cron patterns', () => {
    it('should execute cron schedule at correct time', async () => {
      const handler = vi.fn()

      // Set to Monday 8:55am
      vi.setSystemTime(new Date('2024-01-15T08:55:00'))

      const workflow = Workflow(($) => {
        // Every hour at minute 0 (cron: 0 * * * *)
        $.every.hour(handler)
      })

      await workflow.start()

      // Advance 5 minutes to 9:00am (next hour boundary)
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(handler).toHaveBeenCalledTimes(1)

      // Advance another hour to 10:00am
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(handler).toHaveBeenCalledTimes(2)

      await workflow.stop()
    })

    it('should execute day-specific schedule ($.every.Monday)', async () => {
      const handler = vi.fn()

      // Set to Sunday 11pm
      vi.setSystemTime(new Date('2024-01-14T23:00:00'))

      const workflow = Workflow(($) => {
        // Every Monday at midnight (cron: 0 0 * * 1)
        $.every.Monday(handler)
      })

      await workflow.start()

      // Advance 1 hour to Monday midnight
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)

      expect(handler).toHaveBeenCalledTimes(1)

      await workflow.stop()
    })

    it('should execute day+time schedule ($.every.Monday.at9am)', async () => {
      const handler = vi.fn()

      // Set to Monday 8:30am
      vi.setSystemTime(new Date('2024-01-15T08:30:00'))

      const workflow = Workflow(($) => {
        // Every Monday at 9am (cron: 0 9 * * 1)
        $.every.Monday.at9am(handler)
      })

      await workflow.start()

      // Advance 30 minutes to 9:00am
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000)

      expect(handler).toHaveBeenCalledTimes(1)

      await workflow.stop()
    })

    it('should handle weekday schedule', async () => {
      const handler = vi.fn()

      // Set to Monday 8:55am
      vi.setSystemTime(new Date('2024-01-15T08:55:00'))

      const workflow = Workflow(($) => {
        $.every.weekday.at9am(handler)
      })

      await workflow.start()

      // Advance 5 minutes to 9am
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(handler).toHaveBeenCalledTimes(1)

      await workflow.stop()
    })

    it('should stop cron jobs on workflow stop', async () => {
      const handler = vi.fn()

      vi.setSystemTime(new Date('2024-01-15T08:55:00'))

      const workflow = Workflow(($) => {
        $.every.hour(handler)
      })

      await workflow.start()

      // Advance to next hour
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      expect(handler).toHaveBeenCalledTimes(1)

      // Stop workflow
      await workflow.stop()

      // Advance another hour - should NOT call handler
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
      expect(handler).toHaveBeenCalledTimes(1) // Still 1
    })

    it('should handle multiple cron schedules', async () => {
      const hourlyHandler = vi.fn()
      const dailyHandler = vi.fn()

      // Set to 8:55am
      vi.setSystemTime(new Date('2024-01-15T08:55:00'))

      const workflow = Workflow(($) => {
        $.every.hour(hourlyHandler)
        $.every.day(dailyHandler)
      })

      await workflow.start()

      // Advance to 9:00am (hourly triggers)
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      expect(hourlyHandler).toHaveBeenCalledTimes(1)
      expect(dailyHandler).toHaveBeenCalledTimes(0)

      await workflow.stop()
    })

    it('should track schedule execution in history', async () => {
      vi.setSystemTime(new Date('2024-01-15T08:55:00'))

      const workflow = Workflow(($) => {
        $.every.hour(async ($) => {
          $.log('Hourly task')
        })
      })

      await workflow.start()

      // Advance to 9:00am
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      // Check history has schedule entry
      const history = workflow.state.history
      const scheduleEntries = history.filter((h) => h.type === 'schedule')
      expect(scheduleEntries.length).toBeGreaterThanOrEqual(1)

      await workflow.stop()
    })
  })

  describe('$.every with natural language', () => {
    it('should convert natural language to cron and execute', async () => {
      const handler = vi.fn()

      // Set up AI converter
      setCronConverter(async (desc) => {
        if (desc === 'every weekday morning') {
          return '0 9 * * 1-5'
        }
        throw new Error(`Unknown: ${desc}`)
      })

      // Set to Monday 8:55am
      vi.setSystemTime(new Date('2024-01-15T08:55:00'))

      const workflow = Workflow(($) => {
        $.every('every weekday morning', handler)
      })

      await workflow.start()

      // Wait for async natural language parsing
      await vi.advanceTimersByTimeAsync(100)

      // Advance to 9:00am
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(handler).toHaveBeenCalledTimes(1)

      await workflow.stop()
    })
  })

  describe('mixed schedules (interval + cron)', () => {
    it('should support both interval and cron schedules', async () => {
      const intervalHandler = vi.fn()
      const cronHandler = vi.fn()

      vi.setSystemTime(new Date('2024-01-15T08:55:00'))

      const workflow = Workflow(($) => {
        // Interval-based: every 30 seconds
        $.every.seconds(30)(intervalHandler)
        // Cron-based: every hour
        $.every.hour(cronHandler)
      })

      await workflow.start()

      // Advance 30 seconds - interval triggers
      await vi.advanceTimersByTimeAsync(30 * 1000)
      expect(intervalHandler).toHaveBeenCalledTimes(1)
      expect(cronHandler).toHaveBeenCalledTimes(0)

      // Advance to next hour
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 30 * 1000)
      expect(cronHandler).toHaveBeenCalledTimes(1)

      await workflow.stop()
    })
  })

  describe('timer count', () => {
    it('should include cron jobs in timer count', async () => {
      const workflow = Workflow(($) => {
        $.every.seconds(10)(() => {})
        $.every.hour(() => {})
        $.every.Monday.at9am(() => {})
      })

      await workflow.start()

      // Should have 3 schedules (1 interval + 2 cron)
      expect(workflow.timerCount).toBe(3)

      await workflow.stop()

      expect(workflow.timerCount).toBe(0)
    })
  })
})
