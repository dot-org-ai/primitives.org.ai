/**
 * Video Conferencing Providers
 *
 * @packageDocumentation
 */

export { zoomInfo, zoomProvider, createZoomProvider } from './zoom.js'
export { googleMeetInfo, googleMeetProvider, createGoogleMeetProvider } from './google-meet.js'
export { teamsInfo, teamsProvider, createTeamsProvider } from './teams.js'
export { jitsiInfo, jitsiProvider, createJitsiProvider } from './jitsi.js'

import { zoomProvider } from './zoom.js'
import { googleMeetProvider } from './google-meet.js'
import { teamsProvider } from './teams.js'
import { jitsiProvider } from './jitsi.js'

/**
 * Register all video conferencing providers
 */
export function registerVideoConferencingProviders(): void {
  zoomProvider.register()
  googleMeetProvider.register()
  teamsProvider.register()
  jitsiProvider.register()
}

/**
 * All video conferencing providers
 */
export const videoConferencingProviders = [
  zoomProvider,
  googleMeetProvider,
  teamsProvider,
  jitsiProvider,
]
