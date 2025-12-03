import { describe, it, expect, beforeEach } from 'vitest'
import {
  every,
  registerScheduleHandler,
  getScheduleHandlers,
  clearScheduleHandlers,
  toCron,
  intervalToMs,
  formatInterval,
  setCronConverter,
} from '../src/every.js'

describe('every - schedule handler registration', () => {
  beforeEach(() => {
    clearScheduleHandlers()
  })

  describe('every.interval pattern', () => {
    it('should register handler for every.hour', () => {
      const handler = () => {}
      every.hour(handler)

      const handlers = getScheduleHandlers()
      expect(handlers).toHaveLength(1)
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 * * * *',
        natural: 'hour',
      })
      expect(handlers[0]?.source).toBeDefined()
    })

    it('should register handler for every.day', () => {
      every.day(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 0 * * *',
        natural: 'day',
      })
    })

    it('should register handler for every.minute', () => {
      every.minute(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '* * * * *',
        natural: 'minute',
      })
    })

    it('should register handler for every.week', () => {
      every.week(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 0 * * 0',
        natural: 'week',
      })
    })
  })

  describe('every.Day pattern', () => {
    it('should register handler for every.Monday', () => {
      every.Monday(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 0 * * 1',
        natural: 'Monday',
      })
    })

    it('should register handler for every.Friday', () => {
      every.Friday(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 0 * * 5',
        natural: 'Friday',
      })
    })

    it('should register handler for every.weekday', () => {
      every.weekday(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 0 * * 1-5',
        natural: 'weekday',
      })
    })

    it('should register handler for every.weekend', () => {
      every.weekend(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 0 * * 0,6',
        natural: 'weekend',
      })
    })
  })

  describe('every.Day.atTime pattern', () => {
    it('should register handler for every.Monday.at9am', () => {
      every.Monday.at9am(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 9 * * 1',
        natural: 'Monday.at9am',
      })
    })

    it('should register handler for every.Friday.at5pm', () => {
      every.Friday.at5pm(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 17 * * 5',
        natural: 'Friday.at5pm',
      })
    })

    it('should register handler for every.weekday.at8am', () => {
      every.weekday.at8am(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 8 * * 1-5',
        natural: 'weekday.at8am',
      })
    })

    it('should register handler for every.Thursday.atnoon', () => {
      every.Thursday.atnoon(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 12 * * 4',
        natural: 'Thursday.atnoon',
      })
    })

    it('should register handler for every.Sunday.atmidnight', () => {
      every.Sunday.atmidnight(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'cron',
        expression: '0 0 * * 0',
        natural: 'Sunday.atmidnight',
      })
    })
  })

  describe('every.units(value) pattern', () => {
    it('should register handler for every.minutes(30)', () => {
      every.minutes(30)(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'minute',
        value: 30,
        natural: '30 minutes',
      })
    })

    it('should register handler for every.hours(4)', () => {
      every.hours(4)(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'hour',
        value: 4,
        natural: '4 hours',
      })
    })

    it('should register handler for every.seconds(10)', () => {
      every.seconds(10)(() => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'second',
        value: 10,
        natural: '10 seconds',
      })
    })
  })

  describe('every(natural language) pattern', () => {
    it('should register handler with natural language description', () => {
      every('first Monday of the month at 9am', () => {})

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.interval).toEqual({
        type: 'natural',
        description: 'first Monday of the month at 9am',
      })
    })

    it('should capture source code', () => {
      every('weekly', async ($) => {
        $.log('weekly task')
      })

      const handlers = getScheduleHandlers()
      expect(handlers[0]?.source).toContain('$.log')
    })
  })

  describe('registerScheduleHandler', () => {
    it('should register handler directly', () => {
      const handler = () => {}
      registerScheduleHandler({ type: 'hour', value: 2 }, handler)

      const handlers = getScheduleHandlers()
      expect(handlers).toHaveLength(1)
      expect(handlers[0]?.interval).toEqual({ type: 'hour', value: 2 })
    })
  })

  describe('clearScheduleHandlers', () => {
    it('should clear all handlers', () => {
      every.hour(() => {})
      every.day(() => {})

      expect(getScheduleHandlers()).toHaveLength(2)

      clearScheduleHandlers()

      expect(getScheduleHandlers()).toHaveLength(0)
    })
  })
})

