/**
 * Messaging Providers
 *
 * @packageDocumentation
 */

export { slackInfo, slackProvider, createSlackProvider } from './slack.js'
export { twilioSmsInfo, twilioSmsProvider, createTwilioSmsProvider } from './twilio-sms.js'

import { slackProvider } from './slack.js'
import { twilioSmsProvider } from './twilio-sms.js'

/**
 * Register all messaging providers
 */
export function registerMessagingProviders(): void {
  slackProvider.register()
  twilioSmsProvider.register()
}

/**
 * All messaging providers
 */
export const messagingProviders = [slackProvider, twilioSmsProvider]
