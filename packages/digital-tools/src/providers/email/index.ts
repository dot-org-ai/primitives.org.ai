/**
 * Email Providers
 *
 * @packageDocumentation
 */

export { sendgridInfo, sendgridProvider, createSendGridProvider } from './sendgrid.js'
export { resendInfo, resendProvider, createResendProvider } from './resend.js'

import { sendgridProvider } from './sendgrid.js'
import { resendProvider } from './resend.js'

/**
 * Register all email providers
 */
export function registerEmailProviders(): void {
  sendgridProvider.register()
  resendProvider.register()
}

/**
 * All email providers
 */
export const emailProviders = [sendgridProvider, resendProvider]
