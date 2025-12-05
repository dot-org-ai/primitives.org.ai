/**
 * Calendar Providers
 *
 * @packageDocumentation
 */

export { googleCalendarInfo, googleCalendarProvider, createGoogleCalendarProvider } from './google-calendar.js'
export { calComInfo, calComProvider, createCalComProvider } from './cal-com.js'

import { googleCalendarProvider } from './google-calendar.js'
import { calComProvider } from './cal-com.js'

/**
 * Register all calendar providers
 */
export function registerCalendarProviders(): void {
  googleCalendarProvider.register()
  calComProvider.register()
}

/**
 * All calendar providers
 */
export const calendarProviders = [googleCalendarProvider, calComProvider]
