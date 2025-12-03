/**
 * Schedule registration using natural language
 *
 * Usage:
 *   every.hour($ => { ... })
 *   every.Thursday.at8am($ => { ... })
 *   every.weekday.at9am($ => { ... })
 *   every('hour during business hours', $ => { ... })
 *   every('first Monday of the month at 9am', $ => { ... })
 */

import type { ScheduleHandler, ScheduleRegistration, ScheduleInterval } from './types.js'

/**
 * Registry of schedule handlers
 */
const scheduleRegistry: ScheduleRegistration[] = []

/**
 * Get all registered schedule handlers
 */
export function getScheduleHandlers(): ScheduleRegistration[] {
  return [...scheduleRegistry]
}

/**
 * Clear all registered schedule handlers
 */
export function clearScheduleHandlers(): void {
  scheduleRegistry.length = 0
}

/**
 * Register a schedule handler directly
 */
export function registerScheduleHandler(
  interval: ScheduleInterval,
  handler: ScheduleHandler
): void {
  scheduleRegistry.push({ interval, handler })
}

/**
 * Well-known cron patterns for common schedules
 */
const KNOWN_PATTERNS: Record<string, string> = {
  // Time units
  'second': '* * * * * *',
  'minute': '* * * * *',
  'hour': '0 * * * *',
  'day': '0 0 * * *',
  'week': '0 0 * * 0',
  'month': '0 0 1 * *',
  'year': '0 0 1 1 *',

  // Days of week
  'Monday': '0 0 * * 1',
  'Tuesday': '0 0 * * 2',
  'Wednesday': '0 0 * * 3',
  'Thursday': '0 0 * * 4',
  'Friday': '0 0 * * 5',
  'Saturday': '0 0 * * 6',
  'Sunday': '0 0 * * 0',

  // Common patterns
  'weekday': '0 0 * * 1-5',
  'weekend': '0 0 * * 0,6',
  'midnight': '0 0 * * *',
  'noon': '0 12 * * *',
}

/**
 * Time suffixes for day-based schedules
 */
const TIME_PATTERNS: Record<string, { hour: number; minute: number }> = {
  'at6am': { hour: 6, minute: 0 },
  'at7am': { hour: 7, minute: 0 },
  'at8am': { hour: 8, minute: 0 },
  'at9am': { hour: 9, minute: 0 },
  'at10am': { hour: 10, minute: 0 },
  'at11am': { hour: 11, minute: 0 },
  'at12pm': { hour: 12, minute: 0 },
  'atnoon': { hour: 12, minute: 0 },
  'at1pm': { hour: 13, minute: 0 },
  'at2pm': { hour: 14, minute: 0 },
  'at3pm': { hour: 15, minute: 0 },
  'at4pm': { hour: 16, minute: 0 },
  'at5pm': { hour: 17, minute: 0 },
  'at6pm': { hour: 18, minute: 0 },
  'at7pm': { hour: 19, minute: 0 },
  'at8pm': { hour: 20, minute: 0 },
  'at9pm': { hour: 21, minute: 0 },
  'atmidnight': { hour: 0, minute: 0 },
}

/**
 * Parse a known pattern or return null
 */
function parseKnownPattern(pattern: string): string | null {
  return KNOWN_PATTERNS[pattern] ?? null
}

/**
 * Combine a day pattern with a time pattern
 */
function combineWithTime(baseCron: string, time: { hour: number; minute: number }): string {
  const parts = baseCron.split(' ')
  parts[0] = String(time.minute)
  parts[1] = String(time.hour)
  return parts.join(' ')
}

/**
 * AI-powered cron conversion (placeholder - will use ai-functions)
 */
let cronConverter: ((description: string) => Promise<string>) | null = null

/**
 * Set the AI cron converter function
 */
export function setCronConverter(converter: (description: string) => Promise<string>): void {
  cronConverter = converter
}

/**
 * Convert natural language to cron expression
 */
export async function toCron(description: string): Promise<string> {
  // First check known patterns
  const known = parseKnownPattern(description)
  if (known) return known

  // If we have an AI converter, use it
  if (cronConverter) {
    return cronConverter(description)
  }

  // Otherwise, assume it's already a cron expression or throw
  if (/^[\d\*\-\/\,\s]+$/.test(description)) {
    return description
  }

  throw new Error(
    `Unknown schedule pattern: "${description}". ` +
    `Set up AI conversion with setCronConverter() for natural language schedules.`
  )
}

/**
 * Create a time accessor for a day pattern
 */
function createTimeAccessor(dayPattern: string) {
  return new Proxy({} as Record<string, (handler: ScheduleHandler) => void>, {
    get(_target, timeKey: string) {
      const time = TIME_PATTERNS[timeKey]
      if (time) {
        const cron = combineWithTime(dayPattern, time)
        return (handler: ScheduleHandler) => {
          registerScheduleHandler({ type: 'cron', expression: cron, natural: `${dayPattern} ${timeKey}` }, handler)
        }
      }
      // If not a known time, treat as handler function directly
      return (handler: ScheduleHandler) => {
        registerScheduleHandler({ type: 'cron', expression: dayPattern, natural: dayPattern }, handler)
      }
    }
  })
}

