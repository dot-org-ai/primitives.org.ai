/**
 * Catalog barrel — autonomous-events Services.
 *
 * Ships three Services (`eventProgramCurator`, `partnershipDealOrchestrator`,
 * `eventAttendeeEngagementMonitor`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `eventProgramCurator.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  eventProgramCurator,
  EventProgramCuratorInputSchema,
  EventProgramCuratorOutputSchema,
  type EventProgramCuratorInput,
  type EventProgramCuratorOutput,
} from './event-program-curator.js'

export {
  partnershipDealOrchestrator,
  PartnershipDealInputSchema,
  PartnershipDealOutputSchema,
  type PartnershipDealInput,
  type PartnershipDealOutput,
} from './partnership-deal-orchestrator.js'

export {
  eventAttendeeEngagementMonitor,
  EngagementMonitorInputSchema,
  EngagementMonitorOutputSchema,
  type EngagementMonitorInput,
  type EngagementMonitorOutput,
} from './event-attendee-engagement-monitor.js'
