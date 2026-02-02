import { describe, it, expect } from 'vitest'
import {
  parseCron,
  matchesCron,
  getNextCronDate,
  getNextCronMs,
  type ParsedCron,
} from '../src/cron-parser.js'

describe('parseCron', () => {
  describe('basic parsing', () => {
    it('should parse * * * * * (every minute)', () => {
      const cron = parseCron('* * * * *')
      expect(cron.minutes).toHaveLength(60) // 0-59
      expect(cron.hours).toHaveLength(24) // 0-23
      expect(cron.daysOfMonth).toHaveLength(31) // 1-31
      expect(cron.months).toHaveLength(12) // 1-12
      expect(cron.daysOfWeek).toHaveLength(7) // 0-6
    })

    it('should parse 0 * * * * (every hour at minute 0)', () => {
      const cron = parseCron('0 * * * *')
      expect(cron.minutes).toEqual([0])
      expect(cron.hours).toHaveLength(24)
    })

    it('should parse 0 9 * * * (every day at 9am)', () => {
      const cron = parseCron('0 9 * * *')
      expect(cron.minutes).toEqual([0])
      expect(cron.hours).toEqual([9])
    })

    it('should parse 0 9 * * 1 (every Monday at 9am)', () => {
      const cron = parseCron('0 9 * * 1')
      expect(cron.minutes).toEqual([0])
      expect(cron.hours).toEqual([9])
      expect(cron.daysOfWeek).toEqual([1])
    })

    it('should parse 0 0 1 * * (first of every month at midnight)', () => {
      const cron = parseCron('0 0 1 * *')
      expect(cron.minutes).toEqual([0])
      expect(cron.hours).toEqual([0])
      expect(cron.daysOfMonth).toEqual([1])
    })
  })

  describe('ranges', () => {
    it('should parse 0 9-17 * * * (every hour from 9am to 5pm)', () => {
      const cron = parseCron('0 9-17 * * *')
      expect(cron.hours).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
    })

    it('should parse 0 0 * * 1-5 (weekdays)', () => {
      const cron = parseCron('0 0 * * 1-5')
      expect(cron.daysOfWeek).toEqual([1, 2, 3, 4, 5])
    })
  })

  describe('lists', () => {
    it('should parse 0 9,12,17 * * * (at 9am, noon, and 5pm)', () => {
      const cron = parseCron('0 9,12,17 * * *')
      expect(cron.hours).toEqual([9, 12, 17])
    })

    it('should parse 0 0 * * 0,6 (weekends)', () => {
      const cron = parseCron('0 0 * * 0,6')
      expect(cron.daysOfWeek).toEqual([0, 6])
    })
  })

  describe('steps', () => {
    it('should parse */5 * * * * (every 5 minutes)', () => {
      const cron = parseCron('*/5 * * * *')
      expect(cron.minutes).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
    })

    it('should parse */15 * * * * (every 15 minutes)', () => {
      const cron = parseCron('*/15 * * * *')
      expect(cron.minutes).toEqual([0, 15, 30, 45])
    })

    it('should parse 0-30/5 * * * * (every 5 minutes for first half hour)', () => {
      const cron = parseCron('0-30/5 * * * *')
      expect(cron.minutes).toEqual([0, 5, 10, 15, 20, 25, 30])
    })

    it('should parse 0 */2 * * * (every 2 hours)', () => {
      const cron = parseCron('0 */2 * * *')
      expect(cron.hours).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22])
    })
  })

  describe('day names', () => {
    it('should parse 0 9 * * Mon (Monday at 9am)', () => {
      const cron = parseCron('0 9 * * Mon')
      expect(cron.daysOfWeek).toEqual([1])
    })

    it('should parse 0 9 * * Mon-Fri (weekdays)', () => {
      const cron = parseCron('0 9 * * Mon-Fri')
      expect(cron.daysOfWeek).toEqual([1, 2, 3, 4, 5])
    })

    it('should parse 0 9 * * Sat,Sun (weekends)', () => {
      const cron = parseCron('0 9 * * Sat,Sun')
      expect(cron.daysOfWeek).toEqual([0, 6])
    })
  })

  describe('month names', () => {
    it('should parse 0 0 1 Jan * (New Year)', () => {
      const cron = parseCron('0 0 1 Jan *')
      expect(cron.months).toEqual([1])
    })

    it('should parse 0 0 1 Jan,Jul * (Jan and July)', () => {
      const cron = parseCron('0 0 1 Jan,Jul *')
      expect(cron.months).toEqual([1, 7])
    })
  })

  describe('6-field expressions with seconds', () => {
    it('should parse * * * * * * (every second)', () => {
      const cron = parseCron('* * * * * *')
      expect(cron.seconds).toHaveLength(60)
    })

    it('should parse 0 0 9 * * 1 (Monday at 9am, second 0)', () => {
      const cron = parseCron('0 0 9 * * 1')
      expect(cron.seconds).toEqual([0])
      expect(cron.minutes).toEqual([0])
      expect(cron.hours).toEqual([9])
      expect(cron.daysOfWeek).toEqual([1])
    })

    it('should parse */10 * * * * * (every 10 seconds)', () => {
      const cron = parseCron('*/10 * * * * *')
      expect(cron.seconds).toEqual([0, 10, 20, 30, 40, 50])
    })
  })

  describe('error handling', () => {
    it('should throw for invalid field count', () => {
      expect(() => parseCron('* * *')).toThrow('expected 5 or 6 fields')
      expect(() => parseCron('* * * * * * *')).toThrow('expected 5 or 6 fields')
    })

    it('should throw for invalid field values', () => {
      expect(() => parseCron('60 * * * *')).toThrow('Invalid cron field value')
      expect(() => parseCron('* 24 * * *')).toThrow('Invalid cron field value')
      expect(() => parseCron('* * 32 * *')).toThrow('Invalid cron field value')
      expect(() => parseCron('* * * 13 *')).toThrow('Invalid cron field value')
      expect(() => parseCron('* * * * 7')).toThrow('Invalid cron field value')
    })
  })

  describe('wildcard tracking', () => {
    it('should track day-of-month wildcard', () => {
      const cron = parseCron('0 9 * * 1')
      expect(cron.dayOfMonthWildcard).toBe(true)
      expect(cron.dayOfWeekWildcard).toBe(false)
    })

    it('should track day-of-week wildcard', () => {
      const cron = parseCron('0 9 15 * *')
      expect(cron.dayOfMonthWildcard).toBe(false)
      expect(cron.dayOfWeekWildcard).toBe(true)
    })

    it('should track both wildcards', () => {
      const cron = parseCron('0 9 * * *')
      expect(cron.dayOfMonthWildcard).toBe(true)
      expect(cron.dayOfWeekWildcard).toBe(true)
    })
  })
})