/**
 * Create the `every` proxy
 */
function createEveryProxy() {
  const handler = {
    get(_target: unknown, prop: string) {
      // Check if it's a known pattern
      const pattern = KNOWN_PATTERNS[prop]
      if (pattern) {
        // Return an object that can either be called directly or have time accessors
        const result = (handlerFn: ScheduleHandler) => {
          registerScheduleHandler({ type: 'cron', expression: pattern, natural: prop }, handlerFn)
        }
        // Add time accessors
        return new Proxy(result, {
          get(_t, timeKey: string) {
            const time = TIME_PATTERNS[timeKey]
            if (time) {
              const cron = combineWithTime(pattern, time)
              return (handlerFn: ScheduleHandler) => {
                registerScheduleHandler({ type: 'cron', expression: cron, natural: `${prop}.${timeKey}` }, handlerFn)
              }
            }
            return undefined
          },
          apply(_t, _thisArg, args) {
            registerScheduleHandler({ type: 'cron', expression: pattern, natural: prop }, args[0])
          }
        })
      }

      // Check for plural time units (e.g., seconds(5), minutes(30))
      const pluralUnits: Record<string, string> = {
        seconds: 'second',
        minutes: 'minute',
        hours: 'hour',
        days: 'day',
        weeks: 'week',
      }
      if (pluralUnits[prop]) {
        return (value: number) => (handlerFn: ScheduleHandler) => {
          registerScheduleHandler({ type: pluralUnits[prop] as any, value, natural: `${value} ${prop}` }, handlerFn)
        }
      }

      return undefined
    },

    apply(_target: unknown, _thisArg: unknown, args: unknown[]) {
      // Called as every('natural language description', handler)
      const [description, handler] = args as [string, ScheduleHandler]

      if (typeof description === 'string' && typeof handler === 'function') {
        // Register with natural language - will be converted to cron at runtime
        registerScheduleHandler({ type: 'natural', description }, handler)
      }
    }
  }

  return new Proxy(function() {} as any, handler)
}

/**
 * The `every` function/object for registering scheduled handlers
 *
 * @example
 * ```ts
 * import { every } from 'ai-workflows'
 *
 * // Simple intervals
 * every.hour($ => console.log('Hourly task'))
 * every.day($ => console.log('Daily task'))
 *
 * // Day + time combinations
 * every.Monday.at9am($ => console.log('Monday morning standup'))
 * every.weekday.at8am($ => console.log('Workday start'))
 * every.Friday.at5pm($ => console.log('End of week report'))
 *
 * // Plural intervals with values
 * every.minutes(30)($ => console.log('Every 30 minutes'))
 * every.hours(4)($ => console.log('Every 4 hours'))
 *
 * // Natural language (requires AI converter)
 * every('hour during business hours', $ => { ... })
 * every('first Monday of the month at 9am', $ => { ... })
 * every('every 15 minutes between 9am and 5pm on weekdays', $ => { ... })
 * ```
 */
export const every = createEveryProxy()

/**
 * Convert interval to milliseconds (for simulation/testing)
 */
export function intervalToMs(interval: ScheduleInterval): number {
  switch (interval.type) {
    case 'second':
      return (interval.value ?? 1) * 1000
    case 'minute':
      return (interval.value ?? 1) * 60 * 1000
    case 'hour':
      return (interval.value ?? 1) * 60 * 60 * 1000
    case 'day':
      return (interval.value ?? 1) * 24 * 60 * 60 * 1000
    case 'week':
      return (interval.value ?? 1) * 7 * 24 * 60 * 60 * 1000
    case 'cron':
    case 'natural':
      // Cron/natural expressions need special handling
      return 0
  }
}

/**
 * Format interval for display
 */
export function formatInterval(interval: ScheduleInterval): string {
  if ('natural' in interval && interval.natural) {
    return interval.natural
  }

  switch (interval.type) {
    case 'second':
      return interval.value && interval.value > 1
        ? `every ${interval.value} seconds`
        : 'every second'
    case 'minute':
      return interval.value && interval.value > 1
        ? `every ${interval.value} minutes`
        : 'every minute'
    case 'hour':
      return interval.value && interval.value > 1
        ? `every ${interval.value} hours`
        : 'every hour'
    case 'day':
      return interval.value && interval.value > 1
        ? `every ${interval.value} days`
        : 'every day'
    case 'week':
      return interval.value && interval.value > 1
        ? `every ${interval.value} weeks`
        : 'every week'
    case 'cron':
      return `cron: ${interval.expression}`
    case 'natural':
      return interval.description
  }
}