describe('toCron', () => {
  it('should return known patterns directly', async () => {
    expect(await toCron('hour')).toBe('0 * * * *')
    expect(await toCron('day')).toBe('0 0 * * *')
    expect(await toCron('Monday')).toBe('0 0 * * 1')
    expect(await toCron('weekday')).toBe('0 0 * * 1-5')
  })

  it('should return cron expression if already valid', async () => {
    expect(await toCron('0 9 * * 1-5')).toBe('0 9 * * 1-5')
    expect(await toCron('*/15 * * * *')).toBe('*/15 * * * *')
  })

  it('should throw for unknown patterns without converter', async () => {
    await expect(toCron('every 15 minutes during business hours')).rejects.toThrow(
      'Unknown schedule pattern'
    )
  })

  it('should use custom converter when set', async () => {
    setCronConverter(async (desc) => {
      if (desc.includes('business hours')) {
        return '*/15 9-17 * * 1-5'
      }
      return '* * * * *'
    })

    expect(await toCron('every 15 minutes during business hours')).toBe('*/15 9-17 * * 1-5')

    // Reset converter
    setCronConverter(async () => '* * * * *')
  })
})

describe('intervalToMs', () => {
  it('should convert second intervals', () => {
    expect(intervalToMs({ type: 'second' })).toBe(1000)
    expect(intervalToMs({ type: 'second', value: 5 })).toBe(5000)
  })

  it('should convert minute intervals', () => {
    expect(intervalToMs({ type: 'minute' })).toBe(60000)
    expect(intervalToMs({ type: 'minute', value: 30 })).toBe(1800000)
  })

  it('should convert hour intervals', () => {
    expect(intervalToMs({ type: 'hour' })).toBe(3600000)
    expect(intervalToMs({ type: 'hour', value: 4 })).toBe(14400000)
  })

  it('should convert day intervals', () => {
    expect(intervalToMs({ type: 'day' })).toBe(86400000)
    expect(intervalToMs({ type: 'day', value: 2 })).toBe(172800000)
  })

  it('should convert week intervals', () => {
    expect(intervalToMs({ type: 'week' })).toBe(604800000)
    expect(intervalToMs({ type: 'week', value: 2 })).toBe(1209600000)
  })

  it('should return 0 for cron intervals', () => {
    expect(intervalToMs({ type: 'cron', expression: '0 * * * *' })).toBe(0)
  })

  it('should return 0 for natural intervals', () => {
    expect(intervalToMs({ type: 'natural', description: 'every hour' })).toBe(0)
  })
})

describe('formatInterval', () => {
  it('should format second intervals', () => {
    expect(formatInterval({ type: 'second' })).toBe('every second')
    expect(formatInterval({ type: 'second', value: 5 })).toBe('every 5 seconds')
  })

  it('should format minute intervals', () => {
    expect(formatInterval({ type: 'minute' })).toBe('every minute')
    expect(formatInterval({ type: 'minute', value: 30 })).toBe('every 30 minutes')
  })

  it('should format hour intervals', () => {
    expect(formatInterval({ type: 'hour' })).toBe('every hour')
    expect(formatInterval({ type: 'hour', value: 4 })).toBe('every 4 hours')
  })

  it('should format day intervals', () => {
    expect(formatInterval({ type: 'day' })).toBe('every day')
    expect(formatInterval({ type: 'day', value: 2 })).toBe('every 2 days')
  })

  it('should format week intervals', () => {
    expect(formatInterval({ type: 'week' })).toBe('every week')
    expect(formatInterval({ type: 'week', value: 2 })).toBe('every 2 weeks')
  })

  it('should format cron intervals', () => {
    expect(formatInterval({ type: 'cron', expression: '0 9 * * 1' })).toBe('cron: 0 9 * * 1')
  })

  it('should format natural intervals', () => {
    expect(formatInterval({ type: 'natural', description: 'every hour during business hours' })).toBe(
      'every hour during business hours'
    )
  })

  it('should use natural description when available', () => {
    expect(formatInterval({ type: 'cron', expression: '0 9 * * 1', natural: 'Monday.at9am' })).toBe(
      'Monday.at9am'
    )
  })
})
