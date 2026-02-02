/**
 * Cron Expression Parser
 *
 * Parses standard 5-field cron expressions:
 *   minute hour day-of-month month day-of-week
 *
 * Also supports optional 6-field expressions with seconds:
 *   second minute hour day-of-month month day-of-week
 *
 * Supported syntax:
 *   - Numbers: 0, 5, 15
 *   - Ranges: 1-5, 9-17
 *   - Lists: 1,3,5, Mon,Wed,Fri
 *   - Steps: star/5, 0-30/5
 *   - Wildcards: star (asterisk)
 *   - Day names: Mon, Tue, Wed, Thu, Fri, Sat, Sun
 *   - Month names: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
 */

/**
 * Parsed cron expression
 */
export interface ParsedCron {
  /** Seconds (0-59) - optional, defaults to [0] */
  seconds: number[]
  /** Minutes (0-59) */
  minutes: number[]
  /** Hours (0-23) */
  hours: number[]
  /** Days of month (1-31) */
  daysOfMonth: number[]
  /** Months (1-12) */
  months: number[]
  /** Days of week (0-6, Sunday = 0) */
  daysOfWeek: number[]
  /** Whether day of month is a wildcard */
  dayOfMonthWildcard: boolean
  /** Whether day of week is a wildcard */
  dayOfWeekWildcard: boolean
}

/**
 * Day name to number mapping (Sunday = 0)
 */
const DAY_NAMES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

/**
 * Month name to number mapping (January = 1)
 */
const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

/**
 * Parse a single cron field value
 */
function parseFieldValue(
  value: string,
  min: number,
  max: number,
  names?: Record<string, number>
): number {
  // Check for named value (e.g., Mon, Jan)
  if (names) {
    const lower = value.toLowerCase()
    if (lower in names) {
      return names[lower]!
    }
  }

  const num = parseInt(value, 10)
  if (isNaN(num) || num < min || num > max) {
    throw new Error(`Invalid cron field value: ${value} (expected ${min}-${max})`)
  }
  return num
}

/**
 * Parse a single cron field
 * Examples: "0", "*", "1-5", "* /15" (no space), "1,3,5"
 */
function parseField(
  field: string,
  min: number,
  max: number,
  names?: Record<string, number>
): number[] {
  const values: Set<number> = new Set()

  // Split by comma for lists
  const parts = field.split(',')

  for (const part of parts) {
    // Check for step (e.g., */5 or 0-30/5)
    const stepMatch = part.match(/^(.+)\/(\d+)$/)
    const step = stepMatch ? parseInt(stepMatch[2]!, 10) : 1
    const range = stepMatch ? stepMatch[1]! : part

    let start: number
    let end: number

    if (range === '*') {
      start = min
      end = max
    } else if (range.includes('-')) {
      // Range (e.g., 1-5)
      const [rangeStart, rangeEnd] = range.split('-')
      start = parseFieldValue(rangeStart!, min, max, names)
      end = parseFieldValue(rangeEnd!, min, max, names)
    } else {
      // Single value
      start = parseFieldValue(range, min, max, names)
      end = start
    }

    // Generate values with step
    for (let i = start; i <= end; i += step) {
      values.add(i)
    }
  }

  return Array.from(values).sort((a, b) => a - b)
}

/**
 * Parse a cron expression
 *
 * @param expression - Cron expression (5 or 6 fields)
 * @returns ParsedCron object
 * @throws Error if expression is invalid
 */
export function parseCron(expression: string): ParsedCron {
  const fields = expression.trim().split(/\s+/)

  if (fields.length < 5 || fields.length > 6) {
    throw new Error(`Invalid cron expression: expected 5 or 6 fields, got ${fields.length}`)
  }

  // Determine if we have seconds field
  const hasSeconds = fields.length === 6
  const offset = hasSeconds ? 0 : -1

  const secondsField = hasSeconds ? fields[0]! : '0'
  const minutesField = fields[offset + 1]!
  const hoursField = fields[offset + 2]!
  const daysOfMonthField = fields[offset + 3]!
  const monthsField = fields[offset + 4]!
  const daysOfWeekField = fields[offset + 5]!

  return {
    seconds: parseField(secondsField, 0, 59),
    minutes: parseField(minutesField, 0, 59),
    hours: parseField(hoursField, 0, 23),
    daysOfMonth: parseField(daysOfMonthField, 1, 31),
    months: parseField(monthsField, 1, 12, MONTH_NAMES),
    daysOfWeek: parseField(daysOfWeekField, 0, 6, DAY_NAMES),
    dayOfMonthWildcard: daysOfMonthField === '*',
    dayOfWeekWildcard: daysOfWeekField === '*',
  }
}

/**
 * Check if a date matches a parsed cron expression
 */