describe('matchesCron', () => {
  it('should match * * * * * for any time', () => {
    const cron = parseCron('* * * * *')
    expect(matchesCron(new Date('2024-01-15T10:30:00'), cron)).toBe(true)
    expect(matchesCron(new Date('2024-06-20T23:59:00'), cron)).toBe(true)
  })

  it('should match specific minute', () => {
    const cron = parseCron('30 * * * *')
    expect(matchesCron(new Date('2024-01-15T10:30:00'), cron)).toBe(true)
    expect(matchesCron(new Date('2024-01-15T10:31:00'), cron)).toBe(false)
  })

  it('should match specific hour', () => {
    const cron = parseCron('0 9 * * *')
    expect(matchesCron(new Date('2024-01-15T09:00:00'), cron)).toBe(true)
    expect(matchesCron(new Date('2024-01-15T10:00:00'), cron)).toBe(false)
  })

  it('should match specific day of week', () => {
    const cron = parseCron('0 9 * * 1') // Monday
    // Jan 15, 2024 is a Monday
    expect(matchesCron(new Date('2024-01-15T09:00:00'), cron)).toBe(true)
    // Jan 16, 2024 is a Tuesday
    expect(matchesCron(new Date('2024-01-16T09:00:00'), cron)).toBe(false)
  })

  it('should match specific day of month', () => {
    const cron = parseCron('0 9 15 * *')
    expect(matchesCron(new Date('2024-01-15T09:00:00'), cron)).toBe(true)
    expect(matchesCron(new Date('2024-01-16T09:00:00'), cron)).toBe(false)
  })

  it('should match specific month', () => {
    const cron = parseCron('0 9 15 6 *') // June 15 at 9am
    expect(matchesCron(new Date('2024-06-15T09:00:00'), cron)).toBe(true)
    expect(matchesCron(new Date('2024-07-15T09:00:00'), cron)).toBe(false)
  })

  it('should use OR logic when both day-of-month and day-of-week are specified', () => {
    // 15th of month OR Monday
    const cron = parseCron('0 9 15 * 1')
    // Jan 15, 2024 is a Monday (matches both)
    expect(matchesCron(new Date('2024-01-15T09:00:00'), cron)).toBe(true)
    // Jan 22, 2024 is a Monday (day of week matches)
    expect(matchesCron(new Date('2024-01-22T09:00:00'), cron)).toBe(true)
    // Feb 15, 2024 is a Thursday (day of month matches)
    expect(matchesCron(new Date('2024-02-15T09:00:00'), cron)).toBe(true)
    // Jan 23, 2024 is a Tuesday, not the 15th (neither matches)
    expect(matchesCron(new Date('2024-01-23T09:00:00'), cron)).toBe(false)
  })

  it('should match 6-field expression with seconds', () => {
    const cron = parseCron('30 * * * * *') // At second 30
    expect(matchesCron(new Date('2024-01-15T10:30:30'), cron)).toBe(true)
    expect(matchesCron(new Date('2024-01-15T10:30:31'), cron)).toBe(false)
  })
})