export function matchesCron(date: Date, cron: ParsedCron): boolean {
  const second = date.getSeconds()
  const minute = date.getMinutes()
  const hour = date.getHours()
  const dayOfMonth = date.getDate()
  const month = date.getMonth() + 1 // JavaScript months are 0-indexed
  const dayOfWeek = date.getDay()

  // Check basic fields
  if (!cron.seconds.includes(second)) return false
  if (!cron.minutes.includes(minute)) return false
  if (!cron.hours.includes(hour)) return false
  if (!cron.months.includes(month)) return false

  // Handle day matching (special cron semantics)
  // If both day-of-month and day-of-week are specified (not wildcards),
  // either one matching is sufficient (OR logic)
  // If only one is specified, that one must match
  const domMatches = cron.daysOfMonth.includes(dayOfMonth)
  const dowMatches = cron.daysOfWeek.includes(dayOfWeek)

  if (cron.dayOfMonthWildcard && cron.dayOfWeekWildcard) {
    // Both wildcards - any day matches
    return true
  } else if (cron.dayOfMonthWildcard) {
    // Only day-of-week specified
    return dowMatches
  } else if (cron.dayOfWeekWildcard) {
    // Only day-of-month specified
    return domMatches
  } else {
    // Both specified - OR logic (standard cron behavior)
    return domMatches || dowMatches
  }
}

/**
 * Find the next date that matches a cron expression
 *
 * @param cron - Parsed cron expression
 * @param from - Start date (defaults to now)
 * @param maxIterations - Maximum iterations to prevent infinite loops
 * @returns Next matching Date or null if not found within iterations
 */
export function getNextCronDate(
  cron: ParsedCron,
  from: Date = new Date(),
  maxIterations: number = 366 * 24 * 60 // ~1 year of minutes
): Date | null {
  // Start from the next second
  const next = new Date(from.getTime())
  next.setMilliseconds(0)
  next.setSeconds(next.getSeconds() + 1)

  let iterations = 0

  while (iterations < maxIterations) {
    iterations++

    // Check if current time matches
    if (matchesCron(next, cron)) {
      return next
    }

    // Advance to next possible match
    // Start by advancing the smallest unit that doesn't match

    // Check seconds
    if (!cron.seconds.includes(next.getSeconds())) {
      const nextSecond = findNextValue(next.getSeconds(), cron.seconds)
      if (nextSecond !== null) {
        next.setSeconds(nextSecond)
      } else {
        // Roll over to next minute
        next.setSeconds(cron.seconds[0]!)
        next.setMinutes(next.getMinutes() + 1)
      }
      continue
    }

    // Check minutes
    if (!cron.minutes.includes(next.getMinutes())) {
      const nextMinute = findNextValue(next.getMinutes(), cron.minutes)
      if (nextMinute !== null) {
        next.setMinutes(nextMinute)
        next.setSeconds(cron.seconds[0]!)
      } else {
        // Roll over to next hour
        next.setMinutes(cron.minutes[0]!)
        next.setSeconds(cron.seconds[0]!)
        next.setHours(next.getHours() + 1)
      }
      continue
    }

    // Check hours
    if (!cron.hours.includes(next.getHours())) {
      const nextHour = findNextValue(next.getHours(), cron.hours)
      if (nextHour !== null) {
        next.setHours(nextHour)
        next.setMinutes(cron.minutes[0]!)
        next.setSeconds(cron.seconds[0]!)
      } else {
        // Roll over to next day
        next.setHours(cron.hours[0]!)
        next.setMinutes(cron.minutes[0]!)
        next.setSeconds(cron.seconds[0]!)
        next.setDate(next.getDate() + 1)
      }
      continue
    }

    // Check month
    if (!cron.months.includes(next.getMonth() + 1)) {
      const nextMonth = findNextValue(next.getMonth() + 1, cron.months)
      if (nextMonth !== null) {
        next.setMonth(nextMonth - 1)
        next.setDate(1)
        next.setHours(cron.hours[0]!)
        next.setMinutes(cron.minutes[0]!)
        next.setSeconds(cron.seconds[0]!)
      } else {
        // Roll over to next year
        next.setFullYear(next.getFullYear() + 1)
        next.setMonth(cron.months[0]! - 1)
        next.setDate(1)
        next.setHours(cron.hours[0]!)
        next.setMinutes(cron.minutes[0]!)
        next.setSeconds(cron.seconds[0]!)
      }
      continue
    }

    // Day checks are complex due to OR semantics
    // Just advance by one day and re-check
    next.setDate(next.getDate() + 1)
    next.setHours(cron.hours[0]!)
    next.setMinutes(cron.minutes[0]!)
    next.setSeconds(cron.seconds[0]!)
  }

  return null
}

/**
 * Find the next value in a sorted array that is greater than the current value
 */
function findNextValue(current: number, values: number[]): number | null {
  for (const value of values) {
    if (value > current) {
      return value
    }
  }
  return null
}

/**
 * Calculate milliseconds until the next cron occurrence
 */
export function getNextCronMs(cron: ParsedCron, from: Date = new Date()): number | null {
  const next = getNextCronDate(cron, from)
  if (!next) return null
  return next.getTime() - from.getTime()
}