describe('getNextCronDate', () => {
  it('should find next minute for * * * * *', () => {
    const cron = parseCron('* * * * *')
    const from = new Date('2024-01-15T10:30:00')
    const next = getNextCronDate(cron, from)
    expect(next).not.toBeNull()
    expect(next!.getTime()).toBeGreaterThan(from.getTime())
  })

  it('should find next occurrence of 0 * * * *', () => {
    const cron = parseCron('0 * * * *')
    const from = new Date('2024-01-15T10:30:00')
    const next = getNextCronDate(cron, from)
    expect(next).not.toBeNull()
    expect(next!.getMinutes()).toBe(0)
    expect(next!.getHours()).toBe(11) // Next hour
  })

  it('should find next Monday for 0 9 * * 1', () => {
    const cron = parseCron('0 9 * * 1')
    // Jan 16, 2024 is a Tuesday
    const from = new Date('2024-01-16T10:00:00')
    const next = getNextCronDate(cron, from)
    expect(next).not.toBeNull()
    expect(next!.getDay()).toBe(1) // Monday
    expect(next!.getHours()).toBe(9)
    expect(next!.getMinutes()).toBe(0)
    // Should be Jan 22, 2024
    expect(next!.getDate()).toBe(22)
  })

  it('should find next 15th for 0 9 15 * *', () => {
    const cron = parseCron('0 9 15 * *')
    const from = new Date('2024-01-16T10:00:00')
    const next = getNextCronDate(cron, from)
    expect(next).not.toBeNull()
    expect(next!.getDate()).toBe(15)
    expect(next!.getMonth()).toBe(1) // February
    expect(next!.getHours()).toBe(9)
  })

  it('should handle year rollover', () => {
    const cron = parseCron('0 0 1 1 *') // Jan 1 at midnight
    const from = new Date('2024-06-15T10:00:00')
    const next = getNextCronDate(cron, from)
    expect(next).not.toBeNull()
    expect(next!.getFullYear()).toBe(2025)
    expect(next!.getMonth()).toBe(0) // January
    expect(next!.getDate()).toBe(1)
  })

  it('should handle */5 step', () => {
    const cron = parseCron('*/5 * * * *')
    const from = new Date('2024-01-15T10:32:00')
    const next = getNextCronDate(cron, from)
    expect(next).not.toBeNull()
    expect(next!.getMinutes()).toBe(35) // Next 5-minute mark
  })
})

describe('getNextCronMs', () => {
  it('should return milliseconds until next occurrence', () => {
    const cron = parseCron('0 * * * *') // Every hour at minute 0
    const from = new Date('2024-01-15T10:30:00')
    const ms = getNextCronMs(cron, from)
    expect(ms).not.toBeNull()
    // Should be ~30 minutes (1800000ms)
    expect(ms).toBe(30 * 60 * 1000)
  })

  it('should return positive milliseconds', () => {
    const cron = parseCron('* * * * *')
    const ms = getNextCronMs(cron)
    expect(ms).not.toBeNull()
    expect(ms).toBeGreaterThan(0)
  })
})
